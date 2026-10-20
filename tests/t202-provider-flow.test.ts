import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readdir, readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

// T-202 key flow through the real chat route and workflow. The model is a local
// HTTP stand-in; the visitor's credentials come only from request headers.
const callbacks: Array<() => Promise<void>> = [];
(globalThis as any).__t202After = callbacks;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'next/server.js') return { shortCircuit: true, url: 'data:text/javascript,export function after(fn){globalThis.__t202After.push(fn)}' };
  if (!specifier.startsWith('@/')) return next(specifier, context);
  return next(pathToFileURL(`${path.join(process.cwd(), specifier.slice(2))}.ts`).href, context);
} });
assert.ok(process.env.SITECRAFT_DATA_ROOT, '需要显式独立测试数据根');
process.env.SITE_STORE = 'fs';

const visitorKey = `sk-visitor-${crypto.randomUUID()}`;
const operatorKey = `sk-operator-${crypto.randomUUID()}`;
const seen: Array<{ url: string; authorization?: string; model?: string }> = [];
let redirects = 0;
const standIn = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  if (req.url === '/redirect/chat/completions') { redirects++; res.writeHead(302, { location: '/landing' }); res.end(); return; }
  if (req.url === '/landing') { seen.push({ url: req.url }); res.end('{}'); return; }
  seen.push({ url: req.url!, authorization: req.headers.authorization, model: JSON.parse(raw).model });
  // Echo the key in an error body: the stored run must still not contain it (T-174 redaction).
  res.writeHead(400, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: { message: `invalid request for key ${req.headers.authorization}` } }));
});
await new Promise<void>(resolve => standIn.listen(0, '127.0.0.1', resolve));
const address = standIn.address(); assert.ok(address && typeof address === 'object');
const standInBase = `http://127.0.0.1:${address.port}`;
// The operator's environment points elsewhere; it must never be used for a visitor.
process.env.DEEPSEEK_BASE_URL = 'http://127.0.0.1:9'; process.env.DEEPSEEK_API_KEY = operatorKey; process.env.DEEPSEEK_MODEL = 'operator-model';
test.after(() => standIn.close());

const logged: string[] = [];
for (const level of ['log', 'warn', 'error'] as const) {
  const original = console[level].bind(console);
  console[level] = (...args: unknown[]) => { logged.push(args.map(String).join(' ')); original(...args); };
}

const { createCodeSite, getCodeSite } = await import('../lib/code-site-store.ts');
const { getOrCreateConversation, getConversation } = await import('../lib/conversation-store.ts');
const chat = await import('../app/api/sites/[siteId]/chat/route.ts');
const { providerFromRequest, isPublicAddress, guardedFetch, ProviderSettingsError } = await import('../lib/provider-context.ts');

const headers = (base = standInBase, key = visitorKey, model = 'visitor-model') => ({ 'content-type': 'application/json', 'x-sitecraft-provider-base': base, 'x-sitecraft-provider-key': key, 'x-sitecraft-provider-model': model });
async function post(siteId: string, body: unknown, extra: Record<string, string> = { 'content-type': 'application/json' }) {
  const response = await chat.POST(new Request(`http://local/api/sites/${siteId}/chat`, { method: 'POST', headers: extra, body: JSON.stringify(body) }), { params: Promise.resolve({ siteId }) });
  return { status: response.status, body: await response.json() };
}
async function siteAtStyleQuestion() {
  const siteId = crypto.randomUUID(), conversation = await getOrCreateConversation(siteId, `conversation-${siteId}`);
  await createCodeSite(siteId, 'T-202 站点', conversation.conversationId);
  const started = await post(siteId, { message: '公司名：青禾纸包装\n做折叠彩盒和瓦楞运输盒。' });
  assert.equal(started.status, 200, JSON.stringify(started.body));
  const question = (await getConversation(siteId, conversation.conversationId))!.alignment.currentQuestion!;
  assert.equal(question.kind, 'style');
  return { siteId, conversationId: conversation.conversationId, select: { action: 'select', questionId: question.questionId, questionRevision: question.questionRevision, optionId: question.options.find(option => option.id !== 'auto')!.id } };
}
async function settle() { for (const callback of callbacks.splice(0)) await callback(); }
async function filesUnder(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  // The full run shares this root with other test files: read regular files only (no links).
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? filesUnder(path.join(dir, entry.name)) : entry.isFile() ? [path.join(dir, entry.name)] : []))).flat();
}

test('production ignores the operator key: a model request without visitor headers is refused before any state changes', async () => {
  const { siteId, conversationId, select } = await siteAtStyleQuestion();
  const previous = process.env.NODE_ENV;
  (process.env as Record<string, string>).NODE_ENV = 'production';
  try {
    const refused = await post(siteId, select);
    assert.equal(refused.status, 400);
    assert.match(refused.body.userMessage, /先在「设置」里填写/);
  } finally { (process.env as Record<string, string | undefined>).NODE_ENV = previous; }
  assert.equal((await getCodeSite(siteId))!.run, null, 'no run is recorded');
  assert.equal((await getConversation(siteId, conversationId))!.alignment.currentQuestion?.questionId, select.questionId, 'the style question stays answerable');
  assert.equal(callbacks.length, 0);
  assert.ok(!seen.some(item => item.authorization?.includes(operatorKey)), 'the operator key never reaches a provider');
});

