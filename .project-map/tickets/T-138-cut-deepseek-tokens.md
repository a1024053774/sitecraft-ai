---
id: T-138
title: 降低每次生成与评估的 DeepSeek 用量
type: build
status: out-of-scope
blocked_by: []
claimed_by: t138-build
supersedes:
---

## Why

负责人 2026-10-09：DeepSeek 钱包撑不住，尽量减少用量。一整轮 8 组合评估 60–120 万 token；T-134 一轮 122.5 万（write 60.7 万、facts 34.8 万、polish 22.6 万、plan 4.5 万）。修正轮多半来自模型编造无来源的承诺或政策，每多一轮就多一次写整站和一次事实校对。

## What to build

先用已有轮次的用量记录（T-133 基线、T-132、T-134、T-135 的 private/ 调用记录，不新调模型）算清楚 token 花在哪：各用途的输入/输出、推理 token 占比、修正轮占比、单站平均。然后在根因处减：

1. 修正轮只改被拒的部分：把拒因对应的句子删掉或改写成资料原话，不重写整站；交回模型的上下文只带必要内容。
2. 写页提示里把「无来源的承诺、报价、交期、付款、售后、认证类说法一律不写」放到显著位置，减少首稿被拒。
3. 事实校对与规划等不需要长推理的调用，评估是否改用非思考模式或更小的输出上限；不影响结果才改，用成对数据说明。
4. 评估命令加一个快速档：4 个组合（每家一种风格）、只生成首页和产品页，用于日常验证；整轮 8 组合只在做决定时跑。

## Acceptance

- [ ] Resolution 有改前用量拆分（来自已有记录）和改后快速档一轮的用量拆分，单站平均 token 至少下降三分之一，最终拒收率不上升
- [x] 修正轮的局部修改不绕过提交入口和底线检查；有测试，坏实现（整站重写或跳过检查）失败
- [x] Astra 审查通过；typecheck、test、build 通过

## Resolution

INCOMPLETE（整票省量目标未完成）：两站全内容非思考快速档虽省67.0%，独立盲评两站均选思考版本，写页非思考NO_GO；T-133原始报价候选的非思考facts校对6/6漏拦，facts非思考也NO_GO。按主控条件，write/facts默认思考，repair默认非思考，plan保持原思考+strict。当前策略尚无完整生成省量对照，不能沿用全非思考的67.0%宣称达标。本次事实实验合格6坏+2干净样本20,034 token，加上两次无效控制尝试，实际10次调用共26,379；所有失败保留。不派审查、不关票、不推送，T-140提示词、图标与邮箱不修改。

### 改前用量（只读已有记录）

2026-10-09，运行以下命令，不调用模型。完整拆分、来源及不一致记录在 `artifacts/t138/baseline-usage.json`：

```bash
node --experimental-strip-types scripts/analyze-code-usage.ts \
  /Users/luckye/Documents/Code/sitecraft-ai-t133/artifacts/t130/round-2026-10-08T07-59-10-005Z \
  /Users/luckye/Documents/Code/sitecraft-ai-t132/artifacts/t130/round-2026-10-08T13-55-52-008Z \
  /Users/luckye/Documents/Code/sitecraft-ai-t134/artifacts/t130/round-2026-10-08T18-08-06-860Z \
  /Users/luckye/Documents/Code/sitecraft-ai-t135/artifacts/t130/round-2026-10-08T19-20-37-063Z \
  > artifacts/t138/baseline-usage.json
```

采用 `private/case-N/code-site.json` 的逐次调用；没有候选记录的未运行项使用原轮次记录。输入与输出均为上游报告，输出包含推理，不把推理再加到总量。

| 轮次 | 用途 | 次数 | 输入 token | 输出 token | 合计 token |
| --- | --- | ---: | ---: | ---: | ---: |
| T-133 | plan | 8 | 31,648 | 12,746 | 44,394 |
| T-133 | write | 13 | 107,017 | 281,686 | 388,703 |
| T-133 | facts | 13 | 45,216 | 125,856 | 171,072 |
| T-132 | plan | 8 | 36,848 | 14,686 | 51,534 |
| T-132 | write | 19 | 223,550 | 441,516 | 665,066 |
| T-132 | facts | 19 | 80,246 | 189,379 | 269,625 |
| T-134 | plan | 8 | 31,896 | 12,846 | 44,742 |
| T-134 | write | 20 | 212,808 | 393,823 | 606,631 |
| T-134 | facts | 22 | 98,038 | 232,448 | 330,486 |
| T-134 | polish | 5 | 100,469 | 125,298 | 225,767 |
| T-135 | plan | 4 | 17,572 | 10,007 | 27,579 |
| T-135 | write | 6 | 59,761 | 103,547 | 163,308 |
| T-135 | facts | 6 | 17,650 | 41,735 | 59,385 |

