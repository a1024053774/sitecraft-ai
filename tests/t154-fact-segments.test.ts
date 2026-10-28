import { factAuditPayload } from './fixtures/fact-audit-reply.ts';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import type { SiteCode } from '../lib/code-site.ts';

// Contract failure modes (before implementation): reused values lose changed
// column headers/qualifiers; source updates reuse old conclusions; one-character
// edits or pseudo/auxiliary copy disappear; invalid/missing/duplicate IDs pass;
// rejected segments are cached; CSS-only repairs audit everything again;
// stored current-version evidence or task attempts are trusted outside their
// source/run; restoration, local edits and English acquire an audit bypass.
const requests: any[] = [];
let protocol: 'valid' | 'unknown' | 'missing' | 'duplicate' = 'valid';
let rejectText = '';
const server = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw); requests.push(body);
  const input = JSON.parse(body.messages[1].content.split('\n')[0].startsWith('{') ? body.messages[1].content.split('\n')[0] : '{}');
  let results = (input.segments ?? []).map((s: any) => ({ id: s.id, noFacts: true, factCategories: [], citations: [], issues: rejectText && s.text.includes(rejectText) ? [`页面原句：${rejectText}；资料未提供该承诺。`] : [] }));
  if (protocol === 'unknown') results.push({ id: 's999999', noFacts: true, issues: [], citations: [] });
  if (protocol === 'missing') results.pop();
  if (protocol === 'duplicate' && results.length) results.push(results[0]);
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(factAuditPayload(body, { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(input.segments ? { results } : { issues: [] }) } }], usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 } })));
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); assert.ok(address && typeof address === 'object');
assert.ok(process.env.SITECRAFT_BASE, 'Set the worktree application origin explicitly');
process.env.SITE_STORE = 'fs';
process.env.SITECRAFT_DATA_ROOT = path.join(process.env.SITECRAFT_DATA_ROOT!, `t154-${Date.now()}`);
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
process.env.DEEPSEEK_API_KEY = 'local-fixture'; process.env.DEEPSEEK_MODEL = 'local-fixture';
const { commitSiteCode, createCodeSite, updateCodeSite, getCodeSite } = await import('../lib/code-site-store.ts');
test.after(async () => {
  await mkdir('artifacts/t154', { recursive: true });
  await writeFile(`artifacts/t154/requests-${Date.now()}.json`, JSON.stringify(requests, null, 2));
  await new Promise<void>(resolve => server.close(() => resolve()));
});
const materials = '同源纸品：纸盒和纸袋。样品确认后交期 12 天；起订量 12 件。仅普通纸盒，食品用途待补充。不承接裸装食品。';
const code: SiteCode = { header: '', footer: '', css: 'body{margin:0;color:#111;background:#fff;font:16px/1.6 sans-serif}main{padding:24px}table{border-spacing:12px}td,th{text-align:left}', pages: [{ id: 'home', title: '纸品', html: '<main><h1>同源纸品</h1><section><h2>普通纸盒</h2><p>仅普通纸盒</p><table><thead><tr><th>品类</th><th>交期</th></tr></thead><tbody><tr><td>纸盒</td><td>12 天</td></tr></tbody></table><ul><li>不承接裸装食品</li><li>食品用途待补充</li></ul></section><section><h2>纸袋</h2><p title="纸袋说明">纸袋</p></section></main>' }] };
const input = () => JSON.parse(requests.at(-1).messages[1].content.split('\n')[0]);
async function setup() {
  const siteId = `t154-${crypto.randomUUID()}`;
  await createCodeSite(siteId, '同源纸品', 'test-conversation');
  await updateCodeSite(siteId, () => ({ materials, factSources: [{ type: 'message', messageIndex: 1, text: materials }] }));
  return siteId;
}
const commit = (siteId: string, baseRevision: number, candidate = code, request = '') => commitSiteCode({ siteId, baseRevision, code: candidate, author: 'user', summary: '核对段测试', request });
const changed = (before: string, after: string): SiteCode => ({ ...code, pages: code.pages.map(p => ({ ...p, html: p.html.replace(before, after) })) });
const applied = (result: any) => { assert.equal(result.status, 'applied', JSON.stringify(result.checks?.issues)); return result.version; };

