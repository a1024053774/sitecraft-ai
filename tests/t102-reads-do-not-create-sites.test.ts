import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

function sitePath(siteId: string) {
  return path.join(process.cwd(), ".sitecraft-data", "sites", `${siteId}.json`);
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const abs = path.join(process.cwd(), specifier.slice(2));
    const file = existsSync(`${abs}.ts`) ? `${abs}.ts` : path.join(abs, "index.ts");
    return nextResolve(pathToFileURL(file).href, context);
  },
});

const draftRoute = await import(pathToFileURL(path.join(process.cwd(), "app/api/sites/[siteId]/draft/route.ts")).href);
const chatRoute = await import(pathToFileURL(path.join(process.cwd(), "app/api/sites/[siteId]/chat/route.ts")).href);
const qualityRoute = await import(pathToFileURL(path.join(process.cwd(), "app/api/quality/cells/route.ts")).href);
const sitesRoute = await import(pathToFileURL(path.join(process.cwd(), "app/api/sites/route.ts")).href);
const siteStore = await import("../lib/site-store.ts");
const base = process.env.SITECRAFT_BASE || "http://127.0.0.1:3062";

const missingIds = [
  `t102-missing-${crypto.randomUUID().slice(0, 8)}`,
  "p4-sw-bright",
  "p4-sw-eng",
  "p4-long",
];

test.after(async () => {
  await Promise.all(missingIds.map((siteId) => rm(sitePath(siteId), { force: true })));
});

test("GET draft for a missing site returns 404 without creating a record", async () => {
  const siteId = missingIds[0];
  const response = await draftRoute.GET(new Request(`http://sitecraft.test/api/sites/${siteId}/draft`), { params: Promise.resolve({ siteId }) });
  assert.equal(response.status, 404);
  assert.equal(existsSync(sitePath(siteId)), false);
});

test("PUT draft for a missing site returns 404 without creating a record", async () => {
  const siteId = `t102-put-${crypto.randomUUID().slice(0, 8)}`;
  const response = await draftRoute.PUT(new Request(`http://sitecraft.test/api/sites/${siteId}/draft`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baseRevision: 1, operations: [{ op: "set_text", target: "hero.title", locale: "zh", value: "T102" }], summary: "T102 missing", source: "manual" }),
  }), { params: Promise.resolve({ siteId }) });
  assert.equal(response.status, 404);
  assert.equal(existsSync(sitePath(siteId)), false);
});

test("store commit and history paths reject a missing site instead of creating it", async () => {
  const siteId = `t102-store-${crypto.randomUUID().slice(0, 8)}`;
  await assert.rejects(() => siteStore.commitOperations({
    siteId,
    baseRevision: 1,
    operations: [{ op: "set_text", target: "hero.title", locale: "zh", value: "T102" }],
    summary: "T102 missing store",
    source: "manual",
  }), /Site not found/);
  await assert.rejects(() => siteStore.moveHistory(siteId, "undo"), /Site not found/);
  assert.equal(await siteStore.getExistingSite(siteId), null);
  assert.equal(existsSync(sitePath(siteId)), false);
});

test("a missing published site is a 404 without a default empty draft", async () => {
  const siteId = `t102-published-${crypto.randomUUID().slice(0, 8)}`;
  const response = await fetch(`${base}/published/${siteId}`);
  assert.equal(response.status, 404);
  assert.equal(existsSync(sitePath(siteId)), false);
});

test("quality matrix reports a missing fixed site instead of creating it", async () => {
  await Promise.all(["p4-sw-bright", "p4-sw-eng", "p4-long"].map((siteId) => rm(sitePath(siteId), { force: true })));
  const response = await qualityRoute.GET();
  assert.equal(response.status, 404);
  for (const siteId of ["p4-sw-bright", "p4-sw-eng", "p4-long"]) assert.equal(existsSync(sitePath(siteId)), false);
});

test("chat on a missing site returns site_not_found without creating it", async () => {
  const siteId = `t102-chat-${crypto.randomUUID().slice(0, 8)}`;
  const response = await chatRoute.POST(new Request(`http://sitecraft.test/api/sites/${siteId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baseRevision: 1, message: "读取当前站点" }),
  }), { params: Promise.resolve({ siteId }) });
  assert.equal(response.status, 404);
  assert.equal(existsSync(sitePath(siteId)), false);
});

test("workspace creation remains explicit through POST and its draft can be reread", async () => {
  const response = await sitesRoute.POST(new Request("http://sitecraft.test/api/sites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "T102 explicit site", templateId: "forge", locales: ["zh", "en"] }),
  }));
  assert.equal(response.status, 201);
  const body = await response.json() as { id: string };
  assert.equal(existsSync(sitePath(body.id)), true);
  const draft = await draftRoute.GET(new Request(`http://sitecraft.test/api/sites/${body.id}/draft`), { params: Promise.resolve({ siteId: body.id }) });
  assert.equal(draft.status, 200);
  await rm(sitePath(body.id), { force: true });
});
