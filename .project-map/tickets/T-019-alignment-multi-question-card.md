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

- [x] 新建站点从资料进入后，出现一张 1–4 题的卡；全部答完一次提交，同一会话继续
- [x] 最多 3 轮，之后进入方案确认（现有状态机保留并限制 `MAX_ALIGNMENT_ROUNDS`）
- [x] 刷新页面后仍是同一张卡、同样的已选答案（会话快照持久化 `questions` 与答案）
- [x] 已生成的站点改文案时不出现完整的对齐流程（沿用既有 alignmentEnabled/已生成草稿分支）
- [x] 确认文案显示实际选中的配色
- [x] 端到端流程（资料 → 对齐 → 确认 → 生成 → 预览）有一条可以重跑的测试或脚本，产物放 `artifacts/`
- [x] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [ ] 独立审核 agent（不是做这张票的 agent）验收通过，结论记在 Resolution

## Resolution

实现：`CurrentQuestion.questions` 支持 1–4 题；Chat API 接收 `selections` 并由状态机一次校验、保存全部答案；工作台仅增加多题卡选择和一次提交入口，保留单题路径。确认提示使用实际 `styleLabel`，移除固定“工程橙色板”文案。

验证命令与结果：

- `node --test --experimental-strip-types tests/alignment-multi-question.e2e.test.ts`：先在改动前失败，改动后 PASS。
- `npm run typecheck`：PASS。
- `npm test`：235 tests PASS。
- `npm run build`：PASS。
- `node scripts/verify-alignment-multi-question.mjs`：PASS。

产物：[artifacts/t019-alignment-multi-question.json](../../artifacts/t019-alignment-multi-question.json)

Commit：实现 `a1753036edd0ed8f2b7d541cf5174282805a5341`；本票 Resolution 回写为后续文档提交。
