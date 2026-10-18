---
id: T-179
title: 批注浮层腾位后，用户手动滚动不应被再次推回
type: build
status: closed
blocked_by: []
claimed_by: Codex
supersedes:
---

## Why

T-175 第三轮独立审查（2026-10-18）读源码推断：批注浮层为避开历史回看栏和「返回当前版本」自动腾位后，用户在预览里小幅往上滚，可能再次触发腾位，把阅读位置推回去。尚未实测，但若成立会直接伤到「修改/回看」的手感。

## What to build

1. 先实测：375/768/1440 三档，打开批注线程、触发一次腾位后，用真实滚轮小幅上滚与下滚，记录预览滚动位置是否被程序改写。
2. 不复现：把对照断言留作回归，写明结论关票。复现：只在用户主动滚动后停止自动腾位，直到用户再次点选目标或重新打开浮层；不改生成站代码，不放宽 T-162/T-175 已有的遮挡与可见性断言。
3. 顺带把 T-175 移交的小项改掉：「同一节点多占位」用例的两个预期片段改成两个不同出处。

## 2026-10-18 主控决定：测试入口按类别分池

负责人已授权实施，不选原 A/B 方案。入口沿本地运行时依赖静态识别浏览器 helper／CHROME_PATH 等 Chrome 入口，包含间接引用；每轮打印浏览器池归属，删除 T-175 的手工名单。非浏览器文件保持 Node 默认并发，浏览器文件进入独立限并发池，每文件每轮只运行一次，继续合并原生每文件 summary，零用例或任一池失败均令整轮失败。

验收条件：先在当前入口取得直接／间接识别、非浏览器排除、执行一次、统计合并与失败传播的红灯；浏览器池并发 1、2、3 分别实测总耗时、Chrome 峰值和失败数，以连续两轮全过且最快的值固定默认并发；最终同一提交完整运行两轮全量并 build。所有重任务串行，开始前 memory_pressure 与 ps，空闲低于 25% 不启动；当前全量必须自然跑完，失败后不进入下一项。旧中止轮仅作不完整反例保留。入口另行提交，不混入产品修复，不改产品预算、判断条件或用例，不跳测。同步 AGENTS 标准命令规则和 spec。

负责人后续判定：`120927a` 并发 1 开发轮的 T-169 页面载入与 T-175 768 动画等待失败，归因于入口漏掉 CLI 间接启动 Chrome、使其在非浏览器池默认并发运行。此轮原样保留为修复前证据；修正入口后重新校准属于修复验证。分类继续沿 CLI 子进程、spawn 脚本与 helper 调用链追踪，补充在 `120927a` 上失败的成对回归；非浏览器池运行时发现 Chrome 必须告警并记录所属文件，但不改变通过条件。校准顺序改为先 3 再 2，各须连续两轮全过，再选最快值；只有两者均不合格才回头测 1。任一校准轮失败时自然跑完该轮后停报，不自动进入下一轮。选定并发后另建入口提交，在同一提交上完整跑两轮全量，再 build。

目标／非目标：只修测试调度的根因边界，不改站点或批注产品代码；沿用「浏览器池／非浏览器池」的 Ubiquitous language，以真实 npm test 入口作为 Tracer bullet 验证分类、调度与统计，不另设平行入口，保持 Deep modules 的小接口。静态依赖规则的行为用合成模块及真实子进程验证；并发选择仍是 measured unknown，必须由本次完整运行决定，不能用上次生命周期区间推算。

## 2026-10-18 主控决定：A′，明确终态与共用生产预算

主控收到根因更正后以 A′ 取代刚派的 A，不加 B；撤回「排除 iterations 为 Infinity 的动画」，不实现该过滤。测试等待改等明确的任务状态或 DOM 终态，等待上限直接引用生产代码中同一预算常量或函数（三档合计封顶 60 秒），只加有本次实测依据的模型替身与存版固定余量，不在测试中另抄产品预算数字。逐个登记被替换的动画／加载图标等待点；旧上限超时、新上限通过、任务真卡住在新上限内明确失败须有成对证据，并先在 `8176884` 上取得红灯。

T-162 首次预览先核对保留 dev.log 的对应路由编译耗时与浏览器 navigation 计时；由证据决定只预热浏览器池实际使用的路由，还是按预算推导等待上限，不自行扩展方案。之后并发 2 连续两轮全量通过，固定候选后在同一提交再完整两轮全量并 build。每项前 memory_pressure 与 ps，空闲低于 25% 不启动；全量自然跑完，任一轮失败后停报。基础设施单独提交，不 amend、不与产品修复混合；这是 T-179 验收前置，完成即收口，不继续扩展其他基础设施。

## 2026-10-18 负责人决定：读取系数改为 300ms，60 秒总封顶不变

构思主控转达负责人决定：每档预算改为 `max(5 秒, 1 秒 + 300 毫秒 × 实际读取次数)`，三档合计仍封顶 60 秒。依据是本次负载下读取约 160ms／次，原 150ms 系数下两项生产检查分别超出 13,300ms 约 34.750／28.267ms：T-175 的 768 用例在 1440 检查档为 13,334.750ms，375 用例在 375 检查档为 13,328.267ms，两者计划均为源 41＋候选 41＝82 次，Chrome 峰值均为 3。原始现场在 [A′ 定向失败诊断](../../artifacts/t179/a-prime-related-diagnosis/diagnosis.json)，不以提高测试等待上限代替生产预算调整。

系数只改共用生产预算定义；测试等待继续直接引用同一生产总预算，固定实测余量不变。边界期望独立按新需求计算：82 次为 25,600ms，小页面仍走 5 秒下限；超出预算拒收；三档单档预算理论合计 76,800ms，因此须覆盖总封顶先到、第三档剩余额度小于单档预算时仍明确拒收。先在当前 150ms 候选上取得新断言红灯，再改生产定义。同步 AGENTS「局部修改」与 spec 当前规则为 300ms，不在规则中并列旧系数。

本次是此基础设施链的最后一步：相关定向、runner、typecheck 后，在同一预算候选提交上以浏览器池并发 2 连续完整跑两轮全量，再 build；以最新派单的两轮为准，不额外加此前的校准后两轮。每项前 memory_pressure 与 ps，低于 25% 停；每轮自然跑完，出现非本次引入的新基础设施问题后停报，不继续扩展 T-179。测试基础设施与预算调整分开新建提交，不 amend；独立 fast 审查由主控另派。

## 2026-10-18 入口负载门禁试行记录（已撤销）

此前曾实施入口负载门禁及测试观测注入，负责人现已决定完整删除。旧门禁的反例、通过与拒绝现场只作历史记录保留：[首轮证据](../../artifacts/t179/load-gate-evidence/index.json)、[NO_GO 修复证据](../../artifacts/t179/review-evidence/index.json)、[真实入口拒绝日志](../../artifacts/t179/review-t176-direct/command.log)。产品代码与动态检查预算继续冻结。

## 2026-10-18 独立审查 NO_GO：仅修本票四项问题

主控要求在 T-179 内修正：memory_pressure 改用可信绝对路径 `/usr/bin/memory_pressure`；T-176 嵌套入口注入测试系统观测，避免宿主机负载抢先挡住锁／保留策略断言；补静态分类中的解构重命名与显式 cwd 漏判，并检查默认值和嵌套写法；删除默认并发仍为 1 的过时说明，旧失败链接保留。不扩展其他基础设施。负责人随后明确：runner、T-176、typecheck 都不开 Chrome，属于轻量检查，只记录开跑 load，不受负载门禁限制；T-176 优先走 npm test，入口拒绝时可在测试侧注入系统观测，不给入口加跳过开关。反例先在 42cfc92 失败，再修到通过；不跑全量、build 或 Chrome 测试，新建提交后 idle。

## 2026-10-18 负责人最终决定：删除入口负载门槛，立即验收

负责人直接决定：门槛导致验收一直等不到机器空闲，因此删掉测试入口的开跑负载门槛，不再等待负载下降。完整删除门槛常量、系统读取、拒绝逻辑、报告开跑字段、测试观测 helper 及所有注入、门禁相关回归；保留静态分类的两条漏判修复及同类对照，默认并发说明保持 2。AGENTS、README、spec 删除门槛规则，不保留旧说法。只跑 runner、T-176 和 typecheck，不运行全量、build 或 Chrome 测试；全量与 build 由主控马上接续。新建提交，不 amend、不推送，报告 SHA 后 idle。

## Acceptance

