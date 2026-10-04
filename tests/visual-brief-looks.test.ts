import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { STYLE_OPTIONS } from "../lib/alignment.ts";
import { defaultDraft, normalizeDraft, visualBriefCatalog, visualBriefIds } from "../lib/site-document.ts";
import { applySiteOperations } from "../lib/site-operations.ts";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const abs = path.join(process.cwd(), specifier.slice(2));
    let file = abs;
    if (existsSync(`${abs}.ts`)) file = `${abs}.ts`;
    else if (existsSync(path.join(abs, "index.ts"))) file = path.join(abs, "index.ts");
    return nextResolve(pathToFileURL(file).href, context);
  },
});

const { getTemplateReadiness } = await import("../lib/template-readiness.ts");

// Plan v0.6 look board. Cards ship only when the look has a local page: a usable snapshot, or, for a
// look on the block library, the page composed from lib/blocks (T-053).
const LOOK_BOARD = [
  { id: "industrial", label: "明亮产品", templateId: "forge" },
  { id: "engineering-industrial", label: "工程工业", templateId: "screwfast" },
  { id: "export-catalog", label: "蓝白目录", templateId: "landwind" },
  { id: "technical-product", label: "灰底短路径", templateId: "tailwind-landing" },
] as const;

const OMITTED_TEMPLATES = ["atlas", "powerai", "astro-starter", "fresh", "shadcn-landing", "nextjs-landing"] as const;
const INDUSTRY_CARD_LABELS = ["工业专业", "外贸目录", "技术产品", "专业顾问"];

test("look board ships snapshot-backed looks with look-language labels, not industry 1:1", () => {
  const shipped = LOOK_BOARD.filter((look) => getTemplateReadiness(look.templateId).hasLocalSnapshot);
  assert.ok(shipped.length >= 1, "at least one listed look must have a local snapshot");
  assert.deepEqual(
    visualBriefCatalog.map((item) => ({ id: item.id, label: item.label, templateId: item.templateId })),
    shipped.map((item) => ({ id: item.id, label: item.label, templateId: item.templateId })),
  );
  assert.deepEqual([...visualBriefIds].filter((id) => shipped.some((item) => item.id === id)), shipped.map((item) => item.id));
  assert.equal(visualBriefIds.includes("editorial-service"), true, "legacy drafts keep the removed id in the schema");

  for (const item of visualBriefCatalog) {
    assert.equal(INDUSTRY_CARD_LABELS.includes(item.label), false, `${item.id} still uses an industry card label`);
    assert.equal(item.label, LOOK_BOARD.find((look) => look.id === item.id)?.label);
    assert.notEqual(item.label, item.templateId);
    assert.equal(getTemplateReadiness(item.templateId).hasLocalSnapshot, true, `${item.templateId} has no local page`);
  }

  const shippedTemplateIds = new Set(visualBriefCatalog.map((item) => item.templateId));
  for (const templateId of OMITTED_TEMPLATES) {
    assert.equal(shippedTemplateIds.has(templateId), false, `${templateId} must stay off the look board`);
  }
});

test("alignment style options reuse the look board labels and never expose template ids as the choice", () => {
  assert.deepEqual(
    STYLE_OPTIONS.map((item) => ({ id: item.id, label: item.label })),
    visualBriefCatalog.map((item) => ({ id: item.id, label: item.label })),
  );
  for (const option of STYLE_OPTIONS) {
    assert.equal(INDUSTRY_CARD_LABELS.includes(option.label), false);
    assert.notEqual(option.label, visualBriefCatalog.find((item) => item.id === option.id)?.templateId);
  }
});

test("stored drafts refresh look labels from the catalog and keep authored content", () => {
  const legacy = structuredClone(defaultDraft);
  legacy.visualBrief = {
    ...legacy.visualBrief,
    id: "industrial",
    label: "工业专业",
    summary: "旧行业卡文案",
    templateId: "forge",
  };
  legacy.content.hero.title.zh = "留存阀组 LOOK_LABEL_9182";
  const restored = normalizeDraft(legacy);
  assert.equal(restored.visualBrief.id, "industrial");
  assert.equal(restored.visualBrief.label, "明亮产品");
  assert.equal(restored.visualBrief.summary, "留白充足，产品先于故事。");
  assert.equal(restored.visualBrief.templateId, "forge");
  assert.equal(restored.content.hero.title.zh, "留存阀组 LOOK_LABEL_9182");
});

test("legacy engineering drafts hydrate to the named default palette", () => {
  const legacy = structuredClone(defaultDraft);
  legacy.visualBrief = structuredClone(visualBriefCatalog.find((item) => item.id === "engineering-industrial")!);
  legacy.templateId = "screwfast";
  legacy.paletteId = "default";
  const restored = normalizeDraft(legacy);
  assert.equal(restored.paletteId, "engineering-warm-orange");
});

test("set_visual_brief maps each shipped look onto its compatible template in one revision", () => {
  const templateIds = new Set(visualBriefCatalog.map((item) => item.templateId));
  for (const look of visualBriefCatalog) {
    const result = applySiteOperations(structuredClone(defaultDraft), [{ op: "set_visual_brief", briefId: look.id }], {
      templateIds,
      lastChange: `选择样子 ${look.label}`,
    });
    assert.equal(result.draft.visualBrief.id, look.id);
    assert.equal(result.draft.visualBrief.label, look.label);
    assert.equal(result.draft.templateId, look.templateId);
    assert.equal(result.draft.visualBrief.templateId, look.templateId);
    if (look.id === defaultDraft.visualBrief.id && look.templateId === defaultDraft.templateId) {
      assert.equal(result.changed, false);
    } else {
      assert.equal(result.changed, true);
      assert.equal(result.draft.revision, defaultDraft.revision + 1);
      assert.deepEqual(result.appliedTargets, ["visualBrief", "template", "pagePlan"]);
    }
  }
});

test("workspace look cards do not present Skill names or internal template ids as the product choice", () => {
  const source = readFileSync(new URL("../app/(workspace)/workspace/page.tsx", import.meta.url), "utf8");
  assert.equal(source.includes("先选网站的样子"), true);
  assert.equal(source.includes("行业仍来自公司资料"), true);
  assert.equal(source.includes("工业专业"), false);
  assert.equal(source.includes("外贸目录"), false);
  assert.equal(/\bSkill\b/.test(source), false);
  assert.equal(source.includes("sitecraft-frontend-less-ai-tone"), false);
  assert.equal(source.includes('{ op: "set_visual_brief", briefId: brief.id }'), true);
  assert.equal(source.includes("{brief.label}"), true);
  assert.match(source, /data-testid="visual-brief-card"/);
  assert.match(source, /data-brief-id=\{brief\.id\}/);
  assert.match(source, /palette-swatch-row/);
  assert.match(source, /paletteSwatchRoles/);
  assert.match(source, /background.*surface.*text.*muted.*border.*accent.*accentStrong/);
});
