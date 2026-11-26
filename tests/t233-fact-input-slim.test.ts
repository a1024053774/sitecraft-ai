import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import test from 'node:test';
import * as codeSiteModel from '../lib/code-site-model.ts';
import type { CodeFactSegment, CodeFactSource } from '../lib/code-site-fact-segments.ts';
import type { CodeModelCall } from '../lib/code-site.ts';

const { auditCodeFacts, codeFactAuditInput, codeModelCalls } = codeSiteModel;

const materials = [
  '资料性质：模拟。',
  '公司名：星河精密制造。',
  '交期：样品确认后 15 天内出货。',
].join('\n');

const extraFollowUp = '补充说明：标准件起订量 50 件。样品确认后 15 天内出货。';

const sources: CodeFactSource[] = [
  { type: 'message', messageIndex: 1, text: materials },
  { type: 'upload', sourceId: 'src-2', name: 'supply.txt', text: extraFollowUp },
];

const richSegments: CodeFactSegment[] = [
  {
    text: '产能<TR><TH>[scope=row]模具年产</TH><TD>约 180 套</TD></TR><TR><TH>[scope=row]月产能</TH><TD>约 600 万件</TD></TR>',
    group: 'cap',
    context: { pageId: 'home', headings: ['产能'], outline: ['产能表'] },
    targets: [
      { pageId: 'home', root: 'main', path: [0], text: '约 180 套' },
      { pageId: 'home', root: 'main', path: [1], text: '约 180 套', readable: '约 180 套' },
    ],
  },
  {
    text: '交期与起订\n样品确认后 15 天内出货。\n标准件起订量 50 件。',
    group: 'terms',
    context: { pageId: 'terms', headings: ['交期与起订'], outline: ['交易边界'] },
    members: [
      { kind: 'text', field: 'pages[0].html', path: [0], offset: 0, before: '', text: '样品确认后 15 天内出货。' },
      { kind: 'text', field: 'pages[0].html', path: [1], offset: 0, before: '', text: '标准件起订量 50 件。' },
    ],
  },
];

let replyMode: 'pass-dedup-quotes' | 'overlong-issue' | 'cross-segment' | 'unknown-quote' | 'duplicate-key' | 'no-facts-with-citation' = 'pass-dedup-quotes';
const wireBodies: any[] = [];

const server = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  wireBodies.push(body);
  const wireInput = JSON.parse(body.messages[1].content.split('\n')[0]);

  const resolveWireQuoteText = (q: any) => (
    q.sameAsMaterials ? wireInput.materials.trim()
      : q.sameTextAs ? wireInput.sourceQuotes.find((p: any) => p.id === q.sameTextAs)?.text
        : q.text
  );
  const quoteMatchExact = (needle: string) => wireInput.sourceQuotes.filter((q: any) => resolveWireQuoteText(q) === needle).at(-1);

  const qFullMat = wireInput.sourceQuotes.find((q: any) => q.sameAsMaterials);
  const qSecondLine = quoteMatchExact('样品确认后 15 天内出货。');
  const firstId = wireInput.segments[0]?.id ?? 's1';
  const secondId = wireInput.segments[1]?.id ?? 's2';

  const makeValidRow = (seg: any, idx: number) => idx === 1
    ? {
        issues: [],
        noFacts: false,
        factCategories: ['时间与交期承诺'],
        citations: [{
          category: '时间与交期承诺',
          claimRef: seg.claims.find((c: any) => c.text.includes('15 天内出货'))?.id ?? `${seg.id}c1`,
          quoteRef: (qSecondLine ?? qFullMat ?? wireInput.sourceQuotes[0]).id,
        }],
      }
    : { issues: [], noFacts: true, factCategories: [], citations: [] };

  let obj: Record<string, any> = Object.fromEntries(wireInput.segments.map((s: any, i: number) => [s.id, makeValidRow(s, i)]));
  if (replyMode === 'overlong-issue') obj[firstId].issues = ['x'.repeat(501)];
  if (replyMode === 'cross-segment') obj[firstId] = { issues: [], noFacts: false, factCategories: ['时间与交期承诺'], citations: [{ category: '时间与交期承诺', claimRef: `${secondId}c1`, quoteRef: wireInput.sourceQuotes[0].id }] };
  if (replyMode === 'unknown-quote') obj[secondId].citations[0].quoteRef = 'q99999';
  if (replyMode === 'no-facts-with-citation') obj[secondId] = { issues: [], noFacts: true, factCategories: ['时间与交期承诺'], citations: obj[secondId].citations };

  const argumentsText = replyMode === 'duplicate-key'
    ? `{${JSON.stringify(firstId)}:${JSON.stringify(obj[firstId])},${JSON.stringify(firstId)}:${JSON.stringify(obj[firstId])},${JSON.stringify(secondId)}:${JSON.stringify(obj[secondId])}}`
    : JSON.stringify(obj);

  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({
    choices: [{
      finish_reason: 'tool_calls',
      message: { content: null, tool_calls: [{ type: 'function', id: 'tc1', function: { name: 'submit_fact_review', arguments: argumentsText } }] },
    }],
    usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
  }));
});

