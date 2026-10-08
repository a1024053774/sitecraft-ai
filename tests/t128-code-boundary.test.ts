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
let auditedText = '';
const server = createServer(async (req, res) => {
  if (req.url === '/') { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><html><body></body></html>'); return; }
  res.setHeader('content-type', 'application/json');
  if (req.url === '/api/health') { res.end('{}'); return; }
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw);
  const system = body.messages[0].content as string;
  let reply: unknown;
  if (system.includes('事实校对员')) {
    auditedText = body.messages[1].content;
    reply = { issues: auditedText.includes('终身保修') ? ['资料没有终身保修承诺。'] : [] };
  }
  else if (body.messages[1].content.includes('先给页面大纲')) reply = { summary: '首页介绍加工与联系。', style: 'precision', styleReason: '加工资料', pages: [{ id: 'home', title: '首页', outline: '公司与加工' }] };
  else { writerCalls++; reply = { ...good, pages: [{ ...good.pages[0], html: good.pages[0].html.replace('</main>', '<p>年产量 99999999 台。</p></main>') }] }; }
  res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(reply) } }] }));
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); assert.ok(address && typeof address === 'object');
const base = `http://127.0.0.1:${address.port}`;
process.env.SITE_STORE = 'fs'; process.env.SITECRAFT_BASE = base;
process.env.DEEPSEEK_BASE_URL = base; process.env.DEEPSEEK_API_KEY = 'local-test-only'; process.env.DEEPSEEK_MODEL = 'local-test-only';
const { POST: create, GET: list } = await import('../app/api/sites/route.ts');
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
async function lineFeedback(code: SiteCode) {
  const id = await site();
  assert.equal((await put(id, code)).status, 200, 'line length is quality feedback');
  const saved = (await getCodeSite(id))!.versions[0];
  assert.equal(saved.checks.issues.length, 0);
  assert.ok(saved.checks.viewports.some(viewport => viewport.longLines > 0));
}
test.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });

