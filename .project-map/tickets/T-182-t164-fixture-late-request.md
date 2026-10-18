---
id: T-182
title: T-164 局部输出上限测试在文件结束后收到半截请求
type: build
status: open
blocked_by: [T-180]
claimed_by: Codex fast（T-182 执行实例）
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

执行实例：Codex fast，工作树 `sitecraft-ai-t182`，基线 `e002c6c`。本票仅改测试替身与生命周期证据；输出上限、预算、产品代码和原有通过条件不变。独立 fast 审查由负责人另派，本实例不启动审查。

现场定位（2026-10-19）：`/Users/luckye/Documents/Code/sitecraft-ai/artifacts/t181/main-verify-run1/test.log:1057–1060` 先记录两个子用例通过，再记录文件结束后的 `Unexpected end of JSON input` / unhandledRejection。对应 `artifacts/t162/self-contained-1792349997729-25504/`：`local-output-truncated.json` 的站点 `881e53a6-3d40-444a-9b1b-50940d3cf3da` 仅有一次 local-edit，19:00:04.003Z 开始、耗时 3ms；`local-output-repair.json` 的站点 `9311458b-20ee-4f70-b40d-c9c9ec4af277` 有四次 local-edit（首轮两组、修正两组）及一次 local-facts，最后一次事实核对 19:00:13.197Z 开始、耗时 8ms。`timings.json` 中对应 after.task 分别于 19:00:04.013Z、19:00:13.279Z 左右完成，随后 state 读回 error / complete（最后一次 13.285Z）。运行目录 `test-run-1792349721121-16236/dev.log:403–407,413–421` 对应这两个站点的界面和预览；chat 由进程内生产路由桥执行，不会出现在 Next dev 的 POST 日志中。

已证实的根因是旧替身把 HTTP 回调中的读取、解析异常留成无人接收的 Promise 拒绝；且两个用例共用监听器和可变 mode，解析前没有请求归属。已记录的 after、修正和事实核对均已完成，不能把坏请求认定为这些调用。旧替身在 JSON.parse 之前不记录 method/path/字节数，现场也没有原始坏请求；其具体发送者与用途仍 **INCOMPLETE**，不把「半截正文」或清理影响当成已证实事实。

警告时间不等于请求时间：`node --test --experimental-strip-types artifacts/t182/parent-during-request.ts` 在所属用例仍运行时发送相同空 POST，也在子用例通过后于文件尾报告同一句 “asynchronous activity after the test ended” / unhandledRejection（退出 1，`parent-during-red.log`）。因此现场警告本身不能证明请求在用例结束后才到达，更不能据此认定生产 after 漏等；新增请求起止时间用于消除这项不可定位性。

已实现的部分：每个局部用例建立独立监听器；每个请求在读取前登记监听器所属用例、请求序号、方法和路径，累计实际 Buffer 字节，记录起止时间、complete、用途及 responded / failed 终态。坏正文返回 HTTP 400；异常保存在失败集合，关闭先停止接收并等待已接收请求和处理 Promise，落盘后抛 AggregateError，使测试明确失败。T-164 保持等待生产 after；另以最终事实响应闸门证明事实核对挂起时不能先 settle，并核对当时的实际请求数与持久化 modelCalls。监听器保留到桥的全部 after 回调收束后关闭，迟到坏请求仍由文件收尾断言报告。初始化请求的归属仍有下述缺口，本候选不算完成。

成对证据（本工作树 `artifacts/t182/`）：从父版 `e002c6c:tests/t164-local-output-limit.test.ts` 原样提取 HTTP handler，构造所属用例结束后的空 POST `/beta/chat/completions`。运行 `node --test --experimental-strip-types artifacts/t182/parent-empty-request.ts`，退出 1；`parent-red.log` 同时包含 `Unexpected end of JSON input` 和与现场一致的 “asynchronous activity after the test ended” / unhandledRejection。新版通过真实 HTTP 覆盖同一空 POST、坏 JSON、意外 GET、传输中断与关闭时半截正文，检查 400、所属用例/路径/字节诊断及关闭时显式拒绝；正常半截请求补完后才可关闭。

全量收尾新定位：旧现场 `local-output-requests.json` 实际共有 8 次完整请求，顺序为整站事实核对（65536，12 段）→ 截断局部写作 → 整站事实核对（65536，12 段）→ 四次局部写作 → 局部事实核对（4096，2 段）。两次整站核对由 `tests/helpers/t162-browser.ts` 的 `fixture()` → `commitSiteCode()` 初始存版触发，分别落在两段 commit.initial 计时内，不记进局部 run.modelCalls；此前只统计 run 内调用会漏掉它们。当前全量的 `artifacts/t162/self-contained-1792362277823-61353/local-output-transport-truncate.json` 第 2 条在 22:24:44.409Z 收到，确实晚于截断 after 的完成（约 22:24:43.312Z），但位于下一用例 commit.initial 的 22:24:43.556Z–44.472Z 内。其正文仍是 65536、12 段的初始整站核对。

仍未完成：当前 `providerFor()` 在 `fixture()` 之后调用，第二用例初始化沿用第一用例的 DEEPSEEK_BASE_URL，所以上述请求的 caseName 被标成前一用例；非局部请求目前一律标成 local-facts，也把这条整站核对错标。后续须在初始化前隔离替身与归属，并区分初始化核对和 run 内调用；现有 run 终态计数没有拦截这条额外完整请求。上述完整请求不能解释旧现场无法解析正文的那一条，原始坏请求的具体发送者与发生时间仍未知。因首轮全量失败，按负责人「失败就停」要求停止修改与重跑，把此缺口保留给后续处理。

验证（2026-10-19，本提交的测试候选，父版 `e002c6c`；后续仅补本票记录和撤销 Next 自动增补的 tsconfig 路径）：

- 定向：`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t182-fixture-late-request.test.ts tests/t164-local-output-limit.test.ts`，冻结候选 10/10，退出 0。日志 `artifacts/t182/focused-frozen.log`，报告 `focused-frozen-report.json`。早期定向的 `focused.log`、`focused-final.log` 同样 10/10，保留不覆盖。
- runner：`node --test --experimental-strip-types scripts/t167-runner-regressions.ts`，冻结候选 18/18，退出 0，`artifacts/t182/runner-frozen.log`；前次 `runner.log` 18/18，同样保留。
- 全量第一轮：`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test`，2026-10-18 22:18:16Z–22:34:18Z 自然结束，861 项、1 失败，退出 1，标准报告 **INCOMPLETE**。失败为 `tests/t162-mobile-reveal.test.ts:61` 的 375 跨页定位：等待 `!document.querySelector('[data-testid="annotation-draft"]')` 超时。`artifacts/t182/full1.log:1523` 起有完整错误；报告 `full1-report.json`；原运行目录 `artifacts/t167/test-run-1792361891670-18374/`（含 dev.log、checks、summary）；失败数据根 `/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-test-acwq2F` 保留。目标 T-164 两项及新增传输回归在全量中通过，没有 unhandledRejection；这不代表上述归属缺口已被拦截。
- 全量前确认其他测试进程已退出，memory_pressure 可用比例 51%，记录在 `artifacts/t182/full1-memory.log`。
- 按失败即停：第二轮全量、typecheck、build 均未运行；没有改预算、放宽断言或修其他票。独立 fast 审查未启动，由负责人安排。本票保持 open，两个验收项均未勾选，整体 **INCOMPLETE**。
