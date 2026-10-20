import { browserStorage } from '@/lib/workspace-session';
import { getCodeSite, CodeSiteUnavailableError } from '@/lib/code-site-store';
import { currentCodeVersion, escapeCodeText } from '@/lib/code-site';
import { serveCodePage } from '@/lib/code-site-serving';

export const runtime = 'nodejs';
export async function GET(request: Request, { params }: { params: Promise<{ siteKey: string }> }) {
  // T-202: browser storage keeps no lasting server copy, so there are no public links; download the site package instead.
  if (browserStorage) return new Response('这个服务器不提供公开发布链接，请在工作台下载站点包后自行托管。', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const { siteKey } = await params;
  try {
    const site = await getCodeSite(siteKey);
    if (!site) return new Response('找不到这个站点', { status: 404 });
    const version = currentCodeVersion(site), pageId = new URL(request.url).searchParams.get('page') || 'home';
    return serveCodePage(site, version, pageId, 'zh', true);
  } catch (error) {
    if (!(error instanceof CodeSiteUnavailableError)) throw error;
    return new Response(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>站点无法打开</title><body><main><h1>站点无法打开</h1><p>${escapeCodeText(error.message)}</p></main></body></html>`, {
      status: 422, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; script-src 'none'" },
    });
  }
}
