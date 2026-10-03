import { errorCatalog } from "./user-errors.ts";

// User-facing names for draft targets in the workspace. Field paths (hero.title.zh, contact.phone)
// stay internal; the workspace only ever shows these Chinese page-part names (spec §3.4).

const sectionLabels: Record<string, string> = {
  hero: "首屏",
  about: "关于我们",
  features: "优势",
  services: "服务",
  products: "产品",
  industries: "应用行业",
  capabilities: "加工能力",
  certifications: "认证",
  contact: "询盘",
  faq: "常见问题",
};

const exactLabels: Record<string, string> = {
  palette: "配色",
  siteStyle: "页面样式",
  products: "产品目录",
  pagePlan: "页面规划",
  siteName: "站名",
  companyName: "公司名",
  industry: "行业",
  goal: "经营目标",
  "hero.cta": "首屏按钮",
  "contact.phone": "询盘电话",
  "contact.email": "询盘邮箱",
  "contact.address": "询盘地址",
};

export function changeTargetLabel(target: string) {
  const path = target.replace(/\.(zh|en)$/, "").replace(/^content\./, "");
  if (exactLabels[path]) return exactLabels[path];
  const parts = path.split(".");
  if (parts[0] === "navigation") return "导航";
  if (parts[0] === "sectionOrder") return "区块顺序";
  if (parts[0] === "blockVariants") return `${sectionLabels[parts[1]] ?? "页面"}布局`;
  const section = sectionLabels[parts[0]];
  if (!section) return "页面内容";
  if (parts[0] === "products" && parts[1] && !/^intro$/.test(parts[1])) {
    if (parts[2] === "name") return `${section}名称`;
    if (parts[2] === "summary") return `${section}说明`;
    if (parts[2] === "category") return `${section}类别`;
    if (parts[2] === "specs") return `${section}参数`;
    if (parts[2] === "image") return `${section}图片`;
  }
  if (parts[1] === "intro") return `${section}介绍`;
  if (parts[1] === "items" && parts[2] && /^\d+$/.test(parts[2])) {
    const index = Number(parts[2]) + 1;
    if (parts[3] === "title") return `${section}第${index}项标题`;
    if (parts[3] === "body") return `${section}第${index}项说明`;
    return `${section}第${index}项`;
  }
  if (parts[1] === "title") return `${section}标题`;
  if (parts[1] === "body" || parts[1] === "subtitle") return `${section}说明`;
  if (parts[1] === "image") return `${section}图片`;
  if (parts[1] === "visibility") return `${section}显示`;
  return section;
}

export function changeTargetLabels(targets: string[]) {
  return [...new Set(targets.map(changeTargetLabel))];
}

type AppliedChangeAction = "applied" | "undo" | "redo";
const MAX_APPLIED_CHANGE_SUMMARY_CHARS = 400;
const CHANGE_PREFIX_RE = /^(?:已应用|已更新|已撤销|已重做|未修改|同步中|注意)：/;

/**
 * Gives a workspace change marker exactly one status/action prefix. Applied-target summaries
 * already carry their action (更新/撤销/重做); status-only replies, such as a rejection, get the
 * one prefix from this formatter instead of having the JSX add another one.
 */
export function formatWorkspaceChange(status: string, change: unknown) {
  const text = typeof change === "string" ? change.trim() : "";
  if (!text) return "";
  const prefixed = CHANGE_PREFIX_RE.test(text);
  const bare = prefixed ? text.replace(CHANGE_PREFIX_RE, "") : text;
  if (status === "applied") return prefixed ? text : `已应用：${text}`;
  if (status === "no_change") return prefixed ? text : `未修改：${text}`;
  if (status === "syncing") return `同步中：${bare}`;
  if (status === "warning") return `注意：${bare}`;
  return prefixed ? text : `注意：${text}`;
}

/**
 * Builds the user-facing summary from the targets that the operation engine actually wrote.
 * This is also used for inverse operations so undo and redo name their real落点 rather than
 * repeating any model sentence.
 */
