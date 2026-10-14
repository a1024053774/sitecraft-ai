---
id: T-159
title: 补 1–2 个非工业风格，风格卡带真实缩略图
type: build
status: open
blocked_by: [T-157, T-158]
claimed_by: Codex (t159-nonindustrial-style)
supersedes:
---

## Why

T-156 定为任何行业的展示型官网。现有精密工程、现场实拍、品牌画册都是按工业企业写的方向；非工业资料选「帮我选」时没有贴合的风格。

## What to build

1. 先看 T-158 的非工业生成结果与盲评：现有风格用在非工业站是否已经够好，够好就不新增，本票如实关闭。
2. 不够时新增 1–2 个风格（例如面向门店与生活服务的温和亲近方向、面向专业服务的克制文字方向），每个一份短 skill，在 `lib/code-site-styles.ts` 登记，缩略图来自真实生成版本；按 T-153 规则，未验证的候选不提供给用户。
3. 「帮我选」按资料从已登记风格里挑，不按行业硬映射。

## Acceptance

- [x] 风格区分盲评：新风格与最接近的现有风格在同一非工业资料上可辨（新实例，随机命名）
- [x] 「像这家店/机构」成对盲评不差于现有风格；真实预算主控报批
- [x] typecheck、test、build 通过（最新任务准入修复聚焦 23/23、全量 484/484、typecheck/build；均为本次修改后证据）

## Resolution

执行者 Codex，claimed_by 保持；本票 open，交主控关票，不推送。**真实生成、风格区分与同店成对盲评均 PASS**，主控已揭盲并批准 neighborly 转为 ready；缩略图来自本次真实版本，不另发模型请求。**第二个风格不做**：负责人只批准这一轮生成，本次唯一真实授权已经执行。

**当前任务准入 P2 根因修复。** 主控复审 `86fdb23` 的 NO_GO 指出快捷修改绕过确认早拒，原文证据 `artifacts/t159/review-restyle-gate-dcba8efa-fbc5-4dd2-91a9-04c1c32fced3/phase-quick.json`。已保存大纲是业务数据，不是当前进程的模型任务许可。统一判定在 `lib/code-site-eval-styles.ts` 的 `requireModelTaskAdmission`，由聊天任务领取 `claimRun` 和唯一提交入口 `commitSiteCode` 在锁内调用；HTTP 各入口没有分别加条件。规划领取检查本次 preferences.style，后续领取和提交检查当前 plan.style，未选定方向的首次手改不借用候选大纲。confirm 的早拒复用同一判定，避免消耗确认；拒绝不改风格/大纲、不创建 run/after 或进入提交检查。

入口核对清单：

| 入口 | 已核对的实际路径与准入点 |
| --- | --- |
| 资料后的选择/重新规划 | chat select → claimRun(plan)，按本次偏好检查；旧 pending 大纲不阻止改选 ready 或 auto 后重新规划 |
| 确认生成/重新生成 | chat confirm → 共用早拒 → claimRun(generate) → schedule；领取锁内再次按当前大纲检查 |
| 四个快捷提示、普通对话、指定页修改 | 都是 chat message → claimRun(edit)，不能借已有版本或 pageId 绕过当前 pending 大纲 |
| 点选/批注修改 | 同一 message 的 selectedTarget → claimRun(edit) → executeLocalEdit；模型前经过同一领取判定，旧锚点/版本校验仍保留。pending 准入的点选反例仅源码核对；普通局部修改及批注的真实 Chrome 路径已由本次全量跑过 |
| 英文生成/重翻译 | chat translate → claimRun(translate)；中文版必须先过底线，再复核当前风格准入 |
| 错误后重发/重试 | 无独立 retry API；重新发消息或点英文按钮仍进上述领取点。state 仅观察/标记中断，不重新调度 |
| 同任务的修正循环 | generate/edit/local/translate 的修正在已领取任务内执行，不创建平行任务；每次存版仍经同一提交准入，运行时其他编辑入口的 409 仍有效 |
| 历史恢复/撤销 | history restore/undo → commitSiteCode，在核事实或沿用事实前经过同一准入判定；当前未准入 pending 大纲时不能借旧精密版本进入提交 |
| 手工代码 PUT | draft PUT → commitSiteCode，同一判定，不会进入浏览器/事实检查或存新版 |
| 可信离线旧站导入、版本命名/读取/删除、图片分析 | 核对无 pending 大纲模型任务：离线导入固定 precision 且不调模型；其余不消费大纲风格，不形成上述任务入口 |

