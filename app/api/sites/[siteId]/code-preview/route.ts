import { getCodeSite } from '@/lib/code-site-store';
import { currentCodeVersion } from '@/lib/code-site';
import { serveCodePage } from '@/lib/code-site-serving';

export const runtime = 'nodejs';
export async function GET(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const site = await getCodeSite(siteId);
  if (!site) return new Response('找不到这个站点', { status: 404 });
  const query = new URL(request.url).searchParams;
  const version = query.has('version') ? site.versions.find(v => v.id === query.get('version')) : currentCodeVersion(site);
  const pageId = query.get('page') || 'home';
  return serveCodePage(site, version, pageId, query.get('language') === 'en' ? 'en' : 'zh');
}
