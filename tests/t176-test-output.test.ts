import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, readdir, stat, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

// Failure modes: keep a sixth successful run; erase a failed/interrupted run;
// traverse an artifacts/run symlink; remove unrelated data; omit failure paths.
// Only Next is a small health server fixture. The entry, Node test runner,
// report writer and filesystem deletion run unchanged in an isolated project.
const runner = path.resolve('scripts/run-tests.ts');
async function fixture() {
  const cwd = await mkdtemp(path.join(process.env.SITECRAFT_DATA_ROOT!, 't176-'));
  await mkdir(path.join(cwd, 'node_modules/next/dist/bin'), { recursive: true });
  await mkdir(path.join(cwd, 'scripts'));
  await symlink(path.resolve('scripts/test-summary-reporter.mjs'), path.join(cwd, 'scripts/test-summary-reporter.mjs'));
  await writeFile(path.join(cwd, 'node_modules/next/dist/bin/next'), `
    const http = require('node:http');
    const server = http.createServer((req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ testIdentity: { cwd: process.cwd(), dataRoot: process.env.SITECRAFT_DATA_ROOT } }));
    });
    server.listen(0, '127.0.0.1', () => console.log('Local: http://127.0.0.1:' + server.address().port + '\\nReady in fixture'));
    process.on('SIGTERM', () => server.close());
  `, 'utf8');
  await writeFile(path.join(cwd, 'pass.test.ts'), "import test from 'node:test'; test('fixture succeeds', () => {});\n", 'utf8');
  await writeFile(path.join(cwd, 'fail.test.ts'), "import test from 'node:test'; test('injected failure', () => { throw new Error('T176_EXPECTED_FAILURE'); });\n", 'utf8');
  return cwd;
}
async function run(cwd: string, file = 'pass.test.ts') {
  const env: NodeJS.ProcessEnv = { ...process.env, TMPDIR: cwd, DEEPSEEK_API_KEY: '', AI_API_KEY: '' };
  delete env.NODE_TEST_CONTEXT;
  const child = spawn(process.execPath, ['--experimental-strip-types', runner, file], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const exited = once(child, 'exit');
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
  const [code] = await exited;
  const directory = output.match(/证据目录：([^\n]+)/)?.[1];
  await writeFile(path.join(cwd, `entry-${crypto.randomUUID()}.log`), output, 'utf8');
  assert.ok(directory, output);
  const report = JSON.parse(await readFile(path.join(directory, 'report.json'), 'utf8'));
  return { code, output, directory, report };
}
async function seed(cwd: string, name: string, status?: string) {
  const directory = path.join(cwd, 'artifacts/t167', name);
  await mkdir(directory, { recursive: true });
  if (status) await writeFile(path.join(directory, 'report.json'), JSON.stringify({ status }), 'utf8');
  return directory;
}

test('T-176: the real entry retains five runs across consecutive starts and preserves failure evidence', async t => {
  const cwd = await fixture(); t.diagnostic(`入口清理夹具与日志：${cwd}`);
  for (let i = 1; i <= 7; i++) await seed(cwd, `test-run-${i}-1`, 'PASS');
  const failed = await seed(cwd, 'test-run-0-1', 'INCOMPLETE');
  const interrupted = await seed(cwd, 'test-run-0-2');
  const unrelated = await seed(cwd, 'other-ticket');
  const malformed = await seed(cwd, 'test-run-not-a-run');
  const protectedData = path.join(cwd, '.sitecraft-data');
  await mkdir(protectedData); await writeFile(path.join(protectedData, 'sentinel'), '保留用户数据', 'utf8');
  await symlink(protectedData, path.join(cwd, 'artifacts/t167/test-run-0-3'));
  for (const suffix of ['first', 'second']) {
    const result = await run(cwd);
    assert.equal(result.code, 0, result.output);
    const names = await readdir(path.join(cwd, 'artifacts/t167'));
    const completed = [];
    for (const name of names.filter(name => /^test-run-\d+-\d+$/.test(name) && name !== 'test-run-0-3')) {
      if (name !== 'test-run-0-2') {
        const report = JSON.parse(await readFile(path.join(cwd, 'artifacts/t167', name, 'report.json'), 'utf8'));
        if (report.status === 'PASS') completed.push(name);
      }
    }
    assert.equal(completed.length, 3, `${suffix}: 失败和中断证据占两个名额，新一轮计入总共五轮`);
    assert.ok(!names.includes('test-run-1-1'), '必须删除最早的成功轮');
    for (const directory of [failed, interrupted, unrelated, malformed]) assert.ok((await stat(directory)).isDirectory());
    assert.equal(await readFile(path.join(protectedData, 'sentinel'), 'utf8'), '保留用户数据');
    assert.ok(result.output.includes(failed), '必须输出保留的失败目录');
    assert.ok(result.output.includes(interrupted), '中断证据也必须列明');
  }
  const result = await run(cwd, 'fail.test.ts');
  assert.notEqual(result.code, 0); assert.match(result.output, /T176_EXPECTED_FAILURE/);
  assert.equal(result.report.status, 'INCOMPLETE');
  assert.ok(result.output.includes(`失败证据保留：${result.directory}`));
  assert.ok(result.output.includes(result.report.dataRoot), '同时报告失败数据根');
  const next = await run(cwd); assert.equal(next.code, 0, next.output);
  assert.equal(JSON.parse(await readFile(path.join(result.directory, 'report.json'), 'utf8')).status, 'INCOMPLETE');
  assert.equal((await readdir(path.join(cwd, 'artifacts/t167'))).filter(name => /^test-run-\d+-\d+$/.test(name) && name !== 'test-run-0-3').length, 5);
});

test('T-176: an artifacts symlink cannot redirect entry cleanup outside its project', async t => {
  const cwd = await fixture(); t.diagnostic(`符号链接边界夹具：${cwd}`);
  const outside = await mkdtemp(path.join(process.env.SITECRAFT_DATA_ROOT!, 't176-outside-'));
  await mkdir(path.join(outside, 't167/test-run-1-1'), { recursive: true });
  await writeFile(path.join(outside, 't167/test-run-1-1/report.json'), '{"status":"PASS"}', 'utf8');
  await symlink(outside, path.join(cwd, 'artifacts'));
  const env: NodeJS.ProcessEnv = { ...process.env, TMPDIR: cwd }; delete env.NODE_TEST_CONTEXT;
  const child = spawn(process.execPath, ['--experimental-strip-types', runner, 'pass.test.ts'], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const exited = once(child, 'exit'); let output = '';
  child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
  const [code] = await exited; await writeFile(path.join(cwd, 'symlink.log'), output, 'utf8');
  assert.notEqual(code, 0, '必须在符号链接边界拒绝运行');
  assert.deepEqual(await readdir(path.join(outside, 't167')), ['test-run-1-1'], '不能写入或删除范围外目录');
});
