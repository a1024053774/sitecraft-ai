import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { defaultDraft } from "../lib/site-document.ts";
import type { SiteOperation } from "../lib/site-operations.ts";

const previousChrome = process.env.CHROME_PATH;
process.env.CHROME_PATH = "/definitely/missing/sitecraft-chrome";
process.env.SITE_STORE = undefined;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const abs = path.join(process.cwd(), specifier.slice(2));
    let file = abs;
    if (existsSync(`${abs}.ts`)) file = `${abs}.ts`;
    else if (existsSync(path.join(abs, "index.ts"))) file = path.join(abs, "index.ts");
    return nextResolve(pathToFileURL(file).href, context);
  },
});
const { commitOperations, getSite } = await import("../lib/site-store.ts");
const created = new Set<string>();
const options = { templateIds: new Set(["forge", "screwfast", "landwind", "tailwind-landing"]), lastChange: "site-style-commit" };
const style: Extract<SiteOperation, { op: "set_site_style" }> = { op: "set_site_style", direction: null, rules: [{ block: "hero", part: "title", declarations: { "font-size": "64px" } }] };

test.after(async () => {
  process.env.CHROME_PATH = previousChrome;
  await Promise.all([...created].map((siteId) => rm(`${process.cwd()}/.sitecraft-data/sites/${siteId}.json`, { force: true })));
});

function newSite() {
  const siteId = `t054-style-${crypto.randomUUID()}`;
  created.add(siteId);
  return siteId;
}

test("without Chrome a style-only commit is rejected and leaves the draft unchanged", async () => {
  const siteId = newSite();
  const before = await getSite(siteId);
  const result = await commitOperations({ siteId, baseRevision: before.draft.revision, source: "manual", summary: "改首屏", operations: [style] });
  assert.equal(result.status, "rejected");
  if (result.status !== "rejected") throw new Error("expected style rejection");
  assert.match(result.reasons.join("；"), /找不到 Chrome/);
  assert.deepEqual((await getSite(siteId)).draft, before.draft);
});

test("without Chrome a mixed commit keeps ordinary changes and rejects only style", async () => {
  const siteId = newSite();
  const before = await getSite(siteId);
  const result = await commitOperations({
    siteId,
    baseRevision: before.draft.revision,
    source: "manual",
    summary: "改首屏标题和样式",
    operations: [style, { op: "set_text", target: "hero.title", locale: "zh", value: "正常标题" }],
  });
  assert.equal(result.status, "applied");
  if (result.status !== "applied") throw new Error("expected ordinary change to apply");
  assert.ok(result.rejected?.some((reason) => /找不到 Chrome/.test(reason)));
  assert.deepEqual(result.changeSet.operations.map((operation) => operation.op), ["set_text"]);
  const after = await getSite(siteId);
  assert.equal(after.draft.content.hero.title.zh, "正常标题");
  assert.equal(after.draft.siteStyle, undefined);
});
