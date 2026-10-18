---
id: T-175
title: 补充新事实后提示其他页面同项的「待补充」
type: build
status: open
blocked_by: []
claimed_by: Codex
supersedes:
---

## Why

负责人 2026-10-17 决定开票。T-173 盲评发现：用户在首页批注里补了「外带包装费每单2元」，修改版正确去掉首页的「待补充」，但菜单页「米饭与收费」仍写「外带包装费待补充」。批注只改首页，不算越界，可两页信息不一致，用户自己很难发现。

## What to build

1. 版本存成后，如果本次用户消息带来新的出处原句（合同 D 的「你的第 N 条消息」），用确定性规则在**其他页面和本页范围外**查找含「待补充」的文字，且其前面紧邻的事项名（如「外带包装费」）逐字出现在本次新原句里，才算同项。不调用模型做匹配，不猜近义词。
2. 命中时在工作台对话里给一条提示：列出页面名和原文片段（如「菜单页还写着『外带包装费待补充』」），附「一起更新」按钮。按钮只把这些位置作为批注草稿加入（沿用 T-163 草稿与 T-164 多区块入口），由用户确认发送；不自动改站，不新建版本。
3. 没命中不提示；同一版本同一位置只提示一次，刷新后从版本记录恢复，不重复弹。
4. 同步 `spec.md`、`CONTEXT.md`（术语「同项待补充提示」）。

## Acceptance

- [x] 先列失效方式再写测试，测试先在父版本失败：事项名不逐字出现时不提示；本次修改范围内的「待补充」不重复提示；跨页命中；刷新不重复；按钮只加草稿不存版本
- [x] 用 `3e52f683`（禾巷小馆（批注验收））的 v2 只读副本，以本地替身重放首页包装费批注，工作台出现菜单页提示；1440/768/375 截图逐张看过
- [ ] 不调用 DeepSeek；typecheck、test、build 通过；独立 sol 审查通过

## 失效方式与验收边界

实施前列出（2026-10-17，父版本 d7e0aa2）：
- 旧消息、上传、原始资料、未通过核对或没有出处原句的请求误触发；本次新增消息未被采用为出处却触发。
- 用近义词、子事项、跨标点/换行/元素拼接匹配，或空事项名、单字符事项名误匹配；遗漏同一节点的多个占位。
- 本次单区块、多区块并集或整页范围内重复提示；跨页、本页范围外漏报。
- 同一位置被多条出处重复登记；刷新重新生成提示、增加版本或丢失提示；旧版本锚点被当作当前位置。
- 「一起更新」直接发送、调用模型、存版本，或覆盖已有/发送中的草稿；重复点击、刷新重复添加草稿。
- 草稿目标不是原区块/文字快照，意见缺少采用的原句，无法沿用单条及多条批注入口。

切分规则：每个 DOM 文本节点独立扫描；「待补充」前向左遇 Unicode 标点、换行或节点边界即止，首尾空白去除；事项名不足两个 Unicode 字符不匹配。不规范化、不猜同义词，完整事项名必须逐字出现在本次新增消息的已通过出处原句里。只扫描可沿现有批注合同定位的 main 正文区块。

## Resolution

执行状态：BLOCKED（内存门禁，整票验收未完成）。新入口已提交为 `ce80733d837b02679c0fd5f192be8cf304d890bb`，runner 5／5、typecheck、T-175 定向 18／18 均通过；第一轮全量的启动前检查在 2026-10-18 01:27:25 UTC 记录空闲内存 24%，低于负责人规定的 25%，因此没有启动 npm test，第二轮及 build 也未运行。按门禁停止，不等待后重试。固定三文件末尾串行、单轮每文件一次、两阶段原生统计合并已实现；产品预算及既有判断条件未改。两轮 823 项全过的稳定性与 build 仍未验证，不能拿旧入口的一轮成功代替。`blocked_by: []`、`claimed_by: Codex` 保持，独立 fast 审查由负责人另派，票保持 open。

### 构思主控决定：重浏览器文件移到末尾串行阶段（2026-10-17）

在 `8603913` 之上只修改测试入口的文件调度与对应回归、规则文档。固定名单按下面两轮实测选择，文件从并行阶段移出，末尾串行阶段每个文件只执行一次，不能先并行再补跑；不修改测试断言、不跳过用例、不改产品读取预算。两阶段仍共用本轮工作树锁、服务与临时数据根；仍按 Node 原生每文件 summary 合并实际执行数，成功全量总数须保持 823，零实际用例或任一阶段失败均令整轮失败。

#### `8603913` 两轮结果与失败诊断

两轮均执行规定 CHROME_PATH 下的 `npm test`，源码无改动。第一轮 01:04:50–01:10:09 UTC，空闲 51%，318.824 秒，118 文件、823 项全部通过；第二轮 01:10:18–01:16:03 UTC，空闲 44%，344.393 秒，118 文件、823 项中 822 通过／1 失败，取消、跳过与 todo 均为 0。报告分别为 [第一轮](../../artifacts/t175/placement-20261018T005958Z/full-1/test-run-1792285490512-57146/report.json)、[第二轮](../../artifacts/t175/placement-20261018T005958Z/full-2/test-run-1792285819143-71966/report.json)，同目录有完整日志、summary 与 checks 副本。第二轮失败后未 build、未重跑。新增三档浮层成对用例两轮都通过；失败为既有 T-175 餐馆 1440 工作台场景的存版动态检查，不是按钮遮挡。

只读诊断汇总：[failure-diagnosis.json](../../artifacts/t175/placement-20261018T005958Z/failure-diagnosis.json)。失败发生于 01:15:04.455–01:15:17.762 UTC 的 home／375 检查档：源 41 次、候选 41 次、合计 82 次完整读取计划，计算预算与实际准入均为 13300ms，整档已用 13306.744ms。本档入口的 `pageRemainingMs`（对应 remainingDynamicMs）为 60000ms；失败后的 remainingDynamicMs 没有单独记录，768／1440 后档未执行，不能把推算余额写成实际记录。

