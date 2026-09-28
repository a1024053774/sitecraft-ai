---
id: T-033
title: 2026-09-28 起谁做什么，谁来审核
type: decide
status: closed
blocked_by: []
claimed_by:
supersedes: T-013
---

## Question

Claude Code 没有额度之后，规划、执行、审核和盲评由谁负责？

## Resolution

2026-09-28 负责人决定：Kiro 做整体规划与执行，并负责整合、提交和推送；执行可以分一部分给 Cursor 的两个 Grok agent。不同 harness 之间互相验收：Kiro 做的票由 Grok 审，Grok 做的票由 Kiro 审，同一个 harness 不审自己的票。前端页面的盲评交给 Codex（Astra）。Claude Code 不再安排工作。负责人仍只定方向和需求，不做盲评和审核。取代 T-013 的分工。
