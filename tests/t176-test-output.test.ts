import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, watch } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, readdir, stat, symlink, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

// Failure modes: keep a sixth successful run; erase a failed/interrupted run;
// traverse an artifacts/run symlink; remove unrelated data; omit failure paths;
// use another worktree's cwd; allow two entries to clean/register concurrently.
// Only Next is a small health server fixture. The entry, Node test runner,
// report writer and filesystem deletion run unchanged in an isolated project.
async function fixture() {
  const cwd = await mkdtemp(path.join(process.env.SITECRAFT_DATA_ROOT!, 't176-'));
  await mkdir(path.join(cwd, 'node_modules/next/dist/bin'), { recursive: true });
  await mkdir(path.join(cwd, 'scripts'));
  // These four scripts are executable test inputs, not evidence copies. The
  // isolated entry must derive its own project from its real script location.
  for (const name of ['run-tests.ts', 'test-identity.ts', 'local-endpoint.ts', 'test-summary-reporter.mjs']) {
    await copyFile(path.resolve('scripts', name), path.join(cwd, 'scripts', name));
  }
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
  await writeFile(path.join(cwd, 'hold.test.ts'), `
    import test from 'node:test';
    import { existsSync, watch, writeFileSync } from 'node:fs';
    test('hold entry until the parent releases its gate', async () => {
      await new Promise(resolve => {
        const watcher = watch('.', () => { if (!existsSync('hold-gate')) { watcher.close(); resolve(); } });
        writeFileSync('test-started', '');
      });
    });
  `, 'utf8');
  return cwd;
}
function start(cwd: string, file = 'pass.test.ts', scriptProject = cwd) {
  const env: NodeJS.ProcessEnv = { ...process.env, TMPDIR: cwd, DEEPSEEK_API_KEY: '', AI_API_KEY: '' };
  delete env.NODE_TEST_CONTEXT;
  const child = spawn(process.execPath, ['--experimental-strip-types', path.join(scriptProject, 'scripts/run-tests.ts'), file], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const exited = once(child, 'exit');
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
  return { child, completed: exited.then(async ([code]) => {
    await writeFile(path.join(cwd, `entry-${crypto.randomUUID()}.log`), output, 'utf8');
    return { code, output };
  }) };
}
async function run(cwd: string, file = 'pass.test.ts') {
  const result = await start(cwd, file).completed;
  const directory = result.output.match(/证据目录：([^\n]+)/)?.[1];
  assert.ok(directory, result.output);
  const report = JSON.parse(await readFile(path.join(directory, 'report.json'), 'utf8'));
  return { ...result, directory, report };
}
async function waitForFile(file: string) {
  if (existsSync(file)) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { watcher.close(); reject(new Error(`未收到夹具闸门：${file}`)); }, 10000);
    const ready = () => { if (existsSync(file)) { clearTimeout(timer); watcher.close(); resolve(); } };
    const watcher = watch(path.dirname(file), ready);
    ready();
  });
}
async function seed(cwd: string, name: string, status?: string) {
  const directory = path.join(cwd, 'artifacts/t167', name);
  await mkdir(directory, { recursive: true });
  if (status) await writeFile(path.join(directory, 'report.json'), JSON.stringify({ status }), 'utf8');
  return directory;
}

test('T-176: the real entry keeps the latest five runs plus older failures across consecutive starts', async t => {
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
    assert.equal(completed.length, 5, `${suffix}: 窗口外的失败不占最近五轮的名额`);
    assert.ok(names.includes(suffix === 'first' ? 'test-run-4-1' : 'test-run-5-1'), '最近五轮内的成功证据不可删除');
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
  for (let i = 0; i < 5; i++) {
    const next = await run(cwd); assert.equal(next.code, 0, next.output);
  }
  assert.equal(JSON.parse(await readFile(path.join(result.directory, 'report.json'), 'utf8')).status, 'INCOMPLETE');
  assert.equal((await readdir(path.join(cwd, 'artifacts/t167'))).filter(name => /^test-run-\d+-\d+$/.test(name) && name !== 'test-run-0-3').length, 8, '最近五轮加三份窗口外失败或中断证据');
  assert.ok(!existsSync(path.join(cwd, 'artifacts/t167/.run-tests.lock')), '正常和失败结束均释放互斥锁');
});