test('real commit stores numbered audit evidence; same source and CSS-only change reuse it', async () => {
  const id = await setup(), first = applied(await commit(id, 0));
  assert.ok(first.checks.factSegments?.audited > 0, 'first commit must store the numbered fact audit');
  assert.equal(input().segments.length, first.checks.factSegments.audited);
  const before = requests.length;
  const second = applied(await commit(id, 1, { ...code, css: code.css + 'h1{letter-spacing:.02em}' }));
  assert.equal(requests.length, before, 'CSS-only change must reuse reviewed segments');
  assert.equal(second.checks.factSegments.audited, 0);
  assert.equal(second.checks.factSegments.reused, first.checks.factSegments.audited);
  assert.deepEqual(second.checks.viewports.map((v: any) => v.width), [375, 768, 1440]);
});

test('changed table header or qualifier re-audits unchanged values, while unrelated section is reused', async () => {
  for (const [before, after] of [['<th>交期</th>', '<th>起订量</th>'], ['仅普通纸盒', '所有纸盒']]) {
    const id = await setup(); applied(await commit(id, 0));
    const result = applied(await commit(id, 1, changed(before, after)));
    assert.ok(result.checks.factSegments?.reused > 0, 'unchanged independent section remains reusable');
    assert.ok(input().segments.some((s: any) => s.text.includes('12 天') && s.text.includes(after.replace(/<[^>]+>/g, ''))), 'value must travel with its changed qualifier/header');
    assert.ok(!input().segments.some((s: any) => s.text.includes('纸袋说明')), 'unchanged section is context at most, never an audited segment');
  }
});

test('one-character change re-audits the paragraph; source change re-audits all segments', async () => {
  const id = await setup(); applied(await commit(id, 0));
  const second = applied(await commit(id, 1, changed('>纸袋</p>', '>纸盒</p>')));
  assert.ok(second.checks.factSegments?.audited > 0 && second.checks.factSegments.reused > 0);
  assert.ok(input().segments.some((s: any) => s.text.includes('纸袋说明') && s.text.includes('纸盒')));
  await updateCodeSite(id, () => ({ materials: materials + '资料已更新。' }));
  const third = applied(await commit(id, 2));
  assert.equal(third.checks.factSegments.reused, 0);
  assert.equal(third.checks.factSegments.audited, third.checks.factSegments.segments.length);
});

test('unknown, missing and duplicate response IDs reject the submission and cannot create a version', async () => {
  for (const invalid of ['unknown', 'missing', 'duplicate'] as const) {
    const id = await setup(); protocol = invalid;
    try { await assert.rejects(commit(id, 0), /核对段.*编号/); }
    finally { protocol = 'valid'; }
    assert.equal((await getCodeSite(id))!.versions.length, 0);
  }
});

test('new user facts invalidate cached evidence even when raw site materials are unchanged', async () => {
  const id = await setup(); applied(await commit(id, 0));
  const second = applied(await commit(id, 1, code, '资料更新：不再承接纸袋。'));
  assert.equal(second.checks.factSegments?.reused, 0);
});

