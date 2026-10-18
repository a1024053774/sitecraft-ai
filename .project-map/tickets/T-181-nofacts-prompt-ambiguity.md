---
id: T-181
title: 事实核对 noFacts 提示歧义导致整站生成全部拒收
type: build
status: open
blocked_by: []
claimed_by: Codex
supersedes:
---

## Why

T-180（2026-10-18）真实整轮 20 个站 0 成功，全部停在整站生成最后一步的事实核对协议检查：17 个是 `noFacts=false` 且类别为空，2 个编号遗漏/重复/越界，1 个出处不在当前核对段。共花 1,681,673 token。执行主控推断根因：提示写「有企业事实时 noFacts=false 且列出高风险类别」，而「企业事实」宽于七类高风险声明，规格、地址、流程这类段落让模型填 false 又列不出类别。该规则来自 T-169，此后没跑过整轮真实生成。当时核对回复正文未保存，根因尚未逐段印证。主流程（优先级 2）：真实整站生成大概率存不下版本。

## What to build

1. 事实核对任务保存每次模型回复原文、finish_reason 与用量（沿用 T-174 的凭据脱敏规则），任务记录可按站点和核对段查到。
2. 提示改为：`noFacts=true` 表示本段没有七类高风险声明（客户与合作方、资质认证、业绩与数量、价格与收费、时间与交期承诺、效果、评价）；规格、地址、流程等普通企业事实不算，填 `noFacts=true`。严格协议不变：`noFacts=false` 必须列出非空类别，二选一违规照旧拒收（不放宽成把空类别当 true）。
3. 编号遗漏/重复/越界与「出处不在当前核对段」两类，用保存的原文查明是提示问题还是代码边界问题，在根因层修；查不清就如实写进票。
4. 离线成对测试：只有规格/流程的段落判 `noFacts=true` 通过；含价格或资质的段落仍须列类别；`noFacts=false` 加空类别仍被拒；先在父版本上失败。
5. 真实探针：1～2 个站（资料最丰富的公司）走真实整站生成，确认存下版本、出处正常；失败时用保存的原文定位，不盲目重跑。

## Acceptance

- [x] 回复原文已保存并能查到；三类协议失败的根因结论写进 Resolution
- [ ] 成对测试先红后绿；typecheck、test、build 通过；独立 fast 审查通过
- [x] 真实探针至少 1 个站存版成功，用量写进 Resolution（负责人 2026-10-18 授权不限额，探针账本 `SITECRAFT_TOKEN_LIMIT=500000`）

## Resolution

本次授权执行项 PASS；T-181 保持 open，仅待构思主控派新的 fast 实例完成正式审查。工作树基于 `9ed936419085e3c7ef13a363f1f3a03c0b4b4960`，分支 `t181-nofacts-prompt`；原实现 `9478c1a`、claim 复制修复 `2148748`，最终测试候选 **`b31c9bc275f8cbd49cc3821ed099b70d99d0cd58`**。负责人 2026-10-18 选 A 后，先在精确的 `9478c1a` 上补全量和 build，再用新账本取得真实回复并修复复制歧义。最终候选两轮全量各 845/845、build 通过，修复后两站均成功存版。协议、校验、动态预算、网关脚本和 500000 上限均未放宽；本轮未自行开审查实例。新账本累计 **412921 token** 全部已知，旧账本那次写页调用用量仍未知。

2026-10-18 16:55 UTC 的父版本离线检查：`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t181-fact-replies.test.ts`，6 项全部预期失败，证据 `artifacts/t167/test-run-1792342517001-54548/` 与 `artifacts/t181/parent-red-v3.log`。失败分别指向旧提示、缺失原始回复和失败段映射；更早的测试夹具缺 conversation 初始化，已修正并保留最初失败，不计为缺陷红灯。离线模型替身只证明提示合同、解析和落盘，不能证明真实模型理解。

同日修改后，原定向检查 6/6 通过（`artifacts/t167/test-run-1792342544884-54867/`）；相关命令 `CHROME_PATH=上述路径 npm test -- tests/t181-fact-replies.test.ts tests/t169-production-contract.test.ts tests/t174-local-function.test.ts tests/t154-fact-segments.test.ts`，89/89 通过（`artifacts/t181/related-report.json`、`related.log`，原目录 `artifacts/t167/test-run-1792342565329-55148/`）。增加整段脱敏落盘检查后，T-181 定向检查 7/7 通过（`artifacts/t181/focused-report.json`、`green-final.log`）。实现提交 `9478c1a` 后再次执行 `npm run typecheck`，通过（`artifacts/t181/typecheck-final.log`）。

