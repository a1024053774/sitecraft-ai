import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import type { SiteCode } from '../lib/code-site.ts';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';

// Real submission failures: text becomes markup; comments swallow later facts;
// closing tags reparent siblings; incomplete elements auto-close; an element
// replacement adds peers; a refused repair silently saves or loses its response.
const scheduled: Array<() => Promise<void>> = [];
(globalThis as typeof globalThis & { __t138DomAfter?: typeof scheduled }).__t138DomAfter = scheduled;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'next/server.js') return { shortCircuit: true, url: 'data:text/javascript,export function after(fn){globalThis.__t138DomAfter.push(fn)}' };
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });
const materials = '公司名：边界机械\n产品：精密零件。精密零件加工，材质与检验要求按图纸标注记录。不接食品接触零件。\n页面要求：首页、产品两个独立页面。';
let kind = 'text', after = '', repairs = 0;
let textOrder: 'forward' | 'reverse' = 'forward';
const makeCode = (): SiteCode => ({
  header: '<header data-kept="brand">边界机械</header>', footer: '<footer data-kept="footer">边界机械' + (kind === 'interleaved' || kind === 'adjacent' ? '<p>终身保修。</p>' : '') + '</footer>',
  css: 'body{margin:0;color:#111;background:#fff;font:16px/1.6 sans-serif}main,header,footer{padding:24px}p{max-width:32em}' + (kind === 'style' ? 'p{color:#aaa}' : ''),
  pages: [{ id: 'home', title: '首页', html: `<main><h1>边界机械</h1><p>精密零件加工，材质与检验要求按图纸标注记录。</p>${kind === 'nested' ? '<p><a id="bad" href="">说明</a><span data-kept="boundary">不接食品接触零件。</span><!--保留的注释--></p>' : `${kind === 'interleaved' ? '<p id="bad" data-kept="target">终身保修。精密零件加工。终身保修。不接食品接触零件。</p>' : kind === 'adjacent' ? '<p id="bad" data-kept="target">终身保修。终身保修。不接食品接触零件。</p>' : kind === 'text' ? '<p id="bad" data-kept="target">终身保修。</p>' : kind === 'style' ? '<p id="bad">说明</p>' : '<a id="bad" href="">说明</a>'}<p data-kept="boundary">不接食品接触零件。</p><!--保留的注释-->`}</main>` },
    { id: 'products', title: '产品', html: '<main><h1>精密零件</h1><p data-kept="product">精密零件加工。</p><!--产品注释--></main>' }],
});
const server = createServer(async (req, res) => {
  if (req.method === 'GET') { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><html><body>local fixture origin</body></html>'); return; }
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw), system = body.messages[0].content, user = body.messages[1].content;
  let reply: unknown;
  if (system.includes('事实校对员')) reply = { issues: user.includes('终身保修') ? ['页面原句：终身保修。；资料未提供该承诺。'] : [] };
  else if (user.includes('先给页面大纲')) reply = { summary: '公司与产品', style: 'precision', styleReason: '加工资料', pages: [{ id: 'home', title: '首页', outline: '公司与边界' }, { id: 'products', title: '产品', outline: '精密零件' }] };
  else if (system.includes('修正输出合同')) {
    repairs++;
    const input = JSON.parse(user.slice(0, user.lastIndexOf('\n请以 json')));
    if (kind === 'interleaved' || kind === 'adjacent') {
      const a = input.fragments.filter((f: { field: string; before: string }) => f.field === 'pages/home/html' && f.before === '终身保修。');
      const b = input.fragments.find((f: { field: string; before: string }) => f.field === 'footer' && f.before === '终身保修。');
      // A faulty first repair can ask again with fewer remaining promises.
      // Return their edits so the run ends and its assertions expose the loss;
      // the acceptance still requires exactly one successful repair.
      const edits = a.length === 2 && b ? [{ fragmentId: a[0].id, after: kind === 'adjacent' ? '' : '待补充。' }, { fragmentId: b.id, after: '待补充。' }, { fragmentId: a[1].id, after: '待补充。' }]
        : a.map((f: { id: number }) => ({ fragmentId: f.id, after: '待补充。' }));
      const overlap = input.fragments.find((f: { before: string; field: string }) => f.field === 'pages/home/html' && f.before === '身保修。');
      reply = { replacements: process.env.T138_RANGE_OVERLAP === '1' && overlap ? [{ fragmentId: a[0].id, after: '待补充。' }, { fragmentId: overlap.id, after: '' }] : textOrder === 'reverse' ? edits.reverse() : edits };
    } else {
      const fragment = input.fragments.find((f: { before: string; field: string }) => kind === 'text' ? f.before.includes('终身保修') : kind === 'style' ? f.field === 'css' : f.before.includes('id="bad"'));
      reply = { replacements: fragment ? [{ fragmentId: fragment.id, after }] : [] };
    }
  } else reply = makeCode();
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(reply) } }] }));
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); assert.ok(address && typeof address === 'object');
const base = `http://127.0.0.1:${address.port}`;
process.env.SITE_STORE = 'fs'; process.env.SITECRAFT_BASE = base;
process.env.DEEPSEEK_BASE_URL = base; process.env.DEEPSEEK_API_KEY = 'local-only'; process.env.DEEPSEEK_MODEL = 'local-dom-fixture';
const { POST: create } = await import('../app/api/sites/route.ts');
const { POST: chat } = await import('../app/api/sites/[siteId]/chat/route.ts');
const { getCodeSite } = await import('../lib/code-site-store.ts');
const request = (url: string, body: unknown) => new Request(base + url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const out = path.resolve('artifacts/t138', `dom-scope-${crypto.randomUUID()}`);
await mkdir(out, { recursive: true });
test.after(() => new Promise<void>(resolve => server.close(() => resolve())));
async function generate(label: string) {
  repairs = 0;
  const source = makeCode();
  const created = await create(request('/api/sites', { name: '边界机械', templateId: 'forge', locales: ['zh'], generationRoute: 'code' }));
  const id = (await created.json()).id, ctx = { params: Promise.resolve({ siteId: id }) };
  let state = await (await chat(request(`/api/sites/${id}/chat`, { message: materials, baseRevision: 0 }), ctx)).json();
  assert.equal((await chat(request(`/api/sites/${id}/chat`, { action: 'select', questionId: state.alignment.questionId, questionRevision: state.alignment.questionRevision, optionId: 'precision' }), ctx)).status, 202);
  await scheduled.shift()!();
  state = await (await chat(request(`/api/sites/${id}/chat`, { action: 'state' }), ctx)).json();
  assert.equal((await chat(request(`/api/sites/${id}/chat`, { action: 'confirm', questionId: state.alignment.questionId, questionRevision: state.alignment.questionRevision, baseRevision: 0 }), ctx)).status, 202);
  await scheduled.shift()!();
  const site = (await getCodeSite(id))!;
  await writeFile(path.join(out, `${label}.json`), JSON.stringify({ source, kind, after, repairs, site }, null, 2), 'utf8');
  return { site, source };
}
for (const [index, payload] of ['<!--', '</p><p>', '<script>', '<section>'].entries()) test(`text repair ${JSON.stringify(payload)} stays text through the real commit`, async () => {
  kind = 'text'; after = payload;
  const { site, source } = await generate(`text-${index}`);
  assert.equal(site.run!.status, 'complete'); assert.equal(site.versions.length, 1);
  assert.deepEqual(site.run!.attempts.map(a => a.checks.passed), [false, true]);
  assert.equal(site.versions[0].checks.viewports.length, 6);
  const browser = await codeCheckBrowser();
  try {
    const observed = await browser.evaluate<{ before: unknown; after: unknown; text: string; elementChildren: number; comments: number; scripts: number }>(`(() => {
      const before=new DOMParser().parseFromString(${JSON.stringify(source.header + source.pages[0].html + source.footer)},'text/html');
      const after=new DOMParser().parseFromString(${JSON.stringify(site.versions[0].code.header + site.versions[0].code.pages[0].html + site.versions[0].code.footer)},'text/html');
      const target=after.getElementById('bad');const text=target?.textContent,elementChildren=target?.children.length;
      const comments=[...function* walk(n){if(n.nodeType===8)yield n;for(const c of n.childNodes)yield* walk(c)}(after.body)].length;
      const scripts=after.querySelectorAll('script').length;
      before.getElementById('bad').textContent='';if(target)target.textContent='';
      const snap=n=>[n.nodeType,n.nodeName,n.nodeValue,n.attributes?[...n.attributes].map(a=>[a.name,a.value]):[],[...n.childNodes].map(snap)];
      return {before:snap(before.body),after:snap(after.body),text,elementChildren,comments,scripts};
    })()`);
    assert.equal(observed.text, payload); assert.equal(observed.elementChildren, 0);
    assert.equal(observed.comments, 1); assert.equal(observed.scripts, 0);
    assert.deepEqual(observed.after, observed.before, 'unrefused text, attributes and comments must survive');
    assert.equal(site.versions[0].code.pages[1].html, source.pages[1].html);
  } finally { await browser.close(); }
});
for (const [index, payload] of ['<!--', '</p><p>', '<script>', '<a href="/home"><span>说明</span>', '<a href="/home">说明</a><p>越界</p>'].entries()) test(`element repair ${JSON.stringify(payload)} is refused and recorded`, async () => {
  kind = 'element'; after = payload;
  const { site } = await generate(`element-${index}`);
  assert.equal(site.versions.length, 0, 'a malformed local repair must never create a version');
  assert.equal(site.run!.status, 'error'); assert.equal(site.run!.attempts.length, 1);
  assert.equal(repairs, 1, 'a boundary violation is reported, not silently retried');
  assert.match(site.run!.step, /局部修正/);
  const failure = (site.run as typeof site.run & { repairFailure?: { response: { replacements: Array<{ after: string }> } } })!.repairFailure;
  assert.equal(failure?.response.replacements[0].after, payload, 'the rejected response must remain verifiable');
});

test('a closed replacement that reparents an unrefused sibling is refused before commit', async () => {
  kind = 'nested'; after = '<div id="bad">说明</div>';
  const { site } = await generate('reparsed-parent');
  assert.equal(site.versions.length, 0); assert.equal(site.run!.status, 'error');
  assert.equal(site.run!.attempts.length, 1); assert.equal(repairs, 1);
  assert.match(site.run!.step, /重新解析整站/);
  assert.equal(site.run!.repairFailure?.response && (site.run!.repairFailure.response as { replacements: Array<{ after: string }> }).replacements[0].after, after);
});
test('a single closed element fixes a link and the complete candidate is checked', async () => {
  kind = 'element'; after = '<a id="bad" href="/home">查看产品</a>';
  const { site } = await generate('valid-element');
  assert.equal(site.run!.status, 'complete'); assert.equal(site.versions.length, 1);
  assert.deepEqual(site.run!.attempts.map(a => a.checks.passed), [false, true]);
  assert.equal(site.versions[0].checks.viewports.length, 6);
  assert.ok(site.versions[0].code.pages[0].html.includes('<a id="bad" href="/home">查看产品</a>'));
  assert.ok(site.versions[0].code.pages[0].html.includes('<p data-kept="boundary">不接食品接触零件。</p><!--保留的注释-->'));
});
test('a complete style element repairs contrast through the same commit boundary', async () => {
  kind = 'style'; after = `<style>${makeCode().css.replace('p{color:#aaa}', 'p{color:#111}')}</style>`;
  const { site, source } = await generate('valid-style');
  assert.equal(site.run!.status, 'complete'); assert.equal(site.versions.length, 1);
  assert.deepEqual(site.run!.attempts.map(a => a.checks.passed), [false, true]);
  assert.equal(site.versions[0].checks.viewports.length, 6);
  assert.deepEqual(site.versions[0].code.pages, source.pages);
});
test('an unclosed stylesheet is refused and recorded', async () => {
  kind = 'style'; after = '<style>p{color:#111</style>';
  const { site } = await generate('unclosed-css');
  assert.equal(site.run!.status, 'error'); assert.equal(site.versions.length, 0);
  assert.equal(repairs, 1); assert.match(site.run!.step, /CSS.*未闭合/);
  assert.ok(site.run!.repairFailure);
});
for (const order of ['forward', 'reverse'] as const) test(`interleaved text edits ${order} preserve every unselected character through commit`, async () => {
  kind = 'interleaved'; textOrder = order;
  const { site, source } = await generate(`interleaved-${order}`);
  if (process.env.T138_RANGE_CORRUPTION === '1' || process.env.T138_RANGE_OVERLAP === '1') {
    assert.equal(site.run!.status, 'error'); assert.equal(site.versions.length, 0);
    assert.equal(site.run!.attempts.length, 1); assert.equal(repairs, 1);
    assert.match(site.run!.step, process.env.T138_RANGE_OVERLAP === '1' ? /重叠/ : /未选中的字符区间/);
    assert.ok(site.run!.repairFailure, 'the invalid application must retain its complete response');
    return;
  }
  assert.equal(site.run!.status, 'complete'); assert.equal(site.versions.length, 1);
  assert.deepEqual(site.run!.attempts.map(a => a.checks.passed), [false, true]);
  assert.equal(site.versions[0].checks.viewports.length, 6);
  assert.ok(site.versions[0].code.pages[0].html.includes('<p id="bad" data-kept="target">待补充。精密零件加工。待补充。不接食品接触零件。</p>'), 'both promises change; intervening words and the negative restriction remain exact');
  assert.equal(site.versions[0].code.footer, '<footer data-kept="footer">边界机械<p>待补充。</p></footer>');
  assert.equal(site.versions[0].code.pages[1].html, source.pages[1].html);
});
for (const order of ['forward', 'reverse'] as const) test(`adjacent text edits ${order} allow deletion and preserve the following restriction`, async () => {
  kind = 'adjacent'; textOrder = order;
  const { site } = await generate(`adjacent-${order}`);
  assert.equal(site.run!.status, 'complete'); assert.equal(site.versions.length, 1);
  assert.deepEqual(site.run!.attempts.map(a => a.checks.passed), [false, true]);
  assert.ok(site.versions[0].code.pages[0].html.includes('<p id="bad" data-kept="target">待补充。不接食品接触零件。</p>'));
});
