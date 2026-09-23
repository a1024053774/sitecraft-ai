import { z } from "zod";
import { getSite, listExistingSites } from "@/lib/site-store";
import { templates } from "@/lib/site-model";
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
  return Response.json({ id, ...parsed.data, status: "draft", ...(await getSite(id)) }, { status: 201 });
}

export async function GET() {
  const sites = await listExistingSites();
  return Response.json({ sites }, { headers: { "Cache-Control": "no-store" } });
}
