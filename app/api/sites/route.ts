import { z } from "zod";
import { commitOperations, getSite, listExistingSites, snapshot } from "@/lib/site-store";
import { templates } from "@/lib/site-model";
import { visualBriefCatalog } from "@/lib/site-document";
import { userErrorPayload } from "@/lib/user-errors";

const createSiteSchema = z.object({
  name: z.string().min(1).max(100),
  templateId: z.string().refine((id) => templates.some((template) => template.id === id)),
  locales: z.array(z.enum(["zh", "en"])).min(1),
});

export async function POST(request: Request) {
  const parsed = createSiteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json(userErrorPayload({ code: "invalid_payload" }), { status: 400 });
  const id = crypto.randomUUID();
  const initial = await getSite(id);
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
