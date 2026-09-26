---
id: T-009
title: 中英文怎么生成，缺的内容怎么显示
type: decide
status: closed
blocked_by: []
claimed_by:
supersedes:
---

## Question

英文站怎么来？资料没有的内容在访客页上怎么显示？

## Resolution

中英文一起生成：一条 operation 同时带 `{zh, en}`，不提高 20 条上限，也不分两轮；英文缺口写 `To be provided`；只有默认英文的旧草稿视为未生成，发布页不提供 EN 切换。缺口规则：条目的标题和正文都缺时不显示，整块都缺时隐藏该块，句子里个别缺口保留「待补充」。

依据：[docs/project/review-2026-09-24.md](../../docs/project/review-2026-09-24.md) §5。2026-09-24，负责人。