新反例在父版 `86fdb23`、生产源码未改时先跑 `SITECRAFT_BASE=http://127.0.0.1:63446 CHROME_PATH= node --test --experimental-strip-types tests/t159-task-admission.test.ts`：**0/8，exit=1**，快捷/对话/重发/指定页/翻译仍 202，恢复/撤销/手改仍 200，均为预期失败。准备两个精密版本只经提交入口的协议检查替身建立，不构造真实底线/审美结论；随后由原 start/select/workflow 的本地规划替身保存 pending 大纲，普通新进程先见 confirm=400，再发待测请求。修复后八类拒绝，生成任务类 400、提交类沿用 422，after/model/检查调用均 0、版本与风格不变；每类有已准入进程允许的正向对照，另证普通进程重新选 precision 仍可领取 plan，不被旧大纲误拦。所有生成/翻译 after 队列不执行，无真实模型或 Chrome 调用。

证据在 `artifacts/t159/task-admission-20261014T055710Z/`：parent-86fdb23-red.log 保留父版红；focused-controls-green.log **23/23、0 skipped**，命令为 `SITECRAFT_BASE=http://127.0.0.1:63446 CHROME_PATH= node --test --experimental-strip-types tests/t159-task-admission.test.ts tests/t159-confirm-gate.test.ts tests/t159-eval-entry.test.ts tests/t159-ready-style.test.ts tests/t159-http-diagnostics.test.ts tests/t153-style-preferences.test.ts tests/t159-style-eval.test.ts`；`SITECRAFT_BASE=http://127.0.0.1:63446 npm run typecheck` 与 `SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:63446 npm run build` 均 PASS，见 typecheck-controls.log、build.log。生产修改在这些检查前完成，之后只补正向测试和文档。

主控释放 Chrome 后已先报告，再执行 `SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:63446 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test`：**484/484、0 skipped、exit=0**，日志 full-test.log，运行于 **2026-10-14 06:27:51–06:30:06 UTC（纽约 02:27:51–02:30:06 EDT）**。health 核对 cwd 为本工作树、文件存储；普通 dev server 模型地址仅指向本地替身，未读 .env.local。全量产出的 56 张站点/工作台截图及 T-130 的 24 张原始照片抓取图已逐张打开，清单 browser-screenshots.json；匿名包复制件引用原始抓取图，不做图像比对、不作审美判断。结束后无遗留 Chrome/node --test，已停本工作树 dev server。当前不合主控暂停的 dfb9d5e 主线，不自开审查；新增真实调用/token 0。原始 task-contract 快照、命令时间与本次提交 SHA 关联于 delivery.json，仍交主控复审。

**此前确认准入 P2 修复（2026-10-14 UTC）。** 主控转达新 sol 对 `ee4007a` 的 NO_GO：普通进程可以确认评估进程已保存的 pending 大纲，原证据 `artifacts/t159/review-process-gate-faf2444e-5625-4bf6-9568-ea38235d24da/phase-confirm.json`。在同一父版先运行 `SITECRAFT_BASE=http://127.0.0.1:63446 CHROME_PATH= node --test --experimental-strip-types tests/t159-confirm-gate.test.ts`，预期红 **0/1，exit=1**：跨进程的生产 HTTP 普通确认返回 202 而非 400；该次进入 generate/running 且排入 after，证据 `artifacts/t159/confirm-gate-20261014T053610Z/parent-ee4007a-red.log` 及其 confirm-contract 子目录原始 before/after。准备阶段通过原 select 和 workflow 保存本地替身大纲，CLI 在首个确认前止步；跨进程共享该隔离数据。确认阶段只记录 after 队列，不执行生成，不调用模型或 Chrome。

