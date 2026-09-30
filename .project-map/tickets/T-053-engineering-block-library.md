---
id: T-053
title: 工程工业迁到区块库（区块库主线第一段）
type: build
status: open
blocked_by: []
claimed_by: kiro
supersedes:
---

## What to build

按 [spec.md §4「区块库、设计 token 与站点样式」](../../docs/project/spec.md) 建区块库，先把工程工业这个样子迁过去。决定见 [T-048](T-048-generation-direction-block-library-css.md)，素材与排法见 [T-051 调研](../../docs/research/区块素材与CSS校验调研-2026-09-29.md) §1–2。

- 建 `lib/blocks/`：区块 HTML 片段、`catalog.ts` 数据清单、`looks/engineering.ts`（token + 默认变体）。
- 把现有 `lib/template-adapters/overlays/screwfast.index.html` 的每一段拆成区块（导航、首屏、产品、应用行业、加工能力、流程、认证、常见问题、询盘、页脚），每种先一个变体，页面效果不退步。
- 首屏、产品族、参数表、询盘各再做一个变体（排法从 T-051 §1 选「无照片也成立」的那种）。
- 服务端按样子拼出整页骨架，走现有模板静态文件路由取代 screwfast overlay；预览桥先删掉未选中的变体，再照旧写槽位。
- 草稿加 `blockVariants`，新 operation `set_block_variant`（带 inverse、最少资料条件不满足时拒绝并说明）；模型的 operation 白名单和提示里加上它，让模型按资料选变体。
- 盲评通过后删除 `overlays/screwfast.index.html` 和只为它存在的代码，不留兼容层。

不做：站点样式（T-054）；其他三个样子（T-055–T-057）；新数据字段（沿革、交期起订等）。

## 实现决定（Claude，2026-09-29，依据 Kiro 的计划 `artifacts/kiro-t053-plan.md`）

- 参数表做成产品区块的 `compare` 变体，不单独成块。
- 变体原件放 `<template>`，预览桥挂上选中的、删掉其余实体；每个区块任何时刻只有一个实体。
- 已选变体因资料变化不再满足条件时，在同一批里自动改回默认：可撤销、有改动标记、摘要里说明原因，不静默退化渲染。
- 旧版对照用不提交的离线渲染脚本（放 `artifacts/`），同一份草稿分别用 618d4e7 的 overlay + 桥和新代码渲染，默认组合应逐像素一致。
- 模型每次操作上限 20 → 24、需求对齐方案上限 22 → 27，配测试。
- 常见问题槽位扩到 6 条不在本票（保持新旧对照只差排法），另开票。`sectionOrder` 排序不在本票。
- 用户看到的词：变体叫「布局」（首屏布局、产品布局、询盘布局），写进 CONTEXT.md。
- `data-sc-part` 本票只标注并测唯一，给 T-054 用。
- Kiro 在自己的提交里更新 spec §4、CONTEXT、mainline 和本票 Resolution；MAP 的 Verified 列由 Claude 改。
- 3034 dev server 归 Kiro 使用，其他 agent 这段时间不在 3034 上跑浏览器测试。

## Acceptance

- [ ] 三份模拟资料（P3I、P3E、注塑 molding）用工程工业生成，`node scripts/check-published.mjs` 通过，1440 / 768 / 375 截图打开看过
- [ ] 同一份资料下，模型选的变体组合能被 `set_block_variant` 改掉，撤销后恢复；不满足资料条件的变体被拒绝并有说明
- [ ] 旧 overlay 与新区块库版本交 Codex gpt-6.1-sol 盲评（不告诉哪版是新的）：新版不差于旧版，且两家公司的页面能看出差异
- [ ] 测试先写、改动前先失败；`npm run typecheck`、`npm test`、`npm run build` 通过
- [ ] Codex Astra 代码审查通过；Claude 验收；旧 overlay 已删除
