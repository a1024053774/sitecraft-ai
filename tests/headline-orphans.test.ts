import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { servedHomeHtml } from "./fixtures/look-pages.ts";

const looks = ["forge", "screwfast", "landwind", "tailwind-landing"];
const checkSource = readFileSync(new URL("../scripts/check-published.mjs", import.meta.url), "utf8");

test("hero titles balance and mobile brand names are not ellipsized", () => {
  for (const templateId of looks) {
    const html = servedHomeHtml(templateId);
    assert.match(html, /\.sitecraft-hero h1[^{]*\{[^}]*text-wrap:\s*(?:balance|wrap|var\(--site-heading-text-wrap\))/, `${templateId} hero title does not wrap lines`);
    assert.doesNotMatch(html, /\.sitecraft-brand-name[^{]*\{[^}]*ellipsis/, `${templateId} still ellipsizes the brand name`);
    assert.doesNotMatch(html, /\.sitecraft-brand-name[^{]*\{[^}]*nowrap/, `${templateId} still keeps the brand name on one line`);
  }
  assert.match(checkSource, /hero title last line is a single character/);
  assert.match(checkSource, /header company name is truncated/);
  assert.match(checkSource, /scrollHeight > brand\.clientHeight \+ 1/);
  assert.match(checkSource, /parentStyle\.overflowX === "hidden" \|\| parentStyle\.overflowX === "clip"/);
  assert.match(checkSource, /header overflows the viewport/);
  assert.match(checkSource, /header control text wraps inside its button/);
});
