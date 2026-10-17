import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import type { SiteCode } from '../lib/code-site.ts';

// 期望来自 T-174：格式错误终止且保留原答；首轮、修正轮均严格调用函数；
// 合法单区块与跨页批次经生产 chat/提交入口存版。只替换 after 调度和模型。
const callbacks: Array<() => Promise<void>> = [];
(globalThis as any).__t174After = callbacks;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'next/server.js') return { shortCircuit: true, url: 'data:text/javascript,export function after(fn){globalThis.__t174After.push(fn)}' };
  if (!specifier.startsWith('@/')) return next(specifier, context);
  return next(pathToFileURL(path.join(process.cwd(), `${specifier.slice(2)}.ts`)).href, context);
} });
const { commitSiteCode, getCodeSite, updateCodeSite } = await import('../lib/code-site-store.ts');
const { POST: chat } = await import('../app/api/sites/[siteId]/chat/route.ts');
const output = `artifacts/t174/local-function-${Date.now()}-${process.pid}`;
await mkdir(output, { recursive: true });
const original: SiteCode = {
  header: '<header>青禾纸品</header>', footer: '<footer>纸品介绍</footer>',
  css: 'body{margin:0;color:#222;background:#fff;font:18px/1.6 sans-serif}header,footer,main{padding:24px}section{padding:24px 0}p{max-width:36em}',
  pages: [
    { id: 'home', title: '首页', html: '<main><section><h1>纸箱介绍</h1><p>纸箱按用途展示。</p></section><aside>首页其余内容保留。</aside></main>' },
    { id: 'products', title: '产品', html: '<main><section><h1>纸袋介绍</h1><p>纸袋按用途展示。</p></section><aside>产品页其余内容保留。</aside></main>' },
  ],
};
const incomplete = '{"html":"' + '未闭合的区块内容'.repeat(200);
const broken1284 = incomplete.slice(0, 1284);
assert.equal(broken1284.length, 1284);
const usage = { prompt_tokens: 3735, completion_tokens: 1898, total_tokens: 5633, completion_tokens_details: { reasoning_tokens: 1311 } };
type Mode = 'valid' | 'repair' | 'stop-1284' | 'missing' | 'wrong-name' | 'multiple' | 'non-json' | 'fenced' | 'schema' | 'extra' | 'mixed' | 'stop-function' | 'length' | 'cannot';
let mode: Mode = 'valid', groupCount = 1, writes = 0;
const requests: any[] = [], replies: any[] = [];
const provider = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw), local = body.messages[0].content.includes('本次局部修改');
  const input = JSON.parse(body.messages[1].content.split('\n')[0]);
  requests.push({ local, url: req.url, body });
  let finishReason = 'stop', message: any;
  if (!local) {
    message = { content: JSON.stringify({ results: input.segments.map((segment: any) => ({ id: segment.id, issues: [], noFacts: true, factCategories: [], citations: [] })) }) };
  } else {
    writes++;
    const html = input.html.replace('纸箱介绍', '纸箱用途').replace('纸袋介绍', '纸袋用途');
    let answer: unknown = { html: mode === 'repair' && writes <= groupCount ? `<main>${html}</main>` : html, css: '' };
    if (mode === 'schema') answer = { html }; // 合同要求 css，即使为空也不能遗漏。
    if (mode === 'extra') answer = { html, css: '', pages: [] };
    if (mode === 'mixed') answer = { html, css: '', cannotEdit: '拒绝与候选不得混用' };
    if (mode === 'cannot') answer = { cannotEdit: '该意见需要修改区块外内容' };
    const args = mode === 'non-json' ? broken1284 : mode === 'fenced' ? '```json\n' + JSON.stringify(answer) + '\n```' : JSON.stringify(answer);
    message = { content: '模型正文也须保留', tool_calls: [{ id: 'local-call', type: 'function', function: { name: mode === 'wrong-name' ? 'other_function' : 'submit_local_edit', arguments: args } }] };
    finishReason = mode === 'stop-function' ? 'stop' : mode === 'length' ? 'length' : 'tool_calls';
    if (mode === 'stop-1284') { finishReason = 'stop'; message = { content: broken1284 }; }
    if (mode === 'missing') message = { content: JSON.stringify(answer) };
    if (mode === 'multiple') message.tool_calls.push(structuredClone(message.tool_calls[0]));
    replies.push({ finishReason, message });
  }
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ choices: [{ finish_reason: finishReason, message }], usage }));
});
await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
const address = provider.address(); assert.ok(address && typeof address === 'object');
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
process.env.DEEPSEEK_API_KEY = 'local-only'; process.env.DEEPSEEK_MODEL = 'local-only';
test.after(() => new Promise<void>(resolve => provider.close(() => resolve())));

