---
id: T-216
title: AGENTS.md 只留规则，测试机制移到 spec 或票
type: build
status: open
blocked_by: []
claimed_by: Claude
supersedes:
---

## What to build

负责人定过：AGENTS.md 只放规则，测试机制写进对应票的 Resolution 或 spec.md。2026-11-14 静态扫描时，AGENTS.md 有 46KB（164 行），其中不少段落在描述测试怎么做。例如 `tests/t162-*`、`tests/t179-*`、`tests/t187-*` 用什么方式拦截哪类回归，以及 T-167 测试入口的分池、锁和清理细节。

本票把这类测试机制描述移到 `docs/project/spec.md` 的对应节，或对应票的 Resolution，AGENTS.md 只保留行为约束和验收要求。

搬移时要守住三点：

- 每条规则的含义不变，只是换了位置。
- 移出去的内容都有去处，不丢信息。
- AGENTS.md 里保留指向新位置的链接。

不做：不改任何规则，不合并或删减规则，不顺手改写措辞。

## Acceptance

- [ ] AGENTS.md 只剩行为约束和验收要求，测试机制都移到 spec.md 或对应票，并留有指向链接
- [ ] Resolution 附搬移对照表：原段落 → 新位置；逐条确认原文都有去处、没有丢失内容
- [ ] 由没参与本票的审查实例核对：规则含义没有变化
- [ ] `project_map.py status` 不报 AGENTS.md、spec.md 过时

## Resolution

