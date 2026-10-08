---
id: T-133
title: 首轮评估暴露的底线检查误拦与截图超时：图片显示、行长、编号数字、待补充
type: build
status: closed
blocked_by: []
claimed_by: t133-build
supersedes:
---

## Why

T-130 首轮真实评估（2026-10-08，`artifacts/t130/round-2026-10-08T05-11-25-013Z/`，逐站拒因见 T-130 Resolution）：首稿 8/8 被拒，逐轮 17/22 被拒，最终 3/8 拒收未存版；5 个存版站在截图阶段全部 `Runtime.evaluate` 超时，盲评包没有生成页。拒因多数看起来是检查器问题而不是模型写错：

- **图片无法显示** 11 轮 / 6 站 / 54 条：引用的是已上传的有效编号，同一站修正一轮后有的又能显示，结果不稳定。
- **正文行长** 5 轮 / 5 站 / 46 条：多为页脚目录与邮箱句、参数行、MOQ/交期说明。AGENTS 的底线清单（事实、脚本、外部资源、未授权图片、空链接、Logo 墙、假评价/数字、溢出、重叠、对比度）不含行长。
- **事实/数字**：步骤编号「01–05」、「4」被当成资料没有的数字；电话/地址写「待补充」被拒——AGENTS 明确允许「待补充」。真正的事实改写（「分开介绍」→「分开排产」、漏掉「为主」限定、交期条件改写）是对的拦截，保留。
- **对比度** 2 轮 / 57 条：4.41、4.29，略低于 4.5，属真实问题，但应在引导里给出不会踩线的做法，而不是让模型两轮试错。
- **截图超时**：主工作区真实流程同期也出现 `Page.navigate` 超时与轮询 ECONNRESET；当时机器上并行跑着多组 Chrome。需要分清是负载还是检查链路本身的问题。

## What to build

在根因层修，不放宽事实、脚本、外部资源、溢出、重叠、对比度这些底线：

1. 查清「图片无法显示」的根因（例如模型写了 `loading="lazy"` 而检查在图片进入视口前判定、图片路由在检查时响应慢、编号解析时序），修在检查或解析层；有效编号的已授权图片在三档宽度下稳定判定为可显示。
2. 正文行长改为不拦截的质量反馈：写进版本的检查结果和评估集统计，交给截图打磨与盲评，不触发修正轮。
3. 按主控 2026-10-08 复核决定，删除确定性检查里的手写序号豁免，所有手写数字按事实检查；核心规范引导步骤和列表使用原生 ol 或标准 CSS counter，不手写 01/02。「待补充」本身不当新事实；保留对数值、条件、范围、对象改写的拦截。
4. 核心规范补一句对比度引导（正文、页脚、浅底标签的文字色给出稳妥做法），不改 4.5:1 阈值。
5. 查清截图阶段 `Runtime.evaluate` / `Page.navigate` 超时：在机器空闲时单独复现；若空闲也超时就在根因层修，若只在高负载出现，评估命令改为串行检查并在报告里写明，不靠加长超时或重试掩盖。

## Acceptance

- [x] 每类问题先有能复现的失败用例（取首轮真实拒收的页面片段做夹具），修后通过；坏实现（恢复原判定）应失败
- [x] 在机器空闲时用同一评估命令重跑一轮：成功存版并有截图的组合数、首稿/逐轮/最终拒收率与首轮对照写进 Resolution；事实类真实改写仍被拦下
- [x] 产出完整盲评包（mixed 有生成页、company 有成对题目），交主控安排首轮盲评
- [x] Astra 审查通过；typecheck、test、build 通过

## Resolution

**INCOMPLETE（本次手写序号修复与真实修正 PASS，整票仍待验收），票保持 open，claimed_by=t133-build。** Astra 复核 30cb48c 指出序号豁免仍能绕过。按主控决定，现已完全删除该豁免、独立数字文本副本和单位/段落启发式，手写数字与辅助文案一律走同一事实检查；核心规范改为原生 ol 或标准 CSS counter 引导。四个绕过反例均拒，真实完整五页候选在单次 DeepSeek 修正后采用 counter 并经唯一提交入口存版。本次相关测试、typecheck、默认 Turbopack build 结果见下；旧报价、图片、跨轮与独立验收的限制保留，不宣布全部事实稳定或审美通过。未自行盲评、派审查、关票或推送。

