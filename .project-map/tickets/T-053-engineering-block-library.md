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

## Acceptance

- [ ] 三份模拟资料（P3I、P3E、注塑 molding）用工程工业生成，`node scripts/check-published.mjs` 通过，1440 / 768 / 375 截图打开看过
- [ ] 同一份资料下，模型选的变体组合能被 `set_block_variant` 改掉，撤销后恢复；不满足资料条件的变体被拒绝并有说明
- [ ] 旧 overlay 与新区块库版本交 Codex gpt-6.1-sol 盲评（不告诉哪版是新的）：新版不差于旧版，且两家公司的页面能看出差异
- [ ] 测试先写、改动前先失败；`npm run typecheck`、`npm test`、`npm run build` 通过
- [ ] Codex Astra 代码审查通过；Claude 验收；旧 overlay 已删除
