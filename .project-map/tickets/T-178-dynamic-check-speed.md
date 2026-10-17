---
id: T-178
title: 加快局部修改动态状态检查（不改检查语义）
type: build
status: open
blocked_by: []
claimed_by: Codex
supersedes:
---

## Why

T-175 的正常局部修改在动态检查固定截止时间处被拒收，完整样式取值是主要成本。单次读取、变化节点跟踪与每侧并行试验均无可保留的稳定收益，负责人最终决定保留原完整检查，按实际完整读取次数分配时间并限制三档总耗时，使预算与本次检查工作量对应。

## 构思主控决定（2026-10-17）

T-175 先暂停，这张票提前做，用新的 sol 实例执行。依据是 T-175 的实测结果（证据在 t175 工作树的票 Resolution 与 `artifacts/t175/`）：
- 测试文件并发降到 1、同一轮没有其他测试 Chrome 重叠时，禾巷小馆首页样式读取空闲约 2.7 秒，负载下约 4.6 秒，第二轮 375 档在 5.02 秒超时；
- 并发 2、4、6 也都有失败。
所以光限制测试并发不能稳定通过，要在检查本身提速。验收另加一条有负载的要求，见下方 Acceptance。

构思主控进一步决定（2026-10-17）：先不引入并行方案，先定位实现根因。负责人观察当前 load 约 2.6、内存空闲 61%，无温控或低电量记录，空闲检查仍约 5.3 秒，据此判断慢在实现。先在同一 Chrome、同一禾巷小馆 v2 首页做单次 Runtime.evaluate 的完整属性读取基准，至少五次并拆分读取、JSON 序列化、CDP 传输与 Node 解析；再对现有一次完整检查同时录 Chrome CPU／Tracing 与 Node --cpu-prof，列出热点及占比。基准远低于一秒时采用同语义读取方式，并重跑 131 次对照、完整属性用例与三档五次分布；若剖析证明主要成本为样式重算，停止并报告，再由主控考虑并行。生产五秒上限不改，DeepSeek、全量与 build 均不运行。

构思主控新方向（2026-10-17，取代继续优化单次读取）：单次完整读取约 85ms，但每档每侧约 41 次、两侧约 82 次，故改为减少完整读取次数。先在指定 headless shell 154 上验证 `CSS.trackComputedStyleUpdates`／`CSS.takeComputedStyleUpdates` 的实际可用性、完整属性列表及上限、CSS 域 enable 要求、强制状态到更新可取的时机与漏报风险。准入后跟踪全部计算属性，只重读确实变化节点，其余沿用基线；五类伪元素分别验证，不能覆盖的伪元素继续每态完整读取。API 不可用或元素跟踪覆盖不全即停止报告，不另找替代路径。通过准入才实现并沿用 131 次对照、故意漏读用例，另加故意遗漏变化节点的反例，再测三档各五次空闲分布；全量、负载轮与 build 仍须负责人放行，DeepSeek 和生产上限均不动。负责人另指出本轮窗格的 fast／priority 不是项目设置，稍后由其切回 default，本票不改项目配置。

构思主控批准 A（2026-10-17，取代跟踪方案）：完整读取次数与内容均不变，并行强制状态与读取。每路使用 `Target.createBrowserContext` 独立上下文，先以 Target 信息或 renderer 进程证明隔离。路数按每侧分别计算：2／3／4 路对应源与候选合计 4／6／8 个 renderer，不能按整次合计。三视口每种各五次，同时记录一次提交检查的 Chrome 进程组 RSS 峰值相对串行的增量；负责人进一步明确，峰值增量达到 300 MiB 就停在该档，不再增加路数，带数据报告。等价性沿用 131 次结论／拒因对照、完整属性与故意漏读反例，并证明各路初始快照与串行基线逐项一致、焦点与 hover 不互扰、任一路失败或超时整次拒收。所有页面与上下文在正常、失败、超时均须关闭；五秒／十五秒及超时拒收不变。先完成空闲选择，再回报 READY_FOR_HEAVY 等负责人放行负载全量；负载三档不能稳定低于五秒即停报。DeepSeek 不调用，全量和 build 均须放行。

