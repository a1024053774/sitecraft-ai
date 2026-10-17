import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import type { SiteCode } from '../lib/code-site.ts';

// Oracle: T-173 permits the same original sentence in separate segments;
// missing/nonliteral quotes get the existing two correction rounds. Protocol
// violations remain terminal. All candidates enter the production chat POST.
const callbacks: Array<() => Promise<void>> = [];
(globalThis as any).__t173After = callbacks;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'next/server.js') return { shortCircuit: true, url: 'data:text/javascript,export function after(fn){globalThis.__t173After.push(fn)}' };
  if (!specifier.startsWith('@/')) return next(specifier, context);
  return next(pathToFileURL(path.join(process.cwd(), `${specifier.slice(2)}.ts`)).href, context);
} });
const { commitSiteCode, getCodeSite, updateCodeSite } = await import('../lib/code-site-store.ts');
const { POST: chat } = await import('../app/api/sites/[siteId]/chat/route.ts');

const output = `artifacts/t173/citation-repair-${Date.now()}-${process.pid}`;
await mkdir(output, { recursive: true });
const sentence = '节假日营业安排待补充。';
const category = '时间与交期承诺';
const original: SiteCode = {
  header: '<header>禾巷小馆</header>', footer: '<footer>家常饭菜</footer>',
  css: 'body{margin:0;color:#222;background:#fff;font:18px/1.6 sans-serif}header,footer,main{padding:24px}section{padding:24px 0}p{max-width:36em}',
  pages: [
    { id: 'home', title: '首页', html: `<main><h1>禾巷小馆</h1><section><h2>营业时段</h2><p>${sentence}</p></section><section><h2>用餐须知</h2><p>${sentence}</p></section><aside>其余说明保留。</aside></main>` },
    { id: 'menu', title: '菜单', html: '<main><h1>家常饭菜</h1><p>按当天供应。</p></main>' },
  ],
};
type Mode = 'valid' | 'missing-fixed' | 'missing-always' | 'nonliteral-fixed' | 'empty-fixed' | 'shared-budget' | 'duplicate-category' | 'duplicate-citation' | 'missing-noFacts' | 'invalid-choice' | 'old-format';
let mode: Mode = 'valid', audits = 0, writes = 0;
const requests: any[] = [];
const provider = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw), local = body.messages[0].content.includes('本次局部修改');
  const input = JSON.parse(body.messages[1].content.split('\n')[0]);
  requests.push({ local, input, thinking: body.thinking });
  let answer;
  if (local) {
    writes++;
    answer = { html: mode === 'shared-budget' && writes <= 2 ? `<main>${input.html}</main>`
      : input.html.replace('营业时段', '营业安排').replace('用餐须知', '来店须知'), css: '' };
  } else {
    audits++;
    answer = mode === 'old-format' ? { issues: [] } : { results: input.segments.map((segment: any) => {
      const first = segment.headings.includes('营业安排');
      const missing = first && (mode === 'missing-always' || mode === 'shared-budget' || mode === 'missing-fixed' && audits === 1);
      const quote = first && audits === 1 && mode === 'nonliteral-fixed' ? '节假日的营业安排待补充。'
        : first && audits === 1 && mode === 'empty-fixed' ? '' : sentence;
      const citation = { category, claim: sentence, quote };
      const row: any = { id: segment.id, issues: missing ? [`页面原句：${sentence}；未提供支持声明的资料原句。`] : [], noFacts: false,
        factCategories: mode === 'duplicate-category' ? [category, category] : [category],
        citations: missing ? [] : mode === 'duplicate-citation' ? [citation, citation] : [citation] };
      if (mode === 'missing-noFacts') delete row.noFacts;
      if (mode === 'invalid-choice') row.noFacts = true;
      return row;
    }) };
  }
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(answer) } }], usage: { prompt_tokens: 30, completion_tokens: 20, total_tokens: 50 } }));
});
await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
const address = provider.address(); assert.ok(address && typeof address === 'object');
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
process.env.DEEPSEEK_API_KEY = 'local-only'; process.env.DEEPSEEK_MODEL = 'local-only';
test.after(() => new Promise<void>(resolve => provider.close(() => resolve())));