- [x] 按负责人最终决定完整删除门禁及替身，保留分类对照，runner 18/18、T-176 10/10 与 typecheck 通过
- [x] 保留静态分类修复与同类语法对照：42cfc92 上先红后绿，默认并发当前说明为 2，旧失败证据保留
- [x] 手动滚动对照断言三档成对（自动腾位仍生效 / 用户滚动后不被推回），复现时先在父版本失败
- [x] A′ 基础设施前置：明确终态、共用生产预算与实测余量、预览原因证据、并发 2 校准及同提交验收通过
- [x] T-162 mobile-reveal、scroll-edge、review-regressions 与 T-175 遮挡断言回归通过，截图逐张看过
- [x] 不调用 DeepSeek；typecheck、test、build 通过；独立 fast 审查通过

## Resolution

**删除入口负载门槛：本轮 PASS（2026-10-18）；T-179 整体验收仍由主控接续，票保持 open。** 负责人决定门槛导致验收一直等不到机器空闲，因此完整删除，不再延迟验收。入口已删除门槛常量、load／memory_pressure 读取、拒绝分支及 `report.json.startupLoad`；仅为导出门禁函数引入的入口包装也已撤除。删除 `scripts/test-load-fixture.ts`、runner 中的门禁用例与所有观测注入、T-176 的负载 preload 及专属高负载用例。AGENTS、README、spec 中的门槛规则全部移除。

静态分类的来源属性名、重命名／默认值／嵌套／计算属性、显式 cwd 及同类写法修复与 12 项对照保持原样，默认并发仍为 2，票中相关更正保留。与门禁前 `5830141` 比较，入口差异只剩静态分类修复；T-176 恢复为门禁前的原有 10 项断言。runner 25→18、T-176 11→10 均来自删除门禁专属用例，没有跳过或放宽保留的断言。模型预算和产品组件未改。

本次检查源 HEAD 为 `bddf66a2291f62a5c23144f92276cde87216c01c` 加删除门槛后的提交前工作树；之后仅整理文档和证据。以下三项串行自然结束，退出码均为 0，0 跳过／取消，未设置负载替身或 NODE_OPTIONS。记录 load 的外部证据脚本不作拒绝判断，测试入口自身不再读取或报告开跑负载。[准确命令、UTC 时间、源提交与退出码](../../artifacts/t179/remove-gate-evidence/index.json)。

| 命令 | UTC 时间 | 开跑 load（1／5 分钟，仅证据记录） | 结果 |
| --- | --- | --- | --- |
| `node --test --experimental-strip-types scripts/t167-runner-regressions.ts` | 13:04:15.229–13:04:30.122 | 4.70068359375／5.7138671875 | **18/18**；[日志](../../artifacts/t179/remove-gate-runner/command.log) |
| `npm test -- tests/t176-test-output.test.ts` | 13:04:38.091–13:04:48.407 | 4.2861328125／5.52783203125 | **10/10**，非浏览器池 1 文件、浏览器池 0 文件；[报告副本](../../artifacts/t179/remove-gate-t176/entry-0/report.json) |
| `npm run typecheck` | 13:04:57.179–13:04:58.465 | 4.40087890625／5.47607421875 | 退出 **0**；[日志](../../artifacts/t179/remove-gate-typecheck/command.log) |

旧门禁证据不删除：[首轮门禁证据](../../artifacts/t179/load-gate-evidence/index.json)、[真实拒绝现场](../../artifacts/t179/review-t176-direct/command.log)、[前次修复成对证据](../../artifacts/t179/review-evidence/index.json)；它们只是历史记录，不再是当前入口规则。本轮未运行全量、build 或 Chrome 浏览器测试；主控将立即接续全量与 build。新建本地提交，不 amend、不推送；`tsconfig.json` 的 Next 自动改动保留且不提交，提交后停在 idle。

**前次 NO_GO 修复记录（bddf66a）：当时范围 PASS（2026-10-18）；其中门禁部分现已按负责人决定删除，下述证据保留。** 先在 `42cfc92931bb3f14bd47334fea48497bb7227531` 的产品入口上取得反例，再修复。当次没有改产品组件、生成站代码或动态检查预算，没有新增入口跳过开关。

1. 内存检查固定调用 `/usr/bin/memory_pressure`。PATH 反例放置可执行的同名伪造程序，返回 0% 并留下执行标记，仅对可信绝对命令注入 30% 观测。旧入口执行伪造程序并被 0% 拒绝；修后不执行伪造程序，取得可信命令的 30% 并放行。[旧 PATH 现场](../../artifacts/t179/review-evidence/review-runner-red-path.json)、[修后现场](../../artifacts/t179/review-evidence/review-runner-green-path.json)。另一次未注入的真实入口从绝对命令读到 39%，见下表。
2. T-176 与 runner 共用测试侧 `scripts/test-load-fixture.ts`，仅在被测子进程的系统 API 边界注入观测。T-176 每个嵌套入口最后加载自己的健康观测，不改锁、清理或统计条件。新用例先注入宿主机 9／8／20%：旧实现被负载抢先拒绝，原「已有测试入口」断言失败；修后真正走到原锁拒绝并保留持有者。[旧失败报告](../../artifacts/t179/review-t176-red/entry-0/report.json)、[完整错误](../../artifacts/t179/review-t176-red/entry-0/tests.log)、[新旧嵌套日志索引](../../artifacts/t179/review-evidence/index.json)。
3. 静态分类读取解构的来源属性名，覆盖重命名、默认值、嵌套对象模式、计算属性与对象简写；CLI cwd 支持 `process.cwd()`、同值变量、路径拼接和 cwd 简写属性。12 项语法对照在旧入口有 11 项明确漏分，既有简写默认值 1 项已能分类，保留为对照；修后 12/12。纯 Node CLI、纯类型、注释、普通字符串及旧名单文件名仍排除；五个分池场景继续检查每文件一次、过滤统计合并、任一池失败传播及并发参数，未放宽期望。[旧分类现场](../../artifacts/t179/review-evidence/review-runner-red-classification.json)、[新分类现场](../../artifacts/t179/review-evidence/review-runner-green-classification.json)。本次只证明所列确定语法；运行时计算的键、cwd／argv 和动态选择的模块路径不能由本次证据确认，仍沿用原有非浏览器池 Chrome 归属告警，不在本票继续扩展分析器。
4. 默认并发的当前说明已改为 **2（自 5830141 起）**，仍待主控完整验收；旧默认 1 失败轮的链接保留。AGENTS、README 与 spec 同步可信命令及轻量检查规则，只写当前规则。

以下均由 `python3 artifacts/t179/light-check.py <标签> <命令>` 保存真实开跑 load、UTC 时间、源 HEAD 与退出码，不做负载拦截。源 HEAD 均为 `42cfc92` 加本次提交前工作树；红灯时生产入口尚未修改，绿灯时为最终修复代码，之后只整理文档与证据。准确 argv（含测试侧 preload）、运行结果及已复制到本票的原入口报告见 [完整索引](../../artifacts/t179/review-evidence/index.json)。

| 标签／命令 | UTC 时间 | 开跑真实 load（1／5 分钟） | 结果 |
| --- | --- | --- | --- |
| `review-runner-red`：node --test 定向 PATH 与分类反例 | 12:47:31.206–12:47:33.824 | 5.1015625／6.16552734375 | 预期失败：PATH 与 11 项漏分；Node 统计 14 项，1 通过、13 失败（含父用例） |
| `review-t176-red`：测试侧 preload 后 npm test 定向 nested entry | 12:47:50.843–12:47:52.948 | 10.17138671875／7.13720703125 | 预期 1/1 失败；嵌套入口被高负载观测提前拒绝 |
| `review-runner-green`：`node --test --experimental-strip-types scripts/t167-runner-regressions.ts` | 12:48:33.444–12:48:49.039 | 6.619140625／6.619140625 | **25/25**，0 跳过／取消，退出 0 |
| `review-t176-direct`：`npm test -- tests/t176-test-output.test.ts` | 12:49:02.756–12:49:03.114 | 5.23876953125／6.28662109375 | 真实入口拒绝，内存空闲 39%，用例未执行，退出 1；现场保留 |
| `review-t176-green`：测试侧 preload 后 `npm test -- tests/t176-test-output.test.ts` | 12:49:10.968–12:49:19.886 | 5.29931640625／6.28173828125 | **11/11**，0 跳过／取消，退出 0；非浏览器池 1 文件、浏览器池 0 文件 |
| `review-typecheck`：`npm run typecheck` | 12:49:37.880–12:49:40.284 | 4.63623046875／6.02978515625 | 退出 **0**，无注入、无门禁 |

