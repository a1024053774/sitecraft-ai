---
id: T-090
title: 按区块声明检查基线对齐、组间距和每页一个主按钮
type: build
status: open
blocked_by: [T-089]
claimed_by: exec-t090
supersedes:
---

## What to build

依据 [R4 调研](../../docs/research/前端收藏调研-2026-10-03/R4-rules-skills-prompts.md) 第 B、6 节。检查按区块变体的声明判定，不扫描全页去猜。

- `lib/blocks/catalog.ts` 的变体可声明：基线组（同一行里字号不同、应沿基线对齐的文字节点）、语义组（哪些节点同属一组）、按钮角色（primary / secondary）。没有声明的变体不检查，并在报告里列出「未声明」。
- `scripts/render-block.mjs`（区块进库）和 `scripts/check-published.mjs`（发布页）：声明的基线组在三档宽度下基线差 ≤ 2px；同一语义组内间距小于组与组之间的间距；每页可见的 primary 按钮最多一个，按钮文字是具体动作（不接受「了解更多 / Learn More」这类空泛文案）。
- 现有变体逐个补声明；补声明后检查不过的是真实缺陷，修区块，不放宽。

## Acceptance

- [x] 测试先写，并在父提交上能加载、在断言处失败：基线错 4px 失败、组内间距大于组间距失败、一页两个 primary 失败、空泛按钮文案失败、未声明的变体报「未声明」而不是通过
- [ ] 全部已进库变体三档跑区块进库检查、三家 `check-published` 中英文三档通过，报告存 `artifacts/t090/`
- [ ] `npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收

## Resolution

2026-10-05（纽约时间）：

- `e84a53e997813a8d564305bb7cce645845b19973` 在合入 `family-kit-assembly` 的 `59fcd0fe14b1a1e8bb2a174f9ad5e95fe2f9728a`（合并头 `31ffc95`）后，为全部 41 个已进库变体补齐 `lib/blocks/catalog.ts` 的 `declarations`。字段只引用现有 slot、`data-sc-part` 或其下的实际 DOM selector；没有改布局值、HTML 或 CSS。上一轮 review-1 P1 红证据保留在 `artifacts/t090/red.txt`。
- `d6a823cf8adfb0692fe80f0278ddc8e9b8aa9c66` 沿 `blockCatalog → blockAdapterFor → preview bridge` 传递 `adapter.blocks.declarations`，由 bridge 设置 `window.__SITECRAFT_VARIANT_DECLARATIONS`；scanner 仍只读取显式 selector 声明。
- `tests/t090-layout-declarations.test.ts` 新增真实生产路径：打开 `screwfast`，挂载工业资料的 `hero:statement` + `footer:line`，测到 products 语义组、footer 基线和唯一 primary CTA，且 hero 不再列为未声明。最终 focused 3 pass：`artifacts/t090/focused-wiring-final.txt`。
- 最终 `npm run build`、`npm run typecheck` 通过：`artifacts/t090/build-wiring-final.txt`、`artifacts/t090/typecheck-wiring-final.txt`。
- wiring 首轮 fulltest 的真实反证保留在 `artifacts/t090/fulltest-wiring-r1.txt`（T-103 暴露不稳定声明关系）；修正后 `artifacts/t090/fulltest-wiring-r2.txt` 为 809 pass / 0 fail / 0 cancelled。
- 最终 13 站检查使用绝对清单 `/Users/luckye/Documents/Code/sitecraft-ai/artifacts/handoff/mainline-12-sites.txt`（原样 13 行），每次前强制复制主工作区 `.sitecraft-data/sites`；`artifacts/t090/mainline-wiring-final/run.log` 的真实退出码为 0，`report.json` 为 39/39 行、failures 0、`undeclaredVariants` 0。与 `/Users/luckye/Documents/Code/sitecraft-ai/artifacts/merge-104982b/check-published/report.json` 对照，正文行长和对比度测量均不少于基线。
- 修复前的 39 行、0 failures、411 条 `undeclaredVariants` 报告保留在 `artifacts/t090/mainline-catalog-final/`，作为本次 plumbing 的 P1 反证。

最终运行时代码为 `d6a823cf8adfb0692fe80f0278ddc8e9b8aa9c66`；后续文档提交只更新证据与 living-doc 校验，未推送。最终证据首行绑定最终 HEAD。
