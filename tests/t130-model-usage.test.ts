import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

registerHooks({ resolve(specifier, context, next) {
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });

// Isolated failure modes: omitted usage becomes zero; paid invalid JSON loses usage;
// HTTP 402 is retried; concurrent runs mix calls; fact-audit usage is omitted.
// This local provider fixture proves accounting only, never generation quality.
const server = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw), content = body.messages[1].content;
  if (content.includes('FAILNET')) { req.socket.destroy(); return; }
  if (content.includes('FAIL402')) { res.writeHead(402); res.end('{}'); return; }
  const payload = content.includes('INVALID') ? 'not json' : body.messages[0].content.includes('事实校对员') ? { issues: [] }
    : { summary: '首页介绍服务', style: 'precision', styleReason: '服务资料', skeletonId: 'compact-profile', skeletonReason: '简短服务资料。', pages: [{ id: 'home', title: '首页', outline: ['公司和服务'] }] };
  const planCall = !!body.tools, text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  res.end(JSON.stringify({ choices: [{ finish_reason: planCall ? 'tool_calls' : 'stop', message: planCall
    ? { content: null, tool_calls: [{ type: 'function', function: { name: 'submit_page_plan', arguments: text } }] }
    : { content: text } }],
    ...(!content.includes('NOUSAGE') ? { usage: { prompt_tokens: 17, completion_tokens: 9, total_tokens: 26 } } : {}) }));
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); assert.ok(address && typeof address === 'object');
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
process.env.DEEPSEEK_API_KEY = 'accounting-fixture-secret'; process.env.DEEPSEEK_MODEL = 'accounting-fixture';
const model = await import('../lib/code-site-model.ts');
test.after(() => new Promise<void>(resolve => server.close(() => resolve())));
test('model accounting preserves paid, failed, missing and concurrent usage', async () => {
  assert.ok('codeModelCalls' in model, 'model calls must expose run-scoped provider accounting');
  const calls: import('../lib/code-site.ts').CodeModelCall[] = [], other: import('../lib/code-site.ts').CodeModelCall[] = [];
  const prefs = { style: 'precision' as const, layout: 5, density: 6 };
  await Promise.all([
    model.codeModelCalls.run(calls, async () => {
      await model.planSiteCode('公司服务', prefs, '规划');
      await model.auditCodeFacts('公司服务', '公司服务');
      await assert.rejects(model.planSiteCode('INVALID', prefs, '规划'), /不是完整 JSON/);
      await assert.rejects(model.planSiteCode('FAIL402', prefs, '规划'), /HTTP 402/);
      await assert.rejects(model.planSiteCode('FAILNET', prefs, '规划'), /fetch failed/);
    }),
    model.codeModelCalls.run(other, () => model.planSiteCode('NOUSAGE', prefs, '规划')),
  ]);
  assert.equal(calls.length, 5, 'provider failures must produce one call each, without retries');
  assert.deepEqual(calls.map(c => c.purpose), ['plan', 'facts', 'plan', 'plan', 'plan']);
  assert.deepEqual(calls.map(c => c.usage?.totalTokens ?? null), [26, 26, 26, null, null]);
  assert.deepEqual(calls.map(c => c.httpStatus), [200, 200, 200, 402, null]);
  assert.equal(other.length, 1); assert.equal(other[0].usage, null);
  assert.ok(calls.every(c => c.latencyMs >= 0));
  assert.doesNotMatch(JSON.stringify(calls), /accounting-fixture-secret|Bearer|INVALID|FAIL402|NOUSAGE/);
});
