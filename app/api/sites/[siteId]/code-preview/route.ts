import { withSiteWorkspace } from '@/lib/workspace-session';
import { getCodeSite } from '@/lib/code-site-store';
import { currentCodeVersion } from '@/lib/code-site';
import { serveCodePage } from '@/lib/code-site-serving';

export const runtime = 'nodejs';
async function getSiteRoute(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const site = await getCodeSite(siteId);
  if (!site) return new Response('找不到这个站点', { status: 404 });
  const query = new URL(request.url).searchParams;
  const version = query.has('version') ? site.versions.find(v => v.id === query.get('version')) : currentCodeVersion(site);
  const pageId = query.get('page') || 'home';
  return serveCodePage(site, version, pageId, query.get('language') === 'en' ? 'en' : 'zh');
}
// T-202: in browser storage only the workspace that opened this site may use it.
export async function GET(request: Request, context: { params: Promise<{ siteId: string }> }) {
  return withSiteWorkspace(request, (await context.params).siteId, () => getSiteRoute(request, context));
}
