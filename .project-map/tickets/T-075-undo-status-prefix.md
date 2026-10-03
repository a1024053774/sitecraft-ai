---
id: T-075
title: 撤销 / 重做的对话提示不再叠两层状态前缀
type: build
status: open
blocked_by: []
claimed_by:
supersedes:
---

## What to build

T-070 验收截图（`artifacts/merge-713b5ee/t070-ui/undone-375.png`）里，撤销后的对话提示显示为「已应用：已撤销：首屏布局」——工作台的状态标签「已应用：」又套在已经带「已撤销：」的摘要外面。和 T-070 第三次审查里修过的「未修改：未修改：」是同一类问题。状态标签和摘要只能有一层前缀：撤销显示「已撤销：首屏布局」，重做显示「已重做：…」。

## Acceptance

- [ ] 测试先写、改动前先失败：撤销、重做、普通应用、拒绝四种情况，对话提示都只有一层状态前缀
- [ ] 工作台 1440 / 768 / 375 截图看过；`npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收
