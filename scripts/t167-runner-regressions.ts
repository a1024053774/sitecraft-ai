import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { copyFile, mkdir, mkdtemp, readFile, rename, symlink, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// Run separately from the full suite: these cases own the real npm test entry
// and its dev server. They cannot share the full suite's live Next dev lock.
const project = fileURLToPath(new URL('../', import.meta.url));
// Test-only OS boundary fixture. The entry has no skip flag or injected reader.
// --require executes this fixture as test code; normal npm test never loads it.
function loadFixture(load: number[], memory: string | { error: string }) {
  return `{
    const cp=require('node:child_process'),original=cp.execFile;
    require('node:os').loadavg=()=>${JSON.stringify(load)};
    cp.execFile=function(command,args,options,callback){
      if(command!=='memory_pressure')return original.apply(this,arguments);
      const result=${JSON.stringify(memory)};
      setImmediate(()=>typeof result==='string'?callback(null,result,''):callback(new Error(result.error),'',''));
      return {pid:0};
    };
    require('node:module').syncBuiltinESMExports();
  }`;
}
const withinLoad = [1.25, 2.5, 3];
const withinMemory = 'System-wide memory free percentage: 30%\n';

// The regression suite itself uses the same entry preflight before any case.
// It is deliberately deterministic on a busy host, through test-only OS mocks.
const preflightRoot = await mkdtemp(path.join(tmpdir(), 'sitecraft-t179-runner-load-'));
const preflightFixture = path.join(preflightRoot, 'os-fixture.cjs');
await writeFile(preflightFixture, loadFixture(withinLoad, withinMemory));
const preflight = spawn(process.execPath, ['--require', preflightFixture, '--experimental-strip-types', '--input-type=module', '-e',
  `const {checkStartupLoad}=await import(${JSON.stringify(new URL('./run-tests.ts', import.meta.url).href)});await checkStartupLoad();`],
  { cwd: project, stdio: 'inherit' });
const [preflightCode] = await once(preflight, 'exit');
assert.equal(preflightCode, 0, 'runner 必须先通过同一开跑负载检查（测试 OS 注入）');

for (const scenario of [
  { name: 'one-minute limit', load: [5, 1, 0], memory: 'System-wide memory free percentage: 40%', allowed: false },
  { name: 'five-minute limit', load: [1, 5, 0], memory: 'System-wide memory free percentage: 40%', allowed: false },
  { name: 'memory below limit', load: withinLoad, memory: 'System-wide memory free percentage: 29%', allowed: false },
  { name: 'inside limits including memory boundary', load: [4.99, 4.99, 0], memory: withinMemory, allowed: true },
  { name: 'memory command unavailable', load: withinLoad, memory: { error: 'spawn memory_pressure ENOENT' }, allowed: false },
  { name: 'memory output malformed', load: withinLoad, memory: 'memory value unavailable', allowed: false },
]) test(`T-179 load gate: ${scenario.name}`, { timeout: 15000 }, async t => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'sitecraft-t179-load-'));
  for (const directory of ['node_modules/next/dist/bin', 'scripts', 'tests'])
    await mkdir(path.join(cwd, directory), { recursive: true });
  await symlink(path.join(project, 'node_modules/typescript'), path.join(cwd, 'node_modules/typescript'));
  for (const name of ['run-tests.ts', 'test-identity.ts', 'local-endpoint.ts', 'test-summary-reporter.mjs'])
    await copyFile(path.join(project, 'scripts', name), path.join(cwd, 'scripts', name));
  await writeFile(path.join(cwd, 'load-fixture.cjs'), loadFixture(scenario.load, scenario.memory));
  await writeFile(path.join(cwd, 'node_modules/next/dist/bin/next'), `
    require('node:fs').writeFileSync('server-started','yes');
    const server=require('node:http').createServer((req,res)=>{
      res.setHeader('content-type','application/json');
      res.end(JSON.stringify({testIdentity:{cwd:process.cwd(),dataRoot:process.env.SITECRAFT_DATA_ROOT}}));
    });
    server.listen(0,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+server.address().port+'\\nReady in fixture'));
    process.on('SIGTERM',()=>server.close());
  `);
  await writeFile(path.join(cwd, 'tests/plain.test.ts'), "import test from 'node:test';test('gate permits execution',()=>{});\n");
  const env: NodeJS.ProcessEnv = { ...process.env, TMPDIR: cwd }; delete env.NODE_TEST_CONTEXT;
  const child = spawn(process.execPath, ['--require', './load-fixture.cjs', '--experimental-strip-types', 'scripts/run-tests.ts'], {
    cwd, env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const closed = once(child, 'close'); let output = '';
  child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
  const [code] = await closed;
  const directory = output.match(/证据目录：([^\n]+)/)?.[1];
  const report = directory ? JSON.parse(await readFile(path.join(directory, 'report.json'), 'utf8')) : undefined;
  const out = path.join(project, 'artifacts/t179', `load-gate-${crypto.randomUUID()}`);
  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, 'output.log'), output);
  await writeFile(path.join(out, 'observation.json'), JSON.stringify({ at: new Date().toISOString(), cwd, scenario, code, report }, null, 2)+'\n');
  t.diagnostic(`负载门禁证据：${out}`);
  if (scenario.allowed) {
    assert.equal(code, 0, output);
    assert.equal(report.executed, 1);
    assert.equal(report.startupLoad?.load1, 4.99, '通过时必须保存开跑的 1 分钟 load');
    assert.equal(report.startupLoad?.load5, 4.99);
    assert.equal(report.startupLoad?.memoryFreePercent, 30, '30% 边界应放行并记录');
  } else {
    assert.notEqual(code, 0, '越限或无法读取时必须非零拒绝');
    assert.equal(existsSync(path.join(cwd, 'server-started')), false, '拒绝时不能启动测试服务');
    assert.equal(existsSync(path.join(cwd, 'artifacts/t167')), false, '拒绝时不能清理、取得锁或建立本轮目录');
    assert.match(output, /开跑负载检查拒绝/);
  }
  assert.ok(output.includes(`1分钟 load=${scenario.load[0]}`), output);
  assert.ok(output.includes(`5分钟 load=${scenario.load[1]}`), output);
  assert.match(output, /1分钟、5分钟 load 均 < 5；内存空闲 >= 30%/);
  if (typeof scenario.memory === 'object') assert.match(output, /ENOENT/);
  else if (scenario.name === 'memory output malformed') assert.match(output, /解析/);
  else assert.ok(output.includes(`内存空闲=${scenario.memory.match(/(\d+)%/)![1]}%`), output);
});

