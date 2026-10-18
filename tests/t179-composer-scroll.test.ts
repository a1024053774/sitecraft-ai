import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseFragment, type DefaultTreeAdapterTypes as Dom } from 'parse5';
import { base, commitSiteCode, session, updateCodeSite } from './helpers/t162-browser.ts';

// T-179：首次定位须腾位；随后原生滚轮决定阅读位置，直到重新点选/打开。
// 先保留 4781659 的真实测量，再加入需求断言，最后修改产品代码。
const output = `artifacts/t179/measurement-${Date.now()}-${process.pid}`;
await mkdir(output, { recursive: true });
await writeFile(`${output}/measurement.ts`, await readFile(new URL(import.meta.url), 'utf8'), 'utf8');
const restaurant = JSON.parse(await readFile(new URL('./fixtures/t175-restaurant.json', import.meta.url), 'utf8'));
async function historicalSite() {
  const response = await fetch(`${base}/api/sites`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: restaurant.name }) });
  assert.equal(response.status, 201); const { id } = await response.json();
  await updateCodeSite(id, () => ({ materials: `${restaurant.materials}\n${restaurant.annotation}`, plan: restaurant.plan, preferences: restaurant.preferences }));
  const first = await commitSiteCode({ siteId: id, baseRevision: 0, code: restaurant.version.code, author: 'user', summary: '滚动测量初版', request: '' });
  assert.equal(first.status, 'applied', JSON.stringify(first)); if (first.status !== 'applied') throw new Error('初版未存成');
  const main = parseFragment(first.version.code.pages[0].html).childNodes.find(node => 'tagName' in node && node.tagName === 'main') as Dom.Element;
  const block = main.childNodes.filter(node => 'tagName' in node)[5];
  const text = (node: Dom.Node): string => node.nodeName === '#text' ? (node as Dom.TextNode).value : 'childNodes' in node ? node.childNodes.map(text).join('') : '';
  const target = { kind: 'dom', pageId: 'home', versionId: first.version.id, path: [5], label: '收费口径', text: text(block).replace(/\s+/g, ' ').trim().slice(0, 1000) };
  const created = await fetch(`${base}/api/sites/${id}/annotations`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
    pageId: 'home', pagePath: '/home', author: { id: 'scroll-test', name: '你' }, body: `${restaurant.annotation}\n补充说明：查看本条意见时，请保留收费口径的其余说明和原有操作。\n回看时还需要对照堂食价格、米饭和饮用水说明。`,
    anchor: { pageId: 'home', pagePath: '/home', revision: 1, locale: 'zh', capturedAt: new Date().toISOString(), target, snapshot: { label: target.label } },
  }) });
  assert.equal(created.status, 201);
  const second = await commitSiteCode({ siteId: id, baseRevision: 1, code: first.version.code, author: 'user', summary: '保留历史线程', request: '' });
  assert.equal(second.status, 'applied', JSON.stringify(second)); return id;
}

// 只观察真实 scrollBy 调用及浏览器事件；不拦截默认滚动或改写参数。
const observeScript = `(()=>{
  const log=window.__t179Log=[]; window.__t179Phase='open';
  const snapshot=()=>{const f=document.querySelector('[data-testid="code-preview"]'),s=document.querySelector('.code-preview-stage');
    return {inner:f?.contentWindow?.scrollY,outer:s?.scrollTop}};
  const record=(type,detail={})=>log.push({phase:window.__t179Phase,type,...detail,scroll:snapshot()});
  const watched=new WeakSet();
  const watch=()=>{
    const f=document.querySelector('[data-testid="code-preview"]'),s=document.querySelector('.code-preview-stage');
    for(const [object,name] of [[f?.contentWindow,'iframe'],[s,'stage']]){
      if(!object||watched.has(object))continue;watched.add(object);
      const native=object.scrollBy;
      object.scrollBy=function(...args){record('scrollBy',{scroller:name,args});const result=native.apply(this,args);record('scrollBy.done',{scroller:name});return result};
      object.addEventListener('scroll',()=>record('scroll',{scroller:name}),true);
      object.addEventListener('wheel',event=>record('wheel',{scroller:name,deltaY:event.deltaY,trusted:event.isTrusted}),{capture:true,passive:true});
    }
  };
  document.addEventListener('load',watch,true);new MutationObserver(watch).observe(document,{childList:true,subtree:true});watch();
})()`;

