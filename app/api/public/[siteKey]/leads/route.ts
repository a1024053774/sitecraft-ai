import { z } from "zod";
import { createLead, LeadStoreError } from "@/lib/lead-store";

export const runtime = "nodejs";

const leadSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email().max(160),
  company: z.string().max(120).optional(),
  message: z.string().min(1).max(4000),
  honeypot: z.string().max(80).optional(),
});

function statusFor(error: unknown) {
  if (error instanceof LeadStoreError) {
    if (error.code === "invalid") return 400;
    if (error.code === "not_found") return 404;
    if (error.code === "full") return 429;
  }
  return 500;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteKey: string }> },
) {
  const { siteKey } = await params;
  const parsed = leadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "询盘字段无效" }, { status: 400 });
  }
  if (parsed.data.honeypot) {
    return Response.json({ status: "accepted" }, { status: 201 });
  }
  try {
    const lead = await createLead({
      siteId: siteKey,
      name: parsed.data.name,
      email: parsed.data.email,
      company: parsed.data.company,
      message: parsed.data.message,
    });
    return Response.json(
      {
        id: lead.id,
        siteKey: lead.siteId,
        status: lead.status,
        receivedAt: lead.receivedAt,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "询盘未保存" },
      { status: statusFor(error) },
    );
  }
}