test('a task reuses only passed segments of its prior rejected candidate, including after metadata reload', async () => {
  const id = await setup(), now = new Date().toISOString();
  await updateCodeSite(id, () => ({ run: { id: 'active-test-run', kind: 'generate', status: 'running', request: '', baseRevision: 0, startedAt: now, updatedAt: now, step: '检查', repairRound: 0, issues: [], attempts: [] } }));
  rejectText = '纸袋说明';
  const rejected = await commit(id, 0);
  assert.equal(rejected.status, 'rejected'); if (rejected.status !== 'rejected') throw new Error('Expected rejection');
  await updateCodeSite(id, site => ({ run: { ...site.run!, attempts: [{ code, checks: rejected.checks }] } }));
  const failedAgain = await commit(id, 0);
  assert.equal(failedAgain.status, 'rejected'); if (failedAgain.status !== 'rejected') throw new Error('Expected rejection');
  assert.ok(failedAgain.checks.factSegments!.reused > 0);
  assert.ok(input().segments.every((s: any) => s.text.includes('纸袋说明')), 'rejected segment must never count as passed');
  rejectText = '';
  const last = applied(await commit(id, 0, changed('title="纸袋说明"', 'title="纸盒说明"')));
  assert.ok(last.checks.factSegments.reused > 0);
  assert.ok(input().segments.every((s: any) => s.text.includes('纸盒说明')));
  // A subsequent empty-request commit compares the same effective source text.
  const before = requests.length;
  applied(await commit(id, 1, changed('title="纸袋说明"', 'title="纸盒说明"')));
  applied(await commit(id, 2, changed('title="纸袋说明"', 'title="纸盒说明"')));
  assert.equal(requests.length, before);
});

test('computed CSS strings and auxiliary attributes participate in the segment with their conditions', async () => {
  const id = await setup();
  const cssCode = { ...code, css: code.css + 'tbody::before{content:"仅普通纸盒";display:table-row}p::after{content:attr(title)}@media(min-width:700px){p::after{content:"不承接裸装食品"}}' };
  applied(await commit(id, 0, cssCode));
  assert.ok(input().segments.some((s: any) => s.text.includes('12 天') && s.text.includes('CSS=仅普通纸盒')));
  assert.ok(input().segments.some((s: any) => s.text.includes('CSS=纸袋说明')));
  assert.ok(input().segments.some((s: any) => s.text.includes('CSS=不承接裸装食品')));
  const second = applied(await commit(id, 1, { ...cssCode, css: cssCode.css.replace('content:"仅普通纸盒"', 'content:"所有纸盒"') }));
  assert.ok(second.checks.factSegments.reused > 0);
  assert.ok(input().segments.some((s: any) => s.text.includes('12 天') && s.text.includes('CSS=所有纸盒')));
});

test('removing the last complete company name creates a fresh site-wide audit obligation', async () => {
  const id = await setup(); applied(await commit(id, 0));
  const calls = requests.length, result = await commit(id, 1, changed('同源纸品', '纸品'));
  assert.equal(result.status, 'rejected');
  if (result.status === 'rejected') assert.match(result.checks.identityIssue!, /完整主体名称/);
  assert.equal(requests.length, calls, '完整主体名称由程序检查，不把内部观察交给模型');
});

test('a restarted or unrelated run cannot lend rejected-candidate receipts', async () => {
  const id = await setup(), now = new Date().toISOString();
  const first = applied(await commit(id, 0));
  await updateCodeSite(id, () => ({ run: { id: 'old-run', kind: 'generate', status: 'complete', request: '', baseRevision: 0, startedAt: now, updatedAt: now, step: '完成', repairRound: 0, issues: [], attempts: [{ code, checks: first.checks }] } }));
  const second = applied(await commit(id, 1, changed('>纸袋</p>', '>纸盒</p>')));
  const third = applied(await commit(id, 2));
  assert.ok(second.checks.factSegments.audited > 0);
  assert.ok(third.checks.factSegments.audited > 0, 'old task must not supply the removed paragraph receipt');
});

test('system-looking CSS classes and system icon attributes cannot hide authored factual copy', async () => {
  const id = await setup();
  const candidate = changed('<p title="纸袋说明">纸袋</p>', '<p class="sc-image-credits" title="纸袋说明">纸袋</p><span data-system-icon="mail" title="不承接裸装食品"></span>');
  applied(await commit(id, 0, candidate));
  assert.ok(input().segments.some((s: any) => s.text.includes('title=纸袋说明') && s.text.includes('纸袋')));
  assert.ok(input().segments.some((s: any) => s.text.includes('title=不承接裸装食品')));
});

