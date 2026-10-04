import { getExistingSite, moveHistory, snapshot } from "@/lib/site-store";
import { userErrorPayload } from "@/lib/user-errors";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ siteId: string; action: string }> }) {
  const { siteId, action } = await params;
  if (action !== "undo" && action !== "redo") return Response.json(userErrorPayload({ code: "invalid_payload" }), { status: 404 });
  if (!await getExistingSite(siteId)) return Response.json(userErrorPayload({ code: "site_not_found" }), { status: 404 });
  const result = await moveHistory(siteId, action);
  return Response.json({ status: result.status, ...(result.status === "applied" ? { changeSet: result.changeSet, appliedTargets: result.appliedTargets } : {}), ...snapshot(result.record) });
}
