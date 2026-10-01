import { z } from "zod";
import { blockCatalog } from "./catalog.ts";

/** Site-content blocks that may receive model-authored style rules. Page chrome stays protected. */
export const siteStyleBlocks = [
  "hero",
  "products",
  "industries",
  "capabilities",
  "services",
  "certifications",
  "faq",
  "contact",
] as const;
export type SiteStyleBlock = (typeof siteStyleBlocks)[number];

export const siteStyleMedia = ["desktop", "tablet", "phone"] as const;
export type SiteStyleMedia = (typeof siteStyleMedia)[number];
export const siteStyleDirectionIds = ["spec-led", "catalog-led", "capability-led"] as const;
export type SiteStyleDirectionId = (typeof siteStyleDirectionIds)[number];
export const siteStyleDirectionSchema = z.enum(siteStyleDirectionIds);

export const SITE_STYLE_MAX_RULES = 40;
export const SITE_STYLE_MAX_DECLARATIONS = 200;
export const SITE_STYLE_MAX_BYTES = 8 * 1024;

const mediaQueries: Record<SiteStyleMedia, string> = {
  desktop: "(min-width: 901px)",
  tablet: "(max-width: 900px)",
  phone: "(max-width: 480px)",
};

const partsByBlock: Record<SiteStyleBlock, readonly string[]> = Object.fromEntries(
  siteStyleBlocks.map((block) => [
    block,
    [...new Set(Object.values(blockCatalog[block].variants).flatMap((variant) => [...variant.parts, ...(variant.renderedParts || [])]))],
  ]),
) as unknown as Record<SiteStyleBlock, readonly string[]>;

export const siteStyleParts = partsByBlock;

const tokenNames = new Set([
  "--site-bg", "--site-surface", "--site-ink", "--site-muted", "--site-accent", "--site-accent-strong",
  "--site-accent-soft", "--site-line", "--site-diagram", "--site-tint", "--site-font", "--site-radius",
  "--site-input", "--site-focus", "--site-disabled", "--site-container", "--site-gutter", "--site-gutter-narrow",
  "--site-section-space", "--site-section-space-narrow", "--site-h1", "--site-h1-display", "--site-h2",
  "--site-rule", "--site-rule-strong",
]);

const allowedProperties = new Set([
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left", "padding-block", "padding-block-start", "padding-block-end", "padding-inline", "padding-inline-start", "padding-inline-end",
  "margin-top", "margin-bottom", "margin-block",
  "gap", "row-gap", "column-gap",
  "max-width", "min-height",
  "grid-template-columns", "grid-column", "align-items", "align-content", "align-self", "justify-items", "justify-content", "justify-self",
  "font-size", "font-weight", "line-height", "letter-spacing", "text-align", "text-wrap",
  "border", "border-top", "border-right", "border-bottom", "border-left", "border-width", "border-top-width", "border-right-width", "border-bottom-width", "border-left-width", "border-color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color", "border-radius",
  "color", "background-color",
]);

const forbiddenProperties = new Set([
  "content", "quotes", "display", "visibility", "opacity", "position", "z-index", "transform", "overflow", "overflow-x", "overflow-y", "clip", "clip-path", "mask", "filter", "backdrop-filter", "pointer-events", "cursor", "animation", "transition", "width", "height", "min-width", "max-height", "white-space", "word-break", "overflow-wrap", "text-overflow", "order", "flex-direction", "float", "font-family", "text-transform", "box-shadow", "background", "background-image",
]);

const styleRuleShape = z.object({
  block: z.enum(siteStyleBlocks),
  part: z.string().min(1).max(40).optional(),
  media: z.enum(siteStyleMedia).optional(),
  declarations: z.record(z.string(), z.string()),
}).strict();

export const siteStyleRuleSchema = styleRuleShape;
export type SiteStyleRule = z.infer<typeof siteStyleRuleSchema>;

/** The persisted shape; direction ids are tightened when the look recipes are added in step 3. */
export const siteStyleSchema = z.object({
  direction: siteStyleDirectionSchema.nullable().optional(),
  rules: z.array(siteStyleRuleSchema).max(SITE_STYLE_MAX_RULES),
}).strict();
export type SiteStyle = z.infer<typeof siteStyleSchema>;

type ValidationError = { ok: false; errors: string[] };
type ValidationSuccess = { ok: true; rules: SiteStyleRule[]; declarationCount: number; bytes: number };
export type SiteStyleValidation = ValidationError | ValidationSuccess;

