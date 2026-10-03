---
id: T-080
title: 商业条款的区块布局（区块素材流水线）
type: build
status: open
blocked_by: [T-079]
claimed_by: sonnet-blocks
supersedes:
---

## What to build

T-079 落地后，按 T-073 的流水线为「商业条款」区块做 2–3 个布局：每个候选写 `candidate.md`（对哪类公司有用、读哪些字段、资料条件、和其他布局的结构差别、参考来源），用 `scripts/render-block.mjs` 渲染三家真实草稿（注塑条款最多、工业只有 MOQ、外贸只有交期说明，资料少的情况必须看）和必要的压力 / 跨样子案例，扫描溢出、重叠、资料事实、重复目标，交 codex-taste 做 AI 味审查，ACCEPT 才进库。

方向参考：首屏下方的条款带、询盘区旁的成交条件栏、独立的条款表。只有一条条款时不能显得像占位。

## Acceptance

- [ ] 每个候选都有候选目录和审查记录；进库的布局各有测试先失败的证据（父提交上行为级失败）
- [ ] 渲染扫描溢出 / 重叠 / 资料事实缺失 / 重复目标全为 0；`npm run typecheck`、`npm test`、`npm run build` 通过
- [ ] 代码审查通过；合回主线后三家 `check-published` 中英文三档通过；Claude 验收
