import assert from "node:assert/strict";
import test from "node:test";
import { blockCatalog } from "../lib/blocks/catalog.ts";
import { blockLooks } from "../lib/blocks/looks/index.ts";
import { composeLookDocument, composedPageForTemplate } from "../lib/blocks/compose.ts";
import { blockFragments } from "../lib/blocks/fragments/index.ts";
import { checkVariantRequirements } from "../lib/blocks/requirements.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { applySiteOperations, type SiteOperation } from "../lib/site-operations.ts";
import { resolveVars, rootTokens } from "./fixtures/look-tokens.ts";
import { parseHtmlDocument, parseHtmlFragment, visibleText } from "./fixtures/html-dom.ts";
import { packDraft, withLayouts } from "./fixtures/pack-drafts.ts";
import { base, openBrowser } from "./helpers/workspace-browser.ts";

// T-073: 产品「型号索引表」(products:index). One row per product: category, name, that product's
// own first three valued specs (each cell names its spec, so rows need not share any), and the
// inquiry link. It needs at least 3 visible products, and it does not show the product summary.

const text = (node: Parameters<typeof visibleText>[0] | null | undefined) => (node ? visibleText(node).replace(/\s+/g, " ").trim() : "");

function render(draft: unknown, locale: "zh" | "en" = "zh", expectedTargets: string[] = []) {
  const html = composedPageForTemplate("screwfast");
  assert.ok(html);
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter?.blocks);
  const document = parseHtmlDocument(html);
  const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  const api = installPreviewBridge(globalObject, "screwfast", adapter);
  const report = api.applyDeclaredContent(draft, locale, expectedTargets, "published");
  const entities = document.querySelectorAll('[data-sc-block="products"]');
  assert.equal(entities.length, 1);
  return { document, report, products: entities[0] };
}

test("型号索引表 is in the catalog with a user-facing name, its own render mode and a 3-product requirement", () => {
  const spec = blockCatalog.products.variants.index;
  assert.ok(spec, "products:index missing from the catalog");
  assert.equal(spec.label, "型号索引表");
  assert.deepEqual(spec.render, { products: "index", keySpecs: 3, askHref: "#inquiry" });
  assert.deepEqual(spec.requires, [{ kind: "productCount", min: 3 }]);
  assert.ok(blockFragments.products.variants.index, "products:index has no markup");
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter?.blocks?.variants.products.includes("index"));
  assert.deepEqual(adapter?.blocks?.render?.products?.index, spec.render);
});

test("型号索引表 needs at least 3 visible products and says so in page words when short", () => {
  assert.equal(checkVariantRequirements(packDraft("molding"), "products", "index").ok, true, "molding has 5 products");
  for (const pack of ["industrial", "export"] as const) {
    const result = checkVariantRequirements(packDraft(pack), "products", "index");
    assert.equal(result.ok, false, `${pack} has 2 products`);
    assert.match(result.failures[0].message, /型号索引表要至少 3 个产品；现在有 2 个/);
    assert.doesNotMatch(result.failures[0].message, /区块|变体|字段|槽|slot|operation|blockVariants/i);
  }
  const three = packDraft("molding");
  three.products = three.products.slice(0, 3);
  assert.equal(checkVariantRequirements(three, "products", "index").ok, true, "exactly 3 is enough");
  const archived = structuredClone(three);
  archived.products[2].status = "archived" as never;
  assert.equal(checkVariantRequirements(archived, "products", "index").ok, false, "an archived product does not count");
  const blank = structuredClone(three);
  blank.products[2].name = { zh: "待补充", en: "To be provided" };
  blank.products[2].summary = { zh: "待补充", en: "To be provided" };
  assert.equal(checkVariantRequirements(blank, "products", "index").ok, false, "a product blank in name and summary does not count");
});

test("型号索引表 declares its slots once each and carries no summary node", () => {
  const spec = blockCatalog.products.variants.index;
  const fragment = parseHtmlFragment(blockFragments.products.variants.index);
  assert.equal(fragment.children.length, 1);
  assert.equal(fragment.children[0].getAttribute("data-sc-block"), "products");
  assert.equal(fragment.children[0].getAttribute("data-sc-variant"), "index");
  for (const slot of spec.slots) assert.equal(fragment.querySelectorAll(slot.selector).length, 1, `slot ${slot.target} (${slot.selector}) must hit exactly one node`);
  for (const marker of spec.markers) assert.equal(fragment.querySelectorAll(marker).length, 1, `marker ${marker} must hit exactly one node`);
  assert.equal(fragment.querySelectorAll("#products").length, 1);
  assert.equal(fragment.querySelectorAll('[data-sitecraft-section="products"]').length, 1);
  for (const part of spec.parts) assert.equal(fragment.querySelectorAll(`[data-sc-part="${part}"]`).length, 1, `part ${part} is used once`);
});