| 轮次 | 已报告总量 | 每个已启动站平均 | 修正用量（含后续事实校对） | 修正占比 | 最终拒收 |
| --- | ---: | ---: | ---: | ---: | --- |
| T-133 | 604,169 | 75,521（8站） | 173,413 | 28.7% | 0/8；8站生成 |
| T-132 | 986,225 | 123,278（8站） | 426,961 | 43.3% | 0/8；8站生成 |
| T-134 | 1,207,626 | 150,953（8站） | 466,204 | 38.6% | 汇总为2/7；4生成、1错误、1未运行，最后候选仍为 running |
| T-135 | 250,272（部分） | 62,568（4站，含被阻塞项） | 92,229 | 36.9% | 0/3；3生成、1被402阻塞、4未运行 |

T-134 原 `round.json`/`report.json` 只有 1,091,963 token，最后一站只登记 plan；候选快照另有 115,663 token。票原有“122.5万”是历史概要，现有调用记录只能核实上述 120.8 万，不补造缺失用量，也不把 running 算成功。生成阶段修正 265,515，打磨后修正 200,689；首轮打磨与随后的事实校对不算修正轮。

T-133/T-132/T-134 的 34/46/55 次调用都没有推理用量记录。T-135 的 15 次有记录调用报告推理 110,764，占这些调用输出 155,289 的 71.3%；另1次失败调用未知。规划/事实校对无非思考模式或低上限的同输入成对证据，因此保留思考模式与 65536 上限；不以重放旧回答代替模型能力对比。新增记录只保存上游推理 token 数，不保存思考文字。

### 内容非思考对照与用途决策（t138b-thinking）

REALITY GATE：参数、只读用量和真实省量证据PASS，全内容非思考质量NO_GO。目标是降低内容调用的推理成本；不改模型、资料、提示词、图标、输出上限或规划strict协议。合并后四站都存版、首稿拒收2/4；只按主控放行跑两站真实快速档一次，失败/402一次即停，保留所有拒因和用量。执行者只做技术自查、不派盲评；独立盲评与定向事实实验已否决非思考write/facts，不能以存版或空issues外推质量。

源目录只读：`/Users/luckye/Documents/Code/sitecraft-ai/artifacts/t130/round-2026-10-09T07-04-36-535Z/private`，轮次提交 `321e956`。命令 `node --experimental-strip-types scripts/analyze-code-usage.ts <该轮目录>`，本次结果 `artifacts/t138b/baseline-usage.json`、`thinking-breakdown.json`；汇总与候选快照无差异，16/16调用均报告推理用量。推理是输出的子集，不额外加进 total。

| 用途 | 调用 | 输入 | 输出 | 推理 | 推理/输出 |
| --- | ---: | ---: | ---: | ---: | ---: |
| plan | 4 | 34,889 | 10,995 | 8,141 | 74.0% |
| write | 4 | 42,395 | 142,993 | 111,797 | 78.2% |
| facts | 6 | 38,328 | 102,222 | 101,778 | 99.6% |
| repair | 2 | 16,729 | 18,627 | 18,363 | 98.6% |
| 合计 | 16 | 132,341 | 274,837 | 240,079 | 87.4% |

推理占总407,178的59.0%。拟对照的工业/precision：总119,703，输出81,676、推理72,319（输出88.5%）；纸包装/documentary：总135,791，输出93,870、推理85,090（输出90.6%）。两站总255,494、平均127,747；首稿各拒收一次，最终均存版。工业拒因是把“铭牌照片”改成“铭牌”；纸包装两条拒因把纸盒的白样/印刷确认流程套到内托，修正后均消除。完整文字保留在 `thinking-breakdown.json`，对照须按站核对首稿/最终拒收、事实拒因和新增/漏检事实问题。

