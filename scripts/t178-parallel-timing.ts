import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { loadavg } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const [laneText, output, reference, samplesText] = process.argv.slice(2);
const lanes = Number(laneText) as 1 | 2 | 3 | 4;
const samples = samplesText ? Number(samplesText) : 5;
assert.ok([1, 2, 3, 4].includes(lanes) && output?.startsWith('artifacts/t178/'));
assert.ok(Number.isInteger(samples) && samples >= 1 && samples <= 5);
assert.ok(lanes === 1 || reference?.startsWith('artifacts/t178/'));
await mkdir(output);
const run = promisify(execFile);
const baseline = lanes === 1 ? null : JSON.parse(await readFile(reference, 'utf8'));
const baselinePeakMiB = baseline ? Math.max(...baseline.observations.map((row: any) => row.peakMiB)) : null;
const fixture = JSON.parse(await readFile('tests/fixtures/t178-restaurant.json', 'utf8'));
const checkDocument = await readFile('public/code-check.html', 'utf8');
const server = createServer((_req, res) => { res.setHeader('content-type', 'text/html'); res.end(checkDocument); });
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); assert.ok(address && typeof address === 'object');
process.env.SITECRAFT_BASE = `http://127.0.0.1:${address.port}`;
let current: any;
(globalThis as any).__t178ParallelBrowser = (root: any) => {
  const record = { pid: root.pid, captures: 0, pages: [] as any[], isolation: null as any };
  current.browsers.push(record);
  const wrap = (page: any) => {
    const pageRecord = { targetId: page.targetId, contextId: page.browserContextId, captures: 0 };
    record.pages.push(pageRecord);
    return { ...page, async evaluate(expression: string) {
      const value = await page.evaluate(expression);
      if (value?.encoded) {
        record.captures++; pageRecord.captures++;
        if (!record.isolation) record.isolation = {
          contexts: await root.sendBrowser('Target.getBrowserContexts'),
          targets: await root.sendBrowser('Target.getTargets'),
          processes: await root.sendBrowser('SystemInfo.getProcessInfo'),
        };
      }
      return value;
    } };
  };
  return { ...wrap(root), async createContext() { return wrap(await root.createContext()); } };
};
const browserUrl = pathToFileURL(path.resolve('lib/code-site-browser.ts')).href;
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) specifier = pathToFileURL(path.resolve(specifier.slice(2) + '.ts')).href;
  const resolved = next(specifier, context);
  if (resolved.url !== browserUrl) return resolved;
  return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(
    'import {codeCheckBrowser as real} from ' + JSON.stringify(browserUrl + '?parallel-timing') + ';' +
    'export async function codeCheckBrowser(){return globalThis.__t178ParallelBrowser(await real())}'
  ) };
} });
const { checkSiteCode } = await import('../lib/code-site-check.ts');
const observations: any[] = [];
const header = { at: new Date().toISOString(), lanesPerSide: lanes, baselinePeakMiB, rssSamplingMs: 50,
  uncappedDiagnosticOnly: true, memoryStopDeltaMiB: 300, observations };
try {
  for (let repeat = 0; repeat < samples; repeat++) {
    current = { repeat, at: new Date().toISOString(), load: loadavg(), browsers: [], rss: [], completed: false };
    observations.push(current);
    await mkdir(`${output}/checks-${repeat}`);
    process.env.SITECRAFT_CHECK_DIAGNOSTICS_DIR = `${output}/checks-${repeat}`;
    let sampling = true;
    const sampler = (async () => {
      while (sampling) {
        const { stdout } = await run('ps', ['-axo', 'pid=,ppid=,rss=']);
        const rows = stdout.trim().split('\n').map(line => line.trim().split(/\s+/).map(Number));
        const owned = new Set<number>(current.browsers.map((browser: any) => browser.pid));
        for (let changed = true; changed;) {
          changed = false;
          for (const [pid, ppid] of rows) if (owned.has(ppid) && !owned.has(pid)) { owned.add(pid); changed = true; }
        }
        const processes = rows.filter(([pid]) => owned.has(pid)).map(([pid, ppid, rssKiB]) => ({ pid, ppid, rssKiB }));
        const rssMiB = processes.reduce((sum, row) => sum + row.rssKiB, 0) / 1024;
        current.rss.push({ at: Date.now(), rssMiB, processes });
        if (baselinePeakMiB !== null && rssMiB - baselinePeakMiB >= 300) {
          current.memoryStop = true;
          // Stop the owned processes immediately; the submission must reject.
          for (const browser of current.browsers) {
            try { process.kill(browser.pid, 'SIGTERM'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
          }
          break;
        }
        if (sampling) await new Promise(resolve => setTimeout(resolve, 50));
      }
    })();
    try {
      const result = await checkSiteCode({ siteId: fixture.timingSiteId, code: fixture.timingCandidate.code,
        materials: fixture.materials + '\n' + fixture.annotation, images: [], legacyImport: true,
        localEdit: { source: fixture.version.code, target: { kind: 'dom', versionId: fixture.version.id,
          pageId: 'home', path: [5], label: '收费口径',
          text: '收费口径 价格口径堂食单份含税价格，不另收服务费。 米饭单点米饭 3 元/碗；香菇鸡腿饭与午市单人组合包含米饭，不再另收米饭费用；其他热菜米饭单点。 饮用水免费提供。 外带包装费每单 2 元。 待补充 节假日营业安排待补充。' } },
        dynamicStateLanes: lanes, dynamicStateBudgetMs: Infinity });
      current.issues = result.checks.issues;
      current.viewports = result.checks.viewports.filter(row => row.pageId === 'home').map(row => ({ width: row.width, ...row.dynamicState }));
      assert.deepEqual(current.issues, []);
      assert.equal(current.viewports.length, 3);
      for (const browser of current.browsers) {
        assert.equal(browser.captures, 3 * 41, '每侧每档完整读取必须仍为 41 次');
        assert.equal(new Set(browser.pages.map((page: any) => page.contextId)).size, lanes);
        assert.ok(browser.isolation.processes.processInfo.filter((value: any) => value.type === 'renderer').length >= lanes,
          '不同 BrowserContext 必须同时拥有足够数量的 renderer');
      }
      current.completed = true;
    } catch (error) { current.error = String(error); }
    finally { sampling = false; await sampler; }
    current.peakMiB = Math.max(...current.rss.map((row: any) => row.rssMiB));
    current.deltaMiB = baselinePeakMiB === null ? null : current.peakMiB - baselinePeakMiB;
    console.log(JSON.stringify({ ...current, rss: undefined }));
    await writeFile(`${output}/timings.json`, JSON.stringify(header, null, 2) + '\n', 'utf8');
    if (current.memoryStop || current.error) break;
  }
} finally { await new Promise<void>(resolve => server.close(() => resolve())); }
assert.ok(observations.length === samples && observations.every(row => row.completed), '未完成样本或内存门禁停止，保留全部记录');
