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


### 独立复审修复（2026-10-16，Codex）

主控确认 `f4008d8` 的全量 652/652、失败／取消／跳过均为 0，13:55:46Z 完成；日志 `artifacts/t173-supervisor-full-f4008d8.log`，报告 `artifacts/t167/test-run-1792158655483-64327/report.json`。该复测不覆盖或删除首轮 651/652 的证据。独立 sol 复审仍为 **NO_GO**：空引文掩盖非法 claim、协议错误仅在批次终止、整站仅代码发现缺出处时无法定位修正。测试通过不替代协议合同核对。主控同时确认重叠确认等待表达式存在节点竞态，与本次事实修改无关。

本轮在共用 `auditCodeFacts` 边界先完成全部段的 claim 归属、类别、段内重复与 noFacts 二选一检查，协议错误直接抛终止错误；混合错误不受引文验真短路影响，整站、单区块和批次共用该行为，不在工作流分别补判断。协议通过后再验真原句，代码生成的缺出处拒因包含核对段原文，供现有整站 DOM 片段修正定位，单区块沿用区块归属和两轮额度。没有新增兼容层、免核对或整站重写路径。`t164-overlap-confirmation` 只补两个按钮均存在的等待条件，断言不变。

新增 `tests/t173-fact-boundary.test.ts` 使用生产 chat POST 的整站 select／confirm、单区块 selectedTarget 和多区块 annotationBatch 入口，替身仅替代模型与 after 调度，普通标准服务读回存储。首次审核故意给出非法 claim + 空引文或有效原句、重复类别，并在后续调用返回合法回复，断言立即终止、不再写作／修正且不存版；缺出处场景固定 `issues=[]`，检查整站及单区块实际修正、一次补正存版与两轮仍缺出处拒收，整站修正请求必须包含可定位原句的 DOM 片段。

先在未修改实现的 `f4008d8ee956b4c04530ebc1beeac25527abc4f7` 运行 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t173-fact-boundary.test.ts`：10 项中 7 项按复审反例失败，3 项保留行为的正向对照通过；红日志 `artifacts/t173/review-f4008d8-red.log`，标准报告 `artifacts/t167/test-run-1792159248117-77468/report.json`，请求及终态 `artifacts/t173/fact-boundary-1792159250212-77475/`。其中批次／单区块混合错误和单区块重复类别被后续合法回复存版，整站协议与缺出处场景错误进入修正后无法定位，均与合同预期相反。

首次扩展定向 137/139，`artifacts/t173/review-focused.log`、`artifacts/t167/test-run-1792159329892-78431/report.json` 原样保留。两项旧夹具问题已按用例本意修复：无企业事实用例显式清空上一用例遗留的 citation；重复类别只注入实际客户声明段，避免在无事实段先触发二选一错误。原协议返回 issues 的断言同步为共用边界抛终止错误；无效资料仍拒收，未削弱断言。新增 T-173 十项在该轮全部通过。

本轮最终定向命令：`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t173-fact-boundary.test.ts tests/t173-citation-repair.test.ts tests/t164-multi-block-edit.test.ts tests/t164-multi-block-chat.test.ts tests/t164-original-materials.test.ts tests/t164-review-seven.test.ts tests/t164-overlap-confirmation.test.ts tests/t169-fact-citations.test.ts tests/t169-production-contract.test.ts tests/t169-contract-d.test.ts tests/t169-citations-browser.test.ts tests/t154-fact-segments.test.ts tests/t151-paragraph-repair.test.ts tests/t151-translation-protocol.test.ts tests/t151-short-translation.test.ts`。14:07:25Z 结束，139/139，0 失败／取消／跳过；`artifacts/t173/review-focused-final.log`、`artifacts/t167/test-run-1792159490352-82908/report.json`。新边界测试 10/10、新旧 T-173 合计 21/21。三档重叠确认及待确认图、三档原始资料与空资料图、T-169 三档消息／上传／表格出处图共 19 张均逐张打开确认载入，目录 `artifacts/t162/self-contained-1792159492422-82927/`、`self-contained-1792159492678-82926/`、`artifacts/t169/browser-1792159495636/`；不作审美判断。

随后串行验证（UTC）：14:07:49Z `node --test --experimental-strip-types scripts/t167-runner-regressions.ts` 4/4（`review-runner.log`）；14:07:53Z `npm run typecheck` 通过（`review-typecheck.log`）；14:08:22Z `SITE_STORE=fs npm run build` 通过（`review-build.log`），日志均在 `artifacts/t173/`。未加载 `.env.local`，未调用 DeepSeek。开工已有的 `tsconfig.json` 构建目录 glob 脏改保留、不纳入提交；本轮 build 另加的一条 glob 仅还原该新增行。

全量前 `memory_pressure` 空闲 43%，`ps -axo pid,ppid,command` 未发现其他 Chrome 无头测试、`node --test` 或 `next build`，原始记录 `artifacts/t173/review-pre-full-memory.txt`、`review-pre-full-processes.txt`。实现及测试冻结提交 `a1171fe81602baa529fda7cc5afaf15873ca0e18`，上述最终定向／runner／typecheck／build 与该快照一致；收尾只补本 Resolution，不改实现或测试。随后在该提交上仅串行运行一次 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test`，14:15:57Z 结束：**662/662，失败／取消／跳过均为 0，PASS**。日志 `artifacts/t173/review-full.log`，身份／统计／服务日志 `artifacts/t167/test-run-1792159741382-87756/`，临时数据根 `/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-test-F3HSud` 保留。新增十项与修复后的重叠确认三档用例均在本轮全量通过；未重跑全量、未跳过或扩大上限。

