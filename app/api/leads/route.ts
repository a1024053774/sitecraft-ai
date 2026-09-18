import { LeadStoreError, listLeads, SITE_ID_PATTERN } from "@/lib/lead-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const siteId = new URL(request.url).searchParams.get("site")?.trim() || undefined;
  if (siteId && !SITE_ID_PATTERN.test(siteId)) {
    return Response.json({ error: "站点编号无效" }, { status: 400 });
  }
  try {
    const leads = await listLeads(siteId ? { siteId } : {});
    return Response.json(
      { leads, count: leads.length },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const status = error instanceof LeadStoreError && error.code === "invalid" ? 400 : 500;
    return Response.json(
      { error: error instanceof Error ? error.message : "无法读取询盘" },
      { status },
    );
  }
}
