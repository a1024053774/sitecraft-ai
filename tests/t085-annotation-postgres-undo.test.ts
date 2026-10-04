import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const repoRoot = process.cwd();
const mockPath = path.join("/tmp", `sitecraft-t085-postgres-undo-${process.pid}.ts`);
await writeFile(mockPath, `
const sites = new Map();
const annotations = new Map();
const siteKey = (workspace, site) => workspace + "\\0" + site;
const annotationKey = (workspace, site, id) => workspace + "\\0" + site + "\\0" + id;
function siteRow(workspace, site) {
  const row = sites.get(siteKey(workspace, site));
  return row ? { ...row, draft: structuredClone(row.draft), history: structuredClone(row.history), future: structuredClone(row.future) } : null;
}
async function query(sql, params = []) {
  if (sql.includes("INSERT INTO sitecraft_sites")) {
    const key = siteKey(params[0], params[1]);
    if (sites.has(key)) return { rowCount: 0, rows: [] };
    sites.set(key, { site_id: params[1], draft: JSON.parse(params[2]), history: [], future: [], history_schema_version: 3, updated_at: params[4] });
    return { rowCount: 1, rows: [] };
  }
  if (sql.includes("SELECT site_id, draft, history, future")) {
    const row = siteRow(params[0], params[1]);
    return { rowCount: row ? 1 : 0, rows: row ? [row] : [] };
  }
  if (sql.includes("UPDATE sitecraft_sites")) {
    sites.set(siteKey(params[0], params[1]), { site_id: params[1], draft: JSON.parse(params[2]), history: JSON.parse(params[3]), future: JSON.parse(params[4]), history_schema_version: params[5], updated_at: params[6] });
    return { rowCount: 1, rows: [] };
  }
  if (sql.includes("INSERT INTO sitecraft_annotations")) {
    annotations.set(annotationKey(params[0], params[1], params[2]), JSON.parse(params[3]));
    return { rowCount: 1, rows: [] };
  }
  if (sql.includes("SELECT annotation FROM sitecraft_annotations")) {
    const value = annotations.get(annotationKey(params[0], params[1], params[2]));
    return { rowCount: value ? 1 : 0, rows: value ? [{ annotation: value }] : [] };
  }
  if (sql.includes("UPDATE sitecraft_annotations")) {
    annotations.set(annotationKey(params[0], params[1], params[2]), JSON.parse(params[3]));
    return { rowCount: 1, rows: [] };
  }
  throw new Error("unexpected postgres undo mock query: " + sql);
}
export async function ensureDatabaseSchema() {}
export function getDatabasePool() { return { query }; }
export async function withDatabaseTransaction(task) { return task({ query }); }
`, "utf8");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/postgres") return { url: pathToFileURL(mockPath).href, shortCircuit: true };
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const absolute = path.join(repoRoot, specifier.slice(2));
    const file = existsSync(`${absolute}.ts`) ? `${absolute}.ts` : absolute;
    return { url: pathToFileURL(file).href, shortCircuit: true };
  },
});

process.env.SITE_STORE = "postgres";
const { commitOperations, createSite, selectiveUndo } = await import("../lib/site-store.ts");
const { createAnnotation } = await import("../lib/annotation-store.ts");

async function makeAnnotation(siteId: string) {
  const created = await createAnnotation({
    siteId, pageId: "home", pagePath: "/",
    anchor: { pageId: "home", pagePath: "/", templateId: "screwfast", revision: 0, locale: "zh", viewport: { width: 1440, height: 900, device: "desktop" }, scroll: { x: 0, y: 0 }, target: { kind: "slot", slot: "hero.title", section: "hero", locale: "zh" }, rect: { x: 0, y: 0, width: 1, height: 1, space: "target-ratio" }, snapshot: { text: "标题" }, capturedAt: new Date().toISOString() },
    body: "批注", author: { id: "reviewer", name: "审核者" },
  });
  return created.id;
}

test("Postgres selective undo partially applies non-conflicting bilingual targets", async () => {
  const siteId = `t085-pg-undo-${crypto.randomUUID()}`;
  const initial = await createSite(siteId);
  const annotationId = await makeAnnotation(siteId);
  const committed = await commitOperations({ siteId, baseRevision: initial.draft.revision, source: "ai", summary: "双语", annotationId, operations: [{ op: "set_text", target: "hero.title", value: { zh: "批注中文", en: "Annotation English" } }] } as Parameters<typeof commitOperations>[0] & { annotationId: string });
  assert.equal(committed.status, "applied");
  if (committed.status !== "applied") throw new Error("expected applied");
  await commitOperations({ siteId, baseRevision: committed.record.draft.revision, source: "manual", summary: "后来中文", operations: [{ op: "set_text", target: "hero.title", locale: "zh", value: "后来中文" }] });
  const undone = await selectiveUndo(siteId, committed.changeSet.id);
  assert.equal(undone.status, "applied");
  assert.deepEqual(undone.conflictTargets, ["hero.title.zh"]);
  assert.equal((await createSite(siteId)).draft.content.hero.title.en, initial.draft.content.hero.title.en);
});

