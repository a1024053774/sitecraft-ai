import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Pool } from "pg";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE_ID = "p2-pg-verification-20260916";
const FOREIGN_WORKSPACE_ID = "p2-pg-foreign-ws-20260916";
const DEMO_WORKSPACE_ID = "demo";
const STUB_BASE = "https://p2-pg-stub.test.invalid";
const DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/site_studio";

const INPUT = {
  styleOptionId: "industrial",
  pendingMessage: "P2_PG_EDIT_SENTINEL_20260916 把首屏标题改成探测文本",
  newTaskMessage: "P2_PG_NEWTASK_SENTINEL_20260916 再改一次首屏标题",
  legacyTurn: "P2_PG_LEGACY_TURN_20260916 keep turns when alignment is db default",
  sentinelSummary: "P2_PG_SUMMARY_20260916",
  sentinelTitle: "P2_PG_TITLE_20260916",
};

const ENV = {
  SITE_STORE: "postgres",
  DATABASE_URL,
  NODE_ENV: "test",
  DEFAULT_WORKSPACE_ID: WORKSPACE_ID,
  DATABASE_SSL: "false",
  DATABASE_POOL_SIZE: "20",
  DEEPSEEK_API_KEY: "sk-p2-pg-probe-not-real",
  DEEPSEEK_MODEL: "p2-pg-stub-model",
  DEEPSEEK_BASE_URL: STUB_BASE,
};

class ProbeFailure extends Error {
  constructor(caseName, expected, observed) {
    super(`FAIL ${caseName}`);
    this.name = "ProbeFailure";
    this.caseName = caseName;
    this.expected = expected;
    this.observed = observed;
  }
}

function applyIsolatedEnv() {
  const env = process.env;
  for (const [key, value] of Object.entries(ENV)) env[key] = value;
  delete env.AI_API_KEY;
  delete env.AI_MODEL;
  delete env.AI_BASE_URL;
}

applyIsolatedEnv();

if (process.cwd() !== repoRoot) process.chdir(repoRoot);

let providerFetchCount = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.includes("api.deepseek.com") || !url.startsWith(`${STUB_BASE}/`)) {
    throw new Error(`refusing unexpected fetch ${url}`);
  }
  providerFetchCount += 1;
  return new Response(JSON.stringify({
    choices: [{
      finish_reason: "stop",
      message: {
        content: JSON.stringify({
          type: "edit",
          summary: INPUT.sentinelSummary,
          operations: [{
            op: "set_text",
            target: "hero.title",
            locale: "zh",
            value: INPUT.sentinelTitle,
          }],
        }),
      },
    }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const abs = path.join(repoRoot, specifier.slice(2));
    const file = existsSync(`${abs}.ts`) ? `${abs}.ts` : abs;
    return nextResolve(pathToFileURL(file).href, context);
  },
});

const { POST } = await import(pathToFileURL(path.join(repoRoot, "app/api/sites/[siteId]/chat/route.ts")).href);
const { ensureDatabaseSchema, getDatabasePool } = await import(pathToFileURL(path.join(repoRoot, "lib/postgres.ts")).href);

function fail(caseName, expected, observed) {
  throw new ProbeFailure(caseName, expected, observed);
}

function check(caseName, ok, expected, observed) {
  if (!ok) fail(caseName, expected, observed);
}

function parseSseEvents(payload) {
  const events = [];
  for (const chunk of payload.split("\n\n")) {
    const line = chunk.trim();
    if (!line.startsWith("data:")) continue;
    events.push(JSON.parse(line.slice("data:".length).trim()));
  }
  return events;
}

async function postChat(siteId, body) {
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
  const done = events.find((event) => event.type === "done") ?? null;
  let json = null;
  if (!events.length) {
    try { json = JSON.parse(text); } catch { json = null; }
  }
  return { status: response.status, contentType: response.headers.get("content-type") || "", text, events, done, json };
}

function stableJson(value) {
  return JSON.stringify(value);
}

async function workspaceCounts(pool, workspaceId) {
  const sites = await pool.query(
    "SELECT COUNT(*)::int AS n FROM sitecraft_sites WHERE workspace_id = $1",
    [workspaceId],
  );
  const conversations = await pool.query(
    "SELECT COUNT(*)::int AS n FROM sitecraft_conversations WHERE workspace_id = $1",
    [workspaceId],
  );
  return { sites: sites.rows[0].n, conversations: conversations.rows[0].n };
}

async function readSiteRow(pool, workspaceId, siteId) {
  const result = await pool.query(
    `SELECT site_id, draft, history, future, updated_at,
            (draft->>'revision')::int AS revision,
            jsonb_typeof(history) AS history_type,
            CASE WHEN jsonb_typeof(history) = 'array' THEN jsonb_array_length(history) ELSE -1 END AS history_len
     FROM sitecraft_sites
     WHERE workspace_id = $1 AND site_id = $2`,
    [workspaceId, siteId],
  );
  return result.rows[0] ?? null;
}

async function readConversationRow(pool, workspaceId, siteId, conversationId) {
  const result = await pool.query(
    `SELECT workspace_id, site_id, conversation_id, turns, alignment, alignment::text AS alignment_text,
            created_at, updated_at
     FROM sitecraft_conversations
     WHERE workspace_id = $1 AND site_id = $2 AND conversation_id = $3`,
    [workspaceId, siteId, conversationId],
  );
  return result.rows[0] ?? null;
}

async function countConversation(pool, workspaceId, siteId, conversationId) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS n FROM sitecraft_conversations
     WHERE workspace_id = $1 AND site_id = $2 AND conversation_id = $3`,
    [workspaceId, siteId, conversationId],
  );
  return result.rows[0].n;
}

async function countSite(pool, workspaceId, siteId) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS n FROM sitecraft_sites WHERE workspace_id = $1 AND site_id = $2`,
    [workspaceId, siteId],
  );
  return result.rows[0].n;
}