await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const addr = server.address();
assert.ok(addr && typeof addr === 'object');
const prevEnv = { url: process.env.DEEPSEEK_BASE_URL, key: process.env.DEEPSEEK_API_KEY, model: process.env.DEEPSEEK_MODEL, format: process.env.AI_PROVIDER_FORMAT };
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${addr.port}`;
process.env.DEEPSEEK_API_KEY = 't233-fixture';
process.env.DEEPSEEK_MODEL = 'fixture';
delete process.env.AI_PROVIDER_FORMAT;
test.after(async () => {
  for (const [k, v] of [['DEEPSEEK_BASE_URL', prevEnv.url], ['DEEPSEEK_API_KEY', prevEnv.key], ['DEEPSEEK_MODEL', prevEnv.model], ['AI_PROVIDER_FORMAT', prevEnv.format]] as const) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  await new Promise<void>(resolve => server.close(() => resolve()));
});

test('T-233 lossless wire slimming omits claimTexts and verbatim duplicates while preserving allowed claimRef text sets', async () => {
  const fullInput = codeFactAuditInput(materials, richSegments, sources);
  const codeFactWireInput = (codeSiteModel as any).codeFactWireInput;
  assert.equal(typeof codeFactWireInput, 'function', 'codeFactWireInput must be exported from lib/code-site-model.ts');

  // Within every segment, claim texts are strictly deduplicated and unchanged before vs after wire transform.
  const wireInput = codeFactWireInput(fullInput);
  assert.equal(wireInput.segments.length, fullInput.segments.length);
  for (let i = 0; i < fullInput.segments.length; i++) {
    const fullTexts = fullInput.segments[i].claims.map((c: any) => c.text);
    assert.equal(new Set(fullTexts).size, fullTexts.length, 'segment claims must not contain verbatim duplicate strings');
    assert.deepEqual(wireInput.segments[i].claims, fullInput.segments[i].claims, 'allowed claimRef set and IDs must remain identical');
    assert.equal('claimTexts' in wireInput.segments[i], false, 'upstream wire segments must omit unused claimTexts');
    assert.ok(Array.isArray(fullInput.segments[i].claimTexts) && fullInput.segments[i].claimTexts.length > 0, 'local codeFactAuditInput retains claimTexts');
  }

  // Deduplication in sourceMaterials and sourceQuotes without losing any model-visible text.
  assert.equal(wireInput.materials, materials);
  assert.equal(wireInput.sourceMaterials[0].sameAsMaterials, true);
  assert.equal('text' in wireInput.sourceMaterials[0], false, 'sourceMaterials[0] verbatim equal to materials must omit duplicate text');
  assert.ok(wireInput.sourceMaterials[1].fullQuoteId || typeof wireInput.sourceMaterials[1].text === 'string');

  // Reconstruct every source quote text from wireInput and verify exact equivalence with fullInput.sourceQuotes.
  const wireQuotesById = new Map<string, any>(wireInput.sourceQuotes.map((q: any) => [q.id, q]));
  for (const fullQ of fullInput.sourceQuotes) {
    const wq = wireQuotesById.get(fullQ.id);
    assert.ok(wq, `missing wire quote ${fullQ.id}`);
    assert.equal(wq.sourceIndex, fullQ.sourceIndex);
    const resolved = wq.sameAsMaterials ? wireInput.materials.trim()
      : wq.sameTextAs ? wireQuotesById.get(wq.sameTextAs)?.text
        : wq.text;
    assert.equal(resolved, fullQ.text, `wire quote ${fullQ.id} must resolve losslessly to original source quote text`);
  }

  // Duplicate quote text appearing across sourceMaterials[0] and sourceMaterials[1] (e.g. '样品确认后 15 天内出货。') must be deduped.
  const duplicateQuotesInWire = wireInput.sourceQuotes.filter((q: any) => q.sameAsMaterials || q.sameTextAs);
  assert.ok(duplicateQuotesInWire.length >= 2, 'expected full-materials quote and cross-source repeated sentence quote to be deduped on wire');
  for (const dq of duplicateQuotesInWire) assert.equal('text' in dq, false);
});

test('T-233 keeps local Zod, full call.factInput snapshot, and T-210 quote/claim readback & rejection unchanged', async () => {
  replyMode = 'pass-dedup-quotes';
  wireBodies.length = 0;
  const calls: CodeModelCall[] = [];
  const res = await codeModelCalls.run(calls, () => auditCodeFacts(materials, richSegments, false, 'precision', sources));
  assert.equal(res[1].noFacts, false);
  assert.equal(res[1].citations[0].quote, '样品确认后 15 天内出货。');
  assert.ok(res[1].citations[0].claim.includes('15 天内出货'));
  assert.ok(Buffer.byteLength(JSON.stringify(wireBodies.at(-1)), 'utf8') < Buffer.byteLength(JSON.stringify(codeFactAuditInput(materials, richSegments, sources)), 'utf8') + 10000);
  // Local factInput snapshot keeps claimTexts & full claims for traceability/replay.
  assert.ok(Array.isArray(calls[0].factInput?.segments[0].claimTexts));
  // Prompt updated: mentions sameAsMaterials/sameTextAs resolution and does not reference claimTexts as active segment field.
  assert.match(wireBodies.at(-1).messages[0].content, /sameAsMaterials/);
  const wireSent = JSON.parse(wireBodies.at(-1).messages[1].content.split('\n')[0]);
  assert.equal('claimTexts' in wireSent.segments[0], false);

  for (const bad of ['overlong-issue', 'cross-segment', 'unknown-quote', 'duplicate-key', 'no-facts-with-citation'] as const) {
    replyMode = bad;
    const before = wireBodies.length;
    await assert.rejects(auditCodeFacts(materials, richSegments, false, 'precision', sources));
    assert.equal(wireBodies.length, before + 1, `${bad} must reject once without retry`);
  }
});
