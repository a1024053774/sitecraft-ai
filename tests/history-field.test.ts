import assert from "node:assert/strict";
import test from "node:test";
import { defaultDraft, siteDraftSchema } from "../lib/site-document.ts";
import { applySiteOperations, siteOperationSchema, validateAIOperations } from "../lib/site-operations.ts";
import { composedPageForTemplate } from "../lib/blocks/compose.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { expectedFacts, missingFacts } from "../scripts/published-facts.mjs";
import { parseHtmlDocument } from "./fixtures/html-dom.ts";

const text = (zh: string, en: string) => ({ zh, en });
const history = [
  { id: "founded", year: 2008, event: text("建厂，从模具维修和小型模具起步", "Founded, starting with mold repair and small molds") },
  { id: "injection", year: 2013, event: text("注塑车间投产", "The injection shop started production") },
  { id: "export", year: 2017, event: text("开始承接出口订单", "Started taking export orders") },
  { id: "workshop", year: 2021, event: text("新增恒温精密模具车间", "Added a temperature-controlled precision mold shop") },
  { id: "metrology", year: 2024, event: text("建成三坐标与影像测量室", "Completed a coordinate measuring and vision inspection room") },
];
const materials = "沿革：2008 年 建厂，从模具维修和小型模具起步；2013 年 注塑车间投产；2017 年 开始承接出口订单；2021 年 新增恒温精密模具车间；2024 年 建成三坐标与影像测量室。";
const options = { templateIds: new Set(["forge", "screwfast", "landwind", "tailwind-landing"]), lastChange: "history-test" };

test("history schema accepts stable ids, four-digit years and bilingual events", () => {
  const parsed = siteDraftSchema.safeParse({ ...structuredClone(defaultDraft), content: { ...structuredClone(defaultDraft.content), history } });
  assert.equal(parsed.success, true, parsed.success ? "" : parsed.error.message);
  if (parsed.success) assert.deepEqual((parsed.data.content as typeof parsed.data.content & { history?: typeof history }).history?.map((item) => item.year), [2008, 2013, 2017, 2021, 2024]);
});

test("history operations replace, update, remove, reorder and undo", () => {
  const replace = { op: "replace_history", history } as never;
  assert.equal(siteOperationSchema.safeParse(replace).success, true);
  const replaced = applySiteOperations(structuredClone(defaultDraft) as never, [replace], options);
  assert.deepEqual((replaced.draft as never as { content: { history: typeof history } }).content.history.map((item) => item.id), history.map((item) => item.id));
  const updated = applySiteOperations(replaced.draft, [{ op: "update_history", itemId: "export", year: 2018, event: text("开始承接出口订单", "Started taking export orders") } as never], options);
  assert.equal((updated.draft as never as { content: { history: typeof history } }).content.history[2].year, 2018);
  const reordered = applySiteOperations(updated.draft, [{ op: "reorder_history", order: ["metrology", "founded", "injection", "export", "workshop"] } as never], options);
  assert.deepEqual((reordered.draft as never as { content: { history: typeof history } }).content.history.map((item) => item.id), ["metrology", "founded", "injection", "export", "workshop"]);
  const removed = applySiteOperations(reordered.draft, [{ op: "remove_history", itemId: "metrology" } as never], options);
  assert.equal((removed.draft as never as { content: { history: typeof history } }).content.history.some((item) => item.id === "metrology"), false);
  const restored = applySiteOperations(removed.draft, removed.inverseOperations.concat(reordered.inverseOperations, updated.inverseOperations, replaced.inverseOperations), options);
  assert.deepEqual((restored.draft as never as { content: { history: typeof history } }).content.history, []);
});

test("history grounding keeps source order and rejects inferred or non-adjacent years", () => {
  const checked = validateAIOperations(materials, [{ op: "replace_history", history: [
    ...history,
    { id: "invented", year: 2025, event: text("成立新公司", "Founded a new company") },
  ] } as never], options.templateIds);
  assert.equal(checked.operations.length, 1);
  assert.deepEqual((checked.operations[0] as never as { history: typeof history }).history.map((item) => item.id), history.map((item) => item.id));
  assert.ok(checked.rejected.some((message) => message.includes("成立新公司")));

  const wrongYear = validateAIOperations(materials, [{ op: "replace_history", history: [{ ...history[0], year: 2013 }] } as never], options.templateIds);
  assert.deepEqual(wrongYear.operations, []);
});

test("history grounding rejects a reverse or shuffled source order instead of reordering it", () => {
  const checked = validateAIOperations(materials, [{ op: "replace_history", history: [history[1], history[0]] } as never], options.templateIds);
  assert.deepEqual(checked.operations, []);
  assert.ok(checked.rejected.some((message) => message.includes("资料顺序")));
});

