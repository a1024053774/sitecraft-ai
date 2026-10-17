---
id: T-174
title: 局部写作改用严格函数参数提交（T-173 第二组遗留）
type: build
status: open
blocked_by: [T-173]
claimed_by: Codex
supersedes:
---

## Why

T-173 第二组（首页用餐场景 + 菜单页午市组合，跨页多区块）在追加授权的唯一一次重跑中，首个局部写作调用 HTTP 200、finish_reason=stop，但回答 1,284 字符不是合法 JSON，系统如实拒收、未存版（2026-10-17，实付 5,633）。局部写作仍走 `response_format: json_object`，与翻译、大纲的严格函数参数提交不是同一机制；失败时只记字符数，原始回答未保存，无法确认具体缺陷。真实用户批注同样会随机碰到。

## 构思主控决定（2026-10-17）

- 局部写作和修正轮改用严格函数参数提交，与翻译同一套机制；不保留 json_object 旧路径。
- 任何解析失败都把原始回答、finish_reason、用量存进任务记录。格式错误不重试、不宽松解析，不变。
- 余额 19,367 属负责人已批的 T-173 第二组 2.5 万额度，修好并经新的 sol 实例复审通过后可沿用：在导入主目录的「（批注验收）」站的 v2 副本上只跑一次第二组，截断、超额或拒收即停；存版后交新实例盲评。
- 同一时间最多一个重任务。

### 追加决定（2026-10-17）

- 预算网关是验收工具，按不静默降级原则：局部写作和修正轮（submit_local_edit）在发请求前，如果累计授权不能完整预留请求自带的 12,288 输出，就明确拒绝（不出网、网关停止并记录原因），不再自动调小 max_tokens。其他调用（事实核对、翻译、大纲、整站写作等）保持 T-165 现有行为。
- 负责人已批追加：第二组新账本 SITECRAFT_TOKEN_LIMIT=30000（原余额 19,367 加追加约 1.1 万），仍只跑一次第二组，截断、拒收或预留失败即停。
- 网关改动交新的 sol 实例快速复审，通过后才运行。
- 构思主控对 HTTP 400 选 A（2026-10-17）：修复局部写作 schema 的根 object 与长重复正则问题，并保存 HTTP 错误正文、状态和实际响应 request id；全部算在负责人已批的 30000 账本内（上次账本实付 0），上次 400 请求未被模型处理，不算用掉运行授权。先完成离线修复；全量／build 先报 READY_FOR_HEAVY 等主控放行。探针另等主控明确「可以探针」后才发，旧／新 schema 各一次、独立 1000 新账本、max_tokens≤256，合计≤2000；新 schema 仍 400 就停。第二组重跑须新 sol 复审通过并由主控另行下达；大纲与翻译只读检查，不在本票改。

## What to build

1. 坏例先行：覆盖这次失败形态（回答 1284 字符、finish_reason=stop、不是合法 JSON）。原文未保留，按「合法 stop 但 JSON 不完整」构造本地模型替身；在当前主线上证明原始回答未保存（失败），修好后格式错误如实拒收且原始回答已保存。
2. 局部写作（单区块、多区块批次）与修正轮改为严格函数参数提交，函数参数 schema 与现有局部写作输出合同一致；删除 json_object 路径。
3. 解析失败（含函数缺失、参数非 JSON、schema 不符）统一在任务记录保存原始回答、finish_reason、用量；不进修正轮、不重试。
4. 同步 AGENTS.md 相关规则（只写规则）、spec.md。

## Acceptance

- [ ] 坏例测试先红后绿；独立 sol 复审通过；typecheck、test、build 通过
- [ ] 真实 chat 入口在「（批注验收）」站 v2 副本上跑第二组并存版，用量写进 Resolution；工作台三档出处显示正确
- [ ] 独立盲评实例对比第二组原版和修改版的结论写进 Resolution

## Resolution

### 离线修复（2026-10-17，Codex）

