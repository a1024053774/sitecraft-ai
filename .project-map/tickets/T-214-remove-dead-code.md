---
id: T-214
title: 删除无调用方的状态接口与死代码
type: build
status: open
blocked_by: []
claimed_by:
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

- [ ] 上面列出的路由、函数、常量、字段和类型都已删除，对应的测试一并删除或改写
- [ ] 用含旧 `roundCount` 字段的对齐记录做测试，记录照常读出；该测试在恢复删除前的 schema 后应失败
- [ ] 用扫描时的严格 tsc 命令复查，删掉的这几类问题都是 0，剩余项在 Resolution 里逐条说明
- [ ] `npm run typecheck` 和触及模块的定向测试通过；全量测试在合并后的主线上跑一次

## Resolution

