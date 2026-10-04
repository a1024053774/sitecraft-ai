---
id: T-103
title: 真实注塑站英文页：常见问题行长、参数格溢出、页头公司名截断
type: build
status: closed
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

- [x] 测试先写、改动前先失败（行为级）：用该站真实草稿，在浏览器里断言常见问题回答单行不超上限、参数格不溢出不截断、375 页头公司名完整（复用 `visitor-layout-scan.js` 计量）
- [x] 注塑真实站 + 主线 12 站 `check-published` 中英文三档全部通过、逐行测量条数不少于基线；改动区块重渲后交审美审查确认观感没有变差
- [x] `npm run typecheck`、`npm test`（0 失败）、`npm run build` 通过；代码审查通过；Claude 验收

## Resolution

2026-10-04，基于合并主线 `7207ba97ed6dc1dd787b49945840569335bd42a8`（含 T-093 全部代码）完成 T-103；最终代码提交为 `b60f36085e4659d59006a2c97dcaee5ff4bf3f56`。FAQ 回答加 `33em` 正文行长上限并允许自然换行；产品参数 key 在窄屏允许 flex 收缩和规格值换行；导航页头对短公司名保持完整，对带 fit 标记的长公司名动态缩放并允许换行；新增无标点长中文品牌反例，保留 T-063 的可读字号底线。资料、模型内容、检查门槛和文字截断规则均未改。

- 红测：`artifacts/t103/red-7207ba97.log` 首行绑定已知坏父提交，真实注塑站 1440/768/375 复现原始 14 failures；`artifacts/t103/rework/red-unbroken-bound-f315883.log` 首行绑定旧候选，复现无标点长中文品牌溢出。两条红测均在断言处失败。
- 可复现测试：`tests/fixtures/t103-real-molding-draft.json` 和 `tests/fixtures/t103-real-molding-measurements.json` 已跟踪；`tests/t103-real-molding-layout.test.ts` 通过公开 API 创建站点并用 `replace_draft` 安装 fixture，再走真实发布页入口；逐项比较 zh/en、1440/768/375 的 `textContrast`、`bodyLineLength`、`lineLengthExemptions` 数量不低于父报告基线。`artifacts/t103/final/focused-b60f360.log`：8/8 PASS；`artifacts/t103/final/measurement-comparison-b60f360.log`：6 locale rows、0 regressions。
- 最终验证（每份首行均绑定完整 SHA、命令和 UTC）：`artifacts/t103/final/build-b60f360.log` PASS；`artifacts/t103/final/typecheck-b60f360.log` PASS；`artifacts/t103/final/npm-test-b60f360.log` 780/780 PASS、0 FAIL；`artifacts/t103/final/check-published-b60f360/run.log` 与 `report.json` 为主线 12 站 + 真实注塑站共 13 站 × 3 宽度、39 行、0 failures。
- 区块重渲：`artifacts/t103/final/render-faq-b60f360.log`、`render-products-b60f360.log`、`render-nav-b60f360.log` 首行均绑定最终 SHA；每个区块在 1440/768/375 均 0 overflow、0 overlap、0 missing facts。独立逻辑审核（Astra）对 `b60f360` PASS；独立盲评将匿名候选 A（最终页面）评为 PASS、可接受且首选，确认 FAQ 行长和参数值完整，6 张 1440/768/375 截图均加载完整。
