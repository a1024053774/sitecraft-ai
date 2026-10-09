import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { simulatedPacks } from "../lib/simulated-packs.ts";
import { packDraft } from "./fixtures/pack-drafts.ts";

// T-053 step 3 through the chat route: the alignment run plans on the look the user picked in the
// card before that look is saved (so the model gets that look's layouts and its layout requests
// are checked on it), and a plain chat request for a layout the materials do not support changes
// nothing and tells the user why.

const envKeys = ["SITE_STORE", "NODE_ENV", "DEEPSEEK_API_KEY", "DEEPSEEK_MODEL", "DEEPSEEK_BASE_URL", "DEEPSEEK_MAX_TOKENS", "AI_API_KEY", "AI_MODEL", "AI_BASE_URL"] as const;
const previousEnv: Partial<Record<(typeof envKeys)[number], string | undefined>> = {};
for (const key of envKeys) previousEnv[key] = process.env[key];
function writeEnv(key: string, value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env[key];
  else env[key] = value;
}
writeEnv("NODE_ENV", "test");
writeEnv("SITE_STORE", undefined);
writeEnv("DEEPSEEK_API_KEY", "sk-test-chat-layouts-not-real");
writeEnv("DEEPSEEK_MODEL", "test-chat-layouts-model");
writeEnv("DEEPSEEK_BASE_URL", "https://chat-layouts-stub.test.invalid");
writeEnv("AI_API_KEY", undefined);
writeEnv("AI_MODEL", undefined);
writeEnv("AI_BASE_URL", undefined);

const setLayout = (block: string, variant: string | null) => ({ op: "set_block_variant", block, variant });
const industrialProducts = packDraft("industrial").products;

const originalFetch = globalThis.fetch;
const stubBase = "https://chat-layouts-stub.test.invalid/";
const bodies: string[] = [];
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith(stubBase)) throw new Error(`refusing unexpected fetch ${url}`);
  const raw = typeof init?.body === "string" ? init.body : "";
  bodies.push(raw);
  let payload: Record<string, unknown> = { type: "answer", text: "unexpected request" };
  if (raw.includes("ALIGN_LAYOUT_LOOK_7302")) {
    payload = {
      type: "edit",
      summary: "按资料生成工程工业首页",
      operations: [
        { op: "set_text", target: "companyName", value: simulatedPacks.industrial.companyName },
        { op: "set_text", target: "contact.email", value: simulatedPacks.industrial.email },
        { op: "replace_products", products: industrialProducts },
        setLayout("products", "compare"),
        setLayout("hero", "statement"),
        setLayout("contact", "band"),
      ],
    };
  } else if (raw.includes("CHAT_LAYOUT_REFUSE_7302")) {
    payload = { type: "edit", summary: "已把产品改成参数对比表", operations: [setLayout("products", "compare")] };
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
    let file = abs;
    if (existsSync(`${abs}.ts`)) file = `${abs}.ts`;
    else if (existsSync(path.join(abs, "index.ts"))) file = path.join(abs, "index.ts");
    return nextResolve(pathToFileURL(file).href, context);
  },
});

const { POST } = await import(pathToFileURL(path.join(process.cwd(), "app/api/sites/[siteId]/chat/route.ts")).href) as {
  POST: (request: Request, context: { params: Promise<{ siteId: string }> }) => Promise<Response>;
};
const { getConversation } = await import("../lib/conversation-store.ts");
const { commitOperations, createSite, moveHistory } = await import("../lib/site-store.ts");

const created = new Set<string>();
function uniqueSiteId() {
  const siteId = `t053chat-${crypto.randomUUID()}`;
  created.add(siteId);
  return siteId;
}

test.after(async () => {
  globalThis.fetch = originalFetch;
  for (const key of envKeys) writeEnv(key, previousEnv[key]);
  await Promise.all([...created].flatMap((siteId) => [
    rm(path.join(process.cwd(), ".sitecraft-data", "sites", `${siteId}.json`), { force: true }),
    rm(path.join(process.cwd(), ".sitecraft-data", "conversations", siteId), { recursive: true, force: true }),
  ]));
});