所有改动基于 `279a831`，继续合并为一个本地提交。首批模型运行与检查时 HEAD 为 `158e40af20e5424b4413c94e768b2f7642310f2f`、dirty=true，后并为 `a7bcd12`；首轮 Astra 返工本地验证时 HEAD 为 `a7bcd12`、dirty=true。充值后报价回归时 HEAD 为 `cafa3eb`、dirty=false；本次删除豁免与真实修正验证时 HEAD 为 `30cb48c`、dirty=true。此前交接 JSON 全部保留，最新 SHA、证据与命令见 `artifacts/t133/native-final-handoff.json`。最终生产代码验证后只更新文档与合并提交，没有改写历史轮次或候选。

### 证据前提与根因修复

主控已确认首轮候选 HTML/CSS 随旧 worktree 的 `.sitecraft-data` 删除，不再恢复。真实只读首轮目录为 `/Users/luckye/Documents/Code/sitecraft-ai/artifacts/t130/t130/round-2026-10-08T05-11-25-013Z/`，只剩检查、报告与对照截图。按主控改后的验收办法，先补候选归档，再在其保证的空闲窗口跑诊断轮，用新轮真实拒收候选复现；不把自造 HTML 声称为首轮源码。

- **候选和上传证据**：每次轮询及异常退出前保存 `private/case-N/code-site.json`，包含各轮原始候选、拒因和已存版本；上传的 JPEG、提交许可字段及回执另存 `uploads/` 与 `uploads.json`。诊断轮保留 14 份候选、基线 13 份，含所有被拒候选，后续删 worktree 数据仍可追溯。归档测试在没有版本、任务尚运行时也核验三份不同候选。
- **行长**：首轮 case-8 R0 的拒因原文作最小夹具，外层容器明确是复现所需的构造。删除硬拒因，保留版本 `viewports.longLines` 与评估 `qualityFeedback.body-line-length`，不触发修正轮。其他事实与安全、布局底线未放宽。
- **编号**：诊断 case-6 R0 的真实 `ol/li/span` 01–05 和 CSS 存为 `numbered-steps.json`。确定性检查不再识别或清空任何手写序号，不克隆单独的 numericText，也不检查相邻单位白名单；正文与辅助文案中的全部数字共用来源检查。无资料的手写 01–05 会被拒，模型应改用原生 ol 或标准 CSS counter；标准结构计数沿用 T-128 已有规则。辅助属性从 DOM 完整读取，包括子元素 title/alt/data-label/aria-label；真实“每 2 小时”等参数仍核对资料。
- **待补充**：诊断 case-8 R1 的完整原候选、资料与旧拒因存为 `placeholder-and-facts.json`。只在事实校对的责任层说明占位不是断言，保留数量、条件、范围、对象与承诺的核对；不删除返回拒因、不重试。相同实际候选的真实 DeepSeek 复验不再拒收电话/地址待补充，但仍拒收两个对象范围/交期起算条件泛化（`placeholder-true-facts-live.json`，HTTP200，07:18:49 UTC，21,856 tokens）。这是一次模型成对观察，不是确定性保证。
- **承诺与政策**：Astra 指出“分开报价/报价也分开算”的漏检属于事实校对遗漏。只在 auditCodeFacts 增加报价/收费、付款/结算、交期/响应、售后/质保、认证/文件提供、合作/排产/交付清单，要求找到资料对应原句并核对对象、条件和范围；没有来源就拒收，不以行业常识或产品参数差异补造政策。没有加报价关键词硬拦、返回结果过滤或重试。政策的等价改写仍允许。
- **图片**：诊断轮与基线均未出现首轮的“图片无法显示”；未改图片检查或解析规则、未缩成无图替代。基线六个有授权图片组合实际分别引用 3、3、1、1、2、2 张，其余两个纸包装组合无授权图片。已存诊断 case-1 的实际代码/署名/图片编号与已有授权 JPEG 路径作采集夹具；正常图片三档采集通过、图片 404 必须失败。该证据只能证明本次正常链路和失败不静默放行，不能推断首轮 54 条图片拒因的根因。首轮源码丢失且新轮未复现，所以第一项验收保留未勾选。
- **对比度**：只在核心规范增加正文、页脚、浅底标签的用色余量建议，4.5:1 阈值和实际文字填充色检查不变。T-128 的真实低对比度反例仍拒收。