本轮离线修复及规定验证 **PASS**，三项 P1 的反例已在父版本留红并转绿，原失败日志未覆盖；真实模型能力、独立 sol 复审与盲评没有本轮通过结论，仍由主控安排，本票保持 open。未调用 DeepSeek、未读取 `.env.local`、未推送；已有 `tsconfig.json` 脏改仍保留。


### 短声明出处定位修复（2026-10-16，Codex）

主控转达新的独立 sol 复审：`9bdbd48` 的混合错误与统一协议终止已堵住，仍 **NO_GO**，仅余短声明的整站修正定位 P1；合同不变。根因是出处拒因只保留原文，普通片段选择仍要求至少四个字符，`松禾／运费／免运费。` 没有可选片段，未发修正请求就终止。

现由事实核对代码把对应出处拒因与同段已有 DOM 定位、文字快照记录为 `citationRepair`，模型不能提供或选择定位；只保留属于核对段可读内容的目标。整站工作流把这份定位交给原片段修正入口，先核验当前候选路径与快照，再选择相应文本节点，不设字数门槛；这些出处拒因不再参与全文文本匹配，其他底线拒因照旧定位。片段仍经过原写回及范围核验，不新增免核对、重写整页或调用方重试。已同步资料出处规则、术语、mainline 与 spec。

在未改实现的 `9bdbd485132a00a98d8705ce0f4812015089def2` 先运行 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t173-fact-boundary.test.ts`，14:31:06Z 结束，16 项中短声明整站的补正存版／两轮拒收两项按预期失败，14 项对照通过；红日志 `artifacts/t173/short-9bdbd48-red.log`，报告 `artifacts/t167/test-run-1792161035398-3206/report.json`，原始候选、请求和终态 `artifacts/t173/fact-boundary-1792161037622-3249/` 保留。新增短声明单区块两项及批次协议／出处分属两组且交换顺序两项在父版本已通过，作为保留行为的对照。修复后短声明整站确实发出修正请求，发送片段只含该段的「运费」「免运费。」，不包含其他短文字「自取。」；补正后只存一版，两轮仍缺出处如实拒收，两种组顺序均在 repairRound=0 按协议终止。

初步定向 33/33（`artifacts/t173/short-focused-initial.log`、`artifacts/t167/test-run-1792161216600-4923/report.json`）。最终定向命令（原样）：`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t173-fact-boundary.test.ts tests/t173-citation-repair.test.ts tests/t164-multi-block-edit.test.ts tests/t164-multi-block-chat.test.ts tests/t164-original-materials.test.ts tests/t164-review-seven.test.ts tests/t164-overlap-confirmation.test.ts tests/t164-local-output-limit.test.ts tests/t164-dynamic-gate.test.ts tests/t164-review-seven.test.ts tests/t169-fact-citations.test.ts tests/t169-production-contract.test.ts tests/t169-contract-d.test.ts tests/t169-citations-browser.test.ts tests/t154-fact-segments.test.ts tests/t151-paragraph-repair.test.ts tests/t151-translation-protocol.test.ts tests/t151-short-translation.test.ts tests/t138-repair-fragments.test.ts tests/t138-token-repair.test.ts`；14:38:55Z 结束，169/169，0 失败／取消／跳过，日志 `artifacts/t173/short-focused-final.log`、报告 `artifacts/t167/test-run-1792161396623-7492/report.json`；本次边界测试记录 `artifacts/t173/fact-boundary-1792161444559-9357/`。T-164 原始资料与重叠确认、T-169 消息／上传／表格出处的三档相关图共 19 张均逐张打开确认载入，目录 `artifacts/t162/self-contained-1792161402644-7674/`、`self-contained-1792161405201-7814/`、`artifacts/t169/browser-1792161408867/`；不作审美结论。

随后串行执行：14:39:44Z `node --test --experimental-strip-types scripts/t167-runner-regressions.ts` 4/4（`short-runner.log`）；14:40:46Z `npm run typecheck` 通过（`short-typecheck.log`）；14:41:52Z `SITE_STORE=fs npm run build` 通过（`short-build.log`）。日志均在 `artifacts/t173/`。全量前 `memory_pressure` 空闲 47%，`ps -axo pid,ppid,command` 未发现其他 Chrome 无头测试、`node --test` 或 `next build`，记录 `short-pre-full-memory.txt`、`short-pre-full-processes.txt`。`tsconfig.json` 的 Next 自动 include 不手改、不提交。

实现及测试冻结提交 `09b4d44c5aba379c39ff1226e590d52ead6469e3`，上述最终定向／runner／typecheck／build 的实现与测试均与该快照一致，收尾仅补本 Resolution。随后在该提交上串行运行本轮唯一一次 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test`，14:50:20Z 结束：**668/668，失败／取消／跳过均为 0，PASS**。日志 `artifacts/t173/short-full.log`，身份／统计／服务日志 `artifacts/t167/test-run-1792161837211-15405/`，临时数据根 `/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-test-rUAKKI` 保留。短声明四项及两种组顺序均在本轮全量通过，未重跑全量、未跳过或扩大上限。

