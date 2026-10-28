import { factAuditPayload } from './fixtures/fact-audit-reply.ts';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { auditCodeFacts, codeModelCalls } from '../lib/code-site-model.ts';
import type { CodeModelCall } from '../lib/code-site.ts';
import type { CodeFactSource } from '../lib/code-site-fact-segments.ts';

// Replay the complete captured HTTP bodies and 59/40 input mappings. Before
// testing a prompt-only repair, retain the bad replies as rejection controls.
// Failure modes: concatenating separate claimTexts, structured issues, missing
// output types, and a prompt that requires context to be appended to a claim.
type Fixture = { name: string; source: string; siteId: string; materials: string; sourceMaterials: CodeFactSource[];
  factInput: NonNullable<CodeModelCall['factInput']>; rawBody: string };
const fixtures: Fixture[] = await Promise.all(['packaging', 'restaurant'].map(async name => ({ name,
  ...JSON.parse(await readFile(new URL(`./fixtures/t185/${name}.json`, import.meta.url), 'utf8')),
})));
const output = `artifacts/t185/protocol-${Date.now()}-${process.pid}`;
await mkdir(output, { recursive: true });
let reply = '', encode = false;
const requests: any[] = [];
const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(chunk);
  requests.push(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  const request = requests.at(-1);
  let payload = JSON.parse(reply);
  if (encode) {
    const input = JSON.parse(request.messages[1].content.split('\n')[0]);
    const data = JSON.parse(payload.choices[0].message.content);
    const normalize = (value: string) => value.normalize('NFKC').replace(/\s+/g, ' ').trim();
    // These are hand-approved semantic controls from the old captured response.
    // Choose a contained excerpt for the new finite-reference protocol; the
    // untouched bad responses above are never converted or repaired.
    for (const row of data.results) for (const citation of row.citations) {
      const segment = input.segments.find((segment: any) => segment.id === row.id);
      if (citation.claim !== rowClaims[row.id] && !segment.claims.some((claim: any) => normalize(claim.text) === normalize(citation.claim))) {
        const contained = segment.claims.filter((claim: any) => normalize(citation.claim).includes(normalize(claim.text))).sort((a: any, b: any) => b.text.length - a.text.length)[0];
        if (contained) citation.claim = contained.text;
      }
      if (!input.sourceQuotes.some((quote: any) => normalize(quote.text).includes(normalize(citation.quote)))) {
        const contained = input.sourceQuotes.filter((quote: any) => normalize(citation.quote).includes(normalize(quote.text))).sort((a: any, b: any) => b.text.length - a.text.length)[0];
        if (contained) citation.quote = contained.text;
      }
    }
    payload.choices[0].message.content = JSON.stringify(data);
  }
  res.setHeader('content-type', 'application/json'); res.end(encode ? JSON.stringify(factAuditPayload(request, payload)) : reply);
});
await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
const address = provider.address(); assert.ok(address && typeof address === 'object');
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
process.env.DEEPSEEK_API_KEY = 't185-fixture'; process.env.DEEPSEEK_MODEL = 'fixture';
test.after(() => new Promise<void>(resolve => provider.close(() => resolve())));

// Independent literal choices from the captured row text, not a production
// normalizer or the model's concatenated claims. The original context remains.
const rowClaims: Record<string, string> = {
  s25: '起订量 3000 个', s26: '交期 印刷文件及白样确认后 12–18 天',
  s32: '起订量 1000 个', s33: '交期 印刷文件及白样确认后 12–18 天',
  s38: '起订量 5000 个', s39: '交期 模具确认后 20–25 天',
};
function conformingReply(fixture: typeof fixtures[number]) {
  const wire = JSON.parse(fixture.rawBody), data = JSON.parse(wire.choices[0].message.content);
  if (fixture.name === 'packaging') {
    for (const row of data.results) if (rowClaims[row.id]) {
      const citation = row.citations.find((c: any) => c.category !== '资质认证');
      citation.claim = rowClaims[row.id];
    }
  } else {
    // A hand-authored string control. Production must never coerce the object.
    data.results[12].issues = ['页面原句：门店在杭州市拱墅区；资料只说明服务社区，未说明门店位于该区。'];
  }
  wire.choices[0].message.content = JSON.stringify(data);
  return JSON.stringify(wire);
}

