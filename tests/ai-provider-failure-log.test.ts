import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { defaultDraft, type SiteDraft } from "../lib/site-document.ts";

// T-058: when a DeepSeek call fails, the server writes one line per failed attempt: which call,
// which attempt, the failure category (timeout / http / network / parse / schema, and truncated when
// the answer hit max_tokens), the HTTP status, how long the attempt took and the upstream trace id.
// The line never carries the API key, the company materials, the prompt, the model's text or the
// upstream error message (which can echo the request). What the user sees does not change.

const API_KEY = "sk-test-failure-log-SECRET-7Q2";
const SENTINEL = "SENTINEL-7Q2";
const MATERIALS = `模拟资料：忻州重载减速机P3I，直角减速机 i=25–100，${SENTINEL}`;
const envKeys = ["DEEPSEEK_API_KEY", "DEEPSEEK_MODEL", "DEEPSEEK_BASE_URL", "DEEPSEEK_MAX_TOKENS", "AI_API_KEY", "AI_MODEL", "AI_BASE_URL"] as const;
const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const writeEnv = (key: string, value: string | undefined) => {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env[key];
  else env[key] = value;
};
writeEnv("DEEPSEEK_API_KEY", API_KEY);
writeEnv("DEEPSEEK_MODEL", "test-failure-log-model");
writeEnv("DEEPSEEK_BASE_URL", "https://failure-log-stub.test.invalid");
for (const key of ["DEEPSEEK_MAX_TOKENS", "AI_API_KEY", "AI_MODEL", "AI_BASE_URL"]) writeEnv(key, undefined);

type Step = () => Response | Promise<Response>;
let steps: Step[] = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith("https://failure-log-stub.test.invalid/")) throw new Error(`refusing unexpected fetch ${url}`);
  const step = steps.shift();
  if (!step) throw new Error("no stubbed response left");
  return step();
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const abs = path.join(process.cwd(), specifier.slice(2));
    const file = existsSync(`${abs}.ts`) ? `${abs}.ts` : abs;
    return nextResolve(pathToFileURL(file).href, context);
  },
});
const { requestStructuredOperations, requestAlignmentPlan } = await import("../lib/ai-provider.ts");

const PREFIX = "[sitecraft] DeepSeek call failed ";
let lines: string[] = [];
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => { lines.push(args.map(String).join(" ")); };
test.after(() => {
  globalThis.fetch = originalFetch;
  console.warn = originalWarn;
  for (const key of envKeys) writeEnv(key, previousEnv[key]);
});

const draft: SiteDraft = { ...structuredClone(defaultDraft), companyName: `忻州重载减速机P3I ${SENTINEL}` };
const json = (body: unknown, init: { status?: number; trace?: string } = {}) => new Response(JSON.stringify(body), {
  status: init.status ?? 200,
  headers: { "Content-Type": "application/json", ...(init.trace ? { "x-ds-trace-id": init.trace } : {}) },
});
const answer = (content: string, extra: Record<string, unknown> = {}, trace?: string) =>
  json({ id: "cmpl-1", choices: [{ finish_reason: "stop", message: { content } }], ...extra }, { trace });
const edit = JSON.stringify({ type: "edit", summary: "更新首屏标题", operations: [{ op: "set_text", target: "hero.title", value: { zh: "重载减速机", en: "Heavy-duty gearboxes" } }] });

async function run(queue: Step[], call: "structured" | "plan" = "structured") {
  steps = queue;
  lines = [];
  const result = call === "plan"
    ? await requestAlignmentPlan({ message: MATERIALS, draft })
    : await requestStructuredOperations({ message: `${MATERIALS}\n请根据资料生成网站`, draft, templateId: "screwfast" });
  assert.equal(steps.length, 0, "every stubbed response was used");
  for (const line of lines) {
    assert.ok(line.startsWith(PREFIX), line);
    for (const secret of [API_KEY, SENTINEL, "忻州", "你是企业独立站", "你是 SiteCraft", "echo"]) assert.ok(!line.includes(secret), `the log line leaks "${secret}": ${line}`);
  }
  return { result, logged: lines.map((line) => JSON.parse(line.slice(PREFIX.length)) as Record<string, unknown>) };
}

