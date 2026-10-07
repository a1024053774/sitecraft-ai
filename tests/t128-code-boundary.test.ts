import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import type { SiteCode } from '../lib/code-site.ts';

// Failure modes: generated CSS copy survives; compressed lines overlap;
// normal Chinese font padding is mistaken for overlap; the fill differs from color
// or cannot be measured; stale undo writes; confirmed deletion
// leaves code/materials/runs or readable previews; repairs exceed two rounds.
// These route-handler tests isolate only Next's deferred scheduler and the model HTTP
// response. Chrome, cleaning, commit checks, revision locks and file storage are real.
const scheduled: Array<() => Promise<void>> = [];
(globalThis as typeof globalThis & { __t128After?: typeof scheduled }).__t128After = scheduled;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'next/server.js') return { shortCircuit: true, url: 'data:text/javascript,export function after(fn){globalThis.__t128After.push(fn)}' };
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });

const good: SiteCode = { header: '<header>边界机械</header>', footer: '<footer>边界机械</footer>',
  css: 'body{margin:0;color:#111;background:#fff;font:16px/1.6 sans-serif}main,header,footer{padding:24px}p{max-width:32em}',
  pages: [{ id: 'home', title: '边界机械', html: '<main><h1>边界机械</h1><p>精密零件加工。</p></main>' }] };
let writerCalls = 0;
const server = createServer(async (req, res) => {
  if (req.url === '/') { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><html><body></body></html>'); return; }
  res.setHeader('content-type', 'application/json');
  if (req.url === '/api/health') { res.end('{}'); return; }
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw);
  const system = body.messages[0].content as string;
  let reply: unknown;
  if (system.includes('事实校对员')) reply = { issues: [] };
  else if (body.messages[1].content.includes('先给页面大纲')) reply = { summary: '首页介绍加工与联系。', style: 'precision', styleReason: '加工资料', pages: [{ id: 'home', title: '首页', outline: '公司与加工' }] };
  else { writerCalls++; reply = { ...good, pages: [{ ...good.pages[0], html: good.pages[0].html.replace('</main>', '<p>年产量 99999999 台。</p></main>') }] }; }
  res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(reply) } }] }));
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); assert.ok(address && typeof address === 'object');
const base = `http://127.0.0.1:${address.port}`;
process.env.SITE_STORE = 'fs'; process.env.SITECRAFT_BASE = base;
process.env.DEEPSEEK_BASE_URL = base; process.env.DEEPSEEK_API_KEY = 'local-test-only'; process.env.DEEPSEEK_MODEL = 'local-test-only';
const { POST: create } = await import('../app/api/sites/route.ts');
const { POST: chat } = await import('../app/api/sites/[siteId]/chat/route.ts');
const { PUT } = await import('../app/api/sites/[siteId]/draft/route.ts');
const { POST: undo } = await import('../app/api/sites/[siteId]/history/[action]/route.ts');
const { DELETE } = await import('../app/api/sites/[siteId]/route.ts');
const { GET: preview } = await import('../app/api/sites/[siteId]/code-preview/route.ts');
const { getCodeSite } = await import('../lib/code-site-store.ts');
const { deleteSiteRecord } = await import('../lib/site-store.ts');
const { checkSiteCode } = await import('../lib/code-site-check.ts');
const request = (url: string, method: string, body: unknown) => new Request(base + url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const context = (siteId: string) => ({ params: Promise.resolve({ siteId }) });
async function site() {
  const response = await create(request('/api/sites', 'POST', { name: '边界机械', templateId: 'forge', locales: ['zh'], generationRoute: 'code' }));
  assert.equal(response.status, 201); const { id } = await response.json();
  const start = await chat(request(`/api/sites/${id}/chat`, 'POST', { message: '公司名：边界机械\n精密零件加工。', baseRevision: 0 }), context(id));
  assert.equal(start.status, 200); return id as string;
}
async function put(id: string, code: SiteCode, baseRevision = 0) {
  return PUT(request(`/api/sites/${id}/draft`, 'PUT', { code, baseRevision, summary: '调整页面布局' }), context(id));
}
async function refused(code: SiteCode, pattern: RegExp, removed?: (cleaned: SiteCode) => void) {
  const id = await site();
  const response = await put(id, code); const payload = await response.json();
  assert.equal(response.status, 422, JSON.stringify(payload));
  assert.equal(payload.status, 'rejected'); assert.match(payload.checks.issues.join('\n'), pattern);
  assert.equal((await getCodeSite(id))!.versions.length, 0, 'refusal must not save a version');
  if (removed) {
    const result = await checkSiteCode({ siteId: id, code, materials: '边界机械 精密零件加工。', images: [] });
    assert.equal(result.checks.passed, false); assert.ok(result.checks.cleaned.length); removed(result.code);
  }
}
test.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });

