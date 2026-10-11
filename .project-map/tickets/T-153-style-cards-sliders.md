---
id: T-153
title: 风格卡用真实缩略图、增加风格，并让两个滑杆在成品上看得出差别
type: build
status: closed
blocked_by: []
claimed_by: Codex (t153-style-cards)
supersedes:
---

## Why

负责人 2026-10-09 排定的第 4 项：让用户在「精密工程」「现场实拍」之外有更多风格可选，并能调整版式和疏密。mainline 已定：主风格单选 + 「版式：规整 ↔ 大胆」「信息：疏朗 ↔ 紧凑」两个滑杆，默认「帮我选」；风格卡展示本系统真实生成的缩略图；每个风格一份短 skill，必须能在评估集里看出差别，看不出就删。

现状：风格问题只有三个文字选项（`lib/code-site-workflow.ts` 的 `styleQuestion`），没有缩略图；两个滑杆已在工作台（`components/code-workspace.tsx`）并作为「版式 x/10，信息 y/10」一句话进入提示，没人验证过它们在成品上有没有可见差别；spec 写着「当前不做风格卡、缩略图或扩充风格库」，本票取代这一句。

## What to build

1. **新风格**：新增风格 skill（`skills/site-code-<名>/`），与现有两份同样短、同样结构。候选从已核过许可的研究资料（T-146 的 good-css / Oil UI 方法、`resources/`）中提炼，适合工业、设备、零部件、外贸 B2B；先在 Resolution 写清每个新风格与现有两个的可见区别（版式骨架、字体、色彩、图片用法），再写 skill。数量由主控按真实预算确定（见 Acceptance），代码按「风格目录」一处登记，加一个风格不改多处。
2. **风格卡**：风格问题的每个选项显示一张本系统真实生成站点的首屏缩略图（静态 WebP，提交进仓库，来源站点与生成版本写进登记），配一句普通语言描述，不出现 skill 名。「帮我选」没有缩略图，写清由系统按资料挑。缩略图来自评估集或演示站的真实生成结果，不是手绘或外部模板截图。
3. **滑杆生效**：把两个滑杆从一句数值提示改成按档位给出具体、可检查的写法差异（例如版式：栅格对齐程度、首屏比例、不对称与叠放；信息：每屏内容量、段落长度、表格与列表密度、留白），三档即可（1–3 / 4–7 / 8–10），写进核心规范或风格 skill 的同一处。滑杆只影响版式与密度，不改事实、不增删用户资料里的内容。
4. 工作台：风格卡和滑杆在 1440/768/375 下可用，键盘可操作；刷新恢复选择；对话里改风格或滑杆仍走现有需求对齐与提交入口。
5. 同步 `intent.md`、`spec.md`（删去「当前不做风格卡」）、`mainline.md`、`CONTEXT.md`。

## Failure modes

新风格和旧风格看起来一样；滑杆不同档位成品看不出差别；滑杆把内容删了或加了资料里没有的东西；缩略图与实际生成效果不符或用了未授权图片；风格卡在 375 下挤压或不可键盘选择；刷新后选择丢失；加风格要改多处；「帮我选」选出未登记风格。

## Acceptance

- [x] 先列失效方式再写红绿测试，测试在已知坏实现上失败（风格目录登记、缩略图存在且登记来源、滑杆档位进入提示、未登记风格被拒）
- [x] 开发阶段一律用本地模型替身；真实 DeepSeek 只在主控按负责人批准的预算运行，每次生成前估算，超了停
- [x] 区分度盲评（新盲评实例，随机命名）：同一家公司资料分别用新风格和现有风格生成，评审能否分出两种不同方向并描述差别；同一站按主控本轮指定的 2/2 与 5/6 对比首屏与产品页，评审能否正确指出哪版更大胆、哪版更紧凑。分不出就按 mainline 删掉该风格或重写滑杆规则，如实记录
- [x] 工作台风格卡与滑杆 1440/768/375 截图看过
- [x] Astra 审查通过；typecheck、test、build 通过

## Resolution

2026-10-11，负责人批准方案 1，仅验证品牌画册，真实总预算硬上限 300,000 token。已完成同资料的 5/6 与 2/2；主控指定用已生成的 low（2/2）与 default（5/6）做差距更小的严格盲评，现已转达通过结论，不再跑 9/9、不再调用真实模型。工业铭牌不在运行时提供选择，设计说明保留。票保持 open，不推送、不关票。

