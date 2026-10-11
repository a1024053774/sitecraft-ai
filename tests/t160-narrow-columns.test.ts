import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { checkSiteCode } from '../lib/code-site-check.ts';
import { commitSiteCode, getCodeSite } from '../lib/code-site-store.ts';
import type { CodeCheck, SiteCode } from '../lib/code-site.ts';
import { summarize, type EvalCase } from '../scripts/eval-set-report.ts';

assert.ok(process.env.SITECRAFT_BASE, 'Set SITECRAFT_BASE to this worktree server');
process.env.SITE_STORE = 'fs';
const records: unknown[] = [];
test.after(async () => {
  const folder = `artifacts/t160/contract-${crypto.randomUUID()}`;
  await mkdir(folder, { recursive: true });
  await writeFile(`${folder}/checks.json`, JSON.stringify(records, null, 2), 'utf8');
  console.log(`T-160 checks: ${folder}`);
});
const zh = '学费按完整一期收取，不按单次课拆售。';
const en = 'Each course includes guided practice and a discussion of your finished work.';
const make = (html: string, css = ''): SiteCode => ({ header: '', footer: '',
  css: `body{margin:0;background:#fff;color:#111;font:16px/2 monospace}main{padding:20px}p,dd{margin:0 0 24px} .narrow{width:4em;overflow-wrap:anywhere} ${css}`,
  pages: [{ id: 'home', title: '课程说明', html: `<main><h1>课程说明</h1>${html}</main>` }] });
const run = async (code: SiteCode) => {
  const { checks } = await checkSiteCode({ siteId: 't160-contract', code, materials: `课程说明。${zh}${en} 1280 1500`, images: [], legacyImport: true });
  records.push({ code, checks }); return checks;
};
function narrow(checks: CodeCheck, width: number) {
  const q = checks.viewports.find(v => v.width === width)!.qualityFeedback;
  const count = q && Reflect.get(q, 'narrowColumns');
  assert.equal(typeof count, 'number', 'new checks must measure narrow columns, including zero');
  return { count, details: q!.details.filter(d => d.kind as string === 'narrowColumns') };
}

test('Chinese prose and table caption warn only where rendered lines are narrow; inline emphasis stays one block', async () => {
  const checks = await run(make(`<p id="prose">学费按<strong>完整一期</strong>收取，不按单次课拆售。</p><table><caption id="caption">${zh}</caption><tr><td>课程</td></tr></table>`,
    'table{width:100%}@media(max-width:400px){#prose,caption{width:4em}}'));
  assert.equal(narrow(checks, 375).count, 2);
  assert.deepEqual(narrow(checks, 375).details.map(d => d.target).sort(), ['#caption', '#prose']);
  assert.ok(narrow(checks, 375).details.every(d => /字.*行|行.*字/.test(d.detail)));
  for (const width of [768, 1440]) assert.equal(narrow(checks, width).count, 0);
});

test('thresholds count Han characters and English words with strict averages, minimum length and three lines', async () => {
  // Explicit lines make the threshold independent of the platform font metrics.
  const checks = await run(make(`
    <p id="zh-low">学费按期收<br>取课程纸笔<br>需要自备好</p>
    <p id="zh-equal">学费按完整期<br>收取课程纸笔<br>需要自己准备</p>
    <p id="zh-short">学费<br>按期<br>收取</p>
    <p id="two-lines">学费按期<br>完整收取</p>
    <p id="en-low">Course fees<br>include guided<br>practice and<br>group discussion</p>
    <p id="en-equal">Course fees include<br>guided practice and<br>small group discussion</p>
    <p id="en-short">Course<br>fees<br>include<br>paper</p>
    <p id="mixed-normal">周二至周日，午市 11:00–14:00<br>晚市 17:00–20:30<br>周一休息。</p>
    <p id="inline-words"><span>Course</span> <strong>fees include</strong><br>guided practice and<br>small group discussion</p>
    <p id="en-broken" class="narrow">${en}</p>`));
  for (const width of [375, 768, 1440]) {
    assert.equal(narrow(checks, width).count, 3);
    assert.deepEqual(narrow(checks, width).details.map(d => d.target).sort(), ['#en-broken', '#en-low', '#zh-low']);
    assert.match(narrow(checks, width).details.find(d => d.target === '#en-low')!.detail, /词/);
  }
});

