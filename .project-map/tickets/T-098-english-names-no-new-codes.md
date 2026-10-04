---
id: T-098
title: 英文设备名不引入中文里没有的代码和数字
type: build
status: open
blocked_by: []
claimed_by: field-build
supersedes:
---

## What to build

T-081 真实运行里，注塑资料的「精密慢走丝线切割 6 台」「镜面电火花 8 台」「二次元影像测量仪」被事实核对拒绝：模型英文写成了 `EDM`（中文同句没有这个代码）和 `2D`（中文值里没有数字 2）。按 T-082 的机械规则这是正确的拒绝，结果是访客页少了 3 台设备。

在模型提示里写明：英文名称、规格只用中文原文里出现的数字和代码，不自行加缩写或数字，用完整英文词表达（如 wire-cut machine、mirror-finish spark machine、image measuring instrument）。核对规则不放宽。

## Acceptance

- [x] 测试先写、改动前先失败（行为级）：提示里有这条规则；带 `EDM` / `2D` 的英文仍被拒绝（核对没有放宽）
- [x] 真实 DeepSeek：注塑资料重新生成，`artifacts/t098/` 记录这 3 台是否落稿；没落稿就如实写原因
- [ ] 注塑站 `check-published` 中英文三档通过；`npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收

## Resolution

2026-10-04，提示与行为测试修复提交 `1efa14a`：

- `replace_equipment` 提示明确禁止英文名称/规格自行添加中文没有的缩写或数字，并给出慢走丝、电火花、二次元影像测量仪的完整英文表达。`tests/ai-provider-layouts.test.ts` 覆盖提示契约；`tests/equipment.test.ts` 覆盖完整词翻译通过、`EDM` / `2D` 继续拒绝。父实现红证据为 [artifacts/t098/red-parent-t098.txt](../../artifacts/t098/red-parent-t098.txt)，修复后相关测试 35/35（[artifacts/t098/t098-focused-pass.txt](../../artifacts/t098/t098-focused-pass.txt)）。
- 真实注塑 structured generation 在提交 `1efa14ad5dab9b21a5bf85b5478221fce3a4d167` 上 HTTP 200、首次 Schema 通过、没有 provider retry；原始请求/响应和汇总在 [artifacts/t098/real-molding-1efa14ad5dab9b21a5bf85b5478221fce3a4d167/](../../artifacts/t098/real-molding-1efa14ad5dab9b21a5bf85b5478221fce3a4d167/)。三台设备均落稿：慢走丝为 `Precision wire-cut machine`，电火花为 `Mirror spark machine`，二次元影像测量仪为 `Two-dimensional image measuring instrument`；没有新增代码或数字。
- 注塑站复查、typecheck/build/full test 和代码审查仍待后续验收；本票保持 **INCOMPLETE**，没有放宽核对规则。
- 后续验证在提交 `55929ad5ce66a9290668b3b99f847a1d1cc4e106` 上完成：`npm run build`、`npm run typecheck`、全量 `npm test` 772/772 均通过，证据在 `artifacts/t098/build-55929ad.txt`、`typecheck-55929ad.txt`、`npm-test-55929ad.txt`。
- 注塑站 `t097-real-936749b-molding` 的中英文三档检查命令与报告在 `artifacts/t098/published-check-55929ad.log` 和 `published-check-55929ad/report.json`。剩余失败全部是 T-103 已登记的英文常见问题正文行长、产品参数格溢出/截断、页头公司名截断；没有沿革或设备英文名规则失败，本票不修改这些区块。
