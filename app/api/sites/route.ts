import { browserStorage, registerSite, sitesOfToken, withWorkspaceToken } from '@/lib/workspace-session';
import { z } from 'zod';
import { createCodeSite, listCodeSites } from '@/lib/code-site-store';
import { createConversation } from '@/lib/conversation-store';
import { codeWorkspaceState } from '@/lib/code-site-workflow';
import { userErrorPayload } from '@/lib/user-errors';

const createSiteSchema = z.object({ name: z.string().trim().min(1).max(100) }).strict();
export async function POST(request: Request) {
  return withWorkspaceToken(request, token => createSite(request, token));
}
async function createSite(request: Request, token: string | null) {
  const parsed = createSiteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json(userErrorPayload({ code: 'invalid_payload' }), { status: 400 });
  const id = crypto.randomUUID();
  const conversation = await createConversation(id);
  const site = await createCodeSite(id, parsed.data.name, conversation.conversationId);
  registerSite(id, token);
  return Response.json({ id, ...await codeWorkspaceState(site) }, { status: 201 });
}
export async function GET(request: Request = new Request('http://localhost/api/sites')) {
  // Browser storage lists only this workspace's server copies; the browser keeps the full list.
  return withWorkspaceToken(request, async token => {
    const sites = await listCodeSites(), own = sitesOfToken(token);
    return Response.json({ sites: browserStorage ? sites.filter(site => own.has(site.siteId)) : sites }, { headers: { 'Cache-Control': 'no-store' } });
  });
}
