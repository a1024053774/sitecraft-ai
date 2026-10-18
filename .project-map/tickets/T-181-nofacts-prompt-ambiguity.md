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

- [ ] 回复原文已保存并能查到；三类协议失败的根因结论写进 Resolution
- [ ] 成对测试先红后绿；typecheck、test、build 通过；独立 fast 审查通过
- [ ] 真实探针至少 1 个站存版成功，用量写进 Resolution（负责人 2026-10-18 授权不限额，探针账本 `SITECRAFT_TOKEN_LIMIT=500000`）

## Resolution

INCOMPLETE，Codex 执行中。工作树基于 `9ed936419085e3c7ef13a363f1f3a03c0b4b4960`，分支 `t181-nofacts-prompt`；缺依赖通过 `npm ci` 安装，未建软链接。目标是明确七类高风险声明的分类边界并保留可诊断回复；不放宽协议，不修改预算网关，不凭猜测修编号或越段声明。

2026-10-18 16:55 UTC 的父版本离线检查：`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t181-fact-replies.test.ts`，6 项全部预期失败，证据 `artifacts/t167/test-run-1792342517001-54548/` 与 `artifacts/t181/parent-red-v3.log`。失败分别指向旧提示、缺失原始回复和失败段映射；更早的测试夹具缺 conversation 初始化，已修正并保留最初失败，不计为缺陷红灯。离线模型替身只证明提示合同、解析和落盘，不能证明真实模型理解。

同日修改后，原定向检查 6/6 通过（`artifacts/t167/test-run-1792342544884-54867/`）；相关命令 `CHROME_PATH=上述路径 npm test -- tests/t181-fact-replies.test.ts tests/t169-production-contract.test.ts tests/t174-local-function.test.ts tests/t154-fact-segments.test.ts`，89/89 通过（`artifacts/t167/test-run-1792342565329-55148/`）。增加整段脱敏落盘检查后，T-181 最终定向检查 7/7 通过（`artifacts/t181/green-final.log`）。`npm run typecheck` 通过（`artifacts/t181/typecheck.log`）。完整全量、build、真实探针与独立审查待完成。

Tracer bullet 已经由生产 chat 的生成入口、提交检查、任务保存贯通普通 dev 的 draft HTTP 读回；仅替换模型与 after 调度，真实 Next after 由下述真实探针验证。Deep modules：复用 T-174 的整段凭据检查到事实回复，不另建日志存储或旁路提交。Ubiquitous language：noFacts 仅指没有七类高风险声明，普通企业事实仍按资料核对并可返回 issues。

T-180 只读现场结论：17 次 false/空类别与旧提示歧义一致，因没有回复原文，尚不能逐段证实；两次“格式或编号无效”还可能来自 schema 无效，不能断言具体是遗漏、重复还是越界（round1 case-5，round2 case-3，finishReason 均 stop）。round1 case-14 只留下越段声明“不承接印刷生产、包装成品采购、商标检索与注册、法律审查”，未留下其所属编号与待核段，无法区分模型改写、跨段归属或代码边界错误。严格编号和 claim 范围校验保持，离线覆盖遗漏、重复、越界与越段拒收；真实探针有原文后再分析，不盲目重跑。
