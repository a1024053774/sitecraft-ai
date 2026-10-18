---
id: T-180
title: 页面质量基线轮：全矩阵真实生成 + 独立盲评，找出下一批质量缺口
type: build
status: open
blocked_by: []
claimed_by: Codex（T-180 重跑 fast）
supersedes:
---

## Why

2026-10-18 T-179 关闭后 frontier 为空。10-09 之后的工作集中在「修改」流程（T-162～T-179），生成页面质量（优先级 1）没有再做整轮评估；提交入口、出处、事实核对、风格登记等都已变化。负责人 2026-10-18：「你跑吧，预算不限，deepseek 给了赠金」。

## What to build

1. 在主线最新提交上，用标准评估入口 `npm run eval:new-route` 跑**整轮默认矩阵**（7 家公司 × precision/documentary 整站），`--previous` 指向最近一次同档整轮（没有同档整轮就如实记录无对照）。
2. 另跑一轮 `--only`，覆盖 editorial 与 neighborly 两种已登记风格：采用构思主控 2026-10-18 选 A 的六组合：education/editorial、design/editorial、restaurant/editorial、restaurant/neighborly、education/neighborly、design/neighborly；共 3 家公司、6 个 case、6 份对照，选择理由见 Resolution。
3. 真实生成走预算网关，显式 `SITECRAFT_TOKEN_LIMIT=3000000`（负责人授权不限额，此为本票封顶，用完即停报构思主控）；每轮实际用量写进 Resolution。
4. 盲评由构思主控另派实例；本次执行者不开审查或盲评实例，不读取 `review/` 包内容。`review/mixed/`、`review/company/` 与 `comparison-review/` 分别交互不读其他包的新实例，`private/` 映射由主控保管。
5. 汇总：把盲评结论按「同类问题出现在几个站」排序，列出前 5 个质量缺口，每个附代表截图路径与站点 ID；技术检查（提交入口拒收、底线失败、机械反馈）单独列。结论交构思主控开后续修复票。本票不改代码。
6. 生成成功的站由构思主控复制进主目录 `.sitecraft-data`，站名加「（质量基线 10-18）」，方便负责人在 3034 查看；本次执行者不写主目录数据。

## Acceptance

- [x] 两轮评估的命令、提交、时间、用量、成功/失败站数写进 Resolution；失败站保留失败记录，不重跑掩盖
- [ ] 三份独立盲评结论原文路径与汇总的前 5 个质量缺口写进 Resolution
- [ ] 生成站已复制进主目录且 3034 可打开；构思主控据此开出后续票

## Resolution

**INCOMPLETE。** 两轮真实生成与记录已完成：18 站 generated、2 站 error；两轮评估器均 exit=1，盲评包不完整。本票只改记录，不改代码、不推送；盲评及主目录站点复制由构思主控负责，执行者只打开 private 截图核对非空，不判审美。盲评与后续票尚未交付，票保持 open。

**第一次运行（历史）。** 2026-10-18，源码 `447332073fadec72a0551cf985cbc318698d94b5`，默认 full 14 组合与旧版所选 6 组合共 20 站全部事实协议失败、无版本：17 个 noFacts=false 却无七类高风险类别、2 个回复格式或编号异常、1 个出处不属当前段。累计 1,681,673 token；失败及用量证据已移到主目录 `/Users/luckye/Documents/Code/sitecraft-ai/artifacts/t180/` 和 `/Users/luckye/Documents/Code/sitecraft-ai/artifacts/t174/t180-quality-baseline/`，不覆盖、不作成功对照。T-181 已修提示及 claim 复制歧义并合入主线，未捕获的旧回复不补造。

**本次重跑。** 分支 `t180-quality-baseline-r2`，运行源码 `ff4a9643a6cbf8bf382e7349eafa628180718584`（T-181 已合并）。两轮使用当前工作树独立随机端口 dev、独立数据根与 `scripts/t153-real-budget.ts` 网关；真实密钥只在网关进程 source 主目录 `.env.local`，应用只持占位凭据。固定 CHROME_PATH；唯一新账本 `artifacts/t174/t180-quality-baseline-r2/usage.json`，累计上限 3,000,000 token，两轮共用、不重置、不另开；遇上游中断、HTTP 错误或预算停止即交回主控。失败站不重跑。

第 1 轮为默认 7 家 × precision/documentary 的 full 14 组合。第 2 轮按构思主控 2026-10-18 选 A 的以下六组合，full、滑杆默认 layout=5 / density=6，共 3 家公司、6 个 case、6 份对照：