本轮离线修复及规定验证 **PASS**，原父版本红日志保留；project-map 无结构问题或过时 living doc，中文 UTF-8 回读正常。独立复审、真实模型与盲评没有本轮通过结论，由主控安排，本票保持 open；未调用 DeepSeek、未读 `.env.local`、未推送。`tsconfig.json` 的 Next 自动 include 保持不动、未提交，收尾无遗留 Chrome 测试、`node --test` 或 `next build`。


### 核对段位置成员与完整归属修复（2026-10-16，Codex）

主控转达第三个独立 sol 对 `a98bfa1` 的复审：先前协议与普通正文短声明问题已堵住，仍 **NO_GO**。五个 P1 均来自把可读核对段反查成修正范围：标题无 DOM target、同文表格跨数据行、非叶节点属性不能定点改、根级 CSS 无目标、同文局部段合并后仅保留第一组拒因归属。本轮按同一个位置成员模型修复，不增加调用方特判、兼容层、免核对或整页重写。

读取核对段时同步生成 `members`：作者字段与文本节点路径、属性名＋节点路径、页面标题字段、生成文案所在样式节点／字段及 CSS 规则路径、选择器／伪元素／声明值快照。简单表格成员按数据行收集；父级说明作为只读上下文，不扩大子段可写范围。出处拒因直接携带成员，原片段修正入口逐项校验快照，只发文本／标题／属性值／单个 CSS 声明值；写回核验其余 DOM、属性、CSS 规则与声明。无法可靠定位的成员带原因拒收。同文核对段合并时合并全部成员及区块 owners，向每个所属区块反馈拒因，继续共用原两轮额度。资料原句验真、段内重复和协议错误终止规则不变。

新增 `tests/t173-fact-members.test.ts` 的期望来自本轮合同。前五项经生产 create/chat POST、本地 HTTP 模型替身和普通服务读回存版，修正轮实际把「免运费。」改成「运费待补充。」；分别核对标题独立字段、甲行可改而乙行同文保留、非叶属性可改而子树保留、根级 CSS content 可改而其他声明与正文保留、同文两组都收到拒因并在一轮同时改好且范围外保留。另两项验证多条 CSS 作者声明、无法核实的作用域／选择器均写明原因拒收，不发猜测性修正、不存版。不是 after=before 的存版证明，也不把本地替身当作真实模型效果证据。

先红证据：只临时切回本轮拥有的四个源文件到 `a98bfa14785d0dfacb986cad06c6e9762d94ff55`，测试不变，经标准入口运行后在 finally 恢复实现；临时备份仅供安全恢复，不作源码复制证据。最终修正夹具后的七项父版本红测命令为 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t173-fact-members.test.ts`，15:53:50Z 结束：**0/7，七项均失败**。日志 `artifacts/t173/members-a98bfa1-red-container.log`，报告 `artifacts/t167/test-run-1792166016148-64531/report.json`；此前五项与六项父版本红日志 `members-a98bfa1-red-final.log`、`members-a98bfa1-red-boundary.log` 均保留，表格反例确实曾写错乙行。

中间失败原样保留：`members-initial.log` 为 23/26，标题替身误把正文中的页面标签当成标题声明，收窄到标题字段标记后重新做父版本红测；另两项原短声明断言发现父级上下文被选入可写片段。`members-focused.log` 为 67/69，同一范围问题仍在，现以只读 context 成员修复，未改原断言。`members-typecheck-initial.log` 的联合类型收窄错误已修复。扩展定向曾 182/182 通过（`members-focused-final.log`）。补充 CSS 选择器／未知分组的代码检查后，额外 `@scope` 夹具得到 6/7（`members-css-boundary-red.log`），扩展定向同项为 183/184（`members-focused-complete.log`）；实际请求表明 `@scope` 被既有「CSS 使用未支持的资源规则」提前拦下，未进入出处核对，这项失败不能作出处定位证据。改用清理允许的 `@container` 后，生产入口确实在出处定位处写明未知作用域并拒收，七项通过（`members-seven-container.log`），最终夹具也已在父版本全部失败；旧 `@scope` 夹具的父版本红日志 `members-a98bfa1-red-seven.log` 保留但不作为有效边界证明。成员生成按选择器分支匹配，不忽略未知作用域后猜另一条声明。上述失败不以重跑覆盖，最终验证另存日志。


最终规定定向命令：

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t173-fact-members.test.ts tests/t173-fact-boundary.test.ts tests/t173-citation-repair.test.ts tests/t164-multi-block-edit.test.ts tests/t164-multi-block-chat.test.ts tests/t164-original-materials.test.ts tests/t164-review-seven.test.ts tests/t164-overlap-confirmation.test.ts tests/t164-local-output-limit.test.ts tests/t164-dynamic-gate.test.ts tests/t169-fact-citations.test.ts tests/t169-production-contract.test.ts tests/t169-contract-d.test.ts tests/t169-citations-browser.test.ts tests/t154-fact-segments.test.ts tests/t151-paragraph-repair.test.ts tests/t151-translation-protocol.test.ts tests/t151-short-translation.test.ts tests/t138-repair-fragments.test.ts tests/t138-token-repair.test.ts tests/t160-narrow-columns.test.ts
```