for (const [name, css] of [
  ['string marker', 'li{list-style-type:"年产量 99999999 台"}'],
  ['shorthand marker', 'li{list-style:"年产量 99999999 台" inside}'],
  ['before content', 'li::before{content:"年产量 99999999 台"}'],
  ['after content', 'li::after{content:"年产量 99999999 台"}'],
  ['marker content', 'li::marker{content:"年产量 99999999 台"}'],
  ['variable marker', ':root{--claim:"年产量 99999999 台"}li{list-style-type:var(--claim)}'],
]) test(`CSS generated copy: ${name}`, async () => {
  await refused({ ...good, css: good.css + css, pages: [{ ...good.pages[0], html: '<main><h1>边界机械</h1><ul><li>精密零件加工。</li></ul></main>' }] }, /99999999/);
});
test('review3: rendered generated words reach fact audit; supported source text passes', async () => {
  auditedText = '';
  await refused({ ...good, css: good.css + 'p::before{content:"终身保修"}' }, /终身保修/);
  assert.ok(auditedText.includes('终身保修'), 'the fact auditor must receive generated text, not just HTML');
  assert.equal((await put(await site(), { ...good, css: good.css + 'p::before{content:"精密零件加工。"}' })).status, 200);
});
test('review3: computed attr text is inspected; unused pseudo declarations do not invent text', async () => {
  const code = { ...good, css: good.css + 'p::before{content:attr(data-label)}',
    pages: [{ ...good.pages[0], html: '<main><h1>边界机械</h1><p data-label="精密零件加工。">精密零件加工。</p></main>' }] };
  assert.equal((await put(await site(), code)).status, 200);
  assert.equal((await put(await site(), { ...good, css: good.css + 'p::before{content:attr(data-label)}' })).status, 200);
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

// Review 2 failure modes: harmless span wrappers change overlap/heading decisions;
// ordinary list ordinals are removed; nested styles or trailing declarations vanish;
// div/li/dd/caption prose evades line measurement; list metadata uses the legacy seed
// or is copied into both records instead of reading the authoritative code record.
test('review2: normal span-wrapped Chinese lines pass; compressed lines still refuse', async () => {
  const code = { ...good, css: good.css + 'h1{font-family:"PingFang SC",system-ui,sans-serif;font-size:25px;line-height:1.34;max-width:12em}',
    pages: [{ ...good.pages[0], html: '<main><h1><span>边界机械 精密零件加工。</span><br><span>边界机械 精密零件加工。</span></h1><p>精密零件加工。</p></main>' }] };
  assert.equal((await put(await site(), code)).status, 200);
  await refused({ ...code, css: code.css + 'h1{line-height:4px}' }, /文字重叠/);
});
test('review2: heading descendants share title semantics; small title text needs body contrast', async () => {
  for (const text of ['边界机械', '<span><em>边界机械</em></span>']) {
    const code = { ...good, css: good.css + 'h1{font-size:30px;color:#888;line-height:1.6}',
      pages: [{ ...good.pages[0], html: `<main><h1>${text}</h1><p>精密零件加工。</p></main>` }] };
    assert.equal((await put(await site(), code)).status, 200, 'large title at 3–4.5:1 must pass with or without spans');
  }
  await refused({ ...good, pages: [{ ...good.pages[0], html: '<main><h1><span style="font-size:16px;font-weight:400;color:#888">边界机械</span></h1><p>精密零件加工。</p></main>' }] }, /对比度/);
});
test('review2: standard ordered-list markers survive cleaning; arbitrary strings refuse', async () => {
  for (const value of ['decimal', 'decimal-leading-zero', 'lower-roman', 'upper-alpha']) {
    const id = await site();
    const code = { ...good, css: good.css + `ol{list-style:${value} outside}`,
      pages: [{ ...good.pages[0], html: '<main><h1>边界机械</h1><ol><li>精密零件加工。</li><li>边界机械</li></ol></main>' }] };
    assert.equal((await put(id, code)).status, 200, value);
    assert.match((await getCodeSite(id))!.versions[0].code.css, new RegExp(`list-style(?:-type)?:[^;]*${value}`));
  }
  await refused({ ...good, css: good.css + 'li{list-style-type:"年产量 99999999 台"}',
    pages: [{ ...good.pages[0], html: '<main><h1>边界机械</h1><ol><li>精密零件加工。</li></ol></main>' }] }, /99999999/);
});
test('review2: standard marker variables pass; string marker variables refuse', async () => {
  const code = { ...good, css: good.css + ':root{--marker:decimal}ol{list-style-type:var(--marker)}',
    pages: [{ ...good.pages[0], html: '<main><h1>边界机械</h1><ol><li>精密零件加工。</li></ol></main>' }] };
  assert.equal((await put(await site(), code)).status, 200);
  await refused({ ...code, css: good.css + ':root{--marker:"年产量 99999999 台"}ol{list-style-type:var(--marker)}' }, /99999999/);
});
test('review2: nested styles and trailing declarations survive; nested bad contrast refuses', async () => {
  const id = await site();
  const code = { ...good, css: good.css + 'main{ & p{max-width:20em;} @media(min-width:600px){ & h1{font-size:30px;} } letter-spacing:0.1px; }' };
  assert.equal((await put(id, code)).status, 200);
  const saved = (await getCodeSite(id))!.versions[0].code.css;
  assert.match(saved, /& p\s*\{[^}]*max-width:\s*20em/);
  assert.match(saved, /@media[^]*& h1\s*\{[^}]*font-size:\s*30px/);
  assert.match(saved, /letter-spacing:\s*0\.1px/);
  await refused({ ...good, css: good.css + 'main{ & p{color:#fff;} }' }, /对比度/);
});
test('review2: unsupported nested rules refuse explicitly instead of disappearing', async () => {
  await refused({ ...good, css: good.css + 'main{ @font-face{font-family:bad;src:url(https://invalid.example/font.woff2)} }' }, /CSS/);
});
const longProse = '精密零件加工。'.repeat(8);
for (const [tag, wrapper] of [['div', ''], ['li', 'ul'], ['dd', 'dl'], ['figcaption', 'figure'], ['blockquote', '']] as const) {
  test(`review2: ${tag} prose uses body lines; readable wrapping passes`, async () => {
    const inner = `<${tag} class="prose">${longProse}</${tag}>`;
    const code = { ...good, pages: [{ ...good.pages[0], html: `<main><h1>边界机械</h1>${wrapper ? `<${wrapper}>${inner}</${wrapper}>` : inner}</main>` }] };
    await lineFeedback(code);
    assert.equal((await put(await site(), { ...code, css: code.css + '.prose{max-width:20em}' })).status, 200);
  });
}
test('review2: structural title, navigation and parameter text have explicit line exemptions', async () => {
  const code = { ...good, css: good.css + 'h1{font-size:16px}table{width:100%;table-layout:fixed}td{overflow-wrap:anywhere}',
    pages: [{ ...good.pages[0], html: `<main><h1>${longProse}</h1><nav>${longProse}</nav><table><tbody><tr><td>${longProse}</td></tr></tbody></table></main>` }] };
  assert.equal((await put(await site(), code)).status, 200);
});
test('review2: image attribution metadata is exempt while ordinary captions remain prose', async () => {
  const credits = 'Author — https://commons.wikimedia.org/wiki/File:Licensed_industrial_photo_reference.jpg; Creative Commons Attribution ShareAlike';
  const code = { ...good, css: good.css + '[data-sitecraft-image-credits]{font-size:12px;overflow-wrap:anywhere}',
    pages: [{ ...good.pages[0], html: `<main><h1>边界机械</h1><p>精密零件加工。</p><div data-sitecraft-image-credits><span>${credits}</span></div></main>` }] };
  const response = await put(await site(), code);
  assert.equal(response.status, 200, JSON.stringify(await response.json()));
  await lineFeedback({ ...good, pages: [{ ...good.pages[0], html: `<main><h1>边界机械</h1><figure><figcaption>${longProse}</figcaption></figure></main>` }] });
});
test('review2: site list reads code names, retains legacy names, and never dual-writes', async () => {
  const { getExistingSite } = await import('../lib/site-store.ts');
  const response = await create(request('/api/sites', 'POST', { name: '复审列表初名', templateId: 'forge', locales: ['zh'], generationRoute: 'code' }));
  const { id } = await response.json();
  const before = (await getExistingSite(id))!;
  const initial = (await (await list()).json()).sites.find((item: { siteId: string }) => item.siteId === id);
  assert.equal(initial.siteName, '复审列表初名');
  const start = await chat(request(`/api/sites/${id}/chat`, 'POST', { message: '公司名：复审列表改名\n精密零件加工。', baseRevision: 0 }), context(id));
  assert.equal(start.status, 200);
  const changed = (await (await list()).json()).sites.find((item: { siteId: string }) => item.siteId === id);
  assert.equal(changed.siteName, '复审列表改名'); assert.equal(changed.companyName, '复审列表改名');
  const after = (await getExistingSite(id))!;
  assert.equal(after.draft.siteName, before.draft.siteName); assert.equal(after.draft.companyName, before.draft.companyName);
  assert.equal(after.updatedAt, before.updatedAt, 'code metadata must not be copied into the legacy record');
  const legacy = await create(request('/api/sites', 'POST', { name: '复审旧站', templateId: 'forge', locales: ['zh'] }));
  const legacyId = (await legacy.json()).id; const source = (await getExistingSite(legacyId))!;
  const item = (await (await list()).json()).sites.find((entry: { siteId: string }) => entry.siteId === legacyId);
  assert.equal(item.siteName, source.draft.siteName); assert.equal(item.updatedAt, source.updatedAt);
});
test('review2: list update time comes from code metadata, not the original seed', async t => {
  const response = await create(request('/api/sites', 'POST', { name: '复审列表时间', templateId: 'forge', locales: ['zh'], generationRoute: 'code' }));
  const { id } = await response.json();
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2031-02-03T04:05:06.000Z') });
  assert.equal((await chat(request(`/api/sites/${id}/chat`, 'POST', { message: '公司名：复审列表时间\n精密零件加工。', baseRevision: 0 }), context(id))).status, 200);
  const item = (await (await list()).json()).sites.find((entry: { siteId: string }) => entry.siteId === id);
  assert.equal(item.updatedAt, '2031-02-03T04:05:06.000Z');
});

// Review 3 failure modes: side-by-side independent boxes get merged into one body
// line; CSS shorthand/nesting hides generated facts from declaration inspection.
// The normal oracle is three separate 18-character lines, not one 54-character line.
const cardText = '精密零件加工资料'.repeat(2) + '工艺';
for (const display of ['inline-block', 'inline-flex', 'grid', 'flex']) {
  test(`review3: three parallel ${display} cards pass; long single prose has quality feedback`, async () => {
    const layout = ['grid', 'flex'].includes(display) ? `.cards{display:${display};grid-template-columns:repeat(3,1fr)}` : `.card{display:${display};width:33.333%}`;
    const code = { ...good, css: good.css + '.card{font-size:10px;line-height:1.6}.cards{font-size:0}' + layout,
      pages: [{ ...good.pages[0], html: `<main><h1>边界机械</h1><div class="cards">${[1,2,3].map(() => `<span class="card">${cardText}</span>`).join('')}</div></main>` }] };
    const response = await put(await site(), code);
    assert.equal(response.status, 200, JSON.stringify(await response.json()));
    await lineFeedback({ ...good, pages: [{ ...good.pages[0], html: `<main><h1>边界机械</h1><div>${cardText.repeat(3)}</div></main>` }] });
  });
}
for (const [name, css] of [
  ['shorthand', ':root{--x:"产能 840271 台"}ol{list-style:var(--x) inside}'],
  ['nested', 'main{ol{--x:"产能 840271 台";list-style-type:var(--x)}}'],
]) test(`review3: rendered ${name} marker fact refuses; decimal passes`, async () => {
  const html = '<main><h1>边界机械</h1><ol><li>精密零件加工。</li></ol></main>';
  await refused({ ...good, css: good.css + css, pages: [{ ...good.pages[0], html }] }, /840271/);
  assert.equal((await put(await site(), { ...good, css: good.css + 'ol{list-style:decimal inside}', pages: [{ ...good.pages[0], html }] })).status, 200);
});
