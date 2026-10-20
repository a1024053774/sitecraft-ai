import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { siteHasWork } from './work-queue.ts';

// T-202 browser storage: the visitor's browser (IndexedDB) is the only lasting
// copy of a site. The server keeps a temporary working copy on a RAM disk while
// the site is open: the browser uploads its bundle (hydrate), pulls it back after
// changes, and idle copies are removed. A random workspace token in an HttpOnly
// cookie only separates visitors from each other; it is not an identity. Losing
// it voids the server copy and leaves the browser's data untouched.
export const browserStorage = process.env.SITE_STORE === 'browser';
const configuredRoot = process.env.SITECRAFT_DATA_ROOT;
const dataRoot = path.resolve(/* turbopackIgnore: true */ configuredRoot || path.join(process.cwd(), '.sitecraft-data'));
const uploadWorkspace = process.env.DEFAULT_WORKSPACE_ID || 'demo';
const cookieName = 'sitecraft_ws';
const internalHeader = 'x-sitecraft-internal';
const tokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const sitePattern = /^[a-z0-9][a-z0-9_-]{0,79}$/i;

const idleMs = () => Number(process.env.SITECRAFT_SESSION_IDLE_MS ?? 30 * 60_000);
const capBytes = () => Number(process.env.SITECRAFT_SESSION_CAP_BYTES ?? 128 * 2 ** 20);
export const bundleLimitBytes = () => Number(process.env.SITECRAFT_BUNDLE_LIMIT_BYTES ?? 20 * 2 ** 20);

type Entry = { token: string; lastActive: number };
type SessionState = { sites: Map<string, Entry>; secret: string; ready: Promise<void> | null; sweeper: ReturnType<typeof setInterval> | null };
const shared = globalThis as typeof globalThis & { __sitecraftSessions?: SessionState };
const state: SessionState = shared.__sitecraftSessions ??= { sites: new Map(), secret: crypto.randomUUID(), ready: null, sweeper: null };
const workspace = new AsyncLocalStorage<string | null>();

export class BundleError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) { super(message); this.name = 'BundleError'; this.status = status; }
}

// The server copy is disposable, so browser mode refuses any root it might share
// with lasting data, and starts every process from an empty working area.
function ensureReady() {
  if (!browserStorage) return Promise.resolve();
  return state.ready ??= (async () => {
    if (!configuredRoot || dataRoot === path.resolve(process.cwd(), '.sitecraft-data'))
      throw new Error('SITE_STORE=browser 必须把 SITECRAFT_DATA_ROOT 设为单独的临时目录（例如内存盘），不能使用默认数据目录。');
    for (const dir of ['code-sites', 'conversations', 'annotations', 'uploads'])
      await rm(path.join(dataRoot, dir), { recursive: true, force: true });
    state.sweeper ??= setInterval(() => { void sweep(); }, 60_000);
    state.sweeper.unref?.();
  })();
}

export function internalRequestHeaders(): Record<string, string> { return browserStorage ? { [internalHeader]: state.secret } : {}; }
export function currentWorkspaceToken() { return workspace.getStore() ?? null; }

function cookieToken(request: Request) {
  const value = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  return value && tokenPattern.test(value) ? value : null;
}
function tokenCookie(token: string, request: Request) {
  const secure = new URL(request.url).protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
  return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;
}
function withCookie(response: Response, cookie: string | null) {
  if (cookie) response.headers.append('set-cookie', cookie);
  return response;
}
const notFound = () => Response.json({ userMessage: '找不到这个站点。请从工作台重新打开。' }, { status: 404 });

