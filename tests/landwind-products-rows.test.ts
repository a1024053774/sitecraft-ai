import assert from "node:assert/strict";
import test from "node:test";
import { blockCatalog } from "../lib/blocks/catalog.ts";
import { productsFragment } from "../lib/blocks/fragments/products.ts";

test("the block catalog declares a directory-row product layout with a real host", () => {
  const variant = blockCatalog.products.variants.rows;
  assert.ok(variant, "rows must be available before the catalog look chooses it");
  assert.equal(variant.render?.products, "rows");
  assert.ok(productsFragment.variants.rows.includes('data-sc-variant="rows"'));
  assert.ok(productsFragment.variants.rows.includes("sitecraft-product-rows"));
});
