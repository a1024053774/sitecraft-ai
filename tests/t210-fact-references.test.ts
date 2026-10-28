import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { auditCodeFacts, codeModelCalls } from '../lib/code-site-model.ts';

// The expected sentences and their owners are supplied independently. Valid
// identifiers cannot authorize a different segment, invented text or a bad fact.
const first = '三门课程均为线下小班，按整期收费。';
const second = '所有课程按整期收费，不设单次课散售。';
const source = { type: 'message' as const, messageIndex: 1, text: '机构名：博思研习社\n所有课程按整期收费，不设单次课散售。' };
let mode = 'valid';
const requests: any[] = [];
const server = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw); requests.push(body);
  const input = JSON.parse(body.messages[1].content.split('\n')[0]);
  const results = Object.fromEntries(input.segments.map((s: any, i: number) => [s.id, {
    issues: mode === 'semantic' ? ['页面原句：三门课程均为线下小班，按整期收费。；资料未提供小班人数。'] : [],
    noFacts: false, factCategories: ['价格与收费'], citations: [{ category: '价格与收费',
      claimRef: mode === 'cross-segment' && i === 0 ? 's2c1' : `${s.id}c1`,
      quoteRef: mode === 'unknown-source' ? 'q9999' : 'q2' }],
  }]));
  const argumentsText = mode === 'duplicate-key' ? '{"s1":' + JSON.stringify(results.s1) + ',"s1":' + JSON.stringify(results.s1) + ',"s2":' + JSON.stringify(results.s2) + '}' : JSON.stringify(results);
  const message = { content: null, tool_calls: [{ type: 'function', function: { name: 'submit_fact_review', arguments: argumentsText } }] };
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ choices: [{ finish_reason: mode === 'finish' ? 'stop' : 'tool_calls', message }], usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 } }));
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const addr = server.address(); assert.ok(addr && typeof addr === 'object');
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${addr.port}`;
process.env.DEEPSEEK_API_KEY = 't210-fixture'; process.env.DEEPSEEK_MODEL = 'fixture';
test.after(() => new Promise<void>(resolve => server.close(() => resolve())));
const segments = [first, second].map(text => ({ text, group: text, context: { pageId: 'courses', outline: [], headings: [] } }));
test('strict function binds citation choices to the current segment and recovers original source text', async () => {
  mode = 'valid'; const calls: any[] = [];
  const result = await codeModelCalls.run(calls, () => auditCodeFacts(source.text, segments, false, 'precision', [source]));
  assert.deepEqual(result.map(s => s.citations[0].claim), [first.normalize('NFKC'), second.normalize('NFKC')]);
  assert.deepEqual(result.map(s => s.citations[0].quote), [second, second]);
  assert.equal(requests.at(-1).tools[0].function.name, 'submit_fact_review');
  assert.equal(requests.at(-1).tools[0].function.strict, true);
  assert.ok(calls[0].factInput.sourceQuotes.length >= 2);
  const schema = requests.at(-1).tools[0].function.parameters;
  assert.deepEqual(schema.properties.s1.properties.citations.items.properties.claimRef.enum, ['s1c1']);
  await mkdir('artifacts/t210', { recursive: true });
  await writeFile('artifacts/t210/reference-roundtrip.json', JSON.stringify({ result, requests, calls }, null, 2));
});
for (const bad of ['cross-segment', 'unknown-source', 'finish', 'duplicate-key']) test(`reject ${bad} once without rewriting or saving`, async () => {
  mode = bad; const before = requests.length;
  await assert.rejects(auditCodeFacts(source.text, segments, false, 'precision', [source]));
  assert.equal(requests.length, before + 1);
});
test('a valid identifier does not turn a semantic rejection into a passed fact', async () => {
  mode = 'semantic';
  const result = await auditCodeFacts(source.text, segments, false, 'precision', [source]);
  assert.match(result[0].issues.join('\n'), /资料未提供小班人数/);
});