2026-10-16T15:58:26.322Z 结束：**183/184，INCOMPLETE**，七项新回归均通过。唯一失败为 `tests/t164-review-seven.test.ts:110` 的祖先 main focus-within 背景检查，在 `outsideCssApplications` 第 408 行命中既有 5 秒动态探针超时并抛错，尚未完成该用例的范围外断言；不是出处断言失败，不据此断言与改动无关。保留 `artifacts/t173/members-focused-verified.log`、`artifacts/t167/test-run-1792166062330-65015/report.json` 和临时数据根 `/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-test-g9PnlH`。未改该测试、未放宽上限，也未单独重跑或用其他结果覆盖这次失败。

随后串行运行：`node --test --experimental-strip-types scripts/t167-runner-regressions.ts`，15:59:27Z，4/4；`npm run typecheck`，15:59:30Z，通过；`SITE_STORE=fs npm run build`，15:59:45Z，通过。日志分别为 `artifacts/t173/members-runner-verified.log`、`members-typecheck-verified.log`、`members-build-verified.log`。全量前 `memory_pressure` 空闲 48%，`ps -axo pid,ppid,command` 未发现 Chrome 无头测试、node --test 或 next build；原始记录 `members-pre-full-memory.txt`、`members-pre-full-processes.txt`。


实现及测试冻结提交 `ebc534f65144a9395469b7278a23e64046f1c5fc`；最终定向、runner、typecheck、build 与此快照实现一致。随后在该提交上只串行运行一次 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test`，2026-10-16T16:10:05.624Z 结束：**673/675，失败 2、取消／跳过均 0，INCOMPLETE**。日志 `artifacts/t173/members-full.log`，报告／身份／服务日志 `artifacts/t167/test-run-1792166493844-71239/`，临时数据根 `/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-test-64X2Vp` 保留。七条新回归在本轮全量均通过；没有重跑全量、改单项断言、延长超时或切换入口。

全量失败与可核查状态：

- `tests/t163-area-drafts.test.ts:233`：等待三条草稿且第二条显示「未保存版本」失败。已逐张打开的 `artifacts/t163/browser-1792166622201/failure-send.png` 显示第二条为 `TypeError: Invalid URL`；保留数据根的 `code-sites/ec0c3a7a-ef2b-46c8-9689-a108b03f5c39.json` 中，该任务两轮范围修正后记录相同错误，只有两个版本。
- `tests/t164-review-seven.test.ts:156`：期望 complete，实际 error。`code-sites/t164-seven-622dc1b2-4023-46ec-9d07-4c4063f349f0.json` 中 run.step 同为 `TypeError: Invalid URL`、repairRound=0、issues=[]、attempts=[]，已完成两次 local-edit，尚无事实模型调用。这两次异常的完整抛错栈未保留，不能据此确认根因，也不能断言与本改动无关；未绕过它们或单独重跑。

本次引用的定向截图已逐张打开：`artifacts/t162/self-contained-1792166083906-65483/` 的原始资料四张、`self-contained-1792166084084-65497/` 的重叠确认六张、`artifacts/t169/browser-1792166098152/` 的消息／上传／表格三档九张；加上上述全量失败截图，共二十张。只确认本轮可见行为和异常，不作审美通过结论。

本轮交付状态 **INCOMPLETE**：五项同类问题已按位置成员统一修改，父版本失败与新回归通过证据齐全，但规定定向留有一次动态探针超时、规定全量留有上述两次 Invalid URL；均保留原结果，未用重跑覆盖。独立 sol 复审、真实 DeepSeek 运行与盲评仍由主控另行安排，票保持 open，验收项不勾选。收尾只补本 Resolution 并合入同一个本地功能提交，不改实现或测试；未推送，未读 `.env.local`，未调用 DeepSeek，未写主目录 `.sitecraft-data`，未提交 `tsconfig.json`。 project-map 结构问题与过时 living doc 均为 0，中文 UTF-8 回读正常；收尾无遗留 Chrome 测试、node --test 或 next build，记录 `artifacts/t173/members-post-processes.txt`。


### 模型拒因与 CSS 渲染影响范围修复（2026-10-16，Codex）

主控转达第四个独立 sol 对 `68d0b22` 的复审为 **NO_GO**，剩两个 P1：模型返回的事实／出处 issues 未携带成员归属，仍全文匹配并误选同文乙行；单项 CSS 声明虽定点改源码，却能连带改变其他已通过段。合同不变，本轮先补生产 chat 红测，再修共用成员边界；共享声明的实际影响超出被拒段允许成员并集时明确拒收，不拆分规则。

主控已核实在 `68d0b22b9137c2a9c48988c552342e6ab42b6a73` 上于 12:14–12:23 EDT（16:14–16:23Z）执行一次全量，**675/675，失败／取消／跳过均 0，PASS**；日志 `artifacts/t173-supervisor-full-68d0b22.log`，报告 `artifacts/t167/test-run-1792167274169-84145/report.json`，报告结束时间 16:23:14.565Z。此前本执行轮的 Invalid URL 与动态探针超时本次未复现，根因仍未知，原失败证据保留；不能把复跑通过写成已修复这些异常。


本轮由模型核对边界把该段全部模型 issues 与代码出处拒因统一记录为 `factRepair`（内部旧字段已替换，不留兼容分支），携带同一份成员；这些拒因全部退出普通全文检索。修正入口按字段、类型、节点／规则路径、属性名与字符区间去重，不依赖 JSON 对象键顺序。CSS 成员另记录页面、视口、DOM 位置与伪元素；整站片段修正前复用提交检查的已渲染候选，在每页三档逐项临时改变指定声明再恢复，读取实际计算值变化的位置以核实层叠、继承和媒体条件。所有影响都须属于被拒段允许 CSS 成员并集，超出或无法稳定核实即明确拒收，不拆分规则、不发修正请求。无法定位的成员仍保留原始明确拒因，不继续探测无法使用的其他片段。原局部写作仍由既有区块／共享 CSS 范围检查约束，原两轮额度未变。

先红证据：实现未改时，在 `68d0b22b9137c2a9c48988c552342e6ab42b6a73` 运行 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t173-repair-scope.test.ts`，16:32:43Z 结束：**2/8，六个坏例失败、两个合法修正对照通过**。日志 `artifacts/t173/scope-68d0b22-red-fixture.log`，报告 `artifacts/t167/test-run-1792168353365-1471/report.json`。混合拒因出现甲行重复片段重叠；只有模型拒因时实存了甲乙都被改的版本；共享声明的本页及另一页三种视口反例均被父版本误存。最初正例把 `.first` 挂在 main，开工自查改为甲段后、仍未改实现时重新做上述红测；原 `scope-68d0b22-red.log` 与产物保留。

