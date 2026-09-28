---
id: T-043
title: 工作台深色主题的文字看得清
type: build
status: open
blocked_by: [T-041]
claimed_by: grok-a
supersedes:
---

## What to build

系统是深色模式时，工作台默认用深色主题。深色主题把 `--ink` 设成浅色 `#edf2ed`，但对话气泡、输入框、预览工具栏和草稿状态条仍是白底或浅底，文字几乎看不见（`artifacts/t036/new-site-from-dashboard-1440.png`）。Kiro 在 1440 下量到的对比度：

- 对话气泡 `.message-bubble` 1.13:1
- 输入框 `.chat-input textarea` 1.11:1
- 工具栏站名 `.preview-toolbar .project-name` 1.13:1
- 草稿版本 `[data-testid=workspace-draft-revision]` 1.04:1
- 快捷提示 `.chat-hints .hint` 1.6:1
- 保存状态 `.save-status` 2.43:1
- 当前样子 `.builder-template-name` 2.3:1

可改范围：`app/globals.css`。不改 `app/workspace/page.tsx`。

## Acceptance

- [x] 深色和浅色主题下，上面这些元素的正文对比度都 ≥ 4.5:1（小于 18px 的次要文字也按 4.5:1）；有测试或检查脚本量出来
- [x] 1440 / 768 / 375 深浅两套主题截图，打开看过
- [x] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [ ] 另一个 harness 的审核 agent 验收通过，结论记在 Resolution

## Resolution

2026-09-28 14:55（UTC-4）。深色主题里，白底气泡、输入框、工具栏站名和草稿版本改为 `#17211b`，提示改为 `#243028`，当前样子改为 `#d8f5c8`。浅色保存状态改为 `#3e5148`，深色的同步中/注意也用 `#243028`。

失败测试：`node --test --experimental-strip-types tests/workspace-dark-contrast.test.ts` 改动前失败（没有深色覆盖）。改完通过。`npm run typecheck` 通过。`npm test` 299/299 通过。`npm run build` 通过。

浏览器量到的对比度（1440，768/375 同组，浅色保存状态在同步中为 6.70）：

| 元素 | 深色 | 浅色 |
| --- | --- | --- |
| 对话气泡 | 16.54 `#17211b` / `#ffffff` | 16.71 `#172019` / `#ffffff` |
| 输入框 | 16.18 `#17211b` / `#fbfdfb` | 16.34 `#172019` / `#fbfdfb` |
| 工具栏站名 | 6.40 `#17211b` / `#9ea29f` | 15.92 `#172019` / `#f8faf7` |
| 草稿版本 | 15.11 `#17211b` / `#f1f6f0` | 15.26 `#172019` / `#f1f6f0` |
| 快捷提示 | 13.74 `#243028` / `#ffffff` | 6.66 `#506057` / `#ffffff` |
| 保存状态 | 5.31 `#243028` / `#9ea29f` | 8.08 `#3e5148` / `#f8faf7` |
| 当前样子 | 12.31 `#d8f5c8` / `#202c24` | 6.00 `#2e6b4f` / `#f8faf7` |

截图 `artifacts/t043/workspace-dark-1440.png`、`workspace-dark-768.png`、`workspace-dark-375.png`、`workspace-light-1440.png`、`workspace-light-768.png`、`workspace-light-375.png`。深色气泡和输入框是深字浅底，看过。保留了 `.alignment-card .palette-swatch-row`。

实现提交：本 commit。
