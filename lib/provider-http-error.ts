export type ProviderHttpError = {
  status: number;
  body: string;
  requestId: string | null;
  requestIdHeader: 'x-ds-trace-id' | 'x-request-id' | null;
};

// 两个响应消费者共用同一脱敏边界；只保留已有调用追踪采用的编号头。
export async function readProviderHttpError(response: Response, apiKey: string): Promise<ProviderHttpError> {
  const redact = (text: string) => apiKey ? text.split(apiKey).join('[REDACTED]') : text;
  let body = redact(await response.text());
  try {
    const parsed: unknown = JSON.parse(body);
    let changedJSON = false;
    const sanitized = JSON.stringify(parsed, (key, value) => {
      if (/^(?:authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password)$/i.test(key)) {
        changedJSON = true; return undefined;
      }
      if (typeof value === 'string') {
        const safe = redact(value);
        if (safe !== value) changedJSON = true;
        return safe;
      }
      return value;
    });
    // 不含敏感字段时保留正文原文，包括空白；仅脱敏时重序列化 JSON。
    if (changedJSON) body = sanitized;
  } catch (error) { if (!(error instanceof SyntaxError)) throw error; }
  const requestIdHeader = (['x-ds-trace-id', 'x-request-id'] as const).find(name => response.headers.get(name)) ?? null;
  return { status: response.status, body, requestIdHeader,
    requestId: requestIdHeader ? redact(response.headers.get(requestIdHeader)!) : null };
}
