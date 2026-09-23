import { z } from "zod";
import { createLead, LeadStoreError } from "@/lib/lead-store";
import { deliverLeadNotification } from "@/lib/smtp";
import { userErrorPayload } from "@/lib/user-errors";

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
    return Response.json(userErrorPayload({ code: "lead_invalid" }), { status: 400 });
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
    const delivery = await deliverLeadNotification({
      siteId: lead.siteId,
      name: lead.name,
      email: lead.email,
      company: lead.company,
      message: lead.message,
    });
    return Response.json(
      {
        id: lead.id,
        siteKey: lead.siteId,
        status: lead.status,
        receivedAt: lead.receivedAt,
        delivery: delivery.status === "sent" ? "smtp" : "stored_only",
        ...(delivery.status === "failed" ? { deliveryWarning: "询盘已写入收件箱，邮件转发结果未确认；请勿重复提交留言。" } : {}),
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const code = error instanceof LeadStoreError
      ? error.code === "not_found" ? "lead_not_found" : error.code === "full" ? "lead_full" : "lead_invalid"
      : "database_error";
    return Response.json(
      userErrorPayload({ code }),
      { status: statusFor(error) },
    );
  }
}
