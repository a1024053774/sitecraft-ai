import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const overlays = ["forge.index.html", "screwfast.index.html", "landwind.index.html", "tailwind-landing.index.html"];
const checkSource = readFileSync(new URL("../scripts/check-published.mjs", import.meta.url), "utf8");

test("hero titles balance and mobile brand names are not ellipsized", () => {
  for (const file of overlays) {
    const html = readFileSync(new URL(`../lib/template-adapters/overlays/${file}`, import.meta.url), "utf8");
    assert.match(html, /\.sitecraft-hero h1[^{]*\{[^}]*text-wrap:\s*balance/, `${file} hero title does not balance lines`);
    assert.doesNotMatch(html, /\.sitecraft-brand-name[^{]*\{[^}]*ellipsis/, `${file} still ellipsizes the brand name`);
    assert.doesNotMatch(html, /\.sitecraft-brand-name[^{]*\{[^}]*nowrap/, `${file} still keeps the brand name on one line`);
  }
  assert.match(checkSource, /hero title last line is a single character/);
  assert.match(checkSource, /header company name is truncated/);
  assert.match(checkSource, /header overflows the viewport/);
  assert.match(checkSource, /header control text wraps inside its button/);
});
