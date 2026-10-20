import { BundleError, bundleLimitBytes, importBundle, withWorkspaceToken, browserStorage } from '@/lib/workspace-session';

export const runtime = 'nodejs';
// T-202: the browser uploads its stored site so the server can work on it.
export async function POST(request: Request) {
  if (!browserStorage) return Response.json({ userMessage: '当前服务器不使用浏览器存储。' }, { status: 404 });
  return withWorkspaceToken(request, async token => {
    // base64 inflates the bundle by a third; refuse oversized bodies before reading them.
    if (Number(request.headers.get('content-length') ?? 0) > bundleLimitBytes() * 1.4 + 65536)
      return Response.json({ userMessage: `站点包超过 ${Math.round(bundleLimitBytes() / 2 ** 20)}MB 上限。` }, { status: 413 });
    try {
      const result = await importBundle(token!, await request.json().catch(() => null));
      return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (!(error instanceof BundleError)) throw error;
      return Response.json({ userMessage: error.message }, { status: error.status });
    }
  });
}
