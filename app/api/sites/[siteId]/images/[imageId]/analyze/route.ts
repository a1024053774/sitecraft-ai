import { requestImageFacts } from "@/lib/ai-provider";
import { readSiteImage, SiteImageError } from "@/lib/site-images";

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
    if (!loaded) return Response.json({ ok: false, error: "图片不属于当前站点" }, { status: 404 });
    const result = await requestImageFacts({
      imageBytes: loaded.bytes,
      originalName: loaded.record.originalName,
    });
    if (!result.ok) {
      return Response.json(
        { ok: false, error: result.error, code: result.code, model: result.model },
        { status: statusFor(result.code) },
      );
    }
    return Response.json({
      ok: true,
      image: {
        imageId: loaded.record.imageId,
        siteId: loaded.record.siteId,
        url: `/api/sites/${loaded.record.siteId}/images/${loaded.record.imageId}`,
        license: loaded.record.license,
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
      return Response.json({ ok: false, error: error.message }, { status: error.code === "forbidden" ? 403 : 400 });
    }
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "分析失败" }, { status: 500 });
  }
}
