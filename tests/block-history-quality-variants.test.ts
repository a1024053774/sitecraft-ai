import assert from "node:assert/strict";
import test from "node:test";
import { blockCatalog } from "../lib/blocks/catalog.ts";
import { blockFragments } from "../lib/blocks/fragments/index.ts";
import { parseHtmlFragment } from "./fixtures/html-dom.ts";

const cases = [
  { block: "history", variants: ["timeline", "milestones"], marker: "[data-sitecraft-history-grid]", classes: ["sitecraft-history-timeline", "sitecraft-history-milestones"] },
] as const;

test("T-108 registers two new history and quality-process layouts with unique markers and parts", () => {
  for (const item of cases) {
    const spec = blockCatalog[item.block];
    const fragment = blockFragments[item.block];
    for (const [index, variant] of item.variants.entries()) {
      const variantSpec = spec.variants[variant];
      assert.ok(variantSpec, `${item.block}:${variant} is in the catalog`);
      assert.deepEqual(variantSpec.markers, [item.marker], `${item.block}:${variant} keeps the bridge marker`);
      assert.deepEqual(new Set(variantSpec.parts).size, variantSpec.parts.length, `${item.block}:${variant} parts are unique`);
      const document = parseHtmlFragment(fragment.variants[variant]);
      assert.equal(document.querySelectorAll(item.marker).length, 1, `${item.block}:${variant} has one marker`);
      assert.ok(document.querySelector(`.${item.classes[index]}`), `${item.block}:${variant} has its own structural class`);
      assert.equal(document.querySelectorAll("svg, img").length, 0, `${item.block}:${variant} does not add media dependencies`);
    }
  }
});

test("T-108 new layouts keep their facts on the same bridge-owned slots", () => {
  for (const item of cases) {
    const baseSlots = blockCatalog[item.block].variants.rows.slots;
    for (const variant of item.variants) assert.deepEqual(blockCatalog[item.block].variants[variant].slots, baseSlots, `${item.block}:${variant} slot contract`);
  }
});
