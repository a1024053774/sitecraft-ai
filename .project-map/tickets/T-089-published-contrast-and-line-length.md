---
id: T-089
title: 发布页硬门：正文对比度 4.5:1 和正文行长
type: build
status: closed
blocked_by: [T-084, T-081]
claimed_by: exec-t089
supersedes:
---

## What to build

依据 [R4 调研](../../docs/research/前端收藏调研-2026-10-03/R4-rules-skills-prompts.md) 第 B、6 节。T-081 合回主线后再从主线拉分支（两边都改 `scripts/check-published.mjs`）。

- **正文对比度**：`scripts/visitor-layout-scan.js` 按实际渲染的前景色和合成后的背景色计算；`scripts/check-published.mjs` 对普通正文低于 4.5:1 判失败，大号文字（≥ 24px，或 ≥ 18.66px 且粗体）按 3:1。图片背景上的文字算不出来时报「未测」，不算通过。站点样式提交前的检查（`lib/site-style-check.ts`）对正文也改用 4.5:1。
- **正文行长**：只对正文段落检查，中文约 20–40 字、英文约 45–75 字符一行，超出报失败；参数表、按钮、型号、邮箱、导航豁免并在报告里列出。
- 硬门升级后，现有三家基线站和已进库布局的站点必须通过；不过就是真实缺陷，修页面或 token，不放宽门槛。

## Acceptance

- [x] 测试先写，并在父提交上能加载、在断言处失败：用固定 HTML 夹具覆盖正文 4.4:1 失败、4.6:1 通过、大字 3.2:1 通过、图片背景报未测、正文过长失败、参数表豁免
- [x] 三家模拟资料 × 中英文 × 1440 / 768 / 375 跑 `check-published`，报告和截图存 `artifacts/published-check/t089-*`；发现的缺陷已在根因层修好
- [x] `npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收

## Resolution

实现正文对比度与正文行长硬门：`visitor-layout-scan.js` 现在按实际前景色、透明背景合成链和文字落点测量，纯色 CSS 渐变逐色标取最差对比度，任一未知色标使整层报告「未测」，正文普通文字要求 4.5:1、大号文字按 3:1，图片背景、混合图层和无法解析背景报告「未测」；按实际 Range 分行检查中文 40 字、英文 75 字上限，并列出参数表、按钮、型号、邮箱、导航豁免。`check-published.mjs` 与 `lib/site-style-check.ts` 共用扫描结果并拒绝未测、对比度不足和正文超长。目录样式恢复 Hero 渐变 token，并将默认目录 muted token 调深至通过 4.5:1。

证据（纽约时间 2026-10-03）：

- `SITECRAFT_BASE=http://127.0.0.1:3058 CHROME_PATH=... node --test --experimental-strip-types tests/t089-contrast-line-length.test.ts tests/site-style-scan.test.ts`：通过；父提交红测输出见 `artifacts/t089/red.txt`，本轮坏实现红测见 `artifacts/t089/red-r3.txt`，夹具报告见 `artifacts/t089/contrast-line-length-fixture.json`。
- 三家模拟资料（industrial/export/molding）中英文 × 1440/768/375：`node scripts/check-published.mjs --out artifacts/published-check/t089-r3 t089-industrial t089-export t089-molding`，9 个视口均通过且每个英文报告存在；报告见 `artifacts/published-check/t089-r3/report.json`，18 张截图同目录。
- `npm run typecheck`：通过；`bash /Users/luckye/Documents/Code/sitecraft-ai/artifacts/research/threads-2026-10-03/briefs/fulltest.sh /Users/luckye/Documents/Code/sitecraft-ai-t089 3058 artifacts/t089/npm-test-r3.txt`：666/666 通过；`npm run build`：通过。页面拼图复核见 `artifacts/t089/r2-visual-review.png`。
- 对应提交：本票提交（最终 SHA 以 `git log -1 --format=%H` 为准）；代码审查与 Claude 验收待后续实例完成。

### 当前状态（2026-10-03 18:50 EDT，Claude 验收）

- 独立审查（rs-ui，未参与实现）三轮：第一轮 `REVISE`（纯色渐变被当图片导致目录样子改设计迁就检查器、opacity 未进合成、嵌套正文行长漏检与豁免过宽）；第二轮 `REVISE`（无法解析的渐变色标被跳过）；第三轮 `PASS`。报告在 sitecraft-ai 主工作区 `artifacts/research/threads-2026-10-03/reviews/T-089-review-{1,2,3}.md`。
- 修复后的证据：全量 `npm test` 666/666（`artifacts/t089/npm-test-r3.txt`，经 `fulltest.sh`，提交 `0afdb52` 前一分钟运行）；`npm run build` 通过；目录样子首屏渐变已恢复原设计，只把默认 muted token 调深到通过 4.5:1。
- Claude 验收：并入主线 `e2622d8`（合并提交 `dfa46d2`）后，`npm run typecheck` 通过；`tests/t089-contrast-line-length.test.ts` 与 `tests/site-style-scan.test.ts` 3/3；`check-published` 三家 × 中英 × 1440/768/375 全部通过，报告 `artifacts/published-check/t089-claude-accept/report.json`，抽看外贸站中文 1440 截图正常。历史段落里的 open/未完成描述是当时状态，以本段为准。
