import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { composedPageForTemplate } from "../lib/blocks/compose.ts";

const html = composedPageForTemplate("tailwind-landing");
if (!html) throw new Error("tailwind-landing must be composed from the block library");
const checkSource = readFileSync(new URL("../scripts/check-published.mjs", import.meta.url), "utf8");

test("short-path product photos are cropped inside the composed card", () => {
  assert.match(html, /sitecraft-product-image/);
  assert.match(html, /sitecraft-product-media/);
  assert.match(checkSource, /visitor page scrolls horizontally/);
  assert.match(checkSource, /sitecraft-product-card, \.sitecraft-catalog-card/);
  assert.match(checkSource, /card content overflows its card/);
});
