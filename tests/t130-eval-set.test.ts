import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { simulatedPacks } from '../lib/simulated-packs.ts';
import { buildBlindPackage, compareRounds, summarize, tokenUsage, requireWholeSitePlan, type EvalCase, type EvalRound } from '../scripts/eval-set-report.ts';
import type { CodeCheck } from '../lib/code-site.ts';

// Failure modes: drop earlier refusals; count unrun sites as passes/zero tokens;
// mix unrelated companies across rounds; reveal style/source/time in the review;
// silently omit missing screenshots or failed cases. These are packaging fixtures,
// not real DeepSeek generation or independent visual review evidence.
const check = (issues: string[]): CodeCheck => ({ passed: !issues.length, issues, cleaned: [], checkedAt: '2026-10-07T00:00:00Z', viewports: [] });
const item = (key: string, outcome: EvalCase['outcome'], issues: string[][]): EvalCase => ({ key, pack: key.split('/')[0], style: key.split('/')[1],
  materials: '该公司的模拟资料' + key.split('/')[0], outcome, elapsedMs: 100,
  attempts: issues.map((issues, round) => ({ round, checks: check(issues) })), pages: [], modelCalls: [] });
test('all refusals and denominators survive, including form body line length', () => {
  const result = summarize([
    item('industrial/precision', 'generated', [['contact/1440 正文行长超标：表单说明'], ['contact/375 正文行长超标：表单说明'], []]),
    item('export/precision', 'rejected', [['home/1440 横向溢出'], ['contact/1440 正文行长超标：表单说明'], ['contact/1440 正文行长超标：表单说明']]),
    item('molding/precision', 'generated', [[]]), item('packaging/precision', 'blocked', []),
    item('industrial/documentary', 'not-run', []),
  ]);
  assert.equal(result.checkedAttempts, 7); assert.equal(result.rejectedAttempts, 5);
  assert.equal(result.firstDraftRejectionRate, 2 / 3); assert.equal(result.finalRejectionRate, 1 / 3);
  assert.deepEqual(result.reasons['body-line-length'], { attempts: 4, sites: 2, occurrences: 4 });
  assert.equal(result.generated, 2); assert.equal(result.blocked, 1); assert.equal(result.notRun, 1);
  assert.equal(summarize([item('industrial/precision', 'blocked', [])]).firstDraftRejectionRate, null);
});
test('reported tokens remain partial when a provider omits usage', () => {
  const base = { purpose: 'plan' as const, model: 'fixture', startedAt: '2026-10-07', latencyMs: 1, httpStatus: 200 };
  assert.deepEqual(tokenUsage([{ ...base, usage: { promptTokens: 17, completionTokens: 9, totalTokens: 26 } }, { ...base, usage: null }]),
    { calls: 2, unknownCalls: 1, complete: false, reported: { promptTokens: 17, completionTokens: 9, totalTokens: 26 } });
  assert.equal(tokenUsage([]).complete, false);
});
test('fourth pack describes a distinct business and keeps full client facts', () => {
  const pack = simulatedPacks.packaging;
  assert.match(pack.body, /^资料性质：模拟/); assert.match(pack.industry, /纸包装/);
  assert.match(pack.body, /不接直接接触裸装食品/); assert.match(pack.body, /12–18 天/); assert.match(pack.body, /20–25 天/);
  assert.match(pack.body, /四个独立页面/); assert.ok(pack.body.length < 4000);
});
test('explicit whole-site page requests cannot silently become a home-only plan', () => {
  for (const [pack, count] of [['industrial', 3], ['export', 5], ['molding', 5], ['packaging', 4]] as const) {
    assert.throws(() => requireWholeSitePlan(pack, 1), /大纲缩减/);
    assert.throws(() => requireWholeSitePlan(pack, count - 1), /大纲缩减/);
    assert.doesNotThrow(() => requireWholeSitePlan(pack, count));
    assert.doesNotThrow(() => requireWholeSitePlan(pack, count + 1));
  }
});
const round = (cases: EvalCase[]): EvalRound => ({ schemaVersion: 1, cases, startedAt: '2026-10-07T00:00:00Z', command: 'fixture',
  commit: 'fixture', dirty: false, base: 'fixture', status: 'fixture', controls: [], errors: [] });
test('pairing follows company/style keys, never array order; changed inputs refuse pairing', () => {
  const a = item('industrial/precision', 'generated', [[]]), b = item('export/documentary', 'blocked', []);
  const before = round([b, { ...a, elapsedMs: 50 }]);
  const after = round([a, { ...b, outcome: 'generated' }]);
  const pairs = compareRounds(after, before);
  assert.equal(pairs[0].elapsedDeltaMs, 50); assert.equal(pairs[0].visualPairAvailable, true);
  assert.equal(pairs[1].previousOutcome, 'blocked'); assert.equal(pairs[1].visualPairAvailable, false);
  assert.throws(() => compareRounds(after, round([{ ...a, materials: 'changed' }, b])), /资料或组合已变化/);
});
test('CLI refuses an incompatible previous corpus and preserves the reason in its output', async () => {
  const directory = path.resolve('artifacts/t130', `cli-fixture-${crypto.randomUUID()}`), before = path.join(directory, 'before'), after = path.join(directory, 'after');
  await mkdir(path.join(before, 'private'), { recursive: true });
  await writeFile(path.join(before, 'private/round.json'), JSON.stringify(round([item('industrial/precision', 'generated', [[]])])), 'utf8');
  const result = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/eval-new-route.ts', '--prepare-only', '--previous', before, '--out', after], { encoding: 'utf8' });
  await writeFile(path.join(directory, 'command-result.txt'), result.stdout + result.stderr, 'utf8');
  assert.equal(result.status, 1);
  const output = JSON.parse(await readFile(path.join(after, 'private/round.json'), 'utf8'));
  assert.ok(output.errors.some((error: string) => error.includes('资料或组合已变化')), 'the refusal must be saved, not just printed');
  assert.equal(output.cases.length, 8); assert.ok(output.cases.every((c: EvalCase) => c.outcome === 'not-run'));
  assert.equal(output.controls.length, 0, 'an invalid comparison must stop before any provider or website calls');
  assert.ok((await readFile(path.join(after, 'review/mixed/prompt.txt'), 'utf8')).includes('独立页面盲评者'));
});
