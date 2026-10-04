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

检查脚本还必须拒绝静默通过：页面未完成渲染时可能出现 `bodyLineLength` 为 0、`textContrast` 只有少量条目但 `failures` 为空。`visitor-layout-scan.js` 要返回可见区块、已测区块、正文段落、正文行和对比度条目的测量元数据；`check-published` 在判定前确认页面就绪且这些测量完整，缺失或明显为空时直接失败并写出缺失原因。不能用外部基线比例掩盖未取数。

不在本票：限制机器上同时跑的全量数（这是排工的事，由 supervisor 协调）。

## Acceptance

- [x] 先写出依赖墙钟时长的清单和各自的失败方式（`artifacts/t099/`）；能在父提交上复现失败（例如人为加负载或缩短采样窗口），存 red 输出
- [x] 修改后在高负载下（同时跑另一个全量或人为加负载，记录 `uptime`）`workspace-interaction` 连跑 5 次通过；全量 `npm test` 0 失败、`npm run typecheck`、`npm run build` 通过
- [x] `check-published` 在高负载下对主工作区 12 个站点（ID 见 `artifacts/merge-13ae686/check-published/report.json`）的结果与低负载一致：只剩已知的 16 条行长失败，不出现 `material facts missing`；记录 `uptime` 和逐站点输出
- [x] `check-published` 对未渲染或缺少测量结果的报告直接失败；父提交行为红测和当前实现通过证据均在 `artifacts/t099/`，高低负载报告逐行列出测量条数
- [ ] 断言没有放宽（审查逐条对照）；代码审查通过；Claude 验收

## Resolution

2026-10-04（America/New_York），codex-build：

- 在 `family-kit-assembly` `2576213` 合并后的代码上完成改动。固定等待逐条清单和失败方式见 `artifacts/t099/wall-clock-inventory.md`、`wall-clock-scan.txt`；T-089 的 visitor hard gates 与本票等待条件同时保留。
- 浏览器助手统一使用命名条件等待；移动 375 初始隐藏预览先切到预览 pane 再等待 hydration，进度条先等 current step，再在页面内 `requestAnimationFrame` 等至少两个步骤。预览刷新在 revision+hydration 完成前持续采样遮挡历史。断言仍保持 150–300ms、transform/opacity/visibility 白名单、reduced-motion 无动效和 preview 不遮挡。
- `scripts/check-published.mjs` 的 Chrome、iframe、预览 ready、字体、整页高度、截图和 lead 取数均改为有上限的条件等待；`visitor-layout-scan.js` 返回可见/已测区块、对比度条目、正文段落和行条目元数据，缺少元数据、区块未测或正文测量为空直接失败。父提交缺测行为红测见 `red-check-published-completeness-parent.txt`，当前实现通过见 `green-check-published-completeness.txt`；`red-short-window-parent.txt` 证明父实现会漏掉短时遮挡，`transient-cover-history.txt` 证明当前全程采样能抓到遮挡历史。`red-motion-parent-load.txt` 是通过日志而非红测，未作为失败证据。
- 主工作区 12 个站点的低/高负载报告为 `check-published-low-completeness/report.json`、`check-published-high-completeness/report.json`，各 36 行；每行都有 11 个可见且已测区块、正文段落/行和对比度条目。`check-published-failure-diff-completeness.txt` 逐行结果为 `low=16 high=16 same=True`，只有既有正文行长失败，无 facts missing。
- 人为负载（1 个 CPU hog；运行期间 1 分钟负载记录见 `uptime-motion-load-final-r11.txt`）下 motion 连跑 5 次通过，日志为 `motion-load-final-r11-1..5.txt`。错误入口、过高负载和时序缺口日志均保留；最终 focused motion 也通过 `motion-after-progress-delay.txt`。
- 合并后最终全量 `npm test` **703/703、0 失败**，见 `npm-test-final-t099.txt`；`npm run typecheck` 和 `npm run build` 均退出 0，见 `typecheck-final-t099.txt`、`build-final-t099.txt`。开发服务器已在验证后停止，未启动 T-102。
- AGENTS.md、`docs/project/spec.md` 已同步发布检查的就绪与测量完整性要求；`project_map.py status --root .` 在提交前复核无 stale。票状态保持 open，等待独立审查与 Claude 验收；不 push。
