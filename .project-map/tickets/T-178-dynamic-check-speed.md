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

T-175（2026-10-17）在禾巷小馆 v2 首页（10 个可交互元素）实测：动态状态检查空闲时每档已用 2.6–3.6 秒，占每档 5 秒上限的 50–70%，主要耗时在完整计算样式读取。检查在服务端提交入口的 Chrome 里运行，服务端负载升高时正常批注会被判超时拒收，直接伤到主流程「修改」。构思主控决定先优化速度，上限暂不调。

## 构思主控决定（2026-10-17）

T-175 先暂停，这张票提前做，用新的 sol 实例执行。依据是 T-175 的实测结果（证据在 t175 工作树的票 Resolution 与 `artifacts/t175/`）：
- 测试文件并发降到 1、同一轮没有其他测试 Chrome 重叠时，禾巷小馆首页样式读取空闲约 2.7 秒，负载下约 4.6 秒，第二轮 375 档在 5.02 秒超时；
- 并发 2、4、6 也都有失败。
所以光限制测试并发不能稳定通过，要在检查本身提速。验收另加一条有负载的要求，见下方 Acceptance。

构思主控进一步决定（2026-10-17）：先不引入并行方案，先定位实现根因。负责人观察当前 load 约 2.6、内存空闲 61%，无温控或低电量记录，空闲检查仍约 5.3 秒，据此判断慢在实现。先在同一 Chrome、同一禾巷小馆 v2 首页做单次 Runtime.evaluate 的完整属性读取基准，至少五次并拆分读取、JSON 序列化、CDP 传输与 Node 解析；再对现有一次完整检查同时录 Chrome CPU／Tracing 与 Node --cpu-prof，列出热点及占比。基准远低于一秒时采用同语义读取方式，并重跑 131 次对照、完整属性用例与三档五次分布；若剖析证明主要成本为样式重算，停止并报告，再由主控考虑并行。生产五秒上限不改，DeepSeek、全量与 build 均不运行。

构思主控新方向（2026-10-17，取代继续优化单次读取）：单次完整读取约 85ms，但每档每侧约 41 次、两侧约 82 次，故改为减少完整读取次数。先在指定 headless shell 154 上验证 `CSS.trackComputedStyleUpdates`／`CSS.takeComputedStyleUpdates` 的实际可用性、完整属性列表及上限、CSS 域 enable 要求、强制状态到更新可取的时机与漏报风险。准入后跟踪全部计算属性，只重读确实变化节点，其余沿用基线；五类伪元素分别验证，不能覆盖的伪元素继续每态完整读取。API 不可用或元素跟踪覆盖不全即停止报告，不另找替代路径。通过准入才实现并沿用 131 次对照、故意漏读用例，另加故意遗漏变化节点的反例，再测三档各五次空闲分布；全量、负载轮与 build 仍须负责人放行，DeepSeek 和生产上限均不动。负责人另指出本轮窗格的 fast／priority 不是项目设置，稍后由其切回 default，本票不改项目配置。

## What to build

1. 先按段测出耗时分布（强制状态、样式读取、比较、视口切换），结果写进 Resolution。
2. 只做不改语义的优化：例如每个「元素×状态」在页面内一次批量读取全部范围外元素与已生成伪元素的完整计算样式，减少 CDP 往返；复用同一视口下的布局。比较对象仍是完整计算样式，不缩减属性集合、不跳元素、不删状态、不减视口。
3. 目标：禾巷小馆首页空闲时每档 ≤1.5 秒，并记录每档 5 次分布；5 秒/15 秒上限与超时拒收不变。

## Acceptance

- [ ] T-164/T-173 的动态检查坏例（:has(:focus)、兄弟组合器、祖先 hover/active、伪元素、自定义属性、媒体查询）全部仍被拒，正常对照仍通过；优化前后对同一组输入结论逐项一致
- [x] 耗时分布与目标对比写进 Resolution；不调用 DeepSeek
- [ ] 有负载时（同时跑一轮全量），禾巷小馆三档都稳定低于 5 秒，并记录分布
- [ ] typecheck、test、build 通过；独立 sol 审查通过

