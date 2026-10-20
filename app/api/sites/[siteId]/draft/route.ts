import { ServerBusyError } from '@/lib/work-queue';
import { withSiteWorkspace } from '@/lib/workspace-session';
import { withRequestProvider } from '@/lib/provider-context';
import { z } from 'zod';
import { getCodeSite, commitSiteCode, CodeSiteUnavailableError } from '@/lib/code-site-store';
import { codeSiteSchema } from '@/lib/code-site';
import { codeWorkspaceState, queuedCommit } from '@/lib/code-site-workflow';
import { userErrorPayload } from '@/lib/user-errors';

export const runtime = 'nodejs';
async function getSiteRoute(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
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
async function putSiteRoute(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  return withRequestProvider(request, () => handlePut(request, params));
}
async function handlePut(request: Request, params: Promise<{ siteId: string }>) {
  const { siteId } = await params;
  try {
    const site = await getCodeSite(siteId);
    if (!site) return Response.json(userErrorPayload({ code: 'site_not_found' }), { status: 404 });
    if (site.run?.status === 'running') return Response.json({ userMessage: '当前生成还在进行。' }, { status: 409 });
    const parsed = submission.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json(userErrorPayload({ code: 'invalid_payload' }), { status: 400 });
    const result = await queuedCommit(siteId, () => commitSiteCode({ siteId, ...parsed.data, author: 'user', request: parsed.data.summary }));
    return Response.json({ status: result.status, ...(result.status === 'rejected' ? { checks: result.checks, userMessage: `底线检查未通过：${result.checks.issues.join('；')}` } : {}), ...await codeWorkspaceState(result.site) }, { status: result.status === 'rejected' ? 422 : result.status === 'conflict' ? 409 : 200 });
  } catch (error) { return Response.json({ userMessage: error instanceof Error ? error.message : '提交失败，未保存版本。' }, { status: error instanceof ServerBusyError ? 503 : 422 }); }
}
// T-202: in browser storage only the workspace that opened this site may use it.
export async function GET(request: Request, context: { params: Promise<{ siteId: string }> }) {
  return withSiteWorkspace(request, (await context.params).siteId, () => getSiteRoute(request, context));
}
export async function PUT(request: Request, context: { params: Promise<{ siteId: string }> }) {
  return withSiteWorkspace(request, (await context.params).siteId, () => putSiteRoute(request, context));
}
