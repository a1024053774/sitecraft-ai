import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

// T-034: round 1 of 需求对齐 on a new site always asks 样子 and 色彩集, and the color options come
// only from the 6-set catalog, whatever the planner returns.

const env = process.env as Record<string, string | undefined>;
env.NODE_ENV = "test";
delete env.SITE_STORE;
env.DEEPSEEK_API_KEY = "sk-test-t034-not-real";
env.DEEPSEEK_MODEL = "test-t034-model";
env.DEEPSEEK_BASE_URL = "https://t034-stub.test.invalid";
delete env.AI_API_KEY;
delete env.AI_MODEL;
delete env.AI_BASE_URL;

const INVENTED = "LOOKCARD_INVENTED_0928";
const READY = "LOOKCARD_READY_0928";
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith("https://t034-stub.test.invalid/")) throw new Error(`refusing unexpected fetch ${url}`);
  const raw = typeof init?.body === "string" ? init.body : "";
  const planner = raw.includes("需求对齐规划器");
  let payload: Record<string, unknown>;
  if (planner && raw.includes(INVENTED)) {
    // The planner invents its own color set, the way DeepSeek did in the 2026-09-28 run.
    payload = {
      kind: "question",
      recommendation: {
        styleId: "export-catalog",
        styleReason: "外贸目录按系列筛选。",
        colorSetId: "colorSet:turquoise",
        colorSetReason: "洁净流体和不锈钢接头适合冷静的松石强调。",
      },
      questions: [
        { field: "style", question: "选择网站的样子", options: [
          { id: "export-catalog", label: "蓝白目录（推荐）", description: "外贸目录按系列筛选。", recommended: true },
          { id: "engineering-industrial", label: "工程工业", description: "工况与询盘路径清楚。" },
        ], allowOther: true },
        { field: "pages", question: "页面重点怎么排？", options: [
          { label: "产品分类 + 经销商合作 + 询盘", description: "方便经销商筛选。", recommended: true },
          { label: "仅首页 + 产品 + 联系", description: "路径最短。" },
        ], allowOther: true },
        { field: "colorSet", question: "官网配色用哪套？", options: [
          { id: "colorSet:hydraulic-blue", label: "液压蓝白（推荐）", description: "贴合工业外贸。", paletteId: "hydraulic-blue", recommended: true },
          { id: "colorSet:deep-green", label: "深绿灰", description: "稳重。", paletteId: "deep-green" },
        ], allowOther: true },
      ],
    };
  } else if (planner) {
    payload = {
      kind: "ready",
      summary: "资料已经足够形成首页方案。",
      recommendation: {
        styleId: "engineering-industrial",
        styleReason: "参数和加工能力适合工程选型。",
        colorSetId: "colorSet:warm-orange",
        colorSetReason: "工程资料适合暖橙行动入口。",
      },
    };
  } else if (raw.includes("EDIT_AFTER_0928")) {
    payload = { type: "edit", summary: "改首屏标题", operations: [{ op: "set_text", target: "hero.title", locale: "zh", value: "重载减速机，按图定制" }] };
  } else {
    payload = {
      type: "edit",
      summary: "按资料生成首页",
      operations: [{ op: "set_text", target: "hero.title", locale: "zh", value: "按图加工重载减速机" }],
    };
  }
  return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(payload) } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

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
const { colorSetCatalog, paletteIds } = await import("../lib/site-document.ts");

const created: string[] = [];
function newSiteId() {
  const id = `t034-${crypto.randomUUID()}`;
  created.push(id);
  return id;
}

