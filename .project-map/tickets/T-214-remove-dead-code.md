---
id: T-214
title: 删除无调用方的状态接口与死代码
type: build
status: closed
blocked_by: []
claimed_by: Claude
supersedes:
---

## What to build

2026-11-14 静态扫描时，在 `npm run typecheck` 之外又加了几项检查，命令是 `npx tsc --noEmit --incremental false --noUnusedLocals --noUnusedParameters --noFallthroughCasesInSwitch --noImplicitReturns --noImplicitOverride`，并按标识符统计了导出的使用情况。结果发现下面这些代码在运行时已经没人用：

- `GET /api/ai/status` 及只为它服务的 `getAIProviderStatus`：界面、脚本、测试都不调用。
- `lib/site-images.ts` 里的 `canonicalizeOwnedImageUrl`，以及只被它在运行时调用的 `isTemplateStockUrl`、`isOwnedSiteImageUrl`。这一组是给已退役的模板图准备的（T-105），目前只有 `tests/site-images.test.ts` 还在测它们。
- `lib/alignment.ts` 里的 `OTHER_OPTION_ID`、`MAX_ALIGNMENT_SUMMARY_CHARS`、`MAX_ALIGNMENT_ROUNDS`，以及从不递增的 `roundCount` 字段。
- `lib/annotations.ts` 里的 `AnnotationCapture`、`AnnotationCurrent`、`AnnotationComment` 三个类型。
- 未使用的局部变量和参数：运行时代码 5 处，分别在 `app/(workspace)/settings/page.tsx`、`components/app-sidebar.tsx`、`lib/code-site-fact-segments.ts`、`lib/code-site-model.ts`、`lib/code-site.ts`；测试与脚本另有 11 处。扫描时逐处看过，没有发现漏传参数的逻辑问题。

本票删除这些代码，保持现有行为不变。

注意事项：

- T-004 定下的「最多 3 轮」针对的是旧的问题卡。现行对齐是风格卡加大纲确认（spec 第 35 行），没有多轮问题。删除 `MAX_ALIGNMENT_ROUNDS` 和 `roundCount` 前，先确认没有代码读它们；如果判断 T-004 仍约束现行对齐，就停下来问负责人。
- 存量对齐记录里还有 `roundCount`。从 schema 里删掉这个字段前，先确认 schema 不是 strict 的，保证旧记录照常能读出来。

不做：

- 不删 `scripts/` 下只被票引用的一次性脚本。已关闭票的 Resolution 靠它们重新生成证据。
- 不处理 T-213 的两条接口。
- 不改 `tsconfig.json` 的检查选项。

## Acceptance

- [x] 上面列出的路由、函数、常量、字段和类型都已删除，对应的测试一并删除或改写
- [x] 用含旧 `roundCount` 字段的对齐记录做测试，记录照常读出；该测试在恢复删除前的 schema 后应失败
- [x] 用扫描时的严格 tsc 命令复查，删掉的这几类问题都是 0，剩余项在 Resolution 里逐条说明
- [x] `npm run typecheck` 和触及模块的定向测试通过；全量测试在合并后的主线上跑一次

## Resolution

2026-11-14，提交 835aee9f。

- 删除内容：
  - `app/api/ai/status/route.ts`。
  - `lib/alignment.ts` 中的 `OTHER_OPTION_ID`、`MAX_ALIGNMENT_SUMMARY_CHARS`、`MAX_ALIGNMENT_ROUNDS` 及 `roundCount` 字段（类型、schema、默认值三处）。
  - `lib/annotations.ts` 中的 AnnotationCapture、AnnotationCurrent、AnnotationComment 三个类型。
  - `lib/site-images.ts` 中的 `canonicalizeOwnedImageUrl`、`isTemplateStockUrl`、`isOwnedSiteImageUrl`，相应测试一并删除。
  - 各处未使用的局部变量和参数。`reviewedFactSourceSnapshot` 去掉了未用的 `site` 参数，`lib/code-site-store.ts` 中的 4 处调用已同步修改。
- 保留 `getAIProviderStatus`：扫描时说它只为 status 路由服务，这个判断有误，`/api/health` 也在用它。
- T-004：现行对齐只有风格卡加大纲确认，没有代码读取 `roundCount` 或 `MAX_ALIGNMENT_ROUNDS`（已用 `git grep` 核对），因此 T-004 的轮数限制不约束现行对齐。
- 旧记录兼容：对齐 schema 不是 strict 的。在 `tests/alignment.test.ts` 新增「a stored snapshot that still carries roundCount reads back without it」，验证带 `roundCount` 的旧快照照常读出且不带出该字段。该用例在 `z.strictObject` 变体和改前 schema（`roundCount` 被保留）下都会失败。
- 严格 tsc 复查（扫描时的命令）：未用局部变量和参数等本票处理的几类问题已为 0。剩余两条都是 TS7030 隐式返回，不属于死代码，未处理：
  - `scripts/run-tests.ts:30`
  - `tests/t140-code-icons.test.ts:28`
- 检查：`npm run typecheck` 通过，对齐与图片的定向测试通过。全量测试见 T-212：Windows 第二轮 1252/1252 通过。
- 审查：Codex gpt-6.1-sol 结论 PASS。
