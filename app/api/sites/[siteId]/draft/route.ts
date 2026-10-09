import { z } from 'zod';
import { getCodeSite, commitSiteCode, CodeSiteUnavailableError } from '@/lib/code-site-store';
import { codeSiteSchema } from '@/lib/code-site';
import { codeWorkspaceState } from '@/lib/code-site-workflow';
import { userErrorPayload } from '@/lib/user-errors';

export const runtime = 'nodejs';
export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  try {
    const site = await getCodeSite(siteId);
    if (!site) return Response.json(userErrorPayload({ code: 'site_not_found' }), { status: 404 });
    return Response.json(await codeWorkspaceState(site), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (!(error instanceof CodeSiteUnavailableError)) throw error;
    return Response.json({ error: 'site_unavailable', userMessage: error.message }, { status: 422, headers: { 'Cache-Control': 'no-store' } });
  }
}
const submission = z.object({ baseRevision: z.number().int().nonnegative(), code: codeSiteSchema, summary: z.string().min(1).max(500) }).strict();
export async function PUT(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  try {
    const site = await getCodeSite(siteId);
    if (!site) return Response.json(userErrorPayload({ code: 'site_not_found' }), { status: 404 });
    if (site.run?.status === 'running') return Response.json({ userMessage: '当前生成还在进行。' }, { status: 409 });
    const parsed = submission.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json(userErrorPayload({ code: 'invalid_payload' }), { status: 400 });
    const result = await commitSiteCode({ siteId, ...parsed.data, author: 'user', request: parsed.data.summary });
    return Response.json({ status: result.status, ...(result.status === 'rejected' ? { checks: result.checks, userMessage: `底线检查未通过：${result.checks.issues.join('；')}` } : {}), ...await codeWorkspaceState(result.site) }, { status: result.status === 'rejected' ? 422 : result.status === 'conflict' ? 409 : 200 });
  } catch (error) { return Response.json({ userMessage: error instanceof Error ? error.message : '提交失败，未保存版本。' }, { status: 422 }); }
}