T-176 直接入口拒绝后，按轻量授权使用与 runner 相同的临时 CJS preload（`NODE_OPTIONS=--require=.../review-t176-fixed-load.cjs`）注入系统边界，仅限测试进程。外层仍经过标准入口的临时数据根、health 身份核对、存储许可及报告，没有手工绕过根校验。报告中的 1.25／2.5／30% 是测试观测，不能冒充真实低负载；真实 load 如表。[直接拒绝日志](../../artifacts/t179/review-t176-direct/command.log)、[通过报告副本](../../artifacts/t179/review-t176-green/entry-0/report.json)。

本轮只跑上述轻量检查，**未跑全量、build 或 Chrome 浏览器测试**；独立复审由主控安排。项目图检查为 0 problems／0 stale living docs。按要求新建本地提交，不 amend、不推送；Next 自动改动 `tsconfig.json` 保留且不提交，提交后停在 idle。下方保留前次暂停与旧失败证据，不作为当前未修复的说明。

**修复前暂停现场：BLOCKED（2026-10-18 12:44 UTC；后续已按主控的轻量检查澄清继续）**。工作树开工 HEAD 为 `42cfc92931bb3f14bd47334fea48497bb7227531`，原有脏改仅 `tsconfig.json`，未覆盖。源码已确认三条审查路径：生产门禁仍执行相对命令；T-176 start() 未注入系统观测；分类只读 BindingElement.name 且 values() 不支持 process.cwd()。票中默认 1 的当前说明已改为默认 2、待主控完整验收，原失败证据链接未删。

已准备但**尚未执行**的新反例：PATH 前置伪造 memory_pressure；分类的重命名、默认值、嵌套／计算属性解构、对象简写，以及显式／变量／拼接／简写 cwd；T-176 中高负载观测必须继续执行原锁断言。测试侧观测构造函数已提取到 `scripts/test-load-fixture.ts`，用于后续复用；尚未给 T-176 的默认启动注入健康观测，也未改生产路径或分类行为。runner 的外层前置检查已改读真实宿主机，仅嵌套被测入口保留测试观测注入，符合本轮派单。

准备反例时第一次脚本因批量替换误入夹具字符串而发生语法错误，未进入系统检查；已修正，仅属新测试开发错误，不算父版本行为红灯。[原始开发失败](../../artifacts/t179/review-runner-parent-red/command.log)。修正后只尝试一次真实门禁：`python3 artifacts/t179/run-check.py review-runner-parent-red-fixed node --test --experimental-strip-types '--test-name-pattern=T-179: a forged|T-179: runtime imports' scripts/t167-runner-regressions.ts`，UTC **12:44:55.180–12:44:55.503**，源提交仍为 `42cfc92` 加反例工作树。runner 调用同一个 `checkStartupLoad()`，未加载测试替身；取得 **1 分钟 load=4.40771484375、5 分钟 load=6.939453125、内存空闲=42%**，5 分钟 load 未低于 5，检查与 runner 退出 **1**。没有执行任何反例；Node 输出的文件包装失败不能算成缺陷红灯，也不能用它声称已证明三项修复。

[拒绝日志](../../artifacts/t179/review-runner-parent-red-fixed/command.log)、[命令／时间／提交／退出码](../../artifacts/t179/review-runner-parent-red-fixed/metrics.json)、[memory_pressure 与 ps 记录](../../artifacts/t179/review-runner-parent-red-fixed/preflight.txt) 均保留在本票。之后未等待或重试，未启动 T-176、typecheck、全量、build 或 Chrome 测试。由于本轮明确要求真实门禁及先红后修，生产行为修改与相应测试证据保持待续；未创建一个冒充修复完成的提交，准备中的改动保留未提交，HEAD 仍为 `42cfc92`，停在 idle。

**入口门禁首轮记录：INCOMPLETE（2026-10-18 12:35 UTC；当时 typecheck 被拒绝，最新结果见本轮修复记录）**。已将既有 300ms 候选和该轮两项失败独立保存为 `80c7672`；本次入口提交不再改产品或预算。门禁位于工作树身份核对之后、清理／取得锁／创建本轮目录／启动服务之前，直接读取 `os.loadavg()` 与 `memory_pressure`；1 分钟及 5 分钟 load 必须均 **< 5**，内存空闲必须 **>= 30%**。读取异常、命令不可用、输出无法唯一解析或数值无效一律拒绝，输出当前可取得的数值、门槛与原因并非零退出，不等待、不重试。通过值连同采样时间、门槛保存到本轮 `report.json.startupLoad`。入口不读取任何跳过检查的环境变量／参数，导出的共用检查函数也不接受替身参数。

成对回归通过真实入口及系统 API 边界验证，预期独立来自本次门槛需求。`node --test --experimental-strip-types '--test-name-pattern=T-179 load gate:' scripts/t167-runner-regressions.ts` 在 **80c7672** 原入口上先 **6/6 失败**（UTC **12:33:56–12:33:58**）：1 分钟等于 5、5 分钟等于 5、内存 29%、memory_pressure 不可用及输出异常均被旧入口错误放行，门槛内场景缺少开跑数值报告。[父提交红灯日志](../../artifacts/t179/load-gate-parent-red.log)。修后同一六场景通过，4.99／4.99／30% 放行并保存实际值；拒绝场景还检查没有启动服务、建立运行目录或取得锁。

完整命令 `node --test --experimental-strip-types scripts/t167-runner-regressions.ts` 首次 **12/12** 通过（UTC **12:34:30–12:34:45**）；收尾补足入口文件符号链接的真实路径判断与环境类型注解后，同一命令最终 **12/12** 通过（UTC **12:35:37–12:35:52**，14.874 秒，0 跳过／取消）。两次均为 `80c7672` 加本次入口工作树代码，属于提交前验证；[首轮日志](../../artifacts/t179/load-gate-runner-green.log)、[最终日志](../../artifacts/t179/load-gate-runner-final.log)。没有在读取失败后重试系统门禁。

回归在高负载宿主机的行为是明确的：回归开始先在测试子进程中调用同一个 `checkStartupLoad()`，只在 Node 系统 API 边界注入 1.25／2.5／30% 以通过前置检查；原有真实 `npm test` 子进程通过临时 `--require` 测试代码注入同样数值，使原有上下文、零用例、普通 dev 共存、启动失败、分池与统计断言仍可执行。高负载／低内存／读取失败另用真实入口子进程逐项验证拒绝。替身只由回归生成的临时 CJS 文件执行并同步 Node 内建模块绑定，正常 `npm test` 没有该文件加载步骤，没有新增生产开关、测试环境判定分支或可选 reader。此处的系统模拟只证明门禁判断与入口流程，不冒充宿主机当时处于低负载。[各场景值、时间、命令及已复制到本票的原有入口报告](../../artifacts/t179/load-gate-evidence/index.json)。

随后 UTC **12:35:03.398–12:35:03.639**，typecheck 的前置命令直接导入入口的 `checkStartupLoad()`，通过才 spawn `npm run typecheck`；本次真实结果为 **1 分钟 load=9.0595703125、5 分钟 load=13.3203125、内存空闲=41%**，两项 load 均越限，检查退出 **1**，**typecheck 没有启动**。没有等待或重试，也没有改为注入后运行 typecheck。[拒绝日志](../../artifacts/t179/load-gate-typecheck/command.log)、[准确命令、时间、退出码及未启动记录](../../artifacts/t179/load-gate-typecheck/result.json)、[ps](../../artifacts/t179/load-gate-typecheck/ps.txt)。不能将先前提交的 typecheck 结果算成本次通过。

AGENTS 验收标准命令、spec 和 README 的同处规则已同步；project-map 检查为 0 problems、0 stale living docs。按最新主控决定，**未跑全量、未跑 build、未启动 Chrome 浏览器测试**，没有继续修先前的产品／预算失败；入口单独新建提交后停在 idle。票仍 open，整体不报 PASS；主控另安排机器空闲后的全量与新 fast 独立审查。Next 自动改动 `tsconfig.json` 原样保留且不提交，未推送。

**A′ 基础设施候选与 300ms 调整：INCOMPLETE（2026-10-18，预算边界通过，相关定向自然结束后仍有两项失败）**。A′ 没有实现新增 Infinity 过滤，也不按动画名称判断任务完成。共用生产预算从原实现提取至 `lib/code-site-check-budget.ts`，生产提交入口、直接探针与测试引用同一定义；A′ 提取时数值不变，随后仅在此处执行负责人授权的系数调整。测试终态等待直接使用生产三档总预算加实测固定余量，初始预览沿用同一推导；`evaluate` 可接受此等待的 RPC 传输期限，生产调用默认 30 秒不变，DOM／任务自己的截止时间不延长、不重试。

