import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { defaultDraft } from "../lib/site-document.ts";

const envKeys = ["DEEPSEEK_API_KEY", "DEEPSEEK_MODEL", "DEEPSEEK_BASE_URL", "AI_API_KEY", "AI_MODEL", "AI_BASE_URL"] as const;
const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const setEnv = (key: string, value: string | undefined) => {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env[key];
  else env[key] = value;
};
setEnv("DEEPSEEK_API_KEY", "sk-test-t100-not-real");
setEnv("DEEPSEEK_MODEL", "test-t100-model");
setEnv("DEEPSEEK_BASE_URL", "https://t100-schema-stub.test.invalid");
for (const key of ["AI_API_KEY", "AI_MODEL", "AI_BASE_URL"]) setEnv(key, undefined);

let lastRequestBody = "";
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith("https://t100-schema-stub.test.invalid/")) throw new Error(`refusing unexpected fetch ${url}`);
  lastRequestBody = typeof init?.body === "string" ? init.body : "";
  return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ type: "answer", text: "ok" }) } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const abs = path.join(process.cwd(), specifier.slice(2));
    const file = existsSync(`${abs}.ts`) ? `${abs}.ts` : existsSync(path.join(abs, "index.ts")) ? path.join(abs, "index.ts") : abs;
    return nextResolve(pathToFileURL(file).href, context);
  },
});

const { requestStructuredOperations } = await import("../lib/ai-provider.ts");
const raw = JSON.parse(readFileSync("artifacts/t096/repro-current-264c953/industrial-trial-1.json", "utf8")) as { rawCalls: Array<{ content?: string | null }> };

test.after(() => {
  globalThis.fetch = originalFetch;
  for (const key of envKeys) setEnv(key, previousEnv[key]);
});

test("saved first responses expose the independent shape failures", () => {
  const malformed = raw.rawCalls
    .map((call) => typeof call.content === "string" ? JSON.parse(call.content) as { operations?: Array<Record<string, unknown>> } : null)
    .filter(Boolean)
    .flatMap((payload) => payload?.operations ?? []);
  const products = malformed.find((operation) => operation.op === "replace_products") as { products?: Array<{ sku?: unknown }> } | undefined;
  const catalogs = malformed.filter((operation) => operation.op === "set_catalog_section") as Array<{ value?: { intro?: unknown; items?: Array<{ body?: unknown }> } }>;
  assert.ok(products?.products?.some((product) => product.sku === undefined), "the saved response omits product sku");
  assert.ok(catalogs.some((catalog) => catalog.value?.intro === null), "the saved response uses null for catalog intro");
  assert.ok(catalogs.some((catalog) => catalog.value?.items?.some((item) => item.body === undefined)), "the saved response omits catalog item body");
});

test("the structured-output prompt states the exact required shapes for sparse facts", async () => {
  await requestStructuredOperations({ message: "请根据资料生成网站", draft: structuredClone(defaultDraft), templateId: "screwfast" });
  const system = String((JSON.parse(lastRequestBody) as { messages: Array<{ role: string; content: string }> }).messages.find((item) => item.role === "system")?.content ?? "");
  assert.match(system, /sku[^\n]{0,120}非空字符串/);
  assert.match(system, /SKU[^\n]{0,160}待补充/);
  assert.match(system, /intro[^\n]{0,220}必须始终是.*zh.*en/);
  assert.match(system, /body[^\n]{0,220}不得省略|body[^\n]{0,220}不能省略/);
  assert.match(system, /spec[^\n]{0,220}只能是 null 或.*zh.*en/);
  assert.match(system, /不能写裸字符串|禁止裸字符串/);
});
