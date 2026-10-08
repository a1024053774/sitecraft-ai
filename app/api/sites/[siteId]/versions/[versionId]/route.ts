import { z } from 'zod';
import { nameCodeVersion } from '@/lib/code-site-store';
import { getExistingSite } from '@/lib/site-store';
import { codeWorkspaceState } from '@/lib/code-site-workflow';

export const runtime = 'nodejs';
export async function PATCH(request: Request, { params }: { params: Promise<{ siteId: string; versionId: string }> }) {
  const { siteId, versionId } = await params;
  if (!await getExistingSite(siteId)) return Response.json({ userMessage: '找不到这个站点。' }, { status: 404 });
  const parsed = z.object({ name: z.string().trim().max(80) }).strict().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ userMessage: '版本名称最多 80 字。' }, { status: 400 });
  const site = await nameCodeVersion(siteId, versionId, parsed.data.name);
  if (!site) return Response.json({ userMessage: '找不到这个版本。' }, { status: 404 });
  return Response.json(await codeWorkspaceState(site));
}
