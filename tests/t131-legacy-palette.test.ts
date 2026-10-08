import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { defaultDraft } from '../lib/site-document.ts';

registerHooks({ resolve(specifier, context, next) {
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });
process.env.SITE_STORE = 'fs';
const { GET: list } = await import('../app/api/sites/route.ts');
const { GET: open } = await import('../app/api/sites/[siteId]/draft/route.ts');
const { POST: move } = await import('../app/api/sites/[siteId]/history/[action]/route.ts');

// Failure modes: the draft is renamed but history/future forward or inverse operations
// retain retired ids; migration drops the record or changes its content; undo/redo fails.
// Expected colour groups come from the retirement in 42eef85, not runtime lookup output.
for (const side of ['history', 'future'] as const) {
  test(`T-131: list and open a retired ${side} palette, then undo and redo`, async () => {
    const siteId = `t131-${side}-${crypto.randomUUID()}`;
    const file = path.join(process.cwd(), '.sitecraft-data', 'sites', `${siteId}.json`);
    const now = '2026-09-23T12:00:00.000Z';
    const change = {
      id: 'legacy-palette', baseRevision: 1, revision: 2, source: 'manual',
      summary: '旧配色选择', createdAt: now, appliedTargets: ['palette'],
      operations: [{ op: 'set_palette', paletteId: side === 'history' ? 'industrial-white' : 'industrial-minimal-gray' }],
      inverseOperations: [{ op: 'set_palette', paletteId: side === 'history' ? 'industrial-minimal-gray' : 'industrial-white' }],
    };
    const raw = {
      siteId, updatedAt: now, historySchemaVersion: 1,
      draft: { ...structuredClone(defaultDraft), siteName: '旧配色站点', companyName: '旧配色企业', paletteId: 'industrial-white', revision: 2 },
      history: side === 'history' ? [change] : [],
      future: side === 'future' ? [change] : [],
    };
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(raw), 'utf8');
    try {
      const context = { params: Promise.resolve({ siteId }) };
      const opened = await open(new Request(`http://localhost/api/sites/${siteId}/draft`), context);
      assert.equal(opened.status, 200);
      const initial = await opened.json();
      assert.equal(initial.draft.paletteId, 'industrial-porcelain');
      assert.deepEqual(initial.draft.content, raw.draft.content);

      const response = await list();
      assert.equal(response.status, 200);
      const item = (await response.json()).sites.find((entry: { siteId: string }) => entry.siteId === siteId);
      assert.equal(item.siteName, '旧配色站点');
      assert.equal(item.companyName, '旧配色企业');
      assert.equal(item.updatedAt, now);

      const saved = JSON.parse(await readFile(file, 'utf8'));
      assert.equal(saved.historySchemaVersion, 3);
      assert.equal(saved[side].length, 1);
      assert.deepEqual(saved[side][0], {
        ...change,
        operations: [{ op: 'set_palette', paletteId: side === 'history' ? 'industrial-porcelain' : 'industrial-graphite' }],
        inverseOperations: [{ op: 'set_palette', paletteId: side === 'history' ? 'industrial-graphite' : 'industrial-porcelain' }],
      });

      let revision = initial.draft.revision;
      for (const [step, action] of (side === 'history' ? ['undo', 'redo'] : ['redo', 'undo']).entries()) {
        const moved = await move(new Request(`http://localhost/api/sites/${siteId}/history/${action}`, {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ baseRevision: revision }),
        }), { params: Promise.resolve({ siteId, action }) });
        assert.equal(moved.status, 200);
        const payload = await moved.json();
        assert.equal(payload.status, 'applied');
        assert.equal(payload.draft.paletteId, step === 0 ? 'industrial-graphite' : 'industrial-porcelain');
        assert.equal(payload.draft.revision, raw.draft.revision + step + 1);
        revision = payload.draft.revision;
      }
    } finally {
      await unlink(file);
    }
  });
}

// A migration refusal must remain a visible row with raw metadata, never an omitted
// record or a fabricated draft. One refusal must leave a healthy neighbour readable.
test('T-131: an unreadable legacy record stays visible without breaking healthy sites', async () => {
  const badId = `t131-unreadable-${crypto.randomUUID()}`;
  const goodId = `t131-readable-${crypto.randomUUID()}`;
  const badFile = path.join(process.cwd(), '.sitecraft-data', 'sites', `${badId}.json`);
  const goodFile = path.join(process.cwd(), '.sitecraft-data', 'sites', `${goodId}.json`);
  const bad = {
    siteId: badId, updatedAt: '2026-09-23T01:02:03.000Z', history: [], future: [], historySchemaVersion: 1,
    draft: { ...structuredClone(defaultDraft), siteName: '旧记录原名', companyName: '旧记录企业',
      content: { ...structuredClone(defaultDraft.content), services: { ...structuredClone(defaultDraft.content.services),
        items: [{ id: 'unsafe.id', title: { zh: '原始标题', en: 'Original' }, body: { zh: '原始正文', en: 'Original' } }] } } },
  };
  const good = {
    siteId: goodId, updatedAt: '2026-10-07T01:02:03.000Z', history: [], future: [], historySchemaVersion: 3,
    draft: { ...structuredClone(defaultDraft), siteName: '正常站点原名', companyName: '正常企业' },
  };
  await mkdir(path.dirname(badFile), { recursive: true });
  await writeFile(badFile, JSON.stringify(bad), 'utf8');
  await writeFile(goodFile, JSON.stringify(good), 'utf8');
  try {
    const response = await list();
    assert.equal(response.status, 200);
    const { sites } = await response.json();
    const unavailable = sites.find((item: { siteId: string }) => item.siteId === badId);
    assert.equal(unavailable.siteName, '旧记录原名');
    assert.equal(unavailable.companyName, '旧记录企业');
    assert.equal(unavailable.updatedAt, '2026-09-23T01:02:03.000Z');
    assert.equal(unavailable.status, '旧记录无法打开');
    assert.match(unavailable.readError, /旧记录无法打开：.*id 必须/);
    const normal = sites.find((item: { siteId: string }) => item.siteId === goodId);
    assert.equal(normal.siteName, '正常站点原名');
    assert.equal(normal.updatedAt, '2026-10-07T01:02:03.000Z');
    assert.equal(normal.readError, undefined);
    const refused = await open(new Request(`http://localhost/api/sites/${badId}/draft`), { params: Promise.resolve({ siteId: badId }) });
    assert.equal(refused.status, 422);
    const error = await refused.json();
    assert.equal(error.error, 'site_migration_failed');
    assert.equal(error.userMessage, unavailable.readError);
    assert.equal(error.draft, undefined, 'an unreadable record must not become a default draft');
    const opened = await open(new Request(`http://localhost/api/sites/${goodId}/draft`), { params: Promise.resolve({ siteId: goodId }) });
    assert.equal(opened.status, 200);
    assert.equal((await opened.json()).draft.companyName, '正常企业');
    assert.deepEqual(JSON.parse(await readFile(badFile, 'utf8')), bad, 'failed reads must preserve the source record');
  } finally {
    await unlink(badFile);
    await unlink(goodFile);
  }
});
