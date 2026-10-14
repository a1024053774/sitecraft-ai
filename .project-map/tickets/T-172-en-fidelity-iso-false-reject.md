---
id: T-172
title: 英文保真误拒「ISO 9001 certified.」
type: build
status: open
blocked_by: [T-169]
claimed_by:
supersedes:
---

## Why

T-169 执行中发现：T-151 的英文机械保真检查把「取得 ISO 9001 认证。」的正确译文「ISO 9001 certified.」判为不符而拒收。这是 T-151 规则本身的缺陷，不是 T-169 引入的。2026-10-14 构思主控决定另开小票、低优先级；T-169 只把它记成已知缺口。

## What to build

1. 用 T-169 记录的这条真实样本复现，找出是哪条保真规则误判（含数字记号、型号/单位抽取、缩写或公司名槽位等），在该规则层修正。
2. 不放宽其他保真保护：数字换序、新增数字、单位换算、整页修正等既有红例仍须拒收。

## Acceptance

- [ ] 该样本先在父版本上被拒（红），修后通过（绿）
- [ ] `tests/t151-fidelity-rules.test.ts` 等既有保真用例全部仍通过；不调用 DeepSeek
- [ ] 全量 test、typecheck、build 通过；独立 sol 实例代码审查通过
