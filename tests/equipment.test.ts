import assert from "node:assert/strict";
import test from "node:test";
import { defaultDraft, siteDraftSchema } from "../lib/site-document.ts";
import { applySiteOperations, validateAIOperations } from "../lib/site-operations.ts";
import { expectedFacts, missingFacts } from "../scripts/published-facts.mjs";
import { composedPageForTemplate } from "../lib/blocks/compose.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { parseHtmlDocument, visibleText } from "./fixtures/html-dom.ts";
import { simulatedPacks } from "../lib/simulated-packs.ts";

const options = { templateIds: new Set(["forge", "screwfast", "landwind", "tailwind-landing"]), lastChange: "equipment" };
const localized = (zh: string, en: string) => ({ zh, en });
const cnc = { id: "cnc-1", name: localized("高速 CNC 加工中心", "High-speed CNC machining center"), quantity: 12, spec: null };
const injection = { id: "injection-1", name: localized("注塑机", "Injection machine"), quantity: 42, spec: localized("90–800 t", "90–800 t") };
const inspection = { id: "cmm-1", name: localized("三坐标测量机", "Coordinate measuring machine"), quantity: null, spec: null };

function withEquipment(items: unknown[]) {
  return {
    ...structuredClone(defaultDraft),
    content: { ...structuredClone(defaultDraft.content), equipment: items },
  } as never;
}

test("equipment schema accepts stable names, nullable integer quantities and nullable specs", () => {
  const parsed = siteDraftSchema.safeParse(withEquipment([cnc, injection, inspection]));
  assert.equal(parsed.success, true);
  assert.deepEqual((parsed.data as never as { content: { equipment: unknown[] } }).content.equipment, [cnc, injection, inspection]);
});

test("equipment schema rejects non-integer quantities and malformed full arrays", () => {
  assert.equal(siteDraftSchema.safeParse(withEquipment([{ ...cnc, quantity: 12.5 }])).success, false);
  assert.equal(siteDraftSchema.safeParse(withEquipment([{ ...cnc, quantity: "12" }])).success, false);
  assert.equal(siteDraftSchema.safeParse(withEquipment([{ ...cnc, quantity: -1 }])).success, false);
  assert.equal(siteDraftSchema.safeParse(withEquipment([{ ...cnc, id: "cnc.unsafe" }])).success, false);
});

test("equipment operations replace, update and remove by stable id and undo restores englishReady", () => {
  const before = structuredClone(defaultDraft) as never;
  const replaced = applySiteOperations(before, [{ op: "replace_equipment", equipment: [cnc, injection] } as never], options);
  assert.deepEqual((replaced.draft as never as { content: { equipment: unknown[] } }).content.equipment, [cnc, injection]);
  assert.equal(replaced.draft.englishReady, true);
  const updated = applySiteOperations(replaced.draft, [{ op: "update_equipment", equipmentId: "cnc-1", quantity: 16, spec: localized("BT40", "BT40") } as never], options);
  assert.equal((updated.draft as never as { content: { equipment: typeof cnc[] } }).content.equipment[0].quantity, 16);
  const removed = applySiteOperations(updated.draft, [{ op: "remove_equipment", equipmentId: "injection-1" } as never], options);
  assert.deepEqual((removed.draft as never as { content: { equipment: unknown[] } }).content.equipment.map((item) => (item as { id: string }).id), ["cnc-1"]);
  const restored = applySiteOperations(removed.draft, removed.inverseOperations, options);
  assert.deepEqual((restored.draft as never as { content: { equipment: unknown[] } }).content.equipment, (updated.draft as never as { content: { equipment: unknown[] } }).content.equipment);
  assert.equal(restored.draft.englishReady, updated.draft.englishReady);
});

test("equipment update validates the complete next array before writing duplicate ids", () => {
  const before = applySiteOperations(structuredClone(defaultDraft) as never, [{ op: "replace_equipment", equipment: [cnc, injection] } as never], options).draft;
  assert.throws(() => applySiteOperations(before, [{ op: "update_equipment", equipmentId: "cnc-1", quantity: 12.5 } as never], options), /integer|schema|quantity/i);
  assert.equal((before as never as { content: { equipment: Array<{ quantity: number }> } }).content.equipment[0].quantity, 12);
});

test("equipment grounding accepts the molding machine facts and preserves null inspection quantities", () => {
  const checked = validateAIOperations(simulatedPacks.molding.body, [{
    op: "replace_equipment",
    equipment: [
      cnc,
      { id: "wire-1", name: localized("精密慢走丝线切割", "Precision slow-wire wire-cut machine"), quantity: 6, spec: null },
      { id: "edm-1", name: localized("镜面电火花", "Mirror electric discharge machine"), quantity: 8, spec: null },
      { id: "grinder-1", name: localized("精密平面磨床", "Precision surface grinder"), quantity: 4, spec: null },
      injection,
      { id: "two-shot-1", name: localized("双色注塑机", "Two-shot injection machine"), quantity: 3, spec: null },
      inspection,
    ],
  } as never], options.templateIds, withEquipment([]));
  assert.equal(checked.operations.length, 1);
  assert.deepEqual((checked.operations[0] as never as { equipment: Array<{ id: string }> }).equipment.map((item) => item.id), ["cnc-1", "wire-1", "edm-1", "grinder-1", "injection-1", "two-shot-1", "cmm-1"]);
  assert.equal((checked.operations[0] as never as { equipment: typeof injection[] }).equipment.find((item) => item.id === "injection-1")?.quantity, 42);
});

