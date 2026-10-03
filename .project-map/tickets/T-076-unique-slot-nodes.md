---
id: T-076
title: 每个修改目标只落一个节点：修「参数对比表」并把唯一性检查放进区块扫描
type: build
status: open
blocked_by: [T-074]
claimed_by: sonnet-blocks
supersedes:
---

## What to build

T-074 的型号索引表返工时发现：一个产品的 `products.<id>.specs` 目标挂在了多个节点上（每个参数格一个），违反 AGENTS.md「写入须唯一命中声明节点」。sonnet-blocks 报告现有的「参数对比表」（`products:compare`，T-053 起就有）每个参数格也挂着同一个 specs 目标，是同类问题（Astra 复审时核实）。

- 修「参数对比表」：每个目标只落一个节点，点击任一参数格仍选中这个产品的 specs 目标；不引入按序号或按参数名猜的第二条寻址路径。
- 把「每个 `data-sitecraft-slot` 值在页面上只出现一次」做成通用检查：加进 `scripts/render-block.mjs` 的扫描，和一条覆盖四个样子 × 全部布局的测试，以后任何布局重复挂目标都会在审查前暴露。检查只能加严。

## Acceptance

- [ ] 测试先写、改动前先失败：参数对比表一个产品的 specs 目标命中数为 1；通用唯一性测试在当前代码上找出参数对比表的重复
- [ ] 四个样子 × 全部布局都通过唯一性检查；`npm run typecheck`、`npm test`、`npm run build` 通过；`check-published` 三家中英文三档通过
- [ ] 代码审查通过；Claude 验收