修复仅在 confirm 分支、消耗确认和 claimRun 之前，按已保存大纲的实际 style 复核当前 serverCodeStyleOptions。未准入返回 400 和明确中文提示，偏好、原大纲、问题 ID/修订号与等待确认状态不变；无新 run、无 after；再由已准入进程确认同一大纲仍返回 202、排入一个生成任务（队列未执行）。不静默替换风格，不依赖已持久化的评估选择授权。当前 ready 邻里日常仍为普通用户选项；pending 夹具仅用于后续候选门禁。修复后同目录 focused-green.log **15/15、0 skipped**（新增反例、既有准入/ready/诊断/规划合同），typecheck.log 与 build.log 均 PASS；聚焦命令为 `SITECRAFT_BASE=http://127.0.0.1:63446 CHROME_PATH= node --test --experimental-strip-types tests/t159-confirm-gate.test.ts tests/t159-eval-entry.test.ts tests/t159-ready-style.test.ts tests/t159-http-diagnostics.test.ts tests/t153-style-preferences.test.ts tests/t159-style-eval.test.ts`。本次不跑全量 npm test 或浏览器测试，T-167 独占 Chrome；此前 475/475 仅代表 ee4007a 收尾，不冒充本次全量通过。新增真实调用/token 均 0，未读 .env.local、未自开审查；本次提交 SHA 与原始反例/修复快照关联于同目录 delivery.json，交主控复审。

**正式准入与盲评结论。** 2026-10-14 主控转述两份独立盲评：风格区分 PASS，邻里日常与现场实拍可辨为不同方向，字体相近，区别在色面、区块组织与信息重点，不只换色；「更像禾巷小馆自己建的」成对题，邻里日常略胜，门店气质与文案口吻占优，现场实拍首页直接列菜价、菜单速查有长处。执行者只引用主控结论，不重评审美。原文由主控保管于 `/private/tmp/claude-501/-Users-luckye-Documents-Code-sitecraft-ai/a94ba246-5f01-45e5-b06b-4024882c4ff2/scratchpad/blind-t159-style-9290/` 与 `blind-t159-company-13483/`；题包仍为下述两个随机 review 目录，private 映射不交审核实例。

收尾先合并最新 `family-kit-assembly`：主线仍为已包含的 `6e0ccfe`，git merge 返回 Already up to date。唯一风格登记把 neighborly 改为 ready，`public/style-previews/neighborly.webp` 直接取已生成的 576×400 缩略图，已打开；源站点 `20d7d9ae-8272-4880-81cd-eb2aec872557`、版本 `7be34b12-ec78-4d75-bcd5-c12a4b7e210d`、修订 1、原始首屏路径与 `SOURCE.md` 的 CC BY-SA 4.0 整体截图许可齐备，无照片/外部图片或字体文件再分发。普通 chat 选项与 auto 的枚举/skill 都从 ready 登记派生；既有 prompt 要求按资料挑，不固定行业，运行逻辑未加映射。评估开关保留原 pending 门禁；当前没有 pending 条目时，仅以共享 CodeStyle 类型保留联合类型校验，未知与 ready 配置仍启动拒绝。

收尾红绿证据在 `artifacts/t159/ready-20261014T050921Z/`。父版 `cbaad77` 运行 `SITECRAFT_BASE=http://127.0.0.1:63446 CHROME_PATH= node --test --experimental-strip-types tests/t159-ready-style.test.ts tests/t153-style-preferences.test.ts`，**3/7 通过、4/7 预期失败**：普通 select=400 而非 202、auto 枚举缺邻里日常、普通选项缺邻里日常、预览 pending 而非 ready（parent-red.log）。父版单独启动配置 neighborly 未自然拒绝，15 秒终止后 exit=143 而非 1（parent-startup-ready-red.log）；正式准入后同一配置在没有首个请求时自然 exit=1。门禁测试用隔离的目录元数据把一条登记设为 pending，只替换输入目录状态，生产门禁、HTTP handler 与 CLI 均未模拟响应；继续证明无变量拒绝/有变量进入规划/旧会话不能绕门禁。最终 `tests/t159-ready-style.test.ts tests/t153-style-preferences.test.ts tests/t159-eval-entry.test.ts tests/t159-http-diagnostics.test.ts tests/t159-style-eval.test.ts` 非浏览器聚焦 **14/14、0 skipped**（focused-final-green.log），typecheck/build 通过（typecheck-fixed.log、build.log）。初次 typecheck 的空 pending 集合联合类型与夹具读取类型错误保留在 typecheck.log；未删除失败。已先向主控报告全量验收安排，并于 05:18:26 UTC 用 ps 核对无其他 Chrome/node --test（before-full-processes.json），运行 `SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:63446 CHROME_PATH=<固定路径> npm test`，**475/475、0 failed、0 skipped**（full-test.log）。结束后串行运行 `SITECRAFT_BASE=http://127.0.0.1:63446 CHROME_PATH=<固定路径> T159_SELECTION_GATE=artifacts/t159/ready-20261014T050921Z/selection.json T159_CAPTURE_PREFIX=ready-20261014T050921Z/selection node --experimental-strip-types artifacts/t159/ready-20261014T050921Z/capture-ready.mjs`；1440/768/375 普通进程风格卡及缩略图完整载入，每张已打开（selection-{1440,768,375}.png），未提交规划，after-capture.json 确认模型调用 0。均在本次源码改动后运行，交付 SHA 与时间在同目录 delivery.json；未推送、未自开审查。

