import { browserStorage, exportBundle, withSiteWorkspace } from '@/lib/workspace-session';

export const runtime = 'nodejs';
// T-202: the browser pulls the server copy back into IndexedDB after changes.
export async function GET(request: Request, context: { params: Promise<{ siteId: string }> }) {
  if (!browserStorage) return Response.json({ userMessage: '当前服务器不使用浏览器存储。' }, { status: 404 });
  const { siteId } = await context.params;
  return withSiteWorkspace(request, siteId, async () => Response.json(await exportBundle(siteId), { headers: { 'Cache-Control': 'no-store' } }));
}
