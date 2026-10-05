---
id: T-108
title: 开源模板拆区块进池，先补沿革、质检流程等单一排法
type: build
status: open
blocked_by: [T-103]
claimed_by: blocks-build
supersedes:
---

## What to build

T-104 第 ③ 步。从 `vendor/open-source-templates/` 的 23 个模板里挑结构可借鉴的区块，按 T-073 流水线改写成 SiteCraft 区块布局候选（只借结构，样式用 `--site-*` token，不搬模板品牌、图片、文案），先补只有一种排法的区块：沿革、质检流程，再补其他布局少的区块。每个候选写 `candidate.md`（借自哪个模板哪段、许可、和现有布局的结构差别），渲染真实资料案例、扫描、过 AI 味审查后进库。

- 许可：只用代码许可清楚的模板；图片、字体、图标不随结构搬入。
- 可改范围：`lib/blocks/fragments/**`、`lib/blocks/catalog.ts`、相关测试、`scripts/render-block.mjs`。禁止改 `preview-bridge.ts`（需要桥改动时先停下报告）。

## Acceptance

- [x] 沿革、质检流程各至少 2 个新布局进库；每个候选有目录、审查记录、父提交行为级红测
- [x] 渲染扫描溢出 / 重叠 / 事实缺失 / 重复目标全为 0；12 站 + 真实注塑站 `check-published` 通过；全量、typecheck、build 通过
- [ ] 代码审查通过；Claude 验收

## Resolution

2026-10-05，主线先合并至 `0ab0322682fb256c17b546b4e292f1a06637f19f`。按 T-073 流水线进库四个候选：`history:timeline`（`4bc60aa`）、`qualityProcess:checklist`（`9be7d91`）、`history:alternating` 与 `qualityProcess:flow`（最终代码提交 `406ef63455d7d82bb48f9a91251e9ea02e0bb338`）。REVISE/REJECT 的 `history:milestones` 与 `qualityProcess:steps` 已删除，没有保留兼容变体；`preview-bridge.ts` 未修改。

- 父提交红测：`artifacts/t108/red-history-timeline-0ab.log`、`red-quality-checklist-0ab.log`、`red-history-alternating-9be7d91.log`、`red-quality-flow-9be7d91.log` 均在加入前断言失败。
- 模型提示和文档：`lib/ai-provider.ts` 增加沿革 `rows/timeline/alternating` 与质检 `rows/checklist/flow` 的互斥选用规则；`CONTEXT.md`、`docs/project/mainline.md`、`docs/project/spec.md` 已同步；MAP Verified 在最终提交后更新。
- 最终证据（首行绑定 `406ef63455d7d82bb48f9a91251e9ea02e0bb338`）：`artifacts/t108/final-build-406ef63.log`、`final-typecheck-406ef63.log`、`final-npm-test-406ef63.log`（799/799 PASS、0 FAIL）、`final-check-published-406ef63/run.log` 与 `report.json`（13 站 × 3 档，39 行、0 failures）。
- 候选目录与 review-1：`artifacts/t108/history-timeline/`、`history-alternating/`、`quality-checklist/`、`quality-flow/`；四个候选的重渲扫描均为 0 overflow、0 overlap、0 facts missing、0 slot repeats，裁切图已打开检查。AI 味审查为四个候选 ACCEPT。代码审查和 Claude 验收留给主控。
