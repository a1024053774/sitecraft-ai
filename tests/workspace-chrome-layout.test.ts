import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const frame = readFileSync(new URL("../components/open-source-template-frame.tsx", import.meta.url), "utf8");

function rule(selector: string) {
  const start = css.indexOf(selector);
  assert.ok(start >= 0, `missing ${selector}`);
  return css.slice(start, css.indexOf("}", start) + 1);
}

test("the change marker sits above the preview frame instead of covering the site header", () => {
  const marker = rule(".preview-change-markers");
  assert.doesNotMatch(marker, /position:\s*absolute/);
  assert.doesNotMatch(marker, /top:\s*74px/);
  assert.match(css, /\.alignment-card \.palette-swatch-row \{ display: flex; margin: 0 0 6px; \}/);
});

test("the selected-template bar paints above the thumbnail grid", () => {
  const bar = rule(".template-selected");
  assert.match(bar, /z-index:\s*(\d+)/);
  const z = Number(bar.match(/z-index:\s*(\d+)/)?.[1]);
  assert.ok(z >= 20);
});

test("the preview frame pauses its load timer while the mobile preview is hidden", () => {
  assert.match(frame, /mobile-hidden/);
  assert.match(frame, /\.hold\(\)/);
  assert.match(frame, /\.release\(\)/);
});
