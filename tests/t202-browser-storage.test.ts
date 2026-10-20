import assert from 'node:assert/strict';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

// T-202 browser storage through the real route handlers. The server copy lives in
// a subdirectory of this run's data root, which browser mode empties at start.
const callbacks: Array<() => Promise<void>> = [];
(globalThis as any).__t202bAfter = callbacks;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'next/server.js') return { shortCircuit: true, url: 'data:text/javascript,export function after(fn){globalThis.__t202bAfter.push(fn)}' };
  if (!specifier.startsWith('@/')) return next(specifier, context);
  return next(pathToFileURL(`${path.join(process.cwd(), specifier.slice(2))}.ts`).href, context);
} });
assert.ok(process.env.SITECRAFT_DATA_ROOT, '需要显式独立测试数据根');
const root = path.join(process.env.SITECRAFT_DATA_ROOT, `t202-browser-${crypto.randomUUID()}`);
await mkdir(root, { recursive: true });
process.env.SITECRAFT_DATA_ROOT = root;
process.env.SITE_STORE = 'browser';
process.env.SITECRAFT_QUEUE_WAITING = '1';
process.env.DEEPSEEK_API_KEY = 'local-only'; process.env.DEEPSEEK_MODEL = 'local-only'; process.env.DEEPSEEK_BASE_URL = 'http://127.0.0.1:9';

const sites = await import('../app/api/sites/route.ts');
const siteRoute = await import('../app/api/sites/[siteId]/route.ts');
const chat = await import('../app/api/sites/[siteId]/chat/route.ts');
const draft = await import('../app/api/sites/[siteId]/draft/route.ts');
const preview = await import('../app/api/sites/[siteId]/code-preview/route.ts');
const bundleRoute = await import('../app/api/sites/[siteId]/bundle/route.ts');
const hydrate = await import('../app/api/workspace/hydrate/route.ts');
const published = await import('../app/published/[siteKey]/route.ts');
const session = await import('../lib/workspace-session.ts');
const queue = await import('../lib/work-queue.ts');
const { getConversation } = await import('../lib/conversation-store.ts');
const { getCodeSite } = await import('../lib/code-site-store.ts');

const base = 'http://local';
const jar = (cookie: string | null) => (cookie ? { cookie } : {}) as Record<string, string>;
async function createSite(cookie: string | null = null) {
  const response = await sites.POST(new Request(`${base}/api/sites`, { method: 'POST', headers: { 'content-type': 'application/json', ...jar(cookie) }, body: JSON.stringify({ name: '浏览器存储站' }) }));
  assert.equal(response.status, 201);
  const set = response.headers.get('set-cookie');
  return { id: (await response.json()).id as string, cookie: cookie ?? set!.split(';')[0], setCookie: set };
}
const params = (siteId: string) => ({ params: Promise.resolve({ siteId }) });
const get = (route: any, siteId: string, cookie: string | null, url = '') => route.GET(new Request(`${base}/api/sites/${siteId}${url}`, { headers: jar(cookie) }), params(siteId));
async function hydrateBundle(bundle: unknown, cookie: string | null) {
  const response = await hydrate.POST(new Request(`${base}/api/workspace/hydrate`, { method: 'POST', headers: { 'content-type': 'application/json', ...jar(cookie) }, body: JSON.stringify(bundle) }));
  return { status: response.status, body: await response.json(), setCookie: response.headers.get('set-cookie') };
}
async function chatPost(siteId: string, cookie: string, body: unknown) {
  const response = await chat.POST(new Request(`${base}/api/sites/${siteId}/chat`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body) }), params(siteId));
  return { status: response.status, body: await response.json() };
}
async function files(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)]))).flat();
}
const siteFilesOnDisk = async (siteId: string) => (await files(root)).filter(file => file.includes(siteId));

