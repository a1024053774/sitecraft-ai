import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, open, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';

// Owns its HTTP provider, dev server and data. Never reads the main workspace.
const base = 'http://127.0.0.1:3161';
const output = process.env.T151_ARTIFACT_DIR || `artifacts/t151/${new Date().toISOString().replace(/[:.]/g, '-')}`;
await mkdir(output, { recursive: true });
const code = {
  header: '<header><a href="/home">临港机械</a><nav aria-label="主导航"><a href="/home">首页</a><a href="/products">产品</a></nav></header>',
  footer: '<footer><p>临港机械 · 精密零件加工</p><a href="mailto:parts@example.com">parts@example.com</a></footer>',
  css: 'body{margin:0;background:#fff;color:#202822;font:16px/1.7 sans-serif}header,footer{padding:24px;border-bottom:1px solid #ccc}nav{display:flex;flex-wrap:wrap;gap:24px}a{color:#24534c}main{padding:32px;max-width:960px;margin:auto}p{max-width:32em}h1{font-size:32px;line-height:1.3}section{padding:24px 0;border-top:1px solid #ccc}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:12px;border-bottom:1px solid #ccc}main,td{overflow-wrap:anywhere}',
  pages: [
    { id: 'home', title: '首页', html: '<main><h1>精密零件加工</h1><p>按图加工轴套与接头。</p><section><h2>产品与加工</h2><p>产品型号 LG-A，尺寸 20 mm。</p><a href="/products" title="产品目录">查看产品</a></section><p>认证：待补充</p></main>' },
    { id: 'products', title: '产品', html: '<main><h1>轴套与接头</h1><p>按图加工。</p><table><thead><tr><th>产品型号</th><th>尺寸</th></tr></thead><tbody><tr><td>LG-A</td><td>20 mm</td></tr></tbody></table><section><h2>资料要求</h2><p>图纸要求：待补充</p></section></main>' },
  ],
};
// Independent bilingual answers for the supplied Chinese material; no production translator is used.
const dictionary = {
  '临港机械': '临港机械', '主导航': 'Main navigation', '首页': 'Home', '产品': 'Products',
  '临港机械 · 精密零件加工': '临港机械 · Precision parts machining',
  '精密零件加工': 'Precision parts machining', '按图加工轴套与接头。': 'Bushings and fittings machined to drawing.',
  '产品与加工': 'Products and machining', '产品型号 LG-A，尺寸 20 mm。': 'Model LG-A, size 20 mm.',
  '产品目录': 'Product catalogue', '查看产品': 'View products', '认证：待补充': 'Certification: To be provided',
  '轴套与接头': 'Bushings and fittings', '按图加工。': 'Machined to drawing.', '产品型号': 'Model', '尺寸': 'Size',
  '资料要求': 'Drawing requirements', '图纸要求：待补充': 'Drawing requirements: To be provided',
  '认证状态：待补充': 'Certification status: To be provided',
};
let translations = 0, facts = 0;
const provider = createServer(async (request, response) => {
  let raw = ''; for await (const chunk of request) raw += chunk;
  try {
    const input = JSON.parse(raw); let data;
    if (input.messages[0].content.includes('事实校对员')) { facts++; data = { issues: [] }; }
    else if (input.messages[0].content.includes('英文翻译')) {
      assert.equal(input.thinking?.type, 'disabled'); translations++;
      assert.equal(request.url, '/beta/chat/completions');
      assert.equal(input.tools[0].function.name, 'submit_english_translation');
      assert.equal(input.tools[0].function.strict, true);
      const payload = JSON.parse(input.messages[1].content.split('\n')[0]);
      data = { translations: payload.slots.map(slot => {
        assert.ok(Object.hasOwn(dictionary, slot.text), `unrecognised fixture text: ${slot.text}`);
        return { id: slot.id, text: dictionary[slot.text] };
      }) };
      await new Promise(resolve => setTimeout(resolve, 150));
    } else if (input.tools) data = { summary: '按加工业务介绍与产品参数组织两页。', style: 'precision', styleReason: '产品参数为主。', skeletonId: 'compact-profile', skeletonReason: '资料以加工介绍和两类产品为主，短版介绍适合现有内容；产品族目录需要更多系列，不适合当前资料。', pages: code.pages.map(page => ({ id: page.id, title: page.title, outline: [page.title] })) };
    else if (input.messages[1].content.includes('返回 {"header"')) data = code;
    else throw new Error('Unexpected model call');
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ choices: [{ finish_reason: input.tools ? 'tool_calls' : 'stop', message: input.tools ? { tool_calls: [{ type: 'function', function: { name: input.tools[0].function.name, arguments: JSON.stringify(data) } }] } : { content: JSON.stringify(data) } }], usage: { prompt_tokens: 500, completion_tokens: 100, total_tokens: 600 } }));
  } catch (error) { response.writeHead(500); response.end(JSON.stringify({ error: { message: String(error) } })); }
});
let child, browser, log, siteId;
const report = { startedAt: new Date().toISOString(), command: 'CHROME_PATH=<approved Chrome> node --experimental-strip-types scripts/check-english.mjs', screenshots: [] };
const request = async (url, method = 'GET', body) => {
  const response = await fetch(base + url, { method, headers: { 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const payload = await response.json(); assert.ok(response.ok, JSON.stringify(payload)); return payload;
};
const state = async () => (await request(`/api/sites/${siteId}/draft`)).codeSite;
async function wait(expression, label, timeout = 60000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await browser.evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 100)); }
  throw new Error(`Timed out: ${label}`);
}
async function click(selector) {
  assert.equal(await browser.evaluate(`(() => { const node=document.querySelector(${JSON.stringify(selector)});if(!node||node.disabled||!node.getClientRects().length)return false;node.scrollIntoView({block:'center'});node.click();return true })()`), true, `click ${selector}`);
}
async function workspace(width = 1440) {
  await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
  await browser.send('Page.navigate', { url: `${base}/workspace?site=${siteId}` });
  await wait(`Boolean(document.querySelector('[data-testid=code-revision]')) && !document.querySelector('.code-preview-loading')`, 'workspace loaded');
}
async function terminal(previousRun) {
  const end = Date.now() + 60000;
  while (Date.now() < end) {
    const site = await state();
    if (site.run && site.run.id !== previousRun && site.run.status !== 'running') { assert.equal(site.run.status, 'complete', site.run.step); return site; }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('translation did not finish');
}
async function shot(name) {
  const image = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  const file = path.join(output, `${name}.png`); await writeFile(file, Buffer.from(image.data, 'base64')); report.screenshots.push(file);
}
try {
  assert.equal(await fetch(base, { signal: AbortSignal.timeout(500) }).then(() => true, () => false), false, 'port 3161 must be free');
  await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
  log = await open(path.join(output, 'dev.log'), 'w');
  child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--port', '3161'], { stdio: ['ignore', log.fd, log.fd], env: { ...process.env, SITE_STORE: 'fs', SITECRAFT_DATA_ROOT: path.resolve(output, 'store'), SITECRAFT_BASE: base, DEEPSEEK_BASE_URL: `http://127.0.0.1:${provider.address().port}`, DEEPSEEK_API_KEY: 'controlled-local-provider', DEEPSEEK_MODEL: 'controlled-local-provider' } });
  const end = Date.now() + 60000;
  while (!await fetch(`${base}/api/health`).then(r => r.ok, () => false)) { assert.ok(Date.now() < end && child.exitCode === null); await new Promise(resolve => setTimeout(resolve, 200)); }
  siteId = (await request('/api/sites', 'POST', { name: '临港机械' })).id; report.siteId = siteId;
  const started = await request(`/api/sites/${siteId}/chat`, 'POST', { message: '公司名：临港机械\n精密零件加工，按图加工轴套与接头。产品型号 LG-A，尺寸 20 mm，邮箱 parts@example.com。认证与图纸要求待补充。', baseRevision: 0 });
  await request(`/api/sites/${siteId}/chat`, 'POST', { action: 'select', questionId: started.alignment.questionId, questionRevision: started.alignment.questionRevision, optionId: 'precision' });
  const planned = await terminal(null); const planState = await request(`/api/sites/${siteId}/draft`);
  await request(`/api/sites/${siteId}/chat`, 'POST', { action: 'confirm', questionId: planState.alignment.questionId, questionRevision: planState.alignment.questionRevision });
  const chinese = await terminal(planned.run.id);
  browser = await codeCheckBrowser(); await workspace();
  // Expected-red contract on parent: no English button exists.
  assert.equal(await browser.evaluate(`Boolean(document.querySelector('[data-testid=generate-english]'))`), true, 'checked Chinese site offers Generate English');
  assert.equal(translations, 0, 'opening the checked Chinese site does not translate automatically');
  await click('[data-testid=generate-english]');
  const claimDeadline = Date.now() + 5000;
  while ((await state()).run.id === chinese.run.id) { assert.ok(Date.now() < claimDeadline, 'UI click must claim a run'); await new Promise(resolve => setTimeout(resolve, 25)); }
  const duplicate = await fetch(`${base}/api/sites/${siteId}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'translate', baseRevision: 1 }) });
  assert.equal(duplicate.status, 409, 'repeated clicks cannot launch another model run');
  const first = await terminal(chinese.run.id); const bilingual = first.versions.at(-1);
  assert.equal(first.versions.length, 2); assert.deepEqual(bilingual.code, first.versions[0].code);
  assert.equal(bilingual.english.sourceRevision, 1); assert.ok(bilingual.english.checks.passed);
  assert.equal(facts, 1, 'English translation never launches another model fact audit');
  for (const width of [1440, 768, 375]) {
    await workspace(width);
    await browser.evaluate(`document.querySelector('[data-testid=english-status]')?.scrollIntoView({block:'center'})`);
    await shot(`workspace-offer-${width}`);
    await browser.evaluate(`(() => {const tab=document.querySelector('.builder-mobile-tabs button:nth-child(2)');if(tab?.getClientRects().length)tab.click()})()`);
    await click('[data-testid=preview-en]');
    await click(`[aria-label="预览宽度"] button:nth-child(${[1440, 768, 375].indexOf(width) + 1})`);
    await wait(`document.querySelector('[data-testid=code-preview]').src.includes('language=en') && !document.querySelector('.code-preview-loading')`, 'English iframe');
    await wait(`document.querySelector('[data-testid=code-preview]').style.width === '${width}px'`, 'English preview width');
    const frames = await browser.send('Page.getFrameTree'); assert.ok(frames.frameTree.childFrames?.some(item => item.frame.url.includes('language=en')));
    await shot(`workspace-en-${width}`);
    await click('[data-testid=open-version-history]');
    await wait(`document.querySelector('[data-testid=version-history]')?.open`, 'history dialog');
    await browser.evaluate(`(() => { const select=document.querySelector('[aria-label="版本语言"]');select.value='en';select.dispatchEvent(new Event('change',{bubbles:true})) })()`);
    await click(`[aria-label="版本预览宽度"] button:nth-child(${[1440, 768, 375].indexOf(width) + 1})`);
    await wait(`document.querySelector('[data-testid=version-preview]')?.src.includes('language=en') && !document.querySelector('[data-testid=version-preview-loading]')`, 'English history preview');
    await wait(`document.querySelector('[data-testid=version-preview]').style.width === '${width}px'`, 'English history width');
    await shot(`history-en-${width}`);
  }
  const published = await fetch(`${base}/published/${siteId}/en?page=products`); assert.equal(published.status, 200);
  const html = await published.text(); assert.match(html, /lang="en"/); assert.match(html, /Bushings and fittings/); assert.match(html, /LG-A/); assert.match(html, /20 mm/); assert.match(html, /To be provided/); assert.match(html, new RegExp(`/published/${siteId}\\?page=products`));
  // Change Chinese through the same public commit endpoint; the old English is retained.
  const current = structuredClone(bilingual.code); current.pages[0].html = current.pages[0].html.replace('认证：', '认证状态：');
  await request(`/api/sites/${siteId}/draft`, 'PUT', { code: current, summary: '将认证标签改成认证状态', baseRevision: 2 });
  const stale = await state(); assert.equal(stale.versions.at(-1).english.sourceRevision, 1);
  await workspace(); await wait(`document.querySelector('[data-testid=english-status]')?.textContent.includes('落后')`, 'English stale notice');
  assert.equal(translations, 3, 'shared header/footer are translated once, followed by each page');
  await click('[data-testid=generate-english]'); const fresh = await terminal(first.run.id);
  assert.equal(fresh.versions.at(-1).english.sourceRevision, 3);
  await workspace(); await click('[aria-label="撤销"]');
  await wait(`document.querySelector('[data-testid=code-revision]').textContent.includes('v5')`, 'undo translation');
  const undone = await state(); assert.equal(undone.versions.length, 5); assert.equal(undone.versions.at(-1).english.sourceRevision, 1);
  assert.equal(undone.versions.at(-1).restoredFrom, stale.versions.at(-1).id); assert.deepEqual(undone.versions.at(-1).code, stale.versions.at(-1).code);
  await workspace(); await wait(`document.querySelector('[data-testid=english-status]')?.textContent.includes('落后')`, 'stale state survives refresh and undo');
  for (const width of [1440, 768, 375]) for (const language of ['zh', 'en']) {
    await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    const url = `${base}/published/${siteId}${language === 'en' ? '/en' : ''}?page=products`;
    await browser.send('Page.navigate', { url });
    await wait(`document.readyState === 'complete' && location.href === ${JSON.stringify(url)} && Boolean(document.querySelector('main h1')) && document.fonts.status === 'loaded'`, 'published page loaded');
    assert.equal(await browser.evaluate('document.documentElement.lang'), language === 'en' ? 'en' : 'zh-CN');
    await shot(`products-${language}-${width}`);
  }
  report.checks = { first: bilingual.checks, english: bilingual.english.checks, fresh: fresh.versions.at(-1).english.checks, undo: undone.versions.at(-1).english.checks };
  report.translations = translations; report.factCalls = facts; report.status = 'PASS';
} catch (error) {
  report.status = 'INCOMPLETE'; report.failure = String(error); process.exitCode = 1;
} finally {
  await browser?.close();
  if (child?.exitCode === null) { const exited = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM'); await exited; }
  if (provider.listening) await new Promise(resolve => provider.close(resolve)); await log?.close();
  report.finishedAt = new Date().toISOString(); await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, failure: report.failure, output }));
}
