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
  const siteId = `p5lead-${crypto.randomUUID().slice(0, 8)}`;
  createdSiteIds.add(siteId);
  return siteId;
}

function siteRecordPath(siteId: string) {
  return path.join(process.cwd(), ".sitecraft-data", "sites", `${siteId}.json`);
}

function leadRecordPath(siteId: string) {
  return path.join(process.cwd(), ".sitecraft-data", "leads", workspaceId, `${siteId}.json`);
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const abs = path.join(process.cwd(), specifier.slice(2));
    const file = existsSync(`${abs}.ts`) ? `${abs}.ts` : abs;
    return nextResolve(pathToFileURL(file).href, context);
  },
});

const { createLead, LeadStoreError, listLeads } = await import("../lib/lead-store.ts") as typeof import("../lib/lead-store.ts");
const { getExistingSite, getSite } = await import("../lib/site-store.ts") as typeof import("../lib/site-store.ts");
const { POST } = await import(pathToFileURL(path.join(process.cwd(), "app/api/public/[siteKey]/leads/route.ts")).href) as {
  POST: (request: Request, context: { params: Promise<{ siteKey: string }> }) => Promise<Response>;
};
const { GET } = await import(pathToFileURL(path.join(process.cwd(), "app/api/leads/route.ts")).href) as {
  GET: (request: Request) => Promise<Response>;
};

test.after(async () => {
  await Promise.all([...createdSiteIds].flatMap((siteId) => [
    rm(siteRecordPath(siteId), { force: true }),
    rm(leadRecordPath(siteId), { force: true }),
  ]));
});

test("lead-store tests require the development-file driver", () => {
  assert.notEqual(process.env.SITE_STORE, "postgres");
  assert.notEqual(process.env.NODE_ENV, "production");
});

test("unknown site keys are not created when an inquiry is refused", async () => {
  const siteId = uniqueSiteId();
  await assert.rejects(() => createLead({
    siteId,
    name: "P5LEAD Sender",
    email: "sender@p5lead.test",
    message: "P5LEAD-MISSING-HX7K should not persist",
  }), (error: unknown) => {
    assert.equal(error instanceof LeadStoreError, true);
    assert.equal(error instanceof LeadStoreError && error.code, "not_found");
    return true;
  });
  assert.equal(existsSync(siteRecordPath(siteId)), false);
  assert.equal(existsSync(leadRecordPath(siteId)), false);
  assert.equal(await getExistingSite(siteId), null);
});

test("a saved inquiry rereads the same payload and stays on its site", async () => {
  const siteA = uniqueSiteId();
  const siteB = uniqueSiteId();
  await getSite(siteA);
  await getSite(siteB);
  const message = "P5LEAD-STORE-HX7K 只要这一条原文";
  const saved = await createLead({
    siteId: siteA,
    name: "P5LEAD 甲方",
    email: "buyer@p5lead.test",
    company: "P5LEAD 模拟厂",
    message,
  });
  assert.match(saved.id, /^lead_[a-z0-9]{16,40}$/);
  assert.equal(saved.siteId, siteA);
  assert.equal(saved.message, message);

  const reread = await listLeads({ siteId: siteA });
  assert.equal(reread.length, 1);
  assert.equal(reread[0]?.id, saved.id);
  assert.equal(reread[0]?.email, "buyer@p5lead.test");
  assert.equal(reread[0]?.company, "P5LEAD 模拟厂");
  assert.equal(reread[0]?.message, message);
  assert.equal("workspaceId" in (reread[0] ?? {}), false);

  const other = await listLeads({ siteId: siteB });
  assert.equal(other.some((item) => item.message.includes("P5LEAD-STORE-HX7K")), false);
});