逐个替换的等待点：

1. `tests/helpers/t162-browser.ts` 的 `session()` 返回前：从所有动画停转改成等待真实 after 任务及渲染的任务状态退出 running。
2. `tests/t175-stale-placeholder.test.ts` 的提示截图前：改成同一明确任务终态等待。
3. 同文件草稿回看截图前：改成同一明确任务终态等待。
4. helper 的 `settle()` 保留实际 after 完成事件，增加从持久化任务 startedAt 起算的期限；等待新运行标识也有同源期限。既有点击／截图稳定检查没有新增 Infinity 排除规则。

固定余量依据：四个保留的 T-175 任务，扣除动态检查后其余耗时为 3712.041、12752.010、5141.964、9363.788ms（包括模型替身、其他确定性检查及存版），最大 12.752 秒向上取至下个 5 秒档，固定取 **15 秒**；与直接导入的生产总预算相加，目前任务／初始预览上限为 **75 秒**。证据：[计算数据](../../artifacts/t179/a-prime-baseline/measurements.json)。生产系数改成 300ms 后，60 秒总封顶不变，因此测试不另写一个新的总预算数字。

首次预览的证据不支持首次编译慢：按三次会话的导航／刷新顺序对齐，同站点第四个请求才是失败的 768 导航，服务端 **38ms**，Next 阶段 **1.6ms**；日志不提供独立编译耗时，不能将 Next 阶段冒充纯编译时间。该路由此前已被请求。CDP 导航提交 **43ms**，DOMContentLoaded 在导航开始后 **20370ms**，load 在 **22879ms**。原 20 秒等待在 DOMContentLoaded 前结束，故按 A′ 使用共用预算推导期限，不加预热。早先提到的 241ms 是先前刷新，初次误对应分析已保留在 `measurements-initial-misattribution.json`，不作为当前结论。证据：[CDP 原始记录副本](../../artifacts/t179/a-prime-baseline/preview-browser.json)、[同站点服务日志](../../artifacts/t179/a-prime-baseline/preview-dev-lines.log)。

成对测试 `tests/t179-task-waits.test.ts` 先在 `8176884` 的旧 helper 上失败两项：旧 20 秒动画等待拒绝任务已终态但仍有无关无限动画的页面；真实 HTTP 任务被模型回复闸门挂起时，旧 settle 没有自己的终态期限。新 helper 下两项通过，覆盖未完成不放行、完成后无限动画仍转也放行；负例只在真实任务被闸门挂住时推进 Node 截止时钟，旧 20 秒时仍待决，到生产总预算＋15 秒且从任务 startedAt 起算时明确失败，随后恢复时钟再放行任务清理，没有固定 sleep 或模拟产品检查成功。时钟推进是期限对照，不冒充真实墙钟等待 75 秒。证据：[父版本红灯](../../artifacts/t179/a-prime-parent-red/report.json)、[绿灯](../../artifacts/t179/a-prime-task-green-fixed/report.json)。首次开发验证因后台 HTTP 提交后 UI 未自动读到 running 状态而失败，并产生未收尾的等待；已改成真实 reload 读回状态、finally 放行并等待未决任务，原结果保留于 [开发失败](../../artifacts/t179/a-prime-task-green/report.json)。

随后 A′ 相关定向自然完成 **10 文件／48 用例，46 通过、2 失败，0 跳过／取消**。UTC **12:02:00.683–12:10:07.069**，总耗时 **486.386 秒**，浏览器文件并发 1，Chrome 主进程峰值 **3**，预检空闲 **37%**、ps 已保存；运行于 `8176884` 加本次 A′ 工作树代码。命令为 `npm test -- tests/t162-inline-annotation.test.ts tests/t162-mobile-reveal.test.ts tests/t162-scroll-edge.test.ts tests/t162-review-regressions.test.ts tests/t175-thread-placement.test.ts tests/t175-stale-placeholder.test.ts tests/t178-read-budget.test.ts tests/t178-full-style-equivalence.test.ts tests/t179-composer-scroll.test.ts tests/t179-task-waits.test.ts`，仍由 run-check 脚本只设置既定 CHROME_PATH 执行。[报告](../../artifacts/t179/a-prime-related/report.json)、[完整日志](../../artifacts/t179/a-prime-related/tests.log)、[耗时与采样](../../artifacts/t179/a-prime-related/metrics.json)。

这两项是 T-175 768、375 用例原有的 `complete` 断言：真实任务终态为 error，step 为「局部动态状态检查超时，本次未保存版本」，已经不再是旧动画等待超时。768 用例在 1440 检查档实际 **13334.750ms**，375 用例在 375 检查档实际 **13328.267ms**；两者源／候选计划均 **41＋41＝82** 次，原预算 **13300ms**，completed=false，期间 Chrome 峰值均为 3。原断言与生产阈值未放宽；T-162 三组及 inline 共 13/13、T-175 遮挡 3/3、T-178 原边界与样式 12/12、T-179 滚动 3/3、新终态反例 2/2 通过。[生产现场副本](../../artifacts/t179/a-prime-related-diagnosis/diagnosis.json)。两项在保存 UI 截图之前抛错，没有失败截图，不能冒充已保存；该项生成的 71 张交互截图及父版红灯 1 张均已逐张打开，只作交互证据，不作审美结论，[截图索引](../../artifacts/t179/a-prime-related-screenshots.json)。

原有失败后曾按规则停止；负责人随后明确授权 300ms 系数调整，现继续该步骤，不延伸其他基础设施。新边界断言先在当前 150ms 生产候选上 **3/3 失败**：82 次实际公布 13300ms、需求期望 25600ms；包括等于预算、超一毫秒拒收及总封顶第三档剩余额度对照。命令为 `npm test -- '--test-name-pattern=源 10|每档刚好|82 次读取' tests/t178-read-budget.test.ts`，[红灯报告](../../artifacts/t179/budget300-parent-red/report.json)。300ms 定义改后预算全文件 **12/12 通过**，包括 82 次读取 25,600ms 的等于／超一毫秒对照，以及三档总额先到、第三档仅剩 8,800ms 的等于／超一毫秒对照。[绿灯报告](../../artifacts/t179/budget300-green/report.json)。

随后同一 300ms 工作树的相关定向于 UTC **12:21:03.071–12:26:11.050** 自然完成，**10 文件／49 用例，47 通过、2 失败，0 跳过／取消**，耗时 **307.975 秒**，Chrome 主进程采样峰值 **5**，预检空闲 **41%**、ps 已保存。命令仍为上述十个定向文件，源 HEAD 为 `5830141` 加预算候选工作树；[报告](../../artifacts/t179/budget300-related/report.json)、[日志](../../artifacts/t179/budget300-related/tests.log)、[采样与命令](../../artifacts/t179/budget300-related/metrics.json)。失败清单：

1. `tests/t175-stale-placeholder.test.ts`：「禾巷小馆 v2 经生产 chat 重放：提示与一起更新草稿刷新恢复 768」；原 complete 断言收到 error，step 为「局部动态状态检查超时，本次未保存版本」。375 检查档通过 11340.363ms；768 检查档为 **26194.531ms / 25600ms**，计划仍为 41＋41＝82 次、completed=false，总额剩余 48659ms，因此不是 60 秒封顶导致。
2. `tests/t175-thread-placement.test.ts`：「历史返回按钮与浮层边界成对验证 1440」；`Error: Chrome 检查 Runtime.evaluate 超时`，默认 30 秒 RPC 实际 **30043ms**，位于 historicalSite 的提交检查，尚未打开工作台。trace 仅到 `/code-check.html` 与 setDocumentContent，没有保留 evaluate 表达式，不能编造更细根因。

两项都发生在截图前，没有失败截图。正常完成的禾巷样本三档动态实际总耗时分别 **18055.512ms**（3723.811＋6213.033＋8118.668）和 **33938.328ms**（14027.730＋9576.710＋10333.888），均低于 60 秒；这两个完成样本不代表该轮全过。[现场和正常样本](../../artifacts/t179/budget300-diagnosis/diagnosis.json)。整项自然结束后已停止，没有继续 runner、typecheck、全量或 build，不重跑掩盖。预算调整独立新建提交，产品与预算不再继续修改；后续仅做主控最新授权的入口负载门禁。