// Site routes: only the token that hydrated or created the site may read or change it.
export async function withSiteWorkspace(request: Request, siteId: string, handler: () => Promise<Response>) {
  if (!browserStorage) return handler();
  await ensureReady();
  if (request.headers.get(internalHeader) === state.secret) return workspace.run(null, handler);
  const token = cookieToken(request), entry = sitePattern.test(siteId) ? state.sites.get(siteId) : undefined;
  if (!token || !entry || entry.token !== token) return notFound();
  entry.lastActive = Date.now();
  return workspace.run(token, handler);
}
// Workspace-level routes (list, create, hydrate): issue a token when the browser has none.
export async function withWorkspaceToken(request: Request, handler: (token: string | null) => Promise<Response>) {
  if (!browserStorage) return handler(null);
  await ensureReady();
  const existing = cookieToken(request), token = existing ?? crypto.randomUUID();
  return withCookie(await workspace.run(token, () => handler(token)), existing ? null : tokenCookie(token, request));
}
export function registerSite(siteId: string, token: string | null) {
  if (browserStorage && token) state.sites.set(siteId, { token, lastActive: Date.now() });
}
export function sitesOfToken(token: string | null) {
  return new Set([...state.sites].filter(([, entry]) => entry.token === token).map(([siteId]) => siteId));
}

