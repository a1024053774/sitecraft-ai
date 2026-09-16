---
name: sitecraft-frontend-less-ai-tone
description: Design and review SiteCraft front-end pages to reduce generic AI-generated UI patterns while preserving user facts, template structure, accessibility, and controlled preview operations.
---

# SiteCraft 前端去 AI 味

用于生成或修改 SiteCraft 的工作台、模板适配和预览页面。目标是让页面有明确的行业依据、内容层级和视觉节奏，减少“所有东西都像 AI 生成的落地页”这种结果。

## 先确认输入

读取当前 `visualBrief`、用户事实、模板能力和实际 slot map。把用户没有提供的企业事实、数字、客户、认证、评价、团队和素材写成“待补充”，不能为了让页面更像真实网站而补齐它们。

把主题效果落到现有 `visualBrief`、模板或白名单 operation。这个 Skill 不直接写任意 HTML、CSS、JavaScript，也不绕过 `commitOperations`。

## 规则

- 先确定一个主行动和一个首屏判断，再组织辅助内容；不要让每个区块都拥有同等权重。
- 保留真实行业术语、规格、应用场景和交付边界；删除空泛的“赋能、领先、全面、无缝”等词时，要确认没有丢失事实或限定条件。
- 不把 Hero、优势、服务和 CTA 写成同一组重复承诺。重复时合并同义表达或让每个区块承担不同证据职责。
- 不为了填满版面自动增加三列卡片、编号步骤、客户 Logo、统计数字、评价、价格或博客条目。没有资料就保持缺口可见。
- 视觉变化必须有 brief 依据：颜色是角色而不是随机渐变，字阶要有主次，圆角、阴影、留白和动效要服务信息层级。不要套用“禁用所有渐变/卡片/常用字体”的绝对规则。
- 模板已有布局优先通过声明 slot 和现有 token 适配；未声明或有歧义的节点报告 `missing`，不凭元素顺序、标题正则或相似卡片猜写。
- 复制或调整内容时保留标题层级、列表、表格、引用、链接、数字和判断强度。只改明确命中的问题，不顺便润色整页。
- 图片、字体、图标、商标和模板代码分别核对来源、版本、许可、角色、比例和实际预览；演示素材不能当客户事实。
- 生成后至少检查中文长标题、缺图、窄屏、键盘焦点、表单错误和 `prefers-reduced-motion`。截图用于发现问题，不能代替人工审美判断。

## 输出边界

输出 `visualBrief` 可消费的设计意图、模板可支持的修改和明确缺口。普通内容修改走已有结构化 operation；主题或重大视觉变化需要用户选择/确认。不得输出内部 Skill 名称作为产品选项，也不得把本规则当作审美通过证明。

上游参考：[`lieflat-less-ai-tone`](https://github.com/larashero3-dotcom/lieflat-less-ai-tone)，MIT，固定 revision `27d29232f10124db904ca9c0536d0b67cb3b2833`。本文件是面向前端界面的窄化改编，不复制上游全文；上游规则仍只处理其明确列出的写作触发项。

运行时消费：`lib/frontend-tone.ts` 将上述边界中的少量结构化约束加入现有模型系统提示。模型不读取本文件，也不因此获得直接改 DOM 的权限。
