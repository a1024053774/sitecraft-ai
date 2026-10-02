---
id: T-066
title: 专家对照：只用现有能力，为三家公司重新组织页面
type: build
status: closed
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

## Resolution

2026-10-02 12:12（America/New_York），在提交 `d248a88e9a7992f6ccc2bf199a3fd089a7e8628d` 上完成。T-065 已关闭；三家均从 T-065 的第二次基线复制到独立站点，源站 revision 保持不变。复制和后续调整全部经 `commitOperations`，完整请求、响应、inverse 和落点在各自 `operations.json`。

- 工业：专家站点 `5233c15c-966e-4716-aa6d-7168773df13e`，起点 `industrial-2`；`engineering-industrial` + `engineering-patina`，首屏 `statement`，产品 `compare`，隐藏合作方式/FAQ，顺序为产品 → 行业/能力 → 认证 → 询盘；未使用站点样式。
- 外贸：专家站点 `04d99180-2831-4147-96cf-95eae3913b27`，起点 `export-2`；`export-catalog` + `export-turquoise`，首屏 `statement`，产品默认 `rows`，隐藏合作方式/FAQ，记录认证页/资料下载页 unsupported。375px 初始检查发现标题断词；30px 样式仍有孤字，最终保留 `hero.title` phone `font-size: 28px` 的白名单样式，三档及英文检查通过。第一次 3034 API 样式提交因 server 未继承 `CHROME_PATH` 被拒绝，未写入草稿；后续独立 `commitOperations` 进程设置 Chrome for Testing 路径完成修正，拒绝和两次样式提交均有记录。
- 注塑：专家站点 `82976660-1768-4c3f-8986-509e2a0e45c1`，起点 `molding-2`；`engineering-industrial` + `engineering-graphite`，首屏 `statement`，产品 `grouped`，能力 `cards`，询盘 `panel`，保留流程/认证/FAQ，顺序为产品 → 能力/行业 → 合作方式 → 认证 → FAQ → 询盘；未使用站点样式，并修正站名为资料中的公司名。

运行的最终命令（均未重启 3034）：

```text
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node scripts/check-published.mjs --out artifacts/t066/expert/industrial/check-published 5233c15c-966e-4716-aa6d-7168773df13e
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node scripts/check-published.mjs --out artifacts/t066/expert/export/check-published 04d99180-2831-4147-96cf-95eae3913b27
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node scripts/check-published.mjs --out artifacts/t066/expert/molding/check-published 82976660-1768-4c3f-8986-509e2a0e45c1
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node artifacts/t065/render.mjs 5233c15c-966e-4716-aa6d-7168773df13e --out artifacts/t066/expert/industrial
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node artifacts/t065/render.mjs 04d99180-2831-4147-96cf-95eae3913b27 --out artifacts/t066/expert/export
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node artifacts/t065/render.mjs 82976660-1768-4c3f-8986-509e2a0e45c1 --out artifacts/t066/expert/molding
```

最终 `check-published` 三家均为 1440/768/375 中文和英文 1440/375 全部通过；`render.json` 与中文遮字版、英文截图齐全并已查看。设计说明和「想做但做不到」清单在各包的 `design.md`，截图/报告路径在各包目录。未修改 `lib/`、`app/`、`scripts/`，未提交 commit；本票 `status` 保持 `open`，等待 supervisor 验收。

## Acceptance

- [x] 三家公司各有一个专家版站点，全部修改都能从 operation 记录复现
- [x] 每家的设计说明和「想做但做不到」清单齐全
- [x] 截图和 `check-published` 报告齐全；不通过的如实列出
- [x] 没有改动仓库里的代码文件（`git status` 证明）

Claude 验收（2026-10-02 EDT）：`operations.json` 逐批复核——每家第 0 批只有一条 `replace_draft`（复制基线），之后全是白名单 operation（外贸两次 `set_site_style` 经三档检查后提交），全部 `applied`；24 张截图均为整页高度，抽看工业中文 1440、外贸中文 375，到页脚完整、无截断。三份「想做但做不到」清单的共同点：几乎都不是版式表达不了，而是内容层能力缺失——产品详情子页 / 下载 / 筛选、MOQ·交期·产能等商业指标块、证书编号与附件、授权实拍图、带交付物的流程时间线；T-068 判读时对照。本票只产出 artifacts，不需要代码审查。