**当前交付（2026-10-14 UTC）。** 主控批准先 abort 未完成的合并，再合并最新 `family-kit-assembly` 的 `6e0ccfe`（已含 T-165 关票与 T-166 检查器修复）；预算目录白名单、测试矩阵均取 t159/t162 并集，合并提交 `d7433e4f9e45fa375e8087a5d5797c3963510ce9`。本轮总限 **360,000**、单次 **130,000**；原已知 117,777 与未知事实调用按旧预留上界 90,332 计，开跑前占额 208,109，加本次最大额为 338,109，不超新总限。以下 260,000 的段落仅保留此前授权与失败证据。

零成本证据在 `artifacts/t159/authorized-20261014T043816Z/`：当前生产模型函数的规划、写页输入预留 22,847/25,987；同资料 T-160 餐厅事实复原请求预留 16,112。沿用上次已知前置用量的离线情景均可留完整 65,536 输出，不宣称未来新回复、事实段与修正输入已经确定。actual /api/health 为本工作树、文件存储、deepseek-flash；实际 Next worker 的 CHROME_PATH 与 SITECRAFT_EVAL_STYLES 由选择性启动记录确认；原 select=202、本地替身收到 neighborly 结构化规划，故意 503 止于输出前、真实请求 0；T-166 静态检查 HTML 源 200、有标记、无脚本。`preflight.json`、`offline-budget.json`、`before-real.json` 保留这些证据；预算非浏览器聚焦 **29/29、0 skipped**（budget-focused.log），typecheck PASS（typecheck.log）。依主控 T-167 独占指令等待结束通知后才运行；本轮没有运行全量 npm test，不把旧 440/440 或主线结果写成本轮全量通过。

真实命令：`SITECRAFT_BASE=http://127.0.0.1:63446 SITECRAFT_TOKEN_LIMIT=130000 CHROME_PATH=<票中固定路径> npm run eval:new-route -- --quick --only restaurant/neighborly --out artifacts/t159/authorized-20261014T043816Z/eval`。新账本在 budget/，密钥仅由网关进程按指定 source 主目录 .env.local，应用只持本地网关占位凭据；实际生成源码为干净的 `d7433e4`。04:48:57 UTC 开始，04:52:04 UTC 存版（纽约同日 00:48:57–00:52:04 EDT），标准 eval exit=0、PASS，case 耗时 197,422ms；站点 `20d7d9ae-8272-4880-81cd-eb2aec872557`、版本 `7be34b12-ec78-4d75-bcd5-c12a4b7e210d`、revision=1，首页与菜单两页完整。五次 HTTP 200 用量依次为规划 **11,207**、写页 **36,739**、事实 **10,169**、一轮修正 **7,992**、事实 **10,021**，本次合计 **76,128 / 130,000**；已知累计 **193,905**，精确历史累计仍未知，含旧未知上界的累计 **284,237 / 360,000**。原未知账本未修改。首轮事实拒收了资料未声明的豆腐煲午晚供应时段，标准一轮修正后最终底线通过，两次检查与拒因均在本次 run/attempts，未重跑生成掩盖。两页 375/768/1440 溢出、重叠、过窄列均 0；悬停门控和 375 点击区有非拒收质量反馈，保留在 checks，不自评审美。运行结束立即向主控回报；`terminal-before-gateway-stop.json` 核对 actual run complete、网关五条请求 complete 且 usage 全齐后，才手动 SIGTERM 网关，随后停本工作树应用，未用收尾编排脚本。

