import assert from "node:assert/strict";
import test from "node:test";
import { blockCatalog, blockIds } from "../lib/blocks/catalog.ts";
import { composedPageForTemplate } from "../lib/blocks/compose.ts";
import { baseFragment, blockFragments } from "../lib/blocks/fragments/index.ts";
import { engineeringLook } from "../lib/blocks/looks/index.ts";
import { checkVariantRequirements, sharedSpecNames } from "../lib/blocks/requirements.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { cssRules } from "./fixtures/css-rules.ts";
import { HtmlDocument, HtmlElement, parseHtmlDocument, visibleText } from "./fixtures/html-dom.ts";
import { packDraft, withLayouts, type PackDraftId } from "./fixtures/pack-drafts.ts";

// T-053 step 2: the four layouts that work without photos — 首屏「大标题加参数条」, 产品「按类别分组」
// and「参数对比表」, 询盘「联系条」. They render through the one preview bridge on the composed page;
// each has a minimum-materials requirement in the catalog.

const NEW_LAYOUTS = [
  { block: "hero", variant: "statement", label: "大标题加参数条", rendered: true },
  { block: "products", variant: "grouped", label: "按类别分组", rendered: true },
  { block: "products", variant: "compare", label: "参数对比表", rendered: true },
  // The band is plain markup: its slots and contact lines use the bridge's existing rules.
  { block: "contact", variant: "band", label: "联系条", rendered: false },
] as const;
const GAP_TEXT = /待补充|To be provided|To be completed/;
const CJK = /[\u3000-\u303f\u3400-\u9fff\uff00-\uffef]/;

function render(draft: unknown, locale: "zh" | "en" = "zh", variant = "published") {
  const html = composedPageForTemplate("screwfast");
  assert.ok(html);
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter?.blocks);
  const document = parseHtmlDocument(html);
  const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  const api = installPreviewBridge(globalObject, "screwfast", adapter);
  const report = api.applyDeclaredContent(draft, locale, [], variant);
  return { document, report, api };
}

function entity(document: HtmlDocument, block: string) {
  const nodes = document.querySelectorAll(`[data-sc-block="${block}"]`);
  assert.equal(nodes.length, 1, `${block} must have one entity`);
  return nodes[0];
}

const text = (node: HtmlElement | null | undefined) => (node ? visibleText(node).replace(/\s+/g, " ").trim() : "");

test("each block gains its no-photo layout, with a user-facing name, a render mode and a materials requirement", () => {
  for (const layout of NEW_LAYOUTS) {
    const spec = blockCatalog[layout.block].variants[layout.variant];
    assert.ok(spec, `${layout.block}:${layout.variant} missing from the catalog`);
    assert.equal(spec.label, layout.label);
    assert.equal(Boolean(spec.render), layout.rendered, `${layout.block}:${layout.variant} render parameters`);
    assert.ok(spec.requires?.length, `${layout.block}:${layout.variant} needs a materials requirement`);
  }
  for (const block of blockIds) {
    const defaultSpec = blockCatalog[block].variants[engineeringLook.defaults[block]];
    assert.equal(defaultSpec.requires?.length ?? 0, 0, `${block} default layout must not need extra materials`);
  }
  const adapter = getTemplateAdapter("screwfast");
  for (const layout of NEW_LAYOUTS) {
    assert.ok(adapter?.blocks?.variants[layout.block].includes(layout.variant));
    assert.deepEqual(adapter?.blocks?.render?.[layout.block]?.[layout.variant], blockCatalog[layout.block].variants[layout.variant].render);
  }
  assert.equal(adapter?.kit?.productCard, undefined, "engineering product cards are configured by the catalog, not the kit");
});

