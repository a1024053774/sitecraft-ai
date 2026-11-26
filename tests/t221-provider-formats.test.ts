import assert from 'node:assert/strict';
import { createServer, type IncomingHttpHeaders } from 'node:http';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { factAuditReply, factAuditPayload } from './fixtures/fact-audit-reply.ts';
import { dialectOf, toDeepSeekBody, fromDeepSeekReply } from './fixtures/provider-dialect.ts';
import { providerRequest, providerReply, otherFormatOutputCap, responsesStrict } from '../lib/provider-format.ts';
import { providerFromRequest, ProviderSettingsError } from '../lib/provider-context.ts';
import { getAIProviderStatus } from '../lib/ai-provider.ts';
import { withProviderAddress, withProviderFormat } from '../lib/provider-settings-client.ts';
import type { CodeModelCall } from '../lib/code-site.ts';

registerHooks({ resolve(specifier, context, next) {
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });

const tool = { name: 'submit_page_plan', description: '大纲', parameters: { type: 'object' }, forced: false };
const call = { model: 'm', system: 'S', user: 'U', maxTokens: 65536, temperature: 0.5, thinking: 'enabled' as const };

test('the DeepSeek request is what it was before other formats existed', () => {
  const withTool = providerRequest('deepseek', 'https://api.deepseek.com', 'k', { ...call, tool });
  assert.equal(withTool.url, 'https://api.deepseek.com/beta/chat/completions');
  assert.deepEqual(withTool.headers, { 'content-type': 'application/json', authorization: 'Bearer k' });
  assert.deepEqual(withTool.body, { model: 'm', temperature: 0.5, max_tokens: 65536, thinking: { type: 'enabled' },
    tools: [{ type: 'function', function: { name: 'submit_page_plan', description: '大纲', strict: true, parameters: { type: 'object' } } }], tool_choice: 'auto',
    messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }] });
  assert.deepEqual(providerRequest('deepseek', 'https://api.deepseek.com', 'k', { ...call, tool: { ...tool, forced: true } }).body.tool_choice, { type: 'function', function: { name: 'submit_page_plan' } });
  const plain = providerRequest('deepseek', 'https://api.deepseek.com', 'k', { ...call, thinking: undefined });
  assert.equal(plain.url, 'https://api.deepseek.com/chat/completions');
  assert.deepEqual(plain.body, { model: 'm', temperature: 0.5, max_tokens: 65536, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }] });
});

