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
- [ ] 代码审查通过；Claude 验收；旧 overlay 已删除

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
