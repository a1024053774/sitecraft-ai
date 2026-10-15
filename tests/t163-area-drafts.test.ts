import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fixture, session, state, holdNextLocalReply, commitSiteCode } from './helpers/t162-browser.ts';
import { inlineSite, inlineMaterials } from './fixtures/t162-inline-site.ts';

const evidence = `artifacts/t163/${process.env.T163_LABEL || 'browser'}-${Date.now()}`;
await mkdir(evidence, { recursive: true });
type Session = Awaited<ReturnType<typeof session>>;
const drafts = (s: Session) => s.browser.evaluate<any[]>(`JSON.parse(localStorage.getItem('sitecraft-annotation-drafts:${s.id}')||'[]').filter(d=>d.status!=='archived')`);
async function shot(s: Session, name: string) {
  await s.wait(`!document.querySelector('.code-preview-loading')`);
  await s.browser.evaluate('document.fonts.ready');
  const result = await s.browser.send<{data:string}>('Page.captureScreenshot', { format: 'png' });
  await writeFile(`${evidence}/${name}.png`, Buffer.from(result.data, 'base64'));
}
async function area(s: Session, from: string, to: string, reverse = false, finish = true) {
  if (await s.browser.evaluate(`document.querySelector('[data-testid="pick-block"]').getAttribute('aria-pressed')!=='true'`)) await s.click('[data-testid="pick-block"]');
  await s.browser.evaluate(`document.querySelector('[data-testid="code-preview"]').contentDocument.querySelector(${JSON.stringify(from)}).scrollIntoView({block:'center'})`);
  await s.browser.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  const points = await s.browser.evaluate<any>(`(()=>{const f=document.querySelector('[data-testid="code-preview"]'),d=f.contentDocument,a=d.querySelector(${JSON.stringify(from)}).getBoundingClientRect(),b=d.querySelector(${JSON.stringify(to)}).getBoundingClientRect(),r=f.getBoundingClientRect(),scale=r.width/f.offsetWidth;return{start:{x:r.x+(a.left+2)*scale,y:r.y+(a.top+2)*scale},end:{x:r.x+(Math.min(a.right,b.right)-2)*scale,y:r.y+(b.bottom-2)*scale}}})()`);
  const start = reverse ? points.end : points.start, end = reverse ? points.start : points.end;
  for (const p of [start,end]) assert.equal(await s.browser.evaluate(`document.elementFromPoint(${p.x},${p.y})===document.querySelector('[data-testid="code-preview"]')`), true, '圈选指针须命中真实 iframe');
  await s.browser.send('Input.dispatchMouseEvent', { type:'mousePressed',button:'left',clickCount:1,...start });
  await s.browser.send('Input.dispatchMouseEvent', { type:'mouseMoved',button:'left',buttons:1,...end });
  if (finish) await s.browser.send('Input.dispatchMouseEvent', { type:'mouseReleased',button:'left',clickCount:1,...end });
  return end;
}
async function add(s: Session, body: string) {
  await s.browser.send('Input.insertText', { text: body }); await s.key('Enter',2);
  await s.wait(`!document.querySelector('[data-testid="annotation-composer"]')`);
}
async function replaceOpinion(s: Session, text: string) {
  await s.click('#annotation-message');
  await s.browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',modifiers:4,commands:['selectAll']});
  await s.browser.send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',modifiers:4});
  await s.browser.send('Input.insertText',{text});
  assert.equal(await s.browser.evaluate(`document.querySelector('#annotation-message').value`),text);
}
let sharedSite: string;
test('圈选段落中的第二个同名链接保留链接自身路径，不能只给整段提示', {timeout:120000},async()=>{
  let s: Session|undefined;
  try{
    const id=await fixture(),code=structuredClone(inlineSite);
    code.pages[0].html=code.pages[0].html.replace('<p title="纸袋位置">相同说明</p>','<p title="纸袋位置">相同说明 <a href="/products">相同说明</a> / <a href="/products">相同说明</a></p>');
    const saved=await commitSiteCode({siteId:id,baseRevision:1,code,author:'user',summary:'嵌套链接圈选合同',request:inlineMaterials});
    assert.equal(saved.status,'applied',JSON.stringify(saved));
    s=await session(1440,{siteId:id});await area(s,'article p a:nth-of-type(2)','article p a:nth-of-type(2)');
    await s.wait(`document.querySelector('[data-testid="annotation-composer"]')`);await add(s,'只调整圈中的链接样式。');
    const [draft]=await drafts(s);assert.ok(Array.isArray(draft.target.elements),'圈选必须保留多个元素提示');
    assert.ok(draft.target.elements.some((hint:any)=>hint.tag==='a'&&hint.path.join(',')==='1,1'),'第二个链接必须有自身路径');
    assert.equal(draft.target.elements.some((hint:any)=>hint.tag==='a'&&hint.path.join(',')==='1,0'),false,'没圈中第一个同名链接');
    await shot(s,'nested-link');
  }catch(error){if(s)await shot(s,'failure-nested-link');throw error;}finally{await s?.browser.close();}
});
test('自由 HTML 的直接文字与 blockquote 同样进入圈选提示，不依赖标签白名单', {timeout:120000},async()=>{
  let s: Session|undefined;
  try{
    const id=await fixture();
    const code=structuredClone(inlineSite);
    code.pages[0].html=code.pages[0].html.replace('</main>','<section class="free-copy">纸箱与纸袋<blockquote>按用途说明规格。</blockquote></section></main>');
    const saved=await commitSiteCode({siteId:id,baseRevision:1,code,author:'user',summary:'自由 HTML 圈选合同',request:inlineMaterials});
    assert.equal(saved.status,'applied',JSON.stringify(saved));
    s=await session(1440,{siteId:id});await area(s,'.free-copy','.free-copy blockquote');
    await s.wait(`document.querySelector('[data-testid="annotation-composer"]')`);await add(s,'保留纸箱与纸袋和规格说明。');
    const [draft]=await drafts(s);
    assert.deepEqual(draft.target.path,[3]);
    assert.ok(Array.isArray(draft.target.elements),'圈选必须保留多个元素提示');
    assert.ok(draft.target.elements.some((hint:any)=>hint.tag==='blockquote'&&hint.text==='按用途说明规格。'));
    assert.ok(draft.target.elements.some((hint:any)=>hint.path.length===0&&hint.tag==='section'));
    await shot(s,'free-html');
  }catch(error){if(s)await shot(s,'failure-free-html');throw error;}finally{await s?.browser.close();}
});
for (const width of [1440,768,375]) test(`圈选与三条草稿：${width} 真实反向指针、编辑、移除、编号和刷新`, {timeout:120000}, async () => {
  let s: Session | undefined;
  try {
    sharedSite ??= await fixture(); s = await session(width,{siteId:sharedSite});
    await area(s,'article h3','article p',true);
    await s.wait(`document.querySelector('[data-testid="annotation-composer"]')`);
    await add(s,'保留纸袋说明，只调整标题字距。');
    assert.equal(await s.browser.evaluate(`document.querySelector('[data-testid="pick-block"]').getAttribute('aria-pressed')`),'true','连续添加时保持批注模式，不要求每条重新进入');
    const first = (await drafts(s))[0];
    assert.deepEqual(first.target.path,[2,0,1]);
    assert.deepEqual(first.target.elements,[{path:[0],tag:'h3',text:'深层纸袋区块'},{path:[1],tag:'p',text:'相同说明'}]);
    assert.equal(first.target.rect,undefined,'显示坐标不进入模型目标');
    await s.pick('main>section:first-child p','青禾纸品'); await add(s,'第二条：保留纸箱与纸袋。');
    await s.pick(); await add(s,'第三条：链接原样保留。');
    const initial = await drafts(s); assert.equal(initial.length,3);
    if(width<1100)await s.click('[role="tab"]:nth-child(1)');
    await s.click('[data-testid="annotation-draft"]:nth-child(2) [data-testid="annotation-reveal"]');
    await s.wait(`document.querySelector('#annotation-message')?.value==='第二条：保留纸箱与纸袋。'`);
    await replaceOpinion(s,'第二条已编辑：保留全部事实。');await s.click('[data-testid="annotation-add"]');
    assert.deepEqual((await drafts(s)).map(d=>d.id),initial.map(d=>d.id),'编辑保留列表位置');
    assert.equal((await drafts(s))[1].body,'第二条已编辑：保留全部事实。');
    if(width<1100)await s.click('[role="tab"]:nth-child(1)');
    await s.click('[data-testid="annotation-draft"]:nth-child(2) [data-testid="annotation-remove"]');
    assert.deepEqual((await drafts(s)).map(d=>d.id),[initial[0].id,initial[2].id]);
    await shot(s,`list-${width}`);
    if(width===375){
      await s.click('#code-message');await s.browser.send('Input.insertText',{text:'多条草稿后仍能输入对话。'});
      assert.equal(await s.browser.evaluate(`document.querySelector('#code-message').value`),'多条草稿后仍能输入对话。');
      assert.equal(await s.browser.evaluate(`document.querySelector('#code-message').getBoundingClientRect().bottom<=innerHeight`),true,'草稿列表不能截断其他输入控件');
      await shot(s,'chat-operable-375');
    }
    if(width<1100)await s.click('[role="tab"]:nth-child(2)');
    await s.browser.evaluate(`document.querySelector('[data-testid="code-preview"]').contentDocument.querySelector('article').scrollIntoView({block:'center'})`);
    await s.wait(`document.querySelectorAll('[data-testid="annotation-number"]').length===2`);
    assert.deepEqual(await s.browser.evaluate(`Array.from(document.querySelectorAll('[data-testid="annotation-number"]'),n=>n.textContent)`),['1','2']);
    await s.click('[data-testid="annotation-number"]:last-of-type');
    await s.wait(`document.querySelector('#annotation-message')?.value==='第三条：链接原样保留。'`);
    await shot(s,`preview-${width}`);
    assert.equal((await state(s.id)).codeSite.run,null,'添加与编辑不调用模型');
    await s.browser.send('Page.reload');await s.wait(`document.querySelectorAll('[data-testid="annotation-draft"]').length===2`);
    assert.deepEqual((await drafts(s)).map(d=>d.body),[initial[0].body,initial[2].body]);
    await writeFile(`${evidence}/interaction-${width}.json`,JSON.stringify({width,id:s.id,drafts:await drafts(s),at:new Date().toISOString()},null,2));
  } catch(error){if(s)await shot(s,`failure-${width}`);throw error;} finally{await s?.browser.close();}
});

