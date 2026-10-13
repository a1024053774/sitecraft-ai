import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { localEndpoint } from '../../scripts/local-endpoint.ts';
import { codeCheckBrowser } from '../../lib/code-site-browser.ts';
import { inlineSite, inlineMaterials } from '../fixtures/t162-inline-site.ts';

registerHooks({ resolve(specifier, context, next) {
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });
export const base = localEndpoint('SITECRAFT_BASE').origin;
export const { commitSiteCode, updateCodeSite } = await import('../../lib/code-site-store.ts');
export const output = `artifacts/t162/${process.env.T162_LABEL || 'browser'}-${Date.now()}`;
await mkdir(output, { recursive: true });
export const state = async (id: string) => {
  const res = await fetch(`${base}/api/sites/${id}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"action":"state"}' });
  assert.equal(res.status, 200); return res.json();
};
export async function fixture() {
  const identity = await fetch(`${base}/api/health`).then(r => r.json());
  assert.equal(identity.testIdentity?.cwd, process.cwd(), '拒绝写入其他工作树');
  const res = await fetch(`${base}/api/sites`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"name":"青禾纸品"}' });
  assert.equal(res.status, 201); const { id } = await res.json();
  const saved = await commitSiteCode({ siteId: id, baseRevision: 0, code: inlineSite, author: 'user', summary: '批注测试初版', request: inlineMaterials });
  assert.equal(saved.status, 'applied', JSON.stringify(saved));
  assert.equal((await state(id)).codeSite.currentVersionId, saved.status === 'applied' ? saved.version.id : null, '应用与测试须使用同一工作树的数据目录');
  await updateCodeSite(id, () => ({ materials: inlineMaterials, preferences: { style: 'precision', layout: 5, density: 6 }, plan: { summary: '纸品目录', style: 'precision', styleReason: '既有方向', pages: [{ id: 'home', title: '首页', outline: '纸品与纸袋' }, { id: 'products', title: '产品', outline: '纸品目录' }] } }));
  return id;
}
export async function session(width: number, options: { siteId?: string; beforeNavigate?: (browser: Awaited<ReturnType<typeof codeCheckBrowser>>) => Promise<void> } = {}) {
  const id = options.siteId ?? await fixture(), browser = await codeCheckBrowser();
  const wait = async (expression: string, timeout = 20000, captureFailure = false) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const observed = await browser.evaluate<{ ready: boolean; error?: string }>(`({ready:Boolean(${expression}),error:window.__t162ReviewErrors?.[0]})`);
      if (observed.error && !captureFailure) throw new Error(`工作台存在未捕获错误：${observed.error}`);
      if (observed.ready) return;
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error(`等待失败：${expression}`);
  };
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
    for (let i=0;i<180;i++) { const result=await state(id); if (result.codeSite.run && result.codeSite.run.id !== previousRunId && result.codeSite.run.status !== 'running') return result; await new Promise(r=>setTimeout(r,300)); }
    throw new Error('任务未结束');
  };
  try {
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