test("public POST persists one inquiry that the inbox GET can read", async () => {
  const siteId = uniqueSiteId();
  await getSite(siteId);
  const message = "P5LEAD-ROUTE-HX7K 发布页发出去必须能读到";
  const created = await POST(new Request(`http://sitecraft.test/api/public/${siteId}/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Route Sender",
      email: "route@p5lead.test",
      company: "Route Co",
      message,
    }),
  }), { params: Promise.resolve({ siteKey: siteId }) });
  assert.equal(created.status, 201);
  const receipt = await created.json() as { id?: string; siteKey?: string };
  assert.equal(receipt.siteKey, siteId);
  assert.match(String(receipt.id), /^lead_/);

  const inbox = await GET(new Request(`http://sitecraft.test/api/leads?site=${siteId}`));
  assert.equal(inbox.status, 200);
  const payload = await inbox.json() as { leads: Array<{ id: string; message: string; email: string }> };
  assert.equal(payload.leads.length, 1);
  assert.equal(payload.leads[0]?.id, receipt.id);
  assert.equal(payload.leads[0]?.message, message);
  assert.equal(payload.leads[0]?.email, "route@p5lead.test");
});

test("honeypot receipts are accepted without writing an inbox row", async () => {
  const siteId = uniqueSiteId();
  await getSite(siteId);
  const created = await POST(new Request(`http://sitecraft.test/api/public/${siteId}/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Bot",
      email: "bot@p5lead.test",
      message: "P5LEAD-HONEYPOT-HX7K should vanish",
      honeypot: "http://spam.test",
    }),
  }), { params: Promise.resolve({ siteKey: siteId }) });
  assert.equal(created.status, 201);
  const receipt = await created.json() as { id?: string; status?: string };
  assert.equal(receipt.id, undefined);
  assert.equal(receipt.status, "accepted");
  const inbox = await listLeads({ siteId });
  assert.equal(inbox.some((item) => item.message.includes("P5LEAD-HONEYPOT-HX7K")), false);
});

test("public POST to a missing site does not create a draft file", async () => {
  const siteId = uniqueSiteId();
  const created = await POST(new Request(`http://sitecraft.test/api/public/${siteId}/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Ghost",
      email: "ghost@p5lead.test",
      message: "P5LEAD-GHOST-HX7K",
    }),
  }), { params: Promise.resolve({ siteKey: siteId }) });
  assert.equal(created.status, 404);
  assert.equal(existsSync(siteRecordPath(siteId)), false);
  assert.equal(existsSync(leadRecordPath(siteId)), false);
});

test("inbox pages stop advertising fake companies and a live mailbox", () => {
  const publicRoute = readFileSync(new URL("../app/api/public/[siteKey]/leads/route.ts", import.meta.url), "utf8");
  const leadsPage = readFileSync(new URL("../app/leads/page.tsx", import.meta.url), "utf8");
  const settingsPage = readFileSync(new URL("../app/settings/page.tsx", import.meta.url), "utf8");
  const publishedClient = readFileSync(new URL("../app/published/[siteKey]/published-client.tsx", import.meta.url), "utf8");
  const sidebar = readFileSync(new URL("../components/app-sidebar.tsx", import.meta.url), "utf8");
  assert.match(publicRoute, /createLead/);
  assert.equal(publicRoute.includes("getSite("), false);
  assert.match(leadsPage, /listLeads/);
  assert.equal(leadsPage.includes("Keller Automation"), false);
  assert.equal(leadsPage.includes("Nordic Process"), false);
  assert.match(settingsPage, /询盘收件/);
  assert.equal(settingsPage.includes("lydia@sitecraft.ai"), false);
  assert.match(publishedClient, /\/api\/public\/\$\{encodeURIComponent\(siteKey\)\}\/leads/);
  assert.match(publishedClient, /published-inquiry-form/);
  assert.match(publishedClient, /onInquiry/);
  assert.equal(/count:\s*4/.test(sidebar), false);
  const forgeContact = readFileSync(new URL("../vendor/open-source-templates/small-bis/dist/Contact/index.html", import.meta.url), "utf8");
  assert.equal(forgeContact.toLowerCase().includes("web3forms"), false);
  assert.match(forgeContact, /data-sitecraft-inquiry="true"/);
});