当前结果：**PASS（本轮修复与执行侧验收，待主控合并验证）**。风格区分与滑杆盲评已由主控转达通过；保留品牌画册，9/9 不再运行。品牌画册 5/6 与 2/2 都经同一提交入口保存，真实累计仍为 226,474 token。本轮只修复 Astra 提出的脚本地址配置问题并做本地替身验证，新增真实模型调用为 0；主控在合并时补最终验证，票保持 open。

### 风格与界面

唯一目录仍为 `lib/code-site-styles.ts`。当前只提供精密工程、现场实拍、品牌画册；三种均有真实生成首屏。品牌画册使用本次默认 5/6 的 v1，站点 `ed6bfbe4-8141-4edb-86f9-d65a91f67eff`，版本 `fecaa36c-2aaf-44ee-bdc0-8e38102f84b0`。原图 1440×1000 等比转 576×400 WebP，来源与照片许可在 `public/style-previews/SOURCE.md`，不润饰页面。

历史会话可能保存过已删除选项：工作台按当前目录过滤，下线偏好明确要求重新选择，不静默改成另一风格，不删除旧站或会话。三档滑杆、键盘与刷新恢复沿用前一提交的流程。

设计说明保留如下，工业铭牌仅供以后单独验证：

| 方向 | 版式骨架 | 字体与色彩 | 图片用法与区别 |
| --- | --- | --- | --- |
| 品牌画册 editorial | 画册扉页式引言，窄栏说明与宽栏产品交替、跨栏标题；不整页复用细线网格 | 系统宋体/衬线标题、黑体正文，暖白底、墨棕字、一处陶土色 | 授权图保留完整比例、穿插正文；区别于精密工程的冷色参数目录和现场实拍的整宽照片、大字 |
| 工业铭牌 industrial（未验证，不提供选择） | 深底产品索引，型号与规格成连续横向条目，一条窄强调色带；不依赖照片撑满首屏 | 系统粗黑体标题、等宽型号，深墨底、米白字、安全黄点缀并核对对比度 | 产品图 contain 与对应条目并排；区别于精密工程浅底细线及现场实拍的图像主导、深浅交替。没有型号或规格时只排已有业务内容，不编数据填表；全站无动效 |

### 样本、用量与底线

只读旧评估 `artifacts/t130/round-2026-10-09T10-14-09-315Z/private/case-2`：外高桥流体接头，现场实拍，两页站，原版本 `bef0d4df-2bfc-4740-890e-f5cd19496adc`。复制原始 2724 字资料与 8 张已有许可图片到本工作树，通过当前站点创建、上传、需求对齐与确认入口生成；未读写主工作区 `.sitecraft-data`。密钥仅按授权 source 主 `.env.local` 进入独立预算进程，没有打印、复制或软链。

| 生成项 | 启动前估算 | 启动前已用 | 本次实际 | 累计 | 结果 |
| --- | ---: | ---: | ---: | ---: | --- |
| 品牌画册 5/6 | 91,000 | 0 | 144,698 | 144,698 | v1，2 轮事实修正后通过 |
| 同站 2/2 | 89,000 | 144,698 | 81,776 | 226,474 | v2，1 轮事实修正后通过；版本 `87b49816-327f-4180-9cb1-9c4c81eeb114` |
| 同站 9/9 | 100,000 | 226,474 | 0 | 226,474 | 预计 326,474 超限，未启动 |

共 12 次上游请求，全部 HTTP 200；输入 91,198、输出 135,276（含推理），合计 226,474，未遇 402。剩余 73,526；没有为满足预算下调 9/9 估算。网关在每次调用前预留完整请求 UTF-8 字节数加 8192 的保守输入界限，并用余额限制 `max_tokens`；用量未知、HTTP 错误、截断即停止。显式恢复预算进程校验并沿用同一账本，不能将已用额度清零。默认站完成后曾暂停核算，随后按“每次生成前”条件继续预算内的 2/2；账本第 8 次调用的 spentBefore 仍为 144,698。

5/6 的两个拒因分别是认证区新增“需要按订单确认”，以及把气密试验台归为加工工艺；2/2 新增“目录供货与按图加工共用同一批设备与质检流程”。均由既有局部修正处理，没有手改产物、跳过检查或换样本。每轮拒收候选与完整检查保留在各 phase 的 `code-site.json`。

首站比 91,000 估算多 **53,698 token（约 59.0%）**，原因是估算基线只含规划、写页和一次事实核对，没有计入实际触发的两轮修正及其后完整事实复核：