### 截图超时与对照图采集

空闲诊断轮 7 个已存版站均在截图阶段 `Runtime.evaluate` 超时；单独打开已存 case-1，文字、公司、字体和授权图片均已载入，只有页面内异步滚动的 `setTimeout` 回调不执行。预览的 `sandbox allow-forms` / `script-src 'none'` 禁脚本，采集器却依赖页内定时器，构成链路错误（`capture-scroll-isolated-red.txt`，07:13:47 UTC）。不是仅高负载现象；没有证据把首轮同期的 `Page.navigate` / ECONNRESET 也归因于此。

修复为采集进程逐段滚动并等待，页面内只做同步 scrollTo；保留原 30 秒滚动、25 秒载入和 30 秒 CDP 预算，不启用预览脚本、不加重试、不延长超时。实际诊断候选在同一预览 CSP 下 1440/768/375 完整采集，脚本仍不执行、滚动回顶、坏图片拒绝；真实基线 8/8 采集成功，零截图超时。

包自查还发现国茂首屏标题处于入场帧。独立观察显示截图前 opacity=1 且无动画，`Page.captureScreenshot(captureBeyondViewport:true)` 后变成 opacity=0.15233 并重新出现 home-title 动画（`shot-resize.txt`）。官网 CSS 的桌面媒体查询入口与最小媒体查询夹具复现同一问题。首屏改为当前视口采集，只有整页启用超视口采集；截图前在原载入预算内等待可见有限动画结束，不关闭动画。修后相同国茂、方正网址各采集一次并打开核查。此前试探性的 inline 样式稳定等待未解决实际问题，已删除；其失败输出与早先 handoff 目录保留，不作成功证据。

### 首轮、诊断轮与修后基线对照

UTC 时间；均真实 deepseek-flash。两个新轮在主控给出的空闲窗口串行执行，运行期间没有并行重负载，只关闭自己的进程。密钥仅用 `set -a; source /Users/luckye/Documents/Code/sitecraft-ai/.env.local; set +a` 加载。应用为本 worktree 的 3144、SITE_STORE=fs、默认 Turbopack，CHROME_PATH 使用 AGENTS 指定的 chrome-headless-shell。

| 轮次 | 存版 / 有截图的组合 | 首稿拒收 | 逐轮拒收 | 最终拒收 | 已存版站截图超时 |
| --- | --- | --- | --- | --- | --- |
| 首轮 05:11:25 | 5/8；0/8 | 8/8，100% | 17/22，77.3% | 3/8，37.5% | 5 |
| 空闲诊断 06:42:00–07:11:56 | 7/8；0/8 | 5/8，62.5% | 7/14，50% | 1/8，12.5% | 7 |
| 修后基线 07:59:10–08:28:00 | 8/8；8/8 | 4/8，50% | 5/13，38.5% | 0/8，0% | 0 |

这是不同实际生成的运行率对照，不是同一候选的审美胜率。首轮错误发生在截图，`outcome=error` 不等于未存版，不能只按 generated 数统计存版率。

诊断命令（在上述密钥加载后）：`CHROME_PATH=<指定路径> SITECRAFT_BASE=http://127.0.0.1:3144 npm run eval:new-route -- --previous /Users/luckye/Documents/Code/sitecraft-ai/artifacts/t130/t130/round-2026-10-08T05-11-25-013Z/`，输出 `artifacts/t130/round-2026-10-08T06-42-00-597Z/`。基线同命令，previous 改为 `artifacts/t130/round-2026-10-08T06-42-00-597Z`，输出 `artifacts/t130/round-2026-10-08T07-59-10-005Z/`；两个目录均不覆盖。