真实缩略图 `eval/private/neighborly-style-preview.webp` 来自本次已存版本首屏；随机风格区分包 `eval/packages/8d3d8854f7/review`、同店成对包 `eval/packages/eea6cc7efe/review` 各 8 图，分别交主控另开的新盲评实例，只读取各自 review。对照复用 T-160 真实餐厅版本 `60cde704-7364-461c-a236-9af8933c5b4c`，配包时再次核对资料文本相同，没有再花对照 token。private 映射、来源、用量与缩略图元数据留在 `eval/private/t159-pairing.json`，不交盲评。标准 mixed/company 包也完整保留；本轮 29 张图（含复制包与缩略图）均逐张打开，非空白、载入态或意外截断；首屏按规定 fold 取景。源码未继续改，构建 PASS（build.log）；主目录 .sitecraft-data 未写，本工作树站点/会话路径在 `eval/report/data-files.json`，由主控收尾复制。交付 SHA 与证据关联于同目录 delivery.json；不自开审查实例、不宣布审美通过、不关票。

**新增判断。** 只读主目录 T-158、T-160、t160-review-* 后，现有非工业盲评由 5/10 提升至 6/10，仍指出餐饮事务区过重、培训限制重复；未找到设计工作室真实生成/盲评，窄列反例不能作审美依据。先验证一个「邻里日常」候选：黑体招牌、柔和色面、店内价目与告示；不是固定行业模板，不增加功能或事实。T-160 餐厅实际「现场实拍」版本已经是暖浅底、黑体、菜单价目，是该资料最接近的现有方向；其 `private/case-1/materials.txt` 与当前 restaurant quick 资料完全一致，直接复用站点 `32e0ab93-d3c5-470e-b4cd-16180fd5ba8b` / 版本 `60cde704-7364-461c-a236-9af8933c5b4c`，不另跑对照。

**当前准入合同。** 服务端 `SITECRAFT_EVAL_STYLES` 用逗号列出已登记 pending 编号；Next 配置加载时校验，未知或 ready 编号在未收到首个 HTTP 请求时使启动失败。styleQuestion 在该进程增加候选，chat select 仍核对持久化问题、问题版本和原有门禁；普通进程不给候选选项并返回 400，旧评估问题也不能继续授权候选，客户端字段不能启用。auto 的资料选择合同、枚举与 skill 加载始终只含已验证风格。变量没有客户端读取，也没有新 API。**Tracer bullet** 经真实 CLI→HTTP→生产 chat select→规划；**Deep modules** 保持同一登记、同一提交入口；**Ubiquitous language** 沿用风格、页面大纲与盲评包。

**准入证据（2026-10-14 UTC）。** 在父版本 `dcf8c0e`，`SITECRAFT_BASE=http://127.0.0.1:3199 node --test --experimental-strip-types tests/t159-eval-entry.test.ts` 4/4 预期失败：on 仍 400；三个非法配置仍启动，原日志 `artifacts/t159/entry-parent-dcf8c0e-red.log`。修复后同一 CLI→HTTP 入口 off=400/0 次规划、on=202/1 次规划；旧评估会话在普通进程拒绝客户端启用字段。模型与 after 用替身，写页故意 503 止于该边界，不证明真实模型或实际 Next after 集成。实际 Next start 的三种错误配置无首个请求即自然 exit=1，日志在各 startup-contract 目录；不是只验证 parser 或只读组合文件。

本版本 Next 的 Ready 日志早于配置加载，首次启动测试错误地据此终止进程（`entry-green.log`）；改为等待无首个请求时自然退出后，instrumentation 路线仍因懒初始化失败（`entry-green-startup.log`）。两份失败保留；已删该路径，校验只在 Next 配置加载和服务端工作流导入执行。最终定向 `tests/t159-eval-entry.test.ts tests/t159-style-eval.test.ts tests/t153-style-preferences.test.ts` **10/10 PASS**，`entry-config-green.log`；typecheck 和 build 通过（`entry-typecheck-final.log`、`entry-build-config.log`）。新的独立 Astra 对冻结 `5dc7849` 的准入审查 PASS（只准入门槛），原文 `artifacts/t159/gate-review-5dc7849.txt`；另有冻结提交 4/4 用例，绑定 SHA 与 dirty=false。父版启动红日志使用不同断言，不单独作为当前自然退出断言的反事实证明；实际无首个请求即 exit=1 是直接证据。