本轮只修局部写作格式边界；独立 sol 复审、真实第二组运行及盲评由主控另行安排，票保持 open，原验收项不勾选。已只读核对 T-173「第二组追加授权的单次重跑」及主工作区 `artifacts/t173/blind2-20261017T050426Z/private/outcome.json`：原回答正文未留存，1,284 字符坏例为按失败形态构造的替身，不能当作真实原答复原。

单区块、多区块各组和局部修正轮统一调用已有 `functionOutput`，用 `submit_local_edit` 严格函数参数提交原合同的两种互斥对象（html/css 或 cannotEdit），删除局部 json_object 路径。schema 沿用 `strictFunctionParameters` 的转换和响应端 Zod 校验；格式校验在模型响应边界完成，工作流只把区块范围和内容底线拒因交回修正。没有兼容开关或替代写作路径。Deep modules：复用既有模型入口，没有增加生产包装层；Ubiquitous language 沿用「局部修改」「区块」「修正轮」。

现有大纲在思考开启时用 beta strict tools 与 tool_choice=auto，翻译关闭思考后才强制指定函数；局部写作沿用大纲的做法，仍开启思考、上限 12288。响应必须是唯一匹配函数且 finish_reason=tool_calls，stop 不视为成功，length 如实报截断。局部事实核对仍固定非思考、4096。所有严格函数响应在解析前记录 content、tool_calls、finishReason 和 usage；局部 schema 错误也保留这些字段，不重试、不宽松解析、不进入修正轮、不继续后续组。任务不保存凭据、请求头或完整请求。

#### 红绿证据

父版本 `1497da824003efa3ac6decf5a2c8acde7d855aa8` 在生产实现未改前运行 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t174-local-function.test.ts`，2026-10-17T05:48:40.638Z：28 项均按未实现合同失败。日志 `artifacts/t174/parent-1497da8-red.log`，报告 `artifacts/t167/test-run-1792216091958-71834/report.json`，临时根 `sitecraft-test-MrwuSg` 保留。父版本 `local-function-1792216095568-71859/single-stop-1284.json` 明确为 HTTP 200、stop、answerChars=1284、一次请求、未存版，但 rawMessage 缺失；合法函数回复也被旧正文解析路径拒收。期望来自票的合同，没有导入生产 schema 或用实现输出生成答案。

相同命令修后于 05:49:49.725Z 28/28 通过，日志 `artifacts/t174/local-function-green.log`，报告 `artifacts/t167/test-run-1792216161282-72649/report.json`，临时根 `sitecraft-test-xWo7UZ` 保留。覆盖合法单区块与跨页批次实际改标题并经提交入口存版、二者的真实修正轮请求、坏 JSON、Markdown 包装、缺函数／错函数／多函数、schema 缺字段／多字段／混用对象、stop 与 length、合法 cannotEdit。坏例均核对原始回答、结束原因、用量、零修正与不存版；不是仅断言抛错。Tracer bullet 由生产 chat POST、原任务、HTTP 模型替身、统一提交入口及普通 dev 服务读回构成，只控制 after 调度，不称为真实 Next after 集成或真实模型能力证据。

#### 规定验证

`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t174-local-function.test.ts tests/t164-*.test.ts tests/t173-*.test.ts tests/t169-*.test.ts tests/t151-*.test.ts tests/t154-*.test.ts tests/t162-inline-annotation.test.ts tests/t162-element-hint.test.ts tests/t163-model-elements.test.ts tests/t152-local-model-input.test.ts` 于 05:52:41.256Z 通过 321/321，失败／取消／跳过为零。日志 `artifacts/t174/focused.log`，报告 `artifacts/t167/test-run-1792216237083-73528/report.json` 保存 29 个展开文件与身份，临时根 `sitecraft-test-T8ph1i` 保留。现有替身只调整局部回复的传输编码及大纲函数识别，原业务断言保留。

随后串行运行 `node --test --experimental-strip-types scripts/t167-runner-regressions.ts`，05:52:55.835Z 4/4（`artifacts/t174/runner.log`）；`npm run typecheck`，05:52:58.471Z 通过（`typecheck.log`）；确认工作树不存在 `.env.local` 后运行 `SITE_STORE=fs npm run build`，05:53:23.940Z 通过（`build.log`）。时间均为 UTC，日志 mtime 记录对应完成时间。

定向生成的 29 张批注、重叠确认及原始资料／消息／上传／表格出处截图均逐张打开，清单 `artifacts/t174/focused-screenshot-views.json`。`artifacts/t162/self-contained-1792216240385-73631/rejected-1440-*.png` 的预览仍显示载入态，不作为有效截图证据；composer-375 只作输入状态，reveal-375/768 是工作台缩放的 1440 预览，不作生成站相应宽度版式证据。其余三档出处图可见原句与来源文字。本轮不自评审美。

AGENTS 与 spec 同步严格提交、格式错误终止与响应留存规则，局部运行时合同同步函数要求；CONTEXT 与 mainline 窄改对应当前说明，避免 living doc 过时。

#### 冻结全量与交接

实现及测试冻结到本地提交 `d459ae342f539d1553b3553789f96ab15985a149`。05:53:40Z 全量前 `memory_pressure` 空闲 58%，`ps -axo pid,ppid,command` 无其他 Chrome 无头测试、node --test 或 Next build；原始输出为 `artifacts/t174/pre-full-memory.txt`、`pre-full-processes.txt`。在该冻结提交上只串行运行一次 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test`，2026-10-17T05:58:05.441Z 完成：751/751，失败／取消／跳过为零，耗时 226576ms。日志 `artifacts/t174/full.log`，报告 `artifacts/t167/test-run-1792216457382-80038/report.json`；临时数据根 `/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-test-k5XelS` 保留。没有重跑全量、放宽断言、延长预算或更换入口。05:58:40Z 结束进程检查无残留本轮测试 Chrome、node --test、dev server 或 Next build（`post-processes.txt`）。

