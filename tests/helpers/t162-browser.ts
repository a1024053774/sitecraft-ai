import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { EventEmitter, once } from 'node:events';
import { AsyncLocalStorage } from 'node:async_hooks';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { loadavg } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { localEndpoint } from '../../scripts/local-endpoint.ts';
import { codeCheckBrowser } from '../../lib/code-site-browser.ts';
import { inlineSite, inlineMaterials } from '../fixtures/t162-inline-site.ts';
import { createT162ModelFixture } from '../fixtures/t162-model-fixture.ts';

const scheduled = new AsyncLocalStorage<Array<() => Promise<void>>>();
(globalThis as any).__t162After = (fn: () => Promise<void>) => {
  const callbacks = scheduled.getStore(); assert.ok(callbacks, 'after 必须归属于创建任务的请求'); callbacks.push(fn);
};
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'next/server.js') return { shortCircuit: true, url: 'data:text/javascript,export function after(fn){globalThis.__t162After(fn)}' };
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });
export const base = localEndpoint('SITECRAFT_BASE').origin;
export const output = `artifacts/t162/${process.env.T162_LABEL || 'self-contained'}-${Date.now()}-${process.pid}`;
await mkdir(output, { recursive: true });
const timings: Array<{ phase: string; startedAt: string; durationMs: number; load: number }> = [];
const transitions: Array<{ at: string; runId: string; status: string; step: string }> = [];
let currentSignal: AbortSignal;
test.beforeEach(context => { currentSignal = context.signal; });
function cancellable<T>(work: Promise<T>, signal = currentSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    work.then(value => { signal.removeEventListener('abort', abort); resolve(value); }, error => { signal.removeEventListener('abort', abort); reject(error); });
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
}
let localGate: { received: () => void; resume: Promise<void> } | null = null;
export function holdNextLocalReply() {
  assert.equal(localGate, null, '不能同时挂起两个替身响应');
  let received!: () => void, release!: () => void;
  const requested = new Promise<void>(resolve => { received = resolve; });
  const resume = new Promise<void>(resolve => { release = resolve; });
  localGate = { received, resume };
  return { requested: () => cancellable(requested), release };
}
export async function measured<T>(phase: string, work: () => Promise<T>): Promise<T> {
  const start = performance.now(), startedAt = new Date().toISOString();
  try { return await work(); }
  finally { timings.push({ phase, startedAt, durationMs: performance.now() - start, load: loadavg()[0] }); }
}
const provider = createT162ModelFixture(output, async () => {
  const gate = localGate; localGate = null;
  if (gate) { gate.received(); await gate.resume; }
});
await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
const address = provider.address(); assert.ok(address && typeof address === 'object');
process.env.SITE_STORE = 'fs';
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
process.env.DEEPSEEK_API_KEY = 'local-only'; process.env.DEEPSEEK_MODEL = 'local-only';
const store = await import('../../lib/code-site-store.ts');
export const { commitSiteCode, updateCodeSite } = store;
const { POST: chat } = await import('../../app/api/sites/[siteId]/chat/route.ts');
const { POST: history } = await import('../../app/api/sites/[siteId]/history/[action]/route.ts');
const tasks: Promise<void>[] = [], errors: unknown[] = [];
const runEvents = new EventEmitter();
const runs = new Map<string, { id: string; finished: Promise<void> }>();
// Like T-152, call production POSTs and run their after callbacks. Chat/history
// own model calls here; the ordinary dev server supplies UI/preview and reads.
const bridge = createServer(async (req, res) => {
  res.setHeader('access-control-allow-origin', base);
  res.setHeader('access-control-allow-methods', 'POST, OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const match = req.url?.match(/^\/api\/sites\/([a-z0-9_-]+)\/(chat|history\/(undo|restore))$/i);
  if (req.method !== 'POST' || !match) { res.writeHead(404); res.end(); return; }
  try {
    const start = performance.now(), startedAt = new Date().toISOString();
    let raw = ''; for await (const chunk of req) raw += chunk;
    const request = new Request(`${base}${req.url}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw });
    const callbacks: Array<() => Promise<void>> = [];
    const response = await scheduled.run(callbacks, () => match[2] === 'chat' ? chat(request, { params: Promise.resolve({ siteId: match[1] }) })
      : history(request, { params: Promise.resolve({ siteId: match[1], action: match[3] }) }));
    const text = await response.text(), payload = JSON.parse(text);
    const run = payload.codeSite?.run;
    if (run && transitions.at(-1)?.step !== run.step) transitions.push({ at: new Date().toISOString(), runId: run.id, status: run.status, step: run.step });
    timings.push({ phase: `route.${match[2] === 'chat' ? JSON.parse(raw).action === 'state' ? 'state' : 'chat' : 'history'}`, startedAt, durationMs: performance.now() - start, load: loadavg()[0] });
    res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(text);
    for (const fn of callbacks) {
      assert.ok(run?.id, 'after 任务须有持久化运行标识');
      const finished = measured('after.task', fn);
      tasks.push(finished.catch(error => { errors.push(error); }));
      runs.set(match[1], { id: run.id, finished }); runEvents.emit(match[1]);
    }
  } catch (error) { errors.push(error); res.writeHead(500); res.end(JSON.stringify({ userMessage: String(error) })); }
});
await new Promise<void>(resolve => bridge.listen(0, '127.0.0.1', resolve));
const bridgeAddress = bridge.address(); assert.ok(bridgeAddress && typeof bridgeAddress === 'object');
export const workflowBase = `http://127.0.0.1:${bridgeAddress.port}`;
test.after(async () => {
  await Promise.all(tasks);
  await Promise.all([new Promise<void>(resolve => bridge.close(() => resolve())), new Promise<void>(resolve => provider.close(() => resolve()))]);
  await writeFile(`${output}/timings.json`, JSON.stringify({ timings, transitions }, null, 2));
  assert.deepEqual(errors, [], '临时 HTTP/调度服务不能吞掉失败');
});
export const state = async (id: string) => {
  const res = await fetch(`${workflowBase}/api/sites/${id}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"action":"state"}' });
  assert.equal(res.status, 200); return res.json();
};
export async function fixture() { return measured('fixture.build', async () => {
  const health = await fetch(`${base}/api/health`), identity = await health.json();
  await writeFile(`${output}/health.json`, JSON.stringify({ status: health.status, cwd: identity.testIdentity?.cwd, providerConfigured: identity.deepseek?.configured }, null, 2));
  assert.equal(identity.testIdentity?.cwd, process.cwd(), '拒绝写入其他工作树');
  const res = await fetch(`${base}/api/sites`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"name":"青禾纸品"}' });
  assert.equal(res.status, 201); const { id } = await res.json();
  const saved = await measured('commit.initial', () => commitSiteCode({ siteId: id, baseRevision: 0, code: inlineSite, author: 'user', summary: '批注测试初版', request: inlineMaterials }));
  assert.equal(saved.status, 'applied', JSON.stringify(saved));
  const readback = await fetch(`${base}/api/sites/${id}/draft`); assert.equal(readback.status, 200);
  assert.equal((await readback.json()).codeSite.currentVersionId, saved.status === 'applied' ? saved.version.id : null, '普通 dev server 须读到经提交入口保存的版本');
  await updateCodeSite(id, () => ({ materials: inlineMaterials, preferences: { style: 'precision', layout: 5, density: 6 }, plan: { summary: '纸品目录', style: 'precision', styleReason: '既有方向', pages: [{ id: 'home', title: '首页', outline: '纸品与纸袋' }, { id: 'products', title: '产品', outline: '纸品目录' }] } }));
  return id;
}); }
export async function session(width: number, options: { siteId?: string; beforeNavigate?: (browser: Awaited<ReturnType<typeof codeCheckBrowser>>) => Promise<void> } = {}) {
  const id = options.siteId ?? await fixture(), browser = await measured('chrome.launch', codeCheckBrowser);
  const wait = async (expression: string, timeout = 20000, captureFailure = false) => measured(expression.includes('getAnimations') ? 'ui.animations' : expression.includes('contentDocument') ? 'ui.preview' : 'ui.state', async () => {
    const observation = browser.evaluate(`new Promise((resolve,reject)=>{
      const documents=new Set(),animations=new WeakSet(),events=['load','scroll','transitionend','animationend','animationcancel'];
      let stopped=false,timer;const observer=new MutationObserver(check);
      function finish(error){if(stopped)return;stopped=true;clearTimeout(timer);observer.disconnect();
        for(const doc of documents)for(const name of events)doc.removeEventListener(name,check,true);
        window.removeEventListener('resize',check);window.removeEventListener('error',check);error?reject(error):resolve(true)}
      function watch(doc){if(!doc||documents.has(doc))return;documents.add(doc);observer.observe(doc,{childList:true,subtree:true,attributes:true,characterData:true});
        for(const name of events)doc.addEventListener(name,check,true)}
      function check(){if(stopped)return;try{watch(document);watch(document.querySelector('[data-testid="code-preview"]')?.contentDocument);
        const error=window.__t162ReviewErrors?.[0];if(error&&!${captureFailure})throw new Error('工作台存在未捕获错误：'+error);
        if(Boolean(${expression})){finish();return}
        for(const animation of document.getAnimations())if(!animations.has(animation)&&Number.isFinite(animation.effect?.getComputedTiming().endTime)){
          animations.add(animation);animation.finished.then(check,check)}
      }catch(error){finish(error)}}
      timer=setTimeout(()=>finish(new Error('等待失败：'+${JSON.stringify(expression)})),${timeout});
      window.addEventListener('resize',check);window.addEventListener('error',check);check();
    })`);
    try { await (captureFailure ? observation : cancellable(observation)); }
    catch (error) {
      const diagnostics = await browser.evaluate(`({at:new Date().toISOString(),now:performance.now(),
        events:window.__t162AnimationEvents,
        animations:document.getAnimations().map(animation=>({name:animation.animationName,playState:animation.playState,
          currentTime:animation.currentTime,startTime:animation.startTime,pending:animation.pending,
          target:animation.effect?.target?.outerHTML?.slice(0,500),
          timing:Object.fromEntries(Object.entries(animation.effect?.getComputedTiming()??{}).map(([key,value])=>[key,typeof value==='number'&&!Number.isFinite(value)?String(value):value]))}))})`);
      await writeFile(`${output}/wait-failure-${width}-${id}-${Date.now()}.json`, JSON.stringify({ expression, timeout, diagnostics }, null, 2), 'utf8');
      throw error;
    }
  });
  const click = async (selector: string) => {
    await wait(`!document.getAnimations().some(a=>(a.playState==='running'||a.playState==='pending')&&Number.isFinite(a.effect?.getComputedTiming().endTime))`);
    const point = await browser.evaluate<{x:number;y:number}>(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el||el.disabled)throw new Error('不可操作：'+${JSON.stringify(selector)});el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    assert.equal(await browser.evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)}),hit=document.elementFromPoint(${point.x},${point.y});return hit===el||el.contains(hit)})()`), true, `指针须命中 ${selector}`);
    await browser.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
    await browser.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
    await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  };
  const key = async (value: string, modifiers = 0) => {
    await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: value, code: value.length === 1 ? `Key${value.toUpperCase()}` : value, modifiers, ...(value === 'Enter' && !modifiers ? { text: '\r' } : {}) });
    await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: value, modifiers });
  };
  const pick = async (selector = 'article p', label = '深层纸袋区块') => {
    await wait(`!document.querySelector('.code-preview-loading')`);
    if(await browser.evaluate(`document.querySelector('[data-testid="pick-block"]').getAttribute('aria-pressed')!=='true'`))await click('[data-testid="pick-block"]');
    await wait(`document.querySelector('[data-testid="pick-block"]').getAttribute('aria-pressed')==='true'`);
    await browser.evaluate(`document.querySelector('[data-testid="code-preview"]').contentDocument.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);
    // Scroll updates the floating composer in React before the pointer is placed.
    await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const point = await browser.evaluate<{x:number;y:number}>(`(()=>{const f=document.querySelector('[data-testid="code-preview"]'),n=f.contentDocument.querySelector(${JSON.stringify(selector)});const r=n.getBoundingClientRect(),fr=f.getBoundingClientRect(),s=fr.width/f.offsetWidth;return{x:fr.x+(r.x+r.width/2)*s,y:fr.y+(r.y+r.height/2)*s}})()`);
    assert.equal(await browser.evaluate(`document.elementFromPoint(${point.x},${point.y})===document.querySelector('[data-testid="code-preview"]')`),true,'指针须实际命中 iframe');
    await browser.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    // An open composer keeps its current range; after scrolling that range can
    // be offscreen. The next native click still selects the new target.
    if (!await browser.evaluate(`!!document.querySelector('[data-testid="annotation-composer"]')`))
      await wait(`document.querySelector('.code-selection-outline')`);
    await browser.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
    await browser.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
    await wait(`document.querySelector('[data-testid="annotation-composer"]') && document.querySelector('[data-testid="annotation-scope"]')?.textContent.includes(${JSON.stringify(label)})`);
    await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    assert.ok(await browser.evaluate<boolean>(`document.querySelector('[data-testid="annotation-scope"]').textContent.includes(${JSON.stringify(label)})`));
  };
  const shot = async (name: string) => {
    await browser.evaluate('document.fonts.ready');
    await wait(`!document.getAnimations().some(a=>(a.playState==='running'||a.playState==='pending')&&Number.isFinite(a.effect?.getComputedTiming().endTime))`, 20000, true);
    const result = await browser.send<{data:string}>('Page.captureScreenshot', { format: 'png' });
    await writeFile(`${output}/${name}-${width}-${id}.png`, Buffer.from(result.data, 'base64'));
  };
  const settle = async (previousRunId?: string) => {
    // A completed callback remains in the map, so a late observer cannot miss it.
    while (!runs.has(id) || runs.get(id)!.id === previousRunId) await once(runEvents, id, { signal: currentSignal });
    await cancellable(runs.get(id)!.finished);
    const result = await state(id);
    assert.notEqual(result.codeSite.run.id, previousRunId);
    assert.notEqual(result.codeSite.run.status, 'running', 'after 完成后任务须有终态');
    return result;
  };
  try {
    await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__t162AnimationEvents=[];
      for(const name of ['animationstart','animationend','animationcancel'])document.addEventListener(name,event=>{
        window.__t162AnimationEvents.push({type:name,name:event.animationName,elapsedTime:event.elapsedTime,at:new Date().toISOString(),now:performance.now(),target:event.target?.outerHTML?.slice(0,300)});
      },true);` });
    await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `const workflowFetch=window.fetch;window.fetch=function(input,init){const url=new URL(String(input),location.href);if(url.origin===${JSON.stringify(base)}&&/^\\/api\\/sites\\/[a-z0-9_-]+\\/(chat|history\\/(undo|restore))$/i.test(url.pathname))return workflowFetch.call(this,${JSON.stringify(workflowBase)}+url.pathname,init);return workflowFetch.apply(this,arguments)}` });
    if (options.beforeNavigate) await options.beforeNavigate(browser);
    await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await browser.send('Page.navigate', { url: `${base}/workspace?site=${id}` });
    await wait(`document.querySelector('[data-testid="code-preview"]')?.contentDocument?.querySelector('main h1') || window.__t162ReviewErrors?.length`);
    assert.ok(await browser.evaluate<boolean>(`!!document.querySelector('[data-testid="code-workspace"]')`), '存储被拒时工作台不得崩溃');
    if (width < 1100) await click('[role="tab"]:nth-child(2)');
    if (width !== 1440) { await click(`.device-toggle[aria-label="预览宽度"] button:nth-child(${width === 768 ? 2 : 3})`); await wait(`document.querySelector('[data-testid="code-preview"]').offsetWidth===${width}`); }
    await wait(`!document.getAnimations().some(a=>a.playState==='running')`);
    return { id, browser, wait, click, key, pick, shot, settle };
  } catch (error) { try { await shot('session-failure'); } finally { await browser.close(); } throw error; }
}