**预算与保留的失败。** 总上限仍 **260,000**，已花 **30,770**；本轮获批生成 neighborly 一次，新账本单次 `SITECRAFT_TOKEN_LIMIT=130000`，不改保守请求预留规则；开始前按已花额加单次最大额核对总限。原账本 `artifacts/t159/budget-neighborly-20261014T012608Z/usage.json` 保留且 stopped=true：规划 15,786，写页 14,984；单次 70,000 在写页前只留下 5,401 输出额度，全部用于思考，HTTP 200/length，没有 HTML/CSS、事实核对、底线检查或已存版本。按主控决定，这次是单次预算设小导致的截断，不算模型质量问题。站点 `4c13530a-af1d-454a-a8e6-6f7a7801b950` 及其会话完整保留；原报告、账本、两张已打开的官网对照图在 `real-neighborly-20261014T012608Z/`，blind-coverage=false，不能交审。首次服务退出造成的 360/435 失败和修复后 435/435 通过均留在原日志，不引用为本次代码的全量证据。

此前 Astra 对 `918cfa6` 的 P1（最终选择门禁拒绝候选）和 P2（CLI 测试只证明组合构造）原文保留在 `artifacts/t159/acceptance-review.txt`；本次在主控明确合同后修复，评审是另一个新实例。拿到版本后制作真实缩略图、随机风格区分包和同店成对包，private 映射/来源/用量不交盲评。候选仍 pending，独立页面盲评由主控另开实例，执行者不选胜者或宣布审美通过。

**此前真实结果 INCOMPLETE。** 准入审查通过后，在 `5dc7849`（源码干净）运行一次：

```sh
SITECRAFT_BASE=http://127.0.0.1:63453 SITECRAFT_TOKEN_LIMIT=130000 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm run eval:new-route -- --quick --only restaurant/neighborly --out artifacts/t159/approved-neighborly-20261014T015431Z
```

本次 2026-10-14 01:55–01:57 UTC，账本 `artifacts/t159/approved-budget-20261014T015431Z/usage.json`：规划 11,434，写页 35,905，合计 **47,339**；两次 HTTP 200、回复完整，网关 stopped=false，随后关闭。计入旧 30,770，累计 **78,109 / 260,000**，剩余 **181,891**。执行者启动应用进程时遗漏 CHROME_PATH，仅给评估进程设置，应用报「底线检查需要 CHROME_PATH；本次未保存版本」。这是执行环境遗漏，不是预算、模型质量或底线拒收。事实核对、浏览器底线与修正没有运行，版本数 0；不冒充生成通过。

新站点 `f513a199-cfa2-4c7e-bd4d-edea7fde084f`、会话及运行完整留在本工作树；用量逐次与账本对齐，路径在本轮 `report/data-files.json`，失败细表在 `report/summary.json`。只产出两张官网对照图，均已打开；无可交盲评的生成图、缩略图或成对包，配包脚本未执行。没有换资料、伪造生成页或绕提交入口存版，主目录数据未改。

启动配置已修正：`artifacts/t159/start-approved-app.mjs` 要求显式且可执行的 CHROME_PATH，并传入应用子进程；实际启动记录 `app-bootstrap-2026-10-14T02-02-18-055Z.json`，cwd 与本工作树一致。本轮授权只包含一次真实生成，执行者已向主控申请追加一次、新账本、单次 130,000、累计仍不超 260,000；主控已认可 859ae9f 的准入审查并明确批准再跑一次、先做零成本预检；见下文最新结果。第二风格未开始。

最终技术检查：`npm run typecheck`（gate-typecheck-final.log）、`SITE_STORE=fs npm run build`（entry-build-config.log）PASS；`SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:63453 SITECRAFT_TOKEN_LIMIT=130000 CHROME_PATH=<上述路径> npm test` **439/439、0 skipped**（gate-full-test.log，02:03–02:07 UTC）。普通进程三档工作台图 `gate-selection-complete-{1440,768,375}.png` 已逐张打开、完整载入，候选隐藏；它们只证明选项准入，不是生成站或审美证据。复现截图命令：`SITECRAFT_BASE=http://127.0.0.1:63453 CHROME_PATH=<上述路径> T159_SELECTION_GATE=artifacts/t159/gate-selection.json T159_CAPTURE_PREFIX=gate-selection-complete node artifacts/t159/capture-selection.mjs`。project-map Problems 0、Stale living docs 0；最新提交与原审查目标由 `artifacts/t159/gate-delivery.json` 关联，审查后代码、测试不再改，只更新本票真实结果。本票保持 open，不推送、不关票。