test("an HTTP error is logged per attempt with its status and trace id, not the upstream message", async () => {
  const upstream = () => json({ error: { message: `echo ${MATERIALS}` } }, { status: 503, trace: "trace-503" });
  const { result, logged } = await run([upstream, upstream]);
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("expected a failure");
  assert.equal(result.code, "provider_error", "the user-facing code does not change");
  assert.deepEqual(logged.map(({ call, attempt, of, category, status, traceId }) => ({ call, attempt, of, category, status, traceId })), [
    { call: "structured_operations", attempt: 1, of: 2, category: "http", status: 503, traceId: "trace-503" },
    { call: "structured_operations", attempt: 2, of: 2, category: "http", status: 503, traceId: "trace-503" },
  ]);
  for (const line of logged) assert.equal(typeof line.ms, "number");

  const refused = await run([() => json({ error: { message: `echo ${MATERIALS}` } }, { status: 401 })]);
  assert.deepEqual(refused.logged.map(({ attempt, category, status }) => ({ attempt, category, status })), [{ attempt: 1, category: "http", status: 401 }], "a 4xx is not retried, and is logged once");
});

test("a network failure is logged with its cause code", async () => {
  const drop = () => { throw new TypeError("fetch failed", { cause: Object.assign(new Error(`socket closed ${SENTINEL}`), { code: "ECONNRESET" }) }); };
  const { result, logged } = await run([drop, drop]);
  assert.equal(!result.ok && result.code, "provider_error");
  assert.deepEqual(logged.map(({ attempt, category, status, cause }) => ({ attempt, category, status, cause })), [
    { attempt: 1, category: "network", status: null, cause: "ECONNRESET" },
    { attempt: 2, category: "network", status: null, cause: "ECONNRESET" },
  ]);
});

test("a timeout is logged once (it is not retried)", async () => {
  const { result, logged } = await run([() => { throw new DOMException("The operation was aborted due to timeout", "TimeoutError"); }]);
  assert.equal(!result.ok && result.code, "timeout");
  assert.deepEqual(logged.map(({ attempt, category, status }) => ({ attempt, category, status })), [{ attempt: 1, category: "timeout", status: null }]);
});

test("a body or an answer that is not JSON is logged as parse", async () => {
  const gateway = () => new Response(`<html>bad gateway ${SENTINEL}</html>`, { status: 200, headers: { "Content-Type": "text/html", "x-ds-trace-id": "trace-html" } });
  const body = await run([gateway, gateway]);
  assert.equal(!body.result.ok && body.result.code, "provider_error");
  assert.deepEqual(body.logged.map(({ attempt, category, status, traceId }) => ({ attempt, category, status, traceId })), [
    { attempt: 1, category: "parse", status: 200, traceId: "trace-html" },
    { attempt: 2, category: "parse", status: 200, traceId: "trace-html" },
  ]);
  const content = await run([() => answer(`not json { ${MATERIALS}`), () => answer(`still not json ${MATERIALS}`)]);
  assert.equal(!content.result.ok && content.result.code, "invalid_output");
  assert.deepEqual(content.logged.map(({ attempt, category, finish }) => ({ attempt, category, finish })), [
    { attempt: 1, category: "parse", finish: "stop" },
    { attempt: 2, category: "parse", finish: "stop" },
  ]);
  assert.ok([...body.logged, ...content.logged].every((line) => !("fields" in line)), "an answer that is not JSON has no fields to name");
});

