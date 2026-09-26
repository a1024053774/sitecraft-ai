---
id: T-023
title: 平板和手机：对话抽屉和逐题作答的底部抽屉
type: build
status: open
blocked_by: [T-022]
claimed_by:
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
