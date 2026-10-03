---
id: T-072
title: 需求对齐的样子和色彩集按公司资料推荐
type: build
status: open
blocked_by: [T-070]
claimed_by: t072-build
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
- (c) 复跑：在提示加入四个区块库样子的具体版式、token 重点、默认区块和适合业务形态后，运行 `SITECRAFT_ENV_FILE=/Users/luckye/Documents/Code/sitecraft-ai/.env.local T072_OUTPUT_DIR=artifacts/t072/round-c node artifacts/t072/round-c/generate.mjs`（2026-10-03 07:30–07:31 UTC），六次均 HTTP 200；`artifacts/t072/round-c/recommendations.json` 中六次仍是工程工业 + 工程暖橙，样子/色彩理由也六次完全等于目录默认摘要。
- (c) 诊断：`round-c` 脚本只保存路由重建后的卡片，不保存规划器原始 JSON；临时站点和会话在每次请求后删除，故无法事后读取 raw `questions`。六次颜色理由都等于工程暖橙目录摘要、样子理由都等于工程工业目录摘要；这与没有合法推荐走默认路径相符，也与模型恰好重复默认句相符，现有证据不能区分两者。诊断详见 `artifacts/t072/round-c/diagnosis.md` 和 `comparison.json`。本轮没有为补 raw 而重复请求。

## 负责人决定（2026-10-03）

第一轮真实结果（f0a0483）：色彩集已随公司变化，但样子 6 次全是工程工业，外贸两次和注塑一次的理由是通用文案。代码审查 PASS（`artifacts/review-astra-t072.md`）。负责人定：

1. 先做 (c)：在规划器提示里给出 4 个样子各自的具体样子（版式、视觉重点）和适合的业务形态（必须和区块库里实际的 token、默认布局一致），真实 DeepSeek 再跑一轮（三份资料各两次），和第一轮对比。
2. 如果样子推荐仍无变化，再做 (b)：在代码里从草稿的结构化字段算出资料特征（产品数、类别数、参数齐全程度、认证 / 行业 / 能力条目数等，只用结构化字段，不从正文猜），按写明的规则推荐样子，理由由这些特征生成。这取代本票原来「规则只写在提示里、不写成硬映射」一条；仍然不按行业标签硬映射。
3. 由专门的执行会话（`t072-build`，Codex gpt-6.1-sol xhigh fast）在独立 worktree 上做，另开专门的验收会话（`t072-check`，Codex gpt-6-astra xhigh）验收；完成后两个会话关闭。