test("requirements follow the materials of the three packs", () => {
  const expected: Record<PackDraftId, Record<string, boolean>> = {
    industrial: { "hero:statement": true, "products:grouped": false, "products:compare": true, "contact:band": false },
    export: { "hero:statement": true, "products:grouped": false, "products:compare": false, "contact:band": false },
    molding: { "hero:statement": true, "products:grouped": true, "products:compare": false, "contact:band": false },
  };
  for (const [pack, cases] of Object.entries(expected) as Array<[PackDraftId, Record<string, boolean>]>) {
    const draft = packDraft(pack);
    for (const [key, ok] of Object.entries(cases)) {
      const [block, variant] = key.split(":");
      const result = checkVariantRequirements(draft, block as (typeof blockIds)[number], variant);
      assert.equal(result.ok, ok, `${pack} ${key}: ${result.failures.map((failure) => failure.message).join(" / ")}`);
      if (!ok) {
        assert.ok(result.failures.length, `${pack} ${key} must say what is missing`);
        for (const failure of result.failures) {
          assert.ok(failure.message.length > 6);
          assert.doesNotMatch(failure.message, /区块|变体|字段|模板|槽|slot|operation|blockVariants/i, "the reason speaks in page terms");
        }
      }
    }
  }
  const exportCompare = checkVariantRequirements(packDraft("export"), "products", "compare");
  assert.match(exportCompare.failures[0].message, /2 项/);
  assert.match(exportCompare.failures[0].message, /额定压力/);
  const moldingCompare = checkVariantRequirements(packDraft("molding"), "products", "compare");
  assert.match(moldingCompare.failures[0].message, /5 个/);
  const industrialBand = checkVariantRequirements(packDraft("industrial"), "contact", "band");
  assert.match(industrialBand.failures[0].message, /只有邮箱/);
  const industrialGroups = checkVariantRequirements(packDraft("industrial"), "products", "grouped");
  assert.match(industrialGroups.failures[0].message, /1 个类别/);
  assert.equal(checkVariantRequirements(packDraft("industrial"), "hero", "split").ok, true, "defaults always pass");
});

test("大标题加参数条: full-width statement, the key specs in a strip even without a photo, no photo slot", () => {
  const draft = withLayouts(packDraft("industrial"), { hero: "statement" });
  const { document, report } = render(draft);
  const hero = entity(document, "hero");
  assert.equal(hero.getAttribute("data-sc-variant"), "statement");
  assert.equal(document.querySelectorAll('[data-sitecraft-benchmark="hero-image"]').length, 0);
  assert.equal(document.querySelectorAll("[data-sitecraft-hero-nameplate]").length, 0);
  assert.equal(text(hero.querySelector("h1")), "按图加工重载减速机");
  const strip = hero.querySelector("[data-sitecraft-hero-specs]");
  assert.equal(strip?.hidden, false, "the strip shows without a product photo");
  const cells = strip?.querySelectorAll(".sitecraft-hero-spec") ?? [];
  assert.equal(cells.length, 4);
  assert.equal(text(cells[0].querySelector("dt")), "直角减速机 · 速比范围");
  assert.equal(text(cells[0].querySelector("dd")), "i=25–100");
  assert.doesNotMatch(text(hero), GAP_TEXT);
  assert.ok(report.appliedSlots.includes("blockVariants.hero"));
  assert.ok(report.appliedSlots.includes("hero.title.zh"));
});

test("c1: choosing the product comparison table removes the hero parameter strip", () => {
  const draft = withLayouts(packDraft("industrial"), { hero: "statement", products: "compare" });
  const { document } = render(draft);
  assert.equal(document.querySelector('[data-sc-block="hero"] [data-sitecraft-hero-specs]')?.hidden, true);
});

test("按类别分组: one group per category in material order, cards without a repeated category, no gap rows", () => {
  const draft = withLayouts(packDraft("molding"), { products: "grouped" });
  draft.products.find((product) => product.name.zh === "精密结构注塑件")!.specs!.find((spec) => spec.name.zh === "表面处理")!.value = "待补充";
  const { document, report } = render(draft);
  const products = entity(document, "products");
  assert.equal(products.getAttribute("data-sc-variant"), "grouped");
  const groups = products.querySelectorAll(".sitecraft-product-group");
  assert.deepEqual(groups.map((group) => text(group.querySelector(".sitecraft-product-group-title"))), ["注塑模具", "精密注塑件"]);
  assert.deepEqual(groups.map((group) => group.querySelectorAll(".sitecraft-product-card").length), [2, 3]);
  assert.deepEqual(groups[1].querySelectorAll(".sitecraft-product-card h4").map((node) => text(node)), ["精密结构注塑件", "透明光学注塑件", "金属嵌件注塑件"]);
  assert.equal(products.querySelectorAll(".sitecraft-product-category").length, 0, "the group title already names the category");
  assert.equal(products.querySelectorAll(".sitecraft-product-card h3").length, 0);
  const structural = products.querySelector(`[data-sitecraft-product="${draft.products.find((product) => product.name.zh === "精密结构注塑件")!.id}"]`);
  assert.ok(structural);
  assert.doesNotMatch(text(structural), /表面处理/, "a spec whose value is a gap is left out");
  assert.match(text(structural), /PA66\+GF\/POM\/PBT\/PC/);
  assert.doesNotMatch(text(products), GAP_TEXT);
  assert.ok(report.appliedSlots.includes("products"));
  assert.ok(report.appliedSlots.includes(`products.${draft.products[3].id}.name.zh`));
});

