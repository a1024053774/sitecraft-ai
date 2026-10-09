import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { simulatedPacks } from "../lib/simulated-packs.ts";
import { packDraft } from "./fixtures/pack-drafts.ts";

// T-061 through the chat route: when the model's answer is cut off at its token budget, the user is
// told that this generation was cut off and nothing changed, for a chat edit, for the alignment
// planning step and for the alignment generation step, instead of "模型服务暂时不可用" or "无法安全校验".

const envKeys = ["SITE_STORE", "NODE_ENV", "DEEPSEEK_API_KEY", "DEEPSEEK_MODEL", "DEEPSEEK_BASE_URL", "DEEPSEEK_MAX_TOKENS", "AI_API_KEY", "AI_MODEL", "AI_BASE_URL"] as const;
const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const writeEnv = (key: string, value: string | undefined) => {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env[key];
  else env[key] = value;
};
writeEnv("NODE_ENV", "test");
writeEnv("SITE_STORE", undefined);
writeEnv("DEEPSEEK_API_KEY", "sk-test-chat-truncated-not-real");
writeEnv("DEEPSEEK_MODEL", "test-chat-truncated-model");
writeEnv("DEEPSEEK_BASE_URL", "https://chat-truncated-stub.test.invalid");
for (const key of ["DEEPSEEK_MAX_TOKENS", "AI_API_KEY", "AI_MODEL", "AI_BASE_URL"]) writeEnv(key, undefined);

const originalFetch = globalThis.fetch;
const stubBase = "https://chat-truncated-stub.test.invalid/";
let requests = 0;
globalThis.fetch = async (input) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith(stubBase)) throw new Error(`refusing unexpected fetch ${url}`);
  requests += 1;
  return new Response(JSON.stringify({
    choices: [{ finish_reason: "length", message: { content: "" } }],
    usage: { prompt_tokens: 6096, completion_tokens: 32768, completion_tokens_details: { reasoning_tokens: 32768 } },
  }), { status: 200, headers: { "Content-Type": "application/json" } });
};
const originalWarn = console.warn;
console.warn = () => {};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const abs = path.join(process.cwd(), specifier.slice(2));
    let file = abs;
    if (existsSync(`${abs}.ts`)) file = `${abs}.ts`;
    else if (existsSync(path.join(abs, "index.ts"))) file = path.join(abs, "index.ts");
    return nextResolve(pathToFileURL(file).href, context);
  },
});

const { POST } = await import(pathToFileURL(path.join(process.cwd(), "app/api/sites/[siteId]/chat/route.ts")).href) as {
  POST: (request: Request, context: { params: Promise<{ siteId: string }> }) => Promise<Response>;
};
const { commitOperations, createSite } = await import("../lib/site-store.ts");

const created = new Set<string>();
function uniqueSiteId() {
  const siteId = `t061chat-${crypto.randomUUID()}`;
  created.add(siteId);
  return siteId;
}

test.after(async () => {
  globalThis.fetch = originalFetch;
  console.warn = originalWarn;
  for (const key of envKeys) writeEnv(key, previousEnv[key]);
  await Promise.all([...created].flatMap((siteId) => [
    rm(path.join(process.cwd(), ".sitecraft-data", "sites", `${siteId}.json`), { force: true }),
    rm(path.join(process.cwd(), ".sitecraft-data", "conversations", siteId), { recursive: true, force: true }),
  ]));
});

async function postChat(siteId: string, body: Record<string, unknown>) {
  const response = await POST(new Request(`http://sitecraft.test/api/sites/${siteId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }), { params: Promise.resolve({ siteId }) });
  const text = await response.text();
  if ((response.headers.get("Content-Type") ?? "").includes("application/json")) return { response, done: JSON.parse(text) as Record<string, unknown> };
  const events = text.split("\n\n").map((chunk) => chunk.trim()).filter((line) => line.startsWith("data:")).map((line) => JSON.parse(line.slice(5).trim()) as Record<string, unknown>);
  return { response, done: events.findLast((event) => event.type === "done") };
}

async function generatedSite() {
  const siteId = uniqueSiteId();
  const initial = await createSite(siteId);
  const seeded = await commitOperations({
    siteId, baseRevision: initial.draft.revision, source: "manual", summary: "P3I 资料",
    operations: [{ op: "replace_draft", draft: { ...packDraft("industrial"), revision: initial.draft.revision } }],
  });
  assert.equal(seeded.status, "applied");
  return { siteId, draft: (await createSite(siteId)).draft };
}

test("a chat edit cut off at the token budget says so, once, and changes nothing", async () => {
  const { siteId, draft } = await generatedSite();
  requests = 0;
  const result = await postChat(siteId, { baseRevision: draft.revision, message: "把首屏标题改短一点" });
  assert.equal(requests, 1, "the cut-off answer is not retried");
  assert.equal(result.done?.status, "error", JSON.stringify(result.done).slice(0, 300));
  assert.equal(result.done?.code, "truncated");
  assert.equal(result.done?.error, "这次生成被截断，没有改动草稿。");
  assert.match(String(result.done?.userMessage), /^这次生成被截断，没有改动草稿。.*重试/);
  assert.equal((await createSite(siteId)).draft.revision, draft.revision);
});

test("an alignment planning answer cut off at the token budget says so", async () => {
  const siteId = uniqueSiteId();
  const before = await createSite(siteId);
  requests = 0;
  const result = await postChat(siteId, { action: "start", message: "我们做重载减速机，想做官网", baseRevision: before.draft.revision });
  assert.equal(requests, 1, "the cut-off planning answer is not retried");
  assert.equal(result.response.status, 502);
  assert.equal(result.done?.error, "truncated");
  assert.equal(result.done?.userMessage, "需求对齐规划被截断，原需求没有修改草稿，可以重试。");
  assert.equal((await createSite(siteId)).draft.revision, before.draft.revision);
});

test("an alignment generation answer cut off at the token budget says so and keeps the task", async () => {
  const siteId = uniqueSiteId();
  const before = await createSite(siteId);
  // ALIGN_ skips the planner (test fixtures drive the later stages with the stubbed provider).
  const started = await postChat(siteId, { action: "start", message: `ALIGN_TRUNCATED_6101\n${simulatedPacks.industrial.body}\n目标：展示减速机产品。`, baseRevision: before.draft.revision });
  const conversationId = String(started.done?.conversationId);
  assert.equal(started.done?.questionId, "style-theme");
  const style = await postChat(siteId, {
    action: "select", conversationId, questionId: String(started.done?.questionId),
    questionRevision: Number(started.done?.questionRevision), optionId: "engineering-industrial",
  });
  assert.equal(style.done?.questionId, "build-plan");
  requests = 0;
  const generated = await postChat(siteId, {
    action: "select", conversationId, questionId: String(style.done?.questionId),
    questionRevision: Number(style.done?.questionRevision), optionId: "no-image",
  });
  assert.equal(requests, 1, "the cut-off generation answer is not retried");
  assert.equal(generated.done?.status, "error", JSON.stringify(generated.done).slice(0, 300));
  assert.equal(generated.done?.code, "truncated");
  assert.match(String(generated.done?.userMessage), /^这次生成被截断，没有改动草稿。/);
  assert.equal((await createSite(siteId)).draft.revision, before.draft.revision);
});
