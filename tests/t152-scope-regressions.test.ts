import { factAuditReply, factAuditPayload } from './fixtures/fact-audit-reply.ts';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { renderSiteCode, type SiteCode } from '../lib/code-site.ts';

// Astra reproductions: unchanged sibling/:has rules react to a selected DOM edit;
// pageId is prompt-only; native hash/language links are cancelled; commas inside
// :is(), :not() or quoted attributes are incorrectly treated as selector lists.
// Provider and scheduling are controlled; chat, commit, CSS matching, storage,
// preview links and Chrome are the production entry points.
// Focus regression: focus-visible/focus-within must not become tag-name suffixes;
// inactive external focus styles must reject, and selected focus rules must reach
// the writer and remain valid at commit. The origin is supplied by the caller.
assert.ok(process.env.SITECRAFT_BASE, 'Set SITECRAFT_BASE to the test server URL');
const scheduled: Array<() => Promise<void>> = [];
(globalThis as any).__t152ScopeAfter = scheduled;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'next/server.js') return { shortCircuit: true, url: 'data:text/javascript,export function after(fn){globalThis.__t152ScopeAfter.push(fn)}' };
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });
let replyCode: SiteCode;
const server = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw), system = body.messages[0].content;
  const reply = system.includes('事实校对员') ? { issues: [] } : system.includes('版本参考选择') ? { referenceRevisions: [] }
    : system.includes('修正输出合同') ? { replacements: [] } : replyCode;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(factAuditPayload(body, { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(factAuditReply(body, reply)) } }] })));
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); assert.ok(address && typeof address === 'object');
process.env.SITE_STORE = 'fs';
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
process.env.DEEPSEEK_API_KEY = 'local-only'; process.env.DEEPSEEK_MODEL = 'local-only';
const { commitSiteCode, getCodeSite } = await import('../lib/code-site-store.ts');
const { POST: chat } = await import('../app/api/sites/[siteId]/chat/route.ts');
const { localEditContext, applyLocalEdit } = await import('../lib/code-site-local-edit.ts');
const { codeCheckBrowser } = await import('../lib/code-site-browser.ts');
test.after(() => new Promise<void>(resolve => server.close(() => resolve())));
const source: SiteCode = {
  header: '<header>Paper Works <a href="/products#specs">Products</a></header>', footer: '<footer>Paper Works</footer>',
  css: 'body{margin:0;color:#111;background:#fff;font:16px/1.6 sans-serif}main,header,footer{padding:24px}a{color:#123}section{padding:24px}h1,h2{margin:0 0 16px}',
  pages: [{ id: 'home', title: 'Home', html: '<main><section class="selected"><h1>Paper Works</h1><p data-note="a,b"><a href="/products">Paper boxes</a></p></section><section class="outside"><h2>Materials</h2><p>Paper bags</p></section></main>' },
    { id: 'products', title: 'Products', html: '<main><section id="specs"><h1>Paper boxes</h1><p>Paper bags</p></section></main>' }],
};
async function setup(css = '', scrollTarget = false) {
  const id = `t152-scope-${crypto.randomUUID()}`;
  const code = structuredClone(source); code.css += css;
  if (scrollTarget) {
    code.header += '<nav><a href="#specs">Specs</a></nav>';
    code.pages[0].html = code.pages[0].html.replace('<section ', '<section id="specs" ');
    code.pages[1].html = code.pages[1].html.replace('<main>', '<main><div style="height:1200px"></div>');
  }
  const first = await commitSiteCode({ siteId: id, legacyImport: { kind: 'convert', name: 'Paper Works', source: { revision: 1, updatedAt: new Date().toISOString() }, materials: 'Paper Works. Paper boxes. Paper bags. Materials.', code, exportIssues: [] } });
  assert.equal(first.status, 'applied', JSON.stringify(first)); if (first.status !== 'applied') throw new Error('Fixture rejected');
  return { id, version: first.version, target: { kind: 'dom' as const, versionId: first.version.id, pageId: 'home', path: [0], text: 'Paper WorksPaper boxes', label: 'Paper Works' } };
}
for (const [label, css] of [
  ['sibling', '.selected + .outside {border-top:3px solid #123}'],
  ['relational', 'main:has(.selected) .outside {border-top:3px solid #123}'],
] as const) test(`A1: existing ${label} CSS cannot change outside matches through selected DOM`, async () => {
  const { id, version, target } = await setup(css);
  const code = structuredClone(version.code);
  code.pages[0].html = code.pages[0].html.replace('class="selected"', 'class="changed"');
  const result = await commitSiteCode({ siteId: id, baseRevision: 1, code, selectedTarget: target, author: 'assistant', summary: 'Block edit', request: 'Change only this block' });
  assert.equal(result.status, 'rejected', 'old rules must keep the same out-of-block matches');
  if (result.status === 'rejected') assert.match(result.checks.issues.join('\n'), /越界/);
  assert.equal((await getCodeSite(id))!.versions.length, 1);
});
for (const edit of ['other HTML', 'shared CSS'] as const) test(`A2: chat pageId scope rejects ${edit} through every repair`, async () => {
  const { id, version } = await setup(); replyCode = structuredClone(version.code);
  if (edit === 'other HTML') replyCode.pages[1].html = replyCode.pages[1].html.replace('Paper bags', 'Paper boxes');
  else replyCode.css += 'p{border-bottom:2px solid #123}';
  const result = await chat(new Request(`${process.env.SITECRAFT_BASE}/api/sites/${id}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: '更大胆，只改当前页', baseRevision: 1, pageId: 'home' }) }), { params: Promise.resolve({ siteId: id }) });
  assert.equal(result.status, 202); await scheduled.shift()!();
  const saved = (await getCodeSite(id))!;
  assert.equal(saved.run!.status, 'error', 'a prompt-only page scope wrongly accepts the escaped candidate');
  assert.match(saved.run!.issues.join('\n'), /越界/);
  assert.equal(saved.versions.length, 1);
  assert.ok(saved.run!.attempts.every(attempt => !attempt.checks.passed));
  // The same chat request can still change this page, including page-only CSS.
  replyCode = structuredClone(version.code);
  replyCode.pages[0].html = replyCode.pages[0].html.replace('Paper boxes', 'Paper bags');
  replyCode.css += '.selected{border-left:2px solid #123}';
  const accepted = await chat(new Request(`${process.env.SITECRAFT_BASE}/api/sites/${id}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: '更大胆，只改当前页', baseRevision: 1, pageId: 'home' }) }), { params: Promise.resolve({ siteId: id }) });
  assert.equal(accepted.status, 202); await scheduled.shift()!();
  const changed = (await getCodeSite(id))!;
  assert.equal(changed.run!.status, 'complete', JSON.stringify(changed.run));
  assert.equal(changed.versions.length, 2);
  assert.deepEqual(changed.versions[1].code.pages[1], version.code.pages[1]);
});
test('A4: nested and quoted commas stay in a scoped selector, while a top-level escape rejects', async () => {
  const { id, version, target } = await setup();
  const context = await localEditContext(version.code, target);
  const selectors = `.${context.scope} :is(h1, p):not([data-note="x,y"], .excluded), .${context.scope} [data-note="a,b"]`;
  const code = await applyLocalEdit(version.code, target, context.html, `${selectors}{border-left:2px solid #123}`);
  const good = await commitSiteCode({ siteId: id, baseRevision: 1, code, selectedTarget: target, author: 'assistant', summary: 'Scoped selectors', request: 'Change border' });
  assert.equal(good.status, 'applied', good.status === 'rejected' ? good.checks.issues.join('\n') : '');
  const escaped = await setup(), other = await localEditContext(escaped.version.code, escaped.target);
  const bad = await applyLocalEdit(escaped.version.code, escaped.target, other.html, `.${other.scope} :is(h1,p), .outside{border-left:2px solid #123}`);
  assert.equal((await commitSiteCode({ siteId: escaped.id, baseRevision: 1, code: bad, selectedTarget: escaped.target, author: 'assistant', summary: 'Escape', request: '' })).status, 'rejected');
});
for (const pseudo of ['focus-visible', 'focus-within']) test(`external ${pseudo} styles reject at the current-page commit boundary`, async () => {
  const { id, version } = await setup('a{outline:2px solid #123}');
  const code = { ...version.code, css: version.code.css + `a:${pseudo}{outline-width:8px}` };
  // Independent browser evidence: the proposed CSS really changes the other
  // page's focused link. The submission checker must reject it even unfocused.
  const browser = await codeCheckBrowser();
  try {
    const { frameTree } = await browser.send<{ frameTree: { frame: { id: string } } }>('Page.getFrameTree');
    const widths = [];
    for (const candidate of [version.code, code]) {
      await browser.send('Page.setDocumentContent', { frameId: frameTree.frame.id, html: renderSiteCode(id, candidate, 'products') });
      await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      const focused = await browser.evaluate<{ matches: boolean; width: string }>(`(()=>{const link=document.querySelector('a');return {matches:document.activeElement===link&&link.matches(':${pseudo}'),width:getComputedStyle(link).outlineWidth}})()`);
      assert.equal(focused.matches, true, 'the external link must be in the actual keyboard focus state');
      widths.push(focused.width);
    }
    assert.deepEqual(widths, ['2px', '8px']);
  } finally { await browser.close(); }
  const result = await commitSiteCode({ siteId: id, baseRevision: 1, pageId: 'home', code, author: 'assistant', summary: 'Current page only', request: '更大胆，只改首页' });
  assert.equal(result.status, 'rejected', 'focus CSS that changes products must not save a homepage edit');
  if (result.status === 'rejected') assert.match(result.checks.issues.join('\n'), /products.*越界|越界.*products/);
  assert.equal((await getCodeSite(id))!.versions.length, 1);
});
test('selected focus rules reach local writing context and remain valid in a scoped edit', async () => {
  const { id, version, target } = await setup('.selected a:focus-visible{outline-width:6px}.selected:focus-within{outline-offset:4px}');
  const context = await localEditContext(version.code, target);
  assert.match(context.css, /\.selected a:focus-visible/);
  assert.match(context.css, /\.selected:focus-within/);
  const code = await applyLocalEdit(version.code, target, context.html, `.${context.scope} a:focus-visible{outline-width:8px}.${context.scope}:focus-within{outline-offset:6px}`);
  const result = await commitSiteCode({ siteId: id, baseRevision: 1, selectedTarget: target, code, author: 'assistant', summary: 'Selected focus style', request: 'Only change this block' });
  assert.equal(result.status, 'applied', result.status === 'rejected' ? result.checks.issues.join('\n') : '');
});
for (const kind of ['hash', 'language'] as const) test(`A3: preview retains native ${kind} navigation with picking off`, async () => {
  const { id, version } = await setup('', true);
  const english = await commitSiteCode({ siteId: id, baseRevision: 1, englishCode: version.code, author: 'assistant', summary: 'English', request: 'Translate' });
  assert.equal(english.status, 'applied');
  const browser = await codeCheckBrowser();
  const wait = async (expression: string) => {
    for (let i = 0; i < 200; i++) { if (await browser.evaluate<boolean>(`Boolean(${expression})`)) return; await new Promise(resolve => setTimeout(resolve, 100)); }
    assert.fail(`Navigation timed out: ${expression}`);
  };
  try {
    await browser.send('Page.navigate', { url: `${process.env.SITECRAFT_BASE}/workspace?site=${id}` });
    await wait(`!document.querySelector('.code-preview-loading') && document.querySelector('[data-testid="code-preview"]')?.contentDocument?.querySelector('main h1')`);
    const selector = kind === 'hash' ? 'header a[href*="#specs"]' : 'a[lang="en"]';
    const native = await browser.evaluate<boolean>(`(() => {const doc=document.querySelector('[data-testid="code-preview"]').contentDocument;const link=doc.querySelector(${JSON.stringify(selector)});if(!link)throw new Error('Missing fixture link');return link.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));})()`);
    assert.equal(native, true, 'selection-off must not cancel the native link');
    await wait(`document.querySelector('[data-testid="code-preview"]')?.contentWindow?.location.${kind === 'hash' ? "hash === '#specs'" : "search.includes('language=en')"}`);
    await wait(kind === 'hash' ? `document.querySelector('[data-page-id="products"]')?.getAttribute('aria-pressed')==='true'` : `document.querySelector('[data-testid="preview-en"]')?.getAttribute('aria-pressed')==='true'`);
    if (kind === 'hash') {
      const scrolledToTarget = `(()=>{const frame=document.querySelector('[data-testid="code-preview"]');const rect=frame.contentDocument.querySelector('#specs')?.getBoundingClientRect();return frame.contentWindow.scrollY>100 && rect && rect.top>=0 && rect.bottom<=frame.contentWindow.innerHeight})()`;
      await wait(`!document.querySelector('.code-preview-loading') && ${scrolledToTarget}`);
      await browser.evaluate(`document.querySelector('[data-testid="code-preview"]').contentWindow.scrollTo(0,0)`);
      await wait(`document.querySelector('[data-testid="code-preview"]').contentWindow.scrollY===0`);
      const samePageNative = await browser.evaluate<boolean>(`document.querySelector('[data-testid="code-preview"]').contentDocument.querySelector('a[href="#specs"]').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}))`);
      assert.equal(samePageNative, true, 'a same-page hash must retain native scrolling too');
      await wait(scrolledToTarget);
    }
  } finally { await browser.close(); }
});