新回归的期望来自合同，替身对返回的实际修正片段回填改写，并经普通服务读回存版：模型 issues 非空的两个表格用例只改甲行、乙行同文保留且片段不重复；CSS 只影响一段或被拒两段并集时实改声明后只存一版；共享声明影响已通过乙段时拒收，包括另一页分别仅在 375／768／1440 生效的三个反例。八项在最终定向均通过。初次扩展 `scope-first.log` 为 46/47，新八项通过，但旧未知作用域反例被新 CSS 影响拒因先截住；现按成员是否可定位确定检查顺序，保留更直接的原拒因，原断言未改。


最终规定定向命令（所有 npm test 只设置下列 CHROME_PATH）：

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t173-repair-scope.test.ts tests/t173-fact-members.test.ts tests/t173-fact-boundary.test.ts tests/t173-citation-repair.test.ts tests/t164-multi-block-edit.test.ts tests/t164-multi-block-chat.test.ts tests/t164-original-materials.test.ts tests/t164-review-seven.test.ts tests/t164-overlap-confirmation.test.ts tests/t164-local-output-limit.test.ts tests/t164-dynamic-gate.test.ts tests/t169-fact-citations.test.ts tests/t169-production-contract.test.ts tests/t169-contract-d.test.ts tests/t169-citations-browser.test.ts tests/t154-fact-segments.test.ts tests/t151-paragraph-repair.test.ts tests/t151-translation-protocol.test.ts tests/t151-short-translation.test.ts tests/t138-repair-fragments.test.ts tests/t138-token-repair.test.ts tests/t160-narrow-columns.test.ts tests/t160-materials.test.ts
```

2026-10-16T16:44:21.270Z 结束，**192/193，INCOMPLETE**；本轮新八项及其余 T-173 全部通过。唯一失败为 `tests/t164-dynamic-gate.test.ts:179` 的 `:scope:has(a:nth-of-type(2):focus) .outside` 范围检查，在 `outsideCssApplications` 的既有五秒动态探针中超时、未完成原定断言。日志 `artifacts/t173/scope-focused.log`、报告 `artifacts/t167/test-run-1792168755760-11933/report.json`、临时根 `/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-test-0YPJnO` 原样保留；根因未确认，不断言与改动无关，未单独重跑或放宽上限。

随后串行检查：`node --test --experimental-strip-types scripts/t167-runner-regressions.ts`，16:45:15Z，4/4；`npm run typecheck`，16:45:18Z，通过；`SITE_STORE=fs npm run build`，16:45:40Z，通过。日志 `artifacts/t173/scope-runner.log`、`scope-typecheck-final.log`、`scope-build.log`；未载入 `.env.local`。

全量前 `memory_pressure` 空闲 46%，`ps -axo pid,ppid,command` 未发现其他 Chrome 无头测试、node --test 或 next build；记录 `artifacts/t173/scope-pre-full-memory.txt`、`scope-pre-full-processes.txt`。

在冻结提交 `eee67b81e0598264d531dc2d331f25579f6e56db` 上执行本轮唯一一次 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test`，16:55:31.436Z 结束：**679/683，失败 4、取消／跳过 0，INCOMPLETE**。日志 `artifacts/t173/scope-full.log`、报告 `artifacts/t167/test-run-1792169212349-21281/report.json`、临时根 `/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-test-wbUpzG` 保留。新增八项均通过；四条失败均在 `tests/t138-dom-scope.test.ts` 的 interleaved／adjacent 正反顺序用例。原始失败状态 `artifacts/t138/dom-scope-48e5d04c-df8d-4b4e-8b28-1cce87d370c9/` 显示一次修正返回空 replacements。统一成员定位后只记录整文本节点，丢失原句字符区间，合法修正无法回填。

