---
id: T-099
title: 浏览器测试在机器高负载时不靠固定等待时长
type: build
status: closed
blocked_by: [T-094]
claimed_by: codex-build
supersedes:
---

## What to build

2026-10-03 多个 worktree 同时跑全量，15 分钟平均负载到 43。此时 `tests/workspace-interaction.test.ts` 的「workspace motion is 150–300 ms …」在 T-080、T-088、T-091、T-092 的全量里都失败过（断言「the progress lists its steps」等），单独重跑和父提交上能过；区块浏览器测试还会因 `/api/health` 超时失败。结果是每张票都拿不到「全量 0 失败」的证据。

动效时长读的是计算后的 CSS，不受负载影响；不稳定的是测试用固定 `sleep` 采样界面状态（进度步骤、面板展开、预览刷新），以及工作区核对的固定超时。先把每个浏览器测试里依赖墙钟时长的地方逐条列出（失败方式写下来），再改成等条件成立（有上限、超时报清楚等的是什么），断言本身不放宽：150–300 ms、只动 transform/opacity、减少动效时不动、预览刷新不遮挡页面，这些都保持原样。

同根因还覆盖 `scripts/check-published.mjs` 及其调用的 `visitor-layout-scan.js`：高负载时固定等待会在访客页预览、整页高度或区块渲染完成前取事实和量版面，造成 `material facts missing` 假失败。这里也必须改成有上限的条件等待，不得放宽事实、行长、溢出、覆盖或区块断言。

检查脚本还必须拒绝静默通过：页面未完成渲染时可能出现 `bodyLineLength` 为 0、`textContrast` 只有少量条目但 `failures` 为空。`visitor-layout-scan.js` 要返回可见区块、已测区块、正文段落、正文行和对比度条目的测量元数据；`check-published` 在判定前确认页面就绪且这些测量完整，缺失或明显为空时直接失败并写出缺失原因。不能用外部基线比例掩盖未取数。

不在本票：限制机器上同时跑的全量数（这是排工的事，由 supervisor 协调）。

## Acceptance

- [x] 先写出依赖墙钟时长的清单和各自的失败方式（`artifacts/t099/`）；能在父提交上复现失败（例如人为加负载或缩短采样窗口），存 red 输出
- [x] 修改后在高负载下（同时跑另一个全量或人为加负载，记录 `uptime`）`workspace-interaction` 连跑 5 次通过；全量 `npm test` 0 失败、`npm run typecheck`、`npm run build` 通过
- [x] `check-published` 在高负载下对主工作区 12 个站点（ID 见 `artifacts/merge-13ae686/check-published/report.json`）的结果与低负载一致：只剩已知的 16 条行长失败，不出现 `material facts missing`；记录 `uptime` 和逐站点输出
- [x] `check-published` 对未渲染或缺少测量结果的报告直接失败；父提交行为红测和当前实现通过证据均在 `artifacts/t099/`，高低负载报告逐行列出测量条数
- [x] 断言没有放宽（审查逐条对照）；代码审查通过；Claude 验收

## Resolution

2026-10-04（America/New_York），codex-build，最终合并 SHA `12562149adde50f62d1044a1aaceec38407163cb`：

- 已合并主线 `family-kit-assembly`（93e4e0e）。固定等待清单、失败方式和两个 equipment 测试已统一到 `artifacts/t099/wall-clock-inventory.md`、`browser-test-files.txt`；冲突保留两边功能。
- `completeness-merge-1256214.txt` 与 `transient-cover-merge-1256214.txt` 均在最终 SHA 通过；父提交缺测红测、短时遮挡红测和历史采样夹具均保留。`red-motion-parent-load.txt` 明确是通过日志，不作为红测。
- motion 高负载 5 次通过：`motion-merge-1256214-1..5.txt`，完整 SHA/命令/时间在每份日志首行，负载见 `uptime-motion-merge-1256214.txt`。
- 12 站低/高负载 check-published 使用 `artifacts/handoff/mainline-12-sites.txt` 的 zsh 数组参数，并在每次运行前强制复制主工作区站点文件。报告 `check-published-low-merge-final-array/report.json` 与 `check-published-high-merge-final-array/report.json` 各 36 行、0 失败；`check-published-merge-failure-diff.txt` 逐行显示两份失败集合相同为空，textContrast/bodyLineLength/facts 条数均不少于 `artifacts/merge-32a4ee9/check-published/report.json` 基线。
- 旧报告 `check-published-low-merge-2576213` 的 0 条行长根因是预览、整页高度和字体尚未完成时就调用同步 scanner；且当时没有测量完整性元数据，所以无数据被静默当成无失败。当前 checker 在取数前等待这些条件，并对测量缺失直接失败。
- 合并后第一次全量在机器高负载下的设备数量带失败已保留于 `npm-test-merge-1256214.txt`；低负载最终全量 `npm-test-merge-1256214-final-low.txt` **770/770、0 失败**。`typecheck-merge-1256214-clean.txt`（清除旧 `.next` 后）和 `build-merge-1256214.txt` 均退出 0。
- `project_map.py status --root .` 无 stale；本票状态保持 open，等待 Astra/Claude 验收。本地提交待本次 Resolution commit，未 push。

### 合回主线与关闭（Claude，2026-10-04 EDT）
- Astra 三轮：r1 NO_GO（预览遮挡改成只看一次、diff 比错报告）、r2 NO_GO（证据未绑定提交、清单遗漏）、r3 PASS（`artifacts/review-astra-t099-r3.md`）。合并主线 `e2e8863`；主工作区 3034：build、typecheck 通过，全量 770/770，12 站 `check-published` 36 行 0 失败且逐行测量条数不少于基线（`artifacts/merge-e2e8863/`）。check-published 现在对未渲染 / 缺测量直接判失败。Claude 验收关闭。