分类耗时 78.568ms；两侧探针均 completed=true，各有 10 个可聚焦元素、76 次强制调用、215 次 CDP 往返。源探针 8859.198ms（focus 20.225、force 693.008、styleRead 6004.424ms），候选 8663.349ms（focus 35.212、force 679.869、styleRead 6329.032ms）。最后一侧探针在 01:15:14.161 留下完成记录，距整档超时约 3601ms；compareMs=0，没有已完成比较的耗时证据。现有诊断没有单独计时探针返回、浏览器退出等待或主线程调度，不能把这段空档唯一归为分类、强制状态、样式读取或比较，也不能仅凭 compareMs=0 断言比较从未开始。可确认的边界是「两侧探针完成记录之后，整档完成之前超时」，不是两侧样式读取仍未完成。原始 [整档记录](../../artifacts/t175/placement-20261018T005958Z/full-2/test-run-1792285819143-71966/checks/81211-df588a3f-c596-4bf6-acce-5a1ad79833c5.json)、[源探针](../../artifacts/t175/placement-20261018T005958Z/full-2/test-run-1792285819143-71966/checks/81211-725eeaa9-96f5-4f23-8fd6-6cfcbdda3a1f.json)、[候选探针](../../artifacts/t175/placement-20261018T005958Z/full-2/test-run-1792285819143-71966/checks/81211-4ae6fbe9-f021-4b62-826d-d66a89bb9c9d.json) 均保留。

第一轮同一个 1440 工作台场景的对照（每档均源 41＋候选 41 次，计算与准入预算均为 13300ms，三档均完成）：

| 检查宽度 | 实际耗时 ms | 本档入口 remainingDynamicMs／pageRemainingMs |
| --- | ---: | ---: |
| 375 | 5465.371 | 60000 |
| 768 | 5177.255 | 54534 |
| 1440 | 5566.344 | 49357 |

失败窗口与另外 2 个 Node 测试进程的 15 条 Chrome 生命周期相交：pid 81116 的 `t174-local-function.test.ts` 有 9 条，pid 82815 的 `t178-read-budget.test.ts` 有 6 条；后者六条贯穿整个窗口。窗口内同时存在的其他测试进程峰值为 2、其他 Chrome 峰值为 8，15 是累计相交生命周期数，不是同时存在数。按同轮 browser 诊断区间相交计算，不包含未登记的外部进程及普通 Chrome；不据此声称并发是唯一根因。[原始 timings 副本](../../artifacts/t175/placement-20261018T005958Z/full-2/t175-timings.json) 在窗口内有 5 个一分钟 load average 样本：01:15:05.018 为 26.434、06.875／08.810／10.795 为 25.999、12.874 为 25.038；下一条样本 17.921 为 33.042，已在超时结束后约 159ms。load 不是 CPU 百分比，也不是连续采样；采样时刻按 startedAt＋durationMs 回读，不能把结束时取到的 load 记在操作开始时。

#### 固定名单及挑选依据

数据来自上面两轮各文件的原生 summary；单档耗时来自对应文件 pid 的 dynamic-check 诊断。以下为秒，故障注入的预期拒收不当作文件失败：

| 文件 | 第一轮整文件 | 第二轮整文件 | 单档最长：第一／第二轮 | 选择 |
| --- | ---: | ---: | ---: | --- |
| t175-stale-placeholder.test.ts | 140.471 | 142.054 | 5.566／13.307（超时） | 串行：整文件最长，且餐馆九档完整状态读取是本轮失败点 |
| t174-local-function.test.ts | 130.565 | 141.742 | 0.230／1.412 | 串行：整文件第二长，每轮 196 条 Chrome 生命周期，实际与失败窗口重叠 |
| t178-read-budget.test.ts | 62.576 | 81.839 | 4.342／10.252 | 串行：含真实负载对照，六个 Chrome 覆盖失败窗口，完整状态检查次重 |
| t163-area-drafts.test.ts | 118.372 | 123.802 | 0.391／0.494 | 保留并行：耗时较长，但单档为短静态检查，未与本次失败窗口重叠 |
| t169-citations-browser.test.ts | 122.840 | 116.495 | 0.272／0.293 | 保留并行：同上，末尾串行会等待它完整结束 |
| t173-fact-boundary.test.ts | 119.859 | 110.451 | 0.546／0.503 | 保留并行：同上 |
| t173-citation-repair.test.ts | 117.497 | 111.482 | 0.699／2.460 | 保留并行：同上 |

先只移动「整文件耗时前二＋实测六 Chrome 动态负载」三项，不重排全部浏览器测试。固定名单直接写在 `scripts/run-tests.ts`，并行阶段预期 746 项、串行阶段 77 项，合计仍为 823。新入口回归先在 `8603913` 生产入口上失败：观察真实 Node spawn 的文件参数及串行并发参数、每个夹具文件实际载入次数、两阶段合并统计，并注入串行失败确认整轮失败；不以入口自身输出的固定期望值代替这些行为观察。后续结果留在本节。

#### 新入口实现与冻结前检查（2026-10-18 UTC）

入口将选中的文件先去重、再分为并行与末尾串行两组，只从串行组传入 `--test-concurrency=1`；显式定向文件使用同一分组逻辑。两个子进程顺序完成，共用本轮服务、身份许可、数据根与独占锁，各自输出原生 summary，并原样合并为 summaries.ndjson；执行数仍按原公式计算，任一阶段非零结果保留到整轮，不被后面的成功覆盖。AGENTS 的标准命令、spec 与 README 只同步当前规则，名单与实测依据留在本票和入口中；产品预算及所有既有测试判断条件未改。

