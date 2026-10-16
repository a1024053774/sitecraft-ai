import { storageGuard } from './storage-directory.ts';
import type { AnnotationTarget } from './annotations.ts';
import { mkdir, readdir, readFile, rename, writeFile, rm, link } from 'node:fs/promises';
import path from 'node:path';
import { safeSiteId, listSiteImages } from './site-images.ts';
import { currentCodeVersion, reviewedMaterialSnapshot, reviewedFactSourceSnapshot, chineseCodeRevision, englishSiteCode, codeFactMaterials, codeFactSourceMaterials, type CodeSiteRecord, type SiteCode, type CodeVersion, type UnavailableCodeSite, type CodeCheck, type CodePlan } from './code-site.ts';
import { sameFactSources, type CodeFactSource } from './code-site-fact-segments.ts';
import { checkSiteCode } from './code-site-check.ts';
import { getOrCreateConversation } from './conversation-store.ts';

const root = path.join(process.env.SITECRAFT_DATA_ROOT || path.join(process.cwd(), '.sitecraft-data'), 'code-sites');
const checkStorage = storageGuard();
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
async function readStored(id: string): Promise<CodeSiteRecord | UnavailableCodeSite | null> {
  checkStorage();
  try { return JSON.parse(await readFile(path.join(root, `${safeSiteId(id)}.json`), 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}
export class CodeSiteUnavailableError extends Error {
  readonly record: UnavailableCodeSite;
  constructor(record: UnavailableCodeSite) { super(record.readError); this.name = 'CodeSiteUnavailableError'; this.record = record; }
}
export async function getCodeSite(id: string): Promise<CodeSiteRecord | null> {
  const record = await readStored(id);
  if (record?.route === 'unavailable') throw new CodeSiteUnavailableError(record);
  return record;
}
export type CodeSiteListItem = { siteId: string; siteName: string; companyName: string; updatedAt: string; hasVersion: boolean; status?: string; readError?: string };
export async function listCodeSites(): Promise<CodeSiteListItem[]> {
  checkStorage();
  let names: string[];
  try { names = await readdir(root); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  const items: CodeSiteListItem[] = [];
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    const record = await readStored(name.slice(0, -5));
    if (!record) continue;
    const hasVersion = record.route === 'code' && !!currentCodeVersion(record);
    items.push({ siteId: record.siteId, siteName: record.name, companyName: record.name, updatedAt: record.updatedAt, hasVersion,
      ...(record.route === 'unavailable' ? { status: record.status, readError: record.readError } : hasVersion ? {} : {status:'尚未生成'}) });
  }
  return items.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt) || a.siteId.localeCompare(b.siteId));
}
export async function deleteCodeSite(id: string) {
  checkStorage();
  // Wait for any checked commit; removing the single record removes versions, materials and runs.
  return locked(id, () => rm(path.join(root, `${safeSiteId(id)}.json`), { force: true }));
}
async function write(site: CodeSiteRecord | UnavailableCodeSite, insert = false) {
  checkStorage();
  await mkdir(root, { recursive: true });
  const file = path.join(root, `${safeSiteId(site.siteId)}.json`), temp = `${file}.${crypto.randomUUID()}.tmp`;
  if (site.route === 'code' || !site.updatedAt) site.updatedAt = new Date().toISOString();
  await writeFile(temp, JSON.stringify(site, null, 2), 'utf8');
  if (!insert) { await rename(temp, file); return true; }
  // Publish the complete first record without replacing a file created by another
  // process during the browser check. This links only our own temporary output.
  try { await link(temp, file); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false; throw error; }
  finally { await rm(temp, { force: true }); }
}
export async function createCodeSite(siteId: string, name: string, conversationId: string) {
  return locked(siteId, async () => {
    if (await readStored(siteId)) throw new Error('站点已存在');
    const site: CodeSiteRecord = { route: 'code', siteId, name, conversationId, materials: '', factSources: [],
      preferences: { style: 'auto', layout: 5, density: 6 }, plan: null, versions: [], currentVersionId: null, run: null, runs: [], updatedAt: '' };
    if (!await write(site, true)) throw new Error('站点已存在'); return site;
  });
}
// Only workflow metadata is editable here. Site code is written by commitSiteCode alone.
type Metadata = Pick<CodeSiteRecord, 'materials' | 'factSources' | 'preferences' | 'plan' | 'run' | 'name'>;
export async function updateCodeSite(id: string, update: (site: Readonly<CodeSiteRecord>) => Partial<Metadata>) {
  return locked(id, async () => {
    const site = await getCodeSite(id); if (!site) throw new Error('找不到这个站点');
    const patch = update(structuredClone(site));
    for (const key of ['materials', 'factSources', 'preferences', 'plan', 'run', 'name'] as const) if (key in patch) Object.assign(site, { [key]: patch[key] });
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
type CodeCommit = {
  siteId: string; baseRevision: number; code?: SiteCode; selectedTarget?: AnnotationTarget; selectedTargets?: AnnotationTarget[]; pageId?: string; restoreVersionId?: string; englishCode?: SiteCode;
  author: 'assistant' | 'user'; summary: string; request: string; model?: string; source?: CodeFactSource | CodeFactSource[]; dynamicStateBudgetMs?: number;
};
type CodeCommitResult = { status: 'conflict'; site: CodeSiteRecord }
  | { status: 'rejected'; site: CodeSiteRecord; code: SiteCode; checks: CodeCheck }
  | { status: 'applied'; site: CodeSiteRecord; version: CodeVersion };
// This input is constructed only by the offline CLI. Public routes parse their own
// normal submission schemas and never forward this field from request JSON.
export type LegacyImportCommit = { siteId: string; legacyImport: {
  name: string; source: { revision: number; updatedAt: string };
} & ({ kind: 'protected' } | { kind: 'failed'; reason: string } | { kind: 'convert'; materials: string; code: SiteCode; exportIssues: string[] }) };
type LegacyImportResult = { status: 'existing'; record: CodeSiteRecord | UnavailableCodeSite }
  | { status: 'unavailable'; record: UnavailableCodeSite }
  | { status: 'applied'; site: CodeSiteRecord; version: CodeVersion };
export function commitSiteCode(args: CodeCommit): Promise<CodeCommitResult>;
export function commitSiteCode(args: LegacyImportCommit): Promise<LegacyImportResult>;
export async function commitSiteCode(args: CodeCommit | LegacyImportCommit): Promise<CodeCommitResult | LegacyImportResult> {
  return locked(args.siteId, async () => {
    if ('legacyImport' in args) {
      const existing = await readStored(args.siteId);
      if (existing) return { status: 'existing' as const, record: existing };
      const imported = args.legacyImport;
      if (imported.kind === 'protected' || imported.kind === 'failed') {
        const status = imported.kind === 'protected' ? '旧站点未转换，含用户上传，已保留' : '旧站转换失败';
        const record: UnavailableCodeSite = { route: 'unavailable', siteId: args.siteId, name: imported.name, updatedAt: imported.source.updatedAt,
          status, readError: imported.kind === 'failed' ? `${status}：${imported.reason}` : status, legacySource: imported.source };
        if (!await write(record, true)) {
          const record = await readStored(args.siteId); if (!record) throw new Error('站点在导入期间已改变，请重新核对。');
          return { status: 'existing' as const, record };
        }
        return { status: 'unavailable' as const, record };
      }
      // Unlike ordinary edits this reads supplied legacy materials, not a new
      // model audit. The cleaning and all deterministic checks are identical.
      const checked = await checkSiteCode({ siteId: args.siteId, code: imported.code, materials: imported.materials,
        images: await listSiteImages(args.siteId), legacyImport: true });
      checked.checks.issues.push(...imported.exportIssues);
      checked.checks.passed = checked.checks.issues.length === 0;
      if (!checked.checks.passed) {
        const record: UnavailableCodeSite = { route: 'unavailable', siteId: args.siteId, name: imported.name, updatedAt: imported.source.updatedAt,
          status: '旧站转换失败', readError: `旧站转换失败：${checked.checks.issues.join('；')}`, checks: checked.checks, legacySource: imported.source };
        if (!await write(record, true)) {
          const record = await readStored(args.siteId); if (!record) throw new Error('站点在导入期间已改变，请重新核对。');
          return { status: 'existing' as const, record };
        }
        return { status: 'unavailable' as const, record };
      }
      // One site-scoped import conversation also makes interrupted or concurrent
      // offline invocations reuse the same metadata rather than creating orphans.
      const conversation = await getOrCreateConversation(args.siteId, 'legacy-import');
      const plan: CodePlan = { summary: '沿用旧站的中文内容与区块顺序。', style: 'precision', styleReason: '沿用旧站静态样式，未重新选风格。',
        pages: checked.code.pages.map(page => ({ id: page.id, title: page.title, outline: '保留旧站已有内容与顺序。' })) };
      const version: CodeVersion = { id: crypto.randomUUID(), revision: 1, author: 'legacy-import', summary: '旧站转换',
        request: '', createdAt: new Date().toISOString(), code: checked.code, checks: checked.checks };
      const site: CodeSiteRecord = { route: 'code', siteId: args.siteId, name: imported.name, conversationId: conversation.conversationId,
        materials: imported.materials, preferences: { style: 'auto', layout: 5, density: 6 }, plan, versions: [version], currentVersionId: version.id,
        run: null, runs: [], updatedAt: '', legacySource: imported.source };
      if (!await write(site, true)) {
        const record = await readStored(args.siteId); if (!record) throw new Error('站点在导入期间已改变，请重新核对。');
        return { status: 'existing' as const, record };
      }
      return { status: 'applied' as const, site, version };
    }
    const site = await getCodeSite(args.siteId); if (!site) throw new Error('找不到这个站点');
    const current = currentCodeVersion(site), revision = current?.revision ?? 0;
    if (revision !== args.baseRevision) return { status: 'conflict' as const, site };
    const images = await listSiteImages(args.siteId);
    if (args.englishCode) {
      if (!current?.checks.passed) throw new Error('请先完成中文版的底线检查。');
      const checked = await checkSiteCode({ siteId: args.siteId, code: args.englishCode, materials: codeFactMaterials(site), images, translationSource: current.code, companyName: site.name });
      if (!checked.checks.passed) return { status: 'rejected' as const, site, ...checked };
      const version: CodeVersion = { id: crypto.randomUUID(), revision: revision + 1, author: args.author, summary: args.summary, request: args.request,
        createdAt: new Date().toISOString(), code: current.code, checks: current.checks, chineseRevision: chineseCodeRevision(current),
        english: { sourceRevision: chineseCodeRevision(current), header: checked.code.header, footer: checked.code.footer, pages: checked.code.pages, checks: checked.checks },
        ...(reviewedMaterialSnapshot(site, current) !== undefined ? { materialSnapshot: reviewedMaterialSnapshot(site, current) } : {}),
        ...(reviewedFactSourceSnapshot(site, current) !== undefined ? { factSourceSnapshot: reviewedFactSourceSnapshot(site, current) } : {}),
        ...(args.model ? { model: args.model } : {}) };
      site.versions.push(version); site.currentVersionId = version.id;
      await write(site); return { status: 'applied' as const, site, version };
    }
    const restore = args.restoreVersionId ? site.versions.find(v => v.id === args.restoreVersionId) : null;
    if (args.restoreVersionId && !restore) throw new Error('找不到要恢复的版本');
    const candidate = restore?.code ?? args.code;
    if (!candidate) throw new Error('没有可提交的站点代码');
    // T-164 / contract D: the stored materials field is original user text.
    // Register it once when the basis does not contain that raw source, without
    // rewriting that version or admitting any text from model context/code.
    const basis = restore ?? current;
    const knownSources = basis ? basis.factSourceSnapshot : site.factSources;
    if (!(Array.isArray(knownSources) && knownSources.some(source => source.text === site.materials)) && site.materials.trim()
      && !site.factSources?.some(source => source.type === 'materials' && source.text === site.materials)) {
      const messageIndex = Math.max(0, ...(site.factSources ?? []).filter(source => source.type !== 'upload').map(source => source.messageIndex)) + 1;
      site.factSources = [{ type: 'materials', messageIndex, text: site.materials }, ...(site.factSources ?? [])];
      await write(site);
    }
    const materials = restore ? codeFactMaterials(site, undefined, restore.id) : codeFactMaterials(site, args.request, site.currentVersionId, true);
    const sourceMaterials = restore ? codeFactSourceMaterials(site, undefined, restore.id) : codeFactSourceMaterials(site, args.source, site.currentVersionId, true);
    const localTargets = args.selectedTargets ?? (args.selectedTarget ? [args.selectedTarget] : []);
    if (localTargets.length && (!current || localTargets.some(target => target.versionId !== current.id) || restore)) throw new Error('锚点版本已改变，请重新点选。');
    if (args.pageId && (!current?.code.pages.some(page => page.id === args.pageId) || restore)) throw new Error('当前页面不存在，请重新选择。');
    const targetMaterials = restore ? reviewedMaterialSnapshot(site, restore) : undefined;
    const restoreSourceMaterials = restore?.checks.factSegments?.sourceMaterials;
    const restoreHasSeparatedFacts = restore?.checks.factSegments?.format === 4
      && Array.isArray(restoreSourceMaterials)
      && sameFactSources(restoreSourceMaterials, sourceMaterials)
      && sameFactSources(reviewedFactSourceSnapshot(site, restore), sourceMaterials);
    const restoredFactReview = restore && restoreHasSeparatedFacts && targetMaterials !== undefined && targetMaterials === site.materials
      ? { versionId: restore.id, revision: restore.revision, checkedAt: restore.checks.factReviewFrom?.checkedAt ?? restore.checks.checkedAt } : undefined;
    // Only the current version and attempts of this exact active task supply
    // receipts. No HTTP-supplied exemption or arbitrary historical candidate.
    const task = site.run;
    const attempts = task?.status === 'running' && task.baseRevision === revision && task.request === args.request
      && !task.selectedTarget && (task.kind === 'generate' || task.kind === 'edit') ? task.attempts : [];
    const factReviews = !restore && !localTargets.length ? [current?.checks.factSegments, ...attempts.map(attempt => attempt.checks.factSegments)]
      .filter((review): review is NonNullable<typeof review> => !!review) : [];
    const checked = await checkSiteCode({ siteId: args.siteId, code: candidate, materials, images, companyName: site.name, restoredFactReview, factReviews, factSourceMaterials: sourceMaterials, style: site.plan?.style,
      ...(args.dynamicStateBudgetMs !== undefined ? { dynamicStateBudgetMs: args.dynamicStateBudgetMs } : {}),
      ...(args.pageId && current ? { pageEdit: { source: current.code, pageId: args.pageId } } : {}),
      ...(localTargets.length && current ? { localEdit: { source: current.code, targets: localTargets,
        ...(current.checks.factCitations ? { citations: current.checks.factCitations } : {}) } } : {}) });
    if (!checked.checks.passed) return { status: 'rejected' as const, site, ...checked };
    if (restoredFactReview && restore?.checks.factSegments) checked.checks.factSegments = { ...restore.checks.factSegments, audited: 0, reused: restore.checks.factSegments.segments.length };
    if (restoredFactReview && restore?.checks.factCitations) checked.checks.factCitations = restore.checks.factCitations;
    if (localTargets.length && current?.checks.factReview) checked.checks.factReview = current.checks.factReview;
    let english = restore ? restore.english : current?.english;
    if (restore?.english) {
      const source = site.versions.find(version => version.revision === restore.english!.sourceRevision);
      if (!source) throw new Error('找不到英文版对应的中文版本。');
      const checkedEnglish = await checkSiteCode({ siteId: args.siteId, code: englishSiteCode(site, restore)!, materials: codeFactMaterials(site, undefined, source.id), images, translationSource: source.code, companyName: site.name });
      if (!checkedEnglish.checks.passed) return { status: 'rejected' as const, site, ...checkedEnglish };
      english = { ...restore.english, checks: checkedEnglish.checks };
    }
    const version: CodeVersion = { id: crypto.randomUUID(), revision: revision + 1, author: args.author,
      summary: args.summary, request: args.request, createdAt: new Date().toISOString(), code: checked.code, checks: checked.checks,
      // A local audit covers its fragment; unchanged portions require a known
      // parent review on the same base materials before we record a reusable basis.
      ...(!localTargets.length || (current && reviewedMaterialSnapshot(site, current) === site.materials && sameFactSources(reviewedFactSourceSnapshot(site, current), sourceMaterials))
        ? { materialSnapshot: site.materials } : {}),
      ...(sourceMaterials !== undefined ? { factSourceSnapshot: sourceMaterials } : {}),
      ...(args.model ? { model: args.model } : {}), ...(restore ? { restoredFrom: restore.id, chineseRevision: chineseCodeRevision(restore) } : {}), ...(english ? { english } : {}) };
    site.versions.push(version); site.currentVersionId = version.id;
    await write(site); return { status: 'applied' as const, site, version };
  });
}