负责人最终决定（2026-10-17，由构思主控转达，取代 A 及固定上限）：动态检查按完整读取次数给预算。每档上限为 1000ms＋150ms×实际完整读取次数，次数是源、候选两侧各自「一次基线＋可聚焦元素数×四态」之和；须在任何完整读取之前按本次实际元素算好并记录，读取中不追加。三档动态检查总耗时封顶 60000ms，超时、无法聚焦、无法强制状态仍明确拒收。禾巷小馆两侧各 41 次，共 82 次，每档 13300ms。撤掉全部独立 BrowserContext、浏览器级连接、分片并行及无稳定提速的批量读取试验，生产只保留预算改动；测量工具、夹具、完整属性等价用例与失败证据可保留。先在父版本取得新成对测试红灯，再实现并跑定向、runner 回归、typecheck；回报 READY_FOR_HEAVY 后等负责人放行全量、同时一轮全量的负载五次分布及 build。负载三档都须通过，审查由负责人另派新的 sol 实例，不调用 DeepSeek。在 421a148 之后新建提交，不 amend。

## What to build

1. 撤掉全部并行与无稳定收益的读取试验，生产只保留按实际完整读取次数计算预算的改动；完整属性、元素、状态、视口及拒因语义不减。
2. 任何完整读取前完成两侧元素发现，记录每侧及合计读取次数、计算预算与三档剩余额度；冻结同一份元素列表用于执行，不在读取途中追加。
3. 每档上限 1000ms＋150ms×源候选合计完整读取次数；每页三档动态检查总耗时封顶 60000ms。无作者动态规则的静态分支仍免强制状态，只计两次完整基线。超时、无法聚焦或无法强制状态照旧拒收。
4. 先完成定向、runner 回归、typecheck，回报 READY_FOR_HEAVY；负责人放行后执行全量、同时全量的负载五次分布和 build。负载三档每次均须在生产预算内通过。

## Acceptance

- [x] 全部独立上下文、浏览器级连接、分片并行与无稳定提速试验退出生产；原完整读取器保留
- [x] 预算成对测试先在父版本失败，覆盖两侧不同元素数、读取前记录且中途不变、每档和六十秒边界、超时与聚焦／强制失败拒收
- [x] T-164/T-173 坏例与正常对照结论不变，131 次检查结论／拒因逐项一致，完整属性用例及故意漏读反例有效
- [x] 定向、runner 回归、typecheck 通过
- [ ] 一轮全量通过
- [ ] 同时全量时禾巷小馆三档各五次，均在生产预算内通过，分布与读取计划已记录
- [ ] build 通过；负责人另派独立 sol 审查通过

## Resolution

状态：**INCOMPLETE／READY_FOR_HEAVY**。当前按负责人最终决定实现读取次数预算，旧并行候选全部撤掉。定向、等价性、runner 回归、typecheck 和计时入口验证均通过；全量、负载轮、build 和独立审查未执行，等待负责人放行。保持 open、claimed_by=Codex。本次在 `421a148` 之后新建提交，不 amend、不推送。

### 生产改动