async function run(args: string[], context: string | undefined) {
  const env: NodeJS.ProcessEnv = { ...process.env, DEEPSEEK_API_KEY: '', AI_API_KEY: '',
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --require=${JSON.stringify(preflightFixture)}`.trim() };
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

test('T-179: runtime imports classify browser pools, execute once, merge summaries and propagate failure', { timeout: 120000 }, async t => {
  // The oracle comes from the dependency shapes below, including a former
  // serial filename that contains no browser reference. No Chrome is launched.
  const nonBrowser = ['node-cli.test.ts', 'plain.test.ts', 't175-stale-placeholder.test.ts'];
  const browser = ['cli.test.ts', 'direct.test.ts', 'dynamic.test.ts', 'helper-cli.test.ts', 'indirect.test.ts', 'loop-cli.test.ts'];
  for (const scenario of ['pass', 'filtered', 'browser-failure', 'nonbrowser-failure', 'cap-two']) {
    const cwd = await mkdtemp(path.join(tmpdir(), 'sitecraft-t179-entry-'));
    for (const directory of ['node_modules/next/dist/bin', 'scripts', 'tests/helpers', 'lib'])
      await mkdir(path.join(cwd, directory), { recursive: true });
    await symlink(path.join(project, 'node_modules/typescript'), path.join(cwd, 'node_modules/typescript'));
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
      ${loadFixture(withinLoad, withinMemory)}
      const fs=require('node:fs'),cp=require('node:child_process'),spawn=cp.spawn;
      cp.spawn=function(command,args,options){
        if(args.includes('--test'))fs.appendFileSync('spawns.ndjson',JSON.stringify({command,args})+'\\n');
        return spawn.call(this,command,args,options);
      };
      require('node:module').syncBuiltinESMExports();
    `, 'utf8');
    await writeFile(path.join(cwd, 'lib/browser-entry.ts'), "export type BrowserHint = string; export function browserRequested(){return process.env['CHROME_PATH']}\n", 'utf8');
    await writeFile(path.join(cwd, 'tests/helpers/bridge.ts'), "import './cycle.ts'; export {browserRequested} from '../../lib/browser-entry.ts';\n", 'utf8');
    await writeFile(path.join(cwd, 'tests/helpers/cycle.ts'), "import './bridge.ts';\n", 'utf8');
    await writeFile(path.join(cwd, 'lib/node-cli.ts'), 'void process.version;\n', 'utf8');
    await writeFile(path.join(cwd, 'tests/helpers/launch.ts'), "import {execFileSync as run} from 'node:child_process'; import path from 'node:path'; export function launch(){const script=path.join('lib','browser-cli.ts'); run(process.execPath,['--experimental-strip-types',script]);}\n", 'utf8');
    await writeFile(path.join(cwd, 'lib/browser-cli.ts'), "import {browserRequested} from './browser-entry.ts'; void browserRequested();\n", 'utf8');
    for (const name of [...nonBrowser, ...browser]) {
      const inBrowser = browser.includes(name), plain = name === 'plain.test.ts';
      const dependency = name === 'cli.test.ts' ? "import {spawnSync} from 'node:child_process'; const command=[process.execPath,'--experimental-strip-types','lib/browser-cli.ts']; spawnSync(command[0],command.slice(1));"
        : name === 'node-cli.test.ts' ? "import {spawnSync} from 'node:child_process'; spawnSync(process.execPath,['--experimental-strip-types','lib/node-cli.ts']);"
        : name === 'helper-cli.test.ts' ? "import {launch} from './helpers/launch.ts'; launch();"
        : name === 'loop-cli.test.ts' ? "import * as cp from 'node:child_process'; for(const script of ['lib/browser-cli.ts'])cp.spawnSync(process.execPath,['--experimental-strip-types',script]);"
        : name === 'direct.test.ts' ? "void process.env.CHROME_PATH;"
        : name === 'indirect.test.ts' ? "import {browserRequested} from './helpers/bridge.ts'; void browserRequested;"
          : name === 'dynamic.test.ts' ? "await import('./helpers/bridge.ts');"
            : plain ? "import type {BrowserHint} from '../lib/browser-entry.ts'; /* process.env.CHROME_PATH */ void 'process.env.CHROME_PATH';" : '';
      await writeFile(path.join(cwd, 'tests', name), `
        import test from 'node:test';
        import {appendFileSync,existsSync} from 'node:fs';
        ${dependency}
        appendFileSync('executed.ndjson',JSON.stringify({file:${JSON.stringify(name)}})+'\\n');
        test(${JSON.stringify((inBrowser ? 'browser ' : 'ordinary ') + name)},()=>{
          if(${JSON.stringify(name)}==='direct.test.ts'&&existsSync('fail-browser'))throw new Error('T179_EXPECTED_BROWSER_FAILURE');
          if(${plain}&&existsSync('fail-nonbrowser'))throw new Error('T179_EXPECTED_NONBROWSER_FAILURE');
        });
        ${plain ? "test('ordinary second',()=>{});" : ''}
      `, 'utf8');
    }
    if (scenario === 'browser-failure') await writeFile(path.join(cwd, 'fail-browser'), '故意让浏览器池失败', 'utf8');
    if (scenario === 'nonbrowser-failure') await writeFile(path.join(cwd, 'fail-nonbrowser'), '故意让非浏览器池失败', 'utf8');
    const args = scenario === 'filtered' ? ['--test-name-pattern=^browser ', ...[...nonBrowser, ...browser].map(name => `tests/${name}`), 'tests/indirect.test.ts']
      : scenario === 'cap-two' ? ['--browser-concurrency=2'] : [];
    const env: NodeJS.ProcessEnv = { ...process.env, TMPDIR: cwd, DEEPSEEK_API_KEY: '', AI_API_KEY: '' }; delete env.NODE_TEST_CONTEXT;
    const child = spawn('npm', ['test', '--', ...args], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const closed = once(child, 'close'); let output = '';
    child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
    const [code] = await closed;
    const directory = output.match(/证据目录：([^\n]+)/)?.[1]; assert.ok(directory, output);
    const report = JSON.parse(await readFile(path.join(directory, 'report.json'), 'utf8'));
    const spawns = (await readFile(path.join(cwd, 'spawns.ndjson'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    const executed = (await readFile(path.join(cwd, 'executed.ndjson'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    const out = path.join(project, 'artifacts/t179', `entry-regression-${scenario}-${crypto.randomUUID()}`);
    await mkdir(out, { recursive: true });
    await writeFile(path.join(out, 'output.log'), output, 'utf8');
    await writeFile(path.join(out, 'observation.json'), JSON.stringify({ cwd, args, code, spawns, executed, report }, null, 2) + '\n', 'utf8');
    await copyFile(path.join(directory, 'summaries.ndjson'), path.join(out, 'summaries.ndjson'));
    t.diagnostic(`分池入口 ${scenario} 证据：${out}`);
    assert.equal(spawns.length, 2, '必须从真实 Node spawn 观察到两个互斥池');
    const files = (call: { args: string[] }) => call.args.filter(arg => arg.endsWith('.test.ts')).map(file => path.basename(file)).sort();
    assert.deepEqual(files(spawns[0]), nonBrowser, '注释、字符串、纯类型和历史文件名不能将非浏览器文件送入浏览器池');
    assert.deepEqual(files(spawns[1]), browser, '直接环境入口、静态间接引用、动态 import 和本地 CLI 引用都必须进入浏览器池');
    assert.ok(!spawns[0].args.some((arg: string) => arg.startsWith('--test-concurrency')), '非浏览器池保持 Node 默认并发');
    const cap = spawns[1].args.find((arg: string) => /^--test-concurrency=[123]$/.test(arg));
    assert.ok(cap, '浏览器并发上限必须传给真实 Node 进程');
    if (scenario === 'cap-two') assert.equal(cap, '--test-concurrency=2', '实测参数只改变浏览器池');
    assert.deepEqual(executed.map(row => row.file).sort(), [...nonBrowser, ...browser].sort(), '每个文件全程只实际载入一次');
    assert.equal(report.executed, scenario === 'filtered' ? 6 : 10, '总数合并两个池的原生每文件统计');
    assert.deepEqual(report.phases.map((phase: { executed: number }) => phase.executed), scenario === 'filtered' ? [0, 6] : [4, 6]);
    assert.deepEqual(report.classification.browser.map((item: { file: string }) => path.basename(item.file)).sort(), browser);
    assert.ok(browser.every(name => output.includes(`浏览器池：tests/${name}`)), '每轮须打印浏览器池文件判定');
    if (scenario.endsWith('failure')) {
      assert.notEqual(code, 0, '任一池失败须令整轮失败'); assert.equal(report.status, 'INCOMPLETE');
      assert.notEqual(report.testCode, 0); assert.match(output, /T179_EXPECTED_/);
    } else { assert.equal(code, 0, output); assert.equal(report.status, 'PASS'); }
  }
});

test('T-179: unexpected Chrome is attributed to its non-browser file and only warns', { timeout: 15000 }, async t => {
  // The OS boundary is simulated: one worker owns a CLI -> Chrome chain,
  // another worker and an unrelated Chrome must not receive that warning.
  const cwd = await mkdtemp(path.join(tmpdir(), 'sitecraft-t179-warning-'));
  for (const directory of ['node_modules/next/dist/bin', 'scripts', 'tests'])
    await mkdir(path.join(cwd, directory), { recursive: true });
  await symlink(path.join(project, 'node_modules/typescript'), path.join(cwd, 'node_modules/typescript'));
  for (const name of ['run-tests.ts', 'test-identity.ts', 'local-endpoint.ts', 'test-summary-reporter.mjs'])
    await copyFile(path.join(project, 'scripts', name), path.join(cwd, 'scripts', name));
  await writeFile(path.join(cwd, 'package.json'), JSON.stringify({ scripts: { test: 'node --require ./process-fixture.cjs --experimental-strip-types scripts/run-tests.ts' } }));
  await writeFile(path.join(cwd, 'node_modules/next/dist/bin/next'), `
    const http=require('node:http');
    const server=http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({testIdentity:{cwd:process.cwd(),dataRoot:process.env.SITECRAFT_DATA_ROOT}}))});
    server.listen(0,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+server.address().port+'\\nReady in fixture'));
    process.on('SIGTERM',()=>server.close());
  `);
  await writeFile(path.join(cwd, 'process-fixture.cjs'), `
    ${loadFixture(withinLoad, withinMemory)}
    const fs=require('node:fs'),cp=require('node:child_process'),spawn=cp.spawn,execFile=cp.execFile;
    let phase;
    cp.spawn=function(command,args,options){const child=spawn.call(this,command,args,options);if(args.includes('--test'))phase=child;return child;};
    cp.execFile=function(command,args,options,callback){
      if(command!=='ps')return execFile.apply(this,arguments);
      const target=process.cwd()+'/tests/z-owner.test.ts',other=process.cwd()+'/tests/a-other.test.ts',chrome=process.env.CHROME_PATH;
      const rows=[
        [phase.pid,process.pid,process.execPath,process.execPath+' --test '+other+' '+target],
        [700001,phase.pid,process.execPath,process.execPath+' '+target],
        [700002,700001,process.execPath,process.execPath+' runtime-cli.ts'],
        [700003,700002,chrome,chrome+' --remote-debugging-port=0'],
        [700004,700003,chrome,chrome+' --type=renderer'],
        [700005,phase.pid,process.execPath,process.execPath+' '+other],
        [700006,1,chrome,chrome+' --remote-debugging-port=0']
      ];
      setImmediate(()=>{callback(null,rows.map(row=>row.join(' ')).join('\\n'),'');fs.writeFileSync('sampled','yes');});
      return {pid:700007};
    };
    require('node:module').syncBuiltinESMExports();
  `);
  await writeFile(path.join(cwd, 'tests/a-other.test.ts'), "import test from 'node:test'; test('ordinary peer',()=>{});\n");
  await writeFile(path.join(cwd, 'tests/z-owner.test.ts'), `
    import test from 'node:test'; import {existsSync,watch} from 'node:fs';
    test('runtime-only child',()=>new Promise(resolve=>{
      if(existsSync('sampled'))return resolve();
      const watcher=watch('.',()=>{if(existsSync('sampled'))finish();});
      const timer=setTimeout(finish,1500);
      function finish(){clearTimeout(timer);watcher.close();resolve();}
    }));
  `);
  const env: NodeJS.ProcessEnv = { ...process.env, TMPDIR: cwd, CHROME_PATH: '/fixture/chrome-headless-shell', DEEPSEEK_API_KEY: '', AI_API_KEY: '' }; delete env.NODE_TEST_CONTEXT;
  const child = spawn('npm', ['test'], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const closed = once(child, 'close'); let output = '';
  child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
  const [code] = await closed;
  const directory = output.match(/证据目录：([^\n]+)/)?.[1]; assert.ok(directory, output);
  const report = JSON.parse(await readFile(path.join(directory, 'report.json'), 'utf8'));
  const out = path.join(project, 'artifacts/t179', `runtime-warning-${crypto.randomUUID()}`);
  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, 'output.log'), output);
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  t.diagnostic(`运行时告警证据：${out}`);
  assert.equal(code, 0, '发现漏分类只告警，不能令原本通过的测试失败');
  assert.equal(report.status, 'PASS'); assert.equal(report.executed, 2);
  assert.equal(report.classification.browser.length, 0, '运行时告警不能重分池或重跑文件');
  assert.deepEqual(report.browserWarnings.map((warning: { file: string; chromePid: number }) => [path.basename(warning.file), warning.chromePid]), [['z-owner.test.ts', 700003]], '必须沿 CLI 祖先定位到真正的文件；排除同池其他文件、外部 Chrome 和 renderer；同个进程只告警一次');
  assert.match(output, /非浏览器池发现 Chrome：tests\/z-owner\.test\.ts/);
});