test('跨区块先收窄；Esc、滚轮、缩放和失焦取消未完成框；极小框及 IME', {timeout:120000}, async()=>{
  let s: Session | undefined;
  try{
    s=await session(1440);
    await area(s,'main>section:first-child h1','main>section:nth-child(2) h2');
    await s.wait(`document.querySelector('[data-testid="annotation-area-candidates"]')`);
    assert.equal(await s.browser.evaluate(`!!document.querySelector('[data-testid="annotation-add"]')`),false,'跨区块不能直接提交');
    assert.match(await s.browser.evaluate<string>(`document.querySelector('[data-testid="annotation-area-candidates"]').textContent`),/青禾纸品.*相同标题/);
    await shot(s,'cross-block');await s.click('[data-testid="annotation-area-candidates"] button:first-of-type');
    await s.wait(`document.querySelector('[data-testid="annotation-scope"]')?.textContent.includes('青禾纸品')`);await s.key('Escape');
    for(const mode of ['escape','scroll','blur','scale']){
      if(mode==='blur')await s.browser.evaluate(`window.__t163Focus=[];window.addEventListener('blur',()=>window.__t163Focus.push({focus:document.hasFocus(),at:Date.now()}))`);
      const end=await area(s,'article h3','article p',false,false);
      await s.wait(`document.querySelector('[data-testid="annotation-area-outline"]')`);
      if(mode==='escape')await shot(s,'live-area');
      if(mode==='escape')await s.key('Escape');
      if(mode==='scroll')await s.browser.send('Input.dispatchMouseEvent',{type:'mouseWheel',deltaX:0,deltaY:100,...end});
      if(mode==='blur'){
        // Headless target activation keeps document.hasFocus() true. Only the
        // blur boundary uses a controlled event; the drag remains native CDP.
        await s.browser.evaluate(`window.dispatchEvent(new FocusEvent('blur'))`);
        await writeFile(`${evidence}/focus.json`,JSON.stringify(await s.browser.evaluate(`({kind:'controlled-window-blur',nativeDrag:true,focus:document.hasFocus(),events:window.__t163Focus})`),null,2));
      }
      if(mode==='scale')await s.browser.send('Emulation.setDeviceMetricsOverride',{width:1000,height:1000,deviceScaleFactor:1,mobile:false});
      await s.browser.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...end});
      await s.wait(`!document.querySelector('[data-testid="annotation-area-outline"]')`);
      assert.equal(await s.browser.evaluate(`!!document.querySelector('[data-testid="annotation-composer"]')`),false,`${mode} 取消后不得提交框`);
      if(mode==='scale')await s.browser.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    }
    // Native touch cancellation exercises pointercancel; no synthetic DOM event.
    const end=await area(s,'article h3','article p',false,false);
    await s.key('Escape');await s.browser.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...end});
    await s.browser.send('Emulation.setTouchEmulationEnabled',{enabled:true});
    await s.browser.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:end.x-60,y:end.y-40}]});
    await s.browser.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:end.x,y:end.y}]});
    await s.wait(`document.querySelector('[data-testid="annotation-area-outline"]')`);
    await s.browser.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    await s.wait(`!document.querySelector('[data-testid="annotation-area-outline"]')`);
    assert.equal(await s.browser.evaluate(`!!document.querySelector('[data-testid="annotation-composer"]')`),false);
    await s.browser.send('Emulation.setTouchEmulationEnabled',{enabled:false});
    // Two CSS pixels are below the movement threshold, so this remains a click.
    const tiny=await s.browser.evaluate<any>(`(()=>{const f=document.querySelector('[data-testid="code-preview"]'),r=f.getBoundingClientRect(),n=f.contentDocument.querySelector('article p').getBoundingClientRect(),scale=r.width/f.offsetWidth;return{x:r.x+(n.x+20)*scale,y:r.y+(n.y+10)*scale}})()`);
    await s.browser.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...tiny});
    await s.browser.send('Input.dispatchMouseEvent',{type:'mouseMoved',buttons:1,x:tiny.x+2,y:tiny.y+2});
    await s.browser.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:tiny.x+2,y:tiny.y+2});
    await s.wait(`document.querySelector('[data-testid="annotation-composer"]')`);
    assert.equal(await s.browser.evaluate(`!!document.querySelector('[data-testid="annotation-area-outline"]')`),false);
    await s.key('Escape');
    await s.pick();await s.browser.send('Input.imeSetComposition',{text:'c',selectionStart:1,selectionEnd:1});await s.key('c');
    assert.equal(await s.browser.evaluate(`document.querySelector('[data-testid="pick-block"]').getAttribute('aria-pressed')`),'true');
    await s.browser.send('Input.insertText',{text:'中文意见'});await s.key('Enter');await s.browser.send('Input.insertText',{text:'保留事实'});
    assert.match(await s.browser.evaluate<string>(`document.querySelector('#annotation-message').value`),/\n保留事实/);
  }catch(error){if(s)await shot(s,'failure-cancel');throw error;}finally{await s?.browser.close();}
});

