---
id: T-176
title: 测试不再把临时产物堆进 artifacts 和 /tmp
type: build
status: open
blocked_by: []
claimed_by: Codex
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

## Resolution

状态：INCOMPLETE，已实现，等待重任务许可；独立审查由主控另派。分支 `t176-test-litter`，父版本 `f178ab0`；实现、测试与本票随本提交保存。

- T-130 三个临时目录改入本轮 `SITECRAFT_DATA_ROOT/t130/`；评估代码允许该输出位置。入口在新一轮前仅清理当前工作树的有效 `artifacts/t167/test-run-*` 成功目录，失败或中断证据优先占五轮名额；这些证据本身占满五轮时保留全部并输出原因。清理拒绝目录符号链接，不碰站点数据和其他票的产物。
- 2026-10-17 09:32 UTC，在 `f178ab0` 的原入口上运行最终新回归：`CHROME_PATH=<AGENTS 指定路径> npm test -- tests/t176-test-output.test.ts`，退出 1，分别检出成功目录累积和符号链接边界未拒绝。红日志：`artifacts/t176/parent-final-regression-red.log`；标准入口红轮：`artifacts/t167/test-run-1792229559226-33947/`。运行后恢复候选入口，未改旧用例判断条件。
- 2026-10-17 09:31–09:34 UTC，分别经同一标准入口运行 `tests/t176-test-output.test.ts`（2 项）、`tests/t130-eval-set.test.ts`（7 项）、`tests/t130-blind-privacy.test.ts`（4 项）、`tests/t130-run-records.test.ts`（1 项），均通过。新回归用临时 health 服务替身注入失败，确认非零退出、失败目录及数据根路径输出、后续运行仍保留失败目录；不代表真实 Next 集成。T-130 定向检查无新增 artifacts 临时目录，清单：`artifacts/t176/t130-targeted-inventory.json`。
- `node --test --experimental-strip-types scripts/t167-runner-regressions.ts`：4 项通过；`npm run typecheck`、`git diff --check` 通过。首轮类型检查失败已修正，记录：`artifacts/t176/typecheck-first-failure.log`。`project_map.py status --root .`：Problems 0、Stale living docs 0。
- T-174 正占用重任务，等待主控回复「可以跑」后再串行执行两轮全量 `CHROME_PATH=<AGENTS 指定路径> npm test` 及 `npm run build`，每项前核对内存和全机重任务进程；结果追加到本 Resolution，再提交或 amend，不推送。无 UI 改动，不作审美结论；未调用真实模型或其他外部服务。
