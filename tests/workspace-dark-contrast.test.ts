import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import test from 'node:test';
import {codeCheckBrowser} from '../lib/code-site-browser.ts';
const base=process.env.SITECRAFT_BASE||'http://127.0.0.1:3034';
const scan=await readFile('scripts/workspace-contrast-scan.js','utf8');
// Exercise the actual new-route controls. The same saved question is read on
// every viewport; no model runs and no legacy look/color panels are substituted.
test('actual code workspace controls and dialogs remain readable in both themes at three widths',{timeout:180000},async()=>{
 const created=await fetch(base+'/api/sites',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'工作台对比度检查'})});assert.equal(created.status,201);const {id}=await created.json();
 const started=await fetch(`${base}/api/sites/${id}/chat`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:'公司名：工作台对比度检查\n我们加工精密零件。',baseRevision:0})});assert.equal(started.status,200);
 const out=`artifacts/t145/workspace-contrast-${crypto.randomUUID()}`;await mkdir(out,{recursive:true});
 const browser=await codeCheckBrowser(),reports:unknown[]=[];
 try{
  for(const theme of ['light','dark'])for(const width of [1440,768,375]){
   await browser.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await browser.send('Page.navigate',{url:`${base}/workspace?site=${id}`});
   const end=Date.now()+20000;let ready=false;while(Date.now()<end){ready=await browser.evaluate<boolean>(`!!document.querySelector('[data-testid="code-style-question"]')`);if(ready)break;await new Promise(r=>setTimeout(r,100))}assert.ok(ready,'saved style question must be visible');
   await browser.evaluate(`document.querySelector('.builder-shell').classList.replace('workspace-theme-light','workspace-theme-${theme}')`);await browser.evaluate('document.fonts.ready');
   for(const surface of ['style','materials','images','delete']){
    if(surface==='materials'||surface==='images')await browser.evaluate(`[...document.querySelectorAll('.code-material-tools button')].find(b=>b.textContent.includes('${surface==='materials'?'资料':'图片'}')).click()`);
    if(surface==='delete'){
     if(width<1100)await browser.evaluate(`document.querySelectorAll('[role="tab"]')[1].click()`);
     await browser.evaluate(`document.querySelector('[data-testid="toolbar-delete-site"]').click()`);
    }
    const settled=Date.now()+5000;
    while(await browser.evaluate<boolean>(`document.getAnimations().some(a=>Number.isFinite(a.effect?.getComputedTiming().endTime) && (a.playState==='running'||a.playState==='pending'))`)){
      assert.ok(Date.now()<settled,'UI transition did not settle');await new Promise(r=>setTimeout(r,50));
    }
    const measured=await browser.evaluate<{checked:number;lowCount:number;low:unknown[];unmeasured:unknown[]}>(`(${scan.trim()})('.builder-shell')`);
    reports.push({theme,width,surface,...measured});assert.ok(measured.checked>0);assert.equal(measured.lowCount,0,JSON.stringify({theme,width,surface,low:measured.low}));assert.equal(measured.unmeasured.length,0);
    if(surface==='delete')await browser.evaluate(`document.querySelector('[aria-label="关闭删除"]').click()`);
   }
   const shot=await browser.send<{data:string}>('Page.captureScreenshot',{format:'png'});await writeFile(`${out}/${theme}-${width}.png`,Buffer.from(shot.data,'base64'));
  }
 }finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify({at:new Date().toISOString(),siteId:id,reports},null,2)+'\n')}
});
