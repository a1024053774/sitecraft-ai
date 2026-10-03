import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { getTemplateAdapter } from "../lib/template-adapters/index.ts";
import { composeLookDocument } from "../lib/blocks/compose.ts";
import { blockLookForTemplate } from "../lib/blocks/looks/index.ts";

const LOOK_TEMPLATES = ["screwfast", "landwind", "forge", "tailwind-landing"] as const;
const CJK_FALLBACKS = ["PingFang SC", "Noto Sans SC", "Microsoft YaHei"] as const;

test("all production look kits declare the shared Chinese fallback stack", () => {
  for (const templateId of LOOK_TEMPLATES) {
    const font = getTemplateAdapter(templateId)?.kit?.tokens.font ?? "";
    for (const fallback of CJK_FALLBACKS) {
      assert.ok(font.includes(`"${fallback}"`), `${templateId} should include ${fallback} in its font token`);
    }
  }
});


test("production kits select fixed local font families and compose local font faces", () => {
  const expected = {
    screwfast: ["engineering-geist", "engineering-geist", "engineering-geist-mono", "Geist", "Geist Mono"],
    landwind: ["catalog-manrope", "catalog-manrope", "catalog-jetbrains-mono", "Manrope", "JetBrains Mono"],
    forge: ["bright-manrope", "bright-sora", "bright-jetbrains-mono", "Sora", "JetBrains Mono"],
    "tailwind-landing": ["short-path-geist", "short-path-geist", "short-path-geist-mono", "Geist", "Geist Mono"],
  } as const;

  for (const [templateId, [fontFamilyId, headingFontFamilyId, dataFontFamilyId, headingName, dataFontName]] of Object.entries(expected)) {
    const kit = getTemplateAdapter(templateId)?.kit;
    assert.ok(kit, `${templateId} should declare a kit`);
    assert.equal(kit.fontFamilyId, fontFamilyId);
    assert.equal(kit.headingFontFamilyId, headingFontFamilyId);
    assert.equal(kit.dataFontFamilyId, dataFontFamilyId);
    assert.match(kit.tokens.headingFont ?? "", new RegExp(headingName));
    assert.match(kit.tokens.dataFont ?? "", new RegExp(dataFontName));
    const look = blockLookForTemplate(templateId);
    assert.ok(look, `${templateId} should have a block look`);
    const html = composeLookDocument(look, kit.tokens);
    assert.match(html, /@font-face/);
    assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic/);
    assert.match(html, /url\(["']\/fonts\/sitecraft\//);
  }

  assert.ok(existsSync("public/fonts/sitecraft/geist/geist-400-latin.woff2"));
  assert.ok(existsSync("public/fonts/sitecraft/manrope/manrope-400-latin.woff2"));
  assert.ok(existsSync("public/fonts/sitecraft/sora/sora-700-latin.woff2"));
  assert.ok(existsSync("public/fonts/sitecraft/geist/OFL.txt"));
});

test("data roles opt into the mono token without allowing model style overrides", () => {
  const source = composeLookDocument(blockLookForTemplate("screwfast")!, getTemplateAdapter("screwfast")!.kit!.tokens);
  assert.match(source, /--site-data-font/);
  assert.match(source, /sitecraft-product-key dd[^}]*font-family: var\(--site-data-font/);
});


test("the app shell also keeps font requests first-party", () => {
  const globalCss = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.doesNotMatch(globalCss, /fonts\.googleapis|fonts\.gstatic/);
  assert.match(globalCss, /url\(["']\/fonts\/sitecraft\//);
});

