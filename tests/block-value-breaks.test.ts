import assert from "node:assert/strict";
import test from "node:test";
import { composedPageForTemplate } from "../lib/blocks/compose.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { cssRules, styleText } from "./fixtures/css-rules.ts";
import { HtmlDocument, HtmlElement, parseHtmlDocument } from "./fixtures/html-dom.ts";
import { servedHomeHtml } from "./fixtures/look-pages.ts";
import { packDraft, withLayouts } from "./fixtures/pack-drafts.ts";

// T-053: a spec value breaks only at spaces and after / + – 、, never inside a word or a run of
// Chinese characters, unless a single piece is wider than its cell. When the bridge writes a
// value on a block-library page it puts a zero-width space after those separators (a <wbr>
// element shifts glyphs even when nothing wraps); the draft keeps the value as written.

const Z = "\u200b";

function render(templateId: string, draft: unknown, locale = "zh"): HtmlDocument {
  const adapter = getTemplateAdapter(templateId);
  assert.ok(adapter, templateId);
  const document = parseHtmlDocument(servedHomeHtml(templateId));
  const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  installPreviewBridge(globalObject, templateId, adapter).applyDeclaredContent(draft, locale, [], "published");
  return document;
}

const raw = (nodes: HtmlElement[]) => nodes.map((node) => node.textContent);
function card(document: HtmlDocument, sku: string) {
  const node = document.querySelector(`[data-sitecraft-product="${sku}"]`);
  assert.ok(node, `card ${sku}`);
  return node;
}

test("product cards break key values and the full spec list only after / + – 、, and the draft keeps its values", () => {
  const draft = packDraft("molding");
  draft.products[1].summary = { zh: "PC+TPU/PP 包胶件。", en: "PC+TPU/PP overmolds." };
  const before = structuredClone(draft);
  const document = render("screwfast", draft);
  assert.deepEqual(raw(card(document, "hot-runner-mold").querySelectorAll(".sitecraft-product-key dd")), [`1–${Z}32 腔`, "最大 900×1200 mm", `S136/${Z}H13/${Z}NAK80`]);
  assert.deepEqual(raw(card(document, "two-shot-mold").querySelectorAll(".sitecraft-product-key dd")), [`旋转式/${Z}机械手转移`, `双色注塑机 120–${Z}650 t`, `PC+${Z}TPU/${Z}PP+${Z}TPE/${Z}ABS+${Z}PC`]);
  assert.deepEqual(raw(card(document, "optical-parts").querySelectorAll(".sitecraft-product-key dd")), [`PMMA/${Z}PC/${Z}COC`, "≥90%（PMMA 2 mm 厚）", `0.8–${Z}6 mm`]);
  assert.deepEqual(raw(card(document, "insert-molded-parts").querySelectorAll(".sitecraft-product-key dd")), [`铜螺母/${Z}冲压端子/${Z}不锈钢轴`, `PBT+${Z}GF/${Z}PA6/${Z}LCP`, "±0.05 mm"]);
  assert.deepEqual(raw(card(document, "hot-runner-mold").querySelectorAll(".sitecraft-product-specs td")), [`1–${Z}32 腔`, "最大 900×1200 mm", `S136/${Z}H13/${Z}NAK80`, `12–${Z}40 s`]);
  // Names, labels and summaries are not spec values.
  assert.equal(card(document, "two-shot-mold").querySelector(".sitecraft-product-summary")?.textContent, "PC+TPU/PP 包胶件。");
  assert.deepEqual(raw(card(document, "two-shot-mold").querySelectorAll(".sitecraft-product-key dt")), ["成型方式", "适配机型", "材料组合"]);
  assert.deepEqual(draft, before, "rendering never writes the break points into the draft");
});

test("the bright product cards use the same separator-only value breaks", () => {
  const document = render("forge", packDraft("molding"));
  assert.deepEqual(raw(card(document, "optical-parts").querySelectorAll(".sitecraft-product-key dd")), ["PMMA/" + Z + "PC/" + Z + "COC", "≥90%（PMMA 2 mm 厚）", "0.8–" + Z + "6 mm"]);
});

test("the hero nameplate, the statement strip, grouped cards and the comparison table use the same break points", () => {
  const molding = packDraft("molding");
  const plate = render("screwfast", molding);
  assert.deepEqual(raw(plate.querySelectorAll("[data-sitecraft-hero-nameplate] dd")), [`1–${Z}32 腔`, "最大 900×1200 mm", `旋转式/${Z}机械手转移`, `双色注塑机 120–${Z}650 t`]);
  assert.deepEqual(raw(plate.querySelectorAll("[data-sitecraft-hero-nameplate] dt")), ["多腔热流道模具 · 型腔数", "多腔热流道模具 · 模具尺寸", "双色注塑模具 · 成型方式", "双色注塑模具 · 适配机型"]);

  const strip = render("screwfast", withLayouts(molding, { hero: "statement" }));
  assert.deepEqual(raw(strip.querySelectorAll(".sitecraft-statement-specs .sitecraft-hero-spec dd")), [`1–${Z}32 腔`, "最大 900×1200 mm", `旋转式/${Z}机械手转移`, `双色注塑机 120–${Z}650 t`]);

  const grouped = render("screwfast", withLayouts(molding, { products: "grouped" }));
  assert.deepEqual(raw(card(grouped, "precision-structural-parts").querySelectorAll(".sitecraft-product-key dd")), [`PA66+${Z}GF/${Z}POM/${Z}PBT/${Z}PC`, `0.5–${Z}350 g`, "±0.02 mm"]);

  const compare = render("screwfast", withLayouts(packDraft("industrial"), { products: "compare" }), "en");
  const values = raw(compare.querySelectorAll(".sitecraft-compare-table .sitecraft-compare-value"));
  assert.deepEqual(values, [`i=25–${Z}100`, `i=4–${Z}100`, "8500 N·m", "3200 N·m", "≤1500 r/min", "≤3000 r/min", "Foot / flange", "Flange"]);
  assert.deepEqual(raw(compare.querySelectorAll(".sitecraft-compare-extra dd")), ["200 mm", "F280", "IP65"]);
  assert.deepEqual(raw(compare.querySelectorAll(".sitecraft-compare-table tbody th")), ["Ratio range", "Rated output torque", "Input speed", "Mounting"]);
});

