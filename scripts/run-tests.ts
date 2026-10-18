import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { closeSync, constants, createWriteStream, fstatSync, lstatSync, openSync, readFileSync, statSync, unlinkSync, writeSync } from 'node:fs';
import { appendFile, lstat, mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { checkTestIdentity } from './test-identity.ts';

delete process.env.NODE_TEST_CONTEXT;
// Only completed successful runs expire. Failed, interrupted and malformed
// reports remain evidence, even when that requires more than five directories.
const project = await realpath(fileURLToPath(new URL('../', import.meta.url)));
assert.equal(await realpath(process.cwd()), project, '测试入口工作树与当前目录不一致，拒绝清理或启动');
const entryStartedAt = Date.now();
// T-179: begin the authorized 1/2/3 comparison at 1. Replace the default with
// the fastest value that passes two consecutive full runs before acceptance.
const defaultBrowserConcurrency = 1;
type BrowserDependency = { file: string; via: string[]; marker: string };
// Classify runtime references, without importing or executing test modules.
// Follow local import/export, literal import()/require(), and the project's @/
// alias. Ignore type-only references, comments, strings and external packages.
// CHROME_PATH access/binding/environment entries mark a Chrome boundary. Thus
// helper filenames do not need a list. A per-search visited set handles cycles.
const modules = new Map<string, { marker?: string; imports: string[] }>();
function browserDependency(file: string): BrowserDependency | undefined {
  const queue = [{ file, via: [file] }], visited = new Set<string>();
  for (let at = 0; at < queue.length; at++) {
    const current = queue[at]; if (visited.has(current.file)) continue; visited.add(current.file);
    let module = modules.get(current.file);
    if (!module) {
      module = { imports: [] }; modules.set(current.file, module);
      const source = ts.createSourceFile(current.file, readFileSync(current.file, 'utf8'), ts.ScriptTarget.Latest, true);
      const imports = new Set<string>();
      const reference = (node: ts.Node | undefined) => { if (node && ts.isStringLiteralLike(node)) imports.add(node.text); };
      const visit = (node: ts.Node) => {
        if (ts.isImportDeclaration(node)) {
          const clause = node.importClause;
          const onlyTypes = clause?.isTypeOnly || (!clause?.name && clause?.namedBindings && ts.isNamedImports(clause.namedBindings)
            && clause.namedBindings.elements.length > 0 && clause.namedBindings.elements.every(item => item.isTypeOnly));
          if (!onlyTypes) reference(node.moduleSpecifier); return;
        }
        if (ts.isExportDeclaration(node)) { if (!node.isTypeOnly && !(node.exportClause && ts.isNamedExports(node.exportClause)
          && node.exportClause.elements.length > 0 && node.exportClause.elements.every(item => item.isTypeOnly))) reference(node.moduleSpecifier); return; }
        if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
          || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) reference(node.arguments[0]);
        const name = ts.isPropertyAccessExpression(node) ? node.name.text
          : ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text
            : (ts.isPropertyAssignment(node) || ts.isBindingElement(node)) && node.name && (ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name)) ? node.name.text : '';
        if (name === 'CHROME_PATH') module!.marker = 'CHROME_PATH';
        ts.forEachChild(node, visit);
      };
      visit(source);
      for (const specifier of imports) {
        if (!specifier.startsWith('.') && !specifier.startsWith('@/')) continue;
        const resolved = ts.resolveModuleName(specifier, current.file, { moduleResolution: ts.ModuleResolutionKind.Bundler,
          baseUrl: project, paths: { '@/*': ['./*'] }, allowJs: true, resolveJsonModule: true }, ts.sys).resolvedModule;
        assert.ok(resolved, `无法静态解析测试运行时引用：${current.file} → ${specifier}`);
        const dependency = path.resolve(resolved.resolvedFileName);
        if (dependency.startsWith(project + path.sep) && !dependency.includes(`${path.sep}node_modules${path.sep}`)
          && !/\.d\.[cm]?ts$/.test(dependency) && /\.[cm]?[jt]sx?$/.test(dependency)) module.imports.push(dependency);
      }
    }
    if (module.marker) return { file, via: current.via, marker: module.marker };
    for (const dependency of module.imports) queue.push({ file: dependency, via: [...current.via, dependency] });
  }
}
const artifacts = path.join(project, 'artifacts'), runRoot = path.join(artifacts, 't167');
for (const directory of [artifacts, runRoot]) {
  await mkdir(directory, { recursive: true });
  assert.ok((await lstat(directory)).isDirectory(), `测试证据目录不能是符号链接：${directory}`);
}
const lockPath = path.join(runRoot, '.run-tests.lock');
type LockOwner = { pid: number; startedAt: string };
function readLockOwner(): { exists: boolean; owner?: LockOwner } {
  let content: string;
  try {
    assert.ok(lstatSync(lockPath).isFile(), `测试锁必须是普通文件，拒绝启动：${lockPath}`);
    content = readFileSync(lockPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { exists: false };
    throw error;
  }
  for (const line of content.split('\n').filter(Boolean)) {
    let owner: LockOwner;
    try { owner = JSON.parse(line); }
    catch (error) { if (error instanceof SyntaxError) continue; throw error; }
    if (!owner || !Number.isSafeInteger(owner.pid) || owner.pid <= 0
      || typeof owner.startedAt !== 'string' || !Number.isFinite(Date.parse(owner.startedAt))) continue;
    try { process.kill(owner.pid, 0); return { exists: true, owner }; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH') continue;
      throw new Error(`无法核对测试锁持有者，拒绝启动：${lockPath}（pid=${owner.pid}）`, { cause: error });
    }
  }
  return { exists: true };
}
const busyLock = (owner: LockOwner) => new Error(`已有测试入口持有工作树锁，拒绝启动：${lockPath}（pid=${owner.pid}）`);
const previousLock = readLockOwner();
if (previousLock.owner) throw busyLock(previousLock.owner);
const owner = { pid: process.pid, startedAt: new Date().toISOString() };
// A single O_APPEND write orders contenders on the same file. The first live
// record owns it; stale claimants never unlink a newly published live lock.
const lock = openSync(lockPath, constants.O_CREAT | constants.O_RDWR | constants.O_APPEND | constants.O_NOFOLLOW, 0o600);
try {
  writeSync(lock, '\n' + JSON.stringify(owner) + '\n');
  const winner = readLockOwner().owner;
  assert.ok(winner, `测试锁在登记期间已变化，拒绝启动：${lockPath}`);
  if (winner.pid !== owner.pid || winner.startedAt !== owner.startedAt) throw busyLock(winner);
  const opened = fstatSync(lock), current = statSync(lockPath);
  assert.ok(opened.dev === current.dev && opened.ino === current.ino, `测试锁在登记期间已替换，拒绝启动：${lockPath}`);
} catch (error) { closeSync(lock); throw error; }
if (previousLock.exists) console.log(`接管了残留锁：${lockPath}（pid=${owner.pid}）`);
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
  let executed: number | null = null, failed = 0, passed = false, browserConcurrency = defaultBrowserConcurrency;
  const classification: { browser: BrowserDependency[]; nonBrowser: string[] } = { browser: [], nonBrowser: [] };
  const phases: Array<{ name: string; files: string[]; summaryFile: string; testCode: number | null; executed: number; failed: number; startedAt: string; endedAt: string }> = [];
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
    const requested = args.filter(arg => arg.endsWith('.test.ts'));
    const files = [...new Set((requested.length ? requested
      : (await readdir('tests')).filter(name => name.endsWith('.test.ts')).sort().map(name => `tests/${name}`)).map(file => path.resolve(file)))];
    const concurrency = args.filter(arg => arg.startsWith('--browser-concurrency='));
    assert.ok(concurrency.length <= 1 && (!concurrency.length || /^--browser-concurrency=[123]$/.test(concurrency[0])), '浏览器池实测并发只接受单个 --browser-concurrency=1、2 或 3');
    if (concurrency.length) browserConcurrency = Number(concurrency[0].split('=')[1]);
    const options = args.filter(arg => !arg.endsWith('.test.ts') && !arg.startsWith('--browser-concurrency='));
    assert.ok(!options.some(arg => arg.startsWith('--test-concurrency')), '请用 --browser-concurrency 设置浏览器池；非浏览器池保留默认并发');
    for (const file of files) {
      const dependency = browserDependency(file);
      if (dependency) { classification.browser.push(dependency);
        console.log(`浏览器池：${path.relative(project, file)}（${dependency.via.map(item => path.relative(project, item)).join(' → ')} → ${dependency.marker}）`); }
      else classification.nonBrowser.push(file);
    }
    console.log(`测试分池：非浏览器 ${classification.nonBrowser.length} 个文件；浏览器 ${classification.browser.length} 个文件，并发 ${browserConcurrency}`);
    const summaryFile = path.join(output, 'summaries.ndjson');
    await writeFile(summaryFile, '', 'utf8');
    testCode = 0; executed = 0;
    const testLog = createWriteStream(path.join(output, 'tests.log'));
    try {
      for (const phase of [
        { name: 'non-browser', files: classification.nonBrowser },
        { name: 'browser', files: classification.browser.map(item => item.file) },
      ]) {
        if (!phase.files.length) continue;
        assert.ok(!interrupted, '测试入口已取消，拒绝启动下一阶段');
        const startedAt = new Date().toISOString();
        const phaseSummaryFile = path.join(output, `summaries-${phase.name}.ndjson`);
        console.log(`测试阶段：${phase.name}（${phase.files.length} 个文件）`);
        tests = spawn(process.execPath, ['--test', '--experimental-strip-types',
          '--test-reporter=spec', `--test-reporter=${path.resolve('scripts/test-summary-reporter.mjs')}`,
          '--test-reporter-destination=stdout', `--test-reporter-destination=${phaseSummaryFile}`, ...options,
          ...(phase.name === 'browser' ? [`--test-concurrency=${browserConcurrency}`] : []), ...phase.files], {
          env: { ...env, SITECRAFT_BASE: base }, stdio: ['ignore', 'pipe', 'pipe'],
        });
        const completed = once(tests, 'close');
        tests.stdout!.pipe(testLog, { end: false }); tests.stderr!.pipe(testLog, { end: false });
        tests.stdout!.pipe(process.stdout); tests.stderr!.pipe(process.stderr);
        const [phaseCode] = await completed;
        const rawSummaries = await readFile(phaseSummaryFile, 'utf8');
        const summaries = rawSummaries.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
        const phaseExecuted = summaries.reduce((total: number, summary) => total + summary.counts.tests - summary.counts.skipped - summary.counts.cancelled - summary.counts.todo, 0);
        await appendFile(summaryFile, rawSummaries, 'utf8');
        executed += phaseExecuted;
        const phaseFailed = summaries.reduce((total: number, summary) => total + summary.counts.failed, 0); failed += phaseFailed;
        if (phaseCode !== 0) testCode = phaseCode ?? 1;
        phases.push({ ...phase, summaryFile: phaseSummaryFile, testCode: phaseCode, executed: phaseExecuted, failed: phaseFailed, startedAt, endedAt: new Date().toISOString() });
      }
    } finally { testLog.end(); await once(testLog, 'finish'); }
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
      executed, failed, phases, classification, browserConcurrency, durationMs: Date.now() - entryStartedAt, status: passed ? 'PASS' : 'INCOMPLETE',
      ...(startupFailed ? { startupError: `测试服务启动或身份核对失败：${startupCause instanceof Error ? startupCause.message : String(startupCause)}\n${serverOutput}\n日志：${path.join(output, 'dev.log')}` } : {}) }, null, 2) + '\n', 'utf8');
    if (!passed) console.error(`失败证据保留：${output}\n失败数据根保留：${dataRoot}`);
  }
  if (startupFailed) throw new Error(`测试服务启动或身份核对失败：${startupCause instanceof Error ? startupCause.message : String(startupCause)}\n${serverOutput}\n日志：${path.join(output, 'dev.log')}`, { cause: startupCause });
} finally {
  process.off('SIGINT', stop); process.off('SIGTERM', stop);
  releaseLock(); process.off('exit', releaseLock);
}
