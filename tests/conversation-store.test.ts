import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  appendConversationTurn,
  conversationPromptContext,
  createConversation,
  getConversation,
  getOrCreateConversation,
} from "../lib/conversation-store.ts";

const createdSiteIds = new Set<string>();

function uniqueSiteId() {
  const siteId = `t2-${crypto.randomUUID()}`;
  createdSiteIds.add(siteId);
  return siteId;
}

async function cleanupCreatedConversations() {
  await Promise.all([...createdSiteIds].map((siteId) => (
    rm(path.join(process.cwd(), ".sitecraft-data", "conversations", siteId), { recursive: true, force: true })
  )));
  createdSiteIds.clear();
}

test.after(async () => {
  await cleanupCreatedConversations();
});

test("conversation-store tests require the development-file driver", () => {
  assert.notEqual(process.env.SITE_STORE, "postgres");
  assert.notEqual(process.env.NODE_ENV, "production");
});

test("creates a conversation, persists a turn, and rereads the same turns", async () => {
  const siteId = uniqueSiteId();
  const created = await createConversation(siteId);
  assert.match(created.conversationId, /^[a-z0-9][a-z0-9_-]{0,79}$/i);
  assert.equal(created.siteId, siteId);
  assert.deepEqual(created.turns, []);

  const userMessage = "SENTINEL_T2_USER_ORANGE_7719 shorten the hero";
  const aiSummary = "SENTINEL_T2_AI_LIME_7719 updated hero title";
  const appliedOperationsSummary = "SENTINEL_T2_OPS_VIOLET_7719 applied ops=set_text targets=hero.title.zh";
  const saved = await appendConversationTurn({
    siteId,
    conversationId: created.conversationId,
    userMessage,
    aiSummary,
    appliedOperationsSummary,
    outcome: "applied",
  });
  assert.equal(saved.turns.length, 1);
  assert.equal(saved.turns[0].userMessage, userMessage);
  assert.equal(saved.turns[0].aiSummary, aiSummary);
  assert.equal(saved.turns[0].appliedOperationsSummary, appliedOperationsSummary);
  assert.equal(saved.turns[0].outcome, "applied");

  const reread = await getConversation(siteId, created.conversationId);
  assert.ok(reread);
  assert.deepEqual(reread.turns, saved.turns);
  assert.equal(reread.workspaceId, saved.workspaceId);

  const reused = await getOrCreateConversation(siteId, created.conversationId);
  assert.equal(reused.conversationId, created.conversationId);
  assert.equal(reused.turns.length, 1);
  assert.equal(reused.turns.at(0)?.userMessage, userMessage);
});

test("isolates conversations across site ids", async () => {
  const siteA = uniqueSiteId();
  const siteB = uniqueSiteId();
  const conversationA = await createConversation(siteA);
  await appendConversationTurn({
    siteId: siteA,
    conversationId: conversationA.conversationId,
    userMessage: "SENTINEL_T2_SITEA_ONLY_4401 keep this private",
    aiSummary: "site A summary",
    appliedOperationsSummary: "not applied: no_change",
    outcome: "no_change",
  });

  const leaked = await getConversation(siteB, conversationA.conversationId);
  assert.equal(leaked, null);
  const createdB = await getOrCreateConversation(siteB, conversationA.conversationId);
  assert.equal(createdB.conversationId, conversationA.conversationId);
  assert.equal(createdB.siteId, siteB);
  assert.equal(createdB.turns.length, 0);
  const stillA = await getConversation(siteA, conversationA.conversationId);
  assert.ok(stillA?.turns.some((turn) => turn.userMessage.includes("SENTINEL_T2_SITEA_ONLY_4401")));
  assert.equal(createdB.turns.length, 0);
});

test("rejects unsafe ids and truncates overlong untrusted fields observably", async () => {
  const siteId = uniqueSiteId();
  await assert.rejects(() => getConversation("../etc", "abc"), /Invalid site id/);
  await assert.rejects(() => getConversation(siteId, "../escape"), /Invalid conversation id/);
  await assert.rejects(() => getConversation(siteId, "has space"), /Invalid conversation id/);
  await assert.rejects(() => createConversation("a".repeat(81)), /Invalid site id/);

  const created = await createConversation(siteId);
  const overlong = `VISIBLE_HEAD_SENTINEL_T2_9182_${"Z".repeat(20_000)}_VISIBLE_TAIL_SENTINEL_T2_9182`;
  const binary = `keep-start data:image/png;base64,${"A".repeat(8000)} keep-end`;
  await assert.rejects(() => appendConversationTurn({
    siteId,
    conversationId: created.conversationId,
    userMessage: "   ",
    aiSummary: "x",
    appliedOperationsSummary: "y",
    outcome: "error",
  }), /user message/i);

  const saved = await appendConversationTurn({
    siteId,
    conversationId: created.conversationId,
    userMessage: overlong,
    aiSummary: `SUM_${"Q".repeat(4000)}_ENDSUM`,
    appliedOperationsSummary: binary,
    outcome: "error",
  });
  const turn = saved.turns[0];
  assert.ok(turn.userMessage.startsWith("VISIBLE_HEAD_SENTINEL_T2_9182_"));
  assert.equal(turn.userMessage.includes("VISIBLE_TAIL_SENTINEL_T2_9182"), false);
  assert.ok(turn.userMessage.length < overlong.length);
  assert.ok(turn.userMessage.endsWith("…[truncated]"));
  assert.equal(turn.aiSummary.includes("_ENDSUM"), false);
  assert.ok(turn.aiSummary.length < 4000);
  assert.equal(turn.appliedOperationsSummary.includes("A".repeat(50)), false);
  assert.equal(turn.appliedOperationsSummary.includes("keep-start"), true);
  assert.equal(turn.appliedOperationsSummary.includes("keep-end"), true);
});