基线 34 页、68 张整页截图加 8 张首页首屏，共 76 张生成截图；全部逐张打开作技术自查（`artifacts/t133/viewed-final.json`），不宣布审美通过。三档提交检查每轮执行。34 次模型调用均 HTTP200、用量齐备：输入 183,881、输出 420,288、合计 604,169 tokens。基线仍有 5 轮、4 站、9 条真实事实拒因；长行质量反馈为 8 轮、6 站、18 处，不触发修正。原摘要误将带“正文”的事实拒因归为对比度，已修分类并在新交接摘要重算，原轮次摘要不覆盖。

### INCOMPLETE 与盲评包交接

基线 `errors=[]`、8 个 outcome 全 generated；INCOMPLETE 不是本轮缺生成图，而是 previous 指向诊断轮，后者没有生成页截图，8 道跨轮题均缺图。修复覆盖报告的责任边界：新增 `review.complete/missing` 与 `comparison.requested/complete/missing`；总体 complete 仍要求所有已请求部分齐备，命令仍 exit1，不把缺比较改成成功。

交接目录 `artifacts/t133/handoff-2026-10-08T11-31-41-332Z/`：

- `review/mixed/`：16 个匿名样本（8 生成首页 + 8 个不同真实官网），齐备可交独立 mixed 评审。
- `review/company/`：12 道不同公司成对题，每个候选有 1440/375 首页，齐备可交另一个新评审实例。
- `comparison-review/`：0 道，缺 8 道，**不可评审**；没有伪造旧图或补跑旧模型代替历史候选。
- `private/`：候选、图片上传记录、全部原始截图、映射、覆盖报告、重算统计和原比较报告；主控保管，不能交盲评实例。

交接包以未改写的基线输出重打包，只按相同网址重采国茂/方正首屏，原对照图仍保留；模型调用新增 0，原总体 INCOMPLETE 保留。可复现命令：`CHROME_PATH=<指定路径> node --experimental-strip-types artifacts/t133/repackage-handoff.mjs`，每次创建新目录，过程与时间见 `private/repackaging.json`（本次完成 11:31 UTC）和 `handoff-root-final.txt`。早先原包与各次不合格 handoff 不删除，主控应只交本节指定的两个最新包。

### 坏实现失败与当前验证

红证据及输出在 gitignore 的 `artifacts/t133/`；失败必须为目标行为的 AssertionError 或实际超时，导入/启动错误不算红证据。下面列的是相同契约的成对验证，不把最初缩小输入未复现的模型回答当作通过。

| 检查 | 坏实现/原行为失败证据（UTC） | 修后证据 |
| --- | --- | --- |
| 行长不拦且反馈不丢 | `line-parent-red.txt` 06:22:47；`check-line-mutants.py` 三个变异（恢复拒收/丢版本统计/丢评估统计），`line-mutants/report.json` 06:31:49，全 AssertionError | `t133-floor-checks` 通过真实 commitSiteCode/FS/三档 Chrome；最终相关集通过 |
| 手写序号回到事实检查，标准结构计数通过 | 30cb48c 上 `native-numbers-parent-red.txt`：四种数量绕过均错误放行；手写步骤旧契约放行，按主控新契约测试失败，共五个目标 AssertionError | `native-numbers-green.txt` 8/8；手写 01–05 与四种无来源数量拒，原生 ol 和 counter 修正后通过。先前按序列豁免的红绿/变异证据仅保留为已被取代的历史 |
| 占位不当断言，真实范围/条件仍拒 | 诊断 case-8 R1 原检查拒占位，同时含真实事实改写；夹具保存全代码 | `recheck-placeholder.mjs` 的真实 HTTP 成对复验，仅去占位误拒、保留两条真实拒因；模型不确定性另记限制 |
| 未存版/运行中的候选也归档 | `archive-parent-red.txt` 06:40:57，旧实现没有归档函数，明确 AssertionError | `t133-eval-evidence` 核验三份原候选，与真实两轮归档共同作证 |
| 预览禁脚本仍能完整截图 | `capture-scroll-isolated-red.txt` 07:13:47 与 `capture-parent-red.txt` 07:20:55，实际 CSP 下原采集超时 | `capture-root-green.txt` 4/4，11:31:28；真实基线零超时 |
| 对照首屏不捕获动画帧、不重启动画 | `control-motion-parent-red.txt` 10:36:57、`control-late-parent-red.txt` 10:49:03；`control-media-parent-red.txt` 11:30:35，媒体查询夹具 opacity=0.0708201 而非 1 | 同一用例 opacity=1；相同真实网址重采并打开，最新包齐备 |
| 本轮审包和跨轮缺图分开报告 | `coverage-parent-red.txt` 10:25:57，旧实现没有 review 状态；总体仍须 incomplete | `t130-blind-privacy` 核验齐备当前包/缺历史包及缺本轮图两个反例，匿名隔离/文件元数据检查保留 |
| 带“正文”的事实不能统计成对比度 | `reason-parent-red.txt` 10:25:09，基线实际拒因在旧分类失败 | `t130-eval-set` 成对校验事实与真实对比度统计，最新私有摘要 9 条事实 |

