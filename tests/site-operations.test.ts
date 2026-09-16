import assert from "node:assert/strict";
import test from "node:test";
import { defaultDraft } from "../lib/site-document.ts";
import {
  aiIntentResponseSchema,
  applySiteOperations,
  validateAIOperations,
  type SiteOperation,
} from "../lib/site-operations.ts";

const templateIds = new Set(["forge", "kindred", "signal"]);

test("updates only the requested service card and creates a reversible operation", () => {
  const original = structuredClone(defaultDraft);
  const result = applySiteOperations(original, [{
    op: "update_card",
    section: "services",
    index: 1,
    locale: "zh",
    title: "智能产线集成",
  }], { templateIds, lastChange: "AI saved" });

  assert.equal(result.changed, true);
  assert.equal(result.draft.templateId, "forge");
  assert.equal(result.draft.content.services.items[1].title.zh, "智能产线集成");
  assert.equal(result.draft.content.services.items[0].title.zh, original.content.services.items[0].title.zh);
  assert.deepEqual(result.appliedTargets, ["services.items.1.title.zh"]);
  assert.equal(result.draft.revision, original.revision + 1);

  const restored = applySiteOperations(result.draft, result.inverseOperations, { templateIds, lastChange: "Undo" });
  assert.equal(restored.draft.content.services.items[1].title.zh, original.content.services.items[1].title.zh);
  assert.equal(restored.draft.templateId, original.templateId);
});

test("intent union accepts edit, answer, and clarify and rejects operations on answer", () => {
  const edit = aiIntentResponseSchema.safeParse({
    type: "edit",
    summary: "更新中文首屏",
    operations: [{ op: "set_text", target: "hero.title", locale: "zh", value: "新标题" }],
  });
  assert.equal(edit.success, true);

  const answer = aiIntentResponseSchema.safeParse({ type: "answer", text: "当前站点名称是 Forge Industrial。" });
  assert.equal(answer.success, true);

  const clarify = aiIntentResponseSchema.safeParse({
    type: "clarify",
    question: "你想先改哪一部分？",
    options: ["首屏标题", "服务卡片"],
  });
  assert.equal(clarify.success, true);

  const answerWithOps = aiIntentResponseSchema.safeParse({
    type: "answer",
    text: "不该带操作",
    operations: [{ op: "set_text", target: "hero.title", locale: "zh", value: "hacked" }],
  });
  assert.equal(answerWithOps.success, false);

  const clarifyWithOps = aiIntentResponseSchema.safeParse({
    type: "clarify",
    question: "不该带操作",
    operations: [{ op: "set_text", target: "hero.title", locale: "zh", value: "hacked" }],
  });
  assert.equal(clarifyWithOps.success, false);
});

test("rejects an unsolicited template switch", () => {
  const validated = validateAIOperations("只修改第二个服务标题", [
    { op: "set_template", templateId: "kindred" },
    { op: "update_card", section: "services", index: 1, locale: "zh", title: "智能产线集成" },
  ], templateIds);
  assert.equal(validated.operations.length, 1);
  assert.equal(validated.operations[0].op, "update_card");
  assert.match(validated.rejected[0], /拒绝模板切换/);
});

test("allows a whitelisted template switch only when explicitly requested", () => {
  const validated = validateAIOperations("请切换模板为 kindred", [
    { op: "set_template", templateId: "kindred" },
  ], templateIds);
  assert.deepEqual(validated.rejected, []);
  assert.equal(validated.operations[0].op, "set_template");
});

test("does not increment revision for a no-op", () => {
  const operation: SiteOperation = {
    op: "set_text",
    target: "hero.title",
    locale: "zh",
    value: defaultDraft.content.hero.title.zh,
  };
  const result = applySiteOperations(defaultDraft, [operation], { templateIds, lastChange: "No-op" });
  assert.equal(result.changed, false);
  assert.equal(result.draft.revision, defaultDraft.revision);
  assert.deepEqual(result.appliedTargets, []);
});

test("replaces imported products as one reversible draft change", () => {
  const products = [{
    sku: "NEW-001",
    name: { zh: "测试产品", en: "Test Product" },
    summary: { zh: "测试简介", en: "Test description" },
    category: "测试",
    status: "draft" as const,
    imageColor: "#ffffff",
  }];
  const result = applySiteOperations(defaultDraft, [{ op: "replace_products", products }], { templateIds, lastChange: "Imported" });
  assert.equal(result.draft.products.length, 1);
  assert.equal(result.draft.products[0].sku, "NEW-001");
  const restored = applySiteOperations(result.draft, result.inverseOperations, { templateIds, lastChange: "Undo" });
  assert.deepEqual(restored.draft.products, defaultDraft.products);
});

test("applies a user-facing visual brief and its compatible template as one reversible change", () => {
  const result = applySiteOperations(defaultDraft, [{ op: "set_visual_brief", briefId: "export-catalog" }], {
    templateIds: new Set(["forge", "landwind"]),
    lastChange: "选择主题方向",
  });
  assert.equal(result.changed, true);
  assert.equal(result.draft.visualBrief.id, "export-catalog");
  assert.equal(result.draft.templateId, "landwind");
  assert.equal(aiIntentResponseSchema.safeParse({
    type: "edit",
    summary: "不允许模型直接选择主题",
    operations: [{ op: "set_visual_brief", briefId: "technical-product" }],
  }).success, false);
  assert.equal(result.draft.revision, defaultDraft.revision + 1);
  const restored = applySiteOperations(result.draft, result.inverseOperations, {
    templateIds: new Set(["forge", "landwind"]),
    lastChange: "撤销主题方向",
  });
  assert.equal(restored.draft.templateId, defaultDraft.templateId);
  assert.equal(restored.draft.visualBrief.id, defaultDraft.visualBrief.id);
});
