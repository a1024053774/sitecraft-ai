import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import { base } from './helpers/workspace-browser.ts';

// A query-only Link navigation must load a new workspace without reloading the
// document. Refresh must retain that ID, and returning to the chooser must allow
// another new site. The development identity guard precedes every write.
test('Chrome clicking 新建站点 responds to query navigation and refresh retains the created site',{timeout:120000},async(t)=>{
  const health=await fetch(base+'/api/health').then(response=>response.json());
  assert.equal(health.testIdentity?.cwd,process.cwd(),'refuse writes to a browser server from another workspace');
  const out=`artifacts/t145/workspace-navigation-${crypto.randomUUID()}`;await mkdir(out,{recursive:true});
  t.diagnostic(`Chrome navigation report and screenshots: ${out}`);
  const browser=await codeCheckBrowser();
  const observations:unknown[]=[];let passed=false;
  const ready=async(expression:string)=>{
    const end=Date.now()+20000;
    while(Date.now()<end){if(await browser.evaluate<boolean>(expression))return true;await new Promise(resolve=>setTimeout(resolve,100))}
    return false;
  };
  let width=1440;
  try{
    const createdIds=new Set<string>();
    for(width of [1440,768,375]){
      await browser.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
      await browser.send('Page.navigate',{url:base+'/workspace'});
      assert.ok(await ready(`document.querySelector('h1')?.textContent==='打开一个站点'`));
      const coordinates=await browser.evaluate<{x:number;y:number}>(`(() => {
        window.__t145NavigationMarker=true;
        const link=document.querySelector('a[href="/workspace?new=1"]');link.scrollIntoView();
        const rect=link.getBoundingClientRect();return {x:rect.x+rect.width/2,y:rect.y+rect.height/2};
      })()`);
      await browser.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...coordinates});
      await browser.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...coordinates});
      const loaded=await ready(`!!document.querySelector('[data-testid="code-workspace"]') && !!new URL(location.href).searchParams.get('site') && !new URL(location.href).searchParams.has('new')`);
      const view=await browser.evaluate<{url:string;documentRetained:boolean;text:string;overflow:boolean}>(`({url:location.href,documentRetained:window.__t145NavigationMarker===true,text:document.body.innerText,overflow:document.documentElement.scrollWidth>innerWidth})`);
      observations.push({width,loaded,...view});
      assert.ok(loaded,`Chrome click changed the query but did not open a new workspace: ${view.url}`);
      assert.equal(view.documentRetained,true,'the Link must update the current document');
      assert.equal(view.overflow,false);
      const siteId=new URL(view.url).searchParams.get('site')!;
      assert.ok(!createdIds.has(siteId),'a later explicit new-site action creates a separate site');createdIds.add(siteId);
      const draft=await fetch(`${base}/api/sites/${siteId}/draft`);assert.equal(draft.status,200);
      const state=await draft.json();assert.equal(state.codeSite.name,'未命名站点');assert.equal(state.codeSite.versions.length,0);
      await browser.send('Page.reload');
      assert.ok(await ready(`!!document.querySelector('[data-testid="code-workspace"]')`));
      assert.equal(await browser.evaluate('new URL(location.href).searchParams.get("site")'),siteId);
      if(width<1100){
        await browser.evaluate(`document.querySelectorAll('[role="tab"]')[1].click()`);
        assert.ok(await ready(`document.querySelector('.code-workspace')?.classList.contains('pane-preview')`));
      }
      await browser.evaluate('document.fonts.ready');
      assert.ok(await ready(`!document.getAnimations().some(animation =>
        (animation.playState==='running'||animation.playState==='pending') && Number.isFinite(animation.effect?.getComputedTiming().endTime))`),
        'capture only the settled workspace, not its tab transition');
      const shot=await browser.send<{data:string}>('Page.captureScreenshot',{format:'png'});
      await writeFile(`${out}/workspace-${width}.png`,Buffer.from(shot.data,'base64'));
    }
    passed=true;
  }finally{
    if(!passed){const shot=await browser.send<{data:string}>('Page.captureScreenshot',{format:'png'});await writeFile(`${out}/failure-${width}.png`,Buffer.from(shot.data,'base64'))}
    await browser.close();
    await writeFile(out+'/report.json',JSON.stringify({at:new Date().toISOString(),base,status:passed?'PASS':'INCOMPLETE',observations},null,2)+'\n');
  }
});
