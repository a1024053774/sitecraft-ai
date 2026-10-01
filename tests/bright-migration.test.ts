import assert from "node:assert/strict";
import test from "node:test";
import { blockCatalog } from "../lib/blocks/catalog.ts";
import { composedPageForTemplate } from "../lib/blocks/compose.ts";
import { blockLookForTemplate } from "../lib/blocks/looks/index.ts";

test("the bright-product migration declares its five block-library variants", () => {
  assert.ok(blockCatalog.industries.variants.cards);
  assert.ok(blockCatalog.capabilities.variants.cards);
  assert.ok(blockCatalog.services.variants.cards);
  assert.ok(blockCatalog.faq.variants.open);
  assert.ok(blockCatalog.contact.variants.panel);
});

test("forge is served by a composed block-library look", () => {
  assert.ok(blockLookForTemplate("forge"));
  const page = composedPageForTemplate("forge");
  assert.ok(page?.includes('data-sc-block="hero"'));
  assert.equal(page?.includes("data-sitecraft-demo"), false);
});
