import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import type { SiteCode } from '../lib/code-site.ts';

// Boundary failures: added/lost/moved nodes, changed fixed attributes/CSS/images/components;
// lost/added facts or units, omitted accessible copy, wrong gap, malformed slot replies;
// English layout overflow, concurrent charges, stale commits and source/recovery lineage.
// The requirements and the bilingual fixture supply the expected answers, never the translator.
const scheduled: Array<() => Promise<void>> = [];
(globalThis as typeof globalThis & { __t151After?: typeof scheduled }).__t151After = scheduled;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'next/server.js') return { shortCircuit: true, url: 'data:text/javascript,export function after(fn){globalThis.__t151After.push(fn)}' };
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });
process.env.SITE_STORE = 'fs';
process.env.SITECRAFT_DATA_ROOT = path.resolve('artifacts/t151', `contracts-${Date.now()}`);
await mkdir(process.env.SITECRAFT_DATA_ROOT, { recursive: true });
let translationCalls = 0, factCalls = 0, fault = '', missingInjected = false;
const dictionary: Record<string, string> = { '边界机械': '边界机械', '主导航': 'Main navigation', '产品': 'Products', '首页': 'Home', '轴套': 'Bushings',
  '产品型号 LG-A1，尺寸 20 mm，额定流量 30 L/min。': 'Model LG-A1, size 20 mm, rated flow 30 L/min.',
  '认证：待补充': 'Certification: To be provided', '产品目录': 'Product catalogue' };
