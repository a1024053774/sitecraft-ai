import { imageFactsSystemPrompt, imageFactsUserPrompt, parseImageFacts, type ImageFacts } from './image-facts.ts';
import { imageDataUrl, inspectSiteImage, SiteImageError, type ImageMime } from './site-images.ts';

export type ImageFactsResult =
  | {
    ok: true;
    facts: ImageFacts;
    model: string;
    latencyMs: number;
    image: { mime: ImageMime; width: number; height: number; byteLength: number };
  }
  | {
    ok: false;
    error: string;
    code: "not_configured" | "invalid_image" | "provider_error" | "invalid_output" | "timeout" | "truncated";
    model: string | null;
    latencyMs: number;
  };

export function providerConfig() {
  return {
    baseURL: (process.env.DEEPSEEK_BASE_URL || process.env.AI_BASE_URL || "https://api.deepseek.com").replace(/\/$/, ""),
    apiKey: process.env.DEEPSEEK_API_KEY || process.env.AI_API_KEY,
    model: process.env.DEEPSEEK_MODEL || process.env.AI_MODEL,
  };
}

export function getAIProviderStatus() {
  const config = providerConfig();
  const configured = Boolean(config.apiKey && config.model);
  return {
    configured,
    mode: configured ? "deepseek" as const : "unconfigured" as const,
    provider: "DeepSeek" as const,
    model: config.model ?? null,
    baseURL: configured ? config.baseURL : null,
  };
}

async function providerError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: { message?: unknown } } | null;
  const message = payload?.error?.message;
  return typeof message === "string" && message.trim()
    ? `DeepSeek 返回 HTTP ${response.status}：${message.slice(0, 300)}`
    : `DeepSeek 返回 HTTP ${response.status}`;
}

// Every DeepSeek call makes at most this many attempts.
const MODEL_ATTEMPTS = 2;

// T-058: one server log line per failed DeepSeek attempt, so failures can be told apart (they all
// reach the user as a few safe codes). The line carries the call, the attempt, the category, the
// HTTP status, the attempt's duration, the upstream trace id and, when an answer came back, its
// finish reason and token usage. Never the API key, the materials, the prompt, the model's text or
// the upstream error message (which can echo the request).
type ModelCall = "image_facts";
type FailureCategory = "timeout" | "http" | "network" | "parse" | "schema" | "truncated";
type FailureStage = "request" | "body" | "answer";
type ModelUsage = { prompt_tokens?: unknown; completion_tokens?: unknown; completion_tokens_details?: { reasoning_tokens?: unknown } | null };
type ModelPayload = { usage?: ModelUsage | null };

function logModelFailure(entry: {
  call: ModelCall;
  attempt: number;
  category: FailureCategory;
  startedAt: number;
  response?: Response | null;
  payload?: { choices?: Array<{ finish_reason?: string }>; usage?: ModelUsage | null } | null;
  error?: unknown;
  fields?: string[];
}) {
  const word = (value: unknown, pattern: RegExp) => (typeof value === "string" && pattern.test(value) ? value : null);
  const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  const trace = entry.response?.headers.get("x-ds-trace-id") ?? entry.response?.headers.get("x-request-id") ?? null;
  const finish = word(entry.payload?.choices?.[0]?.finish_reason, /^[a-z_]{1,40}$/);
  const usage = entry.payload?.usage;
  const cause = entry.category === "network" && entry.error instanceof Error
    ? word((entry.error.cause as { code?: unknown } | undefined)?.code, /^[A-Z0-9_]{1,40}$/)
    : null;
  const line = {
    call: entry.call,
    attempt: entry.attempt + 1,
    of: MODEL_ATTEMPTS,
    category: entry.category,
    status: entry.response ? entry.response.status : null,
    ms: Date.now() - entry.startedAt,
    traceId: word(trace, /^[\w.:-]{1,120}$/),
    ...(finish ? { finish } : {}),
    ...(usage ? { tokens: { prompt: count(usage.prompt_tokens), completion: count(usage.completion_tokens), reasoning: count(usage.completion_tokens_details?.reasoning_tokens) } } : {}),
    ...(cause ? { cause } : {}),
    ...(entry.fields?.length ? { fields: entry.fields.filter((field) => /^[A-Za-z0-9_.?]{1,200}:[a-z_]{1,40}$/.test(field)) } : {}),
  };
  console.warn(`[sitecraft] DeepSeek call failed ${JSON.stringify(line)}`);
}

