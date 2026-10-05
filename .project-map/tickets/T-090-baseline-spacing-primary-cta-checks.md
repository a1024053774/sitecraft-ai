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

2026-10-05（纽约时间），代码提交 `e84a53e997813a8d564305bb7cce645845b19973` 在合入 `family-kit-assembly` 的 `59fcd0fe14b1a1e8bb2a174f9ad5e95fe2f9728a`（合并头 `31ffc95`）后完成 catalog 范围：`lib/blocks/catalog.ts` 为全部 41 个已进库变体增加 `declarations`，只引用现有 slot、`data-sc-part` 或其下的实际 DOM selector；没有改布局值、HTML 或 CSS。上一轮 review-1 P1 红证据保留在 `artifacts/t090/red.txt`。

- 聚焦测试：`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell SITECRAFT_BASE=http://127.0.0.1:3059 node --test --experimental-strip-types tests/t090-layout-declarations.test.ts`，2 pass，见 `artifacts/t090/focused-catalog-final.txt`。
- `npm run build` 和随后 `npm run typecheck` 均通过，见 `artifacts/t090/build-catalog-final.txt`、`artifacts/t090/typecheck-catalog-final.txt`。
- brief 全量命令首轮结果原样保留在 `artifacts/t090/fulltest-catalog-final.txt`（806 pass、1 timeout、1 cancelled）；低负载重跑 `artifacts/t090/fulltest-catalog-r2.txt` 为 808 pass / 0 fail / 0 cancelled。
- 13 站检查使用绝对清单 `/Users/luckye/Documents/Code/sitecraft-ai/artifacts/handoff/mainline-12-sites.txt`（原样 13 行），每次前强制复制主工作区 `.sitecraft-data/sites`；命令输出 `artifacts/t090/mainline-catalog-final/run.log`，报告 `artifacts/t090/mainline-catalog-final/report.json`，39/39 行、真实退出码 0、failures 0。与 `/Users/luckye/Documents/Code/sitecraft-ai/artifacts/merge-104982b/check-published/report.json` 的 39 行 baseline 对照，正文行长和对比度测量均不少于基线。
- 修复前反证 `artifacts/t090/mainline-catalog-final/report.json` 保留 39 行、0 failures 但 411 条 `undeclaredVariants`，证明仅有 catalog 数据还未到达浏览器扫描。后续代码提交 `d6a823cf8adfb0692fe80f0278ddc8e9b8aa9c66` 沿现有 `blockCatalog → blockAdapterFor → preview bridge` 路径传递 `adapter.blocks.declarations`，由 bridge 设置 `window.__SITECRAFT_VARIANT_DECLARATIONS`；scanner 仍只读 selector 声明，不猜 DOM。
- 新增 focused 生产路径测试：真实打开 `screwfast` 预览，挂载工业资料的 `hero:statement` + `footer:line`，测到产品语义组、footer 基线和 primary CTA，且该 hero 不再列为未声明；最终 focused 命令 3 pass，见 `artifacts/t090/focused-wiring-final.txt`。
- 最终 `npm run build`、`npm run typecheck` 通过，见 `artifacts/t090/build-wiring-final.txt`、`artifacts/t090/typecheck-wiring-final.txt`。
- wiring 首轮 fulltest 的声明关系反证保留在 `artifacts/t090/fulltest-wiring-r1.txt`（809 tests 中 808 pass，T-103 因真实声明暴露 footer 0/0 间距与 hero 英文换行基线失败）；修正不稳定声明后 `artifacts/t090/fulltest-wiring-r2.txt` 为 809 pass / 0 fail / 0 cancelled。
- 最终 13 站检查使用绝对清单 `/Users/luckye/Documents/Code/sitecraft-ai/artifacts/handoff/mainline-12-sites.txt`（原样 13 行），每次前强制复制主工作区 `.sitecraft-data/sites`；输出 `artifacts/t090/mainline-wiring-final/run.log` 和 `report.json`，39/39 行、真实退出码 0、failures 0、`undeclaredVariants` 0。与 `/Users/luckye/Documents/Code/sitecraft-ai/artifacts/merge-104982b/check-published/report.json` 的 39 行 baseline 对照，正文行长和对比度测量均不少于基线。

文档更新另提交，未推送；最终代码与检查证据首行绑定 `d6a823cf8adfb0692fe80f0278ddc8e9b8aa9c66`，文档提交不改运行时代码。
