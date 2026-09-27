---
id: T-023
title: 平板和手机：对话抽屉和逐题作答的底部抽屉
type: build
status: open
blocked_by: [T-022]
claimed_by: astra
supersedes:
---

## What to build

平板上对话是抽屉；手机上用「对话 / 预览」切换；需求对齐在手机上用底部抽屉，一次答一题，答完一起提交。预览工具栏在 375 宽不溢出。

## Acceptance

- [ ] 375 宽能走完一轮对齐（逐题作答、提交），刷新后能恢复
- [ ] 768 宽对话抽屉可以开合，不挡住预览的主要操作
- [ ] 375 宽工具栏不溢出，按钮都能点到
- [ ] 375 / 768 截图交独立审核 agent 验收
- [ ] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [ ] 独立审核 agent（不是做这张票的 agent）验收通过，结论记在 Resolution

## Resolution

实现：375 宽将需求对齐多题卡变为固定底部抽屉，逐题显示并提供上一题/下一题，最后仍用一次 `selections` 提交；恢复时沿用服务端答案初始化选择。768 宽保留「AI 对话 / 网站预览」抽屉切换，预览工具栏在 375 宽检查横向不溢出。

红态：`node scripts/check-mobile-drawers.mjs artifacts/workspace-t023-red7` 在旧代码上失败于 `375 alignment must use the bottom drawer`。

新鲜证据：`node scripts/check-mobile-drawers.mjs artifacts/workspace-t023-green10` 返回 `PASS`。报告记录 375 的 3 题逐题显示、一次提交后服务端读回 3 个答案、刷新后「已保存的问答（3）」与抽屉恢复；文档宽度等于视口、预览工具栏无溢出。768 报告记录预览标签隐藏对话、对话标签重新打开抽屉。截图已逐张查看：`artifacts/workspace-t023-green10/workspace-375.png`、`artifacts/workspace-t023-green10/workspace-768.png`。

相关检查：`npm run typecheck` 通过；`npm test` 248/248 通过；`npm run build` 通过。

实现提交：待提交后填写 SHA。
