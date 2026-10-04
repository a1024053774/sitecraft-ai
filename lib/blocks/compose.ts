import { layoutBlocks, type BlockId, type BlockLayoutItem, type BlockLook } from "./catalog.ts";
import { baseFragment, blockFragments, BREAKPOINTS } from "./fragments/index.ts";
import { blockLookForTemplate } from "./looks/index.ts";
import { getTemplateAdapter } from "../template-adapters/registry.ts";
import type { TemplateKitTokens } from "../template-adapters/types.ts";
import { fontFaceCssForFamilies, fontFaceCssForTemplate } from "../site-fonts.ts";

// Server-side: builds the page skeleton of a look from the block library. Every block shows its
// default variant, and every variant (default included) is kept once as a <template>, so the
// preview bridge can mount the one the draft picks without reloading the frame. Nodes inside a
// <template> are not part of the document, so each declared selector still hits one node.

/** Same variable names the bridge writes from the palette (applyFamilyKit). */
function paletteDeclarations(tokens: TemplateKitTokens): Array<[string, string]> {
  const pairs: Array<[string, string | undefined]> = [
    ["--site-bg", tokens.background],
    ["--site-surface", tokens.surface],
    ["--site-ink", tokens.text],
    ["--site-muted", tokens.muted],
    ["--site-line", tokens.border],
    ["--site-accent", tokens.accent],
    ["--site-accent-strong", tokens.accentStrong],
    ["--site-accent-text", tokens.accentText || "#ffffff"],
    ["--site-accent-soft", tokens.accentSoft],
    ["--site-diagram", tokens.diagram],
    ["--site-tint", tokens.tint],
    ["--site-radius", tokens.radius],
    ["--site-font", tokens.font],
    ["--site-heading-font", tokens.headingFont],
    ["--site-data-font", tokens.dataFont],
  ];
  return pairs.filter((pair): pair is [string, string] => Boolean(pair[1]));
}

function blockMarkup(look: BlockLook, block: BlockId) {
  const fragment = blockFragments[block];
  const variant = look.defaults[block];
  const entity = fragment.variants[variant];
  if (!entity) throw new Error(`Look ${look.id}: block ${block} has no variant ${variant}`);
  const templates = Object.entries(fragment.variants).map(([id, html]) => `<template data-sc-template="${block}:${id}">${html}</template>`);
  return [entity, ...templates].join("\n");
}

function layoutMarkup(look: BlockLook, item: BlockLayoutItem) {
  if (typeof item === "string") return blockMarkup(look, item);
  return `<div class="sitecraft-pair">\n<div class="sitecraft-container">\n${item.map((block) => blockMarkup(look, block)).join("\n")}\n</div>\n</div>`;
}

export function composeLookDocument(look: BlockLook, palette: TemplateKitTokens, fontFamilyId?: string, dataFontFamilyId?: string, headingFontFamilyId?: string): string {
  const fragments = layoutBlocks(look).map((block) => blockFragments[block]);
  const root = [...paletteDeclarations(palette), ...Object.entries(look.tokens)].map(([name, value]) => `  ${name}: ${value};`).join("\n");
  const narrow = [baseFragment.narrow, ...fragments.map((fragment) => fragment.narrow)].filter(Boolean).join("");
  const phone = [baseFragment.phone, ...fragments.map((fragment) => fragment.phone)].filter(Boolean).join("");
  const blockCss = [baseFragment.css, ...fragments.map((fragment) => fragment.css)].join("\n");
  const fontFaces = fontFaceCssForFamilies(fontFamilyId, dataFontFamilyId, headingFontFamilyId) || fontFaceCssForTemplate(look.templateId);
  const css = [
    fontFaces,
    "@layer sc-blocks, site-style;",
    `:root {\n${root}\n}`,
    `@layer sc-blocks {\n${blockCss}\n}`,
    `@layer sc-blocks { @media ${BREAKPOINTS.narrow} {${narrow}} }`,
    `@layer sc-blocks { @media ${BREAKPOINTS.phone} {${phone}} }`,
  ].join("\n");
  const body = [
    ...look.layout.top.map((block) => blockMarkup(look, block)),
    '<main id="top">',
    ...look.layout.main.map((item) => layoutMarkup(look, item)),
    "</main>",
    ...look.layout.bottom.map((block) => blockMarkup(look, block)),
  ].join("\n");
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${look.documentTitle}</title>
    <style>
${css}
    </style>
  </head>
  <body>
    <div class="sitecraft-page sitecraft-look-${look.id}">
${body}
    </div>
  </body>
</html>
`;
}

const composedPages = new Map<string, string>();

/** The composed home page for a template behind a block-library look, or null for other templates. */
export function composedPageForTemplate(templateId: string): string | null {
  const look = blockLookForTemplate(templateId);
  if (!look) return null;
  const cached = composedPages.get(templateId);
  if (cached) return cached;
  const kit = getTemplateAdapter(templateId)?.kit;
  const palette = kit?.tokens;
  if (!palette) throw new Error(`Template ${templateId} has no palette for look ${look.id}`);
  const html = composeLookDocument(look, palette, kit.fontFamilyId, kit.dataFontFamilyId, kit.headingFontFamilyId);
  composedPages.set(templateId, html);
  return html;
}
