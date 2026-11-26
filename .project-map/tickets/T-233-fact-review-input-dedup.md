---
id: T-233
title: 事实核对上游输入无损去重瘦身（保持本地 claimRef/Zod/出处回读契约不变）
type: build
status: closed
blocked_by: []
claimed_by: Antigravity
supersedes:
---

## What to build

在保证 [AGENTS.md](../../AGENTS.md) 与 [spec.md](../../docs/project/spec.md) 中 `T-210`／`T-169` 全部硬约束（完整核对上下文保留给模型、`claim` 切分粒度不变、程序本地逐字回读与严格 `Zod`／协议拒收零放宽）完全不变的前提下，消除 `auditCodeFacts` 发送给上游模型的三处纯逐字冗余：

1. **上游剔除 `claimTexts`（保留本地与任务快照）**：
   - `codeFactAuditInput()` 与本地 `call.factInput.segments` 仍按既有规则计算并保存 `claimTexts`；
   - 新增无损传输组装函数 `codeFactWireInput(input)`，在上游请求载荷 `segments` 中省去模型完全不消费也不回传的 `claimTexts`（保留 `id`、`text`、`claims`、`groupId`、`pageId`、`headings`）。同步修正系统提示及活文档 `AGENTS.md`、`CONTEXT.md`、`docs/project/mainline.md`、`docs/project/spec.md` 表述。
2. **逐字相同的 `materials`／`sourceMaterials`／`sourceQuotes` 只保留一份原文**：
   - 当 `sourceMaterials[i].text` 与 `materials`（精确或 `.trim()`）逐字完全相同时，传输中省去重复 `text` 并标注 `sameAsMaterials: true`；当其出现于本来源 `sourceQuotes` 中（`q.sourceIndex === i && q.text === source.text.trim()`）时，省去重复 `text` 并标注 `fullQuoteId: q.id`。
   - 当 `sourceQuotes[j].text` 与 `materials`（精确或 `.trim()`）逐字完全相同时，省去重复 `text` 并标注 `sameAsMaterials: true`；当其与更早的 `sourceQuotes[k].text` 逐字完全相同时，省去重复 `text` 并标注 `sameTextAs: qPrev.id`。模型仍能通过 `materials` 或引用编号看到 100% 完整的资料原文；`auditCodeFacts` 本地仍使用完整 `input.sourceQuotes` 做 `quoteRef` 逐字回读与来源归属记录。
3. **验证与真实探针**：
   - 修改 `lib/code-site-model.ts` 前先在 [tests/t233-fact-input-slim.test.ts](../../tests/t233-fact-input-slim.test.ts) 跑出红灯日志（`artifacts/t233/red-slim.log`），覆盖「瘦身前后同一段 `claimRef` 原文集合 100% 一致」「传输层去重后完整原文零丢失」「本地 `Zod` 与 `T-210` 回读／拒收不变」；
   - 使用已生成的 `design/indexgrid`（`b8e3659b-fb5c-49a1-a158-a084a7c1d56a`，`v1` `1f462c88`）通过本地 `T-153` 预算网关跑一次真实 `openai-responses` 事实核对，对比瘦身前后输入／总 token 与核对结论（必须同为通过、0 issues；若结论不一致立即停下汇报）。

## Acceptance

- [x] 修改 `lib/code-site-model.ts` 前已在 `tests/t233-fact-input-slim.test.ts` 捕获红灯失败日志（`artifacts/t233/red-slim.log`）
- [x] `codeFactAuditInput()` 与 `call.factInput` 仍保留 `claimTexts` 与完整 `sourceQuotes` 快照，`claims` 切分粒度与每段允许 `claimRef` 原文集合与瘦身前 100% 一致（无重复 `claim.text`），上游传输省略 `claimTexts` 及逐字重复的 `materials`/`sourceMaterials`/`sourceQuotes` 副本且无原文缺失
- [x] 本地 `Zod` 校验与 `T-210` 逐字回读／协议拒收零放宽；`design/indexgrid` 真实核对探针核对结论与瘦身前一致（`passed=true`、0 issues）且输入用量显著下降（对比留存 `artifacts/t233/probe-indexgrid-comparison.json`）
- [x] `npm run typecheck`、全部相关事实核对与预算回归测试、`design_integrity.py`、活文档（`AGENTS.md`、`CONTEXT.md`、`docs/project/mainline.md`、`docs/project/spec.md`）同步及独立 Antigravity `claude-sonnet-4-6` 只读审查全部通过

