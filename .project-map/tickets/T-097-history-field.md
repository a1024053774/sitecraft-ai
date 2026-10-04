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
