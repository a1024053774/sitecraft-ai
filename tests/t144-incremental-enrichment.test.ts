import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { currentCodeVersion, renderSiteCode, type CodeSiteRecord } from '../lib/code-site.ts';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import { assertEnrichmentStep, observeEnrichmentCode } from '../scripts/enrichment-acceptance.ts';
import { enrichmentCompany, enrichmentSteps, enrichmentPhotos, enrichmentProviderFixture } from './fixtures/incremental-enrichment.ts';

// Route regression coverage uses the same public handlers and commit boundary.
// Only model replies and Next's deferred scheduler are controlled. The separate
// check-incremental-enrichment command runs the UI, including history restoration.
const scheduled: Array<() => Promise<void>> = [];
(globalThis as typeof globalThis & { __t144After?: typeof scheduled }).__t144After = scheduled;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'next/server.js') return { shortCircuit: true, url: 'data:text/javascript,export function after(fn){globalThis.__t144After.push(fn)}' };
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });
const fixture = await enrichmentProviderFixture();
process.env.SITE_STORE = 'fs';
process.env.DEEPSEEK_BASE_URL = fixture.url;
process.env.DEEPSEEK_API_KEY = 'local-fixture-only';
process.env.DEEPSEEK_MODEL = 'local-fixture-only';
const base = process.env.SITECRAFT_BASE || 'http://127.0.0.1:3153';
process.env.SITECRAFT_BASE = base;
const { POST: create } = await import('../app/api/sites/route.ts');
const { POST: chat } = await import('../app/api/sites/[siteId]/chat/route.ts');
const { POST: upload } = await import('../app/api/sites/[siteId]/images/route.ts');
const { GET: draft } = await import('../app/api/sites/[siteId]/draft/route.ts');
const { POST: history } = await import('../app/api/sites/[siteId]/history/[action]/route.ts');
const post = (url: string, body: unknown) => new Request(base + url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
test.after(() => fixture.close());
test('同一会话保留补充事实、正常上传图片、三个版本与恢复刷新', async () => {
  const directory = path.resolve('artifacts/t144', `route-${crypto.randomUUID()}`); await mkdir(directory, { recursive: true });
  const snapshots: CodeSiteRecord[] = [];
  const browser = await codeCheckBrowser();
  try {
    const created = await create(post('/api/sites', { name: enrichmentCompany }));
    assert.equal(created.status, 201); const { id } = await created.json(), context = { params: Promise.resolve({ siteId: id }) };
    const read = async () => (await (await draft(new Request(`${base}/api/sites/${id}/draft`), context)).json()).codeSite as CodeSiteRecord;
    const started = await (await chat(post(`/api/sites/${id}/chat`, { message: enrichmentSteps[0], baseRevision: 0 }), context)).json();
    assert.equal((await chat(post(`/api/sites/${id}/chat`, { action: 'select', questionId: started.alignment.questionId, questionRevision: started.alignment.questionRevision, optionId: 'precision' }), context)).status, 202);
    await scheduled.shift()!();
    const confirmation = await (await chat(post(`/api/sites/${id}/chat`, { action: 'state' }), context)).json();
    assert.equal((await chat(post(`/api/sites/${id}/chat`, { action: 'confirm', questionId: confirmation.alignment.questionId, questionRevision: confirmation.alignment.questionRevision }), context)).status, 202);
    await scheduled.shift()!(); snapshots.push(await read());
    assert.equal(snapshots[0].versions.length, 1);
    assertEnrichmentStep(1, await observeEnrichmentCode(browser, currentCodeVersion(snapshots[0])!.code));
    assert.match(currentCodeVersion(snapshots[0])!.code.pages[1].html, /待补充/);
    const folder = path.resolve('tests/fixtures/company-images/industrial');
    const manifest = JSON.parse(await readFile(path.join(folder, 'manifest.json'), 'utf8'));
    for (const file of enrichmentPhotos) {
      const photo = manifest.images.find((p: { file: string }) => p.file === file);
      const form = new FormData(); form.set('file', new Blob([await readFile(path.join(folder, file))], { type: 'image/jpeg' }), file);
      for (const [name, value] of Object.entries({ license: photo.apiLicense, sourceUrl: photo.sourceUrl, licenseUrl: photo.licenseUrl, author: photo.author, attribution: photo.attribution, usageCategory: photo.category, usageScope: 'current-site-only' })) form.set(name, String(value));
      assert.equal((await upload(new Request(`${base}/api/sites/${id}/images`, { method: 'POST', body: form }), context)).status, 201);
    }
    for (const step of [2, 3]) {
      assert.equal((await chat(post(`/api/sites/${id}/chat`, { message: enrichmentSteps[step - 1], baseRevision: step - 1 }), context)).status, 202);
      await scheduled.shift()!(); const site = await read(); snapshots.push(site);
      assert.equal(site.run!.status, 'complete', fixture.failures.join(';'));
      assert.equal(site.versions.length, step);
      const version = currentCodeVersion(site)!; assert.equal(version.checks.passed, true);
      const products = version.code.pages.find(p => p.id === 'products')!.html;
      assertEnrichmentStep(step, await observeEnrichmentCode(browser, version.code));
      assert.equal((products.match(/data-image-id/g) ?? []).length, 2);
      assert.deepEqual(version.code.pages.map(p => p.id).sort(), step === 2 ? ['home', 'products'] : ['contact', 'home', 'products']);
    }
    assert.equal(new Set(snapshots.map(s => s.conversationId)).size, 1);
    assert.deepEqual(snapshots[2].versions.slice(0, 2), snapshots[1].versions);
    const contact = renderSiteCode(id, currentCodeVersion(snapshots[2])!.code, 'contact');
    assert.match(contact, /<form class="sc-inquiry"/); assert.match(contact, /chengchuan-sales@luckye.online/);
    const restored = await history(post(`/api/sites/${id}/history/restore`, { versionId: snapshots[0].versions[0].id, baseRevision: 3 }), { params: Promise.resolve({ siteId: id, action: 'restore' }) });
    assert.equal(restored.status, 200); const refreshed = await read();
    assert.equal(refreshed.versions.length, 4); assert.deepEqual(currentCodeVersion(refreshed)!.code, snapshots[0].versions[0].code);
    assert.equal(currentCodeVersion(refreshed)!.restoredFrom, snapshots[0].versions[0].id);
    assertEnrichmentStep(1, await observeEnrichmentCode(browser, currentCodeVersion(refreshed)!.code));
  } finally {
    await browser.close();
    await writeFile(path.join(directory, 'report.json'), JSON.stringify({ at: new Date().toISOString(), fixtureOnly: true, snapshots, calls: fixture.calls, failures: fixture.failures }, null, 2), 'utf8');
  }
});
