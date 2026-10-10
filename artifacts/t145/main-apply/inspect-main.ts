import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { codeCheckBrowser } from '../../../lib/code-site-browser.ts';
import { captureEvalPage } from '../../../scripts/eval-site-capture.ts';

const base = 'http://127.0.0.1:3155', out = 'artifacts/t145/main-apply/ui';
const root = '/Users/luckye/Documents/Code/sitecraft-ai/.sitecraft-data';
const samples = ['561a1113-4dab-49b6-81dc-ab7e3eb712a5', '89f55641-6e28-45c4-a9f9-440a94171d3c'];
const protectedId = 'blind-p3i-20260920-withimage';
const protectedMessage = '旧站点未转换，含用户上传，已保留';
const plan = JSON.parse(await readFile('artifacts/t145/main-data-plan.json', 'utf8'));
const ids: string[] = plan.writePaths.filter((p: string) => p.includes('/code-sites/')).map((p: string) => p.split('/').pop()!.slice(0, -5));
const before = new Map(await Promise.all(ids.map(async id => [id, JSON.parse(await readFile(`${root}/code-sites/${id}.json`, 'utf8'))] as const)));
await mkdir(out, { recursive: false });
const report: { startedAt: string; finishedAt?: string; status: string; observations: unknown[]; screenshots: string[]; failure?: string } = {
  startedAt: new Date().toISOString(), status: 'INCOMPLETE', observations: [], screenshots: [],
};
const browser = await codeCheckBrowser();
const wait = async (expression: string) => {
  const end = Date.now() + 25000;
  while (Date.now() < end) {
    if (await browser.evaluate<boolean>(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Main-data UI did not become ready: ${expression}`);
};
const screenshot = async (name: string) => {
  await browser.evaluate('document.fonts.ready');
  await new Promise(resolve => setTimeout(resolve, 350));
  const shot = await browser.send<{ data: string }>('Page.captureScreenshot', { format: 'png' });
  const file = `${out}/${name}.png`;
  await writeFile(file, Buffer.from(shot.data, 'base64'), { flag: 'wx' });
  report.screenshots.push(file);
};

try {
  const response = await fetch(base + '/api/sites');
  assert.equal(response.status, 200);
  const list = await response.json();
  assert.equal(list.sites.length, 1096);
  const conversion = [];
  for (const id of ids) {
    const row = list.sites.find((item: { siteId: string }) => item.siteId === id);
    assert.ok(row, `Missing listed imported site: ${id}`);
    const record = before.get(id);
    if (plan.preservedUploadSiteIds.includes(id)) {
      assert.equal(row.readError, protectedMessage);
      assert.equal(row.hasVersion, false);
      assert.equal(record.route, 'unavailable');
      assert.equal(record.status, protectedMessage);
      assert.ok(!('versions' in record));
    } else {
      assert.equal(row.hasVersion, true);
      assert.equal(record.versions.length, 1);
      const version = record.versions[0];
      assert.equal(version.revision, 1);
      assert.equal(version.id, record.currentVersionId);
      assert.equal(version.author, 'legacy-import');
      assert.equal(version.checks.factReview, 'legacy-unreviewed');
      assert.equal(version.checks.passed, true);
      assert.deepEqual(version.code.pages.map((p: { id: string }) => p.id), ['home']);
      assert.deepEqual(version.checks.viewports.map((v: { width: number }) => v.width), [375, 768, 1440]);
      assert.ok(version.checks.viewports.every((v: { overflow: number; overlaps: number; contrastIssues: number }) => !v.overflow && !v.overlaps && !v.contrastIssues));
      conversion.push({ id, revision: version.revision, author: version.author, factReview: version.checks.factReview, checks: version.checks });
    }
  }
  report.observations.push({ siteListStatus: response.status, siteCount: list.sites.length, imported: conversion, protected: plan.preservedUploadSiteIds });
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  for (const id of [...samples, protectedId]) {
    await browser.send('Page.navigate', { url: base + '/sites' });
    await wait(`!!document.querySelector('[data-site-id="${id}"]')`);
    const row = await browser.evaluate<{ text: string; workspaceHref: string }>(`(() => {
      const row = document.querySelector('[data-site-id="${id}"]');
      row.scrollIntoView({block:'center'});
      return {text:row.innerText,workspaceHref:row.querySelector('a[href*="/workspace"]').href};
    })()`);
    if (id === protectedId) assert.ok(row.text.includes(protectedMessage));
    else assert.ok(row.text.includes('工作台') && row.text.includes('发布页'));
    await screenshot(`list-${id}`);
    // Open the list's actual workbench link, then wait for its preview or reason.
    await browser.evaluate(`document.querySelector('[data-site-id="${id}"] a[href*="/workspace"]').click()`);
    if (id === protectedId) {
      await wait(`document.querySelector('[role="alert"]')?.textContent.includes(${JSON.stringify(protectedMessage)})`);
      const opened = await fetch(`${base}/api/sites/${id}/draft`);
      assert.equal(opened.status, 422);
      const payload = await opened.json();
      assert.equal(payload.userMessage, protectedMessage);
      assert.ok(!('codeSite' in payload));
      assert.equal(await browser.evaluate('document.querySelectorAll("iframe").length'), 0);
      await screenshot(`protected-${id}`);
      report.observations.push({ id, row, openStatus: opened.status, userMessage: payload.userMessage, previewFrames: 0 });
      continue;
    }
    await wait(`!!document.querySelector('[data-testid="code-workspace"]') && !!document.querySelector('[data-testid="code-preview"]') && !document.querySelector('.code-preview-loading')`);
    const workspace = await browser.evaluate<{ text: string; previewUrl: string; overflow: boolean }>(`({text:document.body.innerText,previewUrl:document.querySelector('[data-testid="code-preview"]').src,overflow:document.documentElement.scrollWidth>innerWidth})`);
    assert.equal(workspace.overflow, false);
    assert.ok(workspace.text.includes('旧站转换未做模型校对'));
    const draft = await fetch(`${base}/api/sites/${id}/draft`);
    assert.equal(draft.status, 200);
    const state = await draft.json();
    assert.equal(state.codeSite.versions.length, 1);
    const preview = await fetch(workspace.previewUrl);
    assert.equal(preview.status, 200);
    assert.ok(preview.headers.get('content-type')?.includes('text/html'));
    const source = JSON.parse(await readFile(`artifacts/t145/source-data/sites/${id}.json`, 'utf8')).draft;
    const html = await preview.text();
    for (const product of source.products) assert.ok(html.includes(product.name.zh), `Missing source product: ${product.name.zh}`);
    await screenshot(`workspace-${id}`);
    // Inspect the same preview at phone width, outside the scaled workspace.
    const image = await captureEvalPage(browser, workspace.previewUrl, 375, source.companyName);
    const file = `${out}/preview-${id}-375.png`;
    await writeFile(file, Buffer.from(image, 'base64'), { flag: 'wx' });
    report.screenshots.push(file);
    const view = await browser.evaluate<{ text: string; h1: string; overflow: boolean }>('({text:document.body.innerText,h1:document.querySelector("h1")?.textContent,overflow:document.documentElement.scrollWidth>innerWidth})');
    assert.ok(view.h1);
    assert.equal(view.overflow, false);
    for (const product of source.products) assert.ok(view.text.includes(product.name.zh));
    report.observations.push({ id, row, draftStatus: draft.status, previewStatus: preview.status, workspace,
      preview: { h1: view.h1, overflow: view.overflow, sourceProductsShown: source.products.length } });
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  }
  for (const id of ids) assert.deepEqual(JSON.parse(await readFile(`${root}/code-sites/${id}.json`, 'utf8')), before.get(id), `UI inspection changed imported data: ${id}`);
  report.observations.push({ inspectedRecordsUnchanged: ids.length, modelRequestsMade: 0 });
  report.status = 'PASS';
} catch (error) {
  report.failure = error instanceof Error ? error.message : String(error);
  throw error;
} finally {
  await browser.close();
  report.finishedAt = new Date().toISOString();
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
}
console.log('PASS: main-data list, two imported previews and one protected entry.');
