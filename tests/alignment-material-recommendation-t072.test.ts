import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { packDraft } from "./fixtures/pack-drafts.ts";
import type { SiteOperation } from "../lib/site-operations.ts";

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

function seedOperations(packId: "industrial" | "export" | "molding", sparse = false): SiteOperation[] {
  const draft = packDraft(packId);
  const operations: SiteOperation[] = [{ op: "replace_products", products: sparse ? draft.products.slice(0, 1) : draft.products }];
  if (sparse) return operations;
  for (const section of ["industries", "capabilities", "certifications"] as const) {
    const value = draft.content[section];
    if (value?.items.length) operations.push({ op: "set_catalog_section", section, value });
  }
  return operations;
}

async function runRecommendation(packId: "industrial" | "export", sparse = false) {
  const siteId = `t072-behavior-${packId}-${crypto.randomUUID()}`;
  created.push(siteId);
  const before = await getSite(siteId);
  const imported = await commitOperations({
    siteId,
    baseRevision: before.draft.revision,
    source: "import",
    summary: `seed ${packId} structured fields`,
    operations: seedOperations(packId, sparse),
  });
  assert.equal(imported.status, "applied");
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
  const questions = done?.questions as Array<{ field?: string; options: Array<{ id: string; description?: string; recommended?: boolean }> }>;
  return {
    response,
    style: questions.find((question) => question.field === "style"),
    color: questions.find((question) => question.field === "colorSet"),
  };
}

test("alignment route chooses different looks from structured company shape while retaining planner color", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({
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
  try {
    const industrial = await runRecommendation("industrial");
    const sparse = await runRecommendation("export", true);
    assert.equal(industrial.response.status, 200);
    assert.equal(sparse.response.status, 200);
    assert.equal(industrial.style?.options.find((option) => option.recommended)?.id, "engineering-industrial");
    assert.equal(sparse.style?.options.find((option) => option.recommended)?.id, "technical-product");
    assert.match(sparse.style?.options.find((option) => option.recommended)?.description ?? "", /1 个产品/);
    assert.equal(sparse.color?.options.find((option) => option.recommended)?.id, "colorSet:turquoise");
    assert.equal(sparse.color?.options.find((option) => option.recommended)?.description, "模型颜色理由");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
