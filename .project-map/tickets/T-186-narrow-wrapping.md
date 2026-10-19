---
id: T-186
title: 375 下时间、参数与标签碎折行
type: build
status: open
blocked_by: [T-190]
claimed_by:
supersedes:
---

## Why

T-180 company 盲评发现约 7 站在 375 宽度下出现碎折行：营业时间的起止值被拆开，「10:00—17:00」、开放日「周四」单独换到一行，减速机的长参数串多次折行，桌面页脚的邮箱也被断开。代表截图：

- restaurant/editorial：`artifacts/t180-r2/round2-selected/private/case-1/home-375.png`
- education/documentary：`artifacts/t180-r2/round1-full/private/case-12/home-375.png`
- industrial/documentary：`artifacts/t180-r2/round1-full/private/case-2/home-375.png`

2026-10-19 构思主控改排期：等 T-190 新资料基线出来，按固定口径确认 375 碎折行仍存在再做；不存在则关票并写明。

## What to build

1. **先查根因**：对照源码，看问题出在模型写的 CSS（栏宽、white-space、标签和值的排法），还是核心规范缺少相应约束。
2. **在根因层修**：可以是提示约束（时间区间、短标签、型号、邮箱不拆开；长参数串在窄屏改为上下排列等），也可以是确定性的系统样式。修法以不引入横向溢出为前提。
3. **只作质量反馈**：如果新增机械检查，只作为质量反馈，不拒收、不触发修正轮（与 T-160 一致）。
4. **证据**：在 T-184 之后的主线上，用 `--only` 跑代表组合，预算 `SITECRAFT_TOKEN_LIMIT=1000000`。375、768、1440 截图都要逐张打开看过，company 盲评交独立实例。

## Acceptance

- [ ] 根因写进 Resolution
- [ ] 代表组合 375 截图不再出现上述碎折行，同时无横向溢出；盲评如实记录
- [ ] typecheck、test、build 通过；独立 fast 审查通过
