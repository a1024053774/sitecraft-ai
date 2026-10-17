import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { closeSync, createWriteStream, openSync, unlinkSync } from 'node:fs';
import { lstat, mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkTestIdentity } from './test-identity.ts';

delete process.env.NODE_TEST_CONTEXT;
// Only completed successful runs expire. Failed, interrupted and malformed
// reports remain evidence, even when that requires more than five directories.
const project = await realpath(fileURLToPath(new URL('../', import.meta.url)));
assert.equal(await realpath(process.cwd()), project, '测试入口工作树与当前目录不一致，拒绝清理或启动');
const artifacts = path.join(project, 'artifacts'), runRoot = path.join(artifacts, 't167');
for (const directory of [artifacts, runRoot]) {
  await mkdir(directory, { recursive: true });
  assert.ok((await lstat(directory)).isDirectory(), `测试证据目录不能是符号链接：${directory}`);
}
const lockPath = path.join(runRoot, '.run-tests.lock');
let lock: number;
try { lock = openSync(lockPath, 'wx'); }
catch (error) {
  if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error(`已有测试入口持有工作树锁，拒绝启动：${lockPath}`, { cause: error });
  throw error;
}
const releaseLock = () => { unlinkSync(lockPath); closeSync(lock); };
process.once('exit', releaseLock);
let runningServer: ChildProcess | undefined, tests: ChildProcess | undefined, interrupted = false;
const stop = () => { interrupted = true; tests?.kill('SIGTERM'); runningServer?.kill('SIGTERM'); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
try {
  const previous = (await readdir(runRoot, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && /^test-run-\d+-\d+$/.test(entry.name))
    .sort((a, b) => Number(b.name.split('-')[2]) - Number(a.name.split('-')[2]) || b.name.localeCompare(a.name));
  for (const [index, entry] of previous.entries()) {
    const directory = path.join(runRoot, entry.name);
    assert.equal(path.dirname(directory), runRoot, '只能清理本工作树的测试轮目录');
    assert.equal(await realpath(directory), directory, '不能沿符号链接清理测试证据');
    let status: unknown;
    try { status = JSON.parse(await readFile(path.join(directory, 'report.json'), 'utf8'))?.status; }
    catch (error) {
      if (!(error instanceof SyntaxError) && (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (status !== 'PASS') console.log(`失败或未完成证据保留：${directory}`);
    // The new run occupies one of the latest five slots, regardless of outcome.
    else if (index >= 4) await rm(directory, { recursive: true });
  }
  assert.ok(!interrupted, '测试入口已取消，拒绝启动');
  const dataRoot = await mkdtemp(path.join(tmpdir(), 'sitecraft-test-'));
  const output = path.join(runRoot, `test-run-${Date.now()}-${process.pid}`);
  const distDir = '.next-test';
  await mkdir(output, { recursive: true });
  await mkdir(path.join(output, 'checks'));
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'test', SITE_STORE: 'fs', SITECRAFT_DATA_ROOT: dataRoot,
    SITECRAFT_CHECK_DIAGNOSTICS_DIR: path.join(output, 'checks'),
    SITECRAFT_TEST_IDENTITY_FILE: path.join(dataRoot, '.test-identity.json'),
    SITECRAFT_TEST_DIST_DIR: distDir,
    DEEPSEEK_API_KEY: '', AI_API_KEY: '' };
  delete env.SITECRAFT_BASE;
  console.log(`证据目录：${output}`);
  assert.ok(!interrupted, '测试入口已取消，拒绝启动');
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '0'], {
    env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  runningServer = server;
  const serverClosed = once(server, 'close');
  let serverOutput = '';
  server.stdout!.on('data', chunk => { serverOutput += chunk; });
  server.stderr!.on('data', chunk => { serverOutput += chunk; });
  const serverLog = createWriteStream(path.join(output, 'dev.log'));
  server.stdout!.pipe(serverLog, { end: false }); server.stderr!.pipe(serverLog, { end: false });
  server.once('close', () => serverLog.end());
  const serverFailure = serverClosed.then(([code, signal]) => { throw new Error(`测试 dev server 提前退出（code=${code}, signal=${signal}）`); });
  let testCode: number | null = null, identity: unknown, base: string | undefined;
  let executed: number | null = null, passed = false;
  let startupFailed = false, startupCause: unknown;
  try {
    base = await Promise.race([new Promise<string>((resolve, reject) => {
      let text = ''; const timer = setTimeout(() => reject(new Error('测试 dev server 启动超时')), 60000);
      server.stdout!.on('data', chunk => {
        text += chunk;
        const match = text.match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/);
        if (match && /Ready in/.test(text)) { clearTimeout(timer); resolve(match[1]); }
      });
      server.once('error', error => { clearTimeout(timer); reject(error); });
      server.once('exit', () => { clearTimeout(timer); reject(new Error('测试 dev server 提前退出')); });
    }), serverFailure]);
    process.env.SITECRAFT_BASE = base;
    process.env.SITECRAFT_DATA_ROOT = dataRoot;
    // Run this before spawning workers: test module imports can already write.
    identity = await Promise.race([checkTestIdentity(), serverFailure]);
    await writeFile(env.SITECRAFT_TEST_IDENTITY_FILE!, JSON.stringify(identity) + '\n', 'utf8');
    console.log(`测试数据根：${dataRoot}\n测试构建目录：${distDir}\n测试服务：${base}`);
    const args = process.argv.slice(2);
    const files = args.some(arg => arg.endsWith('.test.ts')) ? []
      : (await readdir('tests')).filter(name => name.endsWith('.test.ts')).sort().map(name => `tests/${name}`);
    const summaryFile = path.join(output, 'summaries.ndjson');
    tests = spawn(process.execPath, ['--test', '--experimental-strip-types',
      '--test-reporter=spec', `--test-reporter=${path.resolve('scripts/test-summary-reporter.mjs')}`,
      '--test-reporter-destination=stdout', `--test-reporter-destination=${summaryFile}`, ...args, ...files], {
      env: { ...env, SITECRAFT_BASE: base }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    const completed = once(tests, 'exit');
    const testLog = createWriteStream(path.join(output, 'tests.log'));
    tests.stdout!.pipe(testLog, { end: false }); tests.stderr!.pipe(testLog, { end: false });
    tests.stdout!.pipe(process.stdout); tests.stderr!.pipe(process.stderr);
    [testCode] = await completed; testLog.end(); await once(testLog, 'finish');
    const summaries = (await readFile(summaryFile, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    executed = summaries.reduce((total: number, summary) => total + summary.counts.tests - summary.counts.skipped - summary.counts.cancelled - summary.counts.todo, 0);
    assert.equal(testCode, 0, '测试失败，保留本轮日志与临时数据根');
    assert.ok(typeof executed === 'number' && executed > 0, '零用例：没有实际执行的测试，拒绝报通过');
    passed = true;
  } catch (error) {
    if (tests) throw error;
    startupFailed = true; startupCause = error;
  } finally {
    if (server.exitCode === null) server.kill('SIGTERM');
    await serverClosed;
    await writeFile(path.join(output, 'report.json'), JSON.stringify({ at: new Date().toISOString(),
      command: ['npm', 'test', '--', ...process.argv.slice(2)], base, dataRoot, distDir, identity, testCode,
      executed, status: passed ? 'PASS' : 'INCOMPLETE',
      ...(startupFailed ? { startupError: `测试服务启动或身份核对失败：${startupCause instanceof Error ? startupCause.message : String(startupCause)}\n${serverOutput}\n日志：${path.join(output, 'dev.log')}` } : {}) }, null, 2) + '\n', 'utf8');
    if (!passed) console.error(`失败证据保留：${output}\n失败数据根保留：${dataRoot}`);
  }
  if (startupFailed) throw new Error(`测试服务启动或身份核对失败：${startupCause instanceof Error ? startupCause.message : String(startupCause)}\n${serverOutput}\n日志：${path.join(output, 'dev.log')}`, { cause: startupCause });
} finally {
  process.off('SIGINT', stop); process.off('SIGTERM', stop);
  releaseLock(); process.off('exit', releaseLock);
}
