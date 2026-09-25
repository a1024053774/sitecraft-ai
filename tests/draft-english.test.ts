import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { defaultDraft } from "../lib/site-document.ts";
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
