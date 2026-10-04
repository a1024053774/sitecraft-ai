import assert from "node:assert/strict";
import { existsSync } from "node:fs";
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
//
// T-061 (2026-09-30): deepseek-flash thinks by default and its reasoning tokens count against
// max_tokens (a real 8192-token answer was 8192 reasoning tokens and no content). Measured without a
// cap, whole-site generation used 13.7K–22.7K completion tokens (11.2K–18.7K of them reasoning) in
// 57–95 s, and alignment planning 2.6K–3.2K in 13–16 s (artifacts/t061/probe-budget.jsonl). Thinking
// stays on (quality); the budgets and timeouts fit the measurements, and an answer that still hits
// the cap is reported as cut off instead of being retried. The acceptance runs then cut off one
// molding generation at 32768 (32761 tokens, 31191 of them reasoning, 136 s); the owner chose success
// rate over cost and wait at this stage, so the floor is 65536 and an attempt may run 300 s.

const env = process.env as Record<string, string | undefined>;
delete env.DEEPSEEK_MAX_TOKENS;
env.DEEPSEEK_API_KEY = "sk-test-budget-not-real";
env.DEEPSEEK_MODEL = "test-budget-model";
env.DEEPSEEK_BASE_URL = "https://budget-stub.test.invalid";

const { requestStructuredOperations } = await import("../lib/ai-provider.ts");
const { defaultDraft } = await import("../lib/site-document.ts");

const plannerRecommendation = {
  styleId: "engineering-industrial",
  styleReason: "结构化测试资料包含参数和加工能力。",
  colorSetId: "colorSet:warm-orange",
  colorSetReason: "结构化测试资料适合工程暖橙。",
};
function withPlannerRecommendation(reply: Record<string, unknown>) {
  return reply.kind === "question" || reply.kind === "ready" ? { ...reply, recommendation: plannerRecommendation } : reply;
}

test("structured generation asks for a 65536-token budget by default and leaves thinking at its default", async () => {
  assert.equal(await requestedMaxTokens(undefined), 65536);
  assert.equal(lastBody.thinking, undefined, "thinking mode is not switched off");
  assert.equal(lastBody.reasoning_effort, undefined, "the reasoning effort is not lowered");
});

test("a lower configured budget is raised to 65536, a higher one is kept", async () => {
  assert.equal(await requestedMaxTokens("32768"), 65536);
  assert.equal(await requestedMaxTokens("100000"), 100000);
});

let lastBody: Record<string, unknown> = {};
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
  lastBody = body;
  return body.max_tokens;
}

// The per-attempt timeouts, read from the AbortSignal.timeout calls the provider makes.
async function attemptTimeouts(reply: Record<string, unknown>, call: () => Promise<unknown>) {
  const seen: number[] = [];
  const originalTimeout = AbortSignal.timeout;
  const original = globalThis.fetch;
  AbortSignal.timeout = (ms: number) => { seen.push(ms); return originalTimeout.call(AbortSignal, ms); };
  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(reply) } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  try {
    await call();
  } finally {
    AbortSignal.timeout = originalTimeout;
    globalThis.fetch = original;
  }
  return seen;
}

test("a structured-generation attempt may run up to 300 s and a planning attempt up to 90 s", async () => {
  const { requestAlignmentPlan } = await import("../lib/ai-provider.ts");
  assert.deepEqual(await attemptTimeouts({ type: "answer", text: "这是工程工业样子的站点。" }, () => requestStructuredOperations({ message: "这个网站是做什么的？", draft: structuredClone(defaultDraft), templateId: defaultDraft.templateId, selectedTarget: null })), [300_000]);
  assert.deepEqual(await attemptTimeouts(withPlannerRecommendation({ kind: "ready", summary: "资料足够。" }), () => requestAlignmentPlan({ message: "我们做重载减速机，想做官网", draft: structuredClone(defaultDraft), conversationContext: "", alignmentContext: "" })), [90_000]);
});

