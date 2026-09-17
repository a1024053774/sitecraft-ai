import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import {
  inspectPreviewScreenshot,
  parsePreviewReview,
  previewReviewSchema,
  PREVIEW_REVIEW_NONCE_PREFIX,
} from "../lib/preview-vision.ts";
import { aiIntentResponseSchema } from "../lib/site-operations.ts";

const ONE_BY_ONE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
  "base64",
);

function pngWithSize(width: number, height: number, byteLength = 24) {
  const bytes = Buffer.alloc(Math.max(24, byteLength));
  bytes[0] = 0x89;
  bytes[1] = 0x50;
  bytes[2] = 0x4e;
  bytes[3] = 0x47;
  bytes[4] = 0x0d;
  bytes[5] = 0x0a;
  bytes[6] = 0x1a;
  bytes[7] = 0x0a;
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

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

const LEAK_TOKEN = "sk-test-preview-vision-not-real-LEAKTOKEN";
writeEnv("DEEPSEEK_API_KEY", LEAK_TOKEN);
writeEnv("DEEPSEEK_MODEL", "test-preview-vision-model");
writeEnv("DEEPSEEK_BASE_URL", "https://preview-vision-stub.test.invalid");
writeEnv("AI_API_KEY", undefined);
writeEnv("AI_MODEL", undefined);
writeEnv("AI_BASE_URL", undefined);

const originalFetch = globalThis.fetch;
const stubBase = "https://preview-vision-stub.test.invalid/";
let lastRequest: { url: string; authorization: string; body: string } = { url: "", authorization: "", body: "" };
let nextPayload: Record<string, unknown> = {
  type: "preview_review",
  visibleText: ["Landwind"],
  nonce: "SCV5-TEST",
  templateFit: { looksLikeClaimedTemplate: true, notes: "蓝白目录首屏" },
  imageTextMismatches: [],
};
let fetchCount = 0;

globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.includes("api.deepseek.com") || !url.startsWith(stubBase)) {
    throw new Error(`refusing unexpected fetch ${url}`);
  }
  fetchCount += 1;
  const headers = init?.headers instanceof Headers
    ? init.headers
    : new Headers(init?.headers as Record<string, string> | undefined);
  lastRequest = {
    url,
    authorization: headers.get("authorization") ?? "",
    body: typeof init?.body === "string" ? init.body : "",
  };
  return new Response(JSON.stringify({
    model: "test-preview-vision-model",
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

const { requestPreviewReview } = await import("../lib/ai-provider.ts") as typeof import("../lib/ai-provider.ts");

const { POST } = await import(pathToFileURL(path.join(process.cwd(), "app/api/ai/preview-review/route.ts")).href) as {
  POST: (request: Request) => Promise<Response>;
};

function restoreEnv() {
  for (const key of envKeys) writeEnv(key, previousEnv[key]);
}

test.after(() => {
  globalThis.fetch = originalFetch;
  restoreEnv();
});

test("inspectPreviewScreenshot rejects empty and 1×1 PNGs", () => {
  assert.throws(() => inspectPreviewScreenshot(new Uint8Array()), (error: unknown) => {
    assert.equal(error instanceof Error && error.message.includes("为空"), true);
    return true;
  });
  assert.equal(ONE_BY_ONE_PNG.length > 0, true);
  assert.throws(() => inspectPreviewScreenshot(ONE_BY_ONE_PNG), (error: unknown) => {
    assert.equal(error instanceof Error && error.message.includes("1×1"), true);
    assert.equal(error instanceof Error && error.message.includes("1×1") && error.message.includes("合成小图"), true);
    return true;
  });
  assert.throws(() => inspectPreviewScreenshot(pngWithSize(1, 1, 9000)), (error: unknown) => {
    assert.equal(error instanceof Error && error.message.includes("1×1"), true);
    return true;
  });
});

test("inspectPreviewScreenshot rejects a 320×200 header that is still a tiny synthetic PNG", () => {
  assert.throws(() => inspectPreviewScreenshot(pngWithSize(320, 200, 100)), (error: unknown) => {
    assert.equal(error instanceof Error && error.message.includes("合成小图"), true);
    return true;
  });
});

test("preview review schema drops CSS/HTML/operations and does not become an edit intent", () => {
  const parsed = previewReviewSchema.safeParse({
    type: "preview_review",
    visibleText: ["Building digital products"],
    nonce: `${PREVIEW_REVIEW_NONCE_PREFIX}LIVE`,
    templateFit: { looksLikeClaimedTemplate: true, notes: "蓝白目录" },
    imageTextMismatches: [],
    operations: [{ op: "set_css", value: "body{color:red}" }],
    op: "set_html",
    html: "<style>body{color:red}</style>",
    beautyScore: 9,
  });
  assert.equal(parsed.success, true);
  if (!parsed.success) throw new Error("expected preview review parse");
  assert.equal("operations" in parsed.data, false);
  assert.equal("op" in parsed.data, false);
  assert.equal("html" in parsed.data, false);
  assert.equal("beautyScore" in parsed.data, false);
  assert.equal(parsed.data.type, "preview_review");

  const asIntent = aiIntentResponseSchema.safeParse(parsed.data);
  assert.equal(asIntent.success, false);

  const css = aiIntentResponseSchema.safeParse({
    type: "edit",
    summary: "写入样式",
    operations: [{ op: "set_css", value: "body{color:red}" }],
  });
  assert.equal(css.success, false);
});

test("parsePreviewReview rejects an edit payload that would rewrite HTML", () => {
  const parsed = parsePreviewReview(JSON.stringify({
    type: "edit",
    summary: "改草稿",
    operations: [{ op: "set_text", target: "hero.title", locale: "zh", value: "x" }],
  }));
  assert.equal(parsed.data, null);
});

test("requestPreviewReview rejects 1×1 without calling the provider", async () => {
  const before = fetchCount;
  const result = await requestPreviewReview({ imageBytes: ONE_BY_ONE_PNG, claimedTemplateId: "landwind" });
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("expected invalid image");
  assert.equal(result.code, "invalid_image");
  assert.equal(result.error.includes("1×1"), true);
  assert.equal(fetchCount, before);
  assert.equal(JSON.stringify(result).includes(LEAK_TOKEN), false);
});

test("requestPreviewReview sends image_url, keeps keys out of the result, and returns no operations", async () => {
  fetchCount = 0;
  nextPayload = {
    type: "preview_review",
    visibleText: ["Building digital products & brands."],
    nonce: "SCV5-PAGE-9188",
    templateFit: { looksLikeClaimedTemplate: true, notes: "浅色目录首屏" },
    imageTextMismatches: [],
    operations: [{ op: "set_html", value: "<div/>" }],
    set_css: "body{display:none}",
  };
  const imageBytes = pngWithSize(1440, 900, 12_000);
  const result = await requestPreviewReview({ imageBytes, claimedTemplateId: "landwind" });
  if (!result.ok) throw new Error(result.error);
  assert.equal(result.ok, true);
  assert.equal(fetchCount, 1);
  assert.equal(lastRequest.url, "https://preview-vision-stub.test.invalid/chat/completions");
  assert.equal(lastRequest.authorization, `Bearer ${LEAK_TOKEN}`);
  const body = JSON.parse(lastRequest.body) as {
    model: string;
    messages: Array<{ role: string; content: unknown }>;
  };
  assert.equal(body.model, "test-preview-vision-model");
  const user = body.messages.find((item) => item.role === "user");
  assert.equal(Array.isArray(user?.content), true);
  const parts = user?.content as Array<{ type?: string; image_url?: { url?: string }; text?: string }>;
  const imagePart = parts.find((item) => item.type === "image_url");
  assert.equal(imagePart?.image_url?.url?.startsWith("data:image/png;base64,"), true);
  const system = body.messages.find((item) => item.role === "system");
  assert.equal(typeof system?.content, "string");
  assert.equal(String(system?.content).includes("审美由人工拍板"), true);
  assert.equal(String(system?.content).includes("operations"), true);
  assert.equal(result.review.type, "preview_review");
  assert.equal(result.review.nonce, "SCV5-PAGE-9188");
  assert.equal("operations" in result.review, false);
  assert.equal("operations" in result, false);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes(LEAK_TOKEN), false);
  assert.equal(serialized.includes("set_html"), false);
  assert.equal(result.image.width, 1440);
  assert.equal(result.image.height, 900);
});

test("preview-review route never imports commitOperations and rejects 1×1", async () => {
  const source = readFileSync(new URL("../app/api/ai/preview-review/route.ts", import.meta.url), "utf8");
  assert.equal(source.includes("commitOperations"), false);
  assert.equal(source.includes("applySiteOperations"), false);
  assert.equal(source.includes("aesthetic: \"human\""), true);

  const form = new FormData();
  form.set("screenshot", new Blob([ONE_BY_ONE_PNG], { type: "image/png" }), "tiny.png");
  form.set("claimedTemplateId", "landwind");
  const before = fetchCount;
  const response = await POST(new Request("http://sitecraft.test/api/ai/preview-review", { method: "POST", body: form }));
  assert.equal(response.status, 400);
  const payload = await response.json() as { ok?: boolean; error?: string; aesthetic?: string };
  assert.equal(payload.ok, false);
  assert.equal(String(payload.error).includes("1×1"), true);
  assert.equal(payload.aesthetic, "human");
  assert.equal(JSON.stringify(payload).includes(LEAK_TOKEN), false);
  assert.equal(fetchCount, before);
});
