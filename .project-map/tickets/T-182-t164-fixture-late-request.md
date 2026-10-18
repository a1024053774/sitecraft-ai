---
id: T-182
title: T-164 局部输出上限测试在文件结束后收到半截请求
type: build
status: open
blocked_by: [T-180]
claimed_by:
supersedes:
---

## Why

T-181 合并提交 `61e1107` 的第一轮主线全量（2026-10-18，`artifacts/t181/main-verify-run1/`，test.log 第 1059 行，运行目录 `test-run-1792349721121-16236`）中，`tests/t164-local-output-limit.test.ts` 两个子用例都通过，但文件结束后替身服务第 17 行 `JSON.parse(raw)` 收到空或不完整正文，抛出 `SyntaxError: Unexpected end of JSON input`，以 unhandledRejection 令该文件失败。同一源码在 T-181 分支 4 次全量与此前全部 t167 运行中均未出现。那轮运行期间构思主控在并行删除测试残留（不含本轮数据根和 `.next-test`），不能排除影响。负责人 2026-10-18 决定：排在 T-180 之后，不挡 T-180。

## What to build

1. 替身收到不完整或无法解析的正文时明确失败并指明请求（路径、已收字节、所属用例），不得变成测试结束后的未捕获异常，也不能只用 catch 吞掉。
2. 查清测试结束后仍在发请求的是哪条调用（后台 after 任务、修正轮或事实核对），在根因层修：测试等它到达明确终态再结束，或证明该调用不应在结束后发生并修正产品侧。
3. 成对证据：能让旧替身复现同一 unhandledRejection 的构造，新版明确失败或等待终态；不放宽断言，不扩大上限。

## Acceptance

- [ ] 迟到请求的来源写进 Resolution，附日志定位
- [ ] 成对测试先红后绿；typecheck、test、build 通过；独立 fast 审查通过

## Resolution
