import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';

const base = process.env.SITECRAFT_BASE;
assert.equal(base, 'http://127.0.0.1:3164', 'T-152 must only use its assigned workspace');
const id = process.env.T152_SITE_ID || 'fefa658d-7ce3-499a-8026-431f33313731';
const dir = `artifacts/t152/${process.env.T152_RUN_LABEL || `local-${Date.now()}`}`;
await mkdir('artifacts/t152', { recursive: true });
await mkdir(dir); // A named rerun must not replace earlier evidence.
const browser = await codeCheckBrowser();
const evidence: Record<string, unknown> = { startedAt: new Date().toISOString(), base, siteId: id };
const state = async () => { const res = await fetch(`${base}/api/sites/${id}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"action":"state"}' }); assert.equal(res.status, 200); return res.json(); };
const wait = async (expression: string, timeout = 20000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await browser.evaluate<boolean>(`Boolean(${expression})`)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`UI wait timed out: ${expression}`);
};
const click = async (selector: string) => { await browser.evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el||el.disabled)throw new Error('Button unavailable: '+${JSON.stringify(selector)});el.click()})()`); };
const shot = async (name: string) => { const result = await browser.send<{ data: string }>('Page.captureScreenshot', { format: 'png' }); await writeFile(`${dir}/${name}.png`, Buffer.from(result.data, 'base64')); };
const runDone = async (previousRunId: string | undefined) => {
  for (let i = 0; i < 240; i++) {
    const result = await state(); if (result.codeSite.run?.id !== previousRunId && result.codeSite.run?.status !== 'running') {
      assert.equal(result.codeSite.run?.status, 'complete', JSON.stringify(result.codeSite.run)); return result;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Workflow did not finish within 240 seconds');
};
async function pick(path: number[]) {
  await wait(`!document.querySelector('.code-preview-loading') && document.querySelector('[data-testid="code-preview"]')?.contentDocument?.querySelector('main')`);
  await click('[data-testid="pick-block"]');
  await wait(`document.querySelector('[data-testid="pick-block"]')?.getAttribute('aria-pressed')==='true'`);
  await browser.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  await browser.evaluate(`(()=>{const frame=document.querySelector('[data-testid="code-preview"]');let node=frame.contentDocument.querySelector('main');for(const index of ${JSON.stringify(path)})node=node.children[index];const heading=node.querySelector('h1,h2')||node;heading.scrollIntoView({block:'center'});heading.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}))})()`);
  await wait(`document.querySelector('[data-testid="selected-target"]')`);
}
try {
  const start = await state(); evidence.before = start.codeSite;
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await browser.send('Page.navigate', { url: `${base}/workspace?site=${id}` });
  await wait(`document.querySelector('[data-testid="code-preview"]')?.contentDocument?.querySelector('main h1')`);
  console.log('select hero'); await pick([0]);
  assert.match(await browser.evaluate<string>(`document.querySelector('[data-testid="selected-target"]').textContent`), /青禾/);
  await shot('selected-hero-1440');
  await browser.send('Page.reload');
  await wait(`document.querySelector('[data-testid="selected-target"]')`);
  evidence.selectionRestored = true;
  await browser.evaluate(`(()=>{const input=document.querySelector('#code-message');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'首屏标题更醒目，保留全部文字与事实，只调整选中区块的标题字距和顶部细线。');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await wait(`!document.querySelector('.code-chat-form button').disabled`);
  await browser.evaluate(`document.querySelector('.code-selected-target input').click()`);
  await click('.code-chat-form button');
  console.log('wait first edit'); const edited = await runDone(start.codeSite.run?.id); evidence.edited = edited.codeSite;
  const current = edited.codeSite.versions.find((v: any) => v.id === edited.codeSite.currentVersionId);
  const before = start.codeSite.versions.find((v: any) => v.id === start.codeSite.currentVersionId);
  const calls = edited.codeSite.run.modelCalls;
  assert.ok(calls?.length && calls.every((call: any) => call.usage), 'missing usage must stop the paid round');
  evidence.firstEditTokens = calls.reduce((sum: number, call: any) => sum + call.usage.totalTokens, 0);
  assert.ok(Number(evidence.firstEditTokens) <= 15000, `First local edit used ${evidence.firstEditTokens} tokens; stop before undo or a second edit`);
  assert.equal(current.revision, before.revision + 1);
  assert.equal(current.code.pages[1].html, before.code.pages[1].html);
  await wait(`document.querySelector('[data-testid="code-revision"]')?.textContent.includes('v${current.revision}')`);
  await click('button[aria-label="撤销"]');
  await wait(`document.querySelector('[data-testid="code-revision"]')?.textContent.includes('v${current.revision + 1}')`, 90000);
  console.log('undo complete'); const undone = await state(); evidence.undone = undone.codeSite;
  const restored = undone.codeSite.versions.find((v: any) => v.id === undone.codeSite.currentVersionId);
  assert.deepEqual(restored.code, before.code);
  await wait(`document.querySelector('[data-testid="code-preview"]')?.contentDocument?.querySelector('main h1')`);
  await pick([2]);
  await browser.evaluate(`([...document.querySelectorAll('.code-quick-edits button')].find(el=>el.textContent==='精简文字')).click()`);
  const simplified = await runDone(undone.codeSite.run?.id); evidence.simplified = simplified.codeSite;
  const simplifiedVersion = simplified.codeSite.versions.find((v: any) => v.id === simplified.codeSite.currentVersionId);
  const textLengths = await browser.evaluate<number[]>(`[${JSON.stringify(restored.code.pages[0].html)},${JSON.stringify(simplifiedVersion.code.pages[0].html)}].map(html=>new DOMParser().parseFromString(html,'text/html').querySelector('main').children[2].textContent.replace(/\\s+/g,' ').trim().length)`);
  assert.ok(textLengths[1] < textLengths[0], '精简文字 must actually shorten the selected copy');
  await browser.send('Page.reload');
  await wait(`document.querySelector('[data-testid="code-preview"]')?.contentDocument?.querySelector('main h1')`);
  const refreshed = await state(); assert.equal(refreshed.codeSite.currentVersionId, simplified.codeSite.currentVersionId);
  evidence.refreshRestored = true;
  for (const width of [1440, 768, 375]) {
    await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    if (width <= 768) await browser.evaluate(`([...document.querySelectorAll('[role="tab"]')].find(el=>el.textContent==='预览'))?.click()`);
    await browser.evaluate(`([...document.querySelectorAll('.device-toggle[aria-label="预览宽度"] button')].find(el=>el.textContent==='${width}')).click()`);
    await new Promise(resolve => setTimeout(resolve, 300));
    await pick([0]);
    if (width <= 768) await browser.evaluate(`([...document.querySelectorAll('[role="tab"]')].find(el=>el.textContent==='预览'))?.click()`);
    // The tablet chat drawer hides after its 240 ms transition.
    if (width <= 768) await wait(`getComputedStyle(document.querySelector('.builder-chat')).visibility === 'hidden' || getComputedStyle(document.querySelector('.builder-chat')).display === 'none'`);
    await shot(`workspace-${width}`);
  }
  const final = simplified.codeSite.versions.find((v: any) => v.id === simplified.codeSite.currentVersionId);
  for (const [name, version] of [['before', before], ['hero-after', current], ['before-simplify', restored], ['simplified', final]] as const) for (const width of [1440, 768, 375]) {
    await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await browser.send('Page.navigate', { url: `${base}/api/sites/${id}/code-preview?page=home&version=${version.id}` });
    await wait(`document.querySelector('main h1') && [...document.images].every(img=>img.complete && img.naturalWidth>0)`);
    const size = await browser.evaluate<{ width: number; height: number }>('({width:innerWidth,height:document.documentElement.scrollHeight})');
    const image = await browser.send<{data:string}>('Page.captureScreenshot', { format:'png', captureBeyondViewport:true, clip:{x:0,y:0,...size,scale:1} });
    await writeFile(`${dir}/${name}-${width}.png`,Buffer.from(image.data,'base64'));
  }
  evidence.status = 'PASS';
} catch (error) { evidence.status = 'INCOMPLETE'; evidence.error = String(error); await shot('failure'); throw error; }
finally { evidence.finishedAt = new Date().toISOString(); await writeFile(`${dir}/report.json`, JSON.stringify(evidence, null, 2)); await browser.close(); console.log(dir); }