test('the OpenAI request has no DeepSeek path, thinking switch or temperature', () => {
  const withTool = providerRequest('openai', 'https://api.openai.com/v1', 'k', { ...call, tool });
  assert.equal(withTool.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(providerRequest('openai', 'https://api.openai.com', 'k', call).url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(providerRequest('openai', 'https://example.com/proxy/openai', 'k', call).url, 'https://example.com/proxy/openai/chat/completions');
  assert.deepEqual(Object.keys(withTool.body), ['model', 'max_completion_tokens', 'tools', 'tool_choice', 'messages']);
  assert.equal(withTool.body.max_completion_tokens, otherFormatOutputCap);
  assert.deepEqual(withTool.body.tool_choice, { type: 'function', function: { name: 'submit_page_plan' } });
  assert.equal(providerRequest('openai', 'https://api.openai.com/v1', 'k', { ...call, maxTokens: 12288 }).body.max_completion_tokens, 12288);
  assert.deepEqual(providerRequest('openai', 'https://api.openai.com/v1', 'k', call).body.response_format, { type: 'json_object' });
});

test('the Responses request uses its own endpoint and shapes, with no reasoning setting or temperature', () => {
  const withTool = providerRequest('openai-responses', 'https://api.openai.com/v1', 'k', { ...call, tool });
  assert.equal(withTool.url, 'https://api.openai.com/v1/responses');
  assert.equal(providerRequest('openai-responses', 'https://api.openai.com', 'k', call).url, 'https://api.openai.com/v1/responses');
  assert.deepEqual(withTool.headers, { 'content-type': 'application/json', authorization: 'Bearer k' });
  assert.deepEqual(withTool.body, { model: 'm', instructions: 'S', input: [{ role: 'user', content: 'U' }], max_output_tokens: otherFormatOutputCap, store: false,
    tools: [{ type: 'function', name: 'submit_page_plan', description: '大纲', strict: responsesStrict, parameters: { type: 'object' } }], tool_choice: { type: 'function', name: 'submit_page_plan' } });
  assert.deepEqual(providerRequest('openai-responses', 'https://api.openai.com/v1', 'k', call).body.text, { format: { type: 'json_object' } });
  const done = providerReply('openai-responses', { status: 'completed', output: [{ type: 'reasoning' }, { type: 'function_call', name: 'submit_page_plan', arguments: '{"a":1}' }],
    usage: { input_tokens: 3, output_tokens: 6, total_tokens: 9, output_tokens_details: { reasoning_tokens: 4 } } }, 'submit_page_plan');
  assert.equal(done.finish, 'tool_calls'); assert.equal(done.toolArguments, '{"a":1}'); assert.deepEqual(done.usage, { promptTokens: 3, completionTokens: 6, totalTokens: 9, reasoningTokens: 4 });
  assert.equal(providerReply('openai-responses', { status: 'completed', output: [{ type: 'function_call', name: 'other', arguments: '{}' }] }, 'submit_page_plan').tool, false);
  assert.equal(providerReply('openai-responses', { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] }).finish, 'length');
  assert.equal(providerReply('openai-responses', { status: 'incomplete', incomplete_details: { reason: 'content_filter' }, output: [] }).finish, 'other');
  const text = providerReply('openai-responses', { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{"pages":[]}' }] }] });
  assert.equal(text.finish, 'stop'); assert.equal(text.content, '{"pages":[]}');
});

test('the Anthropic request uses the messages endpoint, its key header and a forced tool', () => {
  const withTool = providerRequest('anthropic', 'https://api.anthropic.com', 'k', { ...call, tool });
  assert.equal(withTool.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(providerRequest('anthropic', 'https://example.com/anthropic/v1/', 'k', call).url, 'https://example.com/anthropic/v1/messages');
  assert.deepEqual(withTool.headers, { 'content-type': 'application/json', 'x-api-key': 'k', 'anthropic-version': '2023-06-01' });
  assert.deepEqual(withTool.body, { model: 'm', max_tokens: otherFormatOutputCap, system: 'S', messages: [{ role: 'user', content: 'U' }],
    tools: [{ name: 'submit_page_plan', description: '大纲', input_schema: { type: 'object' } }], tool_choice: { type: 'tool', name: 'submit_page_plan' } });
  assert.deepEqual(Object.keys(providerRequest('anthropic', 'https://api.anthropic.com', 'k', call).body), ['model', 'max_tokens', 'system', 'messages']);
});

test('replies in the three formats reduce to the same four outcomes', () => {
  const fn = (name: string) => ({ content: null, tool_calls: [{ type: 'function', function: { name, arguments: '{"a":1}' } }] });
  const usage = { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 };
  const deepseek = providerReply('deepseek', { choices: [{ finish_reason: 'tool_calls', message: fn('submit_page_plan') }], usage }, 'submit_page_plan');
  assert.equal(deepseek.finish, 'tool_calls'); assert.equal(deepseek.toolArguments, '{"a":1}'); assert.deepEqual(deepseek.usage, { promptTokens: 3, completionTokens: 2, totalTokens: 5 });
  // DeepSeek keeps requiring its own finish reason; only OpenAI's forced call ends with "stop".
  assert.equal(providerReply('deepseek', { choices: [{ finish_reason: 'stop', message: fn('submit_page_plan') }] }, 'submit_page_plan').finish, 'stop');
  assert.equal(providerReply('openai', { choices: [{ finish_reason: 'stop', message: fn('submit_page_plan') }] }, 'submit_page_plan').finish, 'tool_calls');
  assert.equal(providerReply('openai', { choices: [{ finish_reason: 'stop', message: fn('other') }] }, 'submit_page_plan').tool, false);
  assert.equal(providerReply('openai', { choices: [{ finish_reason: 'length', message: { content: '{' } }] }).finish, 'length');
  const anthropic = providerReply('anthropic', { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'submit_page_plan', input: { a: 1 } }], usage: { input_tokens: 3, cache_read_input_tokens: 4, output_tokens: 2 } }, 'submit_page_plan');
  assert.equal(anthropic.finish, 'tool_calls'); assert.equal(anthropic.toolArguments, '{"a":1}'); assert.deepEqual(anthropic.usage, { promptTokens: 7, completionTokens: 2, totalTokens: 9 });
  assert.equal(providerReply('anthropic', { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'other', input: {} }] }, 'submit_page_plan').tool, false);
  assert.equal(providerReply('anthropic', { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'submit_page_plan', input: {} }, { type: 'tool_use', name: 'submit_page_plan', input: {} }] }, 'submit_page_plan').tool, false);
  assert.equal(providerReply('anthropic', { stop_reason: 'max_tokens', content: [{ type: 'text', text: '{' }] }).finish, 'length');
  const text = providerReply('anthropic', { stop_reason: 'end_turn', content: [{ type: 'text', text: '{"pages"' }, { type: 'text', text: ':[]}' }] });
  assert.equal(text.finish, 'stop'); assert.equal(text.content, '{"pages":[]}');
  assert.equal(providerReply('anthropic', { stop_reason: 'refusal', content: [] }).finish, 'other');
});

