---
id: T-099
title: 浏览器测试在机器高负载时不靠固定等待时长
type: build
status: open
blocked_by: [T-094]
claimed_by: codex-build
supersedes:
---

## What to build

2026-10-03 多个 worktree 同时跑全量，15 分钟平均负载到 43。此时 `tests/workspace-interaction.test.ts` 的「workspace motion is 150–300 ms …」在 T-080、T-088、T-091、T-092 的全量里都失败过（断言「the progress lists its steps」等），单独重跑和父提交上能过；区块浏览器测试还会因 `/api/health` 超时失败。结果是每张票都拿不到「全量 0 失败」的证据。

动效时长读的是计算后的 CSS，不受负载影响；不稳定的是测试用固定 `sleep` 采样界面状态（进度步骤、面板展开、预览刷新），以及工作区核对的固定超时。先把每个浏览器测试里依赖墙钟时长的地方逐条列出（失败方式写下来），再改成等条件成立（有上限、超时报清楚等的是什么），断言本身不放宽：150–300 ms、只动 transform/opacity、减少动效时不动、预览刷新不遮挡页面，这些都保持原样。

不在本票：限制机器上同时跑的全量数（这是排工的事，由 supervisor 协调）。

## Acceptance

- [ ] 先写出依赖墙钟时长的清单和各自的失败方式（`artifacts/t099/`）；能在父提交上复现失败（例如人为加负载或缩短采样窗口），存 red 输出
- [ ] 修改后在高负载下（同时跑另一个全量或人为加负载，记录 `uptime`）`workspace-interaction` 连跑 5 次通过；全量 `npm test` 0 失败、`npm run typecheck`、`npm run build` 通过
- [ ] 断言没有放宽（审查逐条对照）；代码审查通过；Claude 验收
