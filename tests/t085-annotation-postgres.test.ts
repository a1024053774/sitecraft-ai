import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const repoRoot = process.cwd();
const mockPath = path.join("/tmp", `sitecraft-t085-annotation-postgres-${process.pid}.ts`);
await writeFile(mockPath, `
const rows = new Map();
const key = (workspace, site, id) => workspace + "\\0" + site + "\\0" + id;
async function query(sql, params = []) {
  if (sql.includes("INSERT INTO sitecraft_annotations")) {
    rows.set(key(params[0], params[1], params[2]), JSON.parse(params[3]));
    return { rowCount: 1, rows: [] };
  }
  if (sql.includes("SELECT annotation FROM sitecraft_annotations") && sql.includes("annotation_id = $3")) {
    const value = rows.get(key(params[0], params[1], params[2]));
    return { rowCount: value ? 1 : 0, rows: value ? [{ annotation: value }] : [] };
  }
  if (sql.includes("SELECT annotation FROM sitecraft_annotations")) {
    const prefix = params[0] + "\\0" + params[1] + "\\0";
    const selected = [...rows].filter(([id]) => id.startsWith(prefix)).map(([, annotation]) => ({ annotation }));
    return { rowCount: selected.length, rows: selected };
  }
  if (sql.includes("UPDATE sitecraft_annotations")) {
    rows.set(key(params[0], params[1], params[2]), JSON.parse(params[3]));
    return { rowCount: 1, rows: [] };
  }
  if (sql.includes("DELETE FROM sitecraft_annotations")) {
    const deleted = rows.delete(key(params[0], params[1], params[2]));
    return { rowCount: deleted ? 1 : 0, rows: [] };
  }
  throw new Error("unexpected annotation postgres mock query: " + sql);
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
const store = await import("../lib/annotation-store.ts");

const anchor = {
  pageId: "home",
  pagePath: "/",
  templateId: "screwfast",
  revision: 0,
  locale: "zh" as const,
  viewport: { width: 1440, height: 900, device: "desktop" as const },
  scroll: { x: 0, y: 0 },
  target: { kind: "slot" as const, slot: "hero.title", section: "hero", locale: "zh" as const },
  rect: { x: 0, y: 0, width: 1, height: 1, space: "target-ratio" as const },
  snapshot: { text: "标题" },
  capturedAt: new Date().toISOString(),
};

test("Postgres annotation store uses the same thread contract", async () => {
  const siteId = `t085-pg-${crypto.randomUUID()}`;
  const created = await store.createAnnotation({ siteId, pageId: "home", pagePath: "/", anchor, body: "改标题", author: { id: "u1", name: "用户" } });
  assert.equal((await store.listAnnotations(siteId)).length, 1);
  const replied = await store.replyAnnotation(siteId, created.id, { body: "补充说明", author: { id: "u2", name: "审核者" } });
  assert.equal(replied.comments.length, 2);
  const resolved = await store.resolveAnnotation(siteId, created.id, true);
  assert.equal(resolved.status, "resolved");
});

test.after(async () => {
  delete process.env.SITE_STORE;
  const { rm } = await import("node:fs/promises");
  await rm(mockPath, { force: true });
});
