// T-202 browser storage, client side: IndexedDB holds the only lasting copy of
// each site as the server's bundle format. The server copy is hydrated from it
// when a site is opened and pulled back after changes.
export type SiteBundle = { format: 'sitecraft-site-bundle'; version: 1; siteId: string; updatedAt: string; files: { path: string; data: string }[] };
export type LocalSite = { siteId: string; siteName: string; updatedAt: string; hasVersion: boolean; savedAt: string };
type StoredSite = LocalSite & { bundle: SiteBundle; etag: string | null };

export function browserStorageMode() {
  return typeof document !== 'undefined' && document.documentElement.dataset.storage === 'browser';
}

const dbName = 'sitecraft', storeName = 'sites';
function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore(storeName, { keyPath: 'siteId' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('浏览器无法打开本地存储（可能是隐私模式或存储被禁用），站点无法保存在这个浏览器里。'));
  });
}
async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(storeName, mode), request = run(transaction.objectStore(storeName));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = transaction.onabort = () => reject(transaction.error ?? new Error('浏览器本地存储写入失败，可能已满。'));
    });
  } finally { db.close(); }
}

function decodeRecord(bundle: SiteBundle) {
  const file = bundle.files.find(item => item.path === `code-sites/${bundle.siteId}.json`);
  if (!file) throw new Error('站点包缺少站点记录。');
  const bytes = Uint8Array.from(atob(file.data), char => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as { name?: string; updatedAt?: string; currentVersionId?: string | null };
}

export async function listLocalSites(): Promise<LocalSite[]> {
  const all = await withStore<StoredSite[]>('readonly', store => store.getAll() as IDBRequest<StoredSite[]>);
  return all.map(({ siteId, siteName, updatedAt, hasVersion, savedAt }) => ({ siteId, siteName, updatedAt, hasVersion, savedAt }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.siteId.localeCompare(b.siteId));
}
async function readLocal(siteId: string) {
  return (await withStore<StoredSite | undefined>('readonly', store => store.get(siteId) as IDBRequest<StoredSite | undefined>)) ?? null;
}
async function saveLocal(bundle: SiteBundle, etag: string | null) {
  const record = decodeRecord(bundle);
  const value: StoredSite = { siteId: bundle.siteId, siteName: record.name || '未命名站点', updatedAt: record.updatedAt || bundle.updatedAt,
    hasVersion: !!record.currentVersionId, savedAt: new Date().toISOString(), bundle, etag };
  await withStore('readwrite', store => store.put(value));
}
export async function deleteLocalSite(siteId: string) { await withStore('readwrite', store => store.delete(siteId)); }

async function failure(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null) as { userMessage?: string } | null;
  return new Error(payload?.userMessage || fallback);
}

// Bring the server copy back into this browser. Returns false when nothing changed.
export async function pullSite(siteId: string) {
  const local = await readLocal(siteId);
  const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/bundle`, { cache: 'no-store', headers: local?.etag ? { 'if-none-match': local.etag } : {} });
  if (response.status === 304) return false;
  if (!response.ok) throw await failure(response, '站点没有同步回这个浏览器。');
  await saveLocal(await response.json() as SiteBundle, response.headers.get('etag'));
  return true;
}

// Open a site stored in this browser: upload it to the server's working copy.
// A newer server copy (another tab) comes back instead and replaces the local one.
export async function hydrateSite(siteId: string) {
  const local = await readLocal(siteId);
  if (!local) throw new Error('这个站点不在当前浏览器里。站点只保存在建站时使用的浏览器中。');
  const response = await fetch('/api/workspace/hydrate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(local.bundle) });
  if (!response.ok) throw await failure(response, '站点没有载入服务器，请稍后重试。');
  const result = await response.json() as { status: 'hydrated' | 'kept'; bundle: SiteBundle };
  await saveLocal(result.bundle, null);
}
