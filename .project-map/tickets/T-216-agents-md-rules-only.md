---
id: T-216
title: AGENTS.md 只留规则，测试机制移到 spec 或票
type: build
status: closed
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

- [x] AGENTS.md 只剩行为约束和验收要求，测试机制都移到 spec.md 或对应票，并留有指向链接
- [x] Resolution 附搬移对照表：原段落 → 新位置；逐条确认原文都有去处、没有丢失内容
- [x] 由没参与本票的审查实例核对：规则含义没有变化
- [x] `project_map.py status` 不报 AGENTS.md、spec.md 过时

## Resolution

2026-11-14，提交 0c0d8d7c。AGENTS.md 由 46,582 字节减到约 39.5KB，正文不再点名测试文件。改前副本存在 gitignore 的 `artifacts/t216-AGENTS.before.md`。

搬移对照表：

| 原段落（AGENTS.md） | 新位置 |
| --- | --- |
| T-175 段末尾的测试说明（t175-stale-placeholder） | spec §6「回归测试入口·批注与工作台」 |
| t162-mobile-reveal、t162-scroll-edge 段 | 同上；AGENTS 保留规则句「定位留白只在工作台……」 |
| t179-composer-scroll 段 | 同上；AGENTS 保留「T-193 只改变工作台滚动条……」 |
| t162-review-regressions 及 counterfactual 段 | 同上；AGENTS 保留回退脚本须独占工作树串行运行的规则 |
| 「T-162 测试由标准 npm test 入口提供……」（替身、端口、临时服务） | spec §3 T-162 浏览器测试段（第 57 行起）及 §6 指针 |
| 「T-162 的 after 回调按请求隔离……」（预算、timings.json） | spec §3 同段及 §6；AGENTS 保留负载超时须保留改前结果、不扩大上限的规则 |
| t192-check-transitions 段 | spec §6「底线检查与修正范围」；AGENTS 保留 T-192 隔离检查规则句 |
| T-210 条末尾的测试入口 | spec §6「事实核对与局部写作」 |
| 局部修改条中的 t174-local-function 说明 | 同上 |
| t194-number-node-boundary 段 | spec §6「底线检查与修正范围」 |
| T-169 条末尾的测试说明 | spec §6 对应条目 |
| SITECRAFT_EVAL_STYLES 条中的 t159-task-admission | spec §6「风格、评估与预算」 |
| 英文版两条中的 t151 测试 | spec §6「英文版」 |
| T-187 条末尾的 t187 测试 | spec §6「底线检查与修正范围」 |
| 验收第 2 条中的 t160-narrow-columns | 同上 |
| 标准检查命令中的入口细节（数据根、分池、锁、清理） | README「检查」与 spec §3（T-167），AGENTS 保留命令本身和指针 |
| `scripts/t15*` 中的 t153-local-endpoints、预算网关中的 t165 测试 | spec §6「风格、评估与预算」 |
| T-166 中的 t166-check-origin | spec §6「检查浏览器与运行环境」 |

- 逐条对照了改前副本，原文都有去处，没有删改规则措辞。AGENTS 验收节新增链接，指向 spec 第 6 节「回归测试入口」。
- 首行标题 `# This is NOT the Next.js you know` 改为 `##`，与 next dev 生成器写入的格式一致，内容未变。
- 审查：Codex gpt-6.1-sol 没参与本票，对照改前副本核对，结论是规则含义没有变化，PASS。
- `project_map.py status`：AGENTS.md 与 spec.md 均未报过时（MAP 的 Verified 列已更新到 21aec51）。
