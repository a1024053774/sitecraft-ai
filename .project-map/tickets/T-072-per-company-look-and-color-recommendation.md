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
- (b) 先写红测 `node --test --experimental-strip-types tests/alignment-material-recommendation-t072.test.ts`（模块不存在），再加入 `lib/alignment-recommendation.ts`：只从草稿结构化字段统计产品、类别、非空参数、行业/能力/认证/服务/问答条目；空草稿保留模型推荐，有结构化资料时按已写明的形态计数规则选择样子并由计数生成理由。`app/api/sites/[siteId]/chat/route.ts` 只用这个结果覆盖样子推荐，色彩推荐和理由仍走规划器。特征、路由覆盖与四个样子提示测试共 7 项通过，证据见 `artifacts/t072/round-b/focused.txt`。
- (b) 真实模型命令：`SITECRAFT_ENV_FILE=/Users/luckye/Documents/Code/sitecraft-ai/.env.local T072_OUTPUT_DIR=artifacts/t072/round-b node artifacts/t072/round-b/generate.mjs`（2026-10-03 07:43–07:45 UTC）。脚本用 `commitOperations` 预置三份结构化草稿，再让同一 chat route 发送三份模拟资料各两次；六次 HTTP 200。工业包两次工程工业，外贸包两次蓝白目录，注塑包两次工程工业；样子已不再六次相同。色彩仍由模型选择，理由未被样子覆盖，但只有工业/外贸各一次引用具体事实，其余四次是默认或通用摘要，故色彩理由质量保持 **INCOMPLETE**，未重复请求。
- 提交前 `npm run typecheck` PASS（`artifacts/t072/round-b/typecheck.txt`），`npm run build` PASS（`artifacts/t072/round-b/build.txt`）。`CHROME_PATH=… npm test` 为 605 项中 598 通过、7 失败（`artifacts/t072/round-b/npm-test.txt`）：型号索引表浏览器溢出，以及 worktree 缺少 `vendor/open-source-templates/fresh/dist/index.html` 和 powerai/astro-starter 资产导致的 6 项快照/资产测试；本票没有改这些区块或 vendor 资产，故全量验收 **INCOMPLETE**。
- (b) 本阶段实现与证据提交为本地提交 `T-072 recommend look from structured draft data`（未推送，最终 SHA 在 handoff 汇报）；(c) 独立提交为 `e88ce2a`。
- 验收补证：`artifacts/t072/acceptance-c.md` 对 e88ce2a 的 (c) 证据判定 NO_GO，原因是 round-c 没保存 planner 原始 JSON，且记录的 commit 仍是父提交 5271eda。旧 round-c 证据保留不改写；本次改用行为级路由红测 `tests/alignment-material-recommendation-t072.test.ts`，在 e88ce2a 临时 worktree 中以推荐样子断言失败（`artifacts/t072/behavior-red-e88.txt`），当前代码同测通过（`artifacts/t072/round-final/behavior-green.txt`）。
- 种子核对发现 `tests/fixtures/pack-drafts.ts` 漏掉了模拟资料中的应用行业、加工能力、认证状态及部分参数；已按 `lib/simulated-packs.ts` 补齐，并用 `tests/pack-drafts-materials-t072.test.ts` 三项独立事实断言验证。外贸样子规则改为只看结构化形态：2–3 个产品、单一类别、每个产品至少 3 项且参数条数一致时选蓝白目录；工业包参数条数 5–6、注塑包 5 个产品，均选工程工业。规则没有读取正文或行业名称来做映射。
- 最终运行前代码提交为 `d7394f4`。在该 SHA 上运行 `SITECRAFT_ENV_FILE=/Users/luckye/Documents/Code/sitecraft-ai/.env.local T072_OUTPUT_DIR=artifacts/t072/round-final node artifacts/t072/round-final/generate.mjs`（2026-10-03 08:31–08:33 UTC），三份资料各两次，六次顶层请求均 HTTP 200、`stopped=null`；输出顶层和每条结果都记录 `d7394f4`。`recommendations.json` 保存每次 planner 返回的解析 JSON，不含 prompt、资料原文、请求体或密钥；`comparison.json` 和 `diagnosis.md` 明确记录 `field=style` / `field=colorSet` 是否存在推荐、推荐 id 是否为目录 id，以及卡片最终采用的样子/色彩。最终卡片样子为工业两次工程工业、外贸两次蓝白目录、注塑两次工程工业；六个组合不全相同。模型有时返回带中文括号的标签而非合法 id，或返回 `kind=ready` 没有两题，服务端按现有目录默认色彩回退；未把这些输出改写成成功推荐。
- 最终提交后的 `npm run typecheck` 和 `npm run build` 均 PASS（`artifacts/t072/round-final/typecheck.txt`、`build.txt`）；相关行为/种子测试分别通过。全量 `CHROME_PATH=… npm test` 为 603 项中 596 通过、7 失败（`artifacts/t072/round-final/npm-test.txt`）：型号索引表旧基线溢出，以及 worktree 缺少 `fresh/dist/index.html`、powerai/astro-starter 资产的 6 项快照/资产测试。索引失败与本票关系见 `index-failure-relation.txt`：当前基线 5271eda 不包含主线后续修复 60bce15（该修复改的是产品 fragment、preview bridge 和索引测试），测试实际命中 3034 端口；本票没有改这些运行时代码。新增 seed 断言和因 fixture 补齐而局部隔离缺口的测试调整均已保存，未改索引实现。
- schema 枚举补修提交为 `87bc3a7`：`question` 与 `ready` 都必须带 `recommendation.styleId/styleReason/colorSetId/colorSetReason`；styleId 和卡片四套 colorSetId 使用 Zod 枚举，理由非空；路由不再从 questions 文本猜 id。结构化草稿有信号时样子仍由 b 规则覆盖，空草稿使用 planner 的 styleId/理由，色彩始终使用 planner 的 colorSetId/理由。schema 不合格使用现有重试预算，最终返回 HTTP 502 `invalid_output`，用户看到“需求对齐规划没有返回可用的问题卡，样子和色彩推荐格式不合规，原需求没有修改草稿，请重试。”
- schema 行为红测先在 `7cb234f` 失败（`artifacts/t072/enum-red-7cb.txt`），实现后通过（`round-enum/enum-green.txt`）；相关 76 项测试全通过（`enum-related.txt`）。最终真实轮次在 `87bc3a7` 上运行：`SITECRAFT_ENV_FILE=/Users/luckye/Documents/Code/sitecraft-ai/.env.local T072_OUTPUT_DIR=artifacts/t072/round-enum node artifacts/t072/round-enum/generate.mjs`（2026-10-03 09:23–09:25 UTC），六次 HTTP 200、六份原始 JSON、0 次枚举失败；SHA 与推荐状态见 `recommendations.json`、`comparison.json`、`diagnosis.md`，代码不重写缺失/非法模型输出。
- schema 提交后的 `npm run typecheck`、相关测试和 `npm run build` PASS；全量 npm test 为 605 项中 598 通过、7 失败，仍是索引表旧基线溢出与缺失 vendor 资产，输出见 `round-enum/npm-test.txt`。本轮补证提交为 `T-072 record enum recommendation evidence`（最终 SHA 在 handoff 汇报）。
- 理由文案补修提交为 `d936bc2`：保留同一组结构化计数和确定性规则，只把 `lib/alignment-recommendation.ts` 的理由改成工作台用户语言，例如“资料中有 2 个产品，每个都有 5–6 项参数，并列出 4 个应用行业、4 项加工能力和 3 项认证状态，工程工业适合把选型参数和工厂能力放在一起展示。”；不再显示“结构化资料有”“非空参数”“产品类别”等内部词。红测在 `1f29c8f` 失败，修复后通过，证据见 `artifacts/t072/round-reason/`。
- 需求对齐卡片使用已有确定性 fixture 在 3036 dev server 捕获并查看 1440 / 768 / 375 三档截图（`reason-card-1440.png`、`reason-card-768.png`、`reason-card-375.png`）；三档均有卡片，截图和可见文本见 `workspace-screenshots.json`。planner schema/输出未变，因此没有重复真实 DeepSeek。

## 负责人决定（2026-10-03）

第一轮真实结果（f0a0483）：色彩集已随公司变化，但样子 6 次全是工程工业，外贸两次和注塑一次的理由是通用文案。代码审查 PASS（`artifacts/review-astra-t072.md`）。负责人定：

1. 先做 (c)：在规划器提示里给出 4 个样子各自的具体样子（版式、视觉重点）和适合的业务形态（必须和区块库里实际的 token、默认布局一致），真实 DeepSeek 再跑一轮（三份资料各两次），和第一轮对比。
2. 如果样子推荐仍无变化，再做 (b)：在代码里从草稿的结构化字段算出资料特征（产品数、类别数、参数齐全程度、认证 / 行业 / 能力条目数等，只用结构化字段，不从正文猜），按写明的规则推荐样子，理由由这些特征生成。这取代本票原来「规则只写在提示里、不写成硬映射」一条；仍然不按行业标签硬映射。
3. 由专门的执行会话（`t072-build`，Codex gpt-6.1-sol xhigh fast）在独立 worktree 上做，另开专门的验收会话（`t072-check`，Codex gpt-6-astra xhigh）验收；完成后两个会话关闭。
