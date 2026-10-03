---
id: T-089
title: 发布页硬门：正文对比度 4.5:1 和正文行长
type: build
status: open
blocked_by: [T-084, T-081]
claimed_by:
supersedes:
---

## What to build

依据 [R4 调研](../../docs/research/前端收藏调研-2026-10-03/R4-rules-skills-prompts.md) 第 B、6 节。T-081 合回主线后再从主线拉分支（两边都改 `scripts/check-published.mjs`）。

- **正文对比度**：`scripts/visitor-layout-scan.js` 按实际渲染的前景色和合成后的背景色计算；`scripts/check-published.mjs` 对普通正文低于 4.5:1 判失败，大号文字（≥ 24px，或 ≥ 18.66px 且粗体）按 3:1。图片背景上的文字算不出来时报「未测」，不算通过。站点样式提交前的检查（`lib/site-style-check.ts`）对正文也改用 4.5:1。
- **正文行长**：只对正文段落检查，中文约 20–40 字、英文约 45–75 字符一行，超出报失败；参数表、按钮、型号、邮箱、导航豁免并在报告里列出。
- 硬门升级后，现有三家基线站和已进库布局的站点必须通过；不过就是真实缺陷，修页面或 token，不放宽门槛。

## Acceptance

- [ ] 测试先写，并在父提交上能加载、在断言处失败：用固定 HTML 夹具覆盖正文 4.4:1 失败、4.6:1 通过、大字 3.2:1 通过、图片背景报未测、正文过长失败、参数表豁免
- [ ] 三家模拟资料 × 中英文 × 1440 / 768 / 375 跑 `check-published`，报告和截图存 `artifacts/published-check/t089-*`；发现的缺陷已在根因层修好
- [ ] `npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收

## Resolution
