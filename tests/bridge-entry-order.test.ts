import assert from "node:assert/strict";
import test from "node:test";
import type { SiteDraft } from "../lib/site-document.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { HtmlDocument, parseHtmlDocument, visibleText } from "./fixtures/html-dom.ts";
import { servedHomeHtml } from "./fixtures/look-pages.ts";
import { packDraft } from "./fixtures/pack-drafts.ts";

// T-053, found by check-published's material-facts check: a new draft carries six empty FAQ entries
// and three empty cooperation steps, and the model adds the company's questions with add_card, which
// appends them after those placeholders. The page has three FAQ slots, filled by index, so it showed
// three placeholders (and hid the section) while the four real questions never reached it. The page
// now shows the entries that have a title or a body first, in draft order, then placeholders; each
// slot carries its entry's own index, so selecting it in the workspace and confirming a change stay
// on that entry.

const text = (value: string) => ({ zh: value, en: value });
const GAP = { zh: "待补充", en: "To be provided" };
const placeholder = (id: string) => ({ id, title: GAP, body: GAP });
const entry = (id: string, title: string, body: string) => ({ id, title: text(title), body: text(body) });

function render(templateId: string, draft: SiteDraft, expected: string[] = [], variant = "published") {
  const adapter = getTemplateAdapter(templateId);
  assert.ok(adapter, templateId);
  const document = parseHtmlDocument(servedHomeHtml(templateId));
  const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  const report = installPreviewBridge(globalObject, templateId, adapter).applyDeclaredContent({ ...draft, templateId }, "zh", expected, variant);
  return { document, report };
}

// The engineering page shows six FAQ entries and six cooperation steps (T-059).
const slotted = (document: HtmlDocument, group: "faq" | "services", part: "title" | "body") => [0, 1, 2, 3, 4, 5].map((index) => {
  const node = document.querySelector(`[data-sitecraft-benchmark="${group}-item-${index}-${part}"]`);
  return node ? { text: visibleText(node).trim(), slot: node.getAttribute("data-sitecraft-slot") } : null;
});

function moldingFaq(): SiteDraft {
  const draft = packDraft("molding");
  draft.content.faq.items = [
    ...["faq-1", "faq-2", "faq-3", "faq-4", "faq-5", "faq-6"].map(placeholder),
    entry("sample-mold", "没有图纸只有样品能开模吗？", "可以，先做 3D 扫描和逆向建模，图纸确认后再开模。"),
    entry("mold-lead-time", "开模周期多久？", "单腔模具约 25–35 天。"),
    entry("trial-samples", "试模样品怎么提供？", "T1 试模后 3 天内寄出样品。"),
    entry("mold-ownership", "模具归谁所有？", "模具费付清后模具归买方所有。"),
  ];
  return draft;
}

test("questions added after the empty FAQ entries reach the page, in draft order", () => {
  const { document, report } = render("screwfast", moldingFaq());
  assert.deepEqual(slotted(document, "faq", "title").slice(0, 4), [
    { text: "没有图纸只有样品能开模吗？", slot: "faq.items.6.title.zh" },
    { text: "开模周期多久？", slot: "faq.items.7.title.zh" },
    { text: "试模样品怎么提供？", slot: "faq.items.8.title.zh" },
    { text: "模具归谁所有？", slot: "faq.items.9.title.zh" },
  ]);
  assert.deepEqual(slotted(document, "faq", "title").slice(4).map((item) => item?.text), ["", ""], "the two slots left over are empty and hidden");
  assert.equal(slotted(document, "faq", "body")[1]?.text, "单腔模具约 25–35 天。");
  const section = document.querySelector('[data-sitecraft-section="faq"]');
  assert.ok(section && section.getAttribute("data-sitecraft-section-hidden") !== "true" && !section.hidden, "the FAQ section is shown");
  assert.ok(report.appliedSlots.includes("faq.items.6.title.zh"));
  // Four questions and six slots: two placeholders fill the rest (hidden); the other four are not on the page.
  assert.ok(!report.appliedSlots.includes("faq.items.2.title.zh"), "a placeholder that is not on the page is not reported as written");
});

test("a change to a shown entry is confirmed; one to an entry the page has no room for is reported missing", () => {
  const draft = moldingFaq();
  // Seven entries with content for six slots: the seventh (index 12) has no room.
  draft.content.faq.items.push(entry("export-terms", "出口用什么贸易条款？", "常用 FOB 宁波和 EXW。"), entry("moq", "起订量多少？", "注塑件 5000 件起。"), entry("lead-time", "批量交期多久？", "模具确认后 15–20 天。"));
  const { report } = render("screwfast", draft, ["faq.items.7.body.zh", "faq.items.11.title.zh", "faq.items.12.title.zh"], "workspace");
  assert.deepEqual(report.missingSlots, ["faq.items.12.title.zh"]);
});

test("entries with content come first wherever they sit; the slots left over hold placeholders, hidden as before", () => {
  const draft = packDraft("industrial");
  draft.content.faq.items = [entry("moq", "起订量多少？", "批量规格询盘 MOQ 20 台。"), placeholder("faq-2"), placeholder("faq-3"), entry("install", "能否现场安装？", "不提供现场安装。")];
  const published = render("screwfast", draft).document;
  assert.deepEqual(slotted(published, "faq", "title").map((item) => item?.slot).slice(0, 4), ["faq.items.0.title.zh", "faq.items.3.title.zh", "faq.items.1.title.zh", "faq.items.2.title.zh"]);
  assert.deepEqual(slotted(published, "faq", "title").map((item) => item?.text).slice(0, 2), ["起订量多少？", "能否现场安装？"]);
  assert.equal(slotted(published, "faq", "title")[2]?.text, "", "an empty entry is not shown");
  const workspace = render("screwfast", draft, [], "workspace").document;
  assert.deepEqual(slotted(workspace, "faq", "title").map((item) => item?.text), ["起订量多少？", "能否现场安装？", "", "", "", ""]);
});

test("cooperation steps work the same way, and entries already in order render as before", () => {
  const draft = packDraft("industrial");
  draft.content.services.items = [placeholder("step-1"), placeholder("step-2"), placeholder("step-3"), entry("drawing", "发送图纸", "附图纸与规格要求。")];
  assert.deepEqual(slotted(render("screwfast", draft).document, "services", "title")[0], { text: "发送图纸", slot: "services.items.3.title.zh" });
  const ordered = packDraft("industrial");
  ordered.content.faq.items = [entry("a", "问一", "答一"), entry("b", "问二", "答二"), entry("c", "问三", "答三"), placeholder("faq-4")];
  assert.deepEqual(slotted(render("screwfast", ordered).document, "faq", "title").map((item) => item?.slot).slice(0, 4), ["faq.items.0.title.zh", "faq.items.1.title.zh", "faq.items.2.title.zh", "faq.items.3.title.zh"]);
});

test("the looks still on their own overlay show added questions too", () => {
  for (const templateId of ["forge", "landwind", "tailwind-landing"]) {
    const adapter = getTemplateAdapter(templateId);
    const selector = adapter?.slots.find((slot) => slot.target === "faq.items.0.title")?.selector;
    assert.ok(selector, templateId);
    const node = render(templateId, moldingFaq()).document.querySelector(selector);
    assert.equal(node && visibleText(node).trim(), "没有图纸只有样品能开模吗？", templateId);
    assert.equal(node?.getAttribute("data-sitecraft-slot"), "faq.items.6.title.zh", templateId);
  }
});
