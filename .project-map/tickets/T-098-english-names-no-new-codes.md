---
id: T-098
title: 英文设备名不引入中文里没有的代码和数字
type: build
status: open
blocked_by: []
claimed_by:
supersedes:
---

## What to build

T-081 真实运行里，注塑资料的「精密慢走丝线切割 6 台」「镜面电火花 8 台」「二次元影像测量仪」被事实核对拒绝：模型英文写成了 `EDM`（中文同句没有这个代码）和 `2D`（中文值里没有数字 2）。按 T-082 的机械规则这是正确的拒绝，结果是访客页少了 3 台设备。

在模型提示里写明：英文名称、规格只用中文原文里出现的数字和代码，不自行加缩写或数字，用完整英文词表达（如 wire-cut machine、mirror-finish spark machine、image measuring instrument）。核对规则不放宽。

## Acceptance

- [ ] 测试先写、改动前先失败（行为级）：提示里有这条规则；带 `EDM` / `2D` 的英文仍被拒绝（核对没有放宽）
- [ ] 真实 DeepSeek：注塑资料重新生成，`artifacts/t098/` 记录这 3 台是否落稿；没落稿就如实写原因
- [ ] 注塑站 `check-published` 中英文三档通过；`npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收
