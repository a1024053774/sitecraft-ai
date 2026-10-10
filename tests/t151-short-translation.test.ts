import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import test from 'node:test';
import type { CodeModelCall } from '../lib/code-site.ts';

// Failure cases: long IDs leak into model input, DOM mappings are lost, an unknown
// ID overwrites copy, good translations are charged again, duplicate IDs are chosen
// arbitrarily, or omissions exceed the two-correction allowance.
const fixture = JSON.parse(await readFile(new URL('./fixtures/t151-translation-id-failure.json', import.meta.url), 'utf8'));
const original = fixture.observed.rawMessage;
const recorded = JSON.parse(original.tool_calls[0].function.arguments).translations;
const requests: any[] = [];
let mode = 'once';
const server = createServer(async (request, response) => {
  let raw = ''; for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw), input = JSON.parse(body.messages[1].content.split('\n')[0]);
  requests.push({ body, input });
  let message = structuredClone(original);
  if (input.slots[0]?.id === 's1' && requests.length === 1) {
    // Protocol adaptation only: preserve all recorded text and the actual bad ID.
    const rows = recorded.map((row: any, index: number) => ({ ...row,
      id: row.id === fixture.malformedSlot.returnedId ? row.id : `s${index + 1}` }));
    if (mode === 'duplicate') rows.push({ ...rows[0], text: 'Conflicting duplicate' });
    message.tool_calls[0].function.arguments = JSON.stringify({ translations: rows });
  } else if (requests.length > 1) {
    message.tool_calls[0].function.arguments = JSON.stringify({ translations: mode === 'exhausted' ? [] : input.slots.map((slot: any) => ({
      id: slot.id, text: recorded[Number(slot.id.slice(1)) - 1].text,
    })) });
  }
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify({ choices: [{ finish_reason: 'tool_calls', message }], usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 } }));
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); assert.ok(address && typeof address === 'object');
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
process.env.DEEPSEEK_API_KEY = 'short-id-fixture'; process.env.DEEPSEEK_MODEL = 'short-id-fixture';
const { translateSiteCode, codeModelCalls } = await import('../lib/code-site-model.ts');
test.after(() => new Promise<void>(resolve => server.close(() => resolve())));

function checkRequest(index: number, ids: string[]) {
  const { body, input } = requests[index];
  assert.deepEqual(input.slots.map((slot: any) => slot.id), ids);
  assert.ok(input.slots.every((slot: any) => Object.keys(slot).sort().join(',') === 'id,text'));
  assert.deepEqual(body.tools[0].function.parameters.properties.translations.items.properties.id.enum, ids);
  assert.equal(body.tools[0].function.strict, true); assert.equal(body.thinking.type, 'disabled');
  assert.doesNotMatch(body.messages[1].content, /page:home:|<main|"css"/);
}

test('the real malformed ID is supplemented once; the other 190 translations and DOM positions remain', async () => {
  mode = 'once'; requests.length = 0; const calls: CodeModelCall[] = [];
  const result = await codeModelCalls.run(calls, () => translateSiteCode(fixture.sourceCode, fixture.companyName));
  assert.equal(requests.length, 2); assert.equal(calls.length, 2);
  checkRequest(0, Array.from({ length: 191 }, (_, index) => `s${index + 1}`));
  checkRequest(1, ['s29']);
  assert.deepEqual(requests[1].input.slots, [{ id: 's29', text: '1–\u200b32 腔' }]);
  assert.deepEqual(calls[1].translationInput!.slotMap, [{ id: 's29', domId: 'page:home:131:text' }]);
  assert.equal(calls[1].translationInput!.correctionRound, 1);
  assert.equal(result.correctionRounds, 1);
  assert.equal(result.code.css, fixture.sourceCode.css);
  assert.doesNotMatch(result.code.pages[0].html, /1–\u200b32 腔/);
  // The recorded output has this phrase in the hero, specification, and description.
  assert.equal(result.code.pages[0].html.split('1–32 cavities').length - 1, 3);
  assert.equal(JSON.parse((calls[0].response!.rawMessage!.tool_calls as any)[0].function.arguments).translations[28].id, 'page:home:131');
});

test('two failed supplements stop without requesting the other 190 slots again', async () => {
  mode = 'exhausted'; requests.length = 0; const calls: CodeModelCall[] = [];
  await assert.rejects(codeModelCalls.run(calls, () => translateSiteCode(fixture.sourceCode, fixture.companyName)), /遗漏.*修正额度已用完/);
  assert.equal(requests.length, 3); assert.equal(calls.length, 3);
  checkRequest(1, ['s29']); checkRequest(2, ['s29']);
  assert.deepEqual(calls.map(call => call.translationInput!.correctionRound), [0, 1, 2]);
  assert.ok(calls.every(call => call.response!.rawMessage));
});

test('a duplicate is treated as unresolved copy; no arbitrary duplicate reaches the DOM', async () => {
  mode = 'duplicate'; requests.length = 0; const calls: CodeModelCall[] = [];
  const result = await codeModelCalls.run(calls, () => translateSiteCode(fixture.sourceCode, fixture.companyName));
  assert.equal(requests.length, 2); checkRequest(1, ['s1', 's29']);
  assert.equal(result.code.pages[0].title, 'Ninghai Precision Injection Molds P3T');
  assert.doesNotMatch(result.code.pages[0].html, /Conflicting duplicate/);
});
