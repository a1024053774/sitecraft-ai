---
id: T-185
title: 事实核对两类协议失败：claim 越段与 issues 返回对象
type: build
status: closed
blocked_by: []
claimed_by: codex-fast-t185
supersedes:
---

## Why

T-180 重跑的 20 站里有 2 站在事实核对协议处失败，没有生成版本，影响主流程（优先级 2）。T-181 已经开始保存原始回复，这次两站的原文都存下来了：

- **packaging/precision（第 1 轮 case-7）**：claim 不属于当前核对段，报错为 `资料出处声明不在本核对段：折叠彩盒规格 折叠彩盒规格 [scope=row] 起订量 3000 个`。T-181 没有复现这个问题，这次复现了。原文在 `artifacts/t180-r2/round1-full/private/case-7/code-site.json`，即 facts 调用的 response.rawBody.body，同一文件里有 59 段的 factInput 映射。
- **restaurant/neighborly（第 2 轮 case-2）**：`results[12].issues[0]` 返回的是 object，合同要求 string（`lib/code-site-model.ts:340–343`）。见 `artifacts/t180-r2/numbered-failure-analysis.json`。

## What to build

1. **从原文找根因**：
   - 越段的 claim 带着重复的表头和 `[scope=row]` 标记，像是 claimTexts 或表格行文本的构造把表头、属性标记带进了可复制的文本，也可能是模型拼接了内容。用原文和 factInput 映射确认到底是哪一种。
   - issues 返回对象：确认提示或 schema 有没有让模型以为 issue 可以是结构体。
2. **在根因层修**：可以修 claimTexts 构造、提示措辞或协议 schema 描述。
3. **严格协议不放宽**：不宽松解析，不把 object 转成字符串收下，不重试掩盖。如果根因确实在模型这一侧、提示层没法消除，就如实写明，交回构思主控决定。
4. **成对测试**：用这两份真实原文做夹具，先在旧实现上复现失败，再验证修复后通过。
5. **真实探针**：在这两个组合上各跑一次，预算网关显式 `SITECRAFT_TOKEN_LIMIT=500000`，用新账本。

## Acceptance

- [x] 两类失败的根因写进 Resolution，附原文定位
- [x] 成对测试先红后绿；两组合真实探针结果如实记录（用量、成败）
- [x] typecheck、test、build 通过；独立 fast 审查通过

## Resolution

PASS，已关闭，执行实例 `codex-fast-t185`，分支 `t185-fact-protocol`，父版本 `a6e06d746c634f20c119bedbfb9048d47c2593fa`。类型检查、两轮全量、build 及两个生成探针均通过；评估命令本身因外部对照截图和盲评包不齐 exit=1，详情见下文。执行者未派审查或盲评实例，不宣布审美通过。

REALITY GATE: PASS。目标是减少严格事实协议导致的主流程失败；非目标是不放宽 schema、claim 归属或 quote 验真，不改输入构造、不转对象、不重试。真实原文支持最小提示修复，本次获批的两个生成探针也通过严格协议；模型能否在未来所有输出中遵守合同仍无保证，不追加模型调用来追求这一结论。

### 原文归因（2026-10-19）

原证据根为 `/Users/luckye/Documents/Code/sitecraft-ai/artifacts/t180-r2/`，以下均用该绝对路径读取，未改写主工作区。

- `round1-full/private/case-7/code-site.json`：`$.run.modelCalls[1]`（同条也在 `$.runs[1].modelCalls[1]`），purpose=facts，factInput 共 59 段。解析 `response.rawBody.body` 后取 `choices[0].message.content`，其中 `results[24].citations[1].claim` 原文为 `折叠彩盒规格 折叠彩盒规格 [scope=row] 起订量 3000 个`。对应 `factInput.segments[24]` 为 s25，`claimTexts[0]` 以 `折叠彩盒规格 折叠彩盒规格` 结尾，`claimTexts[1]` 恰为 `[scope=row] 起订量 3000 个`。TR 边界已将两条分开，模型跨条拼接，严格校验正确拒收。原回复共六处同类拼接：s25/s26、s32/s33、s38/s39，分别为三种包装的起订量和交期。
- 重复标题确实由 `readCodeFactSegments` 的简单表格 labels 构造带入：`read(structure, skip TR)` 已读取 caption，headers 又读取 caption；`[scope=row]` 来自 `own()` 的结构属性。输入带有这些文字，但没有提供跨条连续 claim。可消除的提示诱因是原文同时要求「单条连续子串」和「包含声明所需的对象、条件与范围」，而标题对象与数据行恰位于不同条目。修复明确 claim 只定位原句，语义仍结合本段及同组完整核对，不把上下文补进 claim；不靠扩大范围接纳旧坏回复。
- `round2-selected/private/case-2/code-site.json`：同路径调用共 40 段，正文同样解析后的 `results[12]` 为 s13，`issues[0]` 原文是 `{"type":"事实不符","description":"资料只说明服务社区为杭州市拱墅区，未说明门店位于杭州市拱墅区。"}`。`numbered-failure-analysis.json` 的 `schemaIssues[0].path=["results",12,"issues",0]`、expected=string、received=object 与原文吻合；编号没有缺失、重复或越界。Zod 从未允许 object，提示也没有主动要求结构体；但只示范空 `issues:[]`，未说明非空元素类型，provider 仅收到 json_object，模型自行选择结构体。修复仍用 json_object，只将原接收 schema 转为 JSON Schema 写进提示，并明确字符串拒因格式；生产代码不转换对象、不重试。

