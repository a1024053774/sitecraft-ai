import { AsyncLocalStorage } from 'node:async_hooks';
import { lookup as dnsLookup } from 'node:dns';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { isIP, type LookupFunction } from 'node:net';

// T-202: the visitor's own model interface. The key arrives in a request header,
// lives in this request's async context (and in the closure of a task the
// request scheduled), and is never written to a record, a log or a package.
export type ProviderCredentials = { baseURL: string; apiKey: string; model: string };
export type ProviderConfig = { baseURL: string; apiKey: string | undefined; model: string | undefined; fetch: typeof fetch };

export class ProviderSettingsError extends Error {
  constructor(message: string) { super(message); this.name = 'ProviderSettingsError'; }
}

const context = new AsyncLocalStorage<ProviderCredentials | null>();
export const providerNotConfiguredMessage = '还没有填写模型接口，请先在「设置」里填写 API 地址、key 和模型名。';

// Production serves visitors only: their own key, never the operator's.
function serverCredentialsAllowed() { return process.env.NODE_ENV !== 'production'; }
// Local acceptance of a production build talks to a local stand-in; never set on a public server.
function localProviderAllowed() { return process.env.SITECRAFT_ALLOW_LOCAL_PROVIDER === '1'; }

export function runWithProvider<T>(credentials: ProviderCredentials | null, task: () => T): T {
  return context.run(credentials, task);
}
export function currentProviderCredentials() { return context.getStore() ?? null; }

export function providerConfig(): ProviderConfig {
  const visitor = context.getStore();
  if (visitor) return { ...visitor, fetch: guardedFetch };
  if (!serverCredentialsAllowed()) return { baseURL: '', apiKey: undefined, model: undefined, fetch: guardedFetch };
  return {
    baseURL: (process.env.DEEPSEEK_BASE_URL || process.env.AI_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, ''),
    apiKey: process.env.DEEPSEEK_API_KEY || process.env.AI_API_KEY,
    model: process.env.DEEPSEEK_MODEL || process.env.AI_MODEL,
    fetch,
  };
}
export function providerConfigured() { const { apiKey, model } = providerConfig(); return Boolean(apiKey && model); }

const headerNames = { baseURL: 'x-sitecraft-provider-base', apiKey: 'x-sitecraft-provider-key', model: 'x-sitecraft-provider-model' } as const;

// Returns null when the request carries no provider headers; throws when they are incomplete or invalid.
export function providerFromRequest(request: Request): ProviderCredentials | null {
  const raw = Object.fromEntries(Object.entries(headerNames).map(([field, name]) => [field, request.headers.get(name)?.trim() ?? ''])) as Record<keyof ProviderCredentials, string>;
  if (!raw.baseURL && !raw.apiKey && !raw.model) return null;
  if (!raw.baseURL || !raw.apiKey || !raw.model) throw new ProviderSettingsError('模型接口设置不完整：API 地址、key 和模型名都要填写。');
  if (raw.apiKey.length > 512 || /[\s\u0000-\u001f\u007f]/.test(raw.apiKey)) throw new ProviderSettingsError('API key 格式无效。');
  if (!/^[A-Za-z0-9._:/@-]{1,120}$/.test(raw.model)) throw new ProviderSettingsError('模型名格式无效。');
  let url: URL;
  try { url = new URL(raw.baseURL); } catch { throw new ProviderSettingsError('API 地址不是有效的网址。'); }
  const local = localProviderAllowed() && url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
  if (url.protocol !== 'https:' && !local) throw new ProviderSettingsError('API 地址必须以 https:// 开头。');
  if (url.username || url.password || url.search || url.hash) throw new ProviderSettingsError('API 地址不能包含账号、查询参数或锚点。');
  return { baseURL: url.toString().replace(/\/$/, ''), apiKey: raw.apiKey, model: raw.model };
}

// Wraps a route handler: invalid provider headers become a 400, valid ones are
// bound to the request context. Without headers the handler runs unbound.
export async function withRequestProvider(request: Request, handler: () => Promise<Response>) {
  let credentials: ProviderCredentials | null;
  try { credentials = providerFromRequest(request); }
  catch (error) {
    if (!(error instanceof ProviderSettingsError)) throw error;
    return Response.json({ userMessage: error.message }, { status: 400 });
  }
  return runWithProvider(credentials, handler);
}

// Only public unicast addresses. Covers loopback, private, link-local (incl.
// cloud metadata 169.254.169.254), CGNAT, multicast, reserved and IPv6 ULA.
export function isPublicAddress(address: string) {
  const family = isIP(address);
  if (family === 4) {
    const [a, b] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)));
  }
  if (family === 6) {
    const lower = address.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPublicAddress(mapped[1]);
    return !(lower === '::' || lower === '::1' || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower) || lower.startsWith('ff') || lower.startsWith('64:ff9b:') || lower.startsWith('2001:db8'));
  }
  return false;
}

// The socket connects to exactly the address this lookup returns, so the
// address that was checked is the address that is used (no DNS rebinding).
const publicLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, '', 0);
    const list = addresses as unknown as { address: string; family: number }[];
    const blocked = list.find(item => !isPublicAddress(item.address));
    if (!list.length || blocked) return callback(Object.assign(new Error('API 地址解析到内网或保留地址，已拒绝连接。'), { code: 'EPROVIDERADDR' }), '', 0);
    if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: typeof list) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

// fetch subset used by the model clients: POST with a string body, no redirects.
export const guardedFetch = ((input: string | URL, init: RequestInit = {}) => new Promise<Response>((resolve, reject) => {
  const url = new URL(String(input));
  const local = localProviderAllowed() && url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
  if (url.protocol !== 'https:' && !local) return reject(new ProviderSettingsError('API 地址必须以 https:// 开头。'));
  if (!local && isIP(url.hostname) && !isPublicAddress(url.hostname)) return reject(new ProviderSettingsError('API 地址指向内网或保留地址，已拒绝连接。'));
  const headers = Object.fromEntries(new Headers(init.headers).entries());
  const send = local ? httpRequest : httpsRequest;
  const req = send(url, { method: init.method ?? 'GET', headers, ...(local ? {} : { lookup: publicLookup }), signal: init.signal ?? undefined }, response => {
    const chunks: Buffer[] = [];
    response.on('data', chunk => chunks.push(chunk));
    response.on('error', reject);
    response.on('end', () => {
      const status = response.statusCode ?? 502;
      if (status >= 300 && status < 400) return reject(new ProviderSettingsError(`API 地址返回了重定向（HTTP ${status}），出于安全不跟随，请填写最终地址。`));
      const responseHeaders = new Headers();
      for (const [name, value] of Object.entries(response.headers)) if (value !== undefined) responseHeaders.set(name, Array.isArray(value) ? value.join(', ') : value);
      resolve(new Response(status === 204 || status === 304 ? null : Buffer.concat(chunks), { status, statusText: response.statusMessage, headers: responseHeaders }));
    });
  });
  req.on('error', reject);
  if (init.body !== undefined && init.body !== null) req.write(typeof init.body === 'string' ? init.body : String(init.body));
  req.end();
})) as typeof fetch;