type View = Awaited<ReturnType<typeof session>>;
async function geometry(view: View) {
  return view.browser.evaluate<any>(`(()=>{
    const box=el=>el?.getBoundingClientRect().toJSON(),f=document.querySelector('[data-testid="code-preview"]'),s=document.querySelector('.code-preview-stage');
    const fr=f.getBoundingClientRect(),sr=s.getBoundingClientRect(),r=f.contentDocument.querySelector('main').children[5].getBoundingClientRect(),scale=fr.width/f.offsetWidth;
    return {scroll:{inner:f.contentWindow.scrollY,outer:s.scrollTop},panel:box(document.querySelector('[data-testid="annotation-composer"]')),
      target:{top:fr.top+r.top*scale,bottom:fr.top+r.bottom*scale},stage:box(s),bar:box(document.querySelector('.code-preview-version')),
      loaded:!document.querySelector('.code-preview-loading')&&f.contentDocument.readyState==='complete',
      point:{x:Math.min(fr.right,sr.right)-20,y:Math.max(fr.top,sr.top)+24},log:window.__t179Log};
  })()`);
}
async function wheel(view: View, direction: string, deltaY: number) {
  const before = await geometry(view), point = before.point;
  assert.equal(await view.browser.evaluate(`document.elementFromPoint(${point.x},${point.y})===document.querySelector('[data-testid="code-preview"]')`), true, '真实滚轮须命中预览 iframe');
  await view.browser.evaluate(`(()=>{
    window.__t179Phase=${JSON.stringify(direction)};
    window.__t179WheelFinished=new Promise((resolve,reject)=>{
      const f=document.querySelector('[data-testid="code-preview"]'),s=document.querySelector('.code-preview-stage');
      let ended=false,stable=0,previous='';
      const timer=setTimeout(()=>{cleanup();reject(new Error('原生滚动未结束'))},10000);
      const cleanup=()=>{clearTimeout(timer);f.contentWindow.removeEventListener('scrollend',end);s.removeEventListener('scrollend',end)};
      const end=()=>{if(ended)return;ended=true;requestAnimationFrame(check)};
      const check=()=>{const next=JSON.stringify([f.contentWindow.scrollY,s.scrollTop,document.querySelector('.code-annotation-position')?.getBoundingClientRect().toJSON()]);
        stable=next===previous?stable+1:0;previous=next;
        if(stable>=4){cleanup();resolve(true)}else requestAnimationFrame(check)};
      f.contentWindow.addEventListener('scrollend',end);s.addEventListener('scrollend',end);
    });return true;
  })()`);
  await view.browser.send('Input.dispatchMouseEvent', { type: 'mouseWheel', ...point, deltaX: 0, deltaY });
  await view.browser.evaluate('window.__t179WheelFinished');
  const after = await geometry(view);
  return { direction, deltaY, before, after, programmatic: after.log.filter((entry: any) => entry.phase === direction && entry.type === 'scrollBy') };
}
async function shot(view: View, name: string, width: number) {
  const result = await view.browser.send<{ data: string }>('Page.captureScreenshot', { format: 'png' });
  await writeFile(`${output}/${name}-${width}.png`, Buffer.from(result.data, 'base64'));
}

function assertInitial(observed: any, width: number) {
  const p = observed.panel, t = observed.target;
  assert.ok(p && p.top >= 0 && p.bottom <= 1000 && p.left >= 0 && p.right <= width, '首次浮层完整留在视口内');
  assert.ok(t.bottom > observed.stage.top && t.top < observed.stage.bottom, '首次定位仍可见目标');
  assert.ok(p.bottom <= t.top || p.top >= t.bottom, '首次腾位须避开目标');
  if (observed.bar) assert.ok(p.top >= observed.bar.bottom, '首次腾位须避开历史回看栏');
  assert.ok(observed.log.some((entry: any) => entry.type === 'scrollBy'), '须实际触发预览自动腾位，不能只检查本来就能放下的浮层');
}
function assertNativeScroll(result: Awaited<ReturnType<typeof wheel>>) {
  assert.ok(result.after.log.some((entry: any) => entry.phase === result.direction && entry.type === 'wheel' && entry.trusted && entry.deltaY === result.deltaY), '须收到真实原生滚轮事件');
  assert.equal(result.after.scroll.inner, result.before.scroll.inner + result.deltaY, '用户滚轮后的阅读位置须保留原生位移，不被程序推回');
  assert.equal(result.after.scroll.outer, result.before.scroll.outer, '内部有空间时不应改写外层预览位置');
  assert.deepEqual(result.programmatic, [], '用户滚动后不得再次调用腾位滚动');
  const p = result.after.panel;
  assert.ok(p.top >= 0 && p.bottom <= 1000, '手动滚动后浮层仍完整留在视口内');
}

