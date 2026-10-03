import assert from "node:assert/strict";
import test from "node:test";
import { composedPageForTemplate } from "../lib/blocks/compose.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { parseHtmlDocument, visibleText } from "./fixtures/html-dom.ts";
import { packDraft, withLayouts } from "./fixtures/pack-drafts.ts";

function render(draft: ReturnType<typeof packDraft>, variant: string) {
  const html = composedPageForTemplate("screwfast");
  assert.ok(html);
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter);
  const document = parseHtmlDocument(html);
  const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  installPreviewBridge(globalObject, "screwfast", adapter).applyDeclaredContent(withLayouts(draft, { products: variant }), "zh", [], "published");
  return document;
}

test("products with no SKU still have unique product identity attributes in every layout", () => {
  for (const [draft, variants] of [[packDraft("industrial"), ["cards", "rows", "compare"]], [packDraft("molding"), ["grouped", "index"]]] as const) {
    draft.products = draft.products.map((product) => ({ ...product, sku: "待补充" }));
    for (const variant of variants) {
      const document = render(draft, variant);
      const nodes = document.querySelectorAll("[data-sitecraft-product]");
      const values = nodes.map((node) => node.getAttribute("data-sitecraft-product"));
      assert.deepEqual(values, draft.products.map((product) => product.id), `${variant} uses stable product ids`);
      assert.equal(new Set(values).size, values.length, `${variant} product identity attributes are unique`);
    }
  }
});

test("published product content never shows an SKU gap marker", () => {
  const draft = packDraft("industrial");
  draft.products = draft.products.map((product) => ({ ...product, sku: "待补充" }));
  const document = render(draft, "cards");
  const products = document.querySelector('[data-sc-block="products"]');
  assert.ok(products);
  assert.doesNotMatch(visibleText(products), /待补充|To be provided/);
});