**测试入口分池：INCOMPLETE（2026-10-18，并发 2 首轮自然完成后因 3 项失败停止）**。入口 CLI 分类候选为 `6466c89`，本票线程时序测试修复为 `be96dda`，最新全量运行于 `0f0987b`。没有修改 components 或生成站代码，产品预算与判断条件不变。CLI 子进程依赖沿参数变量、数组展开／slice、路径构造及 for-of 脚本列表递归追踪；运行时每 250ms 采样非浏览器池进程树，沿工作进程与 CLI 祖先记录 Chrome 所属文件，排除外部 Chrome 与 renderer，重复进程只告警一次；只记录告警，不重分池、不重跑、不改变测试结果。无法静态求值的运行时参数仍由此诊断观察，不声称能静态证明任意动态程序。

入口成对证据：先在 `120927a` 原入口取得 CLI 错分红灯；扩展的 helper／循环脚本与运行时归属回归也先失败，再由新入口通过。完整 runner 6/6；真实 `t145-import-cli` 与 T-176 入口／保留策略 12/12，T-145 打印完整 `测试 → CLI → store → check → browser → CHROME_PATH` 依据；typecheck 退出 0。证据：[原入口红灯](../../artifacts/t179/pool-cli-parent-red/command.log)、[扩展红灯](../../artifacts/t179/pool-cli-expanded-red/command.log)、[完整 runner](../../artifacts/t179/pool-cli-runner-green/command.log)、[CLI 与保留策略](../../artifacts/t179/pool-cli-targeted/report.json)、[类型检查](../../artifacts/t179/pool-cli-typecheck/command.log)。上述均记录命令、UTC 时间、HEAD 与预检，不用最终提交后的证据名义引用。并发 3、2 各首轮均自然完成后失败；两者第二轮、修复后并发 1、固定值后的同提交两轮及 build 未运行。当前入口默认文件并发为 2（自 5830141 起），仍待主控安排同一候选的完整两轮全量验收；上述旧失败证据保留，不作为默认 1 的当前说明。

并发 3 校准完整结果：UTC **11:07:15.875–11:20:21.802**，启动前 memory_pressure 空闲 **39%**，ps 已保存。实际命令为 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell python3 artifacts/t179/run-check.py pool-cli-c3-r1 npm test -- --browser-concurrency=3`（由 `calibrate-pools.py pool-cli` 串行编排）。运行时 HEAD 为 `120927a`，加当时入口工作树改动；这些入口与回归代码随后独立提交为 `6466c89`，不冒充提交后最终验收。

| 候选／并发／轮次 | 文件／实际用例 | 总耗时（秒） | Chrome 主进程峰值 | 失败数 |
| --- | --- | --- | --- | --- |
| CLI 分类修复后／3／第 1 轮 | 119 个唯一文件 summary；826 用例，823 通过；0 跳过、0 取消 | 785.921 | 整轮 7；非浏览器 0、浏览器 7 | 3 |
| 线程时序测试修复后／2／第 1 轮 | 119 个唯一文件 summary；826 用例，823 通过；0 跳过、0 取消 | 1107.968 | 整轮 5；非浏览器 0、浏览器 5 | 3 |
| 3、2 各第 2 轮、修复后 1 校准、固定值后两轮与 build | 各首轮失败后均未启动后续项 | 未测 | 未测 | 未测 |

非浏览器池 **27 文件／114 用例**，浏览器池 **92 文件／712 用例**，合计仍为 **119／826**，无重复文件、无跳过。比修复前多识别 10 个 CLI 引用文件，逐项依据在日志和 classification 中。实际非浏览器池 Chrome 峰值 0；入口 browserWarnings、browserMonitorErrors 与外部采样器 samplingErrors 均为空。峰值为每 200ms 的进程树采样，可能漏掉更短峰值，不把 renderer/GPU/utility 算作独立浏览器。两池都自然完成，入口因浏览器池失败退出 1，编排器正常停止；**没有中途终止全量**。

本轮完整失败清单及原始错误首行：

1. `tests/t175-stale-placeholder.test.ts`：「禾巷小馆 v2 经生产 chat 重放：提示与一起更新草稿刷新恢复 1440」；`Error: Chrome 检查失败：Error: 等待失败：!document.getAnimations().some(a=>a.playState==='running')`。
2. 同文件：「禾巷小馆 v2 经生产 chat 重放：提示与一起更新草稿刷新恢复 768」；`Error: Chrome 检查失败：Error: 等待失败：!document.getAnimations().some(a=>a.playState==='running')`。
3. `tests/t179-composer-scroll.test.ts`：「T-179 首次腾位与用户原生滚动成对验证 768」；`Error: Chrome 检查失败：Error: 不可操作：[data-testid="thread-reveal"]`，位于打开线程的初始点击，尚未进入首次腾位、用户滚动或恢复断言。

三项均不是本轮抛出的动态样式预算错误。没有据此断定新的根因，也没有改等待、放宽断言、修产品或重跑。T-162 三组各 3/3、T-175 遮挡 3/3、T-169 出处 9/9 通过；T-175 stale-placeholder 为 13/15，T-179 为 2/3，不能宣称全量或本票通过。旧中止轮与上一版并发 1 失败轮原样保留作反例。

证据均已复制至本票目录：[完整报告](../../artifacts/t179/pool-cli-c3-r1/report.json)、[完整错误日志](../../artifacts/t179/pool-cli-c3-r1/tests.log)、[耗时／Chrome 采样／提交与命令](../../artifacts/t179/pool-cli-c3-r1/metrics.json)、[预检](../../artifacts/t179/pool-cli-c3-r1/preflight.txt)、[校准停止记录](../../artifacts/t179/pool-cli-calibration.json)、[本轮汇总](../../artifacts/t179/pool-cli-result.json)。新入口未改 components、T-179 产品测试或 T-175 出处用例；独立审查仍由主控另派，尚未执行。

**并发 3 后的定向诊断（2026-10-18，主控授权继续并发 2）**：

T-179 768 是本票测试遗漏线程异步载入的前置等待。旧轮错误在计算点击中心之前抛出，原始按钮状态、命中与失败截图未保存，不能冒充有旧现场。源码中打开线程详情才异步 GET annotations；原测试却将预览载入当作线程就绪，立即点击按钮。先保持原点击方式，仅加观测并用显式闸门挂起真实 annotations 响应，在 `6466c89` 的产品与 helper 上得到相同「不可操作」红灯：按钮不存在，浮层不存在，host／stage／iframe 的滚动均为 0；失败截图已逐张查看，无产品浮层遮挡。修正只在本票测试中等待按钮出现且 enabled，闸门通过响应事件与待决 DOM 等待放行，不加固定 sleep；所有滚动、遮挡、恢复期望不变。三档对照通过，768 就绪后的真实中心 `(418, 726.5)` 命中 BUTTON／`thread-reveal`，滚动仍为 0、浮层仍为空；之后首次腾位、上／下滚、重新展开与原位重新点选均通过。此对照确定性重建该时序缺口，不声称还原旧轮未记录的精确瞬间。没有修改 components 或生成站代码。

红灯命令是 `npm test -- '--test-name-pattern=成对验证 768$' tests/t179-composer-scroll.test.ts`，UTC 11:24:42–11:24:53，预检空闲 36%，1/1 失败：[报告](../../artifacts/t179/initial-thread-red/report.json)、[失败几何](../../artifacts/t179/measurement-1792322684981-41957/failure-768.json)、[失败截图](../../artifacts/t179/measurement-1792322684981-41957/failure-768.png)。绿灯命令是 `npm test -- tests/t179-composer-scroll.test.ts`，UTC 11:25:21–11:25:51，预检空闲 39%，3/3：[报告](../../artifacts/t179/initial-thread-green/report.json)、[三档脚本、几何与截图](../../artifacts/t179/measurement-1792322724140-42303/)。24 张绿灯图、2 张定向红灯图已逐张打开，只证明交互及可见性。随后增加只读动画失败诊断，typecheck 退出 0，[日志](../../artifacts/t179/initial-thread-typecheck/command.log)。所有命令只设既定 CHROME_PATH，时间和 HEAD 在各 command.log。测试等待与诊断单独提交为 `be96dda`，不含入口或产品改动。

T-175 两张旧失败截图已逐张打开，并复制至本票目录。1440 截图仍显示后台检查范围、事实与三档布局的进度转圈；CSS `.spin` 每周期 900ms、无限重复。1440 等待实际 20015.805ms，Chrome 采样为 5→峰值6→6；768 等待 20015.727ms，采样为 6→峰值7→6。对应后台任务总耗时分别 33648.421／36109.179ms，两次 20 秒动画等待结束时任务都还没完成。因此等待失败与任务仍运行的无限进度动画相符，不能说已经证明某个有限入场动画跑了 20 秒。旧轮没有保存动画事件、播放时间或结束事件，无法还原动画精确起止；高并发及 load 约30–32 与较长任务时间并存，但仅凭这些数据不能证明负载是唯一原因。没有改 T-175 判断条件、预算或上限。helper 只增加动画 start/end/cancel 事件及失败时当前动画、播放时间和 computed timing 的只读归档，供随后全量如再次失败时核对；不增加等待、不取消动画。[诊断数据与限制](../../artifacts/t179/pool-c3-diagnosis/diagnosis.json)、[原始 timings 副本](../../artifacts/t179/pool-c3-diagnosis/t175-timings.json)。

**并发 2 完整运行与停止结果**：UTC **11:28:44.071–11:47:12.047**，提交 `0f0987bd178e5e751bf6b4a119fa0a3db0542813`，开始前 memory_pressure 空闲 **36%**，ps 已保存。实际命令为 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell python3 artifacts/t179/run-check.py pool-two-c2-r1 npm test -- --browser-concurrency=2`，由 `calibrate-two.py pool-two` 编排。119 个唯一文件、826 实际用例，823 通过、3 失败，0 跳过／取消；非浏览器池 27 文件／114 用例，浏览器池 92 文件／712 用例，合计与之前一致。总耗时 **1107.968 秒**，Chrome 主进程峰值 **5**（非浏览器池 0），browserWarnings、browserMonitorErrors、samplingErrors 均为空。全量自然完成，两池均完整收尾，退出 1 后编排器停止；没有向运行中的全量发送终止信号。

