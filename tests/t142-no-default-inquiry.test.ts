import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { renderSiteCode } from '../lib/code-site.ts';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';

// Provider outputs are independent local examples of the two user requirements.
// Assertions also inspect actual outbound guidance: fixed replies alone cannot
// prove that a model follows instructions. Routes, commit, storage and Chrome are real.
const scheduled: Array<() => Promise<void>> = [];
(globalThis as typeof globalThis & { __t142After?: typeof scheduled }).__t142After = scheduled;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'next/server.js') return { shortCircuit: true, url: 'data:text/javascript,export function after(fn){globalThis.__t142After.push(fn)}' };
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });
const company = '榆原零件';
const source = '公司名：榆原零件。产品：不锈钢轴套。提供来图车削加工。';
const email = 'sales@yuyuan-fixture.luckye.online';
const css = 'body{margin:0;background:#fff;color:#222;font:16px/1.6 sans-serif}header,main,footer{padding:24px}h1{font-size:28px}p{max-width:30em}nav{display:flex;gap:16px;flex-wrap:wrap}a{color:#222}';
const thin = { header: '<header>榆原零件</header>', footer: '<footer>榆原零件</footer>', css,
  pages: [{ id: 'home', title: company, html: '<main><h1>不锈钢轴套</h1><p>榆原零件提供来图车削加工。</p></main>' }] };
const requested = { ...thin, header: '<header>榆原零件<nav><a href="/home">产品</a><a href="/contact">联系</a></nav></header>',
  pages: [...thin.pages, { id: 'contact', title: '联系', html: `<main><h1>联系榆原零件</h1><p><a href="mailto:${email}">${email}</a></p><div data-system-inquiry></div></main>` }] };
