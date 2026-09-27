import assert from "node:assert/strict";
import test from "node:test";
import { generateCustomPalette, contrastRatio } from "../lib/custom-brand-color.ts";
import { applySiteOperations } from "../lib/site-operations.ts";
import { defaultDraft } from "../lib/site-document.ts";

const options = { templateIds: new Set(["forge"]), lastChange: "custom-brand-color" };

test("custom brand palettes keep text and white CTA contrast for light, dark, and saturated colors", () => {
  for (const color of ["#f4fbff", "#111827", "#ff00aa"]) {
    const result = generateCustomPalette(color, "color");
    assert.equal(result.palette.sourceColor, color.toLowerCase());
    assert.ok(contrastRatio(result.palette.text, result.palette.background) >= 4.5, color);
    assert.ok(contrastRatio("#ffffff", result.palette.accent) >= 4.5, color);
    assert.ok(contrastRatio("#ffffff", result.palette.accentStrong) >= 4.5, color);
  }
});

test("custom palette operation is reversible and records the adjustment note", () => {
  const generated = generateCustomPalette("#f4fbff", "logo");
  const applied = applySiteOperations(defaultDraft, [{ op: "set_custom_palette", palette: generated.palette }], options);
  assert.equal(applied.draft.customPalette?.source, "logo");
  assert.equal(applied.draft.customPalette?.adjusted, true);
  assert.ok(applied.appliedTargets.includes("palette"));
  const undone = applySiteOperations(applied.draft, applied.inverseOperations, options);
  assert.equal(undone.draft.customPalette, null);
});
