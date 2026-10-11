import { localEndpoint } from './local-endpoint.ts';
import assert from 'node:assert/strict';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import { captureEvalPage } from './eval-site-capture.ts';
import type { CodeSiteRecord } from '../lib/code-site.ts';

const base = localEndpoint('SITECRAFT_BASE').origin;
const budgetBase = localEndpoint('SITECRAFT_BUDGET_BASE').origin;
const [phase, folder, source] = process.argv.slice(2);
assert.ok(folder && path.resolve(folder).startsWith(path.join(process.cwd(), 'artifacts/t153/')));
const root = path.join(folder, 'private');
const stateFile = path.join(root, 'generation.json');
async function api(endpoint: string, body?: unknown) {
  const response = await fetch(base + endpoint, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
  const result = await response.json(); assert.ok(response.ok, `${endpoint}: ${response.status} ${result.userMessage || ''}`); return result;
}
const health = await api('/api/health');
assert.equal(health.testIdentity.cwd, process.cwd());
assert.equal(health.persistence.driver, 'development-file');
assert.equal(health.deepseek.model, 'deepseek-flash');
if (phase === 'prepare') {
  assert.ok(source);
  await mkdir(root, { recursive: true });
  const original: CodeSiteRecord = JSON.parse(await readFile(path.join(source, 'code-site.json'), 'utf8'));
  const version = original.versions.find(v => v.id === original.currentVersionId)!;
  assert.ok(version.checks.passed && version.model === 'deepseek-flash');
  assert.deepEqual(version.code.pages.map(p => p.id).sort(), ['home', 'products']);
  const created = await api('/api/sites', { name: original.name });
  const record = { siteId: created.id, company: original.name, materials: original.materials, startedAt: new Date().toISOString(),
    baseline: { source: path.resolve(source), siteId: original.siteId, versionId: version.id, revision: version.revision, style: original.plan!.style, checks: version.checks }, phases: {} };
  await writeFile(stateFile, JSON.stringify(record, null, 2), { flag: 'wx' });
  await writeFile(path.join(root, 'materials.txt'), original.materials);
  const uploads = JSON.parse(await readFile(path.join(source, 'uploads.json'), 'utf8'));
  const receipts = [];
  await mkdir(path.join(root, 'uploads'));
  for (const upload of uploads) {
    assert.ok(['CC0', 'Public Domain', 'CC BY', 'CC BY-SA'].includes(upload.submitted.license));
    assert.ok(upload.submitted.sourceUrl && upload.submitted.licenseUrl && upload.submitted.author && upload.submitted.attribution);
    const filename = path.basename(upload.file);
    await copyFile(path.join(source, upload.file), path.join(root, 'uploads', filename));
    const form = new FormData();
    form.set('file', new Blob([await readFile(path.join(root, 'uploads', filename))], { type: 'image/jpeg' }), filename);
    for (const [key, value] of Object.entries(upload.submitted)) form.set(key, String(value));
    const response: Response = await fetch(`${base}/api/sites/${created.id}/images`, { method: 'POST', body: form });
    const receipt = await response.json();
    receipts.push({ file: `uploads/${filename}`, submitted: upload.submitted, receipt });
    await writeFile(path.join(root, 'uploads.json'), JSON.stringify(receipts, null, 2));
    assert.equal(response.status, 201);
  }
  await api(`/api/sites/${created.id}/chat`, { message: original.materials, baseRevision: 0 });
  console.log(JSON.stringify({ prepared: true, siteId: created.id, imageCount: receipts.length, materialsChars: original.materials.length }));
} else {
  const settings = { default: { layout: 5, density: 6, estimate: 91000 }, low: { layout: 2, density: 2, estimate: 89000 }, high: { layout: 9, density: 9, estimate: 100000 } };
  assert.ok(phase in settings);
  const selected = settings[phase as keyof typeof settings];
  const record = JSON.parse(await readFile(stateFile, 'utf8'));
  assert.ok(!record.phases[phase], 'Do not repeat a generation, including a failed one');
  if (phase === 'low') assert.equal(record.phases.default?.status, 'PASS');
  if (phase === 'high') assert.equal(record.phases.low?.status, 'PASS');
  const budget = await (await fetch(`${budgetBase}/status`)).json();
  assert.equal(budget.limit, 300000); assert.equal(budget.stopped, false);
  console.log(JSON.stringify({ beforeGeneration: phase, estimatedTokens: selected.estimate, spent: budget.spent, projected: budget.spent + selected.estimate, limit: 300000 }));
  assert.ok(budget.spent + selected.estimate <= 300000, 'Stop before the next generation: estimate exceeds approved cumulative budget');
  const phaseFolder = path.join(root, phase); await mkdir(phaseFolder);
  const item: Record<string, any> = record.phases[phase] = { preferences: { style: 'editorial', layout: selected.layout, density: selected.density }, estimate: selected.estimate, spentBefore: budget.spent, status: 'INCOMPLETE', startedAt: new Date().toISOString() };
  const save = () => writeFile(stateFile, JSON.stringify(record, null, 2));
  await save();
  try {
    const arm = await fetch(`${budgetBase}/round`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label: phase, estimate: selected.estimate }) });
    assert.ok(arm.ok, await arm.text());
    let state = await api(`/api/sites/${record.siteId}/chat`, { action: 'state' });
    const revision = state.codeSite.versions.length;
    assert.equal(state.codeSite.materials, record.materials.trim());
    if (phase !== 'default') state = await api(`/api/sites/${record.siteId}/chat`, { action: 'start', baseRevision: revision });
    await api(`/api/sites/${record.siteId}/chat`, { action: 'select', questionId: state.alignment.questionId, questionRevision: state.alignment.questionRevision,
      optionId: 'editorial', preferences: item.preferences, baseRevision: revision });
    async function done() {
      const deadline = Date.now() + 1800000;
      while (Date.now() < deadline) {
        const current: CodeSiteRecord = (await api(`/api/sites/${record.siteId}/draft`)).codeSite;
        await writeFile(path.join(phaseFolder, 'code-site.json'), JSON.stringify(current, null, 2));
        if (current.run?.status !== 'running') { assert.equal(current.run?.status, 'complete', current.run?.step); return current; }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      throw new Error('Generation exceeded 30 minutes; no retry was submitted');
    }
    let site = await done();
    assert.equal(site.plan!.style, 'editorial');
    assert.deepEqual(site.plan!.pages.map(p => p.id).sort(), ['home', 'products']);
    state = await api(`/api/sites/${record.siteId}/chat`, { action: 'state' });
    await api(`/api/sites/${record.siteId}/chat`, { action: 'confirm', questionId: state.alignment.questionId, questionRevision: state.alignment.questionRevision, baseRevision: revision });
    site = await done();
    const version = site.versions.find(v => v.id === site.currentVersionId)!;
    assert.ok(version.checks.passed); assert.equal(version.revision, revision + 1);
    assert.deepEqual(version.code.pages.map(p => p.id).sort(), ['home', 'products']);
    item.versionId = version.id; item.revision = version.revision; item.checks = version.checks;
    const browser = await codeCheckBrowser();
    try {
      for (const page of ['home', 'products']) for (const width of [1440, 375]) {
        const image = await captureEvalPage(browser, `${base}/api/sites/${record.siteId}/code-preview?page=${page}&version=${version.id}`, width, record.company);
        await writeFile(path.join(phaseFolder, `${page}-${width}.png`), Buffer.from(image, 'base64'));
      }
      const fold = await captureEvalPage(browser, `${base}/api/sites/${record.siteId}/code-preview?page=home&version=${version.id}`, 1440, record.company, false);
      await writeFile(path.join(phaseFolder, 'home-fold-1440.png'), Buffer.from(fold, 'base64'));
    } finally { await browser.close(); }
    item.status = 'PASS';
  } catch (error) { item.error = error instanceof Error ? error.message : String(error); throw error; }
  finally {
    const usage = await (await fetch(`${budgetBase}/status`)).json();
    item.spentAfter = usage.spent; item.actualTokens = usage.spent - item.spentBefore; item.finishedAt = new Date().toISOString();
    await save(); console.log(JSON.stringify(item));
  }
}