查询示例：本次最终全量中的 `artifacts/t181/offline-1792344322056-98538/ordinary.json` 与 `high-risk.json` 保存普通 dev 的 draft HTTP 读回；按其中 site.siteId 找 site.run.modelCalls，筛选 purpose=facts/local-facts，再用 factInput.segments 的 id、text、pageId 查 response.rawBody 中对应编号的原始结果。empty.json 保存协议失败原文，leak-in-task.json 证明脱敏标记也落盘且不留下凭据；这些是离线替身证据，不能冒充真实模型回复。旧 T-180 未捕获的原文未补造。

**标准检查，源码均为 `9478c1a`。** `node --test --experimental-strip-types scripts/t167-runner-regressions.ts` 最终 18/18 通过（17:02 UTC，`artifacts/t181/runner-regressions-after-stop.log`）。初次执行时本票探针 dev 占着 .next，coexisting-dev 用例启动第二个普通 dev 后报 socket closed；ordinary.log 明确显示 PID 58060 已占锁。初次失败保留在 `runner-regressions.log` 与 `artifacts/t167/coexisting-dev-cf447a75-b384-4e4f-878b-8c41fc97a820/`；按正常收尾停探针 dev 后再检查，无产品或测试修改。

两轮均先确认没有其他 Chrome 测试，使用默认浏览器并发 2，执行 `CHROME_PATH=上述路径 npm test`，不传外部数据根或端口，均自然跑完：

| 完成时间（2026-10-18 UTC） | 实际执行 / 失败 | 结果 | 证据 |
| --- | --- | --- | --- |
| 17:14:21 | 836 / 0 | PASS，exit=0 | `artifacts/t167/test-run-1792342937484-62254/`；`artifacts/t181/full1-report.json`、`full1.log` |
| 17:25:33 | 836 / 1 | INCOMPLETE，exit=1 | `artifacts/t167/test-run-1792343673016-82517/`；`artifacts/t181/full2-report.json`、`full2.log` |
| 17:41:04 | 836 / 0 | PASS，exit=0；负责人选 A 补跑 | `artifacts/t167/test-run-1792344607346-2975/`；`artifacts/t181/choice-a-20261018/full3-report.json`、`full3.log` |

第二轮唯一失败在 `tests/t164-multi-block-edit.test.ts:186`“候选新增链接触发范围外自定义属性也必须拒绝”：`lib/code-site-local-edit.ts:266` 的动态状态检查在 clear/read 中超时，由 `lib/code-site-check.ts:548` 抛出，尚未到事实模型调用（663 行）。读回失败夹具 `t164-dynamic-e7416376-68c6-46cd-88e4-c846cd7a4521` 仍只有源版本 1；异常未使候选存版，见 `artifacts/t181/full2-failure-state.json`。失败数据根 `/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-test-P49A2L` 原样保留。当时按失败后停止的规则没有 build；负责人选 A 后才补跑。Next 自动添加的 tsconfig include 不纳入提交。

**第二轮 T-164 现场。** 原诊断四份文件及负载来源索引保存在 `artifacts/t181/choice-a-20261018/previous-full2-t164.json`：375 档源 1 次、候选 5 次完整读取，合计 6 次；计算预算 `max(5000,1000+300×6)=5000 ms`，实际允许 5000 ms，三档总剩余额度 60000 ms。整个动态检查实际 **5829.042 ms**，整条用例 **6413.410 ms**。计划在检查开始后 5516 ms 才记下，已比本档截止时刻晚 516 ms；两侧 forceCalls、样式读取分段时间均为 0，说明在首次完整样式读取之前已超时。该探针自身没有 load 字段；相邻 T-162 `artifacts/t162/self-contained-1792343987711-91121/timings.json` 的 route.chat 在约 17:19:57.430 UTC 采到 load1 **14.0815**，距检查结束约 **+346 ms**，只能作为相邻采样，不能补造成精确的探针负载。

