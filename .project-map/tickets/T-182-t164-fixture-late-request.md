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

T-181 合并提交 `61e1107` 的第一轮主线全量（2026-10-18，`artifacts/t181/main-verify-run1/`，test.log 第 1059 行，运行目录 `test-run-1792349721121-16236`）中，`tests/t164-local-output-limit.test.ts` 两个子用例都通过，但文件尾报告替身服务第 17 行 `JSON.parse(raw)` 抛出 `SyntaxError: Unexpected end of JSON input`，以 unhandledRejection 令该文件失败。原始坏正文未保留，警告不能确定请求到达时间。同一源码在 T-181 分支 4 次全量与此前全部 t167 运行中均未出现。那轮运行期间构思主控在并行删除测试残留（不含本轮数据根和 `.next-test`），影响未证实。负责人 2026-10-18 决定：排在 T-180 之后，不挡 T-180。

## What to build

1. 替身收到不完整或无法解析的正文时明确失败并指明请求（路径、已收字节、所属用例），不得变成测试结束后的未捕获异常，也不能只用 catch 吞掉。
2. 隔离初始化与用例 run：先建好当前用例替身再调用 fixture()，分别登记初始化整站核对与 run 内调用，等待明确终态。原始坏正文只按证据归因；无法查明时明确记录「来源未知、未复现」，不把正常初始化请求当成它的来源。
3. 成对证据：能让旧替身复现同一 unhandledRejection 的构造，新版明确失败或等待终态；不放宽断言，不扩大上限。

## Acceptance

### 已证实部分

- [x] 坏正文在解析前登记用例、阶段、路径与已收字节，HTTP 和关闭断言明确失败；同类 unhandledRejection 有旧替身红、新替身绿的构造证据
- [x] 替身在 fixture() 前建立；初始化整站核对与 run 分开登记；只回退旧顺序即可证明 B 初始化会错误计入 A，恢复后同一回归通过
- [x] run 内事实核对闸门及 after 终态等待通过，原输出上限、预算与断言保留
- [x] 当前候选定向测试和 runner 回归通过

### 未知部分

- [ ] 原始现场坏正文的具体输入、发送者与发生时间：来源未知、未复现；不宣称全部查清

### 待主控安排

- [ ] 当前候选两轮全量、typecheck、build 与独立 fast 审查；收到通知前不运行重活

## Resolution

执行实例：Codex fast，工作树 `sitecraft-ai-t182`，基线 `e002c6c`。本票仅改测试替身与生命周期证据；输出上限、预算、产品代码和原有通过条件不变。独立 fast 审查由负责人另派，本实例不启动审查。

现场定位（2026-10-19）：`/Users/luckye/Documents/Code/sitecraft-ai/artifacts/t181/main-verify-run1/test.log:1057–1060` 先记录两个子用例通过，再记录文件结束后的 `Unexpected end of JSON input` / unhandledRejection。对应 `artifacts/t162/self-contained-1792349997729-25504/`：`local-output-truncated.json` 的站点 `881e53a6-3d40-444a-9b1b-50940d3cf3da` 仅有一次 local-edit，19:00:04.003Z 开始、耗时 3ms；`local-output-repair.json` 的站点 `9311458b-20ee-4f70-b40d-c9c9ec4af277` 有四次 local-edit（首轮两组、修正两组）及一次 local-facts，最后一次事实核对 19:00:13.197Z 开始、耗时 8ms。`timings.json` 中对应 after.task 分别于 19:00:04.013Z、19:00:13.279Z 左右完成，随后 state 读回 error / complete（最后一次 13.285Z）。运行目录 `test-run-1792349721121-16236/dev.log:403–407,413–421` 对应这两个站点的界面和预览；chat 由进程内生产路由桥执行，不会出现在 Next dev 的 POST 日志中。

已证实的缺陷机制是旧替身把 HTTP 回调中的读取、解析异常留成无人接收的 Promise 拒绝；两个用例共用监听器和可变 mode，解析前没有请求归属。已记录的调用均已完成，不能把坏请求认定为这些调用。原始现场坏正文：**来源未知、未复现**。旧替身在 JSON.parse 前没有 method/path/字节记录，也没有保留该条原始输入；不能把同类人工构造当成原始现场已复现，不把清理或初始化请求当成它的来源。

警告时间不等于请求时间：`node --test --experimental-strip-types artifacts/t182/parent-during-request.ts` 在所属用例仍运行时发送相同空 POST，也在子用例通过后于文件尾报告同一句 “asynchronous activity after the test ended” / unhandledRejection（退出 1，`parent-during-red.log`）。因此现场警告本身不能证明请求在用例结束后才到达，更不能据此认定生产 after 漏等；新增请求起止时间用于消除这项不可定位性。

当前实现：每个用例先建立独立监听器并设置 DEEPSEEK_BASE_URL，再执行 fixture()；每个监听器保存到独立目录，避免多个同模式用例覆盖请求证据。请求在读取正文前登记用例、initialization / run 阶段、序号、方法和路径，累计实际 Buffer 字节并记录起止时间、complete、用途与终态。初始化整站核对记为 whole-facts，与 run 内 local-edit / local-facts 分组保存；fixture() 全部完成且初始化请求已成功结束后才 beginRun()，run 的请求计数独立核对。事实闸门只挂起 run 内局部核对，不阻塞初始化。

