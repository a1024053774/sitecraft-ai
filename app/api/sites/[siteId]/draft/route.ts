import { z } from "zod";
import { siteDraftSchema } from "@/lib/site-document";
import { siteOperationSchema } from "@/lib/site-operations";
import { commitOperations, getExistingSite, snapshot } from "@/lib/site-store";
import { assertStableItemIds } from "@/lib/site-migration";
import { describeUserError, userErrorPayload } from "@/lib/user-errors";
import { getCodeSite, commitSiteCode } from '@/lib/code-site-store';
import { codeSiteSchema } from '@/lib/code-site';
import { codeWorkspaceState } from '@/lib/code-site-workflow';

export const runtime = "nodejs";

const updateSchema = z.object({
  baseRevision: z.number().int().nonnegative(),
  operations: z.array(siteOperationSchema).min(1).max(25),
  summary: z.string().min(1).max(500),
  source: z.enum(["import", "manual", "migration", "template"]),
  annotationId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/).optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const site = await getExistingSite(siteId);
  if (!site) return Response.json(userErrorPayload({ code: "site_not_found" }), { status: 404 });
  const codeSite = await getCodeSite(siteId);
  return Response.json({ ...site, ...(codeSite ? await codeWorkspaceState(codeSite) : {}) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  if (!await getExistingSite(siteId)) return Response.json(userErrorPayload({ code: "site_not_found" }), { status: 404 });
  const codeSite = await getCodeSite(siteId);
  if (codeSite) {
    if (codeSite.run?.status === 'running') return Response.json({ userMessage: '当前生成还在进行。' }, { status: 409 });
    const parsedCode = z.object({ baseRevision: z.number().int().nonnegative(), code: codeSiteSchema, summary: z.string().min(1).max(500) }).safeParse(await request.json().catch(() => null));
    if (!parsedCode.success) return Response.json(userErrorPayload({ code: 'invalid_payload' }), { status: 400 });
    try {
      const result = await commitSiteCode({ siteId, ...parsedCode.data, author: 'user', request: parsedCode.data.summary });
      return Response.json({ status: result.status, ...(result.status === 'rejected' ? { checks: result.checks, userMessage: `底线检查未通过：${result.checks.issues.join('；')}` } : {}), ...await codeWorkspaceState(result.site) }, { status: result.status === 'rejected' ? 422 : result.status === 'conflict' ? 409 : 200 });
    } catch (error) { return Response.json({ userMessage: error instanceof Error ? error.message : '提交失败，未保存版本。' }, { status: 422 }); }
  }
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json(userErrorPayload({ code: "invalid_payload" }), { status: 400 });
  for (const operation of parsed.data.operations) {
    if (operation.op === "replace_draft") {
      assertStableItemIds(operation.draft, siteId);
      const validDraft = siteDraftSchema.safeParse(operation.draft);
      if (!validDraft.success) return Response.json(userErrorPayload({ code: "invalid_payload" }), { status: 400 });
      operation.draft = validDraft.data;
    }
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
    if (error instanceof Error && error.message.startsWith("Site not found:")) {
      return Response.json(userErrorPayload({ code: "site_not_found" }), { status: 404 });
    }
    const description = describeUserError({ code: "operation_error" });
    return Response.json({ error: description.code, userMessage: description.message, recovery: description.recovery }, { status: 422 });
  }
}
