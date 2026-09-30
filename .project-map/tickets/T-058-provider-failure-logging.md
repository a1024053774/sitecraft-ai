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

## Resolution

Kiro，2026-09-30（纽约时间）。提交：`3c5c3bb`（失败日志），`568d406`（格式不对时加出错字段，随 T-061 的补充提交一起）。本地提交，未推送；勾选项等 Astra 审查后由负责人勾。

做了什么：

- `lib/ai-provider.ts` 的四个模型调用（需求对齐规划、整站生成、预览审查、看图）每次失败尝试写一行 `console.warn`：`[sitecraft] DeepSeek call failed {call, attempt, of, category, status, ms, traceId, finish?, tokens?, cause?, fields?}`。类别是 timeout / http / network / parse / schema，另有 truncated（回答到了 `max_tokens`，处理见 T-061）。随后重试成功的那次失败也记。
- trace id 取 DeepSeek 响应头 `x-ds-trace-id`（实测它不带 `x-request-id`）；收到回答时加结束原因和 token 用量（输入、输出、其中推理）；网络错误加错误码（如 `ECONNRESET`）；格式不对时加出错字段 `路径:问题类型`（如 `operations.0.value:invalid_union`），最多 6 条，不带值，模型自编的键写成 `?`（`lib/schema-issue-fields.ts`）。trace id、结束原因、错误码和字段都先按格式校验再写。
- 不记密钥、资料、prompt、模型输出和上游错误原文（它可能复述请求）。用户看到的错误码和提示不变；重试和超时的改动属于 T-061。

测试：`tests/ai-provider-failure-log.test.ts`（假 fetch，每种类别一例，外加规划调用；断言日志里没有 key、资料里的标记串、prompt 和上游原文；格式不对时字段正确，不是 JSON 时没有字段）、`tests/schema-issue-fields.test.ts`（自编键和异常问题类型被遮住）。

改动前失败：04:01 在 `81e478e` 上 `node --test --experimental-strip-types tests/ai-provider-failure-log.test.ts`，8 条全部失败（`artifacts/t061/red-t058-failure-log.txt`）。字段部分：04:46 在 `0f6bec2` 上相关 2 条失败，`schema-issue-fields` 因模块不存在失败（`artifacts/t061/red-t061-followup.txt`）。

改动后：`3c5c3bb`，04:03–04:04 `npm run typecheck` 通过、`npm test` 398/398、`npm run build` 通过（`artifacts/t061/t058-*.txt`）；`568d406`，04:50–04:52 typecheck 通过、`npm test` 406/406、build 通过（`artifacts/t061/t061b-*.txt`）。

真实运行：T-061 验收（04:20–04:34，`0f6bec2`，真实 DeepSeek）记下 4 行：1 行 parse、2 行 schema（都在第二次尝试成功前）和 1 行 truncated，都带 trace id 和 token 用量（`artifacts/t061/accept-runs.log`）。字段路径是之后加的，还没有在真实失败里出现过（`568d406` 之后注塑 3 次都一次成功，没有失败行）。
