import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { describeUserError } from "../lib/user-errors.ts";

// T-061 rework (Astra, review of 23807c8): the two vision calls, preview review and image facts,
// follow the same rules as planning and generation. An answer cut off at max_tokens is sent once and
// returns `truncated`, and both routes show the error catalog's cut-off copy. T-058's gap on the same
// review: every failed attempt of these two calls writes the sanitized log line, and these tests fail
// if any of their logModelFailure calls is removed (HTTP, cut off, not JSON / wrong shape, thrown).

const API_KEY = "sk-test-vision-failures-SECRET-4K8";
const SENTINEL = "SENTINEL-4K8";
const envKeys = ["DEEPSEEK_API_KEY", "DEEPSEEK_MODEL", "DEEPSEEK_BASE_URL", "DEEPSEEK_MAX_TOKENS", "AI_API_KEY", "AI_MODEL", "AI_BASE_URL", "SITE_STORE"] as const;
const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const writeEnv = (key: string, value: string | undefined) => {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env[key];
  else env[key] = value;
};
writeEnv("DEEPSEEK_API_KEY", API_KEY);
writeEnv("DEEPSEEK_MODEL", "test-vision-failures-model");
writeEnv("DEEPSEEK_BASE_URL", "https://vision-failures-stub.test.invalid");
for (const key of ["DEEPSEEK_MAX_TOKENS", "AI_API_KEY", "AI_MODEL", "AI_BASE_URL", "SITE_STORE"]) writeEnv(key, undefined);

type Step = () => Response | Promise<Response>;
let steps: Step[] = [];
let requests = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith("https://vision-failures-stub.test.invalid/")) throw new Error(`refusing unexpected fetch ${url}`);
  requests += 1;
  const step = steps.shift();
  if (!step) throw new Error("no stubbed response left");
  return step();
};

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
const { requestImageFacts } = await import("../lib/ai-provider.ts");
const { deleteImagesForSite, saveSiteImage } = await import("../lib/site-images.ts");
const analyzeRoute = await import(pathToFileURL(path.join(process.cwd(), "app/api/sites/[siteId]/images/[imageId]/analyze/route.ts")).href) as {
  POST: (request: Request, context: { params: Promise<{ siteId: string; imageId: string }> }) => Promise<Response>;
};

const PREFIX = "[sitecraft] DeepSeek call failed ";
let lines: string[] = [];
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => { lines.push(args.map(String).join(" ")); };
const imageSites = new Set<string>();
test.after(async () => {
  globalThis.fetch = originalFetch;
  console.warn = originalWarn;
  for (const siteId of imageSites) await deleteImagesForSite(siteId);
  for (const key of envKeys) writeEnv(key, previousEnv[key]);
});

// A PNG header with a real size, padded past the "not a tiny synthetic image" byte floor.
function png(width: number, height: number, byteLength = 9000) {
  const bytes = Buffer.alloc(byteLength);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return new Uint8Array(bytes);
}
const screenshot = png(1440, 900);
const photo = png(800, 600);

const json = (body: unknown, init: { status?: number; trace?: string } = {}) => new Response(JSON.stringify(body), {
  status: init.status ?? 200,
  headers: { "Content-Type": "application/json", ...(init.trace ? { "x-ds-trace-id": init.trace } : {}) },
});
const answer = (content: string, trace?: string) => json({ id: "cmpl-v", model: "test-vision-failures-model", choices: [{ finish_reason: "stop", message: { content } }] }, { trace });
const cut = (trace: string) => () => json({
  choices: [{ finish_reason: "length", message: { content: `{"type":"${SENTINEL}` } }],
  usage: { prompt_tokens: 1356, completion_tokens: 800, completion_tokens_details: { reasoning_tokens: 800 } },
}, { trace });

const calls = {
  image_facts: {
    request: () => requestImageFacts({ imageBytes: photo, originalName: `gearbox-${SENTINEL}.png` }),
    good: JSON.stringify({ type: "image_facts", visibleText: [], name: { zh: "直角减速机", en: "Right-angle gearbox" }, sellingPoints: { zh: [], en: [] }, category: "减速机", alt: { zh: "直角减速机", en: "Right-angle gearbox" }, missingFacts: [] }),
    prompt: "你是产品图事实摘录助手",
  },
} as const;
type CallName = keyof typeof calls;

async function run(call: CallName, queue: Step[]) {
  steps = queue;
  lines = [];
  requests = 0;
  const result = await calls[call].request();
  assert.equal(steps.length, 0, "every stubbed response was used");
  for (const line of lines) {
    assert.ok(line.startsWith(PREFIX), line);
    for (const secret of [API_KEY, SENTINEL, calls[call].prompt, "echo", "data:image"]) assert.ok(!line.includes(secret), `the log line leaks "${secret}": ${line}`);
  }
  return { result, requests, logged: lines.map((line) => JSON.parse(line.slice(PREFIX.length)) as Record<string, unknown>) };
}
const pick = (logged: Array<Record<string, unknown>>, ...keys: string[]) => logged.map((line) => Object.fromEntries(keys.map((key) => [key, line[key]])));