- 01:22:41–01:22:42，开跑前空闲 46%，在 `8603913` 的旧入口上执行 `node --test --experimental-strip-types --test-name-pattern=^T-175: scripts/t167-runner-regressions.ts`，新增用例按预期失败：只观察到 1 次包含所有夹具文件的真实 Node spawn，要求为并行、串行两阶段。Next 仅替换为隔离项目的 health 服务，入口、Node 执行及统计均为真实路径；捕获器只观察 spawn，不替换执行。[红测日志](../../artifacts/t175/serial-stage-20261018T012230Z/runner-red/command.log)、[实际启动参数与执行记录](../../artifacts/t175/entry-regression-pass-83dd2c04-c0c5-4600-a9ca-2d936bf5bade/observation.json)。
- 01:23:16–01:23:24，空闲 47%，新入口上运行完整 `node --test --experimental-strip-types scripts/t167-runner-regressions.ts`，5／5 通过，退出 0。[日志](../../artifacts/t175/serial-stage-20261018T012230Z/runner/command.log)。新用例的三组独立夹具分别观察到：[正常两阶段合计 5 项](../../artifacts/t175/entry-regression-pass-c50443ed-e063-4e2a-94e1-eef7695ac33c/observation.json)；[只匹配串行且输入有重复文件时合计 3 项](../../artifacts/t175/entry-regression-filtered-e30657cd-1493-4e1b-a70e-999a7900253e/observation.json)，并行 0 项不误拒整个有效轮；[串行故意失败](../../artifacts/t175/entry-regression-serial-failure-c38c10f0-99a6-411e-9cdb-e85e435edaa3/observation.json) 时仍实际执行全部 5 项，整轮非零且 INCOMPLETE。各文件都只载入一次，原始 report 与分阶段 summary 均复制到这些本票目录。预期故障注入不算本轮 runner 失败。
- 01:23:50–01:23:51，空闲 42%，`npm run typecheck` 通过，退出 0。[回执](../../artifacts/t175/serial-stage-20261018T012230Z/typecheck/receipt.json)。
- 01:24:19–01:25:53，空闲 48%，规定 CHROME_PATH 下执行 `npm test -- tests/t175-thread-placement.test.ts tests/t175-stale-placeholder.test.ts`，实际并行阶段 3 项、串行阶段 15 项，合计 18／18 通过，取消／跳过／todo 均为 0，退出 0。[标准报告](../../artifacts/t175/serial-stage-20261018T012230Z/directed/test-run-1792286659498-89494/report.json)、[完整日志](../../artifacts/t175/serial-stage-20261018T012230Z/directed/command.log)。

每项开始前均保存 memory_pressure 和 ps，日志、回执及标准报告副本均在 [本次入口证据目录](../../artifacts/t175/serial-stage-20261018T012230Z/)。本次只修改入口、增加一个独立 runner 回归和同步规则；本票此前的浮层修复及产品代码不再修改。以下两轮全量和 build 固定在包含本节的同一新提交，SHA 随冻结记录保存；任一重任务失败即停止，不补跑、不重试。

#### 冻结后内存门禁停止

候选冻结为 `ce80733d837b02679c0fd5f192be8cf304d890bb`，未 amend，源码无后续修改。01:27:25.793 UTC，在计划执行规定 CHROME_PATH 下 `npm test` 的第一轮之前运行 `memory_pressure` 与 ps，空闲为 24%，门禁返回 25 并拒绝启动命令。这里的非零是启动前门禁，不是 npm test 的执行结果；没有本轮全量的 Node summary、临时数据根或标准报告，不把未执行写成失败或通过。[门禁回执](../../artifacts/t175/serial-stage-20261018T012230Z/full-1/receipt.json)、[内存原文](../../artifacts/t175/serial-stage-20261018T012230Z/full-1/memory.txt)、[进程快照](../../artifacts/t175/serial-stage-20261018T012230Z/full-1/processes.txt) 均保留。

依负责人「空闲低于 25% 即停」要求，本次没有等待或再次测量后重试，没有启动第二轮、build 或其他测试，也没有调整并发名单、用例、产品预算或系统环境来绕过门禁。现有红绿、旧入口第二轮 13,306.7ms／13,300ms 的反例、同窗 Chrome 重叠和 load 诊断全部保留在本票 artifacts；本次以新的结果提交记录停止点，不推送，tsconfig 自动改动仍不提交。后续仍需在冻结候选上完成新入口的两轮全量与 build，再交负责人安排独立 fast 审查。

### 构思主控决定：本票修复 T-162 遗留浮层遮挡（2026-10-17）

只修改工作台 `.code-annotation-composer` 的定位逻辑，同时避开历史回看栏和返回当前版本按钮。375／768／1440 均须通过真实中心命中及点击验证；对照检查浮层完整位于视口内、可输入、不会盖住被批注目标。先在 `e1af12b` 运行新断言得到缺陷特定失败，再修复并运行原断言，不重试或放宽条件。失效方式：仅把按钮露出却遮住同栏其他内容；把浮层推出视口；把浮层移到目标上；让意见框失去真实指针或输入；滚动后旧位置未更新；手机原有留白与线程收起／展开失效。复用既有工作台材料、颜色与控件，主行动仍是查看线程、返回当前版；不添加装饰或新动效。

本次候选只改 `CodePreviewSelection` 的现有定位 effect：手机沿用已测量留白的底部面板；768／1440 以预览工具区底边作为上界约束，上下都放不下且目标可见时，滚动 iframe 的预览视口，必要时滚动工作台 stage，为目标下方腾出位置。目标已离屏时不重新拉回，保持输入连续。没有修改生成站 HTML/CSS、提交入口、测试 helper 或既有测试条件；spec 已同步。

2026-10-18 UTC 的本次红绿证据均在 [本次证据目录](../../artifacts/t175/placement-20261018T005958Z/)，每项各有 `receipt.json`（命令、时间、SHA、内存）、`command.log`、`memory.txt` 与 `processes.txt`，标准报告及完整诊断已复制到各项目录，不依赖 t167 的成功轮保留窗口：

| 项目 | UTC 时间 | 开跑前空闲 | 结果与证据 |
| --- | --- | --- | --- |
| 新测试初轮夹具 | 01:00:00–01:00:06 | 41% | 3 项均在初版提交被「资料没有的数字：2」拒绝；漏带原批注补充来源，未进入 UI，不算遮挡红证据。[原轮报告](../../artifacts/t175/placement-20261018T005958Z/red/test-run-1792285201201-51309/report.json) 保留。依负责人补充规则，修正自写夹具属于正常迭代，不单独提交检查点。 |
| 父版真实红测 | 01:01:18–01:01:40 | 50% | 生产代码仍为 `e1af12b`，`npm test -- tests/t175-thread-placement.test.ts`：375、1440 成对检查通过；768 按返回按钮中心被浮层内 STRONG 遮挡而失败，2 通过／1 失败，退出 1。[报告](../../artifacts/t175/placement-20261018T005958Z/red-contract/test-run-1792285278716-52833/report.json)，六张三档原图在 `red-contract/ui/`，均已打开查看；没有人为制造其余档失败。 |
| 修复后定向 | 01:01:55–01:03:05 | 49% | `npm test -- tests/t175-thread-placement.test.ts tests/t175-stale-placeholder.test.ts`，18／18 通过，取消／跳过／todo 为 0，退出 0。[报告](../../artifacts/t175/placement-20261018T005958Z/directed/test-run-1792285315343-53394/report.json)。原先餐馆 768 失败路径完成；新增三档实际中心命中、原生点击返回、视口边界、与整个历史栏及可见目标不相交、真实意见输入均通过。 |
| T-162 回归 | 01:03:07–01:04:02 | 47% | `npm test -- tests/t162-mobile-reveal.test.ts tests/t162-scroll-edge.test.ts tests/t162-review-regressions.test.ts`，9／9 通过，取消／跳过／todo 为 0，退出 0。[报告](../../artifacts/t175/placement-20261018T005958Z/regression/test-run-1792285387990-55341/report.json)。 |
| runner 回归 | 01:04:05–01:04:10 | 47% | `node --test --experimental-strip-types scripts/t167-runner-regressions.ts`，4／4 通过，退出 0。[日志](../../artifacts/t175/placement-20261018T005958Z/runner/command.log)。内部预期失败场景报告保留，不误作实际执行失败。 |
| typecheck | 01:04:17–01:04:19 | 48% | `npm run typecheck`，退出 0。[回执](../../artifacts/t175/placement-20261018T005958Z/typecheck/receipt.json)。 |

