---
id: T-076
title: 每个修改目标只落一个节点：修「参数对比表」并把唯一性检查放进区块扫描
type: build
status: open
blocked_by: [T-074]
claimed_by: sonnet-blocks
supersedes:
---

## What to build

T-074 的型号索引表返工时发现：一个产品的 `products.<id>.specs` 目标挂在了多个节点上（每个参数格一个），违反 AGENTS.md「写入须唯一命中声明节点」。sonnet-blocks 报告现有的「参数对比表」（`products:compare`，T-053 起就有）每个参数格也挂着同一个 specs 目标，是同类问题（Astra 复审时核实）。

- 修「参数对比表」：每个目标只落一个节点，点击任一参数格仍选中这个产品的 specs 目标；不引入按序号或按参数名猜的第二条寻址路径。
- 把「每个 `data-sitecraft-slot` 值在页面上只出现一次」做成通用检查：加进 `scripts/render-block.mjs` 的扫描，和一条覆盖四个样子 × 全部布局的测试，以后任何布局重复挂目标都会在审查前暴露。检查只能加严。

## Acceptance

- [x] 测试先写、改动前先失败：参数对比表一个产品的 specs 目标命中数为 1；通用唯一性测试在当前代码上找出参数对比表的重复（见 Resolution）
- [x] 四个样子 × 全部布局都通过唯一性检查；`npm run typecheck`、`npm test`、`npm run build` 通过；`check-published` 三家中英文三档通过（`npm test` 的 6 个失败是已知的快照资源测试，见 Resolution；`check-published` 是在 blocks-pool 自己的 dev server 上跑的，合回主线后请在主工作区再跑一次）
- [ ] 代码审查通过；Claude 验收

## Resolution

2026-10-03，sonnet-blocks，提交 `debee4e`（blocks-pool，本地，未 push）。**代码审查、合回主线后的主工作区 `check-published`、Claude 验收没做，对应验收项留空。**

### 怎么修
- **参数对比表**：一个产品的参数分散在表的每一行里（列方向），没有一个祖先节点能装下它们，所以和型号索引表（行组）的办法不同：`products.<id>.specs` 只落在这个产品的**列头 `th`** 上（带唯一的 id），表格每个格子用标准的 `headers=` 指向列头，格子本身不再挂目标。点击格子时，预览桥的点击处理先照旧找最近的 `[data-sitecraft-slot]`，找不到再按 `td[headers]` 找列头——这是表格自带的关联，不是按序号或参数名猜；`headers` 同时让读屏软件能读出每个值属于哪个系列。
- 原来挂在系列卡片里「其他参数」折叠表上的第二个 `specs` 节点：没有一个祖先能同时装下卡片和表的列，所以把只有该系列有的参数**移到表格最后一行**「其他参数」（在该系列的列里折叠，用同一个列头），卡片只留类别、名称、简介、询价。没有共有参数、不画表时（资料条件本来就不允许）才回落到卡片里，且仍只有一个节点。
- **外观变化**（重渲前后对比 `artifacts/blocks-pool/t076-compare-before/`、`t076-compare-after/`，含展开态）：系列卡片变矮（少了「其他参数」折叠），表格多一行「其他参数」，每个系列列里一条折叠入口，展开后是名称/数值行。桌面三档、手机（每个值标出系列）都看过；其余布局不变。此票的外观变化很小，没有送 AI 味审查，请你定要不要。
- **通用唯一性检查**：规则是「同一个 `data-sitecraft-slot` 值只能出现在一个节点上，唯一例外是目录里在多个区块声明过的字段（公司名在导航和页脚，邮箱、电话在询盘和页脚），每个声明它的区块各一个；任何一个区块内部不能重复」。「例外」是从区块目录算出来的（某个目标被不止一个区块的槽位声明），不是手写白名单。`scripts/render-block.mjs` 的扫描对每个候选做这项检查（中英文，整页和每个区块各一遍），`tests/block-slot-uniqueness.test.ts` 对四个样子 × 每个区块的每个布局 × 中英文做同样的检查（共 400+ 种组合），并检查列头/`headers` 结构，以及在真实 Chrome 里点击对比表每个格子，收到的 `sitecraft:select` 都是该格所在产品的 `specs` 目标。

### 证据（`artifacts/blocks-pool/t076/`）
- 先失败：`red-slot-uniqueness.txt`——新测试在 `1bb5237` 的代码上跑，通用测试报 `products:compare repeats a target inside the block`，列头/last-row 两条结构测试失败（点击测试在旧代码上本来通过，是回归保护）。`red-render-block-slots.md`——render-block 在旧代码上对参数对比表的每个案例报 4/4（中/英）重复目标，新代码 0。
- `npm test` 607 个里 601 通过，6 个失败与本票无关、在干净 `18a3538` 上也失败（模板快照资源，`npm-test-full.txt`）；`npm run typecheck`、`npm run build` 通过（`build.txt`）。
- `check-published`（blocks-pool 的 dev server :3035，工业专家站（用对比表）、外贸、注塑，中英文三档）：全部 ok（`check-published.log`）。
- 重渲对比表 4 个案例（工业真实、换到 forge、换到 tailwind-landing、4 个产品的长值压力测试）× 三档 × 展开态：溢出 0、重叠 0、资料事实缺失 0/0、重复目标 0/0（`t076-compare-after/scan.md`）。

### 给之后的规则
- 新布局如果一个目标要分散在多个格子里，目标放在能装下它们的行组/列头上，格子用 `headers=` 指向；不要给每个格子挂同一个目标。
- 之前的 T-073/T-074 已经按这条改了索引表；目前整套布局（四个样子 × 全部区块布局）通过同一个检查。

