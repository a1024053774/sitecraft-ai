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
env.DEEPSEEK_API_KEY = "sk-test-t072-enum-not-real";
env.DEEPSEEK_MODEL = "test-t072-enum-model";
env.DEEPSEEK_BASE_URL = "https://t072-enum.test.invalid";

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

let plannerPayload: Record<string, unknown>;
globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(plannerPayload) } }] }), {
  status: 200,
  headers: { "Content-Type": "application/json" },
});

const created: string[] = [];
function newSiteId() {
  const id = `t072-enum-${crypto.randomUUID()}`;
  created.push(id);
  return id;
}

async function start(siteId: string) {
  const before = await createSite(siteId);
  const response = await POST(new Request(`http://sitecraft.test/api/sites/${siteId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "start", message: "根据资料规划网站", baseRevision: before.draft.revision }),
  }), { params: Promise.resolve({ siteId }) });
  const text = await response.text();
  if ((response.headers.get("Content-Type") ?? "").includes("application/json")) return { response, json: JSON.parse(text) as Record<string, unknown> };
  const events = text.split("\n\n").map((chunk) => chunk.trim()).filter((line) => line.startsWith("data:"))
    .map((line) => JSON.parse(line.slice(5).trim()) as Record<string, any>);
  return { response, done: events.find((event) => event.type === "done") };
}

test.after(async () => {
  await Promise.all(created.flatMap((siteId) => [
    rm(path.join(process.cwd(), ".sitecraft-data", "sites", `${siteId}.json`), { force: true }),
    rm(path.join(process.cwd(), ".sitecraft-data", "conversations", siteId), { recursive: true, force: true }),
  ]));
});

test("ready recommendation fields reach the catalog card through the chat route", async () => {
  plannerPayload = {
    kind: "ready",
    summary: "资料足够。",
    recommendation: {
      styleId: "export-catalog",
      styleReason: "两个产品系列的参数行完整且面向 OEM 目录浏览。",
      colorSetId: "colorSet:turquoise",
      colorSetReason: "不锈钢接头服务洁净流体回路，松石强调与资料事实相符。",
    },
  };
  const started = await start(newSiteId());
  assert.equal(started.response.status, 200);
  const questions = (started.done?.questions ?? []) as Array<{ field?: string; options: Array<{ id: string; description?: string; recommended?: boolean }> }>;
  const style = questions.find((question) => question.field === "style");
  const color = questions.find((question) => question.field === "colorSet");
  assert.equal(style?.options.find((option) => option.recommended)?.id, "export-catalog");
  assert.match(style?.options.find((option) => option.recommended)?.description ?? "", /两个产品系列/);
  assert.equal(color?.options.find((option) => option.recommended)?.id, "colorSet:turquoise");
  assert.match(color?.options.find((option) => option.recommended)?.description ?? "", /洁净流体/);
});

test("a label-shaped recommendation id is rejected by the planner schema instead of guessed", async () => {
  plannerPayload = {
    kind: "ready",
    summary: "资料足够。",
    recommendation: {
      styleId: "工程工业（engineering-industrial）",
      styleReason: "模型给了标签而不是目录 id。",
      colorSetId: "石墨工坊（graphite）",
      colorSetReason: "模型给了标签而不是目录 id。",
    },
  };
  const started = await start(newSiteId());
  assert.equal(started.response.status, 502);
  assert.equal(started.json?.error, "invalid_output");
  assert.match(String(started.json?.userMessage ?? ""), /样子和色彩推荐格式不合规/);
});