async function runBatch(nextMode: Mode) {
  mode = nextMode; audits = 0; writes = 0; requests.length = 0;
  const id = `t173-${crypto.randomUUID()}`;
  const saved = await commitSiteCode({ siteId: id, legacyImport: { kind: 'convert', name: '禾巷小馆', source: { revision: 1, updatedAt: new Date().toISOString() },
    materials: `公司名：禾巷小馆\n${sentence}`, code: original, exportIssues: [] } });
  assert.equal(saved.status, 'applied');
  await updateCodeSite(id, () => ({ preferences: { style: 'precision', layout: 5, density: 6 }, plan: { summary: '餐馆介绍', style: 'precision', styleReason: '既有方向', pages: [{ id: 'home', title: '首页', outline: '营业与须知' }, { id: 'menu', title: '菜单', outline: '家常饭菜' }] } }));
  const before = (await getCodeSite(id))!, version = before.versions[0];
  const items = ['营业时段', '用餐须知'].map((label, index) => ({ draftId: crypto.randomUUID(), revision: 1,
    target: { kind: 'dom', versionId: version.id, pageId: 'home', path: [index + 1], label, text: `${label}${sentence}` },
    body: index === 0 ? '把标题改为营业安排，保留节假日说明。' : '把标题改为来店须知，保留节假日说明。' }));
  const response = await chat(new Request(`${process.env.SITECRAFT_BASE}/api/sites/${id}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: '批量局部修改', baseRevision: 1, annotationBatch: items, saveAnnotation: true, annotationSubmissionId: crypto.randomUUID() }) }), { params: Promise.resolve({ siteId: id }) });
  assert.equal(response.status, 202, await response.clone().text());
  for (const callback of callbacks.splice(0)) await callback();
  const readback = await fetch(`${process.env.SITECRAFT_BASE}/api/sites/${id}/draft`);
  assert.equal(readback.status, 200);
  const done = (await readback.json()).codeSite;
  await writeFile(`${output}/${mode}.json`, JSON.stringify({ before, done, requests }, null, 2), 'utf8');
  assert.deepEqual(done.versions[0], before.versions[0], '不能回写旧版本');
  return { before, done, items };
}
function assertSaved(done: any) {
  assert.equal(done.run.status, 'complete', done.run.step);
  assert.equal(done.versions.length, 2, '多区块仅存一个新版本');
  const version = done.versions[1];
  assert.match(version.code.pages[0].html, /<h2>营业安排<\/h2>/);
  assert.match(version.code.pages[0].html, /<h2>来店须知<\/h2>/);
  assert.match(version.code.pages[0].html, /<aside>其余说明保留。<\/aside>/);
  assert.equal(version.code.pages[1].html, original.pages[1].html);
  const entries = version.checks.factCitations.entries.filter((entry: any) => entry.claim === sentence);
  assert.ok(entries.length);
  assert.ok(entries.every((entry: any) => entry.quote === sentence && entry.source.type === 'materials'));
  assert.deepEqual(entries.flatMap((entry: any) => entry.targets.map((target: any) => ({ pageId: target.pageId, path: target.path }))).sort((a: any, b: any) => a.path[0] - b.path[0]),
    [{ pageId: 'home', path: [1, 1] }, { pageId: 'home', path: [2, 1] }], '同一出处须保留两个核对段各自的定位');
  assert.ok(requests.filter(request => !request.local).every(request => request.thinking.type === 'disabled'));
}

test('跨核对段可引用同一句原文，多区块生产 chat 合并核对后只存一版', async () => {
  const { done } = await runBatch('valid');
  assertSaved(done); assert.equal(writes, 2); assert.equal(audits, 1); assert.equal(done.run.repairRound, 0);
});

for (const repairMode of ['missing-fixed', 'nonliteral-fixed', 'empty-fixed'] as const) {
  test(`${repairMode}：出处底线拒因进入修正，补上逐字原句后存版`, async () => {
    const { done } = await runBatch(repairMode);
    assertSaved(done); assert.equal(done.run.repairRound, 1); assert.equal(writes, 4); assert.equal(audits, 2);
    assert.match(done.run.attempts[0].checks.issues.join('\n'), /出处|资料原句/);
    const corrections = requests.filter(request => request.local).slice(2);
    assert.match(JSON.stringify(corrections[0].input), /出处|资料原句/);
    assert.deepEqual(corrections[1].input.issues, [], '第一段出处拒因不分配给第二段');
  });
}

for (const failureMode of ['missing-always', 'shared-budget'] as const) {
  test(`${failureMode}：两轮额度用完仍缺出处如实拒收，不存部分版本`, async () => {
    const { before, done, items } = await runBatch(failureMode);
    assert.equal(done.run.status, 'error'); assert.equal(done.run.repairRound, 2);
    assert.match(done.run.step, /两轮多区块修正/);
    assert.match(done.run.issues.join('\n'), /缺少有效资料出处/);
    assert.deepEqual(done.versions, before.versions); assert.equal(done.currentVersionId, before.currentVersionId);
    assert.equal(writes, 6); assert.equal(audits, failureMode === 'shared-budget' ? 2 : 3, '与区块合同修正共用两轮，不另开出处修正额度');
    assert.deepEqual(done.run.annotationResults.map((result: any) => result.draftIds), items.map(item => [item.draftId]));
    assert.match(done.run.annotationResults[0].message, /资料原句|出处/);
    assert.equal(done.run.annotationResults[1].message, '因其他组失败未保存。');
  });
}

for (const protocolMode of ['duplicate-category', 'duplicate-citation', 'missing-noFacts', 'invalid-choice', 'old-format'] as const) {
  test(`${protocolMode}：段内重复或协议错误直接拒收，不进修正轮`, async () => {
    const { before, done } = await runBatch(protocolMode);
    assert.equal(done.run.status, 'error'); assert.equal(done.run.repairRound, 0);
    assert.deepEqual(done.versions, before.versions); assert.equal(writes, 2); assert.equal(audits, 1);
    assert.match(done.run.step, /重复|noFacts|格式|核对段/);
  });
}
