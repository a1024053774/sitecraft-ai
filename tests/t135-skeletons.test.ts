import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

// Contract failure modes: cards never reach the planner or writer; schema drops
// the model's choice; refresh loses it; a fixed enum prevents another structure;
// a missing choice or blank reason is silently accepted. Only the provider and
// Next's deferred scheduler are fixtures. Handlers, storage and commit are real.
const scheduled: Array<() => Promise<void>> = [];
(globalThis as typeof globalThis & { __t135After?: typeof scheduled }).__t135After = scheduled;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'next/server.js') return { shortCircuit: true, url: 'data:text/javascript,export function after(fn){globalThis.__t135After.push(fn)}' };
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });
const choice = { id: 'two-businesses', reason: '标准零件与来图加工的资料分别齐备，先分开两个采购入口。' };
const plan = { summary: '先选标准零件或来图加工，再看各自范围并联系。', style: 'precision', styleReason: '两类业务需要清楚的选型入口。',
  skeletonId: choice.id, skeletonReason: choice.reason, pages: [
    { id: 'home', title: '首页', outline: ['两类业务入口、加工与检测、联系'] },
    { id: 'products', title: '产品与加工', outline: ['标准零件、来图加工范围'] },
    { id: 'contact', title: '联系', outline: ['邮箱、系统询盘表单'] },
  ] };
const code = { header: '<header>双路机械<nav><a href="/home">首页</a><a href="/products">产品与加工</a><a href="/contact">联系</a></nav></header>', footer: '<footer>双路机械</footer>',
  css: 'body{margin:0;background:#fff;color:#111;font:16px/1.6 sans-serif}header,main,footer{padding:24px}nav{display:flex;gap:16px;flex-wrap:wrap}a{color:#111}p{max-width:30em}',
  pages: [
    { id: 'home', title: '双路机械', html: '<main><h1>标准零件与来图加工</h1><p>双路机械从事标准轴套供应与来图车削加工。</p><a href="/products">查看产品与加工范围</a></main>' },
    { id: 'products', title: '产品与加工', html: '<main><h1>产品与加工</h1><h2>标准轴套</h2><p>材质为不锈钢。</p><h2>来图车削加工</h2><p>加工范围以图纸确认为准。</p><a href="/contact">联系</a></main>' },
    { id: 'contact', title: '联系', html: '<main><h1>联系双路机械</h1><p>邮箱 sales@dual.example</p><div data-system-inquiry=""></div></main>' },
  ] };
