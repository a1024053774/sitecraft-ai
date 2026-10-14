import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { localEndpoint } from '../scripts/local-endpoint.ts';

// Permission follows model use, not the mere presence of a pending outline.
// Checked unchanged restoration and cached CSS-only submissions must still run
// deterministic checks; changed/unknown facts require admission before HTTP.
for (const action of ['quick', 'dialog', 'retry', 'page', 'translate', 'restore', 'undo', 'manual', 'restore-changed', 'undo-unknown', 'manual-changed', 'manual-source', 'manual-invalid']) test(`pending 大纲的进程准入按本次模型调用判断：${action}`, async () => {
  localEndpoint('SITECRAFT_BASE');
  const root = path.resolve('artifacts/t159', `task-contract-${action}-${crypto.randomUUID()}`); await mkdir(root);
  const dataRoot = path.join(process.env.SITECRAFT_DATA_ROOT!, path.basename(root));
  async function run(phase: string, admitted: boolean, id?: string, selectedAction = action) {
    const folder = path.join(root, phase);
    const env: NodeJS.ProcessEnv = { ...process.env, T159_PENDING_CATALOG: '1', T159_ENTRY_OUT: folder, T159_ENTRY_DATA_ROOT: dataRoot, T159_RESTYLE_MODE: id ? 'act' : 'prepare', T159_RESTYLE_ACTION: selectedAction };
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
  assert.equal(prepared.bootstrapFactRequests, 1);
  if (action === 'undo-unknown') assert.equal(prepared.initial.codeSite.versions[0].checks.factReview, 'legacy-unreviewed');
  const denied = await run('ordinary', false, prepared.siteId);
  assert.equal(denied.confirm.status, 400); assert.equal(denied.queuedBefore, 0);
  const submitted = /^(restore|undo|manual)/.test(action), noModel = ['restore', 'undo', 'manual'].includes(action), invalid = action === 'manual-invalid';
  assert.equal(denied.result.status, noModel ? 200 : submitted ? 422 : 400);
  if (!noModel) assert.match(denied.result.payload.userMessage, invalid ? /横向溢出/ : /风格.*不能使用/);
  assert.equal(denied.queuedAfter, 0); assert.equal(denied.modelRequests, 0); assert.equal(denied.checksAfter, submitted ? 1 : 0);
  assert.equal(denied.closedChecks, denied.checksAfter);
  assert.equal(denied.after.codeSite.runs.length, denied.before.codeSite.runs.length); assert.equal(denied.after.codeSite.versions.length, noModel ? 3 : 2);
  assert.equal(denied.after.codeSite.plan.style, 'neighborly');
  if (noModel) {
    const version = denied.after.codeSite.versions.at(-1);
    assert.notEqual(version.id, denied.before.codeSite.currentVersionId);
    assert.deepEqual(version.checks.viewports.map((v: any) => v.width), [375, 768, 1440]);
    if (action === 'manual') {
      assert.equal(version.checks.factSegments.audited, 0); assert.ok(version.checks.factSegments.reused > 0);
    } else {
      assert.deepEqual(version.code, prepared.initial.codeSite.versions[0].code);
      assert.equal(version.checks.factReviewFrom.versionId, prepared.initial.codeSite.versions[0].id);
      assert.equal(version.checks.factReviewFrom.checkedAt, prepared.initial.codeSite.versions[0].checks.checkedAt);
    }
  } else assert.equal(denied.after.codeSite.currentVersionId, denied.before.codeSite.currentVersionId);
  const allowed = await run('admitted', true, prepared.siteId);
  assert.equal(allowed.result.status, invalid ? 422 : submitted ? 200 : 202); assert.equal(allowed.queuedAfter, submitted ? 0 : 1);
  assert.equal(allowed.modelRequests, submitted && !noModel && !invalid ? 1 : 0);
  if (submitted) assert.equal(allowed.after.codeSite.versions.length, allowed.before.codeSite.versions.length + (invalid ? 0 : 1));
  else assert.equal(allowed.after.codeSite.run.kind, action === 'translate' ? 'translate' : 'edit');
  if (action === 'dialog') {
    const another = await run('prepare-replan', true);
    const replan = await run('replan-ready', false, another.siteId, 'replan');
    assert.equal(replan.result.status, 202); assert.equal(replan.queuedAfter, 1); assert.equal(replan.modelRequests, 0);
    assert.equal(replan.after.codeSite.run.kind, 'plan'); assert.equal(replan.after.codeSite.preferences.style, 'precision');
  }
});
