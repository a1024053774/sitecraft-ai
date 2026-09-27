import assert from "node:assert/strict";
import test from "node:test";
import { defaultDraft, normalizeDraft } from "../lib/site-document.ts";
import {
  aiIntentResponseSchema,
  applySiteOperations,
  validateAIOperations,
  type SiteOperation,
} from "../lib/site-operations.ts";

const templateIds = new Set(["forge", "kindred", "signal"]);

test("default draft keeps unprovided contact facts as pending", () => {
  assert.equal(defaultDraft.content.contact.email, "待补充");
  assert.equal(defaultDraft.content.contact.phone, "待补充");
  assert.equal(defaultDraft.content.contact.address.zh, "待补充");
});

test("v2 drafts missing only visualBrief retain authored content and revision", () => {
  const { visualBrief: _brief, ...legacy } = structuredClone(defaultDraft);
  legacy.revision = 43;
  legacy.locale = "en";
  legacy.content.hero.title.zh = "留存：定制阀组 A43";
  legacy.content.services.items[1].body.en = "No on-site installation is offered.";
  legacy.hiddenSections = ["features"];
  const restored = normalizeDraft(legacy);
  const { visualBrief: _restoredBrief, ...authored } = restored;
  assert.deepEqual(authored, { ...legacy, paletteId: "industrial-porcelain" });
});

test("switching visual brief keeps authored pack text and only changes the mapped template", () => {
  const options = { templateIds: new Set(["forge", "landwind"]), lastChange: "theme-compare" };
  const packed = applySiteOperations(structuredClone(defaultDraft), [
    { op: "set_text", target: "companyName", value: "汉川精密阀业A17" },
    { op: "set_text", target: "hero.title", locale: "zh", value: "定制阀组出口，按图加工 A17" },
    { op: "set_text", target: "hero.subtitle", locale: "zh", value: "不提供现场安装；仅接受批量规格询盘 A17。" },
  ], options);
  assert.equal(packed.draft.templateId, "forge");
  const swapped = applySiteOperations(packed.draft, [{ op: "set_visual_brief", briefId: "export-catalog" }], options);
  assert.equal(swapped.draft.templateId, "landwind");
  assert.equal(swapped.draft.visualBrief.id, "export-catalog");
  assert.equal(swapped.draft.companyName, "汉川精密阀业A17");
  assert.equal(swapped.draft.content.hero.title.zh, packed.draft.content.hero.title.zh);
  assert.equal(swapped.draft.content.hero.subtitle.zh, packed.draft.content.hero.subtitle.zh);
  assert.notEqual(swapped.draft.content.hero.title.zh, defaultDraft.content.hero.title.zh);
});

test("theme undo restores the saved template and brief even after catalog remapping", () => {
  const previous = structuredClone(defaultDraft);
  previous.templateId = "signal";
  previous.visualBrief = { ...previous.visualBrief, id: "technical-product", label: "保留的旧技术方向", templateId: "signal" };
  const options = { templateIds: new Set(["signal", "landwind", "tailwind-landing"]), lastChange: "change" };
  const changed = applySiteOperations(previous, [{ op: "set_visual_brief", briefId: "export-catalog" }], options);
  const undone = applySiteOperations(changed.draft, changed.inverseOperations, options);
  assert.equal(undone.draft.templateId, "signal");
  assert.deepEqual(undone.draft.visualBrief, previous.visualBrief);
  assert.deepEqual(undone.draft.content, previous.content);
});

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

test("v2 drafts missing faq keep authored hero text and fill six pending FAQ cards", () => {
  const legacy = structuredClone(defaultDraft) as { content: { faq?: unknown; hero: { title: { zh: string } } } };
  legacy.content.hero.title.zh = "留存：忻州减速机 FAQ";
  delete legacy.content.faq;
  const restored = normalizeDraft(legacy);
  assert.equal(restored.content.hero.title.zh, "留存：忻州减速机 FAQ");
  assert.equal(restored.content.faq.items.length, 6);
  assert.equal(restored.content.faq.items[0].title.zh, "待补充");
});

