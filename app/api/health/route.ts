import { getAIProviderStatus } from "@/lib/ai-provider";
import { checkDatabaseConnection } from "@/lib/postgres";
import { codeContentThinkingMode } from "@/lib/code-site-model";
import path from "node:path";

export const runtime = "nodejs";

export async function GET() {
  const ai = getAIProviderStatus();
  const shared = process.env.SITE_STORE === 'postgres' || (process.env.NODE_ENV === 'production' && process.env.SITE_STORE !== 'browser');
  const store = { driver: shared ? 'postgres' : process.env.SITE_STORE === 'browser' ? 'browser-file' : 'development-file', shared };
  let database = store.shared ? "checking" : "development-file";

  if (store.shared) {
    try {
      await checkDatabaseConnection();
      database = "ready";
    } catch {
      database = "unavailable";
    }
  }

  // Production credentials belong to each visitor. Model actions check their
  // own key; a global model key is not a server dependency (T-202).
  const ready = !store.shared || database === "ready";
  // T-167: this runtime identity path is not a deployment dependency. Keep the
  // NFT opt-out until an unannotated build passes with the main artifact tree.
  const developmentIdentity = process.env.NODE_ENV === "production"
    ? {}
    : { testIdentity: { cwd: process.cwd(), dataRoot: path.resolve(/* turbopackIgnore: true */ process.env.SITECRAFT_DATA_ROOT || '.sitecraft-data') } };
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