test('选择第二条发送，发送中新增保留，成功只归档冻结条目，换版本逐条确认', {timeout:180000},async()=>{
  let s: Session|undefined;let release:(()=>void)|undefined;
  try{
    s=await session(1440);await s.pick('main>section:first-child p','青禾纸品');await add(s,'第一条暂不发送。');
    await area(s,'article h3','article p');await s.wait(`document.querySelector('[data-testid="annotation-composer"]')`);await add(s,'保留纸袋说明，只调整标题字距。');
    const original=await drafts(s),gate=holdNextLocalReply();release=gate.release;
    assert.equal(original[1].target.elements.length,2,'经 chat 发送圈选的多个元素提示');
    await s.click('[data-testid="annotation-draft"]:nth-child(2) [data-testid="annotation-send"]');await gate.requested();
    await s.pick('main>section:first-child p','青禾纸品');await add(s,'发送中新增的第三条。');
    assert.equal((await drafts(s)).length,3);assert.equal((await drafts(s))[1].status,'sending');
    await shot(s,'sending-new-draft');gate.release();release=undefined;
    const done=await s.settle();assert.equal(done.codeSite.run.status,'complete');
    assert.equal(done.codeSite.run.request,original[1].body);assert.deepEqual(done.codeSite.run.selectedTarget,original[1].target);
    await s.wait(`document.querySelectorAll('[data-testid="annotation-draft"]').length===2`);
    assert.deepEqual((await drafts(s)).map(d=>d.body),[original[0].body,'发送中新增的第三条。']);
    assert.equal(await s.browser.evaluate(`Array.from(document.querySelectorAll('[data-testid="annotation-send"]')).every(b=>b.disabled)`),true);
    await s.browser.send('Page.reload');await s.wait(`document.querySelectorAll('[data-testid="annotation-reselect"]').length===2`);
    await s.click('[data-testid="annotation-draft"]:nth-child(2) [data-testid="annotation-reselect"]');await s.pick();
    assert.equal(await s.browser.evaluate(`document.querySelector('#annotation-message').value`),'发送中新增的第三条。');
    await s.click('[data-testid="annotation-add"]');
    assert.equal((await drafts(s))[0].target.versionId,original[0].target.versionId);
    assert.equal((await drafts(s))[1].target.versionId,done.codeSite.currentVersionId);
    await shot(s,'version-reselect');
    await s.click('[data-testid="annotation-draft"]:nth-child(2) [data-testid="annotation-reveal"]');
    await s.wait(`document.querySelector('#annotation-message')`);await replaceOpinion(s,'越界修改共享样式');await s.click('[data-testid="annotation-add"]');
    const rejectionGate=holdNextLocalReply();release=rejectionGate.release;
    await s.click('[data-testid="annotation-draft"]:nth-child(2) [data-testid="annotation-send"]');await rejectionGate.requested();
    await s.pick('main>section:first-child p','青禾纸品');await add(s,'拒收期间新增，不能被清空。');
    rejectionGate.release();release=undefined;
    const rejected=await s.settle(done.codeSite.run.id);assert.equal(rejected.codeSite.run.status,'error');
    assert.equal(rejected.codeSite.versions.length,2,'越界不得产生新版本');
    await s.wait(`document.querySelectorAll('[data-testid="annotation-draft"]').length===3 && document.querySelectorAll('[data-testid="annotation-draft"]')[1].textContent.includes('未保存版本')`);
    assert.deepEqual((await drafts(s)).map(d=>d.body),[original[0].body,'越界修改共享样式','拒收期间新增，不能被清空。']);
    await shot(s,'rejection-new-draft');
    await writeFile(`${evidence}/send.json`,JSON.stringify({id:s.id,done:done.codeSite,drafts:await drafts(s),at:new Date().toISOString()},null,2));
  }catch(error){if(s)await shot(s,'failure-send');throw error;}finally{release?.();await s?.browser.close();}
});

