import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { STYLE_OPTIONS } from "../lib/alignment.ts";
import { qualityPacks } from "../lib/quality-comparison.ts";
import { defaultDraft, normalizeDraft, visualBriefCatalog } from "../lib/site-document.ts";

const workspaceSource = readFileSync(new URL("../app/workspace/page.tsx", import.meta.url), "utf8");

test("legacy editorial look is hidden from new choices while old drafts stay readable", () => {
  assert.equal(visualBriefCatalog.some((brief) => brief.id === "editorial-service"), false);
  assert.equal(STYLE_OPTIONS.some((option) => option.id === "editorial-service"), false);
  assert.equal(qualityPacks.services.materialsLookId, "technical-product");
  const legacy = structuredClone(defaultDraft);
  legacy.visualBrief = {
    ...legacy.visualBrief,
    id: "editorial-service",
    label: "深色产品",
    templateId: "fresh",
  };
  const restored = normalizeDraft(legacy);
  assert.equal(restored.visualBrief.id, "technical-product");
  assert.equal(restored.templateId, "tailwind-landing");
  assert.equal(restored.legacyVisualBriefId, "editorial-service");
  assert.match(workspaceSource, /legacy-look-warning/);
  assert.match(workspaceSource, /换用可用样子/);
});
