import { SiteDeleteError, deleteSiteByUserChoice } from "@/lib/site-delete";

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
      return Response.json({ error: error.message, code: error.code }, { status });
    }
    if (error instanceof Error && error.message === "Invalid site id") {
      return Response.json({ error: "站点编号无效", code: "invalid" }, { status: 400 });
    }
    return Response.json({ error: error instanceof Error ? error.message : "删除失败" }, { status: 500 });
  }
}
