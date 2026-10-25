import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { factAuditReply } from './fixtures/fact-audit-reply.ts';

// Failure modes: a follow-up replaces materials or sources; crash recovery loses
// the confirmed outline; a stale confirm repeats work; recovery calls the model
// before a click; an unconfirmed plan becomes executable after a crash.
const callbacks: Array<() => Promise<void>> = [];
(globalThis as any).__t205After = callbacks;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'next/server.js') return { shortCircuit: true, url: 'data:text/javascript,export function after(fn){globalThis.__t205After.push(fn)}' };
  if (!specifier.startsWith('@/')) return next(specifier, context);
  return next(pathToFileURL(`${path.join(process.cwd(), specifier.slice(2))}.ts`).href, context);
} });
assert.ok(process.env.SITECRAFT_DATA_ROOT);
process.env.SITECRAFT_DATA_ROOT = path.join(process.env.SITECRAFT_DATA_ROOT, 't205-browser');
process.env.SITE_STORE = 'browser';
const output = `artifacts/t205/entry-${Date.now()}`; await mkdir(output, { recursive: true });
const materials = '公司名：青禾维修\n提供日常维修和设备保养。维修项目按设备情况确认，保养项目由使用方提供。';
const code = { header: '<header><a href="/home">青禾维修</a><nav><a href="/services">服务项目</a></nav></header>', footer: '<footer>青禾维修</footer>',
  css: 'body{margin:0;background:#fff;color:#111;font:16px/1.8 sans-serif}header,main,footer{max-width:960px;margin:auto;padding:24px}nav{padding:12px 0}a{color:#111}section{margin:24px 0}',
  pages: [{ id: 'home', title: '首页', html: '<main><h1>青禾维修</h1><section><h2>日常维修</h2><p>提供日常维修和设备保养。</p></section></main>' },
    { id: 'services', title: '服务项目', html: '<main><h1>服务项目</h1><section><h2>维修与保养</h2><p>维修项目按设备情况确认，保养项目由使用方提供。</p></section></main>' }] };
let modelCalls = 0;
const provider = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw); modelCalls++;
  const answer = body.messages[0].content.includes('事实校对员') ? factAuditReply(body, { issues: [] }) : code;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(answer) } }], usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 } }));
});
await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
const address = provider.address(); assert.ok(address && typeof address === 'object');
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
process.env.DEEPSEEK_API_KEY = 't205-fixture'; process.env.DEEPSEEK_MODEL = 't205-fixture';
const sites = await import('../app/api/sites/route.ts');
const chat = await import('../app/api/sites/[siteId]/chat/route.ts');
const { getCodeSite, updateCodeSite } = await import('../lib/code-site-store.ts');
const { getConversation, updateConversationAlignment } = await import('../lib/conversation-store.ts');
test.after(() => new Promise<void>(resolve => provider.close(() => resolve())));

