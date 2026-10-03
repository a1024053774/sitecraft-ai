---
id: T-101
title: 区块库正文段落守住 T-089 的行长上限
type: build
status: open
blocked_by: []
claimed_by: sonnet-blocks
supersedes:
---

## What to build

T-089 把发布页正文行长（中文约 40 字、英文约 75 字单行）升为硬门后，主线 `13ae686` 在主工作区对 12 个已有站点跑 `check-published`，36 行里 16 行失败（`artifacts/merge-13ae686/check-published/`）：

- 产品区块的正文段落（中文 13 行）：产品摘要里成串的参数句，例如「速比 i=4–100，额定输出扭矩 3200 N·m，机座号 F280，输入转速 ≤3000 r/min……」在 1440 / 768 下单行 41–52 字。涉及工业 `b1577055` 及其条款带 / 左右条款副本、外贸 `ca40d752`、注塑 `b9074a86` 等。
- 商业条款的条款值（英文 3 行）：注塑产能「About 180 mold sets per year; 42 molding machines (90–800 t), about 6 million molded parts per month」在 1440 下单行 78–85 字符。

这些是真实的排版缺陷：卡片或条款值在宽屏下没有行长上限。按区块逐个在 CSS 层给正文段落加行长上限（`max-inline-size` 之类，用 `--site-*` token 或固定的 ch/em 值），保持四个样子的观感；不改检查门槛、不把这些段落加进豁免、不截断文字、不改模型写的内容。T-089 豁免的参数表、按钮、型号、邮箱、导航不在本票。

## Acceptance

- [ ] 测试先写、改动前先失败（行为级）：在真实浏览器里，上面两类段落在 1440 / 768 / 375 的单行字数不超过上限（复用 `visitor-layout-scan.js` 的计量，不另写一套）
- [ ] 主工作区对同样 12 个站点重跑 `check-published` 中英文三档全部通过；改动的区块重渲后逐张看图，交 codex-taste 确认观感没有变差
- [ ] `npm run typecheck`、`npm test`（0 失败）、`npm run build` 通过；代码审查通过；Claude 验收
