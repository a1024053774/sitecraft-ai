import assert from "node:assert/strict";
import test from "node:test";
import type { SiteDraft } from "../lib/site-document.ts";
import { checkSiteStyle } from "../lib/site-style-check.ts";
import { brightLook } from "../lib/blocks/looks/bright.ts";
import { visualBriefCatalog } from "../lib/site-document.ts";
import { packDraft } from "./fixtures/pack-drafts.ts";

const baseDraft: SiteDraft = packDraft("industrial");

test("a normal site style passes all three browser widths", async () => {
  const result = await checkSiteStyle({
    templateId: "screwfast",
    draft: { ...baseDraft, siteStyle: { direction: null, rules: [{ block: "products", part: "grid", declarations: { gap: "32px" } }] } },
    baseUrl: process.env.SITECRAFT_BASE || "http://127.0.0.1:3034",
    outDir: "artifacts/t054/site-style-check-normal",
  });
  assert.equal(result.ok, true, result.ok ? "" : result.reasons.join("；"));
});

test("a legal grid rule that cannot fit on a phone is rejected with width and block", async () => {
  const result = await checkSiteStyle({
    templateId: "screwfast",
    draft: { ...baseDraft, siteStyle: { direction: null, rules: [{ block: "products", part: "grid", declarations: { "grid-template-columns": "repeat(4, minmax(240px, 1fr))" } }] } },
    baseUrl: process.env.SITECRAFT_BASE || "http://127.0.0.1:3034",
    outDir: "artifacts/t054/site-style-check-overflow",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.reasons.some((reason) => /375/.test(reason)), result.reasons.join("；"));
    assert.ok(result.reasons.some((reason) => /产品/.test(reason)), result.reasons.join("；"));
  }
});

test('a white title on its white surface is rejected for contrast', async () => {
 const result=await checkSiteStyle({templateId:'screwfast',draft:{...baseDraft,siteStyle:{direction:null,rules:[{block:'hero',part:'title',declarations:{color:'var(--site-surface)'}}]}},baseUrl:'http://127.0.0.1:3034',outDir:`artifacts/t054/contrast-${Date.now()}`});
 assert.equal(result.ok,false); if(!result.ok)assert.match(result.reasons.join(' '),/对比度/);
});

test("a style check that exceeds its total deadline is rejected as incomplete", async () => {
  const result = await checkSiteStyle({
    templateId: "screwfast",
    draft: { ...baseDraft, siteStyle: { direction: "spec-led", rules: [] } },
    baseUrl: process.env.SITECRAFT_BASE || "http://127.0.0.1:3034",
    timeoutMs: 1,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reasons.join("；"), /检查没有完成/);
});

test("bright product directions pass all three browser widths for all three materials", async () => {
  const brightBrief = visualBriefCatalog.find((brief) => brief.id === "industrial");
  assert.ok(brightBrief);
  for (const pack of ["industrial", "export", "molding"] as const) {
    for (const direction of Object.keys(brightLook.styleDirections ?? {})) {
      const result = await checkSiteStyle({
        templateId: "forge",
        draft: { ...packDraft(pack), templateId: "forge", visualBrief: structuredClone(brightBrief), siteStyle: { direction, rules: [] } },
        baseUrl: process.env.SITECRAFT_BASE || "http://127.0.0.1:3034",
        outDir: `artifacts/t055/site-style-bright/${pack}-${direction}`,
      });
      assert.equal(result.ok, true, `${pack}/${direction}: ${result.ok ? "" : result.reasons.join("；")}`);
      assert.deepEqual(result.widths, [375, 768, 1440]);
    }
  }
});
