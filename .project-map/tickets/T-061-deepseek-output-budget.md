---
id: T-061
title: DeepSeek 结构化输出被推理用完 token，生成时常失败
type: build
status: open
blocked_by: []
claimed_by: kiro
supersedes:
---

## What to build

T-053 第 3 步实跑发现（Kiro，2026-09-30，日志 `artifacts/t053/probe-provider-p3e*.log`）：`deepseek-flash` 的 8192 `max_tokens` 经常被推理过程用完，结构化 JSON 返回不完整，只能靠重试；P3E 探针 8 次里第一轮全部用完，实跑 2 次失败 1 次。用户看到的是「模型返回的方案无法安全校验」，看不出原因。这是主流程可用性问题，改动前就存在。

先查清根因再改：DeepSeek 当前 API 对这个模型能否关闭或限制推理、`max_tokens` 上限是多少、推理 token 是否计入 `max_tokens`（读官方文档并用一次真实请求核对 `usage`），再按查到的事实选最小修法（例如结构化调用关闭推理、提高上限、精简提示）。不靠加重试掩盖；用户文案要说出真实原因（「这次生成被截断，没有改动草稿，可以重试」）。和 T-058（失败分类日志）一起改 `lib/ai-provider.ts`，同一个人做，避免同文件并行。T-053 的最终盲评要用本票修好后重新生成的三份资料，所以本票不等 T-053。

## Acceptance

- [ ] 写明查到的 DeepSeek 事实和来源（文档链接、一次真实请求的 `usage`）
- [ ] 三份模拟资料各走 3 次需求对齐生成，截断失败为 0 或给出真实原因；记录每次的 token 用量
- [ ] 测试先写、改动前先失败；`npm run typecheck`、`npm test`、`npm run build` 通过
- [ ] 代码审查通过；Claude 验收

## Resolution

Kiro，2026-09-30（纽约时间）。提交：`0f6bec2`（预算、截断不重试、真实文案），`568d406`（负责人定的补充：整站生成最低 65536、每次 300 秒；格式不对的日志加字段；刷新后恢复的失败状态说出原因）。本地提交，未推送；勾选项等 Astra 审查后由负责人勾。

查到的 DeepSeek 事实：

- 思考模式默认开，强度 high；`thinking: {type: "disabled"}` 或 `reasoning_effort: "none"` 关闭，也可设 low / high / max；思考模式下 temperature 不起作用。<https://api-docs.deepseek.com/guides/thinking_mode>
- `max_tokens` 是这次最多生成的 token 数，范围 1–393216；不设时非思考 8K、思考 64K（max 强度 128K）；`finish_reason=length` 表示到了上限；usage 里有 `completion_tokens_details.reasoning_tokens`。<https://api-docs.deepseek.com/api/create-chat-completion>
- `deepseek-flash` 是 DeepSeek-V4.1-Flash，默认思考，最多输出 384K。<https://api-docs.deepseek.com/quick_start/pricing>
- JSON 输出要把 `max_tokens` 设够，否则会被截断，偶尔返回空内容。<https://api-docs.deepseek.com/guides/json_mode>
- 文档没直接写推理 token 算不算进 `max_tokens`，真实请求确认算：02:57 注塑整站生成，`max_tokens` 8192，usage 输入 6096、输出 8192、其中推理 8192，内容为空，`finish_reason=length`（`artifacts/t053/step4-probe-molding.log`）；03:50 P3E 不设上限，输出 13741、其中推理 11201，57 秒正常结束（`artifacts/t061/probe-budget.jsonl`）。

对比测过的做法（03:50–04:00，`artifacts/t061/probe-budget.mjs` → `probe-budget.jsonl`、`probe-*.log`，只调模型不写草稿）：默认强度不设上限，整站生成 13.7K–22.7K（推理 11.2K–18.7K）、57–95 秒，4 次都一次成功；low 强度加 8192 上限，注塑 2 次里 1 次两轮都截断；关掉思考 7–12 秒，但 4 次里 3 次两轮都超过 24 条修改被拒；规划原来的 3000 上限，5 次尝试截断 3 次，不设上限时 2.6K–3.2K、13–16 秒；看图 800 上限实际 435–495。

改法：

