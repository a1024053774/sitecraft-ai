---
id: T-021
title: 第 1 轮卡片选样子和配色
type: build
status: open
blocked_by: [T-019, T-020]
claimed_by:
supersedes:
---

## What to build

需求对齐第 1 轮的卡片里有样子和配色两题：样子按行业标出「推荐」并附一句理由，其余样子也能选；配色题用「当前样子 + 该色彩集」的真实颜色显示色卡。选择结果写入设计意图，生成出的页面能看出所选样子和配色。

## Acceptance

- [ ] 工业类资料进来时，工程工业标为推荐并有理由；选其他样子也能生成
- [ ] 色卡显示的颜色就是生成页面使用的颜色
- [ ] 选不同的样子和配色，生成出的页面明显不同
- [ ] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [ ] 独立审核 agent（不是做这张票的 agent）验收通过，结论记在 Resolution

## Resolution
