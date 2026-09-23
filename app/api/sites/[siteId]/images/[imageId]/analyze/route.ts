import { requestImageFacts } from "@/lib/ai-provider";
import { readSiteImage, SiteImageError } from "@/lib/site-images";
import { userErrorPayload } from "@/lib/user-errors";

export const runtime = "nodejs";

function statusFor(code: string) {
  if (code === "invalid_image") return 400;
  if (code === "not_configured") return 503;
  if (code === "timeout") return 504;
  if (code === "invalid_output") return 422;
  return 502;
}

export async function POST(_request: Request, { params }: { params: Promise<{ siteId: string; imageId: string }> }) {
  const { siteId, imageId } = await params;
  try {
    const loaded = await readSiteImage(siteId, imageId);
    if (!loaded) return Response.json({ ok: false, ...userErrorPayload({ code: "image_invalid" }) }, { status: 404 });
    const result = await requestImageFacts({
      imageBytes: loaded.bytes,
      originalName: loaded.record.originalName,
    });
    if (!result.ok) {
      const userCode = result.code === "invalid_image" ? "image_invalid" : result.code;
      return Response.json(
        { ok: false, ...userErrorPayload({ code: userCode }), model: result.model },
        { status: statusFor(result.code) },
      );
    }
    return Response.json({
      ok: true,
      image: {
        imageId: loaded.record.imageId,
        siteId: loaded.record.siteId,
        url: `/api/sites/${loaded.record.siteId}/images/${loaded.record.imageId}`,
        sourceUrl: loaded.record.sourceUrl,
        license: loaded.record.license,
        licenseUrl: loaded.record.licenseUrl,
        author: loaded.record.author,
        attribution: loaded.record.attribution,
        usageScope: loaded.record.usageScope,
        retrievedAt: loaded.record.retrievedAt,
        sha256: loaded.record.sha256,
        source: loaded.record.source,
        width: result.image.width,
        height: result.image.height,
        byteLength: result.image.byteLength,
        mime: result.image.mime,
      },
      facts: result.facts,
      model: result.model,
      latencyMs: result.latencyMs,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SiteImageError) {
      return Response.json({ ok: false, ...userErrorPayload({ code: "image_invalid" }) }, { status: error.code === "forbidden" ? 403 : 400 });
    }
    return Response.json({ ok: false, ...userErrorPayload({ code: "provider_error" }) }, { status: 500 });
  }
}
