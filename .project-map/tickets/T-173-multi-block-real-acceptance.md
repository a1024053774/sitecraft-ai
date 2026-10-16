---
id: T-173
title: 多区块批注真实存版与盲评（T-164 遗留）
type: build
status: open
blocked_by: [T-164]
claimed_by: Codex
supersedes:
---

## Why

T-164 的多区块合同离线实现已合并（2026-10-16，构思主控按 C 处理），但真实 chat 入口三次运行都没存出修改版，真实存版、工作台出处显示和独立盲评两项未完成，转到本票。负责人批的 8 万额度已用 43,697（17,329 + 9,766 + 16,602），T-164 的授权到此结束；本票真实运行须重新报批额度。

## 已知阻断（最后一次真实运行，T-164 Resolution）

- 第一组（首页 [2] 营业时段 + [5] 收费口径）两段写作正常结束，合并事实核对以「资料出处重复：节假日营业安排待补充。」整体拒收，未进入修正轮（repairRound=0）。
- 原站两个被选区块本来都含逐字相同的「节假日营业安排待补充」，资料里也只有这一句；同一原句出现在两个不同核对段时被判重复。疑似 T-169「重复类别／出处即拒绝」在多区块合并核对时跨段生效，需先确认合同 D 对「同一原句支撑不同段」的本意，再决定是否开决定票。
- 同时确认出处类拒因是否应进入最多两轮修正，还是按协议错误直接拒收（现状为直接拒收）。
- 证据：`artifacts/t164/blind-20261016T113643Z/private/`（first-state.json、outcome.json、usage.json）；底稿临时根 `/tmp/sitecraft-t164-final.Y6komx`。

## 合同确认与额度（2026-10-16）

- 构思主控按合同 D 原意确认：同一用户原句可以同时支撑不同核对段的事实，跨段重复引用不是「出处重复」；同一段内同类别重复仍按 T-169 处理。不开决定票。
- 出处类拒因（缺原句、原句不逐字）属于底线检查失败，按硬约束进入最多两轮修正；仍不过如实拒收。协议格式错误照旧直接拒收。
- 负责人批准真实运行上限 5 万（`SITECRAFT_TOKEN_LIMIT=50000`），两组合计；只跑一次，截断、超额或拒收即停报构思主控。

## What to build

1. 先用最小坏例复现：两个区块各含同一资料原句的待补充说明，合并核对被拒；在当前主线上失败。
2. 按确认后的合同修复根因，不放宽缺原句拒收，不加免核对路径。
3. 报批额度后，在 `32e0ab93` 只读副本上重跑 T-164 的两组（批注原文不变），存出修改版。
4. 新的 sol 盲评实例对比原版和修改版：批注是否落实、范围外是否被改坏；盲评实例看不到实现和审查记录。修改版复制进主目录 `.sitecraft-data`。

## Acceptance

- [ ] 坏例测试先红后绿；独立 sol 复审通过；typecheck、test、build 通过
- [ ] 真实 chat 入口两组均存版，用量写进 Resolution；工作台三档出处显示「原始资料」或「你的第 N 条消息」
- [ ] 独立盲评实例对比原版和修改版的结论写进 Resolution

## Resolution

### 本轮离线修复（2026-10-16，Codex）

只执行负责人本轮授权的离线修复。真实运行、独立 sol 复审和盲评由主控另行安排，本票保持 open，真实验收项不勾选；不读取 `.env.local`、不调用 DeepSeek、不写主目录 `.sitecraft-data`、不推送。

根因：`checkSiteCode` 在汇总多个核对段时，以类别、声明、原句组成全局唯一键，将跨段同句误判为重复；多区块流程把无法归属区块的出处拒因作为整体失败立即终止。现按核对段保留段内重复检查，跨段同一出处合并各自的当前 DOM 定位；事实内容与出处底线拒因携带选中区块归属，进入现有两轮修正循环。协议错误保留整体拒收，空引文也须验真，不构成免核对或通过路径。

新增 `tests/t173-citation-repair.test.ts`：生产 chat POST 的 `annotationBatch`、受控 after 回调、本地 HTTP 模型替身与真实 Chrome 提交检查；由标准入口的普通服务读回最终版本。此证据不宣称真实 Next after 或真实模型通过。两区块共用用户原句「节假日营业安排待补充。」，另页和范围外说明保持；缺原句、非逐字原句、空引文补正后只存一个版本；两轮仍缺出处拒收，且与区块合同修正共用额度。段内重复类别／出处、缺 noFacts、二选一违规、旧回复格式直接拒收，repairRound=0。

