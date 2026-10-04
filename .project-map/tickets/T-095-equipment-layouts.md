---
id: T-095
title: 设备的区块布局（区块素材流水线）
type: build
status: closed
blocked_by: []
claimed_by: sonnet-blocks
supersedes:
---

## What to build

T-081 落地了 `content.equipment`（名称、数量可空、规格可空）和一个朴素的默认布局。按 T-073 的流水线为「设备」区块做 2–3 个布局：每个候选写 `candidate.md`（对哪类公司有用、读哪些字段、资料条件、和其他布局的结构差别、参考来源），用 `scripts/render-block.mjs` 渲染真实草稿（注塑 8 条：4 条带数量、1 条带规格、4 条检测设备无数量）和必要的压力 / 跨样子案例（全部无数量、只有 1–2 条、名称很长），扫描溢出、重叠、资料事实、重复目标，交 codex-taste 做 AI 味审查，ACCEPT 才进库。

方向参考：T-074 当时跳过的「设备清单表」（现在有了结构化数量）、按「生产 / 检测」分组、数量做主视觉的产能带。没有数量的条目不能显得残缺，也不能用占位数字补。

## Acceptance

- [x] 每个候选都有候选目录和审查记录；进库的布局各有测试先失败的证据（父提交上行为级失败）
- [x] 渲染扫描溢出 / 重叠 / 资料事实缺失 / 重复目标全为 0；worktree 补齐 vendor 后 `npm run typecheck`、`npm test`（0 失败）、`npm run build` 通过
- [x] 代码审查通过；合回主线后注塑设备站 `check-published` 中英文三档通过；Claude 验收

## Resolution

2026-10-03（纽约时间），sonnet-blocks。两个候选都过了 AI 味审查并进库，**代码审查（Astra）、合回主线后的主工作区 `check-published`、Claude 验收没做，对应验收项留空。**

| 候选 | 目录（`artifacts/blocks-pool/`） | 审查 | 进库提交 | 测试先失败 |
| --- | --- | --- | --- | --- |
| 数量带（equipment:band） | `equipment-quantity-band/` | 第一轮 ACCEPT | `92c5d85` | 7/7，`red-block-equipment-band.txt` |
| 双栏清单（equipment:compact） | `equipment-compact-list/` | 第一轮 REVISE（≤3 条留空右列；按列灌被读成生产/检测分组），修后第二轮 ACCEPT | `9234eac` | 6/6，`red-block-equipment-compact.txt`（在 `e353195` 上） |

- 没有数量的条目不显得残缺、不补占位数字：数量带里按结构化的「数量是否为空」分组，没有数量的在「其他设备」下只列名称；双栏清单里没有数量的条目就是一行名称，且逐行横向填充，不制造资料里没有的「生产/检测」分组。
- 预览桥的改动：数量改成「标签 / 数字 / 单位」三个行内节点（默认清单的文字不变，仍是「数量：12 台」）、`render.equipment === "grouped"` 分组（只数量带用）、把条数写到容器的 `data-sitecraft-entry-count`（双栏清单按条数分单栏/双栏，默认清单不读）。
- 模型提示：「设备：有几样带数量的主力设备、其余只有名称（检测设备等）时用 band；设备 4 条以上、名称短、想紧凑列出时用 compact；否则 rows。」

### 整票验证（合并主线 `488a295` 之后，自己的 dev server :3035，所有测试带 `SITECRAFT_BASE`，同一时间只跑一个全量）
- `npm run typecheck` 通过；`npm run build` 通过（`t095/build.txt`）。
- 全量 `npm test`：**第一次**（启动时负载 10.75，运行中升到 19–26）679 个里 676 通过，3 个失败全是工作台浏览器测试：`workspace dark/light 1440 did not render`（`workspace-dark-contrast`）、`the action row sits above the chat box …`（`workspace-interaction`）、`undo message does not add an applied prefix`（`t075-prefix-behavior`，等「撤销」按钮超时）；日志 `t095/npm-test-full-run1.txt`。这三个只测工作台页面，与区块无关。**随后在负载 8 时单独重跑这三个文件，7/7 通过**（`t095/rerun-failed-workspace-tests.txt`）。**第二次**完整全量（启动负载 10.65，等负载降到 12 以下后开跑）：**679/679，0 失败**（`t095/npm-test-full.txt`）。没有改任何测试或超时，也没有把第一次的失败算作通过。
- `check-published`（`t095/check-published.log`）：注塑设备站 `b9074a86` 加它切到数量带、双栏清单的两个副本，3 个站 × 1440/768/375 = 9 行全部 ok（含英文页）。
- 渲染扫描：数量带 27 行、双栏清单 33 行，溢出 0、重叠 0、资料事实缺失 0/0、重复目标 0/0。

