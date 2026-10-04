import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const absolute = path.join(process.cwd(), specifier.slice(2));
    const file = existsSync(`${absolute}.ts`) ? `${absolute}.ts` : absolute;
    return nextResolve(pathToFileURL(file).href, context);
  },
});

const { commitOperations, createSite, selectiveUndo } = await import("../lib/site-store.ts");
const { createAnnotation } = await import("../lib/annotation-store.ts");
const { PUT } = await import("../app/api/sites/[siteId]/draft/route.ts");

const createdSites = new Set<string>();
function siteId() {
  const value = `t085-review-${crypto.randomUUID()}`;
  createdSites.add(value);
  return value;
}
async function annotation(site: string) {
  const created = await createAnnotation({
    siteId: site,
    pageId: "home",
    pagePath: "/",
    anchor: {
      pageId: "home", pagePath: "/", templateId: "screwfast", revision: 0, locale: "zh",
      viewport: { width: 1440, height: 900, device: "desktop" }, scroll: { x: 0, y: 0 },
      target: { kind: "slot", slot: "hero.title", section: "hero", locale: "zh" },
      rect: { x: 0, y: 0, width: 1, height: 1, space: "target-ratio" }, snapshot: { text: "标题" }, capturedAt: new Date().toISOString(),
    },
    body: "批注", author: { id: "reviewer", name: "审核者" },
  });
  return created.id;
}

test.after(async () => {
  await Promise.all([...createdSites].flatMap((id) => [
    rm(`${process.cwd()}/.sitecraft-data/sites/${id}.json`, { force: true }),
    rm(`${process.cwd()}/.sitecraft-data/annotations/${id}.json`, { force: true }),
  ]));
});

test("bilingual set_text selective undo keeps the later locale conflict and restores the other locale", async () => {
  const site = siteId();
  const initial = await createSite(site);
  const annotationId = await annotation(site);
  const committed = await commitOperations({ siteId: site, baseRevision: initial.draft.revision, source: "ai", summary: "双语批注", annotationId,
    operations: [{ op: "set_text", target: "hero.title", value: { zh: "批注中文", en: "Annotation English" } }] } as Parameters<typeof commitOperations>[0] & { annotationId: string });
  assert.equal(committed.status, "applied");
  if (committed.status !== "applied") throw new Error("expected applied");
  await commitOperations({ siteId: site, baseRevision: committed.record.draft.revision, source: "manual", summary: "后来中文", operations: [{ op: "set_text", target: "hero.title", locale: "zh", value: "后来中文" }] });
  const undone = await selectiveUndo(site, committed.changeSet.id);
  assert.equal(undone.status, "applied");
  assert.deepEqual(undone.conflictTargets, ["hero.title.zh"]);
  assert.equal((await createSite(site)).draft.content.hero.title.zh, "后来中文");
  assert.equal((await createSite(site)).draft.content.hero.title.en, initial.draft.content.hero.title.en);
});

test("all top-level and navigation text targets detect later edits", async () => {
  const targets = ["siteName", "companyName", "industry", "goal", "navigation.about", "navigation.features", "navigation.services", "navigation.products", "navigation.contact"] as const;
  for (const target of targets) {
    const site = siteId();
    const initial = await createSite(site);
    const annotationId = await annotation(site);
    const committed = await commitOperations({ siteId: site, baseRevision: initial.draft.revision, source: "ai", summary: target, annotationId,
      operations: [{ op: "set_text", target, locale: "zh", value: `批注-${target}` }] } as Parameters<typeof commitOperations>[0] & { annotationId: string });
    assert.equal(committed.status, "applied", target);
    if (committed.status !== "applied") continue;
    await commitOperations({ siteId: site, baseRevision: committed.record.draft.revision, source: "manual", summary: `后来-${target}`, operations: [{ op: "set_text", target, locale: "zh", value: `后来-${target}` }] });
    const undone = await selectiveUndo(site, committed.changeSet.id);
    assert.equal(undone.status, "conflict", target);
    assert.deepEqual(undone.conflictTargets, [`${target}.zh`], target);
  }
});

