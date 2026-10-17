import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import type { SiteCode } from '../lib/code-site.ts';
import { budgetChild } from './helpers/budget-child.ts';

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
// 独立合成输入：不能借完整 JSON 解析丢掉属性名、重复属性或截断的字符串。
const credentialBodies = {
  'http-key-name': String.raw`{"local\u002dintercept\u002donly":"属性名里的合成凭据"}`,
  'http-duplicate': String.raw`{"message":"local\u002dintercept\u002donly","message":"后值覆盖前值"}`,
  'http-truncated': String.raw`{"error":{"message":"local\u002dintercept\u002donly`,
  'http-app-credential': String.raw`{"message":"仅应用持有 local\u002donly"}`,
  'http-clean-control': '{\n  "error": {"message": "无凭据的中文错误，路径 a\\/b", "code": "invalid_request_error"}\n}\n',
} as const;
type Mode = 'valid' | 'repair' | 'stop-1284' | 'missing' | 'wrong-name' | 'multiple' | 'non-json' | 'fenced' | 'schema' | 'extra' | 'mixed' | 'empty' | 'html-limit' | 'css-limit' | 'reason-limit' | 'stop-function' | 'length' | 'cannot' | 'http-400' | 'http-400-fallback' | 'http-400-no-id' | 'http-text' | 'http-sensitive' | keyof typeof credentialBodies;
const errorBody = '{\n  "error": {"message": "局部 schema 被拒绝", "code": "invalid_request_error"},\n  "request_id": "正文中的编号不能代替响应头"\n}\n';
const textError = '<html>上游暂时拒绝局部请求</html>\n';
let mode: Mode = 'valid', groupCount = 1, writes = 0;
const requests: any[] = [], replies: any[] = [];
const provider = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw), local = body.messages[0].content.includes('本次局部修改');
  const input = JSON.parse(body.messages[1].content.split('\n')[0]);
  requests.push({ local, url: req.url, body });
  if (local && mode.startsWith('http-')) {
    writes++;
    if (mode !== 'http-400-no-id') res.setHeader(mode === 'http-400-fallback' ? 'x-request-id' : 'x-ds-trace-id', 'fixture-request-174');
    res.setHeader('authorization', 'Bearer response-header-must-not-be-copied');
    res.setHeader('content-type', mode === 'http-text' ? 'text/html' : 'application/json');
    res.writeHead(mode === 'http-text' ? 503 : 400);
    // 转义后的凭据在 JSON.parse 后仍是密钥，不能只清理原文的连续子串。
    res.end(mode in credentialBodies ? credentialBodies[mode as keyof typeof credentialBodies] : mode === 'http-text' ? textError : mode === 'http-sensitive' ? JSON.stringify({ error: { message: '拒绝 local-intercept-only', authorization: 'Bearer local-intercept-only', api_key: 'local-only' } }).replaceAll('-', '\\u002d') : errorBody);
    return;
  }
  let finishReason = 'stop', message: any;
  if (!local) {
    message = { content: JSON.stringify({ results: input.segments.map((segment: any) => ({ id: segment.id, issues: [], noFacts: true, factCategories: [], citations: [] })) }) };
  } else {
    writes++;
    const html = input.html.replace('纸箱介绍', '纸箱用途').replace('纸袋介绍', '纸袋用途');
    let answer: unknown = { html: mode === 'repair' && writes <= groupCount ? `<main>${html}</main>` : html, css: '', cannotEdit: '' };
    if (mode === 'schema') answer = { html }; // 合同要求 css，即使为空也不能遗漏。
    if (mode === 'extra') answer = { html, css: '', cannotEdit: '', pages: [] };
    if (mode === 'mixed') answer = { html, css: '', cannotEdit: '拒绝与候选不得混用' };
    if (mode === 'empty') answer = { html: '', css: '', cannotEdit: '' };
    if (mode === 'html-limit') answer = { html: 'A'.repeat(100001), css: '', cannotEdit: '' };
    if (mode === 'css-limit') answer = { html, css: 'A'.repeat(30001), cannotEdit: '' };
    if (mode === 'reason-limit') answer = { html: '', css: '', cannotEdit: 'A'.repeat(501) };
    if (mode === 'cannot') answer = { html: '', css: '', cannotEdit: '该意见需要修改区块外内容' };
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
const providerBase = process.env.DEEPSEEK_BASE_URL;
process.env.DEEPSEEK_API_KEY = 'local-only'; process.env.DEEPSEEK_MODEL = 'local-only';
test.after(() => new Promise<void>(resolve => provider.close(() => resolve())));

async function run(nextMode: Mode, batch: boolean, throughBudget = false) {
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
  const gateway = throughBudget ? await budgetChild(providerBase, path.resolve(output, `${batch ? 'batch' : 'single'}-${mode}-budget`)) : null;
  process.env.DEEPSEEK_BASE_URL = gateway?.base ?? providerBase;
  try {
  const response = await chat(new Request(`${process.env.SITECRAFT_BASE}/api/sites/${id}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }), { params: Promise.resolve({ siteId: id }) });
  assert.equal(response.status, 202, await response.clone().text());
  for (const callback of callbacks.splice(0)) await callback();
  const readback = await fetch(`${process.env.SITECRAFT_BASE}/api/sites/${id}/draft`);
  assert.equal(readback.status, 200);
  const done = (await readback.json()).codeSite;
  const ledger = gateway ? await gateway.ledger() : null;
  await writeFile(`${output}/${batch ? 'batch' : 'single'}-${mode}.json`, JSON.stringify({ before, done, requests, replies, ledger }, null, 2), 'utf8');
  assert.deepEqual(done.versions[0], before.versions[0], '旧版本原样保留');
  return { before, done, ledger };
  } finally { process.env.DEEPSEEK_BASE_URL = providerBase; await gateway?.close(); }
}

for (const bad of Object.keys(credentialBodies) as Array<keyof typeof credentialBodies>) {
  test(`T-174 留存边界：${bad} 经网关一直走到任务落盘`, { timeout: 120000 }, async () => {
    const { before, done, ledger } = await run(bad, false, true);
    assert.equal(done.run.status, 'error');
    assert.match(done.run.step, /HTTP 400/);
    assert.equal(done.currentVersionId, before.currentVersionId);
    assert.deepEqual(done.versions, before.versions);
    assert.equal(done.run.repairRound, 0);
    assert.equal(done.run.attempts.length, 0);
    assert.equal(requests.length, 1, 'HTTP 错误不重试、不继续事实核对');
    assert.equal(done.run.modelCalls.length, 1);
    assert.equal(ledger.calls.length, 1);
    assert.equal(ledger.stopped, true);
    const taskError = done.run.modelCalls[0].httpError, gatewayError = ledger.calls[0].httpError;
    for (const diagnostic of [taskError, gatewayError]) {
      assert.equal(diagnostic.status, 400);
      assert.equal(diagnostic.requestIdHeader, 'x-ds-trace-id');
      assert.equal(diagnostic.requestId, 'fixture-request-174');
    }
    const discarded = { status: 400, bodyRedacted: true, bodyLength: credentialBodies[bad].length,
      requestIdHeader: 'x-ds-trace-id', requestId: 'fixture-request-174' };
    if (bad === 'http-clean-control') {
      for (const diagnostic of [taskError, gatewayError]) assert.deepEqual(diagnostic,
        { status: 400, body: credentialBodies[bad], requestIdHeader: 'x-ds-trace-id', requestId: 'fixture-request-174' }, '无凭据正文及其空白、转义原样保存');
    } else {
      assert.deepEqual(taskError, discarded, '任务只保存舍弃标记与原始长度，不能留下原文或转义凭据');
      if (bad === 'http-app-credential') {
        assert.equal(gatewayError.body, credentialBodies[bad], '网关按自己持有的凭据检查；应用独立识别自己的占位 token');
      } else assert.deepEqual(gatewayError, discarded, '账本同样舍弃整段正文，不先解析属性再尝试改写');
      assert.doesNotMatch(JSON.stringify(taskError), /local-only|local-intercept-only|\\u002d/);
    }
    assert.doesNotMatch(JSON.stringify(gatewayError), /local-intercept-only/);
  });
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
    // 根只能是一个对象；互斥和长度全部留给 Zod，不把长上限编码进正则。
    const schema = body.tools[0].function.parameters;
    assert.equal(schema.type, 'object');
    assert.equal(schema.anyOf, undefined);
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual([...schema.required].sort(), ['cannotEdit', 'css', 'html']);
    assert.deepEqual(schema.properties, { html: { type: 'string' }, css: { type: 'string' }, cannotEdit: { type: 'string' } });
    assert.doesNotMatch(JSON.stringify(schema), /"(?:pattern|minLength|maxLength)"/, '局部 provider schema 不携带长度限制');
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
    ['empty', /局部修改.*格式/], ['html-limit', /局部修改.*格式/], ['css-limit', /局部修改.*格式/], ['reason-limit', /局部修改.*格式/],
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
  for (const bad of ['http-400', 'http-400-fallback', 'http-400-no-id', 'http-text', 'http-sensitive'] as const) test(`${entry}：${bad} 经真实预算网关，正文与响应编号同时保留在任务和账本`, { timeout: 120000 }, async () => {
    const { before, done, ledger } = await run(bad, batch, true);
    assert.equal(done.run.status, 'error');
    assert.match(done.run.step, bad === 'http-text' ? /HTTP 503/ : /HTTP 400/);
    assert.deepEqual(done.versions, before.versions);
    assert.equal(done.currentVersionId, before.currentVersionId);
    assert.equal(done.run.repairRound, 0);
    assert.equal(done.run.attempts.length, 0);
    assert.equal(requests.length, 1);
    assert.equal(ledger.calls.length, 1);
    assert.equal(ledger.stopped, true);
    assert.equal(done.run.modelCalls.length, 1);
    const call = done.run.modelCalls[0], recorded = ledger.calls[0];
    const requestId = bad === 'http-400-no-id' ? null : 'fixture-request-174';
    const requestIdHeader = bad === 'http-400-no-id' ? null : bad === 'http-400-fallback' ? 'x-request-id' : 'x-ds-trace-id';
    assert.equal(call.httpStatus, bad === 'http-text' ? 503 : 400);
    assert.equal(recorded.httpStatus, call.httpStatus);
    assert.ok(recorded.httpError, '网关账本必须保留上游 HTTP 错误诊断');
    assert.ok(call.httpError, '任务必须保留网关转发的 HTTP 错误诊断');
    assert.deepEqual(call.httpError, recorded.httpError, '应用必须收到网关转发的原响应编号和相同的脱敏正文');
    assert.deepEqual(Object.keys(recorded.httpError).sort(), bad === 'http-sensitive'
      ? ['bodyLength', 'bodyRedacted', 'requestId', 'requestIdHeader', 'status'] : ['body', 'requestId', 'requestIdHeader', 'status']);
    assert.equal(recorded.httpError.status, call.httpStatus);
    assert.equal(recorded.httpError.requestId, requestId);
    assert.equal(recorded.httpError.requestIdHeader, requestIdHeader);
    if (bad === 'http-sensitive') {
      assert.equal(recorded.httpError.body, undefined);
      assert.equal(recorded.httpError.bodyRedacted, true);
      assert.equal(recorded.httpError.bodyLength, JSON.stringify({ error: { message: '拒绝 local-intercept-only', authorization: 'Bearer local-intercept-only', api_key: 'local-only' } }).replaceAll('-', '\\u002d').length);
    } else assert.equal(recorded.httpError.body, bad === 'http-text' ? textError : errorBody);
    assert.doesNotMatch(JSON.stringify(recorded.httpError), /response-header-must-not-be-copied/);
  });
}