test("history English uppercase codes must come from the same source fragment", () => {
  const checked = validateAIOperations("沿革：2008 年 建厂。", [{ op: "replace_history", history: [{ ...history[0], event: text("建厂", "Founded ABC") }] } as never], options.templateIds);
  assert.deepEqual(checked.operations, []);
  assert.ok(checked.rejected.some((message) => message.includes("同一句资料")));
});

test("history English numbers remove the exact year and preserve event numbers", () => {
  const checked = validateAIOperations("沿革：2008 年 建立第2车间。", [{ op: "replace_history", history: [{ id: "workshop-2", year: 2008, event: text("建立第2车间", "Established workshop 2") }] } as never], options.templateIds);
  assert.equal(checked.operations.length, 1);
});

test("history grounding rejects non-integer, three-digit and five-digit years", () => {
  for (const year of [2008.5, 999, 10000]) {
    const checked = validateAIOperations(materials, [{ op: "replace_history", history: [{ ...history[0], year }] } as never], options.templateIds);
    assert.deepEqual(checked.operations, [], `year ${year} must be rejected`);
  }
});

test("published facts include history year and event and report missing entries", () => {
  const draft = { ...structuredClone(defaultDraft), content: { ...structuredClone(defaultDraft.content), history } } as never;
  const facts = expectedFacts(draft);
  assert.deepEqual(facts.filter((fact) => fact.kind.startsWith("history")).map((fact) => fact.text), history.flatMap((item) => [String(item.year), item.event.zh]));
  assert.deepEqual(missingFacts(facts, "2008 建厂，从模具维修和小型模具起步 2013 注塑车间投产"), [
    { kind: "history year", text: "2017" }, { kind: "history event", text: "开始承接出口订单" },
    { kind: "history year", text: "2021" }, { kind: "history event", text: "新增恒温精密模具车间" },
    { kind: "history year", text: "2024" }, { kind: "history event", text: "建成三坐标与影像测量室" },
  ]);
});

test("history block hides without entries, renders unique slots on all looks, and rejects marker-only entities", () => {
  for (const templateId of ["forge", "screwfast", "landwind", "tailwind-landing"] as const) {
    const adapter = getTemplateAdapter(templateId);
    assert.ok(adapter);
    const html = composedPageForTemplate(templateId);
    assert.ok(html);
    const emptyDocument = parseHtmlDocument(html);
    const globalObject: Record<string, unknown> = { document: emptyDocument, parent: { postMessage() {} }, addEventListener() {} };
    globalObject.window = globalObject;
    installPreviewBridge(globalObject, templateId, adapter).applyDeclaredContent(defaultDraft, "zh", [], "published");
    assert.equal(emptyDocument.querySelector('[data-sitecraft-section="history"]')?.hidden, true, `${templateId} hides empty history`);

    const draft = { ...structuredClone(defaultDraft), templateId, content: { ...structuredClone(defaultDraft.content), history } } as never;
    const document = parseHtmlDocument(html);
    globalObject.document = document;
    const report = installPreviewBridge(globalObject, templateId, adapter).applyDeclaredContent(draft, "zh", [], "published");
    assert.equal(document.querySelector('[data-sitecraft-section="history"]')?.hidden, false, `${templateId} shows history`);
    for (const item of history) {
      assert.equal(document.querySelectorAll(`[data-sitecraft-slot="history.items.${item.id}.year"]`).length, 1);
      assert.equal(document.querySelectorAll(`[data-sitecraft-slot="history.items.${item.id}.event.zh"]`).length, 1);
    }
    assert.ok(report.appliedSlots.includes("history"));
  }

  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter);
  const markerDocument = parseHtmlDocument('<html><body><main><section data-sitecraft-section="history"><div data-sitecraft-history-grid></div></section></main></body></html>');
  const markerGlobal: Record<string, unknown> = { document: markerDocument, parent: { postMessage() {} }, addEventListener() {} };
  markerGlobal.window = markerGlobal;
  const draft = { ...structuredClone(defaultDraft), templateId: "screwfast", content: { ...structuredClone(defaultDraft.content), history } } as never;
  const markerReport = installPreviewBridge(markerGlobal, "screwfast", adapter).applyDeclaredContent(draft, "zh", [], "published");
  assert.equal(markerDocument.querySelector("[data-sitecraft-history-grid]")?.children.length, 0);
  assert.equal(markerReport.appliedSlots.includes("history"), false);
});
