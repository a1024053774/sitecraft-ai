import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { localEndpoint } from '../scripts/local-endpoint.ts';

// T-167: health must report the configured root, and a mismatched caller must
// fail before any test writes. The expected directory comes from the caller.
const base = localEndpoint('SITECRAFT_BASE').origin;
test('T-167: the dev server and test process share an explicit isolated data root', async () => {
  assert.ok(process.env.SITECRAFT_DATA_ROOT);
  const root = path.resolve(process.env.SITECRAFT_DATA_ROOT);
  assert.notEqual(root, path.join(process.cwd(), '.sitecraft-data'));
  const response = await fetch(`${base}/api/health`);
  assert.ok([200, 503].includes(response.status));
  const health = await response.json();
  assert.equal(health.testIdentity?.cwd, process.cwd());
  assert.equal(health.testIdentity?.dataRoot, root);
});

test('T-167: a mismatched data root refuses the browser test entry', async () => {
  const env: NodeJS.ProcessEnv = { ...process.env, SITECRAFT_BASE: base, SITECRAFT_DATA_ROOT: path.resolve('artifacts/t167/incorrect-root') };
  // Node 26 otherwise skips a nested test runner and returns zero without
  // executing t083. This child must be an independent test invocation.
  delete env.NODE_TEST_CONTEXT;
  const child = spawn(process.execPath, ['--test', '--experimental-strip-types', 'tests/t083-browser-base.test.ts'], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const completion = once(child, 'exit');
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const [code] = await completion;
  await mkdir('artifacts/t167', { recursive: true });
  await writeFile(`artifacts/t167/mismatch-${crypto.randomUUID()}.log`, output, 'utf8');
  assert.match(output, /browser base serves the current workspace/, '子进程必须实际执行身份检查');
  assert.notEqual(code, 0, '数据根不一致时必须拒绝，不能只核对 cwd');
  assert.match(output, /数据根不一致/);
});