for (const width of [375, 768, 1440]) test(`T-179 首次腾位与用户原生滚动成对验证 ${width}`, { timeout: 120000 }, async () => {
  const id = await historicalSite(), view = await session(width, { siteId: id, beforeNavigate: async browser => {
    await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: observeScript });
  } });
  try {
    if (width < 1100) await view.click('[role="tab"]:nth-child(1)');
    await view.click('.code-annotation-threads summary');
    await view.click('[data-testid="thread-reveal"]');
    await view.wait(`document.querySelector('.code-preview-version') && document.querySelector('[data-testid="annotation-composer"]') && !document.querySelector('.code-preview-loading')`);
    await view.browser.evaluate('document.fonts.ready');
    await view.browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const opened = await geometry(view); assert.equal(opened.loaded, true);
    await shot(view, 'opened', width);
    const up = await wheel(view, 'up', -48); await shot(view, 'up', width);
    const down = await wheel(view, 'down', 48); await shot(view, 'down', width);
    await writeFile(`${output}/scroll-${width}.json`, JSON.stringify({ at: new Date().toISOString(), width, opened, up, down }, null, 2), 'utf8');
    console.log(JSON.stringify({ width, opened: opened.scroll, up: { before: up.before.scroll, after: up.after.scroll, programmatic: up.programmatic }, down: { before: down.before.scroll, after: down.after.scroll, programmatic: down.programmatic } }));
    assertInitial(opened, width);
    assertNativeScroll(up); assertNativeScroll(down);
    // 手动滚动后重新展开同一线程，必须重新允许腾位，不能永久禁用。
    assertNativeScroll(await wheel(view, 'before-expand', -48));
    await view.click('.code-annotation-actions button');
    await view.wait(`document.querySelector('[data-testid="annotation-expand"]')`);
    await view.browser.evaluate(`window.__t179Phase='expand'`);
    await view.click('[data-testid="annotation-expand"]');
    const expanded = await geometry(view);
    await writeFile(`${output}/expanded-${width}.json`, JSON.stringify(expanded, null, 2), 'utf8');
    await shot(view, 'expanded', width);
    assertInitial({ ...expanded, log: expanded.log.filter((entry: any) => entry.phase === 'expand') }, width);
    assertNativeScroll(await wheel(view, 'expanded-up', -32));
    assertNativeScroll(await wheel(view, 'expanded-down', 32));
    // 当前版重新点选同一区块也须重新允许腾位，随后又交还阅读位置。
    await view.click('.code-preview-version button');
    await view.wait(`!document.querySelector('.code-preview-version') && !document.querySelector('.code-preview-loading')`);
    await view.pick('main > section:nth-of-type(6) h2', '收费口径');
    const draftUp = await wheel(view, 'draft-up', -32);
    await writeFile(`${output}/draft-up-${width}.json`, JSON.stringify(draftUp, null, 2), 'utf8');
    assertNativeScroll(draftUp);
    assert.ok(draftUp.after.target.bottom > draftUp.after.panel.top, '重新点选前须确实存在手动滚动后的目标遮挡，恢复腾位必须有可观察结果');
    await view.browser.evaluate(`window.__t179Phase='repick'`);
    // 原位点击同一标题；pick helper 会先 scrollIntoView，可能自己消除遮挡。
    const point = await view.browser.evaluate<{ x: number; y: number }>(`(()=>{
      const f=document.querySelector('[data-testid="code-preview"]'),fr=f.getBoundingClientRect(),scale=fr.width/f.offsetWidth;
      const r=f.contentDocument.querySelector('main > section:nth-of-type(6) h2').getBoundingClientRect();
      return {x:fr.x+(r.x+r.width/2)*scale,y:fr.y+(r.y+r.height/2)*scale};
    })()`);
    assert.equal(await view.browser.evaluate(`document.elementFromPoint(${point.x},${point.y})===document.querySelector('[data-testid="code-preview"]')`), true, '重新点选须真实命中预览目标');
    await view.browser.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
    await view.browser.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
    await view.browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const repicked = await geometry(view);
    await writeFile(`${output}/repicked-${width}.json`, JSON.stringify(repicked, null, 2), 'utf8');
    await shot(view, 'repicked', width);
    assertInitial({ ...repicked, log: repicked.log.filter((entry: any) => entry.phase === 'repick') }, width);
    const repickedUp = await wheel(view, 'repicked-up', -32), repickedDown = await wheel(view, 'repicked-down', 32);
    await writeFile(`${output}/reopened-${width}.json`, JSON.stringify({ expanded, repicked, repickedUp, repickedDown }, null, 2), 'utf8');
    assertNativeScroll(repickedUp); assertNativeScroll(repickedDown);
    await shot(view, 'reselected', width);
  } finally { await view.browser.close(); }
});
