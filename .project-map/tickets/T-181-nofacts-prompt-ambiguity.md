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
- [ ] 真实探针至少 1 个站存版成功，用量写进 Resolution（负责人 2026-10-18 授权不限额，探针账本 `SITECRAFT_TOKEN_LIMIT=500000`）

## Resolution

INCOMPLETE，票保持 open。工作树基于 `9ed936419085e3c7ef13a363f1f3a03c0b4b4960`，分支 `t181-nofacts-prompt`，实现提交 `9478c1a7f4d3f767641397a0ed8a1f3414c37f31`；缺依赖通过 `npm ci` 安装，未建软链接。明确七类高风险声明的分类边界并保留可诊断回复；不放宽协议，不修改预算网关，不凭猜测修编号或越段声明。真实探针在写页的上游响应体中断，未到事实核对、未存版本，不能宣布真实修复通过。

2026-10-18 16:55 UTC 的父版本离线检查：`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t181-fact-replies.test.ts`，6 项全部预期失败，证据 `artifacts/t167/test-run-1792342517001-54548/` 与 `artifacts/t181/parent-red-v3.log`。失败分别指向旧提示、缺失原始回复和失败段映射；更早的测试夹具缺 conversation 初始化，已修正并保留最初失败，不计为缺陷红灯。离线模型替身只证明提示合同、解析和落盘，不能证明真实模型理解。

同日修改后，原定向检查 6/6 通过（`artifacts/t167/test-run-1792342544884-54867/`）；相关命令 `CHROME_PATH=上述路径 npm test -- tests/t181-fact-replies.test.ts tests/t169-production-contract.test.ts tests/t174-local-function.test.ts tests/t154-fact-segments.test.ts`，89/89 通过（`artifacts/t181/related-report.json`、`related.log`，原目录 `artifacts/t167/test-run-1792342565329-55148/`）。增加整段脱敏落盘检查后，T-181 定向检查 7/7 通过（`artifacts/t181/focused-report.json`、`green-final.log`）。实现提交 `9478c1a` 后再次执行 `npm run typecheck`，通过（`artifacts/t181/typecheck-final.log`）。

查询示例：本次最终全量中的 `artifacts/t181/offline-1792344322056-98538/ordinary.json` 与 `high-risk.json` 保存普通 dev 的 draft HTTP 读回；按其中 site.siteId 找 site.run.modelCalls，筛选 purpose=facts/local-facts，再用 factInput.segments 的 id、text、pageId 查 response.rawBody 中对应编号的原始结果。empty.json 保存协议失败原文，leak-in-task.json 证明脱敏标记也落盘且不留下凭据；这些是离线替身证据，不能冒充真实模型回复。旧 T-180 未捕获的原文未补造。

**标准检查，源码均为 `9478c1a`。** `node --test --experimental-strip-types scripts/t167-runner-regressions.ts` 最终 18/18 通过（17:02 UTC，`artifacts/t181/runner-regressions-after-stop.log`）。初次执行时本票探针 dev 占着 .next，coexisting-dev 用例启动第二个普通 dev 后报 socket closed；ordinary.log 明确显示 PID 58060 已占锁。初次失败保留在 `runner-regressions.log` 与 `artifacts/t167/coexisting-dev-cf447a75-b384-4e4f-878b-8c41fc97a820/`；按正常收尾停探针 dev 后再检查，无产品或测试修改。

两轮均先确认没有其他 Chrome 测试，使用默认浏览器并发 2，执行 `CHROME_PATH=上述路径 npm test`，不传外部数据根或端口，均自然跑完：

| 完成时间（2026-10-18 UTC） | 实际执行 / 失败 | 结果 | 证据 |
| --- | --- | --- | --- |
| 17:14:21 | 836 / 0 | PASS，exit=0 | `artifacts/t167/test-run-1792342937484-62254/`；`artifacts/t181/full1-report.json`、`full1.log` |
| 17:25:33 | 836 / 1 | INCOMPLETE，exit=1 | `artifacts/t167/test-run-1792343673016-82517/`；`artifacts/t181/full2-report.json`、`full2.log` |

第二轮唯一失败在 `tests/t164-multi-block-edit.test.ts:186`“候选新增链接触发范围外自定义属性也必须拒绝”：`lib/code-site-local-edit.ts:266` 的动态状态检查在 clear/read 中超时，由 `lib/code-site-check.ts:548` 抛出，尚未到事实模型调用（663 行）。读回失败夹具 `t164-dynamic-e7416376-68c6-46cd-88e4-c846cd7a4521` 仍只有源版本 1；异常未使候选存版，见 `artifacts/t181/full2-failure-state.json`。失败数据根 `/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-test-P49A2L` 原样保留。超时的负载或根本原因未查清，不把它归为已确认的测试缺陷或 T-181 缺陷；未改动 T-164/T-178 实现、扩大预算或放宽断言，未再跑第三轮掩盖失败。按 AGENTS“失败后不进入下一项”，`npm run build` **未运行**，因此第二项验收不能勾选。Next 自动添加的 tsconfig include 已还原，不纳入提交。

