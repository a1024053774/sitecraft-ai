import { mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PoolClient } from "pg";
import { ensureDatabaseSchema, getDatabasePool, withDatabaseTransaction } from "@/lib/postgres";
import { defaultDraft, normalizeDraft, templates, type SiteDraft } from "@/lib/site-model";
import { applySiteOperations, migrateSiteHistory, type SiteOperation } from "@/lib/site-operations";
import { bindSiteImageOperations } from "@/lib/site-images";
import { checkSiteStyle } from "@/lib/site-style-check";
import { summaryFromAppliedTargets } from "@/lib/workspace-copy";

export type ChangeSource = "ai" | "import" | "manual" | "migration" | "template";
export type ChangeSet = {
  id: string;
  baseRevision: number;
  revision: number;
  summary: string;
  source: ChangeSource;
  operations: SiteOperation[];
  inverseOperations: SiteOperation[];
  appliedTargets: string[];
  model?: string;
  latencyMs?: number;
  createdAt: string;
};
export type SiteRecord = {
  siteId: string;
  draft: SiteDraft;
  history: ChangeSet[];
  future: ChangeSet[];
  historySchemaVersion: number;
  updatedAt: string;
};
export type SiteSnapshot = {
  draft: SiteDraft;
  history: Array<Pick<ChangeSet, "id" | "revision" | "summary" | "source" | "appliedTargets" | "model" | "latencyMs" | "createdAt">>;
  canUndo: boolean;
  canRedo: boolean;
  updatedAt: string;
  isNew?: boolean;
  // True once any model-generated change is in the history; a new site stays false until then.
  hasGeneratedContent: boolean;
};

const storageRoot = path.join(process.cwd(), ".sitecraft-data", "sites");
const templateIds = new Set(templates.map((item) => item.id));
const workspaceId = process.env.DEFAULT_WORKSPACE_ID || "demo";
const usePostgres = process.env.SITE_STORE === "postgres" || process.env.NODE_ENV === "production";
const globalStore = globalThis as typeof globalThis & { __sitecraftLocks?: Map<string, Promise<void>> };
const locks = globalStore.__sitecraftLocks ?? new Map<string, Promise<void>>();
globalStore.__sitecraftLocks = locks;

