import { factAuditPayload } from './fixtures/fact-audit-reply.ts';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import type { SiteCode } from '../lib/code-site.ts';
import { localEditChoice } from './fixtures/local-edit-choice.ts';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';

// Independent contract: the repaired field must change, while the other row,
// attributes, markup and CSS declarations stay intact. The provider changes
// actual content through production POSTs; it does not return after=before.
const callbacks: Array<() => Promise<void>> = [];
(globalThis as any).__t173MembersAfter = callbacks;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'next/server.js') return { shortCircuit: true, url: 'data:text/javascript,export function after(fn){globalThis.__t173MembersAfter.push(fn)}' };
  if (!specifier.startsWith('@/')) return next(specifier, context);
  return next(pathToFileURL(path.join(process.cwd(), `${specifier.slice(2)}.ts`)).href, context);
} });
const { commitSiteCode, getCodeSite } = await import('../lib/code-site-store.ts');
const { POST: chat } = await import('../app/api/sites/[siteId]/chat/route.ts');
const { POST: create } = await import('../app/api/sites/route.ts');
type Case = 'title' | 'table' | 'attribute' | 'root-css' | 'identical' | 'unsupported-css' | 'unsupported-scope-css';
let scenario: Case = 'title', audits = 0;
const category = '价格与收费', claim = '免运费。', replacement = '运费待补充。';
const materials = '公司名：松禾\n甲、乙门店均免运费。免运费。\n只生成一页首页。';
const css = 'body{margin:0;color:#222;background:#fff;font:18px/1.6 sans-serif}header,footer,main{padding:24px}section{padding:16px 0}p{max-width:36em}.keep{letter-spacing:.07em}';
function fixture(which: Case): SiteCode {
  const section = '<section><h2>运费</h2><p>免运费。</p></section>';
  const body = which === 'table' ? '<section><h2>门店</h2><table><thead><tr><th>店</th><th>运费</th></tr></thead><tbody><tr><td>甲</td><td>免运费。</td></tr><tr><td>乙</td><td>免运费。</td></tr></tbody></table></section>'
    : which === 'attribute' ? '<section aria-label="免运费。"><h2>服务</h2><p>自取。</p></section>'
    : which === 'identical' ? section + section : '<section><h2>服务</h2><p>自取。</p></section>';
  return { header: '<header>松禾</header>', footer: '<footer>松禾</footer>', css: css + (which === 'unsupported-scope-css' ? 'body,aside::before{content:"其他"}html{container-type:inline-size}@container(min-width:1px){body::before{content:"免运费。"}}' : '') + (which === 'unsupported-css' ? 'body::before{content:"备用"}' : '') + (which === 'root-css' || which === 'unsupported-css' ? 'body::before{content:"免运费。";display:block;padding:4px 16px}' : ''),
    pages: [{ id: 'home', title: which === 'title' ? claim : '首页', html: `<main><h1>松禾</h1>${body}<aside class="keep">说明</aside></main>` }] };
}
const requests: Array<{ purpose: string; input: any }> = [];
const output = `artifacts/t173/fact-members-${Date.now()}-${process.pid}`;
await mkdir(output, { recursive: true });
const provider = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw), system = body.messages[0].content;
  let purpose: string, input: any, answer: any;
  if (body.tools?.[0]?.function.name === 'submit_page_plan') {
    purpose = 'plan'; input = body.messages[1].content;
    answer = { summary: '门店说明', style: 'precision', styleReason: '资料排版', skeletonId: 'custom', skeletonReason: '按资料展示门店', pages: [{ id: 'home', title: '首页', outline: ['门店说明'] }] };
  } else if (system.includes('事实校对员')) {
    purpose = 'facts'; input = JSON.parse(body.messages[1].content.split('\n')[0]); audits++;
    answer = { results: input.segments.map((segment: any) => {
      const hasFact = scenario === 'title' ? segment.text.includes(`页面标题：${claim}`) : segment.text.includes(claim);
      const bad = hasFact && (scenario !== 'table' || segment.text.includes('<TD>甲</TD>'));
      return { id: segment.id, issues: [], noFacts: !hasFact, factCategories: hasFact ? [category] : [],
        citations: hasFact && !bad ? [{ category, claim, quote: claim }] : [] };
    }) };
  } else if (system.includes('本次局部修改')) {
    purpose = 'local-edit'; input = JSON.parse(body.messages[1].content.split('\n')[0]);
    // Every round starts from the original block. If only one owner receives
    // feedback, the other writer reintroduces the error on the next round.
    answer = { html: input.issues.length ? input.html.replace(claim, replacement) : input.html, css: '' };
  } else if (system.includes('修正输出合同')) {
    purpose = 'repair'; input = JSON.parse(body.messages[1].content.split('\n')[0]);
    const selected = input.fragments.filter((fragment: any) => scenario === 'title' ? fragment.kind === 'title' && fragment.before === claim
      : scenario === 'attribute' ? fragment.kind === 'attribute' && fragment.before === claim
      : scenario === 'root-css' ? fragment.kind === 'css' && fragment.property === 'content'
      : fragment.kind === 'text' && fragment.before === claim);
    answer = { replacements: selected.map((fragment: any) => ({ fragmentId: fragment.id, after: scenario === 'root-css' ? '"运费待补充。"' : replacement })) };
  } else { purpose = 'write'; input = body.messages[1].content; answer = fixture(scenario); }
  requests.push({ purpose, input });
  const message = body.tools ? { content: null, tool_calls: [{ type: 'function', function: { name: 'submit_page_plan', arguments: JSON.stringify(answer) } }] } : { content: JSON.stringify(answer) };
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(factAuditPayload(body, { choices: [purpose === 'local-edit' ? localEditChoice(answer) : { finish_reason: body.tools ? 'tool_calls' : 'stop', message }], usage: { prompt_tokens: 30, completion_tokens: 20, total_tokens: 50 } })));
});
await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
const address = provider.address(); assert.ok(address && typeof address === 'object');
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
process.env.DEEPSEEK_API_KEY = 'local-only'; process.env.DEEPSEEK_MODEL = 'local-only';
test.after(() => new Promise<void>(resolve => provider.close(() => resolve())));
async function send(id: string, body: unknown) {
  const response = await chat(new Request(`${process.env.SITECRAFT_BASE}/api/sites/${id}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ siteId: id }) });
  assert.ok(response.status === 200 || response.status === 202, await response.clone().text());
  const state = await response.json();
  for (const callback of callbacks.splice(0)) await callback();
  return state;
}
async function run(which: Case) {
  scenario = which; audits = 0; requests.length = 0;
  let id: string, before: any;
  if (which === 'identical') {
    id = `t173-members-${crypto.randomUUID()}`;
    const initial = await commitSiteCode({ siteId: id, legacyImport: { kind: 'convert', name: '松禾', source: { revision: 1, updatedAt: new Date().toISOString() }, materials, code: fixture(which), exportIssues: [] } });
    assert.equal(initial.status, 'applied'); before = await getCodeSite(id);
    const batch = [1, 2].map((index) => ({ draftId: crypto.randomUUID(), revision: 1, body: `第${index}组：不保留没有出处的承诺，改为运费待补充。`,
      target: { kind: 'dom', versionId: before.currentVersionId, pageId: 'home', path: [index], label: '运费', text: '运费免运费。' } }));
    await send(id, { message: '批量局部修改', baseRevision: 1, annotationBatch: batch });
  } else {
    const response = await create(new Request(`${process.env.SITECRAFT_BASE}/api/sites`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '松禾' }) }));
    assert.equal(response.status, 201); id = (await response.json()).id;
    let state = await send(id, { message: materials, baseRevision: 0 });
    await send(id, { action: 'select', questionId: state.alignment.questionId, questionRevision: state.alignment.questionRevision, optionId: 'precision', preferences: { style: 'precision', layout: 5, density: 6 }, baseRevision: 0 });
    state = await send(id, { action: 'state' }); before = await getCodeSite(id);
    await send(id, { action: 'confirm', questionId: state.alignment.questionId, questionRevision: state.alignment.questionRevision, baseRevision: 0 });
  }
  const response = await fetch(`${process.env.SITECRAFT_BASE}/api/sites/${id}/draft`); assert.equal(response.status, 200);
  const done = (await response.json()).codeSite;
  await writeFile(`${output}/${which}.json`, JSON.stringify({ before, done, requests }, null, 2), 'utf8');
  if (which === 'unsupported-css' || which === 'unsupported-scope-css') return { saved: undefined, before, done };
  assert.equal(done.run.status, 'complete', done.run.step);
  assert.equal(done.run.repairRound, 1); assert.equal(audits, 2);
  assert.equal(done.versions.length, before.versions.length + 1);
  const saved = done.versions.at(-1).code;
  assert.equal(saved.header, '<header>松禾</header>'); assert.equal(saved.footer, '<footer>松禾</footer>');
  assert.match(saved.pages[0].html, /<aside class="keep">说明<\/aside>/);
  return { saved, before, done };
}

test('页面标题按字段修正，实际改变标题且正文不变', async () => {
  const { saved } = await run('title');
  assert.equal(saved.pages[0].title, replacement);
  assert.equal(saved.pages[0].html, fixture('title').pages[0].html);
  const repair = requests.find(request => request.purpose === 'repair')!;
  assert.deepEqual(repair.input.fragments.map((fragment: any) => [fragment.field, fragment.kind, fragment.before]), [['pages/home/title', 'title', claim]]);
});
test('甲行缺出处只修甲行，乙行相同短文字保持不变', async () => {
  const { saved } = await run('table');
  assert.match(saved.pages[0].html, /<tr><td>甲<\/td><td>运费待补充。<\/td><\/tr>/);
  assert.match(saved.pages[0].html, /<tr><td>乙<\/td><td>免运费。<\/td><\/tr>/);
  const repair = requests.find(request => request.purpose === 'repair')!;
  assert.equal(repair.input.fragments.filter((fragment: any) => fragment.kind === 'text' && fragment.before === claim).length, 1);
});
test('非叶节点承诺属性定点修改，子节点和其他属性不变', async () => {
  const { saved } = await run('attribute');
  assert.match(saved.pages[0].html, /<section aria-label="运费待补充。"><h2>服务<\/h2><p>自取。<\/p><\/section>/);
  const repair = requests.find(request => request.purpose === 'repair')!;
  const attribute = repair.input.fragments.find((fragment: any) => fragment.kind === 'attribute');
  assert.equal(attribute.name, 'aria-label'); assert.equal(attribute.before, claim);
  assert.ok(repair.input.fragments.every((fragment: any) => fragment.kind !== 'element' && !fragment.before.includes('<section')));
});
test('根级伪元素按 CSS 声明修正，其他规则与伪元素声明不变', async () => {
  const { saved } = await run('root-css');
  const repair = requests.find(request => request.purpose === 'repair')!;
  assert.ok(repair.input.fragments.some((fragment: any) => fragment.kind === 'css' && fragment.property === 'content' && fragment.pseudo === '::before' && fragment.before === '"免运费。"'));
  assert.ok(repair.input.fragments.every((fragment: any) => fragment.kind !== 'style'));
  assert.equal(saved.pages[0].html, fixture('root-css').pages[0].html);
  const browser = await codeCheckBrowser();
  try {
    const rules = (source: string) => browser.evaluate(`(()=>{const sheet=new CSSStyleSheet();sheet.replaceSync(${JSON.stringify(source)});return [...sheet.cssRules].map(rule=>({selector:rule.selectorText,decls:[...rule.style].filter(name=>rule.selectorText!=='body::before'||name!=='content').map(name=>[name,rule.style.getPropertyValue(name),rule.style.getPropertyPriority(name)])}))})()`);
    assert.deepEqual(await rules(saved.css), await rules(fixture('root-css').css));
    assert.equal(await browser.evaluate(`(()=>{const sheet=new CSSStyleSheet();sheet.replaceSync(${JSON.stringify(saved.css)});return [...sheet.cssRules].find(rule=>rule.selectorText==='body::before').style.content})()`), '"运费待补充。"');
  } finally { await browser.close(); }
});
test('同文局部区块合并后两个归属都收到拒因，一轮同时修好且范围外不变', async () => {
  const { saved, before } = await run('identical');
  assert.equal((saved.pages[0].html.match(/<p>运费待补充。<\/p>/g) ?? []).length, 2);
  const locals = requests.filter(request => request.purpose === 'local-edit');
  assert.equal(locals.length, 4);
  assert.ok(locals.slice(2).every(request => request.input.issues.length > 0));
  assert.equal(saved.css, before.versions[0].code.css);
});
test('无法可靠归属的 CSS 文案写明原因拒收，不发送猜测性修正', async () => {
  const { before, done } = await run('unsupported-css');
  assert.equal(done.run.status, 'error'); assert.match(done.run.step, /无法定位出处拒因.*多条作者规则/);
  assert.deepEqual(done.versions, before.versions); assert.equal(done.currentVersionId, before.currentVersionId);
  assert.equal(requests.filter(request => request.purpose === 'repair').length, 0);
});

test('无法核实作用域和伪元素分支的 CSS 不猜成另一条声明', async () => {
  const { before, done } = await run('unsupported-scope-css');
  assert.equal(done.run.status, 'error'); assert.match(done.run.step, /无法定位出处拒因.*(?:作用域|选择器)/);
  assert.deepEqual(done.versions, before.versions); assert.equal(done.currentVersionId, before.currentVersionId);
  assert.equal(requests.filter(request => request.purpose === 'repair').length, 0);
});
