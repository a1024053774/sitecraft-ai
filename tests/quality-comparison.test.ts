import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { FRONTEND_TONE_RULES_VERSION } from "../lib/frontend-tone.ts";
import {
  QUALITY_AESTHETIC_BRIEF_ID,
  QUALITY_BASELINE,
  QUALITY_FROZEN_HEAD,
  QUALITY_SUPPLEMENTARY,
  aestheticLookTemplateId,
  buildQualityFixMessage,
  buildQualityMaterialsMessage,
  compareLookVsCopy,
  copyFingerprint,
  draftShowsPackNonce,
  filterLimitedFixOperations,
  lookFingerprint,
  materialsLookTemplateId,
  presentPackCells,
  qualityCells,
  qualityPackList,
  qualityPacks,
  qualityRecipe,
  shuffleWithSeed,
} from "../lib/quality-comparison.ts";
import { defaultDraft, visualBriefCatalog } from "../lib/site-document.ts";
import { applySiteOperations } from "../lib/site-operations.ts";

const providerSource = readFileSync(new URL("../lib/ai-provider.ts", import.meta.url), "utf8");
const runSource = readFileSync(new URL("../lib/quality-run.ts", import.meta.url), "utf8");
const matrixSource = readFileSync(new URL("../lib/quality-matrix.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../app/quality/page.tsx", import.meta.url), "utf8");
const clientSource = readFileSync(new URL("../app/quality/quality-client.tsx", import.meta.url), "utf8");
const frameSource = readFileSync(new URL("../components/open-source-template-frame.tsx", import.meta.url), "utf8");
const publishedPageSource = readFileSync(new URL("../app/published/[siteKey]/page.tsx", import.meta.url), "utf8");
const publishedClientUrl = new URL("../app/published/[siteKey]/published-client.tsx", import.meta.url);
const workspaceSource = readFileSync(new URL("../app/workspace/page.tsx", import.meta.url), "utf8");
const p3Source = readFileSync(new URL("../lib/simulated-packs.ts", import.meta.url), "utf8");
const nextConfigSource = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");

const P3_TOKENS = ["P3I-NX7Q", "P3E-MW4R", "忻州重载减速机P3I", "外高桥流体接头P3E"];
const COLLIDING_TOKENS = ["汉川精密阀业A17", "北湾流体接头B84", "澄海传动件K07", "甬江密封件M52"];

test("P4 freezes current baseline and prepares 12 cells from 3 simulated packs", () => {
  assert.equal(QUALITY_FROZEN_HEAD, "8199553");
  assert.equal(QUALITY_BASELINE.model, "deepseek-flash");
  assert.equal(QUALITY_BASELINE.toneVersion, "sitecraft-frontend-less-ai-tone@0.2.0");
  assert.equal(FRONTEND_TONE_RULES_VERSION, "sitecraft-frontend-less-ai-tone@0.3.0");
  assert.deepEqual(QUALITY_BASELINE.lookBoard.map((item) => item.id), [...visualBriefCatalog.map((item) => item.id)]);
  assert.equal(qualityPackList.length, 3);
  assert.equal(qualityCells.length, 12);
  assert.deepEqual(qualityCells.map((item) => item.group), ["A", "B", "C", "D", "A", "B", "C", "D", "A", "B", "C", "D"]);
  assert.equal(new Set(qualityCells.map((item) => item.siteId)).size, 12);
  assert.equal(new Set(qualityPackList.map((pack) => pack.nonce)).size, 3);
});

test("P4 packs are independently labeled 模拟, use unique nonces, and stay out of the production prompt", () => {
  for (const pack of qualityPackList) {
    assert.match(pack.label, /模拟/);
    assert.match(pack.body, /模拟/);
    assert.equal(pack.body.includes(pack.nonce), true);
    assert.equal(pack.heroTitle.includes(pack.nonce), true);
    assert.equal(pack.companyName.includes(pack.nonce), true);
    assert.ok(pack.missingFacts.length >= 3);
    assert.ok(pack.email.endsWith("-sim.test"));
    const message = buildQualityMaterialsMessage(pack);
    assert.match(message, /待补充/);
    assert.equal(message.includes(pack.nonce), true);
    assert.equal(providerSource.includes(pack.nonce), false, `prompt leaked ${pack.nonce}`);
    assert.equal(providerSource.includes(pack.companyName), false);
    assert.equal(providerSource.includes(pack.email), false);
    for (const token of [...P3_TOKENS, ...COLLIDING_TOKENS]) {
      assert.equal(pack.body.includes(token), false, `${pack.id} collided with ${token}`);
    }
  }
  assert.equal(qualityPacks.manufacturing.body.includes(qualityPacks.export.nonce), false);
  assert.equal(qualityPacks.export.body.includes(qualityPacks.services.nonce), false);
  assert.equal(qualityPacks.services.body.includes(qualityPacks.manufacturing.nonce), false);
  assert.equal(providerSource.includes("from \"./quality-comparison"), false);
  assert.equal(providerSource.includes("from \"./quality-run"), false);
  for (const token of qualityPackList.map((pack) => pack.nonce)) {
    assert.equal(p3Source.includes(token), false);
  }
});