// Independent Astra counterexample: a section's header is a product qualifier,
// not an unrelated segment whose change can leave the numerical row cached.
test('product titles in child headers and sidebar/list conditions invalidate related table values', async () => {
  for (const [start, from, to] of [
    [changed('<h2>普通纸盒</h2>', '<header><h2>普通纸盒</h2></header>'), '普通纸盒', '食品纸盒'],
    [changed('<p>仅普通纸盒</p>', '<aside><p>仅普通纸盒</p></aside>'), '仅普通纸盒', '所有纸盒'],
    [changed('<p>仅普通纸盒</p>', '<ul><li>仅普通纸盒</li></ul>'), '仅普通纸盒', '所有纸盒'],
  ] as const) {
    const id = await setup(); applied(await commit(id, 0, start));
    const next = { ...start, pages: start.pages.map(page => ({ ...page, html: page.html.replace(from, to) })) };
    applied(await commit(id, 1, next));
    assert.ok(input().segments.some((s: any) => s.text.includes(to) && s.text.includes('12 天')), 'changed semantic owner must travel with the unchanged value');
  }
});

test('merged-cell changes invalidate table semantics even when all words are unchanged', async () => {
  const id = await setup();
  const start = changed('<th>品类</th>', '<th colspan="1">品类</th>');
  applied(await commit(id, 0, start));
  const before = requests.length;
  const next = { ...start, pages: start.pages.map(page => ({ ...page, html: page.html.replace('colspan="1"', 'colspan="2"') })) };
  applied(await commit(id, 1, next));
  assert.equal(requests.length, before + 1, 'different header association must not use a text-only receipt');
  assert.ok(input().segments.some((s: any) => s.text.includes('12 天')));
});

// Follow-up Astra findings: deleting a sibling condition must invalidate the
// surviving facts; additions/reordering invalidate the same complete group.
// Source-only whitespace must not shift live node mapping or hide boundary text.
const conditionRow = '<tr><th>起算条件</th><td>样品确认后</td></tr>';
const deliveryRow = '<tr><th>交期</th><td>12 天</td></tr>';
const groupCode = (body: string): SiteCode => ({ ...code, pages: [{ id: 'home', title: '纸品', html: `<main><h1>同源纸品</h1><section><h2>普通纸盒</h2>${body}</section><section><h2>纸袋</h2><p title="纸袋说明">纸袋</p></section></main>` }] });
for (const [name, nextRows] of [
  ['deleting a condition row', deliveryRow],
  ['adding a row', deliveryRow + conditionRow + '<tr><th>起订量</th><td>12 件</td></tr>'],
  ['reordering rows', conditionRow + deliveryRow],
] as const) test(`whole group is re-audited after ${name}`, async () => {
  const id = await setup();
  applied(await commit(id, 0, groupCode(`<table><tbody>${deliveryRow + conditionRow}</tbody></table>`)));
  const before = requests.length;
  const second = applied(await commit(id, 1, groupCode(`<table><tbody>${nextRows}</tbody></table>`)));
  assert.equal(requests.length, before + 1, 'the surviving delivery claim must be audited again');
  const texts: string[] = input().segments.map((s: any) => s.text);
  assert.ok(texts.some(text => text.includes('12 天')), 'unchanged delivery row is part of the changed group');
  if (nextRows.includes('样品确认后')) assert.ok(texts.some(text => text.includes('样品确认后')));
  assert.ok(texts.some(text => text.includes('普通纸盒') && !text.includes('12 天')), 'the section heading also belongs to the changed group');
  assert.ok(!texts.some(text => text.includes('纸袋说明')), 'the independent section stays reusable');
  assert.ok(second.checks.factSegments.reused > 0);
});

test('whole group is re-audited after deleting a list item containing its own subsection', async () => {
  const firstItem = '<li><section><h3>交期</h3><p>12 天</p></section></li>';
  const conditionItem = '<li><section><h3>起算条件</h3><p>样品确认后</p></section></li>';
  const id = await setup();
  applied(await commit(id, 0, groupCode(`<ul>${firstItem + conditionItem}</ul>`)));
  const before = requests.length;
  applied(await commit(id, 1, groupCode(`<ul>${firstItem}</ul>`)));
  assert.equal(requests.length, before + 1);
  assert.ok(input().segments.some((s: any) => s.text.includes('12 天')), 'remaining list item must be re-audited');
  assert.ok(!input().segments.some((s: any) => s.text.includes('纸袋说明')));
});