最终命令及完成时间（UTC）：

- `CHROME_PATH=<指定路径> node --test --experimental-strip-types --test-concurrency=1 tests/t128-code-boundary.test.ts tests/t130-run-records.test.ts tests/t130-eval-set.test.ts tests/t130-blind-privacy.test.ts tests/t133-floor-checks.test.ts tests/t133-capture.test.ts tests/t133-eval-evidence.test.ts`：61/61，exit0，无失败/取消/跳过，11:32:57，`related-root-final.txt`。包括安全资源、真实数量、布局与对比度原底线。
- `npm run build`：默认 Turbopack，exit0，11:33:11，`build-root-final.txt`；随后 `npm run typecheck`：exit0，11:33 UTC，`typecheck-root-final.txt`。顺序运行，没有生成类型竞争。
- 全套 `SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:3144 CHROME_PATH=<指定路径> npm test -- --test-concurrency=1`（按规定 source 环境）：07:40:05，2567/2569、exit1，`npm-test.txt`。失败为 T090 固定旧站点记录 561a1113… 缺失导致 scan.json 不存在，以及 T113 三个固定旧站点图片路由 404；本票未改该两项。没有复制主工作区数据、切端口或改断言掩盖；这是较早全套负证据，采集/报告最终修改后只重跑上述相关集，不能称最终全套通过。

### Astra NO_GO 返工验收

P1 首轮返工的历史证据：两个原反例先在 a7bcd12 复现：`<li>配有<span>1</span>台数控车床</li>` 与 `<span><b title="产能 987654 台">01</b></span>` 均被错误放行。此前收窄序列/段落/单位仍被 Astra 在 30cb48c 判 NO_GO，因此该识别算法已全部删除，不再继续补单位表。当前属性反例仍拒，原手写 01/02 也拒；有来源的属性改用无手写标记的正例后通过并进入语义审计。

先前父实现对照命令：`CHROME_PATH=<指定路径> node --test --experimental-strip-types --test-name-pattern='inline equipment|descendant attributes' tests/t133-floor-checks.test.ts`。临时恢复 a7bcd12 的 code-site-check.ts、finally 恢复文件：11:55:57 UTC，exit1，两个目标 AssertionError（`astra-numeric-parent-final-red.txt`、`astra-numeric-parent-comparison.json`）。这是首轮返工历史，不作为当前序号契约的完成证据。原始首次失败与初次错误观察审计输入的测试失败都保留，后者不算产品红证据。

P2 夹具 `tests/fixtures/t133/pricing-candidates.json` 保存基线 case-7 R0、case-8 R0 的完整原始候选、资料、原检查与来源。case-7 原拒因明确拒“两类分别报价”；case-8 原检查 passed=true 却包含“分开报价”“报价也分开算”“报价按产品分开算”，这就是旧事实提示的实际漏检证据。验收依据来自 Astra 和原始资料，夹具的预期拒收原句不传给模型。

真实回归命令（必须先按规定加载密钥）：`set -a; source /Users/luckye/Documents/Code/sitecraft-ai/.env.local; set +a`，随后 `CHROME_PATH=<指定路径> node --experimental-strip-types scripts/check-t133-live-facts.ts artifacts/t133/astra-policy-live-recharged-2026-10-08`。脚本经同一 checkSiteCode、真实 Chrome 与真实 deepseek-flash 检查，每个候选固定串行 3 次，不是失败后重试；每次必须实际调用 facts 且 HTTP200，并明确拒该候选的报价安排，不能拿其他拒因冒充政策检查成功。只有空白 HTML 来源用本地临时服务，模型服务不得换成夹具。预期原句只在验收侧使用，不传给模型；生产代码没有报价关键词拦截或返回结果过滤。

