import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { defaultDraft, normalizeDraft, type SiteDraft } from "../lib/site-document.ts";
import {
  applySiteOperations,
  validateAIOperations,
  type SiteOperation,
} from "../lib/site-operations.ts";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const abs = path.join(process.cwd(), specifier.slice(2));
    const file = existsSync(`${abs}.ts`) ? `${abs}.ts` : abs;
    return nextResolve(pathToFileURL(file).href, context);
  },
});

const { commitOperations, getSite } = await import("../lib/site-store.ts");

const templateIds = new Set(["forge", "screwfast", "kindred"]);
const options = { templateIds, lastChange: "product-specs" };

test("set_product_specs writes localized names and values through applySiteOperations and undoes", () => {
  const original = structuredClone(defaultDraft);
  const sku = original.products[0].sku;
  const result = applySiteOperations(original, [{
    op: "set_product_specs",
    sku,
    specs: [
      { name: { zh: "速比范围", en: "Ratio range" }, value: "i=25–100" },
      { name: { zh: "额定输出扭矩", en: "Rated output torque" }, value: "8500 N·m" },
    ],
  } as SiteOperation], options);

  assert.equal(result.changed, true);
  const product = result.draft.products.find((item) => item.sku === sku);
  assert.ok(product);
  assert.equal(product.specs?.length, 2);
  assert.equal(product.specs?.[0].name.zh, "速比范围");
  assert.equal(product.specs?.[0].name.en, "Ratio range");
  assert.equal(product.specs?.[0].value, "i=25–100");
  assert.equal(product.specs?.[1].value, "8500 N·m");
  assert.ok(result.appliedTargets.some((target) => target.includes(`${sku}.specs`)));

  const undone = applySiteOperations(result.draft, result.inverseOperations, options);
  const restored = undone.draft.products.find((item) => item.sku === sku);
  assert.deepEqual(restored?.specs, original.products[0].specs);
});

test("old drafts without product specs still normalize and leave specs absent", () => {
  const legacy = structuredClone(defaultDraft) as SiteDraft & { products: Array<Record<string, unknown>> };
  for (const product of legacy.products) {
    delete product.specs;
  }
  const restored = normalizeDraft(legacy);
  assert.equal(restored.content.hero.title.zh, defaultDraft.content.hero.title.zh);
  for (const product of restored.products) {
    assert.equal(product.specs, undefined);
  }
});

test("spec values absent from materials become 待补充 under validateAIOperations", () => {
  const materials = [
    "【公司资料】模拟测试。",
    "产品：直角减速机。",
    "直角减速机参数（模拟设定）：速比范围 i=25–100；额定输出扭矩 8500 N·m。",
  ].join("\n");
  const sku = defaultDraft.products[0].sku;
  const validated = validateAIOperations(materials, [{
    op: "set_product_specs",
    sku,
    specs: [
      { name: { zh: "速比范围", en: "Ratio range" }, value: "i=25–100" },
      { name: { zh: "额定输出扭矩", en: "Rated output torque" }, value: "99999 N·m" },
    ],
  }], templateIds);

  assert.equal(validated.operations.length, 1);
  const op = validated.operations[0];
  assert.equal(op.op, "set_product_specs");
  if (op.op !== "set_product_specs") throw new Error("expected set_product_specs");
  assert.equal(op.specs[0].value, "i=25–100");
  assert.equal(op.specs[1].value, "待补充");
  assert.ok(validated.rejected.some((item) => /资料|待补充|参数/.test(item)));
});

test("commitOperations persists product specs on a real site record", async () => {
  const siteId = `spec-tracer-${Date.now().toString(36)}`;
  const before = await getSite(siteId);
  const sku = before.draft.products[0].sku;
  const committed = await commitOperations({
    siteId,
    baseRevision: before.draft.revision,
    summary: "tracer: product specs",
    source: "manual",
    operations: [{
      op: "set_product_specs",
      sku,
      specs: [
        { name: { zh: "速比范围", en: "Ratio range" }, value: "i=25–100" },
      ],
    }],
  });
  assert.equal(committed.status, "applied");
  if (committed.status !== "applied") return;
  const product = committed.record.draft.products.find((item) => item.sku === sku);
  assert.equal(product?.specs?.[0].value, "i=25–100");
});
