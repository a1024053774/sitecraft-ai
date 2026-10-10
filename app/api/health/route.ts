import { getAIProviderStatus } from "@/lib/ai-provider";
import { checkDatabaseConnection } from "@/lib/postgres";
import { codeContentThinkingMode } from "@/lib/code-site-model";

export const runtime = "nodejs";

export async function GET() {
  const ai = getAIProviderStatus();
  const store = {driver:"development-file",shared:process.env.SITE_STORE === "postgres" || process.env.NODE_ENV === "production"};
  let database = store.shared ? "checking" : "development-file";

  if (store.shared) {
    try {
      await checkDatabaseConnection();
      database = "ready";
    } catch {
      database = "unavailable";
    }
  }

  const ready = ai.configured && (!store.shared || database === "ready");
  const developmentIdentity = process.env.NODE_ENV === "production"
    ? {}
    : { testIdentity: { cwd: process.cwd() } };
  return Response.json(
    {
      status: ready ? "ready" : "not_ready",
      deepseek: { configured: ai.configured, model: ai.model, codeContentThinking: {
        write: codeContentThinkingMode('write'), facts: codeContentThinkingMode('facts'), repair: codeContentThinkingMode('repair'),
      } },
      persistence: { driver: store.driver, database },
      ...developmentIdentity,
    },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
