import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {codeCheckBrowser} from '../lib/code-site-browser.ts';
const base=process.env.SITECRAFT_BASE||'http://127.0.0.1:3034';
const siteId=process.argv[2],out=process.argv[3]||`artifacts/workspace-frames-${Date.now()}`;
if(!siteId)throw new Error('Provide an existing code-site ID; this capture does not create or generate sites.');
await mkdir(out,{recursive:false});const browser=await codeCheckBrowser();const observations:unknown[]=[];
try{
 for(const width of [1440,768,375]){
  await browser.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
  await browser.send('Page.navigate',{url:`${base}/workspace?site=${siteId}`});
  const end=Date.now()+25000;let ready=false;
  while(Date.now()<end){ready=await browser.evaluate<boolean>(`!!document.querySelector('[data-testid="code-workspace"]') && !document.querySelector('.code-preview-loading')`);if(ready)break;await new Promise(r=>setTimeout(r,100))}
  assert.ok(ready,'Real code workspace did not load');await browser.evaluate('document.fonts.ready');
  if(width<1100)await browser.evaluate(`document.querySelectorAll('[role="tab"]')[1].click()`);
  await browser.evaluate(`document.querySelector('[aria-label="预览宽度"] button:nth-child(${width===1440?1:width===768?2:3})').click()`);
  for(let frame=0;frame<3;frame++){
   const shot=await browser.send<{data:string}>('Page.captureScreenshot',{format:'png'});await writeFile(`${out}/${width}-${frame}.png`,Buffer.from(shot.data,'base64'));await new Promise(r=>setTimeout(r,100));
  }
  const observation=await browser.evaluate<{overflow:boolean;controls:number}>(`({overflow:document.documentElement.scrollWidth>innerWidth,controls:document.querySelectorAll('[aria-label="版本历史"],[aria-label="删除站点"]').length})`);
  assert.equal(observation.overflow,false);assert.equal(observation.controls,2);observations.push({width,...observation});
 }
}finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify({at:new Date().toISOString(),siteId,observations},null,2)+'\n')}
