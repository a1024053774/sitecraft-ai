import { browserStorage } from '@/lib/workspace-session';
import { getCodeSite } from '@/lib/code-site-store';
import { currentCodeVersion } from '@/lib/code-site';
import { serveCodePage } from '@/lib/code-site-serving';

export const runtime = 'nodejs';
export async function GET(request: Request, { params }: { params: Promise<{ siteKey: string }> }) {
  // T-202: browser storage keeps no lasting server copy, so there are no public links; download the site package instead.
  if (browserStorage) return new Response('这个服务器不提供公开发布链接，请在工作台下载站点包后自行托管。', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const { siteKey } = await params;
  const site = await getCodeSite(siteKey);
  if (!site) return new Response('找不到这个站点', { status: 404 });
  return serveCodePage(site, currentCodeVersion(site), new URL(request.url).searchParams.get('page') || 'home', 'en', true);
}
