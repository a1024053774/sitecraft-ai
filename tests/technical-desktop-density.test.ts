import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../lib/template-adapters/overlays/tailwind-landing.index.html", import.meta.url), "utf8");

test("technical desktop keeps spec type readable and does not leave an empty hero column", () => {
  assert.match(html, /data-sitecraft-section="hero"/);
  assert.match(html, /data-sitecraft-hero-visual/);
  assert.match(html, /data-sitecraft-hero-nameplate/);
  assert.match(html, /\.sitecraft-hero\[data-sitecraft-hero-mode="none"\] \.sitecraft-hero-grid\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
  const key = html.match(/\.sitecraft-product-keys \.sitecraft-product-key\{[^}]*\}/);
  assert.ok(key, "product keys have no rule");
  assert.match(key[0], /grid-template-columns:minmax\(0,1\.1fr\) minmax\(0,\.9fr\)/);
  assert.match(html, /\.sitecraft-product-keys dt\{[^}]*font-size:14px/);
  assert.match(html, /\.sitecraft-product-keys dd\{[^}]*font-size:14px/);
  assert.match(html, /\.sitecraft-product-specs\{[^}]*font-size:14px/);
  assert.match(html, /\.sitecraft-product-more summary\{[^}]*font-weight:700/);
  assert.match(html, /\.sitecraft-product-ask\{[^}]*font-weight:700/);
  assert.match(html, /\.sitecraft-section\{padding:64px 0/);
  assert.match(html, /\.sitecraft-process,\.sitecraft-catalog-grid\{grid-template-columns:1fr\}/);
  assert.match(html, /\.sitecraft-catalog-card:not\(:has\(p\)\)\{[^}]*padding:10px 14px/);
});
