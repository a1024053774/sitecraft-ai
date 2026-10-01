import assert from "node:assert/strict";
import test from "node:test";
import { composedPageForTemplate } from "../lib/blocks/compose.ts";

const html = composedPageForTemplate("tailwind-landing");
if (!html) throw new Error("tailwind-landing must be composed from the block library");

test("technical desktop keeps spec type readable and does not leave an empty hero column", () => {
  assert.match(html, /data-sitecraft-section="hero"/);
  assert.match(html, /data-sitecraft-hero-visual/);
  assert.match(html, /data-sitecraft-hero-nameplate/);
  assert.match(html, /sitecraft-hero-grid/);
  assert.match(html, /sitecraft-product-key/);
  assert.match(html, /sitecraft-product-specs/);
  assert.match(html, /sitecraft-process/);
  assert.match(html, /sitecraft-catalog-grid/);
});
