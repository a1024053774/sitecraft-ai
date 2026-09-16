import { z } from "zod";
import {
  AlignmentActionError,
  applyAnswerResult,
  applyClarifyResult,
  applyCommittedResult,
  applyEditProposal,
  applyRunError,
  alignmentPromptContext,
  publicAlignmentView,
  type AlignmentActionSuccess,
  type AlignmentPublicView,
} from "@/lib/alignment";
import { requestStructuredOperations } from "@/lib/ai-provider";
import {
  appendConversationTurn,
  applyConversationAlignmentAction,
  CONVERSATION_ID_PATTERN,
  conversationPromptContext,
  getConversation,
  getOrCreateConversation,
  updateConversationAlignment,
  type ConversationRecord,
  type ConversationTurnOutcome,
} from "@/lib/conversation-store";
import { commitOperations, getSite, snapshot } from "@/lib/site-store";

export const runtime = "nodejs";

const chatSchema = z.object({
  baseRevision: z.number().int().nonnegative(),
  message: z.string().trim().min(1).max(4000),
  selectedTarget: z.string().max(120).nullable().optional(),
  conversationId: z.string().regex(CONVERSATION_ID_PATTERN).nullable().optional(),
});
const alignmentSchema = z.object({
  action: z.enum(["start", "select", "confirm", "cancel", "state"]),
  conversationId: z.string().regex(CONVERSATION_ID_PATTERN).nullable().optional(),
  questionId: z.string().trim().min(1).max(80).optional(),
  questionRevision: z.number().int().nonnegative().optional(),
  optionId: z.string().trim().min(1).max(80).optional(),
  note: z.string().max(500).optional(),
  baseRevision: z.number().int().nonnegative().optional(),
  message: z.string().trim().min(1).max(4000).optional(),
  selectedTarget: z.string().max(120).nullable().optional(),
});

type AlignmentApplied = {
  record: ConversationRecord;
  view: AlignmentPublicView;
  result: AlignmentActionSuccess;
};