test('发送 HTTP 丢失回复时不覆盖发送中新增的草稿，不自动重发', {timeout:120000},async()=>{
  let s: Session|undefined;
  try{
    s=await session(1440);await s.pick();await add(s,'HTTP 失败也要保留这条。');
    await s.browser.evaluate(`(()=>{const original=window.fetch;window.fetch=function(input,init){if(String(input).endsWith('/chat')&&JSON.parse(init?.body||'{}').message==='HTTP 失败也要保留这条。'){window.__t163BlockedRequest=true;return new Promise((resolve,reject)=>{window.__t163RejectRequest=()=>reject(new TypeError('本地 HTTP 传输失败'))})}return original.apply(this,arguments)}})()`);
    await s.click('[data-testid="annotation-send"]');await s.wait(`window.__t163BlockedRequest`);
    await s.pick('main>section:first-child p','青禾纸品');await add(s,'HTTP 冻结期间新增。');
    await s.browser.evaluate(`window.__t163RejectRequest()`);
    await s.wait(`document.querySelector('[data-testid="annotation-draft"]')?.textContent.includes('本地 HTTP 传输失败')`);
    assert.deepEqual((await drafts(s)).map(d=>d.body),['HTTP 失败也要保留这条。','HTTP 冻结期间新增。']);
    assert.equal((await state(s.id)).codeSite.run,null,'丢失回复不自动重发模型');
    await shot(s,'transport-new-draft');
  }catch(error){if(s)await shot(s,'failure-transport');throw error;}finally{await s?.browser.close();}
});
