import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { loadavg } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseFragment, type DefaultTreeAdapterTypes as Dom } from 'parse5';

const [mode, output, samplesOption] = process.argv.slice(2);
assert.ok(mode === 'idle' || mode === 'load');
assert.ok(output?.startsWith('artifacts/t178/'));
const samples = samplesOption === undefined ? 5 : Number(samplesOption);
assert.ok(Number.isInteger(samples) && samples > 0 && samples <= 5);
await mkdir(path.dirname(output), { recursive: true });
await mkdir(output);

// Observe the production boundary, including its two browsers and comparison.
// Use the production per-read budget, including the shared three-viewport cap.
const timing: { calls: any[]; browsers: any[] } = { calls: [], browsers: [] };
(globalThis as any).__t178Timing = timing;
const browserUrl = pathToFileURL(path.resolve('lib/code-site-browser.ts')).href;
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) specifier = pathToFileURL(path.resolve(specifier.slice(2) + '.ts')).href;
  const resolved = next(specifier, context);
  if (resolved.url !== browserUrl) return resolved;
  return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(
    'import {codeCheckBrowser as real} from ' + JSON.stringify(browserUrl + '?t178-timing') + ';' +
    'export async function codeCheckBrowser(){const browser=await real(),t=globalThis.__t178Timing,m={id:t.browsers.length,captures:0};t.browsers.push(m);' +
    'return {...browser,send(method,params){if(method!=="Emulation.setDeviceMetricsOverride")return browser.send(method,params);const start=performance.now();return browser.send(method,params).then(value=>{t.calls.push({browser:m.id,width:params.width,durationMs:performance.now()-start});return value})},' +
    'async evaluate(expression){const value=await browser.evaluate(expression);if(value&&typeof value==="object"&&"encoded" in value)m.captures++;if(value?.all&&value?.roots&&value?.interactive)m.discovery={elements:value.all.length,roots:value.roots,interactive:value.interactive.length};return value}}}'
  ) };
} });
const { checkSiteCode } = await import('../lib/code-site-check.ts');
const fixture = JSON.parse(await readFile('tests/fixtures/t178-restaurant.json', 'utf8'));
const source = fixture.version, candidate = fixture.timingCandidate;
const main = parseFragment(source.code.pages[0].html).childNodes.find(node => 'tagName' in node && node.tagName === 'main') as Dom.Element;
const selected = main.childNodes.filter(node => 'tagName' in node)[5];
const text = (node: Dom.Node): string => node.nodeName === '#text' ? (node as Dom.TextNode).value : 'childNodes' in node ? node.childNodes.map(text).join('') : '';
const target = { kind: 'dom' as const, versionId: source.id, pageId: 'home', path: [5], label: '收费口径', text: text(selected).replace(/\s+/g, ' ').trim().slice(0, 1000) };
const document = await readFile('public/code-check.html', 'utf8');
const server = createServer((_req, res) => { res.setHeader('content-type', 'text/html'); res.end(document); });
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); assert.ok(address && typeof address === 'object');
process.env.SITECRAFT_BASE = 'http://127.0.0.1:' + address.port;
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const observations: any[] = [];
try {
  for (let repeat = 0; repeat < samples; repeat++) {
    timing.calls.length = 0; timing.browsers.length = 0;
    const directory = output + '/repeat-' + repeat + '/checks';
    await mkdir(directory, { recursive: true });
    process.env.SITECRAFT_CHECK_DIAGNOSTICS_DIR = directory;
    const row: any = { repeat, startedAt: new Date().toISOString(), load: loadavg(), completed: false };
    observations.push(row);
    try {
      const result = await checkSiteCode({ siteId: fixture.timingSiteId, code: candidate.code,
        materials: fixture.materials + '\n' + fixture.annotation, images: [], legacyImport: true,
        localEdit: { source: source.code, target } });
      row.issues = result.checks.issues;
      const nextPage = timing.calls.findIndex((call, index) => call.width === 375 && timing.calls.slice(0, index).some(previous => previous.width === 1440));
      const homeCalls = nextPage < 0 ? timing.calls : timing.calls.slice(0, nextPage);
      row.viewports = result.checks.viewports.filter(value => value.pageId === 'home').map(value => ({
        width: value.width, ...value.dynamicState,
        viewportMs: homeCalls.filter(call => call.width === value.width).reduce((sum, call) => sum + call.durationMs, 0),
      }));
      row.completed = true;
      for (const viewport of row.viewports) for (const side of ['source', 'candidate']) {
        assert.equal(viewport[side].interactiveElements, 10);
        assert.equal(viewport[side].statesChecked, 4);
      }
      assert.equal(row.viewports.length, 3);
      assert.equal(timing.browsers.length, 2, '源与候选各一浏览器，三档复用');
      assert.ok(timing.browsers.every(browser => browser.captures === 123), '每侧三档各 41 份完整快照');
      for (const viewport of row.viewports) {
        assert.equal(viewport.budget.fullReads, 82, '真实夹具每侧 41 次，读取前合计 82 次');
        assert.equal(viewport.budget.calculatedMs, 13300);
      }
      row.targetMet = row.issues.length === 0 && row.viewports.every((viewport: any) => viewport.durationMs <= viewport.budget.allowedMs);
    } catch (error) { row.error = error instanceof Error ? error.message : String(error); }
    row.browsers = structuredClone(timing.browsers);
    row.viewportCalls = structuredClone(timing.calls);
    row.diagnostics = await Promise.all((await readdir(directory)).filter(name => name.endsWith('.json')).map(async name => JSON.parse(await readFile(path.join(directory, name), 'utf8'))));
    console.log(JSON.stringify({ ...row, diagnostics: undefined }));
    await writeFile(output + '/timings.json', JSON.stringify({ revision, mode, budget: 'production-per-read', samples, reference: fixture.timingOrigin,
      sourceVersion: source.id, candidateVersion: candidate.id, page: 'home', target: target.path, observations }, null, 2) + '\n', 'utf8');
  }
} finally { await new Promise<void>(resolve => server.close(() => resolve())); }
assert.ok(observations.every(row => row.completed && !row.error && row.targetMet), '每轮三档必须在生产预算内通过，失败记录保留');
