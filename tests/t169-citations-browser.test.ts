import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { citationClaims, citationMaterials, citationSite } from './fixtures/t169-site.ts';
import { localEndpoint } from '../scripts/local-endpoint.ts';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';

// Production chat POST -> scheduled task -> commit -> fs -> normal workspace.
// Expected claims/quotes come from the ticket's independent three-fact sample.
// The after scheduler is controlled; this is not a Next after integration claim.
const base = localEndpoint('SITECRAFT_BASE').origin;
assert.ok(process.env.SITECRAFT_DATA_ROOT, '必须显式使用本工作树测试服务的独立数据根，不回退默认目录');
const output = `artifacts/t169/browser-${Date.now()}`; await mkdir(output, { recursive: true });
const callbacks: Array<() => Promise<void>> = [];
(globalThis as any).__t169After = callbacks;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'next/server.js') return { shortCircuit: true, url: 'data:text/javascript,export function after(fn){globalThis.__t169After.push(fn)}' };
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });
let mode: 'valid' | 'forged' | 'stitched' | 'table' = 'valid';
const tableClaim = { ...citationClaims[2], claim: '纸盒 每件 CNY 12。' };
const tableSite = { ...citationSite, pages: citationSite.pages.map(page => ({ ...page,
  html: page.html.replace('<p>纸盒每件 CNY 12。</p>', '<table><thead><tr><th>品名</th><th>规格</th><th>价格</th></tr></thead><tbody><tr><td>纸盒</td><td>每件</td><td>CNY 12。</td></tr></tbody></table>') })) };
