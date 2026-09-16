import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { defaultDraft, type SiteDraft } from "../lib/site-document.ts";

const envKeys = [
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_MODEL",
  "DEEPSEEK_BASE_URL",
  "DEEPSEEK_MAX_TOKENS",
  "AI_API_KEY",
  "AI_MODEL",
  "AI_BASE_URL",
] as const;
const previousEnv: Partial<Record<(typeof envKeys)[number], string | undefined>> = {};
for (const key of envKeys) previousEnv[key] = process.env[key];

function writeEnv(key: string, value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env[key];
  else env[key] = value;
}

writeEnv("DEEPSEEK_API_KEY", "sk-test-provider-intent-not-real");
writeEnv("DEEPSEEK_MODEL", "test-intent-model");
writeEnv("DEEPSEEK_BASE_URL", "https://intent-stub.test.invalid");
writeEnv("AI_API_KEY", undefined);
writeEnv("AI_MODEL", undefined);
writeEnv("AI_BASE_URL", undefined);

const originalFetch = globalThis.fetch;
const stubBase = "https://intent-stub.test.invalid/";
let lastRequestBody = "";
let nextPayload: Record<string, unknown> = { type: "answer", text: "unset" };

globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.includes("api.deepseek.com") || !url.startsWith(stubBase)) {
    throw new Error(`refusing unexpected fetch ${url}`);
  }
  lastRequestBody = typeof init?.body === "string" ? init.body : "";
  return new Response(JSON.stringify({
    choices: [{ finish_reason: "stop", message: { content: JSON.stringify(nextPayload) } }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const abs = path.join(process.cwd(), specifier.slice(2));
    const file = existsSync(`${abs}.ts`) ? `${abs}.ts` : abs;
    return nextResolve(pathToFileURL(file).href, context);
  },
});

const { requestStructuredOperations } = await import("../lib/ai-provider.ts");

function userPromptFromLastRequest() {
  const parsed = JSON.parse(lastRequestBody) as {
    messages?: Array<{ role?: string; content?: string }>;
  };
  const user = parsed.messages?.find((item) => item.role === "user");
  assert.equal(typeof user?.content, "string");
  return String(user?.content);
}

function restoreEnv() {
  for (const key of envKeys) writeEnv(key, previousEnv[key]);
}

test.after(() => {
  globalThis.fetch = originalFetch;
  restoreEnv();
});

test("requestStructuredOperations returns answer without calling operation validation", async () => {
  nextPayload = { type: "answer", text: "T3_ANSWER_TEXT_4409 当前站点用于展示工业能力。" };
  const result = await requestStructuredOperations({
    message: "T3_ANSWER_USER_4409 这个网站是做什么的？",
    draft: defaultDraft,
    templateId: defaultDraft.templateId,
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected answer success");
  assert.equal(result.type, "answer");
  if (result.type !== "answer") throw new Error("expected answer type");
  assert.equal(result.text, "T3_ANSWER_TEXT_4409 当前站点用于展示工业能力。");
  assert.equal(result.model, "test-intent-model");
  assert.equal(typeof result.latencyMs, "number");
  assert.equal("operations" in result, false);
});

test("requestStructuredOperations returns clarify for an underspecified request", async () => {
  nextPayload = {
    type: "clarify",
    question: "T3_CLARIFY_Q_4409 你想先改首屏、配色还是某一段文案？",
    options: ["T3_CLARIFY_OPT_4409 首屏", "配色"],
  };
  const result = await requestStructuredOperations({
    message: "T3_CLARIFY_USER_4409 把网站改好看点",
    draft: defaultDraft,
    templateId: defaultDraft.templateId,
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected clarify success");
  assert.equal(result.type, "clarify");
  if (result.type !== "clarify") throw new Error("expected clarify type");
  assert.equal(result.question, "T3_CLARIFY_Q_4409 你想先改首屏、配色还是某一段文案？");
  assert.deepEqual(result.options, ["T3_CLARIFY_OPT_4409 首屏", "配色"]);
  assert.equal("operations" in result, false);
});

test("requestStructuredOperations returns filtered edit operations", async () => {
  nextPayload = {
    type: "edit",
    summary: "T3_EDIT_SUMMARY_4409 更新中文首屏标题",
    operations: [{
      op: "set_text",
      target: "hero.title",
      locale: "zh",
      value: "T3_EDIT_TITLE_4409",
    }],
  };
  const result = await requestStructuredOperations({
    message: "T3_EDIT_USER_4409 把首屏中文标题改成指定句子",
    draft: defaultDraft,
    templateId: defaultDraft.templateId,
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected edit success");
  assert.equal(result.type, "edit");
  if (result.type !== "edit") throw new Error("expected edit type");
  assert.equal(result.summary, "T3_EDIT_SUMMARY_4409 更新中文首屏标题");
  assert.equal(result.operations.length, 1);
  assert.equal(result.operations[0].op, "set_text");
  if (result.operations[0].op !== "set_text") throw new Error("expected set_text");
  assert.equal(result.operations[0].value, "T3_EDIT_TITLE_4409");
  assert.deepEqual(result.rejected, []);
});

test("requestStructuredOperations rejects answer payloads that also include operations", async () => {
  nextPayload = {
    type: "answer",
    text: "T3_ANSWER_WITH_OPS_4409",
    operations: [{
      op: "set_text",
      target: "hero.title",
      locale: "zh",
      value: "should-not-apply",
    }],
  };
  const result = await requestStructuredOperations({
    message: "这个网站叫什么？",
    draft: defaultDraft,
    templateId: defaultDraft.templateId,
  });
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("expected invalid_output");
  assert.equal(result.code, "invalid_output");
});

function shrinkDraft(seed: SiteDraft): SiteDraft {
  const draft = structuredClone(seed);
  draft.siteName = "T4_SMALL_SITE_9183";
  draft.companyName = "T4_SMALL_CO_9183";
  draft.industry = "i";
  draft.goal = "g";
  draft.lastChange = "x";
  draft.products = [];
  draft.content.features.items = [];
  draft.content.services.items = [];
  draft.content.hero.title = { zh: "h", en: "h" };
  draft.content.hero.subtitle = { zh: "s", en: "s" };
  draft.content.hero.cta = { zh: "c", en: "c" };
  draft.content.about.title = { zh: "a", en: "a" };
  draft.content.about.body = { zh: "T4_SMALL_ABOUT_BODY_9183", en: "b" };
  draft.content.features.title = { zh: "f", en: "f" };
  draft.content.features.intro = { zh: "fi", en: "fi" };
  draft.content.services.title = { zh: "sv", en: "sv" };
  draft.content.services.intro = { zh: "si", en: "si" };
  draft.content.products.title = { zh: "p", en: "p" };
  draft.content.products.intro = { zh: "pi", en: "pi" };
  draft.content.contact.title = { zh: "ct", en: "ct" };
  draft.content.contact.body = { zh: "cb", en: "cb" };
  draft.content.contact.email = "e";
  draft.content.contact.phone = "n";
  draft.content.contact.address = { zh: "ad", en: "ad" };
  return draft;
}

function largeDraft(seed: SiteDraft): SiteDraft {
  const draft = structuredClone(seed);
  draft.siteName = "T4_LARGE_SITE_9183";
  draft.companyName = "T4_LARGE_CO_9183";
  draft.content.hero.subtitle = { zh: "T4_HERO_FULL_SENTINEL_9183", en: "hero-en" };
  draft.content.services.items[1].body.zh = "T4_SERVICES_FULL_SENTINEL_9183";
  draft.content.about.body = {
    zh: `T4_ABOUT_LONG_SENTINEL_9183${"Z".repeat(2400)}`,
    en: "about-en",
  };
  draft.products = [{
    sku: "T4-SKU-9183",
    name: { zh: "T4_PRODUCT_NAME_9183", en: "Large Product" },
    summary: { zh: "T4_PRODUCT_SUMMARY_SENTINEL_9183", en: "hidden summary" },
    category: "test",
    status: "published",
    imageColor: "#ffffff",
  }];
  return draft;
}

test("large draft prompt keeps metadata, selected section, and sku/name without unrelated sentinels", async () => {
  const draft = largeDraft(defaultDraft);
  assert.equal(JSON.stringify(draft).includes("T4_ABOUT_LONG_SENTINEL_9183"), true);
  assert.equal(JSON.stringify(draft).includes("T4_PRODUCT_SUMMARY_SENTINEL_9183"), true);
  nextPayload = { type: "answer", text: "T4_PROMPT_ACK_9183" };
  const result = await requestStructuredOperations({
    message: "T4_PROMPT_USER_9183 当前首屏副标题是什么？",
    draft,
    templateId: draft.templateId,
    selectedTarget: "hero.title",
  });
  assert.equal(result.ok, true);
  const userPrompt = userPromptFromLastRequest();
  assert.match(userPrompt, /T4_LARGE_SITE_9183/);
  assert.match(userPrompt, /T4_LARGE_CO_9183/);
  assert.match(userPrompt, /T4_HERO_FULL_SENTINEL_9183/);
  assert.match(userPrompt, /T4-SKU-9183/);
  assert.match(userPrompt, /T4_PRODUCT_NAME_9183/);
  assert.equal(userPrompt.includes("T4_ABOUT_LONG_SENTINEL_9183"), false);
  assert.equal(userPrompt.includes("T4_PRODUCT_SUMMARY_SENTINEL_9183"), false);
  assert.equal(userPrompt.includes("T4_SERVICES_FULL_SENTINEL_9183"), false);

  nextPayload = { type: "answer", text: "T4_PROMPT_ACK_SERVICES_9183" };
  const servicesResult = await requestStructuredOperations({
    message: "T4_PROMPT_USER_SERVICES_9183 第二项服务写了什么？",
    draft,
    templateId: draft.templateId,
    selectedTarget: "services.items.1.title",
  });
  assert.equal(servicesResult.ok, true);
  const servicesPrompt = userPromptFromLastRequest();
  assert.match(servicesPrompt, /T4_LARGE_SITE_9183/);
  assert.match(servicesPrompt, /T4_SERVICES_FULL_SENTINEL_9183/);
  assert.match(servicesPrompt, /T4-SKU-9183/);
  assert.equal(servicesPrompt.includes("T4_HERO_FULL_SENTINEL_9183"), false);
  assert.equal(servicesPrompt.includes("T4_ABOUT_LONG_SENTINEL_9183"), false);
  assert.equal(servicesPrompt.includes("T4_PRODUCT_SUMMARY_SENTINEL_9183"), false);
});

test("unresolved selectedTarget keeps overview and catalog without unrelated section bodies", async () => {
  const draft = largeDraft(defaultDraft);
  nextPayload = { type: "answer", text: "T4_PROMPT_ACK_UNKNOWN_9183" };
  const result = await requestStructuredOperations({
    message: "T4_PROMPT_USER_UNKNOWN_9183 网站叫什么？",
    draft,
    templateId: draft.templateId,
    selectedTarget: "siteName",
  });
  assert.equal(result.ok, true);
  const userPrompt = userPromptFromLastRequest();
  assert.match(userPrompt, /T4_LARGE_SITE_9183/);
  assert.match(userPrompt, /T4-SKU-9183/);
  assert.equal(userPrompt.includes("T4_HERO_FULL_SENTINEL_9183"), false);
  assert.equal(userPrompt.includes("T4_SERVICES_FULL_SENTINEL_9183"), false);
  assert.equal(userPrompt.includes("T4_ABOUT_LONG_SENTINEL_9183"), false);
  assert.equal(userPrompt.includes("T4_PRODUCT_SUMMARY_SENTINEL_9183"), false);
});

test("small draft prompt may inject the full document including all section bodies", async () => {
  const draft = shrinkDraft(defaultDraft);
  assert.equal(JSON.stringify(draft).length < 2000, true);
  nextPayload = { type: "answer", text: "T4_SMALL_ACK_9183" };
  const result = await requestStructuredOperations({
    message: "T4_SMALL_USER_9183 关于我们写了什么？",
    draft,
    templateId: draft.templateId,
  });
  assert.equal(result.ok, true);
  const userPrompt = userPromptFromLastRequest();
  assert.match(userPrompt, /T4_SMALL_SITE_9183/);
  assert.match(userPrompt, /T4_SMALL_ABOUT_BODY_9183/);
  assert.match(userPrompt, /schemaVersion/);
});
