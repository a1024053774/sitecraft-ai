import assert from "node:assert/strict";
import test from "node:test";
import { defaultDraft, normalizeDraft } from "../lib/site-document.ts";
import { applySiteOperations, type SiteOperation } from "../lib/site-operations.ts";

const options = { templateIds: new Set(["forge"]), lastChange: "T-069" };
const text = (value: string) => ({ zh: value, en: value });

test("card selection stays on the selected id after an earlier card is removed", () => {
  const draft = structuredClone(defaultDraft);
  draft.content.services.items = [
    { id: "service-first", title: text("先删"), body: text("先删正文") },
    { id: "service-selected", title: text("保留并修改"), body: text("原正文") },
  ];
  const removed = applySiteOperations(draft, [{ op: "remove_card", section: "services", itemId: "service-first" }], options);
  const update = {
    op: "update_card", section: "services", itemId: "service-selected", locale: "zh", title: "修改后的卡片",
  } as unknown as SiteOperation;
  const updated = applySiteOperations(removed.draft, [update], options);
  assert.equal(updated.draft.content.services.items[0].id, "service-selected");
  assert.equal(updated.draft.content.services.items[0].title.zh, "修改后的卡片");
});

test("legacy products receive stable ids and remain addressable after their sku changes", () => {
  const legacy = structuredClone(defaultDraft) as typeof defaultDraft & { products: Array<Record<string, unknown>> };
  legacy.products = [
    {
      sku: "OLD-A", name: text("产品 A"), summary: text("摘要 A"), category: text("类别"), status: "published", imageColor: "#fff",
    },
    {
      sku: "OLD-B", name: text("产品 B"), summary: text("摘要 B"), category: text("类别"), status: "published", imageColor: "#eee",
    },
  ];
  const firstRead = normalizeDraft(legacy);
  const secondRead = normalizeDraft(legacy);
  const productId = firstRead.products[0].id;
  assert.ok(productId);
  assert.equal(productId, secondRead.products[0].id);

  const renamed = applySiteOperations(firstRead, [{
    op: "replace_products",
    products: firstRead.products.map((product, index) => index === 0 ? { ...product, sku: "NEW-A" } : product),
  }], options);
  const update = {
    op: "update_product", productId, name: text("产品 A（已改型号）"),
  } as unknown as SiteOperation;
  const updated = applySiteOperations(renamed.draft, [update], options);
  assert.equal(updated.draft.products[0].sku, "NEW-A");
  assert.equal(updated.draft.products[0].name.zh, "产品 A（已改型号）");
});