test('the format header is optional, defaults to DeepSeek, and rejects unknown values', () => {
  const request = (format?: string) => new Request('http://localhost/x', { headers: { 'x-sitecraft-provider-base': 'https://api.example.com/v1', 'x-sitecraft-provider-key': 'k', 'x-sitecraft-provider-model': 'm',
    ...(format === undefined ? {} : { 'x-sitecraft-provider-format': format }) } });
  assert.equal(providerFromRequest(request())?.format, 'deepseek');
  assert.equal(providerFromRequest(request('openai'))?.format, 'openai');
  assert.equal(providerFromRequest(request('anthropic'))?.format, 'anthropic');
  assert.equal(providerFromRequest(request('openai-responses'))?.format, 'openai-responses');
  assert.throws(() => providerFromRequest(request('gemini')), ProviderSettingsError);
});

// One stand-in answers all three formats with the same content. It proves the wire handling only, never generation quality.
const seen: Array<{ url: string | undefined; headers: IncomingHttpHeaders; body: Record<string, unknown> }> = [];
const server = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  if (req.url === '/landing') {
    seen.push({ url: req.url, headers: req.headers, body: {} });
    res.end('{}'); return;
  }
  const dialect = dialectOf(req.url), wire = JSON.parse(raw), body = toDeepSeekBody(dialect, wire), content = body.messages[1].content;
  seen.push({ url: req.url, headers: req.headers, body: wire });
  if (content.includes('FAIL404')) {
    res.writeHead(404, dialect === 'anthropic' ? { 'request-id': 'req-test-404' } : {});
    res.end(JSON.stringify({ error: { message: 'model not found' } })); return;
  }
  if (content.includes('REDIRECT')) { res.writeHead(307, { location: '/landing' }); res.end(); return; }
  const facts = body.messages[0].content.includes('事实校对员'), planCall = body.tools?.[0]?.function.name === 'submit_page_plan';
  let reply: unknown;
  if (facts && (content.includes('ZOD_EMPTY_ISSUE') || content.includes('ZOD_LONG_ISSUE') || content.includes('WITH_CITATION'))) {
    const input = JSON.parse(content.split('\n')[0]);
    const matchedQuote = input.sourceQuotes.find((q: { text: string }) => q.text.includes('按整期收费'))?.id ?? 'q1';
    const rawFacts = Object.fromEntries(input.segments.map((s: { id: string }, i: number) => {
      if (i === 0 && content.includes('ZOD_EMPTY_ISSUE')) return [s.id, { issues: [''], noFacts: true, factCategories: [], citations: [] }];
      if (i === 0 && content.includes('ZOD_LONG_ISSUE')) return [s.id, { issues: ['长'.repeat(501)], noFacts: true, factCategories: [], citations: [] }];
      if (i === 0 && content.includes('WITH_CITATION')) return [s.id, { issues: [], noFacts: false, factCategories: ['价格与收费'], citations: [{ category: '价格与收费', claimRef: `${s.id}c1`, quoteRef: matchedQuote }] }];
      return [s.id, { issues: [], noFacts: true, factCategories: [], citations: [] }];
    }));
    reply = { choices: [{ finish_reason: 'tool_calls', message: { content: null, tool_calls: [{ type: 'function', function: { name: 'submit_fact_review', arguments: JSON.stringify(rawFacts) } }] } }], usage: { prompt_tokens: 17, completion_tokens: 9, total_tokens: 26 } };
  } else {
    const payload = facts ? { issues: [] } : { summary: '首页介绍服务', style: 'precision', styleReason: '服务资料', skeletonId: 'compact-profile', skeletonReason: '简短服务资料。', pages: [{ id: 'home', title: '首页', outline: ['公司和服务'] }] };
    reply = factAuditPayload(body, { choices: [{ finish_reason: content.includes('TRUNCATED') ? 'length' : planCall ? 'tool_calls' : 'stop', message: planCall
      ? { content: null, tool_calls: [{ type: 'function', function: { name: content.includes('WRONGFN') ? 'other' : 'submit_page_plan', arguments: JSON.stringify(payload) } }] }
      : { content: JSON.stringify(factAuditReply(body, payload)) } }], usage: { prompt_tokens: 17, completion_tokens: 9, total_tokens: 26 } });
  }
  let text = JSON.stringify(fromDeepSeekReply(dialect, reply));
  // A repeated key inside the parsed tool input is only visible in the HTTP body.
  if (content.includes('DUPLICATE') && dialect === 'anthropic') text = text.replace('"noFacts":true', '"noFacts":true,"noFacts":true');
  res.setHeader('content-type', 'application/json'); res.end(text);
});
const restricted = new Set([1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697, 10080]);
for (let i = 0; i < 64; i++) {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  if (addr && typeof addr === 'object' && !restricted.has(addr.port)) break;
  await new Promise<void>(resolve => server.close(() => resolve()));
}
const address = server.address(); assert.ok(address && typeof address === 'object' && !restricted.has(address.port));
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
process.env.DEEPSEEK_API_KEY = 'format-fixture-secret'; process.env.DEEPSEEK_MODEL = 'format-fixture';
const model = await import('../lib/code-site-model.ts');
test.after(() => new Promise<void>(resolve => server.close(() => resolve())));
const prefs = { style: 'precision' as const, layout: 5, density: 6 };

