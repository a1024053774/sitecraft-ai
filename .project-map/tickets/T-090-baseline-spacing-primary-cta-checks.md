---
id: T-090
title: 按区块声明检查基线对齐、组间距和每页一个主按钮
type: build
status: open
blocked_by: [T-089]
claimed_by:
supersedes:
---

## What to build

依据 [R4 调研](../../docs/research/前端收藏调研-2026-10-03/R4-rules-skills-prompts.md) 第 B、6 节。检查按区块变体的声明判定，不扫描全页去猜。

- `lib/blocks/catalog.ts` 的变体可声明：基线组（同一行里字号不同、应沿基线对齐的文字节点）、语义组（哪些节点同属一组）、按钮角色（primary / secondary）。没有声明的变体不检查，并在报告里列出「未声明」。
- `scripts/render-block.mjs`（区块进库）和 `scripts/check-published.mjs`（发布页）：声明的基线组在三档宽度下基线差 ≤ 2px；同一语义组内间距小于组与组之间的间距；每页可见的 primary 按钮最多一个，按钮文字是具体动作（不接受「了解更多 / Learn More」这类空泛文案）。
- 现有变体逐个补声明；补声明后检查不过的是真实缺陷，修区块，不放宽。

## Acceptance

- [ ] 测试先写，并在父提交上能加载、在断言处失败：基线错 4px 失败、组内间距大于组间距失败、一页两个 primary 失败、空泛按钮文案失败、未声明的变体报「未声明」而不是通过
- [ ] 全部已进库变体三档跑区块进库检查、三家 `check-published` 中英文三档通过，报告存 `artifacts/t090/`
- [ ] `npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收

## Resolution
