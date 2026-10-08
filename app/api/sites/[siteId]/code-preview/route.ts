import { getCodeSite } from '@/lib/code-site-store';
import { currentCodeVersion, renderSiteCode } from '@/lib/code-site';
import { listSiteImages } from '@/lib/site-images';
import { getExistingSite } from '@/lib/site-store';

export const runtime = 'nodejs';
export async function GET(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  if (!await getExistingSite(siteId)) return new Response('找不到这个站点', { status: 404 });
  const site = await getCodeSite(siteId);
  if (!site) return new Response('找不到这个站点', { status: 404 });
  const query = new URL(request.url).searchParams;
  const version = query.has('version') ? site.versions.find(v => v.id === query.get('version')) : currentCodeVersion(site);
  const pageId = query.get('page') || 'home';
  if (!version || !version.code.pages.some(p => p.id === pageId)) return new Response('这个页面尚未生成', { status: 404 });
  const used = new Set((version.code.header + version.code.footer + version.code.pages.map(p => p.html).join('')).match(/img_[a-z0-9]{16,40}/g));
  const images = await listSiteImages(siteId);
  const credits = images.filter(i => used.has(i.imageId) && i.attribution).map(i => i.attribution);
  return new Response(renderSiteCode(siteId, version.code, pageId, version.id, [...new Set(credits)]), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
      'Content-Security-Policy': "sandbox allow-forms; default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'self'; base-uri 'none'" },
  });
}
