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

## Resolution

2026-10-04，基于合并主线 `7207ba97ed6dc1dd787b49945840569335bd42a8`（含 T-093 全部代码）完成 T-103。FAQ 回答加 `33em` 正文行长上限并允许自然换行；产品参数 key 在窄屏允许 flex 收缩和规格值换行；导航页头对短公司名保持单行完整，对带 fit 标记的超长公司名保留动态缩放和换行。没有改资料、模型内容、检查门槛或截断文本。

- 红测（改动前，已知坏父提交）：`artifacts/t103/red-7207ba97.log`，首行绑定父提交 SHA、UTC 和命令，真实注塑站 1440/768/375 共 14 项失败。
- 最终代码提交：`f3158834bdd3c98858f893d128665ed7e2fbb98e`，其后重新生成的证据首行均写完整 SHA、命令和 UTC：`artifacts/t103/build-f315883.log`（PASS）、`artifacts/t103/typecheck-f315883.log`（PASS）、`artifacts/t103/npm-test-f315883.log`（779/779 PASS、0 FAIL）、`artifacts/t103/focused-f315883.log`（T-103 真实站 3/3 PASS）。
- 真实注塑站 + 主线 12 站：`artifacts/t103/check-published-f315883/run.log` 与 `report.json`，13 站 × 3 宽度共 39 行、0 failures；报告逐行通过，真实注塑站的原始 14 failures 已由同一入口修复后复核。
- 区块重渲：`artifacts/t103/render-faq-final/`、`artifacts/t103/render-products-final/`、`artifacts/t103/render-nav-final/`，对应 `render-*-final.log` 首行均绑定最终 SHA；1440/768/375 均 0 overflow、0 overlap、0 missing facts。渲染图已准备给独立审美审核，执行者不宣布审美通过。
