---
id: T-060
title: 产品参数值中英双语
type: build
status: closed
blocked_by: [T-053, T-063]
claimed_by: codex-build
supersedes:
---

## What to build

产品参数的名称已经是 `{zh, en}`，参数值还是单一字符串。「底脚/法兰」「旋转式/机械手转移」这类带中文的值在英文页原样显示中文（T-053 第 2 步 Kiro 发现，旧卡片也一样）。把参数值改成可以带英文的双语字段：纯数字和单位的值（`8500 N·m`、`i=25–100`）两种语言相同，带中文的值由模型和中文一起写英文；旧草稿的单语值继续按原样读。英文页不再出现中文参数值。

## Acceptance

- [x] 三份模拟资料生成后，英文页的产品卡和参数对比表里没有中文参数值；数字单位类的值不重复存
- [x] 旧草稿照常打开；撤销能恢复参数值和 `englishReady`
- [x] 测试先写、改动前先失败；`npm run typecheck`、`npm test`、`npm run build` 通过；`check-published` 三档通过
- [x] 代码审查通过；Claude 验收

## Resolution

- 开工盘点：`git grep -n -E 'spec\.value|\.specs\b|specs\]|specs\)' -- lib app components scripts tests`，结果 `artifacts/t060/grep-spec-value-98f713b.txt`；旧实现失败证据 `artifacts/t060/red-step1-schema-normalize.txt`。
- 参数值实现提交：`118845c`（双语形状、规范化、englishReady/inverse）、`e44977c`（区块读取）、`d9d2079`（published facts 与中英文检查）、`70ca0b7`（提示和文档）。a5a6d72 及其标题 workaround 已由 `ff4fb1b` 回退，严格检查保持不变。
- 三份资料真实生成记录仍有效：`artifacts/t060/real-engineering-70ca0b7-summary.json`。工程 11 值（字符串 9、双语 2）、外贸 10 值（字符串 10、双语 0）、注塑 31 值（字符串 18、双语 13），均无错误双语值。两份草稿已通过 `commitOperations` 恢复模型原文标题，恢复记录为 `artifacts/t060/restore-title-export-e60e387.json`、`restore-title-molding-e60e387.json`。
- 首屏和页眉问题移交 T-063；T-060 当前不再引用手动缩短标题作为验收证据。T-063 的严格原文检查、最终发布检查和对照证据写在 T-063 Resolution。
- T-060 的最终参数与页面证据由 T-063 最终提交 `a50d582` 重新生成：`artifacts/t063/published-final-a50d582/` 为三份原始标题草稿中英文三档严格检查，`artifacts/t063/full-final-a50d582.log` 为 523/523 全量通过，`typecheck-final-a50d582.log` 与 `build-final-a50d582.log` 均通过。工程工业 66 张、明亮产品/蓝白目录/灰底短路径 9 张对照分别见 `artifacts/t063/engineering-final-a50d582/`、`forge-final-a50d582/`、`landwind-final-a50d582/`、`tailwind-final-a50d582/`；参数值相关的注塑首屏/产品区域差异已在工程工业报告中标出，其余对照逐像素一致。

- 代码审查：Astra PASS（候选 `d7aeb32`，`artifacts/review-astra-t060-t063.md`）。曾出现的检查放宽（`a5a6d72`、`dbe53ea`）和手动缩短标题已撤回/恢复，最终证据用模型原文标题。

Claude 验收关闭（2026-10-01）。
