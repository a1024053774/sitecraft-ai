import { z } from 'zod';
import { createCodeSite, listCodeSites } from '@/lib/code-site-store';
import { createConversation } from '@/lib/conversation-store';
import { codeWorkspaceState } from '@/lib/code-site-workflow';
import { userErrorPayload } from '@/lib/user-errors';

const createSiteSchema = z.object({ name: z.string().trim().min(1).max(100) }).strict();
export async function POST(request: Request) {
  const parsed = createSiteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json(userErrorPayload({ code: 'invalid_payload' }), { status: 400 });
  const id = crypto.randomUUID();
  const conversation = await createConversation(id);
  const site = await createCodeSite(id, parsed.data.name, conversation.conversationId);
  return Response.json({ id, ...await codeWorkspaceState(site) }, { status: 201 });
}
export async function GET() {
  return Response.json({ sites: await listCodeSites() }, { headers: { 'Cache-Control': 'no-store' } });
}
