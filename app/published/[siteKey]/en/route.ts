import { getCodeSite } from '@/lib/code-site-store';
import { currentCodeVersion } from '@/lib/code-site';
import { serveCodePage } from '@/lib/code-site-serving';

export const runtime = 'nodejs';
export async function GET(request: Request, { params }: { params: Promise<{ siteKey: string }> }) {
  const { siteKey } = await params;
  const site = await getCodeSite(siteKey);
  if (!site) return new Response('找不到这个站点', { status: 404 });
  return serveCodePage(site, currentCodeVersion(site), new URL(request.url).searchParams.get('page') || 'home', 'en', true);
}
