import assert from "node:assert/strict";
import test from "node:test";
import { blockCatalog } from "../lib/blocks/catalog.ts";
import { siteStyleRuleSchema, validateSiteStyleRules, type SiteStyleRule } from "../lib/blocks/site-style.ts";

const rule = (declarations: Record<string, string>, extra: Partial<SiteStyleRule> = {}) => ({
  block: "hero",
  part: "title",
  declarations,
  ...extra,
}) as SiteStyleRule;

test("a legal rule uses a named block part and a whitelisted declaration", () => {
  const result = validateSiteStyleRules([rule({ "padding-block": "24px" })]);
  assert.equal(result.ok, true, result.ok ? "" : result.errors.join("；"));
  assert.equal(siteStyleRuleSchema.safeParse(rule({ "padding-block": "24px" })).success, true);
});

test("the style block and part allowlist comes from the block catalog but excludes page chrome", () => {
  assert.equal(validateSiteStyleRules([rule({ color: "var(--site-ink)" }, { block: "nav", part: "bar" } as never)]).ok, false);
  assert.equal(validateSiteStyleRules([rule({ color: "var(--site-ink)" }, { block: "footer", part: "columns" } as never)]).ok, false);
  assert.equal(validateSiteStyleRules([rule({ color: "var(--site-ink)" }, { block: "hero", part: "not-a-part" })]).ok, false);
  assert.ok(blockCatalog.hero.variants.split.parts.includes("title"));
});

test("forbidden properties and values are rejected with a useful reason", () => {
  const cases: Array<[string, Record<string, string>]> = [
    ["content", { content: '"owned text"' }],
    ["list-style-type", { "list-style-type": '"x"' }],
    ["escaped url", { color: "u\\72 l(https://evil.test/x)" }],
    ["image-set", { "background-color": "image-set(url(x) 1x)" }],
    ["@import", { "@import": "https://evil.test/x.css" }],
    ["important", { color: "var(--site-ink) !important" }],
    ["fixed position", { position: "fixed" }],
    ["z-index", { "z-index": "999" }],
    ["display", { display: "none" }],
    ["min-width", { "min-width": "520px" }],
    ["negative margin", { "margin-top": "-1px" }],
    ["unknown function", { color: "paint(foo)" }],
    ["non-ascii", { color: "红色" }],
  ];
  for (const [label, declarations] of cases) {
    const result = validateSiteStyleRules([rule(declarations)]);
    assert.equal(result.ok, false, `${label} must be rejected`);
    if (!result.ok) assert.ok(result.errors.join("；").length > 0, `${label} needs a reason`);
  }
});

test("property values stay inside their numeric and grammar bounds", () => {
  const accepted = [
    rule({ gap: "160px", "font-size": "96px", "border-radius": "12px", "grid-column": "span 4" }),
    rule({ "grid-template-columns": "repeat(4, minmax(240px, 1fr))" }),
    rule({ color: "color-mix(in srgb, var(--site-ink) 70%, var(--site-accent))" }),
    rule({ "max-width": "50%", "min-height": "720px" }),
    rule({ "min-height": "0", "border-radius": "0" }),
    rule({ "letter-spacing": "-0.02em", "line-height": "2", "text-align": "center", "text-wrap": "pretty" }),
  ];
  for (const candidate of accepted) {
    const result = validateSiteStyleRules([candidate]);
    assert.equal(result.ok, true, result.ok ? "" : result.errors.join("；"));
  }
  const rejected = [
    rule({ gap: "161px" }),
    rule({ "font-size": "10px" }),
    rule({ "border-radius": "13px" }),
    rule({ "grid-column": "2 / 3" }),
    rule({ "max-width": "100px" }),
    rule({ "min-height": "721px" }),
    rule({ "letter-spacing": "0.13em" }),
    rule({ "line-height": "2.1" }),
    rule({ border: "1px dashed var(--site-line)" }),
    rule({ border: "1px solid red" }),
  ];
  for (const candidate of rejected) assert.equal(validateSiteStyleRules([candidate]).ok, false);
});

test("rule, declaration, and serialized-byte limits are enforced", () => {
  const fortyOne = Array.from({ length: 41 }, (_, index) => rule({ gap: `${index}px` }));
  assert.equal(validateSiteStyleRules(fortyOne).ok, false);
  const twoHundredOne = [rule(Object.fromEntries(Array.from({ length: 201 }, (_, index) => [`gap-${index}`, "0px"])) )];
  assert.equal(validateSiteStyleRules(twoHundredOne).ok, false);
  const huge = [rule({ "padding-block": "0px", "font-size": `${"1".repeat(9000)}px` })];
  assert.equal(validateSiteStyleRules(huge).ok, false);
});