for (const format of ['openai', 'openai-responses', 'anthropic'] as const) test(`${format}: plan and fact review pass through the shared checks, failures are refused without a retry`, async () => {
  process.env.AI_PROVIDER_FORMAT = format; seen.length = 0;
  const calls: import('../lib/code-site.ts').CodeModelCall[] = [];
  try {
    await model.codeModelCalls.run(calls, async () => {
      const plan = await model.planSiteCode('公司服务', prefs, '规划');
      assert.equal(plan.plan.pages[0].id, 'home');
      assert.deepEqual(await model.auditCodeFacts('公司服务', '公司服务'), []);
      await assert.rejects(model.planSiteCode('TRUNCATED', prefs, '规划'), /模型接口 回答被截断/);
      await assert.rejects(model.planSiteCode('WRONGFN', prefs, '规划'), /模型接口 未返回结构化页面大纲/);
      await assert.rejects(model.planSiteCode('FAIL404', prefs, '规划'), /模型接口 请求失败（HTTP 404，上游没有这个地址或模型，请核对 API 地址、接口格式和模型名）/);
      if (format === 'anthropic') await assert.rejects(model.auditCodeFacts('DUPLICATE 公司服务', 'DUPLICATE 公司服务'), /JSON 属性重复/);
    });
  } finally { delete process.env.AI_PROVIDER_FORMAT; }
  assert.equal(calls.length, format === 'anthropic' ? 6 : 5, 'one call per request, no retries');
  assert.ok(calls.every(call => call.format === format && !('thinking' in call)), 'the format is recorded and no thinking switch is claimed');
  assert.deepEqual(calls.slice(0, 2).map(call => call.usage?.totalTokens), [26, 26]);
  assert.deepEqual(calls.slice(0, 5).map(call => call.httpStatus), [200, 200, 200, 200, 404]);
  if (format === 'anthropic') {
    assert.equal(calls[4].httpError?.requestIdHeader, 'request-id');
    assert.equal(calls[4].httpError?.requestId, 'req-test-404');
  }
  assert.ok(seen.every(request => request.url === (format === 'anthropic' ? '/v1/messages' : format === 'openai-responses' ? '/v1/responses' : '/v1/chat/completions')));
  assert.ok(seen.every(request => !('thinking' in request.body) && !('temperature' in request.body)));
  if (format === 'anthropic') assert.ok(seen.every(request => request.headers['x-api-key'] === 'format-fixture-secret' && !request.headers.authorization && request.headers['anthropic-version'] === '2023-06-01'));
  else assert.ok(seen.every(request => request.headers.authorization === 'Bearer format-fixture-secret'));
  assert.doesNotMatch(JSON.stringify(calls), /format-fixture-secret/);
});

test('without AI_PROVIDER_FORMAT the same stand-in is asked in the DeepSeek format', async () => {
  seen.length = 0;
  const calls: import('../lib/code-site.ts').CodeModelCall[] = [];
  await model.codeModelCalls.run(calls, () => model.planSiteCode('公司服务', prefs, '规划'));
  assert.equal(seen[0].url, '/beta/chat/completions');
  assert.deepEqual(seen[0].body.thinking, { type: 'enabled' });
  assert.equal((calls[0] as { thinking?: string }).thinking, 'enabled'); assert.equal('format' in calls[0], false);
});

test('changing the API origin clears the key, changing only its path preserves it', () => {
  const settings = { baseURL: 'https://api.openai.com/v1', format: 'openai' as const, apiKey: 'fixture', model: 'm' };
  for (const address of ['https://api.anthropic.com', 'https://api.openai.com:8443', 'http://api.openai.com', '']) {
    assert.equal(withProviderAddress(settings, address).apiKey, '');
  }
  assert.equal(withProviderAddress(settings, 'https://API.OPENAI.COM:443/v1/custom').apiKey, settings.apiKey);
  assert.deepEqual(withProviderFormat(settings, 'anthropic'), { ...settings, baseURL: 'https://api.anthropic.com', apiKey: '', format: 'anthropic' });
  assert.deepEqual(withProviderFormat(settings, 'openai-responses'), { ...settings, format: 'openai-responses' });
  const gateway = { ...settings, baseURL: 'https://gateway.example/v1' };
  assert.deepEqual(withProviderFormat(gateway, 'anthropic'), { ...gateway, format: 'anthropic' });
});

