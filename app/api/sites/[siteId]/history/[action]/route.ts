import { getExistingSite, moveHistory, snapshot } from "@/lib/site-store";
import { userErrorPayload } from "@/lib/user-errors";
import { getCodeSite, commitSiteCode } from '@/lib/code-site-store';
import { currentCodeVersion } from '@/lib/code-site';
import { codeWorkspaceState } from '@/lib/code-site-workflow';
import { z } from 'zod';

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string; action: string }> }) {
  const { siteId, action } = await params;
  if (action !== "undo" && action !== "redo" && action !== 'restore') return Response.json(userErrorPayload({ code: "invalid_payload" }), { status: 404 });
  if (!await getExistingSite(siteId)) return Response.json(userErrorPayload({ code: "site_not_found" }), { status: 404 });
  const codeSite = await getCodeSite(siteId);
  if (codeSite) {
    const parsed = z.object({ baseRevision: z.number().int().nonnegative(), versionId: z.string().min(1).max(100).optional() }).refine(input => action !== 'restore' || !!input.versionId).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json(userErrorPayload({ code: 'invalid_payload' }), { status: 400 });
    if (codeSite.run?.status === 'running') return Response.json({ userMessage: '当前生成还在进行。' }, { status: 409 });
    const current = currentCodeVersion(codeSite), previous = codeSite.versions.at(-2);
    const target = action === 'restore' ? codeSite.versions.find(version => version.id === parsed.data.versionId) : previous;
    if (action === 'restore' && !target) return Response.json({ userMessage: '找不到要恢复的版本。' }, { status: 404 });
    if (action === 'redo' || !current || !target) return Response.json({ userMessage: '没有可撤销的版本。' }, { status: 422 });
    try {
      const result = await commitSiteCode({ siteId, baseRevision: parsed.data.baseRevision, restoreVersionId: target.id, author: 'user', summary: `${action === 'undo' ? '撤销，' : ''}恢复版本 ${target.revision}`, request: action === 'undo' ? '撤销上次修改' : `恢复到第 ${target.revision} 版` });
      return Response.json({ status: result.status, ...(result.status === 'rejected' ? { checks: result.checks, userMessage: `恢复未通过检查：${result.checks.issues.join('；')}` } : result.status === 'conflict' ? { userMessage: '版本已经更新，请刷新后再恢复。' } : {}), ...await codeWorkspaceState(result.site) }, { status: result.status === 'rejected' ? 422 : result.status === 'conflict' ? 409 : 200 });
    } catch (error) { return Response.json({ userMessage: error instanceof Error ? error.message : '撤销失败。' }, { status: 422 }); }
  }
  if (action === 'restore') return Response.json(userErrorPayload({ code: 'invalid_payload' }), { status: 404 });
  const result = await moveHistory(siteId, action);
  return Response.json({ status: result.status, ...(result.status === "applied" ? { changeSet: result.changeSet, appliedTargets: result.appliedTargets } : {}), ...snapshot(result.record) });
}
