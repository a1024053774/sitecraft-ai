import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { checkSiteCode } from '../lib/code-site-check.ts';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import { readGeneratedLayout } from '../lib/code-site-generated-layout.ts';
import { codeRepairFragments } from '../lib/code-site-repair.ts';
import { renderSiteCode, type SiteCode } from '../lib/code-site.ts';
import { codeCheckDocument } from './fixtures/code-check-document.ts';

// 仅复制 review5 原输入，不复制其检查答案。七个反例的可见性由独立访客截图确认；
// 其余期望来自 T-199 的保守合同，不把有意拒收冒称为实际低对比度。
const inputs: Record<string, SiteCode> = JSON.parse(await readFile(new URL('./fixtures/t199-review5-inputs.json', import.meta.url), 'utf8'));
const widths = [375, 768, 1440];
const out = `artifacts/t199/probes-${Date.now()}-${process.pid}`;
await mkdir(out, { recursive: true });
console.log(`T-199 证据：${out}`);
let unexpected = 0;
const server = createServer((req, res) => {
  if (req.url !== '/code-check.html') { unexpected++; res.writeHead(404); res.end(); return; }
  res.setHeader('content-type', 'text/html'); res.end(codeCheckDocument);
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
process.env.SITECRAFT_BASE = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
test.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); assert.equal(unexpected, 0); });
const source = (await readFile('scripts/visitor-layout-scan.js', 'utf8')).replace('export function', 'function').replace('export default scanVisitorLayout;', '');
type Entry = { element: string; key: string; status: string; ratio: number | null; reason?: string };
async function run(name: string, code: SiteCode, rejected: boolean, category?: string, capture = false) {
  const result = await checkSiteCode({ siteId: 't199', code, materials: 'VISIBLE TEXT', images: [], legacyImport: true });
  await writeFile(`${out}/${name}-checks.json`, JSON.stringify(result, null, 2), 'utf8');
  const observations: Array<{ width: number; entries: Entry[] }> = [];
  if (capture) {
    const browser = await codeCheckBrowser();
    try {
      await browser.loadPage('Page.navigate', { url: `${process.env.SITECRAFT_BASE}/code-check.html` });
      const { frameTree } = await browser.send<{ frameTree: { frame: { id: string } } }>('Page.getFrameTree');
      for (const width of widths) {
        await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 300, deviceScaleFactor: 1, mobile: false });
        await browser.send('Page.setDocumentContent', { frameId: frameTree.frame.id, html: renderSiteCode('t199', result.code, 'home') });
        await browser.evaluate('document.fonts.ready');
        const generated = await readGeneratedLayout(browser);
        const entries = await browser.evaluate<Entry[]>(`(() => {${source};return scanVisitorLayout(document,{},${JSON.stringify(generated)}).textContrast.filter(t=>t.element==='probe'||t.key.endsWith('::before'));})()`);
        observations.push({ width, entries });
        const { data } = await browser.send<{ data: string }>('Page.captureScreenshot', { format: 'png' });
        await writeFile(`${out}/${name}-${width}.png`, Buffer.from(data, 'base64'));
      }
    } finally { await browser.close(); }
    await writeFile(`${out}/${name}-visitor.json`, JSON.stringify(observations, null, 2), 'utf8');
  }
  assert.deepEqual(result.checks.viewports.map(v => v.width), widths);
  // 先保存所有三档结果，父版某一档放行也不会让其余输入或证据缺失。
  if (rejected) {
    for (const width of widths) {
      const repairs = result.checks.layoutRepairs?.filter(r => r.issue.startsWith(`home/${width} `) && r.issue.includes(category!)) ?? [];
      assert.ok(repairs.length, `${name}/${width} 必须以 ${category} 无法测量拒收；${JSON.stringify(result.checks)}`);
      assert.ok(repairs.every(r => r.reason && /无法核实.*修正.*范围/.test(r.reason)), '未知影响范围不得开放修正');
      assert.ok(repairs.every(r => r.elements.length || r.generatedPositions?.length), '沿用本次结构化失败位置');
    }
    for (const observation of observations) {
      assert.ok(observation.entries.length, '不可删除受效果影响的文字');
      assert.ok(observation.entries.every(e => e.status === 'unmeasured' && e.ratio === null && e.reason?.includes(category!)));
    }
    await assert.rejects(codeRepairFragments(result.code, result.checks.issues, [], [], result.checks.layoutRepairs), /无法核实|无法定位/);
  }
  assert.equal(result.checks.passed, !rejected, `${name}: ${JSON.stringify(result.checks.issues)}`);
  if (!rejected) assert.ok(result.checks.viewports.every(v => v.contrastIssues === 0));
}
const core: Array<[string, string]> = [
  ['dom-firstline-low', 'first-line'], ['dom-firstletter-low', 'first-letter'],
  ['before-filter-opacity', 'filter'], ['ancestor-filter-opacity', 'filter'],
  ['before-mask-transparent', 'mask'], ['before-text-stroke', 'text-stroke'], ['before-clip-path', 'clip-path'],
];
for (const [name, category] of core) {
  test(`review5 ${name} 三档拒收`, () => run(name, inputs[name], true, category, true));
  test(`review5 ${name} 去掉效果的正常对照`, () => run(`${name}-control`, name.startsWith('dom-')
    ? { ...inputs[name], css: inputs[name].css.replace(/#probe::first-(?:line|letter)\{[^}]*\}/g, '') }
    : inputs['safe-before'], false, undefined, true));
}
const dom = { ...inputs['dom-firstline-low'], css: inputs['dom-firstline-low'].css.replace(/#probe::first-line\{[^}]*\}/g, '') };
// 风险面：真实文字与生成文字、作用元素与深层祖先、none/0 边界、仅字重分片、
// mask 简写、嵌套/条件首行规则，以及完整与不完整 sr-only；均走生产提交检查。
const effects: Array<[string, string]> = [
  ['filter', 'filter:blur(0px)'], ['mask', 'mask:linear-gradient(black,black)'],
  ['clip-path', 'clip-path:inset(0)'], ['text-stroke', '-webkit-text-stroke:1px #111'],
];
for (const [kind, base] of [['dom', dom], ['generated', inputs['safe-before']]] as const) {
  for (const [category, declaration] of effects) for (const target of ['#probe', '.outer']) {
    test(`${kind} ${target} ${category} 不分析效果一律拒收`, () => run(`${kind}-${target.slice(1)}-${category}`, { ...base, css: base.css + `${target}{${declaration}}` }, true, category));
  }
  test(`${kind} none 和零描边仍通过`, () => run(`${kind}-none-zero`, { ...base, css: base.css + '.outer,#probe,#probe::before{filter:none;mask:none;clip-path:none;-webkit-text-stroke:0 white}' }, false));
}
for (const fragment of ['first-line', 'first-letter']) {
  test(`DOM ${fragment} 只改字重通过`, () => run(`dom-${fragment}-weight-safe`, { ...dom, css: dom.css + `#probe::${fragment}{font-weight:700}` }, false, undefined, true));
  for (const target of ['#probe', '.outer']) for (const [property, value] of [['color', '#eee'], ['background', '#fff'], ['opacity', '.05']]) {
    test(`DOM ${target} ${fragment} ${property} 拒收`, () => run(`dom-${target.slice(1)}-${fragment}-${property}`, { ...dom, css: dom.css + `${target}::${fragment}{${property}:${value}}` }, true, fragment));
  }
}
for (const [name, rule] of [
  ['nested', '.outer { &::first-line{color:#eee} }'],
  ['media', '@media(min-width:1px){.outer::first-letter{color:#eee}}'],
]) test(`${name} 首行首字母规则不绕过`, () => run(name, { ...dom, css: dom.css + rule }, true, 'first-'));
for (const clip of ['clip-path:inset(50%)', 'clip:rect(0 0 0 0)']) {
  test(`完整 sr-only ${clip} 不拒收`, () => run(`sr-only-${clip.startsWith('clip-path') ? 'path' : 'rect'}`, { ...dom, css: dom.css + `#probe{position:absolute;width:1px;height:1px;min-height:0;overflow:hidden;${clip}}` }, false, undefined, true));
}

// review1 P2-1：参数不创建遮罩图像；每个计算图层都是 none 才算无图遮罩。
// 仅复制独立复审原输入，预期来自用户合同及报告的实际访客绘制。
const masks: Record<string, SiteCode> = JSON.parse(await readFile(new URL('./fixtures/t199-review1-mask-inputs.json', import.meta.url), 'utf8'));
const noImageMasks: Array<[string, SiteCode]> = ['mask-none-size', 'mask-none-mode', 'mask-none-position', 'mask-none-generated', 'mask-none-list']
  .map(name => [name, masks[name]]);
noImageMasks.push(
  ['mask-none-list-generated', { ...masks['mask-none-generated'], css: masks['mask-none-generated'].css + '#probe::before{mask-image:none,none,none;mask-mode:luminance}' }],
  ['webkit-mask-none-ancestor', { ...masks['mask-none-size'], css: masks['mask-none-size'].css + '.outer{-webkit-mask-image:none,none;mask-position:10px;mask-size:cover}' }],
);
for (const [name, code] of noImageMasks) test(`review1 无图遮罩 ${name} 三档通过`, async () => {
  await run(name, code, false, undefined, true);
  const observations = JSON.parse(await readFile(`${out}/${name}-visitor.json`, 'utf8')) as Array<{ width: number; entries: Entry[] }>;
  for (const observation of observations) {
    assert.ok(observation.entries.length, `${name}/${observation.width} 必须保留实际文字`);
    assert.ok(observation.entries.every(e => e.status === 'measured' && e.ratio !== null && e.ratio >= 4.5), '不能以删除文字代替正常测量');
  }
});
for (const name of ['webkit-mask-shorthand', 'webkit-mask-image-generated', 'mask-shorthand-ancestor']) {
  test(`review1 有图遮罩 ${name} 仍拒收`, () => run(name, masks[name], true, 'mask', true));
}
for (const layers of ['none,linear-gradient(black,black)', 'linear-gradient(black,black),none']) {
  test(`review1 混合图层 ${layers} 仍拒收`, () => run(`mask-mixed-${layers.startsWith('none') ? 'last' : 'first'}`, {
    ...masks['mask-none-size'], css: masks['mask-none-size'].css + `#probe{mask-image:${layers}}`,
  }, true, 'mask', true));
}