父版本为 `0c1ef20221737fdc7f1feb11c99efdbc927f5cff`。同一标准命令 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t173-citation-repair.test.ts` 在 13:38:17Z 结束：六项修复场景按预期失败，五项保留合同的反例通过；红日志 `artifacts/t173/parent-0c1ef20-red-final.log`，请求、候选与终态在 `artifacts/t173/citation-repair-1792157875151-49859/`。首次红运行的替身按普通子串识别第一段，误把说明里相同词也选中；已改为按标题识别后重新在未修复的父版本留红。首次日志 `parent-0c1ef20-red.log` 和 `citation-repair-1792157826400-49140/` 原样保留，不作为精确归属证据。

离线检查（UTC；实现及测试冻结后运行）：

- 13:39:54Z：`CHROME_PATH=上述路径 npm test -- tests/t173-citation-repair.test.ts tests/t164-multi-block-edit.test.ts tests/t164-multi-block-chat.test.ts tests/t164-original-materials.test.ts tests/t164-review-seven.test.ts tests/t169-fact-citations.test.ts tests/t169-production-contract.test.ts tests/t169-contract-d.test.ts`，75/75 通过，0 取消／跳过；`artifacts/t173/focused-green.log`、`artifacts/t167/test-run-1792157929016-50592/report.json`。绿色请求与版本记录在 `artifacts/t173/citation-repair-1792157931207-50606/`。
- 13:40:33Z：`node --test --experimental-strip-types scripts/t167-runner-regressions.ts`，4/4 通过；`artifacts/t173/runner.log`。
- 13:40:41Z：`npm run typecheck` 通过；`artifacts/t173/typecheck.log`。
- 13:41:20Z：`SITE_STORE=fs npm run build` 通过，Next.js 16.3.1／Turbopack；`artifacts/t173/build.log`。工作树无 `.env.local`。

定向测试生成的三档原始资料出处图及空资料拒收图共四张，位于 `artifacts/t162/self-contained-1792157930994-50601/`，均逐张打开确认已载入；不作审美判断。Next 自动追加的构建目录类型 glob 已窄改还原，不并入功能提交。

对应实现及测试快照为本地提交 `30d252af8d05d15566693a07457bd61284aa0a63`；上述定向、入口回归、typecheck、build 的实现与该快照一致。全量在该提交上运行，收尾仅补齐本 Resolution 并合入同一个功能提交，不改实现或测试。

全量前执行 `memory_pressure`，空闲 40%；`ps -axo pid,ppid,command` 核对无其他 Chrome 无头测试、`node --test` 或 `next build`，记录为 `artifacts/t173/pre-full-memory.txt`、`pre-full-processes.txt`。随后只运行一次 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test`，13:48:31Z 结束：**651/652，失败 1，取消 0，跳过 0，INCOMPLETE**。日志 `artifacts/t173/full.log`；本轮身份、统计与服务日志在 `artifacts/t167/test-run-1792158159876-53839/`，临时数据根 `/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-test-RlNxXf` 原样保留。T-173 新增 11 项在全量中全部通过。

唯一失败：`tests/t164-overlap-confirmation.test.ts:15` 的 1440 档，等待表达式读取 `[data-testid="annotation-send-batch"]` 的 `disabled` 时节点为 null，报 `TypeError: Cannot read properties of null (reading 'disabled')`；表达式在该文件第 52 行，第一条未确认请求已返回 422，`overlap-1440-ordinary-1.json` 记录版本仍为 1、runs=0，尚未进入确认后的写作／事实核对。不能据此宣称整条重叠交互通过或已证明失败与本次改动无关。本轮未改该等待逻辑、未重跑全量、未跳过或放宽断言。失败截图 `artifacts/t162/self-contained-1792158331879-59040/overlap-confirmation-failure-1440-96f485c0-e62c-4296-833c-71e294203155.png` 已打开，相关请求、timings 与服务日志保留，交主控安排后续处理。

全量的 T-164 原始资料出处三档及空资料图、T-169 三档消息／上传／表格出处图均已逐张打开确认载入；本轮没有审美或真实模型通过结论。收尾标准入口已关闭测试服务，无遗留 Chrome 测试、`node --test` 或 `next build`；project-map 无结构问题或过时 living doc。**本轮交付 INCOMPLETE**：离线目标回归已通过，完整验证仍有上述一项失败，独立复审、真实两组存版和独立盲评待主控安排。
