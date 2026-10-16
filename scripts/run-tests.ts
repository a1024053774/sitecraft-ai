import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkTestIdentity } from './test-identity.ts';

delete process.env.NODE_TEST_CONTEXT;
const dataRoot = await mkdtemp(path.join(tmpdir(), 'sitecraft-test-'));
const output = path.resolve('artifacts/t167', `test-run-${Date.now()}-${process.pid}`);
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
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '0'], {
  env, stdio: ['ignore', 'pipe', 'pipe'],
});
const serverClosed = once(server, 'close');
let serverOutput = '';
server.stdout!.on('data', chunk => { serverOutput += chunk; });
server.stderr!.on('data', chunk => { serverOutput += chunk; });
const serverLog = createWriteStream(path.join(output, 'dev.log'));
server.stdout!.pipe(serverLog, { end: false }); server.stderr!.pipe(serverLog, { end: false });
server.once('close', () => serverLog.end());
const serverFailure = serverClosed.then(([code, signal]) => { throw new Error(`测试 dev server 提前退出（code=${code}, signal=${signal}）`); });
let tests: ChildProcess | undefined, testCode: number | null = null, identity: unknown, base: string | undefined;
let executed: number | null = null, passed = false;
let startupFailed = false, startupCause: unknown;
const stop = () => { tests?.kill('SIGTERM'); server.kill('SIGTERM'); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
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
  process.off('SIGINT', stop); process.off('SIGTERM', stop);
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ at: new Date().toISOString(),
    command: ['npm', 'test', '--', ...process.argv.slice(2)], base, dataRoot, distDir, identity, testCode,
    executed, status: passed ? 'PASS' : 'INCOMPLETE',
    ...(startupFailed ? { startupError: `测试服务启动或身份核对失败：${startupCause instanceof Error ? startupCause.message : String(startupCause)}\n${serverOutput}\n日志：${path.join(output, 'dev.log')}` } : {}) }, null, 2) + '\n', 'utf8');
}
if (startupFailed) throw new Error(`测试服务启动或身份核对失败：${startupCause instanceof Error ? startupCause.message : String(startupCause)}\n${serverOutput}\n日志：${path.join(output, 'dev.log')}`, { cause: startupCause });