function safeSiteId(siteId: string) {
  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(siteId)) throw new Error("Invalid site id");
  return siteId;
}
function recordPath(siteId: string) {
  return path.join(storageRoot, `${safeSiteId(siteId)}.json`);
}
async function readRecord(siteId: string): Promise<SiteRecord | null> {
  try {
    const raw = JSON.parse(await readFile(recordPath(siteId), "utf8")) as Partial<SiteRecord>;
    const record = {
      siteId,
      draft: normalizeDraft(raw.draft, { siteId }),
      history: Array.isArray(raw.history) ? raw.history as ChangeSet[] : [],
      future: Array.isArray(raw.future) ? raw.future as ChangeSet[] : [],
      historySchemaVersion: typeof raw.historySchemaVersion === "number" ? raw.historySchemaVersion : 1,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
    };
    if (record.historySchemaVersion < 3) {
      const migrated = migrateSiteHistory({
        draft: record.draft,
        history: record.history,
        future: record.future,
        templateIds,
        siteId,
      });
      const upgraded: SiteRecord = { ...record, history: migrated.history as ChangeSet[], future: migrated.future as ChangeSet[], historySchemaVersion: 3 };
      await writeRecord(upgraded);
      return upgraded;
    }
    return record as SiteRecord;
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "ENOENT") return null;
    throw error;
  }
}
async function writeRecord(record: SiteRecord) {
  await mkdir(storageRoot, { recursive: true });
  const target = recordPath(record.siteId);
  const temp = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(record, null, 2), "utf8");
  await rename(temp, target);
}
async function withSiteLock<T>(siteId: string, task: () => Promise<T>): Promise<T> {
  const previous = locks.get(siteId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const queue = previous.then(() => current);
  locks.set(siteId, queue);
  await previous;
  try {
    return await task();
  } finally {
    release();
    if (locks.get(siteId) === queue) locks.delete(siteId);
  }
}
function createRecord(siteId: string): SiteRecord {
  return { siteId, draft: structuredClone(defaultDraft), history: [], future: [], historySchemaVersion: 3, updatedAt: new Date().toISOString() };
}
// A layout put back to its default by this change (T-053) is appended as a system notice. AI change
// summaries themselves are rebuilt from appliedTargets below.
function summaryWithNotices(summary: string, notices: string[]) {
  const missing = notices.filter((notice) => !summary.includes(notice));
  return missing.length ? `${summary.replace(/[。.]\s*$/, "")}。${missing.join("")}` : summary;
}
function committedSummary(args: CommitArgs, appliedTargets: string[], notices: string[]) {
  const allNotices = [...(args.notices ?? []), ...notices];
  if (args.source !== "ai") return summaryWithNotices(args.summary, allNotices);
  return summaryFromAppliedTargets({ appliedTargets, notices: allNotices });
}
export function snapshot(record: SiteRecord, isNew?: boolean): SiteSnapshot {
  return {
    draft: structuredClone(record.draft),
    history: record.history.slice(-30).reverse().map(({ id, revision, summary, source, appliedTargets, model, latencyMs, createdAt }) => ({
      id, revision, summary, source, appliedTargets, model, latencyMs, createdAt,
    })),
    canUndo: record.history.length > 0,
    canRedo: record.future.length > 0,
    updatedAt: record.updatedAt,
    ...(isNew === undefined ? {} : { isNew }),
    hasGeneratedContent: record.history.some((change) => change.source === "ai"),
  };
}
async function getLocalSite(siteId: string) {
  return withSiteLock(siteId, async () => {
    const existing = await readRecord(siteId);
    if (existing) return snapshot(existing, false);
    const record = createRecord(siteId);
    await writeRecord(record);
    return snapshot(record, true);
  });
}
async function peekLocalSite(siteId: string) {
  return withSiteLock(siteId, async () => {
    const existing = await readRecord(siteId);
    return existing ? snapshot(existing, false) : null;
  });
}
export type CommitResult =
  | { status: "applied"; record: SiteRecord; changeSet: ChangeSet; rejected?: string[] }
  | { status: "no_change"; record: SiteRecord }
  | { status: "conflict"; record: SiteRecord }
  | { status: "rejected"; record: SiteRecord; reasons: string[] };

type CommitArgs = {
  siteId: string;
  baseRevision: number;
  operations: SiteOperation[];
  summary: string;
  source: ChangeSource;
  notices?: string[];
  // Alignment proposals use their server-issued confirmation ID as the durable receipt.
  changeId?: string;
  model?: string;
  latencyMs?: number;
};

type StyleGuardResult = { operations: SiteOperation[]; rejected: string[]; rejectedOnly: boolean };

async function guardSiteStyle(record: SiteRecord, args: CommitArgs): Promise<StyleGuardResult> {
  const styleOperations = args.operations.filter((operation) => operation.op === "set_site_style" && (operation.rules.length > 0 || operation.direction));
  if (!styleOperations.length) return { operations: args.operations, rejected: [], rejectedOnly: false };
  const candidate = applySiteOperations(record.draft, args.operations, {
    templateIds,
    lastChange: args.source === "ai" ? "刚刚通过 AI 保存" : "草稿已保存",
    siteId: args.siteId,
  });
  if (JSON.stringify(candidate.draft.siteStyle) === JSON.stringify(record.draft.siteStyle)) return { operations: args.operations, rejected: [], rejectedOnly: false };
  const baseUrl = process.env.SITECRAFT_BASE || `http://127.0.0.1:${process.env.PORT || "3034"}`;
  const checked = await checkSiteStyle({ templateId: candidate.draft.templateId, draft: candidate.draft, baseUrl });
  if (checked.ok) return { operations: args.operations, rejected: [], rejectedOnly: false };
  const kept = args.operations.filter((operation) => operation.op !== "set_site_style");
  return { operations: kept, rejected: checked.reasons.map((reason) => reason.startsWith("站点样式没有应用：") ? reason : `站点样式没有应用：${reason}`), rejectedOnly: kept.length === 0 };
}

async function commitLocalOperations(args: CommitArgs): Promise<CommitResult> {
  return withSiteLock(args.siteId, async () => {
    const record = (await readRecord(args.siteId)) ?? createRecord(args.siteId);
    const previous = args.changeId ? [...record.history, ...record.future].find((change) => change.id === args.changeId) : undefined;
    if (previous) return previous.revision === record.draft.revision
      ? { status: "applied", record, changeSet: previous }
      : { status: "conflict", record };
    if (record.draft.revision !== args.baseRevision) return { status: "conflict", record };
    const guarded = await guardSiteStyle(record, args);
    if (guarded.rejectedOnly) return { status: "rejected", record, reasons: guarded.rejected };
    const operations = guarded.operations;
    await bindSiteImageOperations(args.siteId, operations);
    const result = applySiteOperations(record.draft, operations, {
      templateIds,
      lastChange: args.source === "ai" ? "刚刚通过 AI 保存" : "草稿已保存",
      siteId: args.siteId,
    });
    if (!result.changed) return { status: "no_change", record };
    const changeSet: ChangeSet = {
      id: args.changeId ?? crypto.randomUUID(), baseRevision: record.draft.revision, revision: result.draft.revision,
      summary: committedSummary(args, result.appliedTargets, [...guarded.rejected, ...result.notices]), source: args.source, operations: structuredClone(operations),
      inverseOperations: result.inverseOperations, appliedTargets: result.appliedTargets,
      ...(args.model ? { model: args.model } : {}),
      ...(args.latencyMs === undefined ? {} : { latencyMs: args.latencyMs }),
      createdAt: new Date().toISOString(),
    };
    record.draft = result.draft;
    record.history = [...record.history, changeSet].slice(-50);
    record.future = [];
    record.updatedAt = new Date().toISOString();
    await writeRecord(record);
    return { status: "applied", record, changeSet, ...(guarded.rejected.length ? { rejected: guarded.rejected } : {}) };
  });
}
async function moveLocalHistory(siteId: string, action: "undo" | "redo") {
  return withSiteLock(siteId, async () => {
    const record = (await readRecord(siteId)) ?? createRecord(siteId);
    const changeSet = action === "undo" ? record.history.at(-1) : record.future[0];
    if (!changeSet) return { status: "empty" as const, record };
    const result = applySiteOperations(record.draft, action === "undo" ? changeSet.inverseOperations : changeSet.operations, {
      templateIds,
      lastChange: action === "undo" ? "刚刚撤销一次修改" : "刚刚重做一次修改",
      siteId,
    });
    if (!result.changed) return { status: "empty" as const, record };
    record.draft = result.draft;
    if (action === "undo") {
      record.history = record.history.slice(0, -1);
      record.future = [changeSet, ...record.future].slice(0, 50);
    } else {
      record.future = record.future.slice(1);
      record.history = [...record.history, changeSet].slice(-50);
    }
    record.updatedAt = new Date().toISOString();
    await writeRecord(record);
    return { status: "applied" as const, record, changeSet, appliedTargets: result.appliedTargets };
  });
}

type SiteRow = {
  site_id: string;
  draft: unknown;
  history: unknown;
  future: unknown;
  history_schema_version?: number;
  updated_at: Date | string;
};

function rowToRecord(row: SiteRow): SiteRecord {
  return {
    siteId: row.site_id,
    draft: normalizeDraft(row.draft, { siteId: row.site_id }),
    history: Array.isArray(row.history) ? row.history as ChangeSet[] : [],
    future: Array.isArray(row.future) ? row.future as ChangeSet[] : [],
    historySchemaVersion: row.history_schema_version ?? 1,
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function migratePostgresRecordIfNeeded(
  record: SiteRecord,
  persist: (record: SiteRecord) => Promise<void>,
) {
  if (record.historySchemaVersion >= 3) return record;
  const migrated = migrateSiteHistory({
    draft: record.draft,
    history: record.history,
    future: record.future,
    templateIds,
    siteId: record.siteId,
  });
  const upgraded: SiteRecord = {
    ...record,
    ...migrated,
    historySchemaVersion: 3,
    history: migrated.history as ChangeSet[],
    future: migrated.future as ChangeSet[],
  };
  await persist(upgraded);
  return upgraded;
}

async function lockPostgresRecord(client: PoolClient, siteId: string) {
  safeSiteId(siteId);
  const initial = createRecord(siteId);
  await client.query(
    `INSERT INTO sitecraft_sites (workspace_id, site_id, draft, history, future, history_schema_version, updated_at)
     VALUES ($1, $2, $3::jsonb, '[]'::jsonb, '[]'::jsonb, $4, $5)
     ON CONFLICT (workspace_id, site_id) DO NOTHING`,
    [workspaceId, siteId, JSON.stringify(initial.draft), 3, initial.updatedAt],
  );
  const result = await client.query<SiteRow>(
    `SELECT site_id, draft, history, future, history_schema_version, updated_at
     FROM sitecraft_sites WHERE workspace_id = $1 AND site_id = $2 FOR UPDATE`,
    [workspaceId, siteId],
  );
  if (!result.rows[0]) throw new Error("Site record could not be created");
  const record = rowToRecord(result.rows[0]);
  return migratePostgresRecordIfNeeded(record, (upgraded) => savePostgresRecord(client, upgraded));
}

async function savePostgresRecord(client: Pick<PoolClient, "query">, record: SiteRecord) {
  await client.query(
    `UPDATE sitecraft_sites
     SET draft = $3::jsonb, history = $4::jsonb, future = $5::jsonb, history_schema_version = $6, updated_at = $7
     WHERE workspace_id = $1 AND site_id = $2`,
    [workspaceId, record.siteId, JSON.stringify(record.draft), JSON.stringify(record.history), JSON.stringify(record.future), record.historySchemaVersion, record.updatedAt],
  );
}

async function getPostgresSite(siteId: string) {
  safeSiteId(siteId);
  await ensureDatabaseSchema();
  const initial = createRecord(siteId);
  const inserted = await getDatabasePool().query(
    `INSERT INTO sitecraft_sites (workspace_id, site_id, draft, history, future, history_schema_version, updated_at)
     VALUES ($1, $2, $3::jsonb, '[]'::jsonb, '[]'::jsonb, $4, $5)
     ON CONFLICT (workspace_id, site_id) DO NOTHING
     RETURNING site_id`,
    [workspaceId, siteId, JSON.stringify(initial.draft), 3, initial.updatedAt],
  );
  const result = await getDatabasePool().query<SiteRow>(
    `SELECT site_id, draft, history, future, history_schema_version, updated_at
     FROM sitecraft_sites WHERE workspace_id = $1 AND site_id = $2`,
    [workspaceId, siteId],
  );
  if (!result.rows[0]) throw new Error("Site record could not be read");
  const record = rowToRecord(result.rows[0]);
  const migrated = await migratePostgresRecordIfNeeded(record, (upgraded) => savePostgresRecord(getDatabasePool(), upgraded));
  return snapshot(migrated, inserted.rowCount === 1);
}

async function peekPostgresSite(siteId: string) {
  safeSiteId(siteId);
  await ensureDatabaseSchema();
  const result = await getDatabasePool().query<SiteRow>(
    `SELECT site_id, draft, history, future, history_schema_version, updated_at
     FROM sitecraft_sites WHERE workspace_id = $1 AND site_id = $2`,
    [workspaceId, siteId],
  );
  if (!result.rows[0]) return null;
  const record = rowToRecord(result.rows[0]);
  const migrated = await migratePostgresRecordIfNeeded(record, (upgraded) => savePostgresRecord(getDatabasePool(), upgraded));
  return snapshot(migrated, false);
}

async function commitPostgresOperations(args: CommitArgs): Promise<CommitResult> {
  return withDatabaseTransaction(async (client) => {
    const record = await lockPostgresRecord(client, args.siteId);
    const previous = args.changeId ? [...record.history, ...record.future].find((change) => change.id === args.changeId) : undefined;
    if (previous) return previous.revision === record.draft.revision
      ? { status: "applied", record, changeSet: previous }
      : { status: "conflict", record };
    if (record.draft.revision !== args.baseRevision) return { status: "conflict", record };
    const guarded = await guardSiteStyle(record, args);
    if (guarded.rejectedOnly) return { status: "rejected", record, reasons: guarded.rejected };
    const operations = guarded.operations;
    await bindSiteImageOperations(args.siteId, operations);
    const result = applySiteOperations(record.draft, operations, {
      templateIds,
      lastChange: args.source === "ai" ? "刚刚通过 DeepSeek 保存" : "草稿已保存",
      siteId: args.siteId,
    });
    if (!result.changed) return { status: "no_change", record };
    const changeSet: ChangeSet = {
      id: args.changeId ?? crypto.randomUUID(),
      baseRevision: record.draft.revision,
      revision: result.draft.revision,
      summary: committedSummary(args, result.appliedTargets, [...guarded.rejected, ...result.notices]),
      source: args.source,
      operations: structuredClone(operations),
      inverseOperations: result.inverseOperations,
      appliedTargets: result.appliedTargets,
      ...(args.model ? { model: args.model } : {}),
      ...(args.latencyMs === undefined ? {} : { latencyMs: args.latencyMs }),
      createdAt: new Date().toISOString(),
    };
    record.draft = result.draft;
    record.history = [...record.history, changeSet].slice(-50);
    record.future = [];
    record.updatedAt = new Date().toISOString();
    await savePostgresRecord(client, record);
    return { status: "applied", record, changeSet, ...(guarded.rejected.length ? { rejected: guarded.rejected } : {}) };
  });
}

async function movePostgresHistory(siteId: string, action: "undo" | "redo") {
  return withDatabaseTransaction(async (client) => {
    const record = await lockPostgresRecord(client, siteId);
    const changeSet = action === "undo" ? record.history.at(-1) : record.future[0];
    if (!changeSet) return { status: "empty" as const, record };
    const result = applySiteOperations(record.draft, action === "undo" ? changeSet.inverseOperations : changeSet.operations, {
      templateIds,
      lastChange: action === "undo" ? "刚刚撤销一次修改" : "刚刚重做一次修改",
      siteId,
    });
    if (!result.changed) return { status: "empty" as const, record };
    record.draft = result.draft;
    if (action === "undo") {
      record.history = record.history.slice(0, -1);
      record.future = [changeSet, ...record.future].slice(0, 50);
    } else {
      record.future = record.future.slice(1);
      record.history = [...record.history, changeSet].slice(-50);
    }
    record.updatedAt = new Date().toISOString();
    await savePostgresRecord(client, record);
    return { status: "applied" as const, record, changeSet, appliedTargets: result.appliedTargets };
  });
}

export function getSite(siteId: string) {
  return usePostgres ? getPostgresSite(siteId) : getLocalSite(siteId);
}

export function getExistingSite(siteId: string) {
  return usePostgres ? peekPostgresSite(siteId) : peekLocalSite(siteId);
}

export type SiteListItem = {
  siteId: string;
  siteName: string;
  companyName: string;
  templateId: string;
  updatedAt: string;
};

function toListItem(siteId: string, item: SiteSnapshot): SiteListItem {
  return {
    siteId,
    siteName: item.draft.siteName,
    companyName: item.draft.companyName,
    templateId: item.draft.templateId,
    updatedAt: item.updatedAt,
  };
}

async function listLocalSites(): Promise<SiteListItem[]> {
  await mkdir(storageRoot, { recursive: true });
  const names = await readdir(storageRoot);
  const items: SiteListItem[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const siteId = name.slice(0, -5);
    if (!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(siteId)) continue;
    const record = await readRecord(siteId);
    if (record) items.push(toListItem(siteId, snapshot(record, false)));
  }
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.siteId.localeCompare(b.siteId));
}

async function listPostgresSites(): Promise<SiteListItem[]> {
  await ensureDatabaseSchema();
  const result = await getDatabasePool().query<{ site_id: string; draft: unknown; history: unknown; future: unknown; history_schema_version: number; updated_at: Date }>(
    `SELECT site_id, draft, history, future, history_schema_version, updated_at FROM sitecraft_sites WHERE workspace_id = $1`,
    [workspaceId],
  );
  const items: SiteListItem[] = [];
  for (const row of result.rows) {
    const record = rowToRecord({
      site_id: row.site_id,
      draft: row.draft,
      history: row.history,
      future: row.future,
      history_schema_version: row.history_schema_version,
      updated_at: row.updated_at,
    });
    const migrated = await migratePostgresRecordIfNeeded(record, (upgraded) => savePostgresRecord(getDatabasePool(), upgraded));
    items.push(toListItem(row.site_id, snapshot(migrated, false)));
  }
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.siteId.localeCompare(b.siteId));
}

async function deleteLocalSiteRecord(siteId: string) {
  return withSiteLock(siteId, async () => {
    const existing = await readRecord(siteId);
    if (!existing) return false;
    await unlink(recordPath(siteId));
    return true;
  });
}

async function deletePostgresSiteRecord(siteId: string) {
  safeSiteId(siteId);
  await ensureDatabaseSchema();
  const result = await getDatabasePool().query(
    `DELETE FROM sitecraft_sites WHERE workspace_id = $1 AND site_id = $2`,
    [workspaceId, siteId],
  );
  return (result.rowCount ?? 0) > 0;
}

export function listExistingSites() {
  return usePostgres ? listPostgresSites() : listLocalSites();
}

export function deleteSiteRecord(siteId: string) {
  return usePostgres ? deletePostgresSiteRecord(siteId) : deleteLocalSiteRecord(siteId);
}

export function commitOperations(args: CommitArgs): Promise<CommitResult> {
  return usePostgres ? commitPostgresOperations(args) : commitLocalOperations(args);
}

export function moveHistory(siteId: string, action: "undo" | "redo") {
  return usePostgres ? movePostgresHistory(siteId, action) : moveLocalHistory(siteId, action);
}

export function getSiteStoreStatus() {
  return { driver: usePostgres ? "postgres" as const : "development-file" as const, shared: usePostgres };
}