现于成员生成时按句记录节点原文快照、起点与句子文本，沿已记录区间写回，不根据模型拒因反查文本。中间定向 `scope-final-focused.log` 为 205/210：区间修复后四个任务已能 complete，但旧替身借 `factAuditReply` 只把拒因发给第一个同文段，却要求修改未被拒的页脚，与本轮合同冲突；另有一次 `::first-line` 动态探针超时，根因未确认（报告 `artifacts/t167/test-run-1792169810859-32279/report.json`）。原断言未改；只把本测试替身改为逐段真实协议，对每个含「终身保修」的段返回拒因及时间承诺类别，不把页脚标为已通过。

同一更新后的 T-138 夹具均走 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t138-dom-scope.test.ts`。临时恢复本轮五个源文件到 `68d0b22`，17:03:29Z 得到 **17/17**（`scope-t138-parent-control.log`，报告 `artifacts/t167/test-run-1792170189109-38258/report.json`）；恢复到中间候选 `eee67b8`，17:03:47Z 得到 **13/17，四个区间坏例失败**（`scope-t138-interval-red.log`，报告 `artifacts/t167/test-run-1792170209452-38790/report.json`）。finally 已恢复当前实现；临时备份仅供安全恢复，不作源码复制证据。当前实现运行同一 CHROME_PATH 的 `npm test -- tests/t138-dom-scope.test.ts tests/t173-repair-scope.test.ts`，17:05:11Z 得到 **25/25**（`scope-interval-green.log`，报告 `artifacts/t167/test-run-1792170273753-40435/report.json`）。正文、页脚、版本数、修正次数和未选字符保留断言均保留；未放宽测试换取通过。

全量之后的区间修复与夹具修正另做最终定向、runner、typecheck 和 build；遵守本轮「串行一次全量」限制，不再发起第二次全量。最终快照不能沿用修复前全量作为通过证据。

最终定向在前述定向清单上增加 `tests/t138-dom-scope.test.ts`（完整命令保存在下列报告的 command 字段，仍只设置同一 CHROME_PATH），17:10:51.026Z 结束：**210/210，失败／取消／跳过 0，PASS**。日志 `artifacts/t173/scope-verified-focused.log`、报告 `artifacts/t167/test-run-1792170374883-42594/report.json`、临时数据根 `/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-test-rpuQqs` 保留。本轮八项、T-138 的十七项及全部指定相关对照均通过。随后串行运行 `node --test --experimental-strip-types scripts/t167-runner-regressions.ts`（17:12:44Z，4/4）、`npm run typecheck`（17:12:50Z，通过）、`SITE_STORE=fs npm run build`（17:13:10Z，通过）；日志 `scope-final-runner.log`、`scope-final-typecheck.log`、`scope-final-build.log`。

本次最终引用的十九张定向截图已逐张打开：`artifacts/t162/self-contained-1792170393484-43108/` 原始资料四张、`self-contained-1792170392845-43109/` 重叠确认六张、`artifacts/t169/browser-1792170444787/` 消息／上传／表格三档九张。仅确认出处及批注状态，不作审美通过结论。

本轮交付 **INCOMPLETE**：两项越界修复及字符区间回归修复均有相应红绿证据，最终定向、runner、typecheck、build 通过；唯一一次全量是区间修复前的 679/683，最终快照未再次全量验证。原全量失败、定向中的动态探针超时及主控对旧快照的 675/675 均如实保留，未覆盖或跳过。独立 sol 复审、最终快照全量与真实模型运行待主控安排；票保持 open，不勾选真实验收项。未调用 DeepSeek、未读取 `.env.local`、未推送、未写主目录 `.sitecraft-data`，`tsconfig.json` 保持自动脏改、不提交。

最终实现与测试冻结提交 `a41eb289076b3f229d902284a8a2ce2de230c486`，最终 210 项定向及最后的 runner／typecheck／build 与此快照一致；收尾仅补本 Resolution 后合入同一个功能提交，不再改代码或测试。project-map 结构问题与过时 living doc 均为 0，中文 UTF-8 回读正常；收尾无遗留 Chrome 无头测试、node --test 或 next build，记录 `artifacts/t173/scope-post-processes.txt`。

### 公共上下文、交互态声明与 Chrome 就绪修复（2026-10-16，Codex）

主控转达第五次独立 sol 复审：`2048dbc` 仍 **NO_GO**，行段暴露父级／公共表头／document 成员为可写，以及 CSS 声明漏查交互态影响两项 P1。本轮同时处理 DevToolsActivePort 半写入与 T-162 零次提交检查异常，合同不变。构思主控决定还安排第六、第七轮复审；第七轮后剩余越界类问题按严格一侧拒收并记录已知限制，本轮尽量一次封住同类成员归属问题。

主控在 `2048dbc3941d9d10f036f1df1867f1d45e5a6868` 上 13:16–13:24 EDT（17:16–17:24Z）、负载 29–34 的全量结果为 **679/683**，日志 `artifacts/t173-supervisor-full-2048dbc.log`，报告 `artifacts/t167/test-run-1792170992130-51862/report.json`（17:24:17.600Z）。保留四个失败：T-151 Invalid URL、T-162 attempts 为 0，以及两项 T-164 动态探针超时。

T-162 的保留数据 `sitecraft-test-2MFOXU/code-sites/bf094ddf-8274-4356-bb1d-80be2e79cc6f.json` 显示任务 `7e44e51d-4639-4766-982b-899becccbcf9` 已完成一次 local-edit（HTTP 200、14ms），随后 step 为 `TypeError: Invalid URL`，repairRound=0、attempts=[]。不是任务未运行，也没有消耗修正额度；在提交检查启动阶段异常终止，与本轮 DevToolsActivePort 问题同类。保留「初稿加两轮修正」原断言，不改成容忍零次。

已评估 T-164 既有 `outsideCssApplications`：只枚举可见且可聚焦触发元素、沿祖先链强制四态，scope 排除的是整个区块子树。单项 CSS 成员是具体位置／伪元素；直接套用会把成员子树放宽，且不能覆盖没有可聚焦后代的 `p:hover`。要保证完整性需改变触发枚举及权限模型，不能直接复用现成检查来证明本合同。因此采用构思主控允许的严格一侧：复用现有完整伪类分类器，交互声明或静态影响不可核实即写明原因拒收；不另建动态探测、不调整原五秒／十五秒预算。

根因修复：行段的父级 prose、公共表头、表格自身及 document 成员标为只读；document 辅助文案独立核对并拥有自身成员，避免丢失原根级 CSS 修正能力。ARIA 引用文字同样只读。对公共成员的自身归属拒因，再与所有已通过／复用段按位置核对，仍有通过段引用就明确拒收；所有已知引用归属均被拒才可修改明确归属。CSS 声明检查调用 T-164 原分类器识别完整交互伪类（含 :has 内部），无需新探针。Chrome 只采纳完整有效端点：两行、端口 1–65535 正整数、browser 路径前缀及非空无空白后缀；否则继续原轮询，未增加固定等待、连接重试或超时额度。

父版本红测均为标准 npm test、仅设规定 CHROME_PATH：`npm test -- tests/t173-repair-scope.test.ts tests/t173-port-readiness.test.ts` 于 17:39:18Z 得到 **8/30，22 项失败**（`artifacts/t173/shared-2048dbc-red-final.log`，报告 `artifacts/t167/test-run-1792172326091-70143/report.json`）。在补齐“公共成员自身拒收但引用行已通过／所有引用行均拒收”的成对用例后，最终合法 CSS 夹具经 `npm test -- tests/t173-repair-scope.test.ts` 于 17:46:56Z 得到 **9/24，15 个越界坏例失败、9 个合法／保留对照通过**（`shared-2048dbc-corrected-red.log`，报告 `artifacts/t167/test-run-1792172768337-74794/report.json`）。临时恢复本轮四个源文件到 `2048dbc` 后执行，finally 已恢复当前实现，临时备份仅供恢复，不作源码复制证据。8 个端点坏例在真实 Chrome profile 中实际写入未就绪文件，由下一次读取补全；旧版提前连接失败，新版需实际 CDP 求值成功。首次同跑 T-162 四项对照也通过（`shared-2048dbc-red.log`），没有改其断言。

小范围 `shared-first.log` 为 **42/43**：两项 P1、归属并集、8 个端点及 T-162 原断言均通过。额外 CSS 转义夹具被既有反斜杠清理规则提前拦截、未到事实边界，因此不作为声明拒收证据；原结果保留。改用合法大小写 `:HoVeR` 后重新取得上述最终父版本红测；生产清理规则及原断言未放宽。

规定定向于 17:54:10Z 结束，**293/294，INCOMPLETE**；唯一失败为 `tests/t164-dynamic-gate.test.ts:128` 未激活媒体规则用例，原动态检查五秒截止处超时（`checkSiteCode:549`），未完成原定断言。日志 `artifacts/t173/shared-focused.log`、报告 `artifacts/t167/test-run-1792172862536-75708/report.json`、临时根 `sitecraft-test-faBFDV` 保留；不重跑或放宽上限，不断言与改动无关。补充两个 T-151 文件于 17:55:48Z **7/7**（`shared-t151-more.log`，报告 `artifacts/t167/test-run-1792173336966-82865/report.json`）。T-162 单条流程本轮仍以原断言通过“三次提交检查”，没有把零次改成通过。两条精确命令如下。

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t173-repair-scope.test.ts tests/t173-port-readiness.test.ts tests/t173-fact-members.test.ts tests/t173-fact-boundary.test.ts tests/t173-citation-repair.test.ts tests/t164-multi-block-edit.test.ts tests/t164-multi-block-chat.test.ts tests/t164-original-materials.test.ts tests/t164-review-seven.test.ts tests/t164-overlap-confirmation.test.ts tests/t164-local-output-limit.test.ts tests/t164-dynamic-gate.test.ts tests/t169-fact-citations.test.ts tests/t169-production-contract.test.ts tests/t169-contract-d.test.ts tests/t169-citations-browser.test.ts tests/t154-fact-segments.test.ts tests/t151-english.test.ts tests/t151-fidelity-rules.test.ts tests/t151-paragraph-repair.test.ts tests/t151-translation-protocol.test.ts tests/t151-short-translation.test.ts tests/t160-narrow-columns.test.ts tests/t160-materials.test.ts tests/t162-inline-annotation.test.ts tests/t138-dom-scope.test.ts tests/t138-repair-fragments.test.ts
```

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t151-backdrop-merge.test.ts tests/t151-generated-fidelity.test.ts
```

随后串行检查：`node --test --experimental-strip-types scripts/t167-runner-regressions.ts` 于 17:56:08Z **4/4**；`npm run typecheck` 于 17:56:10Z 通过；`SITE_STORE=fs npm run build` 于 17:56:38Z 通过。日志 `artifacts/t173/shared-runner.log`、`shared-typecheck.log`、`shared-build.log`。全量前 `memory_pressure` 空闲 **41%**，ps 未发现其他 Chrome 无头测试、node --test 或 next build；保留 `shared-pre-full-memory.txt`、`shared-pre-full-processes.txt`。

实现／测试冻结提交 `c416aa2d6611a90bcb626b37b48b742bc728304d`，上述最终定向及 runner／typecheck／build 与此快照一致。在该提交上仅串行执行一次 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test`，18:08:14.258Z 结束：**707/707，失败／取消／跳过均 0，PASS**。日志 `artifacts/t173/shared-full.log`，报告／身份／服务日志 `artifacts/t167/test-run-1792173616895-84369/`，临时数据根 `/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-test-xhPMLj` 保留。本轮新增上下文／交互态／端点测试及 T-162 原“三次提交检查”断言均通过；该次全量未出现 Invalid URL。没有重跑全量、放宽上限或改变 T-162 断言。此前规定定向的一项动态截止超时仍保留，不能用本轮全量通过改写为已修复。