test("equipment grounding rejects process capabilities and numbers borrowed from another sentence", () => {
  const process = validateAIOperations(simulatedPacks.industrial.body, [{
    op: "replace_equipment",
    equipment: [{ id: "gear", name: localized("滚齿与磨齿", "Gear hobbing and grinding"), quantity: null, spec: null }],
  } as never], options.templateIds, withEquipment([]));
  assert.deepEqual(process.operations, []);
  const borrowed = validateAIOperations(simulatedPacks.molding.body, [{
    op: "replace_equipment",
    equipment: [{ id: "bad", name: localized("注塑机", "Injection machine"), quantity: 180, spec: null }],
  } as never], options.templateIds, withEquipment([]));
  assert.deepEqual(borrowed.operations, []);
});

test("equipment grounding requires Chinese name and spec to be source substrings and English mechanics to correspond", () => {
  const badName = validateAIOperations(simulatedPacks.molding.body, [{
    op: "replace_equipment",
    equipment: [{ id: "bad-name", name: localized("高速 CNC 加工中心（大型）", "Large high-speed CNC machining center"), quantity: 12, spec: null }],
  } as never], options.templateIds, withEquipment([]));
  assert.deepEqual(badName.operations, []);
  const badEnglish = validateAIOperations(simulatedPacks.molding.body, [{
    op: "replace_equipment",
    equipment: [{ id: "bad-en", name: localized("注塑机", "Injection machine"), quantity: 42, spec: localized("90–800 t", "90–900 tons") }],
  } as never], options.templateIds, withEquipment([]));
  assert.deepEqual(badEnglish.operations, []);
});

test("equipment unit mapping still rejects a ton range translated as kilograms", () => {
  const checked = validateAIOperations("设备：注塑机 42 台（90–800 t）。", [{
    op: "replace_equipment",
    equipment: [{ id: "injection", name: localized("注塑机", "Injection machine"), quantity: 42, spec: localized("90–800 t", "90–800 kg") }],
  } as never], options.templateIds);
  assert.deepEqual(checked.operations, []);
});

test("industrial and export materials do not create an equipment block from capability processes", () => {
  for (const pack of [simulatedPacks.industrial, simulatedPacks.export]) {
    const checked = validateAIOperations(pack.body, [{
      op: "replace_equipment",
      equipment: [{ id: "process", name: localized("数控车削", "CNC turning"), quantity: null, spec: null }],
    } as never], options.templateIds, withEquipment([]));
    assert.deepEqual(checked.operations, [], pack.id);
  }
});

test("the same machine fact is not written to both capabilities and equipment", () => {
  const checked = validateAIOperations(simulatedPacks.molding.body, [
    {
      op: "set_catalog_section",
      section: "capabilities",
      value: { title: localized("加工能力", "Capabilities"), intro: localized("", ""), items: [{ id: "machine-line", title: localized("主设备", "Main equipment"), body: localized("高速 CNC 加工中心 12 台", "12 high-speed CNC machining centers"), status: "已有" }] },
    },
    { op: "replace_equipment", equipment: [cnc] },
  ] as never[], options.templateIds, withEquipment([]));
  const capability = checked.operations.find((operation) => operation.op === "set_catalog_section");
  assert.equal(capability?.op, "set_catalog_section");
  if (capability?.op === "set_catalog_section" && capability.value) assert.equal(capability.value.items.some((item) => item.body.zh.includes("高速 CNC 加工中心")), false);
  assert.ok(checked.operations.some((operation) => operation.op === "replace_equipment"));
});

test("published facts include equipment name, quantity and spec and report missing values", () => {
  const draft = withEquipment([cnc, injection, inspection]);
  const facts = expectedFacts(draft, "zh");
  assert.deepEqual(facts.filter((fact: { kind: string }) => fact.kind.startsWith("equipment")).map((fact: { text: string }) => fact.text), ["高速 CNC 加工中心", "12", "注塑机", "42", "90–800 t", "三坐标测量机"]);
  assert.deepEqual(missingFacts(facts, "高速 CNC 加工中心 12 注塑机 42 90–800 t"), [{ kind: "equipment name", text: "三坐标测量机" }]);
});

test("equipment block is hidden without entries and renders one unique slot per field", () => {
  const html = composedPageForTemplate("forge");
  assert.ok(html);
  const adapter = getTemplateAdapter("forge");
  assert.ok(adapter);
  const emptyDocument = parseHtmlDocument(html);
  const globalObject: Record<string, unknown> = { document: emptyDocument, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  installPreviewBridge(globalObject, "forge", adapter!).applyDeclaredContent(defaultDraft, "zh", [], "published");
  const emptySection = emptyDocument.querySelector('[data-sitecraft-section="equipment"]');
  assert.ok(emptySection);
  assert.equal(emptySection.getAttribute("data-sitecraft-section-hidden"), "true");

  const document = parseHtmlDocument(html);
  const secondGlobal: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
  secondGlobal.window = secondGlobal;
  installPreviewBridge(secondGlobal, "forge", adapter!).applyDeclaredContent(withEquipment([cnc, injection]), "zh", [], "published");
  const section = document.querySelector('[data-sitecraft-section="equipment"]');
  assert.ok(section);
  assert.equal(section.getAttribute("data-sitecraft-section-hidden"), null);
  assert.equal(document.querySelectorAll('[data-sitecraft-slot="equipment.items.cnc-1.name.zh"]').length, 1);
  assert.equal(document.querySelectorAll('[data-sitecraft-slot="equipment.items.cnc-1.quantity"]').length, 1);
  assert.equal(document.querySelectorAll('[data-sitecraft-slot="equipment.items.injection-1.spec.zh"]').length, 1);
  assert.match(visibleText(section), /高速 CNC 加工中心/);
  assert.match(visibleText(section), /12/);
  assert.match(visibleText(section), /90–800 t/);
});
