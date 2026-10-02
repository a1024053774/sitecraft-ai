import { z } from "zod";
import { siteDraftSchema } from "@/lib/site-document";
import { siteOperationSchema } from "@/lib/site-operations";
import { commitOperations, getSite, snapshot } from "@/lib/site-store";
import { SiteMigrationError, assertStableItemIds } from "@/lib/site-migration";
import { describeUserError, userErrorPayload } from "@/lib/user-errors";

export const runtime = "nodejs";

const updateSchema = z.object({
  baseRevision: z.number().int().nonnegative(),
  operations: z.array(siteOperationSchema).min(1).max(25),
  summary: z.string().min(1).max(500),
  source: z.enum(["import", "manual", "migration", "template"]),
});

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  try {
    return Response.json(await getSite(siteId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SiteMigrationError) return Response.json(userErrorPayload({ code: error.code }), { status: 422 });
    throw error;
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json(userErrorPayload({ code: "invalid_payload" }), { status: 400 });
  try {
    for (const operation of parsed.data.operations) {
      if (operation.op === "replace_draft") {
        assertStableItemIds(operation.draft, siteId);
        const validDraft = siteDraftSchema.safeParse(operation.draft);
        if (!validDraft.success) return Response.json(userErrorPayload({ code: "invalid_payload" }), { status: 400 });
        operation.draft = validDraft.data;
      }
    }
  } catch (error) {
    if (error instanceof SiteMigrationError) return Response.json(userErrorPayload({ code: error.code }), { status: 422 });
    throw error;
  }
  try {
    const result = await commitOperations({ siteId, ...parsed.data });
    if (result.status === "conflict") {
      const description = describeUserError({ code: "revision_conflict" });
      return Response.json({ error: description.code, userMessage: description.message, recovery: description.recovery, ...snapshot(result.record) }, { status: 409 });
    }
    return Response.json({
      status: result.status,
      ...(result.status === "applied" ? { changeSet: result.changeSet, rejected: result.rejected } : {}),
      ...(result.status === "rejected" ? { rejected: result.reasons } : {}),
      ...snapshot(result.record),
    });
  } catch (error) {
    if (error instanceof SiteMigrationError) return Response.json(userErrorPayload({ code: error.code }), { status: 422 });
    const description = describeUserError({ code: "operation_error" });
    return Response.json({ error: description.code, userMessage: description.message, recovery: description.recovery }, { status: 422 });
  }
}
