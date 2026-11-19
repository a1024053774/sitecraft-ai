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

改为：带 `pageId` 的整站写作及其修正轮，候选包含当前页但缺少其他页面时，按父版本原样补齐缺失页面（保持父版本页面顺序）再进入同一提交入口。提交入口的页面范围检查不变。

不做：
- 不改局部批注、多区块批次、首次生成和整站修改的完整页面要求。
- 不改写作提示和提交入口的范围检查。

## Acceptance

- [x] 生产 chat 入口带 `pageId`、模型只交回当前页时存为新版本，其他页面与父版本相同
- [x] 原有 `pageId` 越界拒收用例（其他页 HTML、共享 CSS）仍拒收
- [x] 候选缺少当前页时仍按缺页拒收
- [x] `npm run typecheck` 通过，`tests/t152-scope-regressions.test.ts` 通过
- [x] spec 快捷按钮一节与代码一致

## Resolution

2026-11-19（大西洋时间），随本票提交，Linux 开发机。

- `lib/code-site-workflow.ts`：带 `pageId` 时，写作结果和每轮修正结果先经 `keepUnreturnedPages`：候选含当前页时，按父版本页面顺序补齐未交回的页面，多出的页面保留在末尾，交给提交入口拒收；候选缺少当前页时保持原样，仍按缺页拒收。
- `tests/t152-scope-regressions.test.ts` 新增用例，走生产 chat 入口：模型只交回首页时存为 v2，Products 页与父版本相同；随后对 `pageId: 'products'` 只交回首页时报「模型未完成这些页面：Products」，不存版。改动前该用例失败（「模型未完成这些页面：Products；没有保存版本」）。
- 检查：`npm run typecheck` 通过；`npm test -- tests/t152-scope-regressions.test.ts` 11/11 通过（含原 A2 越界拒收两例）；`npm test -- tests/t210-check-resume.test.ts tests/t152-local-edits.test.ts` 20/20 通过。未跑全量和 build，按规则留给主线合并后验证。
- 真实模型：只有改动前的 gpt-6.2-sol 失败记录，改动后没有用真实模型重跑。
