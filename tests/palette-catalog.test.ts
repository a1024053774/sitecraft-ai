import assert from "node:assert/strict";
import test from "node:test";
import {
  paletteCatalogByVisualBrief,
  paletteSourceById,
  type PaletteId,
} from "../lib/site-document.ts";
import { templateAdapters } from "../lib/template-adapters/registry.ts";

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

test("admitted palette cards expose named multi-role tokens from their host kit", () => {
  for (const family of admittedFamilies) {
    const cards = paletteCatalogByVisualBrief[family.briefId];
    const kit = templateAdapters[family.templateId]?.kit;
    assert.ok(cards.length >= 4, `${family.briefId} should expose at least four reviewed palette candidates`);
    assert.ok(kit?.palettes, `${family.templateId} must declare palette tokens`);
    for (const card of cards) {
      assert.ok(card.label.length > 0);
      assert.ok(card.summary.length > 0);
      const tokens = kit?.palettes?.[card.id as PaletteId];
      assert.ok(tokens, `${family.templateId}/${card.id} must resolve to host tokens`);
      assert.ok(paletteSourceById[card.id as Exclude<PaletteId, "default">]?.sourceUrl, `${card.id} must keep a research source`);
      for (const role of roles) assert.ok(tokens?.[role], `${family.templateId}/${card.id} missing ${role}`);
      assert.ok(contrast(tokens?.accentStrong ?? tokens!.accent, "#ffffff") >= 4.5, `${card.id} CTA token must be readable with white text`);
    }
  }
});

test("palette pairs keep font and radius stable while changing the named color roles", () => {
  for (const family of admittedFamilies) {
    const kit = templateAdapters[family.templateId]?.kit;
    const cards = paletteCatalogByVisualBrief[family.briefId];
    const first = kit?.palettes?.[cards[0].id as PaletteId];
    const second = kit?.palettes?.[cards[1].id as PaletteId];
    assert.ok(first && second);
    assert.equal(first.font, second.font);
    assert.equal(first.radius, second.radius);
    assert.notDeepEqual(
      [first.background, first.surface, first.text, first.muted, first.border, first.accent, first.accentStrong],
      [second.background, second.surface, second.text, second.muted, second.border, second.accent, second.accentStrong],
    );
  }
});