| 组合 | 按资料选择的理由 |
| --- | --- |
| education/editorial | 课程前提、材料、练习顺序和学习须知有层次；无授权作品图，可用字阶、栏宽组织阅读。 |
| design/editorial | 服务交付与三条文字项目记录充分，作品图片未授权；可用排版展示任务、过程与交付。 |
| restaurant/editorial | 菜品分类、单人组合与分食热菜、米饭包含或单点口径、午晚供应时段及停止点菜时间均有明确原文，足以按菜单与到店须知分层排版。 |
| restaurant/neighborly | 面向附近居民与午休上班族，菜单价格、供应与停单时间明确，适合街坊日常查阅。 |
| education/neighborly | 课程费用、人数、材料自备和开放时间明确，可把课程选择与条件放在一起。 |
| design/neighborly | 小型品牌的三项服务有明确交付、周期与不包含事项，可直接帮助选择服务，不强造套餐价。 |

第二轮不用 packaging：邻里日常适合面向附近顾客的店，包装厂资料主要写给企业采购，硬套会低估风格本身。评估器 `scripts/eval-set-report.ts:210` 要求 mixed 池对照数恰等于 case 数；T-181 两站探针产生四份对照导致 exit=1，也是此约束。本票不改评估器。

**对照：两轮均无对照。** 已核查主目录 artifacts 的 2,197 份 private/round.json，保留 16 份有成功站或旧 T-180 的候选索引，未找到同 full 档、同矩阵且有成功站的整轮；见 `artifacts/t180-r2/previous-round-verification.json`。第一次全失败不能作对照；T-181 两站探针与旧 quick 四组合均不匹配。两轮不传 `--previous`；本次两轮自身也因矩阵不同而不能成对比较。评估器仍创建 comparison-review 目录和空任务，但两轮 paired=0、comparison.requested=false；comparison.complete=true 只表示未请求时没有缺图项，不代表有可用比较包。

**运行与用量。** 下表均为 2026-10-18 纽约时间（EDT，UTC−04:00），起止取真实进程启动与退出记录；两轮运行提交均为 `ff4a9643a6cbf8bf382e7349eafa628180718584`，dirty 仅本票。应用 `http://127.0.0.1:52424`，网关 `http://127.0.0.1:52425`，数据只在当前工作树 `.sitecraft-data`。health 核对 cwd/dataRoot，静态检查源核对 HTTP 200、HTML 类型、固定标记与无脚本，见 `artifacts/t180-r2/preflight.json`。主目录 3034 与用户数据未参与生成。

| 轮次 | 起止时间（EDT） | token（输入 / 输出） | 调用 | generated / error / not-run | 结果 |
| --- | --- | --- | ---: | --- | --- |
| 1：默认 full 14 组合 | 15:36:29–16:32:52 | 1,307,632（510,417 / 797,215） | 42 | 13 / 1 / 0 | INCOMPLETE，exit=1 |
| 2：指定 full 六组合 | 16:33:12–16:53:18 | 462,107（179,483 / 282,624） | 18 | 5 / 1 / 0 | INCOMPLETE，exit=1 |

唯一账本 `artifacts/t174/t180-quality-baseline-r2/usage.json` 从 0 连续记到 **1,769,739 / 3,000,000 token**，余 **1,230,261**；default/high 只是两轮账本标签，未改变风格或默认 5/6 滑杆。60 次上游调用均 HTTP 200、finish_reason 正常、未知用量 0，无上游中断或 HTTP 错误，没有用完预算、重置、另开账本或重跑失败站。逐轮用量与评估记录一致，见 `artifacts/t180-r2/completion-summary.json`、`round1-completion.json`、`round2-completion.json`。本次重跑累计不包含历史第一次运行的 1,681,673 token。

实际评估命令（两轮均不加 --quick、--previous）：

```sh
SITECRAFT_BASE=http://127.0.0.1:52424 SITECRAFT_TOKEN_LIMIT=3000000 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm run eval:new-route -- --out artifacts/t180-r2/round1-full
SITECRAFT_BASE=http://127.0.0.1:52424 SITECRAFT_TOKEN_LIMIT=3000000 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm run eval:new-route -- --only education/editorial,design/editorial,restaurant/editorial,restaurant/neighborly,education/neighborly,design/neighborly --out artifacts/t180-r2/round2-selected
```

