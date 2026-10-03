import assert from "node:assert/strict";
import test from "node:test";
import { blockCatalog } from "../lib/blocks/catalog.ts";
import { composeLookDocument, composedPageForTemplate } from "../lib/blocks/compose.ts";
import { blockFragments } from "../lib/blocks/fragments/index.ts";
import { blockLooks } from "../lib/blocks/looks/index.ts";
import { checkVariantRequirements } from "../lib/blocks/requirements.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { resolveVars, rootTokens } from "./fixtures/look-tokens.ts";
import { parseHtmlDocument, parseHtmlFragment, visibleText } from "./fixtures/html-dom.ts";
import { packDraft, withLayouts } from "./fixtures/pack-drafts.ts";
import { base, openBrowser } from "./helpers/workspace-browser.ts";

// T-074: 首屏「目录封面」(hero:cover). The hero copy on the left, the product series on the right
// as a contents list (category and name, each a link to the products block), at most 6 rows. It
// needs at least 2 visible products and reads no specs, summaries or photos.

const text = (node: Parameters<typeof visibleText>[0] | null | undefined) => (node ? visibleText(node).replace(/\s+/g, " ").trim() : "");

function withProducts(count: number, templateId?: string) {
  const draft = withLayouts(packDraft("molding"), { hero: "cover" });
  const source = draft.products;
  draft.products = Array.from({ length: count }, (_, index) => {
    const product = structuredClone(source[index % source.length]);
    if (index >= source.length) {
      product.id = `extra-${index}` as typeof product.id;
      product.sku = `extra-${index}`;
      product.name = { zh: `扩展系列${index + 1}`, en: `Extra series ${index + 1}` };
    }
    return product;
  });
  return templateId ? { ...draft, templateId } : draft;
}

function render(draft: unknown, locale: "zh" | "en" = "zh") {
  const html = composedPageForTemplate("screwfast");
  assert.ok(html);
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter?.blocks);
  const document = parseHtmlDocument(html);
  const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  installPreviewBridge(globalObject, "screwfast", adapter).applyDeclaredContent(draft, locale, [], "published");
  const entities = document.querySelectorAll('[data-sc-block="hero"]');
  assert.equal(entities.length, 1);
  return entities[0];
}

test("目录封面 is in the catalog with a user-facing name, a render mode and a 2-product requirement", () => {
  const spec = blockCatalog.hero.variants.cover;
  assert.ok(spec, "hero:cover missing from the catalog");
  assert.equal(spec.label, "目录封面");
  assert.deepEqual(spec.slots, blockCatalog.hero.variants.statement.slots);
  assert.deepEqual(spec.markers, ["[data-sitecraft-hero-index]"]);
  assert.deepEqual(spec.render, { heroIndex: true });
  assert.deepEqual(spec.requires, [{ kind: "productCount", min: 2, layout: "目录封面" }]);
  assert.ok(blockFragments.hero.variants.cover, "hero:cover has no markup");
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter?.blocks?.variants.hero.includes("cover"));
  assert.deepEqual(adapter?.blocks?.render?.hero?.cover, spec.render);
});

test("目录封面 needs at least 2 visible products and says so in page words", () => {
  for (const pack of ["industrial", "export", "molding"] as const) assert.equal(checkVariantRequirements(packDraft(pack), "hero", "cover").ok, true, `${pack} has 2 or more products`);
  const one = packDraft("molding");
  one.products = one.products.slice(0, 1);
  const result = checkVariantRequirements(one, "hero", "cover");
  assert.equal(result.ok, false);
  assert.match(result.failures[0].message, /目录封面要至少 2 个产品；现在有 1 个/);
  assert.doesNotMatch(result.failures[0].message, /区块|变体|字段|槽|slot|operation|blockVariants/i);
  const archived = packDraft("industrial");
  archived.products[1].status = "archived" as never;
  assert.equal(checkVariantRequirements(archived, "hero", "cover").ok, false, "an archived product does not count");
});

test("目录封面 declares its slots and marker once each and names its parts", () => {
  const spec = blockCatalog.hero.variants.cover;
  const fragment = parseHtmlFragment(blockFragments.hero.variants.cover);
  assert.equal(fragment.children.length, 1);
  assert.equal(fragment.children[0].getAttribute("data-sc-block"), "hero");
  assert.equal(fragment.children[0].getAttribute("data-sc-variant"), "cover");
  for (const slot of spec.slots) assert.equal(fragment.querySelectorAll(slot.selector).length, 1, `slot ${slot.target} (${slot.selector}) must hit exactly one node`);
  for (const marker of spec.markers) assert.equal(fragment.querySelectorAll(marker).length, 1, `marker ${marker}`);
  for (const part of spec.parts) assert.equal(fragment.querySelectorAll(`[data-sc-part="${part}"]`).length, 1, `part ${part} is used once`);
});

