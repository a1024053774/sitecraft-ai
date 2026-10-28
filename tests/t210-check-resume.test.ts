import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
const afterTasks: Array<() => Promise<void>> = [];
(globalThis as any).__t210After = afterTasks;
registerHooks({ resolve(s, context, next) {
  if (s === 'next/server.js') return { shortCircuit: true, url: 'data:text/javascript,export function after(fn){globalThis.__t210After.push(fn)}' };
  if (s.startsWith('@/')) return next(pathToFileURL(path.join(process.cwd(), s.slice(2) + '.ts')).href, context);
  return next(s, context);
} });
const { createCodeSite, getCodeSite, updateCodeSite, commitSiteCode } = await import('../lib/code-site-store.ts');
const { getOrCreateConversation } = await import('../lib/conversation-store.ts');
const { handleCodeChat } = await import('../lib/code-site-workflow.ts');
const name = '杉雨设计研习社', materials = `机构名：${name}\n提供成人数字设计课程。`;
const candidate = { header: `<header>${name}</header>`, footer: `<footer>${name}</footer>`,
  css: 'body{margin:0;padding:24px;background:white;color:#111;font:18px/1.8 sans-serif}section{padding:24px 0}',
  pages: [{ id: 'home', title: '首页', html: '<main><h1>数字设计课程</h1><section><h2>课程介绍</h2><p>提供成人数字设计课程。</p></section></main>' }] };
