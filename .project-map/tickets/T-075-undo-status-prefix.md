---
id: T-075
title: 撤销 / 重做的对话提示不再叠两层状态前缀
type: build
status: open
blocked_by: []
claimed_by: codex-build
supersedes:
---

## What to build

T-070 验收截图（`artifacts/merge-713b5ee/t070-ui/undone-375.png`）里，撤销后的对话提示显示为「已应用：已撤销：首屏布局」——工作台的状态标签「已应用：」又套在已经带「已撤销：」的摘要外面。和 T-070 第三次审查里修过的「未修改：未修改：」是同一类问题。状态标签和摘要只能有一层前缀：撤销显示「已撤销：首屏布局」，重做显示「已重做：…」。

## Acceptance

- [x] 测试先写、改动前先失败：撤销、重做、普通应用、拒绝四种情况，对话提示都只有一层状态前缀
- [ ] 工作台 1440 / 768 / 375 截图看过；`npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收

## Resolution

2026-10-03（America/New_York），codex-build 返工：

- 审查指出旧红证据只是在父提交导入新 export 失败，已改名保留为 `artifacts/t075/red-prefix-invalid-import.txt`。新增 `tests/t075-prefix-behavior.test.ts`，只走父版本已有的真实 API、工作台撤销按钮和对话 DOM，不导入 T-075 新增函数。
- 在临时父提交 `81ff44a` worktree 上运行 `SITECRAFT_BASE=http://127.0.0.1:3045 CHROME_PATH=... node --test --experimental-strip-types tests/t075-prefix-behavior.test.ts`，真实读到 `已应用：已撤销：首屏标题`，四条断言失败；输出保存于 `artifacts/t075/red-prefix-behavior.txt`。同一夹具在当前提交 3034 上通过，`duplicated:false` 见 `artifacts/t075/green-prefix-behavior.txt`。
- `tests/t075-status-prefix.test.ts`、行为夹具、`tests/t070-summary.test.ts`、`tests/workspace-copy.test.ts` 共 22/22 通过，输出见 `artifacts/t075/related-tests-final.txt`。根因修在 `lib/workspace-copy.ts` 的 `formatWorkspaceChange`，工作台渲染只调用这一处；撤销/重做/普通应用保留动作摘要前缀，拒绝由状态补唯一的「未修改：」。
- `npm run typecheck`、`npm run build` 通过；带指定 Chrome for Testing 路径的全量 `npm test` 为 604 项 603 通过，唯一失败是已确认的既有 workspace motion 时序测试（1440 宽度等待进度步骤），输出见 `artifacts/t075/typecheck-final.txt`、`artifacts/t075/build-final.txt`、`artifacts/t075/npm-test-final.txt`。
- 三档工作台截图此前已查看：`artifacts/t075/workspace-prefix-1440.png`、`workspace-prefix-768.png`、`workspace-prefix-375.png` 均无「已应用：已撤销/已重做」叠层，报告见 `artifacts/t075/workspace-screenshots.json`。
- `project_map.py status` 无 stale；本票状态保持 open。代码审查与 Claude 验收留给 supervisor，因此第二项验收框保持未勾选。对应本次返工为新本地提交，未 push。
