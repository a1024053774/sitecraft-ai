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

## Resolution

2026-10-03（纽约时间），sonnet-blocks。两个候选都过了 AI 味审查并进库，**代码审查（Astra）、合回主线后的主工作区 `check-published`、Claude 验收没做，对应验收项留空。**

| 候选 | 目录（`artifacts/blocks-pool/`） | 审查 | 进库提交 | 测试先失败 |
| --- | --- | --- | --- | --- |
| 左右条款（commercialTerms:side） | `commercial-terms-side/` | 第一轮 ACCEPT | `aa7d475` | 6/6，`red-block-commercial-terms-side.txt`（在 `71c5a6f` 上） |
| 条款带（commercialTerms:strip） | `commercial-terms-strip/` | 第一轮 REVISE（≤480 单列偶数格带边框、像交替卡片），修后第二轮 ACCEPT | `bf05c40` | 6/6，`red-block-commercial-terms-strip.txt`（在 `a395186` 上）；变异：去掉手机上重置每一格的规则（第一轮被拒的状态），测试在 375 抓到，`red-mutant-phone-cells.txt` |

- 第三个候选（独立条款表）没做：和默认条款行只差边框，会被判「只差一点」。
- 一条条款不显得像占位：条款带里整带只放这一条、值放大（约 32px、宽度限制 40em）；左右条款里左标题右一条、值约 22px。三家真实资料（注塑 4 条、工业只有「起订量 20 台」、外贸只有「交期 批量询盘后确认」）都逐张看过。
- 模型提示（`lib/ai-provider.ts`）：「商业条款：条款值多为整句话（带范围、周期、数量）或只有一条时用 side；条款值短、有 2–4 条时用 strip；否则 rows。」三个布局的规则不重叠（之前 side 写的是「只有一两条」，改成「只有一条」，免得和 strip 的 2–4 条冲突）。
- 预览桥只多了一行：把可见条款数写到容器的 `data-sitecraft-entry-count`（条款带按条数分列用；条款行和左右条款不读它）。

### 整个 T-080 的验证（在 blocks-pool，合并了 T-083 之后；自己的 dev server :3035，所有测试带 `SITECRAFT_BASE`）
- `npm run typecheck` 通过；`npm run build` 通过（`t080/build.txt`）。
- 全量 `npm test`：654 个里 653 通过，1 个失败是 `workspace motion is 150–300 ms …`（`tests/workspace-interaction.test.ts`，约 100 秒，工作台页首次编译慢，断言「1440: the progress lists its steps」没等到）；单独重跑 5/5 通过，判为负载造成的偶发，没有改超时也没有放宽检查（`t080/npm-test-full.txt`）。之前的 6 个快照资源测试这次没有再失败。
- `check-published`（`t080/check-published.log`）：三家商业条款站（工业 `b1577055`、外贸 `827de4c5`、注塑 `561a1113`，从主工作区复制进来）加它们各自切到条款带和左右条款的副本，共 9 个站 × 1440/768/375 = 27 行全部 ok（含英文页的规则）。
- 渲染扫描：两个候选各 27 行（9 案例 × 三档）溢出 0、重叠 0、资料事实缺失 0/0、重复目标 0/0（`scan.md`）。
