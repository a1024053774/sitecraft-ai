import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const env = process.env as Record<string, string | undefined>;
env.NODE_ENV = "test";
delete env.SITE_STORE;
env.DEEPSEEK_API_KEY = "sk-test-t072-not-real";
env.DEEPSEEK_MODEL = "test-t072-model";
env.DEEPSEEK_BASE_URL = "https://t072-stub.test.invalid";
delete env.AI_API_KEY;
delete env.AI_MODEL;
delete env.AI_BASE_URL;

const originalFetch = globalThis.fetch;
let lastPlannerSystemPrompt = "";
let plannerPayload: Record<string, unknown> = {
  kind: "question",
  recommendation: {
    styleId: "export-catalog",
    styleReason: "两个产品系列和 OEM 出口目录决定先按型号筛选。",
    colorSetId: "colorSet:turquoise",
    colorSetReason: "洁净流体和不锈钢接头适合冷静的松石强调。",
  },
  questions: [
    { field: "style", question: "选择网站的样子", options: [
      { id: "export-catalog", label: "蓝白目录", description: "资料里有两个产品系列，且目标是给 OEM 索取样品册。", recommended: true },
      { id: "engineering-industrial", label: "工程工业", description: "" },
      { id: "industrial", label: "明亮产品", description: "" },
      { id: "technical-product", label: "灰底短路径", description: "" },
    ], allowOther: true },
    { field: "colorSet", question: "选择配色", options: [
      { id: "colorSet:turquoise", label: "松石", description: "资料里的洁净流体和不锈钢产品适合冷静的松石强调。", recommended: true },
      { id: "colorSet:porcelain", label: "青花瓷", description: "" },
      { id: "colorSet:graphite", label: "石墨工坊", description: "" },
      { id: "colorSet:warm-orange", label: "工程暖橙", description: "" },
    ], allowOther: true },
  ],
};

globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith("https://t072-stub.test.invalid/")) throw new Error(`refusing unexpected fetch ${url}`);
  const raw = typeof init?.body === "string" ? init.body : "";
  if (raw.includes("需求对齐规划器")) {
    const parsed = JSON.parse(raw) as { messages?: Array<{ role?: string; content?: string }> };
    lastPlannerSystemPrompt = parsed.messages?.find((message) => message.role === "system")?.content ?? "";
  }
  return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(plannerPayload) } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const abs = path.join(process.cwd(), specifier.slice(2));
    const file = existsSync(`${abs}.ts`) ? `${abs}.ts` : abs;
    return nextResolve(pathToFileURL(file).href, context);
  },
});

const { POST } = await import(pathToFileURL(path.join(process.cwd(), "app/api/sites/[siteId]/chat/route.ts")).href) as {
  POST: (request: Request, context: { params: Promise<{ siteId: string }> }) => Promise<Response>;
};
const { createSite } = await import("../lib/site-store.ts");

const created: string[] = [];
function newSiteId() {
  const id = `t072-${crypto.randomUUID()}`;
  created.push(id);
  return id;
}

async function postStart(siteId: string, message: string) {
  const before = await createSite(siteId);
  const response = await POST(new Request(`http://sitecraft.test/api/sites/${siteId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "start", message, baseRevision: before.draft.revision }),
  }), { params: Promise.resolve({ siteId }) });
  const text = await response.text();
  const events = text.split("\n\n").map((chunk) => chunk.trim()).filter((line) => line.startsWith("data:"))
    .map((line) => JSON.parse(line.slice(5).trim()) as Record<string, unknown>);
  return { response, done: events.find((event) => event.type === "done") as Record<string, any> | undefined };
}

test.after(async () => {
  globalThis.fetch = originalFetch;
  await Promise.all(created.flatMap((siteId) => [
    rm(path.join(process.cwd(), ".sitecraft-data", "sites", `${siteId}.json`), { force: true }),
    rm(path.join(process.cwd(), ".sitecraft-data", "conversations", siteId), { recursive: true, force: true }),
  ]));
});

test("planner recommendations for look and color set appear on the same catalog card", async () => {
  const started = await postStart(newSiteId(), "外高桥流体接头做出口 B2B 目录，两个系列服务洁净流体 OEM。");
  assert.equal(started.response.status, 200);
  const questions = (started.done?.questions ?? []) as Array<{
    field?: string;
    options: Array<{ id: string; description?: string; recommended?: boolean }>;
  }>;
  const style = questions.find((question) => question.field === "style");
  const color = questions.find((question) => question.field === "colorSet");
  assert.ok(style, "style question is present");
  assert.ok(color, "color-set question is present");
  assert.equal(style.options.find((option) => option.recommended)?.id, "export-catalog");
  assert.match(style.options.find((option) => option.recommended)?.description ?? "", /两个产品系列|OEM/);
  assert.equal(color.options.find((option) => option.recommended)?.id, "colorSet:turquoise");
  assert.match(color.options.find((option) => option.recommended)?.description ?? "", /洁净流体|不锈钢/);
  assert.match(lastPlannerSystemPrompt, /colorSet/);
  assert.match(lastPlannerSystemPrompt, /业务形态|产品系列|出口|资料厚薄/);
});

test("an invalid or empty planner recommendation is rejected by the planner schema", async () => {
  plannerPayload = {
    kind: "question",
    recommendation: {
      styleId: "export-catalog",
      styleReason: "目录资料。",
      colorSetId: "colorSet:invented",
      colorSetReason: "不应显示",
    },
    questions: [{ field: "colorSet", question: "选择配色", options: [
      { id: "colorSet:invented", label: "不存在", description: "不应显示", recommended: true },
      { id: "colorSet:graphite", label: "石墨工坊", description: "" },
    ], allowOther: true }],
  };
  const invalid = await postStart(newSiteId(), "参数表为主的重载设备资料。");
  assert.equal(invalid.response.status, 502);
  assert.equal(invalid.done, undefined);

  plannerPayload = {
    kind: "question",
    recommendation: {
      styleId: "export-catalog",
      styleReason: "目录资料。",
      colorSetId: "colorSet:graphite",
      colorSetReason: "   ",
    },
    questions: [{ field: "colorSet", question: "选择配色", options: [
      { id: "colorSet:graphite", label: "石墨工坊", description: "   ", recommended: true },
      { id: "colorSet:porcelain", label: "青花瓷", description: "" },
    ], allowOther: true }],
  };
  const empty = await postStart(newSiteId(), "只有少量资料的工厂网站。");
  assert.equal(empty.response.status, 502);
  assert.equal(empty.done, undefined);
});
