---
id: T-074
title: 区块素材第一批：读现有字段的新布局
type: build
status: open
blocked_by: [T-073]
claimed_by: sonnet-blocks
supersedes:
---

## What to build

T-073 的流水线跑通后，按同一条线批量做读现有草稿字段的新布局。起始候选（每个都要说清对哪类公司有用、和已有布局差在哪）：

- 首屏：目录封面（右侧是产品系列索引，而不是参数块）；
- 合作方式：带编号和交付物说明的纵向流程；
- 加工能力：设备 / 工序清单表（正文里有数量时成列显示，没有就不显示数量列）；
- 认证：证书状态表（名称、状态、说明）；
- 常见问题：问题列 + 答案列的两栏问答；
- 应用行业：带说明的编号行业行；
- 其余由 sonnet-blocks 根据三家资料和 T-066 专家清单提出，先写 `candidate.md` 再做。

每个候选都过 T-073 的四步；只有 ACCEPT 的进库。一个区块的布局数不设上限，但每个都要和已有布局有可见的结构差别，审查判为「只差一点」的不收。

## Acceptance

- [ ] 每个候选都有候选目录和审查记录；ACCEPT / REVISE / REJECT 的数量和原因汇总在 Resolution
- [ ] 进库的布局各有测试先失败的证据；`npm run typecheck`、`npm test`、`npm run build` 通过
- [ ] Astra 代码审查通过；合回主线后三家 `check-published` 中英文三档通过；Claude 验收
