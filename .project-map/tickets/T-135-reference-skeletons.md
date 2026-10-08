---
id: T-135
title: 从优秀工业官网反推页面骨架，做成可选的版式卡供模型挑选
type: build
status: open
blocked_by: []
claimed_by: t135-build
supersedes:
---

## Why

基线与 T-132 盲评都指出生成首页共用一副骨架（首屏左大标题 + 右侧参数格，下方细线等宽条目）。换公司不再像同一模板（0/12），但放在真实官网旁边节奏单一。T-127 的计划包括「反推优秀官网提示词」。

## What to build

1. 调研：挑 12–20 个做得好的工业、设备、零部件、外贸 B2B 官网（国内外都要，不限于评估集对照站；评估集 `private/mapping.json` 里的 8 个对照站不得用作样本，避免和盲评对照重合），只看结构与节奏：首屏组织方式、产品区呈现、能力/质量/认证怎么讲、询盘入口放哪、图文比例、区块序列。记录来源网址与观察日期，不下载、不复制原站代码、文案、图片或品牌元素。
2. 提炼 6–10 种彼此明显不同的页面骨架（每种：适合什么公司和资料、首屏怎么组织、区块序列、图少/无图时怎么办），用自己的话写成 `skills/site-code-core/` 下的一份版式卡文件，生成时与核心规范一起加载，让模型在页面大纲阶段按资料选一种并在大纲里说明为什么选它；不强制、不按行业写死。控制长度（deepseek-flash 上下文预算），卡片总长约 80 行以内。
3. 大纲记录所选骨架，便于评估统计骨架分布。

## Acceptance

- [x] 调研记录（gitignore 的 `artifacts/t135/research.md`）列出样本网址、观察日期、每站骨架摘要；版式卡不含原站文案、代码或品牌元素
- [ ] 一轮真实评估中 8 个组合的所选骨架分布写进 Resolution（至少用到 4 种）；交主控安排三种口径独立盲评，跨轮对照 T-133 基线
- [ ] Astra 审查通过；typecheck、test、build 通过

## Resolution

**BLOCKED：主控放行后的本轮在第四份规划遇到 HTTP402，上游额度或限流；3/8 存版，四项未运行，三个评审包均缺项。** 前次轻量规划的 8/8 合法、四种骨架仍是整轮前证据，不能补算本轮缺项；整票未完成。执行者 t135-build；票保持 open，不派审查、不关票、不推送。本地基于 `3c49c95`，本功能始终只保留一个提交。修复及相关验证运行于 `8322f98` + 本票 dirty 改动，本轮整站评估运行于干净 `a3402fd2ed056479f5f6f660374fc5a74eaf8726`；随后只更新本票并 amend。最终 SHA、命令和回执在 gitignore 的 `artifacts/t135/handoff.json`；先前回执与失败产物均保留。

### 当前实现与调研