## Resolution

- **修改摘要**：
  - 在 [lib/code-site-model.ts](../../lib/code-site-model.ts) 新增并导出 `codeFactWireInput(input)`，仅在发送上游模型时剥离各核对段未使用也禁止回传的 `claimTexts`，并将与 `materials`（精确或 `.trim()`）或同源 `sourceQuotes` 逐字相同的 `sourceMaterials`／`sourceQuotes` 副本替换为 `sameAsMaterials: true`、`fullQuoteId` 或 `sameTextAs` 引用，完整保留模型可见资料原文、`claims` 切分粒度、每段允许 `claimRef` 枚举与本地 `call.factInput` 快照；本地 `Zod` 校验、`T-210` 逐字回读及一次性协议拒收零放宽。
  - 在 [scripts/t153-real-budget.ts](../../scripts/t153-real-budget.ts) 允许 `t233`/`t234`/`t235` 作为 `T153_BUDGET_DIR` 目录，并同步更新 `AGENTS.md`、`CONTEXT.md`、`docs/project/mainline.md`、`docs/project/spec.md` 及测试夹具 [tests/fixtures/fact-audit-reply.ts](../../tests/fixtures/fact-audit-reply.ts)（`resolveWireQuoteText`）与相关测试。
- **验证证据**：
  - 修改前红灯：`artifacts/t233/red-slim.log`（`tests/t233-fact-input-slim.test.ts` 未改 `lib/code-site-model.ts` 前 2/2 失败，`RED_EXIT=1`）。
  - 离线校验：`npm run typecheck` 通过（`artifacts/t233/typecheck.log`）；`scripts/run-tests.ts` 运行 14 个事实核对与预算回归测试文件全部通过（非浏览器阶段 `13/13`，浏览器阶段 `74/74`，0 失败，`artifacts/t233/green-tests.log`）；`design_integrity.py --cwd . --format json` 无发现（`artifacts/t233/design-integrity.json`）。
  - 真实探针（`design/indexgrid`，`b8e3659b-fb5c-49a1-a158-a084a7c1d56a`，`v1` `1f462c88-faba-43b7-9c2c-a6ff16c64934`，`openai-responses` `gpt-6.2-sol`，预算账本 `artifacts/t233/probe-indexgrid-r2/budget/usage.json`，对比 `artifacts/t233/probe-indexgrid-comparison.json`；注：首轮 `75,000` 上限因 `reserveRequest` 保守 `inputUpper=107,464 + 4096` 在本地拦截并记 `HTTP 502` 留存于 `artifacts/t233/probe-indexgrid/budget/usage.json`，未发出上游请求；上调至 `160,000` 后一次完成）：
    - 瘦身前：`promptTokens=59,069`、`completionTokens=1,494`、`totalTokens=60,563`、`reasoningTokens=510`、`passed=true`、`issues=[]`。
    - 瘦身后：`promptTokens=53,028`（**-6,041 / -10.23%**）、`completionTokens=1,710`、`totalTokens=54,738`（**-5,825 / -9.62%**）、`reasoningTokens=516`、`passed=true`、`issues=[]`、`verdictConsistent=true`、`snapshotHasClaimTexts=true`、`snapshotClaimsCount=461 === preSnapshotClaimsCount=461`。
- **独立只读审查**：Antigravity `claude-sonnet-4-6`（`--mode plan`，会话 `7ae096dc-71a5-44da-a519-4093f8282c10`，`artifacts/t233/claude-review.txt`）结论 **PASS**（0 缺陷）。