test('a new workspace gets an HttpOnly SameSite=Strict token cookie, and sites stay inside their workspace', async () => {
  const a = await createSite();
  assert.match(a.setCookie!, /^sitecraft_ws=[0-9a-f-]{36}; Path=\/; HttpOnly; SameSite=Strict/);
  const b = await createSite();
  assert.notEqual(a.cookie, b.cookie);
  assert.equal((await get(draft, a.id, a.cookie)).status, 200);
  for (const cookie of [b.cookie, null, 'sitecraft_ws=not-a-token']) {
    assert.equal((await get(draft, a.id, cookie)).status, 404, `draft with ${cookie}`);
    assert.equal((await get(preview, a.id, cookie)).status, 404, `preview with ${cookie}`);
    assert.equal((await get(bundleRoute, a.id, cookie)).status, 404, `bundle with ${cookie}`);
  }
  const deleted = await siteRoute.DELETE(new Request(`${base}/api/sites/${a.id}`, { method: 'DELETE', headers: { cookie: b.cookie, 'content-type': 'application/json' }, body: JSON.stringify({ confirmSiteId: a.id }) }), params(a.id));
  assert.equal(deleted.status, 404, 'another workspace cannot delete');
  const listed = await (await sites.GET(new Request(`${base}/api/sites`, { headers: { cookie: b.cookie } }))).json();
  assert.deepEqual(listed.sites.map((site: any) => site.siteId), [b.id]);
  // The checker's own requests carry the in-process secret instead of a cookie.
  const internal = await draft.GET(new Request(`${base}/api/sites/${a.id}`, { headers: session.internalRequestHeaders() }), params(a.id));
  assert.equal(internal.status, 200);
});

test('hydrate restores a bundle byte for byte, and the bundle round-trips', async () => {
  const a = await createSite();
  const exported = await (await get(bundleRoute, a.id, a.cookie)).json();
  assert.equal(exported.format, 'sitecraft-site-bundle');
  assert.ok(exported.files.some((file: any) => file.path === `code-sites/${a.id}.json`));
  assert.ok(exported.files.some((file: any) => file.path.startsWith(`conversations/${a.id}/`)));
  // Simulate a restart: the server forgets the copy; the browser brings it back with a fresh cookie.
  await session.dropServerCopy(a.id);
  assert.deepEqual(await siteFilesOnDisk(a.id), []);
  const restored = await hydrateBundle(exported, null);
  assert.equal(restored.status, 200);
  assert.equal(restored.body.status, 'hydrated');
  const cookie = restored.setCookie!.split(';')[0];
  assert.deepEqual((await (await get(bundleRoute, a.id, cookie)).json()).files, exported.files);
  for (const file of exported.files) assert.equal((await readFile(path.join(root, file.path))).toString('base64'), file.data);
});

test('hydrate refuses foreign paths, mismatched records, oversize bundles and another workspace\'s site; an older bundle never overwrites', async () => {
  const a = await createSite();
  const exported = await (await get(bundleRoute, a.id, a.cookie)).json();
  const record = exported.files.find((file: any) => file.path === `code-sites/${a.id}.json`);
  const other = crypto.randomUUID();
  for (const bad of [
    { ...exported, files: [...exported.files, { path: `code-sites/../../escape.json`, data: '' }] },
    { ...exported, files: [...exported.files, { path: `code-sites/${other}.json`, data: record.data }] },
    { ...exported, files: [...exported.files, { path: `uploads/demo/${a.id}/../x`, data: '' }] },
    { ...exported, files: exported.files.filter((file: any) => file !== record) },
    { ...exported, siteId: other, files: exported.files.map((file: any) => ({ ...file, path: file.path.replace(a.id, other) })) },
    { ...exported, format: 'zip' },
  ]) assert.equal((await hydrateBundle(bad, a.cookie)).status, 400, JSON.stringify(bad.files?.at(-1)?.path ?? bad.format));
  assert.equal((await hydrateBundle(exported, (await createSite()).cookie)).status, 409, 'another workspace cannot take over a live site');
  // An older browser copy (e.g. a stale tab) is answered with the newer server copy.
  const older = JSON.parse(Buffer.from(record.data, 'base64').toString('utf8'));
  older.updatedAt = '2000-01-01T00:00:00.000Z'; older.name = '旧标签页';
  const stale = await hydrateBundle({ ...exported, files: exported.files.map((file: any) => file === record ? { ...file, data: Buffer.from(JSON.stringify(older)).toString('base64') } : file) }, a.cookie);
  assert.equal(stale.status, 200);
  assert.equal(stale.body.status, 'kept');
  assert.equal((await getCodeSite(a.id))!.name, '浏览器存储站');
  await session.dropServerCopy(a.id);
  process.env.SITECRAFT_BUNDLE_LIMIT_BYTES = '64';
  try { assert.equal((await hydrateBundle(exported, a.cookie)).status, 413); }
  finally { delete process.env.SITECRAFT_BUNDLE_LIMIT_BYTES; }
});

