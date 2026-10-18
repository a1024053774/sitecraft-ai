---
id: T-179
title: 批注浮层腾位后，用户手动滚动不应被再次推回
type: build
status: open
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

## Acceptance

- [x] 手动滚动对照断言三档成对（自动腾位仍生效 / 用户滚动后不被推回），复现时先在父版本失败
- [ ] T-162 mobile-reveal、scroll-edge、review-regressions 与 T-175 遮挡断言回归通过，截图逐张看过（先前定向通过；最新全量 T-175 1440/768 失败，当前不能勾选）
- [ ] 不调用 DeepSeek；typecheck、test、build 通过；独立 fast 审查通过

## Resolution

**测试入口分池：INCOMPLETE（2026-10-18，CLI 分类修复后的并发 3 首轮未通过）**。入口候选在 `120927a` 上继续开发，仅改入口、入口回归与规则文档，不改 components、产品预算、判断条件或已有用例。CLI 子进程依赖现在沿参数变量、数组展开／slice、路径构造及 for-of 脚本列表递归追踪；运行时每 250ms 采样非浏览器池进程树，沿工作进程与 CLI 祖先记录 Chrome 所属文件，排除外部 Chrome 与 renderer，重复进程只告警一次；只记录告警，不重分池、不重跑、不改变测试结果。无法静态求值的运行时参数仍由此诊断观察，不声称能静态证明任意动态程序。

本次成对证据：先在 `120927a` 原入口取得 CLI 错分红灯；扩展的 helper／循环脚本与运行时归属回归也先失败，再由新入口通过。完整 runner 6/6；真实 `t145-import-cli` 与 T-176 入口／保留策略 12/12，T-145 打印完整 `测试 → CLI → store → check → browser → CHROME_PATH` 依据；typecheck 退出 0。证据：[原入口红灯](../../artifacts/t179/pool-cli-parent-red/command.log)、[扩展红灯](../../artifacts/t179/pool-cli-expanded-red/command.log)、[完整 runner](../../artifacts/t179/pool-cli-runner-green/command.log)、[CLI 与保留策略](../../artifacts/t179/pool-cli-targeted/report.json)、[类型检查](../../artifacts/t179/pool-cli-typecheck/command.log)。上述均记录命令、UTC 时间、HEAD 与预检，不用最终提交后的证据名义引用。并发 3 首轮已自然完成并失败，按规则停止；并发 3 第二轮、并发 2/1、选定后的同提交两轮及 build 均未运行，尚未选定默认值，入口默认 1 仍只是开发值。

本次校准完整结果：UTC **11:07:15.875–11:20:21.802**，启动前 memory_pressure 空闲 **39%**，ps 已保存。实际命令为 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell python3 artifacts/t179/run-check.py pool-cli-c3-r1 npm test -- --browser-concurrency=3`（由 `calibrate-pools.py pool-cli` 串行编排）。运行时 HEAD 为 `120927a`，加本次入口工作树改动；这些入口与回归代码会与本次独立提交一致，不冒充提交后最终验收。

| 候选／并发／轮次 | 文件／实际用例 | 总耗时（秒） | Chrome 主进程峰值 | 失败数 |
| --- | --- | --- | --- | --- |
| CLI 分类修复后／3／第 1 轮 | 119 个唯一文件 summary；826 用例，823 通过；0 跳过、0 取消 | 785.921 | 整轮 7；非浏览器 0、浏览器 7 | 3 |
| 3 第 2 轮、2/1 校准、选定后两轮与 build | 本轮失败后未启动 | 未测 | 未测 | 未测 |

非浏览器池 **27 文件／114 用例**，浏览器池 **92 文件／712 用例**，合计仍为 **119／826**，无重复文件、无跳过。比修复前多识别 10 个 CLI 引用文件，逐项依据在日志和 classification 中。实际非浏览器池 Chrome 峰值 0；入口 browserWarnings、browserMonitorErrors 与外部采样器 samplingErrors 均为空。峰值为每 200ms 的进程树采样，可能漏掉更短峰值，不把 renderer/GPU/utility 算作独立浏览器。两池都自然完成，入口因浏览器池失败退出 1，编排器正常停止；**没有中途终止全量**。

本轮完整失败清单及原始错误首行：

1. `tests/t175-stale-placeholder.test.ts`：「禾巷小馆 v2 经生产 chat 重放：提示与一起更新草稿刷新恢复 1440」；`Error: Chrome 检查失败：Error: 等待失败：!document.getAnimations().some(a=>a.playState==='running')`。
2. 同文件：「禾巷小馆 v2 经生产 chat 重放：提示与一起更新草稿刷新恢复 768」；`Error: Chrome 检查失败：Error: 等待失败：!document.getAnimations().some(a=>a.playState==='running')`。
3. `tests/t179-composer-scroll.test.ts`：「T-179 首次腾位与用户原生滚动成对验证 768」；`Error: Chrome 检查失败：Error: 不可操作：[data-testid="thread-reveal"]`，位于打开线程的初始点击，尚未进入首次腾位、用户滚动或恢复断言。

三项均不是本轮抛出的动态样式预算错误。没有据此断定新的根因，也没有改等待、放宽断言、修产品或重跑。T-162 三组各 3/3、T-175 遮挡 3/3、T-169 出处 9/9 通过；T-175 stale-placeholder 为 13/15，T-179 为 2/3，不能宣称全量或本票通过。旧中止轮与上一版并发 1 失败轮原样保留作反例。

证据均已复制至本票目录：[完整报告](../../artifacts/t179/pool-cli-c3-r1/report.json)、[完整错误日志](../../artifacts/t179/pool-cli-c3-r1/tests.log)、[耗时／Chrome 采样／提交与命令](../../artifacts/t179/pool-cli-c3-r1/metrics.json)、[预检](../../artifacts/t179/pool-cli-c3-r1/preflight.txt)、[校准停止记录](../../artifacts/t179/pool-cli-calibration.json)、[本轮汇总](../../artifacts/t179/pool-cli-result.json)。新入口未改 components、T-179 产品测试或 T-175 出处用例；独立审查仍由主控另派，尚未执行。

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
