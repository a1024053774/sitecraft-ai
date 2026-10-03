---
id: T-072
title: 需求对齐的样子和色彩集按公司资料推荐
type: build
status: open
blocked_by: [T-070]
claimed_by: codex-build
supersedes:
---

## What to build

T-065 的 6 个基线（三家不同的公司）全部是工程工业 + 工程暖橙：
- 色彩集：推荐项固定是样子的默认色板（`lib/alignment.ts` `lookCardColorOptions` 里 `recommended: palette?.id === defaultPaletteId`），不看资料。
- 样子：规划器提示只说「如果能按行业推荐样子」（`lib/ai-provider.ts` 需求对齐规划器），三家工业/外贸/注塑公司都被推荐了工程工业；T-066 专家给外贸公司选了蓝白目录 + 松石，两轮评审都认为它比基线更像这家公司。

改成：
- 规划器在推荐样子的同时推荐一个色彩集（卡片上的 4 套之一），各写一句理由，理由必须指向这家公司资料里的具体事实（业务形态、主打产品、出口/内销、资料厚薄等），不能只写行业名。
- 样子推荐看业务形态，不只看行业标签：例如目录型外贸、参数选型为主、工厂实力为主、资料少的小厂，对应的样子可能不同。规则写在提示里，不写成按行业的硬映射。
- 卡片显示规划器推荐的色彩集和理由；规划器没给或给了不在卡片上的色彩集时，仍按现有做法推荐样子的默认色板，并且不显示理由（不是新的兜底分支，是现有行为）。
- 用户的选择照旧决定草稿色板；推荐只是标记。

不改：色彩集和色板目录本身；用户可选范围；`commitOperations` 流程。

## Acceptance

- [x] 测试先写、改动前先失败：规划器返回的色彩集推荐和理由出现在卡片上；返回卡片上没有的色彩集时被拒绝并回到默认推荐；理由为空时不显示理由
- [ ] 真实 DeepSeek：三份模拟资料各走两次需求对齐，记录每次推荐的样子、色彩集和理由（`artifacts/t072/`）；理由都指向资料事实；三家公司的（样子, 色彩集）推荐不全相同。做不到就如实报 INCOMPLETE 并写清模型的实际输出，不靠反复重跑凑结果
- [ ] `npm run typecheck`、`npm test`、`npm run build` 通过；工作台需求对齐卡片 1440 / 768 / 375 截图看过；代码审查通过；Claude 验收

## Resolution

2026-10-03（America/New_York），codex-build：

- 在 `lib/ai-provider.ts` 的需求对齐提示中加入按业务形态判断样子/色彩集的规则，要求 `field=style` 与 `field=colorSet` 各给一条基于资料事实的理由；在 `app/api/sites/[siteId]/chat/route.ts` 传递合法色彩推荐，在 `lib/alignment.ts` 只对卡片目录内的 4 套色彩集改推荐标记和理由，缺失/卡片外值沿用现有默认推荐；工作台提示同步改为“按资料里的业务形态给出”。
- 聚焦证据：先运行 `node --test --experimental-strip-types tests/alignment-recommendations-t072.test.ts`，当前 HEAD 在色彩推荐处失败，输出保存于 `artifacts/t072/red.txt`；改动后同命令 2/2 通过，相关对齐测试最终 6/6 通过。最终 typecheck/build 输出见 `artifacts/t072/typecheck-final3.txt`、`artifacts/t072/build-final2.txt`。
- 真实模型命令：`node --experimental-strip-types artifacts/t072/generate.mjs`（2026-10-03 06:00–06:02 UTC）。6 次请求均 HTTP 200，推荐记录见 `artifacts/t072/recommendations.json`。工业包两次为工程工业+石墨工坊，外贸包两次为工程工业+工程暖橙，注塑包一次工程工业+工程暖橙、一次工程工业+石墨工坊，因此组合不全相同；但外贸包两次理由退回目录/暖橙通用文案，没有指向资料事实，本项 **INCOMPLETE**，未重复请求凑数。
- UI 证据：使用 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell` 在 3034 dev server 捕获并查看 `artifacts/t072/workspace-alignment-1440.png`、`workspace-alignment-768.png`、`workspace-alignment-375.png`；三档均加载了需求对齐卡，375 为逐题抽屉。
- 全量 `CHROME_PATH=… npm test` 为 597/598 通过，既有 `tests/workspace-interaction.test.ts` 动效测试在 375 宽度等待进度步骤失败，输出见 `artifacts/t072/npm-test-chrome.txt`；未改动效范围，故本票全量验收保持 **INCOMPLETE**。第一次未设 Chrome 路径的失败也保留于 `artifacts/t072/npm-test.txt`。对应提交为本票最终本地提交（SHA 由 handoff 报告）。