async function postChat(siteId: string, body: Record<string, unknown>) {
  const response = await POST(new Request(`http://sitecraft.test/api/sites/${siteId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }), { params: Promise.resolve({ siteId }) });
  const text = await response.text();
  const events = text.split("\n\n").map((chunk) => chunk.trim()).filter((line) => line.startsWith("data:"))
    .map((line) => JSON.parse(line.slice(5).trim()) as Record<string, unknown>);
  const done = events.find((event) => event.type === "done") as Record<string, any> | undefined;
  let json: Record<string, unknown> | null = null;
  if (!events.length) { try { json = JSON.parse(text); } catch { json = null; } }
  return { response, done, json };
}

type CardQuestion = { questionId: string; field?: string; prompt: string; options: Array<{ id: string; label: string; paletteId?: string }> };
const catalogOptionIds = new Set(colorSetCatalog.map((set) => `colorSet:${set.id}`));

test.after(async () => {
  globalThis.fetch = originalFetch;
  await Promise.all(created.flatMap((siteId) => [
    rm(path.join(process.cwd(), ".sitecraft-data", "sites", `${siteId}.json`), { force: true }),
    rm(path.join(process.cwd(), ".sitecraft-data", "conversations", siteId), { recursive: true, force: true }),
  ]));
});

test("a new site gets the look and color-set card even when the planner says ready", async () => {
  const siteId = newSiteId();
  const before = await getSite(siteId);
  assert.equal(before.hasGeneratedContent, false);
  const started = await postChat(siteId, { action: "start", message: `${READY} 我们做重载减速机，想做官网。`, baseRevision: before.draft.revision });
  const questions = (started.done?.questions ?? []) as CardQuestion[];
  assert.deepEqual(questions.map((item) => item.field).slice(0, 2), ["style", "colorSet"], "look must come first, then color set");
  const color = questions.find((item) => item.field === "colorSet")!;
  assert.ok(color.options.length >= 2 && color.options.length <= 4);
  for (const option of color.options) assert.ok(catalogOptionIds.has(option.id), `color option ${option.id} is not a catalog color set`);
  assert.equal((await getSite(siteId)).draft.revision, before.draft.revision, "asking must not change the draft");
});

test("invented color sets are replaced by catalog sets, and the chosen look and palette reach the draft", async () => {
  const siteId = newSiteId();
  const before = await getSite(siteId);
  const started = await postChat(siteId, { action: "start", message: `${INVENTED} 我们做液压快换接头的外贸 B2B。`, baseRevision: before.draft.revision });
  const conversationId = String(started.done?.conversationId);
  const questions = (started.done?.questions ?? []) as CardQuestion[];
  assert.ok(questions.length >= 3 && questions.length <= 4);
  assert.equal(questions[0].field, "style");
  const color = questions.find((item) => item.field === "colorSet")!;
  for (const option of color.options) assert.ok(catalogOptionIds.has(option.id), `color option ${option.id} is not a catalog color set`);
  assert.equal(JSON.stringify(questions).includes("hydraulic-blue"), false);
  // The planner's industry recommendation for the look is kept.
  const style = questions[0];
  assert.equal((style.options.find((option) => option.id === "export-catalog") as { recommended?: boolean } | undefined)?.recommended, true);

  const selections = questions.map((item) => ({
    questionId: item.questionId,
    optionId: item.field === "style" ? "export-catalog" : item.field === "colorSet" ? "colorSet:graphite" : item.options[0].id,
  }));
  const submitted = await postChat(siteId, {
    action: "select", conversationId, questionId: String(started.done?.questionId),
    questionRevision: Number(started.done?.questionRevision), selections,
  });
  assert.equal(submitted.done?.conversationError, undefined, "the answers must be saved");
  const restored = await postChat(siteId, { action: "state", conversationId });
  assert.equal(restored.response.status, 200, "refresh must read the saved state back");
  assert.equal(restored.done?.awaitingConfirmation, true);

  const confirmed = await postChat(siteId, {
    action: "confirm", conversationId, questionId: String(restored.done?.questionId),
    questionRevision: Number(restored.done?.questionRevision),
  });
  assert.equal(confirmed.response.status, 200);
  const after = await getSite(siteId);
  assert.equal(after.draft.visualBrief.id, "export-catalog");
  assert.equal(after.draft.paletteId, "export-graphite");
  assert.ok((paletteIds as readonly string[]).includes(after.draft.paletteId));
});

test("a site that was already generated is not re-asked the full card when the planner says ready", async () => {
  const siteId = newSiteId();
  const first = await getSite(siteId);
  await commitOperations({
    siteId, baseRevision: first.draft.revision, summary: "earlier generation", source: "ai",
    operations: [{ op: "set_text", target: "hero.title", locale: "zh", value: "已生成的首屏" }],
  });
  const before = await getSite(siteId);
  assert.equal(before.hasGeneratedContent, true);
  const started = await postChat(siteId, { action: "start", message: `${READY} 把首屏标题改短一点。`, baseRevision: before.draft.revision });
  const questions = (started.done?.questions ?? []) as CardQuestion[];
  assert.equal(questions.some((item) => item.field === "style" || item.field === "colorSet"), false);
});

test("after the confirmed plan is applied, the next ordinary edit applies without another confirmation", async () => {
  const siteId = newSiteId();
  const before = await getSite(siteId);
  const started = await postChat(siteId, { action: "start", message: `${READY} 我们做重载减速机，想做官网。`, baseRevision: before.draft.revision });
  const conversationId = String(started.done?.conversationId);
  const questions = (started.done?.questions ?? []) as CardQuestion[];
  const selections = questions.map((item) => ({ questionId: item.questionId, optionId: item.field === "style" ? "engineering-industrial" : "colorSet:graphite" }));
  const submitted = await postChat(siteId, { action: "select", conversationId, questionId: String(started.done?.questionId), questionRevision: Number(started.done?.questionRevision), selections });
  await postChat(siteId, { action: "confirm", conversationId, questionId: String(submitted.done?.questionId), questionRevision: Number(submitted.done?.questionRevision) });
  const generated = await getSite(siteId);
  assert.equal(generated.hasGeneratedContent, true);
  const restored = await postChat(siteId, { action: "state", conversationId });
  assert.equal(restored.done?.alignment?.enabled, false, "the full interview ends once its plan is applied");
  assert.ok(((restored.done?.alignment?.answers ?? []) as unknown[]).length >= 2, "answers are kept");

  // The workspace sends ordinary edits through the normal chat entry once alignment is off.
  const edit = await postChat(siteId, { message: "EDIT_AFTER_0928 把首屏标题改成：重载减速机，按图定制", baseRevision: generated.draft.revision, conversationId });
  assert.equal(edit.done?.status, "applied");
  assert.equal((await getSite(siteId)).draft.revision, generated.draft.revision + 1);
});
