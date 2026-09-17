import { requestPreviewReview } from "@/lib/ai-provider";

export const runtime = "nodejs";

function statusFor(code: string) {
  if (code === "invalid_image") return 400;
  if (code === "not_configured") return 503;
  if (code === "timeout") return 504;
  if (code === "invalid_output") return 422;
  return 502;
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return Response.json({ error: "需要 multipart 表单，字段名 screenshot" }, { status: 400 });
  }
  const file = form.get("screenshot");
  if (!(file instanceof Blob) || file.size <= 0) {
    return Response.json({ error: "需要 screenshot 文件" }, { status: 400 });
  }
  const claimedRaw = form.get("claimedTemplateId");
  const claimedTemplateId = typeof claimedRaw === "string" && claimedRaw.trim() ? claimedRaw.trim() : null;
  const imageBytes = new Uint8Array(await file.arrayBuffer());
  const result = await requestPreviewReview({ imageBytes, claimedTemplateId });
  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.error, code: result.code, model: result.model, aesthetic: "human" },
      { status: statusFor(result.code) },
    );
  }
  return Response.json({
    ok: true,
    aesthetic: "human",
    review: result.review,
    model: result.model,
    latencyMs: result.latencyMs,
    image: result.image,
  });
}