test("updates only the requested FAQ card and creates a reversible operation", () => {
  const original = structuredClone(defaultDraft);
  const result = applySiteOperations(original, [{
    op: "update_card",
    section: "faq",
    index: 2,
    locale: "zh",
    title: "MOQ 怎么确认？",
  }], { templateIds, lastChange: "AI saved" });
  assert.equal(result.draft.content.faq.items[2].title.zh, "MOQ 怎么确认？");
  assert.equal(result.draft.content.faq.items[0].title.zh, original.content.faq.items[0].title.zh);
  assert.deepEqual(result.appliedTargets, ["faq.items.2.title.zh"]);
  const undone = applySiteOperations(result.draft, result.inverseOperations, { templateIds, lastChange: "Undo" });
  assert.equal(undone.draft.content.faq.items[2].title.zh, original.content.faq.items[2].title.zh);
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
    lastChange: "选择样子",
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
    lastChange: "撤销样子",
  });
  assert.equal(restored.draft.templateId, defaultDraft.templateId);
  assert.equal(restored.draft.visualBrief.id, defaultDraft.visualBrief.id);
});

test("confirming the current look clears a retired visual brief and undo restores it", () => {
  const legacy = structuredClone(defaultDraft);
  legacy.visualBrief = {
    ...legacy.visualBrief,
    id: "editorial-service",
    label: "深色产品",
    templateId: "fresh",
  };
  const migrated = normalizeDraft(legacy);
  assert.equal(migrated.legacyVisualBriefId, "editorial-service");
  assert.equal(migrated.visualBrief.id, "technical-product");
  const options = {
    templateIds: new Set(["tailwind-landing", "forge", "screwfast", "landwind"]),
    lastChange: "确认样子",
  };
  const confirmed = applySiteOperations(migrated, [{ op: "set_visual_brief", briefId: "technical-product" }], options);
  assert.equal(confirmed.changed, true);
  assert.equal(confirmed.draft.legacyVisualBriefId, undefined);
  assert.equal(confirmed.draft.visualBrief.id, "technical-product");
  const undone = applySiteOperations(confirmed.draft, confirmed.inverseOperations, options);
  assert.equal(undone.draft.legacyVisualBriefId, "editorial-service");

  const switched = applySiteOperations(migrated, [{ op: "set_visual_brief", briefId: "engineering-industrial" }], options);
  assert.equal(switched.draft.legacyVisualBriefId, undefined);
  assert.equal(switched.draft.visualBrief.id, "engineering-industrial");
  const switchUndone = applySiteOperations(switched.draft, switched.inverseOperations, options);
  assert.equal(switchUndone.draft.legacyVisualBriefId, "editorial-service");
  assert.equal(switchUndone.draft.visualBrief.id, "technical-product");
});

test("generation refuses a model instruction as the FAQ intro and a card whose title and body are both missing", () => {
  const kept = applySiteOperations(defaultDraft, [{
    op: "update_card",
    section: "faq",
    index: 0,
    locale: "zh",
    title: "交期如何确认？",
    body: "批量规格询盘的交期待补充。",
  }], { templateIds, lastChange: "gap-rule" });
  assert.equal(kept.draft.content.faq.items[0].title.zh, "交期如何确认？");
  assert.equal(kept.draft.content.faq.items[0].body.zh, "批量规格询盘的交期待补充。");
  const validated = validateAIOperations("改常见问题", [
    { op: "set_text", target: "faq.intro", locale: "zh", value: "没有的写成待补充" },
    { op: "update_card", section: "faq", index: 0, locale: "zh", title: "待补充", body: "待补充" },
    { op: "update_card", section: "faq", index: 0, locale: "zh", title: "交期如何确认？", body: "批量规格询盘的交期待补充。" },
  ], templateIds);
  assert.equal(validated.operations.length, 1);
  assert.equal(validated.operations[0].op, "update_card");
  assert.match(validated.rejected.join("\n"), /常见问题引言/);
  assert.match(validated.rejected.join("\n"), /标题和正文都缺/);
});

