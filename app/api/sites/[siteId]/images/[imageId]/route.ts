import { readSiteImage, SiteImageError } from "@/lib/site-images";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string; imageId: string }> }) {
  const { siteId, imageId } = await params;
  try {
    const loaded = await readSiteImage(siteId, imageId);
    if (!loaded) return new Response("Image not found", { status: 404 });
    return new Response(Buffer.from(loaded.bytes), {
      headers: {
        "Content-Type": loaded.record.mime,
        "Content-Length": String(loaded.bytes.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Sitecraft-Image-Site": loaded.record.siteId,
        "X-Sitecraft-Image-License": loaded.record.license,
      },
    });
  } catch (error) {
    if (error instanceof SiteImageError) {
      const status = error.code === "not_found" ? 404 : error.code === "forbidden" ? 403 : 400;
      return new Response(error.message, { status });
    }
    return new Response("Image read failed", { status: 500 });
  }
}
