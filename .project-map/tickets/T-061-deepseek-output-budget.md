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
