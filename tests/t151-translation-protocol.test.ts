import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import test from 'node:test';
import type { CodeModelCall, SiteCode } from '../lib/code-site.ts';
import { englishFidelity } from '../lib/code-site-english.ts';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';

// Contract failures: translation still uses unconstrained message content; thinking
// is enabled; strict output has the wrong function/IDs or silently falls back;
// invalid/truncated replies are retried; source slots or paid failure evidence disappear.
// The original real response body was not saved. This fixture contains only the
// recorded input/metadata; the malformed response below is explicitly synthetic.
const fixture = JSON.parse(await readFile(new URL('./fixtures/t151-translation-observed-failure.json', import.meta.url), 'utf8'));
const dictionary: Record<string, string> = {
  '临港机械': '临港机械', '主导航': 'Main navigation', '首页': 'Home', '产品': 'Products',
  '临港机械 · 精密零件加工': '临港机械 · Precision parts machining',
  '精密零件加工': 'Precision parts machining', '按图加工轴套与接头。': 'Bushings and fittings machined to drawing.',
  '产品与加工': 'Products and machining', '产品型号 LG-A，尺寸 20 mm。': 'Model LG-A, size 20 mm.',
  '产品目录': 'Product catalogue', '查看产品': 'View products', '认证状态：待补充': 'Certification status: To be provided',
  '轴套与接头': 'Bushings and fittings', '按图加工。': 'Machined to drawing.', '产品型号': 'Model', '尺寸': 'Size',
  '资料要求': 'Drawing requirements', '图纸要求：待补充': 'Drawing requirements: To be provided',
};
const malformed = '{"translations":[{"id":"header:3:text","text":"临港机械"}';
const requests: Array<{ url: string; body: any; input: any }> = [];
let mode = 'normal';
const server = createServer(async (request, response) => {
  let raw = ''; for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw), input = JSON.parse(body.messages[1].content.split('\n')[0]);
  requests.push({ url: request.url!, body, input });
  if (mode === '402') { response.writeHead(402); response.end('{}'); return; }
  const strict = body.tools?.[0]?.function?.name === 'submit_english_translation' && body.tools[0].function.strict === true;
  const translations = input.slots.map((slot: { id: string; text: string }) => ({ id: slot.id, text: dictionary[slot.text] }));
  const argument = mode === 'malformed' ? malformed : JSON.stringify({ translations });
  const message = !strict || mode === 'plain' ? { content: mode === 'plain' ? JSON.stringify({ translations }) : malformed }
    : { content: null, tool_calls: [{ type: 'function', function: { name: mode === 'wrong-function' ? 'submit_page_plan' : 'submit_english_translation', arguments: argument } }] };
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify({ choices: [{ finish_reason: mode === 'length' ? 'length' : strict && mode !== 'plain' ? 'tool_calls' : 'stop', message }],
    usage: mode === 'expensive' ? { prompt_tokens: 29000, completion_tokens: 9, total_tokens: 29009 }
      : { prompt_tokens: 17, completion_tokens: 9, total_tokens: 26 } }));
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); assert.ok(address && typeof address === 'object');
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
process.env.DEEPSEEK_API_KEY = 'controlled-translation-protocol'; process.env.DEEPSEEK_MODEL = 'controlled-translation-protocol';
const { translateSiteCode, codeModelCalls } = await import('../lib/code-site-model.ts');
test.after(() => new Promise<void>(resolve => server.close(() => resolve())));

test('the saved source reconstructs 13 small slots for the recorded calls; raw responses are unavailable', () => {
  assert.equal(fixture.provenance.rawResponseAvailable, false);
  assert.deepEqual(fixture.calls.map((call: any) => [call.slotCount, call.sourceChars, call.maxTokens, call.usage.completionTokens, call.finishReason]),
    [[5, 24, 600, 80, 'stop'], [8, 58, 600, 147, 'stop']]);
  assert.ok(fixture.calls.every((call: any) => call.rawMessage === null));
  assert.match(fixture.failure, /不是完整 JSON/);
});

