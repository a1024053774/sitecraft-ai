import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { loadavg } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import { outsideCssApplications } from '../lib/code-site-local-edit.ts';
import { renderSiteCode } from '../lib/code-site.ts';

const [mode, output] = process.argv.slice(2);
assert.ok(mode === 'benchmark' || mode === 'profile');
assert.ok(output?.startsWith('artifacts/t178/'));
await mkdir(path.dirname(output), { recursive: true });
await mkdir(output);
const fixture = JSON.parse(await readFile('tests/fixtures/t178-restaurant.json', 'utf8'));
const checkDocument = await readFile('public/code-check.html', 'utf8');
const server = createServer((_req, res) => { res.setHeader('content-type', 'text/html'); res.end(checkDocument); });
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); assert.ok(address && typeof address === 'object');
process.env.SITECRAFT_BASE = `http://127.0.0.1:${address.port}`;

// One invocation performs one complete snapshot and one compact serialization.
// The full mode preserves the production ancestor Typed OM and pseudo contract.
function readOnce(variant: 'all-three' | 'present-three' | 'production-full' | 'production-bound') {
  const started = performance.now();
  const root = document.querySelector('main')!.children[5];
  const pathOf = (node: Element) => {
    const result: number[] = [];
    for (let child = node; child.parentElement; child = child.parentElement)
      result.unshift([...child.parentElement.children].indexOf(child));
    return result;
  };
  const outside = [...document.querySelectorAll('*')].filter(node => !root.contains(node));
  const standard = [...getComputedStyle(document.documentElement)].filter(name => !name.startsWith('--')).sort((a, b) => a.localeCompare(b));
  const full = variant.startsWith('production-');
  const pseudos = full ? ['', '::before', '::after', '::marker', '::first-line', '::first-letter'] : ['', '::before', '::after'];
  const rows: Array<[number[], string, boolean, string[], string[]]> = [];
  let propertyReads = 0, presentDeclarations = 0;
  for (const node of outside) for (const pseudo of pseudos) {
    const style = getComputedStyle(node, pseudo || null);
    const present = variant === 'all-three' || !pseudo || (pseudo === '::before' || pseudo === '::after'
      ? style.content !== 'none' && style.content !== 'normal' && style.display !== 'none'
      : pseudo === '::marker' ? getComputedStyle(node).display.includes('list-item') : true);
    const custom: string[] = [], values: string[] = [];
    if (present) {
      presentDeclarations++;
      if (style.length < standard.length) throw new Error('属性集合不完整');
      for (let index = standard.length; index < style.length; index++) custom.push(style[index]);
      const names = custom.length ? standard.concat(custom).sort((a, b) => a.localeCompare(b)) : standard;
      const computed = full && !pseudo && node.contains(root) ? (node as any).computedStyleMap() : null;
      if (computed) for (const name of names) values.push(computed.getAll(name).map((value: any) => value.toString()).join(', '));
      else if (variant === 'production-bound') {
        const readValue = style.getPropertyValue.bind(style);
        for (const name of names) values.push(readValue(name));
      } else for (const name of names) values.push(style.getPropertyValue(name));
      propertyReads += names.length;
    }
    rows.push([pathOf(node), pseudo, present, custom, values]);
  }
  const readEnded = performance.now();
  const text = JSON.stringify({ standard, rows });
  const serialized = performance.now();
  return { text, readMs: readEnded - started, serializeMs: serialized - readEnded,
    elements: outside.length, standardProperties: standard.length, declarations: rows.length, presentDeclarations, propertyReads };
}

