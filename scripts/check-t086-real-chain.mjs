import fs from 'node:fs';
import { openBrowser, closeBrowser, openWorkspace, closePage, waitFor, screenshot } from '../tests/helpers/workspace-browser.ts';
const base = process.env.SITECRAFT_BASE || 'http://127.0.0.1:3070';
const sites = JSON.parse(fs.readFileSync('artifacts/t086/real-sites-pointer-r2.json','utf8')).ids;
const out = 'artifacts/t086';
const widths = [1440, 768, 375];
const report = { ticket:'T-086', base, model:'deepseek-flash', startedAt:new Date().toISOString(), runs:[] };
async function json(url, init) { const response = await fetch(url, init); const payload = await response.json().catch(()=>({})); return { response, payload }; }
async function clickProduct(browser, page) {
  await waitFor(browser, page.sessionId, `document.querySelector('[data-testid=\"open-source-template-frame\"]')?.dataset.previewHydrated==='true'`, 20000);
  const tree = await browser.send('Page.getFrameTree', {}, page.sessionId);
  const frame = tree.frameTree.childFrames?.find((item) => String(item.frame?.url || '').includes('/api/templates/'))?.frame;
  if (!frame?.id) throw Error('iframe frame unavailable');
  const world = await browser.send('Page.createIsolatedWorld', { frameId: frame.id, worldName: 't086-read-only' }, page.sessionId);
  const read = await browser.send('Runtime.evaluate', { contextId: world.executionContextId, expression: `(() => { const node = document.querySelector('[data-sitecraft-product-id]'); if (!node) return null; node.scrollIntoView({ block: 'center', inline: 'center' }); const r = node.getBoundingClientRect(); return { productId: node.getAttribute('data-sitecraft-product-id'), slot: node.getAttribute('data-sitecraft-slot'), left: r.left, top: r.top, width: r.width, height: r.height }; })()`, returnByValue: true }, page.sessionId);
  const product = read.result?.value; if (!product) throw Error('product card unavailable');
  const iframe = await browser.eval(`(() => { const r=document.querySelector('[data-testid=open-source-template-frame]').getBoundingClientRect(); return {left:r.left,top:r.top}; })()`, page.sessionId);
  const pageWidth = await browser.eval('innerWidth', page.sessionId);
  let x=iframe.left+product.left+Math.max(4,product.width/2), y=iframe.top+product.top+(pageWidth<=375?8:Math.max(4,product.height*0.25));
  const chat=await browser.eval(`(()=>{const r=document.querySelector('.builder-chat')?.getBoundingClientRect();return r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}:null})()`,page.sessionId);
  if(chat&&chat.width>0&&x>=chat.left&&x<=chat.right&&y>=chat.top&&y<=chat.bottom)x=iframe.left+product.left+Math.min(product.width*.25,Math.max(4,chat.left-iframe.left-product.left-8));
  await browser.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1},page.sessionId); await browser.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1},page.sessionId);
  const attached=await waitFor(browser,page.sessionId,`document.querySelector('[data-testid="annotation-current"]')?.className.includes('attached')`,10000); if(!attached) throw Error('annotation did not attach');
  return {productId: product.productId, slot: product.slot, click:{x,y}};
}
async function typeAndSubmit(browser,page,text) {
  const typed=await browser.eval(`(()=>{const box=document.querySelector('[aria-label="批注内容"]'); if(!box)return false; const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set; setter.call(box,${JSON.stringify(text)}); box.dispatchEvent(new Event('input',{bubbles:true})); return true})()`,page.sessionId); if(!typed) throw Error('annotation textarea missing');
  const enabled=await waitFor(browser,page.sessionId,`!document.querySelector('[data-testid="chat-send"]')?.disabled`,5000); if(!enabled) throw Error('annotation send stayed disabled');
  await browser.eval(`document.querySelector('[data-testid="chat-send"]')?.click()`,page.sessionId);
}
async function pollDraft(site, predicate, timeout=260000) { const start=Date.now(); let last=null; while(Date.now()-start<timeout){ const got=await json(`${base}/api/sites/${site}/draft`); last=got.payload; if(predicate(last)) return last; await new Promise(r=>setTimeout(r,1500)); } return last; }
const browser=await openBrowser();
try {
 for(let i=0;i<widths.length;i++){
  const width=widths[i], site=sites[i]; const page=await openWorkspace(browser,{siteId:site,width,theme:'dark',height:width<800?812:1000});
  if(width===375){ await browser.eval(`(()=>{[...document.querySelectorAll('.builder-mobile-tabs button')].find(x=>x.textContent.includes('预览'))?.click();return true})()`,page.sessionId); await new Promise(r=>setTimeout(r,500)); }
  const before=(await json(`${base}/api/sites/${site}/draft`)).payload; const candidate=await clickProduct(browser,page); const annotationText='只改这张产品卡的标题为“RA 减速机”，其他产品和页面内容保持不变。'; await typeAndSubmit(browser,page,annotationText);
  const annotation=await (async()=>{let value=null;for(let n=0;n<40;n++){const got=await json(`${base}/api/sites/${site}/annotations`);value=(got.payload.annotations||[]).find(x=>x.comments?.some(c=>c.body===annotationText));if(value)return value;await new Promise(r=>setTimeout(r,500));}return value;})();
  const after=await pollDraft(site,(snapshot)=>snapshot?.draft?.revision>before.draft.revision && snapshot.history?.[0]?.source==='ai',260000);
  const change=after?.history?.find((item)=>item.annotationId===annotation?.id) || after?.history?.[0];
  const modelShot=`${out}/real-${width}-after-model.png`; fs.writeFileSync(modelShot,await screenshot(browser,page.sessionId));
  let undo=null, conflict=null, manual=null;
  if(change?.id){ undo=await json(`${base}/api/sites/${site}/history/change/${change.id}/undo`,{method:'POST'}); const afterUndo=undo.payload; const product=afterUndo.draft.products.find(p=>p.id===candidate.productId); const manualTitle=`${product?.name?.zh || '产品'} · 手动 ${width} ${Date.now()}`; manual=await json(`${base}/api/sites/${site}/draft`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({baseRevision:afterUndo.draft.revision,source:'manual',summary:'后续改同一处',operations:[{op:'update_product',productId:candidate.productId,locale:'zh',name:manualTitle}]})}); const latest=manual.payload; conflict=await json(`${base}/api/sites/${site}/history/change/${change.id}/undo`,{method:'POST'}); }
  const shot=`${out}/real-${width}-final.png`; fs.writeFileSync(shot,await screenshot(browser,page.sessionId));
  report.runs.push({width,site,candidate,annotation,model:{revision:after?.draft?.revision,status:after?.history?.[0]?.source,history:after?.history?.slice(0,3)},screenshots:[modelShot,shot],undo:undo?.payload,manual:manual?.payload,conflict:conflict?.payload});
  await closePage(browser,page);
 }
} finally { await closeBrowser(browser); }
report.finishedAt=new Date().toISOString(); report.result=report.runs.every(r=>r.annotation && r.model?.status==='ai' && r.undo?.status==='applied' && r.manual?.status==='applied' && r.conflict?.status==='conflict' && (r.conflict?.conflictTargets?.length||0)>0)?'PASS':'INCOMPLETE'; fs.writeFileSync(`${out}/real-chain-pointer-r2.json`,JSON.stringify(report,null,2)); console.log(JSON.stringify({result:report.result,runs:report.runs.map(r=>({width:r.width,annotation:Boolean(r.annotation),model:r.model?.status,undo:r.undo?.status,manual:r.manual?.status,conflict:r.conflict?.status}))})); if(report.result!=='PASS')process.exitCode=1;