负责人指定的新增全量开跑前已确认无其他 Chrome 测试；现有 9300 普通浏览器服务保持原样。全程每秒采样 load，记录为 `choice-a-20261018/full3-load.ndjson`。该 T-164 用例本轮通过（整个用例 1736.022 ms），同样源 1、候选 5 次，每档预算仍为 5000 ms，375/768/1440 动态检查实际 **460.714 / 114.000 / 102.737 ms**；相邻 load1 **46.6577**，见 `full3-t164-state.json`。因此不能仅由 load 数值断言上轮根因；没有改变动态预算、并发或断言。新增全量前入口回归 18/18 通过，随后 `npm run build` 在 17:41:35 UTC exit=0，源码均为精确的 `9478c1a`，命令、退出码在 `choice-a-20261018/`。

**正式审查待主控。** 上轮独立 `gpt-6.1-sol / xhigh` 实例对 `9478c1a` 的 INCOMPLETE 报告保留在 `artifacts/t181/independent-fast-review.txt`，不覆盖后续修订。负责人选 A 后明确由主控派新的 fast 实例，执行者本轮没有开新审查或盲评实例，也不宣布审美通过，因此第二项验收仍未勾选。

Tracer bullet 已经由生产 chat 的生成入口、提交检查、任务保存贯通普通 dev 的 draft HTTP 读回；离线仅替换模型与 after 调度，随后真实探针经过实际 Next after 并存版。Deep modules：复用 T-174 的整段凭据检查到事实回复，不另建日志存储或旁路提交。Ubiquitous language：noFacts 仅指没有七类高风险声明，普通企业事实仍按资料核对并可返回 issues。

T-180 只读现场结论：17 次 false/空类别与旧提示歧义一致，因没有回复原文，尚不能逐段证实；两次“格式或编号无效”还可能来自 schema 无效，不能断言具体是遗漏、重复还是越界（round1 case-5，round2 case-3，finishReason 均 stop）。round1 case-14 只留下越段声明“不承接印刷生产、包装成品采购、商标检索与注册、法律审查”，未留下其所属编号与待核段，不能把本次复制歧义直接断言为那次的根因。本次两站共 137 个段落编号均完整且唯一，编号遗漏、重复、越界 **未复现**，留到 T-180 重跑时再看；未为它猜测或放宽校验。

**真实探针。** 同日 16:58:17 UTC，从干净实现提交 `9478c1a` 运行 `SITECRAFT_BASE=http://127.0.0.1:52313 SITECRAFT_TOKEN_LIMIT=500000 CHROME_PATH=上述路径 npm run eval:new-route -- --only molding/precision,design/editorial --out artifacts/t181/real-probe-20261018`（不加 quick）。两份原始资料分别 2498、2395 字，是现有资料最丰富的两家：molding 含四页的生产、质检与业务条件，design 含三项服务与项目记录；后者也覆盖 T-180 曾有越段声明的公司。完整实际命令、应用与网关启动方式在 `artifacts/t181/commands.sh`。应用使用本工作树 `.sitecraft-data`、52313 和固定 CHROME_PATH；仅网关进程 source 主目录 `.env.local`，应用只持本地占位凭据，评估器显式清除密钥变量。网关独占 52314，按现有白名单新建账本 `artifacts/t174/t181-fact-probe/usage.json`，上限 500000；未改网关脚本、未复用 T-180 账本。health 核对了本工作树与数据根。静态源预检有一次标记断言写错，改用实际 meta 标记后通过；最初失败记录在 preflight-first-failure.json，未调用模型。

molding/precision 的规划调用 HTTP 200、finishReason=tool_calls，实际 **12854 token**（输入 10240，输出 2614）。写页调用从 16:58:34.598 UTC 开始，上游 HTTP 200 的响应体读取报 `terminated`；网关记录 state=failed 并停止，应用收到 HTTP 502，run=error，版本数 0。该次无 usage，**总用量未知，不能把 12854 当作全部实际消耗**；不能宣称剩余额度精确可用。评估器 exit=1，molding=blocked（146158ms），design=not-run；事实调用数 0。没有事实原文可供真实诊断，前述三类历史协议失败仍保留其证据边界；未重试、未另开账本、未改成离线路径冒充通过。

