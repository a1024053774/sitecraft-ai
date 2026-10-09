import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDatabaseSchema, getDatabasePool, withDatabaseTransaction } from "@/lib/postgres";
import {
  annotationThreadSchema,
  createAnnotationSchema,
  newAnnotationCommentId,
  newAnnotationId,
  parseAnnotation,
  replyAnnotationSchema,
  updateAnnotationSchema,
  type AnnotationThread,
  type CreateAnnotationInput,
  type ReplyAnnotationInput,
  type UpdateAnnotationInput,
} from "@/lib/annotations";

const storageRoot = path.join(process.env.SITECRAFT_DATA_ROOT || path.join(process.cwd(), ".sitecraft-data"), "annotations");
const workspaceId = process.env.DEFAULT_WORKSPACE_ID || "demo";
const usePostgres = process.env.SITE_STORE === "postgres" || process.env.NODE_ENV === "production";
const globalStore = globalThis as typeof globalThis & { __sitecraftAnnotationLocks?: Map<string, Promise<void>> };
const locks = globalStore.__sitecraftAnnotationLocks ?? new Map<string, Promise<void>>();
globalStore.__sitecraftAnnotationLocks = locks;

export class AnnotationNotFoundError extends Error {
  constructor(siteId: string, annotationId: string) {
    super(`Annotation ${annotationId} does not exist for site ${siteId}`);
    this.name = "AnnotationNotFoundError";
  }
}

function safeSiteId(siteId: string) {
  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(siteId)) throw new Error("Invalid site id");
  return siteId;
}

function safeAnnotationId(annotationId: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(annotationId)) throw new Error("Invalid annotation id");
  return annotationId;
}

function filePath(siteId: string) {
  return path.join(storageRoot, `${safeSiteId(siteId)}.json`);
}

type AnnotationFile = { schemaVersion: 1; annotations: AnnotationThread[] };
export type AnnotationQueryClient = { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<{ annotation: unknown }>; rowCount?: number | null }> };

function parseFile(value: unknown): AnnotationFile {
  if (Array.isArray(value)) return { schemaVersion: 1, annotations: value.map(parseAnnotation) };
  if (!value || typeof value !== "object") return { schemaVersion: 1, annotations: [] };
  const raw = value as { schemaVersion?: unknown; annotations?: unknown };
  if (raw.schemaVersion !== undefined && raw.schemaVersion !== 1) throw new Error("Unsupported annotation schema version");
  return { schemaVersion: 1, annotations: Array.isArray(raw.annotations) ? raw.annotations.map(parseAnnotation) : [] };
}

async function readLocal(siteId: string) {
  try {
    return parseFile(JSON.parse(await readFile(filePath(siteId), "utf8")));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && String(error.code) === "ENOENT")
      return { schemaVersion: 1 as const, annotations: [] };
    throw error;
  }
}

async function writeLocal(siteId: string, data: AnnotationFile) {
  await mkdir(storageRoot, { recursive: true });
  const target = filePath(siteId);
  const temp = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(data, null, 2), "utf8");
  await rename(temp, target);
}

