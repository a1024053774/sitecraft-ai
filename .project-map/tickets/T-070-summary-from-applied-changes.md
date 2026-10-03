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
- [ ] `npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收（typecheck/build 已通过；串行 `npm test` 为 555/556，唯一失败是既有 `workspace-interaction` 进度列表时序，单独重跑 5/5 通过；代码审查与 Claude 验收待后续）

## Resolution

- 改动：服务端提交 AI change set 后用实际 `appliedTargets` 生成历史与对话摘要；模型摘要只保留明确的目的/原因，过滤布局和不存在元素的描述；拒绝仍只显示拒绝理由；工作台撤销/重做用逆/正操作返回的落点生成「已撤销/已重做」摘要。
- 测试：先写并运行旧实现红测，失败证据见 `artifacts/t070/red-summary.txt`；误把 3034 不可达当红测的整套日志保留为 `red-summary-invalid-econnrefused.txt`。改后 focused、相关路由/操作/provider/工作台测试通过。
- 验证（2026-10-03 03:02 UTC）：`npm run typecheck`、`npm run build` 通过；`npm test -- --test-concurrency=1` 为 555 通过、1 个既有 `workspace-interaction` 时序失败（`artifacts/t070/npm-test-3.txt`），该文件单独串行 5/5 通过（`artifacts/t070/workspace-interaction-final.txt`）；站点创建单测单独通过（`artifacts/t070/site-creation-rerun.txt`）。第二次并发套件因 3034 已退出而中断/失败，原日志保留于 `artifacts/t070/npm-test-rerun.txt`。
- 浏览器证据：Chrome for Testing 以 1440 / 768 / 375 查看并截图：`artifacts/t070/workspace-1440.png`、`workspace-768.png`、`workspace-375.png`。3034 detached server 的可访问性和日志见 `artifacts/t070/dev-server-2.log`。
- 提交：本地 T-070 commit（不推送；最终 SHA 在交接中报告）。
