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

- [ ] 沿革、质检流程各至少 2 个新布局进库；每个候选有目录、审查记录、父提交行为级红测
- [ ] 渲染扫描溢出 / 重叠 / 事实缺失 / 重复目标全为 0；12 站 + 真实注塑站 `check-published` 通过；全量、typecheck、build 通过
- [ ] 代码审查通过；Claude 验收