test('idle copies are swept, a site with queued work is kept, and the size cap evicts the longest idle first', async () => {
  const idle = await createSite(), busy = await createSite();
  const ticket = queue.reserveWork(null, busy.id);
  try {
    await session.sweep(Date.now() + 31 * 60_000);
    assert.deepEqual(await siteFilesOnDisk(idle.id), [], 'idle copy removed');
    assert.equal((await get(draft, idle.id, idle.cookie)).status, 404, 'its token no longer opens it');
    assert.ok((await siteFilesOnDisk(busy.id)).length > 0, 'busy copy kept');
  } finally { ticket.release(); }
  const first = await createSite(); await new Promise(resolve => setTimeout(resolve, 5));
  const second = await createSite();
  const bundle = await (await get(bundleRoute, second.id, second.cookie)).json();
  const size = bundle.files.reduce((sum: number, file: any) => sum + Buffer.from(file.data, 'base64').length, 0);
  await session.dropServerCopy(second.id);
  process.env.SITECRAFT_SESSION_CAP_BYTES = String(size + 10);
  try {
    // The cap leaves room for the incoming copy only: every idle copy goes, oldest first.
    const result = await hydrateBundle(bundle, second.cookie);
    assert.equal(result.status, 200);
    assert.deepEqual(await siteFilesOnDisk(busy.id), [], 'longest idle evicted');
    assert.deepEqual(await siteFilesOnDisk(first.id), [], 'next idle evicted while still over the cap');
    const hold = queue.reserveWork(null, second.id);
    try {
      const third = await createSite();
      const thirdBundle = await (await get(bundleRoute, third.id, third.cookie)).json();
      await session.dropServerCopy(third.id);
      assert.equal((await hydrateBundle(thirdBundle, third.cookie)).status, 503, 'only busy copies left: refuse');
    } finally { hold.release(); }
  } finally { delete process.env.SITECRAFT_SESSION_CAP_BYTES; }
});

test('one queue, concurrency 1: one place per token, a short line, and the next task starts on release', async () => {
  const first = queue.reserveWork('token-a', 'site-1');
  assert.equal(first.granted(), true);
  assert.throws(() => queue.reserveWork('token-a', 'site-2'), queue.ServerBusyError, 'one place per token');
  const second = queue.reserveWork('token-b', 'site-3');
  assert.equal(second.granted(), false);
  assert.throws(() => queue.reserveWork('token-c', 'site-4'), queue.ServerBusyError, 'line of 1 is full');
  let started = false; const waiting = second.acquire().then(result => { started = true; return result; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(started, false);
  first.release();
  assert.deepEqual(await waiting, { waited: true });
  second.release();
  const after = queue.reserveWork('token-c', 'site-4'); assert.equal(after.granted(), true); after.release();
});

test('a full queue refuses a style selection before the alignment moves', async () => {
  const a = await createSite();
  const started = await chatPost(a.id, a.cookie, { message: '公司名：拾色绘画教室\n成人业余绘画小班。' });
  assert.equal(started.status, 200);
  const conversationId = (await getCodeSite(a.id))!.conversationId;
  const question = (await getConversation(a.id, conversationId))!.alignment.currentQuestion!;
  const holder = queue.reserveWork('someone-else', 'elsewhere'), line = queue.reserveWork('another', 'elsewhere-2');
  try {
    const refused = await chatPost(a.id, a.cookie, { action: 'select', questionId: question.questionId, questionRevision: question.questionRevision, optionId: 'precision' });
    assert.equal(refused.status, 503);
    assert.match(refused.body.userMessage, /服务器忙/);
    assert.equal((await getConversation(a.id, conversationId))!.alignment.currentQuestion?.questionId, question.questionId);
    assert.equal((await getCodeSite(a.id))!.run, null);
  } finally { holder.release(); line.release(); }
  // With the queue free the same selection is accepted and queued work releases its place when done.
  const accepted = await chatPost(a.id, a.cookie, { action: 'select', questionId: question.questionId, questionRevision: question.questionRevision, optionId: 'precision' });
  assert.equal(accepted.status, 202, JSON.stringify(accepted.body));
  for (const callback of callbacks.splice(0)) await callback();
  assert.equal(queue.siteHasWork(a.id), false, 'the finished (failed) task released its place');
});

test('browser storage has no public published links', async () => {
  const a = await createSite();
  const response = await published.GET(new Request(`${base}/published/${a.id}`), { params: Promise.resolve({ siteKey: a.id }) });
  assert.equal(response.status, 404);
  assert.match(await response.text(), /下载站点包/);
});
