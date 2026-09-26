---
id: T-013
title: 谁做什么，谁来审核
type: decide
status: closed
blocked_by: []
claimed_by:
supersedes:
---

## Question

前端交给谁？新加入的 agent 做什么？盲评和审核由谁负责？

## Resolution

负责人不做盲评，也不做任何审核，只定方向和需求。Claude 是主负责人，做所有视觉和界面工作（overlay、色板、工作台），并负责整合和提交。Codex 的 Astra 做不涉及界面的工程逻辑。Cursor 的两个 Grok 4.7 agent 做独立审核（盲评、代码审核、验收）和调研。审核必须由没参与这项工作的 agent 来做。

依据：2026-09-26 负责人回答（Q2 与审核归属）；角色细节写在 AGENTS.md「协作」。
