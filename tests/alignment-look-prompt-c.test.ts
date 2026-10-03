import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const env = process.env as Record<string, string | undefined>;
env.DEEPSEEK_API_KEY = "sk-test-t072-prompt-not-real";
env.DEEPSEEK_MODEL = "test-t072-prompt-model";
env.DEEPSEEK_BASE_URL = "https://t072-prompt.test.invalid";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const abs = path.join(process.cwd(), specifier.slice(2));
    const file = existsSync(`${abs}.ts`) ? `${abs}.ts` : abs;
    return nextResolve(pathToFileURL(file).href, context);
  },
});

const { requestAlignmentPlan } = await import("../lib/ai-provider.ts");
const { defaultDraft } = await import("../lib/site-document.ts");

test("alignment prompt describes each block-library look before asking the model to recommend one", async () => {
  const originalFetch = globalThis.fetch;
  let systemPrompt = "";
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { messages?: Array<{ role?: string; content?: string }> };
    systemPrompt = body.messages?.find((message) => message.role === "system")?.content ?? "";
    return new Response(JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ kind: "ready", summary: "资料足够。", recommendation: {
        styleId: "engineering-industrial", styleReason: "参数资料适合工程选型。",
        colorSetId: "colorSet:warm-orange", colorSetReason: "工程资料适合暖橙入口。",
      } }) } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const result = await requestAlignmentPlan({
      message: "请按资料决定网站的视觉方向。",
      draft: structuredClone(defaultDraft),
      conversationContext: "",
      alignmentContext: "",
    });
    assert.equal(result.ok, true);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.match(systemPrompt, /engineering-industrial[\s\S]*无圆角[\s\S]*左文右图[\s\S]*深色底/);
  assert.match(systemPrompt, /industrial（明亮产品）[\s\S]*20px 卡片[\s\S]*产品\/行业\/能力卡片[\s\S]*浅色填充带边框[\s\S]*产品或品牌范围/);
  assert.match(systemPrompt, /export-catalog（蓝白目录）[\s\S]*浅色渐变首屏[\s\S]*产品目录行[\s\S]*系列或型号浏览[\s\S]*出口询盘/);
  assert.match(systemPrompt, /technical-product（灰底短路径）[\s\S]*大标题[\s\S]*短导航[\s\S]*资料较薄或围绕单一产品/);
  assert.match(systemPrompt, /行业标签→固定样子/);
});