完整失败清单及原始首行：

1. `tests/t162-inline-annotation.test.ts`：「真实指针与键盘：768 就地输入、编号、刷新和离屏定位」；`Error: Chrome 检查失败：Error: 等待失败：document.querySelector('[data-testid="code-preview"]')?.contentDocument?.querySelector('main h1') || window.__t162ReviewErrors?.length`。首次预览等待实际 20011.375ms，Chrome 采样 1→峰值3→2；失败诊断无活动动画，尚未进入线程点击或批注腾位。本轮未进一步归因或修复，失败截图在等待结束后显示站点正文，不能据此反推超时瞬间是否已就绪。
2. `tests/t175-stale-placeholder.test.ts`：「禾巷小馆 v2 经生产 chat 重放：提示与一起更新草稿刷新恢复 1440」；`Error: Chrome 检查失败：Error: 等待失败：!document.getAnimations().some(a=>a.playState==='running')`。
3. 同文件：「禾巷小馆 v2 经生产 chat 重放：提示与一起更新草稿刷新恢复 768」；错误首行同第 2 项。

T-175 的新现场证明，等待覆盖了任务仍在运行时的无限进度动画，不能当成有限动画负载变慢：两档 `ws-fade-in` 均有 `animationend.elapsedTime=0.22`，超时快照只剩 `sitecraft-spin`，周期 900ms、iterations／endTime 均为 Infinity。1440 实际等待 **20017.363ms**，快照中两个 spinner 的 currentTime 均为 **20215.893ms**，Chrome 为 **4→峰值4→4**；768 实际等待 **20009.741ms**，一个 spinner 的 currentTime 为 **21265.840ms**，Chrome 为 **4→峰值5→4**，均仍是 running。对应后台任务共 **39271.348／32406.777ms**，分别在等待结束约 **15396.985／4229.036ms** 后完成。文件并发降到 2 后仍发生，不能把问题简单归为并发 3；负载对后台任务耗时的影响没有隔离测量，不能断言是唯一因果。保持 T-175 条件、预算与超时不变，没有增加固定 sleep、取消动画或重跑。3 张本轮失败截图已逐张打开并复制保留。

T-179 本轮 **3/3**，包括 768 初始线程点击、首次腾位、真实上／下滚、重新展开与重新点选；T-162 指定三组各 3/3、T-175 遮挡 3/3、T-169 出处 9/9 通过。T-175 stale-placeholder 13/15，T-162 inline-annotation 3/4，整体仍不通过。按主控「并发 2 任何一轮失败后停」的指令，未进入第二轮、未固定 2、未跑固定提交后的两轮或 build，也未回头测 1。测试等待修复独立为 `be96dda`；本轮只补诊断与记录，不混入入口或产品修复，不 amend、不推送。独立审查仍由主控安排。

本轮证据：[完整报告](../../artifacts/t179/pool-two-c2-r1/report.json)、[完整失败日志](../../artifacts/t179/pool-two-c2-r1/tests.log)、[耗时与 Chrome 采样](../../artifacts/t179/pool-two-c2-r1/metrics.json)、[预检](../../artifacts/t179/pool-two-c2-r1/preflight.txt)、[校准停止记录](../../artifacts/t179/pool-two-calibration.json)、[动画事件、播放时间、Chrome 区间、后台任务和截图副本](../../artifacts/t179/pool-two-diagnosis/diagnosis.json)。原中止轮、旧并发 1、并发 3 与本轮失败均原样保留。

**修复前分池候选与完整失败轮**：以下记录属于 `120927a` 的上一版入口，全部保留，不代表新候选验收结果。首轮用的是 HEAD `69cea59` 上的新入口工作树代码，随后单独提交为 `120927a`；默认并发 1 是当时的开发起点。

模块引用版本的回归先在原入口红灯（错误分池），再在新入口 5/5 通过，覆盖直接／静态间接／动态 import、循环引用、类型／字符串／注释排除、旧名单文件名不影响归属、每文件一次、过滤统计、任一池失败与并发参数传入。T-176 保留策略回归 10/10，typecheck 退出 0。证据：[旧入口红灯](../../artifacts/t179/pool-parent-red/command.log)、[模块引用版本绿灯](../../artifacts/t179/pool-runner-green/command.log)、[保留策略报告](../../artifacts/t179/pool-retention/report.json)、[类型检查](../../artifacts/t179/pool-typecheck/command.log)。

**修复前分类缺口**：通过 spawn/spawnSync 执行本地 CLI、由该脚本再引用 Chrome 的路径当时未纳入，例如 `tests/t145-import-cli.test.ts → scripts/import-legacy-site-code.ts → commitSiteCode`。开发轮静态分为非浏览器 37、浏览器 82；ps 采样实际在非浏览器池捕获到 Chrome 峰值 1，故此分类不合格。当时已加入 CLI 回归输入但未运行，该轮回归不能报通过；本次红绿结果见上文。没有通过手工搬文件弥补。发现缺口后只暂停后续比较编排，正在运行的全量始终继续自然运行；全量结束后因原有用例失败，依负责人规则停止，没有继续修入口或重跑。

| 并发／轮次 | 全量结果 | 总耗时（秒） | ps 采样 Chrome 主进程峰值 | 失败数 |
| --- | --- | --- | --- | --- |
| 1，第 1 轮（分类未完善的开发候选） | 自然完成 119 文件、826 用例；824 通过、2 失败；0 跳过、0 取消 | 2519.617 | 整轮 3；非浏览器池 1、浏览器池 3 | 2 |
| 1，第 2 轮 | 未运行 | 未测 | 未测 | 未测 |
| 2、3 | 未运行 | 未测 | 未测 | 未测 |
| 固定值后同提交两轮与 build | 未运行；没有合格并发值 | 未测 | 未测 | 未测 |

实际命令：`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell python3 artifacts/t179/run-check.py pool-c1-r1 npm test -- --browser-concurrency=1`。UTC 06:10:40–06:52:39，启动前 memory_pressure 空闲 52%，ps 已记录；采样器每 200ms 读取本命令进程树中的 Chrome 主进程，不把 renderer/GPU/utility 子进程当浏览器，可能漏过更短瞬时峰值。没有向运行中的测试入口发送终止信号；119 个独立文件 summary 全部取得，非浏览器池 151 + 浏览器池 675 = 826，文件唯一数 119，任一池失败使整体退出 1。比较编排器仅在确认测试入口已退出后关闭。

本轮完整失败清单（原始首行已保存）：

1. `tests/t169-citations-browser.test.ts`：「表格中的跨单元格价格出处经真实提交入口存版并准确绑定行」；`Error: Chrome 页面载入超时`。
2. `tests/t175-stale-placeholder.test.ts`：「禾巷小馆 v2 经生产 chat 重放：提示与一起更新草稿刷新恢复 768」；`Error: Chrome 检查失败：Error: 等待失败：!document.getAnimations().some(a=>a.playState==='running')`。

