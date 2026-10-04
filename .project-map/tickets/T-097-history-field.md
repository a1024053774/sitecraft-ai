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
- [ ] 真实 DeepSeek：三份模拟资料各走一次生成，记录写入的条目（`artifacts/t097/`），没有编造年份或事件
- [ ] 三家 `check-published` 中英文三档通过；`npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收

## Resolution

2026-10-04，离线部分完成于提交 `6badbe2`，真实 DeepSeek 暂停（账户欠费，按要求不请求），票据保持 **INCOMPLETE**：

- `content.history` 使用稳定 `id`、四位整数 `year`、双语 `event`；`replace_history` / `update_history` / `remove_history` / 明确的 `reorder_history` 可撤销。年份和事件必须来自同一沿革分句，年份必须紧跟事件，不推算或补「至今」。
- 四个样子加入默认朴素沿革行区块、`sectionOrder` / `hiddenSections` / family-modules 声明和 marker ownership 守卫；缺条目隐藏，section/entity/grid/rows 变体不完整时不写 DOM 或 `applied`。
- `scripts/published-facts.mjs` 覆盖年份和事件；历史行 CSS 使用现有 token、可换行，供 T-089 行长/对比度硬门检查。
- 父提交红测保存在 `artifacts/t097/red-parent-history.txt`；修复后 `tests/history-field.test.ts` 5/5。相关声明/槽位测试、typecheck、build 和最终全量 `npm test` 695/695 通过（`artifacts/t097/npm-test-final.txt`、`typecheck-final.txt`、`build-final.txt`）。
- 真实三份资料生成、三站中英文发布检查和代码审查待负责人充值/后续验收，不在欠费期间尝试 API。
