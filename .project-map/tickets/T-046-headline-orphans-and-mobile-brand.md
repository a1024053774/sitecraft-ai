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

- [x] 四个样子的首屏标题在 1440 / 768 / 375 下最后一行不少于 2 个字（用 `text-wrap: balance` 或等效办法）
- [x] 375 下公司名完整显示（可以换行或缩小字号），不出现省略号，页头不溢出
- [x] `check-published.mjs` 加断言：首屏标题最后一行不是孤字；页头公司名没有被截断
- [x] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [x] 盲评样本站点（`artifacts/blind-20260928/samples-*.json` 里的 8 个 id）跑 `check-published.mjs` 通过，截图打开看过
- [ ] 另一个 harness 的审核 agent 验收通过，结论记在 Resolution

## Resolution

2026-09-28 16:40（UTC-4）。四个 overlay 的页头公司名去掉 `ellipsis` / `nowrap`，可以换行。灰底短路径首屏标题加上 `text-wrap: balance`（另外三个样子原来就有）。窄屏上灰底短路径的「联系」和「菜单」不收缩、不换行，长公司名不再把这两个按钮挤成竖排。

红态（16:33，对 HEAD 的 overlay 和 `scripts/check-published.mjs`）：`node --test --experimental-strip-types tests/headline-orphans.test.ts` 失败，`forge.index.html still ellipsizes the brand name`，exit 1。

绿态：同一命令通过（16:33）。`npm run typecheck` 通过（16:33）。`npm test` 313/313 通过（16:34）。`npm run build` 通过（16:40）。

`node scripts/check-published.mjs --out artifacts/published-check/t046`，站点为 `samples-industrial.json` 与 `samples-export.json` 里的 8 个 id，24/24 通过（16:33–16:39，exit 0）。看过 1440/768/375：灰底短路径「重载减速机按图加工」分成「重载减速 / 机按图加工」，「不锈钢快换接头目录」分成「不锈钢快 / 换接头目录」；375 页头公司名完整，「联系」「菜单」横排。另外三个样子的公司名换行后是全称，没有省略号。

实现提交：本 commit。

跨 harness 审核：
