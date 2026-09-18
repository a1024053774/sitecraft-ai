import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDatabaseSchema, getDatabasePool, withDatabaseTransaction } from "./postgres.ts";
import { getExistingSite } from "./site-store.ts";

export const LEAD_ID_PATTERN = /^lead_[a-z0-9]{16,40}$/;
export const SITE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/i;
export const MAX_LEADS_PER_SITE = 200;
export const MAX_NAME_CHARS = 80;
export const MAX_EMAIL_CHARS = 160;
export const MAX_COMPANY_CHARS = 120;
export const MAX_MESSAGE_CHARS = 4000;

export type LeadStatus = "new";
export type LeadRecord = {
  id: string;
  siteId: string;
  workspaceId: string;
  name: string;
  email: string;
  company: string;
  message: string;
  status: LeadStatus;
  receivedAt: string;
};
export type CreateLeadInput = {
  siteId: string;
  name: string;
  email: string;
  company?: string;
  message: string;
};
export type PublicLead = Omit<LeadRecord, "workspaceId">;

export class LeadStoreError extends Error {
  readonly code: "invalid" | "not_found" | "full";

  constructor(code: LeadStoreError["code"], message: string) {
    super(message);
    this.name = "LeadStoreError";
    this.code = code;
  }
}

type SiteLeadFile = {
  workspaceId: string;
  siteId: string;
  leads: LeadRecord[];
  updatedAt: string;
};

const storageRoot = path.join(process.cwd(), ".sitecraft-data", "leads");
const workspaceId = process.env.DEFAULT_WORKSPACE_ID || "demo";
const usePostgres = process.env.SITE_STORE === "postgres" || process.env.NODE_ENV === "production";
const globalStore = globalThis as typeof globalThis & { __sitecraftLeadLocks?: Map<string, Promise<void>> };
const locks = globalStore.__sitecraftLeadLocks ?? new Map<string, Promise<void>>();
globalStore.__sitecraftLeadLocks = locks;

export function safeSiteId(siteId: string) {
  if (!SITE_ID_PATTERN.test(siteId)) throw new LeadStoreError("invalid", "站点编号无效");
  return siteId;
}

function clip(value: string, maxChars: number) {
  return value.trim().slice(0, maxChars);
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeLead(raw: unknown, siteId: string): LeadRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== "string" || !LEAD_ID_PATTERN.test(value.id)) return null;
  if (value.siteId !== siteId) return null;
  if (typeof value.name !== "string" || typeof value.email !== "string" || typeof value.message !== "string") return null;
  return {
    id: value.id,
    siteId,
    workspaceId: typeof value.workspaceId === "string" ? value.workspaceId : workspaceId,
    name: clip(value.name, MAX_NAME_CHARS),
    email: clip(value.email, MAX_EMAIL_CHARS),
    company: typeof value.company === "string" ? clip(value.company, MAX_COMPANY_CHARS) : "",
    message: clip(value.message, MAX_MESSAGE_CHARS),
    status: "new",
    receivedAt: typeof value.receivedAt === "string" ? value.receivedAt : new Date().toISOString(),
  };
}

function publicLead(lead: LeadRecord): PublicLead {
  return {
    id: lead.id,
    siteId: lead.siteId,
    name: lead.name,
    email: lead.email,
    company: lead.company,
    message: lead.message,
    status: lead.status,
    receivedAt: lead.receivedAt,
  };
}

function sortNewest(leads: LeadRecord[]) {
  return [...leads].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt) || b.id.localeCompare(a.id));
}

function validateInput(input: CreateLeadInput) {
  const siteId = safeSiteId(input.siteId);
  const name = clip(input.name, MAX_NAME_CHARS);
  const email = clip(input.email, MAX_EMAIL_CHARS);
  const company = clip(input.company ?? "", MAX_COMPANY_CHARS);
  const message = clip(input.message, MAX_MESSAGE_CHARS);
  if (!name) throw new LeadStoreError("invalid", "姓名不能为空");
  if (!email || !isEmail(email)) throw new LeadStoreError("invalid", "邮箱无效");
  if (!message) throw new LeadStoreError("invalid", "留言不能为空");
  return { siteId, name, email, company, message };
}

function newLead(input: ReturnType<typeof validateInput>): LeadRecord {
  return {
    id: `lead_${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`,
    siteId: input.siteId,
    workspaceId,
    name: input.name,
    email: input.email,
    company: input.company,
    message: input.message,
    status: "new",
    receivedAt: new Date().toISOString(),
  };
}

function recordPath(siteId: string) {
  return path.join(storageRoot, workspaceId, `${safeSiteId(siteId)}.json`);
}

async function withLeadLock<T>(siteId: string, task: () => Promise<T>): Promise<T> {
  const key = `${workspaceId}\0${siteId}`;
  const previous = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const queue = previous.then(() => current);
  locks.set(key, queue);
  await previous;
  try {
    return await task();
  } finally {
    release();
    if (locks.get(key) === queue) locks.delete(key);
  }
}

