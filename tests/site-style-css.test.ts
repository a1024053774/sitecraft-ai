import assert from "node:assert/strict";
import test from "node:test";
import { siteStyleCss, type SiteStyleRule } from "../lib/blocks/site-style.ts";

const rules: SiteStyleRule[] = [
  { block: "hero", part: "title", media: "desktop", declarations: { "font-size": "64px", color: "var(--site-ink)" } },
  { block: "products", part: "grid", media: "tablet", declarations: { gap: "24px" } },
  { block: "contact", media: "phone", declarations: { "padding-block": "16px" } },
];

test("serialized rules are prefixed, deterministic, and wrapped in the site-style layer", () => {
  const css = siteStyleCss(rules);
  assert.match(css, /^@layer site-style \{/);
  assert.match(css, /@media \(min-width: 901px\)/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 480px\)/);
  assert.match(css, /\[data-sc-block="hero"\] \[data-sc-part="title"\]/);
  assert.match(css, /\[data-sc-block="products"\] \[data-sc-part="grid"\]/);
  assert.match(css, /\[data-sc-block="contact"\]/);
  assert.equal(css, siteStyleCss(rules), "serialization is stable");
});

test("unsafe raw values never reach the serialized stylesheet", () => {
  const css = siteStyleCss([{
    block: "hero",
    part: "title",
    declarations: { color: 'red; background: url("https://evil.test")' },
  } as never]);
  assert.equal(css.includes("evil.test"), false);
  assert.equal(css.includes("background"), false);
});

test("later rules remain later so appended rules override direction rules", () => {
  const css = siteStyleCss([
    { block: "hero", part: "title", declarations: { "font-size": "34px" } },
    { block: "hero", part: "title", declarations: { "font-size": "64px" } },
  ]);
  assert.ok(css.indexOf("font-size: 34px") < css.indexOf("font-size: 64px"));
});