test('local non-DeepSeek formats require an explicit address before starting a call', async t => {
  const originalBase = process.env.DEEPSEEK_BASE_URL!, otherBase = process.env.AI_BASE_URL;
  delete process.env.DEEPSEEK_BASE_URL; delete process.env.AI_BASE_URL;
  t.after(() => {
    process.env.DEEPSEEK_BASE_URL = originalBase;
    if (otherBase !== undefined) process.env.AI_BASE_URL = otherBase;
    delete process.env.AI_PROVIDER_FORMAT;
  });
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('unexpected fetch'); });
  for (const format of ['openai', 'openai-responses', 'anthropic']) {
    process.env.AI_PROVIDER_FORMAT = format;
    assert.equal(getAIProviderStatus().configured, false);
    await assert.rejects(model.planSiteCode('公司服务', prefs, '规划'), /还没有填写模型接口/);
  }
  assert.equal(fetch.mock.callCount(), 0);
  delete process.env.AI_PROVIDER_FORMAT;
  assert.equal(getAIProviderStatus().baseURL, 'https://api.deepseek.com');
});

test('local Anthropic calls stop at the first redirect', async t => {
  process.env.AI_PROVIDER_FORMAT = 'anthropic';
  t.after(() => { delete process.env.AI_PROVIDER_FORMAT; });
  seen.length = 0;
  await assert.rejects(model.planSiteCode('REDIRECT', prefs, '规划'));
  assert.deepEqual(seen.map(item => item.url), ['/v1/messages']);
});

test('writing accepts completed final text and refuses nonterminal or failed responses', async t => {
  const plan = { style: prefs.style, summary: '介绍服务', styleReason: '服务资料', pages: [{ id: 'home', title: '首页', outline: '服务' }] };
  const code = { header: '<header>服务</header>', footer: '<footer>服务</footer>', css: 'body{color:#111}', pages: [{ id: 'home', title: '首页', html: '<main>服务</main>' }] };
  const finalText = JSON.stringify(code);
  const message = (phase: string, text: string) => ({ type: 'message', phase, content: [{ type: 'output_text', text }] });
  const output = [message('commentary', '正在整理资料'), message('final_answer', finalText)];
  let reply: unknown;
  const fetch = t.mock.method(globalThis, 'fetch', () => Response.json(reply));
  const write = () => model.writeSiteCode({ materials: '公司服务', preferences: prefs, plan, images: [], request: '生成' });
  t.after(() => { delete process.env.AI_PROVIDER_FORMAT; });
  process.env.AI_PROVIDER_FORMAT = 'openai-responses';
  reply = { status: 'completed', output };
  assert.deepEqual((await write()).code, code);
  reply = { status: 'completed', output: [message('commentary', finalText)] };
  await assert.rejects(write(), /没有返回站点内容/);
  for (const status of ['failed', 'incomplete', 'in_progress']) {
    reply = { status, output };
    await assert.rejects(write(), /未正常结束/);
  }
  process.env.AI_PROVIDER_FORMAT = 'anthropic';
  for (const stop_reason of ['pause_turn', 'refusal']) {
    reply = { stop_reason, content: [{ type: 'text', text: finalText }] };
    await assert.rejects(write(), /未正常结束/);
  }
  assert.equal(fetch.mock.callCount(), 7);
});

test('a credential anywhere in a successful planning reply discards the raw message', async t => {
  process.env.AI_PROVIDER_FORMAT = 'anthropic';
  t.after(() => { delete process.env.AI_PROVIDER_FORMAT; });
  const body = JSON.stringify({ stop_reason: 'tool_use', content: [
    { type: 'text', text: process.env.DEEPSEEK_API_KEY },
    { type: 'tool_use', name: 'submit_page_plan', input: {} },
  ] });
  const fetch = t.mock.method(globalThis, 'fetch', () => new Response(body));
  const calls: CodeModelCall[] = [];
  await assert.rejects(model.codeModelCalls.run(calls, () => model.planSiteCode('公司服务', prefs, '规划')), /凭据/);
  assert.equal(fetch.mock.callCount(), 1);
  assert.deepEqual(calls[0].response?.rawBody, { bodyRedacted: true, bodyLength: body.length });
  assert.equal(calls[0].response?.rawMessage, undefined);
  assert.doesNotMatch(JSON.stringify(calls), /format-fixture-secret/);
});