const outbound: Array<{ system: string; user: string }> = [];
let nextPlan: unknown = plan;
const server = createServer(async (req, res) => {
  if (req.method === 'GET') { res.setHeader('content-type', 'text/html'); res.end('<html><body>fixture origin</body></html>'); return; }
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw), system = body.messages[0].content, user = body.messages[1].content;
  outbound.push({ system, user });
  const content = system.includes('事实校对员') ? { issues: [] } : user.includes('先给页面大纲') ? nextPlan : code;
  res.setHeader('content-type', 'application/json');
  const planCall = !!body.tools;
  res.end(JSON.stringify({ choices: [{ finish_reason: planCall ? 'tool_calls' : 'stop', message: planCall
    ? { content: null, tool_calls: [{ type: 'function', function: { name: 'submit_page_plan', arguments: JSON.stringify(content) } }] }
    : { content: JSON.stringify(content) } }] }));
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); assert.ok(address && typeof address === 'object');
const base = `http://127.0.0.1:${address.port}`;
process.env.SITE_STORE = 'fs'; process.env.SITECRAFT_BASE = base;
process.env.DEEPSEEK_BASE_URL = base; process.env.DEEPSEEK_API_KEY = 't135-provider-fixture'; process.env.DEEPSEEK_MODEL = 't135-provider-fixture';
const { POST: create } = await import('../app/api/sites/route.ts');
const { POST: chat } = await import('../app/api/sites/[siteId]/chat/route.ts');
const { GET: draft } = await import('../app/api/sites/[siteId]/draft/route.ts');
const { planSiteCode } = await import('../lib/code-site-model.ts');
const request = (url: string, body: unknown) => new Request(base + url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const preferences = { style: 'precision' as const, layout: 5, density: 6 };
test.after(() => new Promise<void>(resolve => server.close(() => resolve())));

test('plan-only: actual alignment and reload retain the choice and request order without generating pages', async () => {
  nextPlan = plan;
  const response = await create(request('/api/sites', { name: '双路机械' }));
  assert.equal(response.status, 201); const { id } = await response.json();
  const ctx = { params: Promise.resolve({ siteId: id }) };
  const started = await chat(request(`/api/sites/${id}/chat`, { message: '公司名：双路机械\n从事标准轴套供应与来图车削加工。', baseRevision: 0 }), ctx);
  const state = await started.json();
  const selected = await chat(request(`/api/sites/${id}/chat`, { action: 'select', questionId: state.alignment.questionId, questionRevision: state.alignment.questionRevision, optionId: 'precision', preferences }), ctx);
  assert.equal(selected.status, 202); await scheduled.shift()!();
  const reloaded = await (await draft(new Request(base + `/api/sites/${id}/draft`), ctx)).json();
  assert.equal(reloaded.codeSite.run.status, 'complete');
  assert.deepEqual(reloaded.codeSite.plan.skeleton, choice);
  const wire = [...outbound.at(-1)!.system.matchAll(/^## ([a-z][a-z0-9-]+) /gm)].map(match => match[1]);
  assert.deepEqual(reloaded.codeSite.plan.skeletonOrder, wire);
  assert.deepEqual(reloaded.codeSite.run.modelCalls[0].skeletonOrder, wire);
  assert.equal(reloaded.codeSite.versions.length, 0, 'planning must not write or check site code');
});
test('skeleton choice survives alignment, confirmation, checked submission and reload; cards reach both model stages', async () => {
  nextPlan = plan;
  let siteId: string | undefined;
  try {
    const response = await create(request('/api/sites', { name: '双路机械' }));
    assert.equal(response.status, 201); siteId = (await response.json()).id;
    const ctx = { params: Promise.resolve({ siteId: siteId! }) };
    const started = await chat(request(`/api/sites/${siteId}/chat`, { message: '公司名：双路机械\n从事标准轴套供应与来图车削加工。标准轴套材质为不锈钢。加工范围以图纸确认为准。邮箱 sales@dual.example', baseRevision: 0 }), ctx);
    const state = await started.json();
    const selected = await chat(request(`/api/sites/${siteId}/chat`, { action: 'select', questionId: state.alignment.questionId, questionRevision: state.alignment.questionRevision, optionId: 'precision', preferences }), ctx);
    assert.equal(selected.status, 202); await scheduled.shift()!();
    const planned = await (await chat(request(`/api/sites/${siteId}/chat`, { action: 'state' }), ctx)).json();
    assert.equal(planned.codeSite.run.status, 'complete');
    assert.deepEqual(planned.codeSite.plan.skeleton, choice, 'the planner choice and material-based reason must persist');
    const confirmed = await chat(request(`/api/sites/${siteId}/chat`, { action: 'confirm', questionId: planned.alignment.questionId, questionRevision: planned.alignment.questionRevision }), ctx);
    assert.equal(confirmed.status, 202); await scheduled.shift()!();
    const reloaded = await (await draft(new Request(base + `/api/sites/${siteId}/draft`), ctx)).json();
    assert.equal(reloaded.codeSite.run.status, 'complete');
    assert.deepEqual(reloaded.codeSite.plan.skeleton, choice);
    assert.equal(reloaded.codeSite.versions.length, 1);
    assert.equal(reloaded.codeSite.versions[0].checks.passed, true);
    assert.equal(reloaded.codeSite.versions[0].checks.viewports.length, 9, 'three pages must pass all three viewport checks');
    const planning = outbound.find(call => call.user.includes('先给页面大纲'))!;
    const writing = outbound.find(call => call.user.includes('当前完整站点') || call.user.includes('写出大纲中所有页面'))!;
    for (const call of [planning, writing]) {
      const ids = [...call.system.matchAll(/^## ([a-z][a-z0-9-]+) /gm)].map(match => match[1]);
      assert.ok(ids.length >= 6 && ids.length <= 10, 'the outbound model request must load 6–10 actual cards');
      assert.ok(ids.includes('two-businesses') && ids.includes('product-atlas'), 'distinct business routing and product browsing must be available');
      assert.ok(call.system.includes('事实只来自用户资料'), 'cards must accompany the core rules');
    }
    assert.ok(writing.user.includes(JSON.stringify(choice)), 'the writer must receive the confirmed choice');
  } finally {
    const directory = path.join('artifacts/t135', `contract-${new Date().toISOString().replace(/[:.]/g, '-')}`);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'report.json'), JSON.stringify({ kind: 'provider-fixture-only', siteId, observedAt: new Date().toISOString(), command: 'CHROME_PATH=<AGENTS path> node --test --experimental-strip-types tests/t135-skeletons.test.ts', outbound }, null, 2), 'utf8');
  }
});
test('a material-specific structure outside the cards is preserved instead of forced into a card enum', async () => {
  const custom = { id: 'custom', reason: '资料只有一个产品及一段工况，采用短页中轴结构。' };
  nextPlan = { ...plan, skeletonId: custom.id, skeletonReason: custom.reason };
  assert.deepEqual((await planSiteCode('单一产品与工况', preferences, '规划')).plan.skeleton, custom);
});
test('new outlines reject missing skeleton metadata and blank reasons', async () => {
  const { skeletonId: _id, skeletonReason: _reason, ...missing } = plan;
  nextPlan = missing;
  await assert.rejects(planSiteCode('两类业务', preferences, '规划'));
  nextPlan = { ...plan, skeletonReason: '   ' };
  await assert.rejects(planSiteCode('两类业务', preferences, '规划'));
});
