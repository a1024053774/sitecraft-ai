import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import test from "node:test";
import { Cdp } from "./helpers/workspace-browser.ts";

const repo = process.cwd();
const out = path.resolve(process.env.T117_EVIDENCE_DIR || `artifacts/t117/focused-${Date.now()}-${process.pid}`);
mkdirSync(out, { recursive: true });

async function run(argv: string[], environment = process.env) {
  const startedAt = new Date().toISOString();
  const child = spawn(process.execPath, argv, { cwd: repo, env: environment, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", data => { output += data; });
  child.stderr.on("data", data => { output += data; });
  const code = await new Promise<number | null>((resolve, reject) => { child.on("error", reject); child.on("close", resolve); });
  return { command: [process.execPath, ...argv], startedAt, finishedAt: new Date().toISOString(), code, output };
}

async function temporaryPublishedSite(equipmentMode: "none" | "visible" | "hidden" = "none", templateId = "forge") {
  const directory = mkdtempSync(path.join(out, "isolated-site-"));
  mkdirSync(path.join(directory, "scripts"));
  copyFileSync(path.join(repo, "scripts/visitor-layout-scan.js"), path.join(directory, "scripts/visitor-layout-scan.js"));
  const script = path.join(directory, "published-fixture.ts");
  writeFileSync(script, `import {existsSync,readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';import {pathToFileURL} from 'node:url';import path from 'node:path';import {createServer} from 'node:http';
const repo=${JSON.stringify(repo)};
registerHooks({resolve(specifier,context,next){if(!specifier.startsWith('@/'))return next(specifier,context);const p=path.join(repo,specifier.slice(2));return next(pathToFileURL(existsSync(p+'.ts')?p+'.ts':path.join(p,'index.ts')).href,context);}});
const {createSite,commitOperations}=await import(pathToFileURL(path.join(repo,'lib/site-store.ts')).href);
const {composedPageForTemplate}=await import(pathToFileURL(path.join(repo,'lib/blocks/compose.ts')).href);
const {prepareHtml}=await import(pathToFileURL(path.join(repo,'app/api/templates/[templateId]/preview/route.ts')).href);
const {saveSiteImage,publicImagePayload,readSiteImage}=await import(pathToFileURL(path.join(repo,'lib/site-images.ts')).href);
const id='t117-rebuildable-fixture',before=await createSite(id);
const committed=await commitOperations({siteId:id,baseRevision:before.draft.revision,source:'manual',summary:'Independent T117 capture input',operations:[
{op:'set_template',templateId:${JSON.stringify(templateId)}},
{op:'set_text',target:'companyName',value:'T117 Precision Works'},
{op:'set_text',target:'industry',value:{zh:'精密零件加工',en:'Precision parts machining'}},
{op:'set_text',target:'hero.title',value:{zh:'按图加工精密零件',en:'Precision parts machined to drawing'}},
{op:'set_text',target:'hero.subtitle',value:{zh:'提供CNC加工与尺寸检测。',en:'CNC machining and dimensional inspection.'}},
{op:'set_text',target:'contact.email',value:'capture@example.test'},
{op:'replace_products',products:[{id:'part-1',sku:'T117-01',name:{zh:'精密工件',en:'Precision part'},summary:{zh:'按图加工，公差0.02 mm。',en:'Machined to drawing, tolerance 0.02 mm.'},category:{zh:'工件',en:'Parts'},status:'published',imageColor:'#e6e1cf',specs:[]}]}]});
if(committed.status!=='applied')throw new Error('Temporary commitOperations input did not apply: '+committed.status);
let draft=committed.record.draft;
const equipmentMode=${JSON.stringify(equipmentMode)},images=[];
if(equipmentMode!=='none'){
 const manifest=JSON.parse(readFileSync(path.join(repo,'tests/fixtures/company-images/industrial/manifest.json'),'utf8'));
 const entry=manifest.images.find(image=>image.category==='equipment');
 const record=await saveSiteImage({siteId:id,bytes:readFileSync(path.join(repo,'tests/fixtures/company-images/industrial',entry.file)),originalName:entry.file,provenance:{usageCategory:'equipment',license:entry.apiLicense,sourceUrl:entry.sourceUrl,licenseUrl:entry.licenseUrl,author:entry.author,attribution:entry.attribution,usageScope:'current-site-only',retrievedAt:entry.downloadedAt}});
 images.push(publicImagePayload(record));
 const change=await commitOperations({siteId:id,baseRevision:draft.revision,source:'manual',summary:'Photo-only equipment visibility fixture',operations:[{op:'replace_equipment',equipment:[]},{op:'set_section_visibility',section:'equipment',visible:equipmentMode==='visible'}]});
 if(!['applied','no_change'].includes(change.status))throw new Error('Equipment visibility commit failed');draft=change.record.draft;
 if(draft.content.equipment.length!==0)throw new Error('Fixture requires zero equipment items');
}
const preview=prepareHtml(composedPageForTemplate(draft.templateId),'',draft.templateId,true,false);
const host=\`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/visitor-host.css"><main class="published-template-shell"><div class="published-template-stage"><div class="open-source-template-frame-shell open-source-template-frame-shell-published" data-preview-state="loading"><iframe class="open-source-template-frame open-source-template-frame-published" sandbox="allow-scripts allow-forms" src="/api/templates/\${draft.templateId}/preview"></iframe></div></div></main><script>
const draft=\${JSON.stringify(draft)},images=\${JSON.stringify(images)},frame=document.querySelector('iframe');let locale='zh';
const send=()=>frame.contentWindow.postMessage({type:'sitecraft:content',typeVersion:1,sessionId:'t117-fixture-session',templateId:draft.templateId,draft,locale,variant:'published',images,offersVisitorEnglish:draft.englishReady},'*');
addEventListener('message',event=>{if(event.source!==frame.contentWindow)return;const data=event.data;if(data.type==='sitecraft:ready')send();if(data.type==='sitecraft:applied'){frame.dataset.previewHydrated='true';frame.parentElement.dataset.previewState='ready';}if(data.type==='sitecraft:locale'){locale=data.locale;send();}});frame.addEventListener('load',send);
</script>\`;
const server=createServer(async(request,response)=>{try{const url=new URL(request.url,'http://fixture');response.setHeader('content-type','text/html; charset=utf-8');response.setHeader('access-control-allow-origin','*');
if(url.pathname==='/api/sites/'+id+'/draft')response.end(JSON.stringify({draft}));
else if(url.pathname==='/api/sites/'+id+'/images')response.end(JSON.stringify({images}));
else if(url.pathname.startsWith('/api/sites/'+id+'/images/')){const image=await readSiteImage(id,url.pathname.split('/').at(-1));if(!image)throw new Error('Image missing');response.setHeader('content-type',image.record.mime);response.end(Buffer.from(image.bytes));}
else if(url.pathname.startsWith('/published/'))response.end(host);
else if(url.pathname.endsWith('/preview'))response.end(preview);
else {const relative=url.pathname.replace(/^\\/api\\/templates\\/[^/]+\\/assets/,'');const file=path.join(repo,'public',relative);if(!file.startsWith(path.join(repo,'public')+path.sep))throw new Error('outside public');response.setHeader('content-type',file.endsWith('.woff2')?'font/woff2':'text/css');response.end(readFileSync(file));}
}catch(error){response.statusCode=500;response.end(String(error));}});
server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({base:'http://127.0.0.1:'+server.address().port,id,cwd:process.cwd()})));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
`, "utf8");
  const child = spawn(process.execPath, ["--experimental-strip-types", script], { cwd: directory, env: { ...process.env, SITE_STORE: "fs", NODE_ENV: "development" }, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  const ready = await new Promise<{ base: string; id: string; cwd: string }>((resolve, reject) => {
    const timer = setTimeout(() => { child.kill();reject(new Error(`isolated fixture did not start: ${output}`)); }, 15000);
    child.stdout.on("data", data => { output += data;const line=output.split("\n").find(line=>line.startsWith('{"base"'));if(line){clearTimeout(timer);resolve(JSON.parse(line));} });
    child.stderr.on("data", data => { output += data; });
    child.on("exit", code => { clearTimeout(timer);reject(new Error(`isolated fixture exited ${code}: ${output}`)); });
  });
  assert.equal(ready.cwd, directory, "commitOperations writes only the isolated temporary cwd");
  writeFileSync(path.join(out, "isolated-site.json"), JSON.stringify(ready, null, 2), "utf8");
  return { ...ready, stop: () => child.kill("SIGTERM") };
}

test("T-117 real CLI rejects size-matched original blank PNGs with a rebuildable commitOperations input", { timeout: 120000 }, async () => {
  const published = path.join(out, "known-blank-cli");
  const preload = path.join(out, "inject-original-blank.mjs");
  const fixtures = path.join(repo, "tests/fixtures/t117");
  // Only the screenshot response changes. The real bridge, DOM facts and layout
  // scanner run against a repo-rebuildable draft committed in an isolated environment.
  writeFileSync(preload, `import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const Native=globalThis.WebSocket,send=Native.prototype.send;
const requests=new Map(),counts=new Map(),injections=[];
globalThis.WebSocket=class extends Native {
  constructor(...args){super(...args);this.listeners=[];super.addEventListener('message',event=>{
    const msg=JSON.parse(event.data),request=requests.get(msg.id);
    if(request){requests.delete(msg.id);if(request.locale==='zh'&&[1440,768].includes(request.width)&&msg.result?.data){
      const file=${JSON.stringify(fixtures)}+'/capture-blank-zh-'+request.width+'.png';
      const sized=spawnSync('python3',['-c',"from PIL import Image\\nimport io,sys,base64\\nim=Image.open(sys.argv[1]);im=im.resize((int(sys.argv[2]),int(sys.argv[3])))\\nb=io.BytesIO();im.save(b,format='PNG');print(base64.b64encode(b.getvalue()).decode())",file,String(request.width),String(request.height)],{encoding:'utf8'});
      if(sized.status!==0)throw Error(sized.stderr);msg.result.data=sized.stdout.trim();injections.push({width:request.width,height:request.height,locale:request.locale,file});
    }}
    const forwarded=new MessageEvent('message',{data:JSON.stringify(msg)});
    for(const listener of this.listeners)listener.call(this,forwarded);
  });}
  addEventListener(type,listener,options){if(type==='message'){this.listeners.push(listener);return;}return super.addEventListener(type,listener,options);}
  send(raw){const request=JSON.parse(raw);if(request.method==='Page.captureScreenshot'){
    const {width,height}=request.params.clip,count=counts.get(width)||0;counts.set(width,count+1);requests.set(request.id,{width,height,locale:count===0?'zh':'en'});
  }return send.call(this,raw);}
};
const log=console.log.bind(console);console.log=(...args)=>{log(...args);if(args.some(x=>String(x).includes('restarting Chrome and retrying')))process.exit(2);};
process.on('exit',()=>fs.writeFileSync(${JSON.stringify(path.join(out, "injected-captures.json"))},JSON.stringify(injections,null,2)));
`, "utf8");
  const fixture = await temporaryPublishedSite();
  let result: Awaited<ReturnType<typeof run>>;
  try { result = await run(["--import", preload, process.env.T117_CHECK_PUBLISHED || "scripts/check-published.mjs", "--out", published, fixture.id], { ...process.env, SITECRAFT_BASE: fixture.base }); }
  finally { fixture.stop(); }
  writeFileSync(path.join(out, "known-blank-cli-run.json"), JSON.stringify(result, null, 2), "utf8");
  const rows = JSON.parse(readFileSync(path.join(published, "report.json"), "utf8"));
  assert.deepEqual(JSON.parse(readFileSync(path.join(out, "injected-captures.json"), "utf8")).map((row: { width: number }) => row.width), [1440, 768], "both actual bad captures reached the real boundary");
  for (const width of [1440, 768]) {
    const row = rows.find((row: { width: number }) => row.width === width);
    assert.ok(row.measurement.visibleBlocks.includes("hero") && row.measurement.visibleBlocks.includes("footer"), "real DOM measurement still ran");
    assert.ok(row.facts.expected > 0, "the actual material-facts check ran");
    assert.ok(row.textContrast.some((entry: { slot: string; text: string }) => entry.slot === "products.part-1.name.zh" && entry.text === "精密工件"), "the product supplied by the independent fixture reached the real DOM scanner");
    assert.equal(row.facts.missing, 0, "the supplied material facts still passed");
    assert.equal(row.imageCoverage.images.length, 0, "the permanent input explicitly has no photos");
    assert.equal(row.screenshotGeometry.pngWidth, row.screenshotGeometry.width);
    assert.equal(row.screenshotGeometry.pngHeight, row.screenshotGeometry.pageHeight, "bad paint has exactly the requested capture dimensions");
    assert.ok(row.captureFailures.some((failure: string) => failure.startsWith("screenshot content missing:")), `${width}: screenshot content business assertion must reject the known blank capture; actual captureFailures=${JSON.stringify(row.captureFailures)}`);
    assert.ok(row.captureFailures.every((failure: string) => failure.startsWith("screenshot content missing:")), "the bad-PNG failure is content, not setup, state or clipping");
  }
  assert.equal(result.code, 1, "known blank screenshot content must make the original CLI exit nonzero");
});

test("T-117 real CLI rejects restored WAAPI motion of unsampled text in a rebuildable commitOperations input", { timeout: 120000 }, async () => {
  const published = path.join(out, "motion-cli");
  const preload = path.join(out, "inject-motion.mjs");
  // Move two distinct business fields, independently of the observer's sample choice.
  // Hold the actual animated geometry through the native screenshot response, then restore.
  const motions = [{ index: 0, slot: "hero.title.zh", dy: 72 }, { index: 3, slot: "products.part-1.summary.en", dy: -27 }];
  writeFileSync(preload, `import fs from 'node:fs';import path from 'node:path';
const Native=globalThis.WebSocket,rawSend=Native.prototype.send;
const pending=new Map(),requests=new Map(),sessions=new Map(),targets=new Map(),records=[];
const motions=${JSON.stringify(motions)},out=${JSON.stringify(out)};
let internalId=-1,captureIndex=0;
function rpc(socket,method,params={},sessionId){const id=internalId--;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});rawSend.call(socket,JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
async function evaluate(socket,sessionId,expression){const r=await rpc(socket,'Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
const raf='new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))';
const read=slot=>\`(() => {const el=document.querySelector('[data-sitecraft-slot="'+\${JSON.stringify(slot)}+'"]');if(!el)throw Error('motion fixture text absent');const r=el.getBoundingClientRect();return {text:el.textContent,x:r.x,y:r.y,width:r.width,height:r.height,viewport:[innerWidth,innerHeight],scroll:[scrollX,scrollY],watchPresent:!!window.__sitecraftCaptureWatch};})()\`;
globalThis.WebSocket=class extends Native {
 constructor(...args){super(...args);this.listeners=[];super.addEventListener('message',event=>{void this.receive(event).catch(error=>{fs.writeFileSync(path.join(out,'motion-preload-error.txt'),error.stack);process.exit(3);});});}
 addEventListener(type,listener,options){if(type==='message'){this.listeners.push(listener);return;}return super.addEventListener(type,listener,options);}
 async receive(event){const msg=JSON.parse(event.data);
  if(pending.has(msg.id)){const p=pending.get(msg.id);pending.delete(msg.id);if(msg.error)p.reject(Error(JSON.stringify(msg.error)));else p.resolve(msg.result);return;}
  const request=requests.get(msg.id);if(request){requests.delete(msg.id);
   if(request.method==='Target.getTargets')for(const target of msg.result.targetInfos)targets.set(target.targetId,target);
   if(request.method==='Target.attachToTarget')sessions.set(msg.result.sessionId,request.params.targetId);
   if(request.audit){if(msg.error)throw Error(JSON.stringify(msg.error));const a=request.audit;
    fs.writeFileSync(path.join(out,'motion-'+a.index+'-native.png'),Buffer.from(msg.result.data,'base64'));
    a.during=await evaluate(this,a.frame,read(a.slot));
    await evaluate(this,a.frame,'window.__t117Motion.cancel();delete window.__t117Motion');
    await evaluate(this,a.frame,raf);a.after=await evaluate(this,a.frame,read(a.slot));records.push(a);
   }
  }
  const forwarded=new MessageEvent('message',{data:JSON.stringify(msg)});for(const listener of this.listeners)listener.call(this,forwarded);
 }
 send(raw){const request=JSON.parse(raw);requests.set(request.id,request);
  if(request.method!=='Page.captureScreenshot'){rawSend.call(this,raw);return;}
  const index=captureIndex++,motion=motions.find(m=>m.index===index);
  if(!motion){rawSend.call(this,raw);return;}
  void(async()=>{const hostTarget=sessions.get(request.sessionId),frameTarget=[...targets.values()].find(t=>t.type==='iframe'&&t.parentId===hostTarget&&t.url.includes('/api/templates/'));
   const frame=[...sessions.entries()].find(([,target])=>target===frameTarget?.targetId)?.[0];if(!frame)throw Error('owned motion fixture iframe absent');
   const a={...motion,hostTarget,frameTarget,frame,clip:request.params.clip};request.audit=a;
   await evaluate(this,frame,raf);a.before=await evaluate(this,frame,read(a.slot));
   const transform='translateY('+a.dy+'px)';
   a.input=\`(() => {const el=document.querySelector('[data-sitecraft-slot="'+\${JSON.stringify(a.slot)}+'"]');window.__t117Motion=el.animate([{transform:\${JSON.stringify(transform)}},{transform:\${JSON.stringify(transform)}}],{duration:60000,fill:'both'});window.__t117Motion.pause();})()\`;
   await evaluate(this,frame,a.input);await evaluate(this,frame,raf);a.atCapture=await evaluate(this,frame,read(a.slot));rawSend.call(this,raw);
  })().catch(error=>{fs.writeFileSync(path.join(out,'motion-preload-error.txt'),error.stack);process.exit(3);});
 }
};
process.on('exit',()=>fs.writeFileSync(path.join(out,'motion-input-output.json'),JSON.stringify(records,null,2)));
`, "utf8");
  const fixture = await temporaryPublishedSite("none", "screwfast");
  let result: Awaited<ReturnType<typeof run>>;
  try { result = await run(["--import", preload, process.env.T117_CHECK_PUBLISHED || "scripts/check-published.mjs", "--out", published, fixture.id], { ...process.env, SITECRAFT_BASE: fixture.base }); }
  finally { fixture.stop(); }
  writeFileSync(path.join(out, "motion-cli-run.json"), JSON.stringify(result, null, 2), "utf8");
  const rows = JSON.parse(readFileSync(path.join(published, "report.json"), "utf8"));
  const records = JSON.parse(readFileSync(path.join(out, "motion-input-output.json"), "utf8"));
  assert.deepEqual(records.map((record: { index: number }) => record.index), [0, 3], "both real native screenshots were animated");
  for (const [i, motion] of motions.entries()) {
    const record = records[i], row = motion.index === 0 ? rows[0] : rows[1].english;
    assert.equal(record.atCapture.y, record.before.y + motion.dy);
    assert.equal(record.during.y, record.atCapture.y, "wrong position persists until the actual screenshot has returned");
    assert.deepEqual(record.after, record.before, "geometry fully restores before capture finishes");
    assert.equal(record.before.watchPresent, true, "motion begins inside the real capture observation interval");
    assert.equal(record.frameTarget.parentId, record.hostTarget);
    assert.ok(row.measurement.visibleBlocks.includes("hero") && row.measurement.visibleBlocks.includes("footer"));
    assert.ok(row.facts.expected > 0);assert.equal(row.facts.missing, 0);
    assert.equal(row.screenshotGeometry.pngWidth, row.screenshotGeometry.width);
    assert.equal(row.screenshotGeometry.pngHeight, row.screenshotGeometry.pageHeight);
    assert.ok(!row.screenshotContent.samples.some((sample: { slot: string }) => sample.slot === motion.slot), "the moving field is outside local paint sampling");
    assert.deepEqual(row.screenshotContent.failures, [], "local paint remains valid and is not complete geometry evidence");
    assert.ok(row.captureFailures.some((failure: string) => failure.startsWith("screenshot layout changed during capture: document")), `${motion.slot}: restored animated geometry must fail the capture report; actual=${JSON.stringify(row.captureFailures)}`);
    assert.ok(row.captureFailures.every((failure: string) => failure.startsWith("screenshot layout changed during capture:")), "reject motion rather than setup, clipping or paint");
  }
  for (const row of [rows[0].english, rows[1], rows[2], rows[2].english]) assert.deepEqual(row.captureFailures, [], "static control captures pass");
  assert.equal(result.code, 1, "capture-time animated text displacement makes the real CLI exit 1");
});

test("T-117 real CLI rejects restored host and ancestor WAAPI motion with native displaced PNGs", { timeout: 120000 }, async () => {
  const published = path.join(out, "boundary-motion-cli");
  const control = path.join(out, "boundary-control-cli");
  const preload = path.join(out, "inject-boundary-motion.mjs");
  // A host iframe translation and an ancestor translation along a different axis.
  // Expected displacement comes from these inputs and the native PNGs, not STATE.
  const motions = [
    { index: 2, selector: "iframe.open-source-template-frame", dx: 0, dy: -2 },
    { index: 4, selector: ".published-template-stage", dx: -1, dy: 0 },
  ];
  writeFileSync(preload, `import fs from 'node:fs';import path from 'node:path';
const Native=globalThis.WebSocket,rawSend=Native.prototype.send;
const pending=new Map(),requests=new Map(),sessions=new Map(),targets=new Map(),records=[];
const motions=${JSON.stringify(motions)},out=${JSON.stringify(out)};
let internalId=-1,captureIndex=0;
function rpc(socket,method,params={},sessionId){const id=internalId--;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});rawSend.call(socket,JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
async function evaluate(socket,sessionId,expression){const r=await rpc(socket,'Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
const raf='new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))';
const readHost=\`(() => {const el=document.querySelector('iframe.open-source-template-frame');if(!el)throw Error('host iframe absent');const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,viewport:[innerWidth,innerHeight],scroll:[scrollX,scrollY],watchPresent:!!window.__sitecraftCaptureWatch};})()\`;
const readText=\`(() => {const el=document.querySelector('[data-sitecraft-slot="hero.title.zh"]');if(!el)throw Error('owned iframe text absent');const r=el.getBoundingClientRect();return {text:el.textContent,x:r.x,y:r.y,width:r.width,height:r.height,watchPresent:!!window.__sitecraftCaptureWatch};})()\`;
globalThis.WebSocket=class extends Native {
 constructor(...args){super(...args);this.listeners=[];super.addEventListener('message',event=>{void this.receive(event).catch(error=>{fs.writeFileSync(path.join(out,'boundary-preload-error.txt'),error.stack);process.exit(3);});});}
 addEventListener(type,listener,options){if(type==='message'){this.listeners.push(listener);return;}return super.addEventListener(type,listener,options);}
 async receive(event){const msg=JSON.parse(event.data);
  if(pending.has(msg.id)){const p=pending.get(msg.id);pending.delete(msg.id);if(msg.error)p.reject(Error(JSON.stringify(msg.error)));else p.resolve(msg.result);return;}
  const request=requests.get(msg.id);if(request){requests.delete(msg.id);
   if(request.method==='Target.getTargets')for(const target of msg.result.targetInfos)targets.set(target.targetId,target);
   if(request.method==='Target.attachToTarget')sessions.set(msg.result.sessionId,request.params.targetId);
   if(request.audit){if(msg.error)throw Error(JSON.stringify(msg.error));const a=request.audit;
    fs.writeFileSync(path.join(out,'boundary-'+a.index+'-native.png'),Buffer.from(msg.result.data,'base64'));
    a.during=await evaluate(this,request.sessionId,readHost);a.textDuring=await evaluate(this,a.frame,readText);
    await evaluate(this,request.sessionId,'window.__t117BoundaryMotion.cancel();delete window.__t117BoundaryMotion');
    await evaluate(this,request.sessionId,raf);a.after=await evaluate(this,request.sessionId,readHost);records.push(a);
   }
  }
  const forwarded=new MessageEvent('message',{data:JSON.stringify(msg)});for(const listener of this.listeners)listener.call(this,forwarded);
 }
 send(raw){const request=JSON.parse(raw);requests.set(request.id,request);
  if(request.method!=='Page.captureScreenshot'){rawSend.call(this,raw);return;}
  const index=captureIndex++,motion=motions.find(m=>m.index===index);
  if(!motion){rawSend.call(this,raw);return;}
  void(async()=>{const hostTarget=sessions.get(request.sessionId),frameTarget=[...targets.values()].find(t=>t.type==='iframe'&&t.parentId===hostTarget&&t.url.includes('/api/templates/'));
   const frame=[...sessions.entries()].find(([,target])=>target===frameTarget?.targetId)?.[0];if(!frame)throw Error('owned boundary iframe absent');
   const a={...motion,hostTarget,frameTarget,frame,clip:request.params.clip};request.audit=a;
   await evaluate(this,request.sessionId,raf);a.before=await evaluate(this,request.sessionId,readHost);a.textBefore=await evaluate(this,frame,readText);
   const transform='translate('+a.dx+'px,'+a.dy+'px)';
   a.input=\`(() => {const el=document.querySelector(\${JSON.stringify(a.selector)});if(!el)throw Error('boundary input absent');window.__t117BoundaryMotion=el.animate([{transform:\${JSON.stringify(transform)}},{transform:\${JSON.stringify(transform)}}],{duration:60000,fill:'both'});window.__t117BoundaryMotion.pause();})()\`;
   await evaluate(this,request.sessionId,a.input);await evaluate(this,request.sessionId,raf);a.atCapture=await evaluate(this,request.sessionId,readHost);rawSend.call(this,raw);
  })().catch(error=>{fs.writeFileSync(path.join(out,'boundary-preload-error.txt'),error.stack);process.exit(3);});
 }
};
process.on('exit',()=>fs.writeFileSync(path.join(out,'boundary-input-output.json'),JSON.stringify(records,null,2)));
`, "utf8");
  const fixture = await temporaryPublishedSite("none", "screwfast");
  let baseline: Awaited<ReturnType<typeof run>>, result: Awaited<ReturnType<typeof run>>;
  try {
    baseline = await run([process.env.T117_CHECK_PUBLISHED || "scripts/check-published.mjs", "--out", control, fixture.id], { ...process.env, SITECRAFT_BASE: fixture.base });
    writeFileSync(path.join(out, "boundary-control-cli-run.json"), JSON.stringify(baseline, null, 2), "utf8");
    assert.equal(baseline.code, 0, baseline.output);
    result = await run(["--import", preload, process.env.T117_CHECK_PUBLISHED || "scripts/check-published.mjs", "--out", published, fixture.id], { ...process.env, SITECRAFT_BASE: fixture.base });
  } finally { fixture.stop(); }
  writeFileSync(path.join(out, "boundary-motion-cli-run.json"), JSON.stringify(result, null, 2), "utf8");
  const rows = JSON.parse(readFileSync(path.join(published, "report.json"), "utf8"));
  const controls = JSON.parse(readFileSync(path.join(control, "report.json"), "utf8"));
  const records = JSON.parse(readFileSync(path.join(out, "boundary-input-output.json"), "utf8"));
  assert.deepEqual(records.map((record: { index: number }) => record.index), [2, 4]);
  for (const measured of controls.flatMap((row: { english: unknown }) => [row, row.english])) assert.deepEqual(measured.captureFailures, [], "all six static controls pass");
  // Prove both real native PNGs moved, before asking the report to reject them.
  for (const [i, motion] of motions.entries()) {
    const record = records[i], row = rows[motion.index / 2], normal = controls[motion.index / 2];
    assert.equal(record.atCapture.x, record.before.x + motion.dx);
    assert.equal(record.atCapture.y, record.before.y + motion.dy);
    assert.deepEqual(record.during, record.atCapture, "displacement lasts through the native screenshot response");
    assert.deepEqual(record.after, record.before, "host geometry restores inside the capture interval");
    assert.deepEqual(record.textDuring, record.textBefore, "iframe-local text does not expose its host projection change");
    assert.equal(record.before.watchPresent, true);assert.equal(record.textBefore.watchPresent, true);
    assert.equal(record.frameTarget.parentId, record.hostTarget);
    const native = path.join(out, `boundary-${motion.index}-native.png`);
    assert.deepEqual(readFileSync(native), readFileSync(row.screenshot), "the CLI kept the unmodified native PNG");
    const pixelArguments = ["-c", "from PIL import Image\nimport sys,json\na=Image.open(sys.argv[1]).convert('RGB');b=Image.open(sys.argv[2]).convert('RGB');dx=int(sys.argv[3]);dy=int(sys.argv[4]);assert a.size==b.size\nw,h=a.size;x=max(0,dx);y=max(0,dy);right=min(w,w+dx);bottom=min(h,h+dy)\nshifted=a.crop((x-dx,y-dy,right-dx,bottom-dy));actual=b.crop((x,y,right,bottom));same=shifted.tobytes()==actual.tobytes();changed=a.tobytes()!=b.tobytes()\nprint(json.dumps({'dx':dx,'dy':dy,'comparedPixels':shifted.width*shifted.height,'nativePixelsDisplaced':same,'nativePixelsChanged':changed}));assert same and changed", normal.screenshot, native, String(motion.dx), String(motion.dy)];
    const pixels = spawnSync("python3", pixelArguments, { encoding: "utf8" });
    writeFileSync(path.join(out, `boundary-${motion.index}-pixel-proof.json`), JSON.stringify({ command: ["python3", ...pixelArguments], status: pixels.status, stdout: pixels.stdout, stderr: pixels.stderr }, null, 2), "utf8");
    assert.equal(pixels.status, 0, `actual PNG must carry the injected displacement: ${pixels.stderr}`);
    assert.ok(row.measurement.visibleBlocks.includes("hero") && row.measurement.visibleBlocks.includes("footer"));
    assert.ok(row.facts.expected > 0);assert.equal(row.facts.missing, 0);
    assert.equal(row.screenshotGeometry.pngWidth, row.screenshotGeometry.width);
    assert.equal(row.screenshotGeometry.pngHeight, row.screenshotGeometry.pageHeight);
    assert.deepEqual(row.screenshotContent.failures, [], "paint errors must not substitute for the host layout assertion");
  }
  for (const motion of motions) {
    const row = rows[motion.index / 2];
    assert.ok(row.captureFailures.some((failure: string) => failure.startsWith("screenshot layout changed during capture: page")), `${motion.selector}: native restored host motion must fail layout; actual=${JSON.stringify(row.captureFailures)}`);
    assert.ok(row.captureFailures.every((failure: string) => failure.startsWith("screenshot layout changed during capture:")), "only the changed capture layout fails");
  }
  for (const measured of [rows[0], rows[0].english, rows[1].english, rows[2].english]) assert.deepEqual(measured.captureFailures, [], "static captures in the injected run pass");
  assert.equal(result.code, 1, "native displaced host screenshots must make the real CLI exit 1");
});

// These HTML inputs specify the paint contract independently of the candidate. They are
// served by an isolated temporary server and contain no SiteDraft or mainline storage writes.
// Failure cases: a decoded blank, border-only noise, and a transient layout that restores.
// Positive case: no photos, 9px light-weight text, CJK/punctuation and a gradient background.
async function captureFixture(kind: "clear" | "blank" | "border" | "color-noise" | "transparent" | "translucent" | "transient" | "rect-transient") {
  const { capturePublishedPage } = await import(process.env.T117_CAPTURE_MODULE || "../scripts/published-capture.mjs");
  const frameHtml = `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    html,body{margin:0}body{font:12px Arial,sans-serif;color:#222;background:white}
    header,section,footer{padding:24px}h1,p{margin:0}h1{font-size:18px;font-weight:400}
    .hero{background:linear-gradient(180deg,#f1f3f5,#fff)}.products{min-height:930px}
    .fine{font-size:9px;font-weight:300;letter-spacing:.35px;color:#60666a;line-height:13px}
    footer{background:#151817;color:white}
  </style><header data-sc-block="nav"><span data-sitecraft-slot="companyName.en">Clear Works</span></header>
  <section class="hero" data-sc-block="hero"><h1 data-sitecraft-slot="hero.title.en">Molds and parts</h1></section>
  <section class="products" data-sc-block="products"><p class="fine" data-sitecraft-slot="products.part.summary.en">iii lll 中文；0.5 mm / CNC, precision.</p></section>
  <footer data-sc-block="footer"><span data-sitecraft-slot="companyName.en">Clear Works</span></footer></html>`;
  const server = createServer((request, response) => {
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(request.url === "/frame" ? frameHtml : `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0}.published-template-shell,.published-template-stage,.open-source-template-frame-shell,iframe{width:100%;height:100vh}iframe{display:block;border:0}</style><main class="published-template-shell"><div class="published-template-stage"><div class="open-source-template-frame-shell" data-preview-state="ready"><iframe class="open-source-template-frame" data-preview-hydrated="true" sandbox="allow-scripts allow-forms" src="/frame"></iframe></div></div></main>`);
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  assert.ok(process.env.CHROME_PATH, "use the approved Chrome binary");
  const chrome = spawn(process.env.CHROME_PATH, ["--remote-debugging-port=0", `--user-data-dir=${mkdtempSync(path.join(out, `chrome-${kind}-`))}`, "--headless=new", "--no-first-run", "--site-per-process", "--enable-features=IsolateSandboxedIframes", "about:blank"], { stdio: "ignore" });
  const profile = chrome.spawnargs.find(arg => arg.startsWith("--user-data-dir="))!.slice("--user-data-dir=".length);
  let browser: Cdp | undefined;
  try {
    let port = "";
    const deadline = Date.now() + 10000;
    while (!port && Date.now() < deadline) {
      try { port = readFileSync(path.join(profile, "DevToolsActivePort"), "utf8").split("\n")[0]; } catch { /* owned browser startup */ }
      if (!port) await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(port, "the owned Chrome must start");
    const version = await fetch(`http://127.0.0.1:${port}/json/version`).then(r => r.json()) as { webSocketDebuggerUrl: string };
    browser = new Cdp(version.webSocketDebuggerUrl);await browser.connect();
    const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
    const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
    await browser.send("Page.enable", {}, sessionId);await browser.send("Runtime.enable", {}, sessionId);
    await browser.send("Emulation.setDeviceMetricsOverride", { width: 375, height: 900, deviceScaleFactor: 1, mobile: true }, sessionId);
    await browser.send("Page.navigate", { url: base }, sessionId);
    let frameTarget: { targetId: string } | undefined;
    while (!frameTarget && Date.now() < deadline) {
      const targets = await browser.send("Target.getTargets") as { targetInfos: Array<{ targetId: string; type: string; parentId: string; url: string }> };
      frameTarget = targets.targetInfos.find(t => t.type === "iframe" && t.parentId === targetId && t.url === `${base}/frame`);
      if (!frameTarget) await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(frameTarget, "the fixture's real sandboxed iframe is attached to the host");
    const frame = (await browser.send("Target.attachToTarget", { targetId: frameTarget.targetId, flatten: true }) as { sessionId: string }).sessionId;
    await browser.send("Runtime.enable", {}, frame);
    await browser.eval("document.fonts.ready", frame);
    assert.equal(await browser.eval("document.images.length", frame), 0, "the positive input has no photos");
    const owned = browser;
    const boundary = { send: async (method: string, params: Record<string, unknown> = {}, target?: string) => {
      const response = await owned.send(method, params, target);
      if (method !== "Page.captureScreenshot") return response;
      const clip = params.clip as { width: number; height: number };
      if (kind === "blank" || kind === "border" || kind === "color-noise") {
        const synthetic = spawnSync("python3", ["-c", "from PIL import Image,ImageDraw\nimport sys,io,base64\nim=Image.new('RGB',(int(sys.argv[1]),int(sys.argv[2])),'white')\nif sys.argv[3]=='border': ImageDraw.Draw(im).rectangle((0,0,im.width-1,im.height-1),outline='black',width=1)\nif sys.argv[3]=='color-noise':\n for y in range(im.height):\n  for x in range(im.width):\n   if (x+y)%2: im.putpixel((x,y),(168,130,205))\nb=io.BytesIO();im.save(b,format='PNG');print(base64.b64encode(b.getvalue()).decode())", String(clip.width), String(clip.height), kind], { encoding: "utf8" });
        assert.equal(synthetic.status, 0, synthetic.stderr);
        return { data: synthetic.stdout.trim() };
      }
      if (kind === "transparent" || kind === "translucent") {
        const original = response as { data: string };
        const synthetic = spawnSync("python3", ["-c", "from PIL import Image\nimport sys,io,base64\nim=Image.open(io.BytesIO(base64.b64decode(sys.stdin.read()))).convert('RGBA')\nim.putalpha(int(sys.argv[1]))\nb=io.BytesIO();im.save(b,format='PNG');print(base64.b64encode(b.getvalue()).decode())", kind === "transparent" ? "0" : "128"], { input: original.data, encoding: "utf8" });
        assert.equal(synthetic.status, 0, synthetic.stderr);
        return { data: synthetic.stdout.trim() };
      }
      if (kind === "transient") {
        for (const width of [1, 375]) {
          await owned.send("Emulation.setDeviceMetricsOverride", { width, height: clip.height, deviceScaleFactor: 1, mobile: true }, sessionId);
          await owned.eval("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))", frame);
        }
      }
      if (kind === "rect-transient") {
        for (const transform of ["translateY(3px)", "none"]) {
          await owned.eval(`document.querySelector('[data-sitecraft-slot="products.part.summary.en"]').style.transform=${JSON.stringify(transform)}`, frame);
          await owned.eval("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))", frame);
        }
      }
      return response;
    }};
    const report = await capturePublishedPage(boundary, sessionId, frame, { width: 375, file: path.join(out, `${kind}.png`), inspect: async () => ({ fixture: kind }) });
    writeFileSync(path.join(out, `${kind}.json`), JSON.stringify(report, null, 2), "utf8");
    return report;
  } finally {
    if (browser) { await browser.send("Browser.close").catch(() => {}); browser.ws.close(); }
    chrome.kill();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test("T-117 actual final text paint accepts an image-free page with fine glyphs and a gradient", async () => {
  const report = await captureFixture("clear");
  assert.deepEqual(report.captureFailures, []);
  assert.deepEqual(report.screenshotContent.samples.map((s: { block: string }) => s.block), ["nav", "hero", "products", "footer"]);
  assert.ok(report.screenshotGeometry.pngHeight > 900, "the fixture needs a genuinely full prepared viewport");
});

for (const kind of ["blank", "border"] as const) test(`T-117 rejects ${kind} pixels despite healthy real text DOM`, async () => {
  const report = await captureFixture(kind);
  assert.ok(report.captureFailures.some((f: string) => f.startsWith("screenshot content missing:")));
});

test("T-117 rejects colored noise that cannot be the fixture's foreground/background paint", async () => {
  const report = await captureFixture("color-noise");
  assert.ok(report.captureFailures.some((f: string) => f.startsWith("screenshot content missing:")), "purple checker pixels cannot prove the supplied gray text was painted");
});

test("T-117 rejects fully transparent PNGs that retain the real RGB glyphs", async () => {
  const report = await captureFixture("transparent");
  assert.ok(report.captureFailures.some((f: string) => f.startsWith("screenshot content missing:")), "hidden RGB glyphs are not visible paint");
});

test("T-117 composites partially transparent glyph paint over its measured CSS backgrounds", async () => {
  const report = await captureFixture("translucent");
  assert.deepEqual(report.captureFailures, []);
  assert.ok(report.screenshotContent.samples.every((sample: { cells: Array<{ alphaRange: number[] }> }) => sample.cells.every(cell => cell.alphaRange[0] === 128 && cell.alphaRange[1] === 128)));
});

test("T-117 rejects capture-time width changes even when the final width restores", async () => {
  const report = await captureFixture("transient");
  assert.equal(report.screenshotState.before.document.viewport.width, report.screenshotState.after.document.state.viewport.width);
  assert.ok(report.captureFailures.some((f: string) => f.startsWith("screenshot layout changed during capture:")));
});

test("T-117 rejects a transient text-rectangle change with an unchanged viewport and final DOM", async () => {
  const report = await captureFixture("rect-transient");
  assert.equal(report.screenshotState.before.document.viewport.width, report.screenshotState.after.document.state.viewport.width);
  assert.deepEqual(report.screenshotState.before.document.samples, report.screenshotState.after.document.state.samples);
  assert.ok(report.captureFailures.some((f: string) => f.startsWith("screenshot layout changed during capture:")), "a restored text rect does not erase a capture-time layout change");
});

for (const visibility of ["visible", "hidden"] as const) test(`T-117 photo-only equipment remains ${visibility} through committed existing semantics`, { timeout: 120000 }, async () => {
  const fixture = await temporaryPublishedSite(visibility);
  const published = path.join(out, `equipment-${visibility}`);
  let result: Awaited<ReturnType<typeof run>>;
  try { result = await run(["scripts/check-published.mjs", "--out", published, fixture.id], { ...process.env, SITECRAFT_BASE: fixture.base }); }
  finally { fixture.stop(); }
  writeFileSync(path.join(out, `equipment-${visibility}-run.json`), JSON.stringify(result, null, 2), "utf8");
  const rows = JSON.parse(readFileSync(path.join(published, "report.json"), "utf8"));
  for (const row of rows) for (const measured of [row, row.english]) {
    assert.ok(measured, "both committed languages were measured");
    assert.deepEqual(measured.captureFailures, []);
    assert.equal(measured.measurement.visibleBlocks.includes("equipment"), visibility === "visible");
    const sample = measured.screenshotContent.samples.find((sample: { block: string }) => sample.block === "equipment");
    if (visibility === "visible") {
      assert.equal(sample.slot, null, "a static title does not invent a data slot");
      assert.deepEqual(sample.boundary, { kind: "declared-part", part: "title", tag: "h2" });
      assert.equal(measured.imageCoverage.images[0].exempt, false);
      assert.ok(measured.imageCoverage.images[0].matches.some((match: { visible: boolean; decoded: boolean; section: string }) => match.visible && match.decoded && match.section === "equipment"));
    } else {
      assert.equal(sample, undefined, "explicitly hidden equipment is outside painted-content coverage");
      assert.equal(measured.imageCoverage.images[0].exempt, true);
      assert.ok(measured.imageCoverage.images[0].matches.every((match: { visible: boolean }) => !match.visible));
    }
  }
  assert.equal(result.code, 0, result.output);
});