**此前获批运行 INCOMPLETE（2026-10-14 UTC）。** 主控已认可 `859ae9f` 准入审查，不再另审，并批准单次 130,000、累计含 78,109 不超 260,000 的一次生成。此后未开任何审查实例。

零成本预检全部 PASS，证据 `artifacts/t159/final-20261014T023002Z/preflight.json`：实际 /api/health cwd 为本工作树，文件存储、deepseek-flash 与整站思考配置正确；选择性 Node 启动记录分别观察应用 CLI 与实际 Next worker 的 CHROME_PATH、SITECRAFT_EVAL_STYLES、SITE_STORE 和数据根目录。实际应用 select 返回 202，本地替身收到原 submit_page_plan、neighborly 枚举与短 skill；替身故意 503 止于输出前，真实请求 0。替身关闭后保留同一应用 worker，`before-real.json` 再核对 health 与 PID、ps 无其他 Chrome/测试。没有只看调用者环境或替身 health。

真实命令：`SITECRAFT_BASE=http://127.0.0.1:55052 SITECRAFT_TOKEN_LIMIT=130000 CHROME_PATH=<票中固定路径> npm run eval:new-route -- --quick --only restaurant/neighborly --out artifacts/t159/final-20261014T023002Z/eval`。密钥仍仅在网关子进程 source 主目录 .env.local；网关新账本在同轮 budget/，预留规则未改。源码为干净的 `859ae9f`。

02:33:21–02:35:29：规划 10,782、写页 28,886，两次 HTTP 200，已知本次 **39,668**。事实校对请求 02:35:22 已发出时，本地 draft 读取出现 fetch failed；原评估快照中的 generate 仍 running。评估器退出后，执行者的收尾脚本立即关闭仍有进行中请求的网关，应用随后事实调用也报 fetch failed，版本数 0。首次本地读取失败底层原因未留栈，不能归因模型、预算或其他工作树；过早关网关是明确的收尾错误。没有重发请求、重跑生成或重置账本。

事实调用未收到 usage，原 ledger.calls[2] 保持 in-flight，spentBefore=39,668、inputUpper=28,995、outputLimit=61,337、reserved=90,332。已知累计 **117,777**，精确累计 **未知**；本次最大额 130,000、累计预留上界 **208,109 / 260,000**。不能把原 result.json 的 cumulative=117777 当精确累计或据此再授权；不修改原账本补齐虚构用量。真实调用已停止，须等 T-165 合并且主控再次通知，之后最多一次；网关只在实际 run 终态且没有进行中请求后手动停，禁止编排脚本关闭。

站点 `ce55589c-3d98-4510-b428-43a73e2e854a` 的终态与真实文件路径在 `eval/report/terminal-site.json`、`summary.json`、`data-files.json`；原 `private/case-1/code-site.json` 保留 running 快照，未覆盖来掩盖退出时机。已有浏览器/事实步骤开始，但完整检查未落盘，不能列机械检查通过。只产出两张官网对照图，均已打开；blind-coverage=false，未制作缩略图或伪盲评包。T-160 对照仍可按此前同资料核对复用，但没有新版可配对。源代码、测试未改，之前 439/439、typecheck、build 仍对应同一源码；这不替代真实生成失败。应用和网关收尾停止，主数据不改，票保持 open。最新提交与证据关联于 `artifacts/t159/final-20261014T023002Z/delivery.json`。

**零成本修复与当前边界（2026-10-14 UTC）。** 证据统一在 `artifacts/t159/local-recovery-20261014T030031Z/`。历史能确认断点为 eval→本地 `:55052/api/sites/ce55589c-3d98-4510-b428-43a73e2e854a/draft` 的读取；CLI 退出时 generate 仍 running、同一应用 worker 仍活着，端口没有改。`final-real.mjs` 在 CLI close 后的 finally 立即 SIGTERM 网关，打断事实请求，是已确定的收尾根因；该脚本停用。旧错误没有 cause/阶段/耗时，Next trace 中首页编译 152ms、首页请求 19.8s、最后 draft 成功 353ms，均不足以确诊旧读取为何断开；不把编译、超时或连接复用写成已确定原因。

