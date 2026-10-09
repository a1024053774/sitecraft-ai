import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { annotationCurrentSchema, annotationTargetSchema } from "../lib/annotations.ts";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const absolute = path.join(process.cwd(), specifier.slice(2));
    const file = existsSync(`${absolute}.ts`) ? `${absolute}.ts` : absolute;
    return nextResolve(pathToFileURL(file).href, context);
  },
});


const { createAnnotation, listAnnotations, replyAnnotation, resolveAnnotation } = await import("../lib/annotation-store.ts");
const {createCodeSite,getCodeSite}=await import('../lib/code-site-store.ts');
const createSite=(id:string)=>createCodeSite(id,id,crypto.randomUUID());
const annotationsRoute = await import("../app/api/sites/[siteId]/annotations/route.ts");
const annotationRoute = await import("../app/api/sites/[siteId]/annotations/[annotationId]/route.ts");
const repliesRoute = await import("../app/api/sites/[siteId]/annotations/[annotationId]/replies/route.ts");

const createdSites = new Set<string>();

function newSiteId() {
  const siteId = `t085-${crypto.randomUUID()}`;
  createdSites.add(siteId);
  return siteId;
}

function annotationInput(siteId: string) {
  return {
    siteId,
    pageId: "home",
    pagePath: "/",
    anchor: {
      pageId: "home",
      pagePath: "/",
      templateId: "screwfast",
      revision: 0,
      locale: "zh" as const,
      viewport: { width: 1440, height: 900, device: "desktop" as const },
      scroll: { x: 0, y: 120 },
      target: { kind: "slot" as const, slot: "products.product-a.name.zh", section: "products", productId: "product-a", locale: "zh" as const },
      rect: { x: 0.1, y: 0.2, width: 0.4, height: 0.1, space: "target-ratio" as const },
      snapshot: { text: "产品 A", label: "产品名称", tag: "h3" },
      capturedAt: new Date().toISOString(),
    },
    body: "把产品标题改得更明确",
    author: { id: "workspace", name: "工作台" },
  };
}

test.after(async () => {
  await Promise.all([...createdSites].map((siteId) => rm(`${process.cwd()}/.sitecraft-data/code-sites/${siteId}.json`, { force: true })));
  await Promise.all([...createdSites].map((siteId) => rm(`${process.cwd()}/.sitecraft-data/annotations/${siteId}.json`, { force: true })));
});

test("annotation CRUD is independent from draft revision", async () => {
  const siteId = newSiteId();
  const before = await createSite(siteId);
  const created = await createAnnotation(annotationInput(siteId));
  assert.equal((await getCodeSite(siteId))!.versions.length, before.versions.length);
  assert.equal((await listAnnotations(siteId)).length, 1);
  const replied = await replyAnnotation(siteId, created.id, { body: "已补充说明", author: { id: "reviewer", name: "审核者" } });
  assert.equal(replied.comments.length, 2);
  const resolved = await resolveAnnotation(siteId, created.id, true);
  assert.equal(resolved.status, "resolved");
  assert.equal((await getCodeSite(siteId))!.versions.length, before.versions.length);
});

test("annotation contract rejects an unowned primary slot and accepts stale state", () => {
  assert.equal(annotationTargetSchema.safeParse({ kind: "region", slots: ["hero.title"], primarySlot: "products.card" }).success, false);
  assert.equal(annotationCurrentSchema.safeParse({ state: "stale", revision: 4, reason: "slot missing" }).success, true);
  assert.equal(annotationCurrentSchema.safeParse({ state: "attached", revision: 4 }).success, true);
});

test("annotation API creates, filters, replies, resolves, and deletes explicitly", async () => {
  const siteId = newSiteId();
  const input = annotationInput(siteId);
  const createdResponse = await annotationsRoute.POST(new Request("http://sitecraft.test", { method: "POST", body: JSON.stringify(input) }), { params: Promise.resolve({ siteId }) });
  assert.equal(createdResponse.status, 201);
  const created = (await createdResponse.json() as { annotation: { id: string } }).annotation;
  const listedResponse = await annotationsRoute.GET(new Request("http://sitecraft.test? pageId=home".replace("? ", "?")), { params: Promise.resolve({ siteId }) });
  assert.equal(listedResponse.status, 200);
  assert.equal((await listedResponse.json() as { annotations: unknown[] }).annotations.length, 1);
  const replyResponse = await repliesRoute.POST(new Request("http://sitecraft.test", { method: "POST", body: JSON.stringify({ body: "回复", author: { id: "reviewer", name: "审核者" } }) }), { params: Promise.resolve({ siteId, annotationId: created.id }) });
  assert.equal(replyResponse.status, 201);
  const resolveResponse = await annotationRoute.PATCH(new Request("http://sitecraft.test", { method: "PATCH", body: JSON.stringify({ status: "resolved" }) }), { params: Promise.resolve({ siteId, annotationId: created.id }) });
  assert.equal(resolveResponse.status, 200);
  const deleteResponse = await annotationRoute.DELETE(new Request("http://sitecraft.test", { method: "DELETE" }), { params: Promise.resolve({ siteId, annotationId: created.id }) });
  assert.equal(deleteResponse.status, 200);
  assert.equal((await listAnnotations(siteId)).length, 0);
});