export async function requestImageFacts(args: {
  imageBytes: Uint8Array;
  originalName?: string | null;
}): Promise<ImageFactsResult> {
  const startedAt = Date.now();
  const { baseURL, apiKey, model } = providerConfig();
  let image: { mime: ImageMime; width: number; height: number; byteLength: number };
  try {
    image = inspectSiteImage(args.imageBytes, "analyze");
  } catch (error) {
    const message = error instanceof SiteImageError ? error.message : "产品图无效";
    return { ok: false, code: "invalid_image", error: message, model: model ?? null, latencyMs: 0 };
  }
  if (!apiKey || !model) {
    return { ok: false, code: "not_configured", error: "尚未配置 DeepSeek API，系统不会伪造看图结果。", model: null, latencyMs: 0 };
  }
  const imageUrl = imageDataUrl(args.imageBytes, "analyze");
  let lastError = "模型没有返回有效的图片事实。";
  let retryFeedback = "";
  let truncated = false;

  for (let attempt = 0; attempt < MODEL_ATTEMPTS; attempt += 1) {
    const attemptStartedAt = Date.now();
    let response: Response | null = null;
    let stage: FailureStage = "request";
    try {
      response = await fetch(`${baseURL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 800,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: imageFactsSystemPrompt() },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `${imageFactsUserPrompt(args.originalName ?? null)}${attempt ? `\n\n上一次输出未通过 Schema：${retryFeedback}。请只修正格式，没有看见的事实继续写待补充，不要输出 operations。` : ""}`,
                },
                { type: "image_url", image_url: { url: imageUrl } },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(45_000),
        cache: "no-store",
      });
      if (!response.ok) {
        logModelFailure({ call: "image_facts", attempt, category: "http", startedAt: attemptStartedAt, response });
        lastError = await providerError(response);
        if (response.status < 500 && response.status !== 429) break;
        continue;
      }
      stage = "body";
      const payload = (await response.json()) as ModelPayload & {
        model?: unknown;
        choices?: Array<{ finish_reason?: string; message?: { content?: unknown } }>;
      };
      stage = "answer";
      if (payload.choices?.[0]?.finish_reason === "length") {
        logModelFailure({ call: "image_facts", attempt, category: "truncated", startedAt: attemptStartedAt, response, payload });
        // Not retried, as for the other calls: the same budget would most likely be spent the same way (T-061).
        lastError = "DeepSeek 看图输出达到 token 上限，被截断";
        truncated = true;
        break;
      }
      const parsed = parseImageFacts(payload.choices?.[0]?.message?.content);
      if (!parsed.data) {
        // An answer that is not JSON at all (parse), or JSON of the wrong shape (schema, with the fields).
        logModelFailure({ call: "image_facts", attempt, category: parsed.fields ? "schema" : "parse", fields: parsed.fields, startedAt: attemptStartedAt, response, payload });
        retryFeedback = parsed.error.slice(0, 1200);
        lastError = `模型输出未通过图片事实 Schema 校验：${retryFeedback}`;
        continue;
      }
      const responseModel = typeof payload.model === "string" && payload.model.trim() ? payload.model : model;
      return { ok: true, facts: parsed.data, model: responseModel, latencyMs: Date.now() - startedAt, image };
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      logModelFailure({ call: "image_facts", attempt, category: timedOut ? "timeout" : stage === "request" ? "network" : stage === "body" ? "parse" : "schema", startedAt: attemptStartedAt, response, error });
      lastError = timedOut ? "DeepSeek 请求超时" : `无法连接 DeepSeek：${error instanceof Error ? error.message : "网络错误"}`;
      if (timedOut) break;
    }
  }
  return {
    ok: false,
    code: truncated ? "truncated" : lastError.includes("超时") ? "timeout" : lastError.includes("Schema") ? "invalid_output" : "provider_error",
    error: lastError,
    model,
    latencyMs: Date.now() - startedAt,
  };
}