test("engineering palette changes are named, reversible, and same-family only", () => {
  const options = { templateIds: new Set(["forge", "screwfast"]), lastChange: "palette-compare" };
  const engineering = applySiteOperations(structuredClone(defaultDraft), [
    { op: "set_visual_brief", briefId: "engineering-industrial" },
  ], options);
  assert.equal(engineering.draft.paletteId, "engineering-warm-orange");
  const slate = applySiteOperations(engineering.draft, [{ op: "set_palette", paletteId: "engineering-porcelain" }], options);
  assert.equal(slate.changed, true);
  assert.equal(slate.draft.paletteId, "engineering-porcelain");
  assert.equal(slate.appliedTargets.includes("palette"), true);
  const restored = applySiteOperations(slate.draft, slate.inverseOperations, options);
  assert.equal(restored.draft.paletteId, "engineering-warm-orange");
  assert.throws(
    () => applySiteOperations(defaultDraft, [{ op: "set_palette", paletteId: "engineering-porcelain" }], options),
    /not available/,
  );
});

test("one localized text operation writes zh and en together and undo restores both", () => {
  const result = applySiteOperations(structuredClone(defaultDraft), [{
    op: "set_text",
    target: "hero.title",
    value: { zh: "双语标题", en: "Bilingual title" },
  }], { templateIds: new Set(["forge"]), lastChange: "bilingual" });
  assert.equal(result.draft.content.hero.title.zh, "双语标题");
  assert.equal(result.draft.content.hero.title.en, "Bilingual title");
  const restored = applySiteOperations(result.draft, result.inverseOperations, { templateIds: new Set(["forge"]), lastChange: "undo" });
  assert.deepEqual(restored.draft.content.hero.title, defaultDraft.content.hero.title);
});

test("undoing the only English operation restores englishReady and keeps a different English sentence unavailable", () => {
  const result = applySiteOperations(structuredClone(defaultDraft), [{ op: "set_text", target: "hero.title", value: { zh: "双语标题", en: "A generated English title" } }], { templateIds: new Set(["forge"]), lastChange: "bilingual" });
  assert.equal(result.draft.englishReady, true);
  const restored = applySiteOperations(result.draft, result.inverseOperations, { templateIds: new Set(["forge"]), lastChange: "undo" }).draft;
  assert.equal(restored.englishReady, false);
  assert.equal(restored.content.hero.title.en, "To be provided");
});

test("undoing the only bilingual card update restores englishReady", () => {
  const result = applySiteOperations(structuredClone(defaultDraft), [{
    op: "update_card", section: "features", index: 0,
    title: { zh: "产品聚焦", en: "Focused product range" },
    body: { zh: "只写资料中的产品", en: "Only documented products" },
  }], { templateIds: new Set(["forge"]), lastChange: "bilingual card" });
  assert.equal(result.draft.englishReady, true);
  const restored = applySiteOperations(result.draft, result.inverseOperations, { templateIds: new Set(["forge"]), lastChange: "undo" }).draft;
  assert.equal(restored.englishReady, false);
  assert.equal(restored.content.features.items[0].title.en, "To be provided");
});

test("one product operation writes a bilingual category and undo restores it", () => {
  const sku = defaultDraft.products[0].sku;
  const result = applySiteOperations(structuredClone(defaultDraft), [{ op: "update_product", sku, category: { zh: "卡套接头", en: "Ferrule fittings" } }], { templateIds: new Set(["forge"]), lastChange: "category" });
  assert.deepEqual(result.draft.products[0].category, { zh: "卡套接头", en: "Ferrule fittings" });
  const restored = applySiteOperations(result.draft, result.inverseOperations, { templateIds: new Set(["forge"]), lastChange: "undo" }).draft;
  assert.deepEqual(restored.products[0].category, defaultDraft.products[0].category);
});
