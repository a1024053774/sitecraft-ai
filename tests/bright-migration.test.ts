import assert from "node:assert/strict";
import test from "node:test";
import { blockCatalog } from "../lib/blocks/catalog.ts";
import { composedPageForTemplate } from "../lib/blocks/compose.ts";
import { blockLookForTemplate } from "../lib/blocks/looks/index.ts";
import { cssRules } from "./fixtures/css-rules.ts";
import { styleText } from "./fixtures/css-rules.ts";

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

test("bright catalog cards keep the body wide under the title", () => {
  const page = composedPageForTemplate("forge");
  assert.ok(page);
  const rules = cssRules(styleText(page));
  const card = rules.find((rule) => rule.selector === ".sitecraft-catalog-cards .sitecraft-catalog-card");
  assert.ok(card, "bright catalog cards have a look-specific rule");
  assert.ok(card.declarations.includes("display: block"), card.declarations.join("; "));
});

test("bright product cards switch to one-column rows on 768px and below, and grouped labels stack above full-width cards", () => {
  const page = composedPageForTemplate("forge");
  assert.ok(page);
  assert.match(page, /sitecraft-look-industrial/);
  assert.match(page, /sitecraft-look-industrial[^}]*sitecraft-product-grid[^}]*grid-template-columns:\s*1fr/);
  assert.match(page, /sitecraft-look-industrial[^}]*sitecraft-product-keys[^}]*grid-template-columns:\s*1fr/);
  assert.match(page, /--site-group-columns:\s*1fr/);
});
