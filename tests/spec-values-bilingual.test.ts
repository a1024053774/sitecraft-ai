import assert from "node:assert/strict";
import test from "node:test";
import {
  hasHan,
  normalizeDraft,
  specValueText,
} from "../lib/site-document.ts";
import { draftWithFixtureProducts as defaultDraft } from "./fixtures/draft-with-products.ts";
import {
  aiOperationSchema,
  applySiteOperations,
  siteOperationSchema,
  validateAIOperations,
  type SiteOperation,
} from "../lib/site-operations.ts";

const templateIds = new Set(["forge", "screwfast", "landwind", "tailwind-landing"]);

test("localized spec values are accepted and rendered by locale", () => {
  const operation = {
    op: "set_product_specs",
    productId: defaultDraft.products[0].id!,
    specs: [{ name: { zh: "安装方式", en: "Mounting" }, value: { zh: "底脚/法兰", en: "Foot / flange" } }],
  } as const;
  assert.equal(siteOperationSchema.safeParse(operation).success, true);
  assert.equal(aiOperationSchema.safeParse(operation).success, true);
  assert.equal(specValueText(operation.specs[0].value, "zh"), "底脚/法兰");
  assert.equal(specValueText(operation.specs[0].value, "en"), "Foot / flange");
  assert.equal(hasHan("最大 900×1200 mm"), true);
  assert.equal(hasHan("8500 N·m"), false);
});

test("normalizeDraft preserves old string values and accepts new localized values", () => {
  const localized = structuredClone(defaultDraft);
  localized.products[0].specs = [{ name: { zh: "安装方式", en: "Mounting" }, value: { zh: "底脚/法兰", en: "Foot / flange" } }];
  assert.deepEqual(normalizeDraft(localized).products[0].specs, localized.products[0].specs);

  const legacy = structuredClone(defaultDraft);
  legacy.products[0].specs = [{ name: { zh: "安装方式", en: "Mounting" }, value: "底脚/法兰" }];
  assert.equal(normalizeDraft(legacy).products[0].specs?.[0].value, "底脚/法兰");
});

test("model spec values are normalized from materials and explain missing English", () => {
  const productId = defaultDraft.products[0].id!;
  const validated = validateAIOperations("产品资料：安装方式为底脚/法兰；防护等级 IP65；转移方式为旋转式。", [{
    op: "set_product_specs",
    productId,
    specs: [
      { name: { zh: "安装方式", en: "Mounting" }, value: "底脚/法兰" },
      { name: { zh: "防护等级", en: "Ingress protection" }, value: { zh: "IP65", en: "IP65 rated" } },
      { name: { zh: "转移方式", en: "Transfer" }, value: { zh: "旋转式", en: "旋转式 transfer" } },
    ],
  } as never], templateIds);
  const operation = validated.operations[0];
  assert.equal(operation.op, "set_product_specs");
  if (operation.op !== "set_product_specs") throw new Error("expected set_product_specs");
  assert.deepEqual(operation.specs.map((spec) => spec.value), [
    { zh: "底脚/法兰", en: "To be provided" },
    "IP65",
    { zh: "旋转式", en: "To be provided" },
  ]);
  assert.ok(validated.notes.some((note) => /英文|安装方式|转移方式/.test(note)));
});

test("set_product_specs opens englishReady and undo restores specs and flag", () => {
  const original = structuredClone(defaultDraft);
  original.englishReady = false;
  const productId = original.products[0].id!;
  const changed = applySiteOperations(original, [{
    op: "set_product_specs",
    productId,
    specs: [{ name: { zh: "安装方式", en: "Mounting" }, value: { zh: "底脚/法兰", en: "Foot / flange" } }],
  } as SiteOperation], { templateIds, lastChange: "bilingual specs" });
  assert.equal(changed.draft.englishReady, true);
  assert.equal(changed.inverseOperations[0].op, "set_product_specs");
  assert.equal((changed.inverseOperations[0] as Extract<SiteOperation, { op: "set_product_specs" }>).englishReadyBefore, false);
  const undone = applySiteOperations(changed.draft, changed.inverseOperations, { templateIds, lastChange: "Undo" });
  assert.deepEqual(undone.draft.products, original.products);
  assert.equal(undone.draft.englishReady, false);
});

test("replace_products normalizes specs, opens englishReady, and undo restores both", () => {
  const original = structuredClone(defaultDraft);
  original.englishReady = false;
  const products = structuredClone(original.products).slice(0, 1);
  products[0].specs = [{ name: { zh: "安装方式", en: "Mounting" }, value: { zh: "底脚/法兰", en: "Foot / flange" } }];
  const changed = applySiteOperations(original, [{ op: "replace_products", products } as SiteOperation], { templateIds, lastChange: "replace products" });
  assert.equal(changed.draft.englishReady, true);
  assert.deepEqual(changed.draft.products[0].specs?.[0].value, { zh: "底脚/法兰", en: "Foot / flange" });
  assert.equal(changed.inverseOperations[0].op, "replace_products");
  assert.equal((changed.inverseOperations[0] as Extract<SiteOperation, { op: "replace_products" }>).englishReadyBefore, false);
  const undone = applySiteOperations(changed.draft, changed.inverseOperations, { templateIds, lastChange: "Undo" });
  assert.deepEqual(undone.draft.products, original.products);
  assert.equal(undone.draft.englishReady, false);
});
