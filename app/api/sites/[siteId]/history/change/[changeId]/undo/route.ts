import { selectiveUndo, snapshot } from "@/lib/site-store";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ siteId: string; changeId: string }> }) {
  const { siteId, changeId } = await params;
  const result = await selectiveUndo(siteId, changeId);
  return Response.json({
    status: result.status,
    ...(result.status === "applied" ? { changeSet: result.changeSet } : {}),
    ...("reason" in result && result.reason ? { reason: result.reason } : {}),
    conflictTargets: result.conflictTargets,
    ...snapshot(result.record),
  }, { status: result.status === "not_found" ? 404 : result.status === "rejected" ? 422 : 200 });
}
