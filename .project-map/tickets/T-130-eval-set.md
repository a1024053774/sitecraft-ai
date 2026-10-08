---
id: T-130
title: 评估集与盲评命令：固定公司 × 风格一条命令生成，交独立评审对比
type: build
status: closed
blocked_by: [T-128]
claimed_by: t130-build
supersedes:
---

## What to build

一条命令用新路线为固定的评估集（至少 4 家模拟公司 × 2 个风格）生成整站，汇总每个站的底线检查结果和截图（1440 / 375），并按 T-104 的两种口径整理成盲评包：混排猜不出是否模板、换公司看不出同一模板。之后改核心规范、风格、提示或模型时，同一命令能生成新一轮并和上一轮成对比较。评审由独立 gpt-6.1-sol 新实例做，不由执行者做。

## Acceptance

- [x] 一条命令跑完整个评估集，输出目录里有每站的截图、底线检查结果、耗时和用量，以及命令本身
- [x] 盲评包里不暴露路线、风格或组别信息
- [x] 第一轮独立盲评结果（两种口径）写进 Resolution，作为后续比较的基线
- [x] Astra 代码审查通过；typecheck、test、build 通过

## Resolution

执行者：t130-build。状态 **INCOMPLETE**：充值后已单次跑完8个组合，5站底线通过并存版、3站最终拒收；5站截图均超时，完整交付0/8，盲评包 **BLOCKED**。按负责人指令保持 open，不派盲评/Astra、不关票、不推送。实现与本文在本票唯一的本地提交中，标题 `T-130: real-entry eval set and blind packages`；实际 SHA 见执行者交接。验证对象为 07c0e61 上本票差异，以下证据均在本次改动后生成，旧路线历史结果不作本票通过证据。

### 实现

`npm run eval:new-route` 经真实 `/api/sites` 创建、`/images` 上传、`/chat` 资料/结构化选择/确认、`/draft` 轮询与版本化 `code-preview`，没有导入 store/commit 或旁路写站点。工业、外贸、注塑、纸包装 × precision/documentary，滑杆 5/6，页面要求 3/5/5/4；第四家公司资料是明确标为模拟的纸包装采购资料。评估输入去掉旧探针后缀和核验记号，邮箱用保留域名，企业事实保持原义。大纲缩减页面数则不确认生成。

每次创建新目录并拒绝覆盖旧轮次，保留命令、HEAD/dirty、每站全部轮次检查与拒因、耗时、规划/写页/事实校对（含修正）的上游 token 用量；缺失 usage 是未知。首稿、逐轮、最终拒收率及行长/溢出/重叠等原因分别统计，未检查不计零拒收。模型 HTTP/网络失败停止剩余组合，不重试。匹配资料及公司×风格键比较上一轮，缺图/失败/未知用量明确报告；不兼容输入的拒绝原因也保存。

盲评输出按口径隔离：`review/mixed/` 与 `review/company/` 各有自己的任务、截图、提示词及查看页，分别交不同的新评审实例；跨轮整站比较在独立的 `comparison-review/`。每个实例只读自己的目录。映射、来源、运行与比较仍在 `private/`。mixed 是8份生成首页与8份真实官网组成的一池16个独立样本，每份真实官网只出现一次，不按公司配成三选一题；company 有12对，跨轮有8对。各包候选编号不复用，不能凭另一口径的公司身份推导来源。

身份描述、任务顺序及落盘顺序在写文件前完成：mixed来源、company风格分层打散；跨轮半数先写本轮、半数先写上一轮，具体候选随机选择。写完把全部文件与目录mtime/atime统一为同一时刻；包内PNG用私有附加块补到相同长度，画面保留，不能用文件大小排名恢复身份。执行者不做审美通过结论。

### 逐项验收与证据

