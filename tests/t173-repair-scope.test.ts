import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import type { SiteCode } from '../lib/code-site.ts';

const callbacks: Array<() => Promise<void>> = [];
(globalThis as any).__t173ScopeAfter = callbacks;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'next/server.js') return { shortCircuit: true, url: 'data:text/javascript,export function after(fn){globalThis.__t173ScopeAfter.push(fn)}' };
  if (!specifier.startsWith('@/')) return next(specifier, context);
  return next(pathToFileURL(path.join(process.cwd(), `${specifier.slice(2)}.ts`)).href, context);
} });
const { POST: chat } = await import('../app/api/sites/[siteId]/chat/route.ts');
const { POST: create } = await import('../app/api/sites/route.ts');

const states = ['hover', 'focus', 'focus-visible', 'focus-within', 'active'] as const;
type State = typeof states[number];
type Scenario = 'mixed' | 'model-only' | 'css-one' | 'css-both' | 'css-shared' | 'css-375' | 'css-768' | 'css-1440'
  | 'attack-title' | 'attack-header' | 'attack-document' | 'owner-passed' | 'owner-rejected' | `css-state-${State}` | `css-has-${State}` | 'css-uppercase-hover'
  | `css-mask-not-${State}` | 'css-mask-is' | 'css-mask-where' | 'css-mask-has' | 'css-mask-media' | 'css-mask-supports' | 'css-mask-all' | 'css-mask-static';
