import { mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PoolClient } from "pg";
import { ensureDatabaseSchema, getDatabasePool, withDatabaseTransaction } from "@/lib/postgres";
import { defaultDraft, normalizeDraft, templates, type SiteDraft } from "@/lib/site-model";
import { applySiteOperations, migrateSiteHistory, readText, textTargets, type SiteOperation, type TextTarget } from "@/lib/site-operations";
import { bindSiteImageOperations } from "@/lib/site-images";
import { checkSiteStyle } from "@/lib/site-style-check";
import { summaryFromAppliedTargets } from "@/lib/workspace-copy";
import { getAnnotation } from "@/lib/annotation-store";

export type ChangeSource = "ai" | "import" | "manual" | "migration" | "template";
export type UndoGuard = {
  targets: string[];
  expected: Record<string, unknown>;
  inverseOperations: SiteOperation[];
};
export type ChangeSet = {
  id: string;
  baseRevision: number;
  revision: number;
  summary: string;
  source: ChangeSource;
  operations: SiteOperation[];
  inverseOperations: SiteOperation[];
  appliedTargets: string[];
  annotationId?: string;
  undoGuards?: UndoGuard[];
  selectiveUndoUnsupported?: string;
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
  history: Array<Pick<ChangeSet, "id" | "revision" | "summary" | "source" | "appliedTargets" | "annotationId" | "model" | "latencyMs" | "createdAt">>;
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
    history: record.history.slice(-30).reverse().map(({ id, revision, summary, source, appliedTargets, annotationId, model, latencyMs, createdAt }) => ({
      id, revision, summary, source, appliedTargets, ...(annotationId ? { annotationId } : {}), model, latencyMs, createdAt,
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
  annotationId?: string;
};

type StyleGuardResult = { operations: SiteOperation[]; rejected: string[]; rejectedOnly: boolean };

const selectiveUndoAllowed = new Set<SiteOperation["op"]>([
  "set_text",
  "update_card",
  "add_card",
  "remove_card",
  "update_product",
  "set_product_specs",
  "set_section_visibility",
  "set_block_variant",
  "set_image_slot",
  "remove_image_slot",
  "set_product_image",
  "remove_product_image",
]);

function selectiveUndoReason(operation: SiteOperation) {
  if (operation.op === "replace_cards") return "整组替换 operation（replace_cards）不支持挑着撤销。";
  if (operation.op === "replace_products") return "整组替换 operation（replace_products）不支持挑着撤销。";
  if (operation.op === "replace_commercial_terms") return "整组替换 operation（replace_commercial_terms）不支持挑着撤销。";
  if (operation.op === "replace_draft") return "整份草稿替换 operation（replace_draft）不支持挑着撤销。";
  if (operation.op === "update_commercial_term") return "单条商业条款更新包含条款值和可见性落点，当前不支持挑着撤销；请使用普通撤销。";
  return `${operation.op} 不支持挑着撤销。`;
}

type UndoTargetRead = { known: true; value: unknown } | { known: false };

function readUndoTarget(draft: SiteDraft, target: string): UndoTargetRead {
  if (target === "draft") return { known: true, value: draft };
  if (target === "template") return { known: true, value: draft.templateId };
  if (target === "visualBrief") return { known: true, value: draft.visualBrief };
  if (target === "pagePlan") return { known: true, value: draft.pagePlan };
  if (target === "palette") return { known: true, value: draft.paletteId };
  if (target === "siteStyle") return { known: true, value: draft.siteStyle ?? null };
  if (target === "sectionOrder") return { known: true, value: draft.sectionOrder ?? null };
  if (target === "products") return { known: true, value: draft.products };
  if (target === "commercialTerms") return { known: true, value: draft.content.commercialTerms };
  const parts = target.split(".");
  const localized = /^(.*)\.(zh|en)$/.exec(target);
  if (localized && (textTargets as readonly string[]).includes(localized[1])) {
    return { known: true, value: readText(draft, localized[1] as TextTarget, localized[2] as "zh" | "en") };
  }
  if (parts[0] === "products" && parts.length >= 3) {
    const product = draft.products.find((item) => item.id === parts[1]);
    if (!product) return { known: true, value: null };
    return { known: true, value: parts.slice(2).reduce<unknown>((value, part) => value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined, product) ?? null };
  }
  if (parts.length >= 3 && parts[1] === "items") {
    const section = draft.content[parts[0] as keyof SiteDraft["content"]] as { items?: Array<Record<string, unknown>> } | undefined;
    const item = section?.items?.find((candidate) => candidate.id === parts[2]);
    if (!item) return { known: true, value: null };
    return { known: true, value: parts.slice(3).reduce<unknown>((value, part) => value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined, item) ?? null };
  }
  if (parts[0] === "blockVariants" && parts[1]) return { known: true, value: draft.blockVariants[parts[1] as keyof typeof draft.blockVariants] ?? null };
  if (parts[0] === "content" && parts[1]) return { known: true, value: draft.content[parts[1] as keyof typeof draft.content] ?? null };
  if (parts.length === 2 && parts[1] === "visibility") return { known: true, value: !new Set(draft.hiddenSections as string[]).has(parts[0]) };
  if (parts[0] && parts.length >= 2 && parts[0] in draft.content) {
    const section = draft.content[parts[0] as keyof typeof draft.content];
    return { known: true, value: parts.slice(1).reduce<unknown>((value, part) => value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined, section) ?? null };
  }
  return { known: false };
}

function sameUndoValue(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

const nonLocalizedTextTargets = new Set(["siteName", "companyName", "industry", "goal", "contact.email", "contact.phone"]);

function inverseForTarget(operation: SiteOperation, target: string, before: SiteDraft, inverseOperations: SiteOperation[], appliedTargetCount: number): SiteOperation[] | null {
  if (appliedTargetCount === 1) return structuredClone(inverseOperations);
  const localized = /^(.*)\.(zh|en)$/.exec(target);
  if (operation.op === "set_text" && localized) {
    const base = localized[1];
    if (nonLocalizedTextTargets.has(base) && localized[2] === "en") return null;
    if ((textTargets as readonly string[]).includes(base)) {
      const value = readText(before, base as TextTarget, localized[2] as "zh" | "en");
      const previousEnglishReady = inverseOperations.find((item) => item.op === "set_text") as Extract<SiteOperation, { op: "set_text" }> | undefined;
      return [{ op: "set_text", target: base as TextTarget, locale: localized[2] as "zh" | "en", value, ...(previousEnglishReady?.englishReadyBefore === undefined ? {} : { englishReadyBefore: previousEnglishReady.englishReadyBefore }) } as SiteOperation];
    }
  }
  const card = /^(features|services|faq)\.items\.([A-Za-z0-9_-]+)\.(title|body)\.(zh|en)$/.exec(target);
  if (operation.op === "update_card" && card) {
    const item = before.content[card[1] as "features" | "services" | "faq"].items.find((candidate) => candidate.id === card[2]);
    if (!item) return null;
    const previousEnglishReady = inverseOperations.find((item) => item.op === "update_card") as Extract<SiteOperation, { op: "update_card" }> | undefined;
    const inverse: SiteOperation = { op: "update_card", section: card[1] as "features" | "services" | "faq", itemId: card[2], locale: card[4] as "zh" | "en", [card[3]]: item[card[3] as "title" | "body"][card[4] as "zh" | "en"], ...(previousEnglishReady?.englishReadyBefore === undefined ? {} : { englishReadyBefore: previousEnglishReady.englishReadyBefore }) } as SiteOperation;
    return [inverse];
  }
  const product = /^products\.([A-Za-z0-9_-]+)\.(name|summary|category)\.(zh|en)$/.exec(target);
  if (operation.op === "update_product" && product) {
    const item = before.products.find((candidate) => candidate.id === product[1]);
    if (!item) return null;
    const previousEnglishReady = inverseOperations.find((entry) => entry.op === "update_product") as Extract<SiteOperation, { op: "update_product" }> | undefined;
    const value = (item[product[2] as "name" | "summary" | "category"] as { zh: string; en: string })[product[3] as "zh" | "en"];
    const inverse: SiteOperation = { op: "update_product", productId: product[1], locale: product[3] as "zh" | "en", [product[2]]: value, ...(previousEnglishReady?.englishReadyBefore === undefined ? {} : { englishReadyBefore: previousEnglishReady.englishReadyBefore }) } as SiteOperation;
    return [inverse];
  }
  return null;
}

function buildUndoGuards(before: SiteDraft, operations: SiteOperation[], siteId: string) {
  let current = before;
  const firstWrites = new Map<string, { before: SiteDraft; operation: SiteOperation; inverseOperations: SiteOperation[]; appliedTargetCount: number }>();
  let unsupported: string | undefined;
  for (const operation of operations) {
    const beforeOperation = current;
    const applied = applySiteOperations(current, [operation], {
      templateIds,
      lastChange: "草稿已保存",
      siteId,
    });
    current = applied.draft;
    if (!applied.changed) continue;
    const reason = selectiveUndoAllowed.has(operation.op) ? undefined : selectiveUndoReason(operation);
    unsupported ??= reason;
    if (reason) continue;
    if (!applied.appliedTargets.length || !applied.inverseOperations.length) {
      unsupported ??= `${operation.op} 的落点无法建立可核对的 postcondition。`;
      continue;
    }
    for (const target of applied.appliedTargets) {
      if (!firstWrites.has(target)) firstWrites.set(target, { before: beforeOperation, operation, inverseOperations: applied.inverseOperations, appliedTargetCount: applied.appliedTargets.length });
    }
  }
  const guards: UndoGuard[] = [];
  for (const [target, first] of firstWrites) {
    const read = readUndoTarget(current, target);
    if (!read.known) {
      unsupported ??= `${target} 没有可核对的 target 读取映射，不能挑着撤。`;
      continue;
    }
    const inverse = inverseForTarget(first.operation, target, first.before, first.inverseOperations, first.appliedTargetCount);
    if (!inverse) {
      const nonLocalizedDuplicate = first.operation.op === "set_text" && /^(siteName|companyName|industry|goal|contact\.email|contact\.phone)\.en$/.test(target);
      if (!nonLocalizedDuplicate) unsupported ??= `${first.operation.op} 的 ${target} 不能拆成单目标 inverse。`;
      continue;
    }
    guards.push({ targets: [target], expected: { [target]: structuredClone(read.value) }, inverseOperations: inverse });
  }
  return { guards, unsupported };
}

type SelectiveUndoResult =
  | { status: "applied"; record: SiteRecord; changeSet: ChangeSet; conflictTargets: string[] }
  | { status: "conflict"; record: SiteRecord; conflictTargets: string[] }
  | { status: "rejected"; record: SiteRecord; reason: string; conflictTargets: string[] }
  | { status: "not_found"; record: SiteRecord; reason: string; conflictTargets: string[] };

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

async function commitLocalOperationsLocked(args: CommitArgs, record: SiteRecord): Promise<CommitResult> {
  const previous = args.changeId ? [...record.history, ...record.future].find((change) => change.id === args.changeId) : undefined;
  if (previous) return previous.revision === record.draft.revision
    ? { status: "applied", record, changeSet: previous }
    : { status: "conflict", record };
  if (record.draft.revision !== args.baseRevision) return { status: "conflict", record };
  if (args.annotationId) await getAnnotation(args.siteId, args.annotationId);
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
  const undo = buildUndoGuards(record.draft, operations, args.siteId);
  const changeSet: ChangeSet = {
    id: args.changeId ?? crypto.randomUUID(), baseRevision: record.draft.revision, revision: result.draft.revision,
    summary: committedSummary(args, result.appliedTargets, [...guarded.rejected, ...result.notices]), source: args.source, operations: structuredClone(operations),
    inverseOperations: result.inverseOperations, appliedTargets: result.appliedTargets,
    ...(args.annotationId ? { annotationId: args.annotationId } : {}),
    ...(undo.guards.length ? { undoGuards: undo.guards } : {}),
    ...(undo.unsupported ? { selectiveUndoUnsupported: undo.unsupported } : {}),
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
}

async function commitLocalOperations(args: CommitArgs): Promise<CommitResult> {
  return withSiteLock(args.siteId, async () => commitLocalOperationsLocked(args, (await readRecord(args.siteId)) ?? createRecord(args.siteId)));
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

async function commitPostgresOperationsLocked(args: CommitArgs, client: PoolClient, record: SiteRecord): Promise<CommitResult> {
  const previous = args.changeId ? [...record.history, ...record.future].find((change) => change.id === args.changeId) : undefined;
  if (previous) return previous.revision === record.draft.revision
    ? { status: "applied", record, changeSet: previous }
    : { status: "conflict", record };
  if (record.draft.revision !== args.baseRevision) return { status: "conflict", record };
  if (args.annotationId) await getAnnotation(args.siteId, args.annotationId, client);
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
  const undo = buildUndoGuards(record.draft, operations, args.siteId);
  const changeSet: ChangeSet = {
    id: args.changeId ?? crypto.randomUUID(),
    baseRevision: record.draft.revision,
    revision: result.draft.revision,
    summary: committedSummary(args, result.appliedTargets, [...guarded.rejected, ...result.notices]),
    source: args.source,
    operations: structuredClone(operations),
    inverseOperations: result.inverseOperations,
    appliedTargets: result.appliedTargets,
    ...(args.annotationId ? { annotationId: args.annotationId } : {}),
    ...(undo.guards.length ? { undoGuards: undo.guards } : {}),
    ...(undo.unsupported ? { selectiveUndoUnsupported: undo.unsupported } : {}),
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
}

async function commitPostgresOperations(args: CommitArgs): Promise<CommitResult> {
  return withDatabaseTransaction(async (client) => commitPostgresOperationsLocked(args, client, await lockPostgresRecord(client, args.siteId)));
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

async function readLocalRecordForSelective(siteId: string) {
  return (await readRecord(siteId)) ?? createRecord(siteId);
}

export async function selectiveUndo(siteId: string, changeId: string): Promise<SelectiveUndoResult> {
  if (usePostgres) {
    return withDatabaseTransaction(async (client) => {
      const record = await lockPostgresRecord(client, siteId);
      return selectiveUndoLocked(siteId, changeId, record, (args) => commitPostgresOperationsLocked(args, client, record));
    });
  }
  return withSiteLock(siteId, async () => {
    const record = await readLocalRecordForSelective(siteId);
    return selectiveUndoLocked(siteId, changeId, record, (args) => commitLocalOperationsLocked(args, record));
  });
}

async function selectiveUndoLocked(
  siteId: string,
  changeId: string,
  record: SiteRecord,
  commit: (args: CommitArgs) => Promise<CommitResult>,
): Promise<SelectiveUndoResult> {
  const change = record.history.find((item) => item.id === changeId);
  if (!change) return { status: "not_found", record, reason: "找不到这条批注修改。", conflictTargets: [] };
  if (!change.annotationId) return { status: "rejected", record, reason: "这条修改不是批注事务，不能按批注挑着撤。", conflictTargets: [] };
  if (change.selectiveUndoUnsupported) return { status: "rejected", record, reason: change.selectiveUndoUnsupported, conflictTargets: [] };
  if (!change.undoGuards?.length) return { status: "rejected", record, reason: "这条历史没有可核对的修改后值，不能安全挑着撤。", conflictTargets: [] };

  const safeOperations: SiteOperation[] = [];
  const conflictTargets: string[] = [];
  for (const guard of change.undoGuards) {
    const reads = guard.targets.map((target) => readUndoTarget(record.draft, target));
    if (reads.some((read) => !read.known)) return { status: "rejected", record, reason: "历史 target 没有可核对的读取映射，不能安全挑着撤。", conflictTargets: [] };
    const matches = guard.targets.every((target, index) => sameUndoValue((reads[index] as { known: true; value: unknown }).value, guard.expected[target]));
    if (matches) safeOperations.push(...structuredClone(guard.inverseOperations));
    else conflictTargets.push(...guard.targets);
  }
  if (!safeOperations.length) return { status: "conflict", record, conflictTargets };

  const committed = await commit({
    siteId,
    baseRevision: record.draft.revision,
    operations: safeOperations,
    source: "manual",
    summary: "撤销批注修改",
    annotationId: change.annotationId,
  });
  if (committed.status === "applied") return { status: "applied", record: committed.record, changeSet: committed.changeSet, conflictTargets };
  if (committed.status === "rejected") return { status: "rejected", record: committed.record, reason: committed.reasons.join("；"), conflictTargets };
  if (committed.status === "conflict") return { status: "conflict", record: committed.record, conflictTargets };
  return { status: "conflict", record: committed.record, conflictTargets };
}

export function getSiteStoreStatus() {
  return { driver: usePostgres ? "postgres" as const : "development-file" as const, shared: usePostgres };
}