test('split credential across multiple output parts is redacted in planning and writing (Responses & Anthropic)', async t => {
  const key = process.env.DEEPSEEK_API_KEY!;
  const planArgs = JSON.stringify({ summary: '介绍服务', style: 'precision', styleReason: '服务资料', skeletonId: 'compact-profile', skeletonReason: '简短资料。', pages: [{ id: 'home', title: '首页', outline: ['公司'] }] });
  const siteCode = { header: '<header>服务</header>', footer: '<footer>服务</footer>', css: 'body{color:#111}', pages: [{ id: 'home', title: '首页', html: '<main>服务</main>' }] };
  const splitSiteJson = JSON.stringify(siteCode).slice(0, -1) + `,"note":"${key.slice(0, 10)}`;
  let replyBody = '';
  const fetch = t.mock.method(globalThis, 'fetch', () => new Response(replyBody, { headers: { 'content-type': 'application/json' } }));
  const plan = { style: prefs.style, summary: '介绍服务', styleReason: '服务资料', pages: [{ id: 'home', title: '首页', outline: '服务' }] };
  const cases = [
    {
      format: 'openai-responses' as const,
      kind: 'plan' as const,
      body: JSON.stringify({ status: 'completed', output: [
        { type: 'message', content: [{ type: 'output_text', text: key.slice(0, 10) }, { type: 'output_text', text: key.slice(10) }] },
        { type: 'function_call', name: 'submit_page_plan', arguments: planArgs },
      ] }),
    },
    {
      format: 'openai-responses' as const,
      kind: 'write' as const,
      body: JSON.stringify({ status: 'completed', output: [
        { type: 'message', phase: 'final_answer', content: [{ type: 'output_text', text: splitSiteJson }, { type: 'output_text', text: `${key.slice(10)}"}` }] },
      ] }),
    },
    {
      format: 'anthropic' as const,
      kind: 'plan' as const,
      body: JSON.stringify({ stop_reason: 'tool_use', content: [
        { type: 'text', text: key.slice(0, 10) },
        { type: 'text', text: key.slice(10) },
        { type: 'tool_use', name: 'submit_page_plan', input: JSON.parse(planArgs) },
      ] }),
    },
    {
      format: 'anthropic' as const,
      kind: 'write' as const,
      body: JSON.stringify({ stop_reason: 'end_turn', content: [
        { type: 'text', text: JSON.stringify(siteCode).slice(0, -1) + `,"x":"${key.slice(0, 10)}` },
        { type: 'text', text: `${key.slice(10)}"}` },
      ] }),
    },
  ];
  try {
    for (const c of cases) {
      process.env.AI_PROVIDER_FORMAT = c.format;
      replyBody = c.body;
      const calls: CodeModelCall[] = [];
      const op = () => c.kind === 'plan'
        ? model.planSiteCode('公司服务', prefs, '规划')
        : model.writeSiteCode({ materials: '公司服务', preferences: prefs, plan, images: [], request: '生成' });
      await assert.rejects(model.codeModelCalls.run(calls, op), /凭据/);
      assert.equal(calls.length, 1);
      assert.deepEqual(calls[0].response?.rawBody, { bodyRedacted: true, bodyLength: c.body.length });
      assert.equal(calls[0].response?.rawMessage, undefined);
      assert.doesNotMatch(JSON.stringify(calls), new RegExp(key));
    }
  } finally {
    delete process.env.AI_PROVIDER_FORMAT;
  }
  assert.equal(fetch.mock.callCount(), 4);
});