test('independent grid, flex and inline-block prose is not merged; hidden text and non-prose are exempt', async () => {
  const checks = await run(make(`
    <dl style="display:grid;grid-template-columns:4em 1fr"><div><dt>需求</dt><dd id="definition">替换直角传动并保留原底脚孔位</dd></div><div>常规栏目</div></dl>
    <div style="display:flex"><span id="flex" class="narrow">${zh}</span><span style="width:200px">正常宽度</span></div>
    <div><span id="inline" class="narrow" style="display:inline-block">${zh}</span></div>
    <table><tr><td class="narrow"><p>${zh}</p></td><th class="narrow">${zh}</th></tr></table>
    <h2 class="narrow">${zh}</h2><nav class="narrow">${zh}</nav><div role="button" class="narrow">${zh}</div>
    <p class="narrow" data-spec>${zh}</p><p class="narrow">1280 元/期</p><span class="narrow" style="display:block">收费说明</span>
    <p data-sitecraft-slot="price" class="narrow">课程学费每期一千二百八十元整</p>
    <p data-sitecraft-slot="course.fee" class="narrow">课程学费每期一千二百八十元整</p>
    <p data-price class="narrow">课程学费每期一千二百八十元整</p>
    <p data-fee class="narrow">课程学费每期一千二百八十元整</p>
    <p class="narrow" style="display:none">${zh}</p><p class="narrow" style="visibility:hidden">${zh}</p>
    <div style="opacity:0"><p class="narrow">${zh}</p></div>
    <details><summary>折叠说明</summary><p class="narrow">${zh}</p></details>
    <div class="aria-hidden" aria-hidden="true"><p class="narrow">${zh}</p></div>
    <p id="wide">${zh}${zh}<small>按课程准备。</small></p>`, '.aria-hidden[aria-hidden=true]{display:none}'));
  for (const width of [375, 768, 1440]) {
    assert.equal(narrow(checks, width).count, 3);
    assert.deepEqual(narrow(checks, width).details.map(d => d.target).sort(), ['#definition', '#flex', '#inline']);
  }
});

test('the only commit entry stores narrow feedback without rejection, model calls or a repair run', async () => {
  const siteId = `t160-${crypto.randomUUID()}`;
  const result = await commitSiteCode({ siteId, legacyImport: { kind: 'convert', name: '课程说明', source: { revision: 1, updatedAt: '2026-10-11T00:00:00Z' },
    materials: `课程说明。${zh}`, code: make(`<p id="saved" class="narrow">${zh}</p>`), exportIssues: [] } });
  assert.equal(result.status, 'applied');
  const site = (await getCodeSite(siteId))!;
  records.push({ site });
  assert.equal(site.versions.length, 1); assert.equal(site.runs.length, 0);
  const checks = site.versions[0].checks;
  assert.equal(checks.passed, true); assert.deepEqual(checks.issues, []);
  for (const width of [375, 768, 1440]) assert.equal(narrow(checks, width).count, 1);
});

test('evaluation counts new measurements separately from historical T-147 feedback and never treats them as rejection', () => {
  const old = { truncatedText: 0, ungatedHover: 0, smallTargets: 0, coveredAnchors: 0, croppedProductImages: 0, details: [] };
  const checks = (q: typeof old): CodeCheck => ({ passed: true, issues: [], cleaned: [], checkedAt: '2026-10-11', viewports: [
    { pageId: 'home', width: 375, overflow: 0, overlaps: 0, contrastIssues: 0, longLines: 0, qualityFeedback: q }] });
  const item = (key: string, report: CodeCheck): EvalCase => ({ key, pack: 'education', style: 'precision', materials: '', outcome: 'generated', elapsedMs: 0, attempts: [{ round: 0, checks: report }], modelCalls: [], pages: [] });
  const result = summarize([item('bad', checks({ ...old, ...{ narrowColumns: 2 } })), item('good', checks({ ...old, ...{ narrowColumns: 0 } })), item('old', checks(old))]);
  assert.deepEqual(Reflect.get(result.qualityFeedback, 'narrowColumns'), { attempts: 1, sites: 1, occurrences: 2, measuredAttempts: 2, measuredSites: 2 });
  assert.equal(result.rejectedAttempts, 0); assert.deepEqual(result.reasons, {});
});
