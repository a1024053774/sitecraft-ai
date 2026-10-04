import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
  for (const templateId of LOOK_TEMPLATES) {
    const adapter = getTemplateAdapter(templateId);
    const source = composeLookDocument(blockLookForTemplate(templateId)!, adapter!.kit!.tokens);
    assert.match(source, /--site-data-font/);
    assert.match(source, /font-family: var\(--site-data-font/);
    assert.match(adapter!.kit!.tokens.dataFont ?? "", /Mono|mono/);
  }
});

test("committed Latin subsets keep required symbols and exclude CJK for every production kit", () => {
  const python = "/opt/miniconda3/bin/python";
  const output = execFileSync(python, ["scripts/check-site-fonts.py"], { encoding: "utf8" });
  const report = JSON.parse(output) as { ok: boolean; kits: Record<string, { files: Array<{ has_cjk: boolean; missing_symbols: string[] }> }> };
  assert.equal(report.ok, true, output);
  for (const templateId of LOOK_TEMPLATES) {
    assert.ok(report.kits[templateId], `${templateId} should have a cmap audit`);
    for (const file of report.kits[templateId].files) {
      assert.equal(file.has_cjk, false, `${templateId} subset must not contain CJK`);
      assert.deepEqual(file.missing_symbols, [], `${templateId} subset is missing required symbols`);
    }
  }
});

test("the workspace keeps its original font import while published hosts omit workspace CSS", () => {
  const globalCss = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const rootLayout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const gate = readFileSync(new URL("../components/workspace-style-gate.tsx", import.meta.url), "utf8");
  const workspaceCss = readFileSync(new URL("../public/workspace.css", import.meta.url), "utf8");
  assert.match(globalCss, /fonts\.googleapis\.com/);
  assert.match(globalCss, /Manrope:wght@400;500;600;700;800/);
  assert.match(globalCss, /Noto\+Sans\+SC/);
  assert.doesNotMatch(rootLayout, /globals\.css/);
  assert.match(gate, /published/);
  assert.match(gate, /templates/);
  assert.match(gate, /workspace\.css/);
  assert.equal(workspaceCss, globalCss);
});

test("font-aware title fitting keeps Chinese runs balanced and does not split English words", () => {
  const hero = readFileSync(new URL("../lib/blocks/fragments/hero.ts", import.meta.url), "utf8");
  const catalog = readFileSync(new URL("../lib/blocks/looks/catalog.ts", import.meta.url), "utf8");
  const bright = readFileSync(new URL("../lib/blocks/looks/bright.ts", import.meta.url), "utf8");
  const engineering = readFileSync(new URL("../lib/blocks/looks/engineering.ts", import.meta.url), "utf8");
  assert.match(hero, /--site-h1-fit-size/);
  assert.match(hero, /text-wrap: balance/);
  assert.match(catalog, /fitText: "container"/);
  assert.match(bright, /"--site-heading-break": "normal"/);
  assert.match(engineering, /"--site-h1-narrow": "clamp\(30px, 8vw, 34px\)"/);
});
