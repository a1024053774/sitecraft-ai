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
- 跳过：常见问题「两栏问答」（faq:columns）。原因：整块结构和现有两种差不多——`open`（展开问答）已经是一条一行的问答堆叠，`side`（旁注问答）已经是「左标题 + 右列表」的两栏；两栏问答只是把单条内的「问题在上、答案在下」改成「左右并排」，差别在单条内版式，属于「只差一点」。
- 评估后不做：询盘布局（现有左右布局、面板、联系条，再加只是排列组合）、产品「简介式目录行」（三家草稿的简介多是把前几项规格改写成一句话，加上现有「型号索引表」已去掉这种重复，再做一个展示简介的目录行价值低）。
- **第一批结论**：只读现有草稿字段能做出的、和现有布局有可见结构差别的新布局，到这里已经做完——进库 3 个（纵向流程、目录封面、证书状态表），跳过 4 个（设备清单表、应用行业编号行、两栏问答、简介式目录行/询盘新排法，原因见上）。没有候选被审查判 REVISE 或 REJECT（都是一次 ACCEPT）。要继续扩充布局池，下一步需要新草稿字段（MOQ / 交期 / 产能等商业条款、质检流程、沿革时间线、设备数量），先写 spec 再做，另开票。
- 批量验证（三个进库之后，提交 `bdf4f5c`）：`npm run typecheck` 通过；`npm run build` 通过（`t074/build-after-batch.txt`）；全量 `npm test`（带 dev server、CHROME_PATH）584 个里 578 通过，6 个失败与本票无关，和 T-073 记录的一样、在干净 `18a3538` 上也失败（模板快照资源，`t074/npm-test-full-after-batch.txt`）。
- 未做：Astra 代码审查、合回 `family-kit-assembly`、主工作区三家 `check-published` 中英文三档、Claude 验收（验收项留空）。
- 恢复点已不需要（候选做完）；若要继续只剩上面的「新字段 spec」。

### 合并后验证（713b5ee）发现并修复的问题
- 注塑专家站副本切到四个新布局后 `check-published` 中英文三档失败：资料事实缺失 31/117（英文 34/110），原因是「型号索引表」只显示前 3 项参数、不显示简介；另有 `span.sitecraft-index-sr`「询价」被判溢出。**根因在流水线，不只是这个布局**：候选评审（AI 味审查）只看外观，没有任何一步检查「资料里的每条事实都能在访客页上找到」，而 T-073 里「去掉简介」的取舍恰恰绕过了这条规则。
- 修复（提交 `98c15dc`）：每行名称下加折叠的「简介与全部参数（N 项）」，去掉 sr-only 文字、询价链接加 aria-label（细节见 `product-index-table/candidate.md` 文末「合并后修正」）。其他三个新布局用同一检查重渲，没有缺失。
- 流水线改动：①`tests/block-published-facts.test.ts`（用 `scripts/published-facts.mjs` + `visitor-readable-text.js`，新布局单独和一起挂载，中英文三档两个样子；在修复前的代码上先失败，`red-published-facts.txt`）；②`scripts/render-block.mjs` 的扫描现在会做同样的资料事实检查，并有 `--open-details` 把折叠区展开再截图再扫——以后候选在送审前就会暴露这类问题（修复前的代码上对 molding 报 31/34，与 check-published 一致，`red-render-block-facts.txt`）；③`scripts/published-facts.mjs` 里证书状态表和证书卡片一样预期显示说明。
- 给之后候选的规则：新布局不得藏资料事实——被隐藏、折叠、截断的字段，都要在访客能展开读到的地方出现；「去掉某个字段」的取舍必须先过 `render-block` 的事实检查。

