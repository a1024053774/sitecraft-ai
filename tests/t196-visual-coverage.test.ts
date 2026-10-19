import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { checkSiteCode } from '../lib/code-site-check.ts';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import { renderSiteCode, type SiteCode } from '../lib/code-site.ts';
import { codeCheckDocument } from './fixtures/code-check-document.ts';

// 原输入来自复审三；预期来自访客原样绘制：浅灰碰撞、视口左侧裁字。
// 对照保留 aria/details/小盒/生成内容，只消除碰撞、低对比或越界。
const inputs: Record<string, SiteCode> = JSON.parse(await readFile(new URL('./fixtures/t196-review3-inputs.json', import.meta.url), 'utf8'));
let unexpected = 0;
const server = createServer((req, res) => {
  if (req.url !== '/code-check.html') { unexpected++; res.writeHead(404); res.end(); return; }
  res.setHeader('content-type', 'text/html'); res.end(codeCheckDocument);
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
process.env.SITECRAFT_BASE = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const out = `artifacts/t196/probes-${Date.now()}-${process.pid}`;
await mkdir(out, { recursive: true });
console.log(`T-196 证据：${out}`);
test.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); assert.equal(unexpected, 0); });
const widths = [375, 768, 1440];
async function run(name: string, code: SiteCode, capture = false, translationSource?: SiteCode) {
  const checked = await checkSiteCode({ siteId: 't196', code, materials: 'Visibility VISIBLE COLLISION Details content OVERLAP 30 L/min', images: [], legacyImport: true, translationSource });
  await writeFile(`${out}/${name}-checks.json`, JSON.stringify(checked, null, 2), 'utf8');
  if (capture) {
    const browser = await codeCheckBrowser();
    const observations = [];
    try {
      await browser.loadPage('Page.navigate', { url: `${process.env.SITECRAFT_BASE}/code-check.html` });
      const { frameTree } = await browser.send<{ frameTree: { frame: { id: string } } }>('Page.getFrameTree');
      for (const width of widths) {
        await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 300, deviceScaleFactor: 1, mobile: false });
        await browser.send('Page.setDocumentContent', { frameId: frameTree.frame.id, html: renderSiteCode('t196', checked.code, 'home') });
        await browser.evaluate('document.fonts.ready');
        observations.push({ width, ...await browser.evaluate<Record<string, unknown>>(`(() => {
          const el=document.getElementById('probe'),s=getComputedStyle(el),p=getComputedStyle(el,'::before');
          const range=document.createRange();range.selectNodeContents(el);const r=range.getBoundingClientRect();
          return {visibility:s.visibility,display:s.display,aria:el.getAttribute('aria-hidden'),open:el.closest('details')?.open,
            range:{left:r.left,right:r.right,width:r.width,height:r.height},pseudo:{content:p.content,visibility:p.visibility,color:p.color},
            hit:document.elementsFromPoint(25,75).includes(el)};
        })()`) });
        const { data } = await browser.send<{ data: string }>('Page.captureScreenshot', { format: 'png' });
        await writeFile(`${out}/${name}-${width}.png`, Buffer.from(data, 'base64'));
      }
    } finally { await browser.close(); }
    await writeFile(`${out}/${name}-visitor.json`, JSON.stringify(observations, null, 2), 'utf8');
  }
  return checked.checks;
}

test('aria 属性保留：按属性恢复可见的文字与不依赖属性的对照均拒收；正常排版通过', async () => {
  const failures: string[] = [];
  for (const name of ['aria-visibility', 'aria-display', 'aria-control']) {
    const code = inputs[name], bad = await run(name, code, true);
    for (const width of widths) {
      const v = bad.viewports.find(v => v.width === width)!;
      if (!(v.overlaps > 0 && v.contrastIssues > 0)) failures.push(`${name}/${width} 漏检访客可见碰撞或浅灰文字`);
    }
    const good = await run(`${name}-safe`, { ...code, css: code.css + '#probe{top:40px;color:#111}' });
    assert.equal(good.passed, true, JSON.stringify(good.issues));
  }
  assert.deepEqual(failures, []);
});