const requests: any[] = [];
const provider = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw), system = body.messages[0].content, input = body.messages[1].content;
  requests.push(body);
  let answer: any;
  if (body.tools) answer = { summary: '展示普通纸盒与经营资料。', style: 'precision', styleReason: '按已有资料集中展示。', skeletonId: 'custom', skeletonReason: '一页短站集中表达，不扩充服务流程。', pages: [{ id: 'home', title: '首页', outline: ['普通纸盒、客户、认证与收费'] }] };
  else if (system.includes('事实校对员')) {
    const data = JSON.parse(input.split('\n')[0]);
    answer = { results: data.segments.map((segment: any) => ({ id: segment.id, issues: [], citations: [...citationClaims.filter(c => segment.text.includes(c.claim)),
      ...(mode === 'table' && segment.text.includes('<TR>') && segment.text.includes('<TD>纸盒</TD>') ? [tableClaim] : [])].map(c => ({ ...c,
      quote: c.category === '客户与合作方' && (mode === 'forged' || mode === 'stitched') ? mode === 'forged' ? '长期服务30家客户。' : '已服务30家客户。取得 ISO 9001 认证。' : c.quote })) })) };
  } else if (system.includes('修正输出合同')) {
    const data = JSON.parse(input.split('\n')[0]); answer = { replacements: data.fragments.map((f: any) => ({ fragmentId: f.id, after: f.before })) };
  } else answer = mode === 'table' ? tableSite : citationSite;
  const message = body.tools ? { content: null, tool_calls: [{ type: 'function', function: { name: 'submit_page_plan', arguments: JSON.stringify(answer) } }] } : { content: JSON.stringify(answer) };
  res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ choices: [{ finish_reason: body.tools ? 'tool_calls' : 'stop', message }], usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130 } }));
});
await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
const address = provider.address(); assert.ok(address && typeof address === 'object');
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`; process.env.DEEPSEEK_API_KEY = 'local-only'; process.env.DEEPSEEK_MODEL = 'local-only'; process.env.SITE_STORE = 'fs';
const { createCodeSite, updateCodeSite, commitSiteCode, getCodeSite } = await import('../lib/code-site-store.ts');
const { POST: chat } = await import('../app/api/sites/[siteId]/chat/route.ts');
const { POST: create } = await import('../app/api/sites/route.ts');
test.after(async () => { await new Promise<void>(resolve => provider.close(() => resolve())); await writeFile(`${output}/requests.json`, JSON.stringify(requests, null, 2)); });
async function send(id: string, body: any) {
  const response = await chat(new Request(`${base}/api/sites/${id}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ siteId: id }) });
  assert.ok(response.status === 200 || response.status === 202, await response.clone().text());
  const state = await response.json();
  for (const callback of callbacks.splice(0)) await callback();
  return state;
}
async function generate() {
  const created = await create(new Request(`${base}/api/sites`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '青禾纸品' }) }));
  assert.equal(created.status, 201);
  const id = (await created.json()).id;
  let state = await send(id, { message: citationMaterials, baseRevision: 0 });
  await send(id, { action: 'select', questionId: state.alignment.questionId, questionRevision: state.alignment.questionRevision, optionId: 'precision', preferences: { style: 'precision', layout: 5, density: 6 }, baseRevision: 0 });
  state = await send(id, { action: 'state' });
  await send(id, { action: 'confirm', questionId: state.alignment.questionId, questionRevision: state.alignment.questionRevision, baseRevision: 0 });
  return (await getCodeSite(id))!;
}
async function wait(browser: Awaited<ReturnType<typeof codeCheckBrowser>>, condition: string) {
  try {
    await browser.evaluate(`new Promise((resolve,reject)=>{const end=Date.now()+30000;const observer=new MutationObserver(check);observer.observe(document,{subtree:true,childList:true,attributes:true});const timer=setInterval(check,100);function check(){try{if(${condition}){observer.disconnect();clearInterval(timer);resolve(true)}else if(Date.now()>end){observer.disconnect();clearInterval(timer);reject(new Error('等待界面条件超时'))}}catch{}}check()})`);
  } catch (error) { throw new Error(`界面等待失败：${condition}`, { cause: error }); }
}
async function settle(browser: Awaited<ReturnType<typeof codeCheckBrowser>>) {
  await browser.evaluate(`(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));await Promise.allSettled(document.getAnimations().filter(a=>a.playState==='running'&&Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))})()`);
}
async function click(browser: Awaited<ReturnType<typeof codeCheckBrowser>>, selector: string) {
  // The 768 drawer exits over 240ms. DOM state alone does not prove that a
  // pointer can reach the preview; wait for its actual finite animations.
  await settle(browser);
  const point = await browser.evaluate<any>(`(async()=>{document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest'});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const node=document.querySelector(${JSON.stringify(selector)}),r=node.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await browser.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
  await browser.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
  await browser.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
}
let generated: Awaited<ReturnType<typeof generate>>;
test('本地替身经真实生成入口保存至少三条出处，三档工作台显示原句且发布页与独立预览无标记', { timeout: 180000 }, async () => {
  const health = await (await fetch(`${base}/api/health`)).json(); assert.equal(health.testIdentity.cwd, process.cwd());
  generated = await generate(); assert.equal(generated.run?.status, 'complete', generated.run?.step);
  const version = generated.versions[0]; assert.ok(version.checks.factCitations?.complete);
  assert.deepEqual(version.checks.factCitations.entries.map(c => c.quote).sort(), citationClaims.map(c => c.quote).sort());
  assert.equal(generated.runs.flatMap(r => r.modelCalls ?? []).filter(c => c.purpose === 'facts').length, 1, '不新增核对调用');
  assert.deepEqual(version.checks.viewports.map(v => v.width), [375, 768, 1440]);
  const { css: _cleanedCss, ...html } = version.code, { css: _fixtureCss, ...expectedHtml } = citationSite;
  assert.deepEqual(html, expectedHtml, '不往站点 HTML 写标记；既有 CSS 序列化允许');
  await writeFile(`${output}/code-site.json`, JSON.stringify(generated, null, 2));
  for (const width of [1440, 768, 375]) {
    const browser = await codeCheckBrowser();
    try {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      await browser.send('Page.navigate', { url: `${base}/workspace?site=${generated.siteId}` });
      await wait(browser, `document.querySelector('[data-testid="fact-citation-status"]')?.textContent.includes('3 条资料出处')`);
      if (width < 1100) await click(browser, '[role="tab"]:nth-child(2)');
      await click(browser, `[aria-label="预览宽度"] button:nth-child(${width === 1440 ? 1 : width === 768 ? 2 : 3})`);
      await wait(browser, `document.querySelector('[data-testid="code-preview"]')?.contentWindow.innerWidth===${width} && document.querySelectorAll('[data-testid="fact-citation-marker"]').length===3`);
      await browser.evaluate(`document.querySelector('[data-testid="code-preview"]').contentDocument.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))`);
      const before = await browser.evaluate(`document.querySelector('[data-testid="code-preview"]').contentDocument.body.innerHTML`);
      assert.equal(before, citationSite.header + citationSite.pages[0].html + citationSite.footer, '首次展示也不能向 iframe 的原始正文插入任何标记');
      for (let i = 0; i < citationClaims.length; i++) {
        await click(browser, `[data-testid="fact-citation-marker"][data-claim="${citationClaims[i].claim}"]`);
        await browser.evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
        await wait(browser, `document.querySelector('[data-testid="fact-citation-source"] blockquote')?.textContent===${JSON.stringify(citationClaims[i].quote)}`);
        await settle(browser);
        const geometry = await browser.evaluate<any>(`(()=>{const p=document.querySelector('[data-testid="fact-citation-source"]').getBoundingClientRect();return{left:p.left,right:p.right,top:p.top,bottom:p.bottom,overflow:document.documentElement.scrollWidth>innerWidth}})()`);
        assert.ok(geometry.left >= 0 && geometry.right <= width && geometry.top >= 0 && geometry.bottom <= 1000 && !geometry.overflow, JSON.stringify(geometry));
        if (i === 0) { const shot = await browser.send<any>('Page.captureScreenshot', { format: 'png' }); await writeFile(`${output}/workspace-${width}.png`, Buffer.from(shot.data, 'base64')); }
        await click(browser, '[aria-label="关闭资料原句"]');
      }
      assert.equal(await browser.evaluate(`document.querySelector('[data-testid="code-preview"]').contentDocument.body.innerHTML`), before, '展示操作不改 iframe DOM');
      if (width === 1440) {
        await browser.evaluate(`(()=>{const d=document.querySelector('[data-testid="code-preview"]').contentDocument;d.querySelector('section p').textContent='文字快照已变化';d.dispatchEvent(new Event('scroll'))})()`);
        await wait(browser, `document.querySelectorAll('[data-testid="fact-citation-marker"]').length===2`);
        await browser.evaluate(`(()=>{const d=document.querySelector('[data-testid="code-preview"]').contentDocument;d.querySelector('section p').textContent=${JSON.stringify(citationClaims[0].claim)};d.dispatchEvent(new Event('scroll'))})()`);
        await wait(browser, `document.querySelectorAll('[data-testid="fact-citation-marker"]').length===3`);
      }
      await browser.send('Page.reload'); await wait(browser, `document.querySelector('[data-testid="fact-citation-status"]')?.textContent.includes('3 条资料出处')`);
      await browser.send('Page.navigate', { url: `${base}/published/${generated.siteId}` });
      await wait(browser, `document.querySelector('main h1')`);
      assert.equal(await browser.evaluate(`document.querySelectorAll('[data-testid="fact-citation-marker"],.code-fact-source').length`), 0);
    } finally { await browser.close(); }
  }
  const preview = await (await fetch(`${base}/api/sites/${generated.siteId}/code-preview?version=${version.id}`)).text();
  assert.doesNotMatch(preview, /fact-citation|code-fact-marker|资料原句/);
});

test('编造与拼接引文进入两轮修正，耗尽后不保存版本', { timeout: 180000 }, async () => {
  for (const invalid of ['forged', 'stitched'] as const) {
    mode = invalid;
    try {
      const site = await generate(); assert.equal(site.run?.status, 'error'); assert.equal(site.versions.length, 0);
      assert.equal(site.run?.attempts.length, 3, '初稿加两轮修正');
      assert.ok(site.run!.attempts.every(a => a.checks.issues.some(i => i.includes('资料出处无依据'))));
      await writeFile(`${output}/${invalid}.json`, JSON.stringify(site, null, 2));
    } finally { mode = 'valid'; }
  }
});

test('表格中的跨单元格价格出处经真实提交入口存版并准确绑定行', { timeout: 180000 }, async () => {
  mode = 'table';
  try {
    const site = await generate(); assert.equal(site.run?.status, 'complete', site.run?.step);
    const version = site.versions[0]; assert.equal(version.checks.passed, true);
    assert.deepEqual(version.checks.viewports.map(v => v.width), [375, 768, 1440]);
    const price = version.checks.factCitations!.entries.find(c => c.category === '价格与收费')!;
    assert.equal(price.claim, '纸盒 每件 CNY 12。'); assert.equal(price.quote, '纸盒每件 CNY 12。');
    assert.deepEqual(price.targets, [{ pageId: 'home', root: 'main', path: [4, 1, 1, 0], text: '纸盒每件CNY 12。' }]);
    await writeFile(`${output}/table.json`, JSON.stringify(site, null, 2));
    for (const width of [1440, 768, 375]) {
      const browser = await codeCheckBrowser();
      try {
        await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
        await browser.send('Page.navigate', { url: `${base}/workspace?site=${site.siteId}` });
        await wait(browser, `document.querySelector('[data-testid="fact-citation-status"]')?.textContent.includes('3 条资料出处')`);
        if (width < 1100) await click(browser, '[role="tab"]:nth-child(2)');
        await click(browser, `[aria-label="预览宽度"] button:nth-child(${width === 1440 ? 1 : width === 768 ? 2 : 3})`);
        await wait(browser, `document.querySelector('[data-testid="code-preview"]')?.contentWindow.innerWidth===${width} && document.querySelector('[data-testid="fact-citation-marker"][data-claim="纸盒 每件 CNY 12。"]')`);
        await settle(browser);
        const priceGeometry = await browser.evaluate<any>(`(()=>{const frame=document.querySelector('[data-testid="code-preview"]'),doc=frame.contentDocument,range=doc.createRange();range.selectNodeContents(doc.querySelector('tbody td:last-child'));const f=frame.getBoundingClientRect(),p=range.getBoundingClientRect(),m=document.querySelector('[data-testid="fact-citation-marker"][data-claim="纸盒 每件 CNY 12。"]').getBoundingClientRect();return{priceRight:f.x+p.right*f.width/frame.offsetWidth,markerLeft:m.left}})()`);
        await writeFile(`${output}/table-geometry-${width}.json`, JSON.stringify(priceGeometry, null, 2));
        assert.ok(priceGeometry.markerLeft >= priceGeometry.priceRight + 2, '资料出处编号不能盖住表格价格：' + JSON.stringify(priceGeometry));
        await click(browser, '[data-testid="fact-citation-marker"][data-claim="纸盒 每件 CNY 12。"]');
        await wait(browser, `document.querySelector('[data-testid="fact-citation-source"] blockquote')?.textContent==='纸盒每件 CNY 12。'`);
        await settle(browser);
        if (width < 1100) assert.equal(await browser.evaluate(`getComputedStyle(document.querySelector('.builder-chat')).visibility`), 'hidden', '截图须在抽屉实际退出后取得');
        const shot = await browser.send<any>('Page.captureScreenshot', { format: 'png' });
        await writeFile(`${output}/table-workspace-${width}.png`, Buffer.from(shot.data, 'base64'));
      } finally { await browser.close(); }
    }
  } finally { mode = 'valid'; }
});

test('CSS复用保留出处并重绑路径，资料改一字重核；局部改后保留外部出处且新声明准确定位', { timeout: 180000 }, async () => {
  generated ??= await generate();
  const first = generated.versions[0], id = generated.siteId;
  const second = await commitSiteCode({ siteId: id, baseRevision: 1, code: { ...first.code, css: first.code.css + 'footer{letter-spacing:.01em}' }, author: 'user', summary: '字距', request: '' });
  assert.equal(second.status, 'applied'); if (second.status !== 'applied') throw new Error('未存版');
  assert.equal(second.version.checks.factSegments?.audited, 0); assert.equal(second.version.checks.factCitations?.entries.length, 3);
  const { applyLocalEdit } = await import('../lib/code-site-local-edit.ts');
  const target = { kind: 'dom' as const, versionId: second.version.id, pageId: 'home', path: [2], text: '客户已服务30家客户。', label: '客户' };
  const candidate = await applyLocalEdit(second.version.code, target, '<section><h2>客户</h2><div><p>已服务30家客户。</p></div></section>', '');
  const third = await commitSiteCode({ siteId: id, baseRevision: 2, code: candidate, selectedTarget: target, author: 'assistant', summary: '局部排版', request: '' });
  assert.equal(third.status, 'applied'); if (third.status !== 'applied') throw new Error('局部未存版');
  assert.equal(third.version.checks.factCitations?.entries.length, 3);
  const customer = third.version.checks.factCitations!.entries.find(c => c.category === '客户与合作方')!;
  assert.equal(customer.targets?.[0].root, 'main'); assert.deepEqual(customer.targets?.[0].path, [2, 1, 0]); assert.equal(customer.targets?.[0].text, '已服务30家客户。');
  assert.equal(requests.at(-1).thinking.type, 'disabled');
  assert.ok(!JSON.parse(requests.at(-1).messages[1].content.split('\n')[0]).segments.some((s: any) => s.text.includes('取得 ISO')), '局部模型只见新段落');
  const changedId = `t169-source-${crypto.randomUUID()}`;
  await createCodeSite(changedId, '青禾纸品', 'source-test');
  await updateCodeSite(changedId, () => ({ materials: citationMaterials }));
  const source = await commitSiteCode({ siteId: changedId, baseRevision: 0, code: citationSite, author: 'user', summary: '资料核对', request: '' });
  assert.equal(source.status, 'applied');
  await updateCodeSite(changedId, () => ({ materials: citationMaterials.replace('已服务30家', '曾服务30家') }));
  const fourth = await commitSiteCode({ siteId: changedId, baseRevision: 1, code: citationSite, author: 'user', summary: '资料变更', request: '' });
  assert.equal(fourth.status, 'rejected'); if (fourth.status !== 'rejected') throw new Error('旧出处不应沿用');
  assert.equal(fourth.checks.factSegments?.reused, 0); assert.match(fourth.checks.issues.join('\n'), /资料出处无依据/);
});

test('旧版本显示未记录而非零条；中英切换不泄漏标记，恢复沿用目标版本出处', { timeout: 180000 }, async () => {
  generated ??= await generate();
  const id = generated.siteId, current = (await getCodeSite(id))!.versions.at(-1)!;
  const restore = await commitSiteCode({ siteId: id, baseRevision: current.revision, restoreVersionId: generated.versions[0].id, author: 'user', summary: '恢复首版', request: '' });
  assert.equal(restore.status, 'applied'); if (restore.status !== 'applied') throw new Error('恢复失败');
  assert.equal(restore.version.checks.factReviewFrom?.versionId, generated.versions[0].id);
  assert.deepEqual(restore.version.checks.factCitations, generated.versions[0].checks.factCitations);
  const oldId = `t169-old-${crypto.randomUUID()}`;
  const old = await commitSiteCode({ siteId: oldId, legacyImport: { kind: 'convert', name: '青禾纸品', source: { revision: 1, updatedAt: new Date().toISOString() }, materials: citationMaterials, code: citationSite, exportIssues: [] } });
  assert.equal(old.status, 'applied');
  const browser = await codeCheckBrowser();
  try {
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await browser.send('Page.navigate', { url: `${base}/workspace?site=${id}` });
    await wait(browser, `document.querySelectorAll('[data-testid="fact-citation-marker"]').length===3`);
    await click(browser, '[data-testid="fact-citation-marker"]'); await wait(browser, `document.querySelector('[data-testid="fact-citation-source"]')`);
    await browser.send('Page.navigate', { url: `${base}/workspace?site=${oldId}` });
    await wait(browser, `document.querySelector('[data-testid="fact-citation-status"]') && !document.querySelector('.code-preview-loading')`);
    const oldStatus = await browser.evaluate<string>(`document.querySelector('[data-testid="fact-citation-status"]').textContent`);
    assert.match(oldStatus, /未记录出处/);
    assert.doesNotMatch(oldStatus, /0 条/);
    assert.equal(await browser.evaluate(`document.querySelectorAll('[data-testid="fact-citation-marker"]').length`), 0);
  } finally { await browser.close(); }
  const translations: Record<string, string> = { '普通纸盒，按资料说明': 'Ordinary paper boxes, as described', '青禾纸品提供普通纸盒。': '青禾纸品 supplies ordinary paper boxes.', '已服务30家客户。': 'We have served 30 customers.', '取得 ISO 9001 认证。': 'ISO 9001 certified.', '纸盒每件 CNY 12。': 'Paper boxes cost CNY 12 each.', '普通纸盒': 'Ordinary paper boxes', '客户': 'Customers', '认证': 'Certification', '收费': 'Prices' };
  const translate = (html: string) => html.replace(/>[^<>]+</g, text => `>${Object.entries(translations).reduce((value, [from, to]) => value.replaceAll(from, to), text.slice(1, -1))}<`);
  const englishCode = { ...restore.version.code, header: translate(restore.version.code.header), footer: translate(restore.version.code.footer), pages: restore.version.code.pages.map(page => ({ ...page, title: 'Home', html: translate(page.html) })) };
  const translated = await commitSiteCode({ siteId: id, baseRevision: restore.version.revision, englishCode, author: 'assistant', summary: '英文版', request: '' });
  assert.equal(translated.status, 'applied', translated.status === 'rejected' ? translated.checks.issues.join('\n') : '');
  const englishBrowser = await codeCheckBrowser();
  try {
    const browser = englishBrowser;
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await browser.send('Page.navigate', { url: `${base}/workspace?site=${id}` });
    await wait(browser, `document.querySelectorAll('[data-testid="fact-citation-marker"]').length===3`);
    await click(browser, '[data-testid="preview-en"]');
    await wait(browser, `document.querySelector('[data-testid="code-preview"]')?.contentDocument?.documentElement.lang==='en'`);
    assert.equal(await browser.evaluate(`document.querySelectorAll('[data-testid="fact-citation-marker"],[data-testid="fact-citation-source"],[data-testid="fact-citation-status"]').length`), 0);
    await click(browser, '[data-testid="preview-zh"]'); await wait(browser, `document.querySelectorAll('[data-testid="fact-citation-marker"]').length===3`);
    await browser.send('Page.navigate', { url: `${base}/published/${id}/en` }); await wait(browser, `document.documentElement.lang==='en'&&document.querySelector('main h1')`);
    assert.equal(await browser.evaluate(`document.querySelectorAll('.code-fact-marker,.code-fact-source').length`), 0);
  } finally { await englishBrowser.close(); }
});
