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

const INTERNAL_WORDS = /HTML|CSS|URL|网址|快照|模板|槽位|槽|字段|声明|slot|operation|schema|变体|variant/i;

function operationLabel(operation: { op?: unknown; target?: unknown; section?: unknown; block?: unknown }) {
  if (operation.op === "set_page_plan") return "页面规划";
  if (operation.op === "set_palette" || operation.op === "set_custom_palette") return "配色";
  if (operation.op === "set_visual_brief") return "样子";
  if (operation.op === "set_block_variant" && typeof operation.block === "string") return changeTargetLabel(`blockVariants.${operation.block}`);
  if (operation.op === "replace_products" || operation.op === "update_product" || operation.op === "set_product_specs") return "产品";
  if (operation.op === "set_catalog_section" && typeof operation.section === "string") return changeTargetLabel(operation.section);
  if (typeof operation.target === "string") return changeTargetLabel(operation.target);
  if (typeof operation.section === "string") return changeTargetLabel(operation.section);
  return "";
}

// The model's summary is shown to the user. When it talks about templates, snapshots or HTML, show
// the page parts that changed instead.
export function plainSummary(summary: string, operations: Array<{ op?: unknown; target?: unknown; section?: unknown; block?: unknown }>) {
  if (!INTERNAL_WORDS.test(summary)) return summary;
  const parts = [...new Set(operations.map(operationLabel).filter(Boolean))];
  return parts.length ? `已更新：${parts.join("、")}` : "已更新页面内容";
}
