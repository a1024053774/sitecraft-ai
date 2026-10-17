---
id: T-176
title: 测试不再把临时产物堆进 artifacts 和 /tmp
type: build
status: open
blocked_by: []
claimed_by:
supersedes:
---

## Why

2026-10-17 清理磁盘时发现：每轮全量测试在 `artifacts/t130/` 留下 `privacy-*`（每个约 45MB）、`api-fixture-*`、`cli-fixture-*` 各一个，已累积 96 轮共约 4.3GB；`artifacts/t167/test-run-*` 累积 375 个；审查与诊断留下的 `/tmp/sitecraft-*` 临时数据根 56 个。负责人这台机器磁盘与内存都紧，已两次因空间不足手动清理。属于优先级 3 的小修，不能挤占页面质量工作。

## What to build

1. `tests/t130-blind-privacy.test.ts:12`、`tests/t130-run-records.test.ts:82`、`tests/t130-eval-set.test.ts:70` 的临时目录改到本轮 SITECRAFT_DATA_ROOT 之下（T-167 入口已提供），或在 `test.after` 删除；若评估代码要求输出位于 `artifacts/` 才能做隐私检查，就按该要求只在失败时保留并在报告里给路径。
2. 全量入口只保留最近 5 个 `artifacts/t167/test-run-*`，更早的在新一轮开始前删除；失败轮的目录保留并在输出里写明。
3. AGENTS.md「Git」段缓存清理一句补上 `/tmp/sitecraft-*` 临时数据根：主控收尾时删除对应票的临时根。
4. 不改测试判断条件，不跳过任何用例。

## Acceptance

- [ ] 连跑两轮全量后 `artifacts/t130/` 无新增 `privacy-*`/`*-fixture-*`，`test-run-*` 不超过 5 个；人为制造一次失败，失败轮目录保留
- [ ] typecheck、test、build 通过；独立 sol 审查通过