test('T-176: an artifacts symlink cannot redirect entry cleanup outside its project', async t => {
  const cwd = await fixture(); t.diagnostic(`符号链接边界夹具：${cwd}`);
  const outside = await mkdtemp(path.join(process.env.SITECRAFT_DATA_ROOT!, 't176-outside-'));
  await mkdir(path.join(outside, 't167/test-run-1-1'), { recursive: true });
  await writeFile(path.join(outside, 't167/test-run-1-1/report.json'), '{"status":"PASS"}', 'utf8');
  await symlink(outside, path.join(cwd, 'artifacts'));
  const result = await start(cwd).completed;
  assert.notEqual(result.code, 0, '必须在符号链接边界拒绝运行');
  assert.deepEqual(await readdir(path.join(outside, 't167')), ['test-run-1-1'], '不能写入或删除范围外目录');
});

test('T-176: invoking an entry from another project refuses before deleting or registering either project', async t => {
  const scriptProject = await fixture(), cwd = await fixture();
  t.diagnostic(`错误工作树夹具：入口 ${scriptProject}；cwd ${cwd}`);
  for (const project of [scriptProject, cwd]) for (let i = 1; i <= 7; i++) await seed(project, `test-run-${i}-1`, 'PASS');
  const before = await Promise.all([scriptProject, cwd].map(project => readdir(path.join(project, 'artifacts/t167'))));
  const result = await start(cwd, 'pass.test.ts', scriptProject).completed;
  assert.notEqual(result.code, 0, result.output);
  assert.match(result.output, /工作树.*不一致/);
  assert.doesNotMatch(result.output, /证据目录：/);
  const after = await Promise.all([scriptProject, cwd].map(project => readdir(path.join(project, 'artifacts/t167'))));
  assert.deepEqual(after, before, '两个工作树都不能删除旧轮或登记新轮');
});

test('T-176: a second entry refuses while the first owns the worktree and exceptions release ownership', async t => {
  const cwd = await fixture(); t.diagnostic(`并发互斥夹具：${cwd}`);
  await writeFile(path.join(cwd, 'hold-gate'), '', 'utf8');
  const waiting = waitForFile(path.join(cwd, 'test-started'));
  const first = start(cwd, 'hold.test.ts');
  try {
    await waiting;
    const before = await readdir(path.join(cwd, 'artifacts/t167'));
    const second = await start(cwd).completed;
    assert.notEqual(second.code, 0, '第二轮必须明确拒绝，不能并发清理和登记');
    assert.match(second.output, /已有测试入口.*拒绝启动/);
    assert.doesNotMatch(second.output, /证据目录：/);
    assert.deepEqual(await readdir(path.join(cwd, 'artifacts/t167')), before);
  } finally {
    await unlink(path.join(cwd, 'hold-gate'));
    const finished = await first.completed;
    assert.equal(finished.code, 0, finished.output);
  }
  assert.ok(!existsSync(path.join(cwd, 'artifacts/t167/.run-tests.lock')));
  await writeFile(path.join(cwd, 'node_modules/next/dist/bin/next'), "throw new Error('T176_EXPECTED_STARTUP_FAILURE');\n", 'utf8');
  const failed = await run(cwd);
  assert.notEqual(failed.code, 0); assert.match(failed.output, /T176_EXPECTED_STARTUP_FAILURE/);
  assert.ok(!existsSync(path.join(cwd, 'artifacts/t167/.run-tests.lock')), '启动异常也必须释放互斥锁');
});