function event(controller: ReadableStreamDefaultController<Uint8Array>, value: unknown) {
  try {
    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(value)}\n\n`));
  } catch (error) {
    // A disconnected SSE consumer must not interrupt the durable task result.
    if (!(error instanceof TypeError && "code" in error && error.code === "ERR_INVALID_STATE")) throw error;
  }
}

function summarizeAppliedOperations(operations: Array<{ op: string }>, appliedTargets: string[]) {
  return `applied ops=${operations.map((item) => item.op).join(",") || "none"} targets=${appliedTargets.join(",") || "none"}`;
}

function sseHeaders() {
  return { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", Connection: "keep-alive" };
}

function viewPayload(conversationId: string, view: AlignmentPublicView, extra?: Record<string, unknown>) {
  return {
    conversationId,
    waitingForUser: view.waitingForUser,
    saved: view.saved,
    confirmed: false,
    awaitingConfirmation: view.awaitingConfirmation,
    prefsOnly: view.prefsOnly,
    cannotProceed: view.cannotProceed,
    summary: view.summary,
    question: view.question,
    questionId: view.questionId,
    questionRevision: view.questionRevision,
    questionKind: view.questionKind,
    options: view.options,
    utilities: view.utilities,
    pendingMessage: view.pendingMessage,
    lastResult: view.lastResult,
    alignment: view,
    ...extra,
  };
}

function alignmentError(error: unknown) {
  if (error instanceof AlignmentActionError) {
    return Response.json({
      error: error.code,
      message: error.message,
      alignment: publicAlignmentView(error.snapshot),
    }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "需求对齐失败";
  if (message === "Conversation not found") {
    return Response.json({ error: "conversation_not_found", message: "会话不存在，无法恢复需求对齐。" }, { status: 404 });
  }
  if (message === "Conversation not found for workspace") {
    return Response.json({ error: "conversation_forbidden", message: "会话不属于当前工作区。" }, { status: 403 });
  }
  if (message === "Conversation record does not match workspace") {
    return Response.json({ error: "conversation_forbidden", message: "会话不属于当前工作区。" }, { status: 403 });
  }
  if (message === "Conversation id required") {
    return Response.json({ error: "conversation_id_required", message: "缺少会话 ID。" }, { status: 400 });
  }
  return Response.json({ error: message }, { status: 400 });
}

function persistWarning(error: unknown) {
  return `会话写入失败：${error instanceof Error ? error.message : "未知错误"}`;
}

async function continueSavedTask(siteId: string, conversationId: string, runId: string, controller: ReadableStreamDefaultController<Uint8Array>) {
  event(controller, { type: "status", value: "正在根据已保存的任务继续…" });
  const conversation = await getConversation(siteId, conversationId);
  if (!conversation) throw new Error("Conversation not found");
  if (conversation.alignment.inflightRunId !== runId) {
    event(controller, { type: "done", status: "alignment", ...viewPayload(conversationId, publicAlignmentView(conversation.alignment), { action: "state" }) });
    return;
  }
  const pending = conversation.alignment.pendingRequest;
  if (!pending) {
    const view = publicAlignmentView(conversation.alignment, { prefsOnly: true });
    const payload = viewPayload(conversationId, view, { action: "continue" });
    event(controller, { type: "alignment", ...payload });
    event(controller, { type: "done", status: "alignment", ...payload });
    return;
  }
  const current = await getSite(siteId);
  const provider = await requestStructuredOperations({
    message: pending.message,
    draft: current.draft,
    templateId: current.draft.templateId,
    selectedTarget: pending.selectedTarget,
    conversationContext: conversationPromptContext(conversation),
    alignmentContext: alignmentPromptContext(conversation.alignment),
  });

  let accepted = false;
  const applied = await updateConversationAlignment(siteId, conversationId, (record) => {
    if (record.alignment.inflightRunId !== runId) return record;
    accepted = true;
    if (!provider.ok) return { ...record, alignment: applyRunError(record.alignment, { runId, error: provider.error }) };
    const result = provider.type === "answer"
      ? applyAnswerResult(record.alignment, { runId, text: provider.text })
      : provider.type === "clarify"
        ? applyClarifyResult(record.alignment, { runId, question: provider.question, options: provider.options ?? [] })
        : applyEditProposal(record.alignment, {
          runId, summary: provider.summary, operations: provider.operations, rejected: provider.rejected,
          baseRevision: pending.baseRevision, model: provider.model, latencyMs: provider.latencyMs,
        });
    return "stale" in result ? record : { ...record, alignment: result.snapshot };
  });
  const view = publicAlignmentView(applied.alignment);
  if (!accepted) {
    event(controller, { type: "done", status: "alignment", ...viewPayload(conversationId, view, { action: "state" }) });
    return;
  }
  const aiSummary = !provider.ok ? provider.error
    : provider.type === "answer" ? provider.text
      : provider.type === "clarify" ? provider.question : provider.summary;
  const status = !provider.ok ? "error"
    : provider.type === "answer" ? "answer"
      : provider.type === "clarify" && !view.cannotProceed ? "clarify" : "alignment";
  const doneEvent = {
    type: "done", status,
    ...viewPayload(conversationId, view, { action: provider.ok ? provider.type : "error" }),
    ...(provider.ok ? { model: provider.model } : { error: provider.error, code: provider.code }),
    ...(provider.ok && provider.type === "answer" ? { text: provider.text } : {}),
    latencyMs: provider.latencyMs,
  };
  event(controller, { ...doneEvent, type: status === "error" ? "alignment" : status });
  try {
    await appendConversationTurn({
      siteId, conversationId, userMessage: pending.message, aiSummary,
      appliedOperationsSummary: `not applied: ${status === "alignment" ? "awaiting confirmation" : status}`,
      outcome: provider.ok ? "no_change" : "error",
    });
  } catch (error) {
    event(controller, { ...doneEvent, conversationPersisted: false, conversationError: persistWarning(error) });
    return;
  }
  event(controller, doneEvent);
}

async function recoverCommittedProposal(siteId: string, conversation: ConversationRecord) {
  const alignment = conversation.alignment;
  const proposal = alignment.proposedChange;
  if (!alignment.confirmClaimed || alignment.lastResult || !proposal) return conversation;
  const current = await getSite(siteId);
  const receipt = current.history.find((change) => change.id === proposal.questionId);
  if (!receipt) return conversation;
  return updateConversationAlignment(siteId, conversation.conversationId, (record) => {
    if (record.alignment.proposedChange?.questionId !== proposal.questionId || record.alignment.lastResult) return record;
    const stillCurrent = receipt.revision === current.draft.revision;
    return { ...record, alignment: applyCommittedResult(record.alignment, {
      status: stillCurrent ? "applied" : "conflict",
      summary: stillCurrent ? receipt.summary : "草稿已在确认后更新，已读取当前版本；未重新应用旧方案。",
      revision: current.draft.revision,
    }) };
  });
}

async function emitRecordedResult(siteId: string, conversationId: string, record: ConversationRecord, controller: ReadableStreamDefaultController<Uint8Array>) {
  const result = record.alignment.lastResult;
  const view = publicAlignmentView(record.alignment);
  if (!result) {
    const payload = viewPayload(conversationId, view, { action: "state" });
    event(controller, { type: "alignment", ...payload });
    event(controller, { type: "done", status: "alignment", ...payload });
    return;
  }
  if (result.status === "applied" || result.status === "no_change" || result.status === "conflict") {
    const current = await getSite(siteId);
    event(controller, {
      type: "done",
      status: result.status,
      summary: result.summary,
      conversationId,
      waitingForUser: false,
      alignment: view,
      ...current,
      changeSet: current.history.find((change) => change.id === record.alignment.proposedChange?.questionId),
      replayed: true,
      ...(result.status === "conflict" ? { error: result.summary || "草稿已经更新，已确认的方案未应用。" } : {}),
    });
    return;
  }
  if (result.status === "answer") {
    event(controller, {
      type: "done",
      status: "answer",
      text: result.text || result.summary,
      conversationId,
      waitingForUser: false,
      alignment: view,
    });
    return;
  }
  event(controller, {
    type: "done",
    status: "error",
    error: result.summary || "需求对齐失败",
    conversationId,
    waitingForUser: false,
    alignment: view,
  });
}

async function commitClaimedProposal(siteId: string, conversationId: string, controller: ReadableStreamDefaultController<Uint8Array>) {
  const conversation = await getConversation(siteId, conversationId);
  if (!conversation) throw new Error("Conversation not found");
  const proposed = conversation.alignment.proposedChange;
  if (conversation.alignment.lastResult?.status === "applied" || conversation.alignment.lastResult?.status === "no_change" || conversation.alignment.lastResult?.status === "conflict") {
    await emitRecordedResult(siteId, conversationId, conversation, controller);
    return;
  }
  if (!proposed || !conversation.alignment.confirmClaimed) {
    throw new AlignmentActionError({
      ok: false,
      status: 400,
      code: "invalid_state",
      error: "当前没有已确认的修改方案。",
      snapshot: conversation.alignment,
    });
  }
  event(controller, { type: "status", value: "正在应用已确认的方案…" });
  let doneEvent: Record<string, unknown>;
  let outcome: ConversationTurnOutcome;
  let aiSummary = proposed.summary;
  let appliedOperationsSummary = "not applied";
  let result: Awaited<ReturnType<typeof commitOperations>>;
  try {
    result = await commitOperations({
      siteId, baseRevision: proposed.baseRevision, operations: proposed.operations,
      summary: proposed.summary, source: "ai", changeId: proposed.questionId,
      model: proposed.model ?? undefined, latencyMs: proposed.latencyMs,
    });
  } catch (error) {
    aiSummary = error instanceof Error ? error.message : "操作应用失败";
    const failed = await updateConversationAlignment(siteId, conversationId, (record) => ({
      ...record, alignment: applyCommittedResult(record.alignment, { status: "error", summary: aiSummary }),
    }));
    event(controller, { type: "done", status: "error", code: "operation_error", error: aiSummary,
      conversationId, alignment: publicAlignmentView(failed.alignment) });
    return;
  }
  outcome = result.status;
  appliedOperationsSummary = result.status === "applied"
    ? summarizeAppliedOperations(result.changeSet.operations, result.changeSet.appliedTargets)
    : `not applied: ${result.status}`;
  const recordedResult = {
    status: result.status,
    summary: result.status === "conflict" ? "草稿已经更新，已确认的方案未应用。" : proposed.summary,
    revision: result.status === "applied" ? result.changeSet.revision : result.record.draft.revision,
  };
  doneEvent = {
    type: "done", status: result.status, summary: recordedResult.summary,
    conversationId, waitingForUser: false,
    alignment: publicAlignmentView(applyCommittedResult(conversation.alignment, recordedResult)),
    ...snapshot(result.record), model: proposed.model, latencyMs: proposed.latencyMs,
    ...(result.status === "applied" ? { changeSet: result.changeSet, rejected: proposed.rejected } : {}),
    ...(result.status === "conflict" ? { error: recordedResult.summary } : {}),
  };
  try {
    let newlyRecorded = false;
    const updated = await updateConversationAlignment(siteId, conversationId, (record) => {
      if (record.alignment.proposedChange?.questionId !== proposed.questionId || record.alignment.lastResult) return record;
      newlyRecorded = true;
      return { ...record, alignment: applyCommittedResult(record.alignment, recordedResult) };
    });
    doneEvent.alignment = publicAlignmentView(updated.alignment);
    if (!newlyRecorded) doneEvent.replayed = true;
    if (newlyRecorded) await appendConversationTurn({
      siteId, conversationId, userMessage: conversation.alignment.pendingRequest?.message || "确认需求对齐方案",
      aiSummary, appliedOperationsSummary, outcome,
    });
  } catch (error) {
    doneEvent.conversationPersisted = false;
    doneEvent.conversationError = persistWarning(error);
  }
  event(controller, doneEvent);
}

function actionStream(siteId: string, conversationId: string, action: string, applied: AlignmentApplied) {
  let disconnected = false;
  return new ReadableStream<Uint8Array>({
    cancel() { disconnected = true; },
    async start(controller) {
      try {
        const success = applied.result;
        if (success.ok && success.shouldCommit) {
          await commitClaimedProposal(siteId, conversationId, controller);
          return;
        }
        if (success.ok && !success.shouldCommit && applied.record.alignment.lastResult && action === "confirm") {
          await emitRecordedResult(siteId, conversationId, applied.record, controller);
          return;
        }
        if (success.ok && success.shouldContinue && success.runId) {
          await continueSavedTask(siteId, conversationId, success.runId, controller);
          return;
        }
        const payload = viewPayload(conversationId, applied.view, { action });
        const waitingClarify = applied.view.waitingForUser && applied.view.questionKind === "clarify";
        const type = waitingClarify ? "clarify" : "alignment";
        event(controller, { type, ...payload });
        event(controller, { type: "done", status: waitingClarify ? "clarify" : "alignment", ...payload });
      } catch (error) {
        const message = error instanceof Error ? error.message : "需求对齐失败";
        let view = applied.view;
        let conversationPersisted = true;
        if (applied.result.shouldContinue && applied.result.runId) {
          try {
            const updated = await updateConversationAlignment(siteId, conversationId, (record) => ({
              ...record, alignment: applyRunError(record.alignment, { runId: applied.result.runId!, error: message }),
            }));
            view = publicAlignmentView(updated.alignment);
          } catch {
            conversationPersisted = false;
          }
        }
        event(controller, {
          type: "done", status: "error", conversationId, error: message, alignment: view,
          ...(!conversationPersisted ? { conversationPersisted: false, conversationError: "任务状态保存失败，请读取服务器状态。" } : {}),
        });
      } finally {
        if (!disconnected) controller.close();
      }
    },
  });
}

async function handleAlignmentAction(siteId: string, raw: unknown) {
  const parsed = alignmentSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "Invalid chat payload", details: parsed.error.flatten() }, { status: 400 });
  try {
    if ((parsed.data.action === "state" || parsed.data.action === "confirm") && parsed.data.conversationId) {
      const existing = await getConversation(siteId, parsed.data.conversationId);
      if (existing) await recoverCommittedProposal(siteId, existing);
    }
    if (parsed.data.message && parsed.data.baseRevision === undefined) {
      return Response.json({ error: "invalid_payload", message: "保存任务时必须提供草稿版本。" }, { status: 400 });
    }
    const pendingRequest = parsed.data.message
      ? {
        message: parsed.data.message,
        baseRevision: parsed.data.baseRevision ?? 0,
        selectedTarget: parsed.data.selectedTarget ?? null,
      }
      : undefined;
    const applied = await applyConversationAlignmentAction({
      siteId,
      conversationId: parsed.data.conversationId,
      action: parsed.data.action,
      questionId: parsed.data.questionId,
      questionRevision: parsed.data.questionRevision,
      optionId: parsed.data.optionId,
      note: parsed.data.note,
      pendingRequest,
    });
    return new Response(actionStream(siteId, applied.record.conversationId, parsed.data.action, {
      record: applied.record,
      view: applied.view,
      result: applied.result as AlignmentActionSuccess,
    }), { headers: sseHeaders() });
  } catch (error) {
    return alignmentError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const raw = await request.json().catch(() => null);
  const { siteId } = await params;
  if (raw && typeof raw === "object" && "action" in raw && typeof (raw as { action?: unknown }).action === "string") {
    return handleAlignmentAction(siteId, raw);
  }
  const parsed = chatSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "Invalid chat payload", details: parsed.error.flatten() }, { status: 400 });
  const current = await getSite(siteId);
  if (current.draft.revision !== parsed.data.baseRevision) {
    return Response.json({ error: "revision_conflict", message: "草稿已经更新，请刷新后重试。", ...current }, { status: 409 });
  }

  let conversation: ConversationRecord;
  try {
    if (parsed.data.conversationId) {
      const existing = await getConversation(siteId, parsed.data.conversationId);
      if (!existing) return Response.json({ error: "conversation_not_found", message: "会话不存在，请明确开启新会话。" }, { status: 404 });
      conversation = existing;
    } else {
      conversation = await getOrCreateConversation(siteId);
    }
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "会话创建失败" }, { status: 400 });
  }

  if (conversation.alignment.enabled) {
    if (conversation.alignment.inflightRunId) {
      return Response.json({
        error: "alignment_pending",
        message: "正在根据已保存的任务继续，请稍候。",
        alignment: publicAlignmentView(conversation.alignment),
      }, { status: 409 });
    }
    if (conversation.alignment.state === "awaiting_confirmation") {
      return Response.json({
        error: "alignment_pending",
        message: "请先确认当前方案，或取消需求对齐。",
        alignment: publicAlignmentView(conversation.alignment),
      }, { status: 409 });
    }
    if (conversation.alignment.state === "awaiting_user" && conversation.alignment.currentQuestion?.allowOther) {
      try {
        const applied = await applyConversationAlignmentAction({
          siteId,
          conversationId: conversation.conversationId,
          action: "select",
          questionId: conversation.alignment.currentQuestion.questionId,
          questionRevision: conversation.alignment.currentQuestion.questionRevision,
          optionId: "other",
          note: parsed.data.message,
        });
        return new Response(actionStream(siteId, applied.record.conversationId, "select", {
          record: applied.record,
          view: applied.view,
          result: applied.result as AlignmentActionSuccess,
        }), { headers: sseHeaders() });
      } catch (error) {
        return alignmentError(error);
      }
    }
    if (conversation.alignment.state === "idle" || conversation.alignment.state === "awaiting_style") {
      try {
        const applied = await applyConversationAlignmentAction({
          siteId,
          conversationId: conversation.conversationId,
          action: "start",
          pendingRequest: {
            message: parsed.data.message,
            baseRevision: parsed.data.baseRevision,
            selectedTarget: parsed.data.selectedTarget ?? null,
          },
        });
        return new Response(actionStream(siteId, applied.record.conversationId, "start", {
          record: applied.record,
          view: applied.view,
          result: applied.result as AlignmentActionSuccess,
        }), { headers: sseHeaders() });
      } catch (error) {
        return alignmentError(error);
      }
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const conversationId = conversation.conversationId;
      const emitDone = (value: Record<string, unknown>) => {
        event(controller, { ...value, conversationId });
      };
      try {
        event(controller, { type: "status", value: "正在调用模型并生成结构化操作…" });
        const provider = await requestStructuredOperations({
          message: parsed.data.message,
          draft: current.draft,
          templateId: current.draft.templateId,
          selectedTarget: parsed.data.selectedTarget,
          conversationContext: conversationPromptContext(conversation),
          alignmentContext: conversation.alignment.enabled ? alignmentPromptContext(conversation.alignment) : "",
        });

        let outcome: ConversationTurnOutcome = "error";
        let aiSummary = "";
        let appliedOperationsSummary = "not applied";
        let doneEvent: Record<string, unknown>;

        if (!provider.ok) {
          aiSummary = provider.error;
          appliedOperationsSummary = "not applied: provider error";
          doneEvent = { type: "done", status: "error", error: provider.error, code: provider.code, latencyMs: provider.latencyMs };
        } else if (provider.type === "answer") {
          event(controller, { type: "answer", text: provider.text });
          outcome = "no_change";
          aiSummary = provider.text;
          appliedOperationsSummary = "not applied: answer";
          doneEvent = { type: "done", status: "answer", text: provider.text, model: provider.model, latencyMs: provider.latencyMs };
        } else if (provider.type === "clarify") {
          event(controller, {
            type: "clarify",
            question: provider.question,
            ...(provider.options ? { options: provider.options } : {}),
          });
          outcome = "no_change";
          aiSummary = provider.question;
          appliedOperationsSummary = "not applied: clarify";
          doneEvent = {
            type: "done",
            status: "clarify",
            question: provider.question,
            ...(provider.options ? { options: provider.options } : {}),
            model: provider.model,
            latencyMs: provider.latencyMs,
          };
        } else {
          event(controller, { type: "status", value: "正在校验操作并保存草稿…" });
          try {
            const committed = await commitOperations({
              siteId,
              baseRevision: parsed.data.baseRevision,
              operations: provider.operations,
              summary: provider.summary,
              source: "ai",
              model: provider.model,
              latencyMs: provider.latencyMs,
            });
            if (committed.status === "conflict") {
              outcome = "conflict";
              aiSummary = provider.summary;
              appliedOperationsSummary = "not applied: conflict";
              doneEvent = { type: "done", status: "conflict", error: "草稿在 AI 处理期间已被更新，本次操作没有覆盖新版本。", ...snapshot(committed.record) };
            } else if (committed.status === "no_change") {
              outcome = "no_change";
              aiSummary = provider.summary;
              appliedOperationsSummary = "not applied: no_change";
              doneEvent = { type: "done", status: "no_change", summary: provider.summary, rejected: provider.rejected, ...snapshot(committed.record), model: provider.model, latencyMs: provider.latencyMs };
            } else {
              outcome = "applied";
              aiSummary = provider.summary;
              appliedOperationsSummary = summarizeAppliedOperations(committed.changeSet.operations, committed.changeSet.appliedTargets);
              doneEvent = { type: "done", status: "applied", summary: provider.summary, rejected: provider.rejected, changeSet: committed.changeSet, ...snapshot(committed.record), model: provider.model, latencyMs: provider.latencyMs };
            }
          } catch (error) {
            aiSummary = error instanceof Error ? error.message : "操作应用失败";
            appliedOperationsSummary = "not applied: operation_error";
            doneEvent = { type: "done", status: "error", code: "operation_error", error: aiSummary };
          }
        }

        try {
          await appendConversationTurn({
            siteId,
            conversationId,
            userMessage: parsed.data.message,
            aiSummary,
            appliedOperationsSummary,
            outcome,
          });
        } catch (error) {
          emitDone({
            ...doneEvent,
            conversationPersisted: false,
            conversationError: persistWarning(error),
          });
          return;
        }
        emitDone(doneEvent);
      } catch (error) {
        emitDone({
          type: "done",
          status: "error",
          code: "conversation_error",
          error: error instanceof Error ? error.message : "对话处理失败",
        });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: sseHeaders() });
}