test("按类别分组 puts products without a category last under a plain label", () => {
  const draft = withLayouts(packDraft("molding"), { products: "grouped" });
  draft.products[1].category = "";
  const { document } = render(draft, "en");
  const titles = entity(document, "products").querySelectorAll(".sitecraft-product-group-title").map((node) => text(node));
  assert.deepEqual(titles, ["Injection molds", "Precision molded parts", "Other products"]);
});

test("参数对比表: series on top, then one row per spec every product has, one column per product", () => {
  const draft = withLayouts(packDraft("industrial"), { products: "compare" });
  const { document, report } = render(draft);
  const products = entity(document, "products");
  assert.equal(products.getAttribute("data-sc-variant"), "compare");
  const series = products.querySelectorAll(".sitecraft-compare-series-card");
  assert.deepEqual(series.map((card) => text(card.querySelector("h3"))), ["直角减速机", "行星减速机"]);
  for (const card of series) assert.equal(card.querySelector(".sitecraft-product-ask")?.getAttribute("href"), "#inquiry");
  const table = products.querySelector("table.sitecraft-compare-table");
  assert.ok(table);
  assert.deepEqual(table.querySelectorAll("thead th").map((node) => text(node)), ["参数", "直角减速机", "行星减速机"]);
  const allRows = table.querySelectorAll("tbody tr");
  const rows = allRows.filter((row) => !row.className.includes("sitecraft-compare-extra-row"));
  assert.deepEqual(rows.map((row) => text(row.querySelector("th"))), ["速比范围", "额定输出扭矩", "输入转速", "安装方式"]);
  assert.deepEqual(allRows.map((row) => text(row.querySelector("th"))).slice(-1), ["其他参数"], "the specs only one series has are the table's last row");
  assert.deepEqual(rows[0].querySelectorAll("td .sitecraft-compare-value").map((node) => text(node)), ["i=25–100", "i=4–100"]);
  assert.deepEqual(rows[0].querySelectorAll("td .sitecraft-compare-label").map((node) => text(node)), ["直角减速机", "行星减速机"], "each cell names its product for the phone layout");
  // Specs only one series has sit in the table's last row, in that series' column, folded.
  assert.deepEqual(allRows[allRows.length - 1].querySelectorAll("td").map((cell) => cell.querySelectorAll(".sitecraft-compare-extra dt").map((node) => text(node))), [["中心距"], ["机座号", "防护等级"]]);
  assert.equal(series.flatMap((card) => card.querySelectorAll(".sitecraft-compare-extra")).length, 0, "the cards do not repeat them");
  assert.doesNotMatch(text(products), GAP_TEXT);
  assert.ok(report.appliedSlots.includes(`products.${draft.products[0].id}.specs`));
});

test("参数对比表 leaves a spec out of the table when one product has no value for it", () => {
  const draft = withLayouts(packDraft("industrial"), { products: "compare" });
  draft.products[1].specs![4] = { name: { zh: "安装方式", en: "Mounting" }, value: "待补充" };
  const { document } = render(draft);
  const products = entity(document, "products");
  const allRows = products.querySelectorAll("tbody tr");
  assert.deepEqual(allRows.filter((row) => !row.className.includes("sitecraft-compare-extra-row")).map((row) => text(row.querySelector("th"))), ["速比范围", "额定输出扭矩", "输入转速"]);
  assert.deepEqual(allRows[allRows.length - 1].querySelectorAll("td")[0].querySelectorAll(".sitecraft-compare-extra dt").map((node) => text(node)), ["中心距", "安装方式"]);
  assert.doesNotMatch(text(products), GAP_TEXT);
});

test("参数对比表 needs 2–4 products sharing at least 3 specs with values", () => {
  assert.deepEqual(blockCatalog.products.variants.compare.requires, [{ kind: "sharedSpecs", minProducts: 2, maxProducts: 4, minShared: 3 }]);
  // The P3I materials with the mounting of one series still to be provided: three shared specs.
  const three = packDraft("industrial");
  three.products[1].specs![4] = { name: { zh: "安装方式", en: "Mounting" }, value: "待补充" };
  assert.deepEqual(sharedSpecNames(three), ["速比范围", "额定输出扭矩", "输入转速"]);
  assert.equal(checkVariantRequirements(three, "products", "compare").ok, true);
  const two = structuredClone(three);
  two.products[0].specs![3] = { name: { zh: "输入转速", en: "Input speed" }, value: "待补充" };
  const result = checkVariantRequirements(two, "products", "compare");
  assert.equal(result.ok, false);
  assert.match(result.failures[0].message, /至少 3 项/);
  assert.match(result.failures[0].message, /只共有 2 项（速比范围、额定输出扭矩）/);
});

