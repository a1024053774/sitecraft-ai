---
id: T-034
title: 需求对齐第 1 轮固定问样子和色彩集，新建站点默认开启
type: build
status: open
blocked_by: []
claimed_by: kiro
supersedes:
---

## What to build

2026-09-28 Kiro 浏览器实操发现：

- 第 1 轮卡片的配色题是模型自己编的配色（液压蓝白、石墨暖橙、深绿灰），不是 6 套色彩集。提交后生成的 `set_palette hydraulic-blue` 过不了会话快照校验，提示「会话历史没有写入」，刷新后读状态失败，确认按钮消失，整轮白答。
- 另一次第 1 轮卡片没有配色题。
- 新站点要不要进入需求对齐，靠 `lib/guided-flow.ts` 里的关键词（减速机、P3I、我们做……）；带「目标：」的资料直接生成，不问样子和配色。

按 spec §3.1 和 MAP：新建站点（还没生成过）默认开启需求对齐；第 1 轮包含样子和配色，样子在前；配色只从 6 套色彩集里选，按所选样子显示真实色块。

## Acceptance

- [x] 新建站点第一次发送（一句话或资料）进入需求对齐，第 1 轮卡片有样子题和色彩集题；色彩集选项只来自 6 套目录，模型给出目录外的配色时由服务端换成目录选项
- [x] 选样子和色彩集后提交、刷新、确认，草稿的 `visualBrief` 与 `paletteId` 和所选一致，过程中不出现「会话历史没有写入」
- [x] 已生成过的站点做普通修改时不重问完整需求
- [x] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [x] 375 和 1440 浏览器实操截图
- [ ] 另一个 harness 的审核 agent 验收通过，结论记在 Resolution

## Resolution

实现（Kiro）：

- 草稿快照新增 `hasGeneratedContent`（完整历史里有 `source: "ai"` 的修改）。工作台载入还没生成过的站点时默认打开需求对齐。
- 第 1 轮的样子题和配色题一律由服务端按目录生成（`styleQuestion` / `lookCardColorOptions`）。规划器只能推荐样子（沿用它的推荐项和理由），它给的配色题整题丢弃，其余问题排在后面，一张卡最多 4 题。还没生成过的站点即使规划器返回 `ready`，也先发样子和配色卡；已经答过样子和配色的会话不再重问。整张卡的提示改成「开始生成前，先确认下面几项。」
- 配色卡放 4 套色彩集（青花瓷、石墨工坊、工程暖橙、松石；每题 2–4 个选项），推荐项是所选样子的默认色彩集，另两套在「配色」按钮里。卡上色块跟着同一张卡里选的样子变；色块原来被 `.alignment-card span { display:block }` 压成 0×0，已补样式。
- `applyAlignmentAction` 只接受目录里的色板，未知色彩集保留原来的选择，会话快照不会再因为 `hydraulic-blue` 这类值校验失败。
- 确认的方案写入草稿后，这次完整访谈结束（`enabled: false`，答案保留），之后的普通修改走普通对话入口，直接应用。
- 实测时又发现两处根因：一是规划器输出上限 1800 token，4 题卡在 6 次里有 2 次被截断（`finish_reason=length`），即当天三次「需求对齐规划没有返回可用的问题卡」；二是按资料整站生成的双语操作被 6000 token 截断，两次都截断就报「模型服务暂时不可用」。改法：规划器上限改为 3000，并且不再让它写配色选项；结构化生成至少 8192 token（`.env.local` 配得更高时照用），每次请求 90 s，工作台刷新后的状态轮询放宽到 200 s；`.env.example` 同步为 8192。改后真实 DeepSeek 并行各 6 次和 3 次，全部成功，规划耗时从 9–26 s 降到 6–11 s。

红态（改动前）：13:47 起，`node --test --experimental-strip-types tests/alignment-look-card.test.ts tests/alignment-round-one-look-color.test.ts` 6 项全部失败，其中复现了 `colorSet:hydraulic-blue` 和写入 `hydraulic-blue`；13:20 `tests/structured-output-budget.test.ts` 的 token 与超时断言失败（实际 6000）；13:41 「确认后普通修改直接应用」一项失败（对齐仍开着）。规划器那条断言对照的是改动前 HEAD 的 `max_tokens: 1800` 和含 `swatches` 的提示词。

绿态（2026-09-28 13:45）：上述三个文件全部通过；`npm test` 283/283、`npm run typecheck`、`npm run build` 通过。

浏览器（Kiro 的 Chrome，dev server 3034，真实 DeepSeek）：

- 1440：从 `?template=landwind` 新建站点，加号菜单里「需求对齐」默认勾选。发送当天出错的那句「液压快换接头外贸 B2B…欧洲经销商」，卡片 4 题：样子（蓝白目录推荐）、配色（4 套目录色彩集，带色块）、语言、产品分类。选蓝白目录 + 石墨工坊提交，没有「会话历史没有写入」；刷新后确认按钮和 4 条答案都在；确认后草稿 `export-catalog` / `export-graphite` / landwind。截图 `artifacts/t034/card-1440.png`、`confirm-step-1440.png`、`generated-1440.png`、`card-swatches-1440.png`。
- 375：从 `?template=screwfast` 新建站点，提交模拟工业资料包（带「目标：」，原来会跳过对齐），底部抽屉逐题出现样子和配色（第 1 / 2 题、第 2 / 2 题）。选灰底短路径 + 松石，色块是灰底短路径的色板；确认后草稿 `technical-product` / `technical-turquoise`，商品只有直角减速机和行星减速机。截图 `artifacts/t034/drawer-q1-375.png`、`drawer-q2-375.png`、`drawer-confirm-375.png`、`generated-375.png`。
- 1440 新站点确认后，加号菜单的对齐自动关闭，面板显示「已应用已确认的方案，草稿 v3」；再发「把首屏标题改成：重载减速机，按图定制」，2.6 s 直接变成 v4，没有问题卡（`artifacts/t034/after-confirm-1440.png`、`after-plain-edit-1440.png`）。

截图里还能看到的问题属于别的票：中文页头「To be provided」（T-037），提示里的字段路径和「独立 HTML」（T-038），改动标记挡导航（T-041），深色主题文字太淡（T-043）。