- `code-site-browser.ts` 完整恢复为 `87e6805`／`c4a72e5` 的实现，不保留独立 BrowserContext、浏览器级发送、renderer 路数或为并行添加的生命周期代码。删除并行计时脚本及三份并行专用测试；已弃候选仍在 `421a148` 历史中，所有失败、profile 和 RSS 证据留在 artifacts/t178。
- `code-site-local-edit.ts` 保留原完整样式读取、基线重复条目省略、四态与祖先传播，只把既有元素发现阶段与读取阶段分开。提交入口先完成源、候选各自的发现，得到实际待执行的完整读取数，再记录计划、执行同一份元素列表；两侧仍沿用原来各一只 Chrome 的并行关系，不增加同侧分片。
- 每档计算 `1000 + 150 × (sourceReads + candidateReads)`，实际允许时间取该值与本页三档剩余额度的较小值。分类、发现、候选 Chrome 启动、探针和比较均从该档开始计时；三档只累计动态检查时间，不计两档之间其他底线扫描。现有内部超时注入参数只能收紧预算，Infinity 不能绕过生产预算或六十秒封顶。
- 计划在第一份完整读取前以 dynamic-plan 诊断记录，成功检查同时存入 dynamicState.budget；记录 sourceReads、candidateReads、fullReads、calculatedMs、allowedMs、pageRemainingMs。无作者动态规则分支沿用不枚举、不强制的原合同，每侧实际只读一次基线，合计两次、计算预算 1300ms。
- 未保留任何声称提速的批量读取候选。标准属性与实时自定义属性、五类伪元素、全部可聚焦元素及三视口读取内容不变。AGENTS「局部修改」、spec、CONTEXT 和 mainline 的固定上限已直接替换为新规则。

### 新合同与反例

2026-10-17 UTC，通过标准 npm test 入口，在父版本 `421a148` 先取得 **7／7 预期红灯**：任何完整读取之前缺少两侧读取次数及预算记录，见 `artifacts/t178/read-budget-parent-valid-red.log`。最初夹具锚点文字错误的失败保留在 `read-budget-parent-421a148-red.log`，修正后才确认真实红灯；不将夹具错误算回归证据。

实现后预算测试首轮 **7／7 通过**（`read-budget-first-green.log`）。预期独立来自负责人公式及手写 DOM：

| 源／候选可聚焦数 | 源／候选完整读取数 | 合计 | 计算上限 ms |
| --- | --- | ---: | ---: |
| 0／0 | 1／1 | 2 | 1300 |
| 1／2 | 5／9 | 14 | 3100 |
| 3／1 | 13／5 | 18 | 3700 |
| 1／1 | 5／5 | 10 | 2500 |
| 50／50 | 201／201 | 402 | 61300，首档被总额限制为 60000 |

新测试从真实生产 checkSiteCode 进入，实际 Chrome 发现与读取上述 DOM。只替换 Node 时钟推进来模拟耗时，不更改生产超时比较条件：每档恰好预算边界通过，超出一毫秒拒收；大计数组按 20000ms／20000ms／20000ms 推进恰好六十秒通过，最后一档 20001ms 则拒收，三档计划上限依次 60000／40000／20000ms。逐次读取核对已公布计划的活引用与初始快照，并核对实际执行次数。DOM.focus 和 CSS.forcePseudoState 的定向故障均成对保留正常对照、明确拒收；不调用真实模型。

三项故意损坏均被检出，恢复源文件后再做正常对照，原始日志保留：

- 去掉剩余总额限制：61300ms 未被压到 60000ms，`read-budget-mutant-cap.log` 拒绝。
- 记录后把 fullReads 加一：第一份读取前即以「计划不能增加或改变」失败，`read-budget-mutant-growing-count.log`。
- 原读取器故意漏掉 color：完整属性原生 oracle 在基线即检出集合／值不一致，`read-budget-mutant-full-style.log`。不是用实现输出更新期望。

汇总 `read-budget-mutants.json`；三项退出码均为 1，故障修改均已恢复。

### 等价性与已有验证

