import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const abs = path.join(process.cwd(), specifier.slice(2));
    return nextResolve(pathToFileURL(existsSync(`${abs}.ts`) ? `${abs}.ts` : abs).href, context);
  },
});

// Found while verifying T-034: bilingual full-site generation from the simulated industrial pack
// (about 20 operations with {zh,en} values) was cut off at 6000 output tokens; with both attempts
// truncated the user saw "模型服务暂时不可用". The budget and the per-attempt timeout must fit it.

const env = process.env as Record<string, string | undefined>;
delete env.DEEPSEEK_MAX_TOKENS;
env.DEEPSEEK_API_KEY = "sk-test-budget-not-real";
env.DEEPSEEK_MODEL = "test-budget-model";
env.DEEPSEEK_BASE_URL = "https://budget-stub.test.invalid";

const { requestStructuredOperations } = await import("../lib/ai-provider.ts");
const { defaultDraft } = await import("../lib/site-document.ts");

test("structured generation asks for an 8192-token budget by default", async () => {
  assert.equal(await requestedMaxTokens(undefined), 8192);
});

test("a lower configured budget is raised to 8192, a higher one is kept", async () => {
  assert.equal(await requestedMaxTokens("6000"), 8192);
  assert.equal(await requestedMaxTokens("12000"), 12000);
});

async function requestedMaxTokens(configured: string | undefined) {
  if (configured === undefined) delete env.DEEPSEEK_MAX_TOKENS;
  else env.DEEPSEEK_MAX_TOKENS = configured;
  let body: Record<string, unknown> = {};
  const original = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    body = JSON.parse(String(init?.body ?? "{}"));
    const content = JSON.stringify({ type: "edit", summary: "改首屏", operations: [{ op: "set_text", target: "hero.title", locale: "zh", value: "按图加工重载减速机" }] });
    return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    await requestStructuredOperations({ message: "把首屏标题改成按图加工重载减速机", draft: structuredClone(defaultDraft), templateId: defaultDraft.templateId, selectedTarget: null });
  } finally {
    globalThis.fetch = original;
    delete env.DEEPSEEK_MAX_TOKENS;
  }
  return body.max_tokens;
}

test("each structured-generation attempt may run up to 90 s", async () => {
  const source = await readFile(new URL("../lib/ai-provider.ts", import.meta.url), "utf8");
  const start = source.indexOf("export async function requestStructuredOperations");
  const end = source.indexOf("export async function", start + 10);
  assert.match(source.slice(start, end), /AbortSignal\.timeout\(STRUCTURED_OPERATIONS_TIMEOUT_MS\)/);
  assert.match(source, /const STRUCTURED_OPERATIONS_TIMEOUT_MS = 90_000;/);
});

// The alignment planner hit its 1800-token cap in 2 of 6 real runs (2026-09-28), which surfaced as
// "需求对齐规划没有返回可用的问题卡". The server now builds the look and color questions itself.
test("the alignment planner has room for a full card and is not asked for color-set options", async () => {
  const { requestAlignmentPlan } = await import("../lib/ai-provider.ts");
  let body: { max_tokens?: number; messages?: Array<{ role: string; content: string }> } = {};
  const original = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    body = JSON.parse(String(init?.body ?? "{}"));
    const content = JSON.stringify({ kind: "ready", summary: "资料足够。" });
    return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    await requestAlignmentPlan({ message: "我们做重载减速机，想做官网", draft: structuredClone(defaultDraft), conversationContext: "", alignmentContext: "" });
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(body.max_tokens, 3000);
  const system = body.messages?.find((message) => message.role === "system")?.content ?? "";
  assert.match(system, /不要输出 colorSet 题/);
  assert.doesNotMatch(system, /swatches/);
});

// The export pack's planner reply failed Schema in 1 of 4 real runs: "summary: Too big: expected
// string to have <=400 characters". Over-long prose is clipped, not treated as a broken card.
test("an over-long planner summary or option description is clipped instead of failing", async () => {
  const { requestAlignmentPlan } = await import("../lib/ai-provider.ts");
  const replies = [
    { kind: "ready", summary: "资料完整。".repeat(150) },
    { kind: "question", questions: [{ field: "pages", question: "页面重点怎么排？", allowOther: true, options: [
      { label: "产品分类 + 询盘", description: "方便经销商按系列筛选。".repeat(30), recommended: true },
      { label: "只要首页", description: "路径最短。" },
    ] }] },
  ];
  const original = globalThis.fetch;
  try {
    for (const reply of replies) {
      globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(reply) } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
      const plan = await requestAlignmentPlan({ message: "外贸资料", draft: structuredClone(defaultDraft), conversationContext: "", alignmentContext: "" });
      assert.equal(plan.ok, true, JSON.stringify(plan).slice(0, 200));
      if (plan.ok && plan.kind === "ready") assert.ok(plan.summary.length <= 400);
      if (plan.ok && plan.kind === "question") assert.ok((plan.questions?.[0]?.options[0]?.description.length ?? 0) <= 200);
    }
  } finally {
    globalThis.fetch = original;
  }
});

// A real export-pack generation failed Schema twice because catalog items came without `body`
// ("operations.15.value.items.0.body: expected object, received undefined"). A missing title or
// body is the same as an explicit gap.
test("catalog items the model sends without a body are kept with a gap body", async () => {
  const { requestStructuredOperations } = await import("../lib/ai-provider.ts");
  const content = JSON.stringify({ type: "edit", summary: "写入应用行业", operations: [{
    op: "set_catalog_section",
    section: "industries",
    value: {
      title: { zh: "应用行业", en: "Industries" },
      intro: { zh: "待补充", en: "To be provided" },
      items: [
        { id: "hydraulic", title: { zh: "液压系统", en: "Hydraulic systems" } },
        { id: "marine", title: { zh: "船舶", en: "Marine" }, body: { zh: "船用液压管路。", en: "Marine hydraulic lines." } },
      ],
    },
  }] });
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  try {
    const result = await requestStructuredOperations({ message: "应用行业：液压系统；船舶（船用液压管路）", draft: structuredClone(defaultDraft), templateId: defaultDraft.templateId, selectedTarget: null });
    assert.equal(result.ok, true, JSON.stringify(result).slice(0, 300));
    if (!result.ok || result.type !== "edit") return;
    const op = result.operations.find((item) => item.op === "set_catalog_section") as { value: { items: Array<{ body: { zh: string; en: string } }> } } | undefined;
    assert.deepEqual(op?.value.items[0].body, { zh: "待补充", en: "To be provided" });
    assert.equal(op?.value.items[1].body.zh, "船用液压管路。");
  } finally {
    globalThis.fetch = original;
  }
});