test('details 默认关闭与展开均扫描：summary 两种隐藏方式不掩盖关闭时碰撞；安全折叠通过', async () => {
  const failures: string[] = [];
  for (const name of ['details-summary-isolated', 'details-summary-visibility']) {
    const code = inputs[name], bad = await run(name, code, true);
    for (const width of widths) {
      const v = bad.viewports.find(v => v.width === width)!;
      if (!(v.overlaps > 0 && v.contrastIssues > 0)) failures.push(`${name}/${width} 漏检关闭时的 summary`);
    }
    const good = await run(`${name}-safe`, { ...code, css: code.css + '#probe{top:20px;color:#111}' });
    assert.equal(good.passed, true, JSON.stringify(good.issues));
  }
  assert.deepEqual(failures, []);
});

test('微小与零盒仍检查文字水平边界：负向和正向越界拒收；同尺寸视口内通过', async () => {
  const failures: string[] = [];
  for (const name of ['overflow-tiny', 'overflow-zero', 'overflow-normal-negative', 'overflow-tiny-positive']) {
    const code = inputs[name], bad = await run(name, code, true);
    for (const width of name.endsWith('positive') ? [375] : widths) {
      if (!bad.issues.includes(`home/${width} 横向溢出`)) failures.push(`${name}/${width} 漏检可见文字越界`);
    }
    const good = await run(`${name}-safe`, { ...code, css: code.css + '#probe{left:0}' });
    assert.equal(good.passed, true, JSON.stringify(good.issues));
  }
  assert.deepEqual(failures, []);
});

test('生成文字自身可见性：正常宿主与隐藏宿主恢复 visible 均测量或明确拒收；安全生成文字通过', async () => {
  const failures: string[] = [];
  for (const name of ['pseudo-visible', 'pseudo-visibility-restored']) {
    const code = inputs[name], bad = await run(name, code, true);
    for (const width of widths) {
      const v = bad.viewports.find(v => v.width === width)!;
      if (!(v.overlaps > 0 && v.contrastIssues > 0) && !bad.issues.some(i => i.includes(`home/${width}`) && /生成文字.*无法/.test(i))) failures.push(`${name}/${width} 生成文字未测量也未明确拒收`);
      if (!bad.layoutRepairs?.some(repair => repair.generatedPositions?.some(position => position.pageId === 'home' && position.width === width && position.pseudo === '::before' && position.path.join('/') === '1/0/1/1') && repair.reason?.includes('无法核实'))) failures.push(`${name}/${width} 未保存 T-173 位置或未明确拒绝不安全修正`);
    }
    const good = await run(`${name}-safe`, { ...code, css: code.css + '#probe{top:40px}#probe::before{color:#111}' });
    assert.equal(good.passed, true, JSON.stringify(good.issues));
  }
  // 相同的已知数值在默认态出现、展开态消失；译文未改它，不能误报新增。
  const rawSource: SiteCode = { header: '', footer: '',
    css: 'body{margin:0;color:#111;background:#fff;font:16px/24px sans-serif}main{padding:20px}summary::before{content:"30 L/min";margin-right:1em}details[open] summary::before{content:none}',
    pages: [{ id: 'home', title: 'Flow', html: '<main><h1>Flow</h1><details><summary>Rate</summary><p>Details content</p></details></main>' }] };
  const normalized = await checkSiteCode({ siteId: 't196', code: rawSource, materials: 'Flow Rate Details content 30 L/min', images: [], legacyImport: true });
  assert.equal(normalized.checks.passed, true, JSON.stringify(normalized.checks.issues));
  const source = normalized.code;
  const same = await run('pseudo-translation-same', source, false, source);
  assert.equal(same.passed, true, JSON.stringify(same.issues));
  const changed = await run('pseudo-translation-changed', { ...source, css: source.css.replace('30 L/min', '30 L/h') }, false, source);
  assert.equal(changed.passed, false, '改变已知单位仍须由 CSS 保真检查拒收');
  assert.match(changed.issues.join('\n'), /CSS.*保真/);
  assert.deepEqual(failures, []);
});