test("型号索引表 renders one row per product with its own first three valued specs and an inquiry link", () => {
  const draft = withLayouts(packDraft("molding"), { products: "index" });
  draft.products[0].specs![1] = { name: { zh: "模具尺寸", en: "Mold size" }, value: "待补充" };
  const { products, report } = render(draft);
  assert.equal(products.getAttribute("data-sc-variant"), "index");
  const rows = products.querySelectorAll("table.sitecraft-index-table tbody tr");
  assert.deepEqual(rows.map((row) => text(row.querySelector("h3"))), draft.products.map((product) => product.name.zh));
  assert.deepEqual(rows.map((row) => text(row.querySelector(".sitecraft-product-category"))), ["注塑模具", "注塑模具", "精密注塑件", "精密注塑件", "精密注塑件"]);
  const labels = (row: (typeof rows)[number]) => row.querySelectorAll(".sitecraft-index-spec-label").map((node) => text(node));
  assert.deepEqual(labels(rows[0]), ["型腔数", "模具钢材", "成型周期"], "a spec without a value is skipped, the next valued one takes its place");
  assert.deepEqual(labels(rows[1]), ["成型方式", "适配机型", "材料组合"], "rows need not share specs");
  assert.deepEqual(labels(rows[2]), ["适用材料", "单件重量", "尺寸公差"], "the gap-valued 表面处理 is not shown");
  assert.equal(text(rows[0].querySelector(".sitecraft-index-spec-value")), "1–32 腔");
  assert.doesNotMatch(text(rows[0]), /模具尺寸/);
  for (const row of rows) assert.equal(row.querySelector(".sitecraft-product-ask")?.getAttribute("href"), "#inquiry");
  assert.doesNotMatch(text(products), /待补充|To be provided/);
  assert.equal(products.querySelectorAll(".sitecraft-product-card").length, 0, "a ledger, not cards");
  assert.ok(report.appliedSlots.includes("products"));
  for (const product of draft.products) {
    assert.ok(report.appliedSlots.includes(`products.${product.id}.name.zh`));
    assert.ok(report.appliedSlots.includes(`products.${product.id}.specs`));
  }
});

test("型号索引表 does not show the summary: an edit of it is reported missing, not applied", () => {
  const draft = withLayouts(packDraft("molding"), { products: "index" });
  const id = draft.products[0].id;
  const targets = [`products.${id}.name.zh`, `products.${id}.specs`, `products.${id}.summary.zh`];
  const index = render(draft, "zh", targets);
  assert.equal(index.products.querySelectorAll(`[data-sitecraft-slot="products.${id}.summary.zh"]`).length, 0);
  assert.doesNotMatch(text(index.products), new RegExp(draft.products[0].summary.zh.slice(0, 8)));
  assert.deepEqual(index.report.missingSlots, [`products.${id}.summary.zh`]);
  assert.ok(index.report.appliedSlots.includes(`products.${id}.name.zh`));
  const cards = render(withLayouts(draft, { products: "cards" }), "zh", targets);
  assert.deepEqual(cards.report.missingSlots, [], "the card layout does show the summary");
});

test("型号索引表 reads the English draft and keeps a product with fewer specs as a short row", () => {
  const draft = withLayouts(packDraft("molding"), { products: "index" });
  draft.products[1].specs = draft.products[1].specs!.slice(0, 1);
  const { products } = render(draft, "en");
  const rows = products.querySelectorAll("tbody tr");
  assert.equal(text(rows[0].querySelector("h3")), draft.products[0].name.en);
  assert.deepEqual(rows[0].querySelectorAll(".sitecraft-index-spec-label").map((node) => text(node)), draft.products[0].specs!.slice(0, 3).map((spec) => spec.name.en));
  assert.equal(rows[1].querySelectorAll(".sitecraft-index-spec-label").length, 1);
  assert.equal(rows[1].querySelectorAll("td.sitecraft-index-spec").filter((cell) => cell.querySelector(".sitecraft-index-spec-label")).length, 1);
  assert.match(text(products.querySelector("thead")), /Product\s+Key specifications/);
});

