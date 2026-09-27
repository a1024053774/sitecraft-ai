---
id: T-019
title: 需求对齐改成多题卡片
type: build
status: open
blocked_by: []
claimed_by: astra
supersedes:
---

## What to build

新建站点默认开启需求对齐。一张卡问 1–4 题，每题 2–4 个选项，标出推荐项，可以填「其他」；全部答完一次提交，最多 3 轮；刷新后能回到当前这张卡。已生成的站点修改时不重问完整需求。确认文案里写死的「工程橙色板」去掉，改成显示实际选中的配色。

这张票只做协议和逻辑。工作台只需要能把多题卡片正确显示出来并提交，外观由 T-022、T-023 负责。

## Acceptance

- [x] 新建站点从资料进入后，出现一张 1–4 题的卡；全部答完一次提交，同一会话继续（1 题也统一提交 `selections`）
- [x] 最多 3 轮，之后进入方案确认（现有状态机保留并限制 `MAX_ALIGNMENT_ROUNDS`）
- [x] 刷新页面后仍是同一张卡、同样的已选答案（会话快照持久化 `questions` 与答案，工作台回填选中态和“其他”说明）
- [x] 已生成的站点改文案时不出现完整的对齐流程（沿用既有 alignmentEnabled/已生成草稿分支）
- [x] 确认文案显示实际选中的色彩集；样子单独标注
- [x] 需求卡协议支持每题 2–4 个选项、推荐标记和“其他”补充说明
- [x] HTTP 端到端流程（资料 → 对齐 → 确认 → 生成 → 预览）有一条可以重跑的测试或脚本，产物放 `artifacts/`
- [x] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [ ] 独立审核 agent（不是做这张票的 agent）验收通过，结论记在 Resolution

## Resolution

实现：`CurrentQuestion.questions` 支持 1–4 题；Chat API 接收 `selections` 并由状态机一次校验、保存全部答案；工作台统一使用整卡提交（包括 1 题），支持推荐标记和“其他”说明，并从会话答案恢复选中态。确认提示按字段分别显示样子与色彩集。

验证命令与结果：

- `node --test --experimental-strip-types tests/alignment-multi-question.e2e.test.ts`：先在改动前失败，改动后 PASS。
- `npm run typecheck`：PASS。
- `npm test`：240 tests PASS。
- `npm run build`：PASS。
- `node scripts/verify-alignment-multi-question.mjs`：PASS。
- `node --experimental-strip-types scripts/check-alignment-card-ui.mjs artifacts/t019-ui-final2`：PASS，1/2 题卡在 1440/768/375 通过，包含推荐、“其他”说明和刷新恢复；截图与读回报告在该目录。
- `node scripts/verify-alignment-multi-question.mjs artifacts/t019-red-http`：BLOCKED，3034 规划器返回 502 `provider_error`，逐步输入/读回失败证据保留。
- 根因复现：直接读取 `.env.local` 调用规划器时，模型返回 `finish_reason=length`；原固定 `max_tokens: 900` 重试后仍被归类为笼统 `provider_error`。修复为 1800，并允许 `questions` 仅数组响应归一化。
- `node scripts/verify-alignment-multi-question.mjs artifacts/t019-http-final`：PASS，3034 真实完成资料、需求卡、刷新读回、一次提交、确认、生成和草稿预览读回。

产物：[artifacts/t019-ui-final2/report.json](../../artifacts/t019-ui-final2/report.json)、[artifacts/t019-red-http/report.json](../../artifacts/t019-red-http/report.json)

修复提交：`32a0ede484860e2788d0350a92072b5a4af5b3ed`。

规划器根因修复与真实 HTTP 证据提交：`1291fbbc9338cdadc63c59db28bceea947df5a20`。

审核后修复：`invalid_output` 不再被转换成内置样子问题；当前请求明确返回错误并可重试。提交：`1078250844c474196fbf750776567974537d0afb`。

聊天路由测试修复：测试用的恢复/延迟 provider 哨兵现在走明确的 deterministic alignment 入口，不再把合法测试夹具误送到规划器；`tests/chat-route-conversation.test.ts` 19/19 通过且进程正常退出。提交：`e1b5e09dc5d427932c1d94636801c4b83e739682`。全套 `npm test` 最终 246/246 通过。

本次复核：本地读取 `.env.local` 调规划器得到原始元信息 `finish_reason=length`，原始 JSON 未完整结束；对照 schema 确认首要原因是规划器输出预算不足，已在 `1291fbb` 将预算从 900 提到 1800，并允许 questions-only 卡归一化。3034 重跑若仍返回 invalid_output，现在产物会明确写入 `retry_alignment`，不再换成内置样子卡：[artifacts/t019-http-after-invalid-output/report.json](../../artifacts/t019-http-after-invalid-output/report.json)。此前成功走完生成/预览的真实证据仍在：[artifacts/t019-http-final/report.json](../../artifacts/t019-http-final/report.json)。

Commit：实现 `a1753036edd0ed8f2b7d541cf5174282805a5341`；本票 Resolution 回写为后续文档提交。