**独立审查。** 独立 `gpt-6.1-sol / xhigh` 实例对冻结提交 `9478c1a` 给出 INCOMPLETE，原文 `artifacts/t181/independent-fast-review.txt`。未发现可证实的候选代码缺陷；独立随机映射、普通地址错误、整站/局部严格拒收和 Unicode 转义凭据检查通过。但替身分类与提示文字断言不能证明真实模型理解已经修复，且真实探针未到事实核对、未存版，不能给完整验收 PASS；该审查发生在第二轮全量结束前，未将第二轮或 build 算作已审通过。默认角色模型不符时取消的早期实例没有被采用结论；没有对同一候选追加复审。

Tracer bullet 已经由生产 chat 的生成入口、提交检查、任务保存贯通普通 dev 的 draft HTTP 读回；仅替换模型与 after 调度，真实 Next after 由下述真实探针验证。Deep modules：复用 T-174 的整段凭据检查到事实回复，不另建日志存储或旁路提交。Ubiquitous language：noFacts 仅指没有七类高风险声明，普通企业事实仍按资料核对并可返回 issues。

T-180 只读现场结论：17 次 false/空类别与旧提示歧义一致，因没有回复原文，尚不能逐段证实；两次“格式或编号无效”还可能来自 schema 无效，不能断言具体是遗漏、重复还是越界（round1 case-5，round2 case-3，finishReason 均 stop）。round1 case-14 只留下越段声明“不承接印刷生产、包装成品采购、商标检索与注册、法律审查”，未留下其所属编号与待核段，无法区分模型改写、跨段归属或代码边界错误。严格编号和 claim 范围校验保持，离线覆盖遗漏、重复、越界与越段拒收；真实探针有原文后再分析，不盲目重跑。

**真实探针。** 同日 16:58:17 UTC，从干净实现提交 `9478c1a` 运行 `SITECRAFT_BASE=http://127.0.0.1:52313 SITECRAFT_TOKEN_LIMIT=500000 CHROME_PATH=上述路径 npm run eval:new-route -- --only molding/precision,design/editorial --out artifacts/t181/real-probe-20261018`（不加 quick）。两份原始资料分别 2498、2395 字，是现有资料最丰富的两家：molding 含四页的生产、质检与业务条件，design 含三项服务与项目记录；后者也覆盖 T-180 曾有越段声明的公司。完整实际命令、应用与网关启动方式在 `artifacts/t181/commands.sh`。应用使用本工作树 `.sitecraft-data`、52313 和固定 CHROME_PATH；仅网关进程 source 主目录 `.env.local`，应用只持本地占位凭据，评估器显式清除密钥变量。网关独占 52314，按现有白名单新建账本 `artifacts/t174/t181-fact-probe/usage.json`，上限 500000；未改网关脚本、未复用 T-180 账本。health 核对了本工作树与数据根。静态源预检有一次标记断言写错，改用实际 meta 标记后通过；最初失败记录在 preflight-first-failure.json，未调用模型。

molding/precision 的规划调用 HTTP 200、finishReason=tool_calls，实际 **12854 token**（输入 10240，输出 2614）。写页调用从 16:58:34.598 UTC 开始，上游 HTTP 200 的响应体读取报 `terminated`；网关记录 state=failed 并停止，应用收到 HTTP 502，run=error，版本数 0。该次无 usage，**总用量未知，不能把 12854 当作全部实际消耗**；不能宣称剩余额度精确可用。评估器 exit=1，molding=blocked（146158ms），design=not-run；事实调用数 0。没有事实原文可供真实诊断，前述三类历史协议失败仍保留其证据边界；未重试、未另开账本、未改成离线路径冒充通过。

评估器结束后又通过普通 draft HTTP 核对实际 run 终态、无进行中请求，保存 `artifacts/t181/terminal-before-gateway-stop.json` 后，才手动 SIGTERM 网关 PID 58034，再停本票 dev。`shutdown.json` 确认 52313/52314 均 ECONNREFUSED。主目录 3034 和 `.sitecraft-data` 未用于本票，也未修改或停止；失败站、账本与私有映射留在本工作树。没有可供审美盲评的成功生成站，不宣称页面质量通过。需要负责人确认上游连接可用后再安排一次获准探针。
