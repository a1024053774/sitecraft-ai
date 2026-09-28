---
id: T-046
title: 首屏标题不留孤字，手机上公司名不被截断
type: build
status: closed
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
- [x] 另一个 harness 的审核 agent 验收通过，结论记在 Resolution

## Resolution

2026-09-28 16:40（UTC-4）。四个 overlay 的页头公司名去掉 `ellipsis` / `nowrap`，可以换行。灰底短路径首屏标题加上 `text-wrap: balance`（另外三个样子原来就有）。窄屏上灰底短路径的「联系」和「菜单」不收缩、不换行，长公司名不再把这两个按钮挤成竖排。

红态（16:33，对 HEAD 的 overlay 和 `scripts/check-published.mjs`）：`node --test --experimental-strip-types tests/headline-orphans.test.ts` 失败，`forge.index.html still ellipsizes the brand name`，exit 1。

绿态：同一命令通过（16:33）。`npm run typecheck` 通过（16:33）。`npm test` 313/313 通过（16:34）。`npm run build` 通过（16:40）。

`node scripts/check-published.mjs --out artifacts/published-check/t046`，站点为 `samples-industrial.json` 与 `samples-export.json` 里的 8 个 id，24/24 通过（16:33–16:39，exit 0）。看过 1440/768/375：灰底短路径「重载减速机按图加工」分成「重载减速 / 机按图加工」，「不锈钢快换接头目录」分成「不锈钢快 / 换接头目录」；375 页头公司名完整，「联系」「菜单」横排。另外三个样子的公司名换行后是全称，没有省略号。

实现提交：本 commit。

2026-09-28 17:15（UTC-4）。Kiro 否决页头公司名：`brandClipped` 只比 `.sitecraft-brand-name` 自己的 scrollWidth。父级 flex 被挤扁时名字在盒子里换行，scrollWidth 不会更大，截断会被放过。检查改为同时看 scrollHeight，并逐字对照 `overflow` 为 hidden 或 clip 的祖先和视口。灰底短路径在 480px 以下把公司名限制在 7em 内换行，型号单独成行。

红态（17:05）：`node --test --experimental-strip-types tests/headline-orphans.test.ts` 失败，源码里没有 `scrollHeight > brand.clientHeight + 1`，exit 1。

绿态：同一命令通过。`npm test` 314/314、`npm run typecheck` 通过（17:07）。`npm run build` 通过（17:15）。

`node scripts/check-published.mjs --out artifacts/published-check/t046`，8 个盲评站点，24/24 通过（17:09–17:15，exit 0）。375 灰底短路径页头是「外高桥流体接头 / P3E」和「忻州重载减速机 / P3I」，没有省略号。

实现提交：本 commit。

跨 harness 审核：

独立审核：Kiro，2026-09-28 17:02，PASS（`3476328` 之后新跑）。Kiro 自己的探针（`artifacts/kiro-browse/hero-brand-probe.js`：逐字量首屏标题的行，另查公司名是否被截断、是否还是 nowrap+ellipsis、页头是否溢出）在 T-045 重新生成的 8 个站和原盲评里出孤字的两个站（`4f4e932b`、`bc281787`）上各跑 1440 / 768 / 375，共 30 次，0 处问题。截图：「重载减速 / 机按图加工」「不锈钢快 / 换接头目录」两行均衡（`artifacts/t046-review-kiro/hero-*-1440.png`）；375 上「外高桥流体接头 / P3E」完整换行，没有省略号，旁边的语言切换和菜单按钮不挤（`header-export-375.png`）。`npm test`、`npm run typecheck`、`npm run build` 通过。

独立审核（后续提交）：Kiro，2026-09-28 17:25，PASS（`89b7eb4` 之后新跑）。这次后续修改是 grok-a 自审时发现的漏检：公司名在被挤扁的页头里换行、结尾被父级裁掉时，旧的 `brandClipped` 看不出来，并不是 Kiro 否决的。Kiro 用 `hero-brand-probe.js` 在 8 个样本站上跑 375 和 768，共 16 次，0 处问题；`node --test --experimental-strip-types tests/headline-orphans.test.ts` 通过，`npm test` 314/314。第二轮 Codex 盲评里「R1、R5 的 375 公司名省略号」是 Codex 看小尺寸整页图时的误读：`R5-375.png` 原尺寸裁图里是「忻州重载减速机 / P3I」两行完整（`artifacts/t047-probe-R5-header.png`）。