本轮离线修复及规定本地验证 **PASS**；整票验收仍 **INCOMPLETE**，独立 sol 复审、真实第二组存版、三档真实出处显示及独立盲评由主控安排，不以替身或自查代替。真实 DeepSeek strict schema 兼容性及生成效果本轮未实测。未调用 DeepSeek、未读取 `.env.local`、未使用 rm、未推送、未写主目录 `.sitecraft-data`；`tsconfig.json` 的 Next 自动修改保留未提交。最后只补本 Resolution 并 amend 同一个功能提交，运行实现与测试仍等于上述冻结提交；project-map 检查无问题及过时 living doc，票继续由 Codex 领取等待交接。

### 预算网关拒绝局部降额（2026-10-17，Codex）

本轮基于 `310d1759e9d3d25afaa24a2db7b846366bfaf74a` 新增一个本地提交，不 amend 上一轮。对应提交为其直接子提交「fix: 局部严格函数请求禁止预算降额」，最终 SHA 见 `artifacts/t174/budget-commit.json` 及交付回报；修后验证对应本轮提交的实现与测试，全量开始后只补本 Resolution。追加决定原样写入上方小节，claimed_by 保持 Codex；真实 30000 授权只记录，未启用真实运行账本或调用真实模型。

已读局部写作调用及单区块／多区块修正循环：各轮都经 writeLocalEdit 调用 submit_local_edit，没有另一种修正函数。reserveRequest 只在请求 tools 含该函数时要求累计余额扣除原输入预留后仍能保留完整 body.max_tokens；不足即抛出明确的中文拒因，由原网关 catch 写入 stopReason、stopped=true，拒绝后续请求，且不调用上游。足够时沿用请求原上限 12288；原输入估算、其他用途的 Math.min 降额、最低输出门槛、已付用量记账与停止路径均保留。T153_BUDGET_DIR 只给既有列表新增 t174，不加开关或兼容路径。Deep modules 沿用既有 reserveRequest 与停止边界；Ubiquitous language 继续使用「局部写作」「修正轮」「完整预留」。

#### 红绿证据