**逐站结果。** generated 只表示提交检查通过、存版与截图完成，不表示独立审美通过。error 两站版本数均为 0。完整站点、失败候选、事实回复原文、资料映射、report 与 HTTP 记录均保存在各轮 private/；工作树数据根保留给主控复制。

第 1 轮：

| 组合 | outcome | 站点 ID | 版本 ID | token |
| --- | --- | --- | --- | ---: |
| industrial/precision | generated | `7741dc9b-535b-4003-bb61-a7a3d57ad7b9` | `400a8287-cdb0-4a05-ac4b-d7fe4a44e756` | 91,187 |
| industrial/documentary | generated | `121d8dd0-7fea-4eb6-a12d-1777eeab3f60` | `7afba2b1-229e-4685-b2ce-6af7a964dc94` | 79,243 |
| export/precision | generated | `54572abd-f372-41b6-8905-529fabcbbf98` | `d44a2045-2f3d-44d7-a1a7-a619ec5fd914` | 91,588 |
| export/documentary | generated | `af4b807c-c409-4926-a94a-64e76132da77` | `17c69728-c644-4033-b920-e6a6a22c4013` | 100,259 |
| molding/precision | generated | `44eb88e0-2960-4252-bd69-1aa3532c039e` | `39bb7796-b932-475b-ad7d-ac74eb9f98f4` | 113,119 |
| molding/documentary | generated | `f1f252f2-0870-4e9d-8025-76a3f1602926` | `7297b70a-13b8-4c92-af09-d850ff56b867` | 115,879 |
| packaging/precision | error | `be7c67d2-7dd7-46c4-8f1e-48bf0bf26352` | 无 | 125,108 |
| packaging/documentary | generated | `1ede4071-551f-42ad-ba56-536b65fb0951` | `24deaf77-e27b-4c6c-8351-359047e62f5d` | 106,616 |
| restaurant/precision | generated | `87467364-1cfb-45a0-a226-e009fa7ca5fe` | `825317c6-0da5-4489-b1f1-436898d3018b` | 91,070 |
| restaurant/documentary | generated | `02c1a6d0-fc14-4d12-a845-ee436c5489bf` | `1a6b069f-bf79-490f-a09e-3661d48433f2` | 84,895 |
| education/precision | generated | `7370ad15-91e5-4fc6-ad5c-40d619294101` | `f5a8538d-be9d-4b7c-807d-00a9f2b6cfff` | 70,431 |
| education/documentary | generated | `90bc3556-bfb8-4ebf-ac39-f5ecfb752190` | `fcbe8dd8-5a4e-4055-bea9-bf87774e9062` | 95,087 |
| design/precision | generated | `b6070731-0b0c-424d-9386-e8ee9463aea7` | `060561e8-e4dc-4d92-9f38-be5240054587` | 71,272 |
| design/documentary | generated | `c16fd0df-6fa2-4167-b38a-f7912f5dfa46` | `ced51061-f2ce-4eb2-84c6-f61f42c47a99` | 71,878 |

第 2 轮：

| 组合 | outcome | 站点 ID | 版本 ID | token |
| --- | --- | --- | --- | ---: |
| restaurant/editorial | generated | `21e191ea-1358-4966-a47d-ac6febc2df59` | `e30a11bb-78f5-4f43-b3b7-7c79565d9bfc` | 78,371 |
| restaurant/neighborly | error | `8935ca3a-ca0a-4663-9622-9670e734747e` | 无 | 90,762 |
| education/editorial | generated | `58f802d8-45bd-4bf7-9cc6-6042ae6c150e` | `ab0ef2c5-3358-4bf1-a927-70b039274303` | 75,621 |
| education/neighborly | generated | `2609b69e-3fe7-43d3-bb8e-a0f0426d7ee9` | `c7851260-5c95-4ea9-bde1-a939f05720ed` | 85,100 |
| design/editorial | generated | `8105526a-83dc-449d-afd6-9cb576f81506` | `b45db7b0-2eec-4ec0-a98e-14acc64a8ea1` | 61,037 |
| design/neighborly | generated | `6fdc0937-66ca-484a-a9bd-952f60e2d967` | `1d96a0f7-b3b6-4edb-b8de-c3522bc40d63` | 71,216 |

