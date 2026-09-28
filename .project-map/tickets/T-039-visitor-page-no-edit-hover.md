---
id: T-039
title: 访客页不带编辑器的悬停描边
type: build
status: open
blocked_by: []
claimed_by: grok-a
supersedes:
---

## What to build

发布页上，访客把鼠标移到任何文字上都会出现绿色描边，光标变手型（截图 `artifacts/kiro-acceptance-20260928/24-published-hover-outline-1440.png`）。来源是 `app/api/templates/[templateId]/preview/route.ts` 无条件注入 `[data-sitecraft-slot]{cursor:pointer}` 和 `:hover` 描边。

描边和手型只在工作台预览里出现；发布页和缩略图上没有。

## Acceptance

- [x] 发布页悬停在文字上没有描边，光标不是手型；工作台预览里点选落点照旧可用
- [x] `scripts/check-published.mjs` 加一条断言：访客页的 slot 元素悬停时没有描边、光标不是 pointer
- [ ] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [x] `node scripts/check-published.mjs --out artifacts/published-check/t039` 通过，截图打开看过
- [ ] 另一个 harness 的审核 agent 验收通过，结论记在 Resolution

## Resolution

2026-09-28 11:31（UTC-4）。描边和手型只在工作台 iframe 带 `editor=1` 时注入。新测试 `node --test --experimental-strip-types tests/visitor-editor-chrome.test.ts` 在改动前失败（共用注入仍含 `data-sitecraft-slot`），改完通过。`npm run typecheck` 通过。`npm run build` 通过。全量 `npm test` 在当前工作区是 244/260：失败的 16 项来自未提交的 `lib/site-document.ts`、`lib/template-adapters/preview-bridge.ts` 和 `tests/no-demo-products.test.ts`，本票没有改这些文件。`node scripts/check-published.mjs --out artifacts/published-check/t039` 9/9 通过（11:30）。看过 `overlay-p3i-thick-20260925-1440.png` 和 `375.png`，页上没有编辑描边。

实现提交：待写入 SHA。