async function readLocalFile(siteId: string): Promise<SiteLeadFile> {
  try {
    const raw = JSON.parse(await readFile(recordPath(siteId), "utf8")) as Partial<SiteLeadFile>;
    const leads = Array.isArray(raw.leads)
      ? raw.leads.map((item) => normalizeLead(item, siteId)).filter((item): item is LeadRecord => Boolean(item))
      : [];
    return {
      workspaceId,
      siteId,
      leads,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
    };
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "ENOENT") return { workspaceId, siteId, leads: [], updatedAt: new Date().toISOString() };
    throw error;
  }
}

async function writeLocalFile(file: SiteLeadFile) {
  const target = recordPath(file.siteId);
  await mkdir(path.dirname(target), { recursive: true });
  const temp = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(file, null, 2), "utf8");
  await rename(temp, target);
}

async function requireExistingSite(siteId: string) {
  const site = await getExistingSite(siteId);
  if (!site) throw new LeadStoreError("not_found", "站点不存在，询盘未保存");
  return site;
}

async function createLocalLead(input: CreateLeadInput) {
  const parsed = validateInput(input);
  await requireExistingSite(parsed.siteId);
  return withLeadLock(parsed.siteId, async () => {
    const file = await readLocalFile(parsed.siteId);
    if (file.leads.length >= MAX_LEADS_PER_SITE) {
      throw new LeadStoreError("full", `该站点询盘已满（${MAX_LEADS_PER_SITE}）`);
    }
    const lead = newLead(parsed);
    file.leads.push(lead);
    file.updatedAt = lead.receivedAt;
    await writeLocalFile(file);
    return lead;
  });
}

async function listLocalLeads(siteId?: string) {
  if (siteId) {
    safeSiteId(siteId);
    const file = await readLocalFile(siteId);
    return sortNewest(file.leads);
  }
  await mkdir(path.join(storageRoot, workspaceId), { recursive: true });
  const names = await readdir(path.join(storageRoot, workspaceId)).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const collected: LeadRecord[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const id = name.slice(0, -5);
    if (!SITE_ID_PATTERN.test(id)) continue;
    const file = await readLocalFile(id);
    collected.push(...file.leads);
  }
  return sortNewest(collected);
}

type LeadRow = { site_id: string; leads: unknown; updated_at: Date };

function rowToFile(row: LeadRow): SiteLeadFile {
  const siteId = row.site_id;
  const rawLeads = Array.isArray(row.leads) ? row.leads : [];
  return {
    workspaceId,
    siteId,
    leads: rawLeads.map((item) => normalizeLead(item, siteId)).filter((item): item is LeadRecord => Boolean(item)),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

async function createPostgresLead(input: CreateLeadInput) {
  const parsed = validateInput(input);
  await requireExistingSite(parsed.siteId);
  return withDatabaseTransaction(async (client) => {
    await client.query(
      `INSERT INTO sitecraft_site_leads (workspace_id, site_id, leads, updated_at)
       VALUES ($1, $2, '[]'::jsonb, NOW())
       ON CONFLICT (workspace_id, site_id) DO NOTHING`,
      [workspaceId, parsed.siteId],
    );
    const result = await client.query<LeadRow>(
      `SELECT site_id, leads, updated_at
       FROM sitecraft_site_leads WHERE workspace_id = $1 AND site_id = $2 FOR UPDATE`,
      [workspaceId, parsed.siteId],
    );
    const file = result.rows[0]
      ? rowToFile(result.rows[0])
      : { workspaceId, siteId: parsed.siteId, leads: [], updatedAt: new Date().toISOString() };
    if (file.leads.length >= MAX_LEADS_PER_SITE) {
      throw new LeadStoreError("full", `该站点询盘已满（${MAX_LEADS_PER_SITE}）`);
    }
    const lead = newLead(parsed);
    file.leads.push(lead);
    await client.query(
      `UPDATE sitecraft_site_leads
       SET leads = $3::jsonb, updated_at = $4
       WHERE workspace_id = $1 AND site_id = $2`,
      [workspaceId, parsed.siteId, JSON.stringify(file.leads), lead.receivedAt],
    );
    return lead;
  });
}

async function listPostgresLeads(siteId?: string) {
  await ensureDatabaseSchema();
  if (siteId) {
    safeSiteId(siteId);
    const result = await getDatabasePool().query<LeadRow>(
      `SELECT site_id, leads, updated_at
       FROM sitecraft_site_leads WHERE workspace_id = $1 AND site_id = $2`,
      [workspaceId, siteId],
    );
    return result.rows[0] ? sortNewest(rowToFile(result.rows[0]).leads) : [];
  }
  const result = await getDatabasePool().query<LeadRow>(
    `SELECT site_id, leads, updated_at FROM sitecraft_site_leads WHERE workspace_id = $1`,
    [workspaceId],
  );
  return sortNewest(result.rows.flatMap((row) => rowToFile(row).leads));
}

export async function createLead(input: CreateLeadInput) {
  return usePostgres ? createPostgresLead(input) : createLocalLead(input);
}

export async function listLeads(filter: { siteId?: string } = {}) {
  const leads = usePostgres ? await listPostgresLeads(filter.siteId) : await listLocalLeads(filter.siteId);
  return leads.map(publicLead);
}

export function getLeadStoreStatus() {
  return { driver: usePostgres ? "postgres" as const : "development-file" as const, shared: usePostgres };
}