### 离线证据与边界

两份真实 HTTP 正文逐字保存为 `tests/fixtures/t185/{packaging,restaurant}.json` 的 rawBody，连同原 59/40 段映射、资料及来源，不依赖主工作区运行测试。`tests/t185-fact-protocol.test.ts` 从实际 auditCodeFacts HTTP 边界回放原坏正文，整站/局部均一次调用直接拒收，保存原文、用量、finish_reason 和编号映射。合法对照只手工替换六条 claim 为原数据行连续子串、将餐馆问题另写成字符串，其余真实回复与事实拒因保留；生产代码从不进行这类修补。

父版本命令：`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t185-fact-protocol.test.ts`。`artifacts/t185/parent-red-utf8.log` 记录 8 项中 4 通过、4 预期失败：缺复制边界说明 2 项、缺 issues 类型 2 项。首次 `parent-red.log` 中测试替身各自解码 UTF-8 网络分块，导致不完整中文，不计作缺陷红态；改为 Buffer.concat 后重跑，首次失败保留。离线测试只证明提示合同和严格解析边界，不证明真实模型理解。

Deep modules：一个 Zod schema 同时描述和校验回复，不添加平行协议。Ubiquitous language：claim 是网页原句定位，quote 是资料原句，issues 是字符串拒因数组。Tracer bullet：沿现有事实 HTTP 调用及任务记录边界验证，真实探针再经过原 chat、提交、存版流程。

### 当前候选验证

源码与测试候选为 `2be32a6eb28d71fbfd35e676a9f97a7af769d3a6`；该提交之后只补本票验收记录。所有命令在本工作树运行，时间为 UTC（本地为次日）。

| 检查 | 命令与结果 | 本次证据 |
| --- | --- | --- |
| 相关测试 | `CHROME_PATH=上述路径 npm test -- tests/t185-fact-protocol.test.ts tests/t181-claim-copy.test.ts tests/t181-fact-replies.test.ts tests/t169-production-contract.test.ts tests/t173-citation-repair.test.ts tests/t158-general-prompts.test.ts`，48/48 | `artifacts/t185/related-green.log`；本次协议请求与原文在 `artifacts/t185/protocol-*/` |
| 类型检查 | `npm run typecheck`，通过 | `artifacts/t185/typecheck-fixed.log`；首次仅新测试 overload 推断失败，改为显式 Fixture 类型，原失败保留在 `typecheck.log` |
| 入口回归 1/2 | `node --test --experimental-strip-types scripts/t167-runner-regressions.ts`，均 18/18 | `artifacts/t185/runner-regressions.log`、`runner-regressions-2.log` |
| 全量 1 | `CHROME_PATH=上述路径 npm test`，853/853，0 失败；2026-10-18 21:26:22 UTC 结束 | `artifacts/t185/full1.log`、`full1-report.json`，原目录 `artifacts/t167/test-run-1792358091067-23344/` |
| 全量 2 | 同一命令与候选，853/853，0 失败；21:38:26 UTC 结束 | `artifacts/t185/full2.log`、`full2-report.json`，原目录 `artifacts/t167/test-run-1792358810710-96103/` |
| 构建 | `npm run build`，通过 | `artifacts/t185/build.log` |

两轮均为非浏览器 114 项、浏览器 739 项，并发 2，无跳过，未改断言或预算。两轮全量及 build 启动前均查 memory_pressure，记录为 `full1-memory.txt`、`full2-memory.txt`、`build-memory.txt`。真实夹具的 rawBody 与 factInput 已逐字对照主工作区原文件；packaging 原响应 reasoning_content 自带三处 U+FFFD，忠实保留，不修补历史正文。相关测试的标准入口成功目录后来按入口保留窗口自动清理，`related-green.log` 与本票 `protocol-*/` 原文输出仍保留；两轮全量报告已另存，不依赖入口窗口。

### 唯一获批的真实探针（2026-10-18 21:39–21:47 UTC）