async function benchmark() {
  const browser = await codeCheckBrowser();
  const observations: any[] = [];
  const nativeParse = JSON.parse;
  let protocolParseMs = 0, protocolReplies = 0;
  try {
    await browser.send('Network.enable');
    await browser.loadPage('Page.navigate', { url: `${process.env.SITECRAFT_BASE}/code-check.html` });
    assert.equal(await browser.evaluate(`document.contentType==='text/html' && performance.getEntriesByType('navigation')[0]?.responseStatus===200 && !!document.querySelector('meta[name="sitecraft-code-check"][content="v1"]') && !document.querySelector('script')`), true);
    await browser.send('Network.setBlockedURLs', { urls: ['*'] });
    const { frameTree } = await browser.send<any>('Page.getFrameTree');
    const html = renderSiteCode(fixture.timingSiteId, fixture.version.code, 'home');
    for (const width of [375, 768, 1440]) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      const reference = await outsideCssApplications(browser, frameTree.frame.id, html, { paths: [[5]] }, Infinity, { states: false });
      const entries = reference.states[0].entries;
      const expectedElements = new Set(entries.map(entry => JSON.stringify(entry.path))).size;
      const expectedProperties = entries.reduce((sum, entry) => sum + entry.styles.length, 0);
      for (const variant of ['all-three', 'present-three', 'production-full', 'production-bound'] as const) for (let repeat = 0; repeat < 5; repeat++) {
        protocolParseMs = 0; protocolReplies = 0;
        JSON.parse = ((text: string, ...args: any[]) => {
          const started = performance.now();
          const value = Reflect.apply(nativeParse, JSON, [text, ...args]);
          if (value?.id && value?.result) { protocolParseMs += performance.now() - started; protocolReplies++; }
          return value;
        }) as typeof JSON.parse;
        const startedAt = new Date().toISOString(), started = performance.now();
        let payload: ReturnType<typeof readOnce>;
        try { payload = await browser.evaluate(`(${readOnce.toString()})(${JSON.stringify(variant)})`); }
        finally { JSON.parse = nativeParse; }
        const replyMs = performance.now() - started;
        const parseStarted = performance.now();
        const data = nativeParse(payload.text);
        const parseMs = performance.now() - parseStarted;
        const totalMs = performance.now() - started;
        assert.equal(protocolReplies, 1, '每个样本只能有一次 Runtime.evaluate 回复');
        assert.equal(payload.elements, expectedElements);
        if (variant.startsWith('production-')) {
          assert.equal(payload.propertyReads, expectedProperties);
          const rebuilt = data.rows.map(([entryPath, pseudo, present, custom, values]: any[]) => {
            const names = custom.length ? data.standard.concat(custom).sort((a: string, b: string) => a.localeCompare(b)) : data.standard;
            return { path: entryPath, pseudo, present, styles: present ? names.map((name: string, index: number) => [name, values[index]]) : [] };
          });
          assert.deepEqual(rebuilt, entries, '完整基准必须与现有生产静态快照的全部属性一致');
        }
        if (!repeat) await writeFile(`${output}/snapshot-${width}-${variant}.json`, payload.text, 'utf8');
        const { text: _text, ...metrics } = payload;
        const row = { width, variant, repeat, startedAt, load: loadavg(), ...metrics, totalMs, replyMs,
          nodeProtocolParseMs: protocolParseMs, nodeDataParseMs: parseMs,
          cdpRemainderMs: replyMs - payload.readMs - payload.serializeMs - protocolParseMs,
          returnedCharacters: payload.text.length, productionElements: expectedElements, productionPropertyReads: expectedProperties };
        observations.push(row); console.log(JSON.stringify(row));
        await writeFile(`${output}/benchmark.json`, JSON.stringify(observations, null, 2) + '\n', 'utf8');
      }
    }
  } finally { JSON.parse = nativeParse; await browser.close(); }
}

