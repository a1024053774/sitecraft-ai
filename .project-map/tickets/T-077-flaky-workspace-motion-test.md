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
- 根因修复在共享 helper：`openBrowser()` 现在以跨进程 owner lock 串行化共享 dev server/Chrome 会话，CDP socket 关闭释放锁，死进程 owner 才会被回收。没有改动动效断言、等待时长或产品代码。第一次锁实现的 owner 创建竞态证据保留在 `artifacts/t077/npm-test-lock-bug-1.txt` 至 `-3.txt`，随后修正为 owner 尚未出现时等待。
- 修复后全量 `npm test` 连续三次 exit 0：`artifacts/t077/npm-test-1.txt`、`npm-test-2.txt`、`npm-test-3.txt`；focused motion 也通过，typecheck/build 输出见 `artifacts/t077/typecheck-after-lock-fix.txt`、`artifacts/t077/build.txt`。
- 本票状态保持 open；代码审查与 Claude 验收留给 supervisor，第三项验收框未勾选。不 push。