前次首次调用（case-7 第 1 次）HTTP402 的失败保留在 `astra-policy-live.txt` 和 `astra-policy-live-2026-10-08/command-failure.json`，没有补造其缺失用量。负责人确认充值后，按要求先做一次最小事实校对：`node --experimental-strip-types artifacts/t133/check-recharged-minimal.mjs`，资料与页面同为“边界机械从事精密零件加工”，返回 HTTP200、issues=[]。时间 2026-10-08 12:53:25.494–12:53:26.869 UTC，输入 755、输出 61、合计 816 tokens；证据 `recharged-minimal-2026-10-08.json`。这只证明充值后可调用，不代替原始候选验收。

随后固定六次全部 HTTP200、检查拒收，均只有一次真实 facts 调用、用量齐备，命令 exit0（`astra-policy-recharged.txt`、轮次 `summary.json`）。逐次完整拒因、viewport 检查、调用时间与用量在该目录的 `case-N-run-M.json`；人工读过全部六次拒因，再按 Astra 已指定的原句核验 `target-coverage.json`，每次所有目标报价句均被报告，没有把其他拒因当成功。期间没有并行启动其他重负载。

以下时间均为 2026-10-08 UTC，终点为结果记录时间；token 依次为输入 / 输出 / 合计：

| 原候选 / 次数 | 事实调用开始 → 结果记录 | tokens | 报价政策结果 |
| --- | --- | --- | --- |
| case-7 / 1 | 12:54:33.741 → 12:55:12.591 | 3,002 / 8,331 / 11,333 | 拒首页和产品页“两类分别报价” |
| case-7 / 2 | 12:55:13.214 → 12:55:28.396 | 3,002 / 3,709 / 6,711 | 同两句明确拒收 |
| case-7 / 3 | 12:55:29.004 → 12:55:42.010 | 3,002 / 2,904 / 5,906 | 同两句明确拒收 |
| case-8 / 1 | 12:55:42.566 → 12:55:57.423 | 2,903 / 3,625 / 6,528 | 拒“分开报价”“报价也分开算”“报价按产品分开算” |
| case-8 / 2 | 12:55:57.980 → 12:56:53.973 | 2,903 / 13,190 / 16,093 | 同三句明确拒收 |
| case-8 / 3 | 12:56:54.532 → 12:57:48.113 | 2,903 / 12,535 / 15,438 | 同三句明确拒收 |

六次回归输入 17,715、输出 44,294、合计 **62,009 tokens**；加一次最小确认调用，已知成功用量 **62,825 tokens**。case-7、case-8 均 3/3 拒指定报价承诺，没有放过该目标句的轮次；这是本次指定样本的 PASS，不推广成其他政策都能稳定检出的结论。

另有观察差异必须保留：case-8 第 3 次还拒“结构设计、白样、胶印、模切、糊盒在同一个厂里完成”，理由是资料只列加工能力与设备、没有同厂完成或合作安排原句；前两次未报告这句。第 2 次另外指出“交期各不相同”不成立（折叠彩盒和瓦楞运输盒交期相同），第 1、3 次没有指出这一对象范围问题。三个候选检查均已因报价政策拒收，所以未发生存版放行；但这些额外事实的逐句检出并不稳定，不能宣布整票事实校对稳定 PASS。未继续换提示或加抽样掩盖差异，也没有补造资料、关键词硬拦或手改历史候选。

真实回归后的最终本地验证（UTC，HEAD=cafa3eb，生产代码未再修改）：

- `CHROME_PATH=<指定路径> node --test --experimental-strip-types --test-concurrency=1 tests/t128-code-boundary.test.ts tests/t130-run-records.test.ts tests/t130-eval-set.test.ts tests/t130-blind-privacy.test.ts tests/t133-floor-checks.test.ts tests/t133-capture.test.ts tests/t133-eval-evidence.test.ts`：63/63，exit0，`recharged-related-final.txt`。
- `npm run build`：默认 Turbopack，exit0，`recharged-build-final.txt`；随后 `npm run typecheck`：exit0，`recharged-typecheck-final.txt`。准确完成时间见最新交接 JSON。
- 按用户要求没有重跑整轮生成评估；旧基线拒收率与截图不冒充本次政策提示的生成评估。没有自行派盲评或审查，Astra 复审仍待主控。

