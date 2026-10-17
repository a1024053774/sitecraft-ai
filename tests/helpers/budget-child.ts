import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { localEndpoint } from '../../scripts/local-endpoint.ts';

// 运行真实网关，只有提供者传输由既有 preload 指向本地替身。
export async function budgetChild(upstream: string, folder: string) {
  localEndpoint('SITECRAFT_BASE');
  const probe = createServer();
  await new Promise<void>(resolve => probe.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(probe.address() as { port: number }).port}`;
  await new Promise<void>(resolve => probe.close(() => resolve()));
  const child = spawn(process.execPath, ['--experimental-strip-types', '--import', './tests/fixtures/t165-upstream.mjs', 'scripts/t153-real-budget.ts'], {
    env: { ...process.env, SITECRAFT_FIXTURE_BASE: upstream, SITECRAFT_BUDGET_BASE: base, SITECRAFT_TOKEN_LIMIT: '30000', T153_BUDGET_DIR: folder,
      DEEPSEEK_API_KEY: 'local-intercept-only', DEEPSEEK_MODEL: 'deepseek-flash', DEEPSEEK_BASE_URL: 'https://api.deepseek.com' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = once(child, 'close');
  let output = '';
  const close = async () => {
    if (child.exitCode === null) child.kill('SIGTERM');
    await exited;
    await writeFile(path.join(folder, 'gateway.log'), output, 'utf8');
  };
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(output || '预算网关启动超时')), 10000);
      child.stdout.on('data', data => { output += data; if (output.includes('approved cumulative budget')) { clearTimeout(timer); resolve(); } });
      child.stderr.on('data', data => { output += data; });
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', () => { clearTimeout(timer); reject(new Error(output)); });
    });
    const response = await fetch(`${base}/round`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"label":"default","estimate":30000}' });
    assert.equal(response.status, 200);
    return { base, close, ledger: async () => JSON.parse(await readFile(path.join(folder, 'usage.json'), 'utf8')) };
  } catch (error) { await close(); throw error; }
}