test("commitOperations rejects a missing or cross-site annotation before changing the draft", async () => {
  const site = siteId();
  const otherSite = siteId();
  const before = await createSite(site);
  const otherAnnotation = await annotation(otherSite);
  await assert.rejects(() => commitOperations({ siteId: site, baseRevision: before.draft.revision, source: "ai", summary: "伪造批注", annotationId: "missing-annotation",
    operations: [{ op: "set_text", target: "hero.title", locale: "zh", value: "不应写入" }] } as Parameters<typeof commitOperations>[0] & { annotationId: string }));
  await assert.rejects(() => commitOperations({ siteId: site, baseRevision: before.draft.revision, source: "ai", summary: "跨站批注", annotationId: otherAnnotation,
    operations: [{ op: "set_text", target: "hero.title", locale: "zh", value: "不应写入" }] } as Parameters<typeof commitOperations>[0] & { annotationId: string }));
  assert.deepEqual((await createSite(site)).draft, before.draft);
});

test("draft HTTP rejects a missing annotation without changing the draft", async () => {
  const site = siteId();
  const before = await createSite(site);
  const response = await PUT(new Request("http://sitecraft.test", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
    baseRevision: before.draft.revision, annotationId: "missing-annotation", source: "manual", summary: "伪造批注", operations: [{ op: "set_text", target: "hero.title", locale: "zh", value: "不应写入" }],
  }) }), { params: Promise.resolve({ siteId: site }) });
  assert.equal(response.status, 422);
  assert.deepEqual((await createSite(site)).draft, before.draft);
});

test("one target written twice in one transaction undoes to its transaction-start value", async () => {
  const site = siteId();
  const initial = await createSite(site);
  const annotationId = await annotation(site);
  const committed = await commitOperations({ siteId: site, baseRevision: initial.draft.revision, source: "ai", summary: "重复标题", annotationId,
    operations: [
      { op: "set_text", target: "hero.title", locale: "zh", value: "one" },
      { op: "set_text", target: "hero.title", locale: "zh", value: "two" },
    ] } as Parameters<typeof commitOperations>[0] & { annotationId: string });
  assert.equal(committed.status, "applied");
  if (committed.status !== "applied") throw new Error("expected applied");
  const undone = await selectiveUndo(site, committed.changeSet.id);
  assert.equal(undone.status, "applied");
  assert.deepEqual(undone.conflictTargets, []);
  assert.equal((await createSite(site)).draft.content.hero.title.zh, initial.draft.content.hero.title.zh);
});

test("repeated target plus later edit of another target restores the repeated target and reports only the later conflict", async () => {
  const site = siteId();
  const initial = await createSite(site);
  const annotationId = await annotation(site);
  const committed = await commitOperations({ siteId: site, baseRevision: initial.draft.revision, source: "ai", summary: "重复混合", annotationId,
    operations: [
      { op: "set_text", target: "hero.title", locale: "zh", value: "one" },
      { op: "set_text", target: "hero.title", locale: "zh", value: "two" },
      { op: "set_text", target: "hero.subtitle", locale: "zh", value: "batch subtitle" },
    ] } as Parameters<typeof commitOperations>[0] & { annotationId: string });
  assert.equal(committed.status, "applied");
  if (committed.status !== "applied") throw new Error("expected applied");
  await commitOperations({ siteId: site, baseRevision: committed.record.draft.revision, source: "manual", summary: "后来说明", operations: [{ op: "set_text", target: "hero.subtitle", locale: "zh", value: "later subtitle" }] });
  const undone = await selectiveUndo(site, committed.changeSet.id);
  assert.equal(undone.status, "applied");
  assert.deepEqual(undone.conflictTargets, ["hero.subtitle.zh"]);
  const after = (await createSite(site)).draft;
  assert.equal(after.content.hero.title.zh, initial.draft.content.hero.title.zh);
  assert.equal(after.content.hero.subtitle.zh, "later subtitle");
});

