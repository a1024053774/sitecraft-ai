import { localEndpoint } from './local-endpoint.ts';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';

const base = localEndpoint('SITECRAFT_BASE').origin;
const id = 'fefa658d-7ce3-499a-8026-431f33313731';
const expectedInput = '5d66128d-b397-4196-9631-b483b8329040';
const reviewBaseline = 'ff213376-6e98-4c9b-be01-f2e0670d38cf';
const folder = `artifacts/t152/${process.env.T152_RUN_LABEL || `simplify-${Date.now()}`}`;
await mkdir(folder); // Never overwrite a preceding result, including a failure.
const browser = await codeCheckBrowser();
const report: Record<string, any> = { startedAt: new Date().toISOString(), base, siteId: id, scenario: 'single-simplify' };
const state = async () => {
  const response = await fetch(`${base}/api/sites/${id}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"action":"state"}' });
  assert.equal(response.status, 200); return (await response.json()).codeSite;
};
const wait = async (expression: string) => {
  for (let i = 0; i < 300; i++) { if (await browser.evaluate<boolean>(`Boolean(${expression})`)) return; await new Promise(resolve => setTimeout(resolve, 100)); }
  throw new Error(`UI wait timed out: ${expression}`);
};
const shot = async (name: string) => {
  const image = await browser.send<{data:string}>('Page.captureScreenshot', { format: 'png' });
  await writeFile(`${folder}/${name}.png`, Buffer.from(image.data, 'base64'));
};
try {
  const before = await state(); report.before = before;
  assert.equal(before.currentVersionId, expectedInput, 'Only continue the previously reviewed v4; no undo or fresh generation');
  if (process.env.T152_BUDGET_REPORT) {
    const budget = JSON.parse(await readFile(process.env.T152_BUDGET_REPORT, 'utf8'));
    assert.equal(budget.limit, 10000); assert.equal(budget.spent, 0); assert.equal(budget.calls.length, 0);
  }
  const baseline = before.versions.find((version: any) => version.id === reviewBaseline);
  assert.ok(baseline); report.reviewBefore = { ...before, currentVersionId: reviewBaseline };
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await browser.send('Page.navigate', { url: `${base}/workspace?site=${id}` });
  await wait(`!document.querySelector('.code-preview-loading') && document.querySelector('[data-testid="code-preview"]')?.contentDocument?.querySelector('main h1')`);
  await browser.evaluate(`document.querySelector('[data-testid="pick-block"]').click()`);
  await wait(`document.querySelector('[data-testid="pick-block"]')?.getAttribute('aria-pressed')==='true'`);
  await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  await browser.evaluate(`(()=>{const doc=document.querySelector('[data-testid="code-preview"]').contentDocument;const node=doc.querySelector('main').children[2].querySelector('h2');node.scrollIntoView({block:'center'});node.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));})()`);
  await wait(`document.querySelector('[data-testid="selected-target"]')?.textContent.includes('楞型与内尺寸')`);
  await shot('selected-1440');
  // Exactly one user action. The existing workflow owns any bounded repair.
  await browser.evaluate(`([...document.querySelectorAll('.code-quick-edits button')].find(button=>button.textContent==='精简文字')).click()`);
  let after: any;
  for (let i = 0; i < 240; i++) {
    after = await state();
    if (after.run?.id !== before.run?.id && after.run?.status !== 'running') break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  report.edited = after;
  assert.equal(after.run?.status, 'complete', JSON.stringify(after.run));
  assert.deepEqual(after.run.selectedTarget.path, [2]);
  assert.equal(after.run.selectedTarget.versionId, expectedInput);
  assert.match(after.run.request, /保留事实与操作顺序/); assert.match(after.run.request, /不压成电报体/);
  const calls = after.run.modelCalls;
  assert.ok(calls?.length && calls.every((call: any) => call.usage));
  report.firstEditTokens = calls.reduce((sum: number, call: any) => sum + call.usage.totalTokens, 0);
  assert.ok(report.firstEditTokens <= 10000);
  if (process.env.T152_BUDGET_REPORT) {
    const budget = JSON.parse(await readFile(process.env.T152_BUDGET_REPORT, 'utf8'));
    report.budget = budget; assert.equal(budget.spent, report.firstEditTokens); assert.equal(budget.calls.length, calls.length);
  }
  const current = after.versions.find((version: any) => version.id === after.currentVersionId);
  const prior = before.versions.find((version: any) => version.id === expectedInput);
  assert.equal(current.revision, prior.revision + 1); assert.equal(current.checks.passed, true);
  assert.deepEqual(current.code.pages[1], prior.code.pages[1]);
  assert.equal(current.code.header, prior.code.header); assert.equal(current.code.footer, prior.code.footer);
  report.selectedCopy = await browser.evaluate(`(${JSON.stringify([baseline.code.pages[0].html, prior.code.pages[0].html, current.code.pages[0].html])}).map(html=>new DOMParser().parseFromString(html,'text/html').querySelector('main').children[2].textContent)`);
  await browser.send('Page.reload');
  await wait(`document.querySelector('[data-testid="code-revision"]')?.textContent.includes('v${current.revision}') && !document.querySelector('.code-preview-loading')`);
  assert.equal((await state()).currentVersionId, current.id); report.refreshRestored = true;
  for (const width of [1440, 768, 375]) {
    await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await browser.evaluate(`([...document.querySelectorAll('.device-toggle[aria-label="预览宽度"] button')].find(button=>button.textContent==='${width}')).click()`);
    if (width <= 768) {
      await browser.evaluate(`([...document.querySelectorAll('[role="tab"]')].find(el=>el.textContent==='预览'))?.click()`);
      await wait(`getComputedStyle(document.querySelector('.builder-chat')).visibility === 'hidden' || getComputedStyle(document.querySelector('.builder-chat')).display === 'none'`);
    }
    await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    await shot(`workspace-${width}`);
  }
  report.status = 'PASS';
} catch (error) { report.status = 'INCOMPLETE'; report.error = String(error); await shot('failure'); throw error; }
finally { report.finishedAt = new Date().toISOString(); await writeFile(`${folder}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); console.log(folder); }
