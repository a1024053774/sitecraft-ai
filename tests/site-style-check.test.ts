import assert from "node:assert/strict";
import test from "node:test";
import type { SiteDraft } from "../lib/site-document.ts";
import { checkSiteStyle } from "../lib/site-style-check.ts";
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
