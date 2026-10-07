---
id: T-124
title: 每家公司骨架不同：区块顺序、首屏结构、询盘位置、页脚按公司选
type: build
status: open
blocked_by: [T-123]
claimed_by:
supersedes:
---

## What to build

T-121 方向 2。T-110 换公司盲评 10/10 判同一模板：导航、区块顺序、首屏参数条、询盘表单、页脚在不同公司间完全一致，只换颜色。把 T-072 的按公司推荐从「样子 + 色彩集」扩大到骨架：

- 按行业与资料差异（产品数量、有无照片、有无设备 / 质检 / 沿革、外贸还是内销）选择区块顺序、首屏结构（已有 split / statement / cover 等）、询盘位置（页中 / 页底 / 侧栏）、页脚形式；同一样子下两家资料不同的公司应得到明显不同的骨架。
- 选择是确定性规则（同资料同结果），写进 `visualBrief` / 区块编排，模型只给理由，不写 HTML。

## Acceptance

- [ ] 测试先写、父提交失败：三份资料在同一样子下得到不同骨架，规则可解释
- [ ] 改动后独立审美审查；`npm run typecheck`、`npm test`、`npm run build`、13 站 `check-published` 通过；代码审查通过；Claude 验收
