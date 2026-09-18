import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { STYLE_OPTIONS, UTILITY_OPTIONS } from "../lib/alignment.ts";
import { FRONTEND_TONE_RULES_VERSION, frontendToneRules } from "../lib/frontend-tone.ts";
import { visualBriefCatalog } from "../lib/site-document.ts";
import { aiIntentResponseSchema } from "../lib/site-operations.ts";

const SKILL_NAME_LEAKS = [
  "sitecraft-frontend-less-ai-tone",
  "frontend-less-ai-tone",
  "less-ai-tone",
];

test("runtime frontend tone is pinned at sitecraft-frontend-less-ai-tone@0.3.0", () => {
  assert.equal(FRONTEND_TONE_RULES_VERSION, "sitecraft-frontend-less-ai-tone@0.3.0");
});

test("user-facing theme cards and alignment options do not expose Skill names", () => {
  const surfaces = [
    ...visualBriefCatalog.map((item) => [item.label, item.summary, item.audience, item.primaryAction].join("\n")),
    ...STYLE_OPTIONS.map((item) => [item.label, item.description].join("\n")),
    ...UTILITY_OPTIONS.map((item) => [item.label, item.description].join("\n")),
    readFileSync(new URL("../app/workspace/page.tsx", import.meta.url), "utf8"),
    readFileSync(new URL("../app/quality/page.tsx", import.meta.url), "utf8"),
    readFileSync(new URL("../app/quality/quality-client.tsx", import.meta.url), "utf8"),
  ];
  for (const surface of surfaces) {
    for (const needle of SKILL_NAME_LEAKS) {
      assert.equal(surface.includes(needle), false, `user surface leaked ${needle}`);
    }
    assert.equal(/\bSkill\b/.test(surface), false, "user surface leaked a Skill label");
  }
  assert.deepEqual(
    visualBriefCatalog.map((item) => item.label),
    ["明亮产品", "工程工业", "蓝白目录", "灰底短路径", "深色产品"],
  );
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

test("project skill keeps the pinned runtime rules and forbids CSS emission", () => {
  const skill = readFileSync(new URL("../skills/sitecraft-frontend-less-ai-tone/SKILL.md", import.meta.url), "utf8");
  assert.match(skill, /sitecraft-frontend-less-ai-tone@0\.3\.0/);
  assert.match(skill, /commitOperations/);
  assert.match(skill, /visualBrief/);
  assert.match(skill, /missing/);
  assert.match(skill, /不输出 CSS/);
  assert.equal(skill.includes("模型不输出 CSS"), true);
  for (const rule of frontendToneRules) {
    assert.equal(skill.includes(rule), true, `skill missing runtime rule: ${rule.slice(0, 32)}`);
  }
});

test("skill source pins upstream revisions and does not claim font licensing", () => {
  const source = readFileSync(new URL("../skills/sitecraft-frontend-less-ai-tone/SOURCE.md", import.meta.url), "utf8");
  assert.match(source, /27d29232f10124db904ca9c0536d0b67cb3b2833/);
  assert.match(source, /41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f/);
  assert.match(source, /lib\/frontend-tone\.ts/);
  assert.match(source, /不批准任何模板图片、字体、图标或商标/);
});

test("cursor skill loader points at the project skill and does not fork rules", () => {
  const loader = readFileSync(new URL("../.cursor/skills/sitecraft-frontend-less-ai-tone/SKILL.md", import.meta.url), "utf8");
  assert.match(loader, /skills\/sitecraft-frontend-less-ai-tone\/SKILL\.md/);
  assert.match(loader, /sitecraft-frontend-less-ai-tone@0\.3\.0/);
  assert.equal(
    loader.includes("先确定一个主行动和一个首屏判断，再组织辅助内容"),
    false,
    "cursor loader forked runtime rules",
  );
});

test("general frontend skill is distinct from the SiteCraft overlay and allows CSS", () => {
  const general = readFileSync(new URL("../skills/frontend-less-ai-tone/SKILL.md", import.meta.url), "utf8");
  const overlay = readFileSync(new URL("../skills/sitecraft-frontend-less-ai-tone/SKILL.md", import.meta.url), "utf8");
  const generalLoader = readFileSync(new URL("../.cursor/skills/frontend-less-ai-tone/SKILL.md", import.meta.url), "utf8");
  assert.match(general, /能写 CSS 就按已选方向写/);
  assert.match(general, /Inter \/ Roboto \/ Arial/);
  assert.match(general, /三列等宽圆角卡片/);
  assert.equal(general.includes("模型不输出 CSS"), false);
  assert.equal(overlay.includes("skills/frontend-less-ai-tone/SKILL.md"), true);
  assert.match(overlay, /模型不输出 CSS/);
  assert.match(generalLoader, /skills\/frontend-less-ai-tone\/SKILL\.md/);
});