坏正文返回 HTTP 400；失败集合在关闭落盘后抛 AggregateError，不能仅 catch 吞掉。监听器保留到桥的全部 after 回调收束后再关闭，并等待已接收请求及处理 Promise；run 内事实闸门证明核对未结束时不能先 settle。现在每次请求都登记归属，坏正文会明确失败，以后再出现可直接按用例、阶段、请求序号、路径、字节及时间定位；这不补造旧现场的发送者。

成对证据（本工作树 `artifacts/t182/`）：从父版 `e002c6c:tests/t164-local-output-limit.test.ts` 原样提取 HTTP handler，构造所属用例结束后的空 POST `/beta/chat/completions`。运行 `node --test --experimental-strip-types artifacts/t182/parent-empty-request.ts`，退出 1；`parent-red.log` 同时包含 `Unexpected end of JSON input` 和与现场一致的 “asynchronous activity after the test ended” / unhandledRejection。新版通过真实 HTTP 覆盖同一空 POST、坏 JSON、意外 GET、传输中断与关闭时半截正文，检查 400、所属用例/路径/字节诊断及关闭时显式拒绝；正常半截请求补完后才可关闭。

初始化串用已单独定位：旧现场 `local-output-requests.json` 有 8 次完整请求，其中两次整站核对（65536，12 段）来自 `fixture()` → `commitSiteCode()` 初始存版，不记进局部 run.modelCalls。旧候选 `e7cdaa5` 的 `artifacts/t162/self-contained-1792362277823-61353/local-output-transport-truncate.json` 第 2 条在 22:24:44.409Z 收到，晚于截断 after 完成（约 43.312Z），位于下一用例 commit.initial 的 43.556Z–44.472Z 内。旧顺序先 fixture() 再 providerFor()，使这条**完整、正常的初始化核对**被记到前一用例，并误标 local-facts；它不是已知的原始坏正文来源。

初始化成对证据：回归通过同一个 caseFor() 连续创建 A、B，要求初始化 B 不改变 A 的记录，B 的整站核对只记入自己的 initialization，run 为空。旧顺序先跑红，`initialization-parent-red.log` 为「B 初始化不得进入 A 的监听器，1 ≠ 0」，退出 1。修复后再运行 `python3 artifacts/t182/revert-initialization-order.py`，仅临时交换 caseFor() 的两行顺序，保留新登记逻辑；同一回归再次退出 1（`initialization-order-reverted-red.log`），finally 原样恢复源文件。对应标准入口为 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- '--test-name-pattern=T-182 初始化归属' tests/t164-local-output-limit.test.ts`。恢复后同一回归随完整定向集转绿。

当前代码验证（2026-10-19，本提交；续做前版为 `e7cdaa5`）：

- 定向：`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t182-fixture-late-request.test.ts tests/t164-local-output-limit.test.ts`，UTC 22:40:13Z–22:40:31Z，11/11，退出 0。日志 `artifacts/t182/initialization-focused-green.log`，报告 `initialization-focused-report.json`。
- 定向请求证据：`artifacts/t162/self-contained-1792363218137-65526/` 的 provider-1、provider-2 分别记录「初始化 whole-facts + run 局部写作」及「初始化 whole-facts + run 四次局部写作和一次 local-facts」；provider-3、provider-4 各只有自己的初始化 whole-facts，均为 responded。`initialization-ownership.json` 记录 B 初始化前后 A 都是 1 次请求。默认替身没有请求记录，没有借用前一用例。
- runner：`node --test --experimental-strip-types scripts/t167-runner-regressions.ts`，18/18，退出 0，日志 `artifacts/t182/initialization-runner.log`。
- 本轮按负责人选 A：只跑定向及 runner，未跑全量、typecheck、build、评估或独立审查。全量与 build 等主控通知；机器一次只跑一个重活。验收尚未完成，本票保持 open，整体 **INCOMPLETE**。

旧候选全量失败现场（不是当前隔离候选的验收）：`e7cdaa5` 第一轮于 2026-10-18 22:18:16Z–22:34:18Z 自然结束，861 项、1 失败，退出 1。失败为 `tests/t162-mobile-reveal.test.ts:61` 的 375 跨页定位，等待 `!document.querySelector('[data-testid="annotation-draft"]')` 超时；日志 `artifacts/t182/full1.log:1523`、报告 `full1-report.json`、原目录 `artifacts/t167/test-run-1792361891670-18374/` 与数据根 `/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-test-acwq2F` 均保留。负责人确认当时 T-183 真实评估在并行跑。`artifacts/t162/self-contained-1792362135862-49220/timings.json` 的 ui.state 由 22:22:23.616Z 开始，等待 20016.873ms，结束时一分钟 load 为 17.50098；同目录 `wait-failure-375-02aaaadd-26ab-465a-9b57-4471ed62fbd7-1792362163629.json` 保留目标表达式及 22:22:43.627Z 的现场。启动前 memory_pressure 可用比例 51%（`full1-memory.log`），不把启动采样当成失败时的内存。并行评估与负载是现场条件，尚不能证明超时原因；之后空闲机器若再超时，保留现场并立即报告负责人，不改等待上限。