export function summaryFromAppliedTargets(args: {
  appliedTargets: string[];
  action?: AppliedChangeAction;
  notices?: string[];
}) {
  const labels = changeTargetLabels(args.appliedTargets);
  const subject = labels.length ? labels.join("、") : "页面内容";
  const prefix = args.action === "undo" ? "已撤销" : args.action === "redo" ? "已重做" : "已更新";
  const parts = [`${prefix}：${subject}`];
  for (const notice of args.notices ?? []) {
    const clean = notice.trim().replace(/[。.；;]+$/, "");
    if (clean && !parts.includes(clean)) parts.push(clean);
  }
  const summary = parts.join("。") + "。";
  return summary.length <= MAX_APPLIED_CHANGE_SUMMARY_CHARS
    ? summary
    : `${summary.slice(0, MAX_APPLIED_CHANGE_SUMMARY_CHARS - 1)}…`;
}

// The preview reported targets it could not place. Say which page parts are not shown and where a
// value could go instead, in page-part names.
export function describePreviewGaps(args: {
  revision: number;
  missing: string[];
  fallback: string[];
  proposals: Array<{ requested: string; proposed: string }>;
}) {
  const missing = changeTargetLabels(args.missing);
  const approximate = changeTargetLabels(args.fallback);
  const moves = args.proposals.map((item) => `${changeTargetLabel(item.requested)}可以放到${changeTargetLabel(item.proposed)}`);
  const parts = [
    missing.length ? `当前样子没有位置显示：${missing.join("、")}` : "",
    approximate.length ? `按相近位置显示：${approximate.join("、")}` : "",
    moves.length ? [...new Set(moves)].join("、") : "",
  ].filter(Boolean);
  const count = missing.length || approximate.length;
  return {
    text: `草稿 v${args.revision} 已保存，有 ${count} 处内容没有按原位显示。`,
    change: parts.join("；"),
  };
}

function operationLabel(operation: { op?: unknown; target?: unknown; section?: unknown; block?: unknown }) {
  if (operation.op === "set_page_plan") return "页面规划";
  if (operation.op === "set_palette" || operation.op === "set_custom_palette") return "配色";
  if (operation.op === "set_visual_brief") return "样子";
  if (operation.op === "set_site_style") return "页面样式";
  if (operation.op === "reorder_sections") return "区块顺序";
  if (operation.op === "set_block_variant" && typeof operation.block === "string") return changeTargetLabel(`blockVariants.${operation.block}`);
  if (operation.op === "replace_products" || operation.op === "update_product" || operation.op === "set_product_specs") return "产品";
  if (operation.op === "set_product_image" || operation.op === "remove_product_image") return "产品图片";
  if (operation.op === "replace_draft") return "页面内容";
  if (operation.op === "set_catalog_section" && typeof operation.section === "string") return changeTargetLabel(operation.section);
  if (typeof operation.target === "string") return changeTargetLabel(operation.target);
  if (typeof operation.section === "string") return changeTargetLabel(operation.section);
  return "";
}

export function operationTargetLabels(operations: Array<{ op?: unknown; target?: unknown; section?: unknown; block?: unknown }>) {
  return [...new Set(operations.map(operationLabel).filter(Boolean))];
}

/** Confirmation copy is built from operation targets; model prose never enters the UI. */
export function operationSummary(operations: Array<{ op?: unknown; target?: unknown; section?: unknown; block?: unknown }>) {
  const labels = operationTargetLabels(operations);
  return `将修改：${labels.length ? labels.join("、") : "页面内容"}`;
}

// A chat turn that changed nothing. When the system refused what the model asked for (a layout the
// materials do not support, a look switch nobody asked for), the reasons are the whole reply and the
// workspace shows them as "未修改：……"; the generic sentence is only for a turn that had nothing to apply.
export function noChangeReply(summary: unknown, rejected: unknown): { text: string; change: string } {
  const reasons = Array.isArray(rejected)
    ? [...new Set(rejected.filter((item): item is string => typeof item === "string").map((item) => item.trim().replace(/[。.；;]+$/, "")).filter(Boolean))]
    : [];
  if (reasons.length) return { text: "", change: `${reasons.join("；")}。` };
  return { text: "模型没有生成可应用的内容差异，草稿和模板均未修改。", change: String(summary || "没有变化") };
}

// A guided run that failed, read back after a refresh (T-061). The stored reason is the error catalog's
// message for that failure (cut off, timed out, service down, not saved); show it with its next step,
// as the workspace did at the time. Anything else, such as an older record, gets the general line.
export function alignmentFailureText(summary: unknown): string {
  const known = typeof summary === "string" ? errorCatalog().find((item) => item.message === summary.trim()) : undefined;
  return known ? `${known.message} ${known.nextStep}` : "需求对齐没有完成，草稿没有修改。请读取当前状态后重试。";
}
