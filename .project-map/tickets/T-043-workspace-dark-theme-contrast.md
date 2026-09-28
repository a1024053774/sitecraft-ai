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

- [ ] 深色和浅色主题下，上面这些元素的正文对比度都 ≥ 4.5:1（小于 18px 的次要文字也按 4.5:1）；有测试或检查脚本量出来
- [ ] 1440 / 768 / 375 深浅两套主题截图，打开看过
- [ ] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [ ] 另一个 harness 的审核 agent 验收通过，结论记在 Resolution

## Resolution
