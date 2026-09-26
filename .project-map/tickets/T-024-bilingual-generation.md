---
id: T-024
title: 中英文一起生成
type: build
status: open
blocked_by: []
claimed_by:
supersedes:
---

## What to build

按 T-009：生成和修改时，一条 operation 同时带中文和英文；英文缺口写 `To be provided`；只有默认英文的旧草稿视为未生成，发布页不提供 EN 切换，补齐后才提供。撤销时中英文一起撤销。

## Acceptance

- [ ] 用厚资料的模拟包生成后，发布页切到 EN，全部是这家公司的英文内容，没有默认英文
- [ ] 一次对话修改同时改中英文，撤销时一起恢复
- [ ] 只有默认英文的旧草稿，发布页没有 EN 切换
- [ ] 真实调用一次 DeepSeek 的端到端运行，产物放 `artifacts/`；如果模型连不上，报告一次后先交其余部分
- [ ] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [ ] 独立审核 agent（不是做这张票的 agent）验收通过，结论记在 Resolution

## Resolution
