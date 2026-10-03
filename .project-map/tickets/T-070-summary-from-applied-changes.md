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
- [x] `npm run typecheck`、`npm test`、`npm run build` 通过（561/561）
- [ ] 代码审查通过；Claude 验收

## Resolution

- 改动：服务端提交 AI change set 后只用实际 `appliedTargets` 生成历史、改动标记和对话修改摘要；确认卡只用 operation 目标标签生成「将修改：…」；模型 summary 完全不进入用户可见摘要。拒绝保留拒绝理由；工作台撤销/重做用逆/正操作返回的落点生成「已撤销/已重做」摘要。
- 测试先写红：b99b96f 上的同义词漏放、确认卡原文泄漏和模型原因误删测试失败，见 `artifacts/t070/red-rework-summary.txt`；FS/Postgres 存储测试在 b99b96f 上失败并暴露 ChangeSet.summary 的模型原因，见 `artifacts/t070/red-rework-store-summary.txt`。旧红测与无效 3034 日志仍分别保留在 `red-summary.txt`、`red-summary-invalid-econnrefused.txt`。
- 改后 focused：T-070 摘要/确认卡 9/9，FS/Postgres 历史回读 1/1，相关 provider/alignment/chat/workspace 测试全绿（`artifacts/t070/rework-related-final.txt`）。
- 验证（2026-10-03）：`npm run typecheck`、`npm test`（561/561）、`npm run build` 全部通过，证据为 `rework-typecheck.txt`、`rework-npm-test.txt`、`rework-build.txt`。前一提交完整套件的 555/556 与 3034 中断证据仍见 `npm-test-3.txt`、`npm-test-rerun.txt`。
- 浏览器证据已按本次重构重新截图：Chrome for Testing 1440 / 768 / 375 为 `artifacts/t070/rework-workspace-1440.png`、`rework-workspace-768.png`、`rework-workspace-375.png`；living docs 已同步 `docs/project/spec.md`、`CONTEXT.md`。
- 提交：本次重构创建新的本地 T-070 commit（不改写 b99b96f，不推送；最终 SHA 在交接中报告）。
