import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { localEndpoint } from '../scripts/local-endpoint.ts';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import { inlineSite, inlineMaterials } from './fixtures/t162-inline-site.ts';

registerHooks({ resolve(specifier, context, next) {
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });
const base = localEndpoint('SITECRAFT_BASE').origin;
const { commitSiteCode, updateCodeSite } = await import('../lib/code-site-store.ts');
const output = `artifacts/t162/${process.env.T162_LABEL || 'browser'}-${Date.now()}`;
await mkdir(output, { recursive: true });
const state = async (id: string) => {
  const res = await fetch(`${base}/api/sites/${id}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"action":"state"}' });
  assert.equal(res.status, 200); return res.json();
};
async function fixture() {
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
async function session(width: number) {
  const id = await fixture(), browser = await codeCheckBrowser();
  const wait = async (expression: string, timeout = 20000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) { if (await browser.evaluate<boolean>(`Boolean(${expression})`)) return; await new Promise(r => setTimeout(r, 100)); }
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
  const pick = async () => {
    await wait(`!document.querySelector('.code-preview-loading')`);
    if(await browser.evaluate(`document.querySelector('[data-testid="pick-block"]').getAttribute('aria-pressed')!=='true'`))await click('[data-testid="pick-block"]');
    await wait(`document.querySelector('[data-testid="pick-block"]').getAttribute('aria-pressed')==='true'`);
    await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const point = await browser.evaluate<{x:number;y:number}>(`(()=>{const f=document.querySelector('[data-testid="code-preview"]'),n=f.contentDocument.querySelector('article p');n.scrollIntoView({block:'center'});const r=n.getBoundingClientRect(),fr=f.getBoundingClientRect(),s=fr.width/f.offsetWidth;return{x:fr.x+(r.x+r.width/2)*s,y:fr.y+(r.y+r.height/2)*s}})()`);
    assert.equal(await browser.evaluate(`document.elementFromPoint(${point.x},${point.y})===document.querySelector('[data-testid="code-preview"]')`),true,'指针须实际命中 iframe');
    await browser.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    await wait(`document.querySelector('.code-selection-outline')`);
    await browser.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
    await browser.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
    await wait(`document.querySelector('[data-testid="annotation-composer"]')`);
    assert.match(await browser.evaluate<string>(`document.querySelector('[data-testid="annotation-scope"]').textContent`), /修改范围：首页 · 深层纸袋区块/);
  };
  const shot = async (name: string) => {
    await browser.evaluate('document.fonts.ready');
    await wait(`!document.getAnimations().some(a=>(a.playState==='running'||a.playState==='pending')&&Number.isFinite(a.effect?.getComputedTiming().endTime))`);
    const result = await browser.send<{data:string}>('Page.captureScreenshot', { format: 'png' });
    await writeFile(`${output}/${name}-${width}-${id}.png`, Buffer.from(result.data, 'base64'));
  };
  const settle = async (previousRunId?: string) => {
    for (let i=0;i<180;i++) { const result=await state(id); if (result.codeSite.run && result.codeSite.run.id !== previousRunId && result.codeSite.run.status !== 'running') return result; await new Promise(r=>setTimeout(r,300)); }
    throw new Error('任务未结束');
  };
  await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
  await browser.send('Page.navigate', { url: `${base}/workspace?site=${id}` });
  await wait(`document.querySelector('[data-testid="code-preview"]')?.contentDocument?.querySelector('main h1')`);
  if (width < 1100) await click('[role="tab"]:nth-child(2)');
  if (width !== 1440) { await click(`.device-toggle[aria-label="预览宽度"] button:nth-child(${width === 768 ? 2 : 3})`); await wait(`document.querySelector('[data-testid="code-preview"]').offsetWidth===${width}`); }
  await wait(`!document.getAnimations().some(a=>a.playState==='running')`);
  try { assert.equal(await browser.evaluate(`document.querySelector('[data-testid="pick-block"]').textContent`), '批注', '父版本应因缺少批注入口失败'); }
  catch(error) {await shot('parent-missing-entry');await browser.close();throw error;}
  return { id, browser, wait, click, key, pick, shot, settle };
}

for (const width of [1440, 768, 375]) test(`真实指针与键盘：${width} 就地输入、编号、刷新和离屏定位`, { timeout: 120000 }, async () => {
  let s: Awaited<ReturnType<typeof session>> | undefined;
  try {
    s = await session(width); const { browser, key, click, wait, pick, shot, id } = s;
    // Normal browsing keeps native scrolling, text selection and bottom-link navigation.
    const fpoint = await browser.evaluate<any>(`(()=>{const f=document.querySelector('[data-testid="code-preview"]'),r=f.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+Math.min(100,r.height/2)}})()`);
    await browser.send('Input.dispatchMouseEvent',{type:'mouseWheel',deltaX:0,deltaY:500,...fpoint});
    await wait(`document.querySelector('[data-testid="code-preview"]').contentWindow.scrollY>0`);
    const linkPoint=await browser.evaluate<any>(`(()=>{const f=document.querySelector('[data-testid="code-preview"]'),n=f.contentDocument.querySelector('article a');n.scrollIntoView({block:'center'});const r=n.getBoundingClientRect(),fr=f.getBoundingClientRect(),s=fr.width/f.offsetWidth;return{x:fr.x+(r.x+r.width/2)*s,y:fr.y+(r.y+r.height/2)*s}})()`);
    await browser.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...linkPoint});
    await browser.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...linkPoint});
    await wait(`document.querySelector('[data-testid="code-preview"]')?.contentDocument?.querySelector('h1')?.textContent==='纸品目录'`);
    await click('[data-page-id="home"]');await wait(`document.querySelector('[data-testid="code-preview"]')?.contentDocument?.querySelector('h1')?.textContent==='青禾纸品'`);
    const textPoints=await browser.evaluate<any>(`(()=>{const f=document.querySelector('[data-testid="code-preview"]'),n=f.contentDocument.querySelector('h1');n.scrollIntoView({block:'center'});const r=n.getBoundingClientRect(),fr=f.getBoundingClientRect(),s=fr.width/f.offsetWidth;return{start:{x:fr.x+(r.x+1)*s,y:fr.y+(r.y+r.height/2)*s},end:{x:fr.x+(r.x+100)*s,y:fr.y+(r.y+r.height/2)*s}}})()`);
    await browser.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...textPoints.start});
    await browser.send('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,...textPoints.end});
    await browser.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...textPoints.end});
    assert.ok(await browser.evaluate(`document.querySelector('[data-testid="code-preview"]').contentWindow.getSelection().toString().length>0`),'正常浏览可选字');
    // C in a focused input remains text; real composing input does not toggle mode.
    if (width < 1100) await click('[role="tab"]:nth-child(1)');
    await click('#code-message'); await browser.send('Input.insertText', { text: 'c' }); await key('c');
    assert.equal(await browser.evaluate(`document.querySelector('[data-testid="pick-block"]').getAttribute('aria-pressed')`), 'false');
    await browser.send('Input.imeSetComposition', { text: 'c', selectionStart: 1, selectionEnd: 1 }); await key('c');
    assert.equal(await browser.evaluate(`document.querySelector('[data-testid="pick-block"]').getAttribute('aria-pressed')`), 'false');
    await browser.send('Input.insertText', { text: '中文' });
    if (width < 1100) await click('[role="tab"]:nth-child(2)');
    await pick();
    assert.equal(await browser.evaluate(`document.querySelector('[data-testid="annotation-add"]').disabled`), true);
    await browser.send('Input.insertText', { text: '保留纸袋说明' }); await key('Enter'); await browser.send('Input.insertText', { text: '只调整标题字距' });
    assert.match(await browser.evaluate<string>(`document.querySelector('#annotation-message').value`), /说明\n只调整/);
    await shot('composer');
    const geometry = await browser.evaluate<any>(`(()=>{const c=document.querySelector('[data-testid="annotation-composer"]').getBoundingClientRect();return{x:c.x,y:c.y,right:c.right,bottom:c.bottom,mode:document.querySelector('.code-workspace').className,overflow:document.documentElement.scrollWidth>innerWidth}})()`);
    assert.ok(geometry.x >= 0 && geometry.right <= width && geometry.y >= 0 && geometry.bottom <= 1000, JSON.stringify(geometry));
    assert.equal(geometry.overflow, false); if (width === 375) assert.match(geometry.mode, /pane-preview/);
    await key('Escape'); await wait(`!document.querySelector('[data-testid="annotation-composer"]')`);
    assert.equal(await browser.evaluate(`document.activeElement===document.querySelector('[data-testid="code-preview"]')`), true);
    await key('Escape'); await wait(`document.querySelector('[data-testid="pick-block"]').getAttribute('aria-pressed')==='false'`);
    await key('c'); await wait(`document.querySelector('[data-testid="pick-block"]').getAttribute('aria-pressed')==='true'`); await key('Escape');
    await pick(); await browser.send('Input.insertText', { text: '保留纸袋说明，只调整标题字距。' });
    await key('Enter', 2); await wait(`document.querySelector('[data-testid="annotation-number"]')`);
    assert.equal((await state(id)).codeSite.run, null, '添加不得调用模型');
    await browser.send('Page.reload');
    await wait(`document.querySelector('[data-testid="annotation-draft"]')`);
    if (width < 1100) await click('[role="tab"]:nth-child(1)');
    assert.match(await browser.evaluate<string>(`document.querySelector('[data-testid="annotation-draft"]').textContent`), /保留纸袋说明，只调整标题字距/);
    if(width<1100)await click('[role="tab"]:nth-child(2)');
    await click('[data-page-id="products"]');await wait(`document.querySelector('[data-testid="code-preview"]')?.contentDocument?.querySelector('h1')?.textContent==='纸品目录'`);
    if(width<1100)await click('[role="tab"]:nth-child(1)');
    await click('[data-testid="annotation-reveal"]'); await wait(`document.querySelector('[data-testid="annotation-composer"]') && document.querySelector('[data-testid="code-preview"]')?.contentDocument?.querySelector('article')`);
    const visible = await browser.evaluate<boolean>(`(()=>{const f=document.querySelector('[data-testid="code-preview"]'),r=f.contentDocument.querySelector('article').getBoundingClientRect();return r.top>=0&&r.top<1000})()`);
    assert.equal(visible, true); await shot('reveal');
    const another = await fixture();
    await browser.send('Page.navigate', { url: `${base}/workspace?site=${another}` });
    await wait(`document.querySelector('[data-testid="code-preview"]')?.contentDocument?.querySelector('h1')`);
    assert.equal(await browser.evaluate(`!!document.querySelector('[data-testid="annotation-draft"]')`), false, '草稿不能串到另一个站点');
    await browser.evaluate(`localStorage.setItem('sitecraft-annotation-drafts:${another}','损坏草稿原记录')`);
    await browser.send('Page.reload'); await wait(`document.querySelector('.code-error')?.textContent.includes('原记录已保留')`);
    assert.equal(await browser.evaluate(`localStorage.getItem('sitecraft-annotation-drafts:${another}')`), '损坏草稿原记录');
    await browser.send('Page.navigate', { url: `${base}/workspace?site=${id}` });
    await wait(`document.querySelector('[data-testid="annotation-draft"]')?.textContent.includes('保留纸袋说明')`);
    await writeFile(`${output}/interaction-${width}.json`, JSON.stringify({ status:'PASS', id, width, geometry, at:new Date().toISOString() },null,2));
  } catch (error) { if (s) await s.shot('failure'); throw error; } finally { await s?.browser.close(); }
});

test('单条发送冻结、成功归档、线程回看、失败保留及版本失效', { timeout: 180000 }, async () => {
  let s: Awaited<ReturnType<typeof session>> | undefined;
  try {
    s = await session(1440); const {id,browser,pick,key,click,wait,settle,shot}=s;
    await pick(); await browser.send('Input.insertText',{text:'保留纸袋说明，只调整标题字距。'}); await key('Enter',2);
    await wait(`document.querySelector('[data-testid="annotation-draft"]')`);
    const before=(await state(id)).codeSite;
    const sendPoint=await browser.evaluate<any>(`(()=>{const r=document.querySelector('[data-testid="annotation-send"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    for(let n=0;n<2;n++){await browser.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:n+1,...sendPoint});await browser.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:n+1,...sendPoint});}
    await wait(`document.querySelector('[data-testid="annotation-send"]').disabled`);
    await browser.send('Page.reload'); await wait(`document.querySelector('[data-testid="annotation-draft"]')`);
    assert.equal(await browser.evaluate(`document.querySelector('[data-testid="annotation-send"]').disabled`),true);
    const done=await settle(); assert.equal(done.codeSite.run.status,'complete');
    assert.equal(done.codeSite.runs.length,1); assert.equal(done.codeSite.versions.length,2);
    const replay=await fetch(`${base}/api/sites/${id}/chat`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:done.codeSite.run.request,selectedTarget:done.codeSite.run.selectedTarget,baseRevision:1,saveAnnotation:true,annotationSubmissionId:done.codeSite.run.annotationSubmissionId})});
    assert.equal(replay.status,200);assert.equal((await replay.json()).codeSite.runs.length,1,'同一发送标识不再调用模型');
    const original=before.versions[0],after=done.codeSite.versions[1];
    assert.equal(after.code.pages[1].html,original.code.pages[1].html);
    assert.equal(after.code.header,original.code.header);assert.equal(after.code.footer,original.code.footer);
    assert.ok(after.code.css.startsWith(original.code.css));
    const outside=await browser.evaluate(`(()=>{const a=new DOMParser().parseFromString(${JSON.stringify(original.code.pages[0].html)},'text/html'),b=new DOMParser().parseFromString(${JSON.stringify(after.code.pages[0].html)},'text/html');a.querySelector('article').replaceWith(a.createComment('target'));b.querySelector('article').replaceWith(b.createComment('target'));return a.isEqualNode(b)})()`);
    assert.equal(outside,true); assert.equal(after.checks.passed,true); assert.equal(after.checks.viewports.length,6);
    await wait(`!document.querySelector('[data-testid="annotation-draft"]')`);
    await click('.code-annotation-threads summary'); await wait(`document.querySelector('[data-testid="thread-reveal"]')`);
    await click('[data-testid="thread-reveal"]'); await wait(`document.querySelector('[data-testid="annotation-composer"]')`);
    assert.match(await browser.evaluate<string>(`document.querySelector('[data-testid="annotation-composer"]').textContent`), /已修改|保存为版本/);
    await key('Escape');
    await click('.code-preview-version button');
    await wait(`!document.querySelector('.code-preview-loading')`);
    await pick(); await browser.send('Input.insertText',{text:'越界修改共享样式'}); await key('Enter',2);
    await wait(`document.querySelector('[data-testid="annotation-draft"]')`);await click('[data-testid="annotation-send"]');
    const rejected=await settle(done.codeSite.run.id);assert.equal(rejected.codeSite.run.status,'error');assert.equal(rejected.codeSite.versions.length,2);
    assert.equal(rejected.codeSite.run.attempts.length,3,'初稿加两轮修正');
    assert.ok(rejected.codeSite.run.attempts.every((a:any)=>a.checks.issues.some((i:string)=>i.includes('局部修改越界'))));
    await wait(`document.querySelector('[data-testid="annotation-draft"]')?.textContent.includes('未保存版本')`);
    await browser.send('Page.reload'); await wait(`document.querySelector('[data-testid="annotation-draft"]')?.textContent.includes('越界修改共享样式')`);
    await shot('rejected');
    const response=await fetch(`${base}/api/sites/${id}/history/undo`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({baseRevision:2})});assert.equal(response.status,200);
    await browser.send('Page.reload');await wait(`document.querySelector('[data-testid="annotation-draft"]')?.textContent.includes('来自 v2，请重新点选')`);
    assert.equal(await browser.evaluate(`document.querySelector('[data-testid="annotation-send"]').disabled`),true);
    await shot('stale');
    await click('[data-testid="annotation-reselect"]');await pick();
    assert.equal(await browser.evaluate(`document.querySelector('#annotation-message').value`),'越界修改共享样式','重新点选不丢意见');
    await click('[data-testid="annotation-add"]');await wait(`!document.querySelector('[data-testid="annotation-reselect"]')`);
    await click('[data-testid="annotation-reveal"]');await wait(`document.querySelector('#annotation-message')`);
    await key('a',4);await browser.send('Input.insertText',{text:'服务失败，保留我的意见'});await click('[data-testid="annotation-add"]');
    await click('[data-testid="annotation-send"]');const failed=await settle(rejected.codeSite.run.id);
    assert.equal(failed.codeSite.run.status,'error');assert.equal(failed.codeSite.run.modelCalls.length,1,'HTTP 模型失败不重试');
    assert.equal(failed.codeSite.run.modelCalls[0].httpStatus,503);assert.equal(failed.codeSite.versions.length,3);
    await wait(`document.querySelector('[data-testid="annotation-draft"]')?.textContent.includes('未保存版本')`);await shot('provider-failed');
    await click('[data-testid="annotation-reveal"]');await wait(`document.querySelector('#annotation-message')`);
    await key('a',4);await browser.send('Input.insertText',{text:'请求失败也要保留意见'});await click('[data-testid="annotation-add"]');
    await browser.send('Network.enable');await browser.send('Network.setBlockedURLs',{urls:[`${base}/api/sites/${id}/chat`]});
    await click('[data-testid="annotation-send"]');await wait(`document.querySelector('[data-testid="annotation-check"]')`);
    assert.match(await browser.evaluate<string>(`document.querySelector('[data-testid="annotation-draft"]').textContent`),/请求失败也要保留意见/);
    await browser.send('Network.setBlockedURLs',{urls:[]});await click('[data-testid="annotation-check"]');
    await wait(`!document.querySelector('[data-testid="annotation-send"]').disabled`);assert.equal((await state(id)).codeSite.runs.length,3,'传输失败不自动重发');await shot('request-failed');

    await writeFile(`${output}/send.json`,JSON.stringify({status:'PASS',id,before,done:done.codeSite,rejected:rejected.codeSite,providerFailed:failed.codeSite,transportFailureRuns:(await state(id)).codeSite.runs.length,at:new Date().toISOString()},null,2));
  } catch(error) { if(s)await s.shot('failure-send');throw error; } finally {await s?.browser.close();}
});
