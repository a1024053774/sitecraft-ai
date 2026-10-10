import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import test from 'node:test';
import type { SiteCode } from '../lib/code-site.ts';

// Risks: full-page repair changes accepted text; missing current text or reasons
// hide the actual defect; a bad path silently repairs the wrong paragraph.
const original = JSON.parse(await readFile(new URL('./fixtures/t151-fidelity-real-response.json', import.meta.url), 'utf8'));
const fixture = JSON.parse(await readFile(new URL('./fixtures/t151-rejected-paragraphs.json', import.meta.url), 'utf8'));
const rows = JSON.parse(fixture.rawMessage.tool_calls[0].function.arguments).translations;
const translations = fixture.slotMap.map((slot: any) => ({ id: slot.domId, text: rows.find((row: any) => row.id === slot.id).text }));
const rejected = fixture.pairs.find((row: any) => row.before.includes('全检'));
const answer = 'Full inspection of appearance and function, with sampling inspection before shipment and an inspection report attached.';
const requests: any[] = [];
const server = createServer(async (request, response) => {
  let raw = ''; for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw), input = JSON.parse(body.messages[1].content.split('\n')[0]);
  requests.push({ body, input });
  const output = input.slots.map((slot: any) => ({ id: slot.id, text: slot.text === rejected.before ? answer : rows.find((row: any) => row.id === slot.id).text }));
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify({ choices: [{ finish_reason: 'tool_calls', message: { tool_calls: [{ type: 'function', function: { name: 'submit_english_translation', arguments: JSON.stringify({ translations: output }) } }] } }], usage: { prompt_tokens: 20, completion_tokens: 30, total_tokens: 50 } }));
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); assert.ok(address && typeof address === 'object');
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
process.env.DEEPSEEK_API_KEY = 'controlled-paragraph-repair';
process.env.DEEPSEEK_MODEL = 'controlled-paragraph-repair';
const { englishText } = await import('../lib/code-site-english.ts');
const current = (await englishText(original.sourceCode, translations)).code;
const { translateSiteCode } = await import('../lib/code-site-model.ts');
test.after(() => new Promise<void>(resolve => server.close(() => resolve())));

test('saved real rejection sends only its original, current translation and reason', async () => {
  requests.length = 0;
  const result = await translateSiteCode(original.sourceCode, fixture.companyName, [rejected.issue], 1, current);
  assert.equal(requests.length, 1);
  const { input, body } = requests[0];
  assert.equal(input.slots.length, 1);
  assert.deepEqual(input.slots.map(({ text, currentText, issues }: any) => ({ text, currentText, issues })), [{ text: rejected.before, currentText: rejected.after, issues: [rejected.issue] }]);
  assert.deepEqual(body.tools[0].function.parameters.properties.translations.items.properties.id.enum, input.slots.map((slot: any) => slot.id));
  assert.match(body.messages[0].content, /不得出现原文没有的数字/);
  assert.equal(result.code.css, current.css);
  assert.deepEqual(result.code, { ...current, pages: current.pages.map((page: any) => ({ ...page, html: page.html.replace(rejected.after, answer) })) });
});

test('unlocated rejection fails before HTTP rather than retranslating the page', async () => {
  requests.length = 0;
  await assert.rejects(translateSiteCode(original.sourceCode as SiteCode, fixture.companyName, ['英文版 CSS 必须与中文版一致'], 1, current), /无法定位/);
  assert.equal(requests.length, 0);
});
