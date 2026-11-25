import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import type { CodeFactSegment, CodeFactSource } from '../lib/code-site-fact-segments.ts';

registerHooks({ resolve(specifier, context, next) {
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });

const CATEGORIES = ['客户与合作方', '资质认证', '业绩与数量', '价格与收费', '时间与交期承诺', '效果', '评价'];

type RecordedRequest = {
  dialect: 'deepseek' | 'openai-responses';
  body: Record<string, any>;
};

let overrideReply: ((input: any) => { raw?: string; obj?: Record<string, any> }) | null = null;
const requests: RecordedRequest[] = [];

const server = createServer(async (req, res) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw);
  const dialect: RecordedRequest['dialect'] = req.url?.endsWith('/responses') ? 'openai-responses' : 'deepseek';
  requests.push({ dialect, body });

  const userText = dialect === 'openai-responses' ? String(body.input?.[0]?.content ?? '') : String(body.messages?.[1]?.content ?? '');
  const input = JSON.parse(userText.split('\n')[0]);
  const built = overrideReply ? overrideReply(input) : {
    obj: Object.fromEntries(input.segments.map((s: any) => [s.id, {
      issues: [],
      noFacts: true,
      factCategories: [],
      citations: [],
    }])),
  };
  const argumentsText = built.raw ?? JSON.stringify(built.obj);

  res.setHeader('content-type', 'application/json');
  if (dialect === 'openai-responses') {
    res.end(JSON.stringify({
      status: 'completed',
      output: [{ type: 'function_call', status: 'completed', name: 'submit_fact_review', arguments: argumentsText }],
      usage: { input_tokens: 50, output_tokens: 20, total_tokens: 70 },
    }));
    return;
  }
  res.end(JSON.stringify({
    choices: [{
      finish_reason: 'tool_calls',
      message: { content: null, tool_calls: [{ type: 'function', function: { name: 'submit_fact_review', arguments: argumentsText } }] },
    }],
    usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
  }));
});

const restricted = new Set([1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697, 10080]);
for (let i = 0; i < 64; i++) {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  if (addr && typeof addr === 'object' && !restricted.has(addr.port)) break;
  await new Promise<void>(resolve => server.close(() => resolve()));
}
const addr = server.address();
assert.ok(addr && typeof addr === 'object' && !restricted.has(addr.port));

