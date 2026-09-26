---
id: T-025
title: 自定义品牌色
type: build
status: open
blocked_by: [T-020, T-022]
claimed_by:
supersedes:
---

## What to build

用户输入一个主色，或从上传的 Logo 里取色，由固定规则生成整套色板（不让模型写 CSS），并检查对比度；对比度不够时自动调整，并告诉用户做了调整。入口在工作台的「配色」按钮里。

## Acceptance

- [ ] 输入 3 种有代表性的颜色（很浅、很深、高饱和），生成的色板都通过对比度检查
- [ ] 从一张 Logo 取色得到的主色合理
- [ ] 应用后可以撤销
- [ ] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [ ] 独立审核 agent（不是做这张票的 agent）验收通过，结论记在 Resolution

## Resolution
