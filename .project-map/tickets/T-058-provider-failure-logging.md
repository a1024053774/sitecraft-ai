---
id: T-058
title: DeepSeek 失败时服务端记下脱敏的失败类别
type: build
status: open
blocked_by: []
claimed_by: kiro
supersedes:
---

## What to build

2026-09-29 Astra 诊断（`artifacts/diagnose-alignment-no-confirmation.md`，gitignore）：注塑厚资料包一次需求对齐提交得到 `provider_error`，状态机安全失败、草稿未改，同一资料手动重试成功；但 `lib/ai-provider.ts` 的 `requestStructuredOperations` 把 5xx、429、网络异常、解析失败都压成 `provider_error`，服务端没有任何记录，无法区分原因。

在失败边界记一行脱敏的服务端日志：HTTP 状态、第几次尝试、分类（timeout / http / network / parse / schema）、耗时、上游 request id（有的话）。不记 API key、不记资料正文和完整 prompt。用户看到的文案和错误码不变，不加重试、不把失败改成成功。和 T-061 由同一个人一起做（2026-09-30 起不再等 T-053：T-053 剩下的工作不碰 `lib/ai-provider.ts`），避免同文件并行修改。

## Acceptance

- [ ] 测试覆盖每种分类各一例（用假的 fetch），并断言日志里没有 key 和资料正文；测试在改动前先失败
- [ ] `npm run typecheck`、`npm test`、`npm run build` 通过
- [ ] 代码审查（Astra）通过；Claude 验收
