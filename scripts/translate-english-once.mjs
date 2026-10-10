import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, open, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';

// Explicit, approved single-site translation only. Load credentials into the calling
// process; this script never reads, copies or logs an env file or a provider request.
const argument = flag => process.argv[process.argv.indexOf(flag) + 1];
assert.ok(process.argv.includes('--site') && process.argv.includes('--data-root'), 'Supply --site and --data-root');
const siteId = argument('--site'), dataRoot = path.resolve(argument('--data-root'));
assert.ok(dataRoot.startsWith(path.resolve('artifacts/t151') + path.sep), 'Use the owned T-151 artifact data only');
assert.ok(process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_MODEL === 'deepseek-flash', 'Load the approved provider environment into the process first');
const base = 'http://127.0.0.1:3161';
assert.equal(process.env.SITECRAFT_BASE, base, 'Set SITECRAFT_BASE explicitly to the owned 3161 server');
assert.equal(path.resolve(process.env.SITECRAFT_DATA_ROOT || ''), dataRoot, 'Set the owned SITECRAFT_DATA_ROOT explicitly');
const output = `artifacts/t151/real-${new Date().toISOString().replace(/[:.]/g, '-')}`;
await mkdir(path.join(output, 'review'), { recursive: true });
await mkdir(path.join(output, 'reference'), { recursive: true });
const report = { startedAt: new Date().toISOString(), siteId, dataRoot, screenshots: [] };
let child, log, browser;
const state = async () => {
  const response = await fetch(`${base}/api/sites/${siteId}/draft`); assert.equal(response.status, 200);
  return (await response.json()).codeSite;
};
async function wait(expression, label) {
  const end = Date.now() + 30000;
  while (Date.now() < end) { if (await browser.evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 100)); }
  throw new Error(`Timed out: ${label}`);
}
try {
  assert.equal(await fetch(base, { signal: AbortSignal.timeout(500) }).then(() => true, () => false), false, 'port 3161 must be free');
  log = await open(path.join(output, 'dev.log'), 'w');
  child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--port', '3161'], { stdio: ['ignore', log.fd, log.fd], env: { ...process.env, SITE_STORE: 'fs', SITECRAFT_DATA_ROOT: dataRoot, SITECRAFT_BASE: base } });
  const ready = Date.now() + 60000;
  while (!await fetch(`${base}/api/health`).then(response => response.ok, () => false)) { assert.ok(Date.now() < ready && child.exitCode === null); await new Promise(resolve => setTimeout(resolve, 200)); }
  const before = await state(), chinese = before.versions.find(version => version.id === before.currentVersionId);
  assert.ok(chinese?.checks.passed && before.run?.status !== 'running'); report.beforeRevision = chinese.revision;
  browser = await codeCheckBrowser();
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await browser.send('Page.navigate', { url: `${base}/workspace?site=${siteId}` });
  await wait(`Boolean(document.querySelector('[data-testid=generate-english]'))`, 'English action');
  assert.equal(await browser.evaluate(`(() => {const button=document.querySelector('[data-testid=generate-english]');if(button.disabled)return false;button.click();return true})()`), true);
  const end = Date.now() + 300000; let after;
  while (Date.now() < end) {
    after = await state();
    if (after.run?.id !== before.run?.id && after.run?.status !== 'running') break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(after?.run?.id !== before.run?.id && after?.run?.status !== 'running', 'translation reaches a terminal state');
  report.run = after.run;
  const calls = after.run.modelCalls ?? [];
  assert.ok(calls.length && calls.every(call => call.purpose === 'translate' && call.thinking === 'disabled'), 'one non-thinking translation run; no write or fact-audit calls');
  report.usage = calls.every(call => call.usage) ? calls.reduce((total, call) => ({ promptTokens: total.promptTokens + call.usage.promptTokens, completionTokens: total.completionTokens + call.usage.completionTokens, totalTokens: total.totalTokens + call.usage.totalTokens }), { promptTokens: 0, completionTokens: 0, totalTokens: 0 }) : null;
  assert.equal(after.run.status, 'complete', after.run.step);
  const version = after.versions.find(item => item.id === after.currentVersionId);
  assert.equal(version.revision, chinese.revision + 1); assert.deepEqual(version.code, chinese.code); assert.ok(version.english.checks.passed);
  report.versionId = version.id; report.checks = version.english.checks;
  for (const language of ['zh', 'en']) for (const page of version.code.pages) for (const width of [1440, 768, 375]) {
    await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    const url = `${base}/published/${siteId}${language === 'en' ? '/en' : ''}?page=${page.id}`;
    await browser.send('Page.navigate', { url });
    await wait(`location.href === ${JSON.stringify(url)} && document.readyState === 'complete' && Boolean(document.querySelector('main h1')) && document.fonts.status === 'loaded'`, 'published language page');
    assert.equal(await browser.evaluate('document.documentElement.lang'), language === 'en' ? 'en' : 'zh-CN');
    const metrics = await browser.send('Page.getLayoutMetrics');
    const image = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: Math.ceil(metrics.cssContentSize.height), scale: 1 } });
    const file = path.join(output, language === 'en' ? 'review' : 'reference', `${page.id}-${width}.png`); await writeFile(file, Buffer.from(image.data, 'base64')); report.screenshots.push(file);
  }
  report.status = 'PASS';
} catch (error) { report.status = 'INCOMPLETE'; report.failure = String(error); process.exitCode = 1; }
finally {
  await browser?.close();
  if (child?.exitCode === null) { const exited = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM'); await exited; }
  await log?.close(); report.finishedAt = new Date().toISOString();
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, usage: report.usage, failure: report.failure, output }));
}
