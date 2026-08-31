/**
 * 一句话建站 · 意图理解模块
 *
 * 纯函数 + zod，只用相对导入（可被 npm test 直接测）。
 * 职责：把用户一句话转成结构化需求（SiteIntent），并据此选择模板。
 *
 * 设计约束：
 * - 枚举用有限集合（businessType/audience/tone/colorTone），避免模型自由发挥
 * - recommendedTemplateId 用白名单 refine 校验，杜绝模型输出不存在的模板
 * - 模板选择：关键词规则定 category（确定性）→ 模型在 category 内细化 → 用户确认兜底
 */

import { z } from "zod";
import { sectionKeys, type SectionKey } from "./site-document.ts";
import { templateCatalog } from "./template-catalog.ts";
import type { Template, TemplateCategory } from "./site-model.ts";

export const BUSINESS_TYPES = ["manufacturing", "trade", "tech", "services", "other"] as const;
export const AUDIENCES = ["overseasB2b", "domesticB2b", "globalB2b", "endUsers", "investorsPartners", "other"] as const;
export const TONES = ["professional", "technical", "friendly", "bold", "minimal", "editorial"] as const;
export const COLOR_TONES = ["green", "navy", "purple", "dark", "warm", "neutral"] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];
export type Audience = (typeof AUDIENCES)[number];
export type Tone = (typeof TONES)[number];
export type ColorTone = (typeof COLOR_TONES)[number];

export const TEMPLATE_IDS = templateCatalog.map((t) => t.id);

/** 工厂：白名单可注入，便于测试（校验随白名单变化） */
export function createSiteIntentSchema(templateIds: readonly string[]) {
  const templateIdRefine = z
    .string()
    .min(1)
    .max(80)
    .refine((v) => templateIds.includes(v), { message: "模板不在白名单" });
  return z.object({
    businessType: z.enum(BUSINESS_TYPES),
    companyName: z.string().min(1).max(40),
    industry: z.string().min(1).max(60),
    targetAudience: z.enum(AUDIENCES),
    tone: z.enum(TONES),
    colorTone: z.enum(COLOR_TONES).optional(),
    coreSections: z.array(z.enum(sectionKeys)).min(1),
    recommendedTemplateId: templateIdRefine,
    summary: z.string().min(1).max(200),
  });
}

export const siteIntentSchema = createSiteIntentSchema(TEMPLATE_IDS);
export type SiteIntent = z.infer<typeof siteIntentSchema>;

