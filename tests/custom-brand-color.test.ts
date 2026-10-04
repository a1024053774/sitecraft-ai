import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { generateCustomPalette } from "../lib/custom-brand-color.ts";
import { applySiteOperations } from "../lib/site-operations.ts";
import { defaultDraft } from "../lib/site-document.ts";

const options = { templateIds: new Set(["forge"]), lastChange: "custom-brand-color" };

function wcagContrast(left: string, right: string) {
  const luminance = (hex: string) => [1, 3, 5]
    .map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const a = luminance(left);
  const b = luminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const abs = path.join(process.cwd(), specifier.slice(2));
    const file = existsSync(`${abs}.ts`) ? `${abs}.ts` : abs;
    return nextResolve(pathToFileURL(file).href, context);
  },
});

test("custom brand palettes keep text and white CTA contrast for light, dark, and saturated colors", () => {
  for (const color of ["#f4fbff", "#111827", "#ff00aa"]) {
    const result = generateCustomPalette(color, "color");
    assert.equal(result.palette.sourceColor, color.toLowerCase());
    assert.ok(wcagContrast(result.palette.text, result.palette.background) >= 4.5, color);
    assert.ok(wcagContrast(result.palette.accentText, result.palette.accent) >= 4.5, color);
    assert.ok(wcagContrast(result.palette.accentText, result.palette.accentStrong) >= 4.5, color);
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

test("commitOperations rejects an invalid custom palette without changing the draft", async () => {
  const { commitOperations, deleteSiteRecord, createSite } = await import("../lib/site-store.ts");
  const siteId = `t088-invalid-palette-${crypto.randomUUID()}`;
  const before = await createSite(siteId);
  const invalid = { ...generateCustomPalette("#111827", "color").palette, background: "#ffffff", surface: "#ffffff", accent: "#ffffff", accentStrong: "#ffffff", accentText: "#ffffff" };
  const result = await commitOperations({
    siteId,
    baseRevision: before.draft.revision,
    operations: [{ op: "set_custom_palette", palette: invalid }],
    summary: "应用自定义品牌色板",
    source: "manual",
  });
  assert.equal(result.status, "rejected");
  const after = await createSite(siteId);
  assert.equal(after.draft.customPalette, null);
  deleteSiteRecord(siteId);
});
