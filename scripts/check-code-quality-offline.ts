import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { checkSiteCode } from '../lib/code-site-check.ts';
import { codeFactMaterials, type CodeSiteRecord, type CodeCheck } from '../lib/code-site.ts';
import { listSiteImages } from '../lib/site-images.ts';
import { summarize, type EvalCase } from './eval-set-report.ts';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import { captureEvalPage } from './eval-site-capture.ts';

// Read copied snapshots only. No model call, commit, version write or import is made.
// Existing deterministic entry checks run with the explicit offline fact-review status.
const { values } = parseArgs({ options: { manifest: { type: 'string' }, samples: { type: 'string' }, out: { type: 'string' } } });
assert.ok(values.manifest && values.samples && values.out, 'use --manifest <selected site IDs> --samples <copied code-sites> --out <new artifact directory>');
const samples = path.resolve(values.samples), out = path.resolve(values.out);
assert.ok(samples.startsWith(process.cwd() + path.sep), 'samples must be copied into this worktree first');
await mkdir(out, { recursive: false }); // Preserve prior runs instead of overwriting their evidence.
const manifest: Array<{ siteId: string; group: string; versionId: string }> = JSON.parse(await readFile(values.manifest, 'utf8'));
const results: Array<{ siteId: string; name: string; group: string; versionId: string; checks?: CodeCheck; error?: string; productImages: number }> = [];
const cases: EvalCase[] = [];
const meta = { startedAt: new Date().toISOString(), command: process.argv.join(' '), commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), samples, modelCalls: 0, factReview: 'offline deterministic replay; no model audit' };
for (const row of manifest) {
  const site: CodeSiteRecord = JSON.parse(await readFile(path.join(samples, `${row.siteId}.json`), 'utf8'));
  assert.equal(site.route, 'code');
  const version = site.versions.find(v => v.id === row.versionId); assert.ok(version);
  const images = await listSiteImages(site.siteId);
  const result = { siteId: site.siteId, name: site.name, group: row.group, versionId: version.id, productImages: images.filter(i => i.usageCategory === 'product').length };
  try {
    const checked = await checkSiteCode({ siteId: site.siteId, code: version.code, materials: codeFactMaterials(site, undefined, version.id), images, legacyImport: true });
    results.push({ ...result, checks: checked.checks });
    cases.push({ key: site.siteId, pack: row.group, style: site.preferences.style, materials: '', outcome: checked.checks.passed ? 'generated' : 'rejected', elapsedMs: 0,
      attempts: [{ round: 0, checks: checked.checks }], modelCalls: [], pages: [] });
    console.log(`${row.group}/${site.siteId}: ${checked.checks.viewports.length} viewports, ${checked.checks.issues.length} floor issues`);
  } catch (error) {
    results.push({ ...result, error: String(error) });
    console.log(`${row.group}/${site.siteId}: ERROR ${String(error)}`);
  }
  await writeFile(path.join(out, 'results.json'), JSON.stringify({ ...meta, results }, null, 2), 'utf8');
}
const summary = summarize(cases);
await writeFile(path.join(out, 'summary.json'), JSON.stringify({ ...meta, completedAt: new Date().toISOString(), selected: manifest.length, replayErrors: results.filter(r => r.error).length,
  ...summary, groups: [...new Set(manifest.map(r => r.group))].map(group => ({ group, ...summarize(cases.filter(c => c.pack === group)) })) }, null, 2), 'utf8');
assert.equal(results.filter(r => r.error).length, 0, 'replay errors remain in results.json and cannot count as passes');
assert.equal(summary.checkedSites, manifest.length);
assert.ok(results.every(r => r.checks?.viewports.length), 'every selected version needs measured viewports');
const kinds = ['truncatedText', 'ungatedHover', 'smallTargets', 'coveredAnchors', 'croppedProductImages'] as const;
const ranked = kinds.map(kind => ({ kind, sites: results.filter(r => r.checks?.viewports.some(v => (v.qualityFeedback?.[kind] || 0) > 0)).length })).sort((a, b) => b.sites - a.sites);
const screenshots: Array<{ kind: string; siteId: string; pageId: string; width: number; file: string }> = [];
const browser = await codeCheckBrowser();
try {
  for (const { kind } of ranked.slice(0, 2)) {
    const result = results.find(r => r.group === 'evaluation' && r.checks?.viewports.some(v => (v.qualityFeedback?.[kind] || 0) > 0)) || results.find(r => r.checks?.viewports.some(v => (v.qualityFeedback?.[kind] || 0) > 0));
    if (!result) continue;
    const page = result.checks!.viewports.find(v => (v.qualityFeedback?.[kind] || 0) > 0)!.pageId;
    for (const width of [1440, 768, 375]) {
      const base = process.env.SITECRAFT_BASE || 'http://127.0.0.1:3157';
      const data = await captureEvalPage(browser, `${base}/api/sites/${result.siteId}/code-preview?page=${page}&version=${result.versionId}`, width, result.name);
      const file = `${kind}-${result.siteId}-${page}-${width}.png`;
      await writeFile(path.join(out, file), Buffer.from(data, 'base64'));
      screenshots.push({ kind, siteId: result.siteId, pageId: page, width, file });
    }
  }
} finally { await browser.close(); }
await writeFile(path.join(out, 'screenshots.json'), JSON.stringify(screenshots, null, 2), 'utf8');
console.log(JSON.stringify({ ranked, summary: summary.qualityFeedback, out }, null, 2));
