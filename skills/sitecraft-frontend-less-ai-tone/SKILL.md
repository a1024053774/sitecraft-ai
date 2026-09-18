---
name: sitecraft-frontend-less-ai-tone
description: SiteCraft overlay on frontend-less-ai-tone. The generated site is this company's page built from licensed materials; look goes into visualBrief and same-family modules. Do not fill leftover template chrome. The generator must not emit CSS. Use when generating or editing a SiteCraft site, choosing a look or visualBrief, composing family modules, or when the user mentions Q22, Q26, sitecraft-frontend-less-ai-tone, 文案层, or 样子层.
---

# SiteCraft 叠加层

先读通用规则：`skills/frontend-less-ai-tone/SKILL.md`。

本仓库的生成器不能把那套方向直接写成 CSS。Q22：文案和样子走同一条路径。Q26：开源模板、区块和样式是素材，不是把整页快照挖空填词。运行时子集是 `lib/frontend-tone.ts` 的 `sitecraft-frontend-less-ai-tone@0.3.0`。不要另写一套规则，也不要把 Skill 名称写进用户选项。

模型不输出 CSS。本叠加层不写任意 HTML/CSS/JavaScript，不绕过 `commitOperations`。

## 何时用

生成或改 SiteCraft 站点文案、选样子或 `visualBrief`、用同族素材组页时。用户看见的是样子名称（明亮产品、工程工业、蓝白目录、灰底短路径、深色产品），不是 Skill 名。

## 先读什么

`visualBrief`、用户事实、已准入素材（结构、token、许可资产）、当前模板能力。没有的企业事实写成「待补充」。字体只能用项目已核许可的名单。Jiro 免费区的提示词可以学写法（先锁一族 token，再写单块），不能把 Copy Prompt 贴进生产，也不能因整页气质不像工业就丢掉那些写法。

## 运行时必须遵守

与 `frontendToneRules` 逐字一致，已注入生成 prompt：

- 先确定一个主行动和一个首屏判断，再组织辅助内容；不要让每个区块都拥有同等权重。
- 保留真实行业术语、规格、应用场景和交付边界；缺少企业事实时写待补充，不编造数字、客户、认证、评价或团队。
- Hero、优势、服务和 CTA 各自承担不同证据职责，避免重复同一组承诺。
- 不要为了填满版面自动增加卡片、编号步骤、客户 Logo、统计数字、评价、价格或博客条目。
- 视觉变化要有 visualBrief 和已选模板依据；颜色、字阶、圆角、阴影、留白和动效服务信息层级，不套用绝对的禁用清单。
- 不要把奶油衬线、酸绿黑底、三列圆角卡片墙或全大写眉题当成默认长相；只在主题卡明确要求时才用。
- 不要把整页模板挖空填词。生成站必须是这家公司的页面；开源模板、区块和样式是素材，不能把未选用的品牌、客户 Logo 墙、SaaS 定价或演示图留在成品上。
- 当前草稿仍只走白名单目标；找不到或有歧义时报告 missing，不凭元素顺序、正则或相似卡片猜写。missing 不能当成可以把模板品牌留在客户站上。
- 保留标题层级、列表、表格、引用、链接、数字和判断强度，只改明确命中的问题。

## 怎么做

1. 按通用规则定主行动和记忆点，再映射到已挂卡的样子，不要现场发明版式。
2. 同一视觉族里用已准入素材组该公司页面。不要把 A 站 Header 接到 B 站 Features 上。
3. 导航、页脚、主标题、主行动和可见区块都要是这家公司的。Airbnb Logo 墙、ScrewFast 字标、`$29` 定价卡留在成品上等于没做成。
4. 当前实现仍走白名单 operation 与 `commitOperations`。找不到声明节点报 `missing`。`missing` 是落点失败，不是允许把演示壳留下。组页引擎未做完之前，不要假装整页快照已经是成品。
5. 不为填版面 `add_card`。生成后看真实预览。`deepseek-flash` 可以挑套模板感，不能代替负责人拍板。

## 样子盘

| 样子 | 模板 | 适合 |
| --- | --- | --- |
| 明亮产品 | `forge` | 留白、产品先于故事 |
| 工程工业 | `screwfast` | 产品线、工况、询盘 |
| 蓝白目录 | `landwind` | 分类清楚、转化路径完整 |
| 灰底短路径 | `tailwind-landing` | 单页说清品类和询盘 |
| 深色产品 | `fresh` | 功能/界面说明，深底 |

当前五张卡仍绑在整页快照上，那是过渡。Q26 之后快照是素材来源，不是交付物。

## 合法落点

只走白名单 operation，并经 `commitOperations`：`set_text`、`update_card`、`update_product`、`set_visual_brief`、`set_section_visibility`、`set_page_plan`、`set_image_slot`、`set_product_image`。用户明确要求时才 `set_template`。禁止 `set_css`、`set_html`、`set_style`。

## 不要做

- 不要把本规则或模型自评当成美观通过
- 不要为了「更像真网站」补造事实
- 不要再平行写一套审美规则或第二套渲染器
- 不要把 jiro 源码或未授权字体写进生成物
- 不要因为免费整页气质不像工业，就丢掉它的提示词设计

SiteCraft 正反例见 [examples.md](examples.md)。来源见 [SOURCE.md](SOURCE.md)。