本次引用截图已逐张打开：`artifacts/t162/self-contained-1792172870610-75830/` 的 T-162 十张、`self-contained-1792172898206-76363/` 的原始资料四张、`self-contained-1792172951284-77289/` 的重叠确认六张、`artifacts/t169/browser-1792173025321/` 的三档出处九张，以及主控 `self-contained-1792171127753-56268/failure-send-1440-bf094ddf-8274-4356-bb1d-80be2e79cc6f.png`，共三十张。载入态或目标离屏图只保留为状态／异常记录，不作为预览已载入的成功证据；本次无审美通过结论。

本轮交付 **INCOMPLETE**：两项 P1 采取上述可核实归属与严格交互策略，Chrome 半写启动有稳定红绿证据，T-162 原断言通过；全量 707/707、补充 T-151 7/7、runner／typecheck／build 通过，但规定定向仍为 293/294，一项 T-164 动态检查超时未归因。所有失败结果保留，不覆盖或重跑掩盖。第六、第七轮独立复审与真实生成继续由主控安排，票保持 open。本轮未读 `.env.local`、未调用 DeepSeek、未推送、未写主目录 `.sitecraft-data`，`tsconfig.json` 的自动脏改未提交。收尾只补本 Resolution，不改冻结实现或测试。

收尾 project-map 结构问题及过时 living doc 均为 0，UTF-8 回读正常，无遗留 Chrome 无头测试、node --test 或 next build（`artifacts/t173/shared-post-processes.txt`）。
