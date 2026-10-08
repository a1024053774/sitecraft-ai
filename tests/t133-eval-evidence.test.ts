import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import * as reports from '../scripts/eval-set-report.ts';
import type { CodeSiteRecord } from '../lib/code-site.ts';

// Archive failure modes: only the accepted version survives; earlier refused
// candidates disappear; code is confused with checks; a partial run is omitted.
// The oracle is supplied outside the writer: three distinct candidate bodies.
test('T133 private evidence preserves every candidate even with no saved version', async () => {
  const folder = path.join('artifacts/t133', `archive-${crypto.randomUUID()}`);
  await mkdir(folder, { recursive: true });
  const site: CodeSiteRecord = { route: 'code', siteId: 't133-archive', name: '归档夹具', conversationId: 'fixture', materials: '夹具',
    preferences: { style: 'precision', layout: 5, density: 6 }, plan: null, versions: [], currentVersionId: null, run: null, updatedAt: '',
    runs: [{ id: 'run-fixture', kind: 'generate', status: 'error', step: '拒收', request: '', baseRevision: 0, startedAt: '', updatedAt: '', repairRound: 2,
      issues: ['资料没有的数字'], attempts: [0, 1, 2].map(round => ({
        code: { header: '<header>归档夹具</header>', footer: '', css: `main{padding:${round + 10}px}`, pages: [{ id: 'home', title: '首页', html: `<main><h1>第${round}轮原候选</h1></main>` }] },
        checks: { passed: false, issues: ['资料没有的数字'], cleaned: [], checkedAt: '', viewports: [] },
      })) }] };
  assert.equal(typeof reports.saveCandidateEvidence, 'function', 'evaluation must own a durable candidate archive');
  await reports.saveCandidateEvidence(folder, site);
  const stored = JSON.parse(await readFile(path.join(folder, 'code-site.json'), 'utf8'));
  assert.equal(stored.siteId, 't133-archive');
  assert.deepEqual(stored.runs[0].attempts.map((attempt: { code: { pages: { html: string }[] } }) => attempt.code.pages[0].html),
    ['<main><h1>第0轮原候选</h1></main>', '<main><h1>第1轮原候选</h1></main>', '<main><h1>第2轮原候选</h1></main>']);
  assert.equal(stored.versions.length, 0);
  // A run still in progress must preserve already checked candidates as well.
  site.runs[0].status = 'running';
  await reports.saveCandidateEvidence(folder, site);
  const running = JSON.parse(await readFile(path.join(folder, 'code-site.json'), 'utf8'));
  assert.equal(running.runs[0].status, 'running');
  assert.equal(running.runs[0].attempts.length, 3);
});