- 现有 `t164-dynamic-gate`、`t164-multi-block-edit`、`t164-review-seven`、`t173-repair-scope` 与 `t178-full-style-equivalence` 共 **86／86 通过**，见 `read-budget-equivalence.log`。为了在独立空闲定向条件下对照，测试文件串行执行，生产探针没有增加并行实现。
- 沿用同一组输入，原始串行父实现与本次 131 次实际检查的 passed、issues、error 逐项相同，仅沿用记录器对随机站点／版本 ID 的归一；未做哈希、字节或像素比较。32／25／28／46 次对照均无差异，报告 `read-budget-equivalence-comparison.json` 指向每组原始目录。覆盖 :has(:focus)、兄弟组合器、祖先 hover／active、伪元素、自定义属性、媒体查询及正常对照。
- `npm run typecheck` 通过，见 `read-budget-typecheck.log`。初轮新测试回调返回值类型不符的日志为 `read-budget-typecheck-first.log`，已收窄为 void；不是生产类型问题。
- 中断恢复时已核对 git status、所有故障注入回滚位置及现有证据，没有重跑已通过的 86 项。恢复故障后的最终预算／完整属性正常对照 **8／8 通过**（read-budget-final-targeted.log），runner 回归 **4／4 通过**（read-budget-runner-regressions.log），无 Chrome 遗留。
- 更新后的标准计时入口 **1／1 通过**（read-budget-timing-entry.log）。禾巷小馆 v2／v3 只读夹具完整结束三档：375 为 10849.10ms，768 为 7306.59ms，1440 为 7276.26ms；每档均在读取前记录源 41＋候选 41＝82 次、计算预算 13300ms，每侧三档实际各 123 次完整读取，无范围外拒因。三档开始时剩余总额分别为 60000／49150／41844ms。原始为 standard-production-budget-1792258496947-63116/timings.json；这是一次计时工具和预算验证，不是五次分布或负载通过证明。

### 重现与待放行

定向和回归命令（均从本工作树根执行）：

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t178-read-budget.test.ts tests/t178-full-style-equivalence.test.ts
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- --test-concurrency=1 --import ./scripts/t178-capture-checks.ts tests/t164-dynamic-gate.test.ts tests/t164-multi-block-edit.test.ts tests/t164-review-seven.test.ts tests/t173-repair-scope.test.ts tests/t178-full-style-equivalence.test.ts
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- scripts/t178-timing-entry.test.ts
node --test --experimental-strip-types scripts/t167-runner-regressions.ts
npm run typecheck
```

测量脚本已改为直接使用生产读取预算，不再传固定五秒或取消截止。后续负载命令为 `CHROME_PATH=同上 node --experimental-strip-types scripts/t178-dynamic-timing.ts load artifacts/t178/<新负载目录>`，默认五轮，每轮真实检查三档，并核对每档 82 次读取、计算预算 13300ms及实际执行数；不覆盖旧证据目录。

负责人放行后才执行：一轮全量；另一轮全量与上述五次负载测量同时运行；build。每次重任务之前先核对 memory_pressure 与 ps，空闲低于 25% 即停止报告。当前不据未执行的重任务宣布 PASS，票保持打开。本次运行时间：父版预期红灯 2026-10-17 17:25 UTC，首次绿灯 17:27 UTC，86 项定向结束 17:30 UTC，故障注入结束 17:31 UTC，最终预算对照结束 17:33 UTC，runner 回归结束 17:34 UTC，计时入口结束 17:35 UTC（以各标准入口 report.json／原始日志为准）。执行对应 421a148 上的本次预算改动，随本次新提交固定；最终本地提交 SHA 与命令时间另存 artifacts/t178/read-budget-checkpoint.json；tsconfig 自动变更不提交，独立 sol 审查由负责人另派。

### 已弃试验的证据保留

此前所有 profile、基准、未截断分布、跟踪漏报和并行 RSS 失败文件均原样留在 artifacts/t178。特别保留 `track-capability-drained-20261017/` 的 flex 漏报、`read-profile-20261017/` 与 Node CPU profile、`parallel-two-rss-20261017/` 的 314.52 MiB 增量停止记录。其详细历史 Resolution 位于 `87e6805` 与 `421a148`；这些证据不作为当前预算方案的提速或负载通过证明。
