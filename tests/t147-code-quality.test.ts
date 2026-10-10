import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type { CodeCheck, SiteCode } from '../lib/code-site.ts';
import type { SiteImageRecord } from '../lib/site-images.ts';
import { summarize, type EvalCase } from '../scripts/eval-set-report.ts';

// Contract and counterfactual are T-147's six failure categories, recorded before implementation.
// Real Chrome and commitSiteCode run; the HTTP server only serves an inert origin and fixture image.
const image = await readFile('tests/fixtures/company-images/industrial/product-gearbox-reducer.jpg');
let unexpectedRequests = 0;
const server = createServer((req, res) => {
  if (req.url === '/') { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><html><body></body></html>'); }
  else if (req.url?.includes('/images/')) { res.setHeader('content-type', 'image/jpeg'); res.end(image); }
  else { unexpectedRequests++; res.writeHead(500); res.end('No model endpoint'); }
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
process.env.SITECRAFT_BASE = base; process.env.SITE_STORE = 'fs';
const { checkSiteCode } = await import('../lib/code-site-check.ts');
const { commitSiteCode, getCodeSite } = await import('../lib/code-site-store.ts');
test.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); assert.equal(unexpectedRequests, 0); });
const css = 'body{margin:0;color:#111;background:#fff;font:16px/1.8 sans-serif}main{padding:24px}h1{font-size:28px}p{max-width:30em}a{color:#111}';
const make = (html: string, extra = '', header = ''): SiteCode => ({ header, footer: '', css: css + extra, pages: [{ id: 'home', title: '测试加工', html: `<main><h1>测试加工</h1>${html}</main>` }] });
type Quality = { truncatedText: number; ungatedHover: number; smallTargets: number; coveredAnchors: number; croppedProductImages: number; details: Array<{ kind: string; target: string; detail: string }> };
function quality(checks: CodeCheck, width = 375, pageId = 'home'): Quality {
  const viewport = checks.viewports.find(v => v.width === width && v.pageId === pageId)!;
  const result = (viewport as unknown as { qualityFeedback?: Quality }).qualityFeedback;
  assert.ok(result, 'the real commit check must return quality feedback, even with zero findings');
  return result;
}
const run = async (code: SiteCode, images: SiteImageRecord[] = []) => (await checkSiteCode({ siteId: 't147-browser-contract', code,
  materials: '测试加工。规格：超长精密加工参数值与设备型号需要完整显示。目标标题。正文链接。导航。折叠规格。详情。44', images, legacyImport: true })).checks;
