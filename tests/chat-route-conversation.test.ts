import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const envKeys = [
  "SITE_STORE",
  "NODE_ENV",
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_MODEL",
  "DEEPSEEK_BASE_URL",
  "DEEPSEEK_MAX_TOKENS",
  "AI_API_KEY",
  "AI_MODEL",
  "AI_BASE_URL",
  "DEFAULT_WORKSPACE_ID",
] as const;
const previousEnv: Partial<Record<(typeof envKeys)[number], string | undefined>> = {};
for (const key of envKeys) previousEnv[key] = process.env[key];

function writeEnv(key: string, value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env[key];
  else env[key] = value;
}

writeEnv("NODE_ENV", "test");
writeEnv("SITE_STORE", undefined);
writeEnv("DEEPSEEK_API_KEY", "sk-test-chat-route-not-real");
writeEnv("DEEPSEEK_MODEL", "test-chat-model");
writeEnv("DEEPSEEK_BASE_URL", "https://chat-stub.test.invalid");
writeEnv("AI_API_KEY", undefined);
writeEnv("AI_MODEL", undefined);
writeEnv("AI_BASE_URL", undefined);

const originalFetch = globalThis.fetch;
const stubBase = "https://chat-stub.test.invalid/";
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.includes("api.deepseek.com") || !url.startsWith(stubBase)) {
    throw new Error(`refusing unexpected fetch ${url}`);
  }
  const raw = typeof init?.body === "string" ? init.body : "";
  let payload: Record<string, unknown>;
  if (raw.includes("CHAT_SENTINEL_ANSWER_7730")) {
    payload = { type: "answer", text: "CHAT_SENTINEL_ANSWER_TEXT_7730" };
  } else if (raw.includes("CHAT_SENTINEL_CLARIFY_7730")) {
    payload = {
      type: "clarify",
      question: "CHAT_SENTINEL_CLARIFY_Q_7730",
      options: ["CHAT_SENTINEL_OPT_A_7730", "CHAT_SENTINEL_OPT_B_7730"],
    };
  } else if (raw.includes("CHAT_SENTINEL_PERSIST_8812")) {
    payload = {
      type: "edit",
      summary: "CHAT_SENTINEL_PERSIST_SUMMARY_8812",
      operations: [{
        op: "set_text",
        target: "hero.title",
        locale: "zh",
        value: "CHAT_SENTINEL_PERSIST_TITLE_8812",
      }],
    };
  } else {
    const beta = raw.includes("CHAT_SENTINEL_USER_BETA_6621");
    payload = {
      type: "edit",
      summary: beta ? "CHAT_SENTINEL_SUMMARY_BETA_6621" : "CHAT_SENTINEL_SUMMARY_ALPHA_6621",
      operations: [{
        op: "set_text",
        target: beta ? "hero.subtitle" : "hero.title",
        locale: "zh",
        value: beta ? "CHAT_SENTINEL_SUB_6621" : "CHAT_SENTINEL_TITLE_6621",
      }],
    };
  }
  return new Response(JSON.stringify({
    choices: [{ finish_reason: "stop", message: { content: JSON.stringify(payload) } }],
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

const { POST } = await import(pathToFileURL(path.join(process.cwd(), "app/api/sites/[siteId]/chat/route.ts")).href) as {
  POST: (request: Request, context: { params: Promise<{ siteId: string }> }) => Promise<Response>;
};
const { getConversation } = await import("../lib/conversation-store.ts");
const { getSite } = await import("../lib/site-store.ts");

const createdSiteIds = new Set<string>();

function uniqueSiteId() {
  const siteId = `t2chat-${crypto.randomUUID()}`;
  createdSiteIds.add(siteId);
  return siteId;
}

async function cleanupCreatedFiles() {
  await Promise.all([...createdSiteIds].flatMap((siteId) => [
    rm(path.join(process.cwd(), ".sitecraft-data", "sites", `${siteId}.json`), { force: true }),
    rm(path.join(process.cwd(), ".sitecraft-data", "conversations", siteId), { recursive: true, force: true }),
  ]));
  createdSiteIds.clear();
}

function restoreEnv() {
  for (const key of envKeys) writeEnv(key, previousEnv[key]);
}

function parseSseEvents(payload: string) {
  const events: Array<Record<string, unknown>> = [];
  for (const chunk of payload.split("\n\n")) {
    const line = chunk.trim();
    if (!line.startsWith("data:")) continue;
    events.push(JSON.parse(line.slice("data:".length).trim()) as Record<string, unknown>);
  }
  return events;
}

async function postChat(siteId: string, body: Record<string, unknown>) {
  const response = await POST(
    new Request(`http://sitecraft.test/api/sites/${siteId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ siteId }) },
  );
  const text = await response.text();
  const events = parseSseEvents(text);
  const done = events.find((event) => event.type === "done");
  return { response, text, events, done };
}

function conversationDir(siteId: string) {
  return path.join(process.cwd(), ".sitecraft-data", "conversations", siteId);
}

async function withConversationRemovedDuringModelFetch<T>(siteId: string, task: () => Promise<T>) {
  const nestedFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    assert.equal(existsSync(conversationDir(siteId)), true, "conversation must exist before the model fetch");
    const response = await nestedFetch(input, init);
    await rm(conversationDir(siteId), { recursive: true, force: true });
    assert.equal(existsSync(conversationDir(siteId)), false, "conversation files must be gone before append");
    return response;
  };
  try {
    return await task();
  } finally {
    globalThis.fetch = nestedFetch;
  }
}

function workspaceUiForDoneEvent(done: Record<string, unknown>, pageSource: string) {
  const status = String(done.status);
  const persistFailed = done.conversationPersisted === false;
  const submitChat = pageSource.slice(pageSource.indexOf("const submitChat"), pageSource.indexOf("const handlePreviewReport"));
  const appliedBranch = submitChat.slice(submitChat.indexOf('if (status === "applied")'), submitChat.indexOf('} else if (status === "no_change")'));
  const answerBranch = submitChat.slice(submitChat.indexOf('} else if (status === "answer")'), submitChat.indexOf('} else if (status === "clarify")'));
  const catchBlock = submitChat.slice(submitChat.lastIndexOf("catch (error)"));
  return {
    persistFailed,
    treatsDraftAsSaved: status === "applied" && submitChat.includes("adoptSnapshot") && /已保存/.test(appliedBranch),
    claimsNoDraftChange: status === "error" && catchBlock.includes("本次没有修改草稿"),
    showsConversationWarning: persistFailed && submitChat.includes("conversationPersisted === false") && submitChat.includes('status: "warning"'),
    appliedBranchClaimsNoDraftChange: appliedBranch.includes("本次没有修改草稿"),
    answerBranchSwallowsResult: persistFailed && status === "answer" && !answerBranch.includes("doneEvent.text"),
  };
}

test.after(async () => {
  globalThis.fetch = originalFetch;
  restoreEnv();
  await cleanupCreatedFiles();
});

test("chat POST SSE reuses conversationId across two applied turns", async () => {
  assert.notEqual(process.env.SITE_STORE, "postgres");
  assert.notEqual(process.env.NODE_ENV, "production");
  const siteId = uniqueSiteId();
  const firstMessage = "CHAT_SENTINEL_USER_ALPHA_6621 shorten the hero title";
  const secondMessage = "CHAT_SENTINEL_USER_BETA_6621 rewrite the hero subtitle";

  const first = await postChat(siteId, { baseRevision: 1, message: firstMessage });
  assert.equal(first.response.headers.get("content-type")?.includes("text/event-stream"), true);
  assert.ok(first.done);
  assert.equal(first.done.status, "applied");
  assert.equal(typeof first.done.conversationId, "string");
  const conversationId = String(first.done.conversationId);
  assert.match(conversationId, /^[a-z0-9][a-z0-9_-]{0,79}$/i);
  const draft = first.done.draft as { revision?: unknown } | undefined;
  const revision = Number(draft?.revision);
  assert.equal(Number.isInteger(revision) && revision > 1, true);

  const second = await postChat(siteId, { baseRevision: revision, message: secondMessage, conversationId });
  assert.ok(second.done);
  assert.equal(second.done.status, "applied");
  assert.equal(second.done.conversationId, conversationId);

  const record = await getConversation(siteId, conversationId);
  assert.ok(record);
  assert.equal(record.conversationId, conversationId);
  assert.equal(record.turns.length, 2);
  assert.equal(record.turns.some((turn) => turn.userMessage === firstMessage), true);
  assert.equal(record.turns.some((turn) => turn.userMessage === secondMessage), true);
});

test("chat POST answer does not commit, emits answer then done, and keeps revision", async () => {
  const siteId = uniqueSiteId();
  const before = await getSite(siteId);
  const message = "CHAT_SENTINEL_ANSWER_7730 这个网站的公司名称是什么？";
  const result = await postChat(siteId, { baseRevision: before.draft.revision, message });

  assert.equal(result.response.status, 200);
  assert.ok(result.events.some((event) => event.type === "status"));
  const answer = result.events.find((event) => event.type === "answer");
  assert.ok(answer);
  assert.equal(answer.text, "CHAT_SENTINEL_ANSWER_TEXT_7730");
  assert.ok(result.done);
  assert.equal(result.done.status, "answer");
  assert.equal(result.done.text, "CHAT_SENTINEL_ANSWER_TEXT_7730");
  assert.equal("changeSet" in result.done, false);
  assert.equal(result.done.changeSet, undefined);
  assert.equal(typeof result.done.conversationId, "string");
  assert.equal(result.done.model, "test-chat-model");
  assert.equal(typeof result.done.latencyMs, "number");

  const after = await getSite(siteId);
  assert.equal(after.draft.revision, before.draft.revision);
  assert.deepEqual(after.draft, before.draft);
  assert.equal(after.history.length, 0);

  const record = await getConversation(siteId, String(result.done.conversationId));
  assert.ok(record);
  assert.equal(record.turns.length, 1);
  assert.equal(record.turns[0].outcome, "no_change");
  assert.equal(record.turns[0].appliedOperationsSummary, "not applied: answer");
  assert.equal(record.turns[0].userMessage, message);
});

test("chat POST clarify does not commit, emits clarify then done, and keeps revision", async () => {
  const siteId = uniqueSiteId();
  const before = await getSite(siteId);
  const message = "CHAT_SENTINEL_CLARIFY_7730 把网站改好看点";
  const result = await postChat(siteId, { baseRevision: before.draft.revision, message });

  assert.equal(result.response.status, 200);
  const clarify = result.events.find((event) => event.type === "clarify");
  assert.ok(clarify);
  assert.equal(clarify.question, "CHAT_SENTINEL_CLARIFY_Q_7730");
  assert.deepEqual(clarify.options, ["CHAT_SENTINEL_OPT_A_7730", "CHAT_SENTINEL_OPT_B_7730"]);
  assert.ok(result.done);
  assert.equal(result.done.status, "clarify");
  assert.equal(result.done.question, "CHAT_SENTINEL_CLARIFY_Q_7730");
  assert.deepEqual(result.done.options, ["CHAT_SENTINEL_OPT_A_7730", "CHAT_SENTINEL_OPT_B_7730"]);
  assert.equal("changeSet" in result.done, false);
  assert.equal(result.done.changeSet, undefined);

  const after = await getSite(siteId);
  assert.equal(after.draft.revision, before.draft.revision);
  assert.equal(after.history.length, 0);

  const record = await getConversation(siteId, String(result.done.conversationId));
  assert.ok(record);
  assert.equal(record.turns[0].outcome, "no_change");
  assert.equal(record.turns[0].appliedOperationsSummary, "not applied: clarify");
});

test("chat POST keeps applied result when append fails after a successful commit", async () => {
  const siteId = uniqueSiteId();
  const before = await getSite(siteId);
  const message = "CHAT_SENTINEL_PERSIST_8812 shorten the hero title after persist fault";
  const result = await withConversationRemovedDuringModelFetch(siteId, () => (
    postChat(siteId, { baseRevision: before.draft.revision, message })
  ));

  assert.ok(result.done);
  assert.equal(result.done.status, "applied");
  assert.equal(result.done.conversationPersisted, false);
  assert.equal(typeof result.done.conversationError, "string");
  assert.match(String(result.done.conversationError), /会话写入失败：Conversation not found/);
  assert.equal(result.done.summary, "CHAT_SENTINEL_PERSIST_SUMMARY_8812");
  assert.equal(typeof result.done.conversationId, "string");
  assert.ok(result.done.changeSet);
  assert.ok(result.done.draft);

  const after = await getSite(siteId);
  assert.ok(after.draft.revision > before.draft.revision);
  assert.equal(after.draft.content.hero.title.zh, "CHAT_SENTINEL_PERSIST_TITLE_8812");
  assert.equal((result.done.draft as { revision?: unknown }).revision, after.draft.revision);
  assert.equal(await getConversation(siteId, String(result.done.conversationId)), null);

  const pageSource = await readFile(path.join(process.cwd(), "app/workspace/page.tsx"), "utf8");
  const ui = workspaceUiForDoneEvent(result.done, pageSource);
  assert.equal(ui.persistFailed, true);
  assert.equal(ui.treatsDraftAsSaved, true);
  assert.equal(ui.claimsNoDraftChange, false);
  assert.equal(ui.appliedBranchClaimsNoDraftChange, false);
  assert.equal(ui.showsConversationWarning, true);
  assert.equal(pageSource.includes("本次没有修改草稿"), true);
});

test("chat POST keeps answer when append fails and does not treat it as an error", async () => {
  const siteId = uniqueSiteId();
  const before = await getSite(siteId);
  const message = "CHAT_SENTINEL_ANSWER_7730 这个网站的公司名称是什么？";
  const result = await withConversationRemovedDuringModelFetch(siteId, () => (
    postChat(siteId, { baseRevision: before.draft.revision, message })
  ));

  assert.ok(result.done);
  assert.equal(result.done.status, "answer");
  assert.equal(result.done.text, "CHAT_SENTINEL_ANSWER_TEXT_7730");
  assert.equal(result.done.conversationPersisted, false);
  assert.match(String(result.done.conversationError), /会话写入失败：Conversation not found/);
  assert.equal("changeSet" in result.done, false);

  const after = await getSite(siteId);
  assert.equal(after.draft.revision, before.draft.revision);

  const pageSource = await readFile(path.join(process.cwd(), "app/workspace/page.tsx"), "utf8");
  const ui = workspaceUiForDoneEvent(result.done, pageSource);
  assert.equal(ui.claimsNoDraftChange, false);
  assert.equal(ui.answerBranchSwallowsResult, false);
  assert.equal(ui.showsConversationWarning, true);
});
