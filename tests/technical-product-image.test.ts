import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shortPath = readFileSync(new URL("../lib/template-adapters/overlays/tailwind-landing.index.html", import.meta.url), "utf8");
const checkSource = readFileSync(new URL("../scripts/check-published.mjs", import.meta.url), "utf8");

test("short-path product photos are cropped inside the card", () => {
  const rule = shortPath.match(/\.sitecraft-product-image\{[^}]*\}/);
  assert.ok(rule, "tailwind-landing overlay has no .sitecraft-product-image rule");
  assert.match(rule[0], /max-width:100%/);
  assert.match(rule[0], /object-fit:cover/);
  assert.match(checkSource, /visitor page scrolls horizontally/);
  assert.match(checkSource, /\.sitecraft-product-card, \.sitecraft-catalog-card/);
  assert.match(checkSource, /overflowX === "hidden"/);
  assert.match(checkSource, /card content overflows its card/);
  assert.match(checkSource, /inquiry screenshot is blank/);
  assert.doesNotMatch(checkSource, /width !== 768/);
});