const unsafeValueCharacters = /["'\\@!;{}<>]|\/\*/;
const functionPattern = /([a-z-]+)\s*\(/gi;
const allowedFunctions = new Set(["var", "calc", "clamp", "min", "max", "minmax", "repeat", "color-mix"]);
const lengthPattern = /^(?:0|(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|%|fr|ch))$/;
const numericUnitPattern = /(-?(?:\d+(?:\.\d+)?|\.\d+))(px|rem|%|fr|ch|em|vw)?/g;

function numberWithUnit(value: string) {
  const match = /^(-?(?:\d+(?:\.\d+)?|\.\d+))(px|rem|%|fr|ch|em)?$/.exec(value.trim());
  return match ? { number: Number(match[1]), unit: match[2] ?? "" } : null;
}

function validToken(value: string) {
  const matches = [...value.matchAll(/var\(([^)]+)\)/g)];
  if (!matches.length) return false;
  return matches.every((match) => tokenNames.has(match[1].trim()) && !match[1].includes(","));
}

function checkGenericSyntax(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || !/^[\x20-\x7e]+$/.test(trimmed) || unsafeValueCharacters.test(trimmed)) return "值含有不允许的字符";
  for (const match of trimmed.matchAll(functionPattern)) {
    if (!allowedFunctions.has(match[1].toLowerCase())) return `函数 ${match[1]} 不在白名单中`;
  }
  if (/var\([^)]*,/.test(trimmed)) return "var() 不允许后备值";
  for (const match of trimmed.matchAll(/var\(([^)]+)\)/g)) {
    if (!tokenNames.has(match[1].trim())) return `token ${match[1].trim()} 不在白名单中`;
  }
  if (trimmed.includes("color-mix(") && !/^color-mix\(\s*in srgb\s*,\s*var\(--site-[a-z0-9-]+\)(?:\s+\d+%)?\s*,\s*var\(--site-[a-z0-9-]+\)(?:\s+\d+%)?\s*\)$/.test(trimmed)) {
    return "color-mix 只允许 srgb 色彩 token";
  }
  return null;
}

function numericParts(value: string) {
  return [...value.matchAll(numericUnitPattern)].map((match) => ({ number: Number(match[1]), unit: match[2] ?? "" }));
}

function checkBoundedExpression(value: string, min: number, max: number, units: Set<string>, label: string, unitRanges: Map<string, [number, number]> = new Map()) {
  if (validToken(value)) return null;
  const parts = numericParts(value);
  if (!parts.length || parts.some((part) => {
    if (part.number === 0 && part.unit === "") return false;
    if (!units.has(part.unit)) return true;
    const [partMin, partMax] = unitRanges.get(part.unit) || [min, max];
    return part.number < partMin || part.number > partMax;
  })) return `${label}超出允许范围`;
  return null;
}

function checkRange(value: string, min: number, max: number, units: Set<string>, label: string) {
  return checkBoundedExpression(value, min, max, units, label);
}

function checkColor(value: string) {
  if (validToken(value)) return null;
  if (value.trim().startsWith("color-mix(")) return checkGenericSyntax(value);
  return "颜色只能使用站点 token 或两个 token 的 color-mix";
}