## Resolution

状态：**INCOMPLETE**；最新跟踪方案的事实门禁为 **BLOCKED**。指定 headless shell 154 的两个 API 可调用，但完整登记属性后，仍漏报范围外 flex 兄弟的布局变化。按负责人「覆盖不全即停止」的指示，未采用跟踪优化、未另找替代路径。生产 `code-site-local-edit.ts` 已恢复到 `7cfd723`，与原父版本 `c4a72e5` 相同；五秒／十五秒与超时拒收不变。本票保持 open、claimed_by 为 Codex。以下数据均为 2026-10-17 本工作树实测；artifacts 保留失败与未采纳试验，不删除慢样本。

### 跟踪 API 事实门禁

目标是减少完整读取次数，同时保留每个范围外元素的完整计算样式语义；非目标是并行、删属性、放宽上限或实现替代检测。准入条件：完整属性登记后，凡现有完整读取能观察到的范围外样式变化，其节点都必须被回报。未知项按真实浏览器实验核对，普通元素出现决定性漏报即停止。执行者 Codex。

- **measured**：16:44:00 UTC 初测，16:44:32 UTC 核对分批返回。版本为 `HeadlessChrome/154.0.8037.92`，revision `334b65d254ccc35df4fca82706d1753227b01039`。由生产 `codeCheckBrowser` 启动、经本地 HTTP `/code-check.html` 的 200／HTML 类型／固定标记／无脚本校验后载入页面；无模型和站点存储调用。
- **measured**：`CSS.enable` 在 DOM 域未 enable 时拒绝，错误为 `DOM agent needs to be enabled first.`；`trackComputedStyleUpdates` 本身在两域未 enable 时可登记，但不能据此认定无需 enable 就能收到更新。正式反例先 `DOM.enable`、`CSS.enable`，并用 `DOM.getDocument(depth=-1,pierce=true)` 加查询确认全部七个元素已绑定前端 nodeId。
- **measured**：禾巷小馆 v2 全页 162 元素、478 个标准属性，把每个元素及五类伪元素的全部基线属性名／值取并集，共 1169 对，API 全部接受；无裁剪、无只取首批。反例另含 `--complete`，完整列表为 479 个名称、539 对名／值，也全部接受。已证本夹具所需规模可登记，未声称测得任意规模的最大上限。
- **measured**：颜色正例 `#trigger:hover + #outside` 将颜色从 `rgb(10,20,30)` 改成 `rgb(40,50,60)`，范围外 nodeId 11 被返回，两轮分别约 0.66ms、1.26ms 即收到第一批。`take` 是长轮询，空队列不会立即返回空数组；本实验明确用 `track([])` 释放最后一个待回复请求，没有把超时当无变化。
- **measured**：决定性反例是宽 400px 的 flex 容器，触发节点固定宽 100px，范围外兄弟 `flex:1;min-width:0`。hover 仅把触发节点宽改成 200px。独立预期来自这组 CSS：外部兄弟宽应从 300px 变为 200px。原生完整读取确实观察到 `width`、`inline-size` 同步改变，`perspective-origin`、`transform-origin` 的横向分量从 150px 变成 100px；API 第一批仅回报触发节点 23，范围外节点 25 缺失。完整同步读取后，再跨两个 requestAnimationFrame 并读取，结果不再变化；继续取第二批、关闭跟踪排空，第二批仍为空。故不是未绑定节点、属性裁剪、漏取第二批或五秒截止导致。
- **observed / inferred**：该二进制 revision 的 [InspectorCSSAgent 源码](https://github.com/chromium/chromium/blob/334b65d254ccc35df4fca82706d1753227b01039/third_party/blink/renderer/core/inspector/inspector_css_agent.cc#L4865) 接收的是属性名与值的过滤表；`DidUpdateComputedStyle` 比较旧／新 `ComputedStyle` 的属性值，且旧值或新值须命中过滤集合。它不是所有 resolved 布局值变化的通知器；这与实测的 flex 漏报相符，不能保证现有 `getComputedStyle` 比较语义。
- **unknown / stop**：普通元素门禁已失败，按指示没有继续五类伪元素覆盖实验、任意属性列表极限探测或实现跟踪方案。伪元素覆盖不作已验证声明；没有新增其他路径来补漏。故意遗漏变化节点的最小反例已由上述独立宽度预期检出，脚本输出 BLOCKED、退出码 2；它不等于生产跟踪实现的等价性通过。

证据：`artifacts/t178/track-capability-20261017/result.json`、`track-capability-drained-20261017/result.json` 及对应 `.log`；脚本为 `scripts/t178-track-capability.ts`。最新方向未通过准入，因此未跑该方案的 131 次对照和三档各五次性能验收。

### 单次完整读取基准

16:07:06–16:07:10 UTC，同一 Chrome、同一禾巷小馆 v2 首页，三档各五次，每个样本严格只有一次 Runtime.evaluate 回复。源 v2 为 `91191b41-483b-4ed8-adba-4d956fad032f`，来自 T-175 的只读夹具；候选 v3 为 `4ca32c17-5104-4215-abb1-6b0c0f9e290e`。三档 width=375／768／1440，height=1000、deviceScaleFactor=1、mobile=false。页面经生产检查页建立同源文档，按生产渲染器载入；选中 home 的 `[5]`，全部 DOM 162、范围外 146。复用同一浏览器和页面，不每次冷启。

单次结果为紧凑 JSON：标准属性 478 项，实时枚举自定义属性不截断。分别量无条件元素＋before／after、仅已生成 before／after，以及完整生产合同；第三种保留五类伪元素，范围外祖先自身沿用完整 Typed OM。完整模式逐项重建后与原生产静态快照全部属性一致。

| 读取范围 | 每次完整取值数 | 375 五次总耗时 ms | 768 五次总耗时 ms | 1440 五次总耗时 ms |
| --- | ---: | --- | --- | --- |
| 元素、before、after，无条件读取 | 209364 | 83.4 / 89.0 / 81.7 / 81.1 / 80.9 | 81.4 / 85.1 / 80.4 / 79.3 / 80.2 | 83.1 / 79.4 / 79.4 / 81.0 / 107.9 |
| 元素及已生成 before／after | 69788 | 25.2 / 25.1 / 25.1 / 25.0 / 25.0 | 24.0 / 23.7 / 24.3 / 24.0 / 24.7 | 24.5 / 24.5 / 24.4 / 25.0 / 25.0 |
| 完整生产范围、五类伪元素 | 212232 | 85.6 / 85.5 / 86.3 / 84.7 / 85.2 | 84.9 / 84.2 / 84.4 / 85.0 / 84.7 | 85.1 / 83.5 / 84.2 / 98.5 / 85.8 |

第二行仅是拆分基准，不能用于替代生产合同。完整模式 876 个元素／伪元素条目，其中 444 个需要完整取值；没有生成 before／after，有六个 marker，first-line／first-letter 仍全部读取。各分段中位数如下，单位 ms；分段中位数相加不一定等于总耗时中位数。

| 宽度 | 页面读取 | JSON 序列化 | CDP 剩余时间 | Node 协议 JSON 解析 | Node 数据 JSON 解析 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 375 | 48.9 | 2.0 | 27.60 | 3.04 | 3.90 |
| 768 | 48.4 | 2.0 | 27.42 | 2.99 | 3.90 |
| 1440 | 48.0 | 2.1 | 27.39 | 3.18 | 3.96 |

CDP 剩余时间是 Node 往返减去页面读取、页面序列化及 Node 协议解析，包含 Chrome 协议编码、传输与调度，无法单凭此计时分离纯传输，不冒称纯 wire 耗时。原始为 `artifacts/t178/read-benchmark-20261017/benchmark.json`，每种首个紧凑快照也保留。另试绑定 getter 的数据在 `read-benchmark-bound-20261017/`，没有显著收益，未采用。

### 生产完整检查 CPU 与 Trace

16:10:46 UTC 完成一次原生产 `7cfd723` 完整检查，Chrome 两侧均开 Profiler（1000µs）和 Tracing，Node 用 --cpu-prof。只在计时驱动通过现有内部参数取消截止；生产上限不动。源、候选各一只隔离 Chrome，按既有生产路径并行，各侧同轮复用三视口；每侧每档 10 个可聚焦元素、四态＋基线共 41 次快照、76 次强制、215 次 CDP 往返。两侧三档共 246 次完整快照，全部完成。82 次是两侧工作量，既有两侧并行，不能把 82×单次基准直接等同每档墙钟。

本次三档动态总耗时为 **2727.0 / 2571.1 / 2683.4ms**，并非此前 5.3 秒；16:14:59 UTC 不挂 profile 的原实现对照为 **2536.3 / 2427.0 / 2576.0ms**。这两轮未唯一定位旧 5.3 秒差异，不用它们宣称优化，也不据此判断环境或完整读取的速度下限。

| 原实现／宽度 | 强制状态，源／候选 ms | 样式读取往返，源／候选 ms | 比较 ms |
| --- | --- | --- | ---: |
| 375 | 30.3 / 30.9 | 2424.6 / 2393.0 | 18.1 |
| 768 | 23.6 / 21.0 | 2467.9 / 2487.7 | 19.2 |
| 1440 | 27.9 / 22.9 | 2567.2 / 2578.0 | 14.8 |

每侧三档合计：页面属性读取 7048.4／7021.0ms，JSON 序列化 24.7／23.7ms，gzip 171.2／173.2ms，样式捕获 CDP 往返 7369.3／7354.8ms。源侧与候选侧完整 profile 区间的全部 CDP 方法数为 716／656，含装载与其他生产检查；动态阶段单档仍各 215，不混为一谈。视口调用单独留在原始 `records[].calls`，不归入样式读取。

CPU 统计仅取 Chrome 样式捕获窗口；Node 仅取生产检查起始至首次导出 profile 前，避免几百 MB Trace 导出污染。Chrome clock_sync 对齐误差小于 0.5ms。热点为采样占窗口比例：

| 进程 | 热点 | 占窗口 | 占活跃采样 |
| --- | --- | ---: | ---: |
| Chrome 源／候选 | 完整快照闭包（eval 1:2） | 94.27% / 94.25% | 95.75% / 95.97% |
| Chrome 源／候选 | program | 1.85% / 1.67% | 1.87% / 1.70% |
| Chrome 源／候选 | 外层快照闭包（eval 1:1） | 1.72% / 1.58% | 1.75% / 1.61% |
| Chrome 源／候选 | GC | 0.33% / 0.31% | 0.34% / 0.31% |
| Node | capture（解码、解压、解析与转换所在函数） | 1.27% | 20.34% |
| Node | GC | 0.89% | 14.31% |
| Node | checkSiteCode | 0.30% | 4.90% |
| Node | 浏览器消息处理 | 0.27% | 4.33% |
| Node | 范围外比较回调 | 0.26% | 4.26% |

Chrome 闭包行采样热点落在完整属性取值语句（`computed.getAll`／`style.getPropertyValue`）。V8 将原生 getter 的时间归给调用者，不能称全是纯 JS 循环。Trace 捕获窗口的真实 Recalc Style 仅 15.90／17.45ms，Layout 事件均为零；全 profile 的 Recalc Style 36.80／29.81ms、Layout 22.85／10.64ms，远非数秒主因。`Document::UpdateStyleAndLayout` 检查调用约 38.5 万次，含子事件总 409.9／408.6ms，不能当成相同数量的真实 Layout，也不能与子事件再相加。Node 生产窗口 8901.4ms 中 idle 8347.3ms（93.78%），活跃 554.1ms；主要是在等 Chrome，不能把 Node idle 全归 CDP 传输。zlib 两个处理函数分别仅占窗口 0.10%／0.08%。

原始 profile：`artifacts/t178/read-profile-20261017/chrome-{0,1}.cpuprofile`、`chrome-{0,1}.trace.json`（均 dataLossOccurred=false）、`result.json`；Node 为 `read-profile-20261017-node/node.cpuprofile`；汇总 `read-profile-summary-20261017.json`。V8 原始样本含少量负 timeDelta，汇总按 DevTools 的绝对时间配对排序方式处理，原文件未改；首个汇总失败日志也保留。结论是重复完整取值占主导，未证样式重算本身慢，不启动并行方案。

### 未采用的读取试验与完整分布

紧凑 JSON 单次远低于一秒，因此按上一决定试过同语义批量读取；但生产原实现本来每态就只做一次 Runtime.evaluate，试验没有减少 41 次完整读取。cached 与 inline 差异分别保留为 `compact-cached-reader.patch`、`compact-inline-reader.patch`，均不在生产代码中。以下均取消计时截止并完整完成，每格五次、单位秒；不把达到截止的旧结果当真实总耗时。

| 宽度 | 原实现，15:37 UTC 起 | cached，16:28 UTC 起 | inline，16:31 UTC 起 |
| --- | --- | --- | --- |
| 375 | 5.905 / 5.826 / 5.864 / 5.981 / 6.008 | 5.968 / 4.830 / 5.377 / 5.882 / 4.927 | 6.256 / 5.618 / 5.280 / 4.990 / 5.144 |
| 768 | 5.533 / 5.632 / 5.542 / 5.564 / 5.971 | 5.086 / 5.120 / 4.555 / 5.357 / 5.049 | 6.486 / 5.014 / 5.346 / 4.805 / 4.936 |
| 1440 | 5.588 / 5.474 / 5.674 / 5.899 / 5.782 | 4.887 / 5.169 / 4.686 / 4.965 / 5.300 | 6.774 / 4.792 / 4.868 / 5.683 / 4.756 |

与 T-175 同场景原轮 2.767／2.694／2.632 秒的口径核对：源 v2、候选 v3 的完整 code 已逐字段核对，计时夹具均保留；`499c1cf` 与 `c4a72e5` 的三个动态检查模块无行为差异。计时直接调用生产 checkSiteCode，legacyImport 仅跳模型事实核对，不存版本；首档含候选 Chrome 启动，其他档复用，每轮才冷启两只 Chrome。T-175 成功轮原始 checks 在参考树未找到，保存的版本仍有两侧指标；不冒用别轮诊断。早期手写驱动两侧都用 v2、复用五轮浏览器、最初没有检查页同源文档且大多被五秒截断，只作过程证据，不能作为完整分布。

原始完整分布为 `before-production-uncapped/`、`compact-distribution-20261017/`、`compact-inline-distribution-20261017/` 的 timings.json 与 checks。更早候选五次与分段仍保留在 `after-production-uncapped/`、`production-timing-summary.json`，未删。改前分段中位数源／候选读取在 375 为 5372.1／5395.2ms、768 为 5326.5／5358.4ms、1440 为 5453.0／5484.4ms；强制为 63.3／49.2、62.3／56.8、51.3／91.0ms；比较 35.7／37.5／39.6ms；首页视口调用合计 4／11／8ms。旧试验更快样本不证明稳定优化，目标每档 1.5 秒尚未达到。

未采纳试验的五次分段中位数如下，单位 ms，源／候选两侧不能直接相加为墙钟时间：

| 试验／宽度 | 强制状态 | 样式读取往返 | 比较 |
| --- | --- | --- | ---: |
| cached 375 | 79.0 / 58.1 | 4919.4 / 4872.2 | 32.0 |
| cached 768 | 49.0 / 46.5 | 4893.7 / 4866.8 | 38.1 |
| cached 1440 | 44.2 / 55.3 | 4804.6 / 4772.2 | 34.2 |
| inline 375 | 92.4 / 57.3 | 4858.2 / 4890.6 | 35.0 |
| inline 768 | 42.4 / 69.5 | 4877.4 / 4798.2 | 30.9 |
| inline 1440 | 41.0 / 53.6 | 4741.6 / 4687.4 | 30.7 |

为隔离候选效果，又在同一 Chrome、同页 375 串行 A/B 五组，原实现完整探针 2.180／2.278／2.459／2.230／2.238 秒，inline 为 2.085／2.361／2.207／2.218／2.210 秒，均 41 次完整读取、215 CDP、76 次强制，五组完整 states 逐属性一致，未证明显著收益（`reader-ab-control-20261017/results.json`）。这是单侧探针对照，不与两侧生产总时间混写。

### 等价性、验证与未完成项

- 原父版 85／85、cached 86／86 定向通过；T-164/T-173 的 :has(:focus)、兄弟组合器、祖先 hover/active、五类伪元素、自定义属性、媒体条件坏例仍拒，正常对照通过。131 次结论与拒因逐项一致，仅归一随机站点／版本 ID，见 `compact-equivalence-comparison.json` 与 `compact-equivalence.log`。这只能支持已弃用 cached 试验，不能当尚未实现的跟踪方案证据；inline 没另跑该 131 次。
- 完整属性用例改为直接核对公开 probe.states，不依赖压缩传输格式；预期是在强制态仍生效时用浏览器原生逐属性 getter 独立读取，覆盖实时自定义名替换、伪元素出现和三视口。改进后先在父实现 1／1 通过（`public-oracle-parent.log`），父实现故意少读 color 后确实失败（`public-oracle-parent-mutant.log`），随后恢复。此次最终原生产检查点再经标准入口运行，结果 1／1 通过，见 `track-gate-full-style-20261017.log`。
- `npm run typecheck` 本轮通过，最终日志 `final-gate-typecheck-20261017.log`；早先脚本 BigInt 字面量与项目 target 不兼容的失败日志保留，已改为 BigInt(1000)。全量、负载轮、build 没有运行，仍等放行；独立审查由主控另派。未调用 DeepSeek、未读 .env.local、未写主工作区数据、未改服务档或系统设置、未推送。AGENTS 规则未变；tsconfig 的 Next 自动改动不提交。

### 复现命令、提交

以下命令仅设负责人指定 CHROME_PATH。profile 与计时取消截止只发生在脚本传参，生产五秒上限未改。命令都从本工作树根执行；profile、基准和分布的输出目录需用新名字，旧目录不会覆盖。

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --experimental-strip-types scripts/t178-track-capability.ts artifacts/t178/track-capability-drained-20261017
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --experimental-strip-types scripts/t178-read-analysis.ts benchmark artifacts/t178/read-benchmark-20261017
mkdir -p artifacts/t178/read-profile-20261017-node
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --cpu-prof --cpu-prof-dir=artifacts/t178/read-profile-20261017-node --cpu-prof-name=node.cpuprofile --experimental-strip-types scripts/t178-read-analysis.ts profile artifacts/t178/read-profile-20261017
python3 scripts/t178-read-summary.py artifacts/t178/read-profile-20261017 artifacts/t178/read-profile-20261017-node/node.cpuprofile artifacts/t178/read-profile-summary-20261017.json
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --experimental-strip-types scripts/t178-dynamic-timing.ts idle artifacts/t178/<新目录> --uncapped
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- --import ./scripts/t178-capture-checks.ts tests/t164-dynamic-gate.test.ts tests/t164-multi-block-edit.test.ts tests/t164-review-seven.test.ts tests/t173-repair-scope.test.ts tests/t178-full-style-equivalence.test.ts
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t178-full-style-equivalence.test.ts
npm run typecheck
```

原生产测量对应 `7cfd723`（生产与 `c4a72e5` 相同）；未采纳候选对应保留的 patch。本次同一提交保存能力门禁、剖析工具、独立完整属性测试与当前文档，不代表 T-178 完成。SHA、最终定向结果与命令时间在提交后回执写入 `artifacts/t178/track-gate-checkpoint.json`，无额外证据提交。