let scenario: Scenario = 'mixed';
const category = '价格与收费', textClaim = '全国免运费。', cssClaim = '免运费。', fixed = '运费待补充。';
const materials = '公司名：松禾\n甲店、乙店全国免运费。全国免运费。免运费。\n按门店说明运费。';
const baseCss = 'body{margin:0;color:#222;background:#fff;font:18px/1.6 sans-serif}header,footer,main{padding:24px}section{padding:16px 0}p{max-width:36em}';
const table = '<section><h2>门店</h2><table><thead><tr><th>店</th><th>运费</th></tr></thead><tbody><tr><td>甲</td><td>全国免运费。</td></tr><tr><td>乙</td><td>全国免运费。</td></tr></tbody></table></section>';
const branch = (name: string) => `<section class="${name === '甲' ? 'first' : 'second'}"><h2>${name}店</h2>${scenario.includes('focus') ? '<a class="fee" href="/home">运费说明</a>' : '<p class="fee">运费说明</p>'}</section>`;
function fixture(): SiteCode {
  if (scenario === 'mixed' || scenario === 'model-only' || scenario.startsWith('attack-') || scenario.startsWith('owner-')) return { header: '<header>松禾</header>', footer: '<footer>松禾</footer>', css: baseCss + (scenario === 'attack-document' ? 'body::before{content:"公共条件"}' : ''),
    pages: [{ id: 'home', title: '首页', html: `<main><h1>松禾</h1>${table}<aside>范围外保留</aside></main>` }] };
  const remote = /^css-\d/.test(scenario);
  const condition = scenario === 'css-375' ? '(max-width:500px)' : scenario === 'css-768' ? '(min-width:700px) and (max-width:1000px)' : '(min-width:1200px)';
  const dynamic = scenario.startsWith('css-state-') ? `.second .fee:${scenario.slice('css-state-'.length)}`
    : scenario.startsWith('css-has-') ? `.second:has(.fee:${scenario.slice('css-has-'.length)}) .fee`
    : scenario === 'css-uppercase-hover' ? '.second .fee:HoVeR' : '';
  const generated = dynamic ? `.first .fee::before,${dynamic}::before{content:"免运费。"}`
    : `${scenario === 'css-one' ? '.first ' : ''}.fee::before{content:"免运费。";padding-right:8px}`;
  const mask = scenario.startsWith('css-mask-not-') ? `.second .fee:not(:${scenario.slice('css-mask-not-'.length)})::before{content:none}`
    : scenario === 'css-mask-is' ? '.second .fee:is(:not(:hover))::before{content:none}'
    : scenario === 'css-mask-where' ? '.second .fee:where(:not(:hover))::before{content:none}'
    : scenario === 'css-mask-has' ? '.second:not(:has(.fee:hover)) .fee::before{content:none}'
    : scenario === 'css-mask-media' ? '.second .fee::before{content:none}@media (max-width:1px){.second .fee:not(:hover)::before{content:none}}'
    : scenario === 'css-mask-supports' ? '@supports (display:block){.second .fee:not(:hover)::before{content:none}}'
    : scenario === 'css-mask-all' ? '.second .fee:not(:hover)::before{all:unset}'
    : scenario === 'css-mask-static' ? '.second .fee::before{content:none}' : '';
  // In remote cases one source declaration affects both pages, but the other
  // page matches its branch at only one viewport. A width-only or page-only
  // guard must not pass this input.
  const remoteGenerated = `.home .fee::before,.remote .fee::before{content:"免运费。"}@media not all and ${condition}{.remote .fee::before{content:none}}`;
  return { header: '<header>松禾</header>', footer: '<footer>松禾</footer>', css: baseCss + (remote ? remoteGenerated : generated) + mask + (scenario === 'css-one' ? '.second .fee:hover{color:#333}' : ''),
    pages: [{ id: 'home', title: '首页', html: `<main class="home"><h1>松禾</h1>${branch('甲')}${remote ? '' : branch('乙')}<aside>范围外保留</aside></main>` },
      ...(remote ? [{ id: 'stores', title: '门店', html: `<main class="remote"><h1>松禾门店</h1>${branch('乙')}<aside>另一页保留</aside></main>` }] : [])] };
}
const requests: Array<{ purpose: string; input: any }> = [];
const output = `artifacts/t173/repair-scope-${Date.now()}-${process.pid}`; await mkdir(output, { recursive: true });
const provider = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw), system = body.messages[0].content;
  let purpose: string, input: any, answer: any;
  if (body.tools) {
    purpose = 'plan'; input = body.messages[1].content;
    answer = { summary: '门店运费', style: 'precision', styleReason: '资料排版', skeletonId: 'custom', skeletonReason: '按资料展示',
      pages: fixture().pages.map(page => ({ id: page.id, title: page.title, outline: ['门店运费'] })) };
  } else if (system.includes('事实校对员')) {
    purpose = 'facts'; input = JSON.parse(body.messages[1].content.split('\n')[0]);
    answer = { results: input.segments.map((segment: any) => {
      const claim = scenario === 'mixed' || scenario === 'model-only' || scenario.startsWith('attack-') || scenario.startsWith('owner-') ? textClaim : cssClaim;
      const hasFact = segment.text.includes(claim);
      const bad = hasFact && scenario !== 'owner-passed' && (segment.text.includes('<TD>甲</TD>') || segment.text.includes('甲店') || scenario === 'css-both' || scenario === 'owner-rejected');
      const modelIssue = bad && (scenario === 'mixed' || scenario === 'model-only' || scenario.startsWith('attack-'));
      const ownerIssue = scenario.startsWith('owner-') && segment.text.endsWith('\n门店');
      return { id: segment.id, issues: ownerIssue ? ['父级标题「门店」需要修正。'] : modelIssue ? [`甲行「${textClaim}」缺资料出处，请改为待补充。`] : [], noFacts: !hasFact, factCategories: hasFact ? [category] : [],
        citations: hasFact && (!bad || scenario === 'model-only') ? [{ category, claim, quote: claim }] : [] };
    }) };
  } else if (system.includes('修正输出合同')) {
    purpose = 'repair'; input = JSON.parse(body.messages[1].content.split('\n')[0]);
    answer = { replacements: input.fragments.filter((fragment: any) => fragment.kind === 'css' || fragment.kind === 'text' && fragment.before === textClaim)
      .map((fragment: any) => ({ fragmentId: fragment.id, after: fragment.kind === 'css' ? '"运费待补充。"' : fixed })) };
    if (scenario.startsWith('attack-')) {
      answer.replacements = answer.replacements.filter((patch: any) => input.fragments.find((fragment: any) => fragment.id === patch.fragmentId).kind === 'text');
      const publicMember = input.fragments.find((fragment: any) => scenario === 'attack-document' ? fragment.kind === 'css' : fragment.before === (scenario === 'attack-title' ? '门店' : '运费'));
      // If the boundary exposes a public member, actively overwrite it. If it
      // withholds that permission, an invented patch id must be refused.
      answer.replacements.push({ fragmentId: publicMember?.id ?? 99999, after: scenario === 'attack-document' ? '"公共条件已改坏"' : '公共文字已改坏' });
    }
    if (scenario.startsWith('owner-')) {
      const heading = input.fragments.find((fragment: any) => fragment.before === '门店');
      if (heading) answer.replacements.push({ fragmentId: heading.id, after: '经核对的门店' });
    }
  } else { purpose = 'write'; input = body.messages[1].content; answer = fixture(); }
  requests.push({ purpose, input });
  const message = body.tools ? { content: null, tool_calls: [{ type: 'function', function: { name: 'submit_page_plan', arguments: JSON.stringify(answer) } }] } : { content: JSON.stringify(answer) };
  res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ choices: [{ finish_reason: body.tools ? 'tool_calls' : 'stop', message }], usage: { prompt_tokens: 30, completion_tokens: 20, total_tokens: 50 } }));
});
await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
const address = provider.address(); assert.ok(address && typeof address === 'object');
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`; process.env.DEEPSEEK_API_KEY = 'local-only'; process.env.DEEPSEEK_MODEL = 'local-only';
test.after(() => new Promise<void>(resolve => provider.close(() => resolve())));
async function send(id: string, body: unknown) {
  const response = await chat(new Request(`${process.env.SITECRAFT_BASE}/api/sites/${id}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ siteId: id }) });
  assert.ok(response.status === 200 || response.status === 202, await response.clone().text());
  const value = await response.json(); for (const callback of callbacks.splice(0)) await callback(); return value;
}
async function run(which: Scenario) {
  scenario = which; requests.length = 0;
  const response = await create(new Request(`${process.env.SITECRAFT_BASE}/api/sites`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '松禾' }) }));
  assert.equal(response.status, 201); const id = (await response.json()).id;
  let state = await send(id, { message: materials, baseRevision: 0 });
  await send(id, { action: 'select', questionId: state.alignment.questionId, questionRevision: state.alignment.questionRevision, optionId: 'precision', preferences: { style: 'precision', layout: 5, density: 6 }, baseRevision: 0 });
  state = await send(id, { action: 'state' });
  await send(id, { action: 'confirm', questionId: state.alignment.questionId, questionRevision: state.alignment.questionRevision, baseRevision: 0 });
  const savedResponse = await fetch(`${process.env.SITECRAFT_BASE}/api/sites/${id}/draft`); assert.equal(savedResponse.status, 200);
  const done = (await savedResponse.json()).codeSite;
  await writeFile(`${output}/${which}.json`, JSON.stringify({ done, requests }, null, 2), 'utf8');
  return done;
}
for (const which of ['mixed', 'model-only'] as const) test(`${which}：甲行模型 issues 非空，实际修正甲行而保留乙行同文`, async () => {
  const done = await run(which); assert.equal(done.run.status, 'complete', done.run.step); assert.equal(done.versions.length, 1);
  assert.match(done.versions[0].code.pages[0].html, /<tr><td>甲<\/td><td>运费待补充。<\/td><\/tr>/);
  assert.match(done.versions[0].code.pages[0].html, /<tr><td>乙<\/td><td>全国免运费。<\/td><\/tr>/);
  const repair = requests.find(request => request.purpose === 'repair')!;
  assert.equal(repair.input.fragments.filter((fragment: any) => fragment.kind === 'text' && fragment.before === textClaim).length, 1, '只发甲行一次，不重复也不包含乙行');
  assert.match(done.versions[0].code.pages[0].html, /<aside>范围外保留<\/aside>/);
});
for (const which of ['css-one', 'css-both', 'css-mask-static'] as const) test(`${which}：声明实际影响都属于被拒段并集，修好后存版`, async () => {
  const done = await run(which); assert.equal(done.run.status, 'complete', done.run.step); assert.equal(done.versions.length, 1);
  assert.equal(done.run.repairRound, 1); assert.equal(requests.filter(request => request.purpose === 'repair').length, 1);
  assert.match(done.versions[0].code.css, /content:\s*"运费待补充。"/);
  assert.equal(done.versions[0].code.pages[0].html, fixture().pages[0].html);
});
for (const which of ['css-shared', 'css-375', 'css-768', 'css-1440'] as const) test(`${which}：共享声明影响已通过段时明确拒收，不拆分也不存版`, async () => {
  const done = await run(which); assert.equal(done.run.status, 'error', done.run.step);
  assert.match(done.run.step, /CSS.*(?:被拒核对段|允许成员).*之外/);
  assert.equal(done.versions.length, 0); assert.equal(done.currentVersionId, null);
  assert.equal(requests.filter(request => request.purpose === 'repair').length, 0, '越界声明不发送修正请求');
});
for (const which of ['attack-title', 'attack-header', 'attack-document'] as const) test(`${which}：只拒甲行时主动改写公共上下文必须拒收`, async () => {
  const done = await run(which); assert.equal(done.run.status, 'error', done.run.step); assert.equal(done.versions.length, 0);
  const repair = requests.find(request => request.purpose === 'repair')!;
  assert.ok(repair, '甲行仍可发起局部修正');
  assert.ok(!repair.input.fragments.some((fragment: any) => ['门店', '店', '运费'].includes(fragment.before)), '公共标题及表头不能获得可写编号');
  if (which === 'attack-document') assert.ok(!repair.input.fragments.some((fragment: any) => fragment.kind === 'css'), '已通过的 document 条件只能只读');
});
for (const which of [...states.map(state => `css-state-${state}` as const), ...states.map(state => `css-has-${state}` as const), 'css-uppercase-hover'] as const) test(`${which}：声明涉及已通过段的交互态时不得静默存版`, async () => {
  const done = await run(which); assert.equal(done.run.status, 'error', done.run.step);
  assert.match(done.run.step, /CSS.*(?:交互|静态.*核实)/); assert.equal(done.versions.length, 0);
  assert.equal(requests.filter(request => request.purpose === 'repair').length, 0);
});
for (const which of [...states.map(state => `css-mask-not-${state}` as const), 'css-mask-is', 'css-mask-where', 'css-mask-has', 'css-mask-media', 'css-mask-supports', 'css-mask-all'] as const) test(`${which}：其他作者规则的交互覆盖使静态影响不完整时拒收`, async () => {
  const done = await run(which); assert.equal(done.run.status, 'error', done.run.step);
  assert.match(done.run.step, /CSS.*交互.*(?:属性|声明).*静态.*核实/);
  assert.equal(done.versions.length, 0); assert.equal(done.currentVersionId, null);
  assert.equal(requests.filter(request => request.purpose === 'repair').length, 0, '默认态不能证明交互覆盖无关，不得发送可写声明');
});
test('公共成员所属段被拒、引用它的行已通过时仍不得改写', async () => {
  const done = await run('owner-passed'); assert.equal(done.run.status, 'error', done.run.step); assert.equal(done.versions.length, 0);
  assert.match(done.run.step, /公共成员.*已通过/); assert.equal(requests.filter(request => request.purpose === 'repair').length, 0);
});
test('公共成员自身及所有引用行均被拒时，只改明确归属成员后可存版', async () => {
  const done = await run('owner-rejected'); assert.equal(done.run.status, 'complete', done.run.step); assert.equal(done.versions.length, 1);
  assert.match(done.versions[0].code.pages[0].html, /<h2>经核对的门店<\/h2>/);
  assert.match(done.versions[0].code.pages[0].html, /<th>店<\/th><th>运费<\/th>/);
  assert.equal((done.versions[0].code.pages[0].html.match(/<td>运费待补充。<\/td>/g) ?? []).length, 2);
});