const prevBase = process.env.DEEPSEEK_BASE_URL;
const prevKey = process.env.DEEPSEEK_API_KEY;
const prevModel = process.env.DEEPSEEK_MODEL;
const prevFormat = process.env.AI_PROVIDER_FORMAT;
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${addr.port}`;
process.env.DEEPSEEK_API_KEY = 't230-fixture-secret';
process.env.DEEPSEEK_MODEL = 't230-fixture-model';
delete process.env.AI_PROVIDER_FORMAT;

const { auditCodeFacts, codeModelCalls } = await import('../lib/code-site-model.ts');

test.after(async () => {
  overrideReply = null;
  if (prevBase !== undefined) process.env.DEEPSEEK_BASE_URL = prevBase; else delete process.env.DEEPSEEK_BASE_URL;
  if (prevKey !== undefined) process.env.DEEPSEEK_API_KEY = prevKey; else delete process.env.DEEPSEEK_API_KEY;
  if (prevModel !== undefined) process.env.DEEPSEEK_MODEL = prevModel; else delete process.env.DEEPSEEK_MODEL;
  if (prevFormat !== undefined) process.env.AI_PROVIDER_FORMAT = prevFormat; else delete process.env.AI_PROVIDER_FORMAT;
  await new Promise<void>(resolve => server.close(() => resolve()));
});

function makeSegment(text: string): CodeFactSegment {
  return { text, group: text, context: { pageId: 'home', outline: [], headings: [] } };
}

function makeLargeCase() {
  const quoteLines = Array.from({ length: 162 }, (_, i) => `第${i + 1}条来源说明：设备精度公差为正负${i + 1}微米，仅适用标准工序。`);
  const source: CodeFactSource = { type: 'message', messageIndex: 1, text: `公司名：精工测试有限公司\n${quoteLines.join('\n')}` };
  const segments: CodeFactSegment[] = Array.from({ length: 81 }, (_, i) =>
    makeSegment(`精工测试有限公司第${i + 1}工段交付说明。支持双工序检测第${i + 1}项。执行标准批次${i + 1}与验收第${i + 1}条。`),
  );
  return { source, segments };
}

function schemaFromRequest(entry: RecordedRequest) {
  return entry.dialect === 'openai-responses'
    ? entry.body.tools[0].parameters
    : entry.body.tools[0].function.parameters;
}

for (const format of ['deepseek', 'openai-responses'] as const) {
  test(`${format}: submit_fact_review uses $defs/$ref, omits length regexes, isolates claimRef, and stays <70KB at 81 segments`, async () => {
    requests.length = 0;
    overrideReply = null;
    if (format === 'deepseek') delete process.env.AI_PROVIDER_FORMAT;
    else process.env.AI_PROVIDER_FORMAT = 'openai-responses';
    try {
      const twoSegs = [
        makeSegment('所有课程按整期收费，不设单次课散售。'),
        makeSegment('设备通过认证校验并按季度维护。'),
      ];
      const twoSources: CodeFactSource[] = [{
        type: 'message',
        messageIndex: 1,
        text: '机构名：测试研习社\n所有课程按整期收费，不设单次课散售。',
      }];
      const calls: any[] = [];
      await codeModelCalls.run(calls, () => auditCodeFacts(twoSources[0].text, twoSegs, false, 'precision', twoSources));

      const req2 = requests.at(-1)!;
      const schema2 = schemaFromRequest(req2);
      const serialized2 = JSON.stringify(schema2);
      assert.doesNotMatch(serialized2, /"(?:pattern|minLength|maxLength|minItems|maxItems)"/);
      assert.deepEqual(schema2.$defs?.category, { type: 'string', enum: CATEGORIES });
      const expectedQuoteIds = calls[0].factInput.sourceQuotes.map((q: any) => q.id);
      assert.ok(expectedQuoteIds.length >= 2);
      assert.deepEqual(schema2.$defs?.quoteRef, { type: 'string', enum: expectedQuoteIds });

      for (const seg of calls[0].factInput.segments) {
        const row = schema2.properties[seg.id];
        assert.equal(row.additionalProperties, false);
        assert.deepEqual(row.required, ['issues', 'noFacts', 'factCategories', 'citations']);
        assert.deepEqual(row.properties.issues, { type: 'array', items: { type: 'string' } });
        assert.deepEqual(row.properties.noFacts, { type: 'boolean' });
        assert.deepEqual(row.properties.factCategories, { type: 'array', items: { $ref: '#/$defs/category' } });
        assert.deepEqual(Object.keys(row.properties.factCategories.items), ['$ref']);
        const citProps = row.properties.citations.items.properties;
        assert.deepEqual(citProps.category, { $ref: '#/$defs/category' });
        assert.deepEqual(citProps.quoteRef, { $ref: '#/$defs/quoteRef' });
        assert.deepEqual(citProps.claimRef, { type: 'string', enum: seg.claims.map((c: any) => c.id) });
      }
      assert.ok(schema2.properties.s1.properties.citations.items.properties.claimRef.enum.every((id: string) => id.startsWith('s1c')));
      assert.ok(schema2.properties.s2.properties.citations.items.properties.claimRef.enum.every((id: string) => id.startsWith('s2c')));

      const { source: largeSource, segments: largeSegments } = makeLargeCase();
      const largeCalls: any[] = [];
      const largeResult = await codeModelCalls.run(largeCalls, () => auditCodeFacts(largeSource.text, largeSegments, false, 'precision', [largeSource]));
      assert.equal(largeResult.length, 81);
      const largeSchema = schemaFromRequest(requests.at(-1)!);
      const largeSerialized = JSON.stringify(largeSchema);
      assert.ok(largeCalls[0].factInput.sourceQuotes.length >= 163);
      assert.doesNotMatch(largeSerialized, /"(?:pattern|minLength|maxLength|minItems|maxItems)"/);
      assert.ok(largeSerialized.length < 70000, `81-segment schema serialized length ${largeSerialized.length} must be < 70000`);
      assert.equal(largeSchema.$defs.quoteRef.enum.length, largeCalls[0].factInput.sourceQuotes.length);
    } finally {
      delete process.env.AI_PROVIDER_FORMAT;
      overrideReply = null;
    }
  });
}

test('local Zod and T-210 protocol checks reject invalid fact audit outputs immediately without retrying', async () => {
  const segs = [
    makeSegment('三门课程均为线下小班，按整期收费。'),
    makeSegment('所有课程按整期收费，不设单次课散售。'),
  ];
  const src: CodeFactSource = {
    type: 'message',
    messageIndex: 1,
    text: '机构名：博思研习社\n所有课程按整期收费，不设单次课散售。',
  };
  const baseRow = () => ({ issues: [] as string[], noFacts: true, factCategories: [] as string[], citations: [] as any[] });
  const cases: Array<{ name: string; make: (input: any) => { raw?: string; obj?: Record<string, any> } }> = [
    { name: 'empty issue string', make: () => ({ obj: { s1: { ...baseRow(), issues: [''] }, s2: baseRow() } }) },
    { name: 'issue over 500 chars', make: () => ({ obj: { s1: { ...baseRow(), issues: ['长'.repeat(501)] }, s2: baseRow() } }) },
    { name: 'more than 40 issues', make: () => ({ obj: { s1: { ...baseRow(), issues: Array.from({ length: 41 }, (_, i) => `问题${i}`) }, s2: baseRow() } }) },
    { name: 'duplicate category', make: () => ({ obj: { s1: { issues: [], noFacts: false, factCategories: ['价格与收费', '价格与收费'], citations: [] }, s2: baseRow() } }) },
    { name: 'more than 100 citations', make: () => ({ obj: { s1: { issues: [], noFacts: false, factCategories: ['价格与收费'], citations: Array.from({ length: 101 }, () => ({ category: '价格与收费', claimRef: 's1c1', quoteRef: 'q2' })) }, s2: baseRow() } }) },
    { name: 'extra property on row', make: () => ({ obj: { s1: { ...baseRow(), extra: 1 }, s2: baseRow() } }) },
    { name: 'cross-segment claimRef', make: () => ({ obj: { s1: { issues: [], noFacts: false, factCategories: ['价格与收费'], citations: [{ category: '价格与收费', claimRef: 's2c1', quoteRef: 'q2' }] }, s2: baseRow() } }) },
    { name: 'unknown quoteRef', make: () => ({ obj: { s1: { issues: [], noFacts: false, factCategories: ['价格与收费'], citations: [{ category: '价格与收费', claimRef: 's1c1', quoteRef: 'q9999' }] }, s2: baseRow() } }) },
    { name: 'duplicate JSON segment key', make: () => ({ raw: `{"s1":${JSON.stringify(baseRow())},"s1":${JSON.stringify(baseRow())},"s2":${JSON.stringify(baseRow())}}` }) },
  ];

  for (const format of ['deepseek', 'openai-responses'] as const) {
    if (format === 'deepseek') delete process.env.AI_PROVIDER_FORMAT;
    else process.env.AI_PROVIDER_FORMAT = 'openai-responses';
    try {
      for (const item of cases) {
        overrideReply = item.make;
        const before = requests.length;
        await assert.rejects(auditCodeFacts(src.text, segs, false, 'precision', [src]), /核对段|资料出处/);
        assert.equal(requests.length, before + 1, `${format} ${item.name} must reject once without retry`);
      }
    } finally {
      delete process.env.AI_PROVIDER_FORMAT;
      overrideReply = null;
    }
  }
});