// One site's files, at the paths each store uses. Stores keep their own formats;
// the bundle carries the files byte for byte.
const siteFiles = {
  record: (siteId: string) => path.join(dataRoot, 'code-sites', `${siteId}.json`),
  annotations: (siteId: string) => path.join(dataRoot, 'annotations', `${siteId}.json`),
  conversations: (siteId: string) => path.join(dataRoot, 'conversations', siteId),
  uploads: (siteId: string) => path.join(dataRoot, 'uploads', uploadWorkspace, siteId),
};
function allowedPath(siteId: string, relative: string) {
  const id = siteId.replace(/[-]/g, '\\-');
  return new RegExp(`^(code-sites/${id}\\.json|annotations/${id}\\.json|conversations/${id}/[A-Za-z0-9][A-Za-z0-9_-]{0,119}\\.json|uploads/${uploadWorkspace}/${id}/[A-Za-z0-9][A-Za-z0-9_.-]{0,159})$`).test(relative)
    && !relative.split('/').some(part => part === '..' || part === '.');
}
async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? listFiles(path.join(dir, entry.name)) : entry.isFile() ? [path.join(dir, entry.name)] : []))).flat();
}
async function filesOf(siteId: string) {
  const single = await Promise.all([siteFiles.record(siteId), siteFiles.annotations(siteId)].map(async file => {
    try { return (await stat(file)).isFile() ? [file] : []; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  }));
  return [...single.flat(), ...await listFiles(siteFiles.conversations(siteId)), ...await listFiles(siteFiles.uploads(siteId))];
}
async function removeSiteFiles(siteId: string) {
  await Promise.all([siteFiles.record(siteId), siteFiles.annotations(siteId), siteFiles.conversations(siteId), siteFiles.uploads(siteId)]
    .map(target => rm(target, { recursive: true, force: true })));
}
async function recordUpdatedAt(siteId: string) {
  try { return String(JSON.parse(await readFile(siteFiles.record(siteId), 'utf8')).updatedAt ?? ''); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}

export type SiteBundle = { format: 'sitecraft-site-bundle'; version: 1; siteId: string; updatedAt: string; files: { path: string; data: string }[] };
export async function exportBundle(siteId: string): Promise<SiteBundle> {
  const files = await filesOf(siteId);
  return { format: 'sitecraft-site-bundle', version: 1, siteId, updatedAt: (await recordUpdatedAt(siteId)) ?? '',
    files: await Promise.all(files.map(async file => ({ path: path.relative(dataRoot, file).split(path.sep).join('/'), data: (await readFile(file)).toString('base64') }))) };
}

// Hydrate a browser bundle into the server copy. A newer server copy of the same
// site (another tab committed meanwhile) is kept and returned instead.
export async function importBundle(token: string, raw: unknown): Promise<{ status: 'hydrated' | 'kept'; bundle: SiteBundle }> {
  await ensureReady();
  const input = raw as Partial<SiteBundle> | null;
  if (!input || input.format !== 'sitecraft-site-bundle' || input.version !== 1 || typeof input.siteId !== 'string' || !sitePattern.test(input.siteId) || !Array.isArray(input.files))
    throw new BundleError('站点包格式无效。');
  const siteId = input.siteId, owner = state.sites.get(siteId);
  if (owner && owner.token !== token) throw new BundleError('这个站点正在另一个浏览器里打开，请在那里继续，或稍后再试。', 409);
  let total = 0;
  const files = input.files.map(file => {
    if (!file || typeof file.path !== 'string' || typeof file.data !== 'string' || !allowedPath(siteId, file.path)) throw new BundleError('站点包里有不属于这个站点的文件。');
    const bytes = Buffer.from(file.data, 'base64');
    total += bytes.length;
    return { path: file.path, bytes };
  });
  if (total > bundleLimitBytes()) throw new BundleError(`站点包超过 ${Math.round(bundleLimitBytes() / 2 ** 20)}MB 上限。`, 413);
  const recordFile = files.find(file => file.path === `code-sites/${siteId}.json`);
  if (!recordFile) throw new BundleError('站点包缺少站点记录。');
  let record: { siteId?: unknown; route?: unknown; updatedAt?: unknown };
  try { record = JSON.parse(recordFile.bytes.toString('utf8')); } catch { throw new BundleError('站点记录不是有效的 JSON。'); }
  if (record.siteId !== siteId || (record.route !== 'code' && record.route !== 'unavailable')) throw new BundleError('站点记录与站点编号不一致。');
  for (const file of files) if (file.path.endsWith('.json') && !file.path.startsWith('uploads/')) {
    try { JSON.parse(file.bytes.toString('utf8')); } catch { throw new BundleError(`站点包文件不是有效的 JSON：${file.path}`); }
  }
  const serverUpdatedAt = owner ? await recordUpdatedAt(siteId) : null;
  if (serverUpdatedAt && serverUpdatedAt >= String(record.updatedAt ?? '')) {
    owner!.lastActive = Date.now();
    return { status: 'kept', bundle: await exportBundle(siteId) };
  }
  if (siteHasWork(siteId)) throw new BundleError('这个站点有任务正在处理，请稍后刷新。', 409);
  await makeRoom(total, siteId);
  await removeSiteFiles(siteId);
  for (const file of files) {
    const target = path.join(dataRoot, ...file.path.split('/'));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.bytes);
  }
  state.sites.set(siteId, { token, lastActive: Date.now() });
  return { status: 'hydrated', bundle: await exportBundle(siteId) };
}

export async function dropServerCopy(siteId: string) {
  state.sites.delete(siteId);
  await removeSiteFiles(siteId);
}
async function siteBytes(siteId: string) {
  return (await Promise.all((await filesOf(siteId)).map(async file => (await stat(file)).size))).reduce((sum, size) => sum + size, 0);
}
// Keep the working area under its cap by removing the longest-idle copies that
// have no task. If that is not enough, the new bundle is refused.
async function makeRoom(incoming: number, except: string) {
  const sizes = new Map<string, number>();
  for (const siteId of state.sites.keys()) sizes.set(siteId, await siteBytes(siteId));
  let used = [...sizes].filter(([siteId]) => siteId !== except).reduce((sum, [, size]) => sum + size, 0);
  const idle = [...state.sites].filter(([siteId]) => siteId !== except && !siteHasWork(siteId)).sort((a, b) => a[1].lastActive - b[1].lastActive);
  for (const [siteId] of idle) {
    if (used + incoming <= capBytes()) break;
    used -= sizes.get(siteId) ?? 0;
    await dropServerCopy(siteId);
  }
  if (used + incoming > capBytes()) throw new BundleError('服务器忙，请稍后再试。', 503);
}
export async function sweep(now = Date.now()) {
  for (const [siteId, entry] of [...state.sites])
    if (now - entry.lastActive > idleMs() && !siteHasWork(siteId)) await dropServerCopy(siteId);
  // Over the cap with only busy sites left: new bundles are refused until they finish.
  try { await makeRoom(0, ''); } catch (error) { if (!(error instanceof BundleError)) throw error; }
}