for (const call of Object.keys(calls) as CallName[]) {
  test(`${call}: an answer cut off at max_tokens is sent once and returns truncated`, async () => {
    const { result, requests: sent, logged } = await run(call, [cut("trace-cut")]);
    assert.equal(sent, 1, "not retried");
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "truncated");
    assert.match(result.error, /截断/);
    assert.deepEqual(logged, [{ call, attempt: 1, of: 2, category: "truncated", status: 200, ms: logged[0]?.ms, traceId: "trace-cut", finish: "length", tokens: { prompt: 1356, completion: 800, reasoning: 800 } }]);
  });

  test(`${call}: an HTTP error is logged per attempt with its status and trace id`, async () => {
    const busy = () => json({ error: { message: `echo ${SENTINEL}` } }, { status: 503, trace: "trace-503" });
    const failed = await run(call, [busy, busy]);
    assert.equal(!failed.result.ok && failed.result.code, "provider_error");
    assert.deepEqual(pick(failed.logged, "call", "attempt", "category", "status", "traceId"), [
      { call, attempt: 1, category: "http", status: 503, traceId: "trace-503" },
      { call, attempt: 2, category: "http", status: 503, traceId: "trace-503" },
    ]);
    const refused = await run(call, [() => json({ error: { message: `echo ${SENTINEL}` } }, { status: 401 })]);
    assert.deepEqual(pick(refused.logged, "attempt", "category", "status"), [{ attempt: 1, category: "http", status: 401 }], "a 4xx is not retried");
  });

  test(`${call}: a network failure is logged with its cause code, a timeout once`, async () => {
    const drop = () => { throw new TypeError("fetch failed", { cause: Object.assign(new Error(`socket closed ${SENTINEL}`), { code: "ECONNRESET" }) }); };
    const network = await run(call, [drop, drop]);
    assert.equal(!network.result.ok && network.result.code, "provider_error");
    assert.deepEqual(pick(network.logged, "attempt", "category", "cause"), [
      { attempt: 1, category: "network", cause: "ECONNRESET" },
      { attempt: 2, category: "network", cause: "ECONNRESET" },
    ]);
    const slow = await run(call, [() => { throw new DOMException("The operation was aborted due to timeout", "TimeoutError"); }]);
    assert.equal(!slow.result.ok && slow.result.code, "timeout");
    assert.deepEqual(pick(slow.logged, "attempt", "category"), [{ attempt: 1, category: "timeout" }]);
  });

  test(`${call}: a body or an answer that is not JSON is logged as parse, a wrong shape as schema with its fields`, async () => {
    const gateway = () => new Response(`<html>bad gateway ${SENTINEL}</html>`, { status: 200, headers: { "Content-Type": "text/html", "x-ds-trace-id": "trace-html" } });
    const body = await run(call, [gateway, gateway]);
    assert.deepEqual(pick(body.logged, "attempt", "category", "status", "traceId"), [
      { attempt: 1, category: "parse", status: 200, traceId: "trace-html" },
      { attempt: 2, category: "parse", status: 200, traceId: "trace-html" },
    ]);
    const prose = await run(call, [() => answer(`not json ${SENTINEL}`), () => answer(`still not json ${SENTINEL}`)]);
    assert.equal(!prose.result.ok && prose.result.code, "invalid_output");
    assert.deepEqual(pick(prose.logged, "attempt", "category", "finish", "fields"), [
      { attempt: 1, category: "parse", finish: "stop", fields: undefined },
      { attempt: 2, category: "parse", finish: "stop", fields: undefined },
    ]);
    const type = "image_facts";
    const shape = () => answer(JSON.stringify({ type, visibleText: `bad ${SENTINEL}` }));
    const wrong = await run(call, [shape, shape]);
    assert.equal(!wrong.result.ok && wrong.result.code, "invalid_output");
    assert.deepEqual(pick(wrong.logged, "attempt", "category"), [{ attempt: 1, category: "schema" }, { attempt: 2, category: "schema" }]);
    for (const line of wrong.logged) assert.ok(Array.isArray(line.fields) && (line.fields as string[]).includes("visibleText:invalid_type"), JSON.stringify(line.fields));
  });

  test(`${call}: a failed attempt followed by a good one logs only the failure; a good call logs nothing`, async () => {
    const once = await run(call, [() => json({ error: { message: "busy" } }, { status: 429 }), () => answer(calls[call].good)]);
    assert.equal(once.result.ok, true, JSON.stringify(once.result).slice(0, 300));
    assert.deepEqual(pick(once.logged, "attempt", "category", "status"), [{ attempt: 1, category: "http", status: 429 }]);
    const clean = await run(call, [() => answer(calls[call].good)]);
    assert.equal(clean.result.ok, true);
    assert.deepEqual(clean.logged, []);
  });
}

const cutOffCopy = (() => {
  const description = describeUserError({ code: "truncated" });
  return `${description.message} ${description.nextStep}`;
})();

test("the image-analyze route shows the error catalog's cut-off copy", async () => {
  const siteId = `t061vision-${crypto.randomUUID().slice(0, 8)}`;
  imageSites.add(siteId);
  const saved = await saveSiteImage({ siteId, bytes: photo, originalName: "gearbox.png" });
  steps = [cut("trace-route")];
  requests = 0;
  const response = await analyzeRoute.POST(new Request(`http://sitecraft.test/api/sites/${siteId}/images/${saved.imageId}/analyze`, { method: "POST" }), {
    params: Promise.resolve({ siteId, imageId: saved.imageId }),
  });
  const payload = await response.json() as Record<string, unknown>;
  assert.equal(requests, 1);
  assert.equal(response.status, 502);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, "truncated");
  assert.equal(payload.userMessage, cutOffCopy);
});
