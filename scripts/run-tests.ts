import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkTestIdentity } from './test-identity.ts';

const dataRoot = await mkdtemp(path.join(tmpdir(), 'sitecraft-test-'));
const output = path.resolve('artifacts/t167', `test-run-${Date.now()}-${process.pid}`);
await mkdir(output, { recursive: true });
const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'test', SITE_STORE: 'fs', SITECRAFT_DATA_ROOT: dataRoot,
  DEEPSEEK_API_KEY: '', AI_API_KEY: '' };
delete env.SITECRAFT_BASE;
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '0'], {
  env, stdio: ['ignore', 'pipe', 'pipe'],
});
const serverClosed = once(server, 'exit');
const serverLog = createWriteStream(path.join(output, 'dev.log'));
server.stdout!.pipe(serverLog, { end: false }); server.stderr!.pipe(serverLog, { end: false });
server.once('exit', () => serverLog.end());
let tests: ChildProcess | undefined, testCode: number | null = null, identity: unknown, base: string | undefined;
const stop = () => { tests?.kill('SIGTERM'); server.kill('SIGTERM'); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
try {
  base = await new Promise<string>((resolve, reject) => {
    let text = ''; const timer = setTimeout(() => reject(new Error('测试 dev server 启动超时')), 60000);
    server.stdout!.on('data', chunk => {
      text += chunk;
      const match = text.match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/);
      if (match && /Ready in/.test(text)) { clearTimeout(timer); resolve(match[1]); }
    });
    server.once('error', error => { clearTimeout(timer); reject(error); });
    server.once('exit', () => { clearTimeout(timer); reject(new Error('测试 dev server 提前退出')); });
  });
  process.env.SITECRAFT_BASE = base;
  process.env.SITECRAFT_DATA_ROOT = dataRoot;
  // Run this before spawning workers: test module imports can already write.
  identity = await checkTestIdentity();
  console.log(`测试数据根：${dataRoot}\n测试服务：${base}\n证据目录：${output}`);
  const args = process.argv.slice(2);
  const files = args.some(arg => arg.endsWith('.test.ts')) ? []
    : (await readdir('tests')).filter(name => name.endsWith('.test.ts')).sort().map(name => `tests/${name}`);
  tests = spawn(process.execPath, ['--test', '--experimental-strip-types', ...args, ...files], {
    env: { ...env, SITECRAFT_BASE: base }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const completed = once(tests, 'exit');
  const testLog = createWriteStream(path.join(output, 'tests.log'));
  tests.stdout!.pipe(testLog, { end: false }); tests.stderr!.pipe(testLog, { end: false });
  tests.stdout!.pipe(process.stdout); tests.stderr!.pipe(process.stderr);
  [testCode] = await completed; testLog.end(); await once(testLog, 'finish');
  assert.equal(testCode, 0, '测试失败，保留本轮日志与临时数据根');
} finally {
  if (server.exitCode === null) server.kill('SIGTERM');
  await serverClosed;
  process.off('SIGINT', stop); process.off('SIGTERM', stop);
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ at: new Date().toISOString(),
    command: ['npm', 'test', '--', ...process.argv.slice(2)], base, dataRoot, identity, testCode }, null, 2) + '\n', 'utf8');
}