test("Postgres repeated target in one transaction restores its start value", async () => {
  const siteId = `t085-pg-repeat-${crypto.randomUUID()}`;
  const initial = await createSite(siteId);
  const annotationId = await makeAnnotation(siteId);
  const committed = await commitOperations({ siteId, baseRevision: initial.draft.revision, source: "ai", summary: "重复", annotationId, operations: [
    { op: "set_text", target: "hero.title", locale: "zh", value: "one" },
    { op: "set_text", target: "hero.title", locale: "zh", value: "two" },
  ] } as Parameters<typeof commitOperations>[0] & { annotationId: string });
  if (committed.status !== "applied") throw new Error("expected applied");
  const undone = await selectiveUndo(siteId, committed.changeSet.id);
  assert.equal(undone.status, "applied");
  assert.deepEqual(undone.conflictTargets, []);
  assert.equal((await createSite(siteId)).draft.content.hero.title.zh, initial.draft.content.hero.title.zh);
});

test("Postgres repeated target plus later other-target edit only conflicts the later target", async () => {
  const siteId = `t085-pg-repeat-mixed-${crypto.randomUUID()}`;
  const initial = await createSite(siteId);
  const annotationId = await makeAnnotation(siteId);
  const committed = await commitOperations({ siteId, baseRevision: initial.draft.revision, source: "ai", summary: "重复混合", annotationId, operations: [
    { op: "set_text", target: "hero.title", locale: "zh", value: "one" },
    { op: "set_text", target: "hero.title", locale: "zh", value: "two" },
    { op: "set_text", target: "hero.subtitle", locale: "zh", value: "batch subtitle" },
  ] } as Parameters<typeof commitOperations>[0] & { annotationId: string });
  if (committed.status !== "applied") throw new Error("expected applied");
  await commitOperations({ siteId, baseRevision: committed.record.draft.revision, source: "manual", summary: "后来说明", operations: [{ op: "set_text", target: "hero.subtitle", locale: "zh", value: "later subtitle" }] });
  const undone = await selectiveUndo(siteId, committed.changeSet.id);
  assert.equal(undone.status, "applied");
  assert.deepEqual(undone.conflictTargets, ["hero.subtitle.zh"]);
  const after = (await createSite(siteId)).draft;
  assert.equal(after.content.hero.title.zh, initial.draft.content.hero.title.zh);
  assert.equal(after.content.hero.subtitle.zh, "later subtitle");
});

test("Postgres same-target conflict does not write a new change", async () => {
  const siteId = `t085-pg-conflict-${crypto.randomUUID()}`;
  const initial = await createSite(siteId);
  const annotationId = await makeAnnotation(siteId);
  const committed = await commitOperations({ siteId, baseRevision: initial.draft.revision, source: "ai", summary: "批注", annotationId, operations: [{ op: "set_text", target: "hero.title", locale: "zh", value: "批注标题" }] } as Parameters<typeof commitOperations>[0] & { annotationId: string });
  if (committed.status !== "applied") throw new Error("expected applied");
  await commitOperations({ siteId, baseRevision: committed.record.draft.revision, source: "manual", summary: "后来", operations: [{ op: "set_text", target: "hero.title", locale: "zh", value: "后来标题" }] });
  const before = await createSite(siteId);
  const undone = await selectiveUndo(siteId, committed.changeSet.id);
  assert.equal(undone.status, "conflict");
  const after = await createSite(siteId);
  assert.deepEqual(after.draft, before.draft);
  assert.equal(after.history.length, before.history.length);
});

test("Postgres second selective undo of the same transaction is a conflict", async () => {
  const siteId = `t085-pg-second-${crypto.randomUUID()}`;
  const initial = await createSite(siteId);
  const annotationId = await makeAnnotation(siteId);
  const committed = await commitOperations({ siteId, baseRevision: initial.draft.revision, source: "ai", summary: "批注", annotationId, operations: [{ op: "set_text", target: "hero.title", locale: "zh", value: "批注标题" }] } as Parameters<typeof commitOperations>[0] & { annotationId: string });
  if (committed.status !== "applied") throw new Error("expected applied");
  const first = await selectiveUndo(siteId, committed.changeSet.id);
  assert.equal(first.status, "applied");
  const historyLength = (await createSite(siteId)).history.length;
  const second = await selectiveUndo(siteId, committed.changeSet.id);
  assert.equal(second.status, "conflict");
  assert.equal((await createSite(siteId)).history.length, historyLength);
});

test.after(async () => {
  delete process.env.SITE_STORE;
  const { rm } = await import("node:fs/promises");
  await rm(mockPath, { force: true });
});