### Astra 代码审查 NO_GO 后的返工（提交 `7c7ec3c`）
- P1：`renderEquipment` 对无数量条目在除分组布局以外的所有布局都追加一个空 `span`，双栏清单只靠 `span:empty{display:none}` 藏它，违反「没有数量节点、也不补占位」。根因层修：只有默认「设备清单」（`variant === "rows"`，它的三列网格需要这格）才创建这个空格，双栏清单和数量带不再创建任何占位节点，`span:empty` 规则删掉。
- P2：双栏清单的测试只断言没有 `.sitecraft-equipment-quantity`，漏了直接子节点的空 span。新增断言：真实注塑、全无数量、有无交错三个案例里，每个无数量条目只含名称（和规格）、没有直接子 `span`；同时断言默认清单仍保留它的空数量格。先在 `c603224` 上跑，行为级失败（`equipment-compact-list/red-compact-empty-span.txt`：`cmm has no empty span standing in for the count`）。
- 外观没变：重渲双栏清单 33 行（溢出 0、重叠 0、事实缺失 0/0、重复目标 0/0），真实 molding 三档、无数量、交错、单条、3 条、24 条、forge 逐张对照之前的图，一致；默认清单 1440 图一致。
- 验证（负载规则：启动全量时 1 分钟负载 7.13）：`npm test` **680/680，0 失败**（`t095/npm-test-full-rework.txt`）；`check-published` 注塑设备站 `b9074a86` 及其数量带、双栏清单副本，3 站 × 三档 = 9 行 ok（`t095/check-published-rework.log`）；`typecheck`、`build` 通过（`t095/build-rework.txt`）。

### Astra 复审（r2）NO_GO 后的返工（提交 `2e32733`）
- P1：`renderEquipment` 只要页面有 `[data-sitecraft-equipment-grid]` 就渲染，即使没有 `data-sitecraft-section` 和 `data-sc-block` 实体，并把变体默认成 rows——孤立 marker 被猜成设备区块。**同一个模式从 T-079 起就在 `renderCommercialTerms` 里（T-081 照抄），这次一起修了。**
- 根因层修：新增 `declaredBlockVariant(block, sectionSelector, gridSelector)`：section 节点、`data-sc-block` 实体、grid 三者各自唯一存在，且实体的 `data-sc-variant` 是区块声明过的变体（catalog 规则：每个变体的根都带它）才渲染；否则直接返回，不写任何节点，也不报 applied。实体缺 `data-sc-variant` 或变体未声明一律不渲染，不再猜 rows；双栏清单里「保留空数量格」的判断直接用这个有效变体（`=== "rows"`）。
- P2：`tests/block-orphan-marker.test.ts`，设备和商业条款各 7 个：单独 grid、section+grid 没有实体、实体缺变体、实体变体未声明、重复 grid、重复实体都不被填充且不报该区块的 applied 目标（`<block>.visibility` 是 `adapter.sections` 声明的独立可见性机制，不算区块渲染，测试里单列说明），完整声明的实体仍被填充。先在 `aff1e6a` 上跑，14 个里 10 个行为级失败（`equipment-compact-list/red-orphan-marker.txt`：`the stray grid stays empty`）。
- 验证（启动全量时 1 分钟负载 9.22）：`npm test` **694/694，0 失败**（`t095/npm-test-full-rework2.txt`）；`check-published`：注塑设备站 `b9074a86` 及其数量带、双栏清单副本 + 商业条款三站 `b1577055`、`827de4c5`、`561a1113`，6 站 × 三档 = 18 行全部 ok（`t095/check-published-rework2.log`）；`typecheck`、`build` 通过（`t095/build-rework2.txt`）。

### 合回主线（Claude，2026-10-03 EDT）
- Astra 三轮：r1 NO_GO（双栏清单为无数量条目插空 span）、r2 NO_GO（只有 grid marker 的页面也被渲染并默认成 rows；同一模式 T-079 商业条款起就有）、r3 PASS（`artifacts/review-astra-t095-r3.md`：设备和商业条款都改为声明的 section + 唯一实体 + grid + 有效变体才渲染）。
- 已合并主线 `fb3f1e2`。**最后一项未完成**：T-089 行长硬门合入后，注塑设备站 `b9074a86` 在主线上仍有产品摘要（中文）和商业条款产能值（英文）的行长失败，不在设备区块，由 T-101 处理；T-101 合并后在主工作区重跑 `check-published` 通过再关闭本票。

### 关闭（Claude，2026-10-04 EDT）
- T-101 合入后，主工作区 3034 在 `32a4ee9`（含 T-089、T-091、T-095、T-101）验证：typecheck、build 通过，全量 705/705；12 个已有站点 `check-published` 中英文三档 36 行 0 失败，行长 / 对比度逐行实测条数与 T-101 分支运行完全一致（中文页行长共 839 条、对比度 4062 条，没有空计量），T-089 硬门暴露的 16 条行长失败已清零（`artifacts/merge-32a4ee9/`）。 注塑设备站 `b9074a86` 三档通过。Claude 验收关闭。
