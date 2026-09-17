import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { STYLE_OPTIONS, UTILITY_OPTIONS } from "../lib/alignment.ts";
import { FRONTEND_TONE_RULES_VERSION } from "../lib/frontend-tone.ts";
import { visualBriefCatalog } from "../lib/site-document.ts";
import { aiIntentResponseSchema } from "../lib/site-operations.ts";

const SKILL_NAME_LEAKS = [
  "sitecraft-frontend-less-ai-tone",
  "frontend-less-ai-tone",
  "less-ai-tone",
];

test("runtime frontend tone is pinned at sitecraft-frontend-less-ai-tone@0.2.0", () => {
  assert.equal(FRONTEND_TONE_RULES_VERSION, "sitecraft-frontend-less-ai-tone@0.2.0");
});

test("user-facing theme cards and alignment options do not expose Skill names", () => {
  const surfaces = [
    ...visualBriefCatalog.map((item) => [item.label, item.summary, item.audience, item.primaryAction].join("\n")),
    ...STYLE_OPTIONS.map((item) => [item.label, item.description].join("\n")),
    ...UTILITY_OPTIONS.map((item) => [item.label, item.description].join("\n")),
    readFileSync(new URL("../app/workspace/page.tsx", import.meta.url), "utf8"),
  ];
  for (const surface of surfaces) {
    for (const needle of SKILL_NAME_LEAKS) {
      assert.equal(surface.includes(needle), false, `user surface leaked ${needle}`);
    }
    assert.equal(/\bSkill\b/.test(surface), false, "user surface leaked a Skill label");
  }
});

test("AI intent schema rejects CSS and HTML write operations", () => {
  const css = aiIntentResponseSchema.safeParse({
    type: "edit",
    summary: "写入样式",
    operations: [{ op: "set_css", value: "body{color:red}" }],
  });
  assert.equal(css.success, false);

  const html = aiIntentResponseSchema.safeParse({
    type: "edit",
    summary: "写入标记",
    operations: [{ op: "set_html", target: "hero.title", value: "<div>x</div>" }],
  });
  assert.equal(html.success, false);

  const styleAttr = aiIntentResponseSchema.safeParse({
    type: "edit",
    summary: "写入内联样式",
    operations: [{ op: "set_style", target: "hero.title", value: "color:red" }],
  });
  assert.equal(styleAttr.success, false);
});