test("联系条: one cell per contact line that has a value, the form below", () => {
  const industrialBand = render(withLayouts(packDraft("industrial"), { contact: "band" }));
  const contact = entity(industrialBand.document, "contact");
  assert.equal(contact.getAttribute("data-sc-variant"), "band");
  const lines = contact.querySelectorAll(".sitecraft-band-line").filter((line) => !line.hidden);
  assert.deepEqual(lines.map((line) => text(line.querySelector("dt"))), ["邮箱"]);
  assert.deepEqual(lines.map((line) => text(line.querySelector("dd"))), ["inquiry@xinzhou-drive.luckye.online"]);
  assert.equal(contact.querySelectorAll('[data-sitecraft-inquiry="true"]').length, 1);

  const sparse = entity(render(withLayouts(packDraft("molding"), { contact: "band" })).document, "contact");
  assert.deepEqual(sparse.querySelectorAll(".sitecraft-band-line").filter((line) => !line.hidden).map((line) => text(line.querySelector("dt"))), ["邮箱"]);
  assert.doesNotMatch(text(sparse), GAP_TEXT);
});

// Spec values are single-language facts from the materials (「底脚/法兰」); only the interface
// text around them has to follow the page language.
const VALUE_NODES = ".sitecraft-compare-value, .sitecraft-compare-extra dd, .sitecraft-hero-spec dd, .sitecraft-product-key dd, .sitecraft-product-specs td";
function interfaceText(node: HtmlElement): string {
  const walk = (current: HtmlElement): string => current.childNodes.map((child) => {
    if (!(child instanceof HtmlElement)) return child.textContent;
    if (child.hidden || child.styleValues.display === "none" || child.matches(VALUE_NODES)) return "";
    return walk(child);
  }).join(" ");
  return walk(node).replace(/\s+/g, " ").trim();
}

test("the new layouts speak English on the English page", () => {
  const layouts = { hero: "statement", products: "compare", contact: "band" };
  const industrial = render(withLayouts(packDraft("industrial"), layouts), "en");
  for (const block of ["hero", "products", "contact"]) {
    const node = entity(industrial.document, block);
    assert.doesNotMatch(interfaceText(node), CJK, `${block} shows Chinese interface text on the English page: ${interfaceText(node)}`);
  }
  assert.deepEqual(entity(industrial.document, "products").querySelectorAll("thead th").map((node) => text(node)), ["Specification", "Right-angle gearbox", "Planetary gearbox"]);
  assert.match(text(entity(industrial.document, "products").querySelector(".sitecraft-compare-more summary")), /^Other specifications \(1\)$/);
  const molding = render(withLayouts(packDraft("molding"), { products: "grouped" }), "en");
  const groups = entity(molding.document, "products");
  assert.deepEqual(groups.querySelectorAll(".sitecraft-product-group-title").map((node) => text(node)), ["Injection molds", "Precision molded parts"]);
  for (const toggle of groups.querySelectorAll(".sitecraft-product-more summary")) assert.match(text(toggle), /^All specifications \(\d+\)$/);
  assert.doesNotMatch(interfaceText(groups), CJK, `grouped products show Chinese interface text: ${interfaceText(groups)}`);
  assert.doesNotMatch(interfaceText(entity(render(withLayouts(packDraft("molding"), { hero: "statement" }), "en").document, "hero")), CJK);
});