上表 npm test 命令均仅设置规定的 CHROME_PATH，开跑前未见其他测试 headless Chrome。真实红测和修复后使用同一份新增断言；只有新夹具补回已提供的原批注来源，没有改既有断言。修复后六张三档线程／输入截图及 T-175 原有十张提示、草稿、空标题与无法加入的截图均逐张打开查看；图中有已载入内容，不以空白或载入态充数。375 的原有菜单草稿图只证明意见与部分选区；新增餐馆成对场景另检查完整可见目标与浮层不相交。接下来冻结本候选为新提交，在同一 SHA 上串行执行两轮全量，最后 build；源码不再改动，独立 fast 审查由负责人另派。

### 恢复验收与主线合并（2026-10-18 UTC / 2026-10-17 EDT）

- 从 `9e95ea5` 以 `git merge --no-ff --no-commit e92b87b` 合入 `family-kit-assembly`，新建 merge 提交，不 rebase。唯一文本冲突在本票头部：主线的空 `claimed_by` 与本分支的 `Codex` 冲突，保留 `Codex`；T-178 已关闭，依负责人要求清空阻塞列表。完整保留本票的功能合同、验收与原失败证据。
- AGENTS.md、CONTEXT.md、mainline.md、spec.md 与 `lib/code-site.ts` 自动合并后逐段核对：主线的 T-176 保留策略、T-178 按完整读取次数计算的预算及 60 秒总额、开 fast 规则保留；本分支同项待补充提示、原句定位和草稿校验规则也保留。不恢复已撤回的文件并发限制，不修改测试条件。
- 既有 `tsconfig.json` 的 Next 自动改动保留且不提交；不推送、不 amend、不调用 DeepSeek、不读取 `.env.local`、不用 rm，不写主工作区 `.sitecraft-data`。本次工作树没有 `.env.local`，仅核对是否存在，未读取其内容。

### 本次定向失败与根因取证