这两项属于页面载入／等待错误，不是本轮抛出的动态五秒预算错误；主控后续判定与 CLI 分类漏洞相关，按上述决定修入口，不放宽等待或改断言。上次已观察到的 8 个失败用例本轮通过，但本轮有新的原有失败，不能据此宣布新入口全量通过。该轮交回主控时，2/3 比较、最快值选择、同提交两轮和 build 均未完成。证据：[开发轮完整报告](../../artifacts/t179/pool-c1-r1/report.json)、[完整异常日志](../../artifacts/t179/pool-c1-r1/tests.log)、[实际耗时与 ps 采样](../../artifacts/t179/pool-c1-r1/metrics.json)、[候选结果汇总](../../artifacts/t179/pool-attempt-summary.json)。上次反例仍为下文那轮中途被人为终止的 8 项记录，不完整，不能作完整总数基线。

**产品阶段与原不完整反例（2026-10-18 UTC）**。功能候选提交为 `be8af2cc0cbdc7182a897142cf48c89cafb16b5b`（父提交 `d90ffc2`）。三档定向检查、指定的原有回归、runner 与 typecheck 通过；该候选上的一次全量出现原有用例失败后，Codex 误把「当前项自然跑完后不再进入下一项」理解成中止当前全量，主动发送 SIGTERM；这不符合负责人原意。此轮未自然跑完，不重跑、不启动 build。结果见 [验收汇总](../../artifacts/t179/final-validation.json)、[全量报告](../../artifacts/t179/full/report.json) 和 [日志](../../artifacts/t179/full/tests.log)。此前文档收尾提交只更新 Resolution；产品代码自 be8af2c 后未改，测试入口变动由本次独立提交承担。独立审查仍由主控另派，最后一项验收保持未勾选。

实测结论：父版本 `4781659` 在 768/1440 复现用户上滚后被程序推回，375 不复现。首次只测量的 [脚本和数据](../../artifacts/t179/measurement-1792289031509-45580/) 与 [报告](../../artifacts/t179/baseline-measurement/report.json) 保留；上滚输入为 -48，内层 scrollTop 分别为 375 `2271→2223`、768 `1927→1879→1919`、1440 `1673→1625→1658`，外层保持 `203/85/0`。浮层 top 分别为 `761→761`、`739.875→749`、`738.015625→749`。下滚 +48 三档均保留原生位移。

需求断言先在 `4781659` 的产品代码上失败：[父版本报告](../../artifacts/t179/parent-red/report.json)、[脚本与数据](../../artifacts/t179/measurement-1792289094226-46179/)。场景增加一句意见，确保三档都实际触发首次腾位；375 通过，768/1440 在原生位移断言失败，首次腾位三档均通过。前一候选失败的 [报告](../../artifacts/t179/focused-green/report.json) 及 [继续诊断的报告](../../artifacts/t179/diagnose-reopen/report.json) 都保留，没有覆盖或重跑掩盖。

两项恢复失败的原因及处理：

- 375 是产品逻辑：手动滚动后收起再展开，只清除 userScrolled，却保留 lastReveal，面板恢复原高度后被误认为已定位。诊断时目标底部 `772.06`、面板顶部 `742`，且没有 expand 阶段的腾位。现在在重新点选／定位／展开时同时清除上次定位标识；展开后目标底部 `732.124`、面板顶部 `742`，恢复避让。
- 768 是测试场景：pick helper 在点击前执行 scrollIntoView，使目标顶部 `545.83984375`、面板底部 `537.828125`，本来就可在上方放下，不产生 scrollBy 是合法结果。现在先用真实滚轮制造遮挡，再原位真实点击同一标题，不让 helper 预先消除场景；仍要求实际腾位、完整浮层和目标避让。修后目标底部 `680.264892578125`、面板顶部 `688`，捕获到重新点选后的自动腾位；375 也取消原用例的宽度豁免，三档统一检查。

最终行为只在工作台实现：首次腾位保留；原生滚轮、触摸移动、滚动键或滚动条输入后停止自动腾位；再次点选、定位线程或展开时恢复。生成站 HTML/CSS 不变，不新建版本。T-175 同节点两个占位用不同出处逐项核对 snippet 与 quote，已在原有回归中通过。既有 T-162/T-175 遮挡与可见性断言未放宽。spec 只记录规则，AGENTS 只补一句同规则。

