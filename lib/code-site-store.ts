import { mkdir, readFile, rename, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { safeSiteId, listSiteImages } from './site-images.ts';
import { currentCodeVersion, codeFactMaterials, type CodeSiteRecord, type SiteCode, type CodeVersion } from './code-site.ts';
import { checkSiteCode } from './code-site-check.ts';

const root = path.join(process.cwd(), '.sitecraft-data', 'code-sites');
const shared = globalThis as typeof globalThis & { __codeSiteLocks?: Map<string, Promise<void>> };
const locks = shared.__codeSiteLocks ??= new Map();
async function locked<T>(id: string, task: () => Promise<T>): Promise<T> {
  safeSiteId(id);
  const before = locks.get(id) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>(resolve => { release = resolve; });
  const queued = before.then(() => next); locks.set(id, queued); await before;
  try { return await task(); } finally { release(); if (locks.get(id) === queued) locks.delete(id); }
}
export async function getCodeSite(id: string): Promise<CodeSiteRecord | null> {
  try { return JSON.parse(await readFile(path.join(root, `${safeSiteId(id)}.json`), 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}
export async function deleteCodeSite(id: string) {
  // Wait for any checked commit; removing the single record removes versions, materials and runs.
  return locked(id, () => rm(path.join(root, `${safeSiteId(id)}.json`), { force: true }));
}
async function write(site: CodeSiteRecord) {
  await mkdir(root, { recursive: true });
  const file = path.join(root, `${safeSiteId(site.siteId)}.json`), temp = `${file}.${crypto.randomUUID()}.tmp`;
  site.updatedAt = new Date().toISOString();
  await writeFile(temp, JSON.stringify(site, null, 2), 'utf8'); await rename(temp, file);
}
export async function createCodeSite(siteId: string, name: string, conversationId: string) {
  return locked(siteId, async () => {
    if (await getCodeSite(siteId)) throw new Error('站点已存在');
    const site: CodeSiteRecord = { route: 'code', siteId, name, conversationId, materials: '',
      preferences: { style: 'auto', layout: 5, density: 6 }, plan: null, versions: [], currentVersionId: null, run: null, runs: [], updatedAt: '' };
    await write(site); return site;
  });
}
// Only workflow metadata is editable here. Site code is written by commitSiteCode alone.
type Metadata = Pick<CodeSiteRecord, 'materials' | 'preferences' | 'plan' | 'run' | 'name'>;
export async function updateCodeSite(id: string, update: (site: Readonly<CodeSiteRecord>) => Partial<Metadata>) {
  return locked(id, async () => {
    const site = await getCodeSite(id); if (!site) throw new Error('找不到这个站点');
    const patch = update(structuredClone(site));
    for (const key of ['materials', 'preferences', 'plan', 'run', 'name'] as const) if (key in patch) Object.assign(site, { [key]: patch[key] });
    if (patch.run) {
      const index = site.runs.findIndex(run => run.id === patch.run!.id);
      if (index < 0) site.runs.push(patch.run); else site.runs[index] = patch.run;
    }
    await write(site); return site;
  });
}
export async function nameCodeVersion(siteId: string, versionId: string, name: string) {
  return locked(siteId, async () => {
    const site = await getCodeSite(siteId);
    const version = site?.versions.find(version => version.id === versionId);
    if (!site || !version) return null;
    // The snapshot, revision, request and checks remain immutable; only its label changes.
    if (name) version.name = name; else delete version.name;
    await write(site); return site;
  });
}
export async function commitSiteCode(args: {
  siteId: string; baseRevision: number; code?: SiteCode; restoreVersionId?: string;
  author: CodeVersion['author']; summary: string; request: string; model?: string;
}) {
  return locked(args.siteId, async () => {
    const site = await getCodeSite(args.siteId); if (!site) throw new Error('找不到这个站点');
    const revision = currentCodeVersion(site)?.revision ?? 0;
    if (revision !== args.baseRevision) return { status: 'conflict' as const, site };
    const restore = args.restoreVersionId ? site.versions.find(v => v.id === args.restoreVersionId) : null;
    if (args.restoreVersionId && !restore) throw new Error('找不到要恢复的版本');
    const candidate = restore?.code ?? args.code;
    if (!candidate) throw new Error('没有可提交的站点代码');
    const materials = restore ? codeFactMaterials(site, undefined, restore.id) : codeFactMaterials(site, args.request);
    const checked = await checkSiteCode({ siteId: args.siteId, code: candidate, materials, images: await listSiteImages(args.siteId) });
    if (!checked.checks.passed) return { status: 'rejected' as const, site, ...checked };
    const version: CodeVersion = { id: crypto.randomUUID(), revision: revision + 1, author: args.author,
      summary: args.summary, request: args.request, createdAt: new Date().toISOString(), code: checked.code, checks: checked.checks,
      ...(args.model ? { model: args.model } : {}), ...(restore ? { restoredFrom: restore.id } : {}) };
    site.versions.push(version); site.currentVersionId = version.id;
    await write(site); return { status: 'applied' as const, site, version };
  });
}
