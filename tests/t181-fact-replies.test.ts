import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import type { CodeModelCall, SiteCode } from '../lib/code-site.ts';

// Failure list: ambiguous ordinary-fact instruction; false/empty accepted;
// high-risk categories lost; malformed/length replies lost; ID/claim errors
// hidden; segment map lost on failure; literal or escaped credentials retained.
// The HTTP substitute cannot prove model classification. The real probe does.
const callbacks: Array<() => Promise<void>> = [];
(globalThis as any).__t181After = callbacks;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'next/server.js') return { shortCircuit: true, url: 'data:text/javascript,export function after(fn){globalThis.__t181After.push(fn)}' };
  if (!specifier.startsWith('@/')) return next(specifier, context);
  return next(pathToFileURL(path.join(process.cwd(), `${specifier.slice(2)}.ts`)).href, context);
} });
const { createCodeSite } = await import('../lib/code-site-store.ts');
const { getOrCreateConversation } = await import('../lib/conversation-store.ts');
const { POST: chat } = await import('../app/api/sites/[siteId]/chat/route.ts');
const { auditCodeFacts, codeModelCalls } = await import('../lib/code-site-model.ts');
const output = `artifacts/t181/offline-${Date.now()}-${process.pid}`;
await mkdir(output, { recursive: true });
const usage = { prompt_tokens: 211, completion_tokens: 89, total_tokens: 300, completion_tokens_details: { reasoning_tokens: 23 } };
const ordinary = '规格：牛皮纸袋，平口结构。流程：确认版面后制样。地址：柳枝路。';
const price = '纸袋每件12元。', qualification = '已取得 ISO 9001 认证。';
const materials = `公司名：柳枝纸品\n${ordinary}\n${price}\n${qualification}`;
let mode = 'ordinary', rawOverride: string | undefined, finishReason = 'stop';
const requests: any[] = [], replies: string[] = [];
const code = (): SiteCode => ({ header: '<header>柳枝纸品</header>', footer: '<footer>纸品资料</footer>',
  css: 'body{margin:0;padding:24px;color:#222;background:#fff;font:18px/1.7 sans-serif}p{max-width:34em}section{padding:24px 0}',
  pages: [{ id: 'home', title: '纸品', html: `<main><h1>纸品</h1><section><h2>规格与流程</h2><p>${ordinary}</p></section>${mode === 'high-risk' ? `<section><h2>收费与认证</h2><p>${price}</p><p>${qualification}</p></section>` : ''}</main>` }] });
const provider = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw); requests.push(body);
  const fn = body.tools?.[0]?.function;
  let message: any;
  if (fn) {
    message = { content: null, tool_calls: [{ type: 'function', function: { name: 'submit_page_plan', arguments: JSON.stringify({
      summary: '展示现有纸品资料', style: 'precision', styleReason: '纸品说明', skeletonId: 'custom', skeletonReason: '依资料组织规格和流程',
      pages: [{ id: 'home', title: '纸品', outline: ['展示规格与流程'] }],
    }) } }] };
  } else if (body.messages[0].content.includes('事实校对员')) {
    const input = JSON.parse(body.messages[1].content.split('\n')[0]);
    const results = input.segments.map((s: any) => {
      const citations = [
        { category: '价格与收费', claim: price, quote: price },
        { category: '资质认证', claim: qualification, quote: qualification },
      ].filter(c => s.text.includes(c.claim));
      return { id: s.id, issues: [], noFacts: mode === 'empty' ? false : !citations.length,
        factCategories: mode === 'empty' ? [] : citations.map(c => c.category), citations };
    });
    if (mode === 'missing') results.pop();
    if (mode === 'duplicate') results.push(results[0]);
    if (mode === 'unknown') results[0].id = 's99999';
    if (mode === 'wrong-claim') results[0] = { ...results[0], noFacts: false, factCategories: ['价格与收费'], citations: [{ category: '价格与收费', claim: '并非本段的声明', quote: price }] };
    message = { content: mode === 'leak-in-task' ? String.raw`{"message":"t181\u002dcredential` : rawOverride ?? `\n${JSON.stringify({ results })}\n` };
  } else message = { content: JSON.stringify(code()) };
  const reply = JSON.stringify({ choices: [{ finish_reason: fn ? 'tool_calls' : finishReason, message }], usage });
  const wire = mode === 'outer-invalid' ? '{"choices":[' : reply;
  replies.push(wire);
  res.setHeader('content-type', 'application/json'); res.end(wire);
});
await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
const address = provider.address(); assert.ok(address && typeof address === 'object');
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
process.env.DEEPSEEK_API_KEY = 't181-credential'; process.env.DEEPSEEK_MODEL = 'fixture';
test.after(() => new Promise<void>(resolve => provider.close(() => resolve())));