test("renderer and requirement agree on the three packs", () => {
  const compareRequirement = blockCatalog.products.variants.compare.requires?.[0];
  assert.ok(compareRequirement && compareRequirement.kind === "sharedSpecs");
  for (const pack of ["industrial", "export", "molding"] as const) {
    const draft = packDraft(pack);
    const hero = entity(render(withLayouts(draft, { hero: "statement" })).document, "hero");
    const facts = hero.querySelectorAll(".sitecraft-hero-spec").length;
    assert.equal(checkVariantRequirements(draft, "hero", "statement").ok, facts >= 3, `${pack} statement strip has ${facts}`);
    const grouped = entity(render(withLayouts(draft, { products: "grouped" })).document, "products");
    const named = grouped.querySelectorAll(".sitecraft-product-group").map((group) => group.querySelectorAll(".sitecraft-product-card").length);
    assert.equal(checkVariantRequirements(draft, "products", "grouped").ok, named.length >= 2 && Math.max(...named) >= 2, `${pack} groups ${named}`);
    const compare = entity(render(withLayouts(draft, { products: "compare" })).document, "products");
    const rows = compare.querySelectorAll("tbody tr").filter((row) => !row.className.includes("sitecraft-compare-extra-row")).length;
    const columns = compare.querySelectorAll(".sitecraft-compare-series-card").length;
    assert.equal(checkVariantRequirements(draft, "products", "compare").ok, rows >= compareRequirement.minShared && columns >= compareRequirement.minProducts && columns <= compareRequirement.maxProducts, `${pack} compare ${rows}x${columns}`);
    const band = entity(render(withLayouts(draft, { contact: "band" })).document, "contact");
    const lines = band.querySelectorAll(".sitecraft-band-line").filter((line) => !line.hidden).length;
    assert.equal(checkVariantRequirements(draft, "contact", "band").ok, lines >= 2, `${pack} band ${lines}`);
  }
});

test("switching the product layout rebuilds the block for the new choice and leaves nothing behind", () => {
  const draft = packDraft("industrial");
  const html = composedPageForTemplate("screwfast");
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(html && adapter);
  const document = parseHtmlDocument(html);
  const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  const api = installPreviewBridge(globalObject, "screwfast", adapter);
  for (const variant of ["compare", "grouped", "cards", "compare"]) {
    api.applyDeclaredContent(withLayouts(draft, { products: variant }), "zh", [], "published");
    const products = entity(document, "products");
    assert.equal(products.getAttribute("data-sc-variant"), variant);
    assert.equal(products.querySelectorAll("table.sitecraft-compare-table").length, variant === "compare" ? 1 : 0);
    assert.equal(products.querySelectorAll(".sitecraft-product-group").length, variant === "grouped" ? 1 : 0);
    assert.equal(products.querySelectorAll(".sitecraft-product-card").length, variant === "compare" ? 0 : 2);
    assert.equal(document.querySelectorAll("[data-sitecraft-product-grid]").length, 1);
  }
});

test("the new layouts' CSS lets values wrap and never touches the default layouts", () => {
  const prefixes = ["sitecraft-statement", "sitecraft-compare", "sitecraft-product-group", "sitecraft-band"];
  const newFragments = [blockFragments.hero, blockFragments.products, blockFragments.contact];
  const allCss = [baseFragment, ...newFragments].flatMap((fragment) => [fragment.css, fragment.narrow ?? "", fragment.phone ?? ""]).join("\n");
  const scoped = cssRules(allCss).filter((rule) => prefixes.some((prefix) => rule.selector.includes(prefix)));
  assert.ok(scoped.length > 10, "the new layouts have their own rules");
  for (const rule of scoped) {
    for (const part of rule.selector.split(",")) {
      assert.ok(prefixes.some((prefix) => part.includes(`.${prefix}`)), `${part.trim()} must be scoped to a new layout class`);
    }
    assert.equal(rule.declarations.some((declaration) => /white-space:\s*nowrap/.test(declaration)), false, `${rule.selector} keeps values on one line`);
  }
  const wraps = (selector: string) => scoped.some((rule) => rule.selector.includes(selector) && rule.declarations.some((declaration) => /overflow-wrap:\s*anywhere/.test(declaration)));
  for (const selector of [".sitecraft-statement-specs", ".sitecraft-compare-table", ".sitecraft-compare-extra", ".sitecraft-product-groups", ".sitecraft-band-line"]) {
    assert.ok(wraps(selector), `${selector} values must be allowed to break`);
  }
});

test('c1: changing cards to comparison hides an already mounted statement strip', () => {
 const draft=withLayouts(packDraft('industrial'),{hero:'statement'});
 const { document }=render(draft);
 const adapter=getTemplateAdapter('screwfast');
 assert.ok(adapter);
 const globalObject={document,parent:{postMessage(){}},addEventListener(){}};
 const api=installPreviewBridge(globalObject,'screwfast',adapter);
 api.applyDeclaredContent({...draft,blockVariants:{hero:'statement',products:'compare'}},'zh',[],'published');
 assert.equal(document.querySelector('[data-sitecraft-hero-specs]')?.hidden,true);
});
