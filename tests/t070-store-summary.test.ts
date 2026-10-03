import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import test from "node:test";

const repoRoot = process.cwd();
const mockPath = path.join("/tmp", `sitecraft-t070-postgres-${process.pid}.ts`);
await writeFile(mockPath, `
const rows = new Map();
function row(siteId) {
  const current = rows.get(siteId);
  return current ? { ...current, draft: structuredClone(current.draft), history: structuredClone(current.history), future: structuredClone(current.future) } : null;
}
async function query(sql, params = []) {
  if (sql.includes("INSERT INTO sitecraft_sites")) {
    const siteId = params[1];
    if (rows.has(siteId)) return { rowCount: 0, rows: [] };
    rows.set(siteId, { site_id: siteId, draft: JSON.parse(params[2]), history: [], future: [], history_schema_version: 3, updated_at: params[4] });
    return { rowCount: 1, rows: [] };
  }
  if (sql.trimStart().startsWith("SELECT")) {
    const current = row(params[1]);
    return { rowCount: current ? 1 : 0, rows: current ? [current] : [] };
  }
  if (sql.includes("UPDATE sitecraft_sites")) {
    rows.set(params[1], { site_id: params[1], draft: JSON.parse(params[2]), history: JSON.parse(params[3]), future: JSON.parse(params[4]), history_schema_version: params[5], updated_at: params[6] });
    return { rowCount: 1, rows: [] };
  }
  throw new Error("unexpected postgres mock query");
}
export async function ensureDatabaseSchema() {}
export function getDatabasePool() { return { query }; }
export async function withDatabaseTransaction(task) { return task({ query }); }
` , "utf8");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/postgres") return { url: pathToFileURL(mockPath).href, shortCircuit: true };
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const abs = path.join(repoRoot, specifier.slice(2));
    const file = existsSync(`${abs}.ts`) ? `${abs}.ts` : abs;
    return { url: pathToFileURL(file).href, shortCircuit: true };
  },
});

const storePath = pathToFileURL(path.join(repoRoot, "lib/site-store.ts")).href;
const textOperation = { op: "set_text", target: "hero.title", value: { zh: "按图加工重载减速机", en: "Heavy-duty gearboxes to drawing" } } as const;
const summaries = new Set<string>();
const siteIds: string[] = [];

async function assertStoreSummary(mode: "fs" | "postgres", suffix: string) {
  process.env.SITE_STORE = mode;
  const store = await import(`${storePath}?t070-${mode}-${suffix}`) as typeof import("../lib/site-store.ts");
  const siteId = `t070-${mode}-${crypto.randomUUID()}`;
  siteIds.push(siteId);
  const before = await store.getSite(siteId);
  const committed = await store.commitOperations({
    siteId,
    baseRevision: before.draft.revision,
    operations: [textOperation],
    summary: "为了在右边预留照片区域",
    source: "ai",
  });
  assert.equal(committed.status, "applied");
  if (committed.status !== "applied") throw new Error("expected applied change");
  assert.equal(committed.changeSet.summary, "已更新：首屏标题。");
  const reread = await store.getSite(siteId);
  assert.equal(reread.history[0]?.summary, committed.changeSet.summary);
  summaries.add(reread.history[0]?.summary ?? "");
}

test("T-070 FS and Postgres commits persist the same target-only ChangeSet summary", async () => {
  await assertStoreSummary("fs", "fs");
  await assertStoreSummary("postgres", "postgres");
  assert.deepEqual([...summaries], ["已更新：首屏标题。"]);
});

test.after(async () => {
  await Promise.all(siteIds.map((siteId) => rm(path.join(repoRoot, ".sitecraft-data", "sites", `${siteId}.json`), { force: true })));
  await rm(mockPath, { force: true });
  delete process.env.SITE_STORE;
});
