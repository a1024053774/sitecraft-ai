import { getCodeSite, CodeSiteUnavailableError } from '@/lib/code-site-store';
import { currentCodeVersion, renderSiteCode, escapeCodeText } from '@/lib/code-site';
import { listSiteImages } from '@/lib/site-images';

export const runtime = 'nodejs';
export async function GET(request: Request, { params }: { params: Promise<{ siteKey: string }> }) {
  const { siteKey } = await params;
  try {
    const site = await getCodeSite(siteKey);
    if (!site) return new Response('找不到这个站点', { status: 404 });
    const version = currentCodeVersion(site), pageId = new URL(request.url).searchParams.get('page') || 'home';
    if (!version || !version.code.pages.some(page => page.id === pageId)) return new Response('这个页面尚未生成', { status: 404 });
    const used = new Set((version.code.header + version.code.footer + version.code.pages.map(page => page.html).join('')).match(/img_[a-z0-9]{16,40}/g));
    const credits = [...new Set((await listSiteImages(siteKey)).filter(image => used.has(image.imageId) && image.attribution).map(image => image.attribution))];
    return new Response(renderSiteCode(siteKey, version.code, pageId, '', credits, `/published/${encodeURIComponent(siteKey)}`), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "sandbox allow-forms; default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'self'; base-uri 'none'" },
    });
  } catch (error) {
    if (!(error instanceof CodeSiteUnavailableError)) throw error;
    return new Response(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>站点无法打开</title><body><main><h1>站点无法打开</h1><p>${escapeCodeText(error.message)}</p></main></body></html>`, {
      status: 422, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; script-src 'none'" },
    });
  }
}
