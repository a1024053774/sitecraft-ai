/**
 * 生成存证（Q3）
 *
 * 每次 AI 生成（execute）成功时，把关键信息落 PG 表，供人工抽查/质量回溯。
 * 存"关键字段"不含完整草稿（省空间）：输入、意图、操作数、耗时、模型、模板、状态。
 * 生产用 PG，开发（SITE_STORE != postgres 且非 production）退化为内存/无操作，避免本地无 DB 时崩。
 */

import { getDatabasePool, ensureDatabaseSchema } from "./postgres.ts";
import type { SiteIntent } from "./site-intent.ts";
import type { SiteOperation } from "./site-operations.ts";

export type GenerationRecordInput = {
  siteId: string;
  inputText: string;
  intent: SiteIntent;
  operations: SiteOperation[];
  templateId: string;
  latencyMs: number;
  model: string;
  status: "applied" | "no_change" | "conflict" | "error";
  /** 附加信息：如重生成板块、失败原因 */
  detail?: string;
};

export type GenerationRecord = GenerationRecordInput & {
  id: number;
  createdAt: string;
};

const usePostgres =
  process.env.SITE_STORE === "postgres" || process.env.NODE_ENV === "production";

export function isGenerationRecordEnabled() {
  return usePostgres;
}

/** 建表（幂等，随 ensureDatabaseSchema 一起） */
export async function ensureGenerationRecordSchema() {
  await ensureDatabaseSchema();
  await getDatabasePool().query(`
    CREATE TABLE IF NOT EXISTS generation_records (
      id BIGSERIAL PRIMARY KEY,
      site_id TEXT NOT NULL,
      input_text TEXT NOT NULL,
      intent JSONB NOT NULL,
      operations JSONB NOT NULL,
      template_id TEXT NOT NULL,
      latency_ms INTEGER NOT NULL DEFAULT 0,
      model TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

/** 写入一条生成存证（fail-open：存证失败不影响主流程） */
export async function recordGeneration(input: GenerationRecordInput): Promise<void> {
  if (!usePostgres) return;
  try {
    await ensureGenerationRecordSchema();
    await getDatabasePool().query(
      `INSERT INTO generation_records (site_id, input_text, intent, operations, template_id, latency_ms, model, status, detail)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7, $8, $9)`,
      [
        input.siteId,
        input.inputText,
        JSON.stringify(input.intent),
        JSON.stringify(input.operations),
        input.templateId,
        input.latencyMs,
        input.model,
        input.status,
        input.detail ?? "",
      ],
    );
  } catch (error) {
    // 存证是辅助功能，失败不阻塞生成；生产可加日志
    console.error("recordGeneration failed:", error instanceof Error ? error.message : error);
  }
}

/** 查询最近 N 条存证（供生成页导出） */
export async function listGenerationRecords(limit = 50): Promise<GenerationRecord[]> {
  if (!usePostgres) return [];
  await ensureGenerationRecordSchema();
  const result = await getDatabasePool().query<GenerationRecord>(
    `SELECT id, site_id, input_text, intent, operations, template_id, latency_ms, model, status, detail, created_at
     FROM generation_records ORDER BY id DESC LIMIT $1`,
    [limit],
  );
  return result.rows;
}
