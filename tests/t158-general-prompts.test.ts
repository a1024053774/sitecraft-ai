import { factAuditPayload } from './fixtures/fact-audit-reply.ts';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { auditCodeFacts, planSiteCode, translateSiteCode, writeSiteCode } from '../lib/code-site-model.ts';
import type { CodeFactSegment } from '../lib/code-site-fact-segments.ts';

// Request-contract evidence only. The fixture does not judge factual truth or design.
// Failure modes and independent acceptance terms are recorded in T-158 before edits.
assert.ok(process.env.SITECRAFT_BASE, 'Set SITECRAFT_BASE to this worktree server');
const requests: any[] = [];
const code = { header: '', footer: '', css: 'body{color:#222;background:#fff}', pages: [{ id: 'home', title: '首页', html: '<main><h1>杏里小馆</h1><p>周日不营业</p></main>' }] };
const server = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw); requests.push(body);
  const user = body.messages[1].content;
  const input = user.startsWith('{') ? JSON.parse(user.split('\n')[0]) : null;
  const tool = body.tools?.[0]?.function.name;
  const answer = tool === 'submit_page_plan'
    ? { summary: '展示已有业务。', style: user.match(/style 必须填 ([a-z]+)/)[1], styleReason: '用户选择。', skeletonId: 'custom', skeletonReason: '业务资料支持短页。', pages: [{ id: 'home', title: '首页', outline: ['按业务介绍'] }] }
    : tool === 'submit_english_translation'
      ? { translations: input.slots.map((slot: any) => ({ id: slot.id, text: slot.text === '首页' ? 'Home' : slot.text === '周日不营业' ? 'Closed on Sundays' : slot.text })) }
      : input?.segments ? { results: input.segments.map((s: any) => ({ id: s.id, issues: [], noFacts: true, factCategories: [], citations: [] })) }
        : body.messages[0].content.includes('局部事实校对员') ? { issues: [] } : code;
  const message = tool ? { tool_calls: [{ type: 'function', function: { name: tool, arguments: JSON.stringify(answer) } }] } : { content: JSON.stringify(answer) };
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(factAuditPayload(body, { choices: [{ finish_reason: tool ? 'tool_calls' : 'stop', message }] })));
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); assert.ok(address && typeof address === 'object');
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
process.env.DEEPSEEK_API_KEY = 'local-fixture-only'; process.env.DEEPSEEK_MODEL = 'local-fixture-only';
test.after(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  const folder = path.resolve('artifacts/t158', `request-contract-${crypto.randomUUID()}`);
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, 'requests.json'), JSON.stringify(requests, null, 2), 'utf8');
  console.log(`Request evidence: ${folder}`);
});

const claims = ['无痛治疗', '包教包会', '当天出餐'];
const materials = `资料性质：模拟。\n公司名：杏里小馆\n业务：只按已提供的内容展示。\n营业安排：周日不营业。\n尾部资料：${crypto.randomUUID()}`;
function generalAudit(system: string) {
  // Terms come from the T-158 acceptance request, not the implementation.
  for (const term of ['价格', '时间', '资质', '承诺', '效果', '客户', '评价']) assert.ok(system.includes(term), `Missing general audit category: ${term}`);
  assert.match(system, /没有数字/);
  assert.match(system, /资料.*原句/);
  assert.match(system, /拒收/);
  for (const claim of claims) assert.ok(!system.includes(claim), 'No sample-specific exception list');
}

test('whole-site audit sends general claim rules and preserves unsupported claims, groups and source boundaries', async () => {
  const segments: CodeFactSegment[] = claims.map((text, i) => ({ text, group: i < 2 ? 'same-section' : 'other-section', context: { pageId: 'home', headings: ['服务说明'], outline: ['已有业务与条件'] } }));
  await auditCodeFacts(materials, segments);
  const body = requests.at(-1), input = JSON.parse(body.messages[1].content.split('\n')[0]);
  assert.equal(input.materials, materials);
  assert.deepEqual(input.segments.map(({ claims: _claims, ...segment }: any) => segment), claims.map((text, i) => ({ id: `s${i + 1}`, text, claimTexts: [text], groupId: i < 2 ? 'g1' : 'g2', pageId: 'home', headings: ['服务说明'] })));
  assert.deepEqual(input.pageContexts, [{ pageId: 'home', outline: ['已有业务与条件'] }]);
  for (const claim of claims) assert.ok(!input.materials.includes(claim));
  generalAudit(body.messages[0].content);
});

test('local audit sends only new copy with the same general claim categories and non-thinking mode', async () => {
  const readable = `新段落：${claims.join('；')}。辅助文案：仅此段。`;
  await auditCodeFacts(materials, readable, true);
  const body = requests.at(-1);
  assert.equal(body.thinking.type, 'disabled');
  const input = JSON.parse(body.messages[1].content.split('\n')[0]);
  assert.equal(input.materials, materials, '结构化核对仍保留资料原文');
  assert.deepEqual(input.segments.map((segment: { text: string }) => segment.text), [readable], '只核新段，不扩到整站');
  assert.match(body.messages[0].content, /不要求本段包含公司全名/);
  generalAudit(body.messages[0].content);
});

test('planning and writing load a material-led identity for each existing style without industrial visitor assumptions', async () => {
  for (const style of ['precision', 'documentary', 'editorial'] as const) {
    const preferences = { style, layout: 5, density: 6 };
    const { plan } = await planSiteCode(materials, preferences, '只做首页');
    const planned = requests.at(-1);
    await writeSiteCode({ materials, preferences, plan, images: [], request: '保留现有事实' });
    for (const body of [planned, requests.at(-1)]) {
      const system = body.messages[0].content;
      assert.match(system, /中小企业与机构/);
      assert.doesNotMatch(system, /采购工程师|OEM 采购|贸易商|工业企业的产品画册|对车间有信心的工厂/);
      assert.ok(body.messages[1].content.includes(materials));
      assert.match(system, /不生成表单、提交入口或收件功能/);
      assert.match(system, /保留单位、条件、否定、数量/);
    }
  }
});

test('English translation uses business context without changing short IDs, literal copy or strict non-thinking transport', async () => {
  const before = requests.length;
  await translateSiteCode(code, '杏里小馆', [], 2, undefined, materials);
  const sent = requests.slice(before); assert.equal(sent.length, 1);
  const body = sent[0], input = JSON.parse(body.messages[1].content.split('\n')[0]);
  assert.deepEqual(input.slots.map((slot: any) => slot.id), ['s1', 's2', 's3']);
  assert.deepEqual(input.slots.map((slot: any) => slot.text).sort(), ['首页', '杏里小馆', '周日不营业'].sort());
  assert.equal(body.thinking.type, 'disabled');
  assert.equal(body.tools[0].function.strict, true);
  assert.doesNotMatch(body.messages[0].content, /海外采购|B2B/);
  assert.match(body.messages[0].content, /常规商务英语/);
  assert.match(body.messages[0].content, /行业/);
});
