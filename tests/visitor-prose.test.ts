import assert from "node:assert/strict";
import test from "node:test";
import { defaultDraft } from "../lib/site-document.ts";
import { validateAIOperations } from "../lib/site-operations.ts";
import { getTemplateAdapter } from "../lib/template-adapters/index.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { stripGapTalk } from "../lib/visitor-prose.ts";
import { createDocument, createNode, visibleText } from "./fixtures/fake-dom.ts";

// T-045 (Codex blind review 2026-09-28): visitor prose must not carry sentences that only report a
// missing fact, or talk about building the site. Individual gaps inside a real fact sentence stay.

test("gap-only sentences are dropped, a gap inside a fact sentence stays", () => {
  assert.equal(stripGapTalk("请提供设备工况与所需扭矩，我们会据此回复选型建议。电话与地址待补充。", "zh"), "请提供设备工况与所需扭矩，我们会据此回复选型建议。");
  assert.equal(stripGapTalk("批量规格询盘。产能数字与客户名单待补充。", "zh"), "批量规格询盘。");
  assert.equal(stripGapTalk("MOQ 20 台，交期待补充。", "zh"), "MOQ 20 台，交期待补充。");
  assert.equal(stripGapTalk("FDA 相关文件待补充", "zh"), "待补充");
  assert.equal(stripGapTalk("联系人与联系电话、邮箱均为待补充。", "zh"), "待补充");
  assert.equal(stripGapTalk("Send us your working conditions. Phone and address to be provided.", "en"), "Send us your working conditions.");
  assert.equal(stripGapTalk("面向 OEM 装配线的接头规格与交期说明；具体交期待补充。", "zh"), "面向 OEM 装配线的接头规格与交期说明。");
});

test("sentences about building the site or about the materials are dropped", () => {
  assert.equal(stripGapTalk("四个整站共用的应用场景。", "zh"), "待补充");
  assert.equal(stripGapTalk("矿山输送与冶金辊道。以下为资料中列出的工况。", "zh"), "矿山输送与冶金辊道。");
  assert.equal(stripGapTalk("资料下载请在询盘里说明需要哪份资料。", "zh"), "资料下载请在询盘里说明需要哪份资料。");
});

test("the validator cleans prose the model writes into visitor copy", () => {
  const templateIds = new Set(["screwfast"]);
  const materials = "应用行业：矿山输送；冶金辊道。";
  const { operations } = validateAIOperations(materials, [
    { op: "set_text", target: "contact.body", value: { zh: "请告诉我们工况。电话与地址待补充。", en: "Tell us your conditions. Phone and address to be provided." } },
    { op: "set_catalog_section", section: "industries", value: {
      title: { zh: "应用行业", en: "Industries" },
      intro: { zh: "四个整站共用的应用场景。", en: "Shared by all four sites." },
      items: [{ id: "mining", title: { zh: "矿山输送", en: "Mining conveying" }, body: { zh: "具体工况参数待补充", en: "Details to be provided" } }],
    } },
  ] as never, templateIds);
  const contact = operations[0] as { value: { zh: string; en: string } };
  assert.deepEqual(contact.value, { zh: "请告诉我们工况。", en: "Tell us your conditions." });
  const catalog = operations[1] as { value: { intro: { zh: string }; items: Array<{ body: { zh: string; en: string } }> } };
  assert.equal(catalog.value.intro.zh, "待补充");
  assert.deepEqual(catalog.value.items[0].body, { zh: "待补充", en: "To be provided" });
});

function renderCatalog(items: unknown[], key: "industries" | "certifications") {
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter);
  const { document, body } = createDocument();
  const section = createNode("section");
  section.setAttribute("data-sitecraft-section", key);
  const grid = createNode("div");
  grid.setAttribute("data-sitecraft-catalog-grid", key);
  section.appendChild(grid);
  body.appendChild(section);
  const draft = structuredClone(defaultDraft) as typeof defaultDraft & { content: Record<string, unknown> };
  (draft.content as Record<string, unknown>)[key] = { title: { zh: "标题", en: "Title" }, intro: { zh: "待补充", en: "To be provided" }, items };
  const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  installPreviewBridge(globalObject, "screwfast", adapter).applyDeclaredContent(draft, "zh", [], "published");
  return visibleText(grid);
}

test("a catalog card whose body is a gap shows only its title on the visitor page", () => {
  const text = renderCatalog([{ id: "mining", title: { zh: "矿山输送", en: "Mining" }, body: { zh: "待补充", en: "To be provided" } }], "industries");
  assert.match(text, /矿山输送/);
  assert.doesNotMatch(text, /待补充/);
});

test("a certification card does not repeat its status as the body", () => {
  const text = renderCatalog([{ id: "iso", title: { zh: "ISO 9001", en: "ISO 9001" }, body: { zh: "认证中", en: "In progress" }, status: "认证中" }], "certifications");
  assert.equal((text.match(/认证中/g) ?? []).length, 1, text);
});

test("a service card with a title and a gap body shows only its title on the visitor page", () => {
  const adapter = getTemplateAdapter("forge");
  assert.ok(adapter);
  const { document, body } = createDocument();
  const section = createNode("section");
  section.setAttribute("data-sitecraft-section", "services");
  const article = createNode("article");
  const title = createNode("h3");
  title.setAttribute("data-sitecraft-benchmark", "services-item-0-title");
  const copy = createNode("p");
  copy.setAttribute("data-sitecraft-benchmark", "services-item-0-body");
  article.appendChild(title);
  article.appendChild(copy);
  section.appendChild(article);
  body.appendChild(section);
  const draft = structuredClone(defaultDraft);
  draft.content.services.items[0].title = { zh: "滚齿与磨齿", en: "Hobbing and grinding" };
  draft.content.services.items[0].body = { zh: "待补充", en: "To be provided" };
  const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  installPreviewBridge(globalObject, "forge", adapter).applyDeclaredContent(draft, "zh", [], "published");
  assert.match(visibleText(article), /滚齿与磨齿/);
  assert.doesNotMatch(visibleText(article), /待补充/);
});
