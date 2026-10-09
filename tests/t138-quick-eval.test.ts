import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

// Exercise the CLI, stopping at an incompatible previous corpus before any
// network operation. A missing flag, eight cases, stale full-page instructions
// or silent pairing with full runs must fail this contract.
test('quick CLI constructs four two-page cases and refuses full-run pairing', async () => {
  const directory = path.resolve('artifacts/t138', `quick-${crypto.randomUUID()}`), before = path.join(directory, 'before'), after = path.join(directory, 'after');
  await mkdir(path.join(before, 'private'), { recursive: true });
  await writeFile(path.join(before, 'private/round.json'), JSON.stringify({ cases: [] }), 'utf8');
  const args = ['--experimental-strip-types', 'scripts/eval-new-route.ts', '--quick', '--prepare-only', '--previous', before, '--out', after];
  const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
  await writeFile(path.join(directory, 'command-result.txt'), JSON.stringify({ args, status: result.status, stdout: result.stdout, stderr: result.stderr }, null, 2), 'utf8');
  assert.doesNotMatch(result.stderr, /ERR_PARSE_ARGS_UNKNOWN_OPTION/, 'the quick profile must be accepted by the real CLI');
  const round = JSON.parse(await readFile(path.join(after, 'private/round.json'), 'utf8'));
  assert.equal(result.status, 1);
  assert.equal(round.profile, 'quick');
  assert.deepEqual(round.cases.map((c: { key: string }) => c.key), ['industrial/precision', 'export/documentary', 'molding/precision', 'packaging/documentary']);
  assert.ok(round.cases.every((c: { materials: string; outcome: string }) => c.outcome === 'not-run' && c.materials.includes('首页（home）、产品（products）两个独立页面') && !/页面要求：.*[三四五]个独立页面/.test(c.materials)));
  assert.ok(round.errors.some((e: string) => e.includes('资料或组合已变化')));
  assert.equal(round.controls.length, 0);
});

test('only CLI selects the requested quick pair without changing its materials', async () => {
  const directory = path.resolve('artifacts/t138b', `only-${crypto.randomUUID()}`), before = path.join(directory, 'before'), after = path.join(directory, 'after');
  await mkdir(path.join(before, 'private'), { recursive: true });
  await writeFile(path.join(before, 'private/round.json'), JSON.stringify({ cases: [] }), 'utf8');
  const args = ['--experimental-strip-types', 'scripts/eval-new-route.ts', '--quick', '--only', 'industrial/precision,packaging/documentary', '--prepare-only', '--previous', before, '--out', after];
  const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
  await writeFile(path.join(directory, 'command-result.txt'), JSON.stringify({ args, status: result.status, stdout: result.stdout, stderr: result.stderr }, null, 2), 'utf8');
  assert.doesNotMatch(result.stderr, /ERR_PARSE_ARGS_UNKNOWN_OPTION/, 'the only selection must be accepted by the real CLI');
  const round = JSON.parse(await readFile(path.join(after, 'private/round.json'), 'utf8'));
  assert.equal(result.status, 1);
  assert.equal(round.profile, 'quick');
  assert.deepEqual(round.cases.map((c: { key: string }) => c.key), ['industrial/precision', 'packaging/documentary']);
  assert.ok(round.cases.every((c: { materials: string; outcome: string }) => c.outcome === 'not-run' && c.materials.includes('首页（home）、产品（products）两个独立页面')));
  assert.ok(round.errors.some((e: string) => e.includes('资料或组合已变化')));
  assert.equal(round.controls.length, 0);
  const all = path.join(directory, 'all');
  spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/eval-new-route.ts', '--quick', '--prepare-only', '--previous', before, '--out', all], { encoding: 'utf8' });
  const unfiltered = JSON.parse(await readFile(path.join(all, 'private/round.json'), 'utf8'));
  for (const c of round.cases) assert.equal(c.materials, unfiltered.cases.find((a: { key: string }) => a.key === c.key).materials);
  for (const selection of ['', 'industrial/precision,industrial/precision', 'industrial/documentary', 'unknown/precision']) {
    const invalid = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/eval-new-route.ts', '--quick', '--only', selection, '--prepare-only', '--out', path.join(directory, `invalid-${crypto.randomUUID()}`)], { encoding: 'utf8' });
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /only/, 'invalid selection must fail before network work');
  }
});
