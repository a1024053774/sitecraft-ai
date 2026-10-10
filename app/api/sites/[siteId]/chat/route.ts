import { getCodeSite, CodeSiteUnavailableError } from '@/lib/code-site-store';
import { handleCodeChat } from '@/lib/code-site-workflow';
import { userErrorPayload } from '@/lib/user-errors';
export const runtime = 'nodejs';
export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  try {
    if (!await getCodeSite(siteId)) return Response.json(userErrorPayload({ code: 'site_not_found' }), { status: 404 });
    return handleCodeChat(siteId, await request.json().catch(() => null));
  } catch (error) {
    if (!(error instanceof CodeSiteUnavailableError)) throw error;
    return Response.json({ userMessage: error.message }, { status: 422 });
  }
}