async function generate(nextMode: string) {
  mode = nextMode; requests.length = 0; replies.length = 0;
  const id = `t181-${crypto.randomUUID()}`;
  const conversation = await getOrCreateConversation(id, `conversation-${id}`);
  await createCodeSite(id, '柳枝纸品', conversation.conversationId);
  const post = async (body: unknown) => {
    const response = await chat(new Request(`${process.env.SITECRAFT_BASE}/api/sites/${id}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ siteId: id }) });
    assert.ok(response.ok, await response.clone().text());
    const state = await response.json();
    for (const callback of callbacks.splice(0)) await callback();
    return state;
  };
  let state = await post({ message: materials, baseRevision: 0 });
  await post({ action: 'select', questionId: state.alignment.questionId, questionRevision: state.alignment.questionRevision, optionId: 'precision', preferences: { style: 'precision', layout: 5, density: 6 }, baseRevision: 0 });
  state = await post({ action: 'state' });
  await post({ action: 'confirm', questionId: state.alignment.questionId, questionRevision: state.alignment.questionRevision, baseRevision: 0 });
  const response = await fetch(`${process.env.SITECRAFT_BASE}/api/sites/${id}/draft`);
  assert.equal(response.status, 200);
  const site = (await response.json()).codeSite;
  await writeFile(`${output}/${nextMode}.json`, JSON.stringify({ site, requests, replies }, null, 2), 'utf8');
  return site;
}

test('T-181 普通企业事实与七类高风险声明的提示边界', async () => {
  mode = 'ordinary';
  for (const local of [false, true]) {
    await auditCodeFacts(materials, [{ text: ordinary, group: ordinary, context: { pageId: 'home', outline: [], headings: [] } }], local, 'precision', [{ type: 'message', messageIndex: 1, text: materials }]);
    const prompt = requests.at(-1).messages[0].content;
    assert.doesNotMatch(prompt, /有企业事实时 noFacts=false|没有企业事实时 noFacts=true/);
    assert.match(prompt, /没有七类高风险声明[^\n]*noFacts=true/);
    assert.match(prompt, /规格、地址、流程/);
  }
});

for (const nextMode of ['ordinary', 'high-risk', 'empty', 'leak-in-task']) test(`T-181 真实生成入口及普通服务读回：${nextMode}`, { timeout: 120000 }, async () => {
  const site = await generate(nextMode), calls = site.run.modelCalls.filter((c: any) => c.purpose === 'facts');
  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.ok(call.response.rawBody, '事实核对任务缺少原始回复');
  if (nextMode === 'leak-in-task') {
    assert.deepEqual(call.response.rawBody, { bodyRedacted: true, bodyLength: replies.at(-1)!.length });
    assert.doesNotMatch(JSON.stringify(site), /t181-credential|\\u002d/);
  } else assert.equal(call.response.rawBody.body, replies.at(-1), '成功与协议拒收均先保存原始 HTTP 回复，不重排正文');
  assert.equal(call.response.finishReason, 'stop');
  assert.deepEqual(call.usage, { promptTokens: 211, completionTokens: 89, totalTokens: 300, reasoningTokens: 23 });
  const sent = JSON.parse(requests.at(-1).messages[1].content.split('\n')[0]);
  assert.deepEqual(call.factInput.segments, sent.segments, '站点任务必须保留输入短编号到实际段落和页面的映射');
  if (nextMode === 'empty' || nextMode === 'leak-in-task') {
    assert.equal(site.run.status, 'error'); assert.match(site.run.step, nextMode === 'empty' ? /空类别/ : /凭据/);
    assert.equal(site.versions.length, 0); assert.equal(site.run.repairRound, 0);
  } else {
    assert.equal(site.run.status, 'complete', site.run.step); assert.equal(site.versions.length, 1);
    const segments = site.versions[0].checks.factSegments.segments;
    const normal = segments.find((s: any) => s.text.includes(ordinary));
    assert.equal(normal.noFacts, true); assert.deepEqual(normal.factCategories, []); assert.deepEqual(normal.citations, []);
    if (nextMode === 'high-risk') {
      const high = segments.find((s: any) => s.text.includes(price));
      assert.equal(high.noFacts, false);
      assert.deepEqual(high.factCategories, ['价格与收费', '资质认证']);
      assert.deepEqual(high.citations.map((c: any) => [c.category, c.claim, c.quote]), [['价格与收费', price, price], ['资质认证', qualification, qualification]]);
    }
  }
  const prompt = requests.at(-1).messages[0].content;
  assert.doesNotMatch(prompt, /有企业事实时 noFacts=false|没有企业事实时 noFacts=true/);
  assert.match(prompt, /没有七类高风险声明[^\n]*noFacts=true/);
  assert.match(prompt, /规格、地址、流程/);
});

// Isolated HTTP-boundary checks vary the segment text and ID set. They retain
// strict rejection and diagnostics without re-running the browser for each body.
for (const local of [false, true]) test(`T-181 ${local ? '局部' : '整站'}事实回复：拒收与脱敏`, async () => {
  for (const nextMode of ['missing', 'duplicate', 'unknown', 'wrong-claim', 'invalid-json', 'outer-invalid', 'length', 'credential-literal', 'credential-key', 'credential-nested', 'credential-duplicate', 'credential-truncated', 'clean']) {
    mode = nextMode; finishReason = nextMode === 'length' ? 'length' : 'stop';
    rawOverride = ({
      'invalid-json': '{"results":[', length: '{"results":[',
      'credential-literal': '{"t181-credential":"secret"}',
      'credential-key': String.raw`{"t181\u002dcredential":"secret"}`,
      'credential-nested': String.raw`{"message":"t181\\u002dcredential"}`,
      'credential-duplicate': String.raw`{"message":"t181\u002dcredential","message":"overwritten"}`,
      'credential-truncated': String.raw`{"message":"t181\u002dcredential`,
    } as Record<string, string>)[nextMode];
    const calls: CodeModelCall[] = [];
    const text = `规格或流程哨兵 ${crypto.randomUUID()}`;
    const operation = () => codeModelCalls.run(calls, () => auditCodeFacts(materials, [{ text, group: text, context: { pageId: 'specs', outline: [], headings: [] } }], local, 'precision', [{ type: 'message', messageIndex: 1, text: materials }]));
    if (nextMode === 'clean') assert.equal((await operation())[0].noFacts, true);
    else await assert.rejects(operation, nextMode === 'length' ? /截断/ : nextMode.startsWith('credential-') ? /凭据/ : nextMode.includes('invalid') ? /JSON/ : /编号无效|声明不在/);
    assert.equal(calls.length, 1, '错误不重试');
    const call = calls[0] as any;
    assert.ok(call.factInput, '失败任务也必须保留核对段映射');
    assert.deepEqual(call.factInput.segments, [{ id: 's1', text, groupId: 'g1', pageId: 'specs', headings: [] }]);
    assert.equal(call.response.finishReason, nextMode === 'outer-invalid' ? null : finishReason);
    assert.deepEqual(call.usage, nextMode === 'outer-invalid' ? null : { promptTokens: 211, completionTokens: 89, totalTokens: 300, reasoningTokens: 23 });
    if (nextMode.startsWith('credential-')) {
      assert.deepEqual(call.response.rawBody, { bodyRedacted: true, bodyLength: replies.at(-1)!.length });
      assert.doesNotMatch(JSON.stringify(call), /t181-credential|\\u002d/);
    } else assert.equal(call.response.rawBody.body, replies.at(-1));
    await writeFile(`${output}/${local ? 'local' : 'whole'}-${nextMode}.json`, JSON.stringify(calls, null, 2), 'utf8');
  }
  rawOverride = undefined; finishReason = 'stop';
});