test("card add/remove selective undo and unsupported replacement operations have explicit outcomes", async () => {
  const site = siteId();
  const initial = await createSite(site);
  const addAnnotation = await annotation(site);
  const card = { id: "review-card", title: { zh: "新增", en: "Added" }, body: { zh: "新增说明", en: "Added body" } };
  const added = await commitOperations({ siteId: site, baseRevision: initial.draft.revision, source: "ai", summary: "新增卡片", annotationId: addAnnotation, operations: [{ op: "add_card", section: "services", item: card }] } as Parameters<typeof commitOperations>[0] & { annotationId: string });
  assert.equal(added.status, "applied");
  if (added.status !== "applied") throw new Error("expected applied");
  assert.equal((await selectiveUndo(site, added.changeSet.id)).status, "applied");
  const seeded = await createSite(site);
  const existing = seeded.draft.content.services.items[0];
  const removeAnnotation = await annotation(site);
  const removed = await commitOperations({ siteId: site, baseRevision: seeded.draft.revision, source: "ai", summary: "删除卡片", annotationId: removeAnnotation, operations: [{ op: "remove_card", section: "services", itemId: existing.id }] } as Parameters<typeof commitOperations>[0] & { annotationId: string });
  assert.equal(removed.status, "applied");
  if (removed.status !== "applied") throw new Error("expected applied");
  assert.equal((await selectiveUndo(site, removed.changeSet.id)).status, "applied");

  const seedProduct = { id: "review-product", sku: "REV-1", name: { zh: "产品", en: "Product" }, summary: { zh: "摘要", en: "Summary" }, category: { zh: "类别", en: "Category" }, status: "published" as const, imageColor: "#eeeeee" };
  const seededProducts = await createSite(site);
  const seed = await commitOperations({ siteId: site, baseRevision: seededProducts.draft.revision, source: "manual", summary: "产品基线", operations: [{ op: "replace_products", products: [seedProduct] }] });
  assert.equal(seed.status, "applied");
  const beforeProducts = await createSite(site);
  const productAnnotation = await annotation(site);
  const replaced = await commitOperations({ siteId: site, baseRevision: beforeProducts.draft.revision, source: "ai", summary: "替换产品", annotationId: productAnnotation, operations: [{ op: "replace_products", products: beforeProducts.draft.products.map((product) => ({ ...product, summary: { zh: "批注摘要", en: "Annotation summary" } })) }] } as Parameters<typeof commitOperations>[0] & { annotationId: string });
  assert.equal(replaced.status, "applied");
  if (replaced.status !== "applied") throw new Error("expected applied");
  const rejectedProducts = await selectiveUndo(site, replaced.changeSet.id);
  assert.equal(rejectedProducts.status, "rejected");
  assert.match(rejectedProducts.reason, /replace_products|整组/);
});

test("update_commercial_term is explicitly rejected for selective undo", async () => {
  const site = siteId();
  const initial = await createSite(site);
  const seeded = await commitOperations({ siteId: site, baseRevision: initial.draft.revision, source: "manual", summary: "条款基线", operations: [{ op: "replace_commercial_terms", terms: [{ id: "moq", kind: "moq", value: { zh: "20 台", en: "20 units" } }] }] });
  assert.equal(seeded.status, "applied");
  if (seeded.status !== "applied") throw new Error("expected applied");
  const annotationId = await annotation(site);
  const updated = await commitOperations({ siteId: site, baseRevision: seeded.record.draft.revision, source: "ai", summary: "更新条款", annotationId, operations: [{ op: "update_commercial_term", termId: "moq", value: { zh: "30 台", en: "30 units" } }] } as Parameters<typeof commitOperations>[0] & { annotationId: string });
  assert.equal(updated.status, "applied");
  if (updated.status !== "applied") throw new Error("expected applied");
  const rejected = await selectiveUndo(site, updated.changeSet.id);
  assert.equal(rejected.status, "rejected");
  assert.match(rejected.reason, /商业条款|update_commercial_term|普通撤销/);
});
