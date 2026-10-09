import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import type { SiteCode } from '../lib/code-site.ts';

// Failure modes: a real rejection poisons alignment and refresh; summary clipping
// discards full issues; another writer persists an invalid snapshot; legacy reads
// silently rewrite records; a broad catch hides other corruption; unavailable chat
// schedules another model call. Only provider HTTP and Next's deferred scheduler
// are fixtures. Route handlers, submission, Chrome and both stores are real.
const fixture = JSON.parse(await readFile('tests/fixtures/t136/long-rejection.json', 'utf8'));
const scheduled: Array<() => Promise<void>> = [];
(globalThis as typeof globalThis & { __t136After?: typeof scheduled }).__t136After = scheduled;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'next/server.js') return { shortCircuit: true, url: 'data:text/javascript,export function after(fn){globalThis.__t136After.push(fn)}' };
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });
let reject = true, writerCalls = 0;
const records: unknown[] = [];
const server = createServer(async (req, res) => {
  if (req.method === 'GET') { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><html><body>local fixture origin</body></html>'); return; }
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw), user = body.messages[1].content, system = body.messages[0].content;
  const repairInput = system.includes('修正输出合同') ? JSON.parse(user.slice(0, user.lastIndexOf('\n请以 json'))) : null;
  const content = repairInput ? (writerCalls++, { replacements: [{ fragmentId: repairInput.fragments[0].id, after: repairInput.fragments[0].before }] })
    : system.includes('事实校对员') ? { issues: reject ? fixture.issues : [] }
    : user.includes('先给页面大纲') ? fixture.plan : (writerCalls++, fixture.candidate);
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] }));
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); assert.ok(address && typeof address === 'object');
const base = `http://127.0.0.1:${address.port}`;
process.env.SITE_STORE = 'fs'; process.env.SITECRAFT_BASE = base;
process.env.DEEPSEEK_BASE_URL = base; process.env.DEEPSEEK_API_KEY = 't136-local-fixture'; process.env.DEEPSEEK_MODEL = 't136-fixture';
const { POST: create } = await import('../app/api/sites/route.ts');
const { POST: chat } = await import('../app/api/sites/[siteId]/chat/route.ts');
const { GET: draft, PUT } = await import('../app/api/sites/[siteId]/draft/route.ts');
const { GET: preview } = await import('../app/api/sites/[siteId]/code-preview/route.ts');
const { getCodeSite, updateCodeSite } = await import('../lib/code-site-store.ts');
const { getConversation, updateConversationAlignment } = await import('../lib/conversation-store.ts');
const { applyCommittedResult, disabledAlignment } = await import('../lib/alignment.ts');
const ctx = (siteId: string) => ({ params: Promise.resolve({ siteId }) });
const request = (url: string, method: string, body?: unknown) => new Request(base + url, { method,
  ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}) });
