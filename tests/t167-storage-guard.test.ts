import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const project = fileURLToPath(new URL('../', import.meta.url));
async function probe(args: string[], env: NodeJS.ProcessEnv, cwd: string, label: string) {
  const child = spawn(process.execPath, args, { env, cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  const completed = once(child, 'exit'); let output = '';
  child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
  const [code] = await completed;
  const files = (await readdir(cwd, { recursive: true })).filter(file => file.endsWith('.json'));
  const out = path.join(project, 'artifacts/t167', `${label}-${crypto.randomUUID()}`);
  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, 'output.log'), output, 'utf8');
  await writeFile(path.join(out, 'report.json'), JSON.stringify({ at: new Date().toISOString(), cwd, args, code, files }, null, 2) + '\n', 'utf8');
  return { code, files, output, out };
}
function environment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'test', SITE_STORE: 'fs', DEEPSEEK_API_KEY: '', AI_API_KEY: '' };
  delete env.NODE_TEST_CONTEXT; delete env.SITECRAFT_DATA_ROOT; delete env.SITECRAFT_TEST_IDENTITY_FILE;
  return env;
}

test('T-167 P1: raw node --test without a data root refuses before creating any default JSON', async t => {
  const cwd = await mkdtemp(path.join(tmpdir(), 't167-unconfigured-'));
  const result = await probe(['--test', '--experimental-strip-types', path.join(project, 'tests/conversation-store.test.ts')], environment(), cwd, 'raw-unconfigured');
  t.diagnostic(`保留证据：${result.out}`);
  assert.equal(result.files.length, 0, '必须在第一个 JSON 写入前拒绝，不能等清理失败');
  assert.notEqual(result.code, 0);
  assert.match(result.output, /测试存储/);
});

test('T-167 P1: an explicit but unverified root cannot write; ordinary development still can', async t => {
  const cwd = await mkdtemp(path.join(tmpdir(), 't167-unverified-'));
  const script = `const m = await import(${JSON.stringify(pathToFileURL(path.join(project, 'lib/conversation-store.ts')).href)}); await m.createConversation('t167-explicit-root');`;
  const args = ['--experimental-strip-types', '--input-type=module', '-e', script];
  const devCwd = await mkdtemp(path.join(tmpdir(), 't167-development-'));
  const development = await probe(args, { ...environment(), NODE_ENV: 'development' }, devCwd, 'normal-development');
  assert.equal(development.code, 0, development.output);
  assert.equal(development.files.length, 1, '普通开发仍按原合同使用默认目录');
  const result = await probe(args, { ...environment(), SITECRAFT_DATA_ROOT: path.join(cwd, 'unverified') }, cwd, 'raw-unverified');
  t.diagnostic(`保留证据：${result.out}`);
  assert.equal(result.files.length, 0, '仅设置目录不足以获得测试写入许可');
  assert.notEqual(result.code, 0);
  assert.match(result.output, /测试存储/);
});