async function withLocalLock<T>(siteId: string, task: () => Promise<T>): Promise<T> {
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

function filterAnnotations(annotations: AnnotationThread[], pageId?: string, pagePath?: string) {
  return annotations
    .filter((annotation) => !pageId || annotation.pageId === pageId)
    .filter((annotation) => !pagePath || annotation.pagePath === pagePath)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((annotation) => structuredClone(annotation));
}

function newThread(input: CreateAnnotationInput): AnnotationThread {
  const now = new Date().toISOString();
  return annotationThreadSchema.parse({
    id: newAnnotationId(),
    siteId: input.siteId,
    pageId: input.pageId,
    pagePath: input.pagePath,
    status: "open",
    anchor: input.anchor,
    current: { state: "attached", revision: input.anchor.revision, rect: input.anchor.rect },
    comments: [{ id: newAnnotationCommentId(), body: input.body.trim(), author: input.author, createdAt: now }],
    createdAt: now,
    updatedAt: now,
  });
}

async function listLocal(siteId: string, pageId?: string, pagePath?: string) {
  return withLocalLock(siteId, async () => filterAnnotations((await readLocal(siteId)).annotations, pageId, pagePath));
}

async function createLocal(input: CreateAnnotationInput) {
  return withLocalLock(input.siteId, async () => {
    const data = await readLocal(input.siteId);
    const annotation = newThread(input);
    data.annotations.push(annotation);
    await writeLocal(input.siteId, data);
    return structuredClone(annotation);
  });
}

async function replyLocal(siteId: string, annotationId: string, input: ReplyAnnotationInput) {
  return withLocalLock(siteId, async () => {
    const data = await readLocal(siteId);
    const found = data.annotations.find((item) => item.id === annotationId);
    if (!found) throw new AnnotationNotFoundError(siteId, annotationId);
    const now = new Date().toISOString();
    found.comments.push({ id: newAnnotationCommentId(), body: input.body.trim(), author: input.author, createdAt: now });
    found.updatedAt = now;
    const parsed = parseAnnotation(found);
    data.annotations = data.annotations.map((item) => item.id === annotationId ? parsed : item);
    await writeLocal(siteId, data);
    return structuredClone(parsed);
  });
}

async function updateLocal(siteId: string, annotationId: string, input: UpdateAnnotationInput) {
  return withLocalLock(siteId, async () => {
    const data = await readLocal(siteId);
    const found = data.annotations.find((item) => item.id === annotationId);
    if (!found) throw new AnnotationNotFoundError(siteId, annotationId);
    Object.assign(found, input, { updatedAt: new Date().toISOString() });
    const parsed = parseAnnotation(found);
    data.annotations = data.annotations.map((item) => item.id === annotationId ? parsed : item);
    await writeLocal(siteId, data);
    return structuredClone(parsed);
  });
}

async function deleteLocal(siteId: string, annotationId: string) {
  return withLocalLock(siteId, async () => {
    const data = await readLocal(siteId);
    if (!data.annotations.some((item) => item.id === annotationId)) throw new AnnotationNotFoundError(siteId, annotationId);
    data.annotations = data.annotations.filter((item) => item.id !== annotationId);
    await writeLocal(siteId, data);
  });
}

async function listPostgres(siteId: string, pageId?: string, pagePath?: string) {
  safeSiteId(siteId);
  await ensureDatabaseSchema();
  const result = await getDatabasePool().query<{ annotation: unknown }>(
    "SELECT annotation FROM sitecraft_annotations WHERE workspace_id = $1 AND site_id = $2 ORDER BY updated_at DESC",
    [workspaceId, siteId],
  );
  return filterAnnotations(result.rows.map((row) => parseAnnotation(row.annotation)), pageId, pagePath);
}

async function createPostgres(input: CreateAnnotationInput) {
  safeSiteId(input.siteId);
  await ensureDatabaseSchema();
  const annotation = newThread(input);
  await getDatabasePool().query(
    "INSERT INTO sitecraft_annotations (workspace_id, site_id, annotation_id, annotation, created_at, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5, $5)",
    [workspaceId, input.siteId, annotation.id, JSON.stringify(annotation), annotation.createdAt],
  );
  return structuredClone(annotation);
}

async function findPostgres(client: AnnotationQueryClient, siteId: string, annotationId: string) {
  const result = await client.query(
    "SELECT annotation FROM sitecraft_annotations WHERE workspace_id = $1 AND site_id = $2 AND annotation_id = $3 FOR UPDATE",
    [workspaceId, siteId, annotationId],
  );
  const row = result.rows[0];
  if (!row) throw new AnnotationNotFoundError(siteId, annotationId);
  return parseAnnotation(row.annotation);
}

async function replyPostgres(siteId: string, annotationId: string, input: ReplyAnnotationInput) {
  safeSiteId(siteId); safeAnnotationId(annotationId);
  return withDatabaseTransaction(async (client) => {
    const annotation = await findPostgres(client, siteId, annotationId);
    const now = new Date().toISOString();
    annotation.comments.push({ id: newAnnotationCommentId(), body: input.body.trim(), author: input.author, createdAt: now });
    annotation.updatedAt = now;
    const parsed = parseAnnotation(annotation);
    await client.query(
      "UPDATE sitecraft_annotations SET annotation = $4::jsonb, updated_at = $5 WHERE workspace_id = $1 AND site_id = $2 AND annotation_id = $3",
      [workspaceId, siteId, annotationId, JSON.stringify(parsed), now],
    );
    return structuredClone(parsed);
  });
}

async function updatePostgres(siteId: string, annotationId: string, input: UpdateAnnotationInput) {
  safeSiteId(siteId); safeAnnotationId(annotationId);
  return withDatabaseTransaction(async (client) => {
    const annotation = await findPostgres(client, siteId, annotationId);
    Object.assign(annotation, input, { updatedAt: new Date().toISOString() });
    const parsed = parseAnnotation(annotation);
    await client.query(
      "UPDATE sitecraft_annotations SET annotation = $4::jsonb, updated_at = $5 WHERE workspace_id = $1 AND site_id = $2 AND annotation_id = $3",
      [workspaceId, siteId, annotationId, JSON.stringify(parsed), parsed.updatedAt],
    );
    return structuredClone(parsed);
  });
}

async function deletePostgres(siteId: string, annotationId: string) {
  safeSiteId(siteId); safeAnnotationId(annotationId);
  await ensureDatabaseSchema();
  const result = await getDatabasePool().query(
    "DELETE FROM sitecraft_annotations WHERE workspace_id = $1 AND site_id = $2 AND annotation_id = $3",
    [workspaceId, siteId, annotationId],
  );
  if (!result.rowCount) throw new AnnotationNotFoundError(siteId, annotationId);
}

export async function listAnnotations(siteId: string, filters?: { pageId?: string; pagePath?: string }) {
  return usePostgres ? listPostgres(siteId, filters?.pageId, filters?.pagePath) : listLocal(siteId, filters?.pageId, filters?.pagePath);
}

export async function getAnnotation(siteId: string, annotationId: string, client?: AnnotationQueryClient) {
  if (usePostgres && client) {
    safeSiteId(siteId); safeAnnotationId(annotationId);
    return findPostgres(client, siteId, annotationId);
  }
  const items = await listAnnotations(siteId);
  const annotation = items.find((item) => item.id === annotationId);
  if (!annotation) throw new AnnotationNotFoundError(siteId, annotationId);
  return annotation;
}

export async function createAnnotation(input: CreateAnnotationInput) {
  const parsed = createAnnotationSchema.parse(input);
  return usePostgres ? createPostgres(parsed) : createLocal(parsed);
}

export async function replyAnnotation(siteId: string, annotationId: string, input: ReplyAnnotationInput) {
  const parsed = replyAnnotationSchema.parse(input);
  return usePostgres ? replyPostgres(siteId, annotationId, parsed) : replyLocal(siteId, annotationId, parsed);
}

export async function updateAnnotation(siteId: string, annotationId: string, input: UpdateAnnotationInput) {
  const parsed = updateAnnotationSchema.parse(input);
  return usePostgres ? updatePostgres(siteId, annotationId, parsed) : updateLocal(siteId, annotationId, parsed);
}

export async function resolveAnnotation(siteId: string, annotationId: string, resolved: boolean) {
  return updateAnnotation(siteId, annotationId, { status: resolved ? "resolved" : "open" });
}

export async function deleteAnnotation(siteId: string, annotationId: string) {
  if (usePostgres) return deletePostgres(siteId, annotationId);
  return deleteLocal(siteId, annotationId);
}
