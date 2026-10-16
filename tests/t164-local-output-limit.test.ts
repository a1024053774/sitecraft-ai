import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { writeFile } from 'node:fs/promises';
import test from 'node:test';
import { fixture, output, session, state, workflowBase } from './helpers/t162-browser.ts';
import { factAuditReply } from './fixtures/fact-audit-reply.ts';
import { reserveRequest } from '../scripts/t153-real-budget.ts';

// Requirements: every local writing/correction request uses 12288; a length
// response remains terminal, observable and unsaved; reservation must include
// the actual HTTP input and the full cap within the approved 52905 balance.
const requests: any[] = [];
let mode: 'truncate' | 'repair' = 'truncate', localRoundCalls = 0;
const provider = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw), local = body.messages[0].content.includes('本次局部修改');
  requests.push({ local, body });
  await writeFile(`${output}/local-output-requests.json`, JSON.stringify(requests, null, 2));
  res.setHeader('content-type', 'application/json');
  if (local && mode === 'truncate') {
    res.end(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: '' } }],
      usage: { prompt_tokens: 100, completion_tokens: 6145, total_tokens: 6245, completion_tokens_details: { reasoning_tokens: 6145 } } }));
    return;
  }
  const input = local ? JSON.parse(body.messages[1].content.split('\n')[0]) : null;
  // Both groups violate the block contract in the first round. The next round
  // returns valid blocks, so the route must send real correction requests.
  const answer = local ? { html: ++localRoundCalls <= 2 ? `<main>${input.html}</main>` : input.html, css: '' }
    : factAuditReply(body, { issues: [] });
  res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(answer) } }],
    usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 } }));
});
await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
const address = provider.address(); assert.ok(address && typeof address === 'object');
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
test.after(() => new Promise<void>(resolve => provider.close(() => resolve())));

async function send(id: string, version: any) {
  const items = [
    { draftId: crypto.randomUUID(), revision: version.revision, body: '请保留原文，只调整首屏标题。',
      target: { kind: 'dom', pageId: 'home', versionId: version.id, path: [0], text: '青禾纸品纸箱与纸袋，按用途说明规格。', label: '首屏' } },
    { draftId: crypto.randomUUID(), revision: version.revision, body: '纸袋这块也保留原文，只调整标题。',
      target: { kind: 'dom', pageId: 'home', versionId: version.id, path: [1], text: '相同标题相同说明', label: '纸袋' } },
  ];
  return fetch(`${workflowBase}/api/sites/${id}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: '批量局部修改', baseRevision: version.revision, annotationBatch: items, annotationOverlapConfirmed: false }) });
}

test('局部写作 length 如实报截断、保留 finishReason 且整批不存版、不重试', { timeout: 120000 }, async () => {
  const id = await fixture(), before = (await state(id)).codeSite;
  const view = await session(1440, { siteId: id }); mode = 'truncate';
  try {
    const start = requests.length, response = await send(id, before.versions[0]);
    assert.equal(response.status, 202);
    const done = (await view.settle()).codeSite, calls = requests.slice(start);
    await writeFile(`${output}/local-output-truncated.json`, JSON.stringify({ before, done, requests: calls }, null, 2));
    assert.equal(done.run.status, 'error');
    assert.match(done.run.step, /被截断/);
    assert.match(done.run.step, /未保存版本/);
    assert.equal(done.currentVersionId, before.currentVersionId);
    assert.deepEqual(done.versions, before.versions);
    assert.equal(calls.length, 1, '截断不能触发修正或发送后续组');
    assert.equal(done.run.modelCalls.length, 1);
    assert.equal(done.run.modelCalls[0].response.finishReason, 'length');
    assert.equal(done.run.modelCalls[0].response.answerChars, 0);
    assert.equal(done.run.modelCalls[0].usage.reasoningTokens, 6145);
    assert.equal(done.run.attempts.length, 0);
  } finally { await view.browser.close(); }
});

test('局部首轮与修正轮实际请求均为 12288，52905 余额可完整预留真实输入与输出', { timeout: 120000 }, async () => {
  const id = await fixture(), before = (await state(id)).codeSite;
  const view = await session(1440, { siteId: id }); mode = 'repair'; localRoundCalls = 0;
  try {
    const start = requests.length, response = await send(id, before.versions[0]);
    assert.equal(response.status, 202);
    const done = (await view.settle()).codeSite, calls = requests.slice(start);
    const local = calls.filter(call => call.local).map(call => call.body);
    const reservation = reserveRequest(local[0], 0, 52905);
    await writeFile(`${output}/local-output-repair.json`, JSON.stringify({ before, done, requests: calls, reservation }, null, 2));
    assert.equal(done.run.status, 'complete', done.run.step);
    assert.equal(done.versions.length, 2);
    assert.equal(done.run.repairRound, 1);
    assert.equal(local.length, 4, '两组各有首轮与一次实际修正');
    assert.deepEqual(local.map(body => body.max_tokens), [12288, 12288, 12288, 12288], '负责人决定 A：首轮和修正轮同一输出上限');
    const inputs = local.map(body => JSON.parse(body.messages[1].content.split('\n')[0]));
    assert.ok(inputs.slice(0, 2).every(input => input.issues.length === 0));
    assert.ok(inputs.slice(2).every(input => input.issues.some((issue: string) => issue.includes('一个区块'))));
    assert.equal(reservation.outputLimit, 12288, '网关不能把实际请求的完整输出额度降下来');
    assert.equal(reservation.reserved, reservation.inputUpper + 12288);
    assert.ok(reservation.inputUpper > 0);
    assert.ok(reservation.reserved <= 52905);
    const facts = calls.filter(call => !call.local);
    assert.ok(facts.length > 0);
    assert.ok(facts.every(call => call.body.thinking.type === 'disabled' && call.body.max_tokens === 4096), '局部事实核对保持固定非思考及既有额度');
  } finally { await view.browser.close(); }
});
