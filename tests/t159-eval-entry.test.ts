import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { localEndpoint } from '../scripts/local-endpoint.ts';

// Failure modes: registered pending IDs never reach select; a client enables
// candidates; the server flag enables ready/unknown IDs; invalid config waits
// until the first request instead of stopping actual Next startup.
test('真实 CLI→HTTP→chat：隔离的 pending 目录样本继续由服务端变量控制准入', async () => {
  localEndpoint('SITECRAFT_BASE');
  const folder = path.resolve('artifacts/t159', `entry-contract-${crypto.randomUUID()}`);
  await mkdir(folder, { recursive: true });
  const dataRoot = path.join(process.env.SITECRAFT_DATA_ROOT!, path.basename(folder));
  let savedStyleSite = '';
  for (const mode of ['off', 'on', 'reopened']) {
    const out = path.join(folder, mode);
    const env: NodeJS.ProcessEnv = { ...process.env, T159_ENTRY_OUT: out, T159_PENDING_CATALOG: '1', T159_ENTRY_DATA_ROOT: path.join(dataRoot, mode === 'reopened' ? 'on' : mode) };
    if (mode === 'on') env.SITECRAFT_EVAL_STYLES = 'neighborly'; else delete env.SITECRAFT_EVAL_STYLES;
    if (mode === 'reopened') env.T159_ENTRY_EXISTING_SITE = savedStyleSite;
    const run = spawnSync(process.execPath, ['--experimental-strip-types', 'tests/fixtures/t159-entry.ts'], { env, encoding: 'utf8', timeout: 30000 });
    await writeFile(path.join(folder, `${mode}-process.json`), JSON.stringify({ status: run.status, stdout: run.stdout, stderr: run.stderr, error: run.error?.message }, null, 2), 'utf8');
    assert.equal(run.status, 0, run.stderr);
    const evidence = JSON.parse(await readFile(path.join(out, 'entry.json'), 'utf8'));
    const selected = evidence.routes.find((route: any) => route.body?.action === 'select');
    assert.ok(selected, 'CLI 须实际发送选择请求');
    assert.equal(selected.status, mode === 'on' ? 202 : 400);
    const planCalls = evidence.modelRequests.filter((body: any) => body.tools?.[0]?.function.name === 'submit_page_plan');
    assert.equal(planCalls.length, mode === 'on' ? 1 : 0, '仅成功 select 后进入生产规划');
    if (mode === 'on') {
      assert.deepEqual(planCalls[0].tools[0].function.parameters.properties.style.enum, ['neighborly']);
      assert.ok(planCalls[0].messages[0].content.includes('name: site-code-neighborly'));
      assert.equal(evidence.round.cases[0].modelCalls[0].purpose, 'plan');
      savedStyleSite = evidence.savedStyleSite;
      assert.ok(savedStyleSite);
    } else if (mode === 'reopened') {
      assert.deepEqual(evidence.reopened.visibleOptions, ['auto', 'precision', 'documentary', 'editorial']);
      assert.equal(evidence.reopened.selectStatus, 400, '旧评估会话或客户端字段不能在普通进程保留候选授权');
    }
  }
});

for (const id of ['not_registered', 'neighborly,not_registered', 'precision', 'neighborly']) test(`实际 Next 启动拒绝非 pending 配置：${id}`, async () => {
  localEndpoint('SITECRAFT_BASE');
  const folder = path.resolve('artifacts/t159', `startup-contract-${crypto.randomUUID()}`);
  await mkdir(folder, { recursive: true });
  const probe = createServer(); await new Promise<void>(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = (probe.address() as any).port; await new Promise<void>(resolve => probe.close(() => resolve()));
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    env: { ...process.env, SITE_STORE: 'fs', SITECRAFT_EVAL_STYLES: id, SITECRAFT_DATA_ROOT: path.join(process.env.SITECRAFT_DATA_ROOT!, path.basename(folder)) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '', ready = false;
  const closed = new Promise<number | null>(resolve => child.once('close', resolve));
  const timer = setTimeout(() => child.kill('SIGTERM'), 15000);
  // Next 16.3 logs Ready before loading config/instrumentation. Observe the
  // startup error and natural exit without sending the first HTTP request.
  for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { output += data; if (output.includes('Ready in')) ready = true; });
  const exit = await closed; clearTimeout(timer);
  await writeFile(path.join(folder, 'result.json'), JSON.stringify({ id, port, exit, ready, output }, null, 2), 'utf8');
  assert.equal(exit, 1, '未知或非 pending id 须在没有收到首个请求时自然退出');
  assert.ok(output.includes('SITECRAFT_EVAL_STYLES'), output);
});