在生产实现尚为 `310d175` 时运行 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t165-token-reserve.test.ts tests/t153-budget.test.ts`，2026-10-17T09:22:38.679Z：21 项中 17 通过、4 失败。日志 `artifacts/t174/budget-310d175-red.log`，报告 `artifacts/t167/test-run-1792228955300-17414/report.json`，临时根 `sitecraft-test-Iy994l` 保留。首轮 12000 余额仍出网、max_tokens 被降到 11393；修正轮被降到 11371；先实付 18000 后，下一局部请求仍被降到 11371 并出网，账本错误继续运行。第四项为 t174 目录仍不被准入。余额充足及事实／翻译对照在父版本通过，这是有意保留的正例，未把它们伪写成缺陷。

三项预留反例沿用原已准入的 artifacts/t160/t165-budget-*/ 目录，避免目录拒绝掩盖出网行为；目录准入由单独的 t174 网关启动用例检查。各新用例在日志写明账本目录，usage.json 与 observations.json 保留实际请求及转发的 max_tokens，不含凭据或请求头。父版本三项错误发出的请求分别保存在目录后缀 `8b8b95db-f732-4324-bc1d-1f60f71f40be`、`a1934caf-a967-4d9e-9d5f-8d40fdcba256`、`ddc30b28-b6d9-4c84-8ffb-ffecfaa3212a`。期望为决定规定的零次出网、12288 原值、账本停止及非局部仍可降额，没有按 reserveRequest 的输出计算答案。

修后相同命令于 09:23:05.179Z 21/21 通过（`artifacts/t174/budget-green.log`，报告 `artifacts/t167/test-run-1792228982937-17546/report.json`，临时根 `sitecraft-test-XQUCEx` 保留）。首轮／修正轮不足时 502、上游零请求、stopReason 有明确原因、stopped=true，后续请求 409；充足时上游恰收 12288；累计已用量仍保留，拒绝下一局部调用；事实核对及 submit_english_translation 余额略紧时仍降额发送，资料里的 submit_local_edit 字样不触发局部门禁。Tracer bullet 经真实预算网关子进程、HTTP 请求、本地上游替身及磁盘账本完成；替身通过既有 t165-upstream.mjs 拦截传输，不能访问真实 DeepSeek。

#### 本轮规定验证

`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t165-*.test.ts tests/t153-*.test.ts tests/t174-local-function.test.ts` 于 09:24:19.438Z 73/73 通过，失败／取消／跳过为零。日志 `artifacts/t174/budget-focused.log`，报告 `artifacts/t167/test-run-1792229023329-17806/report.json` 保存六个展开文件与工作树／数据根身份，临时根 `sitecraft-test-qeD0Hg` 保留。

随后串行运行 `node --test --experimental-strip-types scripts/t167-runner-regressions.ts`，09:24:28.675Z 4/4（`budget-runner.log`）；`npm run typecheck`，09:24:36.544Z 通过（`budget-typecheck.log`）；确认工作树不存在 `.env.local` 后只运行一次 `SITE_STORE=fs npm run build`，09:24:54.395Z 通过（`budget-build.log`）。上述时间均为 UTC，日志位于 artifacts/t174/；AGENTS 只在 T-165 条目补一条规则，spec 第 6 节同步当前预算合同，两者保持 UTF-8。

09:25:40Z 全量前运行 memory_pressure，空闲 51%；ps 检查无其他 Chrome 无头测试、node --test 或 Next build，原始输出为 `artifacts/t174/budget-pre-full-memory.txt`、`budget-pre-full-processes.txt`。随后只串行运行一次 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test`，2026-10-17T09:30:04.697Z 完成：759/759，失败／取消／跳过为零，耗时 251941ms。日志 `artifacts/t174/budget-full.log`，报告 `artifacts/t167/test-run-1792229150412-19460/report.json`，临时数据根 `/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-test-ExTPNe` 保留。没有重跑全量、放宽断言、扩大预算或更换入口。09:30:12Z 的 `budget-post-processes.txt` 未见本轮遗留测试／网关／dev server；主工作区普通服务未动。

build 和全量均在负责人补充 T-176 重任务协调规则前启动；规则到达时全量尚在运行，结束后已立即回报释放，此后未启动新重任务。后续全量或 build 必须先报 READY_FOR_HEAVY 和命令，并收到「可以跑」才启动。