评估器结束后又通过普通 draft HTTP 核对实际 run 终态、无进行中请求，保存 `artifacts/t181/terminal-before-gateway-stop.json` 后，才手动 SIGTERM 网关 PID 58034，再停本票 dev。`shutdown.json` 确认 52313/52314 均 ECONNREFUSED。主目录 3034 和 `.sitecraft-data` 未用于本票，也未修改或停止；失败站、账本与私有映射留在本工作树。这本旧账本保留不动，写页调用用量仍未知。

**选 A 后真实两站探针与根因。** 新账本 `artifacts/t174/t181-fact-probe-choice-a-20261018/usage.json`，500000 上限，未改网关脚本；源码精确 `9478c1a`，仍为 molding/precision、design/editorial 整站和默认滑杆。真实凭据仅在网关进程，应用持本地占位 token。输出 `artifacts/t181/choice-a-20261018/real-probe/`，六次调用均 HTTP 200，实际合计 **191219 token**、未知 0；没有连接中断。两站真实事实回复及输入编号映射均已保存。molding 111 段拒收，版本 0；design 26 段成功存版，站点 `a3f5fec0-d110-4b0c-868f-fbed3895a5ab`、版本 `01617e9d-d2f1-4c96-bfa2-dae153739f6a`，三页九档检查通过，22 条完整出处均有来源及目标。三页 375/768/1440 和首页首屏共 10 张截图均打开确认非空；不自行宣布审美通过。run 终态及网关无进行中请求在 `choice-a-20261018/terminal-before-stop.json` 核对后，才手动停止网关 PID 19187 和 dev。

原文分析 `choice-a-20261018/raw-fact-analysis.json`：两站编号无遗漏、重复或越界，false/空类别也未复现。molding 有 8 段共 9 条非法 claim：例如 s2 中“模具年产”与“约 180 套”分列，模型输出“模具年产约 180 套”，删除了边界空白；s64～s66 又将项目标签改写为带冒号、分号的句子。部分改写恰好在另一段 s80 中出现，仍不能借给当前编号。根因是原提示要求复制完整声明，却只给带结构的 text，让模型重建标签和值或使用资料句。现有连续子串归属校验正确拒收，不能通过去掉空白、标点或跨段查找来放行。

修订 `2148748` 在既有输入增加 `claimTexts`：用相同 NFKC、空白和结构标记规则生成可复制文本，按 TR 拆开；保留原 text 的结构理解，不扩大可引用范围。提示只允许从当前编号的一条复制文本逐字取连续子串，不拼接、不补标点、不回传辅助字段。输出 schema、类别、编号、claim 与 quote 的全部原校验不变。新测试先在功能代码等同 `9478c1a` 的父版本运行，9 项中 3 项预期失败、6 项严格拒收对照通过，证据 `claim-copy-parent-red-final.log`；随后相关 36/36 与 typecheck 通过，证据 `claim-copy-related.log`、`typecheck-fixed.log`。首轮改后检查有两项测试期望误保留全角逗号，已按既有 NFKC 合同将独立常量写为半角；最初失败保留在 `claim-copy-green.log`，未放宽断言或改变规范化规则。

`2148748` 首轮完整全量自然跑完，845 项、2 失败，证据 `fixed-full1.log`、`fixed-full1-report.json`。T-164 未超时。两项均为请求表示适配：T-138 原断言数整包 JSON，新增复制文本后是 4 次，但实际待核段仍为首页和共享页脚各 1 次、合计 2，流程正常两轮修正并存版；现改为统计 segments.text，期望仍严格为 2。T-158 的精确输入快照增加新字段，其他期望不变。独占工作树串行反例检查：把去重键故意加 pageId，让共享页脚按页重复发送，T-138 在同一断言以 **3≠2** 失败；去掉 claimTexts，T-158 以缺少该字段失败。两项临时改动逐项立即恢复，原始生产代码没有追加修改，日志和命令说明在 `counterfactual-duplicate-footer.*`、`counterfactual-missing-copy-text.*`。随后 `npm test -- tests/t138-token-repair.test.ts tests/t158-general-prompts.test.ts tests/t181-claim-copy.test.ts tests/t181-fact-replies.test.ts tests/t169-production-contract.test.ts tests/t169-fact-citations.test.ts` 41/41 通过，typecheck 通过（`final-related.log`、`final-typecheck.log`）。

