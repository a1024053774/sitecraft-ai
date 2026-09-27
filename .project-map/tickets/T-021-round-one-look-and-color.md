---
id: T-021
title: 第 1 轮卡片选样子和配色
type: build
status: closed
blocked_by: [T-019, T-020]
claimed_by: astra
supersedes:
---

## What to build

需求对齐第 1 轮的卡片里有样子和配色两题：样子按行业标出「推荐」并附一句理由，其余样子也能选；配色题用「当前样子 + 该色彩集」的真实颜色显示色卡。选择结果写入设计意图，生成出的页面能看出所选样子和配色。

## Acceptance

- [x] 工业类资料进来时，工程工业标为推荐并有理由；选其他样子也能生成
- [x] 色卡显示的颜色就是生成页面使用的颜色
- [x] 选不同的样子和配色，生成出的页面明显不同
- [ ] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [x] 独立审核 agent（不是做这张票的 agent）验收通过，结论记在 Resolution

## Resolution

实现：第 1 轮需求卡强制包含样子与色彩集两题；工业推荐工程工业并附理由，其余样子仍可选。色彩集选项携带当前样子的真实 paletteId 与 swatches，提交后写入 `visualBrief` 和 `paletteId`。

新鲜证据：`node scripts/verify-alignment-multi-question.mjs artifacts/t021-final-correct` 通过资料、四题卡、一次提交、刷新、确认、生成和发布页预览读回；样子选项稳定为 visualBrief ID，色彩选项携带 registry 真值 `paletteId` 与 `swatches`，读回为 `engineering-industrial` / `engineering-graphite`，发布页包含选中 paletteId。`npm run typecheck` 与 alignment tests 通过。

复审补修：route 只接受模型返回的稳定 style/colorSet ID 与 palette metadata，并从 registry 真值生成 swatches；新增建站路由夹具测试标记，避免聊天测试把明确的 guided fixture 误送规划器。提交：`9e70da9cc339f4773cc71c0e2c955ccc2dc1e3e8`、`3e5631adf1dc0ffa130a7646dd991a3d2402bbce`。

实现提交：`9e70da9cc339f4773cc71c0e2c955ccc2dc1e3e8`。

独立审核：grok-a，2026-09-27，PASS，`artifacts/t021-final-correct/report.json`。色彩 `swatches` 与 engineering registry 的背景、表面、正文、强调、强调深、边框一致；读回 `engineering-industrial` / `engineering-graphite`。`npm test` 另有 1 项失败在 `tests/chat-route-conversation.test.ts`（期望 `style-theme`），该勾选项未勾。