- 固定在上述 merge 提交，仅设置 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell`，执行 `npm test -- tests/t175-stale-placeholder.test.ts`。2026-10-18 00:52:48–00:54:02 UTC，耗时 74.859 秒，15 项中 14 通过、1 失败，取消、跳过、todo 均为 0，退出 1。开跑前 `memory_pressure` 空闲 57%，`ps` 未见其他测试 headless Chrome；常驻普通 Chrome 和主线 3034 dev 服务保留。完整证据：[执行回执](../../artifacts/t175/resume-20261018T005246Z/directed/receipt.json)、[日志](../../artifacts/t175/resume-20261018T005246Z/directed/command.log)、[标准报告](../../artifacts/t175/resume-20261018T005246Z/directed/test-run-1792284768584-44789/report.json)、[每文件统计](../../artifacts/t175/resume-20261018T005246Z/directed/test-run-1792284768584-44789/summaries.ndjson)；同目录保留内存、进程、dev 日志与完整 checks 副本。
- 三个餐馆场景的生产 chat 均完成 v3 存版；九档动态检查全部完成，每档源／候选各 41 次完整读取、合计 82 次，预算均为 13300ms，实际为 2231.4–2615.9ms，没有动态检查超时。详见 [动态检查汇总](../../artifacts/t175/resume-20261018T005246Z/directed/t175-dynamic-summary.json) 及 `artifacts/t175/run-1792284770188-44801/state-{1440,768,375}.json`。失败发生在后续真实 UI 操作：`tests/t175-stale-placeholder.test.ts:279` 调用原 helper 的 `.click('.code-preview-version button')`，中心命中检查返回 false；768 后续的添加草稿及刷新恢复未执行，不计为通过。
- 用例归属：餐馆三档用例由 T-175 的 `95317ea` 新增，主线 `e92b87b` 没有 `tests/t175-stale-placeholder.test.ts`。原失败轮没有点击失败瞬间截图或命中元素记录，只有此前的提示截图，不能用此前截图解释失败。负责人要求取证后，临时在原 helper 的同一命中检查中附加 JSON 与截图，仍以原来的 `hit===el||el.contains(hit)` 断言判定，不重试、不调用 DOM click、不更换按钮、不改产品代码。
- 一次取证命令为同一 `CHROME_PATH` 下 `npm test -- --test-name-pattern=禾巷小馆.*768 tests/t175-stale-placeholder.test.ts`，00:55:26–00:55:40 UTC，空闲 50%，开跑前再次记录 ps；执行 1 项、失败 1 项、退出 1，仍是同一中心命中断言。见 [取证回执](../../artifacts/t175/resume-20261018T005246Z/probe/receipt.json)、[取证日志](../../artifacts/t175/resume-20261018T005246Z/probe/command.log)、[标准报告](../../artifacts/t175/resume-20261018T005246Z/probe/test-run-1792284926664-47040/report.json)。这是保留失败的诊断，不替代原轮结果。
- 实际命中：按钮矩形为 x=120.15625、y=154、宽 94、高 36；其中心 `(167.15625, 172)` 命中 `section.code-annotation-composer`，面板矩形为 x=25、y=162.015625、宽 320、高 232。按钮中心仍位于实际按钮内部，同时落入面板，未记录到运行中的动画；当前为 pane-preview，T-175 提示数量为 0。见 [elementFromPoint 原始记录](../../artifacts/t175/resume-20261018T005246Z/probe/browser-evidence/return-current-hit-1792284939929.json) 与已打开查看的 [失败瞬间截图](../../artifacts/t175/resume-20261018T005246Z/probe/browser-evidence/return-current-failure-1792284939985.png)。遮挡者是原有批注线程面板；T-175 的「同项待补充提示」与「一起更新」当时均不在 DOM 中。
- 根因与主线对照：`CodePreviewSelection` 在区块下方放不下面板时选择上方，只将位置限制在整个视口的 8px 边界内；固定面板使用 z-index:40，未将 `.site-page-chrome` 与 `.code-preview-version` 所在的预览工具区排除，因此可盖住历史返回按钮。`git diff e92b87b HEAD -- components/code-preview-selection.tsx app/globals.css tests/helpers/t162-browser.ts` 为空；工作台的 revealAnnotation、历史按钮及其父布局也沿用主线。按代码判断，移除 T-175 后同样的区块、面板内容和视口仍存在该遮挡路径；未实际运行父版浏览器对照，不能写成父版实测失败。依负责人第 4 条，作为与 T-175 无关的原有布局缺陷回报，不在本次修改它，也不改变测试判断条件。临时取证代码已完整撤回，helper 对 HEAD 的文本 diff 为空。
- 本轮生成的 9 张原始截图及取证失败截图均逐张打开查看。三档提示可见；1440/375 餐馆草稿截图可见意见，375 只证明意见框及部分选区；768 因失败没有草稿截图。空白标题三档及无法加入草稿的截图保留，不宣称整轮 UI 验收通过。原始失败数据根 `/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-test-2l2VUL` 与取证数据根 `/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-test-SwF4Yp` 均保留；原轮和取证服务、测试 Chrome 已退出。没有运行 runner、typecheck、全量或 build，没有重跑原完整定向。
- 本节引用的两轮标准报告、统计、日志、checks 及取证截图／命中记录均已复制到 `artifacts/t175/resume-20261018T005246Z/`。既有两份失败报告及检查目录也复制到 `artifacts/t175/reports/`；旧成功轮 `test-run-1792242973606-12932` 已被保留策略清理，明确记为缺失，只保留原日志，不作为本次证据。结果以本节所在的新本地提交记录，不 amend；提交 SHA 随交付回报。

### 独立审查两项 P1 修复（2026-10-17）

本节证据对应包含本节的本地修复提交，父版本为 `36d755c8d9b865cf072700ad20dc9c586f257ecb`；提交 SHA 随交付回报，并登记于 `artifacts/t175/p1-review-fixes-20261017T173134Z/evidence-index.json`。以下日志均在该目录；完整命令、UTC 起止时间和退出码另保存在同名 `*-command.json`。

- P1 出处匹配：按已通过出处的 messageIndex 从既有 factSourceSnapshot 回读实际消息，用现有 NFKC / 空白规则仅定位引文对应的原始片段，再以原始片段逐字匹配事项名、保存原句。不把模型的等价改写当原文，不扩大到同消息的未采用句子，未新建来源存储。规范化的字符位置按字素绑定回原文，兼容字符的部分展开不能冒充完整原句。
- P1 草稿恢复：先清理标题再选有效标签，空白标题采用区块正文；服务端锚点和客户端完整草稿分别通过既有 schema 才可使用。无法形成合法锚点时仍保留匹配提示、不给草稿定位；正文等字段超过草稿合同也不写入草稿集合，提示该位置无法加入并请用户重新点选填写。历史回看隐藏当前提示；已有及发送中条目的原始字段保留。
- 父版本红证据：17:36:30–17:36:52 UTC，`npm test -- --test-name-pattern=空白标题 tests/t175-stale-placeholder.test.ts` 的三档均在刷新读回断言按预期失败（实际 0，要求原有及两条新草稿共 3），见 `parent-blank-heading-red.log`；17:39:13–17:39:52 UTC，三个产品接入文件串行临时恢复到 36d755c，再运行 `npm test -- --test-name-pattern=已通过出处 tests/t175-stale-placeholder.test.ts`，最终四个全半角/空白方向均因错误提示或漏报按预期失败，结束后立即恢复候选，见 `parent-final-quote-red.log`。两条命令都只设 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell`。
- 早期日志 `parent-red.log`、`parent-final-red.log`、`parent-corrected-red.log`、`candidate-directed.log` 原样保留：最初空白标题夹具缺 h1、刷新等待过早读取空 body、草稿数量及换行页面反例的期望曾不准确，均在夹具或断言层修正，没有改事项切分合同或放宽检查。早期的这些夹具/等待错误不算 P1 红证据；最终引用上面的三档红测与四方向红测。`parent-corrected-red.log` 还直接拦截历史回看仍显示提示；同节点两个占位与发送中条目完整字段在真实 Chrome 中断言。
- 最终定向：`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t175-stale-placeholder.test.ts`，17:40:16–17:43:34 UTC，15 项中 12 通过、3 失败、0 跳过，退出 1；新增九项全部通过。三个失败均是餐馆 1440/768/375 的生产 chat 在存版前报「局部动态状态检查超时，本次未保存版本。」，按负责人限定属于 T-178 已知问题；不计为本次新缺陷，也不记为通过。日志 `final-directed.log`，标准入口报告和诊断在 [报告与检查副本](../../artifacts/t175/reports/test-run-1792258818860-72676/)，失败数据根 `/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-test-n9LpA6` 保留。没有为这个超时另换数据、改入口或重跑掩盖。
- 最终工作台三档截图 `artifacts/t162/self-contained-1792258833409-73014/blank-heading-*.png` 与 `unavailable-draft-*.png` 共四张均逐张打开查看：菜单页第三条草稿的有效标签、原句意见及操作完整可见；375 截图是对话面板，不宣称预览整个区块可见。初轮候选四张截图也已逐张查看并保留，初轮截断的第三条草稿不作为完整草稿证据。
- 其后串行执行 `node --test --experimental-strip-types scripts/t167-runner-regressions.ts`（17:43:34–17:45:28 UTC，4/4 通过、0 跳过、退出 0）和 `npm run typecheck`（17:45:28–17:46:00 UTC，退出 0），分别见 `runner-regressions.log` 与 `typecheck.log`。本次没有其他原因的未解决失败。
- 不调用 DeepSeek，不读取 `.env.local`，不写主工作区 `.sitecraft-data`，不推送、不 amend、不用 rm。Next 自动改动的 `tsconfig.json` 保留且不提交。AGENTS、CONTEXT、mainline 与 spec 已同步本次合同；本次 project-map status 的过期文档为 0，唯一问题仍是本工作树缺 T-178 票文件，保留依赖、不擅自新建。整票继续等 T-178 合并后按主控安排跑两轮全量与 build，独立复审未自行宣布通过。

