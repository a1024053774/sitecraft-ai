---
id: T-048
title: 生成站怎么摆脱「4 个固定版式」：区块库 + 模型写受限 CSS
type: decide
status: open
blocked_by: []
claimed_by: claude
supersedes:
---

## Question

现在只有 4 个样子能生成，每个样子一份手写 overlay，同一样子换公司资料版式和颜色几乎一样（2026-09-28 盲评）。负责人认为不让模型改 HTML/CSS 效果太差。生成路径要不要改、改成什么？

## Notes

- 2026-09-29 负责人在四个方向里选 E：SiteCraft 自有区块库（开发侧写 HTML/CSS，每种区块 2–3 个变体，页面编排是数据）加设计 token；运行时模型可以在区块结构上写一份限定作用域、经校验的 CSS，不写 HTML、不写文字。对比过的其他方向：A 模型自由写整页（事实易编、撤销不可控）、B 只给 token 旋钮（自由度不够）、C 开发侧批量产 overlay、D 模型写受限 HTML。
- 待定：旧 overlay 怎么迁移、CSS 的边界与三档宽度的守门方式、实现分工与盲评人。讨论记录：[.grilling/template-direction-20260929.md](../../.grilling/template-direction-20260929.md)。
- 关闭后须同步：T-001、`docs/project/mainline.md` Q27=A 段、`docs/project/intent.md` §2、MAP Out of scope 第 4 条、AGENTS.md「生成路径的硬约束」第 3 条、CONTEXT.md（区块库、变体、token、站点样式等新词）。
