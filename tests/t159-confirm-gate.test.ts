import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { localEndpoint } from '../scripts/local-endpoint.ts';

// A saved plan grants no process-level permission. A denied confirmation must
// leave its question and chosen style intact so an admitted process can use it.
test('评估进程保存 pending 大纲后，普通进程确认被拒绝且不消耗确认；已准入进程仍可确认', async () => {
  localEndpoint('SITECRAFT_BASE');
  const root = path.resolve('artifacts/t159', `confirm-contract-${crypto.randomUUID()}`); await mkdir(root, { recursive: true });
  const data = path.join(process.env.SITECRAFT_DATA_ROOT!, path.basename(root));
  async function run(phase: string, admitted: boolean, siteId?: string) {
    const folder = path.join(root, phase);
    const env: NodeJS.ProcessEnv = { ...process.env, T159_PENDING_CATALOG: '1', T159_ENTRY_OUT: folder, T159_ENTRY_DATA_ROOT: data };
    if (admitted) env.SITECRAFT_EVAL_STYLES = 'neighborly'; else delete env.SITECRAFT_EVAL_STYLES;
    if (siteId) env.T159_ENTRY_CONFIRM_SITE = siteId; else env.T159_ENTRY_PLAN_ONLY = '1';
    const result = spawnSync(process.execPath, ['--experimental-strip-types', 'tests/fixtures/t159-entry.ts'], { env, encoding: 'utf8', timeout: 30000 });
    await writeFile(path.join(root, `${phase}-process.json`), JSON.stringify({ status: result.status, stdout: result.stdout, stderr: result.stderr }, null, 2), 'utf8');
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(await readFile(path.join(folder, siteId ? 'confirm.json' : 'entry.json'), 'utf8'));
  }
  const prepared = await run('plan', true);
  const id = prepared.round.cases[0].siteId;
  const saved = prepared.routes.filter((r: any) => r.url.endsWith('/draft')).at(-1).payload;
  assert.equal(saved.codeSite.plan.style, 'neighborly'); assert.equal(saved.codeSite.run.kind, 'plan'); assert.equal(saved.codeSite.run.status, 'complete');
  assert.equal(saved.alignment.questionKind, 'confirm_ops'); assert.equal(prepared.modelRequests.length, 1);
  const denied = await run('ordinary-confirm', false, id);
  assert.equal(denied.status, 400); assert.match(denied.payload.userMessage, /风格.*(?:未准入|不能使用)/);
  assert.equal(denied.queuedAfter, 0); assert.equal(denied.modelRequests, 0);
  assert.equal(denied.after.codeSite.runs.length, denied.before.codeSite.runs.length);
  assert.equal(denied.after.codeSite.preferences.style, 'neighborly'); assert.equal(denied.after.codeSite.plan.style, 'neighborly');
  assert.equal(denied.after.alignment.questionId, denied.before.alignment.questionId);
  assert.equal(denied.after.alignment.questionRevision, denied.before.alignment.questionRevision);
  assert.equal(denied.after.alignment.awaitingConfirmation, true); assert.equal(denied.after.alignment.processing, false);
  const accepted = await run('admitted-confirm', true, id);
  assert.equal(accepted.status, 202); assert.equal(accepted.queuedAfter, 1); assert.equal(accepted.modelRequests, 0);
  assert.equal(accepted.after.codeSite.run.kind, 'generate'); assert.equal(accepted.after.codeSite.run.status, 'running');
});
