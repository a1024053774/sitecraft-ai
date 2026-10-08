import { z } from "zod";
import { commitOperations, createSite, listExistingSites, snapshot } from "@/lib/site-store";
import { templates } from "@/lib/site-model";
import { visualBriefCatalog } from "@/lib/site-document";
import { userErrorPayload } from "@/lib/user-errors";
import { createCodeSite } from "@/lib/code-site-store";
import { createConversation } from "@/lib/conversation-store";

const createSiteSchema = z.object({
  name: z.string().min(1).max(100),
  templateId: z.string().refine((id) => templates.some((template) => template.id === id)),
  locales: z.array(z.enum(["zh", "en"])).min(1),
  generationRoute: z.literal('code').optional(),
});

export async function POST(request: Request) {
  const parsed = createSiteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json(userErrorPayload({ code: "invalid_payload" }), { status: 400 });
  const id = crypto.randomUUID();
  const initial = await createSite(id);
  if (parsed.data.generationRoute === 'code') {
    const conversation = await createConversation(id);
    const codeSite = await createCodeSite(id, parsed.data.name, conversation.conversationId);
    return Response.json({ id, ...initial, codeSite, conversationId: conversation.conversationId }, { status: 201 });
  }
  const brief = visualBriefCatalog.find((item) => item.templateId === parsed.data.templateId);
  if (!brief) return Response.json(userErrorPayload({ code: "invalid_payload" }), { status: 400 });
  const seeded = await commitOperations({
    siteId: id,
    baseRevision: initial.draft.revision,
    operations: [{ op: "set_visual_brief", briefId: brief.id }],
    summary: "按新建站点所选样子初始化草稿",
    source: "template",
  });
  return Response.json({ id, ...parsed.data, status: "draft", ...snapshot(seeded.record, true) }, { status: 201 });
}

export async function GET() {
  const sites = await listExistingSites();
  return Response.json({ sites }, { headers: { "Cache-Control": "no-store" } });
}
