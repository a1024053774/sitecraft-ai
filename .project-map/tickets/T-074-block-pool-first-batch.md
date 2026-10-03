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

## Resolution（进行中；每个候选审查后更新）

| 候选 | 目录（`artifacts/blocks-pool/`） | 结论 | 进库提交 |
| --- | --- | --- | --- |
| 合作方式「纵向流程」（services:vertical） | `services-vertical-process/` | ACCEPT（review-1） | `d081c3f`；测试先失败 6/6 见 `red-block-services-vertical.txt` |
| 首屏「目录封面」（hero:cover） | `hero-catalog-cover/` | ACCEPT（review-1） | `5a6d9e4`；测试先失败 7/7 见 `red-block-hero-cover.txt` |
| 认证「证书状态表」（certifications:table） | `certifications-status-table/` | ACCEPT（review-1） | `399a0da`；测试先失败 6/6 见 `red-block-certifications-table.txt` |

- 流水线改动（T-074 开头）：`scripts/render-block.mjs`（从 artifacts 挪出）、`tests/block-fragment-tokens.test.ts`（每个区块 CSS 的 var() 在四个样子上都要有值，28 处旧缺口是 forge 缺线条 token，只能少不能多）、`tests/fixtures/look-tokens.ts`。
- 跳过：加工能力「设备/工序清单表」。原因：票里的「正文有数量时成列、没有就不显示数量列」要判断正文是不是数量，那是猜内容；不猜的话它就是「名称 | 正文」两栏，和现有 `list`（名称列 + 正文列）只差表头和线条，属于「只差一点」。如果以后草稿有独立的数量字段再做。
- 跳过：应用行业「带说明的编号行业行」。原因：现有 `list` 已经是「名称列 + 说明列」的行，编号只是在名称前加一个数字；`cards` 是方块。加编号不改变结构，属于「只差一点」；行业条目也没有顺序含义，编号还会暗示先后。
- 进度：已进库三个（见表）。**停在这里的原因：5 小时额度接近上限，不是候选的问题。** 恢复点：
  - 下一个候选「常见问题两栏问答」（faq:columns）还没开始，代码和 `artifacts/blocks-pool/` 里都没有它的目录。开工前先在 `candidate.md` 写清差别：现有 `open`（展开问答）是问题在上、答案在下的整行堆叠，`side`（旁注问答）是左侧标题 + 右侧同样的上下堆叠；新布局把每一条做成左右两栏（左：问题，右：答案），整块更矮、问答能横向对照；窄屏回到上下。差别是单条内的版式，不是整块——审查可能判「只差一点」，判不过就按规则记原因后删。读 `content.faq` 六条槽位（同 accordion），无额外资料条件。
  - 流水线已就绪：`scripts/render-block.mjs --cases <json>`（real + 跨样子 + stress 案例的写法见 `artifacts/blocks-pool/*/cases.json`）、进库流程（红灯测试在临时 worktree 的 HEAD 上跑、模型提示加一句选用规则、同步 CONTEXT / mainline / spec、MAP Verified 另起一个文档 commit）。
  - 其他还可以考虑的候选（未评估）：产品「简介式目录行」、询盘布局。三家资料没有新字段可读，新字段类（MOQ / 交期 / 质检流程 / 沿革时间线）需要先写 spec。
  - 全量 `npm test` 还没统一跑（这一批进库后要跑一次，已知有 6 个与本票无关、在干净 `18a3538` 上也失败的快照资源测试）。
