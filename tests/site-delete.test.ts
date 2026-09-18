import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const createdSiteIds = new Set<string>();
const workspaceId = process.env.DEFAULT_WORKSPACE_ID || "demo";

function uniqueSiteId() {
  const siteId = `p5del-${crypto.randomUUID().slice(0, 8)}`;
  createdSiteIds.add(siteId);
  return siteId;
}

function siteRecordPath(siteId: string) {
  return path.join(process.cwd(), ".sitecraft-data", "sites", `${siteId}.json`);
}

function conversationDir(siteId: string) {
  return path.join(process.cwd(), ".sitecraft-data", "conversations", siteId);
}

function leadRecordPath(siteId: string) {
  return path.join(process.cwd(), ".sitecraft-data", "leads", workspaceId, `${siteId}.json`);
}

function uploadDir(siteId: string) {
  return path.join(process.cwd(), ".sitecraft-data", "uploads", workspaceId, siteId);
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const abs = path.join(process.cwd(), specifier.slice(2));
    const file = existsSync(`${abs}.ts`) ? `${abs}.ts` : abs;
    return nextResolve(pathToFileURL(file).href, context);
  },
});

const { createLead } = await import("../lib/lead-store.ts") as typeof import("../lib/lead-store.ts");
const { createConversation } = await import("../lib/conversation-store.ts") as typeof import("../lib/conversation-store.ts");
const { getExistingSite, getSite } = await import("../lib/site-store.ts") as typeof import("../lib/site-store.ts");
const { deleteSiteByUserChoice, SiteDeleteError } = await import("../lib/site-delete.ts") as typeof import("../lib/site-delete.ts");
const { DELETE } = await import(pathToFileURL(path.join(process.cwd(), "app/api/sites/[siteId]/route.ts")).href) as {
  DELETE: (request: Request, context: { params: Promise<{ siteId: string }> }) => Promise<Response>;
};

test.after(async () => {
  await Promise.all([...createdSiteIds].flatMap((siteId) => [
    rm(siteRecordPath(siteId), { force: true }),
    rm(conversationDir(siteId), { recursive: true, force: true }),
    rm(leadRecordPath(siteId), { force: true }),
    rm(uploadDir(siteId), { recursive: true, force: true }),
  ]));
});

test("site-delete tests require the development-file driver", () => {
  assert.notEqual(process.env.SITE_STORE, "postgres");
  assert.notEqual(process.env.NODE_ENV, "production");
});

test("a mismatched confirmation leaves the site, conversation and inquiry in place", async () => {
  const siteId = uniqueSiteId();
  await getSite(siteId);
  await createConversation(siteId);
  await createLead({
    siteId,
    name: "Keep Me",
    email: "keep@p5del.test",
    message: "P5DEL-KEEP-HX7K must remain",
  });
  await assert.rejects(
    () => deleteSiteByUserChoice(siteId, `${siteId}-nope`),
    (error: unknown) => {
      assert.equal(error instanceof SiteDeleteError, true);
      assert.equal(error instanceof SiteDeleteError && error.code, "unconfirmed");
      return true;
    },
  );
  assert.equal(existsSync(siteRecordPath(siteId)), true);
  assert.equal(existsSync(conversationDir(siteId)), true);
  assert.equal(existsSync(leadRecordPath(siteId)), true);
  assert.equal(Boolean(await getExistingSite(siteId)), true);
});

test("typing the site id deletes draft, conversation and inquiry without recreating them", async () => {
  const siteId = uniqueSiteId();
  await getSite(siteId);
  await createConversation(siteId);
  await createLead({
    siteId,
    name: "Drop Me",
    email: "drop@p5del.test",
    message: "P5DEL-DROP-HX7K should vanish",
  });
  const result = await deleteSiteByUserChoice(siteId, siteId);
  assert.equal(result.deleted, true);
  assert.equal(existsSync(siteRecordPath(siteId)), false);
  assert.equal(existsSync(conversationDir(siteId)), false);
  assert.equal(existsSync(leadRecordPath(siteId)), false);
  assert.equal(await getExistingSite(siteId), null);
});

test("DELETE without a matching confirmSiteId does not remove the site file", async () => {
  const siteId = uniqueSiteId();
  await getSite(siteId);
  const refused = await DELETE(new Request(`http://sitecraft.test/api/sites/${siteId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  }), { params: Promise.resolve({ siteId }) });
  assert.equal(refused.status, 400);
  assert.equal(existsSync(siteRecordPath(siteId)), true);

  const missing = await DELETE(new Request(`http://sitecraft.test/api/sites/${siteId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmSiteId: siteId }),
  }), { params: Promise.resolve({ siteId }) });
  assert.equal(missing.status, 200);
  const payload = await missing.json() as { deleted?: boolean };
  assert.equal(payload.deleted, true);
  assert.equal(existsSync(siteRecordPath(siteId)), false);
});

test("delete UI requires typed confirmation and does not schedule cleanup", () => {
  const panel = readFileSync(new URL("../components/site-delete-panel.tsx", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/sites/[siteId]/route.ts", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../app/workspace/page.tsx", import.meta.url), "utf8");
  const settings = readFileSync(new URL("../app/settings/page.tsx", import.meta.url), "utf8");
  assert.match(panel, /confirmSiteId/);
  assert.match(panel, /typed === siteId/);
  assert.match(panel, /workspaceHref/);
  assert.match(panel, /publishedHref/);
  assert.match(panel, /useSitePreview/);
  assert.equal(panel.includes("delete-site-board"), false);
  assert.equal(panel.includes("<iframe"), false);
  assert.equal(panel.includes("setInterval"), false);
  assert.equal(panel.includes("90"), false);
  assert.match(route, /deleteSiteByUserChoice/);
  assert.equal(route.includes("getSite("), false);
  assert.match(workspace, /toolbar-delete-site/);
  assert.match(settings, /SiteDeleteSettings/);
});
