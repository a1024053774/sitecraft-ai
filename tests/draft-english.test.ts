import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { draftWithFixtureProducts as defaultDraft } from "./fixtures/draft-with-products.ts";
import { draftOffersVisitorEnglish } from "../lib/draft-english.ts";
import { applySiteOperations } from "../lib/site-operations.ts";

test("default draft does not offer visitor English", () => {
  assert.equal(draftOffersVisitorEnglish(defaultDraft), false);
});

test("authored English that differs from default draft offers visitor English", () => {
  const draft = applySiteOperations(structuredClone(defaultDraft), [{
    op: "set_text",
    target: "hero.title",
    locale: "en",
    value: "Custom right-angle gearboxes for batch RFQs",
  }], {
    templateIds: new Set(["forge", "screwfast"]),
    lastChange: "en",
  }).draft;
  assert.equal(draftOffersVisitorEnglish(draft), true);
});

test("Chinese-only edits leave default English and still do not offer EN", () => {
  const draft = applySiteOperations(structuredClone(defaultDraft), [{
    op: "set_text",
    target: "hero.title",
    locale: "zh",
    value: "按图加工重载减速机",
  }, {
    op: "set_text",
    target: "companyName",
    value: "忻州重载减速机P3I",
  }], {
    templateIds: new Set(["forge", "screwfast"]),
    lastChange: "zh-only",
  }).draft;
  assert.equal(draftOffersVisitorEnglish(draft), false);
});

test("published client removes SiteCraft chrome bars", () => {
  const publishedClient = readFileSync(new URL("../app/published/[siteKey]/published-client.tsx", import.meta.url), "utf8");
  assert.equal(publishedClient.includes("published-chrome-bar"), false);
  assert.equal(publishedClient.includes("published-inquiry\""), false);
  assert.equal(publishedClient.includes("published-inquiry-form"), false);
  assert.equal(/data-testid="published-inquiry"/.test(publishedClient), false);
  assert.match(publishedClient, /onInquiry/);
  assert.match(publishedClient, /\/api\/public\/\$\{encodeURIComponent\(siteKey\)\}\/leads/);
});

test("sparse legacy draft with only inherited English does not offer visitor English", () => {
  const draft = structuredClone(defaultDraft);
  draft.templateId = "screwfast";
  draft.visualBrief = { ...draft.visualBrief, id: "engineering-industrial", templateId: "screwfast" };
  draft.siteName = "临汾传动件示意厂";
  draft.companyName = "临汾传动件示意厂";
  draft.content.hero.title.zh = "行星减速机按图加工";
  draft.content.hero.title.en = "Planetary gearbox inherited English";
  draft.content.hero.subtitle.zh = "现有减速机品类有货可询；规格和交期按询盘确认。";
  draft.content.hero.subtitle.en = "Inherited English subtitle";
  draft.products[0].name = { zh: "行星减速机", en: "Planetary gearbox Precision Module" };
  draft.products[0].summary = { zh: "批量规格询盘，交期待补充。", en: "Inherited product summary" };
  draft.englishReady = false;
  assert.equal(draftOffersVisitorEnglish(draft), false);
});
