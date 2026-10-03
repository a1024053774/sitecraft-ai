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
const steps = [
  { id: "incoming", title: text("来料检验", "Incoming inspection"), body: text("树脂批次与嵌件尺寸。", "Resin batches and insert dimensions.") },
  { id: "first-article", title: text("试模后首件全尺寸检测", "First article full-dimensional inspection"), body: text("试模后首件全尺寸检测", "First article full-dimensional inspection") },
  { id: "patrol", title: text("过程巡检", "In-process patrol inspection"), body: text("每 2 小时抽检", "Sample every 2 hours") },
  { id: "functional", title: text("外观与功能全检", "Full appearance and functional inspection"), body: text("外观与功能全检", "Full appearance and functional inspection") },
  { id: "shipping", title: text("出货抽检", "Pre-shipment sampling inspection"), body: text("出货抽检并附检测报告。", "Sample before shipment and attach an inspection report.") },
];

const materials = [
  "【公司资料】以下内容明确标记为模拟测试资料，仅供内部 Demo。",
  "质检流程：来料检验（树脂批次与嵌件尺寸）；试模后首件全尺寸检测；过程巡检每 2 小时抽检；外观与功能全检；出货抽检并附检测报告。",
].join("\n");

const options = { templateIds: new Set(["forge", "screwfast", "landwind", "tailwind-landing"]), lastChange: "quality-process-test" };

test("quality process schema accepts ordered bilingual steps", () => {
  const parsed = siteDraftSchema.safeParse({
    ...structuredClone(defaultDraft),
    content: { ...structuredClone(defaultDraft.content), qualityProcess: steps },
  });
  assert.equal(parsed.success, true, parsed.success ? "" : parsed.error.message);
  if (parsed.success) assert.deepEqual((parsed.data.content as typeof parsed.data.content & { qualityProcess?: typeof steps }).qualityProcess?.map((step) => step.id), steps.map((step) => step.id));
});

test("quality process operations replace, update, remove, reorder and undo", () => {
  const before = structuredClone(defaultDraft) as never;
  const replace = { op: "replace_quality_process", steps } as never;
  assert.equal(siteOperationSchema.safeParse(replace).success, true);
  const replaced = applySiteOperations(before, [replace], options);
  assert.deepEqual((replaced.draft as never as { content: { qualityProcess: typeof steps } }).content.qualityProcess.map((step) => step.id), steps.map((step) => step.id));
  const updated = applySiteOperations(replaced.draft, [{ op: "update_quality_process", stepId: "patrol", body: text("每 2 小时抽检一次并记录。", "Sample once every 2 hours and record it.") } as never], options);
  assert.equal((updated.draft as never as { content: { qualityProcess: typeof steps } }).content.qualityProcess[2].body.zh, "每 2 小时抽检一次并记录。");
  const reordered = applySiteOperations(updated.draft, [{ op: "reorder_quality_process", order: ["shipping", "incoming", "first-article", "patrol", "functional"] } as never], options);
  assert.deepEqual((reordered.draft as never as { content: { qualityProcess: typeof steps } }).content.qualityProcess.map((step) => step.id), ["shipping", "incoming", "first-article", "patrol", "functional"]);
  const removed = applySiteOperations(reordered.draft, [{ op: "remove_quality_process", stepId: "shipping" } as never], options);
  assert.equal((removed.draft as never as { content: { qualityProcess: typeof steps } }).content.qualityProcess.some((step) => step.id === "shipping"), false);
  const restored = applySiteOperations(removed.draft, removed.inverseOperations.concat(reordered.inverseOperations, updated.inverseOperations, replaced.inverseOperations), options);
  assert.deepEqual((restored.draft as never as { content: { qualityProcess: typeof steps } }).content.qualityProcess, []);
});

test("quality process grounding keeps source order and rejects an invented step or borrowed equipment fact", () => {
  const checked = validateAIOperations(materials, [{ op: "replace_quality_process", steps: [...steps, { id: "invented", title: text("最终客户审核", "Final customer approval"), body: text("客户审核后放行。", "Release after customer approval.") }] } as never], options.templateIds);
  assert.equal(checked.operations.length, 1);
  const grounded = checked.operations[0] as never as { steps: typeof steps };
  assert.deepEqual(grounded.steps.map((step) => step.id), steps.map((step) => step.id));
  assert.ok(checked.rejected.some((message) => message.includes("最终客户审核")));

  const duplicate = validateAIOperations(`${materials}\n质检流程：来料检验（三坐标测量机）。\n检测设备：三坐标测量机。`, [
    { op: "replace_quality_process", steps: [{ ...steps[0], body: text("三坐标测量机", "Coordinate measuring machine") }] } as never,
    { op: "replace_equipment", equipment: [{ id: "cmm", name: text("三坐标测量机", "Coordinate measuring machine"), quantity: null, spec: null }] } as never,
  ], options.templateIds);
  assert.equal(duplicate.operations.some((operation) => operation.op === "replace_quality_process"), false);
  assert.ok(duplicate.operations.some((operation) => operation.op === "replace_equipment"));
  assert.ok(duplicate.rejected.some((message) => message.includes("重复") || message.includes("质检")));
});

test("published facts include every quality process title and body", () => {
  const draft = { ...structuredClone(defaultDraft), content: { ...structuredClone(defaultDraft.content), qualityProcess: steps } } as never;
  const facts = expectedFacts(draft);
  assert.deepEqual(facts.filter((fact) => fact.kind.startsWith("quality process")).map((fact) => fact.text), steps.flatMap((step) => [step.title.zh, step.body.zh]));
  assert.deepEqual(missingFacts(facts, "来料检验 树脂批次与嵌件尺寸。 试模后首件全尺寸检测 过程巡检 每 2 小时抽检 外观与功能全检 出货抽检"), [{ kind: "quality process body", text: "出货抽检并附检测报告。" }]);
});

test("quality process block hides without entries and exposes one slot per field on all four looks", () => {
  for (const templateId of ["forge", "screwfast", "landwind", "tailwind-landing"] as const) {
    const adapter = getTemplateAdapter(templateId);
    assert.ok(adapter);
    const html = composedPageForTemplate(templateId);
    assert.ok(html);
    const emptyDocument = parseHtmlDocument(html);
    const globalObject: Record<string, unknown> = { document: emptyDocument, parent: { postMessage() {} }, addEventListener() {} };
    globalObject.window = globalObject;
    installPreviewBridge(globalObject, templateId, adapter).applyDeclaredContent(defaultDraft, "zh", [], "published");
    assert.equal(emptyDocument.querySelector('[data-sitecraft-section="qualityProcess"]')?.hidden, true, `${templateId} hides empty process`);

    const draft = { ...structuredClone(defaultDraft), templateId, content: { ...structuredClone(defaultDraft.content), qualityProcess: steps } } as never;
    const document = parseHtmlDocument(html);
    globalObject.document = document;
    installPreviewBridge(globalObject, templateId, adapter).applyDeclaredContent(draft, "zh", [], "published");
    assert.equal(document.querySelector('[data-sitecraft-section="qualityProcess"]')?.hidden, false, `${templateId} shows process`);
    for (const step of steps) {
      assert.equal(document.querySelectorAll(`[data-sitecraft-slot="qualityProcess.items.${step.id}.title.zh"]`).length, 1);
      assert.equal(document.querySelectorAll(`[data-sitecraft-slot="qualityProcess.items.${step.id}.body.zh"]`).length, 1);
    }
  }
});
