---
id: T-035
title: 新草稿不带演示商品
type: build
status: open
blocked_by: []
claimed_by: kiro
supersedes:
---

## What to build

`POST /api/sites` 新建的草稿自带 FM-2401「高精度模块」、FM-2402「复合材料组件」、FM-2403「智能检测单元」。走需求对齐、不给资料时，这三件直接上了发布页，是成品否决项。CONTEXT「默认条目」：草稿里不放演示文案。

新草稿的商品为空；商品区整块都缺时按缺口规则隐藏，导航和页脚也不留指向它的入口。询盘入口不受影响。

## Acceptance

- [x] 新建站点的草稿 `products` 为空；四个样子的工作台预览和发布页都没有演示商品，也没有空的商品区或指向它的导航
- [x] 资料、表格或对话提供商品后，商品区正常出现
- [x] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [x] 1440 和 375 浏览器截图
- [ ] 另一个 harness 的审核 agent 验收通过，结论记在 Resolution

## Resolution

实现（Kiro）：`starterProducts` 改为空数组，新草稿不带商品。预览桥新增 `hideEmptyProductSection`：访客页和缩略图上没有可显示的商品（全部归档，或名称和简介都是缺口）时整块隐藏商品区；它在 `applySectionVisibility` 之后运行，草稿自己的 `hiddenSections` 不会把它重新打开。工作台预览保留「产品资料待补充。」提示。`syncHiddenNavigation` 对指向隐藏区块的链接额外写入 `display:none !important`，因为灰底短路径首屏的「看产品系列」按钮是 `display:flex`，只设 `hidden` 挡不住；只撤销自己设过的内联样式。原来依赖三件演示商品的测试改用 `tests/fixtures/draft-with-products.ts` 里的测试夹具。

红态（2026-09-28 11:1x，改动前）：`node --test --experimental-strip-types tests/no-demo-products.test.ts` 6 项里 5 项失败（新草稿有 FM-2401 等三件；四个样子的访客页商品区仍显示）。

绿态（2026-09-28 11:36）：同一命令 6/6 通过；`npm test` 265/265、`npm run typecheck`、`npm run build` 通过。

浏览器（Kiro 的 Chrome，dev server 3034）：用 `POST /api/sites` 按四个样子各建一个新站（id 记在 `artifacts/t035/sites.txt`），发布页 1440 / 375 都没有商品区、没有演示商品、没有指向隐藏区块的链接、没有横向溢出，截图 `artifacts/t035/published-*-{1440,375}.png`；工作台预览显示「产品资料待补充。」（`artifacts/t035/workspace-screwfast-1440.png`）。有商品的站点照常显示：`node scripts/check-published.mjs --out artifacts/published-check/t035-with-products bdfcba17-1b8b-429f-9c52-893edcd2a244 palette-sample-export-porcelain` 6 项 ok。

另：`/content` 页原来把这三件演示商品当「商品草稿」列出，现在显示 0 件和导入入口。