async function profile() {
  const traces: Array<{ events: unknown[]; done: Promise<any>; resolve: (value: any) => void }> = [];
  const NativeWebSocket = globalThis.WebSocket;
  globalThis.WebSocket = class extends NativeWebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols);
      let resolve!: (value: any) => void;
      const trace = { events: [] as unknown[], done: new Promise<any>(done => { resolve = done; }), resolve: (value: any) => resolve(value) };
      traces.push(trace);
      this.addEventListener('message', event => {
        const text = String(event.data);
        if (!text.includes('"method":"Tracing.')) return;
        const record = JSON.parse(text);
        if (record.method === 'Tracing.dataCollected') for (const value of record.params.value) trace.events.push(value);
        if (record.method === 'Tracing.tracingComplete') trace.resolve(record.params);
      });
    }
  };
  const url = pathToFileURL(path.resolve('lib/code-site-browser.ts')).href;
  const records: any[] = [];
  const nowUs = () => Number(process.hrtime.bigint() / BigInt(1000));
  let productionEndUs = 0;
  (globalThis as any).__t178StartProfile = async (browser: Awaited<ReturnType<typeof codeCheckBrowser>>, id: number) => {
    await browser.send('Performance.enable');
    const metricsBefore = await browser.send('Performance.getMetrics');
    await browser.send('Profiler.enable');
    await browser.send('Profiler.setSamplingInterval', { interval: 1000 });
    await browser.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: {
      recordMode: 'recordAsMuchAsPossible', includedCategories: ['devtools.timeline', 'blink', 'v8', 'blink.user_timing'],
    } });
    const clock = { syncId: `t178-browser-${id}`, startUs: nowUs(), endUs: 0 };
    await browser.send('Tracing.recordClockSyncMarker', { syncId: clock.syncId });
    clock.endUs = nowUs();
    await browser.send('Profiler.start');
    const calls: any[] = [];
    return { ...browser,
      async send(method: string, params?: Record<string, unknown>) {
        const started = performance.now(), startUs = nowUs();
        try { return await browser.send(method, params); }
        finally { calls.push({ method, startUs, endUs: nowUs(), startedAt: started, durationMs: performance.now() - started }); }
      },
      async evaluate(expression: string) {
        const started = performance.now(), startUs = nowUs();
        const result = await browser.evaluate<any>(expression);
        calls.push({ method: 'Runtime.evaluate', startUs, endUs: nowUs(), startedAt: started, durationMs: performance.now() - started,
          ...(result?.encoded ? { readMs: result.read, serializeMs: result.serialize, compressMs: result.compress } : {}) });
        return result;
      },
      async close() {
        productionEndUs ||= nowUs();
        try {
          const metricsAfter = await browser.send('Performance.getMetrics');
          const { profile: cpu } = await browser.send<any>('Profiler.stop');
          await browser.send('Tracing.end');
          const completion = await traces[id].done;
          await writeFile(`${output}/chrome-${id}.cpuprofile`, JSON.stringify(cpu), 'utf8');
          await writeFile(`${output}/chrome-${id}.trace.json`, JSON.stringify({ traceEvents: traces[id].events, completion }), 'utf8');
          records.push({ id, clock, metricsBefore, metricsAfter, completion, calls });
          assert.equal(completion.dataLossOccurred, false, 'Tracing 不能丢事件');
        } finally { await browser.close(); }
      },
    };
  };
  registerHooks({ resolve(specifier, context, next) {
    if (specifier.startsWith('@/')) specifier = pathToFileURL(path.resolve(specifier.slice(2) + '.ts')).href;
    const result = next(specifier, context);
    if (result.url !== url) return result;
    return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(
      'import {codeCheckBrowser as real} from ' + JSON.stringify(url + '?t178-profile') + ';let id=0;' +
      'export async function codeCheckBrowser(){return globalThis.__t178StartProfile(await real(),id++)}'
    ) };
  } });
  await mkdir(`${output}/checks`);
  process.env.SITECRAFT_CHECK_DIAGNOSTICS_DIR = `${output}/checks`;
  try {
    const { checkSiteCode } = await import('../lib/code-site-check.ts');
    const code = fixture.version.code;
    // The saved source target was verified against the v2 DOM in the prior run.
    const target = { kind: 'dom' as const, pageId: 'home', path: [5], versionId: fixture.version.id, label: '收费口径',
      text: '收费口径 价格口径堂食单份含税价格，不另收服务费。 米饭单点米饭 3 元/碗；香菇鸡腿饭与午市单人组合包含米饭，不再另收米饭费用；其他热菜米饭单点。 饮用水免费提供。 外带包装费每单 2 元。 待补充 节假日营业安排待补充。' };
    const productionStartUs = nowUs();
    const result = await checkSiteCode({ siteId: fixture.timingSiteId, code: fixture.timingCandidate.code,
      materials: fixture.materials + '\n' + fixture.annotation, images: [], legacyImport: true,
      localEdit: { source: code, target }, dynamicStateBudgetMs: Infinity });
    await writeFile(`${output}/result.json`, JSON.stringify({ at: new Date().toISOString(), productionStartUs, productionEndUs, checks: result.checks, records }, null, 2) + '\n', 'utf8');
    assert.deepEqual(result.checks.issues, []);
  } finally { globalThis.WebSocket = NativeWebSocket; }
}

try { if (mode === 'benchmark') await benchmark(); else await profile(); }
finally { await new Promise<void>(resolve => server.close(() => resolve())); }
