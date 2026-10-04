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

实现已限于 `scripts/visitor-layout-scan.js`、`scripts/check-published.mjs` 和 `tests/t090-layout-declarations.test.ts`；没有改 `lib/blocks/catalog.ts` 或任何区块声明、HTML、CSS。扫描器只读取挂载变体显式提供的 selector 声明，按声明测量基线（≤2px）、语义组间距（组内 < 组间）和 primary 按钮（每页 ≤1 且文案具体）；未提供声明的变体只写入 `undeclaredVariants`，不猜测 DOM。

证据（2026-10-04，纽约时间）：

- 父提交 `ed65aecd7abd2c33731ec8ed157d7364ca1b11e9` 的红测命令及断言级失败：`artifacts/t090/red.txt`。
- 修复后的聚焦测试：`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell SITECRAFT_BASE=http://127.0.0.1:3059 node --test --experimental-strip-types tests/t090-layout-declarations.test.ts`，2 pass，见 `artifacts/t090/focused-final.txt`。
- `npm run build` 通过，见 `artifacts/t090/build-final.txt`；随后 `npm run typecheck` 通过，见 `artifacts/t090/typecheck-final.txt`。
- brief 要求的全量命令 `zsh /Users/luckye/Documents/Code/sitecraft-ai/artifacts/research/threads-2026-10-03/briefs/fulltest.sh /Users/luckye/Documents/Code/sitecraft-ai-t090 3059 artifacts/t090/fulltest-final.txt` 通过：791 pass / 0 fail。
- 13 站主线回归为 `INCOMPLETE`：`artifacts/handoff/mainline-12-sites.txt` 与 `artifacts/merge-104982b/check-published/report.json` 在共享 filesystem 全路径检索不到，见 `artifacts/t090/mainline-13-incomplete.txt`；未用替代报告冒充基线，也未把 INVALID/timeout 当通过。

对应提交：本票唯一提交（最终 SHA 以该提交的 `git log -1` 为准，未推送）。
