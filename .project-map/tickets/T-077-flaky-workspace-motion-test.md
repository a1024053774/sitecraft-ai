---
id: T-077
title: 工作台动效测试在整套运行时不稳定
type: build
status: open
blocked_by: []
claimed_by:
supersedes:
---

## What to build

`tests/workspace-interaction.test.ts` 的「workspace motion is 150–300 ms of transform/opacity and stops under prefers-reduced-motion」在 T-070、T-072、T-075、T-076 的全量 `npm test` 里反复失败（等待进度列表或 3034 连接超时，1440 / 375 都出现过），单独串行重跑都通过；Astra 在 T-070 审查时在父提交上也复现，确认不是那些改动引入的。每次验收都要额外解释这一条，证据不干净。

找出它在整套运行时失败的根因（等待条件、和别的浏览器测试抢同一个 dev server / Chrome、超时预算），在根因层修；不靠加长超时、不跳过、不放宽动效断言。

低优先级：排在页面质量和主流程之后，有空的执行者再领。

## Acceptance

- [ ] 写清根因并有证据（失败时的日志 / 时间线）
- [ ] 修复后全量 `npm test` 连续三次该测试都通过，动效断言没有放宽
- [ ] 代码审查通过；Claude 验收
