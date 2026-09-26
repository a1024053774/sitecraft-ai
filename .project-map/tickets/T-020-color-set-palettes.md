---
id: T-020
title: 6 套色彩集 × 4 个样子的色板
type: build
status: open
blocked_by: [T-018]
claimed_by:
supersedes:
---

## What to build

把现有 16 套按样子命名的色板归入 6 套色彩集，补齐缺的部分，共 24 套；每套检查对比度（正文和按钮白字都 ≥ 4.5:1），检查写成可以重跑的脚本。换色彩集走白名单 operation，可以撤销，不改版式和内容。工程工业族的色板在 T-018 定下新版式之后再调。

## Acceptance

- [ ] 4 个样子 × 6 套色彩集都有色板，对比度脚本全部通过
- [ ] 换色彩集后预览变色，版式和内容不变，撤销能恢复
- [ ] 每个样子挑 2 套色彩集截图（1440 / 375），交独立审核 agent 看是否协调
- [ ] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [ ] 独立审核 agent（不是做这张票的 agent）验收通过，结论记在 Resolution

## Resolution