| 阶段 | 原估算 | 实际 token | 账本调用 |
| --- | ---: | ---: | --- |
| 规划 | 12,000 | 12,754 | 1 |
| 首次写页 | 52,000 | 47,765 | 2 |
| 首次事实核对 | 27,000 | 24,923 | 3 |
| 基础阶段合计 | 91,000 | 85,442 | 1–3 |
| 两次局部修正 | 未含在基线内 | 17,222（8,589 + 8,633） | 4、6 |
| 两次额外整站事实复核 | 未含在基线内 | 42,034（25,688 + 16,346） | 5、7 |
| 首站总计 | 91,000 | 144,698 | 1–7 |

基础阶段实际比估算少 5,558；后续修正与复核新增 59,256，抵消节省后净超 53,698。额外消耗主要来自两次完整事实复核（42,034），不是写页超长。两次局部修正的输出总共只有 106 token，但请求输入共 17,116；因此修改文字虽短，仍会产生修正上下文和再次全站事实核对的 token 用量。全部事实核对共三次，总用量 66,957。依据为 `private/budget/usage.json` 的逐次上游 usage，包含推理；不把缓存命中 token 从本轮 token 预算中扣除。

两个已保存版本均覆盖首页/产品页 × 375/768/1440，最终溢出、重叠、对比度问题均为 0。质量反馈不拒收：5/6 的正文长行 13、悬停未门控 27、375 点击区偏小 12；2/2 分别为 9、27、15（均为跨页/视口累计触发次数，非唯一元素数）。两版文字裁剪、锚点遮挡、产品图 cover 裁切反馈均为 0；技术通过不等于审美或资料完整性已独立通过。

### 盲评交付

根目录 `artifacts/t153/approved/real-2026-10-11T03-58/`：

- 风格区分包：`review/9f02006d/`。同公司旧现场实拍 vs 本次默认品牌画册，首页和产品页各 1440/375，共 8 张；随机命名、随机顺序，均已打开检查。说明只问不同设计方向、各自特点、哪版更像该公司的官网，不透露风格名、参数或生成来源。
- 滑杆包：`review/67f1a975/`。按主控指定，将同一品牌画册站的 low（2/2，v2）与 default（5/6，v1）作为本轮验收对；首页和产品页各 1440/375，共 8 张。重新随机命名与顺序，8 张均打开检查；说明只问“哪版版式更大胆（不规整）”“哪版信息更紧凑”，不提滑杆、档位、风格或预期答案。
- 映射：风格包沿用 `private/blind-mapping.json`；本轮滑杆包单独保存为 `private/blind-layout-density-67f1a975.json`，包含真实版本与档位，不交评审。旧付费阶段关于 9/9 缺项的记录保留为当时结果；资料、授权上传记录、完整代码版本及失败候选、用量分别在 `private/materials.txt`、`private/uploads.json`、`private/{default,low}/code-site.json`、`private/budget/usage.json`；总状态在 `private/generation.json`。只把匿名 review 子目录交盲评，private 不交评审。

### 主控转达的独立盲评结论

2026-10-11，主控在当前任务中转达结果，作为本票验收依据；不由实施者另作审美评分：

- **风格区分通过，保留品牌画册**：`review/9f02006d/` 被判为不同设计方向。“哪版更像公司自己的网站”选原风格；已知反馈是原版采购路径更直接，画册产品入口靠后。此偏好未胜出如实保留，不写成画册全面更好；本轮不改生成产物或扩展修复范围。
- **滑杆有效，不再跑 9/9**：`review/67f1a975/` 中 default（5/6）被正确判为比 low（2/2）更大胆、更紧凑。本轮按主控批准的这组更小差距完成验证。

### 验证与复现

本次变更先列失效方式：下线风格仍可选、旧问题复活旧选项、旧偏好静默改选、真实缩略图漏来源、预算忽略已用量、恢复账本清零、未获批准就替换对比档位，或把未生成的 9/9 写成已完成。红绿证据均保留在 `artifacts/t153/approved/`。

