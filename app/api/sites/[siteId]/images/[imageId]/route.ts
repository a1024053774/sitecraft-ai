import { withSiteWorkspace } from '@/lib/workspace-session';
import { readSiteImage, SiteImageError } from "@/lib/site-images";
import { userErrorPayload } from "@/lib/user-errors";

export const runtime = "nodejs";

async function getSiteRoute(_request: Request, { params }: { params: Promise<{ siteId: string; imageId: string }> }) {
  const { siteId, imageId } = await params;
  try {
    const loaded = await readSiteImage(siteId, imageId);
    if (!loaded) return Response.json(userErrorPayload({ code: "image_invalid" }), { status: 404 });
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
      return Response.json(userErrorPayload({ code: "image_invalid" }), { status });
    }
    return Response.json(userErrorPayload({ code: "database_error" }), { status: 500 });
  }
}
// T-202: in browser storage only the workspace that opened this site may use it.
export async function GET(request: Request, context: { params: Promise<{ siteId: string; imageId: string }> }) {
  return withSiteWorkspace(request, (await context.params).siteId, () => getSiteRoute(request, context));
}
