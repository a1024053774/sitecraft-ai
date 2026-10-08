---
id: T-131
title: 站点列表因旧路线记录配色已下线而整体 500
type: task
status: open
blocked_by: []
claimed_by:
supersedes:
---

## Problem

`GET /api/sites` 逐条读取本地站点并做历史迁移；主工作区两条 9 月旧路线记录（`.sitecraft-data/sites/ab-ind-asm.json`、`goal-live-20260923.json`）引用已下线配色 `industrial-minimal-gray`，`applySiteOperations` 抛错，整个列表返回 500，工作台站点列表不可用。合并 T-128 前即存在（2026-10-07 在 5b8257b 上由 `tests/t128-code-boundary.test.ts` 的两项列表用例暴露）。

## Direction

旧路线整套将在新路线跑通后删除，旧站点一次性转成静态页面存为第一个版本（T-127）。本票只决定在那之前怎么让列表可用：在迁移层把已下线配色映射到同色组现行配色（根因层），不在列表层吞异常、不删除用户数据。若旧路线删除票先开工，本票并入它。

## Acceptance

- [ ] 主工作区 `GET /api/sites` 返回 200，两条旧记录可列出并能打开
- [ ] `tests/t128-code-boundary.test.ts` 在主工作区数据上全部通过；`npm test` 全量通过
