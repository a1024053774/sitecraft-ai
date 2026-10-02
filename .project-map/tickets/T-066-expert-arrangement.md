---
id: T-066
title: 专家对照：只用现有能力，为三家公司重新组织页面
type: build
status: open
blocked_by: [T-065]
claimed_by: codex-expert
supersedes:
---

## What to build

T-064 的第二组，用来测「现有区块库的上限」：如果一个懂工业 B2B 官网和版式的专家，只用运行时模型被允许做的事，能把页面做得明显更好，说明瓶颈在模型的选择和内容组织；做不好，才说明表达力不够。

每家公司做一个专家版站点（三家共 3 个），起点任选：T-065 该公司两次生成之一的草稿（复制到新站点上再改，**不要改 T-065 的站点本身**，T-067 可能要重渲它们），或新建空站。

**允许**（和运行时模型完全相同的能力）：
- 只通过 `commitOperations`（`lib/site-store.ts`）提交白名单 operation：换样子（`set_template` / `set_visual_brief`）、色板和 6 套色彩集、`set_block_variant`（现有 24 个布局，资料不够时会被拒绝）、`reorder_sections`、`set_section_visibility`、页面计划、文字和卡片类 operation、`set_site_style`（站点样式白名单和三档检查照常生效）。
- 文字只能来自该公司的模拟资料（中英双语一起写）；资料里没有的写缺口或不显示，按 CONTEXT.md 的缺口规则和元话术规则。

**不允许**：改 `lib/`、`app/`、`scripts/` 里的任何代码、区块 HTML/CSS 或 token；绕过 `commitOperations` 写草稿；资料以外的事实、图片、数字；用 `replace_draft` 塞入手写的整份草稿来绕过 operation 校验（只允许用它复制 T-065 的起点草稿）。

交付，每家公司：
- 站点 siteId 和按顺序提交的全部 operation（JSON），被系统拒绝的也记下来和拒绝原因；
- 设计说明：这家公司的访客是谁、首页要先回答什么，为此做了哪些选择、为什么；
- **「想做但做不到」清单**：每条写清想要的效果、为什么对这家公司重要、现有布局 / token / 站点样式差在哪里。这份清单是之后决定扩库还是放开结构的主要依据，宁可具体，不要泛泛。
- 用 `artifacts/t065/render.mjs` 渲染的截图（放 `artifacts/t066/expert/<pack>/`），每张看过；`check-published` 中英文三档报告。

## Acceptance

- [ ] 三家公司各有一个专家版站点，全部修改都能从 operation 记录复现
- [ ] 每家的设计说明和「想做但做不到」清单齐全
- [ ] 截图和 `check-published` 报告齐全；不通过的如实列出
- [ ] 没有改动仓库里的代码文件（`git status` 证明）
