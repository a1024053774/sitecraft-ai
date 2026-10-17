import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import type { SiteCode } from '../lib/code-site.ts';
import { localEditChoice } from './fixtures/local-edit-choice.ts';

// Contract oracle: protocol errors terminate every workflow, including when a
// quote is also invalid. A structurally valid missing citation is a content
// failure even when the model returns no issues. Use production POSTs, real
// commit checks/storage and a local provider; only after scheduling is replaced.
const callbacks: Array<() => Promise<void>> = [];
(globalThis as any).__t173BoundaryAfter = callbacks;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'next/server.js') return { shortCircuit: true, url: 'data:text/javascript,export function after(fn){globalThis.__t173BoundaryAfter.push(fn)}' };
  if (!specifier.startsWith('@/')) return next(specifier, context);
  return next(pathToFileURL(path.join(process.cwd(), `${specifier.slice(2)}.ts`)).href, context);
} });
const { commitSiteCode, getCodeSite, updateCodeSite } = await import('../lib/code-site-store.ts');
const { POST: chat } = await import('../app/api/sites/[siteId]/chat/route.ts');
const { POST: create } = await import('../app/api/sites/route.ts');

const claim = '外带包装费每单2元。', category = '价格与收费';
const materials = `公司名：禾巷小馆\n${claim}\n只生成一页首页。`;
const code: SiteCode = { header: '<header>禾巷小馆</header>', footer: '<footer>家常饭菜</footer>',
  css: 'body{margin:0;color:#222;background:#fff;font:18px/1.6 sans-serif}header,footer,main{padding:24px}section{padding:24px 0}p{max-width:36em}',
  pages: [{ id: 'home', title: '首页', html: `<main><h1>禾巷小馆</h1><section><h2>收费口径</h2><p>${claim}</p></section><section><h2>用餐须知</h2><p>按当天供应。</p></section><aside>其余说明保留。</aside></main>` }] };
type Entry = 'site' | 'single' | 'batch';
const shortClaim = '免运费。';
const shortCode: SiteCode = { ...code, header: '<header>松禾</header>', footer: '<footer>松禾</footer>',
  pages: [{ id: 'home', title: '首页', html: '<main><h1>松禾</h1><section><h2>运费</h2><p>免运费。</p></section><section><h2>须知</h2><p>自取。</p></section></main>' }] };
