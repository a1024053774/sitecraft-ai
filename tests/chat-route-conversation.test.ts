import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
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
let providerFetchCount = 0;
let lastChatFetchBody = "";
const hitlCallCounts = new Map<string, number>();
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.includes("api.deepseek.com") || !url.startsWith(stubBase)) {
    throw new Error(`refusing unexpected fetch ${url}`);
  }
  providerFetchCount += 1;
  const raw = typeof init?.body === "string" ? init.body : "";
  lastChatFetchBody = raw;
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
  } else if (raw.includes("ALIGN_HITL_ALPHA_4401")) {
    const n = (hitlCallCounts.get("alpha") ?? 0) + 1;
    hitlCallCounts.set("alpha", n);
    payload = n === 1
      ? {
        type: "clarify",
        question: "ALIGN_HITL_ALPHA_Q_4401 先改哪一块？",
        options: ["ALIGN_HITL_ALPHA_OPT_4401"],
      }
      : {
        type: "edit",
        summary: "ALIGN_HITL_ALPHA_SUMMARY_4401",
        operations: [{
          op: "set_text",
          target: "hero.title",
          locale: "zh",
          value: "ALIGN_HITL_ALPHA_TITLE_4401",
        }],
      };
  } else if (raw.includes("ALIGN_HITL_BETA_4401")) {
    const n = (hitlCallCounts.get("beta") ?? 0) + 1;
    hitlCallCounts.set("beta", n);
    payload = n === 1
      ? {
        type: "clarify",
        question: "ALIGN_HITL_BETA_Q_4401 联系方式怎么写？",
        options: ["ALIGN_HITL_BETA_OPT_4401"],
      }
      : {
        type: "edit",
        summary: "ALIGN_HITL_BETA_SUMMARY_4401",
        operations: [{
          op: "set_text",
          target: "hero.subtitle",
          locale: "zh",
          value: "ALIGN_HITL_BETA_SUB_4401",
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
const { commitOperations, getSite } = await import("../lib/site-store.ts");

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
  let json: Record<string, unknown> | null = null;
  if (!events.length) {
    try { json = JSON.parse(text) as Record<string, unknown>; } catch { json = null; }
  }
  return { response, text, events, done, json };
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
  return {
    persistFailed,
    treatsDraftAsSaved: status === "applied" && pageSource.includes("adoptSnapshot") && pageSource.includes("已保存"),
    claimsNoDraftChange: status === "error" && pageSource.includes("本次没有修改草稿"),
    showsConversationWarning: persistFailed && pageSource.includes("conversationPersisted === false") && pageSource.includes('status: "warning"'),
    appliedBranchClaimsNoDraftChange: status === "applied" && /status === "applied"[\s\S]*本次没有修改草稿/.test(pageSource) === false ? false : false,
    answerBranchSwallowsResult: persistFailed && status === "answer" && !pageSource.includes("done.text") && !pageSource.includes("doneEvent.text"),
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
  assert.equal(pageSource.includes("本次没有修改草稿"), false);
  assert.equal(pageSource.includes("请以服务器草稿和恢复状态为准"), true);
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

function alignmentOptionsFrom(result: { events: Array<Record<string, unknown>>; done?: Record<string, unknown> }) {
  const event = [...result.events].reverse().find((item) => item.type === "alignment") ?? result.done;
  const options = Array.isArray(event?.options) ? event.options as Array<{ id?: string; label?: string }> : [];
  return options;
}

function asOptionCards(done?: Record<string, unknown> | null) {
  const options = Array.isArray(done?.options) ? done.options as Array<{ id?: string; label?: string }> : [];
  return options.filter((option): option is { id: string; label?: string } => typeof option.id === "string");
}

test("ordinary chat without alignment action does not persist enabled alignment", async () => {
  const siteId = uniqueSiteId();
  const message = "CHAT_SENTINEL_ANSWER_7730 ALIGN_ABSENT_PATH_SENTINEL_9188 这个网站的公司名称是什么？";
  const beforeFetch = providerFetchCount;
  const result = await postChat(siteId, { baseRevision: 1, message });
  assert.ok(result.done);
  assert.equal(result.done.status, "answer");
  assert.ok(providerFetchCount > beforeFetch);

  const conversationId = String(result.done.conversationId);
  const filePath = path.join(conversationDir(siteId), `${conversationId}.json`);
  const raw = JSON.parse(await readFile(filePath, "utf8")) as {
    turns?: Array<{ userMessage?: string }>;
    alignment?: { enabled?: boolean; state?: string; confirmedSummary?: string | null };
  };
  assert.equal(raw.turns?.some((turn) => turn.userMessage?.includes("ALIGN_ABSENT_PATH_SENTINEL_9188")), true);
  assert.notEqual(raw.alignment?.enabled, true);
  assert.notEqual(raw.alignment?.state, "confirmed");
  assert.equal(raw.alignment?.confirmedSummary ?? null, null);
});

test("alignment start returns style options without calling the provider or changing the draft", async () => {
  const siteId = uniqueSiteId();
  const before = await getSite(siteId);
  const beforeFetch = providerFetchCount;
  const result = await postChat(siteId, { action: "start" });

  assert.equal(result.response.status, 200);
  assert.equal(result.response.headers.get("content-type")?.includes("text/event-stream"), true);
  assert.equal(providerFetchCount, beforeFetch);
  const alignmentEvent = result.events.find((event) => event.type === "alignment");
  assert.ok(alignmentEvent);
  assert.equal(alignmentEvent.action, "start");
  assert.equal(alignmentEvent.waitingForUser, true);
  const labels = alignmentOptionsFrom(result).map((option) => option.label);
  assert.equal(labels.includes("工业专业"), true);
  assert.equal(labels.includes("外贸目录"), true);
  assert.equal(labels.includes("技术产品"), true);
  assert.equal(labels.includes("专业顾问"), true);
  assert.ok(result.done);
  assert.equal(result.done.status, "alignment");
  assert.equal(result.done.action, "start");
  assert.notEqual(result.done.status, "applied");
  assert.equal(typeof result.done.conversationId, "string");
  assert.equal("changeSet" in result.done, false);

  const after = await getSite(siteId);
  assert.equal(after.draft.revision, before.draft.revision);
  assert.deepEqual(after.draft, before.draft);

  const record = await getConversation(siteId, String(result.done.conversationId));
  assert.ok(record);
  assert.equal(record.alignment?.enabled, true);
  assert.equal(record.alignment?.state, "awaiting_style");
});

test("alignment select is idempotent and rejects stale or unknown options without changing the draft", async () => {
  const siteId = uniqueSiteId();
  const before = await getSite(siteId);
  const started = await postChat(siteId, { action: "start" });
  const conversationId = String(started.done?.conversationId);
  const questionId = String(started.done?.questionId);
  const questionRevision = Number(started.done?.questionRevision);

  const unknown = await postChat(siteId, {
    action: "select",
    conversationId,
    questionId,
    questionRevision,
    optionId: "ALIGN_UNKNOWN_OPTION_9188",
  });
  assert.equal(unknown.response.status, 400);
  assert.equal(unknown.json?.error, "invalid_option");

  const stale = await postChat(siteId, {
    action: "select",
    conversationId,
    questionId,
    questionRevision: questionRevision - 1,
    optionId: "industrial",
  });
  assert.equal(stale.response.status, 409);
  assert.equal(stale.json?.error, "stale_question");

  const selected = await postChat(siteId, {
    action: "select",
    conversationId,
    questionId,
    questionRevision,
    optionId: "industrial",
  });
  assert.equal(selected.response.status, 200);
  assert.equal(selected.done?.status, "alignment");
  assert.equal(selected.done?.saved, true);
  assert.equal(selected.done?.prefsOnly, true);
  assert.equal(selected.done?.waitingForUser, false);
  assert.match(String(selected.done?.summary || ""), /偏好已保存|工业专业/);

  const again = await postChat(siteId, {
    action: "select",
    conversationId,
    questionId,
    questionRevision,
    optionId: "industrial",
  });
  assert.equal(again.response.status, 200);
  assert.equal(again.done?.saved, true);
  assert.equal(again.done?.prefsOnly, true);

  const after = await getSite(siteId);
  assert.equal(after.draft.revision, before.draft.revision);
});

test("alignment HITL continues the saved task through clarify, proposal, and confirm without a new chat", async () => {
  const siteId = uniqueSiteId();
  const before = await getSite(siteId);
  const task = "ALIGN_HITL_ALPHA_4401 把首屏改成工厂目录风格";
  const started = await postChat(siteId, {
    action: "start",
    message: task,
    baseRevision: before.draft.revision,
  });
  const conversationId = String(started.done?.conversationId);
  const questionId = String(started.done?.questionId);
  const questionRevision = Number(started.done?.questionRevision);
  assert.equal(started.done?.pendingMessage, task);
  assert.equal(started.done?.waitingForUser, true);
  assert.equal(typeof started.done?.questionId, "string");

  const beforeStyleFetch = providerFetchCount;
  const styled = await postChat(siteId, {
    action: "select",
    conversationId,
    questionId,
    questionRevision,
    optionId: "industrial",
  });
  assert.ok(providerFetchCount > beforeStyleFetch);
  assert.equal(styled.done?.status, "clarify");
  assert.match(String(styled.done?.question || ""), /ALIGN_HITL_ALPHA_Q_4401/);
  const clarifyOptions = asOptionCards(styled.done);
  assert.ok(clarifyOptions[0]?.id.startsWith("opt-"));
  assert.equal(styled.done?.pendingMessage, task);
  assert.equal((await getSite(siteId)).draft.revision, before.draft.revision);

  const restoredQuestion = await postChat(siteId, { action: "state", conversationId });
  assert.equal(restoredQuestion.done?.pendingMessage, task);
  assert.equal(restoredQuestion.done?.questionId, styled.done?.questionId);
  assert.equal(restoredQuestion.done?.questionRevision, styled.done?.questionRevision);

  const answered = await postChat(siteId, {
    action: "select",
    conversationId,
    questionId: String(styled.done?.questionId),
    questionRevision: Number(styled.done?.questionRevision),
    optionId: clarifyOptions[0].id,
  });
  assert.equal(answered.done?.status, "alignment");
  assert.equal(answered.done?.awaitingConfirmation, true);
  assert.match(String(answered.done?.summary || answered.done?.question || ""), /ALIGN_HITL_ALPHA_SUMMARY_4401/);
  assert.equal((await getSite(siteId)).draft.revision, before.draft.revision);

  const restoredConfirm = await postChat(siteId, { action: "state", conversationId });
  assert.equal(restoredConfirm.done?.awaitingConfirmation, true);
  assert.equal(restoredConfirm.done?.questionId, answered.done?.questionId);
  assert.equal(restoredConfirm.done?.pendingMessage, task);

  const bypass = await postChat(siteId, {
    baseRevision: before.draft.revision,
    message: "CHAT_SENTINEL_ANSWER_7730 ALIGN_BYPASS_4401 这个网站的公司名称是什么？",
    conversationId,
  });
  assert.equal(bypass.response.status, 409);
  assert.equal(bypass.json?.error, "alignment_pending");
  assert.equal((await getSite(siteId)).draft.revision, before.draft.revision);

  const staleConfirm = await postChat(siteId, {
    action: "confirm",
    conversationId,
    questionId: String(answered.done?.questionId),
    questionRevision: Number(answered.done?.questionRevision) - 1,
  });
  assert.equal(staleConfirm.response.status, 409);
  assert.equal(staleConfirm.json?.error, "stale_question");
  assert.equal((await getSite(siteId)).draft.revision, before.draft.revision);

  const confirmed = await postChat(siteId, {
    action: "confirm",
    conversationId,
    questionId: String(answered.done?.questionId),
    questionRevision: Number(answered.done?.questionRevision),
  });
  assert.equal(confirmed.done?.status, "applied");
  assert.equal((confirmed.done?.draft as { content?: { hero?: { title?: { zh?: string } } } } | undefined)?.content?.hero?.title?.zh, "ALIGN_HITL_ALPHA_TITLE_4401");
  const appliedRevision = Number((confirmed.done?.draft as { revision?: number } | undefined)?.revision);
  assert.ok(appliedRevision > before.draft.revision);

  const duplicate = await postChat(siteId, {
    action: "confirm",
    conversationId,
    questionId: String(answered.done?.questionId),
    questionRevision: Number(answered.done?.questionRevision),
  });
  assert.equal(duplicate.done?.status, "applied");
  assert.ok(duplicate.done?.changeSet, "replayed applied response must include the changeSet consumed by workspace UI");
  assert.equal(Number((duplicate.done?.draft as { revision?: number } | undefined)?.revision), appliedRevision);

  const after = await getSite(siteId);
  assert.equal(after.draft.revision, appliedRevision);
  assert.equal(after.draft.content.hero.title.zh, "ALIGN_HITL_ALPHA_TITLE_4401");
});

test("alignment confirm conflicts when the draft revision changes, and cancel does not replay", async () => {
  const siteId = uniqueSiteId();
  const before = await getSite(siteId);
  const started = await postChat(siteId, {
    action: "start",
    message: "ALIGN_HITL_BETA_4401 改联系区说明",
    baseRevision: before.draft.revision,
  });
  const conversationId = String(started.done?.conversationId);
  const styled = await postChat(siteId, {
    action: "select",
    conversationId,
    questionId: String(started.done?.questionId),
    questionRevision: Number(started.done?.questionRevision),
    optionId: "advisor",
  });
  const clarifyOptions = asOptionCards(styled.done);
  const proposed = await postChat(siteId, {
    action: "select",
    conversationId,
    questionId: String(styled.done?.questionId),
    questionRevision: Number(styled.done?.questionRevision),
    optionId: clarifyOptions[0].id,
  });
  assert.equal(proposed.done?.awaitingConfirmation, true);

  await commitOperations({
    siteId,
    baseRevision: before.draft.revision,
    operations: [{ op: "set_text", target: "hero.title", locale: "zh", value: "ALIGN_MANUAL_CONFLICT_4401" }],
    summary: "manual conflict",
    source: "manual",
  });
  const conflicted = await postChat(siteId, {
    action: "confirm",
    conversationId,
    questionId: String(proposed.done?.questionId),
    questionRevision: Number(proposed.done?.questionRevision),
  });
  assert.equal(conflicted.done?.status, "conflict");
  const afterConflict = await getSite(siteId);
  assert.equal(afterConflict.draft.content.hero.title.zh, "ALIGN_MANUAL_CONFLICT_4401");
  assert.notEqual(afterConflict.draft.content.hero.subtitle.zh, "ALIGN_HITL_BETA_SUB_4401");

  const otherSite = uniqueSiteId();
  const otherBefore = await getSite(otherSite);
  const otherStart = await postChat(otherSite, {
    action: "start",
    message: "ALIGN_HITL_BETA_4401 第二个任务",
    baseRevision: otherBefore.draft.revision,
  });
  const otherId = String(otherStart.done?.conversationId);
  const otherStyled = await postChat(otherSite, {
    action: "select",
    conversationId: otherId,
    questionId: String(otherStart.done?.questionId),
    questionRevision: Number(otherStart.done?.questionRevision),
    optionId: "advisor",
  });
  const cancelled = await postChat(otherSite, { action: "cancel", conversationId: otherId });
  assert.equal(cancelled.done?.action, "cancel");
  const staleAfterCancel = await postChat(otherSite, {
    action: "confirm",
    conversationId: otherId,
    questionId: String(otherStyled.done?.questionId),
    questionRevision: Number(otherStyled.done?.questionRevision),
  });
  assert.equal(staleAfterCancel.response.status, 400);
  lastChatFetchBody = "";
  const afterCancel = await postChat(otherSite, {
    baseRevision: otherBefore.draft.revision,
    message: "CHAT_SENTINEL_ANSWER_7730 ALIGN_AFTER_CANCEL_9188 这个网站的公司名称是什么？",
    conversationId: otherId,
  });
  assert.equal(afterCancel.done?.status, "answer");
  assert.equal(lastChatFetchBody.includes("专业顾问"), false);
  assert.equal((await getSite(otherSite)).draft.revision, otherBefore.draft.revision);
});

test("two unrelated alignment tasks produce corresponding model questions and results", async () => {
  const siteA = uniqueSiteId();
  const siteB = uniqueSiteId();
  const beforeA = await getSite(siteA);
  const beforeB = await getSite(siteB);
  hitlCallCounts.clear();

  const startA = await postChat(siteA, {
    action: "start",
    message: "ALIGN_HITL_ALPHA_4401 工厂任务",
    baseRevision: beforeA.draft.revision,
  });
  const startB = await postChat(siteB, {
    action: "start",
    message: "ALIGN_HITL_BETA_4401 顾问任务",
    baseRevision: beforeB.draft.revision,
  });
  const styleA = await postChat(siteA, {
    action: "select",
    conversationId: String(startA.done?.conversationId),
    questionId: String(startA.done?.questionId),
    questionRevision: Number(startA.done?.questionRevision),
    optionId: "industrial",
  });
  const styleB = await postChat(siteB, {
    action: "select",
    conversationId: String(startB.done?.conversationId),
    questionId: String(startB.done?.questionId),
    questionRevision: Number(startB.done?.questionRevision),
    optionId: "advisor",
  });
  assert.match(String(styleA.done?.question || ""), /ALIGN_HITL_ALPHA_Q_4401/);
  assert.match(String(styleB.done?.question || ""), /ALIGN_HITL_BETA_Q_4401/);
  assert.equal(String(styleA.done?.question || "").includes("ALIGN_HITL_BETA_Q_4401"), false);
  assert.equal(String(styleB.done?.question || "").includes("ALIGN_HITL_ALPHA_Q_4401"), false);

  const answerA = await postChat(siteA, {
    action: "select",
    conversationId: String(startA.done?.conversationId),
    questionId: String(styleA.done?.questionId),
    questionRevision: Number(styleA.done?.questionRevision),
    optionId: asOptionCards(styleA.done)[0].id,
  });
  const answerB = await postChat(siteB, {
    action: "select",
    conversationId: String(startB.done?.conversationId),
    questionId: String(styleB.done?.questionId),
    questionRevision: Number(styleB.done?.questionRevision),
    optionId: asOptionCards(styleB.done)[0].id,
  });
  assert.match(String(answerA.done?.summary || answerA.done?.question || ""), /ALIGN_HITL_ALPHA_SUMMARY_4401/);
  assert.match(String(answerB.done?.summary || answerB.done?.question || ""), /ALIGN_HITL_BETA_SUMMARY_4401/);
});

test("alignment recovers a committed proposal after the conversation result write is lost", async () => {
  const siteId = uniqueSiteId();
  const started = await postChat(siteId, { action: "start", message: "RECOVERY_EXACT_PROPOSAL_5927", baseRevision: 1 });
  const conversationId = String(started.done?.conversationId);
  const proposed = await postChat(siteId, {
    action: "select", conversationId, questionId: started.done?.questionId,
    questionRevision: started.done?.questionRevision, optionId: "industrial",
  });
  const record = await getConversation(siteId, conversationId);
  assert.ok(record?.alignment.proposedChange);
  const committed = await postChat(siteId, {
    action: "confirm", conversationId, questionId: proposed.done?.questionId,
    questionRevision: proposed.done?.questionRevision,
  });
  assert.equal(committed.done?.status, "applied");
  // Restore the exact durable pre-result conversation, as if the process stopped
  // after committing the draft but before saving the conversation result.
  record.alignment.confirmClaimed = true;
  await writeFile(path.join(conversationDir(siteId), `${conversationId}.json`), JSON.stringify(record), "utf8");
  const restored = await postChat(siteId, { action: "state", conversationId });
  const view = restored.done?.alignment as { lastResult?: { status?: string }; waitingForUser?: boolean };
  assert.equal(view.lastResult?.status, "applied", "state restore must use the saved draft receipt, not leave confirmation stuck");
  assert.equal(view.waitingForUser, false);
  assert.equal((await getSite(siteId)).draft.revision, 2);
  assert.equal((await getSite(siteId)).history.length, 1);
});

test("state resumes an already confirmed proposal if the process stopped before its draft commit", async () => {
  const siteId = uniqueSiteId();
  const started = await postChat(siteId, { action: "start", message: "CLAIM_BEFORE_COMMIT_5927", baseRevision: 1 });
  const conversationId = String(started.done?.conversationId);
  await postChat(siteId, { action: "select", conversationId, questionId: started.done?.questionId,
    questionRevision: started.done?.questionRevision, optionId: "industrial" });
  const record = await getConversation(siteId, conversationId);
  assert.ok(record?.alignment.proposedChange);
  record.alignment.confirmClaimed = true;
  await writeFile(path.join(conversationDir(siteId), `${conversationId}.json`), JSON.stringify(record), "utf8");
  const states = await Promise.all(Array.from({ length: 4 }, () => postChat(siteId, { action: "state", conversationId })));
  assert.ok(states.every((item) => item.done?.status !== "conflict"), "recovery cannot overwrite applied with conflict");
  assert.equal((await getSite(siteId)).draft.revision, 2, "an authorized but interrupted commit must finish");
  assert.equal((await getSite(siteId)).history.length, 1);
  assert.equal((await getConversation(siteId, conversationId))?.alignment.lastResult?.status, "applied");
});

test("recovering a lost confirmation result after undo does not report the undone change as applied", async () => {
  const siteId = uniqueSiteId();
  const started = await postChat(siteId, { action: "start", message: "UNDONE_RECEIPT_5927", baseRevision: 1 });
  const conversationId = String(started.done?.conversationId);
  const proposed = await postChat(siteId, { action: "select", conversationId, questionId: started.done?.questionId,
    questionRevision: started.done?.questionRevision, optionId: "industrial" });
  const claimed = await getConversation(siteId, conversationId);
  assert.ok(claimed?.alignment.proposedChange);
  const applied = await postChat(siteId, { action: "confirm", conversationId, questionId: proposed.done?.questionId,
    questionRevision: proposed.done?.questionRevision });
  assert.equal(applied.done?.status, "applied");
  const { moveHistory } = await import("../lib/site-store.ts");
  await moveHistory(siteId, "undo");
  const undone = await getSite(siteId);
  claimed.alignment.confirmClaimed = true;
  await writeFile(path.join(conversationDir(siteId), `${conversationId}.json`), JSON.stringify(claimed), "utf8");
  const recovered = await postChat(siteId, { action: "state", conversationId });
  assert.equal(recovered.done?.status, "conflict", "an undone receipt must not be reported as currently applied");
  assert.equal((recovered.done?.draft as { revision?: number })?.revision, undone.draft.revision);
  assert.equal((await getSite(siteId)).draft.content.hero.title.zh, undone.draft.content.hero.title.zh);
});

test("cancel suppresses a late provider answer and preserves the saved cancellation", async () => {
  const siteId = uniqueSiteId();
  const started = await postChat(siteId, { action: "start", message: "LATE_ANSWER_5927", baseRevision: 1 });
  const conversationId = String(started.done?.conversationId);
  const previousFetch = globalThis.fetch;
  let release!: () => void;
  let entered!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const providerEntered = new Promise<void>((resolve) => { entered = resolve; });
  globalThis.fetch = async () => {
    entered();
    await pending;
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ type: "answer", text: "LATE_CANCELLED_ANSWER_5927" }) } }] }));
  };
  try {
    const selecting = postChat(siteId, {
      action: "select", conversationId, questionId: started.done?.questionId,
      questionRevision: started.done?.questionRevision, optionId: "advisor",
    });
    await providerEntered;
    const cancelled = await postChat(siteId, { action: "cancel", conversationId });
    assert.equal((cancelled.done?.alignment as { state?: string })?.state, "cancelled");
    release();
    const late = await selecting;
    assert.equal(late.events.some((item) => item.type === "answer"), false, "cancelled provider output must not reach the UI");
    assert.equal((await getConversation(siteId, conversationId))?.turns.length, 0);
    assert.equal((await getSite(siteId)).draft.revision, 1);
  } finally {
    release();
    globalThis.fetch = previousFetch;
  }
});