test("型号索引表 has no horizontal overflow at 1440, 768 and 375 on two looks", async () => {
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  try {
    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Runtime.enable", {}, sessionId);
    for (const templateId of ["screwfast", "landwind"]) {
      await browser.send("Page.navigate", { url: `${base}/api/templates/${templateId}/preview?product-index=${Date.now()}` }, sessionId);
      for (let waited = 0; waited < 30000; waited += 100) {
        if (await browser.eval<boolean>("document.readyState === 'complete' && typeof window.__sitecraftApplyDeclared === 'function'", sessionId).catch(() => false)) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const draft = { ...withLayouts(packDraft("molding"), { products: "index" }), templateId };
      for (const width of [1440, 768, 375]) {
        await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
        await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, "zh", [], "published", null, false)`, sessionId);
        const result = await browser.eval<{ variant: string; rows: number; pageWidth: number; viewport: number; outside: string[] }>(`(() => {
          const block = document.querySelector('[data-sc-block="products"]');
          const vw = window.innerWidth;
          const outside = [...block.querySelectorAll('*')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 1 && (r.right > vw + 1 || r.left < -1); }).map((el) => el.className || el.tagName);
          return { variant: block.getAttribute('data-sc-variant'), rows: block.querySelectorAll('tbody tr').length, pageWidth: document.documentElement.scrollWidth, viewport: vw, outside };
        })()`, sessionId);
        const where = `${templateId} @${width}`;
        assert.equal(result.variant, "index", where);
        assert.equal(result.rows, 5, where);
        assert.ok(result.pageWidth <= result.viewport + 1, `${where}: page scrolls sideways (${result.pageWidth} > ${result.viewport})`);
        assert.deepEqual(result.outside, [], `${where}: nodes outside the viewport`);
      }
    }
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    try { browser.ws.send(JSON.stringify({ id: browser.id++, method: "Browser.close" })); } catch {}
    browser.ws.close();
  }
});

// The index table's rules read look tokens with a fallback; every block look must end up with a
// real value for each (a var() with nothing behind it makes the whole declaration invalid, so the
// rule silently disappears on that look).
test("型号索引表 rule tokens resolve to a real value on every block look", () => {
  const css = blockFragments.products.css;
  const top = /\.sitecraft-index-table \{[^}]*border-top: (var\(--site-index-top[^;]*\));/.exec(css)?.[1];
  const row = /\.sitecraft-index-table thead th \{[^}]*border-bottom: (var\(--site-index-row[^;]*\));/.exec(css)?.[1];
  assert.ok(top && row, "the index CSS reads --site-index-top and --site-index-row");
  assert.ok(blockLooks.length >= 4);
  for (const look of blockLooks) {
    const palette = getTemplateAdapter(look.templateId)?.kit?.tokens;
    assert.ok(palette, `${look.id} has a palette`);
    const tokens = rootTokens(composeLookDocument(look, palette));
    assert.notEqual(resolveVars(top, tokens), null, `${look.id}: ${top} has no value, so the table's top rule is invalid`);
    assert.notEqual(resolveVars(row, tokens), null, `${look.id}: ${row} has no value, so the row rules are invalid`);
  }
});

test("a layout request for the index table is refused for a 2-product company and recorded for a 5-product one", () => {
  const options = { templateIds: new Set(["forge", "screwfast", "landwind", "tailwind-landing", "fresh"]), lastChange: "product-index" };
  const setIndex = { op: "set_block_variant", block: "products", variant: "index" } as SiteOperation;
  for (const pack of ["industrial", "export"] as const) {
    assert.throws(() => applySiteOperations(packDraft(pack), [setIndex], options), (error: Error) => {
      assert.match(error.message, /型号索引表要至少 3 个产品；现在有 2 个/);
      assert.doesNotMatch(error.message, /区块|变体|blockVariants|operation/);
      return true;
    });
  }
  const accepted = applySiteOperations(packDraft("molding"), [setIndex], options);
  assert.deepEqual(accepted.draft.blockVariants, { products: "index" });
  assert.deepEqual(accepted.appliedTargets, ["blockVariants.products"]);
});