let failAudit = true;
const purposes: string[] = [];
const provider = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw), fn = body.tools?.[0]?.function.name;
  let answer: unknown, purpose: string;
  if (fn === 'submit_page_plan') {
    purpose = 'plan'; answer = { summary: '首页展示现有课程', style: 'precision', styleReason: '课程说明', skeletonId: 'custom', skeletonReason: '单页展示现有课程', pages: [{ id: 'home', title: '首页', outline: ['课程介绍'] }] };
  } else if (fn === 'submit_local_edit') {
    purpose = 'local-edit'; answer = { html: '<section><h1>数字设计课程</h1><p>提供成人数字设计课程。</p></section>', css: '', cannotEdit: '' };
  } else if (body.messages[0].content.includes('事实校对员')) {
    purpose = 'facts';
    const input = JSON.parse(body.messages[1].content.split('\n')[0]);
    answer = Object.fromEntries(input.segments.map((s: any) => [s.id, { issues: [], noFacts: true, factCategories: [], citations: [] }]));
  } else { purpose = 'write'; answer = candidate; }
  purposes.push(purpose);
  const message = fn ? { content: null, tool_calls: [{ type: 'function', function: { name: fn, arguments: purpose === 'facts' && failAudit ? '{' : JSON.stringify(answer) } }] } : { content: purpose === 'facts' && failAudit ? '{' : JSON.stringify(answer) };
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ choices: [{ finish_reason: fn ? 'tool_calls' : 'stop', message }], usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 } }));
});
await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
const addr = provider.address(); assert.ok(addr && typeof addr === 'object');
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${addr.port}`;
process.env.DEEPSEEK_API_KEY = 't210-fixture'; process.env.DEEPSEEK_MODEL = 'fixture';
test.after(() => new Promise<void>(resolve => provider.close(() => resolve())));
const output = `artifacts/t210/resume-${Date.now()}`; await mkdir(output, { recursive: true });
async function post(id: string, body: unknown, settle = true) {
  const response = await handleCodeChat(id, body), value = await response.json();
  if (settle) for (const fn of afterTasks.splice(0)) await fn();
  return { status: response.status, value };
}
async function failed() {
  failAudit = true;
  const id = `t210-${crypto.randomUUID()}`, c = await getOrCreateConversation(id, id);
  await createCodeSite(id, name, c.conversationId);
  let state = await post(id, { message: materials });
  await post(id, { action: 'select', questionId: state.value.alignment.questionId, questionRevision: state.value.alignment.questionRevision, optionId: 'precision' });
  state = await post(id, { action: 'state' });
  await post(id, { action: 'confirm', questionId: state.value.alignment.questionId, questionRevision: state.value.alignment.questionRevision });
  return (await getCodeSite(id))!;
}
test('save candidate before audit; explicit continuation checks it without another write', async () => {
  const site = await failed();
  assert.equal(site.run!.status, 'error'); assert.equal(site.versions.length, 0);
  assert.deepEqual((site.run as any).checkpoint.code, candidate);
  const before = purposes.length, writes = purposes.filter(p => p === 'write').length;
  const state = await post(site.siteId, { action: 'state' });
  assert.equal(state.value.continuation.runId, site.run!.id);
  assert.equal(purposes.length, before, 'refresh cannot start the model');
  failAudit = false;
  const resumed = await post(site.siteId, { action: 'resume', resumeRunId: site.run!.id, baseRevision: 0 }, false);
  assert.equal(resumed.status, 202);
  assert.equal((await post(site.siteId, { action: 'resume', resumeRunId: site.run!.id, baseRevision: 0 }, false)).status, 409);
  for (const fn of afterTasks.splice(0)) await fn();
  const final = (await getCodeSite(site.siteId))!;
  assert.equal(final.run!.status, 'complete', final.run!.step);
  assert.equal(final.versions.length, 1);
  assert.equal(final.versions[0].code.header, candidate.header); assert.equal(final.versions[0].code.footer, candidate.footer);
  assert.deepEqual(final.versions[0].code.pages, candidate.pages);
  assert.equal(final.versions[0].code.css, 'body{margin: 0px; padding: 24px; background: white; color: rgb(17, 17, 17); font: 18px / 1.8 sans-serif;}\nsection{padding: 24px 0px;}');
  assert.equal(purposes.filter(p => p === 'write').length, writes);
  assert.deepEqual(purposes.slice(before), ['facts']);
  assert.equal(final.runs.find(r => r.id === site.run!.id)!.status, 'error');
  assert.equal((final.run as any).resumedFrom, site.run!.id);
  await writeFile(`${output}/roundtrip.json`, JSON.stringify({ before: site, after: final, purposes }, null, 2));
});
test('new source requires a fresh audit and cannot borrow old receipts', async () => {
  const site = await failed();
  await updateCodeSite(site.siteId, current => ({ materials: current.materials + '\n新资料：课程仅作线下展示。', factSources: [...current.factSources!, { type: 'message', messageIndex: 2, text: '新资料：课程仅作线下展示。' }] }));
  failAudit = false;
  const before = purposes.length;
  assert.equal((await post(site.siteId, { action: 'resume', resumeRunId: site.run!.id, baseRevision: 0 })).status, 202);
  const final = (await getCodeSite(site.siteId))!;
  assert.equal(final.run!.status, 'complete', final.run!.step);
  assert.equal(final.versions[0].checks.factSegments!.reused, 0);
  assert.ok(final.versions[0].checks.factSegments!.audited > 0);
  assert.deepEqual(purposes.slice(before), ['facts']);
});
test('changed plan cannot authorize a stale saved candidate', async () => {
  const site = await failed(), before = purposes.length;
  await updateCodeSite(site.siteId, current => ({ plan: { ...current.plan!, summary: '用户已改变方案', pages: [...current.plan!.pages, { id: 'courses', title: '课程体系', outline: '独立课程页' }] } }));
  const response = await post(site.siteId, { action: 'resume', resumeRunId: site.run!.id, baseRevision: 0 });
  assert.equal(response.status, 409); assert.equal(purposes.length, before);
  assert.equal((await getCodeSite(site.siteId))!.versions.length, 0);
});

for (const batch of [false, true]) test(`missing global identity during ${batch ? 'batch' : 'single-block'} editing stops without a content repair`, async () => {
  failAudit = false;
  const id = `t210-${crypto.randomUUID()}`, c = await getOrCreateConversation(id, id);
  await createCodeSite(id, name, c.conversationId);
  await post(id, { message: materials });
  await updateCodeSite(id, () => ({ plan: { style: 'precision', summary: '展示成人数字设计课程', styleReason: '课程说明', pages: [{ id: 'home', title: '首页', outline: '课程介绍' }] } }));
  const original = { ...candidate, header: '', footer: '', pages: [{ id: 'home', title: '首页', html: `<main><section><h1>${name}</h1><p>提供成人数字设计课程。</p></section></main>` }] };
  const saved = await commitSiteCode({ siteId: id, baseRevision: 0, code: original, author: 'user', summary: '已确认资料', request: '' });
  assert.equal(saved.status, 'applied'); if (saved.status !== 'applied') throw Error('initial candidate missing');
  await post(id, { action: 'cancel' });
  const target = { kind: 'dom', pageId: 'home', versionId: saved.version.id, path: [0], text: `${name}提供成人数字设计课程。`, label: name };
  const before = purposes.length;
  const response = await post(id, { message: '标题使用课程名称，保留其他内容。', baseRevision: 1,
    ...(batch ? { annotationBatch: [{ draftId: 'identity-check', target, revision: 1, body: '标题使用课程名称，保留其他内容。' }] } : { selectedTarget: target }) });
  assert.equal(response.status, 202);
  const after = (await getCodeSite(id))!;
  assert.equal(after.run!.status, 'error'); assert.match(after.run!.step, /完整主体名称/);
  assert.deepEqual(purposes.slice(before), ['local-edit'], 'A missing global identity cannot authorize a local content repair');
  assert.equal(after.versions.length, 1); assert.deepEqual(after.versions[0].code, saved.version.code);
  await writeFile(`${output}/identity-${batch ? 'batch' : 'single'}.json`, JSON.stringify(after, null, 2));
});

// Browser clicks use the production chat workflow and controlled after callbacks;
// the ordinary dev server supplies the workspace and reads the same data root.
// This is not a claim that the bridge itself tests Next's after integration.
const { codeCheckBrowser } = await import('../lib/code-site-browser.ts');
const base = process.env.SITECRAFT_BASE!;
const pending: Promise<void>[] = [], bridgeErrors: string[] = [];
const bridge = createServer(async (req, res) => {
  res.setHeader('access-control-allow-origin', base);
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader('access-control-allow-methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const match = req.url?.match(/^\/api\/sites\/([a-z0-9_-]+)\/chat$/i);
  if (!match || req.method !== 'POST') { res.writeHead(404); res.end(); return; }
  try {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const result = await post(match[1], JSON.parse(raw), false);
    res.writeHead(result.status, { 'content-type': 'application/json' }); res.end(JSON.stringify(result.value));
    for (const fn of afterTasks.splice(0)) pending.push(fn().catch(error => { bridgeErrors.push(String(error)); }));
  } catch (error) { bridgeErrors.push(String(error)); res.writeHead(500); res.end('{}'); }
});
await new Promise<void>(resolve => bridge.listen(0, '127.0.0.1', resolve));
const bridgeAddr = bridge.address(); assert.ok(bridgeAddr && typeof bridgeAddr === 'object');
const workflowBase = `http://127.0.0.1:${bridgeAddr.port}`;
test.after(async () => { await Promise.all(pending); await new Promise<void>(resolve => bridge.close(() => resolve())); assert.deepEqual(bridgeErrors, []); });
async function ui(id: string, width: number) {
  const browser = await codeCheckBrowser();
  const wait = async (selector: string) => browser.evaluate(`new Promise((resolve,reject)=>{
    const check=()=>{if(document.querySelector(${JSON.stringify(selector)})){clearTimeout(timer);observer.disconnect();resolve(true)}};
    const observer=new MutationObserver(check),timer=setTimeout(()=>{observer.disconnect();reject(new Error('Missing '+${JSON.stringify(selector)}))},30000);
    observer.observe(document,{subtree:true,childList:true,attributes:true});check();})`, 35000);
  const click = async (selector: string) => {
    const point = await browser.evaluate<{x:number;y:number}>(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)throw new Error('Missing control');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    assert.equal(await browser.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),hit=document.elementFromPoint(${point.x},${point.y});return hit===e||e.contains(hit)})()`), true);
    await browser.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
    await browser.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
  };
  const shot = async (label: string) => {
    await browser.evaluate('document.fonts.ready');
    const frame = await browser.send<{data:string}>('Page.captureScreenshot', { format: 'png' });
    await writeFile(`${output}/${label}-${width}.png`, Buffer.from(frame.data, 'base64'));
  };
  try {
    await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `const originalFetch=window.fetch;window.fetch=function(input,init){const u=new URL(String(input),location.href);return originalFetch.call(this,u.origin===${JSON.stringify(base)}&&u.pathname.startsWith('/api/sites/')&&u.pathname.endsWith('/chat')?${JSON.stringify(workflowBase)}+u.pathname:input,init)}` });
    await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await browser.loadPage('Page.navigate', { url: `${base}/workspace?site=${id}` });
    await wait('[data-testid="code-workspace"]');
    return { browser, wait, click, shot };
  } catch (error) { await browser.close(); throw error; }
}
for (const width of [1440, 768, 375]) {
  test(`subject clarification ${width}: type a name and continue without model calls`, { timeout: 120000 }, async () => {
    const id = `t210-${crypto.randomUUID()}`, c = await getOrCreateConversation(id, id);
    await createCodeSite(id, '未命名站点', c.conversationId);
    await post(id, { message: '提供成人视觉设计课程。' });
    const before = purposes.length, view = await ui(id, width);
    try {
      await view.wait('[data-testid="code-subject-question"]');
      await view.click('[data-testid="code-subject-question"] input');
      await view.browser.send('Input.insertText', { text: '闻溪视觉研习社' });
      await view.shot('subject');
      await view.click('[data-testid="code-subject-question"] button');
      await view.wait('[data-testid="code-style-question"]');
      assert.equal((await getCodeSite(id))!.subject!.name, '闻溪视觉研习社');
      assert.equal(purposes.length, before);
    } finally { await view.browser.close(); }
  });
  test(`resume ${width}: native click resumes checks and refresh keeps the saved version`, { timeout: 120000 }, async () => {
    const site = await failed(), beforeWrites = purposes.filter(p => p === 'write').length;
    const view = await ui(site.siteId, width); failAudit = false;
    try {
      await view.wait('[data-testid="code-resume-check"]');
      await view.click('[data-testid="code-resume-check"]');
      await view.wait('[data-testid="code-check-receipt"]');
      assert.equal((await getCodeSite(site.siteId))!.versions.length, 1);
      assert.equal(purposes.filter(p => p === 'write').length, beforeWrites);
      await view.browser.loadPage('Page.reload');
      await view.wait('[data-testid="code-check-receipt"]');
      assert.equal(await view.browser.evaluate('!!document.querySelector("[data-testid=code-resume-check]")'), false);
      if (width < 1100) await view.click('[role="tab"]:nth-child(2)');
      await view.wait('[data-testid="code-preview"]');
      await view.browser.evaluate(`new Promise((resolve,reject)=>{const f=document.querySelector('[data-testid="code-preview"]');const check=()=>{if(f.contentDocument?.querySelector('main h1'))resolve(true)};f.addEventListener('load',check,{once:true});setTimeout(()=>reject(new Error('Preview missing')),10000);check()})`);
      assert.equal(await view.browser.evaluate(`document.querySelector('[data-testid="code-preview"]').contentDocument.querySelector('h1').textContent`), '数字设计课程');
      await view.shot('resumed');
    } finally { await view.browser.close(); }
  });
}
