// Isolated UI regression using persisted conversation fixtures, not live-model E2E.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {createConversation, updateConversationAlignment} from '../lib/conversation-store.ts';
import {applyAlignmentAction,disabledAlignment} from '../lib/alignment.ts';
const BASE='http://127.0.0.1:3034', CDP_PORT='9348';
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', PROFILE='/tmp/sitecraft-published-check';
const out=process.argv[2] || `artifacts/t019-ui-${Date.now()}`;
fs.mkdirSync(out,{recursive:true});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Cdp {
  constructor(url) { this.url = url; this.nextId = 1; this.pending = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
    this.ws.addEventListener("close", () => {
      for (const waiter of this.pending.values()) waiter.reject(new Error("DevTools connection closed"));
      this.pending.clear();
    });
    this.ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      const waiter = msg.id && this.pending.get(msg.id);
      if (!waiter) return;
      this.pending.delete(msg.id);
      if (msg.error) waiter.reject(new Error(JSON.stringify(msg.error)));
      else waiter.resolve(msg.result);
    });
  }
  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, 60000);
      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (error) => { clearTimeout(timer); reject(error); },
      });
    });
  }
  async evaluate(expression, sessionId) {
    const { result, exceptionDetails } = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
    return result.value;
  }
}

async function connectChrome() {
  const versionUrl = `http://127.0.0.1:${CDP_PORT}/json/version`;
  let version = await fetch(versionUrl).then((r) => r.json()).catch(() => null);
  if (!version) {
    spawn(CHROME, [`--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE}`, "--headless=new", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore", detached: true }).unref();
    for (let i = 0; i < 60 && !version; i++) {
      await sleep(250);
      version = await fetch(versionUrl).then((r) => r.json()).catch(() => null);
    }
  }
  if (!version?.webSocketDebuggerUrl) throw new Error("Chrome DevTools endpoint not available");
  const browser = new Cdp(version.webSocketDebuggerUrl);
  await browser.connect();
  return browser;
}

async function openPage(browser) {
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true });
  await browser.send("Page.enable", {}, sessionId);
  await browser.send("Runtime.enable", {}, sessionId);
  return { targetId, sessionId };
}

async function waitFor(check, what, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await check();
    if (value) return value;
    await sleep(250);
  }
  throw new Error(`timeout waiting for ${what}`);
}

async function attachPreviewFrame(browser) {
  const target = await waitFor(async () => {
    const { targetInfos } = await browser.send("Target.getTargets");
    return targetInfos.find((t) => t.type === "iframe" && t.url.includes("/api/templates/"));
  }, "preview iframe target");
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId: target.targetId, flatten: true });
  await browser.send("Runtime.enable", {}, sessionId);
  return sessionId;
}


const report={kind:'isolated persisted-card UI regression; no model generation',cases:[]};
const browser=await connectChrome();
try {
for(const count of [1,2]) {
 const site=await fetch(BASE+'/api/sites',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'T019 UI fixture',templateId:'screwfast',locales:['zh','en']})}).then(r=>r.json());
 const conversation=await createConversation(site.id);
 const questions=Array.from({length:count},(_,i)=>({questionId:`q-${i}`,field:i===0?'colorSet':'pages',prompt:i===0?'色彩集':'页面范围',allowOther:true,options:[{id:'a',label:i===0?'石墨工坊':'首页和产品',description:'用于工业询盘',recommended:true},{id:'b',label:i===0?'工程暖橙':'单页',description:'另一种选择'}]}));
 const start=applyAlignmentAction(disabledAlignment(),{action:'start',pendingRequest:{message:'UI fixture',baseRevision:1,selectedTarget:null},startQuestion:{questionId:'card',questionRevision:1,kind:'clarify',prompt:'确认建站方向',options:[],allowOther:false,questions}});
 assert.ok(start.ok);
 await updateConversationAlignment(site.id,conversation.conversationId,record=>({...record,alignment:{...start.snapshot,pendingRequest:null}}));
 const {targetId,sessionId}=await openPage(browser);
 try {
  await browser.send('Page.navigate',{url:BASE},sessionId);
  await waitFor(()=>browser.evaluate('location.origin === '+JSON.stringify(BASE),sessionId),'origin');
  await browser.evaluate(`localStorage.setItem(${JSON.stringify('sitecraft-conversation:'+site.id)},${JSON.stringify(conversation.conversationId)})`,sessionId);
  await browser.send('Page.navigate',{url:BASE+'/workspace?site='+site.id},sessionId);
  await waitFor(()=>browser.evaluate(`!![...document.querySelectorAll('button')].find(x=>x.textContent==='提交全部答案')`,sessionId),'card');
  assert.ok(await browser.evaluate(`document.querySelector('.alignment-panel').innerText.includes('推荐')`,sessionId));
  await browser.evaluate(`document.querySelector('input[name="q-0"]').click()`,sessionId);
  await waitFor(()=>browser.evaluate(`!!document.querySelector('[aria-label="色彩集：其他说明"]')`,sessionId),'note');
  await browser.evaluate(`(()=>{const el=document.querySelector('[aria-label="色彩集：其他说明"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'松石');el.dispatchEvent(new Event('input',{bubbles:true}));})()`,sessionId);
  if(count===2) await browser.evaluate(`[...document.querySelectorAll('.alignment-card')].find(x=>x.textContent.includes('首页和产品')).click()`,sessionId);
  await waitFor(()=>browser.evaluate(`![...document.querySelectorAll('button')].find(x=>x.textContent==='提交全部答案').disabled`,sessionId),'can submit');
  await browser.evaluate(`[...document.querySelectorAll('button')].find(x=>x.textContent==='提交全部答案').click()`,sessionId);
  await waitFor(()=>browser.evaluate(`!document.querySelector('.busy-message') && document.querySelector('.alignment-summary')?.textContent.includes('已保存')`,sessionId),'saved');
  await browser.send('Page.reload',{},sessionId);
  await waitFor(()=>browser.evaluate(`document.querySelector('[aria-label="色彩集：其他说明"]')?.value === '松石' && document.querySelector('input[name="q-0"]').checked`,sessionId),'restored selection and note');
  const state=await fetch(BASE+`/api/sites/${site.id}/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'state',conversationId:conversation.conversationId})}).then(r=>r.text());
  for(const width of [1440,768,375]) {
    await browser.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===375},sessionId);
    if(width===375) await browser.evaluate(`[...document.querySelectorAll('.builder-mobile-tabs button')].find(x=>x.textContent.includes('对话'))?.click()`,sessionId);
    await sleep(500);
    const shot=await browser.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true},sessionId);
    fs.writeFileSync(`${out}/${count}-question-${width}.png`,Buffer.from(shot.data,'base64'));
  }
  report.cases.push({count,siteId:site.id,conversationId:conversation.conversationId,state,result:'PASS'});
 } finally {await browser.send('Target.closeTarget',{targetId}).catch(()=>{});}
}
report.result='PASS';
} catch(e){report.result='FAIL';report.error=String(e);process.exitCode=1;}
finally {fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));browser.ws.close();}
console.log(JSON.stringify({result:report.result,error:report.error,out}));
