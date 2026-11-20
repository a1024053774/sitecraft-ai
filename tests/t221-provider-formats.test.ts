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
  const plain = providerRequest('deepseek', 'https://api.deepseek.com/', 'k', { ...call, thinking: undefined });
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
  const dialect = dialectOf(req.url), wire = JSON.parse(raw), body = toDeepSeekBody(dialect, wire), content = body.messages[1].content;
  seen.push({ url: req.url, headers: req.headers, body: wire });
  if (content.includes('FAIL404')) { res.writeHead(404); res.end(JSON.stringify({ error: { message: 'model not found' } })); return; }
  const facts = body.messages[0].content.includes('事实校对员'), planCall = body.tools?.[0]?.function.name === 'submit_page_plan';
  const payload = facts ? { issues: [] } : { summary: '首页介绍服务', style: 'precision', styleReason: '服务资料', skeletonId: 'compact-profile', skeletonReason: '简短服务资料。', pages: [{ id: 'home', title: '首页', outline: ['公司和服务'] }] };
  const reply = factAuditPayload(body, { choices: [{ finish_reason: content.includes('TRUNCATED') ? 'length' : planCall ? 'tool_calls' : 'stop', message: planCall
    ? { content: null, tool_calls: [{ type: 'function', function: { name: content.includes('WRONGFN') ? 'other' : 'submit_page_plan', arguments: JSON.stringify(payload) } }] }
    : { content: JSON.stringify(factAuditReply(body, payload)) } }], usage: { prompt_tokens: 17, completion_tokens: 9, total_tokens: 26 } });
  let text = JSON.stringify(fromDeepSeekReply(dialect, reply));
  // A repeated key inside the parsed tool input is only visible in the HTTP body.
  if (content.includes('DUPLICATE') && dialect === 'anthropic') text = text.replace('"noFacts":true', '"noFacts":true,"noFacts":true');
  res.setHeader('content-type', 'application/json'); res.end(text);
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); assert.ok(address && typeof address === 'object');
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