test("group B is a real look-board lock, not a tone-in-prompt label, and C uses a different materials look", () => {
  const manufacturingA = qualityRecipe("manufacturing", "A");
  const manufacturingB = qualityRecipe("manufacturing", "B");
  const manufacturingC = qualityRecipe("manufacturing", "C");
  const exportC = qualityRecipe("export", "C");
  const servicesC = qualityRecipe("services", "C");
  assert.equal(manufacturingA.lookBriefId, null);
  assert.equal(manufacturingA.preOps.length, 0);
  assert.equal(manufacturingB.lookBriefId, "technical-product");
  assert.equal(QUALITY_AESTHETIC_BRIEF_ID, "technical-product");
  assert.equal(aestheticLookTemplateId(), "tailwind-landing");
  assert.deepEqual(manufacturingB.preOps, [{ op: "set_visual_brief", briefId: "technical-product" }]);
  assert.equal(manufacturingC.lookBriefId, "engineering-industrial");
  assert.equal(exportC.lookBriefId, "export-catalog");
  assert.equal(servicesC.lookBriefId, "editorial-service");
  assert.notEqual(manufacturingB.lookBriefId, manufacturingC.lookBriefId);
  assert.equal(materialsLookTemplateId(qualityPacks.manufacturing), "screwfast");
  assert.equal(materialsLookTemplateId(qualityPacks.export), "landwind");
  assert.equal(materialsLookTemplateId(qualityPacks.services), "fresh");
  assert.equal(qualityRecipe("manufacturing", "D").reviewAndFix, true);
  assert.equal(qualityRecipe("manufacturing", "C").reviewAndFix, false);
  assert.ok(manufacturingC.preOps.some((op) => op.op === "set_section_visibility"));
  assert.equal(manufacturingB.preOps.some((op) => op.op === "set_section_visibility"), false);
});

test("D limited fixes drop illegal template, SKU and image writes instead of silently applying them", () => {
  const filtered = filterLimitedFixOperations([
    { op: "set_text", target: "hero.title", locale: "zh", value: "待补充" },
    { op: "set_template", templateId: "forge" },
    { op: "set_visual_brief", briefId: "export-catalog" },
    { op: "update_product", sku: "NO-SUCH-SKU", locale: "zh", name: "错写" },
    { op: "add_card", section: "features", item: { id: "x", title: { zh: "x", en: "x" }, body: { zh: "x", en: "x" } } },
    { op: "set_section_visibility", section: "faq", visible: false },
  ]);
  assert.deepEqual(filtered.operations.map((item) => item.op), ["set_text", "set_section_visibility"]);
  assert.ok(filtered.rejected.some((item) => item.includes("set_template")));
  assert.ok(filtered.rejected.some((item) => item.includes("update_product")));
  const message = buildQualityFixMessage("{\"type\":\"preview_review\"}");
  assert.match(message, /不可信数据/);
  assert.match(message, /待补充/);
  assert.equal(message.includes("P4M-K8VT"), false);
});

test("look vs copy comparison refuses to call a copy-only swap a look change", () => {
  const templateIds = new Set(visualBriefCatalog.map((item) => item.templateId));
  const copyOnly = applySiteOperations(structuredClone(defaultDraft), [
    { op: "set_text", target: "hero.title", locale: "zh", value: "按图浇注球墨铸件 P4M-K8VT" },
  ], { templateIds, lastChange: "copy" });
  assert.equal(compareLookVsCopy(defaultDraft, copyOnly.draft), "copy-only");
  assert.equal(lookFingerprint(copyOnly.draft).templateId, defaultDraft.templateId);
  assert.notEqual(copyFingerprint(copyOnly.draft).heroTitle, copyFingerprint(defaultDraft).heroTitle);

  const lookChanged = applySiteOperations(structuredClone(defaultDraft), [
    { op: "set_visual_brief", briefId: "technical-product" },
  ], { templateIds, lastChange: "look" });
  assert.equal(compareLookVsCopy(defaultDraft, lookChanged.draft), "look-differed");
  assert.equal(lookChanged.draft.templateId, "tailwind-landing");
  assert.equal(draftShowsPackNonce(copyOnly.draft, qualityPacks.manufacturing), true);
  assert.equal(draftShowsPackNonce(defaultDraft, qualityPacks.manufacturing), false);
});