**技术失败与覆盖。** 第 1 轮 packaging/precision 的事实回复违反 claim 归属：`资料出处声明不在本核对段：折叠彩盒规格 折叠彩盒规格 [scope=row] 起订量 3000 个`；见 `round1-full/private/case-7/code-site.json` 中 facts 调用的 response.rawBody.body 与 59 段 factInput 映射。第 2 轮 restaurant/neighborly 的通用错误为“核对段回复格式或编号无效”，原文复查 40 个编号均齐全、无重复或越界；按当前 `lib/code-site-model.ts:340–343` 的原约束解析，实际错误是 `results[12].issues[0]` 为 object、合同要求 string。见 `artifacts/t180-r2/numbered-failure-analysis.json` 与 `round2-selected/private/case-2/code-site.json`。没有把该失败误写成已证实的编号遗漏；本票不修代码或放宽协议。

两轮落盘的提交检查分别覆盖 13 站/13 次与 5 站/5 次，均通过；这 18 站共 55 页、165 个页面视口检查。两处协议中断没有通过检查，不能按 20 站覆盖计算。生成站 183 张截图及 18 张官网对照均逐张解码后装入缩略总览并人工打开，仅确认非空，未判审美；清单与方法见 `artifacts/t180-r2/viewed-screenshots.json`，总览在同目录 `screenshot-self-check/`。原始截图均在各轮 private/，未读取 review/ 包内容。

机械质量反馈单列，不作审美结论或拒收：第 1/2 轮正文行长分别触发 10/4 站、101/20 次，未门控 hover 为 13/5 站、933/288 次，375 点击区偏小为 13/5 站、311/93 次，过窄文字列为 2/0 站、24/0 次；文字裁剪、锚点遮挡与产品图 cover 裁切均 0。反馈分母为已测的 13/5 站，发生次数跨页及视口累计；完整统计在各轮 private/summary.json。

**包路径与完整性。** 下列目录均已由原评估器生成，盲评尚未派发。两轮唯一官网失败都是 `https://www.bluefrog.com.cn/` 的入场或转场未结束，按原截图合同未保存，不补抓、不修网络；错误保存在各轮 private/round.json。第二轮虽按六个 case 安排六份对照，实际仅成功五份，数量不足如实保留。

| 轮次 | mixed 路径 / 实际样本 | company 路径 / 实际题数 | comparison-review |
| --- | --- | --- | --- |
| 1 | `artifacts/t180-r2/round1-full/review/mixed/`；13 生成 + 13 官网 = 26/28，缺 2 份 | `artifacts/t180-r2/round1-full/review/company/`；36/42 对，缺 packaging/precision 相关 6 对 | `artifacts/t180-r2/round1-full/comparison-review/`；0 对，未请求，无可用比较包 |
| 2 | `artifacts/t180-r2/round2-selected/review/mixed/`；5 生成 + 5 官网 = 10/12，缺 2 份 | `artifacts/t180-r2/round2-selected/review/company/`；4/6 对，缺 restaurant/neighborly 相关 2 对 | `artifacts/t180-r2/round2-selected/comparison-review/`；0 对，未请求，无可用比较包 |

两轮 `private/blind-coverage.json` 均为 complete=false、review.complete=false：各有一站失败缺图、官网对照不足及上述换公司题缺图，不能把现有目录宣布为完整可审包。执行者没有开审查或盲评实例，没有读取其提示词、任务或内容，也没有编造前五审美缺口。private 映射与原始结果继续由主控保管。

**收尾与交接。** 16:33:04 EDT 经真实 draft HTTP 读回第一轮 14 站全部 run 终态（`artifacts/t180-r2/terminal-observation-1.json`）。第二轮评估器退出后，16:53:26 再经真实 draft HTTP 读回 20 站全部 run 终态，60 次调用 complete、in-flight=0、未知用量=0（`artifacts/t180-r2/terminal-observation-2.json`）；随后手动 SIGTERM，停止网关 PID 70248 与本工作树 dev PID 70497。**16:53:33 EDT** 两个端口均 ECONNREFUSED，见 `artifacts/t180-r2/shutdown.json`；没有评估器退出即关网关的编排钩子。未停止主目录服务，未写主目录 `.sitecraft-data`，未复制站点、删除数据、使用 rm -rf 或推送。

本次只改本票；typecheck、npm test、build 未运行，不借用 T-181 旧绿灯。真实验收入口是上述两次 full eval，均 exit=1，失败与截图如实保留。project-map 状态检查无结构问题、无过时 living doc；本地提交本票记录后交回构思主控。独立盲评、审美前五缺口、主目录复制及后续票仍未完成，因此票保持 open。
