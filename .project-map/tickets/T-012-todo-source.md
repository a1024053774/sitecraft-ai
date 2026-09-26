---
id: T-012
title: 待办以哪里为准
type: decide
status: closed
blocked_by: []
claimed_by:
supersedes:
---

## Question

项目已有 `plan.md`「下一步」和 `.grilling/` 记录，引入 project-map 后以哪个为准？

## Resolution

project-map 取代 `plan.md`，成为唯一的待办来源：决定记在决定票里，要做的工作是 build 票，下一步做什么由 `project_map.py status` 算出来。`plan.md` 删除，当前状态移到 MAP 的 Notes；`.grilling/` 仍是 grilling 会话记录。拒绝：两处并存。

依据：2026-09-26 负责人回答 Q1=A。
