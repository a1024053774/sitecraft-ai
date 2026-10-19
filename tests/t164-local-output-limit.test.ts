import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { fixture, output, session, state, workflowBase } from './helpers/t162-browser.ts';
import { createT164OutputFixture } from './fixtures/t164-output-model.ts';
import { reserveRequest } from '../scripts/t153-real-budget.ts';

// Requirements: every local writing/correction request uses 12288; a length
// response remains terminal, observable and unsaved; reservation must include
// the actual HTTP input and the full cap within the approved 52905 balance.
const providers: ReturnType<typeof createT164OutputFixture>[] = [];
async function providerFor(caseName: string, mode: 'truncate' | 'repair', beforeFactReply?: () => Promise<void>) {
  const directory = `${output}/provider-${providers.length + 1}-${mode}`;
  await mkdir(directory, { recursive: true });
  const model = createT164OutputFixture(directory, caseName, mode, beforeFactReply);
  providers.push(model);
  await new Promise<void>(resolve => model.provider.listen(0, '127.0.0.1', resolve));
  const address = model.provider.address(); assert.ok(address && typeof address === 'object');
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
  return model;
}
async function caseFor(caseName: string, mode: 'truncate' | 'repair', beforeFactReply?: () => Promise<void>) {
  const model = await providerFor(caseName, mode, beforeFactReply);
  const id = await fixture();
  model.beginRun();
  return { id, model };
}
// The imported bridge's after hook first waits for every production callback.
// Keep both case-owned listeners alive until then, even if a case assertion fails.
test.after(async () => {
  const results = await Promise.allSettled(providers.map(model => model.close()));
  const failures = results.filter(result => result.status === 'rejected');
  assert.deepEqual(failures, [], '用例结束后的坏请求也必须明确失败，不能成为未捕获异常');
});

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

test('局部写作 length 如实报截断、保留 finishReason 且整批不存版、不重试', { timeout: 120000 }, async t => {
  const { id, model } = await caseFor(t.name, 'truncate'), before = (await state(id)).codeSite;
  const view = await session(1440, { siteId: id });
  const requests = model.requests.run;
  try {
    const start = requests.length, response = await send(id, before.versions[0]);
    assert.equal(response.status, 202);
    const done = (await view.settle()).codeSite, calls = requests.slice(start);
    await writeFile(`${output}/local-output-truncated.json`, JSON.stringify({ before, done, initializationRequests: model.requests.initialization, requests: calls }, null, 2));
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
    model.assertHealthy();
    assert.ok(model.arrivals.every(arrival => arrival.status === 'responded'));
    assert.equal(model.arrivals.filter(arrival => arrival.phase === 'run').length, done.run.modelCalls.length, 'after 终态须收齐本用例的实际模型调用');
  } finally { await view.browser.close(); }
});

test('局部首轮与修正轮实际请求均为 12288，52905 余额可完整预留真实输入与输出', { timeout: 120000 }, async t => {
  const factsArrived = Promise.withResolvers<void>(), releaseFacts = Promise.withResolvers<void>();
  const { id, model } = await caseFor(t.name, 'repair', async () => { factsArrived.resolve(); await releaseFacts.promise; });
  const before = (await state(id)).codeSite, view = await session(1440, { siteId: id });
  const requests = model.requests.run;
  try {
    const start = requests.length, response = await send(id, before.versions[0]);
    assert.equal(response.status, 202);
    const terminal = view.settle();
    let settled = false;
    terminal.then(() => { settled = true; }, () => { settled = true; });
    await Promise.race([factsArrived.promise, terminal.then(() => assert.fail('事实核对尚未收到，任务不能先结束'))]);
    assert.equal(settled, false, '最后一次事实核对仍被闸门挂起，必须继续等待 after 终态');
    assert.equal((await state(id)).codeSite.run.status, 'running');
    releaseFacts.resolve();
    const done = (await terminal).codeSite, calls = requests.slice(start);
    const local = calls.filter(call => call.local).map(call => call.body);
    const reservation = reserveRequest(local[0], 0, 52905);
    await writeFile(`${output}/local-output-repair.json`, JSON.stringify({ before, done, initializationRequests: model.requests.initialization, requests: calls, reservation }, null, 2));
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
    model.assertHealthy();
    assert.ok(model.arrivals.every(arrival => arrival.status === 'responded'));
    assert.equal(model.arrivals.filter(arrival => arrival.phase === 'run').length, done.run.modelCalls.length, 'after 终态须收齐写作、修正与事实核对');
  } finally { releaseFacts.resolve(); await view.browser.close(); }
});

test('T-182 初始化归属：初始化下一用例不得增加前一用例的请求', { timeout: 120000 }, async t => {
  const first = await caseFor(`${t.name} A`, 'truncate');
  const before = first.model.arrivals.length;
  const second = await caseFor(`${t.name} B`, 'truncate');
  await writeFile(`${output}/initialization-ownership.json`, JSON.stringify({ before, first: first.model.arrivals, second: second.model.arrivals }, null, 2));
  assert.equal(first.model.arrivals.length, before, 'B 初始化不得进入 A 的监听器');
  assert.ok(second.model.arrivals.length > 0, 'B 的初始整站核对须由 B 的替身登记');
  for (const [owner, model] of [[`${t.name} A`, first.model], [`${t.name} B`, second.model]] as const) {
    assert.ok(model.requests.initialization.length > 0);
    assert.deepEqual(model.requests.run, [], '仅初始化的用例不得登记 run 调用');
    assert.ok(model.requests.initialization.every(call => call.purpose === 'whole-facts' && call.body.max_tokens === 65536));
    assert.ok(model.arrivals.every(arrival => arrival.caseName === owner && arrival.phase === 'initialization'
      && arrival.purpose === 'whole-facts' && arrival.status === 'responded'));
  }
});