function checkPropertyValue(property: string, rawValue: string): string | null {
  const value = rawValue.trim();
  const syntaxError = checkGenericSyntax(value);
  if (syntaxError) return syntaxError;
  if (property === "color" || property === "background-color" || property.endsWith("-color")) return checkColor(value);
  if (property === "font-size") {
    if (validToken(value)) return null;
    if (/(?:calc|min|max|clamp)\(/.test(value)) return checkBoundedExpression(value, 12, 96, new Set(["px", "vw"]), "字号", new Map([["vw", [0, 10]]]));
    const parsed = numberWithUnit(value);
    return !parsed || parsed.unit !== "px" || parsed.number < 12 || parsed.number > 96 ? "字号必须在 12–96px 之间" : null;
  }
  if (property === "font-weight") {
    const parsed = numberWithUnit(value);
    return !parsed || parsed.unit || !Number.isInteger(parsed.number) || parsed.number < 400 || parsed.number > 800 ? "字重必须在 400–800 之间" : null;
  }
  if (property === "line-height") {
    const parsed = numberWithUnit(value);
    return !parsed || parsed.unit || parsed.number < 1 || parsed.number > 2 ? "行高必须在 1–2 之间" : null;
  }
  if (property === "letter-spacing") {
    const parsed = numberWithUnit(value);
    return !parsed || parsed.unit !== "em" || parsed.number < -0.02 || parsed.number > 0.12 ? "字距必须在 -0.02em–0.12em 之间" : null;
  }
  if (property === "text-align") return /^(?:start|center)$/.test(value) ? null : "文字对齐只允许 start 或 center";
  if (property === "text-wrap") return /^(?:balance|pretty)$/.test(value) ? null : "text-wrap 只允许 balance 或 pretty";
  if (property === "grid-column") return /^(?:1\s*\/\s*-1|span\s+[1-4])$/.test(value) ? null : "grid-column 只允许整行或 span 1–4";
  if (property === "grid-template-columns") {
    if (/^repeat\((?:[1-4]|auto-fit|auto-fill),\s*minmax\([^,]+,\s*1fr\)\)$/.test(value)) return null;
    if (/^(?:\d+(?:\.\d+)?fr|minmax\([^,]+,\s*1fr\))(?:\s+(?:\d+(?:\.\d+)?fr|minmax\([^,]+,\s*1fr\))){0,3}$/.test(value)) return null;
    return "grid-template-columns 只能使用 1–4 个受限轨道";
  }
  if (property === "max-width") {
    if (validToken(value)) return null;
    if (/(?:calc|min|max|clamp)\(/.test(value)) return "max-width 函数表达式暂不开放";
    const parsed = numberWithUnit(value);
    return !parsed || !((parsed.unit === "px" && parsed.number >= 240) || (parsed.unit === "ch" && parsed.number >= 20) || (parsed.unit === "%" && parsed.number >= 50)) ? "max-width 至少为 240px、20ch 或 50%" : null;
  }
  if (property === "min-height") return checkRange(value, 0, 720, new Set(["px"]), "min-height");
  if (property === "border-radius") return checkRange(value, 0, 12, new Set(["px"]), "圆角");
  if (property === "border" || /^(?:border-top|border-right|border-bottom|border-left)$/.test(property)) {
    const match = /^(0|(?:\d+(?:\.\d+)?px))\s+solid\s+(.+)$/.exec(value);
    if (!match || Number.parseFloat(match[1]) > 4 || checkColor(match[2])) return "边线必须是 0–4px solid 的站点颜色";
    return null;
  }
  if (property.includes("border") && property.startsWith("border-") && !property.endsWith("color") && !property.endsWith("radius")) {
    if (property.endsWith("width")) {
      return checkRange(value, 0, 4, new Set(["px"]), "边线宽度");
    }
    if (/^(?:solid|none)$/.test(value)) return value === "solid" ? null : "边线只允许 solid";
  }
  if (property.startsWith("padding") || property.startsWith("margin") || property === "gap" || property === "row-gap" || property === "column-gap") {
    return checkRange(value, 0, property.startsWith("margin") ? 160 : 160, new Set(["px", "rem", "%", "fr", "ch"]), "间距");
  }
  if (property.startsWith("align-") || property.startsWith("justify-")) return /^(?:start|center|end|stretch|space-between)$/.test(value) ? null : "对齐方式不在白名单中";
  return null;
}

function validateRule(rule: SiteStyleRule, index: number, errors: string[]) {
  const parts = siteStyleParts[rule.block];
  if (rule.part && !parts.includes(rule.part)) errors.push(`第 ${index + 1} 条的部件「${rule.part}」不在${rule.block}清单中`);
  for (const [property, value] of Object.entries(rule.declarations)) {
    if (forbiddenProperties.has(property) || !allowedProperties.has(property)) {
      errors.push(`第 ${index + 1} 条的属性「${property}」不能修改`);
      continue;
    }
    const reason = checkPropertyValue(property, value);
    if (reason) errors.push(`第 ${index + 1} 条的「${property}」${reason}`);
  }
}

export function siteStyleCss(rules: readonly SiteStyleRule[]) {
  const mediaQueries: Record<string, string> = { desktop: "(min-width: 901px)", tablet: "(max-width: 900px)", phone: "(max-width: 480px)" };
  const allowedProperties = new Set([
    "padding", "padding-top", "padding-right", "padding-bottom", "padding-left", "padding-block", "padding-block-start", "padding-block-end", "padding-inline", "padding-inline-start", "padding-inline-end", "margin-top", "margin-bottom", "margin-block", "gap", "row-gap", "column-gap", "max-width", "min-height", "grid-template-columns", "grid-column", "align-items", "align-content", "align-self", "justify-items", "justify-content", "justify-self", "font-size", "font-weight", "line-height", "letter-spacing", "text-align", "text-wrap", "border", "border-top", "border-right", "border-bottom", "border-left", "border-width", "border-top-width", "border-right-width", "border-bottom-width", "border-left-width", "border-color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color", "border-radius", "color", "background-color",
  ]);
  const tokens = new Set([
    "--site-bg", "--site-surface", "--site-ink", "--site-muted", "--site-accent", "--site-accent-strong", "--site-accent-soft", "--site-line", "--site-diagram", "--site-tint", "--site-font", "--site-radius", "--site-input", "--site-focus", "--site-disabled", "--site-container", "--site-gutter", "--site-gutter-narrow", "--site-section-space", "--site-section-space-narrow", "--site-h1", "--site-h1-display", "--site-h2", "--site-rule", "--site-rule-strong",
  ]);
  const functions = new Set(["var", "calc", "clamp", "min", "max", "minmax", "repeat", "color-mix"]);
  const safe = (value: unknown) => {
    if (typeof value !== "string" || !/^[\x20-\x7e]+$/.test(value) || /["'\\@!;{}<>]|\/\*/.test(value)) return false;
    for (const match of value.matchAll(/([a-z-]+)\s*\(/gi)) if (!functions.has(match[1].toLowerCase())) return false;
    for (const match of value.matchAll(/var\(([^)]+)\)/g)) if (!tokens.has(match[1].trim()) || match[1].includes(",")) return false;
    if (value.includes("color-mix(") && !/^color-mix\(\s*in srgb\s*,\s*var\(--site-[a-z0-9-]+\)(?:\s+\d+%)?\s*,\s*var\(--site-[a-z0-9-]+\)(?:\s+\d+%)?\s*\)$/.test(value.trim())) return false;
    return true;
  };
  const chunks: string[] = [];
  for (const rule of rules) {
    const selector = `[data-sc-block="${rule.block}"]${rule.part ? ` [data-sc-part="${rule.part}"]` : ""}`;
    const declarations = Object.entries(rule.declarations).filter(([property, value]) => allowedProperties.has(property) && safe(value)).map(([property, value]) => `${property}: ${value};`).join(" ");
    if (!declarations) continue;
    const body = `${selector} { ${declarations} }`;
    chunks.push(rule.media ? `@media ${mediaQueries[rule.media]} { ${body} }` : body);
  }
  return chunks.length ? `@layer site-style { ${chunks.join(" ")} }` : "";
}

function serializeUnchecked(rules: readonly SiteStyleRule[]) {
  return siteStyleCss(rules);
}

export function validateSiteStyleRules(input: unknown): SiteStyleValidation {
  const parsed = z.array(siteStyleRuleSchema).safeParse(input);
  if (!parsed.success) return { ok: false, errors: ["站点样式规则格式无效"] };
  const errors: string[] = [];
  if (parsed.data.length > SITE_STYLE_MAX_RULES) errors.push(`站点样式最多 ${SITE_STYLE_MAX_RULES} 条规则`);
  let declarationCount = 0;
  for (const [index, rule] of parsed.data.entries()) {
    declarationCount += Object.keys(rule.declarations).length;
    validateRule(rule, index, errors);
  }
  if (declarationCount > SITE_STYLE_MAX_DECLARATIONS) errors.push(`站点样式最多 ${SITE_STYLE_MAX_DECLARATIONS} 条声明`);
  const bytes = new TextEncoder().encode(serializeUnchecked(parsed.data)).byteLength;
  if (bytes > SITE_STYLE_MAX_BYTES) errors.push(`站点样式序列化后不能超过 ${SITE_STYLE_MAX_BYTES} 字节`);
  return errors.length ? { ok: false, errors: errors.slice(0, 6) } : { ok: true, rules: parsed.data, declarationCount, bytes };
}

export function normalizeSiteStyle(input: unknown): SiteStyle | undefined {
  const parsed = siteStyleSchema.safeParse(input);
  if (!parsed.success) return undefined;
  const rules = parsed.data.rules.filter((rule) => validateSiteStyleRules([rule]).ok);
  if (!rules.length && !parsed.data.direction) return undefined;
  const hasDirection = Object.hasOwn(parsed.data, "direction");
  return { ...(hasDirection ? { direction: parsed.data.direction ?? null } : {}), rules };
}
