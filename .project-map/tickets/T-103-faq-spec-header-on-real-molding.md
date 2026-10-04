---
id: T-103
title: 真实注塑站英文页：常见问题行长、参数格溢出、页头公司名截断
type: build
status: open
blocked_by: [T-093]
claimed_by: blocks-build
supersedes:
---

## What to build

T-097 用充值后的真实 DeepSeek 重新生成三站（`936749b`），注塑站英文页 `check-published` 三档共 14 项失败，都不在沿革区块（`sitecraft-ai-fields/artifacts/t097/real-published-936749b/report.json`）：

- **常见问题回答正文行长**：英文回答单行 78–125 字符（上限 75），1440 / 768 都有。T-101 只给产品摘要和条款值加了行长上限，常见问题回答段落没有。
- **产品参数格溢出 / 截断**（768、375）：`dd` 溢出卡片、被容器截断，例如「Two-shot machines 120–650 t」「PC+TPU/PP+TPE/ABS+PC」「≥90% (PMMA, 2 mm thick)」。
- **页头公司名**（375）：英文页页头显示中文公司名「宁海精密注塑模具P3T」且被截断（`header company name is truncated`、`span.sitecraft-brand-name` 溢出）。

按区块在 CSS 层修：常见问题回答段落加行长上限（同 T-101 做法，em / ch 或 `--site-*` token）；参数值允许在合适位置换行而不溢出、不截断（不改内容、不缩字号到不可读）；页头公司名在窄屏完整显示（换行或调整布局，不截断、不省略号）。不改检查门槛、不加豁免、不截断文字、不改模型写的内容。英文页显示中文公司名属于 T-082 记下的专有名词限制，不在本票改内容，只保证显示完整。

把这个真实注塑站加入主线回归站点集（`artifacts/handoff/mainline-12-sites.txt` 之外另列，验收时一起跑）。

## Acceptance

- [ ] 测试先写、改动前先失败（行为级）：用该站真实草稿，在浏览器里断言常见问题回答单行不超上限、参数格不溢出不截断、375 页头公司名完整（复用 `visitor-layout-scan.js` 计量）
- [ ] 注塑真实站 + 主线 12 站 `check-published` 中英文三档全部通过、逐行测量条数不少于基线；改动区块重渲后交审美审查确认观感没有变差
- [ ] `npm run typecheck`、`npm test`（0 失败）、`npm run build` 通过；代码审查通过；Claude 验收
