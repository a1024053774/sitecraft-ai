import { moveHistory, snapshot } from "@/lib/site-store";
import { SiteMigrationError } from "@/lib/site-migration";
import { userErrorPayload } from "@/lib/user-errors";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ siteId: string; action: string }> }) {
  const { siteId, action } = await params;
  if (action !== "undo" && action !== "redo") return Response.json(userErrorPayload({ code: "invalid_payload" }), { status: 404 });
  try {
    const result = await moveHistory(siteId, action);
    return Response.json({ status: result.status, ...(result.status === "applied" ? { changeSet: result.changeSet, appliedTargets: result.appliedTargets } : {}), ...snapshot(result.record) });
  } catch (error) {
    if (error instanceof SiteMigrationError) return Response.json(userErrorPayload({ code: error.code }), { status: 422 });
    throw error;
  }
}