| 验收项 | 当前状态 | 本次证据 |
| --- | --- | --- |
| 完整真实评估集、底线、截图、耗时/用量、命令 | INCOMPLETE | `artifacts/t130/round-2026-10-08T05-11-25-013Z/command.sh`、`private/round.json`、`private/summary.json`、`private/case-1/report.json` 至 `case-8/report.json`：8组合全部运行，22轮检查及39次模型调用用量完整；5站已存版但截图超时，3站最终拒收，完整交付0/8。详见下方首轮结果。 |
| 匿名盲评包 | BLOCKED（隐私检查历史 PASS） | 本轮 `private/blind-coverage.json` 为 complete=false：mixed仅8份真实官网对照、没有生成页；company为0对，不能交评审。Astra 对 a15ca3b 的两项P1修复证据仍在 `artifacts/t130/astra-fix/privacy-parent-red.txt`、`related-green.txt`，旧合包保留为失败证据。 |
| 第一轮两种独立盲评基线 | BLOCKED | 真实运行已完成，截图与完整包未完成；有效包齐备后由 Claude 安排独立 gpt-6.1-sol。执行者未派评审、未引用T-128历史盲评、未宣布审美通过。 |
| Astra、typecheck/test/build | INCOMPLETE（本地检查 PASS） | Astra 对 a15ca3b 判NO_GO；本次修复后 typecheck、默认Turbopack build及相关60/60通过，证据在 `artifacts/t130/astra-fix/`。独立复核由Claude安排，全量npm test仍由主控合并后在主工作区跑。 |

### 本次审查修复证据

候选基于 a15ca3b，修改与文档并入本票同一个amend提交，实际SHA见交接。源文件 UTF-8，旧失败与包均保留；没有重试真实DeepSeek，没有派审查，没有关票或推送。

- `CHROME_PATH=<指定路径> node --test --experimental-strip-types tests/t130-blind-privacy.test.ts`：旧实现 `privacy-parent-red.txt` 实测按目录birthtime猜生成页8/8命中，并因没有独立包失败；初次输入路径错误保留在 `privacy-red.txt`，不是有效红证据。新测试用24份许可照片经真实Chrome渲染成不同PNG；读取真实birthtime/mtime/atime/大小，用private映射检验排序攻击，包内PNG等长、时间一致，跨轮8对只4对先落盘本轮。统一时间曾用过早日期，macOS会随mtime调低birthtime；失败保留于 `privacy-green-initial.txt`，当前统一采用写完后的同一时刻。
- `CHROME_PATH=<指定路径> python3 scripts/check-t130-mutants.py` → `artifacts/t130/mutants-20261008T043656Z/report.json`：7个坏实现均exit1且为明确AssertionError，脚本拒绝把TypeError/SyntaxError当有效证据，finally恢复源码。覆盖丢早轮拒因、泄露style、来源先写、本轮先写、未统一时间、未统一PNG大小；丢用量变异只删除运行记录的用量赋值，规划已完成但保存用量为[]，断言预期为plan/HTTP200/prompt17/completion9/total26，见 `lose-run-accounting.txt`。不是把AsyncLocalStorage设成非法值来制造异常。
- `CHROME_PATH=<指定路径> node --test --experimental-strip-types tests/t130-eval-set.test.ts tests/t130-blind-privacy.test.ts tests/t130-model-usage.test.ts tests/t130-run-records.test.ts tests/simulated-packs.test.ts tests/t128-code-boundary.test.ts` → `artifacts/t130/astra-fix/related-green.txt`，60/60、无失败/取消/跳过。包含每份真实URL及输入截图只用一次、各包互不引用、按公司×风格配对、24张不同照片的元数据攻击、补齐后的PNG在真实Chrome解码，以及三轮行长拒绝/用量保存的真实API与提交入口检查。模型HTTP和Next延后调度是明示fixture，不是真实生成或独立审美证据。
- `npm run typecheck` → `artifacts/t130/astra-fix/typecheck-final.txt`，exit0；`npm run build` → `artifacts/t130/astra-fix/build.txt`，默认Turbopack、exit0。前次依赖复验、旧全量输出留在既有目录；依赖主工作区本机数据的两项用例不列本执行阻塞，全量npm test由主控合并后在主工作区跑，不补数据、不开票。

本次完成时间与命令汇总见 `artifacts/t130/astra-fix/checks.json`。主控把node_modules换成真实npm ci安装后，本轮沿用默认Turbopack及自有3142服务；密钥只按规定source加载，未复制/打印/软链；只停止自有进程。project-map检查无problem、无stale living doc。

已知限制：本票不做截图中的公司身份遮蔽，mixed 包中真实官网与模拟公司名称可能被辨认，结论按「逐张打分」而不是「挑出生成页」解读；若首轮基线显示评审靠名称判断，再开票处理。

### 首轮真实评估（充值后）