本地用现有 `t157-model-fixture.ts --hold-facts` 和仅断一次 draft 的测试代理，经标准 eval 复现 CLI fetch failed；`parent-exit-still-running.json` 同时记录 run running、activeRequests=1。手动 release 后原 run `56b6f58c-6d0b-4293-82ef-dbe67d04defd` 完成并保存版本 `7243acf2-500b-4b84-87a0-5ae86bbca7ff`（`parent-run-completed.json`），没有再次 select/confirm。此对照证明观察者失败不等于后台失败，不能证明历史也是同一种 socket 断开。

标准 eval 现在在 `private/http-requests.json` 保留端点、方法、时间、耗时、fetch/body/http 阶段、状态和安全的错误 cause 字段，不记录请求正文、header 或密钥；保留原错误，不增加重试、回退或关闭进程。新入口测试在父源码 `1c431e3` 先因缺少诊断文件失败（`diagnostics-parent-red.log`），同一断开修复后通过（`diagnostics-final-green.log`）：UND_ERR_SOCKET、GET draft、fetch 阶段、HTTP 状态 null，CLI 仍 exit=1，仅一次 select、零次 confirm。

完整命令 `SITECRAFT_BASE=http://127.0.0.1:50954 CHROME_PATH=<票中固定路径> npm run eval:new-route -- --quick --only restaurant/neighborly --out artifacts/t159/local-recovery-20261014T030031Z/complete` 于 03:06:21 UTC 开始、在父 SHA `1c431e3` 加本次未提交源码下运行。实际 Next dev 使用文件存储、本工作树 cwd、仅本地 local-fixture 模型；标准 HTTP select→规划→确认→写页→提交入口检查→保存版本→三档截图→评估包全部 PASS。站点 `d7416e71-1dc2-48f9-b0c5-8e35b19c6a1e`，版本 `fbfa5f0c-d80e-4a11-9f3b-035fac63e954`，版本数 1；`complete-terminal-before-stop.json` 确认 complete、activeRequests=0 后才手动停替身。全程未加载 .env.local、未发真实请求，新增真实 token 为 0。ps 读取 worker 环境的附加观测未暴露字段，断言失败保存在 `process-env-observation-unavailable.json`；不冒充环境读取成功，实际本地请求和 Chrome 检查另有直接证据。

缩略图 `complete/private/fixture-neighborly-preview.webp` 来自此次已存版本首屏；标准 mixed/company 包与两个随机命名的风格区分、同店成对流程包齐备，后两包复用同资料 T-160 餐厅截图，身份映射只在 `complete/private/fixture-packaging.json`。本轮 31 张图含复制包与缩略图均逐张打开核对载入和完整性。替身只证明协议与流程，事实返回空问题不是语义事实核对，所有包仅供主控核对流程，不作盲评或审美证据，不登记用户缩略图、候选仍 pending，未开审查实例。本次源码定向测试 1/1、`SITECRAFT_BASE=<上述本地 origin> npm run typecheck`、`SITE_STORE=fs SITECRAFT_BASE=<上述本地 origin> CHROME_PATH=<票中固定路径> npm test` **440/440、0 skipped**、`SITE_STORE=fs SITECRAFT_BASE=<上述本地 origin> npm run build` 均 PASS，日志分别为 diagnostics-final-green/typecheck/full-test/build.log；检查在本次源码修改之后、2026-10-14 UTC 完成，提交 SHA 与本次产物关联于同目录 delivery.json。project-map Problems 0、Stale living docs 0，应用与替身已手动停，本票保持 open。

**未知用量核查。** 已查原网关账本/日志、应用站点和会话 run、dev server 日志/Next trace、eval 快照/终态/报告及只读主目录 artifacts/t159，来源清单在 `unknown-facts-investigation.json`。应用开始 `2026-10-14T02:35:22.962Z`；网关开始 **2026-10-14 02:35:22.987 UTC / 2026-10-13 22:35:22.987 EDT**；模型 deepseek-flash，本地 runId `84eef7d8-318a-495e-a502-3a76cb7c6d53`、账本第 3 条，DeepSeek 上游 request id 未保存。请求 JSON 正文 **20,803 UTF-8 字节**由当时公式 inputUpper−8192 逆算；模型名称相同、max_tokens 从 65536 改 61337 位数相同，序列化正文大小不变；不是 HTTP 包大小或原正文实收记录。实际 usage 无法从本地恢复，需负责人在 DeepSeek 控制台按上述时间和模型查，不猜测、不修改原账本。
