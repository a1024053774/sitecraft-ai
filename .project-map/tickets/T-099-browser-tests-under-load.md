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

同根因还覆盖 `scripts/check-published.mjs` 及其调用的 `visitor-layout-scan.js`：高负载时固定等待会在访客页预览、整页高度或区块渲染完成前取事实和量版面，造成 `material facts missing` 假失败。这里也必须改成有上限的条件等待，不得放宽事实、行长、溢出、覆盖或区块断言。

不在本票：限制机器上同时跑的全量数（这是排工的事，由 supervisor 协调）。

## Acceptance

- [x] 先写出依赖墙钟时长的清单和各自的失败方式（`artifacts/t099/`）；能在父提交上复现失败（例如人为加负载或缩短采样窗口），存 red 输出
- [x] 修改后在高负载下（同时跑另一个全量或人为加负载，记录 `uptime`）`workspace-interaction` 连跑 5 次通过；全量 `npm test` 0 失败、`npm run typecheck`、`npm run build` 通过
- [ ] `check-published` 在高负载下对主工作区 12 个站点（ID 见 `artifacts/merge-13ae686/check-published/report.json`）的结果与低负载一致：只剩已知的 16 条行长失败，不出现 `material facts missing`；记录 `uptime` 和逐站点输出
- [ ] 断言没有放宽（审查逐条对照）；代码审查通过；Claude 验收

## Resolution

2026-10-03（America/New_York），codex-build：

- 依赖墙钟清单和失败方式见 `artifacts/t099/wall-clock-inventory.md`，原始扫描见 `wall-clock-scan.txt`。父提交的行为红测通过缩短 workspace-interaction 固定采样窗口复现「预览刷新遮挡页面」，见 `artifacts/t099/red-short-window-parent.txt`；夹具为 `tests/t099-short-window.fixture.ts`，未改产品断言。
- 预览浏览器测试的固定 bridge 等待统一改为命名 `waitForPreviewBridge`；工作台 pane、动画 settle、revision、预览刷新改为有上限的条件等待，motion 采样用页面内 `requestAnimationFrame` 等 revision/hydration 条件后取最终遮挡状态。150–300ms 时长、属性白名单、reduced-motion 空动效、preview 不遮挡等断言保持原样。
- `scripts/check-published.mjs` 的 Chrome/iframe/ready/高度/字体/截图/lead 取数时机改为条件等待并保留上限和目标错误；`visitor-layout-scan.js` 的扫描逻辑和事实/行长/溢出/覆盖断言未放宽。固定等待清单已追加到 inventory。
- 人为负载（6 个 CPU hog）下 workspace motion 连跑 5 次通过：`artifacts/t099/motion-load-r3-1..5.txt`，负载记录 `uptime-motion-load-r3.txt`。早期 r1/r2 失败日志保留，r1 为 pane 条件写错、r2 为全程采样抓到真实 progress overlay，均已在根因层修正。
- 负载规则允许时（开跑前 1 分钟负载 4.96）全量 `npm test` **672/672、0 失败**，见 `artifacts/t099/npm-test-final.txt`；`npm run typecheck` 通过，`npm run build` 通过，见 `artifacts/t099/build-final.txt`。运行后 Chrome 孤儿计数为 0。
- 高负载 check-published 对主工作区 12 个唯一站点、3 个宽度全部完成，未出现 `material facts missing`，逐站输出见 `artifacts/t099/check-published-high.txt`、报告见 `artifacts/t099/check-published-high/report.json`，负载见 `uptime-check-published-high.txt`。当前 `e2622d8` 分支的 checker 报告 0 条失败；主工作区参考报告中的 16 条已知行长失败未在本分支 checker 中重现，未改 T-101 范围，因此该“与低负载只剩16条”对照仍留给验收确认。
- living docs 已同步，`project_map.py status --root .` 无 stale。本票状态保持 open，尚未启动 T-099 之外的新票；本地提交未 push。

check-published 扩展（2026-10-03）：

- `scripts/check-published.mjs` 的固定等待 inventory 已补入 `artifacts/t099/wall-clock-inventory.md`：Chrome 启动、iframe 目标、CTA smooth-scroll、表单 resize/scroll、lead persistence、整页截图和重启；visitor layout scanner 保持同步取数，不放宽任何事实/行长/溢出/覆盖断言。
- 高负载（6 个 CPU hog，`artifacts/t099/uptime-check-published-high.txt`）对主工作区 report 中 12 个唯一站点、3 个宽度全部完成，`material facts missing` 为 0，逐站输出 `artifacts/t099/check-published-high.txt`，报告 `check-published-high/report.json`。当前分支 checker 报告 0 条失败；主工作区参考报告的 16 条行长预期仍由 T-101 处理，未扩大本票范围。

主线/T-089 合并后的最终对照（merge `2576213`，结果提交待本次 Resolution commit）：

- 低负载基线使用主工作区 12 个站点 JSON（只读复制到本 worktree ignored store），报告 `artifacts/t099/check-published-low-main-records/report.json`：36 个页面、16 条失败，全部是参考报告中的中文/英文正文行长。
- 高负载运行前 1 分钟负载记录在 `uptime-check-published-high-merge-2576213.txt`（运行期间超过 20），报告 `artifacts/t099/check-published-high-merge-2576213/report.json`：同样 36 个页面、16 条失败，无 facts missing 或其他新失败。
- `artifacts/t099/check-published-failure-diff.txt` 逐项比较两份 report，`low=16 high=16 same=True`。
- 合并后的全量 `npm test` 为 **703/703、0 失败**（`artifacts/t099/npm-test-merge-2576213.txt`），typecheck/build 已在合并代码上通过；T-099 状态保持 open，未启动其他票。