async function run(nextMode: Mode, batch: boolean) {
  mode = nextMode; writes = 0; groupCount = batch ? 2 : 1; requests.length = 0; replies.length = 0;
  const id = `t174-${crypto.randomUUID()}`;
  const saved = await commitSiteCode({ siteId: id, legacyImport: { kind: 'convert', name: '青禾纸品',
    source: { revision: 1, updatedAt: new Date().toISOString() }, materials: '公司名：青禾纸品\n纸箱、纸袋按用途展示。', code: original, exportIssues: [] } });
  assert.equal(saved.status, 'applied');
  await updateCodeSite(id, () => ({ preferences: { style: 'precision', layout: 5, density: 6 }, plan: { summary: '纸品介绍', style: 'precision', styleReason: '既有方向',
    pages: [{ id: 'home', title: '首页', outline: '纸箱介绍' }, { id: 'products', title: '产品', outline: '纸袋介绍' }] } }));
  const before = (await getCodeSite(id))!, version = before.versions[0];
  const target = (pageId: string, text: string) => ({ kind: 'dom', versionId: version.id, pageId, path: [0], text, label: text });
  const selectedTarget = target('home', '纸箱介绍纸箱按用途展示。');
  const input = { message: '标题改为用途，保留其他内容。', baseRevision: 1,
    ...(batch ? { annotationBatch: [selectedTarget, target('products', '纸袋介绍纸袋按用途展示。')].map(target => ({ draftId: crypto.randomUUID(), revision: 1, target, body: '标题改为用途，保留其他内容。' })) } : { selectedTarget }) };
  const response = await chat(new Request(`${process.env.SITECRAFT_BASE}/api/sites/${id}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }), { params: Promise.resolve({ siteId: id }) });
  assert.equal(response.status, 202, await response.clone().text());
  for (const callback of callbacks.splice(0)) await callback();
  const readback = await fetch(`${process.env.SITECRAFT_BASE}/api/sites/${id}/draft`);
  assert.equal(readback.status, 200);
  const done = (await readback.json()).codeSite;
  await writeFile(`${output}/${batch ? 'batch' : 'single'}-${mode}.json`, JSON.stringify({ before, done, requests, replies }, null, 2), 'utf8');
  assert.deepEqual(done.versions[0], before.versions[0], '旧版本原样保留');
  return { before, done };
}
function strictRequests() {
  const local = requests.filter(call => call.local);
  for (const { body, url } of local) {
    assert.equal(url, '/beta/chat/completions');
    assert.equal(body.response_format, undefined, '删除局部 json_object 路径');
    assert.equal(body.tools.length, 1);
    assert.equal(body.tools[0].type, 'function');
    assert.equal(body.tools[0].function.name, 'submit_local_edit');
    assert.equal(body.tools[0].function.strict, true);
    // T-174 沿用原合同的互斥两种对象，字段均必填且禁止多余字段。
    const variants = body.tools[0].function.parameters.anyOf;
    assert.equal(variants.length, 2);
    assert.deepEqual(variants.map((variant: any) => [...variant.required].sort()), [['css', 'html'], ['cannotEdit']]);
    assert.ok(variants.every((variant: any) => variant.type === 'object' && variant.additionalProperties === false));
    assert.equal(body.thinking.type, 'enabled');
    assert.equal(body.tool_choice, 'auto', '开启思考时沿用现有大纲的 auto 调用机制');
    assert.equal(body.max_tokens, 12288);
  }
  return local;
}
for (const batch of [false, true]) {
  const entry = batch ? '跨页批次' : '单区块';
  for (const nextMode of ['valid', 'repair'] as const) test(`${entry}：合法函数参数${nextMode === 'repair' ? '经实际修正轮' : ''}存版，所有局部请求均 tools + strict`, { timeout: 120000 }, async () => {
    const { done } = await run(nextMode, batch);
    assert.equal(done.run.status, 'complete', done.run.step);
    assert.equal(done.versions.length, 2);
    const code = done.versions.find((version: any) => version.id === done.currentVersionId).code;
    assert.match(code.pages[0].html, /纸箱用途/);
    if (batch) assert.match(code.pages[1].html, /纸袋用途/);
    else assert.equal(code.pages[1].html, original.pages[1].html);
    for (const page of code.pages) assert.match(page.html, /其余内容保留/);
    const local = strictRequests();
    assert.equal(local.length, (batch ? 2 : 1) * (nextMode === 'repair' ? 2 : 1));
    assert.equal(done.run.repairRound, nextMode === 'repair' ? 1 : 0);
    const inputs = local.map(call => JSON.parse(call.body.messages[1].content.split('\n')[0]));
    if (nextMode === 'repair') assert.ok(inputs.slice(batch ? 2 : 1).every(input => input.issues.some((issue: string) => issue.includes('一个区块'))));
    const facts = requests.filter(call => !call.local);
    assert.ok(facts.length > 0);
    assert.ok(facts.every(call => call.body.thinking.type === 'disabled' && call.body.max_tokens === 4096));
  });
  const failures: Array<[Mode, RegExp]> = [
    ['stop-1284', /未返回结构化局部修改/], ['missing', /未返回结构化局部修改/], ['wrong-name', /未返回结构化局部修改/],
    ['multiple', /未返回结构化局部修改/], ['non-json', /不是完整 JSON/], ['fenced', /不是完整 JSON/],
    ['schema', /局部修改.*格式/], ['extra', /局部修改.*格式/], ['mixed', /局部修改.*格式/],
    ['stop-function', /未返回结构化局部修改/], ['length', /被截断/],
  ];
  for (const [bad, error] of failures) test(`${entry}：${bad} 立即拒收，任务保存原始回答、结束原因与用量`, { timeout: 120000 }, async () => {
    const { before, done } = await run(bad, batch);
    assert.equal(done.run.status, 'error');
    assert.match(done.run.step, error);
    assert.match(done.run.step, /未保存版本/);
    assert.equal(done.currentVersionId, before.currentVersionId);
    assert.deepEqual(done.versions, before.versions);
    assert.equal(writes, 1, '格式错误不能重试、进入修正轮或继续后续组');
    assert.equal(requests.length, 1, '不能继续事实核对');
    assert.equal(done.run.repairRound, 0);
    assert.equal(done.run.attempts.length, 0);
    assert.equal(done.run.modelCalls.length, 1);
    const call = done.run.modelCalls[0];
    assert.equal(call.httpStatus, 200);
    assert.deepEqual(call.response.rawMessage, { content: replies[0].message.content, tool_calls: replies[0].message.tool_calls ?? null });
    assert.equal(call.response.finishReason, replies[0].finishReason);
    assert.deepEqual(call.usage, { promptTokens: 3735, completionTokens: 1898, totalTokens: 5633, reasoningTokens: 1311 });
    if (bad === 'stop-1284') assert.equal(call.response.answerChars, 1284);
    strictRequests();
  });
  test(`${entry}：合法 cannotEdit 函数参数保留明确拒因且不进入修正`, { timeout: 120000 }, async () => {
    const { before, done } = await run('cannot', batch);
    assert.equal(done.run.status, 'error');
    assert.match(done.run.step, batch ? /一组批注明确拒绝/ : /该意见需要修改区块外内容/);
    assert.deepEqual(done.versions, before.versions);
    assert.equal(writes, batch ? 2 : 1);
    assert.equal(done.run.repairRound, 0);
    strictRequests();
  });
}
