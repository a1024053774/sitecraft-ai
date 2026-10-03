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

- [ ] 测试先写、改动前先失败（行为级）：在子进程里经助手打开浏览器，分别正常结束、抛错结束、被 SIGTERM，之后断言它启动的 Chrome 已不存在；SIGKILL 后再开一次助手，断言上一次的 Chrome 被回收，而另一个调试端口有连接的 Chrome 不被回收
- [ ] 全量 `npm test` 前后各数一次 `sitecraft-workspace-*` 且父进程为 1 的 Chrome，跑完后不增加（第一次运行时下降为 0 或只剩有连接的）；`npm run typecheck`、`npm run build` 通过
- [ ] 代码审查通过；Claude 验收
