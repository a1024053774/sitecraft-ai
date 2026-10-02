import assert from "node:assert/strict";
import test from "node:test";
import { defaultDraft, normalizeDraft } from "../lib/site-document.ts";
import { effectiveBlockOrder } from "../lib/blocks/order.ts";
import { engineeringLook } from "../lib/blocks/looks/engineering.ts";
import { aiOperationSchema, applySiteOperations, siteOperationSchema, validateAIOperations } from "../lib/site-operations.ts";

const blockOrder = ["certifications", "products", "industries", "capabilities", "services", "faq", "contact"];

test("the retired five-section list is read as no explicit block order", () => {
  const legacy = structuredClone(defaultDraft) as Record<string, unknown>;
  legacy.sectionOrder = ["about", "features", "services", "products", "contact"];
  const restored = normalizeDraft(legacy);
  assert.equal(Object.hasOwn(restored, "sectionOrder"), false);
});

test("block order accepts a partial movable-block list and drops old keys", () => {
  const draft = structuredClone(defaultDraft) as Record<string, unknown>;
  draft.sectionOrder = ["certifications", "products", "certifications", "about", "contact"];
  const restored = normalizeDraft(draft);
  assert.deepEqual(restored.sectionOrder, ["certifications", "products", "contact"]);
});

test("reorder_sections uses movable block keys and null restores the default", () => {
  const operation = { op: "reorder_sections", order: blockOrder };
  assert.deepEqual(siteOperationSchema.parse(operation), operation);
  assert.deepEqual(aiOperationSchema.parse(operation), operation);
  assert.deepEqual(siteOperationSchema.parse({ op: "reorder_sections", order: null }), { op: "reorder_sections", order: null });
});

test("effective block order leaves a default draft untouched and appends omitted blocks", () => {
  const defaultOrder = effectiveBlockOrder(defaultDraft, engineeringLook);
  assert.deepEqual(defaultOrder, ["hero", "products", "industries", "capabilities", "services", "certifications", "faq", "contact"]);
  const partial = { ...defaultDraft, sectionOrder: ["certifications", "products"] as const };
  assert.deepEqual(effectiveBlockOrder(partial, engineeringLook), ["hero", "certifications", "products", "industries", "capabilities", "services", "faq", "contact"]);
});

test("reorder operation is reversible and null removes the explicit order", () => {
  const original = structuredClone(defaultDraft);
  const changed = applySiteOperations(original, [{ op: "reorder_sections", order: ["certifications", "products"] }], { templateIds: new Set(["screwfast"]), lastChange: "区块顺序" });
  assert.deepEqual(changed.draft.sectionOrder, ["certifications", "products"]);
  assert.deepEqual(changed.inverseOperations, [{ op: "reorder_sections", order: null }]);
  const restored = applySiteOperations(changed.draft, changed.inverseOperations, { templateIds: new Set(["screwfast"]), lastChange: "撤销区块顺序" });
  assert.equal(Object.hasOwn(restored.draft, "sectionOrder"), false);
});

test("unknown reorder keys are filtered before schema/model validation and missing blocks are resolved", () => {
  const raw = { op: "reorder_sections", order: ["certifications", "unknown", "products"] } as never;
  assert.equal(aiOperationSchema.safeParse(raw).success, true, "model schema accepts raw keys for validation to normalize");
  assert.equal(siteOperationSchema.safeParse(raw).success, false, "commit schema remains strict");
  const checked = validateAIOperations("把认证放到产品前面", [raw], new Set(["forge"]), defaultDraft);
  assert.ok(checked.operations[0]?.op === "reorder_sections");
  if (checked.operations[0]?.op === "reorder_sections") {
    assert.ok(checked.operations[0].order);
    if (checked.operations[0].order) {
      assert.equal((checked.operations[0].order as string[]).includes("unknown"), false);
      assert.equal(checked.operations[0].order.length, 7);
    }
  }
  assert.match(checked.notes.join(""), /忽略未知项：unknown/);
});
