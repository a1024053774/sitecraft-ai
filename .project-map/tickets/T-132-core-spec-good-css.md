---
id: T-132
title: 核心规范吸纳 good-css 的 CSS 原则，并用评估集成对比较
type: build
status: open
blocked_by: [T-130]
claimed_by:
supersedes:
---

## What to build

负责人 2026-10-08 要求把 good-css（https://good-css.com，Vojta Holik，MIT，revision 6d16d2fd27f4892e2aea4b5c5c2b016f45be7eef）吸纳进系统：写进我们自己的核心规范，生成时不让模型去读网站。调研见 gitignore 的 `artifacts/research-good-css/report.md` 与 `core-spec-draft.diff`（47 条提炼、18 条增量草稿）。

在 `skills/site-code-core/SKILL.md` 用自己的话加入精简后的增量（约 10–12 条，去掉与现有规范重复的焦点、溢出条目；以引导口吻写，不写成死规则）：长规格不截断、网格按可用空间减列、父级管间距、产品图 contain / 现场图有目的裁切、hover 只在精确指针下、角色化 CSS 变量与有上下限的 clamp、触控点击区、sticky 页头锚点留位等。MIT 版权与许可全文放 `skills/site-code-core/SOURCE.md`，不进每次加载的提示词；规范里只留一行来源说明。

## Acceptance

- [ ] 核心规范增量合入，SOURCE.md 记录来源、revision 与 MIT 全文；不复制原站示例代码
- [ ] 用 T-130 的同一命令在改动前后各跑一轮（基线可复用 T-130 首轮），成对盲评结论写进 Resolution：改动后不差于基线，并说明哪些组合变好或变差；底线检查拒收率不上升
- [ ] Astra 审查通过；typecheck、test、build 通过
