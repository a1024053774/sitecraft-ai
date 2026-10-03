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

2026-10-03（America/New_York），codex-build：

- 红测先行：`node --test --experimental-strip-types tests/t075-status-prefix.test.ts` 在当前 HEAD 因缺少前缀归一化契约失败，输出保存于 `artifacts/t075/red-prefix.txt`。根因修在 `lib/workspace-copy.ts` 的 `formatWorkspaceChange`，工作台渲染只调用这一处；撤销/重做/普通应用保留动作摘要前缀，拒绝由状态补唯一的「未修改：」。
- 相关测试 `tests/t075-status-prefix.test.ts`、`tests/t070-summary.test.ts`、`tests/workspace-copy.test.ts` 共 21/21 通过，输出见 `artifacts/t075/related-tests.txt`。
- `npm run typecheck`、带指定 Chrome for Testing 路径的 `npm test`（599/599）、`npm run build` 均通过，输出见 `artifacts/t075/typecheck.txt`、`artifacts/t075/npm-test.txt`、`artifacts/t075/build.txt`。
- 使用 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell` 在 3034 dev server 捕获并查看 `artifacts/t075/workspace-prefix-1440.png`、`workspace-prefix-768.png`、`workspace-prefix-375.png`；三档均无「已应用：已撤销/已重做」叠层，报告见 `artifacts/t075/workspace-screenshots.json`。
- `project_map.py status` 无 stale；本票状态保持 open。代码审查与 Claude 验收留给 supervisor，因此第二项验收框保持未勾选。对应本地提交为本票最终提交（SHA 由 handoff 报告），未 push。
