import { z } from "zod";
import { requestStructuredOperations } from "@/lib/ai-provider";
import {
  appendConversationTurn,
  CONVERSATION_ID_PATTERN,
  conversationPromptContext,
  getOrCreateConversation,
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

function event(controller: ReadableStreamDefaultController<Uint8Array>, value: unknown) {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(value)}\n\n`));
}

function summarizeAppliedOperations(operations: Array<{ op: string }>, appliedTargets: string[]) {
  return `applied ops=${operations.map((item) => item.op).join(",") || "none"} targets=${appliedTargets.join(",") || "none"}`;
}

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const parsed = chatSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid chat payload", details: parsed.error.flatten() }, { status: 400 });
  const { siteId } = await params;
  const current = await getSite(siteId);
  if (current.draft.revision !== parsed.data.baseRevision) {
    return Response.json({ error: "revision_conflict", message: "草稿已经更新，请刷新后重试。", ...current }, { status: 409 });
  }

  let conversation: ConversationRecord;
  try {
    conversation = await getOrCreateConversation(siteId, parsed.data.conversationId ?? undefined);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "会话创建失败" }, { status: 400 });
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
            conversationError: `会话写入失败：${error instanceof Error ? error.message : "未知错误"}`,
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
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", Connection: "keep-alive" } });
}
