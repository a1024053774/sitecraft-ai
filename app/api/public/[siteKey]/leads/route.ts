import { z } from "zod";
import { createLead, LeadStoreError } from "@/lib/lead-store";
import { deliverLeadNotification } from "@/lib/smtp";
import { userErrorPayload } from "@/lib/user-errors";
import { getCodeSite } from '@/lib/code-site-store';
import { escapeCodeText } from '@/lib/code-site';

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
  const htmlForm = request.headers.get('content-type')?.includes('application/x-www-form-urlencoded') === true;
  if (htmlForm && !await getCodeSite(siteKey)) return Response.json(userErrorPayload({ code: 'lead_invalid' }), { status: 400 });
  const input = htmlForm ? Object.fromEntries(await request.formData()) : await request.json().catch(() => null);
  const parsed = leadSchema.safeParse(input);
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
    if (htmlForm) return new Response(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>询盘已保存</title><body><main><h1>询盘已保存</h1><p>${delivery.status === 'sent' ? '询盘已发送。' : '留言已写入收件箱。'}</p><a href="/published/${escapeCodeText(siteKey)}">返回网站</a></main></body></html>`, { status: 201, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; script-src 'none'", 'Cache-Control': 'no-store' } });
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
