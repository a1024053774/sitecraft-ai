---
id: T-101
title: 区块库正文段落守住 T-089 的行长上限
type: build
status: closed
blocked_by: []
claimed_by: sonnet-blocks
supersedes:
---

## What to build

T-089 把发布页正文行长（中文约 40 字、英文约 75 字单行）升为硬门后，主线 `13ae686` 在主工作区对 12 个已有站点跑 `check-published`，36 行里 16 行失败（`artifacts/merge-13ae686/check-published/`）：

- 产品区块的正文段落（中文 13 行）：产品摘要里成串的参数句，例如「速比 i=4–100，额定输出扭矩 3200 N·m，机座号 F280，输入转速 ≤3000 r/min……」在 1440 / 768 下单行 41–52 字。涉及工业 `b1577055` 及其条款带 / 左右条款副本、外贸 `ca40d752`、注塑 `b9074a86` 等。
- 商业条款的条款值（英文 3 行）：注塑产能「About 180 mold sets per year; 42 molding machines (90–800 t), about 6 million molded parts per month」在 1440 下单行 78–85 字符。

这些是真实的排版缺陷：卡片或条款值在宽屏下没有行长上限。按区块逐个在 CSS 层给正文段落加行长上限（`max-inline-size` 之类，用 `--site-*` token 或固定的 ch/em 值），保持四个样子的观感；不改检查门槛、不把这些段落加进豁免、不截断文字、不改模型写的内容。T-089 豁免的参数表、按钮、型号、邮箱、导航不在本票。

## Acceptance

- [x] 测试先写、改动前先失败（行为级）：在真实浏览器里，上面两类段落在 1440 / 768 / 375 的单行字数不超过上限（复用 `visitor-layout-scan.js` 的计量，不另写一套）
- [x] （blocks-pool 的 dev server 上跑，合回主线后请在主工作区再跑一次）主工作区对同样 12 个站点重跑 `check-published` 中英文三档全部通过；改动的区块重渲后逐张看图，交 codex-taste 确认观感没有变差
- [x] `npm run typecheck`、`npm test`（0 失败）、`npm run build` 通过；代码审查通过；Claude 验收（代码审查和 Claude 验收没做，留空）

## Resolution

2026-10-03（纽约时间），sonnet-blocks，提交 `c4834d3`（CSS + 测试，blocks-pool，本地，未 push）。**代码审查（Astra）、合回主线后在主工作区重跑 12 站 `check-published`、Claude 验收没做，对应验收项留空。**

- **根因**：产品摘要（成串的参数句）和商业条款值在宽屏下没有行长上限。只改 CSS，不改门槛、不豁免、不截断、不改内容：产品摘要（卡片、目录行、对比表、索引表）`max-inline-size: 30em`，商业条款值 33em（em 单位，随各段自己的字号走），`text-wrap: pretty`。
- **审美审查两轮**（`artifacts/blocks-pool/t101/review-1.md`、`review-2.md`）：第一轮 REVISE——宽卡片摘要缩到 30em 后右侧大片留白；中文词被拆开（「密封材 / 料 FKM」「在十 / 万级洁净车间」）。修法：卡片自身宽度 ≥ 860px 时正文分两栏（左：类别、名称、参数格、全部参数、询价；右：30em 摘要），更窄的卡片仍单列；摘要用 `word-break: keep-all; overflow-wrap: anywhere`（只在标点和空格处断行，超长串仍折断不溢出）。没有给领域短语包节点（那要预览桥猜内容）。第二轮 ACCEPT。已知取舍：并排后摘要下方右侧仍有留白，断行点只在标点处。
- **测试先失败**：`tests/block-body-line-length.test.ts` 用 `scripts/visitor-layout-scan.js` 自己的 `bodyLineLength` 计量（不另写一套），产品 5 个布局 + 商业条款 3 个布局 × 两个样子 × 中英文 × 1440/768/375，用 12 站里失败的真实摘要和条款原文。在 `d3c8001` 上 53 行超限（中文最多 66>40，英文最多 124>75）；另一条测试检查宽卡片并排、窄卡片堆叠、中文短语不跨行、长串不溢出，在只有上限的第一轮状态下失败（`t101/red-pairing-and-wordbreak.txt`）。
- **验证**（命令都带 `SITECRAFT_BASE=http://127.0.0.1:3035`，自己的 dev server；负载规则：全量启动时 1 分钟负载 6.31，`check-published` 启动时 11.74）：
  - 全量 `npm test`：**704/704，0 失败**（`t101/npm-test-full.txt`）。
  - 12 站 `check-published` 中英文 1440/768/375：**36/36 全部 ok，行长失败 0 条，没有新失败**（站点 id 取自主工作区 `artifacts/merge-13ae686/check-published/report.json`，复制进 blocks-pool；`t101/check-published.log`）。
  - `typecheck`、`build` 通过（`t101/build.txt`）。
- 文档：`spec.md` 加了「正文行长」一条（上限、并排、断行规则），MAP 里 spec 的 Verified 改为 `c4834d3`。`mainline.md`、`CONTEXT.md` 不涉及。

### 合回主线与验收（Claude，2026-10-04 EDT）
- 审美两轮 REVISE → ACCEPT（`t101/review-1.md`、`review-2.md`）；Astra PASS（`artifacts/review-astra-t101.md`，并核对报告里行长实测 1924 条、对比度 8061 条，确认不是空扫描）。合并主线 `32a4ee9`。主工作区 3034 在 `32a4ee9`（含 T-089、T-091、T-095、T-101）验证：typecheck、build 通过，全量 705/705；12 个已有站点 `check-published` 中英文三档 36 行 0 失败，行长 / 对比度逐行实测条数与 T-101 分支运行完全一致（中文页行长共 839 条、对比度 4062 条，没有空计量），T-089 硬门暴露的 16 条行长失败已清零（`artifacts/merge-32a4ee9/`）。 Claude 验收关闭。