运行代码为 `aa2b3fc8f6837344c57bba36139a4ebcb44290b4`，开始时工作树干净；本轮只更新本票 Resolution，没有改源码或干扰 Astra 的只读复核。默认 Turbopack 在本工作树3142启动，`SITE_STORE=fs`，health确认cwd为本工作树；密钥仅用规定的 `set -a; source /Users/luckye/Documents/Code/sitecraft-ai/.env.local; set +a` 加载进进程。2026-10-08 05:11:10.775 UTC，单次最小 `/chat/completions` 调用返回HTTP200、927ms，deepseek-flash用量prompt34/completion16/total50；该确认调用不计入评估用量。

从仓库根目录单次执行以下命令，2026-10-08 05:11:25.032–05:54:42.854 UTC（43分17.822秒），exit1、INCOMPLETE。没有重跑组合、追加修正或替换失败结果；只执行提交入口原有的最多两轮修正。命令本身在本轮 `command.sh`（npm别名对应的实际Node命令），终端输出在 `artifacts/t130/first-funded-20261008T0511.log`。

```bash
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell SITECRAFT_BASE=http://127.0.0.1:3142 npm run eval:new-route
```

本轮目录：`artifacts/t130/round-2026-10-08T05-11-25-013Z/`。以下每站的资料、siteId、versionId、逐轮完整拒因及每次调用用量分别在 `private/case-N/report.json`；耗时包含创建、上传、生成、检查、修正及失败的截图步骤。R0为首稿，R1/R2为第一/第二轮修正；拒因数量按检查器记录计，跨页/视口重复记录不去重。

| N / 公司与风格 | 底线及交付结果 | 逐轮拒收率 | 耗时（秒） | 模型调用 | token（prompt / completion / total） |
| --- | --- | --- | --- | --- | --- |
| 1 工业 / precision | 3页存版；截图超时 | 2/3，66.7% | 296.873 | 5 | 34,310 / 67,618 / 101,928 |
| 2 工业 / documentary | 3页存版；截图超时 | 1/2，50% | 272.450 | 4 | 20,801 / 63,206 / 84,007 |
| 3 外贸 / precision | 最终拒收，未存版 | 3/3，100% | 204.635 | 4 | 29,836 / 50,553 / 80,389 |
| 4 外贸 / documentary | 5页存版；截图超时 | 2/3，66.7% | 350.951 | 6 | 37,886 / 81,795 / 119,681 |
| 5 注塑 / precision | 5页存版；截图超时 | 2/3，66.7% | 310.626 | 5 | 50,975 / 72,245 / 123,220 |
| 6 注塑 / documentary | 最终拒收，未存版 | 3/3，100% | 376.591 | 5 | 56,559 / 100,688 / 157,247 |
| 7 纸包装 / precision | 最终拒收，未存版 | 3/3，100% | 350.397 | 6 | 46,095 / 89,580 / 135,675 |
| 8 纸包装 / documentary | 4页存版；截图超时 | 1/2，50% | 335.492 | 4 | 29,813 / 77,416 / 107,229 |

| N | R0拒因 | R1结果 / 拒因 | R2结果 / 拒因 |
| --- | --- | --- | --- |
| 1 | 19条：图片6；ISO认证状态文字对比度4.41，9条；产品参数及询盘邮箱行长4 | 6条图片显示失败 | 通过 |
| 2 | 6条：首页、产品页图片显示失败 | 通过 | 未运行 |
| 3 | 13条：产品图片3；各页页脚目录/邮箱句行长10 | 3条产品图片显示失败 | 同样3条，最终拒收 |
| 4 | 3条产品图片显示失败 | 2条事实：把追溯报告绑定到316L主体材质，把产品材质/工序扩大为材料追溯覆盖范围 | 通过 |
| 5 | 10条：产品图片3；交期/MOQ及生产能力句行长7 | 3条产品图片显示失败 | 通过 |
| 6 | 24条：图片9；首页产品参数行长10；检查器报“资料没有的数字01–05”5 | 9条图片显示失败 | 1条事实：出口市场漏掉“为主”限定，最终拒收 |
| 7 | 49条：页脚/询价文字对比度4.29，48条；检查器报“资料没有的数字4”1 | 2条事实：纸盒交期的“印刷文件及白样确认”被改成“印刷与盒型确认”；称三类交期都不同而资料中两种纸盒交期相同 | 2条事实校对拒因：“分开介绍”写成“分开排产”；电话/地址“待补充”被拒。最终拒收 |
| 8 | 16条：MOQ/交期、食品接触限制、打样说明行长15；检查器报“资料没有的数字4”1 | 通过 | 未运行 |

