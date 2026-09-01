import assert from "node:assert/strict";
import test from "node:test";
import { isGenerationRecordEnabled, recordGeneration, listGenerationRecords } from "../lib/generation-record.ts";
import type { SiteIntent } from "../lib/site-intent.ts";

// 单测环境无 PG（SITE_STORE 非 postgres）→ usePostgres=false，recordGeneration 应直接返回不崩
// PG 真实写入靠真机验证（npm run test:e2e:real）

const intent: SiteIntent = {
  businessType: "trade",
  companyName: "华辰光伏",
  industry: "光伏组件出口",
  targetAudience: "overseasB2b",
  tone: "professional",
  colorTone: "green",
  coreSections: ["about", "features", "products", "contact"],
  recommendedTemplateId: "atlas",
  summary: "光伏出口企业的双语官网",
};

test("isGenerationRecordEnabled: false in non-postgres test env", () => {
  assert.equal(isGenerationRecordEnabled(), false);
});

test("recordGeneration: no-op (no throw) without postgres", async () => {
  // 不应抛错，静默返回（fail-open）
  await recordGeneration({
    siteId: "demo",
    inputText: "做个光伏官网",
    intent,
    operations: [{ op: "set_text", target: "hero.title", locale: "zh", value: "可靠光伏" }],
    templateId: "atlas",
    latencyMs: 1200,
    model: "deepseek-v4-flash",
    status: "applied",
  });
  assert.ok(true);
});

test("listGenerationRecords: empty without postgres", async () => {
  const records = await listGenerationRecords(10);
  assert.deepEqual(records, []);
});
