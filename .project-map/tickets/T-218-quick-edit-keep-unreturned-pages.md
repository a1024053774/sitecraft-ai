---
id: T-218
title: 未点选快捷修改只交回当前页时补齐其他页面
type: build
status: closed
blocked_by: []
claimed_by: Devin
supersedes:
---

## What to build

未点选区块的快捷修改（如「精简文字」）带 `pageId`，写作提示要求「只修改当前页」，但工作流随后要求候选交回大纲中的全部页面，模型只交回当前页时报「模型未完成这些页面：…；没有保存版本」。2026-11-19 用 gpt-6.2-sol 实测「精简文字」连续两次因此失败。

改为：带 `pageId` 的整站写作，候选包含当前页（首页或内页）但缺少父版本的其他页面时，在整站格式校验前按父版本原样补齐缺失页面（保持父版本页面顺序）再进入同一提交入口。交回全部页面的候选原样提交，不代为还原页面顺序。修正轮在已补齐的候选上按片段替换，始终是完整站点。提交入口的页面范围检查不变。

不做：
- 不改局部批注、多区块批次、首次生成和整站修改的完整页面要求。
- 不改写作提示和提交入口的范围检查。

## Acceptance

- [x] 生产 chat 入口带 `pageId`、模型只交回当前页时存为新版本，其他页面与父版本相同
- [x] 原有 `pageId` 越界拒收用例（其他页 HTML、共享 CSS）仍拒收
- [x] 候选缺少当前页时仍按缺页拒收
- [x] 当前页为内页、模型只交回该内页时存为新版本，首页与父版本相同
- [x] 模型交回全部页面但调换顺序时按越界拒收，不存版
- [x] `npm run typecheck` 通过，`tests/t152-scope-regressions.test.ts` 通过
- [x] spec 快捷按钮一节与代码一致

## Resolution

2026-11-19（大西洋时间），随本票提交，Linux 开发机。首个提交 `59f3c23` 经独立审查不通过（内页单页返回报「缺少首页」；完整候选调序被还原后存版），本节为修改后的结果。

- `lib/code-site.ts`：新增 `keepUnreturnedPages`。候选通过单页字段校验、页面 ID 不重复、含当前页且缺少父版本页面时，按父版本页面顺序补齐，多出的页面保留在末尾，交给提交入口拒收；其余情况（交回全部页面、缺少当前页、格式不符）原样返回。
- `lib/code-site-model.ts`：`writeSiteCode` 收到 `pageId` 和当前站点时，先补页再做 `codeSiteSchema` 整站校验，所以只交回内页不再报「缺少首页」。首次生成和整站修改不传 `pageId`，校验不变。
- `lib/code-site-workflow.ts`：只把 `run.pageId` 传给 `writeSiteCode`，不再在工作流里补页或重排。
- `tests/t152-scope-regressions.test.ts` 走生产 chat 入口：只交回首页时存为 v2、Products 与父版本相同；`pageId: 'products'` 只交回首页时报「模型未完成这些页面：Products」，不存版；`pageId: 'products'` 只交回 Products 时存为 v2、首页与父版本相同（修改前报「缺少首页」）；交回全部页面但调换顺序时报「修改越界」，不存版。
- 检查：`npm run typecheck` 通过；`npm test -- tests/t152-scope-regressions.test.ts` 12/12 通过（含原 A2 越界拒收两例）；`npm test -- tests/t210-check-resume.test.ts tests/t152-local-edits.test.ts` 通过。未跑全量和 build，按规则留给主线合并后验证。
- 真实模型：`59f3c23` 上用 gpt-6.2-sol 在首页点「精简文字」一次存为 v4，其他页面、页头页脚和 CSS 与 v3 相同。本次修改后没有再用真实模型重跑，内页的真实模型快捷修改未测。