### 最终序号根因修复与真实修正

主控在 Astra 复核 30cb48c 后决定不再维护序号识别启发式。当前数字检查只使用同一份正文与辅助文案 readable，删除 numericText、克隆/清空标记、连续序列/段落判定及单位白名单。核心规范原来笼统禁止 counter 的句子同步改为：事实文案在 HTML 中，结构序号用原生 ol 或标准 CSS counter，不手写 01/02。没有添加第二套数字路径、阈值例外或关键词拦截。

回归命令 `CHROME_PATH=<指定路径> node --test --experimental-strip-types --test-name-pattern=handwritten tests/t133-floor-checks.test.ts` 在尚未改生产代码的 30cb48c 上 exit1，五个目标 AssertionError，保存 `artifacts/t133/native-numbers-parent-red.txt`：名工程师、条自动产线、kW 装机功率、L/min 额定流量四种带 1/2 的列表都被错误放行；真实手写 01–05 步骤按新契约应拒、旧契约放行（该项属于主控要求改变契约的红证据）。修后同文件完整运行 `native-numbers-green.txt` 8/8：四种数量及手写步骤拒，真实步骤改原生 ol 和 decimal counter 均通过，正文量值、子元素属性和原有坏数量仍拒收。

真实单次修正使用主控授权重取证的诊断首轮 `artifacts/t130/round-2026-10-08T06-42-00-597Z/private/case-6/code-site.json` 的 R0 完整五页候选；其原始拒因就是手写 01–05。原 T-130 05:11 首轮 HTML 已丢失，不声称恢复该源文件。新建本 worktree 的独立站点，按原上传记录重新上传相同两张授权 JPEG、仅映射系统分配的新图片编号；事实、页面、风格与 CSS 初稿不改。初次 commitSiteCode 拒收五个数字、版本数仍为 0。

命令（先按规定 source 密钥）：`CHROME_PATH=<指定路径> node --experimental-strip-types artifacts/t133/check-native-repair.mjs`，3144 为本 worktree 的默认 Turbopack dev 服务。调用实际 writeSiteCode 修正入口，current 为被拒候选、issues 为入口的五条数字拒因；request 只要求保留未要求改的页面/事实/图片并修正问题，没有把 ol/counter 答案写进请求或拒因。只调用一次写作、不做重试，修正版再次走唯一 commitSiteCode；没有旁路存版或修改旧站点。

结果 **PASS**，2026-10-08 13:20:23.152–13:22:20.133 UTC，运行时 HEAD=30cb48c + dirty：

- writer 主动删除 span 中手写 01–05，保留 `<ol class="steps">`，新增 `counter-reset:step`、`counter-increment:step` 和 `li::before{content:counter(step) "."}`；采用默认 decimal 计数，五条质检内容保留。
- 五个规划页面、两张授权图片保留，15 组页面×375/768/1440 检查全部 overflow=0、overlaps=0、contrastIssues=0，事实校对 issues=[]；长行仍仅记录，未放宽其他底线。
- 新站 b35747a1-df54-4b09-add5-da1bdf95d50d，第 1 版 9218dbe0-c93f-45bb-a935-09758390de7f，经入口检查后存版。全候选、前后入口结果、上传回执、用量在 `artifacts/t133/native-repair-2026-10-08T13-20-23-151Z/report.json`。

| 调用 | UTC 开始 | 延迟 ms | HTTP | 输入 / 输出 / 合计 tokens |
| --- | --- | --- | --- | --- |
| write（唯一一次修正） | 13:20:26.360 | 31,849 | 200 | 15,556 / 11,653 / 27,209 |
| facts（提交入口校对） | 13:21:00.192 | 79,902 | 200 | 4,955 / 20,949 / 25,904 |

本次两次调用共输入 20,511、输出 32,602、合计 **53,113 tokens**，用量齐备。成功证明这份真实拒收候选在一轮修正中能采纳核心引导，不推广为模型所有修正都能成功。

