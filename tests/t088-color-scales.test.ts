import assert from "node:assert/strict";
import test from "node:test";
import { buildColorScale } from "../lib/color-scale.ts";
import { generateCustomPalette } from "../lib/custom-brand-color.ts";
import { templateAdapters } from "../lib/template-adapters/registry.ts";
import { blockLookForTemplate } from "../lib/blocks/looks/index.ts";
import { paletteBaseline } from "./fixtures/t088-palette-baseline.ts";

const seeds = ["#176ba4", "#9d671a", "#192a3a", "#fff4a3", "#39ff88", "#011b3d"];

function wcagChannel(value: number) {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function wcagLuminance(hex: string) {
  return [1, 3, 5].map((offset) => wcagChannel(Number.parseInt(hex.slice(offset, offset + 2), 16)))
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function wcagContrast(left: string, right: string) {
  const a = wcagLuminance(left);
  const b = wcagLuminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function independentOklch(hex: string) {
  const linear = (offset: number) => wcagChannel(Number.parseInt(hex.slice(offset, offset + 2), 16));
  const red = linear(1);
  const green = linear(3);
  const blue = linear(5);
  const l = 0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue;
  const m = 0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue;
  const s = 0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue;
  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);
  const L = 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot;
  const a = 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot;
  const b = 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot;
  return { L, C: Math.hypot(a, b), h: (Math.atan2(b, a) * 180 / Math.PI + 360) % 360 };
}

test("known HEX colors map to independent OKLCH reference values", () => {
  const references = {
    "#111827": [0.2101, 0.0318, 264.6645],
    "#121c28": [0.2230, 0.0277, 253.4623],
    "#f4fbff": [0.9840, 0.0092, 232.3608],
    "#39ff88": [0.8809, 0.2209, 151.2123],
  } as const;
  for (const [seed, expected] of Object.entries(references)) {
    const actual = independentOklch(seed);
    assert.ok(Math.abs(actual.L - expected[0]) < 0.0002, `${seed} L`);
    assert.ok(Math.abs(actual.C - expected[1]) < 0.0002, `${seed} C`);
    assert.ok(Math.abs(actual.h - expected[2]) < 0.02, `${seed} h`);
  }
});

test("OKLCH scales produce role tokens with independent WCAG checks for six difficult seeds", () => {
  for (const seed of seeds) {
    const result = buildColorScale(seed);
    assert.equal(result.ok, true, `${seed}: ${result.ok ? "" : result.reason}`);
    if (!result.ok) continue;
    assert.equal(result.palette.sourceColor, seed);
    assert.equal(result.neutral.length, 11);
    assert.equal(result.primary.length, 11);
    assert.equal(result.palette.border, result.neutral[3], `${seed} border role`);
    assert.equal(result.palette.diagram, result.neutral[2], `${seed} diagram role`);
    assert.equal(result.palette.tint, result.neutral[1], `${seed} tint role`);
    assert.ok(wcagContrast(result.palette.text, result.palette.background) >= 4.5, `${seed} body text`);
    assert.ok(wcagContrast(result.palette.muted, result.palette.background) >= 4.5, `${seed} muted text`);
    assert.ok(wcagContrast(result.palette.accentText, result.palette.accent) >= 4.5, `${seed} button text`);
    assert.ok(wcagContrast(result.palette.accentText, result.palette.accentStrong) >= 4.5, `${seed} strong button text`);
  }
});

test("invalid or impossible color input returns a reason instead of silently changing the seed", () => {
  const invalid = buildColorScale("not-a-hex");
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.match(invalid.reason, /HEX|颜色/);
  assert.throws(() => generateCustomPalette("not-a-hex"), /HEX|颜色/);
});

test("custom palette adjustment notes use user language instead of implementation terms", () => {
  const light = generateCustomPalette("#f4fbff", "color").palette;
  const dark = generateCustomPalette("#111827", "color").palette;
  const bright = generateCustomPalette("#39ff88", "color").palette;
  assert.match(light.adjustmentNote, /调深/);
  assert.match(bright.adjustmentNote, /调深/);
  assert.equal(dark.accent, "#111827");
  assert.equal(dark.adjusted, false);
  assert.match(dark.adjustmentNote, /保持清晰可读/);
  for (const note of [light.adjustmentNote, dark.adjustmentNote, bright.adjustmentNote]) {
    assert.doesNotMatch(note, /OKLCH|sRGB|WCAG/);
  }
});

test("the 24 admitted palette token values remain byte-for-byte unchanged", () => {
  const actual: Record<string, unknown> = {};
  for (const templateId of ["forge", "screwfast", "landwind", "tailwind-landing"]) {
    actual[templateId] = templateAdapters[templateId]?.kit?.palettes ?? {};
  }
  assert.deepEqual(actual, paletteBaseline);
});

test("custom palette button text meets contrast for the actual four look recipes", () => {
  const families = ["forge", "screwfast", "landwind", "tailwind-landing"];
  for (const seed of ["#111827", "#f4fbff", "#39ff88", ...seeds]) {
    const palette = generateCustomPalette(seed).palette as unknown as Record<string, string>;
    for (const templateId of families) {
      const look = blockLookForTemplate(templateId);
      assert.ok(look, templateId);
      const resolve = (value: string) => {
        if (value === "var(--site-accent)") return palette.accent;
        if (value === "var(--site-accent-strong)") return palette.accentStrong;
        if (value === "var(--site-ink)") return palette.text;
        if (value === "var(--site-accent-text)") return palette.accentText;
        if (value === "var(--site-plate-copy)") return templateId === "screwfast" ? palette.accentText : palette.text;
        if (value === "var(--site-tint)") return palette.tint;
        if (value === "var(--site-surface)") return palette.surface;
        if (value === "var(--site-bg)") return palette.background;
        if (value === "var(--site-accent-soft)") return palette.accentSoft;
        if (value === "#fff") return "#ffffff";
        return value;
      };
      const buttonText = resolve(String(look?.tokens["--site-plate-ink"]));
      const buttonBackground = resolve(String(look?.tokens["--site-primary-bg"]));
      const specText = resolve(String(look?.tokens["--site-plate-copy"]));
      const specBackground = resolve(String(look?.tokens["--site-plate-bg"]));
      assert.ok(buttonText && buttonBackground, `${seed}/${templateId} button tokens present`);
      assert.ok(specText && specBackground, `${seed}/${templateId} spec tokens present`);
      assert.ok(wcagContrast(buttonText, buttonBackground) >= 4.5, `${seed}/${templateId} button contrast`);
      assert.ok(wcagContrast(specText, specBackground) >= 4.5, `${seed}/${templateId} spec contrast`);
      assert.ok(wcagContrast(palette.text, palette.surface) >= 4.5, `${seed}/${templateId} secondary contrast`);
      assert.ok(wcagContrast(palette.accentStrong, palette.background) >= 4.5, `${seed}/${templateId} link contrast`);
      assert.ok(wcagContrast(palette.accentStrong, palette.accentSoft) >= 4.5, `${seed}/${templateId} label contrast`);
    }
  }
});
