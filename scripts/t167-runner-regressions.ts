import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { copyFile, mkdir, mkdtemp, readFile, rename, unlink, writeFile } from 'node:fs/promises';
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

test('T-175: heavy browser files run once after parallel files, merge summaries and propagate serial failure', { timeout: 120000 }, async t => {
  // Independent inputs from the approved T-175 schedule, not the entry's list.
  const serial = ['t174-local-function.test.ts', 't175-stale-placeholder.test.ts', 't178-read-budget.test.ts'];
  for (const scenario of ['pass', 'filtered', 'serial-failure']) {
    const cwd = await mkdtemp(path.join(tmpdir(), 'sitecraft-t175-entry-'));
    await mkdir(path.join(cwd, 'node_modules/next/dist/bin'), { recursive: true });
    await mkdir(path.join(cwd, 'scripts')); await mkdir(path.join(cwd, 'tests'));
    // Executable fixture inputs, like T-176; not copies retained as evidence.
    for (const name of ['run-tests.ts', 'test-identity.ts', 'local-endpoint.ts', 'test-summary-reporter.mjs'])
      await copyFile(path.join(project, 'scripts', name), path.join(cwd, 'scripts', name));
    await writeFile(path.join(cwd, 'package.json'), JSON.stringify({ scripts: { test: 'node --require ./capture.cjs --experimental-strip-types scripts/run-tests.ts' } }), 'utf8');
    await writeFile(path.join(cwd, 'node_modules/next/dist/bin/next'), `
      const http=require('node:http');
      const server=http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({testIdentity:{cwd:process.cwd(),dataRoot:process.env.SITECRAFT_DATA_ROOT}}))});
      server.listen(0,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+server.address().port+'\\nReady in fixture'));
      process.on('SIGTERM',()=>server.close());
    `, 'utf8');
    await writeFile(path.join(cwd, 'capture.cjs'), `
      const fs=require('node:fs'),cp=require('node:child_process'),spawn=cp.spawn;
      cp.spawn=function(command,args,options){
        if(args.includes('--test'))fs.appendFileSync('spawns.ndjson',JSON.stringify({command,args})+'\\n');
        return spawn.call(this,command,args,options);
      };
      require('node:module').syncBuiltinESMExports();
    `, 'utf8');
    for (const name of ['parallel.test.ts', ...serial]) {
      const parallel = name === 'parallel.test.ts';
      await writeFile(path.join(cwd, 'tests', name), `
        import test from 'node:test';
        import {appendFileSync,existsSync} from 'node:fs';
        appendFileSync('executed.ndjson',JSON.stringify({file:${JSON.stringify(name)}})+'\\n');
        test(${JSON.stringify(parallel ? 'parallel one' : `serial ${name}`)},()=>{
          if(${JSON.stringify(name)}==='t175-stale-placeholder.test.ts'&&existsSync('fail-serial'))throw new Error('T175_EXPECTED_SERIAL_FAILURE');
        });
        ${parallel ? "test('parallel two',()=>{});" : ''}
      `, 'utf8');
    }
    if (scenario === 'serial-failure') await writeFile(path.join(cwd, 'fail-serial'), '故意让串行用例失败', 'utf8');
    const args = scenario === 'filtered' ? ['--test-name-pattern=^serial ', 'tests/parallel.test.ts', ...serial.map(name => `tests/${name}`), 'tests/t175-stale-placeholder.test.ts'] : [];
    const env: NodeJS.ProcessEnv = { ...process.env, TMPDIR: cwd, DEEPSEEK_API_KEY: '', AI_API_KEY: '' }; delete env.NODE_TEST_CONTEXT;
    const child = spawn('npm', ['test', '--', ...args], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const closed = once(child, 'close'); let output = '';
    child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
    const [code] = await closed;
    const directory = output.match(/证据目录：([^\n]+)/)?.[1]; assert.ok(directory, output);
    const report = JSON.parse(await readFile(path.join(directory, 'report.json'), 'utf8'));
    const spawns = (await readFile(path.join(cwd, 'spawns.ndjson'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    const executed = (await readFile(path.join(cwd, 'executed.ndjson'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    const out = path.join(project, 'artifacts/t175', `entry-regression-${scenario}-${crypto.randomUUID()}`);
    await mkdir(out, { recursive: true });
    await writeFile(path.join(out, 'output.log'), output, 'utf8');
    await writeFile(path.join(out, 'observation.json'), JSON.stringify({ cwd, args, code, spawns, executed, report }, null, 2) + '\n', 'utf8');
    await copyFile(path.join(directory, 'summaries.ndjson'), path.join(out, 'summaries.ndjson'));
    t.diagnostic(`两阶段入口 ${scenario} 证据：${out}`);
    assert.equal(spawns.length, 2, '必须从真实 Node spawn 观察到并行、末尾串行两个阶段');
    const files = (call: { args: string[] }) => call.args.filter(arg => arg.endsWith('.test.ts')).map(file => path.basename(file)).sort();
    assert.deepEqual(files(spawns[0]), ['parallel.test.ts'], '指定重文件不能先进入并行阶段');
    assert.deepEqual(files(spawns[1]), serial, '三个指定文件只进入最后串行阶段且不重复');
    assert.ok(spawns[1].args.includes('--test-concurrency=1'), '串行限制须传给真实 Node 进程');
    assert.deepEqual(executed.map(row => row.file).sort(), ['parallel.test.ts', ...serial].sort(), '每个文件全程只能实际载入一次');
    assert.equal(report.executed, scenario === 'filtered' ? 3 : 5, '总数须合并两阶段的原生每文件统计');
    assert.deepEqual(report.phases.map((phase: { executed: number }) => phase.executed), scenario === 'filtered' ? [0, 3] : [2, 3]);
    if (scenario === 'serial-failure') {
      assert.notEqual(code, 0, '串行失败须令整轮失败');
      assert.equal(report.status, 'INCOMPLETE'); assert.notEqual(report.testCode, 0);
      assert.equal(report.phases[0].testCode, 0); assert.notEqual(report.phases[1].testCode, 0);
      assert.match(output, /T175_EXPECTED_SERIAL_FAILURE/);
    } else {
      assert.equal(code, 0, output); assert.equal(report.status, 'PASS');
    }
  }
});