test('escaped credential in non-2xx request-id header is redacted to [REDACTED]', async t => {
  const key = process.env.DEEPSEEK_API_KEY!;
  const escapedKey = [...key].map(ch => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`).join('');
  let headerName = 'x-request-id';
  let headerValue = escapedKey;
  t.mock.method(globalThis, 'fetch', () => new Response(JSON.stringify({ error: { message: 'bad request' } }), {
    status: 400,
    headers: { 'content-type': 'application/json', [headerName]: headerValue },
  }));
  const matrix: Array<{ format?: 'openai' | 'openai-responses' | 'anthropic'; header: string; val: string; expected: string }> = [
    { format: 'anthropic', header: 'request-id', val: escapedKey, expected: '[REDACTED]' },
    { format: 'anthropic', header: 'request-id', val: `pref-${escapedKey}-suf`, expected: '[REDACTED]' },
    { format: 'openai-responses', header: 'x-request-id', val: escapedKey, expected: '[REDACTED]' },
    { format: 'openai-responses', header: 'x-request-id', val: 'req_clean_123', expected: 'req_clean_123' },
    { header: 'x-ds-trace-id', val: escapedKey, expected: '[REDACTED]' },
    { header: 'x-request-id', val: `trace-${key}-end`, expected: 'trace-[REDACTED]-end' },
  ];
  try {
    for (const item of matrix) {
      if (item.format) process.env.AI_PROVIDER_FORMAT = item.format; else delete process.env.AI_PROVIDER_FORMAT;
      headerName = item.header;
      headerValue = item.val;
      const calls: CodeModelCall[] = [];
      await assert.rejects(model.codeModelCalls.run(calls, () => model.planSiteCode('公司服务', prefs, '规划')), /请求失败/);
      assert.equal(calls[0].httpError?.requestIdHeader, item.header);
      assert.equal(calls[0].httpError?.requestId, item.expected);
      assert.doesNotMatch(JSON.stringify(calls), new RegExp(key));
    }
  } finally {
    delete process.env.AI_PROVIDER_FORMAT;
  }
});

test('openai-responses refuses unfinished output items even when top-level status is completed', async t => {
  for (const status of ['incomplete', 'in_progress']) {
    const fnReply = providerReply('openai-responses', {
      status: 'completed',
      output: [{ type: 'function_call', status, name: 'submit_page_plan', arguments: '{"pages":[]}' }],
    }, 'submit_page_plan');
    assert.equal(fnReply.tool, false);
    assert.equal(fnReply.finish, 'other');

    const msgReply = providerReply('openai-responses', {
      status: 'completed',
      output: [{ type: 'message', status, phase: 'final_answer', content: [{ type: 'output_text', text: '{"header":"<header>a</header>"}' }] }],
    });
    assert.equal(msgReply.finish, 'other');
    assert.equal(msgReply.content, null);
  }
  const doneExplicit = providerReply('openai-responses', {
    status: 'completed',
    output: [{ type: 'function_call', status: 'completed', name: 'submit_page_plan', arguments: '{"a":1}' }],
  }, 'submit_page_plan');
  assert.equal(doneExplicit.finish, 'tool_calls');
  assert.equal(doneExplicit.tool, true);

  const plan = { style: prefs.style, summary: '介绍服务', styleReason: '服务资料', pages: [{ id: 'home', title: '首页', outline: '服务' }] };
  const code = { header: '<header>服务</header>', footer: '<footer>服务</footer>', css: 'body{color:#111}', pages: [{ id: 'home', title: '首页', html: '<main>服务</main>' }] };
  let itemStatus = 'incomplete';
  t.mock.method(globalThis, 'fetch', () => Response.json({
    status: 'completed',
    output: [{ type: 'message', status: itemStatus, phase: 'final_answer', content: [{ type: 'output_text', text: JSON.stringify(code) }] }],
  }));
  process.env.AI_PROVIDER_FORMAT = 'openai-responses';
  try {
    for (itemStatus of ['incomplete', 'in_progress']) {
      await assert.rejects(model.writeSiteCode({ materials: '公司服务', preferences: prefs, plan, images: [], request: '生成' }), /未正常结束/);
    }
  } finally {
    delete process.env.AI_PROVIDER_FORMAT;
  }
});

test('deepseek preserves 0eefc1f6 parity on trailing // baseURL and non-JSON 200 write/plan body', async t => {
  const originalBase = process.env.DEEPSEEK_BASE_URL!;
  let body = '{';
  const requestedUrls: string[] = [];
  t.mock.method(globalThis, 'fetch', (input: string | URL) => {
    requestedUrls.push(String(input));
    return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
  });
  try {
    process.env.DEEPSEEK_BASE_URL = 'https://provider.invalid//';
    const calls: CodeModelCall[] = [];
    await assert.rejects(model.codeModelCalls.run(calls, () => model.planSiteCode('公司服务', prefs, '规划')), SyntaxError);
    assert.equal(requestedUrls.at(-1), 'https://provider.invalid//beta/chat/completions');
    assert.equal('response' in calls[0], false);
    assert.equal(Object.keys(calls[0]).sort().join(','), 'httpStatus,latencyMs,model,purpose,skeletonOrder,startedAt,thinking,usage');

    // DeepSeek fact review on invalid JSON still retains safe rawBody and throws the existing Chinese message.
    process.env.DEEPSEEK_BASE_URL = 'https://provider.invalid/';
    const factCalls: CodeModelCall[] = [];
    await assert.rejects(model.codeModelCalls.run(factCalls, () => model.auditCodeFacts('公司服务', '公司服务')), /DeepSeek 事实核对回复不是完整 JSON/);
    assert.equal(requestedUrls.at(-1), 'https://provider.invalid/beta/chat/completions');
    assert.equal(factCalls[0].response?.rawBody?.body, '{');
  } finally {
    process.env.DEEPSEEK_BASE_URL = originalBase;
  }
});

test('withRequestProvider rejects request carrying only unknown X-SiteCraft-Provider-Format with 400', async () => {
  const { withRequestProvider } = await import('../lib/provider-context.ts');
  let ran = false;
  const badOnlyFormat = await withRequestProvider(
    new Request('http://127.0.0.1/', { headers: { 'x-sitecraft-provider-format': 'unknown' } }),
    async () => { ran = true; return new Response('ok'); },
  );
  assert.equal(badOnlyFormat.status, 400);
  assert.equal(ran, false);

  const validFormatMissingCreds = await withRequestProvider(
    new Request('http://127.0.0.1/', { headers: { 'x-sitecraft-provider-format': 'openai-responses' } }),
    async () => { ran = true; return new Response('ok'); },
  );
  assert.equal(validFormatMissingCreds.status, 400);
  assert.equal(ran, false);

  const emptyHeaders = await withRequestProvider(new Request('http://127.0.0.1/'), async () => { ran = true; return new Response('ok'); });
  assert.equal(emptyHeaders.status, 200);
  assert.equal(ran, true);
});

test('deepseek, openai and anthropic submit_fact_review requests carry $defs/$ref and enforce local Zod bounds', async () => {
  const categories = ['客户与合作方', '资质认证', '业绩与数量', '价格与收费', '时间与交期承诺', '效果', '评价'];
  const segs = [
    { text: '三门课程均为线下小班，按整期收费。', group: 'g1', context: { pageId: 'home', outline: [], headings: [] } },
    { text: '支持常规咨询与课程说明。', group: 'g2', context: { pageId: 'home', outline: [], headings: [] } },
  ];
  const makeSources = (marker: string) => [{
    type: 'message' as const,
    messageIndex: 1,
    text: `${marker}\n机构名：博思研习社\n三门课程均为线下小班，按整期收费。`,
  }];

  try {
    for (const format of ['deepseek', 'openai', 'anthropic'] as const) {
      if (format === 'deepseek') delete process.env.AI_PROVIDER_FORMAT;
      else process.env.AI_PROVIDER_FORMAT = format;
      seen.length = 0;

      const calls: CodeModelCall[] = [];
      const sources = makeSources('WITH_CITATION');
      const reviewed = await model.codeModelCalls.run(calls, () =>
        model.auditCodeFacts(sources[0].text, segs, false, 'precision', sources),
      );
      assert.equal(seen.length, 1);
      assert.equal(reviewed[0].citations[0].quote, '三门课程均为线下小班，按整期收费。');
      assert.match(reviewed[0].citations[0].claim, /按整期收费/);

      const req = seen.at(-1)!;
      assert.equal(req.url, format === 'anthropic' ? '/v1/messages' : format === 'openai' ? '/v1/chat/completions' : '/beta/chat/completions');
      const tools = req.body.tools as Array<Record<string, any>>;
      assert.equal(tools.length, 1);
      if (format !== 'anthropic') assert.equal(tools[0].function.strict, true);
      const schema = format === 'anthropic' ? tools[0].input_schema : tools[0].function.parameters;
      assert.doesNotMatch(JSON.stringify(schema), /"(?:pattern|minLength|maxLength|minItems|maxItems)"/);
      assert.deepEqual(schema.$defs?.category, { type: 'string', enum: categories });
      const expectedQuotes = calls[0].factInput!.sourceQuotes!.map(q => q.id);
      assert.ok(expectedQuotes.length >= 2);
      assert.deepEqual(schema.$defs?.quoteRef, { type: 'string', enum: expectedQuotes });

      for (const seg of calls[0].factInput!.segments) {
        const row = schema.properties[seg.id];
        assert.equal(row.additionalProperties, false);
        assert.deepEqual(row.properties.issues, { type: 'array', items: { type: 'string' } });
        assert.deepEqual(row.properties.factCategories, { type: 'array', items: { $ref: '#/$defs/category' } });
        assert.deepEqual(Object.keys(row.properties.factCategories.items), ['$ref']);
        const citProps = row.properties.citations.items.properties;
        assert.deepEqual(citProps.category, { $ref: '#/$defs/category' });
        assert.deepEqual(citProps.quoteRef, { $ref: '#/$defs/quoteRef' });
        assert.deepEqual(citProps.claimRef, { type: 'string', enum: seg.claims!.map(c => c.id) });
      }
      assert.ok(schema.properties.s1.properties.citations.items.properties.claimRef.enum.every((id: string) => id.startsWith('s1c')));
      assert.ok(schema.properties.s2.properties.citations.items.properties.claimRef.enum.every((id: string) => id.startsWith('s2c')));

      for (const badMarker of ['ZOD_EMPTY_ISSUE', 'ZOD_LONG_ISSUE']) {
        const badSources = makeSources(badMarker);
        const before: number = seen.length;
        await assert.rejects(
          model.auditCodeFacts(badSources[0].text, segs, false, 'precision', badSources),
          /核对段回复格式或编号无效/,
        );
        assert.equal(seen.length, before + 1, `${format} ${badMarker} must reject once without retry`);
      }
    }
  } finally {
    delete process.env.AI_PROVIDER_FORMAT;
  }
});
