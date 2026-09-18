export const FRONTEND_TONE_RULES_VERSION = "sitecraft-frontend-less-ai-tone@0.3.0";

/** Runtime-safe subset of the local skill. These rules guide content decisions;
 * template adapters and commitOperations still own every visible write. */
export const frontendToneRules = [
  "先确定一个主行动和一个首屏判断，再组织辅助内容；不要让每个区块都拥有同等权重。",
  "保留真实行业术语、规格、应用场景和交付边界；缺少企业事实时写待补充，不编造数字、客户、认证、评价或团队。",
  "Hero、优势、服务和 CTA 各自承担不同证据职责，避免重复同一组承诺。",
  "不要为了填满版面自动增加卡片、编号步骤、客户 Logo、统计数字、评价、价格或博客条目。",
  "视觉变化要有 visualBrief 和已选模板依据；颜色、字阶、圆角、阴影、留白和动效服务信息层级，不套用绝对的禁用清单。",
  "不要把奶油衬线、酸绿黑底、三列圆角卡片墙或全大写眉题当成默认长相；只在主题卡明确要求时才用。",
  "不要把整页模板挖空填词。生成站必须是这家公司的页面；开源模板、区块和样式是素材，不能把未选用的品牌、客户 Logo 墙、SaaS 定价或演示图留在成品上。",
  "当前草稿仍只走白名单目标；找不到或有歧义时报告 missing，不凭元素顺序、正则或相似卡片猜写。missing 不能当成可以把模板品牌留在客户站上。",
  "保留标题层级、列表、表格、引用、链接、数字和判断强度，只改明确命中的问题。",
] as const;