test("a slash breaks between readable pieces, while units stay whole", () => {
  const draft = packDraft("molding");
  const values = [
    "≤1500 r/min", "G1/4–G1", "25 N/m", "12 m³/h", "4 kg/h",
    "S136/H13/NAK80", "PA6/LCP", "PBT+GF/PA6/LCP", "旋转式/机械手转移", "咬花/喷砂/高光", "机械手/人工",
  ];
  draft.products = [{ ...draft.products[0], specs: values.map((value, index) => ({ name: { zh: `参数${index}`, en: `Spec ${index}` }, value })) }];
  const document = render("screwfast", draft);
  assert.deepEqual(raw(document.querySelectorAll(".sitecraft-product-specs td")), [
    "≤1500 r/min", `G1/4–${Z}G1`, "25 N/m", "12 m³/h", "4 kg/h",
    `S136/${Z}H13/${Z}NAK80`, `PA6/${Z}LCP`, `PBT+${Z}GF/${Z}PA6/${Z}LCP`, `旋转式/${Z}机械手转移`, "咬花/喷砂/高光", "机械手/人工",
  ]);
});

test("a separator before a space or at the end of a value, or a full-width one, is left alone", () => {
  const draft = packDraft("molding");
  draft.products = [{
    ...draft.products[0],
    specs: [
      { name: { zh: "端部", en: "End" }, value: "3/ 4 in" },
      { name: { zh: "余量", en: "Allowance" }, value: "5 mm+" },
      { name: { zh: "区间", en: "Range" }, value: "a–b" },
      { name: { zh: "全角", en: "Full width" }, value: "Ａ／Ｂ＋Ｃ" },
    ],
  }];
  const document = render("screwfast", draft);
  assert.deepEqual(raw(document.querySelectorAll(".sitecraft-product-key dd")), ["3/ 4 in", "5 mm+", `a–${Z}b`]);
  assert.deepEqual(raw(document.querySelectorAll(".sitecraft-product-specs td")), ["3/ 4 in", "5 mm+", `a–${Z}b`, "Ａ／Ｂ＋Ｃ"]);
});

test("copying from the page gives the value without the break points", () => {
  const copy = (templateId: string, selected: string) => {
    const adapter = getTemplateAdapter(templateId);
    assert.ok(adapter);
    const document = parseHtmlDocument(servedHomeHtml(templateId));
    const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {}, getSelection: () => ({ toString: () => selected }) };
    globalObject.window = globalObject;
    installPreviewBridge(globalObject, templateId, adapter);
    const listener = document.listeners.find((item) => item.type === "copy");
    const written: Array<[string, string]> = [];
    let prevented = false;
    const event = { clipboardData: { setData: (type: string, value: string) => written.push([type, value]) }, preventDefault: () => { prevented = true; } };
    if (listener) (listener.fn as (event: unknown) => void)(event);
    return { written, prevented };
  };
  assert.deepEqual(copy("screwfast", `模具钢材 S136/${Z}H13/${Z}NAK80`), { written: [["text/plain", "模具钢材 S136/H13/NAK80"]], prevented: true });
  assert.deepEqual(copy("screwfast", "询盘"), { written: [], prevented: false }, "text without break points copies as usual");
  assert.deepEqual(copy("forge", `模具钢材 S136/${Z}H13`), { written: [["text/plain", "模具钢材 S136/H13"]], prevented: true });
  assert.deepEqual(copy("landwind", `模具钢材 S136/${Z}H13`), { written: [["text/plain", "模具钢材 S136/H13"]], prevented: true });
});

test("value cells keep words and Chinese runs whole and only force a break inside a piece wider than the cell", () => {
  const html = composedPageForTemplate("screwfast");
  assert.ok(html);
  const rules = cssRules(styleText(html));
  const declares = (selector: string, declaration: string) => rules.some((rule) => rule.context === ""
    && rule.selector.split(",").map((part) => part.trim()).includes(selector)
    && rule.declarations.includes(declaration));
  for (const selector of [
    ".sitecraft-nameplate-cell dd",
    ".sitecraft-hero-spec dd",
    ".sitecraft-product-key dd",
    ".sitecraft-product-specs td",
    ".sitecraft-compare-value",
    ".sitecraft-compare-extra dd",
  ]) {
    assert.ok(declares(selector, "word-break: keep-all"), `${selector} keeps words and Chinese runs whole`);
    assert.ok(declares(selector, "overflow-wrap: anywhere"), `${selector} still breaks a piece wider than its cell`);
  }
  for (const rule of rules) {
    assert.equal(rule.declarations.some((item) => /word-break:\s*break-all|line-break:\s*anywhere/.test(item)), false, `${rule.selector} must not break words anywhere`);
  }
});