async function post(id: string, cookie: string, body: unknown) {
  const response = await chat.POST(new Request(`http://local/api/sites/${id}/chat`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body) }), { params: Promise.resolve({ siteId: id }) });
  return { status: response.status, body: await response.json() };
}
async function interrupted(confirmed = true) {
  const response = await sites.POST(new Request('http://local/api/sites', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"name":"青禾维修"}' }));
  const cookie = response.headers.get('set-cookie')!.split(';')[0], site = (await response.json()).codeSite;
  assert.equal((await post(site.siteId, cookie, { message: materials })).status, 200);
  const now = new Date().toISOString();
  await updateCodeSite(site.siteId, () => ({ plan: { summary: '首页与服务项目', style: 'precision', styleReason: '按维修项目展示', pages: code.pages.map(page => ({ id: page.id, title: page.title, outline: '资料中已有的维修与保养' })) },
    run: { id: crypto.randomUUID(), kind: confirmed ? 'generate' : 'plan', status: 'running', step: '进程退出前', request: materials, baseRevision: 0, startedAt: now, updatedAt: now, repairRound: 0, issues: [], attempts: [] } }));
  await updateConversationAlignment(site.siteId, site.conversationId, record => ({ ...record, alignment: { ...record.alignment,
    state: 'awaiting_confirmation', currentQuestion: { questionId: 'saved-outline', questionRevision: 2, kind: 'confirm_ops', prompt: '首页与服务项目', options: [{ id: 'approve', label: '确认并生成', description: '按大纲生成' }], allowOther: false },
    proposedChange: { questionId: 'saved-outline', questionRevision: 2, summary: '首页与服务项目', rejected: [], baseRevision: 0, model: 'fixture', latencyMs: 0 },
    confirmClaimed: confirmed, styleOptionId: 'precision', epoch: 2, lastResult: null } }));
  return { id: site.siteId as string, conversationId: site.conversationId as string, cookie };
}

test('interrupted first generation appends a follow-up and keeps every original source', async () => {
  const item = await interrupted(), previousCalls = modelCalls;
  await post(item.id, item.cookie, { action: 'state' });
  const message = '补充：只展示已有项目，不增加响应承诺。';
  const result = await post(item.id, item.cookie, { message });
  assert.equal(result.status, 200);
  const after = (await getCodeSite(item.id))!;
  await writeFile(`${output}/follow-up.json`, JSON.stringify(result, null, 2));
  assert.equal(after.materials, `${materials}\n\n${message}`);
  assert.deepEqual(after.factSources, [{ type: 'message', messageIndex: 1, text: materials }, { type: 'message', messageIndex: 2, text: message }]);
  assert.equal(result.body.alignment.questionKind, 'style');
  assert.equal(modelCalls, previousCalls, 'a follow-up does not start generation before alignment');
});

test('recovery restores the confirmed outline, refuses a stale confirm and regenerates via the existing entry', async () => {
  const item = await interrupted(), previousCalls = modelCalls;
  const state = await post(item.id, item.cookie, { action: 'state' });
  await writeFile(`${output}/recovered.json`, JSON.stringify(state, null, 2));
  assert.equal(state.body.alignment.awaitingConfirmation, true);
  assert.equal(modelCalls, previousCalls, 'refresh must not call the model');
  assert.equal((await post(item.id, item.cookie, { action: 'confirm', questionId: 'saved-outline', questionRevision: 2 })).status, 409);
  const current = state.body.alignment;
  const accepted = await post(item.id, item.cookie, { action: 'confirm', questionId: current.questionId, questionRevision: current.questionRevision });
  assert.equal(accepted.status, 202); assert.equal(accepted.body.codeSite.run.kind, 'generate');
  assert.equal(accepted.body.codeSite.run.request, materials); assert.equal(callbacks.length, 1);
  const duplicate = await post(item.id, item.cookie, { action: 'confirm', questionId: current.questionId, questionRevision: current.questionRevision });
  assert.equal(duplicate.status, 409); assert.equal(callbacks.length, 1);
  await callbacks.shift()!();
  const after = (await getCodeSite(item.id))!;
  await writeFile(`${output}/generated.json`, JSON.stringify(after, null, 2));
  assert.equal(after.run?.status, 'complete', JSON.stringify(after.run?.issues));
  assert.equal(after.versions.length, 1); assert.deepEqual(after.versions[0].code.pages.map(page => page.id), ['home', 'services']);
  assert.equal(after.materials, materials); assert.ok(modelCalls > previousCalls);
  assert.equal((await getConversation(item.id, item.conversationId))!.alignment.lastResult?.status, 'applied');
});

test('an interrupted unconfirmed planning task does not expose a generation confirmation', async () => {
  const item = await interrupted(false);
  const state = await post(item.id, item.cookie, { action: 'state' });
  assert.equal(state.body.alignment.awaitingConfirmation, false);
  assert.equal(callbacks.length, 0);
});
