---
id: T-046
title: 首屏标题不留孤字，手机上公司名不被截断
type: build
status: open
blocked_by: []
claimed_by: grok-a
supersedes:
---

## What to build

2026-09-28 Codex 盲评（`artifacts/blind-20260928/review-result.md`）：

- 首屏大标题末字单独一行：「重载减速机按图加工」的「工」、「不锈钢快换接头目录」的「录」，1440 和 375 都这样（S1、S3，灰底短路径）。
- 375 上页头公司名被截成省略号（S2、S4–S8，其他三个样子都有）。四个 overlay 的 `.sitecraft-brand-name` 都是 `nowrap + ellipsis`，灰底短路径还限了 `max-width:140px`。

可改范围：`lib/template-adapters/overlays/*.html`、`scripts/check-published.mjs`、对应测试。不改 `lib/template-adapters/preview-bridge.ts`、`lib/site-operations.ts`、`lib/ai-provider.ts`、`app/workspace/page.tsx`（Kiro 在改 T-045）。

## Acceptance

- [ ] 四个样子的首屏标题在 1440 / 768 / 375 下最后一行不少于 2 个字（用 `text-wrap: balance` 或等效办法）
- [ ] 375 下公司名完整显示（可以换行或缩小字号），不出现省略号，页头不溢出
- [ ] `check-published.mjs` 加断言：首屏标题最后一行不是孤字；页头公司名没有被截断
- [ ] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [ ] 盲评样本站点（`artifacts/blind-20260928/samples-*.json` 里的 8 个 id）跑 `check-published.mjs` 通过，截图打开看过
- [ ] 另一个 harness 的审核 agent 验收通过，结论记在 Resolution

## Resolution