for (const [name, extra] of [
  ['ellipsis', '.spec{display:block;width:80px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'],
  ['line clamp', '.spec{width:100px;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1;overflow:hidden}'],
  ['ancestor height', '.box{height:25px;overflow:hidden}.spec{width:100px}'],
]) test(`truncation: ${name} clips specification text`, async () => {
  const checks = await run(make('<dl class="box"><dd class="spec"><span>超长精密加工参数值与设备型号需要完整显示。</span></dd></dl>', extra));
  assert.equal(quality(checks).truncatedText, 1); assert.match(quality(checks).details[0].target, /dd|spec/);
});
test('truncation: harmless ellipsis, scrollable specs and ordinary summary are not findings; open details is measured', async () => {
  const safe = await run(make('<dl><dd class="fits">规格</dd><dd class="scroll">超长精密加工参数值与设备型号需要完整显示。</dd></dl><p class="summary">超长精密加工参数值与设备型号需要完整显示。</p>',
    '.fits{width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.scroll{width:90px;white-space:nowrap;overflow:auto}.summary{width:90px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'));
  assert.equal(quality(safe).truncatedText, 0);
  const bad = await run(make('<details><summary>折叠规格</summary><table><tr><td>超长精密加工参数值与设备型号需要完整显示。</td></tr></table></details>', 'td{display:block;width:90px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'));
  assert.equal(quality(bad).truncatedText, 1);
});
test('hover: ungated, nested, OR and negated gates warn; conjunctive and split ancestor gates pass', async () => {
  for (const rule of ['a:hover{color:#222}', 'a{&:hover{color:#222}}', 'a:not(:hover){color:#222}', '@media (hover:hover),(pointer:fine){a:hover{color:#222}}', '@media not (hover:hover){a:hover{color:#222}}']) {
    assert.ok(quality(await run(make('<nav><a href="#target">导航</a></nav><h2 id="target">目标标题</h2>', rule))).ungatedHover > 0, rule);
  }
  for (const rule of ['@media (hover:hover) and (pointer:fine){a:hover{color:#222}}', '@media (hover:hover){a{@media (pointer:fine){&:hover{color:#222}}}}', '.unused:hover{color:#222}']) {
    assert.equal(quality(await run(make('<nav><a href="#target">导航</a></nav><h2 id="target">目标标题</h2>', rule))).ungatedHover, 0, rule);
  }
});
test('hover: unsupported supports branch is inactive; supported branch still warns', async () => {
  const html = '<nav><a href="#target">导航</a></nav><h2 id="target">目标标题</h2>';
  assert.equal(quality(await run(make(html, '@supports (display: impossible-layout){a:hover{color:#222}}'))).ungatedHover, 0);
  assert.equal(quality(await run(make(html, '@supports (display: grid){a:hover{color:#222}}'))).ungatedHover, 1);
});
test('hover: ancestor and descendant can have different states; contradictory same-element state is inactive', async () => {
  // Independent Astra counterexample: hovering the nav's blank area leaves its link unhovered.
  const html = '<nav><a href="#target">导航</a></nav><h2 id="target">目标标题</h2>';
  assert.equal(quality(await run(make(html, 'nav{padding:24px}nav:hover a:not(:hover){color:#222}'))).ungatedHover, 1);
  assert.equal(quality(await run(make(html, 'a:hover:not(:hover){color:#222}'))).ungatedHover, 0);
});
test('touch: small standalone link and summary warn; prose inline link and 44 square pass; only 375 is measured', async () => {
  const checks = await run(make('<nav><a href="#target">导航</a></nav><p>正文<a href="#target">正文链接</a>详情。</p><details><summary>详情</summary></details><h2 id="target">目标标题</h2>', 'nav a{display:inline-block;width:44px;height:30px}summary{width:80px}'));
  assert.equal(quality(checks).smallTargets, 2); assert.equal(quality(checks, 768).smallTargets, 0);
  assert.equal(quality(await run(make('<nav><a href="#target">导航</a></nav><h2 id="target">目标标题</h2>', 'nav a{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px}'))).smallTargets, 0);
});
test('touch: real pseudo hit area counts; clipping or adjacent target stealing invalidates it', async () => {
  const html = '<nav><a href="#target">导航</a></nav><h2 id="target">目标标题</h2>';
  const expanded = 'nav{padding:24px}nav a{display:inline-block;position:relative;font-size:12px;line-height:20px}nav a::after{content:"";position:absolute;inset:-15px}';
  assert.equal(quality(await run(make(html, expanded))).smallTargets, 0);
  assert.equal(quality(await run(make(html, expanded + 'nav{width:24px;height:20px;overflow:hidden;padding:0}'))).smallTargets, 1);
  const crowded = await run(make('<nav><a href="#target">导航</a><a href="#target">详情</a></nav><h2 id="target">目标标题</h2>', expanded + 'nav a+a{margin-left:2px}'));
  assert.ok(quality(crowded).smallTargets > 0);
});
test('anchors: actual sticky/fixed occlusion warns; correct offset and normal header pass', async () => {
  const html = '<a href="#target">导航</a><div style="height:1100px"></div><h2 id="target">目标标题</h2><div style="height:1100px"></div>';
  for (const position of ['sticky', 'fixed']) {
    const header = '<header>测试加工</header>', style = `header{position:${position};top:0;width:100%;height:80px;background:#fff;z-index:10}`;
    assert.equal(quality(await run(make(html, style, header))).coveredAnchors, 1);
    assert.equal(quality(await run(make(html, style + '#target{scroll-margin-top:90px}', header))).coveredAnchors, 0);
    assert.equal(quality(await run(make(html, style + 'html{scroll-padding-top:90px}', header))).coveredAnchors, 0);
  }
  assert.equal(quality(await run(make(html, 'header{height:80px}', '<header>测试加工</header>'))).coveredAnchors, 0);
  assert.equal(quality(await run(make('<a href="#target">导航</a><h2 id="target">目标标题</h2>', 'header{position:sticky;top:0;height:80px}', '<header>测试加工</header>'))).coveredAnchors, 0);
});
test('anchors: incoming cross-page target is tested on its destination page', async () => {
  const code = make('<a href="/products#target">导航</a>', 'header{position:sticky;top:0;height:80px;background:#fff;z-index:10}', '<header>测试加工</header>');
  code.pages.push({ id: 'products', title: '规格', html: '<main><h1>测试加工</h1><div style="height:1100px"></div><h2 id="target">目标标题</h2><div style="height:1100px"></div></main>' });
  assert.equal(quality(await run(code), 375, 'products').coveredAnchors, 1);
});
test('product images: crop geometry warns only for registered product; contain and intrinsic aspect fit pass', async () => {
  const id = 'img_0123456789abcdef';
  const record = { imageId: id, usageScope: 'current-site-only', usageCategory: 'product', attribution: '' } as SiteImageRecord;
  const html = `<img data-image-id="${id}" alt="测试加工">`;
  assert.equal(quality(await run(make(html, 'img{width:100px;height:400px;object-fit:cover}'), [record])).croppedProductImages, 1);
  assert.equal(quality(await run(make(html, 'img{width:100px;height:400px;object-fit:contain}'), [record])).croppedProductImages, 0);
  assert.equal(quality(await run(make(html, 'img{width:100px;height:auto;object-fit:cover;padding:20px;border:4px solid #111}'), [record])).croppedProductImages, 0);
  assert.equal(quality(await run(make(html, 'img{width:100px;height:400px;object-fit:cover}'), [{ ...record, usageCategory: 'facility' }])).croppedProductImages, 0);
  assert.equal(quality(await run(make(html, 'img{width:100px;height:400px;object-fit:cover}'), [{ ...record, usageCategory: undefined }])).croppedProductImages, 0);
});
test('quality feedback persists through the only commit entry without rejecting or repairing', async () => {
  const siteId = `t147-commit-${crypto.randomUUID()}`;
  const result = await commitSiteCode({ siteId, legacyImport: { kind: 'convert', name: '测试加工', source: { revision: 1, updatedAt: '2026-10-10T00:00:00Z' },
    materials: '测试加工。导航。目标标题。', code: make('<nav><a href="#target">导航</a></nav><h2 id="target">目标标题</h2>', 'a:hover{color:#222}'), exportIssues: [] } });
  assert.equal(result.status, 'applied', 'feedback must not refuse a version');
  const saved = (await getCodeSite(siteId))!;
  assert.equal(saved.versions.length, 1); assert.equal(saved.runs.length, 0);
  const checks = saved.versions[0].checks;
  assert.equal(checks.passed, true); assert.deepEqual(checks.issues, []);
  assert.ok(quality(checks).smallTargets > 0); assert.ok(quality(checks).ungatedHover > 0);
});
test('evaluation aggregates quality separately and distinguishes old unchecked snapshots', () => {
  const checks = { passed: true, issues: [], cleaned: [], checkedAt: '2026-10-10', viewports: [{ pageId: 'home', width: 375, overflow: 0, overlaps: 0, contrastIssues: 0, longLines: 0,
    qualityFeedback: { truncatedText: 2, ungatedHover: 0, smallTargets: 1, coveredAnchors: 0, croppedProductImages: 0, details: [] } }] };
  const item = (key: string, report: CodeCheck): EvalCase => ({ key, pack: 'industrial', style: 'precision', materials: '', outcome: 'generated', elapsedMs: 0, attempts: [{ round: 0, checks: report }], modelCalls: [], pages: [] });
  const result = summarize([item('new', checks), item('old', { ...checks, viewports: [] })]);
  assert.equal(result.rejectedAttempts, 0); assert.deepEqual(result.reasons, {});
  const feedback = Reflect.get(result.qualityFeedback, 'truncatedText');
  assert.deepEqual(feedback, { attempts: 1, sites: 1, occurrences: 2, measuredAttempts: 1, measuredSites: 1 });
});
