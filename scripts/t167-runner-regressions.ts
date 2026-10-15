import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// Run separately from the full suite: these cases own the real npm test entry
// and its dev server. They cannot share the full suite's live Next dev lock.
const project = fileURLToPath(new URL('../', import.meta.url));
async function run(args: string[], context: string | undefined) {
  const env: NodeJS.ProcessEnv = { ...process.env, DEEPSEEK_API_KEY: '', AI_API_KEY: '' };
  if (context === undefined) delete env.NODE_TEST_CONTEXT; else env.NODE_TEST_CONTEXT = context;
  const child = spawn('npm', ['test', '--', ...args], { cwd: project, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const completed = once(child, 'exit'); let output = '';
  child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
  const [code] = await completed;
  const out = path.join(project, 'artifacts/t167', `runner-regression-${crypto.randomUUID()}`);
  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, 'output.log'), output, 'utf8');
  await writeFile(path.join(out, 'report.json'), JSON.stringify({ at: new Date().toISOString(), args, context, code }, null, 2) + '\n', 'utf8');
  const match = output.match(/证据目录：([^\n]+)\n/);
  const report = match ? JSON.parse(await readFile(path.join(match[1], 'report.json'), 'utf8')) : undefined;
  return { output, code, out, report };
}

test('T-167 P2: inherited NODE_TEST_CONTEXT cannot silently skip the real test entry', async t => {
  const result = await run(['tests/conversation-store.test.ts'], 'child-v8');
  t.diagnostic(`保留证据：${result.out}`);
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /creates a conversation, persists a turn, and rereads the same turns/, '真实业务用例必须执行');
  assert.doesNotMatch(result.output, /skipping running files/);
  assert.ok(result.report.executed > 0, '实际执行数必须有独立的 Node 统计');
  assert.equal(result.report.status, 'PASS');
});

test('T-167 P2: no matching test bodies must fail even when Node counts a file wrapper', async t => {
  const result = await run(['--test-name-pattern=^t167-no-matching-case$', 'tests/conversation-store.test.ts'], undefined);
  t.diagnostic(`保留证据：${result.out}`);
  assert.notEqual(result.code, 0, '没有实际执行用例的结果不得报通过');
  assert.match(result.output, /零用例/);
  assert.equal(result.report.executed, 0);
  assert.notEqual(result.report.status, 'PASS');
});

test('T-167: the standard entry coexists with an ordinary dev server in the same worktree', { timeout: 120000 }, async t => {
  const ordinaryRoot = await mkdtemp(path.join(tmpdir(), 't167-ordinary-'));
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'test', SITE_STORE: 'fs', SITECRAFT_DATA_ROOT: ordinaryRoot,
    DEEPSEEK_API_KEY: '', AI_API_KEY: '' };
  delete env.NODE_TEST_CONTEXT; delete env.SITECRAFT_TEST_DIST_DIR; delete env.SITECRAFT_TEST_IDENTITY_FILE;
  const ordinary = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '0'], {
    cwd: project, env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const closed = once(ordinary, 'exit'); let logs = '';
  ordinary.stdout.on('data', chunk => { logs += chunk; }); ordinary.stderr.on('data', chunk => { logs += chunk; });
  const out = path.join(project, 'artifacts/t167', `coexisting-dev-${crypto.randomUUID()}`);
  await mkdir(out, { recursive: true });
  let base: string | undefined, result: Awaited<ReturnType<typeof run>> | undefined;
  try {
    base = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`普通服务启动超时：${logs}`)), 60000);
      ordinary.stdout.on('data', () => {
        const match = logs.match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/);
        if (match && /Ready in/.test(logs)) { clearTimeout(timer); resolve(match[1]); }
      });
      ordinary.once('exit', () => { clearTimeout(timer); reject(new Error(logs)); });
      ordinary.once('error', error => { clearTimeout(timer); reject(error); });
    });
    const before = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(60000) }).then(response => response.json());
    assert.equal(before.testIdentity.dataRoot, ordinaryRoot);
    result = await run(['tests/conversation-store.test.ts'], undefined);
    assert.equal(ordinary.exitCode, null, '入口不能停止普通服务');
    const after = await fetch(`${base}/api/health`).then(response => response.json());
    assert.equal(after.testIdentity.dataRoot, ordinaryRoot, '普通服务端口及数据根保持原值');
    assert.equal(result.code, 0, result.output);
    assert.ok(result.report.executed > 0);
    assert.notEqual(result.report.base, base, '测试不能复用普通服务');
    assert.notEqual(result.report.dataRoot, ordinaryRoot);
    t.diagnostic(`普通服务与标准入口证据：${out}`);
  } finally {
    if (ordinary.exitCode === null) ordinary.kill('SIGTERM');
    await closed;
    await writeFile(path.join(out, 'ordinary.log'), logs, 'utf8');
    await writeFile(path.join(out, 'report.json'), JSON.stringify({ at: new Date().toISOString(), base, ordinaryRoot,
      ordinaryPid: ordinary.pid, testCode: result?.code, testReport: result?.report }, null, 2) + '\n', 'utf8');
  }
});

test('T-167: startup failure reports the Next cause and its log instead of bare fetch failed', { timeout: 120000 }, async t => {
  const cache = path.join(project, '.next-test');
  const backup = path.join(project, 'artifacts/t167', `cache-backup-${crypto.randomUUID()}`);
  const existed = existsSync(cache);
  if (existed) await rename(cache, backup);
  await writeFile(cache, '故意阻止测试构建目录的目录创建\n', 'utf8');
  try {
    const result = await run(['tests/conversation-store.test.ts'], undefined);
    t.diagnostic(`启动失败证据：${result.out}`);
    assert.notEqual(result.code, 0);
    assert.match(result.output, /测试服务启动或身份核对失败/);
    assert.match(result.output, /ENOTDIR|not a directory|不是目录/);
    assert.match(result.output, /dev\.log/);
    assert.equal(result.report.status, 'INCOMPLETE');
    assert.match(result.report.startupError, /ENOTDIR|not a directory|不是目录/);
  } finally {
    await unlink(cache);
    if (existed) await rename(backup, cache);
  }
});