test("an answer that fails the schema is logged as schema with the fields it got wrong, not their values", async () => {
  const bad = () => answer(JSON.stringify({ type: "edit", summary: MATERIALS, operations: `bad ${SENTINEL}` }));
  const { result, logged } = await run([bad, bad]);
  assert.equal(!result.ok && result.code, "invalid_output");
  assert.deepEqual(logged.map(({ attempt, category, fields }) => ({ attempt, category, fields })), [
    { attempt: 1, category: "schema", fields: ["operations:invalid_type"] },
    { attempt: 2, category: "schema", fields: ["operations:invalid_type"] },
  ]);
  const op = { op: "set_text", target: "hero.title", value: { zh: `${SENTINEL} 标题`, en: "Title" } };
  const tooMany = () => answer(JSON.stringify({ type: "edit", summary: "按资料生成", operations: Array.from({ length: 25 }, () => op) }));
  const missing = () => answer(JSON.stringify({ type: "edit", summary: "按资料生成", operations: [{ ...op, value: { zh: `${SENTINEL} 标题` } }] }));
  const second = await run([tooMany, missing]);
  assert.deepEqual(second.logged.map(({ attempt, fields }) => ({ attempt, fields })), [
    { attempt: 1, fields: ["operations:too_big"] },
    { attempt: 2, fields: ["operations.0.value:invalid_union"] },
  ]);
});

test("an answer cut off at max_tokens is logged as truncated, with the token usage", async () => {
  const usage = { prompt_tokens: 5291, completion_tokens: 32768, completion_tokens_details: { reasoning_tokens: 32768 } };
  const cut = () => json({ id: "cmpl-2", choices: [{ finish_reason: "length", message: { content: `{"type":"edit","summary":"${SENTINEL}` } }], usage }, { trace: "trace-cut" });
  const { result, logged } = await run([cut]);
  assert.equal(!result.ok && result.code, "truncated", "a cut-off answer is not retried (T-061)");
  assert.deepEqual(logged, [{
    call: "structured_operations", attempt: 1, of: 2, category: "truncated", status: 200, ms: logged[0]?.ms, traceId: "trace-cut",
    finish: "length", tokens: { prompt: 5291, completion: 32768, reasoning: 32768 },
  }]);
});

test("a failed attempt followed by a good one logs only the failure; a good call logs nothing", async () => {
  const once = await run([() => json({ error: { message: "busy" } }, { status: 429 }), () => answer(edit)]);
  assert.equal(once.result.ok, true);
  assert.deepEqual(once.logged.map(({ attempt, category, status }) => ({ attempt, category, status })), [{ attempt: 1, category: "http", status: 429 }]);
  const clean = await run([() => answer(edit)]);
  assert.equal(clean.result.ok, true);
  assert.deepEqual(clean.logged, []);
});

test("the alignment planning call logs its failures the same way", async () => {
  const bad = () => answer(JSON.stringify({ kind: "question", questions: `bad ${SENTINEL}` }), {}, "trace-plan");
  const { result, logged } = await run([bad, () => { throw new DOMException("timeout", "TimeoutError"); }], "plan");
  assert.equal(result.ok, false);
  assert.deepEqual(logged.map(({ call, attempt, category, traceId, fields }) => ({ call, attempt, category, traceId, fields })), [
    { call: "alignment_plan", attempt: 1, category: "schema", traceId: "trace-plan", fields: ["questions:invalid_type", "questions:too_big"] },
    { call: "alignment_plan", attempt: 2, category: "timeout", traceId: null, fields: undefined },
  ]);
  const usage = { prompt_tokens: 2445, completion_tokens: 8192, completion_tokens_details: { reasoning_tokens: 8192 } };
  const cut = await run([() => json({ choices: [{ finish_reason: "length", message: { content: "" } }], usage }, { trace: "trace-plan-cut" })], "plan");
  assert.equal(!cut.result.ok && cut.result.code, "truncated");
  assert.deepEqual(cut.logged.map(({ call, attempt, category, traceId, tokens }) => ({ call, attempt, category, traceId, tokens })), [
    { call: "alignment_plan", attempt: 1, category: "truncated", traceId: "trace-plan-cut", tokens: { prompt: 2445, completion: 8192, reasoning: 8192 } },
  ]);
});