type Mode = 'mixed' | 'duplicate' | 'missing-fixed' | 'missing-always' | 'mixed-groups';
let mode: Mode = 'mixed', quote = '', audits = 0;
let activeClaim = claim, activeCode = code;
const requests: Array<{ purpose: string; input: any }> = [];
const output = `artifacts/t173/fact-boundary-${Date.now()}-${process.pid}`;
await mkdir(output, { recursive: true });
const provider = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw), system = body.messages[0].content;
  let answer, purpose: string, input: any;
  if (body.tools?.[0]?.function.name === 'submit_page_plan') {
    purpose = 'plan'; input = body.messages[1].content;
    answer = { summary: '餐馆经营说明', style: 'precision', styleReason: '按资料集中展示', skeletonId: 'custom', skeletonReason: '一页短站展示收费与须知', pages: [{ id: 'home', title: '首页', outline: ['收费口径、用餐须知'] }] };
  } else if (system.includes('事实校对员')) {
    purpose = 'facts'; input = JSON.parse(body.messages[1].content.split('\n')[0]); audits++;
    answer = { results: input.segments.map((segment: any) => {
      const secondGroup = mode === 'mixed-groups' && segment.text.includes(shortClaim);
      const hasFact = segment.text.includes(activeClaim) || secondGroup, bad = hasFact && audits === 1;
      const missing = hasFact && (mode === 'missing-always' || mode === 'missing-fixed' && audits === 1 || mode === 'mixed-groups' && secondGroup);
      return { id: segment.id, issues: [], noFacts: !hasFact,
        factCategories: hasFact ? (mode === 'duplicate' || mode === 'mixed-groups' && !secondGroup) && bad ? [category, category] : [category] : [],
        citations: !hasFact || missing ? [] : [{ category, claim: mode === 'mixed' && bad ? '另一家餐馆承诺免费外送。' : activeClaim, quote: mode === 'mixed' && bad ? quote : activeClaim }] };
    }) };
  } else if (system.includes('修正输出合同')) {
    purpose = 'repair'; input = JSON.parse(body.messages[1].content.split('\n')[0]);
    answer = { replacements: input.fragments.map((fragment: any) => ({ fragmentId: fragment.id, after: fragment.before })) };
  } else if (system.includes('本次局部修改')) {
    purpose = 'local-edit'; input = JSON.parse(body.messages[1].content.split('\n')[0]);
    answer = { html: input.html, css: '' };
  } else { purpose = 'write'; input = body.messages[1].content; answer = activeCode; }
  requests.push({ purpose, input });
  const message = body.tools ? { content: null, tool_calls: [{ type: 'function', function: { name: 'submit_page_plan', arguments: JSON.stringify(answer) } }] } : { content: JSON.stringify(answer) };
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ choices: [purpose === 'local-edit' ? localEditChoice(answer) : { finish_reason: body.tools ? 'tool_calls' : 'stop', message }], usage: { prompt_tokens: 30, completion_tokens: 20, total_tokens: 50 } }));
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
async function run(entry: Entry, nextMode: Mode, nextQuote = '', options: { short?: boolean; reverse?: boolean } = {}) {
  mode = nextMode; quote = nextQuote; audits = 0; requests.length = 0;
  activeClaim = options.short ? shortClaim : claim;
  activeCode = options.short ? shortCode : nextMode === 'mixed-groups' ? { ...code, pages: code.pages.map(page => ({ ...page, html: page.html.replace('按当天供应。', shortClaim) })) } : code;
  const name = options.short ? '松禾' : '禾巷小馆';
  const sourceMaterials = options.short ? '公司名：松禾\n免运费。\n只生成一页首页。' : nextMode === 'mixed-groups' ? `${materials}\n${shortClaim}` : materials;
  let id: string, before: any;
  if (entry === 'site') {
    const response = await create(new Request(`${process.env.SITECRAFT_BASE}/api/sites`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) }));
    assert.equal(response.status, 201); id = (await response.json()).id;
    let state = await send(id, { message: sourceMaterials, baseRevision: 0 });
    await send(id, { action: 'select', questionId: state.alignment.questionId, questionRevision: state.alignment.questionRevision, optionId: 'precision', preferences: { style: 'precision', layout: 5, density: 6 }, baseRevision: 0 });
    state = await send(id, { action: 'state' }); before = await getCodeSite(id);
    await send(id, { action: 'confirm', questionId: state.alignment.questionId, questionRevision: state.alignment.questionRevision, baseRevision: 0 });
  } else {
    id = `t173-boundary-${crypto.randomUUID()}`;
    const saved = await commitSiteCode({ siteId: id, legacyImport: { kind: 'convert', name, source: { revision: 1, updatedAt: new Date().toISOString() }, materials: sourceMaterials, code: activeCode, exportIssues: [] } });
    assert.equal(saved.status, 'applied');
    await updateCodeSite(id, () => ({ plan: { summary: '经营说明', style: 'precision', styleReason: '既有方向', pages: [{ id: 'home', title: '首页', outline: '收费与须知' }] } }));
    before = (await getCodeSite(id))!;
    const items = (options.short ? ['运费', '须知'] : ['收费口径', '用餐须知']).map((label, i) => ({ draftId: crypto.randomUUID(), revision: 1, body: '保留资料原文，调整排法。',
      target: { kind: 'dom', versionId: before.currentVersionId, pageId: 'home', path: [i + 1], label, text: `${label}${i === 0 ? activeClaim : options.short ? '自取。' : nextMode === 'mixed-groups' ? shortClaim : '按当天供应。'}` } }));
    if (options.reverse) items.reverse();
    await send(id, { message: '保留资料原文，调整排法。', baseRevision: 1, ...(entry === 'single' ? { selectedTarget: items[0].target } : { annotationBatch: items }) });
  }
  const response = await fetch(`${process.env.SITECRAFT_BASE}/api/sites/${id}/draft`); assert.equal(response.status, 200);
  const done = (await response.json()).codeSite;
  await writeFile(`${output}/${entry}-${mode}-${quote ? 'valid-quote' : 'empty-quote'}${options.short ? '-short' : ''}${options.reverse ? '-reversed' : ''}.json`, JSON.stringify({ before, done, requests }, null, 2), 'utf8');
  return { before, done };
}

