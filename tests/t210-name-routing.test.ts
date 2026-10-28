import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import type { SiteCode } from '../lib/code-site.ts';

// Acceptance inputs come from the user's declaration, not generated code.
// Failures: institutions stay unnamed; conflicting names reach writing;
// internal observations enter model repair; an actually absent name passes.
registerHooks({ resolve(s, context, next) {
  if (s === 'next/server.js') return { shortCircuit: true, url: 'data:text/javascript,export function after(){throw new Error("No model work expected")}' };
  if (s.startsWith('@/')) return next(pathToFileURL(path.join(process.cwd(), s.slice(2) + '.ts')).href, context);
  return next(s, context);
} });
const { createCodeSite, getCodeSite, commitSiteCode } = await import('../lib/code-site-store.ts');
const { getOrCreateConversation } = await import('../lib/conversation-store.ts');
const { handleCodeChat } = await import('../lib/code-site-workflow.ts');
const output = `artifacts/t210/names-${Date.now()}`;
await mkdir(output, { recursive: true });
async function setup(message: string) {
  const id = `t210-${crypto.randomUUID()}`;
  const c = await getOrCreateConversation(id, id);
  await createCodeSite(id, '未命名站点', c.conversationId);
  const response = await handleCodeChat(id, { message });
  const body = await response.json();
  await writeFile(`${output}/${id}.json`, JSON.stringify(body, null, 2));
  return { id, response, body, site: (await getCodeSite(id))! };
}
for (const label of ['公司名', '机构名', '企业名称', '主体名称']) test(`explicit ${label} registers the same subject`, async () => {
  const item = await setup(`${label}：博思数字创意与视觉设计研习社\n面向成人的数字设计课程。`);
  assert.equal(item.response.status, 200);
  assert.equal(item.site.name, '博思数字创意与视觉设计研习社');
  assert.equal(item.body.alignment.questionKind, 'style');
});
test('a declared name ends before same-line introduction and replaces a pre-generation display name', async () => {
  const id = `t210-${crypto.randomUUID()}`, c = await getOrCreateConversation(id, id);
  await createCodeSite(id, '临时工作区', c.conversationId);
  const reply = await handleCodeChat(id, { message: '机构名：闻溪研习社。提供成人数字设计课程。' });
  assert.equal(reply.status, 200);
  const site = (await getCodeSite(id))!;
  assert.equal(site.subject!.name, '闻溪研习社');
  assert.equal(site.name, '闻溪研习社');
  assert.equal(site.subject!.declaration!.quote, '机构名：闻溪研习社');
});
test('an explicitly empty name still requires clarification', async () => {
  const item = await setup('主体名称：\n提供成人数字设计课程。');
  assert.equal(item.body.alignment.questionKind, 'clarify');
  assert.equal(item.site.run, null);
});
test('missing or conflicting identity asks for a name before style or writing', async () => {
  for (const message of ['面向成人的数字设计课程。', '公司名：青禾工作室\n机构名：博思研习社']) {
    const item = await setup(message);
    assert.equal(item.body.alignment.questionKind, 'clarify');
    assert.match(item.body.alignment.question, /名称/);
    assert.equal(item.site.run, null);
  }
});

const providerRequests: any[] = [];
const provider = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw); providerRequests.push(body);
  const input = JSON.parse(body.messages[1].content.split('\n')[0]);
  const rows = input.segments.map((s: any) => ({ id: s.id, noFacts: true, factCategories: [], citations: [],
    issues: s.text.startsWith('站点公司名检查') ? ['系统观察要求的是占位站名，而候选包含资料中的完整机构名。'] : [] }));
  const fn = body.tools?.[0]?.function.name;
  const answer = fn === 'submit_fact_review' ? Object.fromEntries(rows.map(({ id, ...row }: any) => [id, row])) : { results: rows };
  const message = fn ? { content: null, tool_calls: [{ type: 'function', function: { name: fn, arguments: JSON.stringify(answer) } }] } : { content: JSON.stringify(answer) };
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ choices: [{ finish_reason: fn ? 'tool_calls' : 'stop', message }], usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 } }));
});
await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
const address = provider.address(); assert.ok(address && typeof address === 'object');
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
process.env.DEEPSEEK_API_KEY = 't210-local'; process.env.DEEPSEEK_MODEL = 'fixture';
test.after(() => new Promise<void>(resolve => provider.close(() => resolve())));
const candidate: SiteCode = { header: '<header>博思</header>', footer: '<footer>博思数字创意与视觉设计研习社</footer>',
  css: 'body{margin:0;padding:24px;color:#111;background:white;font:18px/1.8 sans-serif}section{padding:24px 0}',
  pages: [{ id: 'home', title: '首页', html: '<main><h1>数字设计</h1><section><h2>课程介绍</h2><p>面向成人的数字设计课程。</p></section></main>' }] };
