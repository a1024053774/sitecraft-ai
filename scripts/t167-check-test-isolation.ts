import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createWriteStream } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// --parent reproduces the old standard command against this worktree alone.
// The protected directory is always this cwd, never the real main workspace.
const parent = process.argv.includes('--parent');
if (parent) {
  const manifest = JSON.parse(await readFile('package.json', 'utf8'));
  assert.equal(manifest.scripts.test, 'node --test --experimental-strip-types tests/*.test.ts', '--parent 只用于父版本标准入口');
}
const output = path.resolve('artifacts/t167', `${parent ? 'parent-red' : 'isolated'}-${Date.now()}`);
const protectedRoot = path.resolve('.sitecraft-data');
await mkdir(output, { recursive: true });
async function count() {
  try { return (await readdir(path.join(protectedRoot, 'code-sites'))).filter(name => name.endsWith('.json')).length; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0; throw error; }
}
const before = await count();
let server: ChildProcess | undefined, testCode: number | null = null;
const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'test', SITE_STORE: 'fs', DEEPSEEK_API_KEY: '', AI_API_KEY: '' };
try {
  if (parent) {
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '0'], {
      env: { ...env, SITECRAFT_DATA_ROOT: protectedRoot }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    const log = createWriteStream(path.join(output, 'dev.log'));
    server.stdout!.pipe(log, { end: false }); server.stderr!.pipe(log, { end: false });
    server.once('exit', () => log.end());
    env.SITECRAFT_BASE = await new Promise<string>((resolve, reject) => {
      let text = ''; const timer = setTimeout(() => reject(new Error('父版本服务启动超时')), 60000);
      server!.stdout!.on('data', chunk => {
        text += chunk;
        const match = text.match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/);
        if (match && /Ready in/.test(text)) { clearTimeout(timer); resolve(match[1]); }
      });
      server!.once('error', error => { clearTimeout(timer); reject(error); });
      server!.once('exit', () => { clearTimeout(timer); reject(new Error('父版本服务提前退出')); });
    });
    env.SITECRAFT_DATA_ROOT = protectedRoot;
  }
  const child = spawn('npm', ['test'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  const completion = once(child, 'exit');
  const log = createWriteStream(path.join(output, 'npm-test.log'));
  child.stdout!.pipe(log, { end: false }); child.stderr!.pipe(log, { end: false });
  child.stdout!.pipe(process.stdout); child.stderr!.pipe(process.stderr);
  [testCode] = await completion; log.end(); await once(log, 'finish');
} finally {
  if (server && server.exitCode === null) { const closed = once(server, 'exit'); server.kill('SIGTERM'); await closed; }
  const after = await count();
  const report = { at: new Date().toISOString(), command: `node --experimental-strip-types scripts/t167-check-test-isolation.ts${parent ? ' --parent' : ''}`,
    protectedRoot, before, after, testCode, countUnchanged: before === after };
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(`T-167 数量对照：${before} → ${after}；证据：${output}`);
  assert.equal(after, before, '标准全量不得向受保护目录增加 code-sites');
}
assert.equal(testCode, 0, '标准全量必须通过');
