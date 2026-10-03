import assert from "node:assert/strict";
import { before, test } from "node:test";
import type { SiteDraft } from "../lib/site-document.ts";
import { checkSiteStyle } from "../lib/site-style-check.ts";
import { brightLook } from "../lib/blocks/looks/bright.ts";
import { catalogLook } from "../lib/blocks/looks/catalog.ts";
import { visualBriefCatalog } from "../lib/site-document.ts";
import { packDraft } from "./fixtures/pack-drafts.ts";
import { assertWorkspaceServer, base } from "./helpers/workspace-browser.ts";

const baseDraft: SiteDraft = packDraft("industrial");

before(async () => assertWorkspaceServer());

test("a normal site style passes all three browser widths", async () => {
  const result = await checkSiteStyle({
    templateId: "screwfast",
    draft: { ...baseDraft, siteStyle: { direction: null, rules: [{ block: "products", part: "grid", declarations: { gap: "32px" } }] } },
    baseUrl: base,
    outDir: "artifacts/t054/site-style-check-normal",
  });
  assert.equal(result.ok, true, result.ok ? "" : result.reasons.join("；"));
});

test("a legal grid rule that cannot fit on a phone is rejected with width and block", async () => {
  const result = await checkSiteStyle({
    templateId: "screwfast",
    draft: { ...baseDraft, siteStyle: { direction: null, rules: [{ block: "products", part: "grid", declarations: { "grid-template-columns": "repeat(4, minmax(240px, 1fr))" } }] } },
    baseUrl: base,
    outDir: "artifacts/t054/site-style-check-overflow",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.reasons.some((reason) => /375/.test(reason)), result.reasons.join("；"));
    assert.ok(result.reasons.some((reason) => /产品/.test(reason)), result.reasons.join("；"));
  }
});

test('a white title on its white surface is rejected for contrast', async () => {
 const result=await checkSiteStyle({templateId:'screwfast',draft:{...baseDraft,siteStyle:{direction:null,rules:[{block:'hero',part:'title',declarations:{color:'var(--site-surface)'}}]}},baseUrl:base,outDir:`artifacts/t054/contrast-${Date.now()}`});
 assert.equal(result.ok,false); if(!result.ok)assert.match(result.reasons.join(' '),/对比度/);
});

test("a style check that exceeds its total deadline is rejected as incomplete", async () => {
  const result = await checkSiteStyle({
    templateId: "screwfast",
    draft: { ...baseDraft, siteStyle: { direction: "spec-led", rules: [] } },
    baseUrl: base,
    timeoutMs: 1,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reasons.join("；"), /检查没有完成/);
});

test("bright product directions pass all three browser widths for all three materials", async () => {
  const brightBrief = visualBriefCatalog.find((brief) => brief.id === "industrial");
  assert.ok(brightBrief);
  for (const pack of ["industrial", "export", "molding"] as const) {
    for (const direction of ["spec-led", "catalog-led", "capability-led"] as const) {
      const result = await checkSiteStyle({
        templateId: "forge",
        draft: { ...packDraft(pack), templateId: "forge", visualBrief: structuredClone(brightBrief), siteStyle: { direction, rules: [] } },
        baseUrl: base,
        outDir: `artifacts/t055/site-style-bright/${pack}-${direction}`,
      });
      assert.equal(result.ok, true, `${pack}/${direction}: ${result.ok ? "" : result.reasons.join("；")}`);
      assert.deepEqual(result.widths, [375, 768, 1440]);
    }
  }
});

test("catalog directions pass all three browser widths for all three materials", async () => {
  const catalogBrief = visualBriefCatalog.find((brief) => brief.id === "export-catalog");
  assert.ok(catalogBrief);
  for (const pack of ["industrial", "export", "molding"] as const) {
    for (const direction of ["spec-led", "catalog-led", "capability-led"] as const) {
      const result = await checkSiteStyle({
        templateId: "landwind",
        draft: { ...packDraft(pack), templateId: "landwind", visualBrief: structuredClone(catalogBrief), siteStyle: { direction, rules: [] } },
        baseUrl: base,
        outDir: `artifacts/t056/site-style-catalog/${pack}-${direction}`,
      });
      assert.equal(result.ok, true, `${pack}/${direction}: ${result.ok ? "" : result.reasons.join("；")}`);
      assert.deepEqual(result.widths, [375, 768, 1440]);
    }
  }
});
