import assert from "node:assert/strict";
import { unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { defaultDraft, editableCardSchema, ensureProductIds, normalizeDraft, productSchema, productStableId } from "../lib/site-document.ts";
import { applySiteOperations, type SiteOperation } from "../lib/site-operations.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { parseHtmlDocument } from "./fixtures/html-dom.ts";
import { servedHomeHtml } from "./fixtures/look-pages.ts";
import { packDraft } from "./fixtures/pack-drafts.ts";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const absolute = path.join(process.cwd(), specifier.slice(2));
    const file = existsSync(`${absolute}.ts`) ? `${absolute}.ts` : absolute;
    return nextResolve(pathToFileURL(file).href, context);
  },
});

const { requestStructuredOperations } = await import("../lib/ai-provider.ts");
const { getSite, moveHistory } = await import("../lib/site-store.ts");

const options = { templateIds: new Set(["forge", "screwfast"]), lastChange: "T-069 rework" };
const text = (value: string) => ({ zh: value, en: value });

test("three card sentinels keep the selected middle card after deleting the first", () => {
  const draft = structuredClone(defaultDraft);
  draft.content.services.items = [
    { id: "first", title: text("第一张"), body: text("第一张") },
    { id: "selected", title: text("第二张"), body: text("第二张") },
    { id: "third", title: text("第三张"), body: text("第三张") },
  ];
  const removed = applySiteOperations(draft, [{ op: "remove_card", section: "services", itemId: "first" }], options);
  const updated = applySiteOperations(removed.draft, [{ op: "update_card", section: "services", itemId: "selected", locale: "zh", title: "已选中" }], options);
  assert.equal(updated.draft.content.services.items.find((item) => item.id === "selected")?.title.zh, "已选中");
  assert.equal(updated.draft.content.services.items.find((item) => item.id === "third")?.title.zh, "第三张");
});

test("preview selection sends the stable slot and model request receives it as selectedTarget", async () => {
  const draft = packDraft("industrial");
  draft.content.services.items = [
    { id: "discovery", title: text("首步"), body: text("首步") },
    { id: "integration", title: text("第二步"), body: text("第二步") },
    { id: "delivery", title: text("第三步"), body: text("第三步") },
  ];
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter);
  const document = parseHtmlDocument(servedHomeHtml("screwfast"));
  const messages: Array<Record<string, unknown>> = [];
  const globalObject: Record<string, unknown> = { document, parent: { postMessage(value: Record<string, unknown>) { messages.push(value); } }, addEventListener() {} };
  globalObject.window = globalObject;
  installPreviewBridge(globalObject, "screwfast", adapter).applyDeclaredContent(draft, "zh", [], "workspace");
  const selected = document.querySelector('[data-sitecraft-benchmark="services-item-0-title"]');
  assert.ok(selected);
  const click = document.listeners.find((item) => item.type === "click")?.fn as ((event: Record<string, unknown>) => void) | undefined;
  assert.ok(click);
  click({ target: selected, preventDefault() {}, stopPropagation() {} });
  const selection = messages.find((message) => message.type === "sitecraft:select");
  assert.equal(selection?.slot, "services.items.discovery.title.zh");

  let requestBody: any = null;
  const originalFetch = globalThis.fetch;
  const previousKey = process.env.DEEPSEEK_API_KEY;
  const previousModel = process.env.DEEPSEEK_MODEL;
  process.env.DEEPSEEK_API_KEY = "test-key";
  process.env.DEEPSEEK_MODEL = "deepseek-flash";
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body ?? "{}"));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ type: "answer", text: "ok" }) }, finish_reason: "stop" }], usage: {} }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    await requestStructuredOperations({ message: "修改选中的服务", draft, templateId: draft.templateId, selectedTarget: String(selection?.slot ?? "") });
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.DEEPSEEK_MODEL; else process.env.DEEPSEEK_MODEL = previousModel;
  }
  const userMessage = (requestBody?.messages as Array<{ role: string; content: string }>).find((message) => message.role === "user");
  assert.ok(userMessage?.content.includes("当前修改目标：services.items.discovery.title.zh"));
});

