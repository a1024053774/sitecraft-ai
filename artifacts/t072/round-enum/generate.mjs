// T-072 evidence: run the real alignment planner twice for each simulated company pack.
// The output keeps only the selected look/color-set recommendations and their reasons, plus
// non-sensitive call metadata and the planner's parsed JSON response. It never writes materials,
// prompts, request bodies, API keys, or conversation records.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const OUT = process.env.T072_OUTPUT_DIR
  ? path.resolve(process.env.T072_OUTPUT_DIR)
  : path.join(ROOT, "artifacts", "t072", "round-enum");
const RUNS = 2;
const PACKS = ["industrial", "export", "molding"];
const summaryPath = path.join(OUT, "recommendations.json");
mkdirSync(OUT, { recursive: true });

const envFile = process.env.SITECRAFT_ENV_FILE;
if (!envFile) throw new Error("SITECRAFT_ENV_FILE is required; refusing to guess a secrets file");
for (const line of readFileSync(envFile, "utf8").split("\n")) {
  const match = /^\s*(DEEPSEEK_[A-Z_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (match) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
}
delete process.env.SITE_STORE;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const abs = path.join(ROOT, specifier.slice(2));
    let file = abs;
    if (existsSync(`${abs}.ts`)) file = `${abs}.ts`;
    else if (existsSync(`${abs}.tsx`)) file = `${abs}.tsx`;
    else if (existsSync(path.join(abs, "index.ts"))) file = path.join(abs, "index.ts");
    return nextResolve(pathToFileURL(file).href, context);
  },
});

let current = null;
const calls = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.endsWith("/chat/completions")) return originalFetch(input, init);
  const request = JSON.parse(String(init?.body ?? "{}"));
  const system = String(request.messages?.find((message) => message.role === "system")?.content ?? "");
  if (!system.includes("需求对齐规划器")) return originalFetch(input, init);
  const started = Date.now();
  try {
    const response = await originalFetch(input, init);
    const payload = await response.clone().json().catch(() => null);
    const choice = payload?.choices?.[0];
    const plannerOutput = typeof choice?.message?.content === "string"
      ? (() => {
        try { return JSON.parse(choice.message.content); } catch { return { parseError: true, content: choice.message.content }; }
      })()
      : null;
    calls.push({
      ...current,
      http: response.status,
      ms: Date.now() - started,
      finish: choice?.finish_reason ?? null,
      usage: payload?.usage ? {
        prompt: payload.usage.prompt_tokens ?? null,
        completion: payload.usage.completion_tokens ?? null,
        reasoning: payload.usage.completion_tokens_details?.reasoning_tokens ?? null,
      } : null,
      traceId: response.headers.get("x-ds-trace-id"),
      plannerOutput,
    });
    return response;
  } catch (error) {
    calls.push({ ...current, ms: Date.now() - started, error: error instanceof Error ? error.name : "error" });
    throw error;
  }
};

const sitesRoute = await import(pathToFileURL(path.join(ROOT, "app/api/sites/route.ts")).href);
const chatRoute = await import(pathToFileURL(path.join(ROOT, "app/api/sites/[siteId]/chat/route.ts")).href);
const { getSite, commitOperations } = await import(pathToFileURL(path.join(ROOT, "lib/site-store.ts")).href);
const { simulatedPacks, wrapCompanyMaterials } = await import(pathToFileURL(path.join(ROOT, "lib/simulated-packs.ts")).href);
const { packDraft } = await import(pathToFileURL(path.join(ROOT, "tests/fixtures/pack-drafts.ts")).href);

