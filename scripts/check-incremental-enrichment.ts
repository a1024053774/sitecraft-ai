import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { copyFile, mkdir, readFile, writeFile, open } from 'node:fs/promises';
import path from 'node:path';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import { currentCodeVersion, type CodeSiteRecord } from '../lib/code-site.ts';
import { captureEvalPage } from './eval-site-capture.ts';
import { assertEnrichmentStep, observeEnrichmentCode, readEnrichmentPage, type EnrichmentPage } from './enrichment-acceptance.ts';
import { enrichmentCompany, enrichmentSteps, enrichmentPhotos, enrichmentProviderFixture } from '../tests/fixtures/incremental-enrichment.ts';

const mode = process.argv[2];
assert.ok(mode === '--fixture' || mode === '--live' || mode === '--replay', '指定 --fixture、--live 或只读 --replay；不自动重跑。');
if (mode === '--replay') {
  const source = path.resolve(process.argv[3] || 'artifacts/t144/live-once');
  const directory = path.resolve(process.env.T144_ARTIFACTS || `artifacts/t144/replay-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  await mkdir(path.dirname(directory), { recursive: true }); await mkdir(directory);
  const site: CodeSiteRecord = JSON.parse(await readFile(path.join(source, 'code-site.json'), 'utf8'));
  const browser = await codeCheckBrowser(); const observations = [];
  try {
    for (const width of [1440, 375]) for (const step of [1, 2, 3]) {
      const code = site.versions.find(v => v.revision === step)!.code;
      const pages = await observeEnrichmentCode(browser, code, width); observations.push({ step, width, pages }); assertEnrichmentStep(step, pages);
    }
    assert.deepEqual(currentCodeVersion(site)!.code, site.versions[0].code, '恢复刷新代码不等于第一版');
    for (const width of [1440, 375]) assertEnrichmentStep(1, await observeEnrichmentCode(browser, currentCodeVersion(site)!.code, width));
    await writeFile(path.join(directory, 'report.json'), JSON.stringify({ status: 'PASS', at: new Date().toISOString(), source, head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), modelCalls: 0, observations }, null, 2), 'utf8');
    console.log(`PASS：已保存三步及恢复版重放断言，无模型调用。${directory}`);
  } finally { await browser.close(); }
  process.exit(0);
}
const directory = path.resolve(process.env.T144_ARTIFACTS || `artifacts/t144/${mode.slice(2)}-${new Date().toISOString().replace(/[:.]/g, '-')}`);
await mkdir(path.dirname(directory), { recursive: true });
await mkdir(directory, { recursive: false });
const base = 'http://127.0.0.1:3153';
// Refuse an occupied port before opening a workspace or sending any message.
const portCheck = createServer();
await new Promise<void>((resolve, reject) => { portCheck.once('error', reject); portCheck.listen(3153, '127.0.0.1', resolve); });
await new Promise<void>(resolve => portCheck.close(() => resolve()));
const provenance = { command: `node --experimental-strip-types scripts/check-incremental-enrichment.ts ${mode}`,
  head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() };
const fixture = mode === '--fixture' ? await enrichmentProviderFixture() : null;
const log = await open(path.join(directory, 'next.log'), 'wx');
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3153'], {
  env: { ...process.env, SITE_STORE: 'fs', SITECRAFT_BASE: base, ...(fixture ? { DEEPSEEK_BASE_URL: fixture.url, DEEPSEEK_API_KEY: 'local-fixture-only', DEEPSEEK_MODEL: 'local-fixture-only' } : {}) },
  stdio: ['ignore', log.fd, log.fd],
});
let browser: Awaited<ReturnType<typeof codeCheckBrowser>> | undefined;
let siteId = '';
const snapshots: CodeSiteRecord[] = [];
const startedAt = new Date().toISOString();
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const save = (name: string, value: unknown) => writeFile(path.join(directory, name), JSON.stringify(value, null, 2), 'utf8');
async function readSite() {
  const response = await fetch(`${base}/api/sites/${siteId}/draft`); assert.equal(response.status, 200);
  const payload = await response.json(); await save('code-site.json', payload.codeSite); return payload.codeSite as CodeSiteRecord;
}
async function wait(expression: string, label: string, timeout = 60000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await browser!.evaluate<boolean>(expression)) return; await pause(200); }
  throw new Error(`等待超时：${label}`);
}
async function click(label: string) {
  await browser!.evaluate(`(() => {const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)throw new Error('按钮不可用');b.click()})()`);
}
async function workspace() {
  await browser!.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await browser!.send('Page.navigate', { url: `${base}/workspace?${siteId ? `site=${siteId}` : 'new=1'}` });
  await wait('!!document.querySelector("[data-testid=code-workspace]")', '工作台');
  const observedId = await browser!.evaluate<string>('new URL(location.href).searchParams.get("site")');
  if (siteId) assert.equal(observedId, siteId); else siteId = observedId;
}
async function message(text: string) {
  await browser!.evaluate(`(() => {const n=document.querySelector('#code-message');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(n,${JSON.stringify(text)});n.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await pause(100); await browser!.evaluate('document.querySelector(".code-chat-form").requestSubmit()');
  await wait('document.querySelector("#code-message").value===""', '消息已接收');
}
async function run(previousRunId?: string) {
  const deadline = Date.now() + 1800000;
  let last = '';
  while (Date.now() < deadline) {
    const site = await readSite();
    if (site.run?.id !== previousRunId) {
      if (site.run?.step !== last) { last = site.run?.step ?? ''; console.log(last); }
      if (site.run?.status === 'error') throw new Error(site.run.step);
      if (site.run?.status === 'complete') return site;
    }
    await pause(2000);
  }
  throw new Error('任务未在 30 分钟内完成');
}
function budget(site: CodeSiteRecord, remainingEstimate: number) {
  if (fixture) return;
  const calls = site.runs.flatMap(r => r.modelCalls ?? []);
  assert.ok(calls.every(c => c.usage), '上游没有完整用量，无法核对余下预算，本次停止，不重跑。');
  const used = calls.reduce((n, c) => n + c.usage!.totalTokens, 0);
  console.log(`已报告 ${used} token，余下估算 ${remainingEstimate} token。`);
  assert.ok(used + remainingEstimate <= 300000, '根据实际用量重新估算超过 30 万 token，本次停止，不发起下一步。');
}
async function shot(name: string) {
  await browser!.evaluate('document.fonts.ready');
  const { data } = await browser!.send<{ data: string }>('Page.captureScreenshot', { format: 'png' });
  await writeFile(path.join(directory, name + '.png'), Buffer.from(data, 'base64'));
}
async function captureStep(step: number, site: CodeSiteRecord) {
  const version = currentCodeVersion(site)!; assert.equal(version.revision, step); assert.equal(version.checks.passed, true);
  snapshots.push(structuredClone(site)); await save(`step-${step}.json`, site);
  const observations: Array<EnrichmentPage & { width: number }> = [];
  for (const page of version.code.pages) for (const width of [1440, 375]) {
    const url = `${base}/api/sites/${siteId}/code-preview?page=${page.id}&version=${version.id}`;
    const data = await captureEvalPage(browser!, url, width, enrichmentCompany);
    observations.push({ width, ...await browser!.evaluate<EnrichmentPage>(`(${readEnrichmentPage.toString()})(${JSON.stringify(page.id)})`) });
    await writeFile(path.join(directory, `step-${step}-${page.id}-${width}.png`), Buffer.from(data, 'base64'));
    if (step > 1 && page.id === 'products') assert.ok(await browser!.evaluate<number>('document.images.length') >= 1, '补充后的产品页应有授权产品行业配图');
  }
  for (const width of [1440, 375]) assertEnrichmentStep(step, observations.filter(p => p.width === width));
  if (step > 1) {
    const used = new Set((version.code.header + version.code.footer + version.code.pages.map(p => p.html).join('')).match(/img_[a-z0-9]{16,40}/g));
    assert.equal(used.size, 2, '两张授权配图应按类别进入站点，不限定同页摆放');
  }
  await workspace(); await wait(`document.querySelector('[data-testid=code-revision]')?.textContent.includes('v${step}')`, '当前版本');
  await wait('!document.querySelector(".code-preview-loading")', '工作台预览载入');
  for (const width of [1440, 768, 375]) {
    await browser!.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await pause(150); await shot(`step-${step}-workspace-${width}`);
  }
  await workspace();
}
async function upload() {
  const folder = path.resolve('tests/fixtures/company-images/industrial');
  const manifest = JSON.parse(await readFile(path.join(folder, 'manifest.json'), 'utf8'));
  const photos = enrichmentPhotos.map(file => manifest.images.find((p: { file: string }) => p.file === file));
  await click('图片');
  for (const photo of photos) {
    assert.equal(photo.review.status, 'PASS');
    for (const [label, value] of [['用途', photo.category], ['许可', photo.apiLicense], ['来源地址', photo.sourceUrl], ['许可证地址', photo.licenseUrl], ['作者', photo.author], ['署名文字', photo.attribution]]) {
      await browser!.evaluate(`(() => {const label=[...document.querySelectorAll('.code-upload-panel label')].find(n=>n.firstChild.textContent===${JSON.stringify(label)});const n=label.querySelector('input,select');Object.getOwnPropertyDescriptor(n.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(n,${JSON.stringify(value)});n.dispatchEvent(new Event(n.tagName==='SELECT'?'change':'input',{bubbles:true}))})()`);
      await pause(60);
    }
    const doc = await browser!.send<{ root: { nodeId: number } }>('DOM.getDocument');
    const node = await browser!.send<{ nodeId: number }>('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[aria-label="上传图片"]' });
    await browser!.send('DOM.setFileInputFiles', { nodeId: node.nodeId, files: [path.join(folder, photo.file)] });
    await wait(`document.querySelector('.code-upload-panel')?.textContent.includes(${JSON.stringify(photo.file)})`, '图片上传准入');
  }
  const receipt = await (await fetch(`${base}/api/sites/${siteId}/images`)).json();
  assert.equal(receipt.images.length, 2); await save('uploads.json', { photos, receipt });
  await shot('uploaded-1440'); await click('图片');
  return photos.map(p => `${p.file}：${p.caption}（行业配图，不代表本公司实拍或新增能力）。`).join('\n');
}
try {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error('3153 开发服务器启动失败，查看 next.log');
    try { if ((await fetch(base)).ok) break; } catch { /* Local startup only; no provider call. */ }
    await pause(500);
    if (i === 99) throw new Error('开发服务器启动超时');
  }
  browser = await codeCheckBrowser();
  // Full-page CDP captures remove scrollbars. Hide them before measurement so
  // image aspect ratios and the final content height use the requested width.
  await browser.send('Emulation.setScrollbarsHidden', { hidden: true });
  await workspace(); console.log(`site=${siteId}`);
  await message(enrichmentSteps[0]); await wait('!!document.querySelector("[data-testid=code-style-question]")', '风格选择');
  await browser.evaluate('document.querySelector("input[value=precision]").click()'); await click('保存选择，规划页面');
  const planned = await run(); assert.deepEqual(planned.plan!.pages.map(p => p.id).sort(), ['home', 'products']);
  await wait('!!document.querySelector("[data-testid=code-plan]")', '页面确认'); await shot('plan-1440');
  await click('确认并生成'); let site = await run(planned.run!.id); await captureStep(1, site);
  budget(site, 173000);
  const photoNotes = await upload(); await message(enrichmentSteps[1] + '\n' + photoNotes);
  site = await run(site.run!.id); await captureStep(2, site);
  assert.deepEqual(currentCodeVersion(site)!.code.pages.map(p => p.id).sort(), ['home', 'products']);
  budget(site, 108000);
  await message(enrichmentSteps[2]); site = await run(site.run!.id); await captureStep(3, site);
  assert.deepEqual(currentCodeVersion(site)!.code.pages.map(p => p.id).sort(), ['contact', 'home', 'products']);
  assert.equal(new Set(snapshots.map(s => s.conversationId)).size, 1);
  assert.deepEqual(site.versions.slice(0, 2), snapshots[1].versions, '补充不能改写旧版本');
  budget(site, 8000);
  await browser.evaluate('document.querySelector("[data-testid=open-version-history]").click()');
  await wait('!!document.querySelector("[data-testid=version-history]")', '版本历史');
  assert.deepEqual(await browser.evaluate<number[]>('[...document.querySelectorAll("[data-revision]")].map(n=>Number(n.dataset.revision)).sort()'), [1, 2, 3]);
  await shot('history-1440'); await browser.evaluate(`document.querySelector('[data-revision="1"]').click()`);
  await browser.evaluate('document.querySelector("[data-testid=restore-version]").click()');
  await wait('document.querySelector("[data-testid=version-history]").textContent.includes("保存为第 4 版")', '恢复第 1 版', 300000);
  const restored = await readSite(); assert.equal(restored.versions.length, 4);
  assert.deepEqual(currentCodeVersion(restored)!.code, snapshots[0].versions[0].code);
  assert.equal(currentCodeVersion(restored)!.restoredFrom, snapshots[0].versions[0].id);
  await workspace(); assert.equal((await readSite()).currentVersionId, restored.currentVersionId);
  await wait('!document.querySelector(".code-preview-loading")', '恢复后的预览载入'); await shot('restored-refresh-1440');
  const data = await captureEvalPage(browser, `${base}/api/sites/${siteId}/code-preview?page=products`, 375, enrichmentCompany);
  await writeFile(path.join(directory, 'restored-products-375.png'), Buffer.from(data, 'base64'));
  assert.doesNotMatch(await browser.evaluate<string>('document.body.innerText'), /244|400|2016|2024|华岭|luckye/);
  await mkdir(path.join(directory, 'paired-inputs'));
  for (const step of [1, 3]) for (const page of ['home', 'products']) for (const width of [1440, 375]) {
    const name = `step-${step}-${page}-${width}.png`; await copyFile(path.join(directory, name), path.join(directory, 'paired-inputs', name));
  }
  await save('report.json', { status: 'PASS', fixtureOnly: !!fixture, ...provenance, startedAt, finishedAt: new Date().toISOString(), siteId, base, snapshots: snapshots.map(s => ({ conversationId: s.conversationId, version: currentCodeVersion(s), run: s.run })), restoredVersion: currentCodeVersion(restored), screenshotsViewed: false, independentReview: '由主控安排，执行者未盲评', estimatedLiveTokens: 230000,
    reportedRunTokens: restored.runs.flatMap(r => r.modelCalls ?? []).reduce((n, c) => n + (c.usage?.totalTokens ?? 0), 0),
    usageLimitation: '历史恢复的事实校对不属于生成运行，现有入口不记录其 token；reportedRunTokens 不含它，未知不能视为零。' });
  console.log(`PASS：三步、正常上传、版本历史、恢复刷新。${directory}`);
} catch (error) {
  if (siteId) await readSite().catch(() => {});
  if (browser) await shot('failure').catch(() => {});
  await save('failure.json', { status: 'INCOMPLETE', ...provenance, siteId, at: new Date().toISOString(), error: String(error) }); throw error;
} finally {
  if (fixture) { await save('provider-fixture.json', { calls: fixture.calls, failures: fixture.failures }); await fixture.close(); }
  await browser?.close();
  if (child.exitCode === null) { const exited = new Promise<void>(resolve => child.once('exit', () => resolve())); child.kill('SIGINT'); await exited; }
  await log.close();
}