async function postChat(siteId: string, body: Record<string, unknown>) {
  const response = await POST(new Request(`http://sitecraft.test/api/sites/${siteId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }), { params: Promise.resolve({ siteId }) });
  const text = await response.text();
  const events = text.split("\n\n").map((chunk) => chunk.trim()).filter((line) => line.startsWith("data:")).map((line) => JSON.parse(line.slice(5).trim()) as Record<string, unknown>);
  return { response, done: events.find((event) => event.type === "done") };
}

const systemPrompt = (raw: string) => String((JSON.parse(raw) as { messages: Array<{ role: string; content: string }> }).messages.find((item) => item.role === "system")?.content ?? "");

test("the alignment run plans on the look picked in the card, before that look is saved", async () => {
  const siteId = uniqueSiteId();
  const before = await createSite(siteId);
  assert.equal(before.draft.templateId, "forge", "a new site starts on the bright-product look");
  const message = `ALIGN_LAYOUT_LOOK_7302\n${simulatedPacks.industrial.body}\n目标：展示减速机产品。`;
  const started = await postChat(siteId, { action: "start", message, baseRevision: before.draft.revision });
  const conversationId = String(started.done?.conversationId);
  assert.equal(started.done?.questionId, "style-theme");
  const style = await postChat(siteId, {
    action: "select", conversationId, questionId: String(started.done?.questionId),
    questionRevision: Number(started.done?.questionRevision), optionId: "engineering-industrial",
  });
  assert.equal(style.done?.questionId, "build-plan");
  bodies.length = 0;
  const planned = await postChat(siteId, {
    action: "select", conversationId, questionId: String(style.done?.questionId),
    questionRevision: Number(style.done?.questionRevision), optionId: "no-image",
  });
  assert.equal(planned.done?.awaitingConfirmation, true, `expected a proposal, got ${JSON.stringify(planned.done).slice(0, 300)}`);
  assert.equal(bodies.length, 1);
  assert.match(systemPrompt(bodies[0]), /参数对比表/, "the model plans with the engineering layouts although the saved draft is still on forge");
  assert.equal((await createSite(siteId)).draft.revision, before.draft.revision, "planning does not change the draft");

  const proposal = (await getConversation(siteId, conversationId))?.alignment.proposedChange;
  assert.ok(proposal);
  const layouts = proposal.operations.filter((operation) => operation.op === "set_block_variant");
  assert.deepEqual(layouts, [setLayout("products", "compare"), setLayout("hero", "statement")], "layouts the materials support are kept; the contact band is not");
  assert.deepEqual(proposal.operations[0], { op: "set_visual_brief", briefId: "engineering-industrial" });
  assert.equal(proposal.summary, "将修改：样子、公司名、询盘邮箱、产品、产品布局、首屏布局");

  const confirmed = await postChat(siteId, {
    action: "confirm", conversationId, questionId: String(planned.done?.questionId),
    questionRevision: Number(planned.done?.questionRevision),
  });
  assert.equal(confirmed.done?.status, "applied");
  const after = await createSite(siteId);
  assert.equal(after.draft.templateId, "screwfast");
  assert.deepEqual(after.draft.blockVariants, { products: "compare", hero: "statement" });
  assert.ok(after.history[0].appliedTargets.includes("blockVariants.products"));

  const undone = await moveHistory(siteId, "undo");
  assert.equal(undone.status, "applied");
  const restored = await createSite(siteId);
  assert.deepEqual(restored.draft.blockVariants, {});
  assert.equal(restored.draft.templateId, "forge");
});

test("a saved change that leaves the chosen layout short says so in the history and undoes back", async () => {
  const siteId = uniqueSiteId();
  const initial = await createSite(siteId);
  const seeded = await commitOperations({
    siteId, baseRevision: initial.draft.revision, source: "manual", summary: "P3I 资料，产品用参数对比表",
    operations: [
      { op: "replace_draft", draft: { ...packDraft("industrial"), revision: initial.draft.revision } },
      setLayout("products", "compare") as never,
    ],
  });
  assert.equal(seeded.status, "applied");
  assert.deepEqual((await createSite(siteId)).draft.blockVariants, { products: "compare" });
  const fewer = structuredClone(industrialProducts);
  fewer[1].specs = fewer[1].specs!.slice(0, 2);
  const current = await createSite(siteId);
  const imported = await commitOperations({
    siteId, baseRevision: current.draft.revision, source: "import", summary: "导入商品表格",
    operations: [{ op: "replace_products", products: fewer }],
  });
  assert.equal(imported.status, "applied");
  if (imported.status !== "applied") throw new Error("expected applied");
  assert.equal(imported.changeSet.summary, "导入商品表格。参数对比表要 2–4 个产品共有至少 3 项都有数值的同名参数；现在只共有 2 项（速比范围、额定输出扭矩），产品改回产品卡片。");
  assert.ok(imported.changeSet.appliedTargets.includes("blockVariants.products"));
  assert.deepEqual((await createSite(siteId)).draft.blockVariants, {});
  assert.equal((await moveHistory(siteId, "undo")).status, "applied");
  const restored = await createSite(siteId);
  assert.deepEqual(restored.draft.blockVariants, { products: "compare" });
  assert.deepEqual(restored.draft.products, industrialProducts);
});

test("a chat request for a layout the materials do not support changes nothing and says why", async () => {
  const siteId = uniqueSiteId();
  const initial = await createSite(siteId);
  const seeded = await commitOperations({
    siteId, baseRevision: initial.draft.revision, source: "manual", summary: "P3E 资料",
    operations: [{ op: "replace_draft", draft: { ...packDraft("export"), revision: initial.draft.revision } }],
  });
  assert.equal(seeded.status, "applied");
  const current = await createSite(siteId);
  const result = await postChat(siteId, { baseRevision: current.draft.revision, message: "CHAT_LAYOUT_REFUSE_7302 产品改成参数对比表" });
  assert.equal(result.done?.status, "no_change", JSON.stringify(result.done).slice(0, 300));
  assert.equal(result.done?.summary, "参数对比表要 2–4 个产品共有至少 3 项都有数值的同名参数；现在只共有 2 项（额定压力、主体材质），产品仍按产品卡片显示。");
  const after = await createSite(siteId);
  assert.equal(after.draft.revision, current.draft.revision);
  assert.deepEqual(after.draft.blockVariants, {});
});
