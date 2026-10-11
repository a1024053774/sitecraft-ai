import { localEndpoint } from './local-endpoint.ts';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';

// Failure modes: missing/false previews, keyboard-inaccessible choices, lost
// drafts, stale questions overwriting preferences, slider values not on the wire,
// regeneration without confirmation, and commits bypassing viewport checks.
const base = localEndpoint('SITECRAFT_BASE').origin;
const fixtureBase = localEndpoint('SITECRAFT_FIXTURE_BASE').origin;
const dir = `artifacts/t153/e2e-${Date.now()}`;
await mkdir(dir, { recursive: true });
const report: Record<string, any> = { startedAt: new Date().toISOString(), base, fixtureBase, status: 'INCOMPLETE' };
const browser = await codeCheckBrowser();
const api = async (url: string, body: unknown, expected = 200) => {
  const res = await fetch(`${base}${url}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json(); assert.equal(res.status, expected, JSON.stringify(data)); return data;
};
const wait = async (expression: string) => {
  for (let i = 0; i < 300; i++) {
    if (await browser.evaluate<boolean>(`Boolean(${expression})`)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`UI timeout: ${expression}`);
};
const click = async (selector: string) => {
  await wait(`document.querySelector(${JSON.stringify(selector)}) && !document.querySelector(${JSON.stringify(selector)}).disabled`);
  await browser.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
};
const shot = async (name: string) => {
  await browser.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const { data } = await browser.send<{ data: string }>('Page.captureScreenshot', { format: 'png' });
  await writeFile(`${dir}/${name}.png`, Buffer.from(data, 'base64'));
};
const key = async (key: string, code: string, windowsVirtualKeyCode: number) => {
  await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode });
  await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode });
};
try {
  const health = await (await fetch(`${base}/api/health`)).json();
  assert.equal(health.testIdentity?.cwd, process.cwd(), 'The application must serve this worktree');
  const initialWires = await (await fetch(`${fixtureBase}/requests`)).json();
  assert.ok(Array.isArray(initialWires), 'The configured fixture must expose its request records');
  report.fixtureCallsBefore = initialWires.length;
  const created = await api('/api/sites', { name: '恒川传动' }, 201), id = created.id;
  report.siteId = id;
  const chat = `/api/sites/${id}/chat`;
  const materials = '公司名：恒川传动\n按图加工齿轮与传动轴。齿轮 G8，合金钢，直径 80 mm，不适用腐蚀工况。传动轴 S2，按图加工，长度待补充。齿轮热处理由外协完成，入厂复检后再精加工。不提供现场安装。请做首页和产品页。';
  const question = await api(chat, { message: materials });
  assert.deepEqual(question.alignment.options.map((o: any) => o.id), ['auto', 'precision', 'documentary', 'editorial']);
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await browser.send('Page.navigate', { url: `${base}/workspace?site=${id}` });
  await wait(`document.querySelectorAll('input[name="code-style"]').length===4 && [...document.querySelectorAll('.code-style-preview')].every(i=>i.complete && i.naturalWidth===576)`);
  assert.equal(await browser.evaluate(`document.querySelectorAll('.code-style-pending').length`), 0);
  // A real keyboard arrow selects a new radio, and native range keys cross both bands.
  await browser.evaluate(`document.querySelector('input[value="auto"]').focus()`);
  await key('ArrowRight', 'ArrowRight', 39);
  await wait(`document.querySelector('input[value="precision"]').checked`);
  for (const label of ['版式', '信息密度']) {
    await browser.evaluate(`document.querySelector('input[aria-label="${label}"]').focus()`);
    await key('End', 'End', 35); await key('ArrowLeft', 'ArrowLeft', 37);
  }
  await browser.send('Page.reload');
  await wait(`document.querySelector('input[value="precision"]')?.checked && document.querySelector('input[aria-label="版式"]').value==='9' && document.querySelector('input[aria-label="信息密度"]').value==='9'`);
  report.draftReload = true;
  for (const width of [1440, 768, 375]) {
    await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: false });
    await browser.evaluate(`document.querySelector('[data-testid="code-style-question"]').scrollIntoView({block:'start'})`);
    const metrics = await browser.evaluate<any>(`({overflow:document.documentElement.scrollWidth>innerWidth, images:[...document.querySelectorAll('.code-style-preview')].map(i=>({loaded:i.complete&&i.naturalWidth>0,ratio:i.getBoundingClientRect().width/i.getBoundingClientRect().height})), cards:[...document.querySelectorAll('.code-style-card')].map(e=>{const r=e.getBoundingClientRect();return {width:r.width,inside:r.left>=0&&r.right<=innerWidth}})})`);
    assert.equal(metrics.overflow, false); assert.ok(metrics.cards.every((r: any) => r.inside && r.width >= 120));
    assert.ok(metrics.images.every((r: any) => r.loaded && Math.abs(r.ratio - 1.44) < .02));
    report[`viewport${width}`] = metrics;
    await shot(`cards-${width}`);
    await browser.evaluate(`document.querySelector('.code-slider').scrollIntoView({block:'center'});document.querySelector('input[aria-label="版式"]').focus()`);
    await shot(`sliders-${width}`);
  }
  if (process.env.T153_DRAFT_ONLY === '1') { report.status = 'PASS'; }
  else {
    await api(chat, { action: 'select', questionId: question.alignment.questionId, questionRevision: question.alignment.questionRevision, optionId: 'unregistered', preferences: { style: 'unregistered', layout: 9, density: 9 } }, 400);
    await click('[data-testid="code-style-question"] .primary-button');
    await wait(`document.querySelector('[data-testid="code-plan"]')`);
    let state = await api(chat, { action: 'state' });
    assert.deepEqual(state.codeSite.preferences, { style: 'precision', layout: 9, density: 9 });
    assert.equal(state.codeSite.versions.length, 0);
    await browser.send('Page.reload'); await wait(`document.querySelector('[data-testid="code-plan"]')`);
    await click('[data-testid="code-plan"] .primary-button');
    await wait(`document.querySelector('[data-testid="code-revision"]')?.textContent.includes('v1')`);
    state = await api(chat, { action: 'state' });
    const version = state.codeSite.versions[0];
    assert.equal(version.checks.passed, true);
    assert.deepEqual([...new Set(version.checks.viewports.map((v: any) => v.width))].sort(), [1440, 375, 768]);
    assert.deepEqual(version.code.pages.map((p: any) => p.id), ['home', 'products']);
    report.firstVersion = version;
    await click('.code-restyle'); await wait(`document.querySelector('[data-testid="code-style-question"]')`);
    assert.equal(await browser.evaluate(`document.querySelector('input[value="precision"]').checked`), true);
    await click('input[value="editorial"]');
    for (const label of ['版式', '信息密度']) {
      await browser.evaluate(`document.querySelector('input[aria-label="${label}"]').focus()`);
      await key('Home', 'Home', 36); await key('ArrowRight', 'ArrowRight', 39);
    }
    const newer = await api(chat, { action: 'state' });
    await api(chat, { action: 'select', questionId: question.alignment.questionId, questionRevision: question.alignment.questionRevision, optionId: 'precision', preferences: { style: 'precision', layout: 9, density: 9 } }, 409);
    assert.equal((await api(chat, { action: 'state' })).alignment.questionId, newer.alignment.questionId);
    await click('[data-testid="code-style-question"] .primary-button'); await wait(`document.querySelector('[data-testid="code-plan"]')`);
    assert.equal((await api(chat, { action: 'state' })).codeSite.currentVersionId, version.id, 'replanning must not store a version');
    await click('[data-testid="code-plan"] .primary-button');
    await wait(`document.querySelector('[data-testid="code-revision"]')?.textContent.includes('v2')`);
    await browser.send('Page.reload'); await wait(`document.querySelector('[data-testid="code-revision"]')?.textContent.includes('v2')`);
    state = await api(chat, { action: 'state' });
    assert.deepEqual(state.codeSite.preferences, { style: 'editorial', layout: 2, density: 2 });
    report.finalState = state;
    const wires = await (await fetch(`${fixtureBase}/requests`)).json();
    report.fixtureCallsAfter = wires.length;
    const recent = wires.slice(initialWires.length);
    assert.deepEqual(recent.map((w: any) => w.purpose), ['plan', 'write', 'facts', 'plan', 'write', 'facts']);
    for (const [offset, phrase] of [[0, '紧凑表格'], [3, '每组只突出一个']] as const) for (const index of [offset, offset + 1]) assert.ok(recent[index].body.messages[0].content.includes(phrase));
    report.providerPurposes = recent.map((w: any) => w.purpose); report.status = 'PASS';
    await shot('regenerated-375');
  }
} catch (error) { report.error = String(error); await shot('failure'); throw error; }
finally { report.finishedAt = new Date().toISOString(); await writeFile(`${dir}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); console.log(dir); }
