import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { checkSiteCode } from '../lib/code-site-check.ts';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import { renderSiteCode, type SiteCode } from '../lib/code-site.ts';

const out = `artifacts/t198/review1/contract-${Date.now()}-${process.pid}`;
await mkdir(out, { recursive: true });
const text = '采购前请确认材料适用范围';
const make = (css = '', html = `<div class="clip"><p id="target">${text}</p></div>`): SiteCode => ({ header: '', footer: '',
  css: `body{margin:0;background:white;color:#111;font:16px/2 monospace}main{padding:24px}h1{font-size:24px}p{margin:0}#target{width:1em}${css}`,
  pages: [{ id: 'home', title: '审查样本', html: `<main><h1>审查样本</h1>${html}</main>` }] });
const run = async (id: string, code: SiteCode) => {
  const result = await checkSiteCode({ siteId: 't198-review1', code, materials: `审查样本。${text}`, images: [], legacyImport: true });
  await writeFile(`${out}/${id}.json`, JSON.stringify(result, null, 2));
  return result.checks;
};
const extreme = (checks: Awaited<ReturnType<typeof run>>, width: number) => checks.layoutRepairs?.filter(r => r.issue.startsWith(`home/${width} `) && r.issue.includes('极端窄列')) ?? [];
const feedback = (checks: Awaited<ReturnType<typeof run>>, width: number) => checks.viewports.find(v => v.width === width)!.qualityFeedback!;

// The independent review screenshots show exactly 0 / 1 / 2 / 12 painted rows.
// They define these expectations; production line counts are not an oracle.
for (const [id, height, visibleLines] of [
  ['clip-zero', '0', 0], ['clip-one-line', '32px', 1], ['clip-two-lines', '64px', 2], ['visible-control', undefined, 12],
] as const) test(`三档 overflow 裁剪：${id} 访客可见 ${visibleLines} 行`, async () => {
  const code = make(height === undefined ? '' : `.clip{height:${height};overflow:hidden}`);
  const checks = await run(id, code);
  const browser = await codeCheckBrowser();
  try {
    for (const width of [375, 768, 1440]) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: false });
      await browser.loadPage('Page.navigate', { url: 'data:text/html;charset=utf-8,' + encodeURIComponent(renderSiteCode('t198-review1', code, 'home')) });
      await browser.evaluate('document.fonts.ready');
      const image = await browser.send<{data: string}>('Page.captureScreenshot', { format: 'png' });
      await writeFile(`${out}/${id}-${width}.png`, Buffer.from(image.data, 'base64'));
    }
  } finally { await browser.close(); }
  for (const width of [375, 768, 1440]) {
    assert.equal(extreme(checks, width).length, visibleLines >= 3 ? 1 : 0);
    assert.equal(feedback(checks, width).narrowColumns, visibleLines >= 3 ? 1 : 0);
    if (visibleLines === 12) assert.match(extreme(checks, width)[0].issue, /12 字 \/ 12 行/);
  }
  assert.equal(checks.passed, visibleLines < 3);
});

// Each property is explicitly excluded by the 2026-10-20 decision, regardless
// of whether a particular value happens to leave these glyphs visible.
const uncertainCases = [
  ['clip-path', 'clip-path:inset(0)'], ['mask', 'mask-image:linear-gradient(black,black)'],
  ['transform', 'transform:translateX(0px)'], ['contain', 'contain:paint'],
  ['columns-count', 'column-count:1'], ['columns-width', 'column-width:16px'],
  ['content-visibility', 'content-visibility:auto'],
] as const;
for (const [id, declaration] of uncertainCases) for (const owner of ['self', 'ancestor'] as const) test(`三档无法确定可见行：${id}/${owner} 仅反馈；去掉声明仍拒收`, async () => {
  const selector = owner === 'self' ? '#target' : '.clip';
  const unknown = await run(`${id}-${owner}`, make(`${selector}{${declaration}}`));
  const control = await run(`${id}-${owner}-control`, make());
  for (const width of [375, 768, 1440]) {
    assert.equal(extreme(unknown, width).length, 0);
    assert.equal(feedback(unknown, width).narrowColumns, 1);
    assert.ok(feedback(unknown, width).details.some(d => d.kind === 'narrowColumns' && d.target === '#target' && d.detail.includes('可见行无法确定')));
    assert.equal(extreme(control, width).length, 1);
    assert.ok(feedback(control, width).details.every(d => !d.detail.includes('可见行无法确定')));
  }
});

test('可确定裁剪只计可见字符；被裁掉的长行不能稀释竖排，被裁掉的碎行不能制造普通窄列', async () => {
  const clippedWideHead = await run('visible-characters', make('.clip{height:256px;overflow:hidden}#target{width:8em;position:relative;top:-32px}',
    '<div class="clip"><p id="target">采购前请确认材料<br>采<br>购<br>前<br>请<br>确<br>认<br>材<br>料</p></div>'));
  const clippedNarrowTail = await run('hidden-tail', make('.clip{height:96px;overflow:hidden}#target{width:8em}',
    `<div class="clip"><p id="target">采购前请确认材料<br>采购前请确认材料<br>采购前请确认材料<br>${[...text].join('<br>')}</p></div>`));
  for (const width of [375, 768, 1440]) {
    assert.equal(extreme(clippedWideHead, width).length, 1);
    assert.match(extreme(clippedWideHead, width)[0].issue, /8 字 \/ 8 行/);
    assert.equal(feedback(clippedNarrowTail, width).narrowColumns, 0);
    assert.equal(extreme(clippedNarrowTail, width).length, 0);
  }
});
test.after(() => console.log(`T-198 review1 证据：${out}`));