test('translation uses one strict named non-thinking function per real source batch, with complete input', async () => {
  mode = 'normal'; requests.length = 0;
  const calls: CodeModelCall[] = [];
  const result = await codeModelCalls.run(calls, () => translateSiteCode(fixture.sourceCode as SiteCode, fixture.companyName));
  assert.equal(requests.length, 3); assert.equal(calls.length, 3);
  assert.deepEqual(requests.map(request => [request.input.pageId, request.input.slots.length, request.input.slots.reduce((n: number, slot: any) => n + slot.text.length, 0)]), [[null, 5, 24], ['home', 8, 58], ['products', 7, 30]]);
  for (const [index, { body, input, url }] of requests.entries()) {
    assert.equal(url, '/beta/chat/completions'); assert.equal(body.thinking.type, 'disabled'); assert.equal(body.max_tokens, 600);
    assert.equal(body.response_format, undefined);
    assert.deepEqual(body.tool_choice, { type: 'function', function: { name: 'submit_english_translation' } });
    const schema = body.tools[0].function.parameters;
    assert.equal(body.tools[0].function.strict, true); assert.equal(schema.additionalProperties, false);
    assert.equal(schema.properties.translations.items.additionalProperties, false);
    assert.deepEqual(schema.properties.translations.items.properties.id.enum, input.slots.map((slot: any) => slot.id));
    const { slotMap, correctionRound, ...counts } = calls[index].translationInput!;
    assert.deepEqual(counts, { pageId: input.pageId, slotCount: input.slots.length, sourceChars: input.slots.reduce((n: number, slot: any) => n + slot.text.length, 0), maxTokens: 600 });
    assert.equal(correctionRound, 0);
    assert.deepEqual(slotMap!.map(slot => slot.id), Array.from({ length: input.slots.length }, (_, n) => `s${n + 1}`));
    assert.ok(slotMap!.every(slot => !/^s\d+$/.test(slot.domId)));
    assert.ok(calls[index].response?.rawMessage);
    assert.doesNotMatch(body.messages[1].content, /<main|<header|"css"/);
    assert.match(body.messages[0].content, /不得.*具体化|不把.*具体化/);
    assert.match(body.messages[0].content, /copper/);
    assert.match(body.messages[0].content, /dispatch/);
    assert.match(body.messages[0].content, /海外采购.*B2B|B2B.*海外采购/);
  }
  assert.equal(result.code.css, fixture.sourceCode.css);
  assert.match(result.code.pages[0].html, /Certification status: To be provided/);
  assert.match(result.code.pages[1].html, /Bushings and fittings/);
});

test('an English company name comes only from explicit material fields', async () => {
  mode = 'normal'; requests.length = 0;
  await translateSiteCode(fixture.sourceCode, fixture.companyName, [], 2, undefined, '介绍：Harbor Machinery makes parts.');
  assert.ok(requests.every(request => request.input.englishCompanyName === null));
  requests.length = 0;
  await translateSiteCode(fixture.sourceCode, fixture.companyName, [], 2, undefined, '英文公司名：Harbor Machinery');
  assert.ok(requests.length);
  assert.ok(requests.every(request => request.input.englishCompanyName === 'Harbor Machinery'));
});