本轮预算修复与规定离线验证 **PASS**，整票仍 **INCOMPLETE**：新 sol 实例快速复审、真实第二组运行及盲评由主控安排，未经复审不运行。真实 DeepSeek 本轮未实测；未调用真实模型、未读取 `.env.local`、未使用 rm、未写主目录 `.sitecraft-data`、未推送。`tsconfig.json` 自动脏改原样留在工作树，不进提交；仅显式添加本轮六个文件，新建一个提交，不 amend。票保持 open，claimed_by 仍为 Codex。

### 真实第二组的复审前置（2026-10-17）

主控转达：预算网关提交 `bbd8a086c8c339a6961678da0b8597a00018e971` 已经独立 sol 快速复审 **PASS**，未发现 P0/P1，也无非阻断建议；确认 submit_local_edit 识别准确、出网前拒绝、余额足够时保留 12288、非局部用途不受影响、父版本红日志有效，AGENTS／spec 与代码一致。本结论来自独立实例，由主控提供，执行者未自审。主控随后明确授权在该提交上使用新 30000 账本，只运行第二组一次。

### 第二组唯一一次真实运行（2026-10-17，Codex）

**INCOMPLETE**。在应用及预算网关提交 `bbd8a086c8c339a6961678da0b8597a00018e971` 上执行主控授权的唯一一次第二组，首个 submit_local_edit 请求被上游 HTTP 400 拒绝，任务如实终止，未进入修正、未保存候选或新版本；没有重发、更换路径或修改代码。run `a39522db-37ea-4e54-b495-8fd621693a47` 于 2026-10-17T09:38:31.099Z 开始，09:38:31.780Z 终态 error，repairRound=0、attempts=0、模型调用共一次。当前仍为 v2 `91191b41-483b-4ed8-adba-4d956fad032f`，版本历史为 v1、v2。

#### 数据与发送前核对

用 `mktemp -d /tmp/sitecraft-t174-real.XXXXXX` 创建 `/tmp/sitecraft-t174-real.TVHhuV`，从主工作区 `.sitecraft-data` 只读复制 `code-sites/3e52f683-e543-4561-999a-45097c55b174.json`、对应 annotations 文件及整个 conversations/站点目录，保持相对结构。来源登记和历史任务均嵌在站点记录内，七条来源完整保留；该站没有图片引用、关联上传目录、旧 sites 文件或 leads 文件，不需要补复制资源。复制后核对站名「禾巷小馆（批注验收）」、指定 currentVersionId、两版历史及上一任务已终态，全部一致；清单在本轮 private/setup.json，基线及 v1/v2 快照在同目录。09:36Z 跑前 memory_pressure 空闲 38%，df 可用 13 GiB，ps 无其他 Chrome 测试、node --test 或 Next build；发送前再次检查空闲仍为 38%，记录 memory-pressure.txt、disk.txt、processes.txt、pre-send-memory.txt、pre-send-processes.txt。没有全量或 build，与 T-176 重任务互斥。

产物目录 `artifacts/t174/blind-20261017T093637Z/`，实际新账本 `artifacts/t174/budget-20261017T093637Z/usage.json`，显式上限 30000，初始 spent/calls/rounds 均为零。流程脚本从 T-173 第二组 private/ 读取后仅适配本轮目录、临时根、导入站 ID／v2 ID、预算及提交标识；网关直接执行当前 scripts/t153-real-budget.ts，未复制或改写预留算法。批注原文从主工作区 `artifacts/t173/blind2-20261017T050426Z/private/second-request.json` 只读取得；prepare 通过真实 DOM 核对首页 [4]、菜单页 [3]、文字快照、标签与元素提示，并逐字比较两条 body，均一致，只更新新站的版本锚点及本次 draft/submission 标识。目标核对 Chrome 已关闭后才发送模型请求。

#### 命令与真实边界

