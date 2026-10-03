---
id: T-095
title: 设备的区块布局（区块素材流水线）
type: build
status: open
blocked_by: []
claimed_by: sonnet-blocks
supersedes:
---

## What to build

T-081 落地了 `content.equipment`（名称、数量可空、规格可空）和一个朴素的默认布局。按 T-073 的流水线为「设备」区块做 2–3 个布局：每个候选写 `candidate.md`（对哪类公司有用、读哪些字段、资料条件、和其他布局的结构差别、参考来源），用 `scripts/render-block.mjs` 渲染真实草稿（注塑 8 条：4 条带数量、1 条带规格、4 条检测设备无数量）和必要的压力 / 跨样子案例（全部无数量、只有 1–2 条、名称很长），扫描溢出、重叠、资料事实、重复目标，交 codex-taste 做 AI 味审查，ACCEPT 才进库。

方向参考：T-074 当时跳过的「设备清单表」（现在有了结构化数量）、按「生产 / 检测」分组、数量做主视觉的产能带。没有数量的条目不能显得残缺，也不能用占位数字补。

## Acceptance

- [ ] 每个候选都有候选目录和审查记录；进库的布局各有测试先失败的证据（父提交上行为级失败）
- [ ] 渲染扫描溢出 / 重叠 / 资料事实缺失 / 重复目标全为 0；worktree 补齐 vendor 后 `npm run typecheck`、`npm test`（0 失败）、`npm run build` 通过
- [ ] 代码审查通过；合回主线后注塑设备站 `check-published` 中英文三档通过；Claude 验收

## Resolution（进行中）

| 候选 | 目录（`artifacts/blocks-pool/`） | 结论 | 进库提交 |
| --- | --- | --- | --- |
| 数量带（equipment:band） | `equipment-quantity-band/` | 第一轮 ACCEPT | `92c5d85`；测试先失败 7/7 见 `red-block-equipment-band.txt` |
| 双栏清单（equipment:compact） | `equipment-compact-list/` | 第一轮 REVISE（≤3 条留空右列；按列灌被读成生产/检测分组） | 修改中，未进库 |