所有命令显式设置 `SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:3170`；浏览器命令另设 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell`。本轮真实调用时间 2026-10-11 03:58 UTC 起，时间与每个请求用量以账本为准；真实生成与下表实现验证对应提交 `4fa88c3`（父提交 `1daede8`）；本次只打包已有截图并更新说明，未重新调用模型。

| 检查 | 命令 / 证据 | 结果 |
| --- | --- | --- |
| 风格目录及真图 | `node --test --experimental-strip-types tests/t153-style-preferences.test.ts`；`red-retire-industrial.log` → `green-retire-industrial.log`、`red-editorial-preview.log` → `green-editorial-preview.log` | 父候选保留工业铭牌、品牌画册仍为 pending 时拒绝；当前 5 项通过 |
| 历史问题 | `node --experimental-strip-types scripts/t153-retired-style-e2e.ts`；`red-retired-ui.log` → `green-retired-ui.log` | 原工作台显示已删除选项而失败；当前隐藏并要求重新选，选择合法风格后可提交；只造会话/偏好元数据，不旁路写版本 |
| 预算 | `node --test --experimental-strip-types tests/t153-budget.test.ts`；`budget-red-mutant.log` → `budget-green.log` | 去掉累计额度对输出的限制时断言失败；当前通过；真实续进程账本保留累计费用 |
| 真实入口 | `node --experimental-strip-types scripts/t153-real-generation.ts <prepare/default/low/high> <根目录>`；`prepare-real.log`、`default-real.log`、`low-real.log`、`high-budget-stop.log` | 前两项通过；high 在估算关口预期退出 1，没有第 13 次付费请求 |
| 匿名包 | `node --experimental-strip-types scripts/t153-blind-packs.ts <根目录> --available-style-pair`；`pack-result.log` | 只打包已完成的风格对比，整体 INCOMPLETE；没有伪造第二包 |
| 替身 E2E 与截图 | `node --experimental-strip-types scripts/t153-style-e2e.ts`；`e2e-final.log`、`artifacts/t153/e2e-1791691582215/report.json` | 通过，1440/768/375 的卡片与滑杆截图均已打开；真实调用停止期间使用本地替身 |
| 类型/全测/构建 | `npm run typecheck`、`npm test`、`npm run build` | PASS；373/373、0 跳过。三项通过 `&&` 顺序执行，工具报告整条命令退出 0；日志为 `typecheck-verified.log`、`test-final.log`、`build-verified.log`，退出结果收据为 `checks.json` |
| 上次实现审核 | 新 Codex GPT-6 Astra 实例 `t153_paid_stage_review`，冻结父提交 `1daede8` 上的本轮 diff；独立单测 6/6，通过三档 UI 截图及预算/版本/来源核对 | INCOMPLETE：未确认新增代码缺陷；缺少 9/9 与滑杆包，不能将完整任务记 PASS；本审核已读映射，不兼任页面盲评 |

此前无付费阶段在 `1daede8` 交付，旧红态、失败和用量估算仍可从该提交及 gitignore 的 artifacts 查阅，不把旧证据当成本次通过结果。两包的独立盲评结论以主控本轮转达为准，见上文。9/9 不再运行；主控在合并时补最终验证。

审核限制：402 不重试、网关并发互斥及中断恢复本次只做静态检查，没有故障注入；类型和构建的文本日志不含内嵌退出码，退出码来自实际工具执行结果。使用本次完成版本与真实用量，未将替身测试或未执行的高档生成视为审美证据。

本次打包复现（无网络或模型调用）：`SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:3170 node artifacts/t153/approved/real-2026-10-11T03-58/private/package-low-default.mjs`。命令退出 0；日志 `artifacts/t153/approved/pack-low-default.log`。打包前核对两版同站、同资料、同风格、不同真实版本、正确档位与已通过的检查；按两个页面和两种宽度核对 PNG 元数据、8 张文件及两个不泄题的问题，逐图查看。当前程序代码未改，未重跑上个提交的 typecheck/test/build；本次执行包核对、UTF-8 回读、diff 和 project-map 检查。对应文档提交 `d593708`（父提交 `4fa88c3`）；此处记录打包时的验证范围，后续盲评结论见上文。


### Astra 地址配置问题修复

主控转达的 NO_GO：T-153 两个 E2E 锁定 3170，读取替身请求及替身监听锁定 3171。失效方式：换工作树端口即拒绝、误连原工作树、只改应用地址却仍访问旧替身、外部或通配地址被接受、默认回退主工作区 3034。

统一由 `scripts/local-endpoint.ts` 读取与校验显式本地 HTTP origin：应用 `SITECRAFT_BASE`，替身 `SITECRAFT_FIXTURE_BASE`，预算网关 `SITECRAFT_BUDGET_BASE`；不提供默认地址，只接受 127.0.0.1、localhost、[::1]，拒绝凭据、路径、query、fragment、外部地址与通配绑定。替身监听和请求记录读取使用同一配置。预算脚本只迁移本地入口地址配置，本轮未执行真实预算脚本。

同类修复覆盖全部已追踪 `scripts/t15*` 中的固定本地地址/监听端口，并移除 `tests/t151-english.test.ts` 默认回退 3034；单元替身的系统动态分配端口保留。两个 T-153 E2E 在建站前校验服务的工作树身份；历史选项 E2E 尊重显式 `SITECRAFT_DATA_ROOT`，不再覆盖调用者的数据目录。风格 E2E 按本次请求增量核对配置替身的调用，不能用之前的六条记录代替。

红绿证据在 `artifacts/t153/port-config/`：父提交 `d593708` 上两个脚本设置 3173 都因期待 3170 失败（`red-style-3173.log`、`red-retired-3173.log`）；同类固定端口扫描失败见 `red-scan.log`。放行外部地址的 mutant 和忽略监听端口的 mutant 分别在 `red-local-validation-mutant.log`、`red-fixture-port-mutant.log` 失败；恢复后 `green-config.log` 三项通过。机械检查为 `tests/t153-local-endpoints.test.ts`，覆盖配置验证与两个替身 CLI 的实际 HTTP 响应，防止同类错误再出现。

本轮四次真实浏览器 E2E（均为本地模型替身，退出 0）：

| 应用 / 替身 | 脚本 | 本次报告 |
| --- | --- | --- |
| 3170 / 3172 | `scripts/t153-style-e2e.ts` | `artifacts/t153/e2e-1791693112918/report.json`，PASS，本次替身调用 0 → 6 |
| 3170 / 3172 | `scripts/t153-retired-style-e2e.ts` | `artifacts/t153/approved/retired-style-1791693127619/report.json`，PASS |
| 3173 / 3174 | `scripts/t153-style-e2e.ts` | `artifacts/t153/e2e-1791693181001/report.json`，PASS，本次替身调用 0 → 6 |
| 3173 / 3174 | `scripts/t153-retired-style-e2e.ts` | `artifacts/t153/approved/retired-style-1791693196864/report.json`，PASS |

复现时显式设 `SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:<应用端口> SITECRAFT_FIXTURE_BASE=http://127.0.0.1:<替身端口>`，以及上文 CHROME_PATH；替身运行 `node --experimental-strip-types scripts/t153-model-fixture.ts`，开发服务 `npm run dev -- --port <应用端口>`，开发服务的 `DEEPSEEK_BASE_URL` 取同一替身地址，密钥与模型均使用 `local-only-fixture`。两种 E2E 分别运行 `node --experimental-strip-types scripts/t153-style-e2e.ts`、`node --experimental-strip-types scripts/t153-retired-style-e2e.ts`。3170 使用本工作树 `.sitecraft-data`；3173 的服务和脚本同时设置 `SITECRAFT_DATA_ROOT=/Users/luckye/Documents/Code/sitecraft-ai-t153/artifacts/t153/port-config/data-3173`。两组工作台截图均在各自 E2E 目录，已逐张打开。