for (const [name, css] of [
  ['string marker', 'li{list-style-type:"年产量 99999999 台"}'],
  ['symbols marker', 'li{list-style-type:symbols(cyclic "年产量 99999999 台")}'],
  ['shorthand marker', 'li{list-style:"年产量 99999999 台" inside}'],
  ['pseudo content', 'li::before{content:"年产量 99999999 台"}'],
  ['attribute content', 'li::before{content:attr(data-label)}'],
  ['variable marker', ':root{--claim:"年产量 99999999 台"}li{list-style-type:var(--claim)}'],
]) test(`CSS generated copy: ${name}`, async () => {
  await refused({ ...good, css: good.css + css, pages: [{ ...good.pages[0], html: '<main><h1>边界机械</h1><ul><li>精密零件加工。</li></ul></main>' }] }, /CSS/, clean => {
    assert.doesNotMatch(clean.css, /(?:list-style(?:-type)?|content)\s*:/);
  });
});
test('script alone is cleaned and cannot save', async () => {
  await refused({ ...good, pages: [{ ...good.pages[0], html: good.pages[0].html + '<script>window.bad=true</script>' }] }, /script/, clean => assert.doesNotMatch(clean.pages[0].html, /script|window.bad/));
});
test('external resource alone is cleaned and cannot save', async () => {
  await refused({ ...good, css: good.css + 'main{background-image:url(https://invalid.example/image.png)}' }, /CSS/, clean => assert.doesNotMatch(clean.css, /url\(|invalid.example/));
});
test('unsupported fact alone cannot save', async () => {
  const forged = { ...good, pages: [{ ...good.pages[0], html: good.pages[0].html.replace('</main>', '<p>年产量 99999999 台。</p></main>') }] };
  const cleaned = await checkSiteCode({ siteId: 't128-fact-cleaning', code: forged, materials: '边界机械 精密零件加工。', images: [] });
  assert.deepEqual(cleaned.checks.cleaned, [], 'a fake fact must be reported, not silently erased');
  assert.match(cleaned.code.pages[0].html, /99999999/);
  await refused(forged, /99999999/);
});
test('same-element compressed lines cannot save', async () => {
  await refused({ ...good, css: good.css + 'p{font-size:20px;line-height:4px}', pages: [{ ...good.pages[0], html: '<main><h1>边界机械</h1><p>精密零件加工。<br>精密零件加工。</p></main>' }] }, /文字重叠/);
});
test('normal Chinese line spacing passes despite fallback font range padding', async () => {
  const id = await site();
  const code = { ...good, css: good.css + 'h1{font-family:"PingFang SC",system-ui,sans-serif;font-size:25px;line-height:1.34;max-width:12em}',
    pages: [{ ...good.pages[0], html: '<main><h1>边界机械 精密零件加工。边界机械 精密零件加工。</h1><p>精密零件加工。</p></main>' }] };
  const response = await put(id, code); const payload = await response.json();
  assert.equal(response.status, 200, JSON.stringify(payload));
  assert.equal((await getCodeSite(id))!.versions.length, 1);
});
test('contrast follows actual text fill', async () => {
  await refused({ ...good, css: good.css + 'p{color:#111;-webkit-text-fill-color:#fff}' }, /对比度/);
  const id = await site();
  assert.equal((await put(id, { ...good, css: good.css + 'p{color:#fff;-webkit-text-fill-color:#111}' })).status, 200);
});
for (const css of ['p{-webkit-text-fill-color:transparent}', 'p{background:linear-gradient(#111,#111);background-clip:text;-webkit-background-clip:text}']) {
  test(`unmeasurable text paint refuses ${css}`, async () => { await refused({ ...good, css: good.css + css }, /无法测量.*未知/); });
}
test('stale manual writes and stale undo return 409 without storing; undo requires revision', async () => {
  const id = await site(); assert.equal((await put(id, good)).status, 200); assert.equal((await put(id, good, 1)).status, 200);
  const history = { params: Promise.resolve({ siteId: id, action: 'undo' }) };
  assert.equal((await put(id, good, 1)).status, 409);
  assert.equal((await undo(request(`/api/sites/${id}/history/undo`, 'POST', { baseRevision: 1 }), history)).status, 409);
  assert.equal((await getCodeSite(id))!.versions.length, 2);
  assert.equal((await undo(request(`/api/sites/${id}/history/undo`, 'POST', {}), history)).status, 400);
  assert.equal((await undo(request(`/api/sites/${id}/history/undo`, 'POST', { baseRevision: 2 }), history)).status, 200);
  const restored = (await getCodeSite(id))!;
  assert.equal(restored.versions.length, 3); assert.equal(restored.versions[2].restoredFrom, restored.versions[0].id);
});
test('confirmed deletion removes code versions, materials and runs; previews cannot revive it', async () => {
  const id = await site();
  const { getConversation } = await import('../lib/conversation-store.ts');
  const record = (await getCodeSite(id))!;
  const question = (await getConversation(id, record.conversationId))!.alignment.currentQuestion!;
  assert.equal((await chat(request(`/api/sites/${id}/chat`, 'POST', { action: 'select', questionId: question.questionId, questionRevision: question.questionRevision, optionId: 'precision' }), context(id))).status, 202);
  await scheduled.shift()!();
  assert.equal((await put(id, good)).status, 200);
  assert.ok((await getCodeSite(id))!.materials); assert.equal((await getCodeSite(id))!.runs.length, 1);
  assert.equal((await DELETE(request(`/api/sites/${id}`, 'DELETE', {}), context(id))).status, 400);
  assert.ok(await getCodeSite(id));
  assert.equal((await DELETE(request(`/api/sites/${id}`, 'DELETE', { confirmSiteId: id }), context(id))).status, 200);
  assert.equal(await getCodeSite(id), null);
  assert.equal(existsSync(path.join(process.cwd(), '.sitecraft-data/code-sites', `${id}.json`)), false);
  assert.equal((await preview(new Request(`${base}/api/sites/${id}/code-preview`), context(id))).status, 404);
});
test('preview requires the site record even when orphan code remains', async () => {
  const id = await site(); assert.equal((await put(id, good)).status, 200);
  await deleteSiteRecord(id); // Deliberate orphan models an interrupted delete or historic residue.
  assert.ok(await getCodeSite(id));
  assert.equal((await preview(new Request(`${base}/api/sites/${id}/code-preview`), context(id))).status, 404);
});
test('a deleted pending run cannot recreate code or conversations', async () => {
  const id = await site(); const record = (await getCodeSite(id))!;
  const { getConversation } = await import('../lib/conversation-store.ts');
  let question = (await getConversation(id, record.conversationId))!.alignment.currentQuestion!;
  assert.equal((await chat(request(`/api/sites/${id}/chat`, 'POST', { action: 'select', questionId: question.questionId, questionRevision: question.questionRevision, optionId: 'precision' }), context(id))).status, 202);
  await scheduled.shift()!();
  question = (await getConversation(id, record.conversationId))!.alignment.currentQuestion!;
  assert.equal((await chat(request(`/api/sites/${id}/chat`, 'POST', { action: 'confirm', questionId: question.questionId, questionRevision: question.questionRevision }), context(id))).status, 202);
  assert.equal((await getCodeSite(id))!.run!.status, 'running');
  assert.equal((await DELETE(request(`/api/sites/${id}`, 'DELETE', { confirmSiteId: id }), context(id))).status, 200);
  await scheduled.shift()!();
  assert.equal(await getCodeSite(id), null); assert.equal(await getConversation(id, record.conversationId), null);
});
test('two repair rounds stop visibly with three failed attempts and no version', async () => {
  const id = await site(); const record = (await getCodeSite(id))!;
  const { getConversation } = await import('../lib/conversation-store.ts');
  let question = (await getConversation(id, record.conversationId))!.alignment.currentQuestion!;
  const selected = await chat(request(`/api/sites/${id}/chat`, 'POST', { action: 'select', questionId: question.questionId, questionRevision: question.questionRevision, optionId: 'precision' }), context(id));
  assert.equal(selected.status, 202); await scheduled.shift()!();
  question = (await getConversation(id, record.conversationId))!.alignment.currentQuestion!;
  writerCalls = 0;
  const confirmed = await chat(request(`/api/sites/${id}/chat`, 'POST', { action: 'confirm', questionId: question.questionId, questionRevision: question.questionRevision }), context(id));
  assert.equal(confirmed.status, 202); await scheduled.shift()!();
  const result = (await getCodeSite(id))!;
  assert.equal(writerCalls, 3, 'one initial write and at most two repairs');
  assert.equal(result.versions.length, 0); assert.equal(result.run!.status, 'error');
  assert.equal(result.run!.repairRound, 2); assert.equal(result.run!.attempts.length, 3);
  assert.match(result.run!.step, /两轮修正后仍未通过/);
  assert.match((await getConversation(id, record.conversationId))!.turns.at(-1)!.aiSummary, /未保存版本/);
});
