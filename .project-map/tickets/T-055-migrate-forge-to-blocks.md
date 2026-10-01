---
id: T-055
title: 「明亮产品」迁到区块库
type: build
status: closed
blocked_by: [T-054]
claimed_by: codex-build
supersedes:
---

## What to build

照 T-053 的做法，把「明亮产品」（现在是 `lib/template-adapters/overlays/forge.index.html`）迁到区块库：写 `lib/blocks/looks/` 下这个样子的 token 和默认变体，尽量复用已有区块；确实需要这个样子特有的排法时新加变体（写进清单，别的样子也能选）。页面效果不退步，站点样式（T-054）在这个样子上也成立。盲评通过后删掉旧 overlay 和只为它存在的代码。

执行：Codex。代码审查：Kiro 或 Grok（不是做这张票的 agent）。

另外：这个样子旧 overlay 的产品卡参数值过长时会溢出到隔壁格（注塑资料在 1440 下被 T-053 新加的 `check-published` 文字溢出检查判失败），迁移时按 T-053 的做法处理：值可以换行，只在 / + – 、 之后断开。

另外：T-053 给 `check-published` 加了邮箱换行检查（邮箱只能在 @ 处换行），对所有样子生效；这个样子旧 overlay 的站点在 375 下会因邮箱在 - 处换行而不通过，迁移时按 T-053 的做法处理。

## 实现决定（Claude，2026-09-30，依据 Kiro 的计划 `artifacts/kiro-t055-plan.md`）

三张迁移票（T-055/T-056/T-057）共用：
- 外观差异用 token 表达（样子 = token + 默认布局），不给每个样子写覆盖 CSS；新变体 CSS 只写一次。每一步都要保证工程工业默认页 66 张对照逐像素不变。
- 新样子不和旧 overlay 逐像素对照：比对文字、区块结构和截图，最后盲评。
- 新变体写进区块清单，满足资料条件时所有样子都能选。
- 合作方式带步号；常见问题和合作方式最多各 6 条（与 T-059 一致）。
- 串行：T-054 关闭后依次 T-055 → T-056 → T-057，执行 Codex，代码审查 Astra，盲评 gpt-6.1-sol。

## Acceptance

- [x] 三份模拟资料用这个样子生成，`check-published` 通过，1440 / 768 / 375 截图打开看过
- [x] 盲评（Codex gpt-6.1-sol，旧版与新版不标来源）：新版不差于旧版；和工程工业放在一起能看出是不同的样子
- [x] 测试先写、改动前先失败；`npm run typecheck`、`npm test`、`npm run build` 通过
- [x] 代码审查通过；Claude 验收；旧 overlay 已删除

## Resolution

- 实现：明亮产品使用区块库 look 与 token，补齐卡片行业/能力、步骤卡、展开 FAQ、面板询盘四类变体；站点样式三方向在明亮产品上各自使用 12 条白名单配方。卡片正文改为标题上、说明下；参数值在分隔符处断行；迁移旧 overlay 专属的两个 skip 测试已删除，浏览器关闭不再等待失联响应。
- 真实生成：工业、外贸、注塑三份资料各依次完成一次需求对齐与 DeepSeek 生成，结果均 applied；记录在 `artifacts/t055/t055-industrial-summary.json`、`t055-export-summary.json`、`t055-molding-summary.json`。
- 样式验收：三份资料 × 三个方向 × 375/768/1440 三档浏览器检查通过；新增浏览器断言覆盖明亮产品 768/375 单列产品卡与名称/数值行式指标；删除旧 overlay 后测试共 497/497、0 skip；`npm run typecheck`、`npm run build` 通过。
- 发布检查：删除旧 overlay 后三份真实草稿重新渲染，`check-published` 九档全部通过，报告在 `artifacts/t055/published-delete/report.json`。
- 工程工业 66 张默认页使用 `scripts/compare-engineering-default.mjs --old 472a304` 重新对照，删除旧 overlay 后 `artifacts/t055/default-compare-delete/report.json` 为 66 identical、0 unexpected。
- 盲评包：新版在 `artifacts/t055/blind/`，旧包移到 `artifacts/t055/blind-r1/`，对照表 `artifacts/t055/blind-key.json`；同一份草稿同时提供旧 overlay、新区块库版和独立命名的工程工业参照遮字图。
- 代码审查：Astra 首审 NO_GO（证据与覆盖），返工 44794ab 后复审 PASS（`artifacts/review-astra-t055.md`）。
- 盲评：gpt-6.1-sol 首轮旧版更好（窄屏两列、指标带过窄、分组留白），返工后复评（`artifacts/blind-t055-r2.md`）：c1 新版略好、c2 持平、c3 新版明显更好；遮字三家可分、与工程工业可分；无否决项。
- 删除旧 overlay：已删除 `lib/template-adapters/overlays/forge.index.html`、`FORGE_HOST_OVERLAY_PATH`/`forgeHostOverlayFile` 分支及只读取该 overlay 的测试；forge 预览继续直接由区块库页面提供，landwind/tailwind overlay 路径保留。
- T-055 遗留返工（随 T-056）：共享 `services.cards` 恢复步号并从 1 重新计数，空条目不占号；明亮产品合作方式区块作为预期变化，其余页面保持不变。失败/通过证据见 `artifacts/t056/red-step-numbers.txt`、`green-step-numbers.txt`。

Claude 验收关闭（2026-10-01）。