应用启动命令为 `node artifacts/t174/blind-20261017T093637Z/private/start-app.mjs`：普通 Next dev、真实生产 chat POST 与 Next after，NODE_ENV=test 仅用于不加载 .env.local 及显式数据根守卫，没有模型或 after 替身；health 核对 cwd 为本工作树、dataRoot 为本轮临时目录后登记身份。应用只持有本地网关占位 token，不持有真实密钥。网关独立进程按 `set -a; source /Users/luckye/Documents/Code/sitecraft-ai/.env.local; set +a` 载入环境（source 的 stdout/stderr 丢弃），再运行 `DEEPSEEK_BASE_URL=https://api.deepseek.com DEEPSEEK_MODEL=deepseek-flash SITECRAFT_TOKEN_LIMIT=30000 node artifacts/t174/blind-20261017T093637Z/private/start-gateway.mjs`；真实密钥只在该进程及其网关子进程环境，未写入文件、日志或提交。

显式设置规定 CHROME_PATH 后，依次执行 `node --experimental-strip-types artifacts/t174/blind-20261017T093637Z/private/run-real.ts prepare` 和同脚本 `second`，后者仅一次。生产 HTTP annotationBatch 收到 202，由真实 Next after 发起上游调用。网关保持请求完整 12288 输出，inputUpper=10492、reserved=22780，低于 30000；本次不是预留失败或降额发送。首个首页用餐场景调用 HTTP 400，应用显示「DeepSeek 请求失败（HTTP 400），本次未保存版本。」并停止，没有发送菜单组写作或事实核对请求。

| 调用开始（UTC） | 用途／思考 | 延迟 | HTTP | 输入 token | 完成 token | 推理 token | 答案 token |
| --- | --- | ---: | ---: | --- | --- | --- | --- |
| 09:38:31.294 | local-edit／enabled，submit_local_edit | 482ms | 400 | 未记录 | 未记录 | 未记录 | 未记录 |

本次账本实付记录为 **0 / 30000**，仅一条 complete／HTTP 400 调用；现有任务和账本均未留存该 HTTP 错误的原始正文或 usage，不能确认详细参数拒因，也不能计算推理及答案 token，不能把未知用量补成零或把此错误写成截断／JSON 解析失败。完整账本保留在实际预算目录及 private/budget/usage.json；run/modelCalls、请求、accepted 响应、状态及停止前状态在 private/，汇总 private/outcome.json。没有已生成候选或改后版本，不能进一步评价批注落实或出处显示。

#### 停止、失败证据与交接

任务终态后经网关 /status 确认零 in-flight，手动 `kill -INT 39070` 停网关，gateway.log 于 09:39:53Z 留存 SIGINT closed 结果。其后仅运行规定 CHROME_PATH 下的 `node --experimental-strip-types artifacts/t174/blind-20261017T093637Z/private/capture-failure.ts`；1440／768／375 的三张 private/second-rejected-*.png 均逐张打开，已载入并显示原 v2 与本次 HTTP 400，清单 private/screenshot-views.json。它们只作拒收界面证据，不作生成站版式、审美或新版本出处证据。截图结束后 `kill -TERM 38787` 停应用，app-launch.log 于 09:41:52Z 留存 closed 结果；private/post-processes.txt 未见本轮遗留应用、网关或 Chrome。

