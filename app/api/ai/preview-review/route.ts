import { requestPreviewReview } from "@/lib/ai-provider";
import { userErrorPayload } from "@/lib/user-errors";

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
    return Response.json({ ok: false, ...userErrorPayload({ code: "image_invalid" }) }, { status: 400 });
  }
  const file = form.get("screenshot");
  if (!(file instanceof Blob) || file.size <= 0) {
    return Response.json({ ok: false, ...userErrorPayload({ code: "image_invalid" }) }, { status: 400 });
  }
  const claimedRaw = form.get("claimedTemplateId");
  const claimedTemplateId = typeof claimedRaw === "string" && claimedRaw.trim() ? claimedRaw.trim() : null;
  const imageBytes = new Uint8Array(await file.arrayBuffer());
  const result = await requestPreviewReview({ imageBytes, claimedTemplateId });
  if (!result.ok) {
    const code = result.code === "invalid_image" ? "image_invalid" : result.code;
    return Response.json(
      { ok: false, ...userErrorPayload({ code, userMessage: result.code === "invalid_image" ? result.error : undefined }), model: result.model, aesthetic: "human" },
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
