import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// check-published fails a visitor page whose text a visitor cannot read in full: text running
// out of its cell or card (a value kept on one line in a narrow column), text cut off with an
// ellipsis or a line clamp, and text hidden past an ancestor that clips overflow. The in-page
// scan lives in its own file so a probe can run exactly the same code.

const checkSource = readFileSync(new URL("../scripts/check-published.mjs", import.meta.url), "utf8");

test("check-published runs the text-fit scan and reports each way text can fail to fit", () => {
  assert.match(checkSource, /visitor-text-fit-scan\.js/, "the text-fit scan is part of the visitor checks");
  for (const message of [
    "text runs out of its cell or card",
    "text is cut off with an ellipsis or a line clamp",
    "text is clipped by its container",
    "text runs outside the viewport",
    "text is covered by another visible element",
    "catalog card body is squeezed into a narrow column",
  ]) {
    assert.ok(checkSource.includes(message), `check-published reports: ${message}`);
  }
  const scan = readFileSync(new URL("../scripts/visitor-text-fit-scan.js", import.meta.url), "utf8");
  assert.match(scan, /scrollWidth > [\w.]*clientWidth/, "a box whose own text runs past it");
  assert.match(scan, /textOverflow/, "ellipsis truncation");
  assert.match(scan, /webkitLineClamp/, "line-clamp truncation");
  assert.match(scan, /overflowX === "hidden" \|\| [\w.]*overflowX === "clip"/, "text hidden by a clipping ancestor");
  assert.match(scan, /document\.documentElement\.clientWidth/, "text outside the viewport");
  assert.match(scan, /elementsFromPoint/, "text covered by another element");
  assert.match(scan, /details:not\(\[open\]\)/, "folded spec lists are opened while measuring");
  assert.match(scan, /narrow-body/, "catalog cards with only a few glyphs per body line are reported");
  assert.match(checkSource, /brandClipped/, "actual brand clipping remains part of the visitor checks");
});