let explicit = false;
const calls: Array<{ system: string; user: string }> = [];
const server = createServer(async (request, response) => {
  if (request.method === 'GET') { response.setHeader('content-type', 'text/html'); return response.end('<!doctype html><html><body></body></html>'); }
  let raw = ''; for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw), [system, user] = body.messages.map((message: { content: string }) => message.content);
  calls.push({ system, user });
  const planCall = !!body.tools;
  const data = system.includes('事实校对员') ? { issues: [] } : system.includes('版本参考选择') ? { referenceRevisions: [] } : planCall
    ? { summary: '按轴套和车削资料做一页介绍。', style: 'precision', styleReason: '简短产品资料', skeletonId: 'compact-profile', skeletonReason: '只有轴套和加工资料，保持短页。', pages: [{ id: 'home', title: '产品', outline: ['轴套和来图加工'] }] }
    : explicit ? requested : thin;
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify({ choices: [{ finish_reason: planCall ? 'tool_calls' : 'stop', message: planCall
    ? { content: null, tool_calls: [{ type: 'function', function: { name: 'submit_page_plan', arguments: JSON.stringify(data) } }] }
    : { content: JSON.stringify(data) } }] }));
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
process.env.SITE_STORE = 'fs'; process.env.SITECRAFT_BASE = base;
process.env.DEEPSEEK_BASE_URL = base; process.env.DEEPSEEK_API_KEY = 'local-fixture-only'; process.env.DEEPSEEK_MODEL = 'local-fixture-only';
const { POST: create } = await import('../app/api/sites/route.ts');
const { POST: chat } = await import('../app/api/sites/[siteId]/chat/route.ts');
const { GET: draft } = await import('../app/api/sites/[siteId]/draft/route.ts');
const request = (url: string, body: unknown) => new Request(base + url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
test.after(() => new Promise<void>(resolve => server.close(() => resolve())));

test('thin user material stays a one-page site; the same conversation can later request contact and an inquiry form', async () => {
  const out = path.resolve('artifacts/t142', `flow-${crypto.randomUUID()}`); await mkdir(out, { recursive: true });
  const created = await create(request('/api/sites', { name: company, templateId: 'forge', locales: ['zh'], generationRoute: 'code' }));
  assert.equal(created.status, 201); const { id } = await created.json(); const context = { params: Promise.resolve({ siteId: id }) };
  const started = await (await chat(request(`/api/sites/${id}/chat`, { message: source, baseRevision: 0 }), context)).json();
  assert.equal((await chat(request(`/api/sites/${id}/chat`, { action: 'select', questionId: started.alignment.questionId, questionRevision: started.alignment.questionRevision, optionId: 'precision' }), context)).status, 202);
  await scheduled.shift()!();
  const planned = await (await draft(new Request(base + `/api/sites/${id}/draft`), context)).json();
  assert.deepEqual(planned.codeSite.plan.pages.map((p: { id: string }) => p.id), ['home']);
  const planCall = calls.find(call => call.user.includes('先给页面大纲'))!;
  assert.match(planCall.user, /不默认增加询盘表单、报价入口、邮箱联系或联系页/);
  assert.doesNotMatch(planCall.user, /联系资料很薄时只安排|实在无法确定才首页\/产品\/联系/);
  const confirmation = await (await chat(request(`/api/sites/${id}/chat`, { action: 'state' }), context)).json();
  assert.equal((await chat(request(`/api/sites/${id}/chat`, { action: 'confirm', questionId: confirmation.alignment.questionId, questionRevision: confirmation.alignment.questionRevision, baseRevision: 0 }), context)).status, 202);
  await scheduled.shift()!();
  const before = (await (await draft(new Request(base + `/api/sites/${id}/draft`), context)).json()).codeSite;
  assert.equal(before.versions.length, 1); assert.equal(before.versions[0].checks.passed, true);
  assert.deepEqual(before.versions[0].code.pages.map((p: { id: string }) => p.id), ['home']);
  const html = renderSiteCode(id, before.versions[0].code, 'home');
  assert.doesNotMatch(html, /<form\b|mailto:|询盘|报价|索取|联系/);
  const writer = calls.find(call => call.user.includes('写出大纲中所有页面'))!;
  assert.match(writer.system + writer.user, /不默认增加询盘表单、报价入口、邮箱联系或联系页/);
  const browser = await codeCheckBrowser();
  try {
    const { frameTree } = await browser.send<{ frameTree: { frame: { id: string } } }>('Page.getFrameTree');
    await browser.send('Page.setDocumentContent', { frameId: frameTree.frame.id, html });
    for (const width of [1440, 768, 375]) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      const shot = await browser.send<{ data: string }>('Page.captureScreenshot', { format: 'png' });
      await writeFile(path.join(out, `thin-${width}.png`), Buffer.from(shot.data, 'base64'));
    }
  } finally { await browser.close(); }
  explicit = true;
  assert.equal((await chat(request(`/api/sites/${id}/chat`, { message: `请增加联系页，显示邮箱 ${email}，放系统询盘表单；不写报价或响应时效承诺。`, baseRevision: 1 }), context)).status, 202);
  await scheduled.shift()!();
  const after = (await (await draft(new Request(base + `/api/sites/${id}/draft`), context)).json()).codeSite;
  await writeFile(path.join(out, 'report.json'), JSON.stringify({ at: new Date().toISOString(), siteId: id, before, after, calls, fixtureOnly: true }, null, 2));
  assert.equal(after.versions.length, 2); assert.equal(after.versions[1].checks.passed, true);
  const contact = renderSiteCode(id, after.versions[1].code, 'contact');
  assert.match(contact, /<form\b/); assert.ok(contact.includes(`mailto:${email}`));
  assert.doesNotMatch(contact, /报价|响应时效/);
  assert.deepEqual(after.versions[0].code, before.versions[0].code, 'refresh and later enrichment preserve the earlier no-contact version');
  const facts = calls.filter(call => call.system.includes('事实校对员'));
  assert.ok(facts.length >= 2); assert.ok(facts.every(call => call.system.includes('承诺与政策核对清单：报价方式与收费')));
});
