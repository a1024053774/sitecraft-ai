---
id: T-165
title: 预算网关按 token 估算预留
type: build
status: open
blocked_by: []
claimed_by:
supersedes:
---

## Why

`scripts/t153-real-budget.ts` 按 UTF-8 字节预留输入（每字节 1 token + 8192），中文一个字记 3 个 token，实际约 1 个，预留约为实际的 3 倍。它误拦了 T-160 教育站的修正调用和 T-162 的真实单条批注（青禾纸品局部修改预留 16,598，实际同类约 7–10k），T-159 也因单次预留过大导致写页截断。2026-10-13 负责人批准改为按 token 估算。优先级 3，但一直在挡真实运行，可与 T-159 并行。

## What to build

1. 输入预留改为按 token 估算：中文（CJK）、ASCII、其他字符分别按保守系数计，再加请求框架余量。系数和余量依据现有真实账本（`artifacts/t153`、`t158`、`t160` 的 usage.json：请求体与 DeepSeek 返回的 prompt_tokens）定，写明来源；估算值须不低于这些真实调用的实际 prompt_tokens。
2. 仍然拦住超支：累计已用 + 本次输入估算 + 本次输出上限不超过 SITECRAFT_TOKEN_LIMIT；实际用量超出估算时记入账本并停下（沿用现有 stopped 语义）。不加重试、不加宽松回退。
3. 不改网关的其他合同（显式上限、账本、resume、目录白名单、本地 origin 校验）。同步 AGENTS.md 中相关一句与本票。

## Acceptance

- [ ] 红绿：用 T-160 被拦的修正请求和 T-162 青禾纸品两次调用的真实请求体做测试，旧规则下判为放不进、新规则下放得进；测试先在父版本上失败
- [ ] 不放松安全：用真实账本里每次调用的请求体，断言新估算 ≥ 实际 prompt_tokens；构造超支场景（剩余额度不足）仍被拦
- [ ] 不调用 DeepSeek；typecheck、test、build 通过；独立 sol 实例代码审查通过