全部浏览器测试走标准 npm test 入口，运行者只设置 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell`；`artifacts/t179/run-check.py <标签> <命令>` 在每项开始前运行 memory_pressure 和 ps，低于 25% 不启动，并保留时间、提交和退出码。下表命令均以该脚本运行，标签对应报告目录。

| 标签／命令 | UTC 时间 | 结果与证据 |
| --- | --- | --- |
| `reopen-green`：`npm test -- tests/t179-composer-scroll.test.ts` | 02:09:39–02:10:03 | 3/3；[报告](../../artifacts/t179/reopen-green/report.json)、[三档脚本、几何与截图](../../artifacts/t179/measurement-1792289380202-51243/) |
| `related-regressions`：`npm test -- tests/t162-mobile-reveal.test.ts tests/t162-scroll-edge.test.ts tests/t162-review-regressions.test.ts tests/t175-thread-placement.test.ts tests/t175-stale-placeholder.test.ts` | 02:10:18–02:12:47 | 27/27；[报告](../../artifacts/t179/related-regressions/report.json)、[日志](../../artifacts/t179/related-regressions/tests.log) |
| `runner`：`node --test --experimental-strip-types scripts/t167-runner-regressions.ts` | 02:12:52–02:13:08 | 5/5；[日志](../../artifacts/t179/runner/command.log) |
| `typecheck`：`npm run typecheck` | 02:13:15–02:13:20 | 退出 0；[日志](../../artifacts/t179/typecheck/command.log) |
| `full`：`npm test` | 02:14:28–02:21:22；候选 `be8af2c`，启动前空闲 49% | INCOMPLETE，见下文；[报告](../../artifacts/t179/full/report.json)、[日志](../../artifacts/t179/full/command.log) |
| `build`：`npm run build` | 未运行 | 全量出现原有失败后按要求停止 |

定向及原有回归在 `be8af2c` 提交前的工作树运行，产品代码和测试与该候选相同。全量在 `be8af2c` 上运行一次；Codex 主动发送 `kill -TERM 55402`，使入口中途结束并拒绝启动末尾串行阶段，保留报告与临时数据根。已完成的 91 个文件原生汇总为 501 用例、495 通过、6 失败；尚未完成的 review-seven 文件在关闭前另输出 2 项失败，故日志共观察到 8 项失败，未完成项不能算通过。失败涉及 T-163 的 375 圈选草稿流程，以及 T-164 的 dynamic-gate、multi-block-edit、original-materials、review-seven；具体失败名称在验收汇总，完整输出在全量 tests.log。尚未判定各失败根因或与 T-179 的关系，不以负载猜测替代证据。验收截图均在最终产品改动后生成并逐张打开：T-179 定向 18 张，原有回归 37 张（T-162 的 scroll-edge 9、mobile-reveal 6、review-regressions 10，T-175 的 thread-placement 6、stale-placeholder 6）。[原有回归截图索引](../../artifacts/t179/related-screenshots.json) 保留精确路径。只证明交互和可见性，不自评审美；scroll-edge 的空白预览是目标滚出视野的夹具状态，不作生成站质量证据。此前 43 张测量／失败截图也都已逐张打开，原始结果保留。

未读 .env.local、未调用 DeepSeek、未使用 rm 命令、未写主目录 .sitecraft-data、未推送。Next 自动改动 tsconfig.json 留在工作树且不提交。wheel 以外的主动滚动输入未单独实测；模型替身不证明真实模型行为，本票不需要真实模型或外部依赖验证。

**原中止轮八项失败的只读诊断（2026-10-18，当时未重跑、未修复）**

原始 `test:fail` 错误对象未归档：`scripts/test-summary-reporter.mjs` 只保存文件 summary，spec reporter 在中止后没有输出完整异常详情。因此八项的**原始错误首行均未保留**，不能冒充已取得。下表 E0/E1/E2 是依据唯一失败调用、动态诊断、保留的运行状态及源码还原的首行；第 6 项还由该站点第二次提交的 `run.step` 交叉核对。

- E0：`Error: Chrome 检查失败：Error: 等待失败：document.querySelector('[data-testid="code-preview"]')?.contentDocument?.querySelector('main h1') || window.__t162ReviewErrors?.length`
- E1：`Error: 局部动态状态检查超时，本次未保存版本。`
- E2：`AssertionError [ERR_ASSERTION]: 局部动态状态检查超时，本次未保存版本。`

读取列为「预先公布的完整读取计划 → 根据 CDP 序列与 reader 控制流还原的完成数」，均按源+候选列出，不是 getComputedStyle 调用数。完成数不是原始专用计数字段。耗时是该次 dynamic-check 总耗时，包含分类、Chrome 启动、准备、读取与收尾，不等于单纯读样式耗时。Chrome 列为已保存 browser 生命周期区间重建的「开始/期间峰值/结束」测试浏览器实例数；不是当时的 ps 瞬时采样，不含用户 Chrome 的 helper 进程，含启动和退出计时偏差，也不能保证覆盖未正常 close 的实例。原始 OS 瞬时并发进程数未采样。

| 序号 | 测试文件与完整用例名 | 首行（还原） | 是否动态预算超时／档位 | 完整读取：计划 → 完成 | 预算／实际耗时（ms） | Chrome 开始/峰值/结束 | 与 T-179 的关系 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `tests/t163-area-drafts.test.ts`：圈选与三条草稿：375 真实反向指针、编辑、移除、编号和刷新 | E0 | 否；UI 预览等待 | 不适用 | 20000 / 20737.496 | 12/13/11 | 组件关联未证实：初始预览等待，尚未圈选；载入时序的间接影响未排除 |
| 2 | `tests/t164-dynamic-gate.test.ts`：CSS 列表特异性或嵌套条件改变外部样式时拒绝：main:has(a:nth-of-type(2):focus) .outside,.outside{color:rgb(220,20,20)}.outside{color:#111} | E1 | 是；375，四态模式 | 5+9 → 0+0 | 5000 / 17374.690 | 12/13/11 | 无直接功能调用关联：未改动的后端检查超时；不是浮层逻辑失败 |
| 3 | `tests/t164-dynamic-gate.test.ts`：CSS 列表特异性或嵌套条件改变外部样式时拒绝：:scope:has(a:nth-of-type(2):focus) .outside{color:rgb(220,20,20)} | E1 | 是；375，四态模式 | 5+9 → 0+0 | 5000 / 5240.596 | 9/11/10 | 无直接功能调用关联：未改动的后端检查超时；不是浮层逻辑失败 |
| 4 | `tests/t164-multi-block-edit.test.ts`：候选新增链接触发范围外自定义属性也必须拒绝 | E1 | 是；375，四态模式 | 1+5 → 0+0 | 5000 / 16747.429 | 11/13/12 | 无直接功能调用关联：未改动的后端检查超时；不是浮层逻辑失败 |
| 5 | `tests/t164-multi-block-edit.test.ts`：动态探针在三档视口固定检查四种状态并记录强制调用证据 | E1 | 是；375，四态模式 | 5+5 → 3+4 | 5000 / 5057.635 | 8/11/11 | 无直接功能调用关联：未改动的后端检查超时；不是浮层逻辑失败 |
| 6 | `tests/t164-original-materials.test.ts`：旧站批次逐字核对原始资料，只给新版本保存出处，三档显示原始资料 | E2 | 是；1440，静态基线、共用预算 | 1+1 → 1+1 | 5000 / 5779.513 | 10/10/10 | 无直接功能调用关联：未改动的后端检查超时；不是浮层逻辑失败 |
| 7 | `tests/t164-review-seven.test.ts`：祖先规则在焦点态改变明确高度仍须拒绝 | E1 | 是；375，四态模式 | 1+5 → 0+0 | 5000 / 8887.966 | 10/11/6 | 无直接功能调用关联：未改动的后端检查超时；不是浮层逻辑失败 |
| 8 | `tests/t164-review-seven.test.ts`：区块外 ::before 的完整计算样式改变必须拒绝 | E1 | 是；375，四态模式 | 1+5 → 1+3 | 5000 / 5043.673 | 10/11/9 | 无直接功能调用关联：未改动的后端检查超时；不是浮层逻辑失败 |

超时位置：第 2/3/4/7 项在计划发布时已分别耗时 `17336/5229/16648/8882ms`，超过 5000ms，两侧只完成准备的 5 次 CDP 调用、styleRead 均为 0，尚未开始完整读取。第 5 项源侧完成 baseline/focus/focus-visible 后在 clear 校时超时；候选完成至 hover 后被清理打断。第 6 项两次静态完整读取已完成，候选 reader 收尾校时超时，第二次提交保存为 run.error，随后触发 complete 断言失败；尚未进入后续三档出处 UI。第 8 项源侧 baseline 后在无触发元素的状态清理阶段超时，候选完成至 focus-visible 后被清理打断。不能把这些异常误写为「外溢被允许」或「动态用例正常拒收通过」。

关系判断的边界：第 2–8 项走 `commitSiteCode → checkSiteCode → prepareOutsideCssApplications`，这些实现及失败测试文件相对 `4781659` 均未改动；检查浏览器使用无脚本 `/code-check.html` 并阻断 Next 资源，不加载 CodePreviewSelection。第 1 项同属工作台页面，唯一慢调用是 session 首次等待（CDP 20702ms、helper 20737.496ms），失败截图、timings 与源码定位到进入圈选前；没有浮层恢复逻辑触发的证据，但不能把这等同于证明载入时序完全无关。

两项测试改动分别排除：T-179 新用例本轮没有进入创建测量目录、运行用例与创建 Chrome 的路径；T-175 出处调整所在文件属于串行阶段，该阶段未启动，所以它没有运行。二者不是这次并发 Chrome 的新增来源。观察到 10–13 个区间重建的并发实例和多项预算超时，是同轮现象；没有受控实验，不能断言负载是唯一根因。没有跑父版定向：本轮遵照先不重跑，只读既有证据；第 1 项相关性保持未证实，不用不同并发下的一次父版通过替代全量因果证明。

入口提前结束的机制：不是失败后正常跑完，也没有证据表明入口自行崩溃或触发了全量超时。主动 SIGTERM 进入 `scripts/run-tests.ts` 的 stop handler，设置 interrupted=true，并终止测试子进程和 dev server；并行子进程关闭后，准备进入串行阶段时 `assert.ok(!interrupted)` 抛出「测试入口已取消，拒绝启动下一阶段」。正常失败只累计 testCode，原代码不会因此跳过串行阶段。此次人为中止使 116 个并行文件中仅 91 个留下完整 summary，25 个没有完整 summary（可能运行中、尚未运行或输出尚未刷新），3 个串行文件全部未执行。501 仅是完整文件 summary 的统计，不是完整实际执行总数；日志的 8 项也不是完整失败清单，原始异常详情与潜在后续失败均无法从本轮补齐。今后「失败就停」统一按当前项自然结束后不进入下一项执行，不向运行中的全量发 SIGTERM；用户明确要求取消除外。

诊断证据：[逐项数据与关系判断](../../artifacts/t179/failure-audit.json)、[只读指标提取脚本](../../artifacts/t179/failure-audit.py)、[375 首次预览等待失败截图](../../artifacts/t162/self-contained-1792289783018-60122/session-failure-375-1349c66a-6bb7-4641-8354-7c49df8e247d.png)。截图已打开，仅证明失败时工作台状态。该只读诊断阶段只更新诊断与 Resolution，未改产品、测试、预算、超时上限或并发设置。

### 关票（主控）

2026-10-18（纽约时间）。工作树 `f1b4ec1`（入口负载门槛已按负责人决定删除）上自然跑完：runner 回归通过；全量两轮均 829/829（非浏览器池 114、浏览器池并发 2 共 715），分别约 12.0 和 12.7 分钟；typecheck、build 通过。两轮期间 1 分钟 load 5.7–15.3，每步开跑与结束的 load 见 [steps.log](../../artifacts/t179/quiet-run/steps.log)，各步输出同目录。T-175 重放两轮均通过。

独立 fast 审查：首审 `42cfc92` NO_GO（memory_pressure 走 PATH、T-176 嵌套入口未注入观测、静态分类两条漏判、票内旧描述），`bddf66a` 修复后同一审查实例复审 PASS；其后 `f1b4ec1` 只删除门槛及其替身，保留分类修复。

合并主线 `128259a` 后主线验证（09:33–09:48 EDT）：runner exit 0；`npm test` exit 0，non-browser 27 个文件 114/114，browser 93 个文件 715/715；build、typecheck exit 0；站点数 280。报告：[main-verify/report.json](../../artifacts/t179/main-verify/report.json)，日志同目录。主线验证截出的 [1440](../../artifacts/t179/measurement-1792331146574-80915/down-1440.png)、[768](../../artifacts/t179/measurement-1792331146574-80915/down-768.png)、[375](../../artifacts/t179/measurement-1792331146574-80915/up-375.png) 滚动截图已逐张打开：批注线程面板未遮挡选中区块，未被推出视口。未调用 DeepSeek，token 0。
