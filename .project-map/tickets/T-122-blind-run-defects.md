---
id: T-122
title: 修 T-110 暴露的两个缺陷：参数标签看不见、短路径注塑规划截断
type: build
status: open
blocked_by: []
claimed_by: t122-build
supersedes:
---

## What to build

- bright / catalog / short-path 生成站里参数标签 `dt` 正文对比度约 1.0:1（发布检查已报，`artifacts/t110-run/published/*/report.json`），基本看不见。在区块 CSS / token 层修到 ≥ 4.5:1，不加豁免、不改门槛。
- short-path × 注塑资料在需求对齐规划阶段 HTTP 502 truncated（站点 `d0a855e5-7e2f-4288-8e72-2a7895a25150`，`artifacts/t110-run/`）。查清是规划输出超出预算还是提示过长，在根因层修，不加重试。

## Acceptance

- [ ] 两处各有行为测试，先在父提交上失败
- [ ] short-path × 注塑用真实 DeepSeek 重新走一次需求对齐 + 生成成功；三个样子的生成站发布检查不再报 `dt` 对比度
- [ ] `npm run typecheck`、`npm test`、`npm run build`、13 站 `check-published` 通过；代码审查通过；Claude 验收
