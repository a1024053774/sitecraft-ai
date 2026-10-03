---
id: T-070
title: 修改摘要只说实际落到页面上的改动
type: build
status: open
blocked_by: [T-067]
claimed_by: codex-build
supersedes:
---

## What to build

T-053 遗留：模型的修改摘要有时描述页面上没有的东西，例如把首屏改成左文右图时说「右侧留出图片位」，实际右侧是参数牌。摘要里关于「改了什么」的部分应当从这次 change set 的实际落点生成（改动标记已经这样做），模型的话只用来解释原因，不能描述页面上不存在的元素。

等 T-067 截图打完包再开工。

## Acceptance

- [x] 测试先写、改动前先失败：用上面那个例子（左文右图、没有图片时右侧是参数牌），摘要里不出现图片位一类描述，只说实际换成的布局
- [x] 换布局、改文字、被拒绝、撤销四种情况的摘要都和实际落点一致
- [x] `npm run typecheck`、`npm test`、`npm run build` 通过（562/562）
- [ ] 代码审查通过；Claude 验收

## Resolution

- 改动：服务端提交 AI change set 后只用实际 `appliedTargets` 生成历史、改动标记和对话修改摘要；确认卡只用 operation 目标标签生成「将修改：…」；模型 summary 完全不进入用户可见摘要。拒绝保留拒绝理由；工作台撤销/重做用逆/正操作返回的落点生成「已撤销/已重做」摘要。
- 复审 P1 修法：普通聊天的 rejected/no_change/conflict 分支和需求对齐确认的 rejected/no_change/conflict/error 分支，均从终态结果构造 `aiSummary`；applied 用 change set 摘要，拒绝用去重拒绝原因，冲突/错误用明确结果原因，不再把 provider/proposed summary 写入会话或作为后续模型的「AI摘要」。新增普通聊天拒绝、对齐确认冲突的会话回读回归测试。
- 59ms 失败根因与修法：`chat-route-block-layouts` 的 no_change SSE 摘要被新会话拒绝逻辑错误地加了「未修改：」前缀；工作台本身已有状态标签负责显示「未修改」，所以恢复 `done.summary` 为纯去重拒绝原因，同时会话 `aiSummary` 也保存同一纯原因，未放回模型摘要。
- 测试先写红：原 `red-rework-summary.txt` 仅因新导出不存在而失败，已改名保留为 `artifacts/t070/red-rework-summary-invalid-import.txt`；不依赖新导出的 FS/Postgres 行为测试在 clean b99b96f 临时副本上失败并暴露 ChangeSet.summary 的模型原因，见 `artifacts/t070/red-rework2-store-summary.txt`。旧红测与无效 3034 日志仍分别保留在 `red-summary.txt`、`red-summary-invalid-econnrefused.txt`。
- 改后 focused：T-070 摘要/确认卡 9/9，FS/Postgres 历史回读 1/1，普通聊天拒绝与对齐冲突回读回归通过，相关 provider/alignment/chat/workspace 测试全绿（`artifacts/t070/rework-related-final.txt`、`artifacts/t070/rework-chat-route.txt`）。
- 验证（2026-10-03）：`npm run typecheck`、`npm test`（本次复审修复后 562/562）、`npm run build` 全部通过，证据为 `rework-typecheck-final.txt`、`rework-npm-test-final.txt`、`rework-build-final2.txt`。普通聊天/对齐回归单独通过（`rework-chat-route-final.txt`、`rework-p1-regressions.txt`）。前一提交完整套件的 555/556 与 3034 中断证据仍见 `npm-test-3.txt`、`npm-test-rerun.txt`。
- 浏览器证据已按本次重构重新截图：Chrome for Testing 1440 / 768 / 375 为 `artifacts/t070/rework-workspace-1440.png`、`rework-workspace-768.png`、`rework-workspace-375.png`；living docs 已同步 `docs/project/spec.md`、`CONTEXT.md`。
- 提交：本次重构创建新的本地 T-070 commit（不改写 b99b96f，不推送；最终 SHA 在交接中报告）。