2026-10-09核对 [DeepSeek 官方 API](https://api-docs.deepseek.com/api/create-chat-completion/)：`thinking: {type: "disabled"}` 关闭思考，默认enabled；显式 `max_tokens` 可保留65536，JSON模式仍要明确指示JSON。下列两站对照使用的共用开关 `SITE_CODE_CONTENT_THINKING` 已删除，当前按用途决定：write固定enabled，facts默认enabled（显式诊断可用 `SITE_CODE_FACTS_THINKING=disabled`），repair默认disabled（可用 `SITE_CODE_REPAIR_THINKING=enabled`）；plan永远enabled和beta strict，select保持现状。用途开关非法值在该调用付费前拒绝，不静默回退。调用记录实际请求模式，健康接口 `deepseek.codeContentThinking` 返回write/facts/repair的模式映射，不再返回共用模式。

本地协议测试 `CHROME_PATH=<AGENTS指定路径> node --test --experimental-strip-types tests/t138-thinking-mode.test.ts`：旧实现两项失败（缺thinking参数、非法配置仍调用）；修改后通过，并确认 strict规划不变、write/repair/facts使用disabled、原JSON/65536预算保留、402只调用一次。日志 `artifacts/t138b/mode-{red,green}.log`。T-128/T-129/T-130/T-133/T-135/T-136/T-137/T-138相关135项通过、0跳过（`related-first.log`），typecheck/build通过（`typecheck-first.log`、`build-first.log`）。本地夹具证明协议，不证明非思考模式质量。

跑前估算两站合计约7–10万 token：按旧首稿路径不变、扣除内容推理约72,910；若重复旧修正次数，约102,571。不是硬预算，输出/修正轮变化可能超过；最多14次调用、每次上限65536，仅输出硬上限917,504，另加输入。主控放行工业/precision、纸包装/documentary两组合、首页+产品页一次，与旧两站的同资料/风格/滑杆严格配对；旧记录不改。新增 `--only` 只筛选组合及对应官网对照，默认矩阵、资料、提示词与比较规则不变。`only-red.log` 在未支持该参数的实现上失败，`only-green.log` 两项通过（含空值、重复和档位不匹配拒绝）。只读旧记录导出到 `artifacts/t138b/thinking-baseline-pair`，只缩减cases/controls，不改原case内容；本地 `--prepare-only` 核对两份资料逐字符一致、两个官网对照复用、模型调用0，生成未运行故结果如实为INCOMPLETE。3150健康接口确认本工作树、development-file、deepseek-flash、内容模式disabled；记录 `health-disabled.json`。此估算不代替下列实测。

2026-10-09 08:59:35～09:01:44 UTC，代码提交 `2ed0fc8`（本提交amend前；实测后仅更新文档），真实命令如下，结果在 `artifacts/t130/round-2026-10-09T08-59-35-620Z`，日志 `artifacts/t138b/real-pair.log`。3150服务使用规定的source方式加载密钥，`SITE_STORE=fs SITE_CODE_CONTENT_THINKING=disabled`，默认Turbopack。运行记录dirty=false；全部7次调用HTTP 200，无重跑或重试；两个规划仍enabled/strict，5次内容调用均disabled。旧官网对照截图复用，没有另调思考站。

```bash
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell \
SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:3150 \
node --experimental-strip-types scripts/eval-new-route.ts --base http://127.0.0.1:3150 \
  --quick --only industrial/precision,packaging/documentary \
  --previous artifacts/t138b/thinking-baseline-pair \
  --out artifacts/t130/round-2026-10-09T08-59-35-620Z
```

| 同资料两站 | 思考总token | 非思考总token | 下降 | 首稿拒收（前→后） | 最终拒收（前→后） |
| --- | ---: | ---: | ---: | --- | --- |
| 工业/precision | 119,703 | 37,198 | 68.9% | 1→0 | 0→0 |
| 纸包装/documentary | 135,791 | 47,166 | 65.3% | 1→1 | 0→0 |
| 两站合计/率 | 255,494 | 84,364 | 67.0% | 2/2→1/2 | 0/2→0/2 |

| 本次用途 | 次数 | 输入 | 输出 | 合计 |
| --- | ---: | ---: | ---: | ---: |
| plan（思考） | 2 | 17,141 | 5,117 | 22,258 |
| write（非思考） | 2 | 20,727 | 19,295 | 40,022 |
| facts（非思考） | 2 | 13,193 | 10 | 13,203 |
| repair（非思考） | 1 | 8,728 | 153 | 8,881 |
| 合计 | 7 | 59,789 | 24,575 | 84,364 |

本次规划报告推理3,629；非思考响应未提供reasoning用量，记录为未知，不补造实测0。逐站成对数据、相同资料/滑杆核验、拒因和截图路径在 `artifacts/t138b/paired-result.json`；两站骨架也分别沿用 capability-led / two-businesses（规划卡顺序仍按既有逻辑随机，不固定模型答案）。`nonthinking-usage.json` 来自 `node --experimental-strip-types scripts/analyze-code-usage.ts <本轮目录>`。

事实拒因对照：旧工业要求“铭牌照片”被省成“铭牌”，本次首页/产品询价段保留“铭牌照片”；旧纸包装把纸盒白样/印刷确认扩至内托，并错误比较两线白样内容，本次把纸盒白样/印刷与内托模具/样品分别列明。非思考两次事实校对均返回空issues（各5输出token），本次报告事实拒因0；纸包装首稿因home/products链接目标 `/contact` 不存在被拒，未进入首稿事实校对，局部修正后才校对通过。空issues不能证明没有漏检；上述仅针对旧拒因的文字抽查，不是完整独立事实评审。

四张首页截图均已打开：本轮 `private/case-1/home-{1440,375}.png` 为工业，`private/case-2/home-{1440,375}.png` 为纸包装；没有空白、未加载图片、可见截断或明显溢出。两页×375/768/1440的最终入口检查，溢出/重叠/对比度问题均0。行长属于建议：工业跨页/视口计数0→4，纸包装29→11；因此不把“存版”当成质量不下降。评审包和成对比较包齐备，未派审查，company因每种风格仅一站没有换公司题。

两站对照时的 `npm run typecheck`、`npm run build` 均PASS（`typecheck-pair.log`、`build-pair.log`），T-128/T-129/T-130/T-133/T-135/T-136/T-137/T-138相关136/136、0跳过（`related-pair.log`）。只停本执行者3150进程，保留原失败与预检产物。下述独立比较否决非思考写页，定向事实实验否决非思考校对。

主控提供的独立盲评：新gpt-6.1-sol实例，结果 `/Users/luckye/Documents/Code/sitecraft-ai/artifacts/blind-thinking-2026-10-09/result.json`；解盲key同目录 `bthink-key.txt`。工业选Y=思考，理由是图片与内容更丰富、层级更清楚；纸包装选X=思考，理由是首屏关键条件和信息顺序更清楚。执行者不另派盲评、不重跑生成；据此write固定保持思考。

主控授权facts实验跑前估算2～3万token（原六次思考输入17,715、合计62,009；非思考预计较短输出，另加两个干净输入）。只读 `tests/fixtures/t133/pricing-candidates.json`，其来源为T-133基线case-7/8 R0；六次坏候选完整原码不改。预期来自Astra及原资料：case-7“两类分别报价”，case-8“分开报价”“报价也分开算”“报价按产品分开算”，每次全部目标须拒收，不用别的拒因充数，目标不传给模型。

先用现有完整检查入口做本地预检：case-7因原码数字4被当前手写数字检查拦住，facts未调用、费用0，保留 `artifacts/t138b/facts-nonthinking-2026-10-09/`；不把数字拒因当报价成功。本次指定的是事实校对能力，因此直接调用生产 `auditCodeFacts`：浏览器提取完整各页正文/标题、页头页脚一次、辅助属性与三档CSS生成文案，连同未改的原资料输入。不存在删句、关键词硬拦、模型夹具或提交存版；结果只证明事实校对，不能冒充完整提交验收。

2026-10-09，代码基于 `cfdb56e`（干净原模式实现，设disabled），分别运行：

```bash
set -a; source /Users/luckye/Documents/Code/sitecraft-ai/.env.local; set +a
SITE_STORE=fs SITE_CODE_CONTENT_THINKING=disabled CHROME_PATH=<AGENTS指定路径> \
  node --experimental-strip-types artifacts/t138b/check-nonthinking-facts-direct.mjs \
  artifacts/t138b/facts-nonthinking-2026-10-09-direct
SITE_STORE=fs SITE_CODE_CONTENT_THINKING=disabled CHROME_PATH=<AGENTS指定路径> \
  node --experimental-strip-types artifacts/t138b/check-nonthinking-facts-case8.mjs \
  artifacts/t138b/facts-nonthinking-2026-10-09-case8
```

case-7原定三次完成后，最初控制候选返回拒因超长（schema max500），保留格式错误，未重跑这次回答；case-8仅继续剩余四个预定样本，不重跑case-7。两次初始控制都复制了内部“首屏可用事实”字段标签，不是合格干净样本；另一次还错误要求“待补充”必须改为“资料未提供”。保留两次尝试及其6,345 token，不以它们证明干净候选行为。纠正控制夹具，只去掉内部字段标签、保留其余原资料引用及缺口占位，再各运行一次，额外估算4,000 token并已在运行前汇报；不是重试同一模型请求。纠正后的完整四页无新企业事实，两个cases资料相同，故使用相同干净候选：

```bash
SITE_STORE=fs SITE_CODE_FACTS_THINKING=disabled CHROME_PATH=<AGENTS指定路径> \
  node --experimental-strip-types artifacts/t138b/check-nonthinking-facts-clean.mjs \
  artifacts/t138b/facts-nonthinking-2026-10-09-clean
```

| 样本 | 调用数 | 目标句拒收/干净通过 | 输入 | 输出 | 总token |
| --- | ---: | --- | ---: | ---: | ---: |
| case-7原始坏候选 | 3 | 0/3，均issues=[] | 8,184 | 15 | 8,199 |
| case-8原始坏候选 | 3 | 0/3，三条目标均漏，issues=[] | 7,938 | 15 | 7,953 |
| case-7合格干净候选 | 1 | 1/1通过，issues=[] | 1,936 | 5 | 1,941 |
| case-8合格干净候选 | 1 | 1/1通过，issues=[] | 1,936 | 5 | 1,941 |
| 合格8次样本合计 | 8 | 非思考facts NO_GO | 19,994 | 40 | 20,034 |
| 两次无效控制（保留） | 2 | 不作合格干净证据 | 3,882 | 2,463 | 6,345 |
| 实际总用量 | 10 | 全部HTTP200，无模型重试 | 23,876 | 2,503 | 26,379 |

逐次时间、原句覆盖、完整返回拒因/格式错误及调用用量在上述目录的case文件和summary；整合 `artifacts/t138b/facts-purpose-result.json`。全部实际调用均facts/disabled，未报告推理数，不补造0。定向六次全漏即足以否决默认非思考，不外推其他事实可靠性；按主控条件保留facts默认思考，只设repair默认非思考，不再追加真实调用。

用途模式回归在改生产代码前的 `cfdb56e` 上三项均失败：repair默认仍enabled、分用途开关不起效、非法分用途配置仍调用（`purpose-mode-red.log`）。修后协议与完整提交相关集137/137、0跳过（`related-purpose.log`），涵盖write始终思考、facts默认思考/显式诊断、repair默认非思考/显式开启、strict规划不变、非法值付费前拒绝、402只调用一次。`npm run build`、`npm run typecheck` PASS（`build-purpose.log`、`typecheck-purpose.log`）；生产facts提示原文及输出预算未改，没有用强化提示或降阈值掩盖漏拦。本次不重跑生成质量评估，最终默认矩阵及提交记在 `verification-purpose.json`。

### 改动与本地证据

本地合并：`git merge --no-commit family-kit-assembly`，两父提交为 T-138 `b8174f0` 与本地主线 `6f069ee`。四处冲突均按行为合并：`lib/code-site.ts` 同时保留 skeleton/skeletonOrder、response 结束原因/回答长度/推理元数据及 repair 用途、usage.reasoningTokens、repairFailure；T-128/T-130 的 provider 夹具同时支持 strict `submit_page_plan` 与局部修正 JSON，并保留原计数、拒收、版本、用量断言。T-136/T-138 规划夹具适配同一 strict 协议，T-136 历史长纲完整拆为每项不超过120字的数组，不截断、不放宽生产 schema。T-129 保留原区域与版本断言：初稿携历史参考，repair 不再重传整站。自动合入的生产模型代码保持唯一调用入口：规划走 beta strict 函数输出，其余 JSON 调用保留首稿事实红线与 DOM/字符区间修正。资料/全部图片、事实去重、快速档及分用途统计均保留。

合并后运行 `CHROME_PATH=<AGENTS指定路径> SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:3150 node --test --experimental-strip-types tests/t128-*.test.ts tests/t129-*.test.ts tests/t130-*.test.ts tests/t133-*.test.ts tests/t135-*.test.ts tests/t136-*.test.ts tests/t137-*.test.ts tests/t138-*.test.ts`，133/133、0跳过（`merge-family/related-final.log`）。联合断言核对 skeleton 保存/8张卡顺序/strict tool_calls 元数据与 write→facts→repair 的用量记录；两种推理元数据均保留。用 TypeScript AST 检查 T-138 原断言及 T-135/T-137 相对共同基点新增的断言，缺失0（`branch-assertion-preservation.json`）。另跑资料包与图片覆盖两文件，12/12（`dependencies-with-server.log`）；第一次附加检查被本执行者提前停3150做build而中断，失败日志保留，恢复同一服务/场景后重新检查，没有换输入或放宽断言。`npm run typecheck`、`npm run build` 通过（`typecheck-final.log`、`build.log`）。所有日志位于 `artifacts/t138/merge-family/`，记录时间见 `verification.json`。真实模型、真实快速档与全仓测试本次均未运行。

首稿提示显著禁止无来源的承诺、报价、交期、付款、售后和认证说法。修正调用使用 `repair` 用途，只发送资料、拒因和对应 DOM 节点：text/title 是纯文字，Text 节点按文字区间写入、由 DOM 转义；element 是原层级的一个完整元素，标签须闭合；style 是一个完整、无属性的 style 元素，CSS 须闭合。布局只发送叶子元素和公共样式，避免祖先重复带整页。模型输出不得按 HTML 字符位置拼接。未知编号、重复编号、重叠/变化的节点、整站 JSON 和定位不到的拒因明确失败。只有拒因全部属于入口已完成的清理、没有剩余节点时，允许模型明确返回空替换；未知拒因不能借这个分支通过。

文字修正按实际 Text 节点分组，每组按原始偏移倒序应用，其他节点插在提案中不能改变应用顺序；同节点区间重叠直接拒绝，相邻区间允许。范围核验不跳过整个 Text 节点，而是根据原区间、修正长度分别提取修改前后的未选字符区间（前缀、间隙、后缀），逐段核对所有字符；同时核对新长度与每个选中区间的实际结果。元素整节点替换仍只排除该元素子树。修改前后核对范围外 DOM 的节点类型、文本、属性、命名空间与注释，再从完整候选重新解析每页，对照独立以 DOM 节点构建的预期文档。越界回复立即终止，完整回复与拒因保存在 `run.repairFailure`，不重发、不存版。通过后仍由原 `commitSiteCode` 清理、事实校对和三档检查，最多两轮。公共页头页脚在校对文本中各保留一次，页面标题、正文、辅助属性及 CSS 生成文案仍完整检查。

- `CHROME_PATH=<AGENTS指定路径> node --test --experimental-strip-types tests/t138-token-repair.test.ts`：改前整站写作3次，期望1次而失败；改后首稿1次、局部修正2次，第一次修正的新承诺被真实提交入口拒收，第二次才存版。页头页脚重复校对检查由3次对2次的失败转为通过。红态分别保存于 `artifacts/t138/original-rewrite-red.log` 和 `artifacts/t138/facts-dedup-red.log`；最终受控运行记录保存在 `artifacts/t138/repair-*/result.json`。
- Astra 的 P1 原始复现 `artifacts/t138/repair-c9db80bf-b1c8-488a-ba70-901723939984/result.json` 保留：`<!--` 吞掉“不接食品接触零件”却存版。2026-10-09 用 `CHROME_PATH=<AGENTS指定路径> node --test --experimental-strip-types tests/t138-dom-scope.test.ts` 在 `fc11345` 重现，9项均失败，日志 `p1-dom-red.log`；原因都是 HTML 被解释或越界回复创建了版本，没有环境或导入错误。
- Astra 在 `0cb64dd` 的复现 `artifacts/t138/dom-scope-a396023d-*/independent-interleaved-text.json` 保留：A1→B→A2 改坏同一文本节点内未被拒的“不接食品接触零件”仍存版。2026-10-09，`CHROME_PATH=<AGENTS指定路径> node --test --experimental-strip-types --test-name-pattern='interleaved|adjacent' tests/t138-dom-scope.test.ts` 在该提交上复现：正向交错文字错误存版，正向相邻区间多一轮错误修正，反向通过；红态 `p2-interleaved-red-complete.log`。提案次序改变结果的根因是跨节点比较器不构成全序，范围核验又跳过了整个 Text 节点；两个机制均已在原层修正，没有用事实校对兜底。
- 本次相关40项通过（0跳过），`artifacts/t138/p2-related-frozen.log`。包括正/反交错提案、正/反相邻区间（含删除）、部分重叠区间与原13项完整提交安全检查。交错与相邻案例一次修正后真实存版、三档全部检查，未选字符及其他页面保持；同节点部分重叠直接拒绝。原 `<!--`、`</p><p>`、`<script>`、未闭合标签作为 text 只显示文字；作为 element 则拒绝并保存回复；完整标签重解析后越界仍拒绝；合法单元素与完整 style 可存版，未闭合 CSS 不能。原版本恢复、长拒因、失败完整归档断言保留，清理后空替换仍检查三页×三档。
- 字符范围守卫独立故障注入：只删除未选范围的“不”并补句号，保持总长度和选中区间内容不变，真实提交仍拒绝且留 `repairFailure`（`p2-corruption-guard-green.log`）；恢复“整节点跳过”的坏实现会把错误候选存版，测试失败（`p2-mutant-skip-text-red.log`）。故意改组内正序也失败（`p2-mutant-ascending-red.log`）。测试过程向节点目录注入合法定位但重叠的第二区间，完整提交直接拒绝（`p2-overlap-submit-green.log`）；去掉重叠守卫则不能给出直接重叠拒因，回归失败（`p2-mutant-no-overlap-red.log`）。命令：`P2_MUTANT=<corrupt|skip-text|ascending|overlap|no-overlap> T138_RANGE_CORRUPTION=1`（overlap 用 `T138_RANGE_OVERLAP=1`，ascending 不设两者）`NODE_OPTIONS='--import <本工作树>/artifacts/t138/p2-mutants.mjs' CHROME_PATH=<AGENTS指定路径> node --test --experimental-strip-types --test-name-pattern='interleaved.*forward' tests/t138-dom-scope.test.ts`。故障只作用于测试进程，工作树不被替换。
- 运行反例：`P1_MUTANT=<reparse|syntax|css> NODE_OPTIONS='--import <本工作树>/artifacts/t138/p1-mutants.mjs' CHROME_PATH=<AGENTS指定路径> node --test --experimental-strip-types --test-name-pattern=<reparents|element repair.*span|unclosed stylesheet> tests/t138-dom-scope.test.ts`。去掉整站重解析、元素闭合或 CSS 闭合验证，对应测试均因坏候选存版失败；日志 `p1-mutant-{reparse,syntax,css}.log`。loader 只改测试进程读入的源码，不改工作树；原 fc11345 失败及早期反例日志仍保留。
- `CHROME_PATH=<AGENTS指定路径> node --experimental-strip-types artifacts/t138/p1-context-replay.ts`：改动后已有29个被拒候选均可定位；原整站代码上下文558,023字符，节点上下文86,382字符，减少84.5%。结果 `p1-context-replay.json` / `p1-context-summary.json`；只证明代码上下文缩短，不能当作真实 token 降幅、修正成功率或美观通过。
- 2026-10-09 本次修改后的验证（运行时 HEAD 为 `0cb64dd`，工作树含文字区间修复，amend 结果与运行时间记在 `verification-p2.json`）：`npm run typecheck`、`npm run build` 通过，日志 `p2-typecheck-frozen.log`、`p2-build.log`。相关命令：`CHROME_PATH=<AGENTS指定路径> node --test --experimental-strip-types tests/t138-dom-scope.test.ts tests/t138-repair-fragments.test.ts tests/t138-token-repair.test.ts tests/t130-run-records.test.ts tests/t129-version-history.test.ts tests/t136-session-summary.test.ts tests/t130-model-usage.test.ts tests/t138-quick-eval.test.ts`。原截图仅是 fc11345 的受控夹具证据，本次以完整提交与实际 DOM/字符检查为准，不引用旧图宣布本次通过。
- 本次按主控要求跑相关检查，未重跑全仓测试。原 `npm test` 为2596/2598、0跳过（`artifacts/t138/test-final.log`），不是本次改动的全仓通过证据：T-090 缺旧站点 `561a1113-4dab-49b6-81dc-ab7e3eb712a5` 文件，T-113 固定旧站点图片接口404。仍不搬其他树数据、不改检查或跳过它们；全仓测试不能写成 PASS，不因两项旧检查阻塞本票页面质量工作。原失败证据均保留，只停止本执行者的进程。

### 待合入主线的唯一联合真实运行

快速档固定工业/precision、外贸/documentary、注塑/precision、纸包装/documentary，只请求 `home` 与 `products`。来源事实不截断，图片许可和原提交检查照常运行；四份真实官网对照。`--quick` 与整轮互不成对比较；模型失败（含402）一次即停止后续组合，不自动重发。

T-138 单票原粗估18–26万 token，依据 T-133 对应四组合首稿/规划/校对已花219,825 token，截取首页与产品页后代码体积为原站80–96%。这不是合入 T-137 资料加厚与 T-135 骨架卡后的费用承诺，联合运行前须由主控按合并后的输入重估；不把页数减半当作用量减半。无修正12次调用，全部两轮修正最多28次；现有每次输出上限65536，合计输出硬上限1,835,008 token，另加输入，长推理或多轮拒收可超估算。

与 T-133 全8站平均相比，下降三分之一要求快速档平均不超过50,347；对应四个风格组合的原平均69,523，较严格的对应组合目标为46,349。页数改变，二者仅是费用参照，不是同输入成对效果或审美证据。待实跑补改后分用途用量、最终拒收率和是否达标；未放行前不勾选第一项。Astra 审查由主控另派，执行者不派。

主控指示：三票审过并一起合入主线后，才由主控在主线服务上运行一次，用量与质量同时验证。本执行者不运行，3150 单票命令不是当前待执行项。命令形式为：

```bash
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell \
SITECRAFT_BASE="$SITECRAFT_BASE" npm run eval:new-route -- --quick
```

服务密钥仅用 `set -a; source /Users/luckye/Documents/Code/sitecraft-ai/.env.local; set +a` 加载到进程；`SITE_STORE=fs`，默认 Turbopack。此候选尚未真实测 DeepSeek 修正、省量与拒收率；不宣称审美通过。

### 合并验收（Claude，2026-10-09）

Astra：fc11345 NO_GO（`<!--` 吞正文）→ 0cb64dd NO_GO（同节点交错修正偏移错）→ b8174f0 PASS（t138-astra3）；与主线冲突由执行者合并为 7191b42，主控合并为 321e956，主工作区 2637/2637、typecheck、build 通过。合并后快速档（主控，2026-10-09 03:04–03:22 EDT，主线 321e956，3034，`npm run eval:new-route -- --quick`，目录 `artifacts/t130/round-2026-10-09T07-04-36-535Z/`）：4/4 存版，首稿拒收 2/4、最终 0/4；用量 407,178 token（plan 45,884 / write 185,388 / facts 140,550 / repair 35,356），单站平均 101,794（工业 119,703、外贸 75,061、注塑 76,623、纸包装 135,791）。骨架：capability-led 2、two-businesses 2。独立盲评（新 gpt-6.1-sol 实例 bq-m / bq-c，结果 `artifacts/blind-quick-2026-10-09/`）：mixed 生成页识别 4/4、真实官网误判 0/4；company 判同模板 0/2。评审理由：页面直接显示「待补充」、`.example` 占位邮箱、全站同一纸飞机图标、页头与首屏重复询盘按钮、对称分栏细线参数行。

**第一项未达标**：单站平均 101,794，高于目标约 50k，也高于 T-133 整站平均；只生成两页但资料加厚后输入变长，且写页输出以推理为主（工业站 119,703 中输出 81,676）。最终拒收未上升（0/4）。票保持 open，下一步见主控对负责人的建议。

### 结项（Claude，2026-10-09）

T-142 合并后快速档（`artifacts/t130/round-2026-10-09T10-14-09-315Z/`，主线 194b31e）：4/4 存版，首稿拒收 1/4、最终 0/4；单站平均 91,318 token（plan 46,097 / write 192,803 / facts 117,056 / repair 9,317），骨架 capability-led 1、two-businesses 2、product-atlas 1。盲评（新实例 bq2-m / bq2-c，`artifacts/blind-quick2-2026-10-09/`）：mixed 4/4 被认出、company 0/2。按 T-143 调整衡量标准后结项，代码已在主线；未达成的验收项如实保留未勾选。