for (const entry of ['site', 'single'] as const) for (const repairMode of ['missing-fixed', 'missing-always'] as const) {
  test(`${entry}：短声明免运费缺出处，${repairMode === 'missing-fixed' ? '补正后存版' : '两轮后如实拒收'}`, async () => {
    const { before, done } = await run(entry, repairMode, '', { short: true }), fixed = repairMode === 'missing-fixed';
    assert.equal(done.run.status, fixed ? 'complete' : 'error', done.run.step);
    assert.equal(done.run.repairRound, fixed ? 1 : 2); assert.equal(audits, fixed ? 2 : 3);
    const corrections = requests.filter(request => request.purpose === (entry === 'site' ? 'repair' : 'local-edit'));
    assert.equal(corrections.length, entry === 'site' ? fixed ? 1 : 2 : fixed ? 2 : 3);
    if (entry === 'site') for (const correction of corrections) {
      assert.ok(correction.input.fragments.some((fragment: any) => fragment.before === '免运费。'), '短声明必须实际进入修正请求');
      assert.ok(correction.input.fragments.every((fragment: any) => fragment.kind === 'text' && fragment.field === 'pages/home/html' && ['运费', '免运费。'].includes(fragment.before)), '只发送缺出处核对段的文本片段，不发送整页或无关短文字');
    }
    if (fixed) {
      assert.equal(done.versions.length, before.versions.length + 1);
      const saved = done.versions.at(-1);
      assert.ok(saved.checks.factCitations.entries.some((citation: any) => citation.claim === '免运费。' && citation.quote === '免运费。'));
      assert.match(saved.code.pages[0].html, /<h2>须知<\/h2><p>自取。<\/p>/);
    } else {
      assert.match(done.run.step, /两轮.*修正/); assert.deepEqual(done.versions, before.versions);
      assert.match(done.run.issues.join('\n'), /缺少有效资料出处/);
    }
  });
}
for (const reverse of [false, true]) {
  test(`批次两组分别协议错误与出处错误，${reverse ? '交换组顺序' : '原组顺序'}仍按协议终止`, async () => {
    const { before, done } = await run('batch', 'mixed-groups', '', { reverse });
    assert.equal(done.run.status, 'error'); assert.match(done.run.step, /重复类别/);
    assert.equal(done.run.repairRound, 0); assert.equal(audits, 1);
    assert.deepEqual(done.versions, before.versions);
    assert.equal(requests.filter(request => request.purpose === 'local-edit').length, 2);
    assert.equal(requests.filter(request => request.purpose === 'repair').length, 0);
    const audited = requests.find(request => request.purpose === 'facts')!.input.segments;
    assert.equal(audited.length, 2);
    assert.ok(audited[0].text.includes(reverse ? '免运费。' : '外带包装费每单2元。'));
  });
}

for (const entry of ['batch', 'single', 'site'] as const) {
  test(`${entry}：非法 claim 搭配空或有效引文都按协议立即终止`, async () => {
    for (const invalidQuote of ['', claim]) {
      const { before, done } = await run(entry, 'mixed', invalidQuote);
      assert.equal(done.run.status, 'error', done.run.step);
      assert.match(done.run.step, /声明不在本核对段/);
      assert.equal(done.run.repairRound, 0); assert.equal(audits, 1);
      assert.equal(requests.filter(request => request.purpose === 'repair').length, 0);
      assert.deepEqual(done.versions, before.versions); assert.equal(done.currentVersionId, before.currentVersionId);
    }
  });
  test(`${entry}：重复类别直接终止，不靠后续合法回复存版`, async () => {
    const { before, done } = await run(entry, 'duplicate');
    assert.equal(done.run.status, 'error', done.run.step);
    assert.match(done.run.step, /重复类别/);
    assert.equal(done.run.repairRound, 0); assert.equal(audits, 1);
    assert.deepEqual(done.versions, before.versions);
    assert.equal(requests.filter(request => request.purpose === 'local-edit').length, entry === 'site' ? 0 : entry === 'single' ? 1 : 2);
    assert.equal(requests.filter(request => request.purpose === 'repair').length, 0);
  });
}
for (const entry of ['site', 'single'] as const) for (const repairMode of ['missing-fixed', 'missing-always'] as const) {
  test(`${entry}：仅代码发现缺出处，${repairMode === 'missing-fixed' ? '修好存版' : '两轮仍缺如实拒收'}`, async () => {
    const { before, done } = await run(entry, repairMode), fixed = repairMode === 'missing-fixed';
    assert.equal(done.run.status, fixed ? 'complete' : 'error', done.run.step);
    assert.equal(done.run.repairRound, fixed ? 1 : 2);
    assert.equal(audits, fixed ? 2 : 3);
    assert.ok(requests.filter(request => request.purpose === 'facts').every(request => request.input.segments.length > 0));
    assert.match(done.run.attempts[0].checks.issues.join('\n'), /缺少有效资料出处/);
    const corrections = requests.filter(request => request.purpose === (entry === 'site' ? 'repair' : 'local-edit'));
    assert.equal(corrections.length, entry === 'site' ? fixed ? 1 : 2 : fixed ? 2 : 3);
    if (entry === 'site') {
      assert.ok(corrections.every(request => request.input.fragments.some((fragment: any) => fragment.before.includes(claim))), '缺出处拒因须定位到声明原文并实际发起修正');
      assert.ok(corrections.every(request => !('current' in request.input)), '沿用定位片段修正，不能整站重写');
    }
    if (fixed) {
      assert.equal(done.versions.length, before.versions.length + 1);
      assert.ok(done.versions.at(-1).checks.factCitations.entries.some((citation: any) => citation.claim === claim && citation.quote === claim));
      assert.match(done.versions.at(-1).code.pages[0].html, /其余说明保留。/);
    } else {
      assert.match(done.run.step, /两轮.*修正/);
      assert.deepEqual(done.versions, before.versions); assert.equal(done.currentVersionId, before.currentVersionId);
    }
  });
}
