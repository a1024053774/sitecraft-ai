import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { packDraft } from "./fixtures/pack-drafts.ts";

const env = process.env as Record<string, string | undefined>;
env.NODE_ENV = "test";
delete env.SITE_STORE;
env.DEEPSEEK_API_KEY = "sk-test-t072-route-not-real";
env.DEEPSEEK_MODEL = "test-t072-route-model";
env.DEEPSEEK_BASE_URL = "https://t072-route.test.invalid";

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
const { commitOperations, getSite } = await import("../lib/site-store.ts");

const created: string[] = [];

test.after(async () => {
  await Promise.all(created.flatMap((siteId) => [
    rm(path.join(process.cwd(), ".sitecraft-data", "sites", `${siteId}.json`), { force: true }),
    rm(path.join(process.cwd(), ".sitecraft-data", "conversations", siteId), { recursive: true, force: true }),
  ]));
});

test("a populated structured draft overrides the model look pick but keeps its color reason", async () => {
  const siteId = `t072-route-${crypto.randomUUID()}`;
  created.push(siteId);
  const before = await getSite(siteId);
  const seeded = packDraft("export");
  const imported = await commitOperations({
    siteId,
    baseRevision: before.draft.revision,
    source: "import",
    summary: "seed structured recommendation fixture",
    operations: [{ op: "replace_products", products: seeded.products }],
  });
  assert.equal(imported.status, "applied");

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { messages?: Array<{ role?: string; content?: string }> };
    const system = body.messages?.find((message) => message.role === "system")?.content ?? "";
    assert.match(system, /四个样子都来自区块库/);
    return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({
      kind: "question",
      questions: [
        { field: "style", question: "样子", allowOther: true, options: [
          { id: "engineering-industrial", label: "工程工业", description: "模型样子理由", recommended: true },
          { id: "export-catalog", label: "蓝白目录", description: "另一种样子" },
        ] },
        { field: "colorSet", question: "配色", allowOther: true, options: [
          { id: "colorSet:turquoise", label: "松石", description: "模型颜色理由", recommended: true },
          { id: "colorSet:graphite", label: "石墨工坊", description: "另一种配色" },
        ] },
      ],
    }) } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const current = await getSite(siteId);
    const response = await POST(new Request(`http://sitecraft.test/api/sites/${siteId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", message: "根据当前结构化资料规划网站", baseRevision: current.draft.revision }),
    }), { params: Promise.resolve({ siteId }) });
    const events = (await response.text()).split("\n\n")
      .map((chunk) => chunk.trim())
      .filter((line) => line.startsWith("data:"))
      .map((line) => JSON.parse(line.slice(5).trim()) as Record<string, any>);
    const done = events.find((event) => event.type === "done");
    assert.equal(response.status, 200);
    const questions = done?.questions as Array<{ field?: string; options: Array<{ id: string; description?: string; recommended?: boolean }> }>;
    const style = questions.find((question) => question.field === "style");
    const color = questions.find((question) => question.field === "colorSet");
    assert.equal(style?.options.find((option) => option.recommended)?.id, "export-catalog");
    assert.match(style?.options.find((option) => option.recommended)?.description ?? "", /2 个产品|目录/);
    assert.equal(color?.options.find((option) => option.recommended)?.id, "colorSet:turquoise");
    assert.equal(color?.options.find((option) => option.recommended)?.description, "模型颜色理由");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
