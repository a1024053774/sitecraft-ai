import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const ONE_BY_ONE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
  "base64",
);

const envKeys = [
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_MODEL",
  "DEEPSEEK_BASE_URL",
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

const LEAK_TOKEN = "sk-test-image-facts-not-real-LEAKTOKEN";
writeEnv("DEEPSEEK_API_KEY", LEAK_TOKEN);
writeEnv("DEEPSEEK_MODEL", "test-image-facts-model");
writeEnv("DEEPSEEK_BASE_URL", "https://image-facts-stub.test.invalid");
writeEnv("AI_API_KEY", undefined);
writeEnv("AI_MODEL", undefined);
writeEnv("AI_BASE_URL", undefined);

const originalFetch = globalThis.fetch;
const stubBase = "https://image-facts-stub.test.invalid/";
let fetchCount = 0;

globalThis.fetch = async (input) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.includes("api.deepseek.com") || !url.startsWith(stubBase)) {
    throw new Error(`refusing unexpected fetch ${url}`);
  }
  fetchCount += 1;
  return new Response(JSON.stringify({
    model: "test-image-facts-model",
    choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ type: "image_facts" }) } }],
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

const { requestImageFacts } = await import("../lib/ai-provider.ts") as typeof import("../lib/ai-provider.ts");
const { POST } = await import(pathToFileURL(path.join(process.cwd(), "app/api/sites/[siteId]/images/[imageId]/analyze/route.ts")).href) as {
  POST: (request: Request, context: { params: Promise<{ siteId: string; imageId: string }> }) => Promise<Response>;
};

test.after(() => {
  globalThis.fetch = originalFetch;
  for (const key of envKeys) writeEnv(key, previousEnv[key]);
});

test("requestImageFacts rejects 1×1 without calling the provider", async () => {
  const before = fetchCount;
  const result = await requestImageFacts({ imageBytes: ONE_BY_ONE_PNG, originalName: "tiny.png" });
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("expected invalid image");
  assert.equal(result.code, "invalid_image");
  assert.equal(result.error.includes("1×1"), true);
  assert.equal(fetchCount, before);
  assert.equal(JSON.stringify(result).includes(LEAK_TOKEN), false);
});

test("analyze route never imports commitOperations and rejects unknown images", async () => {
  const source = readFileSync(new URL("../app/api/sites/[siteId]/images/[imageId]/analyze/route.ts", import.meta.url), "utf8");
  assert.equal(source.includes("commitOperations"), false);
  assert.equal(source.includes("applySiteOperations"), false);
  const response = await POST(new Request("http://sitecraft.test/api/sites/p3img-missing/images/img_notarealimage0001/analyze", { method: "POST" }), {
    params: Promise.resolve({ siteId: "p3img-missing", imageId: "img_notarealimage0001" }),
  });
  assert.equal(response.status === 404 || response.status === 403 || response.status === 400, true);
  const payload = await response.json() as { ok?: boolean };
  assert.equal(payload.ok, false);
  assert.equal(fetchCount, 0);
});
