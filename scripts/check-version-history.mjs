import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, open, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';

// --real-reference uses the running, genuinely configured server once. --controlled
// owns a dev server on 3141 and controls only fact-audit HTTP, never the writer.
const real = process.argv.includes('--real-reference');
assert.ok(real || process.argv.includes('--controlled'), 'Choose --real-reference or --controlled explicitly');
const base = process.env.SITECRAFT_BASE || 'http://127.0.0.1:3141';
const root = process.env.T129_ARTIFACT_DIR || 'artifacts/t129';
const fixture = JSON.parse(await readFile(path.join(root, 'fixture.json'), 'utf8'));
const siteId = process.env.T129_SITE_ID || fixture.siteId;
const output = path.join(root, process.env.T129_RUN_NAME || (real ? 'real-reference' : 'ui'));
await mkdir(output, { recursive: true });
let browser, child, audit, log;
const report = { startedAt: new Date().toISOString(), base, siteId, mode: real ? 'real DeepSeek, one request' : 'controlled fact-audit HTTP; manual fixture; actual Next/commit/Chrome', screenshots: [], checks: [] };
async function state() {
  const response = await fetch(`${base}/api/sites/${siteId}/draft`);
  assert.equal(response.status, 200);
  return (await response.json()).codeSite;
}
async function wait(expression, label, timeout = 60000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await browser.evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out: ${label}`);
}
async function click(selector) {
  assert.equal(await browser.evaluate(`(() => {const el=document.querySelector(${JSON.stringify(selector)});if(!el||el.disabled||!el.getClientRects().length) return false;el.scrollIntoView({block:'nearest'});el.click();return true})()`), true, selector);
}
async function value(selector, value) {
  await browser.evaluate(`(() => {const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(${JSON.stringify(selector.includes('select') ? 'change' : 'input')},{bubbles:true}))})()`);
}
async function capture(name) {
  await wait(`!document.querySelector('[data-testid=version-preview-loading]')`, 'loaded version preview');
  const frame = await browser.send('Page.getFrameTree');
  report.checks.push({ name, previewFrames: frame.frameTree.childFrames?.map(item => item.frame.url) });
  assert.ok(frame.frameTree.childFrames?.some(item => item.frame.url.includes('/code-preview')), 'a real preview document must be loaded');
  const shot = await browser.send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(output, `${name}.png`); await writeFile(file, Buffer.from(shot.data, 'base64'));
  report.screenshots.push(file);
}
try {
  if (!real) {
    // Refuse to replace a server belonging to any other process.
    const occupied = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) }).then(() => true, () => false);
    assert.equal(occupied, false, `${base} must be free; stop only your own server first`);
    audit = createServer(async (request, response) => {
      let raw = ''; for await (const chunk of request) raw += chunk;
      const payload = JSON.parse(raw);
      if (!payload.messages[0].content.includes('事实校对员')) { response.writeHead(503); response.end('{}'); return; }
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"issues":[]}' } }] }));
    });
    await new Promise(resolve => audit.listen(0, '127.0.0.1', resolve));
    log = await open(path.join(output, 'dev.log'), 'w');
    child = spawn('npm', ['run', 'dev', '--', '--port', '3141'], { detached: true, stdio: ['ignore', log.fd, log.fd], env: { ...process.env, SITE_STORE: 'fs', SITECRAFT_BASE: base, DEEPSEEK_BASE_URL: `http://127.0.0.1:${audit.address().port}`, DEEPSEEK_API_KEY: 'controlled-fact-audit', DEEPSEEK_MODEL: 'controlled-fact-audit' } });
    const end = Date.now() + 60000;
    while (true) {
      if (child.exitCode !== null) throw new Error('Owned dev server exited before readiness');
      const health = await fetch(`${base}/api/health`).then(response => response.json(), () => null);
      if (health) { assert.equal(health.testIdentity.cwd, process.cwd()); break; }
      assert.ok(Date.now() < end, 'owned server readiness'); await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  browser = await codeCheckBrowser();
  if (real) {
    const before = await state(); report.beforeRevision = before.versions.at(-1).revision;
    const referenceFlag = process.argv.indexOf('--reference-revision');
    const revision = referenceFlag >= 0 ? Number(process.argv[referenceFlag + 1]) : 3;
    const reference = before.versions.find(version => version.revision === revision);
    assert.ok(reference, 'The requested old version must exist');
    assert.notDeepEqual(before.versions.at(-1).code, reference.code, 'Choose an old version with different code to exercise a real change');
    report.referenceRevision = revision;
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await browser.send('Page.navigate', { url: `${base}/workspace?site=${siteId}` });
    await wait(`Boolean(document.querySelector('[data-testid=code-message]'))`, 'workspace');
    await value('[data-testid=code-message]', `把产品区改回第 ${revision} 版那样，保留其他内容`);
    await click('.code-chat-form button[type=submit]');
    await wait(`document.querySelector('[data-testid=code-progress]')?.textContent.includes('DeepSeek 请求失败') || document.querySelector('[data-testid=code-revision]')?.textContent.includes('v${report.beforeRevision + 1}')`, 'one real request outcome', 360000);
    const after = await state();
    report.run = { status: after.run.status, step: after.run.step, referenceVersionIds: after.run.referenceVersionIds, versionId: after.run.versionId };
    report.afterRevision = after.versions.at(-1).revision;
    const shot = await browser.send('Page.captureScreenshot', { format: 'png' });
    const file = path.join(output, 'outcome-1440.png'); await writeFile(file, Buffer.from(shot.data, 'base64')); report.screenshots.push(file);
    if (after.run.status !== 'complete') { report.status = 'BLOCKED'; process.exitCode = 2; }
    else {
      assert.equal(report.afterRevision, report.beforeRevision + 1);
      assert.notDeepEqual(after.versions.at(-1).code, before.versions.at(-1).code, 'A new revision containing unchanged code does not prove the requested edit');
      report.status = 'INCOMPLETE'; report.note = '真实模型已存版；仍须打开结果截图，核对指定区域采用旧版且其余区域保留。'; process.exitCode = 1;
    }
  } else {
    const before = await state(); assert.ok(before.versions.length > 10); report.initialVersionCount = before.versions.length;
    const old = before.versions.find(version => version.revision === 3);
    for (const width of [1440, 768, 375]) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: width === 1440 ? 1000 : 900, deviceScaleFactor: 1, mobile: false });
      await browser.send('Page.navigate', { url: `${base}/workspace?site=${siteId}` });
      await wait(`Boolean(document.querySelector('[data-testid=open-version-history]'))`, 'workspace');
      await click('[data-testid=open-version-history]');
      await wait(`document.querySelector('[data-testid=version-history]')?.open`, 'dialog');
      assert.ok(await browser.evaluate(`document.querySelectorAll('[data-version-id]').length > 10`));
      assert.equal(await browser.evaluate(`document.querySelector('[data-testid=version-preview]').getAttribute('sandbox')`), 'allow-forms');
      for (const grouping of ['minute', 'ten-minutes', 'hour', 'day']) {
        await value('select[aria-label="版本分组"]', grouping);
        assert.equal(await browser.evaluate(`document.querySelector('select[aria-label="版本分组"]').value`), grouping);
        await capture(`group-${grouping}-${width}`);
      }
      await click(`[data-revision="3"]`);
      await value('select[aria-label="版本页面"]', 'products');
      await click(`[aria-label="版本预览宽度"] button:nth-child(${[1440, 768, 375].indexOf(width) + 1})`);
      await wait(`document.querySelector('[data-testid=version-preview]')?.src.includes('version=${old.id}&page=products')`, 'selected old product page');
      await capture(`preview-v3-${width}`);
      const label = `产品目录确认版 ${width}`;
      await value('#version-name', label);
      await click('[data-testid=version-history] form button');
      await wait(`document.querySelector('[data-revision="3"]').textContent.includes(${JSON.stringify(label)})`, 'saved version label');
      await capture(`named-v3-${width}`);
      const renamed = await state();
      assert.deepEqual(renamed.versions.find(version => version.id === old.id).code, old.code);
      const count = renamed.versions.length;
      await click('[data-testid=restore-version]');
      await wait(`document.querySelector('[data-testid=version-history]').textContent.includes('保存为第 ${count + 1} 版')`, 'restored new version');
      const restored = await state();
      assert.equal(restored.versions.length, count + 1);
      assert.deepEqual(restored.versions.at(-1).code, old.code);
      assert.equal(restored.versions.at(-1).restoredFrom, old.id);
      assert.equal(restored.versions.at(-1).checks.passed, true);
      assert.ok(renamed.versions.every(version => restored.versions.some(item => item.id === version.id)));
      report.checks.push({ width, name: label, beforeCount: count, afterCount: restored.versions.length, restoredFrom: old.id, check: restored.versions.at(-1).checks });
      await capture(`restored-v3-${width}`);
      const dimensions = await browser.evaluate(`(() => {const d=document.querySelector('[data-testid=version-history]');return {scroll:d.scrollWidth,client:d.clientWidth,right:d.getBoundingClientRect().right,viewport:innerWidth}})()`);
      assert.ok(dimensions.scroll <= dimensions.client && dimensions.right <= dimensions.viewport + 1, JSON.stringify(dimensions));
      await click('[aria-label="关闭版本历史"]');
      await browser.send('Page.reload');
      await wait(`document.querySelector('[data-testid=code-revision]')?.textContent.includes('v${count + 1}')`, 'refresh current version');
      await click('[data-testid=open-version-history]');
      await wait(`document.querySelector('[data-revision="3"]')?.textContent.includes(${JSON.stringify(label)})`, 'refresh named old version');
      await capture(`refreshed-${width}`);
    }
    report.status = 'PASS';
  }
} catch (error) { report.status = 'INCOMPLETE'; report.error = error.stack; process.exitCode = 1; }
finally {
  report.completedAt = new Date().toISOString();
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser?.close();
  if (child?.pid && child.exitCode === null) { process.kill(-child.pid, 'SIGTERM'); await new Promise(resolve => child.once('exit', resolve)); }
  await log?.close();
  if (audit) await new Promise(resolve => audit.close(resolve));
}
console.log(JSON.stringify({ status: report.status, report: path.join(output, 'report.json'), error: report.error, run: report.run }));
