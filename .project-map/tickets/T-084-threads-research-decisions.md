---
id: T-084
title: Notion「前端」收藏调研之后，哪些东西怎么用进 SiteCraft
type: decide
status: closed
blocked_by: []
claimed_by: claude
supersedes:
---

## Question

负责人把收藏的前端资料整理在 Notion「Threads / 学习 / 前端」，共 9 类：规范、提示词生成前端网站、色彩集、类 Figma 网页批注（komo）、Skills、UI 组件、图标库、管理后台模板库、字体。五个 Codex 调研员分头调研、Claude 审核，汇总和分报告见 [docs/research/前端收藏调研-2026-10-03/](../../docs/research/前端收藏调研-2026-10-03/README.md)。要决定的是：哪些用、用在哪一层、先后顺序，以及几个审核时列出的选择题（批注现在开不开工、正文对比度是否升为硬门、图标试验做不做、字体怎么上、要不要找图标作者谈授权）。

## Resolution

2026-10-03 负责人决定：

- **批注（komo）**：现在开工，按调研推荐的契约做。借 komo 的交互骨架（捕获层、悬停描边、点选/拖框、按目标相对比例记位置、找不到就标「脱离」），不借它的通用选择器加文字匹配。锚点只认 `data-sitecraft-slot` 和 T-069 的稳定 id；批注存在站点记录之外的独立文件；圈中多个目标时记录全部，由用户指定主目标后才允许模型修改；「当时看到什么」默认存文字快照，截图由用户主动选；先用轮询；挑着撤按目标逐个检查冲突；批注由用户确认后关闭。这条把 T-064 留下的「圈画批注的契约」变成了票（[T-085](T-085-annotation-contract-store-undo.md)、[T-086](T-086-annotation-preview-tracer.md)）。
- **色卡**：不新增用户可选的色彩集，现有 6 套保留。新增 OKLCH 色阶，把一组种子色展开成中性色、主色、语义色并逐项查对比度，替换自定义品牌色的 HSL 算法（[T-088](T-088-oklch-color-scales.md)）。RAL 名称、色号、Logo 不出现在产品里。
- **字体**：三个样子补中文回退栈；英文按样子用 OFL 字体、自托管，中文先用系统字体（[T-087](T-087-fonts-cjk-fallback-and-ofl.md)）。Fontshare 的 ITF FFL 字体不可用于生成器。
- **UI 组件**：会员或付费的不用；免费且许可清楚的用作参考——生成站区块结构参考 Arc UI 免费仓库、Space UI，进区块池走 T-073 流水线；动效参考 Transitions.dev，自写 CSS；工作台参考 shadcn-admin、Beautiful UI、beUI。只借结构和交互，不把 React 运行时或第三方代码直接拼进访客页。
- **规范**：正文对比度 4.5:1 升为发布页硬门。规则在系统里分四层落地，见下一节（[T-089](T-089-published-contrast-and-line-length.md)、[T-090](T-090-baseline-spacing-primary-cta-checks.md)、[T-091](T-091-anti-ai-tone-rule-additions.md)）。
- **图标**：做联系方式和认证两个区块的图标试验，盲评不过就删。负责人给的 Amicons、Smallbits 只是风格参考，不联系作者谈授权：Lucide（ISC，工作台已在用）里有的直接用，缺的由 Codex 按参考的网格和笔画规范自己画，不描摹、不复制参考作品的路径（[T-092](T-092-icon-set-and-registry.md)、[T-093](T-093-contact-certification-icon-variants.md)）。

### 规范在系统里怎么落地

按「谁在什么时候用」分四层，数值门槛只放在浏览器检查里，不塞进模型提示（避免数字变成页面文字）：

1. **开发侧规则**：`skills/frontend-less-ai-tone/`、`skills/sitecraft-frontend-less-ai-tone/`，给做区块、改样子的人和代理看。区块候选说明（T-073 的 candidate.md）借 oil-ui 的方法，写清品类、区块主任务、一个记忆点、和已有布局的结构差异、主动不做的装饰。
2. **运行时提示**：`lib/frontend-tone.ts`，给模型的短规则：每页先定主任务和一个主动作；状态和资料缺口不只靠颜色表达；只用已选样子支持的层级和密度。
3. **区块数据**：`lib/blocks/catalog.ts` 里每个变体声明语义组、基线组、按钮角色和资料条件，让检查按声明判定，不靠猜 DOM。
4. **浏览器检查（硬门）**：区块进库检查（`scripts/render-block.mjs`）、站点样式提交前三档检查（`lib/site-style-check.ts`）、发布页检查（`scripts/check-published.mjs`）判定正文对比度 4.5:1、正文行长、声明组基线对齐、组间距大于组内间距、每页一个主按钮。不过就拒绝或报失败。

量化不了的（个性一致、强调色和边框用得是否克制、整体像不像这家公司）留给独立审核 agent 盲评；做的人只能自查，不能宣布审美通过。

### 顺序

T-081（设备）还在改 `preview-bridge.ts`、`check-published.mjs`、`lib/blocks/looks/*`、`lib/blocks/fragments/*`，碰这些文件的票等 T-081 合回主线后再从主线拉分支：T-086、T-087、T-089、T-090、T-093。不冲突、可以先做：T-085（不碰 `preview-bridge.ts`）、T-088、T-091、T-092。生成站动效（Transitions.dev 候选：展开、悬停描边、提交成功提示）放在这一批之后再开票。