const conversationPath = (id: string, conversationId: string) => path.join('.sitecraft-data/conversations', id, `${conversationId}.json`);
async function makeSite() {
  const response = await create(request('/api/sites', 'POST', { name: '青禾纸包装', templateId: 'forge', locales: ['zh'], generationRoute: 'code' }));
  assert.equal(response.status, 201); const { id } = await response.json();
  const start = await chat(request(`/api/sites/${id}/chat`, 'POST', { message: fixture.materials, baseRevision: 0 }), ctx(id));
  assert.equal(start.status, 200); return { id: id as string, state: await start.json() };
}
async function readDraft(id: string) {
  // Native Next turns the thrown route error into HTTP 500. Keep that observed
  // failure visible here so the same acceptance assertion can run red and green.
  try { return await draft(request(`/api/sites/${id}/draft`, 'GET'), ctx(id)); }
  catch (error) { return Response.json({ error: String(error) }, { status: 500 }); }
}
test.after(async () => {
  const folder = `artifacts/t136/contracts-${crypto.randomUUID()}`; await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, 'report.json'), JSON.stringify({ time: new Date().toISOString(), provider: 'local fixture only', records }, null, 2));
  await new Promise<void>(resolve => server.close(() => resolve()));
});
test('real long rejection preserves full run evidence while draft and chat refresh remain readable', async () => {
  reject = true; writerCalls = 0;
  assert.equal(fixture.failedStep.length, fixture.observed.alignmentSummaryChars);
  assert.ok(fixture.failedStep.length > fixture.observed.limit);
  const { id, state } = await makeSite();
  const select = await chat(request(`/api/sites/${id}/chat`, 'POST', { action: 'select', questionId: state.alignment.questionId,
    questionRevision: state.alignment.questionRevision, optionId: 'documentary' }), ctx(id));
  assert.equal(select.status, 202); await scheduled.shift()!();
  let site = (await getCodeSite(id))!;
  const conversation = (await getConversation(id, site.conversationId))!;
  const question = conversation.alignment.currentQuestion!;
  const confirm = await chat(request(`/api/sites/${id}/chat`, 'POST', { action: 'confirm', questionId: question.questionId, questionRevision: question.questionRevision }), ctx(id));
  assert.equal(confirm.status, 202);
  const deferredErrors: string[] = [];
  try { await scheduled.shift()!(); } catch (error) { deferredErrors.push(String(error)); }
  site = (await getCodeSite(id))!;
  const response = await readDraft(id), payload = await response.json();
  records.push({ case: 'new-failure', id, deferredErrors, response: { status: response.status, payload }, run: site.run });
  assert.equal(response.status, 200, 'refresh must not return 500 after a rejected generation');
  assert.deepEqual(deferredErrors, []);
  assert.equal(writerCalls, 3); assert.equal(site.versions.length, 0); assert.equal(site.run!.status, 'error');
  assert.deepEqual(site.run!.issues, fixture.issues);
  assert.equal(site.run!.attempts.length, 3);
  for (const attempt of site.run!.attempts) assert.deepEqual(attempt.checks.issues, fixture.issues, 'archive must retain every complete real issue');
  const raw = JSON.parse(await readFile(conversationPath(id, site.conversationId), 'utf8'));
  assert.ok(raw.alignment.lastResult.summary.length < fixture.observed.limit);
  assert.match(raw.alignment.lastResult.summary, /底线检查/); assert.match(raw.alignment.lastResult.summary, /重试/);
  assert.match(payload.turns.at(-1).aiSummary, /重试/);
  const refreshed = await chat(request(`/api/sites/${id}/chat`, 'POST', { action: 'state' }), ctx(id));
  assert.equal(refreshed.status, 200); assert.deepEqual((await refreshed.json()).codeSite.run.issues, fixture.issues);
});
test('old oversized conversation is reported without rewriting; saved versions and preview remain accessible', async () => {
  reject = false; const { id } = await makeSite();
  const code: SiteCode = { header: '<header>青禾纸包装</header>', footer: '<footer>青禾纸包装</footer>',
    css: 'body{margin:0;font:16px/1.6 sans-serif;color:#111;background:#fff}header,main,footer{padding:24px}p{max-width:32em}',
    pages: [{ id: 'home', title: '青禾纸包装', html: '<main><h1>青禾纸包装</h1><p>纸盒和纸浆模塑内托，用于烘焙、茶叶礼盒和日用品包装。</p></main>' }] };
  assert.equal((await PUT(request(`/api/sites/${id}/draft`, 'PUT', { code, baseRevision: 0, summary: '保存页面' }), ctx(id))).status, 200);
  let site = (await getCodeSite(id))!;
  await updateCodeSite(id, () => ({ run: { id: crypto.randomUUID(), kind: 'generate', status: 'error', request: fixture.materials,
    step: fixture.failedStep, baseRevision: 1, startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), repairRound: 2,
    issues: fixture.issues, attempts: [] } }));
  site = (await getCodeSite(id))!; const file = conversationPath(id, site.conversationId);
  const raw = JSON.parse(await readFile(file, 'utf8'));
  raw.alignment.lastResult = { status: 'error', summary: fixture.failedStep };
  raw.alignment.history.push({ at: new Date().toISOString(), action: 'committed', summary: fixture.failedStep });
  const original = JSON.stringify(raw, null, 2); await writeFile(file, original);
  const response = await readDraft(id), payload = await response.json();
  records.push({ case: 'old-corruption', id, status: response.status, payload });
  assert.equal(response.status, 200);
  assert.match(payload.conversationError, /会话.*过长/);
  assert.equal(payload.alignment, null); assert.equal(payload.codeSite.currentVersionId, site.currentVersionId);
  assert.equal(payload.codeSite.materials, fixture.materials); assert.deepEqual(payload.codeSite.versions, site.versions);
  assert.deepEqual(payload.codeSite.run.issues, fixture.issues);
  const refreshed = await chat(request(`/api/sites/${id}/chat`, 'POST', { action: 'state' }), ctx(id));
  assert.equal(refreshed.status, 200); assert.match((await refreshed.json()).conversationError, /会话.*过长/);
  const denied = await chat(request(`/api/sites/${id}/chat`, 'POST', { message: '把标题改短。', baseRevision: 1 }), ctx(id));
  assert.equal(denied.status, 422); assert.match((await denied.json()).userMessage, /会话.*过长/);
  assert.equal(scheduled.length, 0, 'an unreadable conversation must not schedule a model call');
  assert.equal(await readFile(file, 'utf8'), original, 'reads and denied chat cannot mutate stored user data');
  const page = await preview(request(`/api/sites/${id}/code-preview?page=home`, 'GET'), ctx(id));
  assert.equal(page.status, 200); assert.match(await page.text(), /青禾纸包装/);
});
test('a writer cannot persist an oversized snapshot, and other schema corruption is not hidden as a supported long-text case', async () => {
  const { id } = await makeSite(); const site = (await getCodeSite(id))!, file = conversationPath(id, site.conversationId);
  const original = await readFile(file, 'utf8');
  await assert.rejects(updateConversationAlignment(id, site.conversationId, record => ({ ...record,
    alignment: { ...record.alignment, lastResult: { status: 'error', summary: fixture.failedStep } } })), /会话.*过长/);
  assert.equal(await readFile(file, 'utf8'), original, 'invalid write must leave the previous record intact');
  const raw = JSON.parse(original); raw.alignment.enabled = 'invalid boolean'; raw.alignment.lastResult = { status: 'error', summary: fixture.failedStep };
  await writeFile(file, JSON.stringify(raw));
  assert.equal((await readDraft(id)).status, 500, 'a targeted long-text reader must not swallow other corruption');
});
test('the shared committed-result transition bounds both summary fields before persistence', async () => {
  const { id } = await makeSite(); const site = (await getCodeSite(id))!;
  const snapshot = applyCommittedResult(disabledAlignment(), { status: 'error', summary: fixture.failedStep });
  assert.ok(snapshot.lastResult!.summary!.length <= fixture.observed.limit);
  assert.ok(snapshot.history.at(-1)!.summary!.length <= fixture.observed.limit);
  await updateConversationAlignment(id, site.conversationId, record => ({ ...record, alignment: snapshot }));
  assert.equal((await getConversation(id, site.conversationId))!.alignment.lastResult!.status, 'error');
});
