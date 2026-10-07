import { getExistingSite, moveHistory, snapshot } from "@/lib/site-store";
import { userErrorPayload } from "@/lib/user-errors";
import { getCodeSite, commitSiteCode } from '@/lib/code-site-store';
import { currentCodeVersion } from '@/lib/code-site';
import { codeWorkspaceState } from '@/lib/code-site-workflow';

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ siteId: string; action: string }> }) {
  const { siteId, action } = await params;
  if (action !== "undo" && action !== "redo") return Response.json(userErrorPayload({ code: "invalid_payload" }), { status: 404 });
  if (!await getExistingSite(siteId)) return Response.json(userErrorPayload({ code: "site_not_found" }), { status: 404 });
  const codeSite = await getCodeSite(siteId);
  if (codeSite) {
    if (codeSite.run?.status === 'running') return Response.json({ userMessage: '当前生成还在进行。' }, { status: 409 });
    const current = currentCodeVersion(codeSite), previous = codeSite.versions.at(-2);
    if (action !== 'undo' || !current || !previous) return Response.json({ userMessage: '没有可撤销的版本。' }, { status: 422 });
    try {
      const result = await commitSiteCode({ siteId, baseRevision: current.revision, restoreVersionId: previous.id, author: 'user', summary: `撤销，恢复版本 ${previous.revision}`, request: '撤销上次修改' });
      return Response.json({ status: result.status, ...(result.status === 'rejected' ? { checks: result.checks, userMessage: `恢复未通过检查：${result.checks.issues.join('；')}` } : {}), ...await codeWorkspaceState(result.site) }, { status: result.status === 'rejected' ? 422 : result.status === 'conflict' ? 409 : 200 });
    } catch (error) { return Response.json({ userMessage: error instanceof Error ? error.message : '撤销失败。' }, { status: 422 }); }
  }
  const result = await moveHistory(siteId, action);
  return Response.json({ status: result.status, ...(result.status === "applied" ? { changeSet: result.changeSet, appliedTargets: result.appliedTargets } : {}), ...snapshot(result.record) });
}
