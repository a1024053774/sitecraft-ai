---
id: T-057
title: 「灰底短路径」迁到区块库
type: build
status: open
blocked_by: [T-056]
claimed_by: codex-build
supersedes:
---

## What to build

照 T-053 的做法，把「灰底短路径」（现在是 `lib/template-adapters/overlays/tailwind-landing.index.html`）迁到区块库：写 `lib/blocks/looks/` 下这个样子的 token 和默认变体，尽量复用已有区块；确实需要这个样子特有的排法时新加变体（写进清单，别的样子也能选）。页面效果不退步，站点样式（T-054）在这个样子上也成立。盲评通过后删掉旧 overlay 和只为它存在的代码。

执行：Codex。代码审查：Kiro 或 Grok（不是做这张票的 agent）。

## 实现决定（Claude，2026-09-30，依据 Kiro 的计划 `artifacts/kiro-t057-plan.md`）

三张迁移票（T-055/T-056/T-057）共用：
- 外观差异用 token 表达（样子 = token + 默认布局），不给每个样子写覆盖 CSS；新变体 CSS 只写一次。每一步都要保证工程工业默认页 66 张对照逐像素不变。
- 新样子不和旧 overlay 逐像素对照：比对文字、区块结构和截图，最后盲评。
- 新变体写进区块清单，满足资料条件时所有样子都能选。
- 合作方式带步号；常见问题和合作方式最多各 6 条（与 T-059 一致）。
- 串行：T-054 关闭后依次 T-055 → T-056 → T-057，执行 Codex，代码审查 Astra，盲评 gpt-6.1-sol。

另外（Kiro 读代码发现）：旧 overlay 没有草稿时会显示演示文案和元话术；询盘状态选择器写坏，发送成功时也显示失败色。迁移后都应消失，验收时核对。

## Acceptance

- [ ] 三份模拟资料用这个样子生成，`check-published` 通过，1440 / 768 / 375 截图打开看过
- [ ] 盲评（Codex gpt-6.1-sol，旧版与新版不标来源）：新版不差于旧版；和工程工业放在一起能看出是不同的样子
- [ ] 测试先写、改动前先失败；`npm run typecheck`、`npm test`、`npm run build` 通过
- [ ] 代码审查通过；Claude 验收
- [x] 旧 overlay 已删除

## Resolution

- 第 4 步真实生成（提交 `309d953` 之后，DeepSeek 串行一次一个）：工程工业资料于 `2026-10-01T13:40:49Z` 开始、`13:42:34Z` 写入 `artifacts/t057/t057-industrial-summary.json`，结果 `applied`；外贸资料于 `13:42:40Z` 开始、`13:43:33Z` 写入 `artifacts/t057/t057-export-summary.json`，结果 `applied`；注塑资料于 `13:43:40Z` 开始、`13:44:35Z` 写入 `artifacts/t057/t057-molding-summary.json`，结果 `applied`。三份草稿的 `templateId` 均为 `tailwind-landing`。
- `check-published` 于 `2026-10-01T13:45:14Z`（提交 `309d953`）运行：
  `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node scripts/check-published.mjs --out artifacts/t057/published-real-309d953 907f94ea-4738-4859-aa80-9a5674ec184f ed29083e-d01f-4b93-adaf-8674d4690483 660cde13-a572-4eca-a0c4-cfab7f7e4fe9`
  共 9 个视口（3 站点 × 1440/768/375），`failures: []`，产物含 9 张截图和 `artifacts/t057/published-real-309d953/report.json`。
- 旧 overlay 与新区块库对照于 `2026-10-01T13:45:49Z`（提交 `309d953`）运行：
  `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell OUT=artifacts/t057/tailwind-old-new-facts-309d953 node --experimental-strip-types artifacts/t057/compare-tailwind-facts.mjs`
  从 `7d09e6e` 取旧 overlay、同一份三份草稿渲染新区块库，完成 9 组事实、区块顺序和显隐抽取；事实结果均非空、顺序均为 `nav > hero > products > industries > capabilities > services > contact > certifications > faq > footer`，`failures: []`。报告：`artifacts/t057/tailwind-old-new-facts-309d953/report.json`。
- 第 5 步盲评包于 `2026-10-01T13:52:39Z` 生成，基线为 `7d09e6e`，新区块库为提交 `309d953`；三家公司各有旧版/新版随机代号，1440/768/375 均有原图和 `-masked.png`，并附工程工业、明亮产品、蓝白目录三套参照图（同样有 `-masked.png`）。README 保留第 5 问并要求只看遮字版判断公司差异和“四个样子能否区分”。盲评包：`artifacts/t057/blind/`；对照表：`artifacts/t057/blind-key.json`；上一版包保留在 `artifacts/t057/blind-r1/`。
- 代码审查：
- 盲评：
- 删除旧 overlay：

