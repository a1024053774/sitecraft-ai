---
id: T-197
title: 极端窄列（平均每行不到 2 个字）改为底线拒收
type: decide
status: closed
blocked_by: []
claimed_by:
supersedes:
---

## Question

T-186 的真实评估中，molding/documentary（`sitecraft-ai-t186/artifacts/t186/eval/private/case-2/products-375.png`）有五张规格表的 caption 在 375 下变成一字一行的竖排。T-160 的窄列反馈报了 2 次，但按现行规则窄列只作质量反馈，不拒收，这一站照样存了版本。

要不要把极端情况改为拒收？

## Resolution

负责人 2026-10-19 选「极端情况改为拒收」，按以下三条执行：

- 平均每行不到 2 个字的可见文字块属于底线失败，交回模型修正，最多两轮；仍然不过就如实告诉用户。
- 普通窄列与正文行长仍然只作质量反馈，不变。
- 由 T-198 实现。实现合并后，同步改 AGENTS.md「验收」一节和 mainline 评估四层中 T-160 的表述。