本轮最终检查：2026-10-11，在显式 `SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:3170 SITECRAFT_FIXTURE_BASE=http://127.0.0.1:3172` 下顺序运行 `npm run typecheck`、`npm test`（上述 CHROME_PATH）、`npm run build`，三个命令通过 `&&` 连接，工具报告退出 0。日志为 `artifacts/t153/port-config/typecheck.log`、`test.log`、`build.log`；376/376 测试通过、0 失败、0 跳过。独立 Astra 实例 `t153_port_review` 对父提交 `d593708` 上的冻结候选复核，结论 **PASS / LIMITED_GO**：端口配置 NO_GO 已修复，无确认问题；独立重跑配置逻辑与扫描 2/2 通过，核对四次 E2E 报告与两组三档截图。此结论限本轮修复，不代替主控合并验证。

执行侧 Acceptance 已全部勾选；盲评结论来自主控转达，代码配置结论来自新 Astra 复核，主控在合并时补最终验证。真实预算入口只做地址迁移和静态检查，本轮未执行；没有新增真实模型费用，累计仍为 226,474。对应本轮新提交（父提交 `d593708`，最终 SHA 见交付回复）；不推送、不关票。`project_map.py status` 为 0 问题、0 过时 living doc，`git diff --check` 与 UTF-8 回读通过。

## 主控合并验证（2026-10-11，纽约时间）

- 盲评由主控在隔离目录各开新 gpt-6-astra 实例：风格包判「不同方向」，更像公司选原现场实拍版；滑杆包（A=5/6、B=2/2）判 A 更大胆、更紧凑，方向正确。
- Astra：d593708 NO_GO（E2E 与替身脚本写死端口）；d804a1d PASS，用 3173/3174 实跑两个 E2E，含键盘、刷新与旧 industrial 偏好重新选择。
- 主线 d804a1d：`SITECRAFT_BASE=http://127.0.0.1:3034 CHROME_PATH=<本机 chrome-headless-shell> npm test` 376/376，`npm run typecheck`、`SITE_STORE=fs npm run build` 通过；日志 `artifacts/merge-d804a1d/`。真实 DeepSeek 本票 226,474 token（批准上限 30 万）。