review/ 只保留第二组批注原文和中性说明，明确没有可比较的改后版本；不制作 A/B 映射或改后图片，不启动盲评。未满足存版成功前提，**未创建 artifacts/t174/import-3e52f683/**，因此没有三版暂存副本、独立导入验证应用或新版本出处弹层截图。主目录只读复核仍为指定 v2、两版历史、七条来源；本次失败任务、新批注及消息只在临时副本中保留，未写主目录 .sitecraft-data。

本轮执行到约定停止条件即止，30000 账本的本次唯一真实尝试已执行，剩余账面额度不构成自行重发授权。票保持 open，真实第二组存版、出处显示与盲评验收项仍不勾选，交主控决定下一步；本轮只本地提交此 Resolution 与复审记录，不推送、不使用 rm，tsconfig.json 自动改动不提交，临时根及全部失败证据保留。

### 根 object 与 HTTP 诊断修复（2026-10-17，Codex）

本轮基线 `2e46021b83722cb27f0e580315e15c8daa691fcd`，沿用 claimed_by=Codex。主控追加决定明确上次 400 未被模型处理、账本实付 0，不占第二组运行授权；该决定取代上一节当时的授权停止判断。新实现候选先完成离线验证，全量／build 等待 READY_FOR_HEAVY 后明确「可以跑」，真实探针另等「可以探针」；第二组不在本轮自行重跑。最终按要求创建新提交，不 amend。

局部 provider 参数改为单一 type:object，html、css、cannotEdit 三个字符串全部 required，additionalProperties=false；修改时 cannotEdit=""，拒绝时 html/css=""。两种结果互斥及原 100000／30000／500 上限只在 Zod 检查，通过后转换为工作流原有结果类型；没有旧字段缺省兼容路径。局部参数不再经过长度转正则的 strictFunctionParameters。大纲与翻译的 schema 构造及转换函数均未改。选择字符串和全部 required 的依据为 [DeepSeek strict 官方规范](https://api-docs.deepseek.com/zh-cn/guides/tool_calls/)（2026-10-17 读取），不新增对 nullable 类型支持的假设；文档与静态检查不能代替后续真实受理探针。

modelCalls 与预算账本 call 均新增 httpError：status、脱敏正文 body、requestId、requestIdHeader。共用 lib/provider-http-error.ts 读取响应，沿用既有 ai-provider.ts 的 x-ds-trace-id／x-request-id 追踪名称，只在响应实际存在时记录头名称和值，无则为 null，不从正文猜编号。网关保留原 HTTP 状态、响应类型与脱敏正文，并只转发选中的编号头，不复制 authorization 或完整头集合；客户端继续严格拒收，不重试、不进入修正轮。正文无敏感数据时原样保留空白；明确认证字段删除，凭据原文及 JSON 转义后解码的凭据字符串都遮蔽。真实头名称及旧 400 具体原因仍待获准后的探针确认。

网关原 4096 最低输出会在出网前挡住主控指定的小额度探针，因此只对 submit_local_edit 采用完整预留请求上限的既有合同，不再额外套该最低值；其他用途的 4096 门槛与降额逻辑不变，没有探针开关或绕过预算。应用首轮／修正轮上限仍为 12288。Deep modules 使用一个有两个真实消费者的 HTTP 错误读取模块，复用原模型入口、账本和停止边界；Ubiquitous language 沿用「局部写作」「修正轮」「完整预留」。

#### 父版本与补充反例

生产仍为 2e46021 时运行 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t174-local-function.test.ts tests/t165-token-reserve.test.ts`，2026-10-17T09:54:56.382Z：61 项中 14 通过、47 失败。日志 `artifacts/t174/object-2e46021-red.log`，报告 `artifacts/t167/test-run-1792230768246-55195/report.json`，临时根 sitecraft-test-G1I7BL 保留。失败包含新根 object 合同未实现、三字段合法结果不能存版／明确拒绝、HTTP 诊断缺失、非 JSON 错误在网关被改成其他错误，以及小上限被 4096 门槛拒绝；不是环境启动失败。原有预算正例仍通过，未把已有行为伪称为缺陷。

父版本实际序列化的旧 tool 保存为 `artifacts/t174/object-diagnostics/old-tool-2e46021.json`，来源为该轮 single-valid 请求：根无 type，anyOf 位于根部，html pattern={1,100000}、css pattern={0,30000}、cannotEdit pattern={1,500}。它是本次探针使用的旧定义来源，没有人工修补旧 schema。新定义从修后真实请求保存为同目录 new-tool.json。响应和预期来自主控规则与外部替身；用例不导入生产 schema 作为答案。

修后相同两文件命令先于 10:00:50Z 61/61 通过（object-green.log）。随后定向检查及 typecheck 发现异步回调中 provider.apiKey 的类型收窄失效，原 `object-typecheck.log` 保留 TS2345；校验后固定 const apiKey，并删除非 2xx 前置分支之后已不可能命中的旧判断，未增加类型断言或空值降级。相同两文件在 10:08:11Z 再次 61/61 通过（object-final-focused.log）。

最后将已有 http-sensitive 用例强化为 JSON 转义凭据，在修复中的候选上运行 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t174-local-function.test.ts`，10:11:33.267Z 出现预期的 2 项失败、44 项通过：JSON 解码后凭据会重新进入诊断正文。日志 object-escaped-key-red.log、报告 `artifacts/t167/test-run-1792231848065-85782/report.json`、临时根 sitecraft-test-peeLlF 保留；这是补充的已知坏候选反例，不冒充父版本记录。修正为同时清理 JSON 解码后的字符串后，相同两文件命令于 10:13:28.484Z 最终 61/61，通过／失败／取消／跳过分别为 61／0／0／0（object-final-green.log，报告 `artifacts/t167/test-run-1792231961277-87268/report.json`，临时根 sitecraft-test-1wWZDQ）。

最终用例经生产 chat POST、原任务及统一提交入口，控制 after 调度；HTTP 错误额外经过真实预算网关子进程与本地上游替身，检查任务与账本同时保存相同正文／状态／编号，缺头不猜、非 JSON 正文不丢失、认证信息不泄漏，并核对未存版、零修正及只发一次。不能把它称为真实 Next after 或真实 DeepSeek 受理证据。

#### 相关检查与只读风险检查

`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t174-local-function.test.ts tests/t165-*.test.ts tests/t153-*.test.ts tests/t164-*.test.ts tests/t173-*.test.ts tests/t151-translation-protocol.test.ts tests/t151-short-translation.test.ts tests/t135-plan-contract.test.ts` 于 10:04:45.593Z 260/260 通过，失败／取消／跳过为零；日志 object-focused.log，报告 `artifacts/t167/test-run-1792231309502-72831/report.json`，临时根 sitecraft-test-yepJwj 保留。后续类型与转义脱敏补正已用上述最终 61 项复验；全量须在此最终候选上另行获准后运行。定向的十张批注／出处回归截图均逐张打开，载入正常，清单 object-diagnostics/screenshot-views.json，不自评审美。

只读核对 submit_page_plan：根为 object，summary／styleReason／skeletonReason／outline 的最大长度分别为 400／200／300／120，页面 ID 模式上限 39，没有大于 1000 的重复次数。submit_english_translation 根同为 object，但 text.max(30000) 经原转换生成 `^[\s\S]{1,30000}$`，存在同类长模式结构风险；此为静态风险结论，不能据此断言上游必定拒绝。本票未修改这两条 schema，相关既有回归通过。

#### 等待放行的探针

只准备了 `artifacts/t174/object-diagnostics/probe-1-request.json` 与 probe-2-request.json，未发送；同一最小请求仅替换旧／新 tool 定义，thinking=enabled、tool_choice=auto、max_tokens=64。离线完整预留分别为 899（输入 835＋输出 64）与 717（653＋64），各低于独立 1000 上限，两次合计授权不超过 2000；probe-preparation.json 明确记录 actualRequestSent=false。实际启动时仍须使用全新 artifacts/t174/probe-1-<时间戳>/ 和 probe-2-<时间戳>/，不 --resume，真实密钥只进按主控指示 source 的网关进程。尚未读取 .env.local、未发真实模型请求，400 正文、真实编号头及用量仍待「可以探针」后记录；新 schema 仍 400 则停止，不试第三次。

最终候选再串行运行 `node --test --experimental-strip-types scripts/t167-runner-regressions.ts`，10:14:35.472Z 4/4（object-ready-runner.log）；`npm run typecheck`，10:15:20.016Z 通过（object-ready-typecheck.log），时间均为 UTC，日志位于 artifacts/t174/。全量、build 及两次真实探针尚未启动，按主控门禁等待放行，本轮状态 **INCOMPLETE**；之后仍需新 sol 复审才能由主控另行授权第二组。新提交待本轮检查与探针门禁结束后创建，tsconfig.json 保持未提交，不推送。

主控随后明确放行并调整顺序：先新建离线修复提交（不 amend），再在该提交上各执行一次旧／新 schema 探针；新 schema HTTP 400 即停，不执行后续检查。探针通过后才串行 build、全量，每项前检查 memory_pressure（低于 25% 停止）与 ps；T-176 重任务由主控等待本轮结束后再放行。所有执行结果随后另建记录提交，不 amend 离线修复提交。