- `skills/site-code-core/SKELETONS.md` 共 54 行、8 种原创骨架，每种含资料条件、首屏、内容序列及图少/无图方案。参考 12 个国内外工业官网的内容组织，网址、2026-10-08 观察日期、逐站摘要和限制见 `artifacts/t135/research.md`；排除了基线 mapping 的全部 8 个 control 域名。不下载或复制原站代码、文案、图片、字体或品牌。UI 浏览器连接不可用，研究依据网页内容层级和图文顺序，未核对实际像素比例；空间关系和无图方案由本项目推导。
- 卡片随核心规范加载，每次规划用 Fisher–Yates 随机排列，实际顺序同时保存在 `CodePlan.skeletonOrder` 与调用记录中；成功、失败调用均可核对顺序。没有行业、公司、风格或数量配额映射，仍由模型按资料选择，允许 `custom`。产品族入口收窄为至少三个差别明显系列、资料以分类目录为主；两条业务路径明确排除同一成交路径里仅规格不同的两个标准系列。
- 模型输出顶层 `skeletonId`、`skeletonReason`，编号本地校验为现有卡片或 `custom`；理由同时说明主选、首屏节奏和不选次合适那张的资料依据。每页 `outline` 是 1–6 个短句，各句最多 120 字，服务端以分号连接为原有大纲文字，合计最多 725 字，未放宽原 800 字上限。摘要 400、风格理由 200、骨架理由 300、标题 80、页面 1–12、唯一首页及用户风格校验保留。编号拼错提示“页面骨架编号无效，请重新规划。”，其他大纲字段错误提示“页面大纲格式不正确，方案未保存。”。
- `lib/ai-provider.ts` 的配置仍为 `deepseek-flash`。2026-10-08 查阅 [DeepSeek 工具调用](https://api-docs.deepseek.com/guides/tool_calls/) 和 [Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)：strict 函数 schema 用 `/beta`，思考模式只能用 auto 工具选择。规划保持思考模式，只接受一次 `submit_page_plan` 函数参数；不接受普通正文替代、不修补 JSON、不重试。Zod 生成远端 schema；不支持的字符串长度关键字改用 pattern，数组数量及语义约束继续本地检查。真实调用表明上游不总能遵守字段和长度，因此不能以 strict 标记替代本地校验。
- 选择整理为原有 `skeleton: {id, reason}`，随大纲保存、确认、刷新和写页链路传递；历史已存大纲不补造。未加依赖、模板渲染器、平行提交入口或事实豁免。调用记录只新增结束原因、回答长度和推理 token 数等元数据；原始响应与请求仅在私有 artifacts 诊断中保存。CONTEXT、mainline、spec 已同步，MAP 83 行。

### JSON 根因与保留证据

主控确认首轮两份原始响应未保存，不再寻找；以下以新诊断原始响应为准。`SITE_STORE=fs node --experimental-strip-types artifacts/t135/diagnose-plans.mjs` 在 2026-10-08 18:18:44–18:19:17 UTC 对原实现各调用一次，目录 `artifacts/t135/plan-diagnostic-2026-10-08T18-18-44-030Z/`：

- 注塑精密工程复现语法错误：`skeleton` 缺闭合括号，`pages` 落入骨架对象；HTTP200、finish=stop、回答 2302 字符、输出 3286 tokens，其中推理 1784，远低于 65536。根因是自由文本 JSON 的结构序列化错误，不是预算耗尽或推理挤满预算。
- 纸包装精密工程这次正常解析（HTTP200、finish=stop、输出 3407、推理 1440）；历史错误的确切语法位置无法恢复，不能声称已经复现。后续平铺字段候选又出现 outline 字符串内未转义换行，说明仅改字段形状不足以保证合法 JSON。
- 修复落在规划输出合同：改 strict 函数参数，删除混淆字段用途的 JSON 示例，schema 内说明字段意义，并缩短摘要、理由及每页大纲。上游曾返回超长理由、把风格说明写进 style、漏掉 styleReason，均被本地拒绝，未截短或放宽放行。

所有诊断及未达标候选保留，不覆盖失败；每个候选对八份资料各调用一次，没有模型调用失败后的自动重发。以下表格是失败证据索引，不把其中成功项拼进最终结果：

| 私有目录（`artifacts/t135/`） | JSON / 本地合法 / 骨架种类 | 未达标原因 | 总 tokens |
| --- | --- | --- | --- |
| `plan-eight-2026-10-08T18-34-01-429Z` | 7/8、6/8、4 | 未转义换行；理由超 300 字 | 75,842 |
| `plan-eight-2026-10-08T18-55-40-748Z` | 8/8、7/8、2 | 非思考 strict 候选理由超长、选卡集中 | 60,992 |
| `plan-eight-2026-10-08T19-05-22-419Z` | 8/8、6/8、4 | style 错字段且缺理由；summary 424 字 | 86,230 |
| `plan-eight-2026-10-08T19-10-07-334Z` | 8/8、8/8、3 | 两个标准系列被当成两条业务路径 | 77,017 |

### 整轮前的八份轻量规划验证

只读首轮评估 `private/case-N/code-site.json` 的八份原资料、原风格与原请求；生产 `planSiteCode` 每份调用一次，核对页数 3/5/5/4、选定风格、模型请求与保存顺序一致。没有写页面、提交版本、截图或 Chrome 负载。密钥按 `set -a; source /Users/luckye/Documents/Code/sitecraft-ai/.env.local; set +a` 加载，命令 `SITE_STORE=fs node --experimental-strip-types artifacts/t135/plan-eight.mjs`。

2026-10-08 **19:12:45.941–19:14:36.175 UTC**，目录 `artifacts/t135/plan-eight-2026-10-08T19-12-45-810Z/`；输出 `artifacts/t135/distinct-paths-plan-eight.txt`；exit0。各 case 的 `request.json`、`raw-response.json`、`report.json` 和总 `summary.json` 保留完整顺序、原响应、选择理由与用量。

| 组合 | 骨架 | 主选依据及不选次合适那张的理由（摘要） |
| --- | --- | --- |
| 工业 × 精密工程 | `capability-led` | 按图加工、四项工艺和承接范围先行，再在核对处放规格；次选 compact-profile，但两系列参数和应用工况仍需分区。 |
| 工业 × 现场实拍 | `capability-led` | 工序设备与批量承接边界最厚；次选 product-atlas，但只有两系列，且重点是加工承接。 |
| 外贸 × 精密工程 | `compact-profile` | 公司资料薄、两系列、仅邮箱，单栏先定位与样品册入口；次选 flagship-focus，但两系列等厚，不能把另一系列降为附庸。 |
| 外贸 × 现场实拍 | `capability-led` | 车削、攻丝、气密检测、钝化包装与参数边界比外形资料厚；次选 product-atlas，但不足三个系列。 |
| 注塑 × 精密工程 | `product-atlas` | 五个差别明显且参数齐备系列，目录与重点系列先行；次选 capability-led，但分类参数更厚，加工由独立页面承接。 |
| 注塑 × 现场实拍 | `product-atlas` | 五类模具/注塑件适合先浏览比较，重点配图其余紧凑索引；次选 capability-led，但产品目录比工艺范围更厚。 |
| 纸包装 × 精密工程 | `two-businesses` | 纸盒和内托的确认对象、起订量、交期不同，先给双入口，再按详略展开；次选 product-atlas，会削弱两条承接路径的条件差异。 |
| 纸包装 × 现场实拍 | `two-businesses` | 资料明确分开介绍两路及其承接条件，先比较再分别展开；次选 product-atlas，但内托另成一路，目录平铺弱化差异。 |

**8/8 JSON 可解析、8/8 本地合法，四种骨架：capability-led 3、compact-profile 1、product-atlas 2、two-businesses 2。** 不再改卡片或追加规划调用。八次调用均 HTTP200、finish=tool_calls；输入 **50,917** / 输出 **22,123** / 总 **73,040** tokens，无未知用量。含两次诊断与四个未达标候选，本次修复阶段共 42 次规划调用，输入 259,220 / 输出 132,656 / 总 **391,876** tokens，全部计入，不只报告成功候选。

这只证明本次规划的格式与分布，不能证明生成页面采纳骨架或审美通过。纸包装精密工程的完整理由把 product-atlas 说成“要求各系列走同一成交路径”，卡片无此硬条件；上表概括实际选择依据，原话原样保留，理由准确性仍待后续评估。该轻量验证未进入页面提交检查，拒收率无分母，不能写成 0%。

### 修复后验证

在 T-134 明确 build、typecheck、测试结束且无 Chrome 后开始本分支重检查。只停止自己的 3147（PID 8164，cwd 核对为本 worktree），默认 Turbopack。所有结果来自此次修复后源码，命令、UTC 完成时间和输出见 `artifacts/t135/repair-verification.json`：

- `npm run build`：19:13:53 UTC，exit0，`repair-build.txt`；随后 `npm run typecheck`：19:14:38，exit0，`repair-typecheck-after-build.txt`。
- 按规定 source 密钥后，`SITE_STORE=fs CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --test --experimental-strip-types --test-concurrency=1 tests/t128-code-boundary.test.ts tests/t129-version-history.test.ts tests/t130-model-usage.test.ts tests/t130-run-records.test.ts tests/t135-skeletons.test.ts tests/t135-plan-contract.test.ts`：19:15:08，**64/64**、exit0，失败/跳过/取消均 0，`repair-related-tests.txt`。真实 API handler → 风格选择 → 规划 → 确认 → 唯一提交入口 → FS → 刷新链路通过；规划专用用例确认版本数为 0，生成夹具仍经过三页九组视口检查。HTTP 模型响应和延后调度为夹具，不是模型质量证据。
- 新检查在坏实现上失败：`T135_PLAN_MUTATION=shuffle|ids|limit|outline node --import ./artifacts/t135/plan-mutant-hook.mjs --test --experimental-strip-types --test-name-pattern=<对应测试名> tests/t135-plan-contract.test.ts`；固定顺序、放过拼错编号、把 300 放宽为 301、还要求长字符串，分别产生目标失败，exit1，输出 `shuffle-mutant-red.txt`、`id-mutant-red.txt`、`limit-mutant-red.txt`、`outline-mutant-red.txt`。只变异测试进程加载的代码，不修改源码。此前的 `plan-contract-parent-target-red.txt`、`strict-plan-parent-red.txt` 也保留原错误提示、普通正文输出的反例；不是环境失败。
- 本次未重跑全套。首轮 `npm test` 的 2587/2590、exit1 在 `npm-test.txt`：T090/T113 依赖主工作区旧数据，768 选择卡滚动偏移 3px。主控明确合并后在主工作区复核，本票不追查、不改断言。此前夹具预览的三张截图已打开；本修复不改工作台 UI；本轮生成站截图见下。`project_map.py status --root .` 无问题、无过时 living doc。

### 修复后的整站评估及基线对照

主控放行且确认 T-134 已结束整轮及 build、只写交接、不占 Chrome。按规定 source 密钥，重启自己的 3147 / SITE_STORE=fs / 默认 Turbopack，health.cwd 与模型配置核对后运行：

`CHROME_PATH=<AGENTS 路径> SITECRAFT_BASE=http://127.0.0.1:3147 npm run eval:new-route -- --previous /Users/luckye/Documents/Code/sitecraft-ai-t133/artifacts/t130/round-2026-10-08T07-59-10-005Z`

2026-10-08 **19:20:37.065–19:30:45.465 UTC**（结束时间取终端输出文件完成时间）；候选 `a3402fd`、dirty=false；exit1，**BLOCKED**。目录 `artifacts/t130/round-2026-10-08T19-20-37-063Z/`；完整命令 `command.sh`，输出 `artifacts/t135/eval-after-repair.txt`；完整选择理由、顺序、拒因、用量及基线统计在 `artifacts/t135/eval-after-repair-results.json`。只启动这一整轮，未修改评估脚本、源码、卡片或候选，未用手改替换产物。

| 组合 | 本轮骨架及资料理由（摘要） | 结果 / 稿数 |
| --- | --- | --- |
| 工业 × 精密工程 | `capability-led`；按图加工的工艺设备比产品线完整，先范围与工艺目录；次选 product-atlas，但仅两系列且以加工承接为主 | 3 页存版 / 3 稿 |
| 工业 × 现场实拍 | `capability-led`；首屏加工与批量边界，再工序设备、两系列；次选 workshop-story，但配图是行业示意，不能作本厂现场 | 3 页存版 / 1 稿 |
| 外贸 × 精密工程 | `custom`；两个系列先比较、再进入规格表与交期；次选 product-atlas，但少于三个系列 | 5 页存版 / 2 稿 |
| 外贸 × 现场实拍 | 无选择；唯一 plan 调用 HTTP402，未返回有效大纲 | blocked，0 页 / 0 稿 |
| 注塑 × 精密工程 | 未运行，无骨架或理由 | not-run，0 页 / 0 稿 |
| 注塑 × 现场实拍 | 未运行，无骨架或理由 | not-run，0 页 / 0 稿 |
| 纸包装 × 精密工程 | 未运行，无骨架或理由 | not-run，0 页 / 0 稿 |
| 纸包装 × 现场实拍 | 未运行，无骨架或理由 | not-run，0 页 / 0 稿 |

本轮前三份上游成功返回的大纲均合法，四个实际规划调用各一次。外贸现场实拍在 19:30:43.779 UTC 发起唯一调用，HTTP402、latency 810ms、usage=null，实际随机卡片顺序仍保留；脚本即停止后四组合，无重试或重发。有效三份仅 **capability-led 2、custom 1**，后五份缺失；不能把先前轻量规划的选择补进本轮，未获得完整八站或至少四种骨架的整站证据。已报告一次上游问题，需要主控恢复额度并决定后续，本执行者不做网络/额度探测或补跑。

| 指标 | 指定 T-133 基线（八组合） | 本轮 T-135（因 402 中止） |
| --- | --- | --- |
| 存版且有截图 / 页数 | 8/8、34 页 | 3/8、11 页 |
| 大纲 JSON/本地校验错误 | 0/8 | 成功返回的 3/3 合法；另 1 次 HTTP402、4 项未调用 |
| 首稿拒收（进入提交检查） | 4/8（50%） | 2/3（66.7%） |
| 逐稿拒收 | 5/13（38.5%） | 3/6（50%） |
| 最终底线拒收（进入提交检查） | 0/8 | 0/3，不代表其他五项通过 |
| 模型调用 / 未知用量 | 34 / 0 | 16 / 1（唯一 402）；15 次 HTTP200 |
| 输入 / 输出 / 总 tokens | 183,881 / 420,288 / 604,169 | 已知 94,983 / 155,289 / **250,272**；另 1 次未知 |

完整资料一致性检查通过，基线只读。仅配对本轮实际生成的同三个组合时，基线也为 11 页，首稿拒收同为 2/3，逐稿为基线 2/5（40%）与本轮 3/6（50%），最终同为 0/3。基线后 T-133 加强政策事实校对，且本轮大部分未完成，不能将差异全归因于卡片，不能把已知用量下降解释为完整八站省用量，402 未报用量不按零计。

三次拒收、两站、十条拒因全部为事实问题。工业精密工程两次拒收：新增按图报价、关键件承接与接口尺寸要求，改变检验名称，之后又给规格加图纸确认条件、添加规格表回复流程等；外贸精密工程由“材料可追溯报告认证中”推出不能提供报告，修正后才通过。所有拒绝候选和检查记录仍在各 case 的 `code-site.json`；未放宽检查或截断文案放行。

已存三个版本共 **33** 组页面×375/768/1440 检查，overflow=0、overlaps=0、contrastIssues=0；最终长行反馈 **9** 处。所有候选长行为五稿、两站、23 处，不触发拒收。T-128 的极端 line-height/filter 限制保留。

### 本轮截图与三个评审包

本轮 22 张整页、三张首页首屏共 **25 张生成截图**均逐张打开；另用 `CHROME_PATH=<AGENTS 路径> node --experimental-strip-types artifacts/t135/capture-eval-768.mjs artifacts/t130/round-2026-10-08T19-20-37-063Z` 对三个实际版本补采 768 首页，三张也打开。目录 `artifacts/t135/eval-768-2026-10-08T19-31-48-543Z/`，回执列出五项缺失并 exit1，不调用模型。八张沿用基线对照也已逐张查看，共 36 张，清单 `artifacts/t135/eval-after-repair-viewed.json`。三个生成站的正文、导航、页脚可见；技术自查仍见外贸 custom 首页采用左标题右参数列，不能从 id 数量宣布页面结构或审美通过。沿用的 `control-industrial-0-1440.png` 红色主视觉仍缺可见标题，未重采覆盖或改写基线。

三个目录已产出，任务引用的图片全部存在（mixed 11、company 4、comparison 44 个图片引用）；**三个包均不齐备**，完整缺项见 `private/blind-coverage.json`：

- `artifacts/t130/round-2026-10-08T19-20-37-063Z/review/mixed/`：11 样本（3 生成 + 8 对照），缺五生成样本。
- `artifacts/t130/round-2026-10-08T19-20-37-063Z/review/company/`：1/12 题，缺十一题。
- `artifacts/t130/round-2026-10-08T19-20-37-063Z/comparison-review/`：3/8 题，缺五题。

Chrome 已关闭；补采完成后只停止本工作树的 3147（PID 11609，cwd 已核对）。三个包路径、402、缺项与用量已交主控；`private/` 只交主控。本轮不是完整验收证据，没有派盲评或审查、没有关票或推送。

### 保留的首轮失败

首轮 `132dee0` 在 17:38:29–18:00:08 UTC 的 `artifacts/t130/round-2026-10-08T17-38-28-984Z/` 原样保留：6/8 存版、26 页，注塑精密工程与纸包装精密工程 JSON 错误；有效骨架 product-atlas 5、capability-led 1。首稿 4/6、逐稿 5/11、最终 0/6；30 次 HTTP200，输入 201,635 / 输出 335,025 / 总 536,660。完整八组合理由、拒因、包缺项、截图清单及当时回执在 `eval-results.json`、`eval-viewed.json` 和 `handoff-before-plan-repair.json`，不覆盖、不拼入本轮结果。包含首轮、修复阶段及本轮，本票已知模型用量累计 **1,178,808** tokens，另有本轮一次 402 用量未知。
