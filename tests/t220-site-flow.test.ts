import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { codeSiteFlow, codeSiteProgress, type CodeSiteRecord } from '../lib/code-site.ts';

const plan = { summary: '大纲', style: 'precision', pages: [{ id: 'home', title: '首页', outline: '介绍' }] };
const version = { id: 'v1', revision: 1, code: { pages: [{ id: 'home' }] }, checks: { passed: true } };
function site(patch: Record<string, unknown>) {
  return { route: 'code', siteId: 's', name: '青禾包装有限公司', conversationId: 'c', materials: '公司名称：青禾包装有限公司', preferences: { style: 'auto', layout: 5, density: 5 },
    plan: null, versions: [], currentVersionId: null, run: null, runs: [], updatedAt: '2026-11-19T00:00:00.000Z', ...patch } as unknown as CodeSiteRecord;
}
const run = (kind: string, status: string, extra: Record<string, unknown> = {}) => ({ id: 'r', kind, status, repairRound: 0, issues: [], attempts: [], baseRevision: 0, ...extra });
const idle = { waitingForUser: false, awaitingConfirmation: false, questionKind: null };
const style = { waitingForUser: true, awaitingConfirmation: false, questionKind: 'style' };
const confirm = { waitingForUser: true, awaitingConfirmation: true, questionKind: 'confirm_ops' };

test('a failed plan stays on the outline step with the materials and style kept', () => {
  assert.deepEqual(codeSiteFlow(site({ run: run('plan', 'error') }), idle), { step: 'outline', state: 'plan-failed' });
  assert.deepEqual(codeSiteFlow(site({ run: run('plan', 'running') }), idle), { step: 'outline', state: 'planning' });
});

test('the open alignment question decides the step before a version exists', () => {
  assert.deepEqual(codeSiteFlow(site({ materials: '' }), idle), { step: 'material', state: null });
  assert.deepEqual(codeSiteFlow(site({}), { waitingForUser: true, awaitingConfirmation: false, questionKind: 'clarify' }), { step: 'material', state: 'subject' });
  assert.deepEqual(codeSiteFlow(site({}), style), { step: 'style', state: null });
  assert.deepEqual(codeSiteFlow(site({ plan, run: run('plan', 'complete') }), confirm), { step: 'outline', state: null });
  // The user left the outline card: the workspace shows the materials input again, so the list says the same.
  assert.deepEqual(codeSiteFlow(site({ plan, run: run('plan', 'complete') }), idle), { step: 'material', state: null });
});

test('first generation: writing, resumable check, interrupted before a candidate, and plain failure', () => {
  assert.deepEqual(codeSiteFlow(site({ plan, run: run('generate', 'running') }), idle), { step: 'generate', state: 'writing' });
  assert.deepEqual(codeSiteFlow(site({ plan, run: run('generate', 'error', { checkpoint: { code: {}, parentVersionId: null, plan, preferences: { style: 'auto', layout: 5, density: 5 } } }) }), idle), { step: 'generate', state: 'resume' });
  assert.deepEqual(codeSiteFlow(site({ plan, run: run('generate', 'error') }), confirm), { step: 'outline', state: 'regenerate' });
  assert.deepEqual(codeSiteFlow(site({ plan, run: run('generate', 'error') }), idle), { step: 'generate', state: 'generate-failed' });
});

test('a site with a version is on the edit step unless a restyle question is open', () => {
  const saved = { plan, versions: [version], currentVersionId: 'v1' };
  assert.deepEqual(codeSiteFlow(site({ ...saved, run: run('edit', 'complete', { baseRevision: 1 }) }), idle), { step: 'edit', state: null });
  assert.deepEqual(codeSiteFlow(site({ ...saved, run: run('edit', 'error', { baseRevision: 0 }) }), idle), { step: 'edit', state: 'edit-failed' });
  assert.deepEqual(codeSiteFlow(site({ ...saved }), style), { step: 'style', state: null });
  assert.deepEqual(codeSiteFlow(site({ ...saved }), null), { step: 'edit', state: null });
  assert.deepEqual(codeSiteProgress(site({ ...saved }), null), { step: 'edit', state: null, revision: 1, pageCount: 1, checksPassed: true, english: false, hasMaterials: true });
});

test('the workspace, the server list and the browser list all derive the step from codeSiteFlow', () => {
  const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');
  assert.match(read('../components/code-workspace.tsx'), /const flow = codeSiteFlow\(site, alignment\), step = flow\.step;/);
  assert.match(read('../lib/code-site-store.ts'), /progress: codeSiteProgress\(record, alignment\)/);
  assert.match(read('../lib/browser-sites-client.ts'), /codeSiteProgress\(record, conversation \?/);
  // A list item saved without progress still opens as an existing site.
  assert.match(read('../components/site-progress.tsx'), /if \(!progress\) return site\.hasVersion \? \{ label: "已有版本", action: "继续修改"/);
});