汇总：全部8组合运行、未运行0、上游失败0；39次调用均HTTP200且usage完整。prompt **306,275**、completion **603,101**、total **909,376** token；逐站耗时合计 **2,498.015秒**。底线通过并存版 **5/8（62.5%），共20页**；最终拒收 **3/8（37.5%）**；首稿拒收 **8/8（100%）**；逐轮拒收 **17/22（77.3%）**。原因统计：图片11轮/6站/54条，对比度2轮/2站/57条，正文行长5轮/5站/46条，事实或其他7轮/4站/14条。未出现溢出或重叠拒因；这些是提交入口的结果，不能替代截图或独立审美结论。“01–05”“4”和“待补充”的拒因保留检查器原话，未在本次裁定是否误拦。

**截图与盲评包 BLOCKED**：5个存版站都在实际code-preview截图阶段报 `Chrome 检查 Runtime.evaluate 超时`，命令将它们记为error；3个底线拒收站没有可用版本。本轮没有任何生成站1440/375截图，因此每站各抽看一张的要求未完成，完整交付成功数 **0/8**。未换截图路径绕过失败，也未重跑生成；截图链路尚待定位修复，本次按负责人指令只报告结果，不改源码。8张真实官网1440对照已逐张打开；国茂图首屏有大面积红色遮挡、方正图处于轮播转场、裕同图有Cookie条覆盖，后续完整包还须核验这些采集质量问题，不能把文件存在视为合格。

两个包路径如下，**当前均不具备评审条件**：

- `artifacts/t130/round-2026-10-08T05-11-25-013Z/review/mixed/`：8份真实官网、0份生成首页。
- `artifacts/t130/round-2026-10-08T05-11-25-013Z/review/company/`：0对题目。

`private/blind-coverage.json`明确complete=false及每个缺图项；`private/mapping.json`只由主控保管，不给评审。没有匹配到可比较的上一轮，`comparison-review/`为0对。完整包齐备后由Claude交不同的新评审实例分别评阅两个口径，执行者不做盲评。还缺生成站截图、有效盲评包与两种首轮独立盲评、Astra结论，以及主控合并后在主工作区跑的全量npm test；源码未变，本轮不重复typecheck/相关测试/build。此前HTTP402失败仍保留在 `artifacts/t130/round-2026-10-08T02-23-23-602Z/`，不与充值后的证据混用。

### 合并验收（Claude）

Astra：a15ca3b NO_GO（文件时间暴露组别；mixed 重复官网可推答案）→ aa2b3fc 收窄复核 PASS（新实例 t130-astra2，2026-10-08 01:14 EDT；按 PNG 补齐块还原原始大小猜分组 10/16 为非阻断保留意见）。f888516 仅更新本票。合并为 14c34e0（与 T-129 在 `lib/code-site-model.ts`、`lib/code-site-workflow.ts`、`docs/project/mainline.md` 冲突，由主控合并：保留旧版参考选择与用量记录两边，选择阶段计为 `select` 用途）。主工作区 3034：typecheck、T-128/129/130 测试 61/61、`npm run build` 通过；全量 `npm test` 2564/2565，唯一失败 `tests/t117-published-capture-content.test.ts`（旧路线截图采样「footer companyName.zh 缺失」），同机单独重跑 13/13 通过，属并发负载下的已知误报（输出 gitignore 的 `artifacts/merge-14c34e0/`）。

首轮评估的拒收大多指向检查器误拦与截图超时，转 T-133 修；首轮独立盲评用 T-133 修后的那一轮，本票剩余勾选项随之完成。

### 关闭（Claude，2026-10-08）

命令经 T-133 修正后的基线轮 `artifacts/t130/round-2026-10-08T07-59-10-005Z/`（T-133 worktree）8/8 存版并有截图、每站检查结果、耗时、用量与命令齐全；交接包 `handoff-2026-10-08T11-31-41-332Z` 的 review/ 经 Astra（t130-astra2）与评审隔离复制核对，不含映射。第一轮独立盲评（两种口径，新 gpt-6.1-sol 实例 blind133-m、blind133-c，07:44–07:46 EDT）：mixed 生成页识别 8/8、真实官网误判 0/8；company 判同模板 0/12。作为后续比较基线，解盲摘要 `artifacts/blind-baseline-2026-10-08/summary.md`。

