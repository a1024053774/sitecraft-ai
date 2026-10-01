---
id: T-055
title: 「明亮产品」迁到区块库
type: build
status: open
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

- [ ] 三份模拟资料用这个样子生成，`check-published` 通过，1440 / 768 / 375 截图打开看过
- [ ] 盲评（Codex gpt-6.1-sol，旧版与新版不标来源）：新版不差于旧版；和工程工业放在一起能看出是不同的样子
- [ ] 测试先写、改动前先失败；`npm run typecheck`、`npm test`、`npm run build` 通过
- [ ] 代码审查通过；Claude 验收；旧 overlay 已删除