const provider = createServer(async (request, response) => {
  if (request.method === 'GET') { response.setHeader('content-type', 'text/html'); response.end('<!doctype html><html><body></body></html>'); return; }
  let raw = ''; for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw); let reply: unknown;
  if (body.messages[0].content.includes('事实校对员')) { factCalls++; reply = { issues: [] }; }
  else {
    translationCalls++; assert.equal(body.thinking.type, 'disabled');
    const input = JSON.parse(body.messages[1].content.split('\n')[0]);
    let translations = input.slots.map((slot: { id: string; text: string }) => ({ id: slot.id, text: dictionary[slot.text] }));
    if (fault === 'missing') translations = translations.slice(1);
    if (fault === 'duplicate' && translations.length) translations.push(translations[0]);
    if (fault === 'extra') translations.push({ id: 'invented', text: 'Added copy' });
    if (fault === 'coverage-and-numbers' && !missingInjected) { translations = translations.slice(1); missingInjected = true; }
    if (fault === 'numbers' || fault === 'coverage-and-numbers') translations = translations.map((item: { id: string; text: string }) => ({ ...item, text: item.text?.replace('20 mm', '30 mm') }));
    reply = { translations };
  }
  response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ choices: [{ finish_reason: body.tools ? 'tool_calls' : 'stop', message: body.tools
    ? { content: null, tool_calls: [{ type: 'function', function: { name: 'submit_english_translation', arguments: JSON.stringify(reply) } }] }
    : { content: JSON.stringify(reply) } }], usage: { prompt_tokens: 300, completion_tokens: 80, total_tokens: 380 } }));
});
await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
const address = provider.address(); assert.ok(address && typeof address === 'object');
const base = process.env.SITECRAFT_BASE!; assert.equal(base, 'http://127.0.0.1:3161');
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`; process.env.DEEPSEEK_API_KEY = 'local-test'; process.env.DEEPSEEK_MODEL = 'local-test';
const { POST: create } = await import('../app/api/sites/route.ts');
const { POST: chat } = await import('../app/api/sites/[siteId]/chat/route.ts');
const { PUT: draft } = await import('../app/api/sites/[siteId]/draft/route.ts');
const { GET: preview } = await import('../app/api/sites/[siteId]/code-preview/route.ts');
const { GET: publishedChinese } = await import('../app/published/[siteKey]/route.ts');
const { GET: publishedEnglish } = await import('../app/published/[siteKey]/en/route.ts');
const { getCodeSite, commitSiteCode } = await import('../lib/code-site-store.ts');
const { englishText } = await import('../lib/code-site-english.ts');
const source: SiteCode = {
  header: '<header><a href="/home">边界机械</a><nav aria-label="主导航"><a href="/home">首页</a></nav></header>', footer: '<footer><a href="mailto:parts@example.com">parts@example.com</a></footer>',
  css: 'body{margin:0;color:#222;background:#fff;font:16px/1.7 sans-serif}header,footer,main{padding:24px}p{max-width:30em}a{color:#224c4c}h1{font-size:32px;line-height:1.3}',
  pages: [{ id: 'home', title: '首页', html: '<main><h1>轴套</h1><p title="产品目录" data-product-model="">产品型号 LG-A1，尺寸 20 mm，额定流量 30 L/min。</p><p>认证：待补充</p><span data-system-icon="mail"></span></main>' }],
};
const english: SiteCode = { ...source, header: '<header><a href="/home">边界机械</a><nav aria-label="Main navigation"><a href="/home">Home</a></nav></header>',
  pages: [{ id: 'home', title: 'Home', html: '<main><h1>Bushings</h1><p title="Product catalogue" data-product-model="">Model LG-A1, size 20 mm, rated flow 30 L/min.</p><p>Certification: To be provided</p><span data-system-icon="mail"></span></main>' }] };
const request = (body: unknown, method = 'POST') => new Request(base, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const context = (siteId: string) => ({ params: Promise.resolve({ siteId }) });
let siteId: string;
test.before(async () => {
  const response = await create(request({ name: '边界机械' })); siteId = (await response.json()).id;
  await chat(request({ message: '公司名：边界机械\n轴套型号 LG-A1，尺寸 20 mm，额定流量 30 L/min。邮箱 parts@example.com。认证待补充。', baseRevision: 0 }), context(siteId));
  const saved = await draft(request({ baseRevision: 0, code: source, summary: '中文验收样站' }, 'PUT'), context(siteId));
  assert.equal(saved.status, 200, JSON.stringify(await saved.clone().json()));
});
test.after(async () => { await new Promise<void>(resolve => provider.close(() => resolve())); });
async function submit(code: SiteCode) {
  const site = (await getCodeSite(siteId))!;
  return commitSiteCode({ siteId, baseRevision: site.versions.at(-1)!.revision, englishCode: code, author: 'assistant', summary: '生成英文版', request: '生成英文版' });
}
for (const [name, mutate, reason] of [
  ['changed CSS', (code: SiteCode) => { code.css += 'p{margin:12px}'; }, /CSS|结构/],
  ['added node', (code: SiteCode) => { code.pages[0].html += '<p>Additional services</p>'; }, /结构/],
  ['changed fixed class', (code: SiteCode) => { code.header = code.header.replace('<header>', '<header class="new">'); }, /结构|属性/],
  ['changed system component', (code: SiteCode) => { code.pages[0].html = code.pages[0].html.replace('data-system-icon="mail"', 'data-system-icon="phone"'); }, /结构|属性/],
  ['changed sourced number', (code: SiteCode) => { code.pages[0].html = code.pages[0].html.replace('20 mm', '30 mm'); }, /数字|保真/],
  ['lost model', (code: SiteCode) => { code.pages[0].html = code.pages[0].html.replace('LG-A1', 'LG-B1'); }, /型号|保真/],
  ['changed unit', (code: SiteCode) => { code.pages[0].html = code.pages[0].html.replace('20 mm', '20 kg'); }, /单位|保真/],
  ['added certification', (code: SiteCode) => { code.pages[0].html = code.pages[0].html.replace('To be provided', 'ISO 9001'); }, /数字|保真|待补充/],
  ['untranslated attribute', (code: SiteCode) => { code.pages[0].html = code.pages[0].html.replace('Product catalogue', '产品目录'); }, /漏译/],
  ['untranslated heading', (code: SiteCode) => { code.pages[0].html = code.pages[0].html.replace('Bushings', '轴套'); }, /漏译/],
  ['lost gap', (code: SiteCode) => { code.pages[0].html = code.pages[0].html.replace('To be provided', 'Pending'); }, /待补充/],
  ['changed email', (code: SiteCode) => { code.footer = code.footer.replace('>parts@example.com<', '>sales@example.com<'); }, /保真/],
] as const) test(`commit rejects ${name} without saving`, async () => {
  const code = structuredClone(english); mutate(code); const before = (await getCodeSite(siteId))!;
  const result = await submit(code);
  assert.equal(result.status, 'rejected', name);
  if (result.status === 'rejected') assert.match(result.checks.issues.join('\n'), reason);
  assert.deepEqual((await getCodeSite(siteId))!.versions, before.versions);
});
test('English overflow is rejected by the real three-width commit scan', async () => {
  const code = structuredClone(english); code.pages[0].html = code.pages[0].html.replace('Bushings', 'unbroken'.repeat(200));
  const result = await submit(code); assert.equal(result.status, 'rejected');
  if (result.status === 'rejected') assert.match(result.checks.issues.join('\n'), /溢出/);
});
test('the commit boundary accepts real scale/order translations and an explicit English company name', async () => {
  const fixture = JSON.parse(await readFile(new URL('./fixtures/t151-fidelity-real-response.json', import.meta.url), 'utf8'));
  const englishName = JSON.parse(fixture.calls[0].response.rawMessage.tool_calls[0].function.arguments).translations[0].text;
  const rows = fixture.pairs.filter((row: any) => row.before === '50–\u200b100 万模次' || row.before.startsWith('T1 试模')).slice(0, 2);
  assert.equal(rows.length, 2);
  const id = (await (await create(request({ name: fixture.companyName }))).json()).id;
  const materials = `${fixture.companyName}\n英文公司名：${englishName}\n${rows.map((row: any) => row.before).join('\n')}`;
  await chat(request({ message: materials, baseRevision: 0 }), context(id));
  assert.equal((await getCodeSite(id))!.name, fixture.companyName, 'the English-name field must not rename the Chinese record');
  const localSource: SiteCode = { ...source, header: '', footer: '', pages: [{ id: 'home', title: 'Home',
    html: `<main><h1>${fixture.companyName}</h1>${rows.map((row: any) => `<p>${row.before}</p>`).join('')}</main>` }] };
  assert.equal((await draft(request({ baseRevision: 0, code: localSource, summary: '真实片段' }, 'PUT'), context(id))).status, 200);
  const candidate = { ...localSource, pages: [{ ...localSource.pages[0], html: `<main><h1>${englishName}</h1>${rows.map((row: any) => `<p>${row.after}</p>`).join('')}</main>` }] };
  const count = factCalls;
  const refused = await commitSiteCode({ siteId: id, baseRevision: 1, englishCode: candidate, author: 'assistant', summary: '原始真实英文', request: '英文' });
  assert.equal(refused.status, 'rejected', 'the saved reply omits the newly required trial frequency unit');
  assert.equal((await getCodeSite(id))!.versions.length, 1);
  candidate.pages[0].html = candidate.pages[0].html.replace(rows[1].after, 'Samples and full-dimensional inspection reports are dispatched within 3 days after the T1 mold trial; trial molding is performed 3 times for each mold.');
  const result = await commitSiteCode({ siteId: id, baseRevision: 1, englishCode: candidate, author: 'assistant', summary: '英文', request: '英文' });
  assert.equal(result.status, 'applied', result.status === 'rejected' ? result.checks.issues.join('\n') : result.status);
  assert.equal(factCalls, count);
  if (result.status === 'applied') assert.deepEqual(result.version.english!.checks.viewports.map(viewport => [viewport.width, viewport.overflow, viewport.overlaps, viewport.contrastIssues]), [[375, 0, 0, 0], [768, 0, 0, 0], [1440, 0, 0, 0]]);
});
test('translated text writes plain text, all original fixed markup remains', async () => {
  const { slots } = await englishText(source);
  const replacements = slots.map(slot => ({ id: slot.id, text: dictionary[slot.text] }));
  const translated = (await englishText(source, replacements)).code;
  assert.deepEqual(translated, english);
  const title = replacements.find(item => item.text === 'Product catalogue')!; title.text = '<img src="https://bad.example/image">';
  const escaped = (await englishText(source, replacements)).code;
  assert.match(escaped.pages[0].html, /title="&lt;img/); assert.doesNotMatch(escaped.pages[0].html, /<img /);
});
test('concurrent translation actions claim once; malformed or stale replies cannot save', async () => {
  for (const mode of ['missing', 'duplicate', 'extra', 'numbers', 'coverage-and-numbers']) {
    fault = mode; missingInjected = false;
    const before = (await getCodeSite(siteId))!; const revision = before.versions.at(-1)!.revision;
    const responses = await Promise.all([chat(request({ action: 'translate', baseRevision: revision }), context(siteId)), chat(request({ action: 'translate', baseRevision: revision }), context(siteId))]);
    assert.deepEqual(responses.map(response => response.status).sort(), [202, 409]);
    assert.equal(scheduled.length, 1); await scheduled.shift()!();
    const after = (await getCodeSite(siteId))!; assert.equal(after.run!.status, 'error');
    assert.deepEqual(after.versions, before.versions);
    if (mode === 'numbers' || mode === 'coverage-and-numbers') {
      assert.equal(after.run!.attempts.length, mode === 'numbers' ? 3 : 2);
      assert.equal(after.run!.repairRound, 2);
      assert.ok(after.run!.attempts.every(attempt => !attempt.checks.passed));
    }
    else assert.match(after.run!.step, /遗漏|重复|越界/);
  }
  fault = ''; const before = (await getCodeSite(siteId))!;
  const response = await chat(request({ action: 'translate', baseRevision: before.versions.at(-1)!.revision }), context(siteId)); assert.equal(response.status, 202);
  // Recreate a concurrent local commit after claim; the translator must not overwrite it.
  const advanced = await commitSiteCode({ siteId, baseRevision: before.versions.at(-1)!.revision, code: source, author: 'user', summary: '中文已更新', request: '中文已更新' }); assert.equal(advanced.status, 'applied');
  await scheduled.shift()!(); const after = (await getCodeSite(siteId))!;
  assert.equal(after.run!.status, 'error'); assert.match(after.run!.step, /已经更新/); assert.equal(after.versions.length, before.versions.length + 1);
});
test('valid English persists alongside Chinese and never starts fact auditing', async () => {
  const before = (await getCodeSite(siteId))!; const count = factCalls;
  const result = await submit(english); assert.equal(result.status, 'applied');
  if (result.status !== 'applied') return;
  assert.equal(factCalls, count); assert.deepEqual(result.version.code, before.versions.at(-1)!.code);
  assert.equal(result.version.english!.sourceRevision, before.versions.at(-1)!.revision);
  assert.equal(result.version.english!.checks.viewports.length, 3);
  assert.ok(result.version.english!.checks.viewports.every(viewport => !viewport.overflow && !viewport.overlaps && !viewport.contrastIssues));
});
test('published languages and English preview use their independently committed bilingual version', async () => {
  fault = '';
  const created = await create(request({ name: '发布语言机械' })); assert.equal(created.status, 201);
  const id = (await created.json()).id;
  await chat(request({ message: '公司名：发布语言机械\n轴套型号 LG-A1，尺寸 20 mm，额定流量 30 L/min。邮箱 parts@example.com。认证待补充。', baseRevision: 0 }), context(id));
  const ownSource = { ...source, header: source.header.replace('边界机械', '发布语言机械') };
  const ownEnglish = { ...english, header: english.header.replace('边界机械', '发布语言机械') };
  const chinese = await draft(request({ baseRevision: 0, code: ownSource, summary: '发布语言前置中文' }, 'PUT'), context(id));
  assert.equal(chinese.status, 200, JSON.stringify(await chinese.clone().json()));
  const result = await commitSiteCode({ siteId: id, baseRevision: 1, englishCode: ownEnglish, author: 'assistant', summary: '发布语言前置英文', request: '发布语言前置英文' });
  assert.equal(result.status, 'applied', result.status === 'rejected' ? result.checks.issues.join('\n') : result.status);
  if (result.status !== 'applied') throw new Error('发布语言前置存版失败');
  const ownSite = (await getCodeSite(id))!;
  assert.equal(ownSite.versions.length, 2);
  const publishedContext = { params: Promise.resolve({ siteKey: id }) };
  const zh = await publishedChinese(new Request(base), publishedContext);
  const en = await publishedEnglish(new Request(base), publishedContext);
  const historic = await preview(new Request(`${base}?version=${result.version.id}&language=en`), context(id));
  assert.equal(zh.status, 200); assert.equal(en.status, 200); assert.equal(historic.status, 200);
  const zhHTML = await zh.text(), enHTML = await en.text(), previewHTML = await historic.text();
  assert.match(zhHTML, /^<!doctype html><html lang="zh-CN">/i); assert.match(zhHTML, /<h1>轴套<\/h1>/);
  for (const html of [enHTML, previewHTML]) { assert.match(html, /^<!doctype html><html lang="en">/i); assert.match(html, /<h1>Bushings<\/h1>/); assert.match(html, /20 mm, rated flow 30 L\/min/); assert.match(html, /To be provided/); assert.match(html, /<svg/); assert.match(html, /ISC License/); }
  assert.match(en.headers.get('Content-Security-Policy')!, /script-src 'none'/);
  assert.equal((await publishedEnglish(new Request(`${base}?page=missing`), publishedContext)).status, 404);
  assert.equal((await preview(new Request(`${base}?version=${ownSite.versions[0].id}&language=en`), context(id))).status, 404);
});