随后 `capture-native-repair.mjs` 经实际 code-preview 采集生产与质检页 1440/768/375，三张 `quality-宽度.png` 全部逐张打开；CSS counter 的 1–5 可读，图片完整。`observed-counter.json` 保存计算样式观察，非像素或哈希比较。375 导航折行仍较碎，本票未做视觉打磨、不自行宣布审美通过。只关闭自己的 3144 dev 进程后再跑本地检查，没有并行重负载或重跑整轮评估。

最终检查（生产代码未再改）：`CHROME_PATH=<指定路径> node --test --experimental-strip-types --test-concurrency=1 tests/t128-code-boundary.test.ts tests/t130-run-records.test.ts tests/t130-eval-set.test.ts tests/t130-blind-privacy.test.ts tests/t133-floor-checks.test.ts tests/t133-capture.test.ts tests/t133-eval-evidence.test.ts` → `native-related-final.txt`，67/67、exit0，失败/取消/跳过均 0；`npm run build` 默认 Turbopack → `native-build-final.txt`，exit0；随后 `npm run typecheck` → `native-typecheck-final.txt`，exit0。完成时间与最终 amend SHA 见 `native-final-handoff.json`，地图与 UTF-8 回读见交接检查。

### 保留限制与后续验收

1. 图片误拦根因未能确认；本次稳定不等于首轮异常已修。原始候选已失去，新轮没有同类拒收，所以没有符合该类要求的真实坏实现红绿对。
2. 未修改的历史基线 case-8 存了无来源报价安排，0/8 最终拒收只代表当时检查结果。充值后两份原候选各 3 次均拒指定报价句，额外“同厂完成”及“交期各不相同”的逐句检出仍有差异，不能宣布全部事实正确。原审包仍是该历史候选的视觉证据，没有重跑整轮或手改历史版本；报价回归证据与旧生成证据分别保留。
3. T-130 运行记录测试初次全站低对比度构造产生 24 条拒因、1121 字 summary，超过 `MAX_ALIGNMENT_SUMMARY_CHARS=400`，暴露 `Invalid alignment snapshot`（`related-green.txt`）。失败和站点记录保留；最终夹具收窄到所测单段，不声称大量拒因的快照问题已修。
4. T-128 已知 line-height:0 极端重叠和 filter 后对比度限制保留，不借本票放宽阈值。跨轮审美比较没有可用旧图；本轮审美与 Astra 都待主控派独立实例，执行者不宣布通过。

第一项和第四项验收保留未勾选。CONTEXT、mainline、spec 已同步当前实现；项目地图 status 无问题、无过时 living doc。外部邮件与生产数据库未测，不作为本票完成条件。

### 合并验收（Claude，2026-10-08）

Astra：a7bcd12 NO_GO（序号豁免过宽；case-8「分开报价」漏检）→ 30cb48c NO_GO（序号豁免仍可绕过；主控决定删除豁免、改由规范引导原生 ol / CSS counter）→ 8c68f33 收窄复核 PASS（t133-astra3，09:39 EDT）。主控验收第一项：行长、序号、待补充、承诺、截图链路均有真实候选夹具与坏实现失败证据；首轮「图片无法显示」因首轮候选随 t130 worktree 数据被主控误删而无法复现，两轮空闲评估均未再现，正常图通过、404 拒收已证——按已复现部分验收，图片项残留风险由后续评估轮统计继续观察。已知限制：模型事实校对对次要表述不稳定（同一候选三次中偶有检出差异），承诺类目标句 6/6 拒收。合并为 cec1913；主工作区 3034：`npm run typecheck`、`SITECRAFT_BASE=http://127.0.0.1:3034 CHROME_PATH=<指定路径> npm test` 2587/2587、`npm run build` 通过（输出 gitignore 的 `artifacts/merge-cec1913/`）。

基线盲评（主控安排，评审 blind133-m / blind133-c，新 gpt-6.1-sol 实例，各只读隔离副本；解盲见 `artifacts/blind-baseline-2026-10-08/summary.md`）：mixed 生成页识别 8/8（未达 ≤50%），company 判同模板 0/12（通过）。改进转 T-132。