**最终候选验证，均为 `b31c9bc`。** 入口回归再次 18/18 通过（`final-runner-regressions.log`）；开跑前逐轮确认没有其他 Chrome 测试，以默认并发 2 自然跑完两轮 `CHROME_PATH=上述路径 npm test`：18:23:03 UTC **845/845**，18:36:08 UTC **845/845**。两轮的命令、起止时间、退出码、原生汇总、逐秒 load 均在 `choice-a-20261018/final-full{1,2}*`。T-164 关键用例分别 1875.276 / 1180.204 ms，均未超时。随后 `npm run build` 于 18:36:47 UTC exit=0，见 `final-build-command.json`、`final-build.log`、`final-build-exit.json`。未改动态预算、断言通过条件或分池并发，没有跳过失败或隐藏先前红灯。

**修复后真实验证。** 在上述检查后，以相同两组合和默认 5/6 滑杆运行 `npm run eval:new-route -- --only molding/precision,design/editorial --out artifacts/t181/choice-a-20261018/real-probe-fixed`。网关用 `--resume` 恢复选 A 的同一本账本，从 191219 token 接着记账；high 仅是新的账本轮次标识，未改风格、滑杆、资料或预算。应用和评估器均显式设置 SITECRAFT_TOKEN_LIMIT=500000 与固定 CHROME_PATH，应用仅持占位 token，实际命令见 `commands-fixed.sh`。旧账本未触碰，仍是一笔写页用量未知，不合入新账本的已知数。

| 组合 | 站点 / 版本 | 结果 | 本次实际 token |
| --- | --- | --- | ---: |
| molding/precision | `a7c7565a-0676-4f32-9d82-99885d271a1f` / `a9cc299a-c35a-4260-ac78-1f47871a806d` | 四页、12 档检查通过，27 条完整出处；一项无依据的“共用产线排产”普通事实按既有局部修正流程修好，79 段后只重核 1 段、沿用 78 段，再存版 | 126931 |
| design/editorial | `ebf063e1-d8ea-4a0e-9e14-fc018e898199` / `5ed2664f-fa25-4433-b2a1-a3df36c499f1` | 三页、九档检查通过，16 条完整出处，首轮存版 | 94771 |

修复后新增 **221702 token**，与修复前 191219 合计 **412921 / 500000**；14 次上游调用均 HTTP 200、用量全部已知、未知 0，没有连接中断。详见 `completion-fixed.json`、唯一账本 `artifacts/t174/t181-fact-probe-choice-a-20261018/usage.json`。三个事实回复共 111 段次（79+1+31）均保存原文、finish_reason、用量、编号及实际 claimTexts；逐一核对编号无遗漏、重复或越界，false/空类别为 0，claim 均属于当前段且命中当前编号的一条复制文本。所有 43 条出处均命中对应版本来源快照并有定位目标，见 `raw-fact-analysis-fixed.json`。本次编号问题仍 **未复现**，留到 T-180 重跑；原文复现的复制歧义已在输入与提示层修复，严格校验保持。

两站 23 张三档及首页首屏截图全部打开确认非空，清单 `viewed-screenshots.json`；没有自行判定审美通过。标准评估器的两站 outcome 均 generated，但进程 **exit=1、round=INCOMPLETE**：两组合选择产生 4 份真实官网对照，而 `scripts/eval-set-report.ts:210` 的审包规则要求对照数恰等于 2 个 case。`private/blind-coverage.json` 如实保留该数量约束失败，未请求跨轮比较；不是生成或底线检查失败，也不把该审包当作可审。本票不修改评估器或对照数量来绕过。

实际 draft HTTP 再读回两站 currentVersionId、终态和出处，确认网关 in-flight=0、未知用量 0 后，保存 `terminal-fixed-before-stop.json`，才手动 SIGTERM 网关 PID 84642 和 dev PID 84853。`shutdown-fixed.json` 确认 52313/52314 均 ECONNREFUSED。主目录 3034、主目录 `.sitecraft-data`、T-180 现场和旧账本均未修改。所有源码与记录只在本地提交，不推送；留待主控正式审查，执行者停在 idle。