async function main() {
  check("env.SITE_STORE", process.env.SITE_STORE === "postgres", "postgres", process.env.SITE_STORE);
  check("env.NODE_ENV", process.env.NODE_ENV === "test", "test", process.env.NODE_ENV);
  check("env.workspace", process.env.DEFAULT_WORKSPACE_ID === WORKSPACE_ID, WORKSPACE_ID, process.env.DEFAULT_WORKSPACE_ID);

  const observe = new Pool({
    connectionString: DATABASE_URL,
    max: 4,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 5_000,
  });
  const created = {
    sites: [],
    conversations: [],
  };
  const appPool = getDatabasePool();
  let dbVersion = null;
  let demoBefore = null;
  const facts = [];

  const trackSite = (workspaceId, siteId) => {
    if (!created.sites.some((item) => item.workspaceId === workspaceId && item.siteId === siteId)) {
      created.sites.push({ workspaceId, siteId });
    }
  };
  const trackConversation = (workspaceId, siteId, conversationId) => {
    if (!created.conversations.some((item) => (
      item.workspaceId === workspaceId && item.siteId === siteId && item.conversationId === conversationId
    ))) {
      created.conversations.push({ workspaceId, siteId, conversationId });
    }
  };

  const cleanup = async () => {
    for (const row of created.conversations) {
      await observe.query(
        `DELETE FROM sitecraft_conversations
         WHERE workspace_id = $1 AND site_id = $2 AND conversation_id = $3`,
        [row.workspaceId, row.siteId, row.conversationId],
      );
    }
    for (const row of created.sites) {
      await observe.query(
        `DELETE FROM sitecraft_sites WHERE workspace_id = $1 AND site_id = $2`,
        [row.workspaceId, row.siteId],
      );
    }
  };

  const leftover = async () => {
    const remaining = [];
    for (const row of created.conversations) {
      const n = await countConversation(observe, row.workspaceId, row.siteId, row.conversationId);
      if (n !== 0) remaining.push({ kind: "conversation", ...row, n });
    }
    for (const row of created.sites) {
      const n = await countSite(observe, row.workspaceId, row.siteId);
      if (n !== 0) remaining.push({ kind: "site", ...row, n });
    }
    return remaining;
  };

  try {
    await ensureDatabaseSchema();
    const version = await observe.query("SELECT version() AS version, current_setting('server_version') AS server_version");
    dbVersion = {
      version: version.rows[0].version,
      serverVersion: version.rows[0].server_version,
    };
    demoBefore = await workspaceCounts(observe, DEMO_WORKSPACE_ID);
    facts.push({
      db: { host: "127.0.0.1", port: 5432, database: "site_studio", user: "postgres" },
      dbVersion,
      provider: "stub",
      modelProof: false,
      note: "provider is a local HTTP stub; this probe cannot prove DeepSeek/model behavior",
    });

    const mainSiteId = `p2-pg-probe-${crypto.randomUUID()}`;
    const wrongSiteId = `p2-pg-probe-${crypto.randomUUID()}`;
    const legacyConversationId = `p2-pg-legacy-${crypto.randomUUID()}`;
    const foreignConversationId = `p2-pg-foreign-${crypto.randomUUID()}`;
    const missingStartId = `p2-pg-missing-start-${crypto.randomUUID()}`;

    // 1. Legacy conversation: turns only, alignment DB default {}.
    await observe.query(
      `INSERT INTO sitecraft_conversations (workspace_id, site_id, conversation_id, turns, created_at, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW(), NOW())`,
      [WORKSPACE_ID, mainSiteId, legacyConversationId, JSON.stringify([{
        createdAt: new Date().toISOString(),
        userMessage: INPUT.legacyTurn,
        aiSummary: "legacy summary",
        appliedOperationsSummary: "not applied: no_change",
        outcome: "no_change",
      }])],
    );
    trackConversation(WORKSPACE_ID, mainSiteId, legacyConversationId);

    const legacyRaw = await readConversationRow(observe, WORKSPACE_ID, mainSiteId, legacyConversationId);
    check("1.legacy-alignment-default", Boolean(legacyRaw) && legacyRaw.alignment_text === "{}", { alignment_text: "{}" }, {
      alignment_text: legacyRaw?.alignment_text,
      alignment: legacyRaw?.alignment,
    });
    check("1.legacy-turn-present", Array.isArray(legacyRaw.turns) && legacyRaw.turns.some((turn) => turn.userMessage === INPUT.legacyTurn), {
      userMessage: INPUT.legacyTurn,
    }, { turns: legacyRaw.turns });

    const legacyState = await postChat(mainSiteId, { action: "state", conversationId: legacyConversationId });
    check("1.state-status", legacyState.status === 200, 200, legacyState.status);
    check("1.state-disabled", legacyState.done?.alignment?.state === "disabled" && legacyState.done?.alignment?.enabled === false, {
      enabled: false,
      state: "disabled",
    }, legacyState.done?.alignment);
    const afterState = await readConversationRow(observe, WORKSPACE_ID, mainSiteId, legacyConversationId);
    check("1.state-does-not-write-alignment", afterState.alignment_text === "{}", "{}", afterState.alignment_text);
    check("1.state-keeps-turn", Array.isArray(afterState.turns) && afterState.turns.some((turn) => turn.userMessage === INPUT.legacyTurn), {
      userMessage: INPUT.legacyTurn,
    }, { turns: afterState.turns });

    const wrongSiteState = await postChat(wrongSiteId, { action: "state", conversationId: legacyConversationId });
    check("1.wrong-site-state-404", wrongSiteState.status === 404, 404, {
      status: wrongSiteState.status,
      json: wrongSiteState.json,
    });
    check("1.wrong-site-no-conversation", await countConversation(observe, WORKSPACE_ID, wrongSiteId, legacyConversationId) === 0, 0, {
      n: await countConversation(observe, WORKSPACE_ID, wrongSiteId, legacyConversationId),
    });
    check("1.wrong-site-no-site-row", await countSite(observe, WORKSPACE_ID, wrongSiteId) === 0, 0, {
      n: await countSite(observe, WORKSPACE_ID, wrongSiteId),
    });

    await observe.query(
      `INSERT INTO sitecraft_conversations (workspace_id, site_id, conversation_id, turns, created_at, updated_at)
       VALUES ($1, $2, $3, '[]'::jsonb, NOW(), NOW())`,
      [FOREIGN_WORKSPACE_ID, mainSiteId, foreignConversationId],
    );
    trackConversation(FOREIGN_WORKSPACE_ID, mainSiteId, foreignConversationId);

    const foreignState = await postChat(mainSiteId, { action: "state", conversationId: foreignConversationId });
    check("1.wrong-workspace-state-404", foreignState.status === 404, 404, {
      status: foreignState.status,
      json: foreignState.json,
    });
    check("1.wrong-workspace-no-isolated-row", await countConversation(observe, WORKSPACE_ID, mainSiteId, foreignConversationId) === 0, 0, {
      isolated: await countConversation(observe, WORKSPACE_ID, mainSiteId, foreignConversationId),
      foreign: await countConversation(observe, FOREIGN_WORKSPACE_ID, mainSiteId, foreignConversationId),
    });

    const missingStart = await postChat(mainSiteId, { action: "start", conversationId: missingStartId });
    check("1.missing-start-404", missingStart.status === 404, 404, {
      status: missingStart.status,
      json: missingStart.json,
    });
    check("1.missing-start-not-created", await countConversation(observe, WORKSPACE_ID, mainSiteId, missingStartId) === 0, 0, {
      n: await countConversation(observe, WORKSPACE_ID, mainSiteId, missingStartId),
    });
    facts.push({ case: 1, ok: true });

    // 2. Real pending start, then 10 identical select; stub edit once.
    const fetchBeforeStart = providerFetchCount;
    const started = await postChat(mainSiteId, {
      action: "start",
      message: INPUT.pendingMessage,
      baseRevision: 1,
    });
    check("2.start-200", started.status === 200 && started.done?.status === "alignment", {
      status: 200,
      done: "alignment",
    }, { status: started.status, done: started.done });
    const conversationId = String(started.done.conversationId);
    trackConversation(WORKSPACE_ID, mainSiteId, conversationId);
    check("2.start-no-provider", providerFetchCount === fetchBeforeStart, fetchBeforeStart, providerFetchCount);
    check("2.start-pending", started.done.pendingMessage === INPUT.pendingMessage, INPUT.pendingMessage, started.done.pendingMessage);
    const questionId = String(started.done.questionId);
    const questionRevision = Number(started.done.questionRevision);
    check("2.start-question", Boolean(questionId) && Number.isInteger(questionRevision), {
      questionId: "non-empty",
      questionRevision: "int",
    }, { questionId, questionRevision });

    const fetchBeforeSelect = providerFetchCount;
    const selectBody = {
      action: "select",
      conversationId,
      questionId,
      questionRevision,
      optionId: INPUT.styleOptionId,
    };
    const selectResults = await Promise.all(Array.from({ length: 10 }, () => postChat(mainSiteId, selectBody)));
    check("2.select-fetch-once", providerFetchCount === fetchBeforeSelect + 1, fetchBeforeSelect + 1, {
      fetchCount: providerFetchCount,
      before: fetchBeforeSelect,
      statuses: selectResults.map((item) => ({
        status: item.status,
        done: item.done?.status,
        error: item.json?.error,
        awaitingConfirmation: item.done?.awaitingConfirmation,
      })),
    });
    const selectAccepted = selectResults.filter((item) => (
      item.status === 200
      && (item.done?.awaitingConfirmation === true || item.done?.status === "alignment" || item.json == null)
    ));
    const selectConflicts = selectResults.filter((item) => item.status === 409 || item.done?.status === "conflict");
    check("2.select-all-accounted", selectAccepted.length + selectConflicts.length === 10, 10, {
      accepted: selectAccepted.length,
      conflict: selectConflicts.length,
      other: selectResults.filter((item) => !selectAccepted.includes(item) && !selectConflicts.includes(item)).map((item) => ({
        status: item.status,
        done: item.done,
        json: item.json,
      })),
    });

    trackSite(WORKSPACE_ID, mainSiteId);
    const proposalA = await readConversationRow(observe, WORKSPACE_ID, mainSiteId, conversationId);
    const proposalB = await readConversationRow(observe, WORKSPACE_ID, mainSiteId, conversationId);
    const proposedA = proposalA?.alignment?.proposedChange ?? null;
    const proposedB = proposalB?.alignment?.proposedChange ?? null;
    check("2.proposal-reread", stableJson(proposedA) === stableJson(proposedB) && proposedA != null, "identical proposedChange", {
      first: proposedA,
      second: proposedB,
    });
    check("2.proposal-sentinel", proposedA?.summary === INPUT.sentinelSummary
      && proposedA?.operations?.[0]?.value === INPUT.sentinelTitle
      && proposedA?.operations?.[0]?.op === "set_text"
      && proposedA?.operations?.[0]?.target === "hero.title", {
      summary: INPUT.sentinelSummary,
      title: INPUT.sentinelTitle,
    }, proposedA);
    check("2.awaiting-confirmation", proposalA.alignment.state === "awaiting_confirmation", "awaiting_confirmation", proposalA.alignment.state);
    const siteAfterProposal = await readSiteRow(observe, WORKSPACE_ID, mainSiteId);
    check("2.draft-revision-1", siteAfterProposal?.revision === 1 && siteAfterProposal?.history_len === 0, {
      revision: 1,
      history_len: 0,
    }, {
      revision: siteAfterProposal?.revision,
      history_len: siteAfterProposal?.history_len,
      site: Boolean(siteAfterProposal),
    });
    const confirmQuestionId = String(proposalA.alignment.currentQuestion?.questionId || proposedA.questionId);
    const confirmQuestionRevision = Number(proposalA.alignment.currentQuestion?.questionRevision ?? proposedA.questionRevision);
    check("2.confirm-ids", Boolean(confirmQuestionId) && Number.isInteger(confirmQuestionRevision), {
      questionId: "non-empty",
      questionRevision: "int",
    }, { confirmQuestionId, confirmQuestionRevision });
    const claimedSnapshot = {
      ...proposalA.alignment,
      confirmClaimed: true,
    };
    facts.push({
      case: 2,
      ok: true,
      fetchCount: providerFetchCount - fetchBeforeSelect,
      proposalQuestionId: confirmQuestionId,
    });

    // 3. Stale confirm, then 10 identical confirm; one history / revision 2.
    const staleConfirm = await postChat(mainSiteId, {
      action: "confirm",
      conversationId,
      questionId: confirmQuestionId,
      questionRevision: confirmQuestionRevision - 1,
    });
    check("3.stale-confirm-409", staleConfirm.status === 409 && staleConfirm.json?.error === "stale_question", {
      status: 409,
      error: "stale_question",
    }, { status: staleConfirm.status, json: staleConfirm.json, done: staleConfirm.done });
    const siteAfterStale = await readSiteRow(observe, WORKSPACE_ID, mainSiteId);
    check("3.stale-no-draft-change", siteAfterStale?.revision === 1 && siteAfterStale?.history_len === 0, {
      revision: 1,
      history_len: 0,
    }, { revision: siteAfterStale?.revision, history_len: siteAfterStale?.history_len });

    const fetchBeforeConfirm = providerFetchCount;
    const confirmBody = {
      action: "confirm",
      conversationId,
      questionId: confirmQuestionId,
      questionRevision: confirmQuestionRevision,
    };
    const confirmResults = await Promise.all(Array.from({ length: 10 }, () => postChat(mainSiteId, confirmBody)));
    check("3.confirm-no-provider", providerFetchCount === fetchBeforeConfirm, fetchBeforeConfirm, providerFetchCount);

    const applied = confirmResults.filter((item) => item.done?.status === "applied");
    const currentOrConflict = confirmResults.filter((item) => (
      item.status === 409
      || item.done?.status === "conflict"
      || item.done?.replayed === true
      || (item.status === 200 && item.done?.status !== "applied")
    ));
    check("3.confirm-all-accounted", applied.length + currentOrConflict.length === 10, 10, {
      applied: applied.length,
      currentOrConflict: currentOrConflict.length,
      other: confirmResults.filter((item) => !applied.includes(item) && !currentOrConflict.includes(item)).map((item) => ({
        status: item.status,
        done: item.done,
        json: item.json,
      })),
    });
    const receipts = applied.map((item) => item.done?.changeSet?.id).filter(Boolean);
    check("3.applied-same-receipt", applied.length >= 1 && receipts.every((id) => id === confirmQuestionId), {
      receipt: confirmQuestionId,
      applied: ">=1",
    }, {
      applied: applied.length,
      receipts,
      statuses: confirmResults.map((item) => ({
        status: item.status,
        doneStatus: item.done?.status,
        error: item.json?.error,
        changeSetId: item.done?.changeSet?.id,
      })),
    });

    const siteAfterConfirm = await readSiteRow(observe, WORKSPACE_ID, mainSiteId);
    check("3.one-history-revision-2", siteAfterConfirm?.revision === 2 && siteAfterConfirm?.history_len === 1, {
      revision: 2,
      history_len: 1,
    }, {
      revision: siteAfterConfirm?.revision,
      history_len: siteAfterConfirm?.history_len,
      historyIds: Array.isArray(siteAfterConfirm?.history) ? siteAfterConfirm.history.map((item) => item.id) : siteAfterConfirm?.history,
    });
    const historyReceipt = Array.isArray(siteAfterConfirm.history) ? siteAfterConfirm.history[0] : null;
    check("3.history-receipt", historyReceipt?.id === confirmQuestionId && historyReceipt?.revision === 2, {
      id: confirmQuestionId,
      revision: 2,
    }, historyReceipt);
    check("3.draft-title", siteAfterConfirm.draft?.content?.hero?.title?.zh === INPUT.sentinelTitle, INPUT.sentinelTitle, siteAfterConfirm.draft?.content?.hero?.title);

    const stateAfterConfirm = await postChat(mainSiteId, { action: "state", conversationId });
    check("3.state-lastResult-applied", stateAfterConfirm.done?.lastResult?.status === "applied"
      || stateAfterConfirm.done?.alignment?.lastResult?.status === "applied", {
      lastResult: "applied",
    }, {
      lastResult: stateAfterConfirm.done?.lastResult,
      alignment: stateAfterConfirm.done?.alignment,
    });
    const convoAfterConfirm = await readConversationRow(observe, WORKSPACE_ID, mainSiteId, conversationId);
    check("3.pg-lastResult-applied", convoAfterConfirm.alignment?.lastResult?.status === "applied", "applied", convoAfterConfirm.alignment?.lastResult);

    const fetchBeforeNewTask = providerFetchCount;
    const newTask = await postChat(mainSiteId, {
      action: "start",
      conversationId,
      message: INPUT.newTaskMessage,
      baseRevision: 2,
    });
    check("3.new-task-200", newTask.status === 200, 200, { status: newTask.status, done: newTask.done, json: newTask.json });
    check("3.new-task-provider-once", providerFetchCount === fetchBeforeNewTask + 1, fetchBeforeNewTask + 1, providerFetchCount);
    const afterNewTask = await readConversationRow(observe, WORKSPACE_ID, mainSiteId, conversationId);
    check("3.new-task-pending", afterNewTask.alignment?.pendingRequest?.message === INPUT.newTaskMessage
      || newTask.done?.pendingMessage === INPUT.newTaskMessage
      || afterNewTask.alignment?.proposedChange != null, INPUT.newTaskMessage, {
      pending: afterNewTask.alignment?.pendingRequest,
      proposedQuestionId: afterNewTask.alignment?.proposedChange?.questionId,
      state: afterNewTask.alignment?.state,
    });
    check("3.new-task-no-old-proposal", afterNewTask.alignment?.proposedChange?.questionId !== confirmQuestionId, {
      oldProposalId: confirmQuestionId,
      notEqual: true,
    }, { proposedQuestionId: afterNewTask.alignment?.proposedChange?.questionId });
    check("3.new-task-no-old-clarify", afterNewTask.alignment?.currentQuestion?.kind !== "clarify"
      && afterNewTask.alignment?.currentQuestion?.questionId !== confirmQuestionId
      && !(afterNewTask.alignment?.answers ?? []).some((item) => item.questionId?.startsWith?.("needs-") && item.questionId !== afterNewTask.alignment?.currentQuestion?.questionId), {
      noOldClarify: true,
    }, {
      currentQuestion: afterNewTask.alignment?.currentQuestion,
      answers: afterNewTask.alignment?.answers,
    });
    const siteAfterNewTask = await readSiteRow(observe, WORKSPACE_ID, mainSiteId);
    check("3.new-task-no-extra-commit", siteAfterNewTask?.revision === 2 && siteAfterNewTask?.history_len === 1, {
      revision: 2,
      history_len: 1,
    }, { revision: siteAfterNewTask?.revision, history_len: siteAfterNewTask?.history_len });
    facts.push({ case: 3, ok: true, applied: applied.length, receipt: confirmQuestionId });

    // 4. Persist claim+draft, lose conversation result, recover from site history receipt.
    const fetchBeforeRecover = providerFetchCount;
    await observe.query(
      `UPDATE sitecraft_conversations
       SET alignment = $4::jsonb, updated_at = NOW()
       WHERE workspace_id = $1 AND site_id = $2 AND conversation_id = $3`,
      [WORKSPACE_ID, mainSiteId, conversationId, JSON.stringify(claimedSnapshot)],
    );
    const injected = await readConversationRow(observe, WORKSPACE_ID, mainSiteId, conversationId);
    check("4.injected-claimed", injected.alignment?.confirmClaimed === true
      && injected.alignment?.lastResult == null
      && injected.alignment?.proposedChange?.questionId === confirmQuestionId, {
      confirmClaimed: true,
      lastResult: null,
      proposedQuestionId: confirmQuestionId,
    }, {
      confirmClaimed: injected.alignment?.confirmClaimed,
      lastResult: injected.alignment?.lastResult,
      proposedQuestionId: injected.alignment?.proposedChange?.questionId,
    });
    const siteBeforeRecover = await readSiteRow(observe, WORKSPACE_ID, mainSiteId);
    check("4.fault-did-not-write-draft", siteBeforeRecover?.revision === 2
      && siteBeforeRecover?.history_len === 1
      && siteBeforeRecover.draft?.content?.hero?.title?.zh === INPUT.sentinelTitle, {
      revision: 2,
      history_len: 1,
      title: INPUT.sentinelTitle,
    }, {
      revision: siteBeforeRecover?.revision,
      history_len: siteBeforeRecover?.history_len,
      title: siteBeforeRecover?.draft?.content?.hero?.title,
    });

    const recovered = await postChat(mainSiteId, { action: "state", conversationId });
    check("4.recover-state-applied", recovered.done?.lastResult?.status === "applied"
      || recovered.done?.alignment?.lastResult?.status === "applied", {
      lastResult: "applied",
    }, {
      status: recovered.status,
      lastResult: recovered.done?.lastResult,
      alignment: recovered.done?.alignment,
      json: recovered.json,
    });
    check("4.recover-no-provider", providerFetchCount === fetchBeforeRecover, fetchBeforeRecover, providerFetchCount);
    const siteAfterRecover = await readSiteRow(observe, WORKSPACE_ID, mainSiteId);
    check("4.recover-no-recommit", siteAfterRecover?.revision === 2 && siteAfterRecover?.history_len === 1
      && Array.isArray(siteAfterRecover.history) && siteAfterRecover.history[0]?.id === confirmQuestionId, {
      revision: 2,
      history_len: 1,
      receipt: confirmQuestionId,
    }, {
      revision: siteAfterRecover?.revision,
      history_len: siteAfterRecover?.history_len,
      history: siteAfterRecover?.history,
    });
    const convoAfterRecover = await readConversationRow(observe, WORKSPACE_ID, mainSiteId, conversationId);
    check("4.recover-pg-lastResult", convoAfterRecover.alignment?.lastResult?.status === "applied"
      && convoAfterRecover.alignment?.lastResult?.revision === 2, {
      status: "applied",
      revision: 2,
    }, convoAfterRecover.alignment?.lastResult);
    facts.push({ case: 4, ok: true, recoveredFromReceipt: confirmQuestionId, recommit: false });

    await cleanup();
    const remaining = await leftover();
    check("5.cleanup-zero", remaining.length === 0, 0, remaining);
    const demoAfter = await workspaceCounts(observe, DEMO_WORKSPACE_ID);
    check("5.demo-unchanged", demoAfter.sites === demoBefore.sites && demoAfter.conversations === demoBefore.conversations, demoBefore, demoAfter);
    facts.push({
      case: 5,
      ok: true,
      remaining: 0,
      dbVersion,
      demo: demoAfter,
    });

    console.log(JSON.stringify({
      ok: true,
      workspace: WORKSPACE_ID,
      siteId: mainSiteId,
      conversationId,
      dbVersion,
      provider: "stub",
      modelProof: false,
      fetchCount: providerFetchCount,
      facts,
    }, null, 2));
  } catch (error) {
    try { await cleanup(); } catch (cleanupError) {
      console.error(JSON.stringify({ cleanupError: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) }));
    }
    let remaining = [];
    try { remaining = await leftover(); } catch { remaining = [{ error: "leftover-count-failed" }]; }
    if (error instanceof ProbeFailure) {
      console.error(JSON.stringify({
        ok: false,
        case: error.caseName,
        expected: error.expected,
        observed: error.observed,
        remaining,
        dbVersion,
        provider: "stub",
        modelProof: false,
        fetchCount: providerFetchCount,
        note: "minimal counterexample; parent should fix business implementation",
      }, null, 2));
      process.exitCode = 1;
    } else {
      console.error(JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        remaining,
        dbVersion,
        provider: "stub",
        modelProof: false,
      }, null, 2));
      process.exitCode = 1;
    }
  } finally {
    globalThis.fetch = originalFetch;
    await observe.end();
    await appPool.end();
  }
}

const watchdog = setTimeout(() => {
  console.error(JSON.stringify({
    ok: false,
    error: "probe watchdog 90s; process would hang",
    provider: "stub",
    modelProof: false,
  }));
  process.exit(2);
}, 90_000);

try {
  await main();
} finally {
  clearTimeout(watchdog);
}
