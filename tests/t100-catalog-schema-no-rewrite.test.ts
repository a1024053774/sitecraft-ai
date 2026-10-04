import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { defaultDraft } from "../lib/site-document.ts";

const envKeys = ["SITE_STORE", "NODE_ENV", "DEEPSEEK_API_KEY", "DEEPSEEK_MODEL", "DEEPSEEK_BASE_URL", "AI_API_KEY", "AI_MODEL", "AI_BASE_URL"] as const;
const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const writeEnv = (key: string, value: string | undefined) => {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env[key];
  else env[key] = value;
};
writeEnv("SITE_STORE", undefined);
writeEnv("NODE_ENV", "test");
writeEnv("DEEPSEEK_API_KEY", "sk-test-t100-schema-not-real");
writeEnv("DEEPSEEK_MODEL", "test-t100-schema-model");
writeEnv("DEEPSEEK_BASE_URL", "https://t100-schema-no-rewrite.test.invalid");
for (const key of ["AI_API_KEY", "AI_MODEL", "AI_BASE_URL"]) writeEnv(key, undefined);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const abs = path.join(process.cwd(), specifier.slice(2));
    const file = existsSync(`${abs}.ts`) ? `${abs}.ts` : existsSync(path.join(abs, "index.ts")) ? path.join(abs, "index.ts") : abs;
    return nextResolve(pathToFileURL(file).href, context);
  },
});

const { requestStructuredOperations } = await import("../lib/ai-provider.ts");
const { commitOperations, getSite, deleteSiteRecord } = await import("../lib/site-store.ts");

const originalFetch = globalThis.fetch;
const createdSites = new Set<string>();
let malformedPayload: Record<string, unknown>;
globalThis.fetch = async (input) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith("https://t100-schema-no-rewrite.test.invalid/")) throw new Error(`refusing unexpected fetch ${url}`);
  return new Response(JSON.stringify({
    choices: [{ finish_reason: "stop", message: { content: JSON.stringify(malformedPayload) } }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });
};

test.after(async () => {
  globalThis.fetch = originalFetch;
  for (const key of envKeys) writeEnv(key, previousEnv[key]);
  await Promise.all([...createdSites].map((siteId) => deleteSiteRecord(siteId)));
});

async function assertMalformedCatalogDoesNotCommit(item: Record<string, unknown>) {
  malformedPayload = {
    type: "edit",
    summary: "写入行业目录",
    operations: [{
      op: "set_catalog_section",
      section: "industries",
      value: {
        title: { zh: "应用行业", en: "Industries" },
        intro: { zh: "资料中的应用行业", en: "Applications from the materials" },
        items: [item],
      },
    }],
  };
  const siteId = `t100-no-rewrite-${crypto.randomUUID().replaceAll("-", "")}`;
  createdSites.add(siteId);
  const before = await getSite(siteId);
  const provider = await requestStructuredOperations({
    message: "请根据资料更新应用行业目录",
    draft: structuredClone(defaultDraft),
    templateId: defaultDraft.templateId,
  });
  let committed = false;
  if (provider.ok && provider.type === "edit") {
    const result = await commitOperations({
      siteId,
      baseRevision: before.draft.revision,
      source: "ai",
      summary: provider.summary,
      operations: provider.operations,
    });
    committed = result.status === "applied";
  }
  const after = await getSite(siteId);
  assert.equal(provider.ok, false, "missing/null catalog text must be an invalid model response");
  assert.equal(committed, false, "an invalid structured response must never be submitted");
  assert.equal(after.draft.revision, before.draft.revision, "the draft revision must remain unchanged");
  assert.equal(after.history.length, before.history.length, "no change set may be recorded");
}

test("missing catalog item body is rejected before any operation is submitted", async () => {
  await assertMalformedCatalogDoesNotCommit({ id: "cnc", title: { zh: "数控加工", en: "CNC machining" }, status: "已有" });
});

test("null catalog item title is rejected before any operation is submitted", async () => {
  await assertMalformedCatalogDoesNotCommit({ id: "cnc", title: null, body: { zh: "资料正文", en: "Material body" }, status: "已有" });
});