async function chat(siteId, message, baseRevision) {
  const response = await chatRoute.POST(new Request(`http://sitecraft.local/api/sites/${siteId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "start", message, baseRevision }),
  }), { params: Promise.resolve({ siteId }) });
  const text = await response.text();
  if ((response.headers.get("Content-Type") ?? "").includes("application/json")) {
    return { http: response.status, done: { status: "error", ...JSON.parse(text) } };
  }
  const events = text.split("\n\n")
    .map((chunk) => chunk.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => JSON.parse(line.slice(5).trim()));
  return { http: response.status, done: events.findLast((event) => event.type === "done") ?? { status: "error", error: "no done event" } };
}

function recommendation(question) {
  const option = question?.options?.find((item) => item.recommended === true);
  return option ? { id: option.id ?? null, label: option.label ?? null, reason: option.description?.trim() || null } : null;
}

function plannerRecommendation(plannerOutput, field) {
  const question = plannerOutput && typeof plannerOutput === "object" && Array.isArray(plannerOutput.questions)
    ? plannerOutput.questions.find((item) => item?.field === field)
    : null;
  const option = question?.options?.find((item) => item?.recommended === true);
  return option ? { id: option.id ?? null, label: option.label ?? null, reason: typeof option.description === "string" ? option.description.trim() || null : null } : null;
}

function plannerStructuredRecommendation(plannerOutput) {
  const recommendation = plannerOutput && typeof plannerOutput === "object" && plannerOutput.recommendation && typeof plannerOutput.recommendation === "object"
    ? plannerOutput.recommendation
    : null;
  if (!recommendation) return null;
  return {
    styleId: typeof recommendation.styleId === "string" ? recommendation.styleId : null,
    styleReason: typeof recommendation.styleReason === "string" ? recommendation.styleReason.trim() || null : null,
    colorSetId: typeof recommendation.colorSetId === "string" ? recommendation.colorSetId : null,
    colorSetReason: typeof recommendation.colorSetReason === "string" ? recommendation.colorSetReason.trim() || null : null,
  };
}

const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const results = [];
let stopped = null;
try {
  for (const packId of PACKS) {
    const pack = simulatedPacks[packId];
    for (let run = 1; run <= RUNS; run += 1) {
      const siteId = `t072-${packId}-${run}-${crypto.randomUUID().slice(0, 8)}`;
      current = { pack: packId, run };
      const created = await sitesRoute.POST(new Request("http://sitecraft.local/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "未命名站点", templateId: "screwfast", locales: ["zh", "en"] }),
      }));
      // Use the route-created site so the observation follows the same entry point as the workspace.
      const createdJson = await created.json();
      const realSiteId = createdJson.id;
      const draft = await getSite(realSiteId);
      const seeded = packDraft(packId);
      const seedOperations = [
        { op: "replace_products", products: seeded.products },
        ...(seeded.content.industries?.items.length ? [{ op: "set_catalog_section", section: "industries", value: seeded.content.industries }] : []),
        ...(seeded.content.capabilities?.items.length ? [{ op: "set_catalog_section", section: "capabilities", value: seeded.content.capabilities }] : []),
        ...(seeded.content.certifications?.items.length ? [{ op: "set_catalog_section", section: "certifications", value: seeded.content.certifications }] : []),
      ];
      const imported = await commitOperations({
        siteId: realSiteId,
        baseRevision: draft.draft.revision,
        source: "import",
        summary: `structured ${packId} recommendation fixture`,
        operations: seedOperations,
      });
      if (imported.status !== "applied") throw new Error(`structured fixture seed failed for ${packId}`);
      const started = new Date().toISOString();
      const response = await chat(realSiteId, wrapCompanyMaterials(pack.body), imported.record.draft.revision);
      const questions = Array.isArray(response.done?.questions) ? response.done.questions : [];
      const style = questions.find((question) => question.field === "style");
      const colorSet = questions.find((question) => question.field === "colorSet");
      const call = calls.findLast((item) => item.pack === packId && item.run === run) ?? null;
      results.push({
        pack: packId,
        run,
        at: started,
        http: response.http,
        status: response.done?.status ?? "error",
        code: response.done?.code ?? response.done?.error ?? null,
        look: recommendation(style),
        colorSet: recommendation(colorSet),
        plannerOutput: call?.plannerOutput ?? null,
        plannerRecommendation: plannerStructuredRecommendation(call?.plannerOutput),
        plannerRecommendations: {
          style: plannerRecommendation(call?.plannerOutput, "style"),
          colorSet: plannerRecommendation(call?.plannerOutput, "colorSet"),
        },
        call: call ? { ...call, plannerOutput: undefined } : null,
      });
      rmSync(path.join(ROOT, ".sitecraft-data", "sites", `${realSiteId}.json`), { force: true });
      rmSync(path.join(ROOT, ".sitecraft-data", "conversations", realSiteId), { recursive: true, force: true });
      if (call?.error) {
        stopped = { pack: packId, run, reason: "DeepSeek request threw; stopped after the first connectivity failure." };
        throw new Error(stopped.reason);
      }
    }
  }
} catch (error) {
  if (!stopped) stopped = { reason: error instanceof Error ? error.message : "observation stopped" };
} finally {
  const output = {
    generatedAt: new Date().toISOString(),
    timezone: "America/New_York",
    commit,
    runsPerPack: RUNS,
    packs: PACKS,
    stopped,
    results,
  };
  writeFileSync(summaryPath, JSON.stringify(output, null, 2), "utf8");
  globalThis.fetch = originalFetch;
  console.log(summaryPath);
}