// T-061 rework (Astra, review of 23807c8): a retry after a failed first answer (not JSON, wrong shape,
// HTTP 5xx) only gets what is left of the call's total: 360 s for generation, 150 s for planning. The
// clock is moved forward while the first attempt runs; the second attempt's AbortSignal.timeout gets
// the rest, and there is no second request when nothing is left.
async function timedAttempts(firstAttemptMs: number, answers: [unknown, unknown], call: () => Promise<{ ok: boolean; code?: string }>) {
  const seen: number[] = [];
  const realNow = Date.now;
  let skew = 0;
  Date.now = () => realNow.call(Date) + skew;
  const originalTimeout = AbortSignal.timeout;
  AbortSignal.timeout = (ms: number) => { seen.push(ms); return originalTimeout.call(AbortSignal, ms); };
  const original = globalThis.fetch;
  const originalWarn = console.warn;
  console.warn = () => {};
  let sent = 0;
  globalThis.fetch = async () => {
    sent += 1;
    if (sent === 1) skew += firstAttemptMs;
    const content = JSON.stringify(withPlannerRecommendation(answers[sent === 1 ? 0 : 1] as Record<string, unknown>));
    return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const result = await call();
    return { seen, sent, result };
  } finally {
    Date.now = realNow;
    AbortSignal.timeout = originalTimeout;
    globalThis.fetch = original;
    console.warn = originalWarn;
  }
}

test("a structured retry only gets what is left of 360 s, and there is none when nothing is left", async () => {
  const wrongShape = { type: "edit", summary: "按资料生成", operations: "not a list" };
  const answer = { type: "answer", text: "这是工程工业样子的站点。" };
  const generate = () => requestStructuredOperations({ message: "请根据资料生成网站", draft: structuredClone(defaultDraft), templateId: defaultDraft.templateId, selectedTarget: null });
  const retried = await timedAttempts(250_000, [wrongShape, answer], generate);
  assert.equal(retried.sent, 2);
  assert.equal(retried.result.ok, true);
  assert.equal(retried.seen[0], 300_000);
  assert.ok(retried.seen[1] <= 110_000 && retried.seen[1] >= 109_000, `second attempt timeout ${retried.seen[1]}`);
  const spent = await timedAttempts(360_000, [wrongShape, answer], generate);
  assert.equal(spent.sent, 1, "no second request once 360 s are used");
  assert.deepEqual(spent.seen, [300_000]);
  assert.equal(spent.result.ok, false);
  assert.equal(spent.result.code, "invalid_output", "the first attempt's failure is what the user is told");
});

test("a planning retry only gets what is left of 150 s, and there is none when nothing is left", async () => {
  const { requestAlignmentPlan } = await import("../lib/ai-provider.ts");
  const wrongShape = { kind: "question" };
  const ready = withPlannerRecommendation({ kind: "ready", summary: "资料足够。" });
  const plan = () => requestAlignmentPlan({ message: "我们做重载减速机，想做官网", draft: structuredClone(defaultDraft), conversationContext: "", alignmentContext: "" });
  const retried = await timedAttempts(80_000, [wrongShape, ready], plan);
  assert.equal(retried.sent, 2);
  assert.equal(retried.result.ok, true);
  assert.equal(retried.seen[0], 90_000);
  assert.ok(retried.seen[1] <= 70_000 && retried.seen[1] >= 69_000, `second attempt timeout ${retried.seen[1]}`);
  const spent = await timedAttempts(150_000, [wrongShape, ready], plan);
  assert.equal(spent.sent, 1, "no second request once 150 s are used");
  assert.deepEqual(spent.seen, [90_000]);
  assert.equal(spent.result.ok, false);
  assert.equal(spent.result.code, "invalid_output");
});