### 返工（Astra 第三次复审与盲评后的候选）

- 失败证据先行：在 `367a60c` 前运行 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --test --experimental-strip-types tests/t057-rework.test.ts tests/published-facts.test.ts tests/site-style-scan.test.ts`，4 项按错误实现失败（硬编码首屏词、包裹后的词拆分漏报、无标记遮挡漏报、认证卡正文未进事实表），记录在 `artifacts/t057/rework-red-before-r2.log`。
- `367a60c`：首屏标题改为 `Intl.Segmenter("zh", { granularity: "word" })` 的词片段，片段 DOM 使用可在超长单词时强制断开的约束；`scripts/hero-word-break-scan.js`、`visitor-layout-scan.js` 和 `check-published` 使用同一按词出现配对的拆词判定；覆盖扫描检查所有可见元素和链接文字，闭合菜单内容排除；认证卡正文进入 expected facts，徽章不进入；短路径 375 参数值增加可收缩、可换行约束；补齐短路径三档、英文、缺口、无草稿、询盘状态和参数几何测试。
- `27cca5b`：补充闭合导航详情的遮挡回归，避免不可见菜单文字被误判。提交后专项回归 16/16 通过。
- 最终验证（提交 `27cca5b` 后）：`npm test` 504/504 通过、0 失败/0 跳过（日志 `artifacts/t057/full-r2-27cca5b.log`）；`npm run typecheck` 和 `npm run build` 通过（日志分别为 `artifacts/t057/typecheck-r2-27cca5b.log`、`artifacts/t057/build-r2-27cca5b.log`）。
- 三份灰底短路径草稿的 `check-published` 于 `2026-10-01 11:37:09 -0400`（提交 `27cca5b` 后）运行：3 站点 × 1440/768/375 共 9/9 通过，报告和截图在 `artifacts/t057/published-r2-27cca5b/`。
- 三套最终对照均在提交 `27cca5b` 后重新生成：工程工业 `artifacts/t057/engineering-27cca5b/report.json`（66 张，21 张完全一致；其余差异均为首屏词分段导致，注塑 1440 的下方内容只多 1px 的行高对齐误差）；明亮产品 `artifacts/t057/forge-27cca5b/report.json`（9 张中 3 张，仅首屏标题）；蓝白目录 `artifacts/t057/landwind-27cca5b/report.json`（9 张中 6 张，仅首屏标题）。逐张 before/after/diff 裁切和分类报告：`artifacts/t057/hero-segmenter-diffs/report.json`，接触表：`artifacts/t057/hero-segmenter-diffs/contact-sheet.png`；产物生成时间均晚于 `27cca5b`。

### 复审返工（Astra 复审，候选 `d9f2d8b`）

- 失败证据先行：在 `9fb4f99` 上运行新增的孤行、超长词、下层/透明层/`pointer-events:none` 遮挡和实际 look 类名命中测试，记录在 `artifacts/t057/rework-red-before-r3.log`；旧实现的孤行检查漏报、超长词误报、遮挡误判/漏报、参数规则命中数为 0 均被击中。
- `d9f2d8b`：共享标题扫描现在按同一次词出现返回 `heroOrphan` 与 `heroTitleWordBreak`，测量单词未换行自然宽度后才判断拆词；首屏词片段按自然宽度设为不可拆的行内块，超长词保留强制断开，尾部单字与前词合并避免孤行。`check-published` 与 `visitor-layout-scan` 使用同一结果。遮挡扫描按 `elementsFromPoint` 的真实层叠顺序判断，过滤透明/下层元素，并临时启用 `pointer-events:none` 候选做几何层序判断。参数规则改为实际 look class `sitecraft-look-technical-product`，并有计算样式断言。
- 最终全量（提交 `d9f2d8b` 后）：`npm test` 506/506、0 失败/0 跳过；`npm run typecheck`、`npm run build` 通过。日志：`artifacts/t057/full-r3-d9f2d8b.log`、`artifacts/t057/typecheck-r3-d9f2d8b.log`、`artifacts/t057/build-r3-d9f2d8b.log`。
- 三份灰底短路径草稿 `check-published` 于 `2026-10-01 12:19:58 -0400` 运行，9/9 通过；660cde13 三档 `heroOrphan: false`、`heroTitleWordBreak: false`。报告和新截图：`artifacts/t057/published-r3-d9f2d8b/`。
- 三套对照均在提交 `d9f2d8b` 后重新生成：工程工业 `artifacts/t057/engineering-d9f2d8b/report.json`（66 张中 33 张逐像素一致，其余差异均位于首屏标题；注塑 1440 的下方仅有由首屏高度变化带来的 1px 对齐差异）；明亮产品 `artifacts/t057/forge-d9f2d8b/report.json`（9/9 一致）；蓝白目录 `artifacts/t057/landwind-d9f2d8b/report.json`（9/9 一致）。报告时间分别为 12:21:43、12:22:11、12:23:30 -0400，均晚于提交。

### 再收窄返工（候选 `6fcd856`）

- 统一平衡换行的失败证据保留在 `artifacts/t057/engineering-d9f2d8b/`；新增浏览器回归锁定原本不孤行的工程标题“重载减速机”不能被拆开。实现改为先保留原始纯文本布局，只有灰底短路径标题检测到孤行或词内断行时才切分词片段并重排；其他样子不进入重排路径。
- 最终验证（提交 `6fcd856` 后）：`npm test` 507/507，0 失败/0 跳过；typecheck、build 通过。日志：`artifacts/t057/full-r5-6fcd856.log`、`artifacts/t057/typecheck-r5-6fcd856.log`、`artifacts/t057/build-r5-6fcd856.log`。
- 三份草稿 `check-published` 于 `2026-10-01 13:00:56 -0400` 运行，9/9 通过；660cde13 三档无孤行、无拆词，截图在 `artifacts/t057/published-r5-6fcd856/`。
- 三套对照均晚于 `6fcd856`：工程工业 `artifacts/t057/engineering-6fcd856/report.json` 为 66/66 逐像素一致；明亮产品 `artifacts/t057/forge-6fcd856/report.json` 为 9/9 一致；蓝白目录 `artifacts/t057/landwind-6fcd856/report.json` 为 9/9 一致。报告时间分别为 13:02:40、13:03:12、13:03:34 -0400。

### 第三次复审返工（候选 `57f897a`，最终修订 `2985b70`）

- 旧桥实际探针已完成：从 `d9f2d8b`、`6fcd856` 导出到 `artifacts/t057/old-bridge-scratch/`，运行日志 `artifacts/t057/red-old-bridges.log`。两份旧桥均击中新测试的声明 gating/非声明样子与短路径标题行为反例。
- `2985b70`：Segmenter 不可用时回退写入原始纯文本；短路径词 span 改为 `display:inline-block; max-width:100%; white-space:normal; word-break:keep-all; overflow-wrap:anywhere`，长英文/型号不再横向溢出；新增回归测试覆盖 fallback 与 375 长词。
- 最终验证（提交 `2985b70` 后）：`npm test` 510/510，0 失败/0 跳过；typecheck、build 通过。日志：`artifacts/t057/full-r7-2985b70.log`、`artifacts/t057/typecheck-r7-2985b70.log`、`artifacts/t057/build-r7-2985b70.log`。
- `check-published` 于 `2026-10-01 13:44:16 -0400`（独立 `CDP_PORT=9984`）运行，9/9 通过；报告和截图在 `artifacts/t057/published-r7-2985b70/`。
- 三套对照均晚于新提交：工程工业 `artifacts/t057/engineering-2985b70/report.json` 66/66 一致；明亮产品 `artifacts/t057/forge-2985b70/report.json` 9/9 一致；蓝白目录 `artifacts/t057/landwind-2985b70/report.json` 9/9 一致。报告时间分别为 13:45:49、13:46:08、13:46:30 -0400。

### 删除旧 overlay（最终步骤）

- 删除 `lib/template-adapters/overlays/tailwind-landing.index.html`，删空并移除 `Dockerfile` 的 overlay COPY；`lib/template-static.ts` 只保留 composed page 路径，不再有灰底 host overlay 常量或分支。
- 原 overlay 专属测试改为区块库拼页断言；`tests/engineering-page-without-snapshot.test.ts` 增加灰底 overlay 不存在、源码无引用断言。`git grep 'overlays/'` 只剩历史票 T-046/T-047/T-053/T-055/T-056/T-057。
- 最终提交 `2985b70` 后的全量/build/check-published/三套对照证据仍有效；删除本步只移除已不再读取的旧文件和路由分支，最终代码与文档一并提交。

### 删除步骤最终证据（代码提交 `1a2b0a3`，证据均在删除后生成）

- 删除 `lib/template-adapters/overlays/tailwind-landing.index.html` 和空的 `overlays/` 目录，移除 Dockerfile 的 COPY；`lib/template-static.ts` 只走 `composedPageForTemplate`。原 overlay 专属测试已改为区块库拼页断言，灰底短路径的源码无引用断言已加入 `tests/engineering-page-without-snapshot.test.ts`。
- 删除后 `git grep 'overlays/'` 只命中历史票 T-046、T-047、T-053、T-055、T-056、T-057；生产代码、Dockerfile、测试和 living docs 不再引用旧路径。
- 删除后全量测试（`2026-10-01 14:17:03 -0400`）512/512、0 失败/0 跳过；`npm run typecheck`（14:18:10）和 `npm run build`（14:18:35）均通过。日志：`artifacts/t057/full-delete-1a2b0a3.log`、`artifacts/t057/typecheck-delete-1a2b0a3.log`、`artifacts/t057/build-delete-1a2b0a3.log`。
- 删除后 `check-published`（14:19:18）三份真实草稿 9/9 通过，报告和截图在 `artifacts/t057/published-delete-1a2b0a3/`。
- 删除后对照均无非预期差异：工程工业用 `scripts/compare-engineering-default.mjs --old 7d09e6e`，66/66；明亮产品用 `scripts/compare-look-baseline.mjs --template forge --old 7d09e6e`，9/9；蓝白目录用同脚本 `--template landwind --old 7d09e6e`，9/9。报告分别为 `artifacts/t057/engineering-delete-1a2b0a3-rerun/`（14:22:35）、`artifacts/t057/forge-delete-1a2b0a3/`（14:23:00）、`artifacts/t057/landwind-delete-1a2b0a3/`（14:23:19）。
- 灰底短路径的删除前后区块库页逐像素对照用 `node artifacts/t057/compare-tailwind-composed-delete-1a2b0a3.mjs --template tailwind-landing --old 9cdfabd --out artifacts/t057/tailwind-composed-delete-1a2b0a3`（Chrome for Testing，14:27:56）完成，3 份草稿 × 3 档共 9/9、`different=0`；报告：`artifacts/t057/tailwind-composed-delete-1a2b0a3/report.json`。旧提交源码归档在 `artifacts/t057/source-archives/compare-delete-1a2b0a3/`。

### 短路径标题平衡收窄（候选 `9cdfabd`）

- 失败证据：`artifacts/t057/rework-red-before-r8.log` 在 `2985b70` 上复现 375 宽标题以「与」结尾；测试随后锁定 375/768/1440 三档不得以「与」结尾、不得孤行、不得拆词。
- `9cdfabd` 将 `--site-heading-text-wrap` 从 `pretty` 改回 `balance`，词 span 样式保持不变。
- 最终验证（提交 `9cdfabd` 后）：`npm test` 511/511，0 失败/0 跳过；typecheck、build 通过。日志：`artifacts/t057/full-r8-9cdfabd.log`、`artifacts/t057/typecheck-r8-9cdfabd.log`、`artifacts/t057/build-r8-9cdfabd.log`。
- `check-published` 于 `2026-10-01 13:54:45 -0400` 运行，9/9 通过；报告和截图：`artifacts/t057/published-r8-9cdfabd/`。
- 三套对照均晚于提交：工程工业 `artifacts/t057/engineering-9cdfabd/report.json` 66/66 一致；明亮产品 `artifacts/t057/forge-9cdfabd/report.json` 9/9 一致；蓝白目录 `artifacts/t057/landwind-9cdfabd/report.json` 9/9 一致。报告时间分别为 13:56:20、13:56:37、13:56:57 -0400。

### 第三次复审返工（候选 `57f897a`）

- 预览桥删除孤行测量、宽度 probe、RAF 和模板分支；`TemplateBlocks.heroTitle` 作为声明数据，只有 `shortPathLook` 为 `"words"`。工程工业、明亮产品、蓝白目录不写词 span，灰底短路径由浏览器 CSS `text-wrap: pretty` 处理孤行。测试覆盖声明 gating、二次写入结构一致和 resize 后不重新写入仍可重排。
- 最终全量（提交 `57f897a` 后）：`npm test` 508/508，0 失败/0 跳过；typecheck、build 通过。日志：`artifacts/t057/full-r6-57f897a.log`、`artifacts/t057/typecheck-r6-57f897a.log`、`artifacts/t057/build-r6-57f897a.log`。
- 三份草稿 `check-published` 于 `2026-10-01 13:28:38 -0400` 运行，9/9 通过；报告和截图在 `artifacts/t057/published-r6-57f897a/`。
- 三套最终对照均晚于提交：工程工业 `artifacts/t057/engineering-57f897a/report.json` 为 66/66 一致；明亮产品 `artifacts/t057/forge-57f897a/report.json` 为 9/9 一致；蓝白目录 `artifacts/t057/landwind-57f897a/report.json` 为 9/9 一致。报告时间分别为 13:30:09、13:30:28、13:30:51 -0400。P2 扫描脚本未改。
