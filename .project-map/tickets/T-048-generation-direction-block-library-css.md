---
id: T-048
title: 生成站怎么摆脱「4 个固定版式」：区块库 + 模型写受限 CSS
type: decide
status: closed
blocked_by: []
claimed_by: claude
supersedes:
---

## Question

现在只有 4 个样子能生成，每个样子一份手写 overlay，同一样子换公司资料版式和颜色几乎一样（2026-09-28 盲评）。负责人认为不让模型改 HTML/CSS 效果太差。生成路径要不要改、改成什么？

## Resolution

2026-09-29 负责人确认。取代 T-001 中「运行时模型不输出 CSS」和「一个样子一份 overlay」两点，T-001 其余（样子驱动、一个预览引擎、`commitOperations`、adapter 是数据）不变。已同步 AGENTS.md、mainline.md、intent.md §2、CONTEXT.md、MAP。区块库第一批区块、变体数和 CSS 校验的具体做法等 T-051 调研后写进 spec。


- 2026-09-29 负责人在四个方向里选 E：SiteCraft 自有区块库（开发侧写 HTML/CSS，每种区块 2–3 个变体，页面编排是数据）加设计 token；运行时模型可以在区块结构上写一份限定作用域、经校验的 CSS，不写 HTML、不写文字。对比过的其他方向：A 模型自由写整页（事实易编、撤销不可控）、B 只给 token 旋钮（自由度不够）、C 开发侧批量产 overlay、D 模型写受限 HTML。
- 旧 overlay 逐个迁：先迁工程工业，走通 token、首屏/产品族/参数表/询盘 4 个区块、模型写 CSS、三档截图、盲评这一整条线；通过后再迁其余三个样子，每个样子盲评通过才删它的旧 overlay，不留兼容层。
- 模型写的 CSS：只作用于站点区块；加不进文字、外部资源和固定定位；大小有上限；每次改样式是一个 operation，可单独撤销；提交前在无头浏览器里按 375/768/1440 各渲染一次，查横向溢出和文字重叠，不过就拒绝这次修改并告诉用户原因，不静默回退。具体校验做法等 [T-051](T-051-block-material-and-css-guard-research.md)。
- 实现：工程工业这条线由 Kiro（Opus 5.5）做；其余三个样子的迁移由 Sonnet 5.5 子 agent 做；Claude 规划和验收。分工见 [T-049](T-049-roles-2026-09-29.md)。
- 验收：独立盲评通过，并且同一个样子换两家公司后能看出差异。讨论记录：[.grilling/template-direction-20260929.md](../../.grilling/template-direction-20260929.md)。
- 已同步：T-001、`docs/project/mainline.md` Q27=A 段、`docs/project/intent.md` §2、MAP Out of scope 第 4 条、AGENTS.md「生成路径的硬约束」第 3 条、CONTEXT.md（区块库、变体、token、站点样式等新词）。
