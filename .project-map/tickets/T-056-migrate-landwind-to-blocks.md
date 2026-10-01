---
id: T-056
title: 「蓝白目录」迁到区块库
type: build
status: open
blocked_by: [T-055]
claimed_by: codex-build
supersedes:
---

## What to build

照 T-053 的做法，把「蓝白目录」（现在是 `lib/template-adapters/overlays/landwind.index.html`）迁到区块库：写 `lib/blocks/looks/` 下这个样子的 token 和默认变体，尽量复用已有区块；确实需要这个样子特有的排法时新加变体（写进清单，别的样子也能选）。页面效果不退步，站点样式（T-054）在这个样子上也成立。盲评通过后删掉旧 overlay 和只为它存在的代码。

执行：Codex。代码审查：Kiro 或 Grok（不是做这张票的 agent）。

另外：这个样子旧 overlay 的产品卡参数值过长时会溢出到隔壁格（注塑资料在 1440 下被 T-053 新加的 `check-published` 文字溢出检查判失败），迁移时按 T-053 的做法处理：值可以换行，只在 / + – 、 之后断开。

另外：T-053 给 `check-published` 加了邮箱换行检查（邮箱只能在 @ 处换行），对所有样子生效；这个样子旧 overlay 的站点在 375 下会因邮箱在 - 处换行而不通过，迁移时按 T-053 的做法处理。

## 实现决定（Claude，2026-09-30，依据 Kiro 的计划 `artifacts/kiro-t056-plan.md`）

三张迁移票（T-055/T-056/T-057）共用：
- 外观差异用 token 表达（样子 = token + 默认布局），不给每个样子写覆盖 CSS；新变体 CSS 只写一次。每一步都要保证工程工业默认页 66 张对照逐像素不变。
- 新样子不和旧 overlay 逐像素对照：比对文字、区块结构和截图，最后盲评。
- 新变体写进区块清单，满足资料条件时所有样子都能选。
- 合作方式带步号；常见问题和合作方式最多各 6 条（与 T-059 一致）。
- 串行：T-054 关闭后依次 T-055 → T-056 → T-057，执行 Codex，代码审查 Astra，盲评 gpt-6.1-sol。

## Acceptance

- [ ] 三份模拟资料用这个样子生成，`check-published` 通过，1440 / 768 / 375 截图打开看过
- [ ] 盲评（Codex gpt-6.1-sol，旧版与新版不标来源）：新版不差于旧版；和工程工业放在一起能看出是不同的样子
- [ ] 测试先写、改动前先失败；`npm run typecheck`、`npm test`、`npm run build` 通过
- [ ] 代码审查通过；Claude 验收；旧 overlay 已删除

## Resolution

- 三份资料各真实跑过一次 DeepSeek（按工业、外贸、注塑顺序，未并行），均完成“需求对齐 → 确认 → 生成”，草稿 `templateId=landwind`、方向为 `export-catalog / 蓝白目录`：
  - 工业 `4345e6dc-8756-4170-ab7f-68576d601892`：模型建议并写入 `products=compare`，2 个产品。
  - 外贸 `bc386e3d-0d4a-427f-ab22-a309b823ffdf`：写入 `industries=cards`、`services=steps`，2 个产品。
  - 注塑 `3f729be4-8a22-4127-91b8-9c658178d405`：资料不足的变体被拒，保留默认排法，5 个产品。
  原始调用和结果：`artifacts/t056/t056-industrial-summary.json`、`t056-export-summary.json`、`t056-molding-summary.json`（2026-10-01 09:54–09:58 UTC）。
- 发布页三档检查：
  `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node scripts/check-published.mjs --out artifacts/t056/published-real-final 4345e6dc-8756-4170-ab7f-68576d601892 bc386e3d-0d4a-427f-ab22-a309b823ffdf 3f729be4-8a22-4127-91b8-9c658178d405`
  9/9（1440/768/375 × 3）通过，0 failures；逐张截图已查看，文件在 `artifacts/t056/published-real-final/`。
- 旧新事实、顺序、显隐对照：`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell OUT=artifacts/t056/landwind-old-new-compare-r2 node --experimental-strip-types artifacts/t056/compare-landwind-facts.mjs`，旧侧从 `472a304` 的 `lib/template-adapters/overlays/landwind.index.html`、bridge、adapter 取代码，新侧用当前区块库；同一份草稿、同一 Chrome、9 组宽度结果，报告在 `artifacts/t056/landwind-old-new-compare-r2/report.json`。每组都有非空事实和 10 个显隐节点，规范化区块顺序 9/9 一致；工业资料因新版选择参数对比表，旧 overlay 记录 26/36 个共同事实（外贸 38/44、注塑 70/88），差异明细保存在报告中，没有空结果。
- 盲评包：`artifacts/t056/blind/`，两版使用新随机代号并随机顺序，每张旧版/新版截图均有 `-masked.png`；工程工业和明亮产品参照图分别以 `engineering`、`bright` 命名。README 保留五问并加入“和另外两个样子放在一起能看出是不同的样子吗”，对照表单独在 `artifacts/t056/blind-key.json`，截图检查用的接触表在 `artifacts/t056/blind-contact-sheet.png`。
- 验证（2026-10-01）：`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test` 497/497 通过、0 skipped；`npm run typecheck` 通过；`npm run build` 通过。
- 代码审查：
- 盲评：
- 删除旧 overlay：