test("目录封面 lists the series in material order with category and a link to the products block", () => {
  const hero = render(withProducts(5));
  assert.equal(hero.getAttribute("data-sc-variant"), "cover");
  const nav = hero.querySelector("[data-sitecraft-hero-index]");
  assert.ok(nav);
  assert.equal(nav.hidden, false);
  assert.equal(text(nav.querySelector("p")), "产品系列");
  const rows = nav.querySelectorAll("li");
  assert.deepEqual(rows.map((row) => text(row.querySelector(".sitecraft-cover-index-name"))), ["多腔热流道模具", "双色注塑模具", "精密结构注塑件", "透明光学注塑件", "金属嵌件注塑件"]);
  assert.deepEqual(rows.map((row) => text(row.querySelector(".sitecraft-cover-index-category"))), ["注塑模具", "注塑模具", "精密注塑件", "精密注塑件", "精密注塑件"]);
  for (const row of rows) assert.equal(row.querySelector("a")?.getAttribute("href"), "#products");
  assert.equal(nav.querySelectorAll("[data-sitecraft-slot]").length, 0, "the names have no edit slot: editing a product stays on its block");
  assert.equal(hero.querySelectorAll("[data-sitecraft-hero-specs]").length, 0, "no spec strip or nameplate in this layout");
  assert.doesNotMatch(text(nav), /待补充|To be provided/);
});

test("目录封面 lists at most 6 series, follows the page language and leaves out a category that repeats the name", () => {
  const eight = render(withProducts(8));
  assert.equal(eight.querySelectorAll("[data-sitecraft-hero-index] li").length, 6);
  const draft = withProducts(3);
  draft.products[0].category = { ...draft.products[0].name };
  const hero = render(draft, "en");
  const nav = hero.querySelector("[data-sitecraft-hero-index]")!;
  assert.equal(text(nav.querySelector("p")), "Product series");
  const rows = nav.querySelectorAll("li");
  assert.equal(text(rows[0].querySelector(".sitecraft-cover-index-name")), draft.products[0].name.en);
  assert.equal(rows[0].querySelectorAll(".sitecraft-cover-index-category").length, 0, "a category equal to the name is not repeated");
  assert.equal(text(rows[1].querySelector(".sitecraft-cover-index-category")), (draft.products[1].category as { en: string }).en);
});

test("目录封面 has no horizontal overflow with 2, 5 and 8 products at 1440, 768 and 375 on two looks", async () => {
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  try {
    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Runtime.enable", {}, sessionId);
    for (const templateId of ["screwfast", "landwind"]) {
      await browser.send("Page.navigate", { url: `${base}/api/templates/${templateId}/preview?hero-cover=${Date.now()}` }, sessionId);
      for (let waited = 0; waited < 30000; waited += 100) {
        if (await browser.eval<boolean>("document.readyState === 'complete' && typeof window.__sitecraftApplyDeclared === 'function'", sessionId).catch(() => false)) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      for (const count of [2, 5, 8]) {
        const draft = withProducts(count, templateId);
        draft.products[0].name = { zh: "多腔热流道精密注塑模具（含针阀式浇口与模温机）", en: "Multi-cavity hot runner precision injection mold with valve gates" };
        draft.products[0].category = { zh: "注塑模具与热流道系统（含维修保养服务）", en: "Injection molds and hot runner systems including maintenance service" };
        for (const width of [1440, 768, 375]) {
          await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
          await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, "zh", [], "published", null, false)`, sessionId);
          const result = await browser.eval<{ variant: string; rows: number; pageWidth: number; viewport: number; outside: string[] }>(`(() => {
            const block = document.querySelector('[data-sc-block="hero"]');
            const vw = window.innerWidth;
            const outside = [...block.querySelectorAll('*')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 1 && (r.right > vw + 1 || r.left < -1); }).map((el) => String(el.className || el.tagName));
            return { variant: block.getAttribute('data-sc-variant'), rows: block.querySelectorAll('[data-sitecraft-hero-index] li').length, pageWidth: document.documentElement.scrollWidth, viewport: vw, outside };
          })()`, sessionId);
          const where = `${templateId} ${count} products @${width}`;
          assert.equal(result.variant, "cover", where);
          assert.equal(result.rows, Math.min(count, 6), where);
          assert.ok(result.pageWidth <= result.viewport + 1, `${where}: page scrolls sideways (${result.pageWidth} > ${result.viewport})`);
          assert.deepEqual(result.outside, [], `${where}: nodes outside the viewport`);
        }
      }
    }
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    try { browser.ws.send(JSON.stringify({ id: browser.id++, method: "Browser.close" })); } catch {}
    browser.ws.close();
  }
});

test("目录封面 rule tokens resolve to a real value on every block look", () => {
  const css = blockFragments.hero.css;
  const top = /\.sitecraft-cover-index \{[^}]*border-top: (var\(--site-index-top[^;]*\));/.exec(css)?.[1];
  const row = /\.sitecraft-cover-index li \{[^}]*border-bottom: (var\(--site-index-row[^;]*\));/.exec(css)?.[1];
  assert.ok(top && row, "the cover index CSS reads --site-index-top and --site-index-row");
  for (const look of blockLooks) {
    const palette = getTemplateAdapter(look.templateId)?.kit?.tokens;
    assert.ok(palette, `${look.id} has a palette`);
    const tokens = rootTokens(composeLookDocument(look, palette));
    assert.notEqual(resolveVars(top, tokens), null, `${look.id}: ${top} has no value`);
    assert.notEqual(resolveVars(row, tokens), null, `${look.id}: ${row} has no value`);
  }
});
