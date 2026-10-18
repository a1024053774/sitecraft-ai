import assert from 'node:assert/strict';
import test from 'node:test';
import { writeFile } from 'node:fs/promises';
import * as helper from './helpers/t162-browser.ts';

// A′: task state owns completion. An unrelated animation may keep running.
// The model reply gate suspends real production work, without timed sleeps.
const unrelatedAnimation = `document.addEventListener('DOMContentLoaded',()=>{
  const marker=document.createElement('i');marker.dataset.t179Motion='unrelated';marker.setAttribute('aria-hidden','true');
  marker.style.cssText='position:fixed;top:0;right:0;width:1px;height:1px;pointer-events:none';document.body.append(marker);
  marker.animate([{opacity:1},{opacity:.5}],{duration:900,iterations:Infinity});
});`;
async function submit(id: string) {
  const site = (await helper.state(id)).codeSite, version = site.versions.at(-1);
  const response = await fetch(`${helper.workflowBase}/api/sites/${id}/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      message: '保留原文，合法空 CSS', baseRevision: version.revision,
      selectedTarget: { kind: 'dom', pageId: 'home', versionId: version.id, path: [0],
        label: '青禾纸品', text: '青禾纸品纸箱与纸袋，按用途说明规格。' },
    }),
  });
  assert.equal(response.status, 202);
}

test('A′：真实任务未完成不放行，完成后无限动画仍在转也须放行', { timeout: 180000 }, async () => {
  const id = await helper.fixture();
  const view = await helper.session(1440, { siteId: id, beforeNavigate: browser =>
    browser.send('Page.addScriptToEvaluateOnNewDocument', { source: unrelatedAnimation }).then(() => {}) });
  let release: (() => void) | undefined;
  let settling: ReturnType<typeof view.settle> | undefined;
  try {
    const gate = helper.holdNextLocalReply(); release = gate.release;
    await submit(id); await gate.requested();
    let outcome = 'pending';
    settling = view.settle().then(value => { outcome = 'complete'; return value; });
    // This request was sent by the test's HTTP client. Reload so the UI reads
    // its running state, just as the production request handler normally does.
    await view.browser.loadPage('Page.reload');
    await view.wait(`document.querySelector('[data-testid="code-progress"]')?.closest('.running')`);
    const running = (await helper.state(id)).codeSite.run;
    assert.equal(running.status, 'running');
    assert.equal(outcome, 'pending', '真实任务仍被替身闸门挂起时不能放行');
    gate.release(); release = undefined;
    const result = await settling;
    assert.equal(result.codeSite.run.status, 'complete');
    assert.equal(await view.browser.evaluate(`document.getAnimations().some(a=>a.effect?.target?.dataset?.t179Motion==='unrelated'&&a.playState==='running')`), true, '任务完成不要求无关无限动画停转');
    await writeFile(`${helper.output}/terminal-with-animation.json`, JSON.stringify({ outcome, status: result.codeSite.run.status, at: new Date().toISOString() }, null, 2));
  } finally { release?.(); await settling; await view.browser.close(); }
});

test('A′：真实任务卡住时，共用生产预算推导的终态期限必须明确失败', { timeout: 180000 }, async t => {
  const id = await helper.fixture(), view = await helper.session(1440, { siteId: id });
  const gate = helper.holdNextLocalReply();
  let result: { status: string; error?: unknown } = { status: 'pending' };
  let pending: Promise<void> | undefined;
  try {
    await submit(id); await gate.requested();
    const running = (await helper.state(id)).codeSite.run;
    assert.equal(running.status, 'running');
    // Only advance the deadline clock while real work is held at the provider.
    // Restore it before releasing work; no product check runs on a fake clock.
    const before = Date.now();
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: before });
    pending = view.settle().then(() => { result = { status: 'unexpected-completion' }; }, error => { result = { status: 'timeout', error }; });
    // The retained failure used this historical UI ceiling. Advancing a clock
    // is a deadline probe, not a sleep or a new copy of the production budget.
    t.mock.timers.tick(20_000);
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(result.status, 'pending', '旧 20 秒上限到达时，产品预算内的真实挂起任务不能被提前判超时');
    t.mock.timers.runAll();
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(result.status, 'timeout', '卡住的真实任务必须有自己的终态期限，不能等外层测试被取消');
    assert.match(String(result.error), /任务终态等待超时/);
    const deadlineMs = (helper as unknown as { taskWaitTimeoutMs: number }).taskWaitTimeoutMs;
    assert.equal(Date.now(), Date.parse(running.startedAt) + deadlineMs, '期限从持久化任务开始时刻计算，不在调用等待时重置或追加');
    await writeFile(`${helper.output}/stuck-terminal.json`, JSON.stringify({ deadlineMs, result: { status: result.status, error: String(result.error) }, clock: 'Node mock deadline; real HTTP task held at model gate' }, null, 2));
  } finally {
    t.mock.timers.reset(); gate.release(); await pending; await view.browser.close();
  }
});