命令为 `SITECRAFT_BASE=http://127.0.0.1:50281 SITECRAFT_BUDGET_BASE=http://127.0.0.1:50282 SITECRAFT_TOKEN_LIMIT=500000 CHROME_PATH=上述路径 npm run eval:new-route -- --only packaging/precision,restaurant/neighborly --out artifacts/t185/real-probe`。源码仍为上述同一候选；启动命令保存在 `artifacts/t185/{gateway,app,eval}.sh`，不含真实密钥。仅网关进程 source 主工作区 `.env.local`，应用仅持占位凭据；健康检查确认 cwd 为本工作树、dataRoot 为本工作树的 `artifacts/t185/probe-data`，未写主目录 `.sitecraft-data`。唯一新账本是 `artifacts/t174/t185-fact-probe/usage.json`，显式累计上限 500000，实际 **180732 token**，六次调用全部 HTTP 200，用量未知 0，无 HTTP 失败、截断或重发；未续账、未改预算。

| 组合 | 结果与本次用量 | 生成站与版本 |
| --- | --- | --- |
| packaging/precision | generated，首次 55 段核对通过，88717 token；3 页共 9 档底线检查通过 | site `470524ad-8e5b-497c-b99d-06e6944480a2`，v1 `75be3a5c-117b-4a45-bf52-dcbfb0c64fdb` |
| restaurant/neighborly | generated，首次 30 段核对通过，92015 token；3 页共 9 档底线检查通过 | site `5bc5fb1b-1f04-4bd4-ad91-84cc2916e090`，v1 `5c108928-dafd-4ccf-8b31-ea91a18e5f25` |

原文与映射保存在 `artifacts/t185/real-probe/private/case-{1,2}/code-site.json` 的 `run.modelCalls[1].response.rawBody.body` 及 `factInput.segments`（generate 调用包含写页和 facts；若查询合并的 runs 列表，facts 为全列表第 3 次调用）。事实正文分别 30624、83260 字符，finish_reason 均 stop；85 个输入编号全部恰好返回一次，61 条模型引用 claim 全在当前编号的一条复制文本内，quote 全命中版本来源快照；完整版本聚合出处 17/31 条。摘要见 `artifacts/t185/raw-fact-analysis.json`。

packaging 本次仍有 24 个表格段，s21/s22、s28/s29、s35/s36 的起订量和交期全部只复制数据行文字，未拼接重复 caption 或 `[scope=row]`。restaurant 本次没有非空 issues，因此真实运行仅证明本次未再出现对象型问题；非空字符串及原 object 拒收边界由真实旧正文的离线成对用例证明，不能宣称一次探针保证模型永不违规。

两站各 3 页 × 1440/768/375 与首页首屏，共 20 张生成站截图均已逐张打开，确认有实际正文、页尾及图片，不是载入态或空白；截图位于各 case 目录，不做独立审美结论。

**评估命令 exit=1，轮次为 INCOMPLETE。** 两站生成均成功，`round.errors[0]` 为外部 `restaurant/1`（Blue Frog）对照「页面入场或转场未结束，本次未保存截图」；已收集 3 份真实官网对照，mixed/company 包因独立对照不足不齐备，`private/blind-coverage.json` 明确记录缺项，未请求跨轮比较。未修改截图工具、替换对照、绕过打包或重跑模型。此项外部截图失败不冒充生成失败，也不把整个评估命令报 PASS。

评估器退出后，经普通 dev 的 draft HTTP 再读回两站，确认当前及历史 runs 全部 complete；经网关 `/status` 核对六次调用 complete、进行中 0、未知用量 0，保存 `artifacts/t185/terminal-before-stop.json` 后，才手动停止网关与 dev，两进程均已退出。测试与构建自动新增的 tsconfig 类型目录 include 已还原，不进入功能 diff；还原后 `npm run typecheck` 再次通过（`artifacts/t185/typecheck-delivery.log`）。只做本地提交，不推送；工作树及探针数据保留给主控审查。

**审查与主线验证。** 新 fast 审查实例审 `a6e06d7..8661ee6`，结论无需修复：六条坏 claim 确为跨 claimTexts 拼接（重复表题来自输入构造，但行边界与可复制范围计算无误），餐馆原文证实 issues 返回 object；提示与接收校验共用同一 Zod schema，无宽松解析、对象转换、重试或兼容层；定向 24/24、typecheck 通过。主控 `--no-ff` 合并为 `7a4d2ec`，2026-10-18 17:51–18:03 EDT 在主目录验证：runner 18/18，npm test 114/114 + 739/739，build 与 typecheck exit 0（`artifacts/t185/main-verify/`）。两个探针站已不覆盖复制进主目录数据，3034 可打开。