test("prompt context keeps five recent turns complete and bounds older history", async () => {
  const siteId = uniqueSiteId();
  const conversation = await createConversation(siteId);
  const early = [
    `EARLY0_SENTINEL_T2_${"x".repeat(120)}_END0_UNIQUE`,
    "EARLY1_SENTINEL_T2_BETA_SHOULD_NOT_LEAK_9182",
    "EARLY2_SENTINEL_T2_GAMMA_SHOULD_NOT_LEAK_9182",
  ];
  const recent = [
    "RECENT_SENTINEL_T2_ONE_9182 make the title shorter",
    "RECENT_SENTINEL_T2_TWO_9182 apply that to english",
    "RECENT_SENTINEL_T2_THREE_9182 undo the last card",
    "RECENT_SENTINEL_T2_FOUR_9182 hide contact",
    "RECENT_SENTINEL_T2_FIVE_9182 restore services intro",
  ];
  for (const [index, userMessage] of [...early, ...recent].entries()) {
    await appendConversationTurn({
      siteId,
      conversationId: conversation.conversationId,
      userMessage,
      aiSummary: `AI_SENTINEL_${index}_9182`,
      appliedOperationsSummary: index < 3 ? "not applied: no_change" : `applied ops=set_text targets=hero.title.zh`,
      outcome: index < 3 ? "no_change" : "applied",
    });
  }

  const record = await getConversation(siteId, conversation.conversationId);
  assert.ok(record);
  const context = conversationPromptContext(record);
  for (const item of recent) assert.equal(context.includes(item), true);
  for (const item of recent) {
    const idx = [...early, ...recent].indexOf(item);
    assert.equal(context.includes(`AI_SENTINEL_${idx}_9182`), true);
  }
  assert.equal(context.includes("EARLY1_SENTINEL_T2_BETA_SHOULD_NOT_LEAK_9182"), false);
  assert.equal(context.includes("EARLY2_SENTINEL_T2_GAMMA_SHOULD_NOT_LEAK_9182"), false);
  assert.equal(context.includes("END0_UNIQUE"), false);
  assert.equal((context.match(/用户：/g) || []).length, 5);

  for (let extra = 0; extra < 20; extra += 1) {
    await appendConversationTurn({
      siteId,
      conversationId: conversation.conversationId,
      userMessage: `PAD_SENTINEL_T2_${extra}_${"w".repeat(180)}`,
      aiSummary: `pad-ai-${extra}-${"s".repeat(80)}`,
      appliedOperationsSummary: `pad-ops-${extra}-${"o".repeat(80)}`,
      outcome: "error",
    });
  }
  const grown = await getConversation(siteId, conversation.conversationId);
  assert.ok(grown);
  const packed = conversationPromptContext(grown);
  assert.ok(packed.length < 5000);
  assert.equal(packed.includes("RECENT_SENTINEL_T2_ONE_9182"), false);
  assert.equal(packed.includes("PAD_SENTINEL_T2_19_"), true);
  assert.equal((packed.match(/用户：/g) || []).length <= 5, true);
});

test("prompt context includes outcome and does not label non-applied turns as applied", async () => {
  const siteId = uniqueSiteId();
  const conversation = await createConversation(siteId);
  await appendConversationTurn({
    siteId,
    conversationId: conversation.conversationId,
    userMessage: "SENTINEL_T2_FAIL_USER_5530 leave the draft alone",
    aiSummary: "SENTINEL_T2_FAIL_AI_5530",
    appliedOperationsSummary: "not applied: boom",
    outcome: "error",
  });
  const record = await getConversation(siteId, conversation.conversationId);
  assert.ok(record);
  const context = conversationPromptContext(record);
  assert.equal(context.includes("SENTINEL_T2_FAIL_USER_5530"), true);
  assert.equal(context.includes("outcome=error"), true);
  assert.equal(context.includes("已应用"), false);
});