test("new and old operation schemas both undo and redo through stable ids", () => {
  const draft = structuredClone(defaultDraft);
  draft.content.services.items = [
    { id: "first", title: text("第一张"), body: text("第一张") },
    { id: "selected", title: text("第二张"), body: text("第二张") },
  ];
  const operation = { op: "update_card", section: "services", itemId: "selected", locale: "zh", title: "新标题" } as const;
  const changed = applySiteOperations(draft, [operation], options);
  const undone = applySiteOperations(changed.draft, changed.inverseOperations, options);
  const redone = applySiteOperations(undone.draft, [operation], options);
  assert.equal(undone.draft.content.services.items.find((item) => item.id === "selected")?.title.zh, "第二张");
  assert.equal(redone.draft.content.services.items.find((item) => item.id === "selected")?.title.zh, "新标题");
});

test("legacy history migrates index and sku operations before undo and redo", async () => {
  const siteId = `t069-history-${Date.now().toString(36)}`;
  const recordPath = path.join(process.cwd(), ".sitecraft-data", "sites", `${siteId}.json`);
  const legacyDraft = structuredClone(defaultDraft) as typeof defaultDraft & { products: Array<Record<string, unknown>> };
  legacyDraft.content.services.items = [
    { id: "history-first", title: text("第一张"), body: text("第一张") },
    { id: "history-selected", title: text("新标题"), body: text("第二张") },
  ];
  legacyDraft.products = [{ sku: "OLD-A", name: text("改后产品"), summary: text("摘要"), category: text("类别"), status: "published", imageColor: "#fff" }];
  legacyDraft.revision = 2;
  const raw = {
    siteId,
    draft: legacyDraft,
    history: [{
      id: "old-change",
      baseRevision: 1,
      revision: 2,
      summary: "旧 operation",
      source: "manual",
      operations: [
        { op: "update_card", section: "services", index: 1, locale: "zh", title: "新标题" },
        { op: "update_product", sku: "OLD-A", name: text("改后产品") },
      ],
      inverseOperations: [
        { op: "update_product", sku: "OLD-A", name: text("原产品") },
        { op: "update_card", section: "services", index: 1, locale: "zh", title: "第二张" },
      ],
      appliedTargets: ["services.items.1.title.zh", "products.OLD-A.name.zh"],
      createdAt: new Date().toISOString(),
    }],
    future: [],
    updatedAt: new Date().toISOString(),
  };
  await (await import("node:fs/promises")).mkdir(path.dirname(recordPath), { recursive: true });
  await (await import("node:fs/promises")).writeFile(recordPath, JSON.stringify(raw), "utf8");
  try {
    const before = await getSite(siteId);
    const undone = await moveHistory(siteId, "undo");
    assert.equal(undone.status, "applied");
    assert.equal(undone.record.draft.content.services.items[1].title.zh, "第二张");
    assert.equal(undone.record.draft.products[0].name.zh, "原产品");
    const redone = await moveHistory(siteId, "redo");
    assert.equal(redone.status, "applied");
    assert.equal(redone.record.draft.content.services.items[1].title.zh, "新标题");
    assert.equal(redone.record.draft.products[0].name.zh, "改后产品");
    const persisted = JSON.parse(await (await import("node:fs/promises")).readFile(recordPath, "utf8"));
    assert.equal(persisted.historySchemaVersion, 2);
    assert.equal("index" in persisted.history[0].operations[0], false);
    assert.equal("sku" in persisted.history[0].operations[1], false);
    assert.ok(persisted.history[0].appliedTargets.includes("services.items.history-selected.title.zh"));
    assert.ok(persisted.history[0].appliedTargets.includes(`products.${persisted.draft.products[0].id}.name.zh`));
    assert.equal(before.draft.products[0].id, persisted.draft.products[0].id);
  } finally {
    await unlink(recordPath).catch(() => {});
  }
});

