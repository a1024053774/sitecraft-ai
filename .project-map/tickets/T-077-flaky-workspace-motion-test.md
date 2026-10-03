---
id: T-077
title: 工作台动效测试在整套运行时不稳定
type: build
status: open
blocked_by: []
claimed_by: codex-build
supersedes:
---

## What to build

`tests/workspace-interaction.test.ts` 的「workspace motion is 150–300 ms of transform/opacity and stops under prefers-reduced-motion」在 T-070、T-072、T-075、T-076 的全量 `npm test` 里反复失败（等待进度列表或 3034 连接超时，1440 / 375 都出现过），单独串行重跑都通过；Astra 在 T-070 审查时在父提交上也复现，确认不是那些改动引入的。每次验收都要额外解释这一条，证据不干净。

找出它在整套运行时失败的根因（等待条件、和别的浏览器测试抢同一个 dev server / Chrome、超时预算），在根因层修；不靠加长超时、不跳过、不放宽动效断言。

低优先级：排在页面质量和主流程之后，有空的执行者再领。

## Acceptance

- [x] 写清根因并有证据（失败时的日志 / 时间线）
- [x] 修复后全量 `npm test` 连续三次该测试都通过，动效断言没有放宽
- [ ] 代码审查通过；Claude 验收

## Resolution

2026-10-03（America/New_York），codex-build：

- 根因证据见 `artifacts/t077/failure-timeline.txt`：默认 `npm test` 并行启动测试文件；18 个浏览器测试文件通过 `tests/helpers/workspace-browser.ts` 共享 3034，motion 测试在进度列表读取处失败，历史上也出现 3034 `UND_ERR_CONNECT_TIMEOUT`。失败日志来自 T-072/T-075/merge-7ff71e3，单独运行则通过。
- 根因修复在共享 helper：`openBrowser()` 使用按 `SITECRAFT_BASE` 端口命名的原子 O_EXCL lock 文件，记录 PID、`ps` 启动标识和 acquiredAt；owner 写入前崩溃留下的空/残缺记录按过期协议回收，PID 复用按启动标识拒绝，启动标识暂不可读时由 heartbeat mtime 保证活 owner 不被抢占。CDP socket 关闭释放锁，死 owner 才会被回收；默认 CDP 端口也扩大为按 PID 派生，避免浏览器端口碰撞。没有改动动效断言、等待时长或产品代码。
- 新增手动行为夹具 `tests/t077-browser-lock-recovery.fixture.ts` / `tests/t077-browser-lock-probe.ts`：在 6cf1015 父版本上两个 stale lock 场景均行为级失败见 `artifacts/t077/red-lock-recovery.txt`，当前提交独立 fixture 2/2 通过。fixture 使用独立 lock namespace/CDP，不加入普通全量测试。
- 修复后全量 `npm test` 连续三次 exit 0：`artifacts/t077/npm-test-r3-1.txt`、`npm-test-r3-2.txt`、`npm-test-r3-3.txt`；早期锁/端口/fixture 失败日志保留为 `npm-test-lock-bug-*`、`npm-test-r3-*bug-*`。typecheck/build 输出见 `artifacts/t077/typecheck-final2.txt`、`artifacts/t077/build-final2.txt`。
- 本票状态保持 open；代码审查与 Claude 验收留给 supervisor，第三项验收框未勾选。不 push。
