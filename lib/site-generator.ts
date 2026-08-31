/**
 * 一句话建站 · 生成编排模块
 *
 * 纯逻辑 + 依赖注入（DraftOpsProvider），只用相对导入（可被 npm test 直接测，不触网）。
 * 职责：根据意图 + 模板，编排"模板默认草稿 + 结构化操作"生成整站初稿。
 *
 * 设计（方案 A）：baseDraft = cloneDraft(defaultDraft)；templateId≠forge 时 leadingOps 含 set_template；
 * 分批 A（骨架/首屏/元数据）→ 批 B（板块内容，按 coreSections）；合并后单次 commit，可撤销。
 */

import { cloneDraft, defaultDraft, type SiteDraft } from "./site-document.ts";
import { validateGenerationOperations, type SiteOperation } from "./site-operations.ts";
import { templateCatalog } from "./template-catalog.ts";
import type { SiteIntent } from "./site-intent.ts";

export type GenerationScope = { sections: string[]; bilingual: boolean };

export type DraftOpsResult =
  | { ok: true; summary: string; operations: SiteOperation[]; model: string }
  | { ok: false; code: string; error: string };

/** 依赖注入的 AI 调用（route 层把 requestDraftOperations 包进来；测试注入 mock） */
export type DraftOpsProvider = (args: {
  intent: SiteIntent;
  templateId: string;
  baseDraft: SiteDraft;
  scope: GenerationScope;
  attemptHint?: string;
}) => Promise<DraftOpsResult>;

export type GenerationPlan = {
  baseDraft: SiteDraft;
  leadingOps: SiteOperation[];
  scope: GenerationScope;
  hideOps: SiteOperation[];
};

/** 编排计划：克隆默认草稿、生成 set_template 前置、确定生成板块、生成隐藏操作 */
export function buildGenerationPlan(
  intent: SiteIntent,
  templateId: string,
  hiddenSections: string[],
): GenerationPlan {
  const baseDraft = cloneDraft(defaultDraft);
  const leadingOps: SiteOperation[] = templateId !== "forge"
    ? [{ op: "set_template", templateId }]
    : [];
  const core = intent.coreSections as string[];
  const hidden = new Set(hiddenSections);
  const sections = core.filter((s) => !hidden.has(s));
  const hideOps: SiteOperation[] = hiddenSections.map((s) => ({
    op: "set_section_visibility",
    section: s as "about" | "features" | "services" | "products" | "contact",
    visible: false,
  }));
  return { baseDraft, leadingOps, scope: { sections, bilingual: true }, hideOps };
}

/** 批 A 提示：骨架/首屏/元数据（必发） */
const BATCH_A_HINT = "第一批：只改元数据与首屏——siteName、companyName、industry、goal(zh)、hero.title/subtitle/cta(zh+en)、navigation.*(zh+en)。不要改其他板块。";

/** 批 B 提示：板块内容 */
function batchBHint(intent: SiteIntent): string {
  return `第二批：按板块补内容——about(title/body)、features(title/intro 及前 3 张卡片)、services(title/intro 及前 3 张卡片)、products(title/intro)、contact(title/body)。板块只写中文，英文可留"待补充"。不要为未列板块生成操作。`;
}

export type GenerateDraftArgs = {
  intent: SiteIntent;
  templateId: string;
  hiddenSections: string[];
  draftOps: DraftOpsProvider;
};

export type GenerateDraftOutcome =
  | { ok: true; summary: string; operations: SiteOperation[]; model: string }
  | { ok: false; code: string; error: string };

/** 生成整站初稿：批 A（必发）→ 批 B（按板块，失败 fail-open 只提交批 A）→ 合并校验 */
export async function generateDraftOperations(args: GenerateDraftArgs): Promise<GenerateDraftOutcome> {
  const plan = buildGenerationPlan(args.intent, args.templateId, args.hiddenSections);
  // 批 A：骨架/首屏/元数据
  const batchA = await args.draftOps({
    intent: args.intent,
    templateId: args.templateId,
    baseDraft: plan.baseDraft,
    scope: { sections: plan.scope.sections, bilingual: true },
    attemptHint: BATCH_A_HINT,
  });
  if (!batchA.ok) {
    return { ok: false, code: batchA.code, error: batchA.error };
  }
  let ops: SiteOperation[] = [...plan.leadingOps, ...batchA.operations];
  let summary = batchA.summary;
  let model = batchA.model;

  // 批 B：板块内容（仅当有板块且模型可能补内容）
  const batchB = await args.draftOps({
    intent: args.intent,
    templateId: args.templateId,
    baseDraft: plan.baseDraft,
    scope: { sections: plan.scope.sections, bilingual: false },
    attemptHint: batchBHint(args.intent),
  });
  if (batchB.ok) {
    ops = [...ops, ...batchB.operations];
    summary = `${summary}；${batchB.summary}`;
    model = batchB.model;
  }
  // 合并隐藏操作
  ops = [...ops, ...plan.hideOps];

  // 校验（白名单 + 长度，生成场景专用：set_template 只查白名单，不要求"明确换模板"）
  const templateIds = new Set(templateCatalog.map((t) => t.id));
  const validated = validateGenerationOperations(ops, templateIds);
  return { ok: true, summary, operations: validated.operations, model };
}