for (const location of ['page-leading', 'page-trailing', 'footer-leading', 'footer-trailing', 'all-boundaries', 'adjacent-text'] as const)
  test(`fragment boundaries preserve ${location} whitespace and authored copy`, async () => {
    const id = await setup();
    const base: SiteCode = { ...code, header: '<header>同源纸品</header>', footer: '<footer>纸盒与纸袋</footer>' };
    const first = applied(await commit(id, 0, base));
    const next = structuredClone(base);
    if (location === 'page-leading' || location === 'all-boundaries') next.pages[0].html = '\n \t' + next.pages[0].html;
    if (location === 'page-trailing' || location === 'all-boundaries') next.pages[0].html += '\n \t';
    if (location === 'footer-leading' || location === 'all-boundaries') next.footer = '\n \t' + next.footer;
    if (location === 'footer-trailing' || location === 'all-boundaries') next.footer += '\n \t';
    if (location === 'all-boundaries') next.header = '\n \t' + next.header + '\n \t';
    if (location === 'adjacent-text') {
      next.header += '页头尾文案'; next.pages[0].html = '页面前文案' + next.pages[0].html + '页面尾文案';
      next.footer = '页脚前文案' + next.footer;
    }
    const before = requests.length, second = applied(await commit(id, 1, next));
    assert.deepEqual(second.checks.viewports.map((v: any) => v.width), [375, 768, 1440]);
    if (location === 'adjacent-text') {
      const text = input().segments.map((s: any) => s.text).join('\n');
      for (const copy of ['页头尾文案', '页面前文案', '页面尾文案', '页脚前文案']) assert.ok(text.includes(copy), copy);
    } else {
      assert.equal(requests.length, before, 'boundary whitespace leaves the readable groups unchanged');
      assert.equal(second.checks.factSegments.reused, first.checks.factSegments.segments.length);
    }
  });

test('partially accepted groups retain all conditions and cannot combine partial passes across attempts', async () => {
  const id = await setup(), now = new Date().toISOString();
  const candidate = groupCode(`<table><tbody>${deliveryRow + conditionRow}</tbody></table>`);
  await updateCodeSite(id, () => ({ run: { id: 'group-repair-test', kind: 'generate', status: 'running', request: '', baseRevision: 0, startedAt: now, updatedAt: now, step: '检查', repairRound: 0, issues: [], attempts: [] } }));
  try {
    rejectText = '12 天';
    const first = await commit(id, 0, candidate);
    assert.equal(first.status, 'rejected'); if (first.status !== 'rejected') throw new Error('Expected rejection');
    await updateCodeSite(id, site => ({ run: { ...site.run!, attempts: [{ code: candidate, checks: first.checks }] } }));
    const second = await commit(id, 0, candidate);
    assert.equal(second.status, 'rejected');
    assert.ok(input().segments.some((s: any) => s.text.includes('样品确认后')), 'page conditions must remain in the re-audit input, not only in source materials');
    const groupId = input().segments.find((s: any) => s.text.includes('12 天')).groupId;
    assert.equal(input().segments.find((s: any) => s.text.includes('样品确认后')).groupId, groupId);
    rejectText = '样品确认后';
    const complementary = await commit(id, 0, candidate);
    assert.equal(complementary.status, 'rejected'); if (complementary.status !== 'rejected') throw new Error('Expected rejection');
    await updateCodeSite(id, site => ({ run: { ...site.run!, attempts: [...site.run!.attempts, { code: candidate, checks: complementary.checks }] } }));
    rejectText = '';
    const before = requests.length;
    applied(await commit(id, 0, candidate));
    assert.equal(requests.length, before + 1, 'no single prior attempt passed this complete group');
    assert.ok(input().segments.some((s: any) => s.text.includes('12 天')));
    assert.ok(input().segments.some((s: any) => s.text.includes('样品确认后')));
  } finally { rejectText = ''; }
});