test("alignment state restore uses the same POST action and does not create a missing conversation", async () => {
  const siteId = uniqueSiteId();
  const started = await postChat(siteId, { action: "start" });
  const conversationId = String(started.done?.conversationId);
  const restored = await postChat(siteId, { action: "state", conversationId });
  assert.equal(restored.response.status, 200);
  assert.equal(restored.done?.action, "state");
  assert.equal(restored.done?.conversationId, conversationId);
  assert.equal((restored.done?.alignment as { enabled?: boolean } | undefined)?.enabled, true);

  const missing = await postChat(siteId, { action: "state", conversationId: "align-missing-9188" });
  assert.equal(missing.response.status, 404);
  assert.equal(missing.json?.error, "conversation_not_found");
  assert.equal(await getConversation(siteId, "align-missing-9188"), null);

  const missingStart = await postChat(siteId, { action: "start", conversationId: "align-missing-start-9188" });
  assert.equal(missingStart.response.status, 404);
  assert.equal(await getConversation(siteId, "align-missing-start-9188"), null);

  const missingSelect = await postChat(siteId, { action: "select", questionId: "style-theme", questionRevision: 1, optionId: "industrial" });
  assert.equal(missingSelect.response.status, 400);
  assert.equal(missingSelect.json?.error, "conversation_id_required");

  const pageSource = await readFile(path.join(process.cwd(), "app/workspace/page.tsx"), "utf8");
  assert.match(pageSource, /需求对齐/);
  assert.match(pageSource, /action:\s*"state"/);
  assert.match(pageSource, /等待你选择/);
  assert.match(pageSource, /偏好已保存/);
  assert.equal(pageSource.includes("下一次生成会使用此方向"), false);
  assert.equal(pageSource.includes("Impeccable"), false);
  assert.equal(pageSource.includes("UI UX Pro Max"), false);
  const plusSlice = pageSource.slice(pageSource.indexOf("需求对齐") - 400, pageSource.indexOf("需求对齐") + 400);
  assert.equal(/skill/i.test(plusSlice), false);
  assert.match(pageSource, /status === "alignment"/);
  assert.match(pageSource, /consumeSseFrames/);
});