/** 解析模型输出的意图 JSON（复用 ai-provider 的 parseModelJson 模式） */
export function parseSiteIntentContent(content: unknown): { data: SiteIntent | null; error: string } {
  if (typeof content !== "string") return { data: null, error: "message.content 不是字符串" };
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed = siteIntentSchema.safeParse(JSON.parse(cleaned));
    if (parsed.success) return { data: parsed.data, error: "" };
    const issues = parsed.error.issues.slice(0, 6).map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`);
    return { data: null, error: issues.join("；") };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "JSON 解析失败" };
  }
}

/** 构造意图理解的 system prompt（纯函数，可测） */
export function buildIntentPrompt(text: string, catalog: Template[] = templateCatalog): string {
  const businessExamples: Record<string, string> = {
    manufacturing: "工业制造/设备/零部件/光伏组件",
    trade: "出口/外贸/跨境/海外市场",
    tech: "SaaS/AI/软件/开发者工具",
    services: "咨询/设计/律所/作品集/机构",
    other: "其他未归类",
  };
  const audienceExamples: Record<string, string> = {
    overseasB2b: "海外采购商/进口商",
    domesticB2b: "国内企业客户",
    globalB2b: "全球企业客户",
    endUsers: "终端消费者",
    investorsPartners: "投资人/合作伙伴",
    other: "其他",
  };
  const toneExamples: Record<string, string> = {
    professional: "专业可靠",
    technical: "技术硬核",
    friendly: "亲切友好",
    bold: "大胆有冲击力",
    minimal: "极简克制",
    editorial: "编辑式/有观点",
  };
  const colorExamples: Record<string, string> = {
    green: "绿色系（自然/工业）",
    navy: "藏蓝系（稳重/全球贸易）",
    purple: "紫色系（科技/创意）",
    dark: "深色系（高端/极客）",
    warm: "暖色系（亲和/专业服务）",
    neutral: "中性色（极简/通用）",
  };
  const templateLines = catalog
    .map((t) => `- ${t.id}：${t.name}（${t.category}）标签：${t.tags.join("、")}`)
    .join("\n");

  return `你是企业官网建站需求分析师。把用户的一句话转成结构化需求 JSON，只返回 JSON。

枚举含义：
- businessType：${Object.entries(businessExamples).map(([k, v]) => `${k}(${v})`).join("；")}
- targetAudience：${Object.entries(audienceExamples).map(([k, v]) => `${k}(${v})`).join("；")}
- tone：${Object.entries(toneExamples).map(([k, v]) => `${k}(${v})`).join("；")}
- colorTone：${Object.entries(colorExamples).map(([k, v]) => `${k}(${v})`).join("；")}
- coreSections：从 ${sectionKeys.join("、")} 中选用户业务需要保留的板块，默认全选

模板白名单（recommendedTemplateId 必须选最能承载该业务方向的一个）：
${templateLines}

规则：
- companyName 用一句话里的企业名；没有就用行业名占位
- industry 写行业/领域（限 60 字）
- 缺失的企业事实写"待补充"，不虚构客户/认证/产能
- summary 用一句话概括你要建的网站（限 200 字）`;
}

/** 业务类型 → 模板 category 映射（确定性主驱动） */
export const BUSINESS_TYPE_TO_CATEGORY: Record<BusinessType, TemplateCategory | ""> = {
  manufacturing: "制造业",
  trade: "外贸目录",
  tech: "科技企业",
  services: "专业服务",
  other: "",
};

/** 每类模板的默认选择（定位最通用的一档） */
export const DEFAULT_TEMPLATE_FOR_CATEGORY: Record<TemplateCategory, string> = {
  "制造业": "forge",
  "外贸目录": "atlas",
  "科技企业": "signal",
  "专业服务": "kindred",
};

/** 一句话关键词 → category（比 businessType 更"意图化"，如"光伏出口"→外贸目录优先于制造业） */
const CATEGORY_KEYWORDS: Array<[TemplateCategory, RegExp]> = [
  ["外贸目录", /出口|外贸|跨境|海外|欧美|欧洲|美国|glob|export|trade/i],
  ["科技企业", /saas|软件|ai |人工智能|开发者|科技|数字|platform|digital/i],
  ["制造业", /制造|工厂|设备|零部件|光伏|材料|生产|energy|manufactur/i],
  ["专业服务", /咨询|设计|律所|会计|作品集|机构|品牌|agency|portfolio|content/i],
];

export function categoryFromKeywords(text: string): TemplateCategory | null {
  for (const [cat, re] of CATEGORY_KEYWORDS) {
    if (re.test(text)) return cat;
  }
  return null;
}

export type TemplateMatch = {
  templateId: string;
  category: TemplateCategory;
  name: string;
  reason: string;
};

/**
 * 解析一句话 + 意图 → 最终模板选择。
 * 顺序：关键词定 category → businessType 兜底 → category 内模型推荐（越界则规则覆盖）→ 默认模板。
 */
export function resolveTemplate(
  intent: SiteIntent,
  rawText: string,
  catalog: Template[] = templateCatalog,
): TemplateMatch {
  const kwCategory = categoryFromKeywords(rawText);
  let category: TemplateCategory;
  if (kwCategory) {
    category = kwCategory;
  } else {
    const fromType = BUSINESS_TYPE_TO_CATEGORY[intent.businessType];
    if (fromType) category = fromType;
    else category = "制造业"; // other + 无关键词 → 回退 forge 一致
  }
  const whitelist = catalog.filter((t) => t.category === category);
  const recommended = whitelist.some((t) => t.id === intent.recommendedTemplateId)
    ? intent.recommendedTemplateId
    : DEFAULT_TEMPLATE_FOR_CATEGORY[category];
  const t = catalog.find((x) => x.id === recommended)!;
  return {
    templateId: recommended,
    category: t.category,
    name: t.name,
    reason: `${category} · ${t.description}`,
  };
}