test("legacy future migrates its forward operation before redo", async () => {
  const siteId = `t069-future-${Date.now().toString(36)}`;
  const recordPath = path.join(process.cwd(), ".sitecraft-data", "sites", `${siteId}.json`);
  const draft = structuredClone(defaultDraft) as typeof defaultDraft & { products: Array<Record<string, unknown>> };
  draft.content.services.items = [
    { id: "future-first", title: text("第一张"), body: text("第一张") },
    { id: "future-selected", title: text("第二张"), body: text("第二张") },
  ];
  draft.products = [{ sku: "OLD-F", name: text("原产品"), summary: text("摘要"), category: text("类别"), status: "published", imageColor: "#fff" }];
  const raw = {
    siteId,
    draft,
    history: [],
    future: [{
      id: "old-future",
      baseRevision: 1,
      revision: 2,
      summary: "旧 future",
      source: "manual",
      operations: [{ op: "update_card", section: "services", index: 1, locale: "zh", title: "重做标题" }, { op: "update_product", sku: "OLD-F", name: text("重做产品") }],
      inverseOperations: [{ op: "update_product", sku: "OLD-F", name: text("原产品") }, { op: "update_card", section: "services", index: 1, locale: "zh", title: "第二张" }],
      appliedTargets: ["services.items.1.title.zh", "products.OLD-F.name.zh"],
      createdAt: new Date().toISOString(),
    }],
    updatedAt: new Date().toISOString(),
  };
  await (await import("node:fs/promises")).mkdir(path.dirname(recordPath), { recursive: true });
  await (await import("node:fs/promises")).writeFile(recordPath, JSON.stringify(raw), "utf8");
  try {
    const redone = await moveHistory(siteId, "redo");
    assert.equal(redone.status, "applied");
    assert.equal(redone.record.draft.content.services.items[1].title.zh, "重做标题");
    assert.equal(redone.record.draft.products[0].name.zh, "重做产品");
  } finally {
    await unlink(recordPath).catch(() => {});
  }
});

test("a missing product id is reported missing instead of deriving one from SKU or position", () => {
  const draft = packDraft("industrial");
  const requested = "products.prod-missing.name.zh";
  const missingSku = draft.products[0].sku;
  delete draft.products[0].id;
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter);
  const document = parseHtmlDocument(servedHomeHtml("screwfast"));
  const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  const report = installPreviewBridge(globalObject, "screwfast", adapter).applyDeclaredContent(draft, "zh", [requested], "workspace");
  assert.ok(report.missingSlots.includes(requested));
  assert.equal(report.appliedSlots.includes(requested), false);
  assert.equal(report.appliedSlots.some((target) => target.includes(missingSku)), false);
});

test("replace_draft is also normalized through the one id gateway", () => {
  const replacement = structuredClone(defaultDraft) as typeof defaultDraft & { products: Array<Record<string, unknown>> };
  replacement.products = [{ sku: "REPLACED", name: text("产品"), summary: text("摘要"), category: text("类别"), status: "published", imageColor: "#fff" }];
  const result = applySiteOperations(defaultDraft, [{ op: "replace_draft", draft: replacement }], options);
  assert.ok(result.draft.products[0].id);
});

test("stable ids reserve explicit ids, reject duplicates, and stay within target grammar", () => {
  const collision = productStableId({ sku: "MIGRATE" }, 0);
  const products = ensureProductIds([
    { sku: "MIGRATE", name: text("A"), summary: text("A"), category: text("A"), status: "published", imageColor: "#fff" },
    { id: collision, sku: "EXPLICIT", name: text("B"), summary: text("B"), category: text("B"), status: "published", imageColor: "#fff" },
  ]);
  assert.equal(products[1].id, collision);
  assert.notEqual(products[0].id, collision);
  assert.throws(() => ensureProductIds(products.map((product) => ({ ...product, id: "duplicate" }))));
  const cardBase = { title: text("标题"), body: text("正文") };
  assert.equal(editableCardSchema.safeParse({ id: "has.dot", ...cardBase }).success, false);
  assert.equal(productSchema.safeParse({ id: "has.dot", sku: "A", name: text("A"), summary: text("A"), category: text("A"), status: "published", imageColor: "#fff" }).success, false);
  assert.equal(productSchema.safeParse({ id: "a".repeat(81), sku: "A", name: text("A"), summary: text("A"), category: text("A"), status: "published", imageColor: "#fff" }).success, false);
  const maxId = "a".repeat(80);
  assert.equal(productSchema.safeParse({ id: maxId, sku: "A", name: text("A"), summary: text("A"), category: text("A"), status: "published", imageColor: "#fff" }).success, true);
  assert.ok(`products.${maxId}.name.zh`.length <= 200);
});