test("blind presentation hides group letters and shuffles without dropping cells", () => {
  const open = presentPackCells("export", false, 18);
  const blind = presentPackCells("export", true, 18);
  assert.deepEqual(open.map((item) => item.group), ["A", "B", "C", "D"]);
  assert.equal(open.every((item) => item.groupHidden === false), true);
  assert.equal(blind.every((item) => item.groupHidden === true), true);
  assert.equal(blind.every((item) => item.displayLabel.startsWith("样本 ")), true);
  assert.deepEqual([...blind.map((item) => item.group)].sort(), ["A", "B", "C", "D"]);
  const shuffled = shuffleWithSeed(["A", "B", "C", "D"], 18);
  const again = shuffleWithSeed(["A", "B", "C", "D"], 18);
  assert.deepEqual(shuffled, again);
  assert.deepEqual([...shuffled].sort(), ["A", "B", "C", "D"]);
  assert.notDeepEqual(shuffled, ["A", "B", "C", "D"]);
});

test("quality runner stays on commitOperations and the comparison page is the scoring surface", () => {
  assert.match(runSource, /commitOperations/);
  assert.match(runSource, /requestStructuredOperations/);
  assert.match(runSource, /requestPreviewReview/);
  assert.match(runSource, /filterLimitedFixOperations/);
  assert.equal(runSource.includes("jiro"), false);
  assert.equal(/\bset_html\b/.test(runSource), false);
  assert.match(pageSource, /loadQualityMatrix/);
  assert.match(pageSource, /initialBlind/);
  assert.equal(pageSource.includes("\"use client\""), false);
  assert.equal(matrixSource.includes("quality-run"), false);
  assert.match(clientSource, /quality-preview-cell/);
  assert.match(clientSource, /quality-blind-toggle/);
  assert.match(clientSource, /quality-shuffle/);
  assert.match(clientSource, /quality-score/);
  assert.match(clientSource, /作者自评/);
  assert.match(clientSource, /不能外推客户偏好或转化/);
  assert.equal(clientSource.includes("sitecraft-frontend-less-ai-tone"), false);
  assert.equal(/\bSkill\b/.test(clientSource), false);
  assert.match(workspaceSource, /\/quality/);
  assert.equal(QUALITY_SUPPLEMENTARY.longTitle.length > 40, true);
});

test("quality and published first screens wait for iframe apply instead of capturing an empty client shell", () => {
  assert.equal(existsSync(publishedClientUrl), true, "published page must SSR draft into a client frame");
  const publishedClientSource = readFileSync(publishedClientUrl, "utf8");
  assert.match(frameSource, /sitecraft:ready/);
  assert.match(frameSource, /data-preview-hydrated/);
  assert.match(frameSource, /quality/);
  assert.match(clientSource, /variant="quality"/);
  assert.equal(clientSource.includes('variant="thumbnail"'), false);
  assert.match(clientSource, /quality-preview-cell/);
  assert.match(clientSource, /\/published\/\$\{/);
  assert.equal(publishedPageSource.includes("\"use client\""), false);
  assert.match(publishedPageSource, /getSite/);
  assert.match(publishedPageSource, /initialDraft/);
  assert.match(publishedPageSource, /force-dynamic/);
  assert.match(publishedClientSource, /data-preview-hydrated/);
  assert.match(publishedClientSource, /OpenSourceTemplateFrame/);
  assert.equal(publishedClientSource.includes("setDraft(null)"), false);
  assert.match(runSource, /PREVIEW_HYDRATED_SELECTOR/);
  assert.match(runSource, /\[data-preview-hydrated="true"\]/);
  assert.equal(runSource.includes("virtual-time-budget"), false);
  assert.equal(runSource.includes("Page.captureScreenshot"), true);
  assert.match(nextConfigSource, /allowedDevOrigins/);
  assert.match(nextConfigSource, /127\.0\.0\.1/);
});