test('visitor headers drive the background task, and the key is not stored or logged', async () => {
  process.env.SITECRAFT_ALLOW_LOCAL_PROVIDER = '1';
  try {
  const { siteId, select } = await siteAtStyleQuestion();
  const before = seen.length;
  const accepted = await post(siteId, select, headers());
  assert.equal(accepted.status, 202, JSON.stringify(accepted.body));
  assert.equal((await getCodeSite(siteId))!.run?.status, 'running');
  // The task runs after the response, outside the request: it must keep the visitor's credentials.
  await settle();
  const calls = seen.slice(before);
  assert.ok(calls.length >= 1, 'the background plan task called the model');
  for (const call of calls) {
    assert.equal(call.authorization, `Bearer ${visitorKey}`);
    assert.equal(call.model, 'visitor-model');
  }
  const run = (await getCodeSite(siteId))!.run!;
  assert.equal(run.status, 'error');
  assert.ok(JSON.stringify(run).length > 0 && !JSON.stringify(run).includes(visitorKey));
  for (const file of await filesUnder(process.env.SITECRAFT_DATA_ROOT!)) {
    // Other test files may remove their own files while this scan runs.
    const text = await readFile(file, 'latin1').catch(error => { if (error.code === 'ENOENT') return ''; throw error; });
    assert.ok(!text.includes(visitorKey), `key found in ${file}`);
  }
  assert.ok(!logged.some(line => line.includes(visitorKey)), 'key found in server output');
  } finally { delete process.env.SITECRAFT_ALLOW_LOCAL_PROVIDER; }
});

test('invalid visitor headers are rejected with 400 and nothing changes', async () => {
  const { siteId, select } = await siteAtStyleQuestion();
  for (const bad of [
    { ...headers(), 'x-sitecraft-provider-model': '' },
    headers('http://api.example.com'),
    headers('https://user:pass@api.example.com'),
    headers('https://api.example.com/v1?key=1'),
    headers(standInBase), // local http is only allowed with the explicit acceptance switch
    headers('https://api.deepseek.com', 'sk bad key'),
  ]) {
    const refused = await post(siteId, select, bad);
    assert.equal(refused.status, 400, JSON.stringify(bad));
  }
  assert.equal((await getCodeSite(siteId))!.run, null);
});

test('provider headers: complete values are accepted as given', () => {
  const parsed = providerFromRequest(new Request('http://local', { headers: headers('https://api.deepseek.com/', visitorKey, 'deepseek-flash') }));
  assert.deepEqual(parsed, { baseURL: 'https://api.deepseek.com', apiKey: visitorKey, model: 'deepseek-flash' });
  assert.equal(providerFromRequest(new Request('http://local')), null);
});

test('only public unicast addresses are allowed', () => {
  for (const address of ['10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '127.0.0.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '198.18.0.1',
    '::1', '::', 'fc00::1', 'fd12::1', 'fe80::1', 'ff02::1', '::ffff:10.0.0.1', '::ffff:127.0.0.1', 'not-an-ip'])
    assert.equal(isPublicAddress(address), false, address);
  for (const address of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '100.128.0.1', '2606:4700::1111', '::ffff:8.8.8.8'])
    assert.equal(isPublicAddress(address), true, address);
});

test('guarded fetch refuses private targets before connecting and never follows redirects', async () => {
  await assert.rejects(guardedFetch('https://127.0.0.1/chat/completions', { method: 'POST', body: '{}' }), ProviderSettingsError);
  await assert.rejects(guardedFetch('https://10.0.0.8/chat/completions', { method: 'POST', body: '{}' }), ProviderSettingsError);
  // A hostname is checked on the address it actually resolves to and connects with.
  await assert.rejects(guardedFetch('https://localhost:9/chat/completions', { method: 'POST', body: '{}' }), (error: any) => error?.code === 'EPROVIDERADDR');
  await assert.rejects(guardedFetch(`${standInBase}/chat/completions`, { method: 'POST', body: '{}' }), ProviderSettingsError, 'local http needs the acceptance switch');
  process.env.SITECRAFT_ALLOW_LOCAL_PROVIDER = '1';
  try {
    const landingBefore = seen.filter(item => item.url === '/landing').length;
    await assert.rejects(guardedFetch(`${standInBase}/redirect/chat/completions`, { method: 'POST', body: '{}' }), /重定向/);
    assert.equal(redirects, 1);
    assert.equal(seen.filter(item => item.url === '/landing').length, landingBefore, 'the redirect target is never requested');
  } finally { delete process.env.SITECRAFT_ALLOW_LOCAL_PROVIDER; }
});
