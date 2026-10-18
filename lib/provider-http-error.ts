export type ProviderResponseBody = { body: string; bodyRedacted?: never; bodyLength?: never } | { body?: never; bodyRedacted: true; bodyLength: number };
export type ProviderHttpError = {
  status: number;
  requestId: string | null;
  requestIdHeader: 'x-ds-trace-id' | 'x-request-id' | null;
} & ProviderResponseBody;

// HTTP 错误与事实回复共用整段正文的凭据检查。
export function safeProviderResponseBody(body: string, apiKey: string): ProviderResponseBody {
  let decoded = body, containsCredential = false;
  const escapes: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
  // 检查整个文本，不解析属性；截断、重复属性和属性名都不能漏掉。
  // 每轮转义解码都缩短文本，同时检查各层，避免嵌套转义藏住凭据。
  while (apiKey) {
    if (decoded.includes(apiKey)) { containsCredential = true; break; }
    const next = decoded.replace(/\\(?:u([0-9a-fA-F]{4})|(["\\/bfnrt]))/g,
      (_, hex: string | undefined, escaped: string) => hex ? String.fromCharCode(Number.parseInt(hex, 16)) : escapes[escaped]);
    if (next === decoded) break;
    decoded = next;
  }
  return containsCredential ? { bodyRedacted: true, bodyLength: body.length } : { body };
}

export async function readProviderHttpError(response: Response, apiKey: string): Promise<ProviderHttpError> {
  const redact = (text: string) => apiKey ? text.split(apiKey).join('[REDACTED]') : text;
  const body = safeProviderResponseBody(await response.text(), apiKey);
  // 网关正文已舍弃时，只传递原始字符数；应用仍独立检查自己持有的占位 token。
  const redactedLength = response.headers.get('x-sitecraft-redacted-body-length');
  const inheritedLength = redactedLength !== null && /^\d+$/.test(redactedLength) && Number.isSafeInteger(Number(redactedLength)) ? Number(redactedLength) : null;
  const requestIdHeader = (['x-ds-trace-id', 'x-request-id'] as const).find(name => response.headers.get(name)) ?? null;
  return { status: response.status,
    ...(inheritedLength !== null ? { bodyRedacted: true as const, bodyLength: inheritedLength } : body), requestIdHeader,
    requestId: requestIdHeader ? redact(response.headers.get(requestIdHeader)!) : null };
}
