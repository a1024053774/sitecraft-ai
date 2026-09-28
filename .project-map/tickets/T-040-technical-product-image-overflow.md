---
id: T-040
title: 灰底短路径的产品图不溢出卡片
type: build
status: open
blocked_by: [T-039]
claimed_by: grok-a
supersedes:
---

## What to build

灰底短路径样子（`tailwind-landing` overlay）的产品卡里，照片按原尺寸 960px 显示，卡片只有 582px，右边溢出 403px，第二张跑出屏幕；1440 和 375 都这样（`artifacts/kiro-acceptance-20260928/34-technical-products-overflow-1440.png`，样板站 `palette-sample-technical-graphite`）。`check-published.mjs` 对它报了 PASS。

另外 `check-published.mjs --submit` 在 1440 下的询盘失败截图是空白图（`artifacts/published-check/kiro-20260928/*-1440-inquiry-error.png`），不能当证据。

## Acceptance

- [ ] 灰底短路径产品图在卡片内按比例裁切，1440 / 768 / 375 都不溢出；另外三个样子不受影响
- [ ] `check-published.mjs` 加断言：访客页没有元素宽出视口或宽出所在卡片，横向不滚动
- [ ] `check-published.mjs --submit` 的询盘成功和失败截图在三个宽度下都拍到表单和提示
- [ ] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过
- [ ] 四个样子的样板站跑 `check-published.mjs` 通过，截图打开看过
- [ ] 另一个 harness 的审核 agent 验收通过，结论记在 Resolution

## Resolution
