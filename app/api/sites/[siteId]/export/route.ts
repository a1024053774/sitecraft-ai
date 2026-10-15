import { getCodeSite, CodeSiteUnavailableError } from '@/lib/code-site-store';
import { currentCodeVersion } from '@/lib/code-site';
import { buildStaticSitePackage } from '@/lib/code-site-export';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  try {
    const site = await getCodeSite(siteId);
    if (!site) return new Response('找不到这个站点', { status: 404 });
    const version = currentCodeVersion(site);
    if (!version) return new Response('这个站点尚未生成版本', { status: 404 });
    const pack = await buildStaticSitePackage(site, version);
    return new Response(pack.bytes, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${pack.filename}"`,
        'Content-Length': String(pack.bytes.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof CodeSiteUnavailableError) return new Response('这个站点没有可导出的版本', { status: 422 });
    if (error instanceof Error && error.message === 'Invalid site id') return new Response('站点编号无效', { status: 400 });
    throw error;
  }
}
