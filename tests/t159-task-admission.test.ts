import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { localEndpoint } from '../scripts/local-endpoint.ts';

for (const action of ['quick', 'dialog', 'retry', 'page', 'translate', 'restore', 'undo', 'manual']) test(`当前进程未准入已存 pending 大纲时，${action} 不创建任务或进入提交检查`, async () => {
  localEndpoint('SITECRAFT_BASE');
  const root = path.resolve('artifacts/t159', `task-contract-${action}-${crypto.randomUUID()}`); await mkdir(root);
  async function run(phase: string, admitted: boolean, id?: string, selectedAction = action) {
    const folder = path.join(root, phase);
    const env: NodeJS.ProcessEnv = { ...process.env, T159_PENDING_CATALOG: '1', T159_ENTRY_OUT: folder, T159_ENTRY_DATA_ROOT: path.join(root, 'data'), T159_RESTYLE_MODE: id ? 'act' : 'prepare', T159_RESTYLE_ACTION: selectedAction };
    if (id) env.T159_RESTYLE_SITE = id;
    if (admitted) env.SITECRAFT_EVAL_STYLES = 'neighborly'; else delete env.SITECRAFT_EVAL_STYLES;
    const result = spawnSync(process.execPath, ['--experimental-strip-types', 'tests/fixtures/t159-entry.ts'], { env, encoding: 'utf8', timeout: 30000 });
    await writeFile(path.join(root, `${phase}-process.json`), JSON.stringify({ status: result.status, stdout: result.stdout, stderr: result.stderr }, null, 2), 'utf8');
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(await readFile(path.join(folder, 'restyle.json'), 'utf8')).evidence;
  }
  const prepared = await run('prepare', true);
  assert.equal(prepared.initial.codeSite.plan.style, 'precision'); assert.equal(prepared.initial.codeSite.versions.length, 2);
  assert.equal(prepared.selected.status, 202); assert.equal(prepared.saved.codeSite.plan.style, 'neighborly');
  assert.equal(prepared.saved.alignment.awaitingConfirmation, true); assert.equal(prepared.localPlanRequests, 1);
  const denied = await run('ordinary', false, prepared.siteId);
  assert.equal(denied.confirm.status, 400); assert.equal(denied.queuedBefore, 0);
  assert.equal(denied.result.status, ['restore', 'undo', 'manual'].includes(action) ? 422 : 400);
  assert.match(denied.result.payload.userMessage, /风格.*不能使用/);
  assert.equal(denied.queuedAfter, 0); assert.equal(denied.modelRequests, 0); assert.equal(denied.checksAfter, 0);
  assert.equal(denied.after.codeSite.runs.length, denied.before.codeSite.runs.length); assert.equal(denied.after.codeSite.versions.length, 2);
  assert.equal(denied.after.codeSite.currentVersionId, denied.before.codeSite.currentVersionId); assert.equal(denied.after.codeSite.plan.style, 'neighborly');
  const allowed = await run('admitted', true, prepared.siteId);
  const submitted = ['restore', 'undo', 'manual'].includes(action);
  assert.equal(allowed.result.status, submitted ? 200 : 202); assert.equal(allowed.queuedAfter, submitted ? 0 : 1); assert.equal(allowed.modelRequests, 0);
  if (submitted) assert.equal(allowed.after.codeSite.versions.length, 3);
  else assert.equal(allowed.after.codeSite.run.kind, action === 'translate' ? 'translate' : 'edit');
  if (action === 'dialog') {
    const another = await run('prepare-replan', true);
    const replan = await run('replan-ready', false, another.siteId, 'replan');
    assert.equal(replan.result.status, 202); assert.equal(replan.queuedAfter, 1); assert.equal(replan.modelRequests, 0);
    assert.equal(replan.after.codeSite.run.kind, 'plan'); assert.equal(replan.after.codeSite.preferences.style, 'precision');
  }
});