for (const englishName of [null, 'Huaxing（Suzhou）Machinery']) test(`protected company punctuation survives translation: ${englishName ?? 'record name without English name'}`, async () => {
  mode = 'normal'; requests.length = 0;
  const name = '华星（苏州）机械有限公司', original = `公司：${name}，欢迎。`, translatedName = englishName ?? name;
  dictionary[name] = translatedName;
  dictionary[original] = `Company：${translatedName}，welcome。`;
  const source: SiteCode = { header: '', footer: '', css: '', pages: [{ id: 'home', title: name,
    html: `<main><h1>${name}</h1><p title="${name}" aria-label="${name}">${original}</p></main>` }] };
  const result = await translateSiteCode(source, name, [], 2, undefined, englishName ? `英文公司名：${englishName}` : '');
  assert.equal(requests.length, 1);
  assert.equal(result.code.pages[0].title, translatedName);
  assert.equal(result.code.pages[0].html, `<main><h1>${translatedName}</h1><p title="${translatedName}" aria-label="${translatedName}">Company:${translatedName},welcome.</p></main>`);
  const browser = await codeCheckBrowser();
  try { assert.deepEqual(await browser.evaluate(`(${englishFidelity.toString()})(${JSON.stringify(source)},${JSON.stringify(result.code)},${JSON.stringify(name)},${JSON.stringify(englishName ? `英文公司名：${englishName}` : '')})`), []); }
  finally { await browser.close(); }
});

for (const [failureMode, reason] of [['plain', /结构化英文译文/], ['wrong-function', /结构化英文译文/], ['malformed', /不是完整 JSON/], ['length', /截断/], ['402', /HTTP 402/]] as const) {
  test(`strict translation refuses ${failureMode} once and preserves failed output/usage`, async () => {
    mode = failureMode; requests.length = 0; const calls: CodeModelCall[] = [];
    await assert.rejects(codeModelCalls.run(calls, () => translateSiteCode(fixture.sourceCode, fixture.companyName)), reason);
    assert.equal(requests.length, 1); assert.equal(calls.length, 1);
    if (failureMode === '402') { assert.equal(calls[0].httpStatus, 402); assert.equal(calls[0].usage, null); }
    else {
      assert.deepEqual(calls[0].usage, { promptTokens: 17, completionTokens: 9, totalTokens: 26 });
      assert.ok(calls[0].response?.rawMessage);
      if (failureMode === 'malformed') assert.deepEqual(calls[0].response!.rawMessage, { content: null, tool_calls: [{ type: 'function', function: { name: 'submit_english_translation', arguments: malformed } }] });
    }
  });
}

test('an explicit translation budget refuses an unaffordable call before HTTP', async () => {
  mode = 'normal'; requests.length = 0; const calls: CodeModelCall[] = [];
  process.env.SITE_CODE_TRANSLATION_TOKEN_LIMIT = '1';
  try {
    await assert.rejects(codeModelCalls.run(calls, () => translateSiteCode(fixture.sourceCode, fixture.companyName)), /翻译用量.*上限.*未发送/);
    assert.equal(requests.length, 0); assert.equal(calls.length, 0);
  } finally { delete process.env.SITE_CODE_TRANSLATION_TOKEN_LIMIT; }
});

test('an approved output cap bounds the actual request and saved call metadata', async () => {
  mode = 'normal'; requests.length = 0; const calls: CodeModelCall[] = [];
  process.env.SITE_CODE_TRANSLATION_OUTPUT_LIMIT = '500';
  try {
    await codeModelCalls.run(calls, () => translateSiteCode(fixture.sourceCode, fixture.companyName));
    assert.ok(requests.length);
    assert.ok(requests.every(request => request.body.max_tokens === 500));
    assert.ok(calls.every(call => call.translationInput!.maxTokens === 500));
  } finally { delete process.env.SITE_CODE_TRANSLATION_OUTPUT_LIMIT; }
});

test('spent translation tokens stop the next batch while retaining its paid reply', async () => {
  mode = 'expensive'; requests.length = 0; const calls: CodeModelCall[] = [];
  process.env.SITE_CODE_TRANSLATION_TOKEN_LIMIT = '30000';
  try {
    await assert.rejects(codeModelCalls.run(calls, () => translateSiteCode(fixture.sourceCode, fixture.companyName)), /翻译用量.*上限.*未发送/);
    assert.equal(requests.length, 1); assert.equal(calls.length, 1);
    assert.equal(calls[0].usage!.totalTokens, 29009); assert.ok(calls[0].response!.rawMessage);
  } finally { delete process.env.SITE_CODE_TRANSLATION_TOKEN_LIMIT; }
});
