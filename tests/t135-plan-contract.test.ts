import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { registerHooks, syncBuiltinESMExports } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

// Failure modes: a cached/canonical card order biases every request; the recorded
// order differs from the actual request; a misspelled card is accepted; raw Zod
// errors reach users; the model contract requires an avoidable nested skeleton;
// invalid JSON is repaired, validation is relaxed, or a failed call is retried.
registerHooks({ resolve(specifier, context, next) {
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });
const accepted = { summary: '先确认加工范围，再联系。', style: 'precision', styleReason: '来图加工资料。',
  skeletonId: 'capability-led', skeletonReason: '加工边界最厚；次选 process-journey，但资料未给工序先后。',
  pages: [{ id: 'home', title: '首页', outline: ['加工范围、设备、联系'] }] };
let reply: unknown = accepted;
const requests: Array<{ system: string; user: string; url: string; body: any }> = [];
let plainResponse = false;
const server = createServer(async (req, res) => {
  let text = ''; for await (const chunk of req) text += chunk;
  const body = JSON.parse(text); requests.push({ system: body.messages[0].content, user: body.messages[1].content, url: req.url!, body });
  res.setHeader('content-type', 'application/json');
  const structured = body.tools?.[0]?.function?.strict === true && !plainResponse;
  const content = typeof reply === 'string' ? reply : JSON.stringify(reply);
  res.end(JSON.stringify({ usage: { prompt_tokens: 17, completion_tokens: 9, total_tokens: 26 },
    choices: [{ finish_reason: structured ? 'tool_calls' : 'stop', message: structured
      ? { content: null, tool_calls: [{ id: 'fixture-plan', type: 'function', function: { name: 'submit_page_plan', arguments: content } }] }
      : { content } }] }));
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); assert.ok(address && typeof address === 'object');
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
process.env.DEEPSEEK_API_KEY = 't135-lightweight-fixture'; process.env.DEEPSEEK_MODEL = 't135-lightweight-fixture';
const { planSiteCode, codeModelCalls } = await import('../lib/code-site-model.ts');
const prefs = { style: 'precision' as const, layout: 5, density: 6 };
test.after(() => new Promise<void>(resolve => server.close(() => resolve())));

test('each plan shuffles the complete card set and records the actual request order', async () => {
  reply = accepted;
  let identity = false;
  const random = test.mock.method(crypto, 'randomInt', (max: number) => identity ? max - 1 : 0);
  syncBuiltinESMExports();
  const calls: import('../lib/code-site.ts').CodeModelCall[] = [];
  try {
    const first = await codeModelCalls.run(calls, () => planSiteCode('按图车削；材质不锈钢；检测设备。', prefs, '规划'));
    identity = true;
    const second = await codeModelCalls.run(calls, () => planSiteCode('按图车削；材质不锈钢；检测设备。', prefs, '规划'));
    assert.ok(first.plan.skeletonOrder, 'a valid plan must carry its card order');
    assert.notDeepEqual(first.plan.skeletonOrder, second.plan.skeletonOrder, 'a fresh randomness source must be used for every plan');
    for (const [index, result] of [first, second].entries()) {
      const wire = [...requests[index].system.matchAll(/^## ([a-z][a-z0-9-]+) /gm)].map(match => match[1]);
      assert.equal(wire.length, 8); assert.equal(new Set(wire).size, 8);
      assert.deepEqual(result.plan.skeletonOrder, wire, 'refresh metadata must reproduce the exact planning request order');
      assert.deepEqual(calls[index].skeletonOrder, wire, 'failed/successful call records must retain the actual order');
    }
  } finally { random.mock.restore(); syncBuiltinESMExports(); }
});
test('planning uses flat skeleton fields on the wire and preserves the domain choice', async () => {
  reply = accepted;
  const result = await planSiteCode('按图加工，范围明确。', prefs, '规划');
  assert.deepEqual(result.plan.skeleton, { id: accepted.skeletonId, reason: accepted.skeletonReason });
  const wire = requests.at(-1)!;
  assert.ok(wire.body.tools[0].function.parameters.properties.skeletonId && wire.body.tools[0].function.parameters.properties.skeletonReason);
  assert.doesNotMatch(wire.user, /"skeleton"\s*:\s*\{/);
  assert.equal(result.plan.pages[0].outline, accepted.pages[0].outline.join('；'));
});
test('a misspelled skeleton is rejected once with a short Chinese message', async () => {
  reply = { ...accepted, skeletonId: 'capabilty-led' };
  const before = requests.length;
  await assert.rejects(planSiteCode('加工资料', prefs, '规划'), { message: '页面骨架编号无效，请重新规划。' });
  assert.equal(requests.length, before + 1);
});
test('invalid outline fields and blank reasons use a short Chinese message', async () => {
  for (const invalid of [
    { ...accepted, pages: [{ id: 'home', title: '首页', outline: null }] },
    { ...accepted, skeletonReason: '   ' },
  ]) {
    reply = invalid;
    const before = requests.length;
    await assert.rejects(planSiteCode('加工资料', prefs, '规划'), { message: '页面大纲格式不正确，方案未保存。' });
    assert.equal(requests.length, before + 1);
  }
});
test('custom remains valid, and malformed JSON is refused without repair or retry', async () => {
  reply = { ...accepted, skeletonId: 'custom', skeletonReason: '单品无图短页；次选 compact-profile，但一项规格适合放中轴。' };
  assert.equal((await planSiteCode('单个产品', prefs, '规划')).plan.skeleton!.id, 'custom');
  reply = '{"skeletonId":"custom","pages":[]';
  const before = requests.length;
  await assert.rejects(planSiteCode('单个产品', prefs, '规划'), /不是完整 JSON/);
  assert.equal(requests.length, before + 1);
});
test('planning requires strict schema output, supported length patterns and a named function', async () => {
  reply = accepted;
  await planSiteCode('加工资料', prefs, '规划');
  const wire = requests.at(-1)!;
  assert.equal(wire.url, '/beta/chat/completions');
  assert.equal(wire.body.thinking.type, 'enabled');
  assert.equal(wire.body.tool_choice, 'auto');
  const fn = wire.body.tools[0].function;
  assert.equal(fn.strict, true); assert.equal(fn.name, 'submit_page_plan');
  const schema = fn.parameters;
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required.sort(), Object.keys(schema.properties).sort());
  assert.ok(schema.properties.skeletonId.enum.includes('custom'));
  assert.equal(schema.properties.skeletonReason.pattern, '^[\\s\\S]{1,300}$');
  assert.ok(!('maxLength' in schema.properties.skeletonReason), 'the provider does not support this keyword');
  assert.equal(schema.properties.pages.items.additionalProperties, false);
  assert.equal(schema.properties.pages.items.properties.outline.type, 'array');
});
test('strict planning never accepts a plain-content substitute, and the original reason limit remains', async () => {
  reply = accepted; plainResponse = true;
  const before = requests.length;
  try { await assert.rejects(planSiteCode('加工资料', prefs, '规划'), /结构化页面大纲/); }
  finally { plainResponse = false; }
  assert.equal(requests.length, before + 1);
  reply = { ...accepted, skeletonReason: '甲'.repeat(301) };
  await assert.rejects(planSiteCode('加工资料', prefs, '规划'), { message: '页面大纲格式不正确，方案未保存。' });
});