// An answer that still hits the cap is not retried (the same budget would most likely be spent the
// same way, and the user would wait twice as long): the call reports that it was cut off.
test("an answer cut off at the token budget is reported as truncated after one attempt", async () => {
  const { requestAlignmentPlan } = await import("../lib/ai-provider.ts");
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: "" } }], usage: { completion_tokens: 32768, completion_tokens_details: { reasoning_tokens: 32768 } } }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const generated = await requestStructuredOperations({ message: "请根据资料生成网站", draft: structuredClone(defaultDraft), templateId: defaultDraft.templateId, selectedTarget: null });
    assert.equal(requests, 1, "generation is not retried after a cut-off answer");
    assert.equal(generated.ok, false);
    if (generated.ok) return;
    assert.equal(generated.code, "truncated");
    assert.match(generated.error, /截断/);
    requests = 0;
    const planned = await requestAlignmentPlan({ message: "我们做重载减速机，想做官网", draft: structuredClone(defaultDraft), conversationContext: "", alignmentContext: "" });
    assert.equal(requests, 1, "planning is not retried after a cut-off answer");
    assert.equal(planned.ok, false);
    if (planned.ok) return;
    assert.equal(planned.code, "truncated");
    assert.match(planned.error, /截断/);
  } finally {
    globalThis.fetch = original;
    console.warn = originalWarn;
  }
});

// The alignment planner hit its 1800-token cap in 2 of 6 real runs (2026-09-28), which surfaced as
// "需求对齐规划没有返回可用的问题卡". It now returns bounded look and color recommendations,
// while the server still builds the actual card from its catalog.
test("the alignment planner has room for look and color recommendations", async () => {
  const { requestAlignmentPlan } = await import("../lib/ai-provider.ts");
  let body: { max_tokens?: number; messages?: Array<{ role: string; content: string }> } = {};
  const original = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    body = JSON.parse(String(init?.body ?? "{}"));
    const content = JSON.stringify(withPlannerRecommendation({ kind: "ready", summary: "资料足够。" }));
    return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    await requestAlignmentPlan({ message: "我们做重载减速机，想做官网", draft: structuredClone(defaultDraft), conversationContext: "", alignmentContext: "" });
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(body.max_tokens, 8192);
  const system = body.messages?.find((message) => message.role === "system")?.content ?? "";
  assert.match(system, /field=colorSet/);
  assert.match(system, /业务形态/);
  assert.match(system, /colorSet:turquoise/);
});

// The export pack's planner reply failed Schema in 1 of 4 real runs: "summary: Too big: expected
// string to have <=400 characters". Over-long prose is clipped, not treated as a broken card.
test("an over-long planner summary or option description is clipped instead of failing", async () => {
  const { requestAlignmentPlan } = await import("../lib/ai-provider.ts");
  const replies = [
    withPlannerRecommendation({ kind: "ready", summary: "资料完整。".repeat(150) }),
    withPlannerRecommendation({ kind: "question", questions: [{ field: "pages", question: "页面重点怎么排？", allowOther: true, options: [
      { label: "产品分类 + 询盘", description: "方便经销商按系列筛选。".repeat(30), recommended: true },
      { label: "只要首页", description: "路径最短。" },
    ] }] }),
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
// ("operations.15.value.items.0.body: expected object, received undefined"). The parser must keep
// the original shape and let the existing invalid-output retry/failure path handle it.
test("catalog items the model sends without a body remain an invalid structured response", async () => {
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
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const result = await requestStructuredOperations({ message: "应用行业：液压系统；船舶（船用液压管路）", draft: structuredClone(defaultDraft), templateId: defaultDraft.templateId, selectedTarget: null });
    assert.equal(calls, 2, "the existing one retry remains in place");
    assert.equal(result.ok, false, JSON.stringify(result).slice(0, 300));
    if (result.ok) throw new Error("expected invalid structured output");
    assert.equal(result.code, "invalid_output");
    assert.match(result.error, /items\.0\.body/);
  } finally {
    globalThis.fetch = original;
  }
});
