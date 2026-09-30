import assert from "node:assert/strict";
import test from "node:test";
import { defaultDraft, normalizeDraft } from "../lib/site-document.ts";
import { applySiteOperations, aiChangeSchema, aiOperationSchema, siteOperationSchema, type SiteOperation } from "../lib/site-operations.ts";

const options = { templateIds: new Set(["forge", "screwfast", "landwind", "tailwind-landing"]), lastChange: "site-style" };
const style: Extract<SiteOperation, { op: "set_site_style" }> = {
  op: "set_site_style",
  direction: null,
  rules: [{ block: "hero", part: "title", declarations: { "font-size": "64px" } }],
};

test("set_site_style is accepted by both schemas and replaces as one reversible change", () => {
  assert.equal(siteOperationSchema.safeParse(style).success, true);
  assert.equal(aiOperationSchema.safeParse(style).success, true);
  const applied = applySiteOperations(structuredClone(defaultDraft), [style], options);
  assert.deepEqual(applied.draft.siteStyle, { direction: null, rules: [style.rules[0]] });
  assert.deepEqual(applied.appliedTargets, ["siteStyle"]);
  const undone = applySiteOperations(applied.draft, applied.inverseOperations, options);
  assert.equal(undone.draft.siteStyle, undefined);
  const redone = applySiteOperations(undone.draft, [style], options);
  assert.deepEqual(redone.draft.siteStyle, applied.draft.siteStyle);
  assert.equal(applySiteOperations(applied.draft, [style], options).changed, false);
});

test("normalizeDraft keeps valid site rules and drops unknown or unsafe ones", () => {
  const raw = { ...structuredClone(defaultDraft), siteStyle: {
    direction: "spec-led",
    rules: [
      { block: "hero", part: "title", declarations: { "font-size": "64px" } },
      { block: "hero", part: "missing", declarations: { color: "var(--site-ink)" } },
      { block: "hero", part: "title", declarations: { overflow: "hidden" } },
    ],
  } };
  const restored = normalizeDraft(raw);
  assert.deepEqual(restored.siteStyle, { direction: "spec-led", rules: [raw.siteStyle.rules[0]] });
});

test("the style operation does not consume the model's 24 ordinary-operation budget", () => {
  const ordinary = { op: "set_text", target: "hero.title", locale: "zh", value: "标题" } as const;
  const styleOperation = { op: "set_site_style", direction: null, rules: [] } as const;
  assert.equal(aiChangeSchema.safeParse({ summary: "s", operations: [...Array.from({ length: 24 }, () => ordinary), styleOperation] }).success, true);
  assert.equal(aiChangeSchema.safeParse({ summary: "s", operations: [...Array.from({ length: 25 }, () => ordinary), styleOperation] }).success, false);
});
