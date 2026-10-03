---
id: T-094
title: 浏览器测试不再遗留无头 Chrome
type: build
status: open
blocked_by: []
claimed_by: codex-build
supersedes:
---

## What to build

2026-10-03 13:45（纽约时间）本机有 139 个 `chrome-headless-shell` 父进程是 1、`--user-data-dir=/tmp/sitecraft-workspace-<pid>`，最老的已经跑了 12 小时以上；机器负载 5–7，`workspace-interaction` 的偶发超时可能与此有关。根因：`tests/helpers/workspace-browser.ts` 的 `openBrowser()` 以 `detached` + `unref()` 启动 Chrome，助手自己从不结束它；`tests/t057-rework.test.ts`、`t063-hero-title-fit`、`workspace-dark-contrast`、`workspace-interaction` 从不发 `Browser.close`，其余测试只在正常结束时发，超时、断言抛出或进程被杀时都会留下 Chrome。

改成助手负责它启动的 Chrome 的整个生命周期：

- 助手提供一个关闭入口，关闭时结束它启动的那个 Chrome 进程（不是只断开 CDP），所有浏览器测试改用它；测试失败、超时、收到 SIGINT/SIGTERM 时也要结束。
- 进程被 SIGKILL 时无法自清理：下一次 `openBrowser()` 回收「创建它的进程（`user-data-dir` 里的 pid）已经不存在、且调试端口上没有已建立连接」的 `sitecraft-workspace-*` Chrome。判断不确定时不杀（pid 被复用就当作还活着）；绝不碰别的 user-data-dir 的 Chrome，也不碰其他 agent 正在用的。
- T-077 的按端口锁、T-083 的工作区核对不变。`scripts/check-published.mjs` 自带的 Chrome 不在本票范围，除非证明它也漏。

## Acceptance

- [x] 测试先写、改动前先失败（行为级）：在子进程里经助手打开浏览器，分别正常结束、抛错结束、被 SIGTERM，之后断言它启动的 Chrome 已不存在；SIGKILL 后再开一次助手，断言上一次的 Chrome 被回收，而另一个调试端口有连接的 Chrome 不被回收
- [x] 全量 `npm test` 前后各数一次 `sitecraft-workspace-*` 且父进程为 1 的 Chrome，跑完后不增加（第一次运行时下降为 0 或只剩有连接的）；`npm run typecheck`、`npm run build` 通过
- [ ] 代码审查通过；Claude 验收

## Resolution

2026-10-03（America/New_York），codex-build：

- 先写行为夹具 `tests/t094-chrome-lifecycle.fixture.ts` 和子进程 `tests/t094-chrome-lifecycle-child.ts`。父提交 `957ceb6` 上的真实红测见 `artifacts/t094/red-lifecycle.txt`：正常退出遗留 Chrome，SIGKILL 后下一次助手无法回收孤儿；启动尚未就绪的首份异常保留在 `red-lifecycle-startup-timeout.txt`，没有覆盖异常证据。
- `openBrowser()` 现在记录自己 `spawn()` 的 PID、user-data-dir 和调试端口；`Cdp.close()` / `closeBrowser()`、socket close、SIGINT/SIGTERM、进程退出和异常路径都只清理自己持有的 Chrome。下一次打开扫描精确的 `sitecraft-workspace-<数字>` 命令行，仅当目录里的 owner PID 已不存在且 `lsof` 确认调试端口没有 established 连接时 SIGKILL 回收；回收同时结束 detached Chrome 进程组并在有界窗口内重复确认，避免 reparent 延迟留下子进程；PID 仍活着、端口连接状态不确定、命令行或 user-data-dir 不匹配时保留。T-077 的锁和 T-083 的 `SITECRAFT_BASE` 工作区核对未改。
- 所有使用共享助手的浏览器测试改用 `closeBrowser()`；T-075 的独立 Chrome 夹具继续只结束自己创建的进程。
- 修复后生命周期夹具 2/2 通过：`artifacts/t094/lifecycle-final4.txt`，夹具等待正常 socket close 清理完成后再退出，3 秒后计数仍为 0（`chrome-count-before-lifecycle-final4.txt` / `chrome-count-after-lifecycle-final4.txt`）。第一次修复运行从 154 个孤儿降到 0（`chrome-count-before-fix.txt` / `chrome-count-after-fix.txt`）；最终 full run 的即时计数为 2 → 0（`chrome-count-before-npm-final2.txt` / `chrome-count-after-npm-final2.txt`），随后观察到 reparent 延迟出现的 6 个孤儿，再由下一次助手运行回收到 0（`chrome-count-before-final-reclaim2.txt` / `chrome-count-after-final-reclaim2.txt`）；最终单子进程正常退出探针在 5 秒后仍为 0（`chrome-count-before-single-normal2.txt` / `chrome-count-after-single-normal2.txt`）。没有手动 pkill。
- 3056、指定 Chrome for Testing 路径下最终全量 `npm test` 为 658/665，0 个 Chrome 遗留，输出 `artifacts/t094/npm-test-final2.txt`。7 个失败均为已知环境/父提交问题：family-modules 仍包含 equipment，以及 vendor 子模块未初始化造成 fresh/genai/tailcast 快照资产缺失；第一次全量的关闭竞态和 motion 失败原始输出保留在 `npm-test-before-close-race.txt`，没有覆盖。
- `npm run typecheck` 通过（`artifacts/t094/typecheck-final.txt`），`npm run build` 通过（`artifacts/t094/build-final.txt`）。`docs/project/spec.md` 已记录生命周期和回收契约，MAP living-doc 验证已同步；`project_map.py status --root .` 无 stale。状态保持 open，本地提交未 push。

合并主线后的再验证（2026-10-03，America/New_York）：

- 在本 worktree 合并 `family-kit-assembly` 到 `488a295`（merge commit `d7d78da`），冲突按主线版本处理；从主工作区补齐 ignored `vendor/open-source-templates/fresh/dist`、`genai/dist`、`tailcast/dist`。
- 开跑时 1 分钟负载为 5.30，且没有另一个全量测试。`SITECRAFT_BASE=http://127.0.0.1:3056`、指定 Chrome for Testing 路径下全量 `npm test` **665/665、0 失败**，见 `artifacts/t094/npm-test-merge-488a295.txt`；workspace motion 通过，没有启动或修改 T-099。Chrome PPID=1 计数 **4 → 0**，停止 dev server 后等待 3 秒仍为 0，见 `chrome-count-before-merge-full.txt` / `chrome-count-after-merge-full.txt`。
- 合并后 `npm run typecheck` 和 `npm run build` 均通过，见 `artifacts/t094/typecheck-merge-488a295.txt`、`artifacts/t094/build-merge-488a295.txt`。本次 Resolution 更新为本地提交，未 push。