### 已保留的原始验收与并发诊断

- 2026-10-17 13:09 UTC，父版本 d7e0aa2 的初次完整红测执行 5 项、5 项按预期失败：提交后提示数组为空；三档工作台提示数为 0。生产 chat 均完成存版，未因替身、导入或环境错误失败。完整日志 `artifacts/t175/parent-red.log`，报告 `parent-report.json`；中断轮另保留在 `parent-interrupted/`，不作为完整红测。
- 13:16 UTC，最终 6 项用例串行还原 d7e0aa2 的三个产品接入文件后全部按预期失败，含更换事项名的独立输入；还原期间不跑其他测试，结束原样恢复产品改动。日志 `artifacts/t175/parent-final-red.log`，报告 `parent-final-report.json`。
- 13:17 UTC，同一最终 6 项用例在本候选全部通过，typecheck 通过；日志 `artifacts/t175/targeted-candidate.log`、`typecheck-candidate.log`，标准入口成功轮报告已被保留策略清理，当前无法回读；既有日志 `artifacts/t175/targeted-candidate.log` 保留，此旧报告不作为本次恢复验收依据。两次红测及候选定向使用同一命令：`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t175-stale-placeholder.test.ts`；类型检查为 `npm run typecheck`。
- v2 来源与 T-173 原批注在 `tests/fixtures/t175-restaurant.json`，只读取主工作区一次；每个用例只向标准入口新建并核对的临时根复制。生产 chat POST 与唯一提交入口处理修改，临时 HTTP 桥仅控制 after 调度及本地模型响应，不作实际 Next after 或真实模型能力通过的声明。没有调用 DeepSeek，没有读取 `.env.local`。
- `artifacts/t175/run-1792242974584-12937/prompt-{1440,768,375}.png` 三张提示截图均已逐张打开：菜单页原文与「一起更新」可见。对应的三张 `draft-*.png` 也已逐张打开；375 草稿截图只记录意见框和部分区块，不作为完整区块可见性的证据。端到端另验证了跨页回看意见、旧版不改、已有草稿保留、重复点击/刷新不重复添加、模型请求数和版本数不变。
- `spec.md`、`CONTEXT.md`、AGENTS、README 与 mainline 已同步；project-map status 无过期 living doc。Next 自动改动的 `tsconfig.json` 留在工作树，不提交。
- 13:24 UTC，重任务前 `memory_pressure` 空闲 54%，`ps` 无其他 Chrome 测试/Next 测试进程。按负责人指定顺序执行 `SITE_STORE=fs npm run build`，退出 0；日志 `artifacts/t175/build.log`。随后单独运行仓库要求的 `node --test --experimental-strip-types scripts/t167-runner-regressions.ts`，4/4 通过，日志 `runner-regressions.log`。
- 全量前再次核对内存空闲 50% 且无其他 Chrome 测试进程，仅设置 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test`。13:29:41 UTC 完成：115 文件、799 项，796 通过、3 失败、0 跳过，退出 1。失败均在 `tests/t175-stale-placeholder.test.ts:145`：1440/768/375 的真实 chat 任务报「局部动态状态检查超时，本次未保存版本。」，任务没有存成新版本；不能以此前定向通过代替全量通过。未重跑、未改变条件或绕过检查。
- 本轮完整日志 `artifacts/t175/full-test.log`；报告及每文件统计另存 `full-test-report.json`、`full-test-summaries.ndjson`；原始报告、检查诊断与 dev 日志在 [报告与检查副本](../../artifacts/t175/reports/test-run-1792243472424-18680/)，失败数据根为 `/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-test-Umxvng`，均保留。负责人已另行授权：先提交此 INCOMPLETE 快照，再只读排查现有并发机制与本轮 timings；修复后先定向验证，下一轮全量/build 仍须 READY_FOR_HEAVY 后单独放行。

### 只读并发诊断

数据来自上述原轮，未新开测试。定向逐档指标读取 `artifacts/t175/run-1792242974584-12937/state-{1440,768,375}.json` 中新版本的 `checks.viewports[].dynamicState`；每列表示一次对应工作台视口的独立重放，单位毫秒。全量读取 [原轮检查诊断](../../artifacts/t175/reports/test-run-1792243472424-18680/checks/) 中的 `27796-*.json`。

| 动态核对宽度 | 定向：1440 场景 | 定向：768 场景 | 定向：375 场景 | 全量：三个场景 |
| --- | ---: | ---: | ---: | --- |
| 375 | 2561.4 | 2976.9 | 3390.0 | 5028.1 / 5052.2 / 5105.5，均超时 |
| 768 | 3571.4 | 3386.2 | 3533.7 | 首档失败，未执行 |
| 1440 | 3312.1 | 3286.5 | 3146.3 | 首档失败，未执行 |

- 定向完整样式读取每侧约 2322–3479ms，单侧 215 次 CDP 往返并完成四种状态；全量失败时单侧样式读取已用约 3793–4218ms，仅完成 125–140 次往返就耗尽预算。主要耗时是 `stageMs.styleRead`，不是模型响应；全量本地写作回复为 2/5/40ms。没有把部分探针或未执行档记成通过。
- 三次失败的动态检查区间分别为 13:28:32.678–37.706、13:28:41.870–46.922、13:28:50.179–55.285 UTC；每个区间都与其他 5–6 个 Node 测试进程创建的 Chrome 生命周期重叠，开始时共有 6–8 个存活浏览器配置（包含 T-175 自己）。重叠进程为 25268（T-169 浏览器出处）、25320（T-171 导出）、25368（T-173 出处修正）、25845（T-173 事实边界）、27470（T-173 修正范围）、27630（T-174 局部函数），后两次不含已结束的 25320。对应 pid→文件映射来自 `full-test.log`，浏览器开始/结束时间来自同轮 `checks/`。
- `scripts/run-tests.ts` 的工作树锁只防止两轮标准入口同时启动；创建单轮 Node 测试进程时没有 `--test-concurrency`。`tests/helpers/t162-browser.ts`、`lib/code-site-browser.ts` 也没有跨文件互斥。T-162、T-164 多区块 chat、T-175 已使用同一个 helper；因此不能归因为 T-175 漏接了一套现有机制。其他用例采用较小页面或静态模式，T-164 的动态状态对照约 76–1238ms，T-173 修正范围主要走首次生成及事实修正，不等同于餐馆整页十个可聚焦元素的完整动态比较。
- helper 的 `timings.json` 显示：全量本地模型任务时 load 约 35.7–37.1，定向约 7.8–9.1。结合重叠与样式读取变慢，证据支持并发资源争用；这不是内存低于门槛，也没有证明并发是唯一性能因素。本轮没有做新的隔离对照，不把推断写成已验证的修复效果。

可选修复方向（均保留 5 秒/档、15 秒/三档及完整检查）：

| 方向 | 修改范围与影响 |
| --- | --- |
| A：标准入口显式限制 Node 文件并发 | 改 `scripts/run-tests.ts` 的统一调度；影响全部测试文件的并行度、资源峰值与全量耗时。保持同一入口、身份核对、用例统计和所有断言，需要用候选值实测选择上限。 |
| B：按浏览器测试分组串行调度 | 新增测试分类与分组编排，影响入口和浏览器文件清单；可保留非浏览器测试并发，但增加分类维护、统计汇总及漏归类风险，当前没有这套机制可直接复用。 |
| C：优化完整样式读取 | 改生产 `lib/code-site-local-edit.ts` 探针；影响单区块、多区块及实际用户修改的性能，需要独立范围/状态反例证明未减少检查，不应作为本票测试调度修复的顺手改动。 |

### 构思主控决定（2026-10-17）：选 A

在 T-175 内修改标准入口的 Node 文件并发上限；串行实测 2、4、6 三个候选，逐轮记录全量耗时、失败数与 T-175 三档动态检查耗时，选择全部通过且耗时最短者，再冻结同一代码提交连跑两轮全量并构建。每轮开始前核对 memory_pressure（低于 25% 停止）和 ps；不得放宽 5 秒/档、15 秒/三档，不跳过、不重试、不改断言。重任务已明确放行，不再重复请求；生产样式读取优化另开 T-178，不在本票实施。

定向调用也使用同一默认并发上限：入口通过是否显式传入 `.test.ts` 来决定枚举文件，随后共用同一次 Node spawn；多个定向文件同样可能创建重叠 Chrome，统一限制避免第二套调度，单文件定向的执行顺序不受影响。失败方式：上限未传给真实 Node 子进程、定向绕过限制、用例统计减少或跳过、把动态检查超时改成成功。沿用首轮真实失败作红证据，入口回归及完整 799 项作为行为验收，不新增只复述常量的测试。

### A 的候选实测与选择

2026-10-17，三轮串行执行同一 `CHROME_PATH=…/chrome-headless-shell npm test`（完整路径同上），只改变入口传给 Node 的默认 `--test-concurrency` 数值；产品代码、5 秒/档与 15 秒/三档上限及全部断言未改。各轮新建并核对临时数据根；总耗时从启动 npm 至退出计时，包含服务启动。每档毫秒值依次对应工作台 1440/768/375 三个独立重放场景；「未执行」表示该场景前档已拒收，不能计为通过。

| 并发 | 开跑前空闲 | 全量秒数 | 通过 / 失败 | 375 档耗时（ms） | 768 档耗时（ms） | 1440 档耗时（ms） |
| --- | --- | ---: | --- | --- | --- | --- |
| 2 | 56% | 546.215 | 799 / 0 | 4286.1 / 4328.1 / 4035.6 | 4205.2 / 4133.4 / 3558.5 | 4030.5 / 4085.3 / 3461.3 |
| 4 | 55% | 345.293 | 798 / 1 | 5099.1（拒收）/ 4594.0 / 4483.6 | 未执行 / 4248.5 / 4133.1 | 未执行 / 4173.9 / 4088.5 |
| 6 | 60% | 329.659 | 796 / 3 | 5012.3 / 5092.7 / 5004.6（均拒收）| 均未执行 | 均未执行 |

三轮前均核对 ps，无其他测试 Chrome；每轮的 memory.txt、processes.txt、full-test.log、原报告、Node 每文件统计及完整 T-175 动态诊断位于 `artifacts/t175/concurrency-candidates/{2,4,6}/`，汇总为 `results.json`，编排输出 `artifacts/t175/concurrency-calibration.log`。4、6 的失败仍为真实 chat 存版前的动态检查超时，日志原样保留，没有重跑该值或换数据绕过。初筛只有 2 全过，故先冻结为 fb500ec 独立验证；其后稳定性失败如下，初筛通过不能替代稳定性要求。

入口改动前的成对坏例引用 95317ea 的 `artifacts/t175/full-test.log`、`full-test-report.json`（799 项中 3 项 T-175 超时）。入口改动后的定向 6/6、独立入口回归 4/4 已过，日志 `limited-directed.log`、`limited-runner-regressions.log`，typecheck 日志 `limited-typecheck.log`。定向和各候选生成的 T-175 提示/草稿截图均逐张查看；失败场景无新版本及提示截图，375 草稿只证明意见框与部分范围可见。

### 并发 2 的稳定性不通过；补测并发 1

两轮均在 `fb500ec1d5bddb1d84c87126271904e0522b238e` 串行执行，启动前自动核对 SHA 和源码未改变（仅保留 Next 的 tsconfig 自动改动）。第二轮是事先约定的连续两轮中的后一轮，不作为覆盖第一轮失败的重试；两轮全部结果保留在 `artifacts/t175/final-stability/{1,2}/` 及 `stability.log`。

| 轮次 | 开跑前空闲 | 总秒数 | 通过 / 失败 | 375 档耗时（ms）（三场景）| 768 档耗时（ms） | 1440 档耗时（ms） |
| --- | --- | ---: | --- | --- | --- | --- |
| 1 | 40% | 535.317 | 798 / 1 | 4622.4 / 4889.6 / 5043.9（拒收）| 4322.9 / 4666.2 / 未执行 | 4318.5 / 4918.8 / 未执行 |
| 2 | 43% | 601.871 | 796 / 3 | 5004.3 / 5005.9 / 5046.9（均拒收）| 均未执行 | 均未执行 |

因此 2 也不再满足「全部通过」。按已授权的候选值实测继续补测 1：它是最小合法正整数，直接排除测试文件之间的并行竞争，影响仍仅在统一入口，不改生产探针。先做定向，再冻结新提交；在该 SHA 上连续两轮全量同时提供候选 1 的耗时及稳定性证据，不再额外加一轮同值筛选。任一轮失败仍如实不通过，不回头重跑 2，不放宽时限或改断言；若 1 也无法通过，A 无更低可选值，须报告 INCOMPLETE，不能进入 T-178 的产品优化范围。

并发 1 的定向 T-175 6/6、入口回归 4/4、typecheck 均已过，日志 `artifacts/t175/serial-directed.log`、`serial-runner-regressions.log`、`serial-typecheck.log`；只改变统一入口的默认并发数字，测试与产品代码未改。

### 并发 1：同一提交两轮结果与边界

两轮均在 `499c1cfa4a545bd6ef61e24283813fc198cbbd93` 连续执行，代码无修改，启动前均核对同一 SHA、memory_pressure 与 ps，无其他测试 Chrome；标准命令仍仅设上述 CHROME_PATH 后 `npm test`。完整报告与指标分别保存在 `artifacts/t175/serial-stability/{1,2}/`，编排记录 `serial-stability.log`，原 2/4/6 和并发 2 稳定性失败日志全部保留，无覆盖。

| 轮次 | 开跑前空闲 | 全量秒数 | 通过 / 失败 | 375 档耗时 ms（三场景） | 768 档耗时 ms | 1440 档耗时 ms |
| --- | --- | ---: | --- | --- | --- | --- |
| 1 | 43% | 895.289 | 799 / 0 | 2766.8 / 2831.2 / 2850.3 | 2693.9 / 2892.0 / 2853.8 | 2632.5 / 2765.4 / 2652.3 |
| 2 | 60% | 989.219 | 797 / 2 | 4918.9 / 5018.2（拒收）/ 5003.8（拒收） | 4238.2 / 未执行 / 未执行 | 3725.6 / 未执行 / 未执行 |

第二轮的 768、375 工作台场景均在生产 chat 存版前报动态状态检查超时；首个核对宽度都是 375，后档未执行，不能把缺失值记成零或通过。两个失败区间在本轮 `checks/` 中与其他测试文件 pid 的 Chrome 生命周期重叠数均为 0（不代表已经排除机器上未被本轮诊断登记的所有资源影响）。768 场景的两侧探针已完成 215 次 CDP 往返，但含分类、探针和比较的整档仍达 5018.2ms；两侧样式读取分别 4615.3、4623.0ms。375 场景的两侧探针未完成，样式读取已占 4468.5–4532.0ms。没有跳过剩余状态或放宽预算。

因此「仅限制文件并发即可完成验收」未获证明：1 已排除同轮其他文件的 Chrome 竞争，仍无法连续两轮通过；2/4/6 也都有已保留的失败。当前没有符合负责人选择条件的候选，不能把单轮 799/799 或更快但失败的值选作已验收结果。生产读取性能的后续处理归构思主控另开的 T-178，本票不修改 `lib/code-site-local-edit.ts`、`lib/code-site-check.ts` 或测试判断条件，也不新增全量重跑。

`SITE_STORE=fs npm run build` 已在 499c1cf 上退出 0，日志 `artifacts/t175/build-499c1cf.log`；开跑前空闲 61%，ps 及内存记录为 `pre-build-499c1cf-{memory,processes}.txt`，未读取 .env.local。结果记录提交不改代码，最终记录提交上的构建回执单独保存在 `artifacts/t175/build-final.log` 与 `build-final-report.json`（含实际 SHA、时间、命令和退出码）。本票仍为 INCOMPLETE，不关闭上述未满足的验收项。

串行定向、并发 1 两轮生成的 T-175 提示与草稿截图均逐张打开查看；第二轮只有 1440 场景存版成功，768/375 没有新提示截图。所有 375 草稿截图仅作为意见框及部分区块可见的证据，不用于宣称完整区块可见或审美通过。

## 构思主控决定：暂停等 T-178

2026-10-17，构思主控决定先做 T-178，T-175 暂停等它。撤回 `scripts/run-tests.ts` 自 fb500ec 起引入的默认文件并发参数、常量和配套注释，恢复到其父提交 9f5b680 的入口；同步移除 AGENTS.md、README.md、spec.md 的文件并发上限说明。只撤这一部分，T-175 功能、术语、其他文档同步及原始验收保持；A 不再作为当前待办，以上决定与测量表作为历史依据保留。

头部 `blocked_by` 改为 `[T-178]`，`claimed_by: Codex` 不变，票保持 open。当前工作树尚无 T-178 票文件，project-map 的缺失依赖提示如实保留，待主控整合该票后解析；不在本工作树另建 T-178。并发 1/2/4/6 的所有失败日志、report、timings、逐档诊断和截图均留在原 `artifacts/t175/`、对应 `artifacts/t162/` 与失败的 `artifacts/t167/test-run-*/`，供 T-178 使用，不移动、不覆盖或清理。

撤回后只各执行一次定向 T-175、独立 runner 回归与 typecheck；不运行全量、不运行 build。此次用新本地提交记录，不 amend、不用 git revert；`tsconfig.json` 的 Next 自动改动继续留在工作树且不提交。完成限定检查和提交后停止等待，工作树不删除。

本次撤回验证（2026-10-17；对应本节所在的新提交，父提交 00478e5，SHA 见交付回报）：

- `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t175-stale-placeholder.test.ts` 只运行一次，15:05:21 UTC 完成，6 项中 4 通过、2 失败，退出 1；1440、768 场景均在生产 chat 存版前报「局部动态状态检查超时，本次未保存版本。」，375 场景通过。不能宣称撤回后的全部定向验收通过，不重跑掩盖。日志和报告为 `artifacts/t175/withdraw-concurrency-1792249471152/directed.log`、`directed-report.json`；完整检查诊断及失败数据根仍由标准入口保留。
- 随后单独执行一次 `node --test --experimental-strip-types scripts/t167-runner-regressions.ts`，4/4 通过、退出 0，日志同目录 `runner-regressions.log`；再执行一次 `npm run typecheck`，退出 0，日志 `typecheck.log`。本轮没有全量或 build。
- `scripts/run-tests.ts`、AGENTS.md、README.md、spec.md 对 9f5b680 的文本 diff 为空，确认只撤回文件并发部分；T-175 的组件、版本/出处逻辑、测试、夹具、CONTEXT 与 mainline 对功能提交 95317ea 的文本 diff 为空，功能和其他同步保留。本轮 375 的提示/草稿两张截图已逐张打开查看。
- project-map status：过期 living doc 为 0；唯一结构问题是本工作树缺少 T-178 票文件，已按负责人要求保留 `blocked_by: [T-178]`，不擅自创建该票。T-175 为 INCOMPLETE，暂停等待 T-178；claimed_by 和工作树保留。
