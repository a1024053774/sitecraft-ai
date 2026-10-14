import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { localEndpoint } from '../scripts/local-endpoint.ts';

// A draft response is disconnected after the production handler returns.
// The CLI must identify the local fetch boundary and preserve the cause; it
// must not issue another select/confirm to hide the failed observation.
test('标准评估 CLI 保存断开的状态读取端点、阶段及 socket 错误，不重发生成', async () => {
  localEndpoint('SITECRAFT_BASE');
  const folder = path.resolve('artifacts/t159', `http-contract-${crypto.randomUUID()}`); await mkdir(folder, { recursive: true });
  const args = ['--experimental-strip-types', 'tests/fixtures/t159-entry.ts'];
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 30000,
    env: { ...process.env, SITECRAFT_EVAL_STYLES: 'neighborly', T159_PENDING_CATALOG: '1', T159_ENTRY_OUT: folder, T159_DROP_READ: '1' } });
  await writeFile(path.join(folder, 'process.json'), JSON.stringify({ args, status: result.status, stdout: result.stdout, stderr: result.stderr }, null, 2), 'utf8');
  assert.equal(result.status, 0, result.stderr);
  const wire = JSON.parse(await readFile(path.join(folder, 'entry.json'), 'utf8'));
  assert.equal(wire.exit, 1); assert.equal(wire.round.cases[0].error, 'fetch failed');
  assert.equal(wire.routes.filter((route: any) => route.body?.action === 'select').length, 1);
  assert.equal(wire.routes.filter((route: any) => route.body?.action === 'confirm').length, 0);
  const requests = JSON.parse(await readFile(path.join(folder, 'eval/private/http-requests.json'), 'utf8'));
  const failed = requests.filter((entry: any) => entry.error);
  assert.equal(failed.length, 1);
  assert.match(failed[0].endpoint, /^\/api\/sites\/[^/]+\/draft$/);
  assert.equal(failed[0].method, 'GET'); assert.equal(failed[0].phase, 'fetch');
  assert.equal(failed[0].status, null); assert.equal(failed[0].error.cause.code, 'UND_ERR_SOCKET');
  assert.equal(typeof failed[0].durationMs, 'number');
});
