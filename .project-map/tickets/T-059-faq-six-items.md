---
id: T-059
title: 常见问题在访客页放到 6 条
type: build
status: open
blocked_by: [T-053]
claimed_by: kiro
supersedes:
---

## What to build

草稿的常见问题默认就有 6 条，但工程工业的页面只有 3 个槽位；注塑厚资料包（T-050）有 5 组问答，访客页丢掉 2 组。在区块库的常见问题区块里放到 6 条（缺口条目按缺口规则不显示），模型提示同步说明可以写到 6 条。T-053 里为保持新旧对照只差排法，没有一起做。

## Acceptance

- [x] 注塑资料生成后访客页显示 5 组问答，P3I、P3E 只显示实际写入的条目，没有空壳
- [x] `check-published` 三档通过，截图打开看过
- [x] 测试先写、改动前先失败；`npm run typecheck`、`npm test`、`npm run build` 通过
- [ ] 代码审查通过；Claude 验收

## Resolution

Kiro，2026-09-30（纽约时间）。提交：`a1a31fb`（常见问题 6 条）、`f407727`（整组替换 `replace_cards`，负责人 08:31 选的方案 1）。本地提交，未推送；前三个勾选项已勾，最后一项等审查和 Claude 验收。

做了什么：

- 工程工业的常见问题从 3 条放到 6 条（`lib/blocks/fragments/sections.ts`、`lib/blocks/catalog.ts`）；有问有答的先显示，空条目不显示，一条都没有时整块不显示。check-published 对工程工业按 6 条核对。
- 模型提示写明当前样子最多显示几条问答（按样子声明的条目数：工程工业 6、明亮产品 3、蓝白目录 4、灰底短路径 3）。
- 只做到这一步时，注塑实跑还是只写了 3 组：每组问答占一条修改，注塑整站生成每次都用满 24 条上限（`efc9980c`、`1b7c9d43`、`071ccd68`、`0bb9a3ca` 分别写了 3、3、4、3 组）。于是加了整组替换 `replace_cards`（常见问题、合作方式、优势）：一条修改带完整条目列表，撤销时整组恢复（连同英文页开关），同一份列表再写不算修改；草稿每组最多 12 条、id 不重复。模型写的常见问题最多 6 条，多出的不写并说明；标题和正文都缺的条目不写，整组都缺时不执行。提示里整站生成用它代替逐条 add_card / update_card，只改其中一条时仍用 update_card。摘要里出现修改名（`replace_cards` 等）时换成改动的页面部分。

测试：`tests/faq-six-items.test.ts`、`tests/replace-cards.test.ts`（中英文、撤销和重做、12 条和 id 唯一、常见问题 6 条上限、空条目、不误清空、提示）；`bridge-entry-order`、`published-facts` 从 3 条改成 6 条。改动前失败：08:17 在 `61cab33` 上 `node --test --experimental-strip-types tests/faq-six-items.test.ts` 6 条中 5 条失败（`artifacts/t059-red.txt`）；08:35 在 `a1a31fb` 上 `tests/replace-cards.test.ts` 6/6 失败（`artifacts/t059-red-replace-cards.txt`）。改动后：08:37–08:39 在 `f407727` 的内容上 `npm run typecheck` 通过、`npm test` 454/454、`npm run build` 通过（`artifacts/t059b-*.txt`）。

实跑（真实 DeepSeek，工程工业需求对齐，`artifacts/t061/accept-runs.mjs`）：

- 注塑：08:39–08:41 在 `f407727` 上生成一次（`ece74b58…`，`artifacts/t061/t059-replace-cards-summary.json`），草稿里 5 组问答中英齐全，访客页三档都显示 5 组。这次模型用了 24 条修改（加上需求对齐补的样子和配色共 26 条），其中 `replace_cards` 3 条：常见问题 5 条、合作方式 5 条、优势 3 条；之前同样的内容要 6–10 条逐条修改。
- P3I `fffe8309…`、P3E `221f9456…`：08:23–08:27 在 `a1a31fb` 上生成（资料里没有问答），页面不显示常见问题，也没有空壳。
- 08:44 在 `f407727` 上 `node scripts/check-published.mjs --out artifacts/t059-final-published <三个站>`：9 页全部通过，资料事实 117 / 40 / 41 条都在页面上。注塑常见问题区三档截图看过（`artifacts/t059-view/faq-{1440,768,375}.jpg`）。

遗留：注塑的合作方式模型写了 5 步（质检流程），工程工业页面只放 3 步，后 2 步没显示（check-published 按 3 条核对，所以通过）；要不要把合作方式也放宽另开票。

