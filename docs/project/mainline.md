# SiteCraft 主线

负责人确认前以本文 + [intent.md](./intent.md) / [spec.md](./spec.md) / [plan.md](./plan.md) 为准。会话记录在 `.grilling/`，不另写第二套规格。

更新：2026-09-17，grilling Round 15。Jiro 用法依据同日会话 `31efb674-560a-49b7-8fb2-3b864fe3705a` 对免费组件/模板页的实测。

## 要做成什么样

内部 Demo：用模拟的工业、设备、零部件、外贸资料，做出看起来像那家企业自己建的网站。行业对得上、版式有差异、事实不编、预览里改完能看见、对话可以停下来再继续。

公开上线、真实客户试点、整仓合并 PR #4、让模型直接写 HTML/CSS，都不是本阶段。

## 页面怎么生成（三层，缺一层都不算做完）

1. **样子**：用户选一类能落地的视觉方向，不是选行业名，也不是选 Skill 名。卡片数量不锁死为 4；只挂手头已有本地快照、许可可核的模板。行业来自资料。
2. **模块**：在同一视觉族里，AI 按业务挑选要出现的区块（首屏、产品、关于、联系等）。壳（导航、页脚、色板、栅格）跟这一族走。禁止把 A 站 Header 接到 B 站 Features 上。近期先在现有整页模板里显示或隐藏已有区块，不新做跨源拼装器。
3. **槽位**：选定区块之后，公司名、标题、按钮、规格等只写到声明且唯一命中的节点。找不到就 `missing`，不猜写。草稿仍只走 `commitOperations`。

文案去 AI 味和版式去 AI 味走同一条生成路径：句子进槽位，样子进主题族和模块选择。内部规则用 `sitecraft-frontend-less-ai-tone`（见计划里的合并任务）。模型不输出 CSS。

## 参考站怎么用

Jiro 最大的用处不是免费整页，而是它自己写在首页上的那句话：**跨源把 Header 和 Features 硬拼，每一块会像另一个网站。** 这和「同一视觉族里选模块」是同一条规则。Chrome 商店还补了一句：先贴一次 Master Prompt，后面每块才共用同一套 token。对我们来说，Master Prompt ≈ 先锁 `visualBrief` 和族 token，再填槽位。

2026-09-17 对照 [免费组件](https://jiro.build/components/free)、[免费模板](https://jiro.build/templates/free) 和工业分类后的用法：

- **学形态**：按 Header / FAQ 分区浏览 ≈ 模块选择；Collection 名是视觉族，不是行业名。
- **借结构**：克制的分栏、手风琴、三步/四步流程、询盘表。配方表见 [plan.md](./plan.md)。写进**当前 MIT 模板自己的** HTML，颜色跟当前族走。
- **工业/外贸整页**：KonsTuck、Lozitick 全是 Premium。只借「这一类站该有哪些区块」的清单，用来显隐本地 `screwfast` / `landwind` 已有区块。不买、不搬橙底工地皮和飞机图。
- **不用**：免费六张整页当样子卡（没有工业）；Premium 源码；jiro MCP 进生成运行时；Copy Prompt 当生产提示词；把提示词或缩略图提交进 `vendor/`。

条款页仍 404。生成器再分发许可 unknown，所以只当内部 Demo 的配方，不能当成 MIT 素材库。

## 模型

对话和看预览图都用 `deepseek-flash`（DeepSeek V4.1 Flash，原生多模态）。旧名 `deepseek-v4-flash`、`deepseek-v4-flash-vision-exp` 只出现在历史记录里。评测钉日期和行为，不把这个滚动模型名当成永不变更的版本号。

## 防漂移

用户说「主线」「reality-first」或 `/grilling` 时，先读本文和当前 `plan.md`，用几句话对照：目标、当前切片、这次任务有没有让站点更好看、更真、更能改。对不上就停，不在局部实现里换方向。

不另建 `REALITY.md`，不用规则引擎去猜「被动要不要拦」。日常约束靠本目录文档和 `AGENTS.md` 里的入口。
