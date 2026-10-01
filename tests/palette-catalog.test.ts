import assert from "node:assert/strict";
import test from "node:test";
import {
  colorSetCatalog,
  defaultDraft,
  normalizeDraft,
  paletteCatalogForVisualBrief,
  type PaletteId,
} from "../lib/site-document.ts";
import { templateAdapters } from "../lib/template-adapters/registry.ts";
import { servedHomeHtml } from "./fixtures/look-pages.ts";

const roles = ["background", "surface", "text", "muted", "border", "accent", "accentStrong", "accentSoft", "diagram", "tint", "font", "radius"] as const;
const admittedFamilies = [
  { briefId: "industrial", templateId: "forge" },
  { briefId: "engineering-industrial", templateId: "screwfast" },
  { briefId: "export-catalog", templateId: "landwind" },
  { briefId: "technical-product", templateId: "tailwind-landing" },
] as const;

function luminance(hex: string) {
  const rgb = hex.slice(1).match(/.{2}/g)?.map((part) => Number.parseInt(part, 16) / 255) ?? [];
  return rgb.reduce((sum, value, index) => sum + (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][index], 0);
}
function contrast(left: string, right: string) {
  const a = luminance(left);
  const b = luminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// The token behind the white-text primary button, read from the served page's own CSS rather than assumed.
function buttonToken(templateId: string): "accent" | "accentStrong" {
  const html = servedHomeHtml(templateId);
  const match = /\.sitecraft-primary\s*\{[^}]*background:\s*var\(--site-(accent-strong|accent|primary-bg)\)/.exec(html);
  assert.ok(match, `${templateId} primary button background not found`);
  return match[1] === "accent" ? "accent" : "accentStrong";
}

test("every look offers one palette per colour set, in the colour-set names users pick from", () => {
  assert.deepEqual(colorSetCatalog.map((set) => set.label), ["青花瓷", "石墨工坊", "工程暖橙", "铜锈", "松石", "莫兰迪"]);
  for (const family of admittedFamilies) {
    const cards = paletteCatalogForVisualBrief(family.briefId);
    assert.deepEqual(cards.map((card) => card.colorSet), colorSetCatalog.map((set) => set.id), family.briefId);
    assert.deepEqual(cards.map((card) => card.label), colorSetCatalog.map((set) => set.label), family.briefId);
    const kit = templateAdapters[family.templateId]?.kit;
    for (const card of cards) {
      const tokens = kit?.palettes?.[card.id];
      assert.ok(tokens, `${family.templateId}/${card.id} must resolve to host tokens`);
      for (const role of roles) assert.ok(tokens?.[role], `${family.templateId}/${card.id} missing ${role}`);
    }
  }
});

test("all 24 palettes meet WCAG AA for body text, secondary text and white button text", () => {
  const failures: string[] = [];
  for (const family of admittedFamilies) {
    const kit = templateAdapters[family.templateId]?.kit;
    const button = buttonToken(family.templateId);
    for (const card of paletteCatalogForVisualBrief(family.briefId)) {
      const t = kit!.palettes![card.id]!;
      const checks: Array<[string, number]> = [
        ["text/background", contrast(t.text!, t.background!)],
        ["text/surface", contrast(t.text!, t.surface!)],
        ["muted/background", contrast(t.muted!, t.background!)],
        ["muted/surface", contrast(t.muted!, t.surface!)],
        [`white/${button}`, contrast("#ffffff", t[button]!)],
      ];
      for (const [name, ratio] of checks) if (ratio < 4.5) failures.push(`${card.id} ${name} ${ratio.toFixed(2)}`);
    }
  }
  assert.deepEqual(failures, []);
});

test("palettes in one look keep font and radius and differ in colour", () => {
  for (const family of admittedFamilies) {
    const kit = templateAdapters[family.templateId]?.kit;
    const palettes = paletteCatalogForVisualBrief(family.briefId).map((card) => kit!.palettes![card.id]!);
    assert.equal(new Set(palettes.map((p) => p.font)).size, 1);
    assert.equal(new Set(palettes.map((p) => p.radius)).size, 1);
    assert.equal(new Set(palettes.map((p) => `${p.background}${p.accent}${p.text}`)).size, palettes.length);
  }
});

test("drafts saved with a retired palette id open on the nearest colour set", () => {
  const retired: Array<[string, PaletteId]> = [
    ["engineering-orange", "engineering-warm-orange"],
    ["engineering-slate", "engineering-porcelain"],
    ["industrial-white", "industrial-porcelain"],
    ["export-ink", "export-turquoise"],
    ["technical-olive", "technical-patina"],
  ];
  for (const [old, next] of retired) {
    const stored = { ...structuredClone(defaultDraft), paletteId: old, revision: 7 };
    const draft = normalizeDraft(stored);
    assert.equal(draft.paletteId, next, old);
    assert.equal(draft.revision, 7, "renaming the palette must not drop the stored draft");
  }
});
