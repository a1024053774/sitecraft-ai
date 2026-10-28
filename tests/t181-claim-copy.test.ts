import { factAuditPayload } from './fixtures/fact-audit-reply.ts';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { auditCodeFacts, codeModelCalls } from '../lib/code-site-model.ts';
import type { CodeModelCall } from '../lib/code-site.ts';

// 真实 molding 回复将标签和值连写，给项目标签补标点。期望来自原输入的
// 连续文字，不能用回复的改写反推匹配规则。还须防止跨行、跨编号或回传辅助字段。
const examples = [
  { text: '产能摘要\n模具年产\n\n约 180 套', views: ['产能摘要 模具年产 约 180 套'],
    claim: '模具年产 约 180 套', bad: '模具年产约 180 套', quote: '模具年产约 180 套' },
  { text: '产能\n<TR>\n<TH>\n[scope=row]\n月注塑能力</TH>\n<TD>约 600 万件</TD>\n</TR>', views: ['产能', '[scope=row] 月注塑能力 约 600 万件'],
    claim: '月注塑能力 约 600 万件', bad: '月注塑能力约 600 万件', quote: '月注塑能力约 600 万件' },
  { text: '供货案例\n家电装配\n需求\n结构支架装配孔与平面度受控\n交付\n多腔模具、签样件与全尺寸报告\n边界\n装配验证由采购方完成，不承诺整机性能',
    views: ['供货案例 家电装配 需求 结构支架装配孔与平面度受控 交付 多腔模具、签样件与全尺寸报告 边界 装配验证由采购方完成,不承诺整机性能'],
    claim: '家电装配 需求 结构支架装配孔与平面度受控 交付 多腔模具、签样件与全尺寸报告 边界 装配验证由采购方完成，不承诺整机性能',
    bad: '家电装配：需求 结构支架装配孔与平面度受控；交付 多腔模具、签样件与全尺寸报告；边界 装配验证由采购方完成，不承诺整机性能',
    quote: '供货案例一：行业 家电装配；需求：结构支架装配孔与平面度受控；交付：多腔模具、签样件与全尺寸报告；边界：装配验证由采购方完成，不承诺整机性能。' },
  // 同一句在另一编号中真实出现，也不能借给上面的分列段落。
  { text: '模具年产约 180 套', views: ['模具年产约 180 套'], claim: '模具年产约 180 套', bad: '模具年产约 180 套', quote: '模具年产约 180 套' },
];
const materials = examples.map(x => x.quote).join('\n');
const output = `artifacts/t181/claim-copy-${Date.now()}-${process.pid}`;
await mkdir(output, { recursive: true });
let mode = 'valid';
const requests: any[] = [];
const provider = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const request = JSON.parse(raw); requests.push(request);
  const input = JSON.parse(request.messages[1].content.split('\n')[0]);
  const results = input.segments.map((s: any, i: number) => ({ id: s.id, issues: [], noFacts: false, factCategories: ['业绩与数量'], citations: [{ category: '业绩与数量',
    claim: mode === 'cross-row' ? '模具年产 约 180 套 月注塑能力 约 600 万件' : mode === 'rewritten' ? examples[i].bad : mode === 'other-id' && i === 0 ? examples[1].claim : examples[i].claim, quote: examples[i].quote }],
    ...(mode === 'echo-helper' ? { claimTexts: ['不得回传'] } : {}) }));
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(factAuditPayload(request, { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ results }) } }], usage: { prompt_tokens: 50, completion_tokens: 40, total_tokens: 90 } })));
});
await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
const address = provider.address(); assert.ok(address && typeof address === 'object');
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
process.env.DEEPSEEK_API_KEY = 't181-copy-fixture'; process.env.DEEPSEEK_MODEL = 'fixture';
test.after(() => new Promise<void>(resolve => provider.close(() => resolve())));

test('T-181 复制文本按 TR 分开，不能把独立行拼成连续声明', async () => {
  mode = 'cross-row'; requests.length = 0;
  const text = '产能<TR><TD>模具年产 约 180 套</TD></TR><TR><TD>月注塑能力 约 600 万件</TD></TR>';
  await assert.rejects(auditCodeFacts(materials, [{ text, group: text, context: { pageId: 'capacity', outline: [], headings: [] } }], false, 'precision', [{ type: 'message', messageIndex: 1, text: materials }]), /声明不在本核对段/);
  const input = JSON.parse(requests[0].messages[1].content.split('\n')[0]);
  assert.deepEqual(input.segments[0].claimTexts, ['产能', '模具年产 约 180 套', '月注塑能力 约 600 万件']);
});

for (const local of [false, true]) {
  test(`T-181 ${local ? '局部' : '整站'}：模型拿到当前编号可逐字复制的文本，分列与表格保留空格`, async () => {
    mode = 'valid'; requests.length = 0;
    const calls: CodeModelCall[] = [];
    const review = await codeModelCalls.run(calls, () => auditCodeFacts(materials, examples.map(x => ({ text: x.text, group: x.text, context: { pageId: 'capacity', outline: [], headings: [] } })), local, 'precision', [{ type: 'message', messageIndex: 1, text: materials }]));
    assert.equal(review.length, 4); assert.ok(review.every(x => !x.issues.length));
    assert.deepEqual(review.map(x => x.citations[0].claim), examples.map(x => x.views.at(-1)));
    const input = JSON.parse(requests[0].messages[1].content.split('\n')[0]);
    assert.deepEqual(input.segments.map((s: any) => s.claimTexts), examples.map(x => x.views), '当前提示缺少按既有归属规则展开的复制文本，仍迫使模型重建标签和值');
    assert.deepEqual(calls[0].factInput?.segments, input.segments, '复制辅助文本和输入编号一并留在原任务');
    const prompt = requests[0].messages[0].content;
    assert.match(prompt, /claimTexts/); assert.match(prompt, /claimRef.*当前编号/);
    assert.match(prompt, /不.*拼接/); assert.match(prompt, /不.*标点/);
    await writeFile(`${output}/${local ? 'local' : 'whole'}-copy.json`, JSON.stringify({ input, review, calls }, null, 2), 'utf8');
  });
  for (const bad of ['rewritten', 'other-id', 'echo-helper']) test(`T-181 ${local ? '局部' : '整站'}：${bad} 保持严格拒收，不进修正轮`, async () => {
    mode = bad; requests.length = 0;
    const calls: CodeModelCall[] = [];
    await assert.rejects(codeModelCalls.run(calls, () => auditCodeFacts(materials, examples.map(x => ({ text: x.text, group: x.text, context: { pageId: 'capacity', outline: [], headings: [] } })), local, 'precision', [{ type: 'message', messageIndex: 1, text: materials }])), bad === 'echo-helper' ? /格式或编号无效/ : /声明不在本核对段/);
    assert.equal(requests.length, 1); assert.equal(calls.length, 1);
    assert.ok(calls[0].response?.rawBody?.body);
    await writeFile(`${output}/${local ? 'local' : 'whole'}-${bad}.json`, JSON.stringify(calls, null, 2), 'utf8');
  });
}