for (const fixture of fixtures) for (const local of [false, true]) {
  const label = `${fixture.name}-${local ? 'local' : 'whole'}`;
  const run = (calls: CodeModelCall[]) => codeModelCalls.run(calls, () => auditCodeFacts(fixture.materials,
    fixture.factInput.segments.map(s => ({ text: s.text, group: s.groupId,
      context: { pageId: s.pageId, headings: s.headings, outline: [] } })), local, 'precision', fixture.sourceMaterials));

  test(`T-185 ${label}：真实坏回复仍拒收，一次调用且原文保留`, async () => {
    reply = fixture.rawBody; encode = false; requests.length = 0;
    const calls: CodeModelCall[] = [];
    await assert.rejects(run(calls), /结构化事实核对/);
    assert.equal(requests.length, 1); assert.equal(calls.length, 1);
    assert.equal(calls[0].response?.rawBody?.body, fixture.rawBody);
    assert.equal(calls[0].response?.finishReason, 'stop');
    assert.deepEqual(calls[0].factInput?.segments.map(({ claims: _claims, ...segment }) => segment), fixture.factInput.segments);
    assert.ok(calls[0].factInput?.sourceQuotes?.length);
    assert.deepEqual(calls[0].usage?.totalTokens, JSON.parse(fixture.rawBody).usage.total_tokens);
    await writeFile(`${output}/${label}-rejected.json`, JSON.stringify(calls, null, 2), 'utf8');
  });

  test(`T-185 ${label}：显式输出类型与上下文复制边界，合法对照不丢事实问题`, async () => {
    reply = conformingReply(fixture); encode = true; requests.length = 0;
    const calls: CodeModelCall[] = [];
    const reviewed = await run(calls);
    assert.equal(requests.length, 1); assert.equal(reviewed.length, fixture.name === 'packaging' ? 59 : 40);
    const request = requests[0], input = JSON.parse(request.messages[1].content.split('\n')[0]), prompt = request.messages[0].content;
    assert.deepEqual(input.segments.map(({ claims: _claims, ...segment }: any) => segment), fixture.factInput.segments, '不改输入、行边界或可复制范围来接纳旧坏 claim');
    if (fixture.name === 'packaging') {
      for (const [id, claim] of Object.entries(rowClaims)) {
        const i = input.segments.findIndex((s: any) => s.id === id);
        assert.ok(reviewed[i].citations.some(c => c.claim.includes(claim.normalize('NFKC')) && !c.claim.includes('\u0000') && c.source), `${id} 行内声明应按原资料验真`);
      }
      assert.match(prompt, /引用文字由程序从快照回读/);
      assert.match(prompt, /编号有效不等于语义通过/);
      assert.doesNotMatch(prompt, /claim 必须[^。]*包含声明所需的对象、条件与范围/);
    } else {
      assert.match(reviewed[12].issues.join('\n'), /资料只说明服务社区/);
      const schema = request.tools[0].function.parameters;
      const row = schema.properties[input.segments[12].id];
      assert.equal(row.properties.issues.type, 'array'); assert.equal(row.properties.issues.items.type, 'string');
      assert.equal(row.properties.citations.items.properties.claimRef.type, 'string');
      assert.deepEqual(row.properties.citations.items.properties.claimRef.enum, input.segments[12].claims.map((claim: any) => claim.id));
      assert.equal(row.additionalProperties, false);
      assert.deepEqual([...row.required].sort(), ['citations', 'factCategories', 'issues', 'noFacts']);
      assert.match(prompt, /issues[^\n]*字符串数组/);
    }
    assert.equal(request.response_format, undefined);
    assert.equal(request.tools[0].function.name, 'submit_fact_review');
    assert.equal(request.tools[0].function.strict, true);
    assert.equal(request.thinking.type, local ? 'disabled' : 'enabled');
    await writeFile(`${output}/${label}-contract.json`, JSON.stringify({ request, reviewed, calls }, null, 2), 'utf8');
  });
}