- 思考模式保持默认（关掉或调低都更容易失败，也可能降低质量）。
- 整站生成：`max_tokens` 最低值 8192 → 32768（`0f6bec2`）→ 65536（`568d406`，负责人：现阶段成功率优先，不设成本和时延指标）；每次尝试最多等 90 → 180 → 300 秒；`DEEPSEEK_MAX_TOKENS` 设得更大时仍以它为准。
- 需求对齐规划：3000 → 8192，每次 45 → 90 秒。看图和预览审查不变（800 够用）。
- 回答还是到了上限时不再重试（同样的预算多半还是用完），返回新错误码 `truncated`，用户看到「这次生成被截断，没有改动草稿。 可以直接重试；已保存的问题和答案仍可继续。」，规划这一步是「需求对齐规划被截断，原需求没有修改草稿，可以重试。」。刷新后恢复需求对齐时也先说这条原因（`lib/workspace-copy.ts` 的 `alignmentFailureText`，只认错误目录里的说法）；之前问题卡还在时只显示「等待你选择：…」。
- 本票没有加重试：回答不是 JSON 或格式不对时仍按原来的规则再试一次，原因记在 T-058 的日志行里。

测试：`tests/structured-output-budget.test.ts`（预算、不关思考、从 `AbortSignal.timeout` 读超时、截断只试一次）、`tests/user-errors.test.ts`（截断文案）、`tests/chat-route-truncated.test.ts`（对话修改、需求对齐规划、需求对齐生成三条路径走真实 route）、`tests/workspace-copy.test.ts`（恢复时的失败文案，以及它在 `page.tsx` 里排在问题卡之前）。

改动前失败：04:13 在 `3c5c3bb` 上 `node --test --experimental-strip-types tests/structured-output-budget.test.ts tests/user-errors.test.ts tests/chat-route-truncated.test.ts`，14 条中 9 条失败（`artifacts/t061/red-t061-budget.txt`）；补充部分 04:46 在 `0f6bec2` 上 17 条中 7 条失败（`artifacts/t061/red-t061-followup.txt`）。

改动后：`0f6bec2`，04:15–04:16 `npm run typecheck` 通过、`npm test` 403/403、`npm run build` 通过（`artifacts/t061/t061-*.txt`）；`568d406`，04:50–04:52 typecheck 通过、`npm test` 406/406、build 通过（`artifacts/t061/t061b-*.txt`）。

验收实跑：`node --experimental-strip-types artifacts/t061/accept-runs.mjs`，进程内调真实 `POST /api/sites` 和 `POST /api/sites/<id>/chat`（start → select → confirm），真实 DeepSeek，样子选工程工业，其他题选推荐项，依次跑、不并行；fetch 只旁听并记用量，不改请求。

- 04:20–04:34，`0f6bec2`（整站生成上限 32768）：三份资料各 3 次，9 次中 8 次应用。注塑 #2（`2b02c78a…`）截断：32761 token，其中推理 31191，136 秒；用户看到真实原因，草稿停在 v2，4 个答案保留。规划 9/9 正常结束，1239–4527 token（推理 665–4201），7–23 秒；生成 12 次尝试中 11 次正常、1 次截断，6424–32761 token（推理 4315–31191），25–136 秒；3 次靠第二次尝试（1 次不是 JSON、2 次格式不对）。每次用量见 `artifacts/t061/accept-runs-summary.json`。
- 04:52–04:58，`568d406`（上限 65536）：注塑单独再跑 3 次，3 次都一次成功，整站生成 16319 / 14774 / 29654 token（推理 12235 / 10863 / 25961），65 / 59 / 121 秒，没有失败日志行（`artifacts/t061/accept-molding-65k-summary.json`）。
- 刷新恢复：04:49 在工作台打开上面那次截断的站点并记住会话，对话里显示「这次生成被截断，没有改动草稿。 可以直接重试；已保存的问题和答案仍可继续。」，问题卡在它下面（`artifacts/t061/restore-failure/truncated-after-1440.png`，看过）。

遗留：注塑一次整站生成的推理量在 8K–31K 之间波动；格式不对时的重试会拉长等待，最坏约 2 × 300 秒（验收里最慢一次整趟 182 秒）。验收建的 12 个站点留在 `.sitecraft-data`。
