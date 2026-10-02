import { SiteDeleteError, deleteSiteByUserChoice } from "@/lib/site-delete";
import { userErrorPayload } from "@/lib/user-errors";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const { siteId } = await params;
  const body = await request.json().catch(() => null) as { confirmSiteId?: unknown } | null;
  try {
    const result = await deleteSiteByUserChoice(siteId, body?.confirmSiteId);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SiteDeleteError) {
      const status = error.code === "not_found" ? 404 : 400;
      const code = error.code === "not_found" ? "site_not_found" : "delete_unconfirmed";
      return Response.json(userErrorPayload({ code }), { status });
    }
    if (error instanceof Error && error.message === "Invalid site id") {
      return Response.json(userErrorPayload({ code: "invalid_payload" }), { status: 400 });
    }
    return Response.json(userErrorPayload({ code: "database_error" }), { status: 500 });
  }
}