test('real declaration and full-name footer pass without sending internal observations to the fact model', async () => {
  const item = await setup('机构名：博思数字创意与视觉设计研习社\n面向成人的数字设计课程。');
  const result = await commitSiteCode({ siteId: item.id, baseRevision: 0, code: candidate, author: 'user', summary: '机构资料验收', request: '' });
  await writeFile(`${output}/candidate-result.json`, JSON.stringify(result, null, 2));
  assert.equal(result.status, 'applied', JSON.stringify(result));
  assert.ok(providerRequests.every(r => !JSON.stringify(r).includes('站点公司名检查')));
});
test('actually missing full name is rejected before semantic audit without opening a repair range', async () => {
  const item = await setup('机构名：博思数字创意与视觉设计研习社\n面向成人的数字设计课程。');
  const before = providerRequests.length;
  const result = await commitSiteCode({ siteId: item.id, baseRevision: 0, code: { ...candidate, footer: '<footer>博思</footer>' }, author: 'user', summary: '漏名反例', request: '' });
  assert.equal(result.status, 'rejected');
  if (result.status === 'rejected') {
    assert.match(result.checks.issues.join('；'), /完整主体名称/);
    assert.equal(result.checks.factSegments, undefined);
  }
  assert.equal(providerRequests.length, before);
  assert.equal((await getCodeSite(item.id))!.versions.length, 0);
});

test('subject declarations belong to the submitted version and undo restores the prior identity', async () => {
  const item = await setup('机构名：青禾研习社\n提供数字设计课程。');
  const firstCode = { ...candidate, header: '<header>青禾研习社</header>', footer: '<footer>青禾研习社</footer>' };
  const first = await commitSiteCode({ siteId: item.id, baseRevision: 0, code: firstCode, author: 'user', summary: '首版', request: '' });
  assert.equal(first.status, 'applied'); if (first.status !== 'applied') throw Error('first version missing');
  const message = '主体名称：新禾研习社';
  const second = await commitSiteCode({ siteId: item.id, baseRevision: 1, code: { ...firstCode, header: '<header>新禾研习社</header>', footer: '<footer>新禾研习社</footer>' }, author: 'user', summary: '改名', request: message, source: { type: 'message', messageIndex: 2, text: message } });
  assert.equal(second.status, 'applied', JSON.stringify(second));
  assert.equal((await getCodeSite(item.id))!.subject!.name, '新禾研习社');
  const restored = await commitSiteCode({ siteId: item.id, baseRevision: 2, restoreVersionId: first.version.id, author: 'user', summary: '恢复原名', request: '撤销改名' });
  assert.equal(restored.status, 'applied', JSON.stringify(restored));
  assert.equal((await getCodeSite(item.id))!.subject!.name, '青禾研习社');
  if (restored.status === 'applied') assert.deepEqual(restored.version.code, first.version.code);
});
test('a rejected identity update cannot mutate the accepted identity or code', async () => {
  const item = await setup('机构名：青禾研习社\n提供数字设计课程。');
  const original = { ...candidate, header: '<header>青禾研习社</header>', footer: '<footer>青禾研习社</footer>' };
  const first = await commitSiteCode({ siteId: item.id, baseRevision: 0, code: original, author: 'user', summary: '首版', request: '' });
  assert.equal(first.status, 'applied');
  const before = (await getCodeSite(item.id))!;
  const response = await handleCodeChat(item.id, { message: '公司名：新禾研习社\n机构名：另一研习社', baseRevision: 1 });
  assert.equal(response.status, 422);
  const after = (await getCodeSite(item.id))!;
  assert.deepEqual(after.subject, before.subject); assert.deepEqual(after.versions, before.versions);
});
