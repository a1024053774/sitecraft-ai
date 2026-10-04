---
id: T-097
title: 沿革（年份 + 事件）：草稿字段到页面
type: build
status: open
blocked_by: [T-096]
claimed_by: field-build
supersedes:
---

## What to build

T-078 第二批。按 T-096 的同一模式做「沿革」：`content.history` 条目列表，每条有稳定 `id`、年份（四位整数）、事件 `{zh, en}`。年份是结构化数字，只取资料里同一句中紧挨事件的年份，不推算、不补「至今」。

- 只有注塑资料有（「沿革：2008 年 建厂……；2024 年 建成三坐标与影像测量室。」共 5 条）；工业、外贸没有时整块不出现。不从「关于我们」正文里猜年份，也不把成立年份算成经营年数写进别处。
- 事实核对、operation、撤销、`check-published`、默认朴素布局、文档同步，要求同 T-096。

布局由 sonnet-blocks 之后按流水线另做，不在本票。

## Acceptance

- [ ] 测试先写、改动前先失败（行为级）：年份只接受资料里的四位整数；资料没有沿革时区块不出现；条目按年份顺序
- [x] 真实 DeepSeek：三份模拟资料各走一次生成，记录写入的条目（`artifacts/t097/`），没有编造年份或事件
- [ ] 三家 `check-published` 中英文三档通过；`npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收

## Resolution

2026-10-04，离线部分完成于提交 `6badbe2`，真实 DeepSeek 暂停（账户欠费，按要求不请求），票据保持 **INCOMPLETE**：

- `content.history` 使用稳定 `id`、四位整数 `year`、双语 `event`；`replace_history` / `update_history` / `remove_history` / 明确的 `reorder_history` 可撤销。年份和事件必须来自同一沿革分句，年份必须紧跟事件，不推算或补「至今」。
- 四个样子加入默认朴素沿革行区块、`sectionOrder` / `hiddenSections` / family-modules 声明和 marker ownership 守卫；缺条目隐藏，section/entity/grid/rows 变体不完整时不写 DOM 或 `applied`。
- `scripts/published-facts.mjs` 覆盖年份和事件；历史行 CSS 使用现有 token、可换行，供 T-089 行长/对比度硬门检查。
- 父提交红测保存在 `artifacts/t097/red-parent-history.txt`；针对 Astra r1 的边界红测在已知坏提交 `6badbe2` 上保存为 `artifacts/t097/red-6badbe2-history-boundaries.txt`（倒序、资料外英文代码、事件内数字均为行为级失败）。修复提交为 `783e89c`：`groundHistory` 保存源片段序号并拒绝乱序，英文事件复用 `englishCommercialCodes` 同句核对，数字按精确年份移除。
- `783e89c` 上的最终证据均写入命令、UTC 时间和完整 SHA：沿革测试 9/9（2026-10-04 05:08:18，`artifacts/t097/history-final-783e89c.txt`）；`block-slot-uniqueness` 4/4（05:08:36，`block-slot-uniqueness-783e89c.txt`）；`npm run typecheck`（05:08:55，`typecheck-783e89c.txt`）；`npm run build`（05:09:13，`build-783e89c.txt`）。
- 全量第一次在 05:14:42 因 T-099 motion 测试 768 宽度偶发失败，原始结果保存在 `npm-test-783e89c.txt`，未计为通过；按负载降到 11.33 后于 05:21:25 重跑，同一命令 701/701 通过，证据为 `artifacts/t097/npm-test-783e89c-rerun-low-load.txt`。

2026-10-04，充值后在字段分支提交 `936749b524225d40870b337ea5ac86e5b657d912` 上完成真实需求对齐生成：

- 原始 DeepSeek 请求/响应按 call 保存于 [artifacts/t097/real-alignment-936749b524225d40870b337ea5ac86e5b657d912/](../../artifacts/t097/real-alignment-936749b524225d40870b337ea5ac86e5b657d912/)，汇总为 `summary.json`。工业 `t097-real-936749b-industrial` 和外贸 `t097-real-936749b-export` 的 `content.history` 均为 `[]`；注塑 `t097-real-936749b-molding` 为 5 条，年份与中文事件逐字对应资料：2008 建厂、2013 注塑车间投产、2017 开始承接出口订单、2021 新增恒温精密模具车间、2024 建成三坐标与影像测量室。
- 三站中英文三档命令和报告在 `artifacts/t097/real-published-936749b.log` 与 `real-published-936749b/report.json`。工业和外贸 6 个站点/语言/宽度组合全通过；注塑三档英文页共 14 项失败（正文行长超过 75 字符、卡片溢出或文本截断），未改代码或用重试掩盖，当前总验收仍 **INCOMPLETE**。
