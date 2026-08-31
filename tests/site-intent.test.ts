import assert from "node:assert/strict";
import test from "node:test";
import {
  buildIntentPrompt,
  categoryFromKeywords,
  createSiteIntentSchema,
  parseSiteIntentContent,
  resolveTemplate,
  type SiteIntent,
} from "../lib/site-intent.ts";

const validIntent: SiteIntent = {
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

test("parseSiteIntentContent: parses valid JSON", () => {
  const r = parseSiteIntentContent(JSON.stringify(validIntent));
  assert.equal(r.error, "");
  assert.equal(r.data?.businessType, "trade");
  assert.equal(r.data?.recommendedTemplateId, "atlas");
});

test("parseSiteIntentContent: strips code fences", () => {
  const r = parseSiteIntentContent(`\`\`\`json\n${JSON.stringify(validIntent)}\n\`\`\``);
  assert.equal(r.error, "");
  assert.ok(r.data);
});

test("parseSiteIntentContent: rejects invalid businessType", () => {
  const bad = { ...validIntent, businessType: "ai-company" };
  const r = parseSiteIntentContent(JSON.stringify(bad));
  assert.equal(r.data, null);
  assert.match(r.error, /businessType/);
});

test("parseSiteIntentContent: rejects template not in whitelist", () => {
  const bad = { ...validIntent, recommendedTemplateId: "nonexistent" };
  const r = parseSiteIntentContent(JSON.stringify(bad));
  assert.equal(r.data, null);
  assert.match(r.error, /recommendedTemplateId/);
});

test("parseSiteIntentContent: rejects empty coreSections", () => {
  const bad = { ...validIntent, coreSections: [] };
  const r = parseSiteIntentContent(JSON.stringify(bad));
  assert.equal(r.data, null);
});

test("createSiteIntentSchema: whitelist is injectable (subset)", () => {
  const subset = createSiteIntentSchema(["forge", "atlas"]);
  const ok = subset.safeParse({ ...validIntent, recommendedTemplateId: "atlas" });
  assert.equal(ok.success, true);
  const bad = subset.safeParse({ ...validIntent, recommendedTemplateId: "signal" });
  assert.equal(bad.success, false);
});

test("buildIntentPrompt: contains template ids and enum guidance", () => {
  const prompt = buildIntentPrompt("光伏出口", []);
  assert.match(prompt, /recommendedTemplateId/);
  assert.match(prompt, /coreSections/);
  const withCatalog = buildIntentPrompt("光伏出口");
  assert.match(withCatalog, /atlas/);
  assert.match(withCatalog, /forge/);
});

test("categoryFromKeywords: matches intent words", () => {
  assert.equal(categoryFromKeywords("光伏出口企业，主打欧美"), "外贸目录");
  assert.equal(categoryFromKeywords("帮我的 SaaS 团队做官网"), "科技企业");
  assert.equal(categoryFromKeywords("工业零部件厂的官网，突出质量"), "制造业");
  assert.equal(categoryFromKeywords("设计咨询公司的作品集网站"), "专业服务");
  assert.equal(categoryFromKeywords("本地餐饮店的宣传页"), null);
});

test("resolveTemplate: keyword category wins over businessType", () => {
  // 意图说 manufacturing，但一句话含"出口" → 外贸目录优先
  const intent: SiteIntent = { ...validIntent, businessType: "manufacturing", recommendedTemplateId: "forge" };
  const r = resolveTemplate(intent, "光伏组件出口企业，主打欧美");
  assert.equal(r.category, "外贸目录");
  assert.equal(r.templateId, "atlas"); // 推荐 forge 越界 → 规则覆盖为 atlas
});

test("resolveTemplate: businessType maps category when no keyword", () => {
  const intent: SiteIntent = { ...validIntent, businessType: "tech", recommendedTemplateId: "signal" };
  const r = resolveTemplate(intent, "帮我做一个网站");
  assert.equal(r.category, "科技企业");
  assert.equal(r.templateId, "signal");
});

test("resolveTemplate: model recommendation within category is adopted", () => {
  const intent: SiteIntent = { ...validIntent, businessType: "tech", recommendedTemplateId: "moon" };
  const r = resolveTemplate(intent, "做个科技产品官网");
  assert.equal(r.category, "科技企业");
  assert.equal(r.templateId, "moon");
});

test("resolveTemplate: other + no keyword falls back to forge", () => {
  const intent: SiteIntent = { ...validIntent, businessType: "other", recommendedTemplateId: "powerai" };
  const r = resolveTemplate(intent, "本地餐饮店");
  assert.equal(r.templateId, "forge");
  assert.equal(r.category, "制造业");
});

test("resolveTemplate: reason is human-readable", () => {
  const intent: SiteIntent = { ...validIntent, businessType: "trade" };
  const r = resolveTemplate(intent, "出口企业官网");
  assert.match(r.reason, /外贸目录/);
});
