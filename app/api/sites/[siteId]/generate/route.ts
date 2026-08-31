import { z } from "zod";
import { getSite, commitOperations, snapshot } from "@/lib/site-store";
import { requestSiteIntent, requestDraftOperations } from "@/lib/ai-provider";
import { resolveTemplate, siteIntentSchema } from "@/lib/site-intent";
import { generateDraftOperations } from "@/lib/site-generator";
import { getTemplate } from "@/lib/site-model";
import {
  getOrCreateSession,
  pushAssistantMessage,
  recordAppliedChange,
} from "@/lib/ai-session";

export const runtime = "nodejs";

const generateSchema = z.discriminatedUnion("step", [
  z.object({
    step: z.literal("analyze"),
    message: z.string().trim().min(1).max(400),
  }),
  z.object({
    step: z.literal("execute"),
    message: z.string().trim().min(1).max(400),
    intent: siteIntentSchema,
    templateId: z.string().min(1).max(80),
    hiddenSections: z.array(z.enum(["about", "features", "services", "products", "contact"])).default([]),
    baseRevision: z.number().int().nonnegative(),
    sessionId: z.string().max(80).optional(),
  }),
]);

function event(controller: ReadableStreamDefaultController<Uint8Array>, value: unknown) {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(value)}\n\n`));
}

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const parsed = generateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid generate payload", details: parsed.error.flatten() }, { status: 400 });
  }
  const { siteId } = await params;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      if (parsed.data.step === "analyze") {
        // 意图理解：一句话 → 结构化需求 + 模板推荐（不落盘，避免空站）
        event(controller, { type: "status", value: "正在理解你的需求…" });
        const intentRes = await requestSiteIntent({ text: parsed.data.message });
        if (!intentRes.ok) {
          event(controller, { type: "done", status: "error", error: intentRes.error, code: intentRes.code, latencyMs: intentRes.latencyMs });
          controller.close();
          return;
        }
        event(controller, { type: "status", value: "正在匹配模板…" });
        const template = resolveTemplate(intentRes.intent, parsed.data.message);
        event(controller, {
          type: "done",
          status: "ready",
          intent: intentRes.intent,
          template: {
            id: template.templateId,
            name: template.name,
            category: template.category,
            reason: template.reason,
          },
          hiddenSections: [],
          model: intentRes.model,
          latencyMs: intentRes.latencyMs,
        });
        controller.close();
        return;
      }

      // execute：生成整站初稿（单次 commit，可撤销）
      const current = await getSite(siteId);
      if (current.draft.revision !== parsed.data.baseRevision) {
        event(controller, { type: "done", status: "conflict", error: "草稿已经更新，请刷新后重试。" });
        controller.close();
        return;
      }
      event(controller, { type: "status", value: "正在生成网站骨架…" });
      const draftOpsProvider = async (args: Parameters<typeof requestDraftOperations>[0]) => {
        const r = await requestDraftOperations(args);
        return r.ok
          ? { ok: true as const, summary: r.summary, operations: r.operations, model: r.model }
          : { ok: false as const, code: r.code, error: r.error };
      };
      const generated = await generateDraftOperations({
        intent: parsed.data.intent,
        templateId: parsed.data.templateId,
        hiddenSections: parsed.data.hiddenSections,
        draftOps: draftOpsProvider,
      });
      if (!generated.ok) {
        event(controller, { type: "done", status: "error", error: generated.error, code: generated.code });
        controller.close();
        return;
      }
      event(controller, { type: "status", value: "正在校验并保存初稿…" });
      try {
        const committed = await commitOperations({
          siteId,
          baseRevision: parsed.data.baseRevision,
          operations: generated.operations,
          summary: generated.summary,
          source: "ai",
          model: generated.model,
          latencyMs: 0,
        });
        // 播种会话：让"刚才生成的首屏"在工作区能命中
        if (parsed.data.sessionId && committed.status === "applied") {
          const session = getOrCreateSession(siteId, parsed.data.sessionId, {
            baseRevision: committed.changeSet.revision,
            templateId: current.draft.templateId,
          });
          recordAppliedChange(session, {
            revision: committed.changeSet.revision,
            summary: generated.summary,
            targets: committed.changeSet.appliedTargets,
            draft: committed.record.draft,
          });
          pushAssistantMessage(session, generated.summary);
        }
        if (committed.status === "conflict") {
          event(controller, { type: "done", status: "conflict", error: "草稿在生成期间已被更新。", ...snapshot(committed.record) });
        } else if (committed.status === "no_change") {
          event(controller, { type: "done", status: "no_change", summary: generated.summary, ...snapshot(committed.record), model: generated.model });
        } else {
          event(controller, { type: "done", status: "applied", summary: generated.summary, changeSet: committed.changeSet, ...snapshot(committed.record), model: generated.model });
        }
      } catch (error) {
        event(controller, { type: "done", status: "error", code: "operation_error", error: error instanceof Error ? error.message : "生成失败" });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", Connection: "keep-alive" } });
}
