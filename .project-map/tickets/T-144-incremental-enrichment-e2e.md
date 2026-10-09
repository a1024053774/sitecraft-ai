---
id: T-144
title: 端到端验证：少量资料生成精简站，补充资料后站点逐步丰富
type: build
status: open
blocked_by: []
claimed_by: t144-build
supersedes:
---

## Why

T-141：用户给什么就做什么，资料少就做得少，补充后再继续丰富。T-143 把预算转向这条主流程。现有对话修改、版本、局部修正都分别验证过，但「从薄到厚」的连续使用没有端到端证据。

## What to build

在真实工作台入口（不旁路提交入口）走一条连续流程，发现问题就在根因层修：
1. 新建站点只给很少的资料（公司名、一句业务、两个产品名，无图、无联系方式），确认后生成。期望：页数少、没有询盘/报价/联系页，缺口按 T-139 显示「待补充」，不编内容。
2. 在同一会话里补充一批资料：产品参数、两三张授权图片（走正常上传准入）。期望：已有页面变丰富或新增产品页，新事实能通过事实校对，旧内容不丢。
3. 再补充：沿革、一个供货案例、联系邮箱，并明确要求「加联系页和询盘表单」。期望：新增联系页与系统询盘表单；没要求的东西不出现。
4. 每一步都是一个新版本，版本历史可看到这三步，恢复到第一步再刷新后状态正确。
5. 用真实 DeepSeek 只跑一家公司的这一条流程（先估算 token，预计 15–25 万），其余用本地夹具；1440/375 截图逐张看过。

## Acceptance

- [x] 三步流程在真实入口跑通，每步版本、页面清单与关键截图写进 Resolution；没要求的询盘/报价/联系不出现
- [x] 补充的事实进入页面且通过事实校对；补充前的内容没有被丢失或改写成别的事实
- [ ] 发现的缺陷在根因层修复并有测试，坏实现失败；Astra 审查通过；typecheck、test、build 通过
- [x] 主控安排一次新旧成对盲评（第一步精简站 vs 第三步丰富站，看是否更像该公司自己的官网）

## Resolution

**INCOMPLETE（执行流程与成对盲评通过；Astra 指出的漏检已修，待主控直接验收，全套测试仍有两项旧资料依赖失败）**。执行者 t144-build 按授权不关票、不派审查、不推送。运行基线 `5786144` 加本票差异；按负责人要求 amend 本票唯一的本地提交，最终 SHA 与最后一次补验关联在 gitignore 的 `artifacts/t144/numeric-fix/delivery.json`；先前交付与失败记录保留。

交付 `scripts/check-incremental-enrichment.ts`：从真实工作台新建入口发资料、结构化选风格、确认生成、正常上传、两次对话补充、历史恢复与刷新。`--fixture` 仅控制模型响应，`--live` 使用已配置 DeepSeek；两者都走原提交入口。新增 `--replay` 在禁网 Chrome 中只读重放已存版本的验收断言，不调用模型、上传或存版。新增路由回归测试和独立模拟输入，没有改生产生成路径，未发现本次三步流程的产品层缺陷。验收脚本的选择器转义错误已修正；整页采集在测量前隐藏滚动条，使测量与截图宽度一致，避免底部署名裁切。先前失败与裁切产物仍保留，不计入最终截图证据。

工作台脚本、路由测试与只读重放共用 `scripts/enrichment-acceptance.ts`。按三步输入累积断言：公司与业务、两个完整产品名、分别归属于 R/K 系列的型号/扭矩/减速比/输入功率/用途、两个沿革事件、完整供货案例与缺口、指定邮箱。用途及参数在对应产品的可见 DOM 范围内核对，不能靠另一产品或其他页面的同值通过。型号和数值按完整带字段名的词元核对，数值范围整体匹配；不能紧接额外字母、数字或小数点。NFKC、连字符及空格仅作排版归一，已知单位仍是完整值的一部分，不用前缀子串或 parseFloat 截断比较。每一步、每个页面都检查报价/询价/样品与未给出的响应承诺，包含公共页头页脚、辅助文案和链接；第三步只接受指定邮箱及联系页正文的系统询盘表单。

### 本次真实流程

2026-10-09 11:13:53–11:17:28 UTC，`deepseek-flash`，SITE_STORE=fs，3153 默认 Turbopack，仅一家模拟公司「澄川传动」、一次连续流程。站点 `86a0654d-1d7b-4fdc-ad86-87ba6b3dc23a`，同一会话未更换。

| 步骤 | 完整版本 ID | 页面 | 已观察结果 |
| --- | --- | --- | --- |
| 少量资料 | v1 `7c04adec-1685-4f4c-a901-ed01c7c2d440` | home、products | 公司业务、两个产品与待补充参数；无图、联系、询盘、报价入口 |
| 参数与授权图 | v2 `bccf18dc-bc48-4fc0-9ea3-e4b7fc8ae9a7` | home、products | R47/K57、各自扭矩/减速比/输入功率/用途正确进入产品页，原业务与系列保留；两张行业配图正常上传并显示，未增加联系功能 |
| 沿革、案例与明确功能要求 | v3 `1aecf054-6a24-4e81-a9d2-f4905c3343c2` | home、products、contact | 2016/2021 沿革、2024 华岭输送设备案例、指定邮箱与系统询盘表单出现；此前产品参数和图片保留，无报价/样品/响应承诺 |
| 历史恢复与刷新 | v4 `32917016-8bd2-4fb3-b237-094c558be6e0` | home、products | 从 v1 恢复，完整代码与 v1 相等；历史四版保留，刷新仍为 v4，新增参数、案例、联系功能未混入 |

三步首稿均通过提交检查，无修正轮。三步共 21 项页面×视口扫描（375/768/1440），溢出、重叠、对比度问题、长行均为 0；恢复版也重新检查通过。事实校对由真实提交入口执行。两张图来自 industrial 准入清单（产品减速机、设备箱体加工），按类别使用并标行业配图，上传许可/来源/署名回执见 `live-once/uploads.json`。旧版快照未被补充或恢复改写。

最终页面证据在 `artifacts/t144/live-once/`：每步 `step-N.json`，整页截图 `step-N-<页面>-1440.png` / `-375.png`；另有每步工作台 1440/768/375、历史与恢复截图。共 28 张已逐张打开查看，报告记录查看文件与时间。`report.json`、`code-site.json` 保存本次完整版本、调用、检查与恢复结果。第一步/第三步首页及产品页的八张图另存 `live-once/paired-inputs/`。主控已安排独立成对盲评，结果 `/Users/luckye/Documents/Code/sitecraft-ai/artifacts/blind-t144-2026-10-09/result.json` 选 **B**；同目录 `b144-key.txt` 确认 A=第一步、B=第三步。评审依据有效信息完整度、工业配图和信息层级选丰富站；指出行业图未对应型号、移动首页大图推迟产品入口、案例标签末字单独折行。本轮只改验收断言，页面未变；执行者不自行盲评。

运行前估算 230,000 token（180,000–250,000），依据与分项见 `artifacts/t144/token-estimate.json`，低于 300,000 停线。各步结束后按已报告用量复核余下估算。实际生成运行报告 **89,880 token**；现有历史恢复入口不记录恢复事实校对的 token，该部分未知，不能记成零或把 89,880 当整个流程的精确总用量。没有重跑真实流程。

### 命令与当前验收证据

2026-10-09 Astra 对 `1db07e3` 为 NO_GO：删除第三步两种用途、第三步产品页新增「索取报价」均被原断言放过。原报告 `artifacts/t144/route-875043a7-ac61-4451-9b5e-80be5af1c57f/report.json` 保留，第三版最小反例随测试保存为 `tests/fixtures/t144-astra-counterexample.json`，避免测试依赖未版本化本地站点。修正前对原脚本/路由断言重放该报告，二者都错误接受，`review-fix/before.json` / `before.log` 记录了失败信号。

以下为本票验收断言修正的证据；原始异常与真实记录均保留，未重跑真实 DeepSeek：

最终数值边界补验基于 `1babca0` 加修正差异（2026-10-09 12:44–12:48 UTC），按负责人要求为验收脚本最后一次修正，之后主控直接验收：

- Astra 原复现 `artifacts/t144/astra-cli-numeric-2026-10-09T11-53-35-167Z/command.json`：把 K57 改成 K570、3.83–54.00 改成 3.83–54.001 后，旧 CLI 错误返回 0。新增两个独立回归在旧实现上均失败（5/7，通过的正常排版变体不受影响），`numeric-fix/before-both.log`；修正后 7/7 PASS，`numeric-fix/after.log`。
- 除 Astra 两个反例，回归还检查型号前后字母/小数点、范围错误起点/字母后缀；一个正常变体含全角型号与数字、全角/半角连字符、数值与单位有无空格，1440/375 均通过。
- `T144_ARTIFACTS=artifacts/t144/numeric-fix/replay-astra-bad node --experimental-strip-types scripts/check-incremental-enrichment.ts --replay artifacts/t144/astra-cli-numeric-2026-10-09T11-53-35-167Z/input`：12:45:12 UTC，按预期退出 1，指出第二步 R 系列缺少正确范围；原异常输入不改写，日志 `numeric-fix/replay-astra-bad.log`。
- `T144_ARTIFACTS=artifacts/t144/numeric-fix/replay-live node --experimental-strip-types scripts/check-incremental-enrichment.ts --replay artifacts/t144/live-once`：12:45:12 UTC，三步与恢复版的 1440/375 断言全部 PASS，禁网、模型调用 0，`numeric-fix/replay-live/report.json`。
- `SITECRAFT_BASE=http://127.0.0.1:3153 node --test --experimental-strip-types tests/t144-incremental-enrichment.test.ts tests/t144-enrichment-acceptance.test.ts`：12:48:02 UTC，8/8 PASS，`numeric-fix/related-tests.log`；`npm run typecheck`：12:47:58 UTC，PASS，`numeric-fix/typecheck-final.log`。所有浏览器命令使用 AGENTS 指定的 CHROME_PATH，只停止本次自己的 3153 服务。本轮没有真实 DeepSeek 调用，整仓测试与 build 未重跑。

- 临时不检查用途、临时只检查第三步联系页，两项定向坏实现各令新回归测试 2/4 失败（11:41:21 UTC）。日志 `review-fix/mutant-missing-uses.log` / `mutant-third-page-quote.log`；均已撤回。新测试分别隔离 Astra 的两项反例，另覆盖所有累积事实逐项删除、产品用途归属、三步×所有页面/页头/页脚×报价/询价/样品、辅助标签。
- `CHROME_PATH=<AGENTS 路径> node --test --experimental-strip-types tests/t144-enrichment-acceptance.test.ts`：11:44:33 UTC，4/4 PASS，`review-fix/acceptance-final.log`。`SITECRAFT_BASE=http://127.0.0.1:3153 node --test --experimental-strip-types tests/t144-incremental-enrichment.test.ts tests/t144-enrichment-acceptance.test.ts`：11:42:34 UTC，5/5 PASS，`review-fix/related-tests.log`。
- `T144_ARTIFACTS=artifacts/t144/review-fix/replay-live-widths node --experimental-strip-types scripts/check-incremental-enrichment.ts --replay artifacts/t144/live-once`：11:39:46 UTC，三步与恢复版在 1440/375 的新断言全部 PASS；禁网、模型调用 0，报告 `review-fix/replay-live-widths/report.json`。这是本次新断言的重放证据，原真实生成的时间与用量不改写。
- `T144_ARTIFACTS=artifacts/t144/review-fix/workspace-fixture node --experimental-strip-types scripts/check-incremental-enrichment.ts --fixture`：11:41:55–11:42:36 UTC，真实工作台受控模型三步/上传/历史/恢复刷新 PASS，日志 `review-fix/workspace-fixture.log`。正常夹具使用显式空值询盘标记，以便直接只读渲染与提交入口清理后的 HTML 使用同一系统部件合同。
- `npm run typecheck`：11:44:34 UTC，PASS，`review-fix/typecheck-amend.log`。按负责人本次范围只补相关测试与 typecheck，整仓测试和 build 未重跑，原结果如下；两项旧资料依赖失败仍保留。

以下浏览器命令均先设置 AGENTS 指定的 `CHROME_PATH`。密钥只通过负责人指定的 `set -a; source /Users/luckye/Documents/Code/sitecraft-ai/.env.local; set +a` 加载，未复制到工作树。

- `T144_ARTIFACTS=artifacts/t144/final-fixture node --experimental-strip-types scripts/check-incremental-enrichment.ts --fixture`：11:12:34–11:13:14 UTC，PASS；真实工作台三步、上传、版本、恢复刷新，28 张图逐张查看。控制事实校对响应不能证明模型语义校对能力，真实边界证据用上面的 live 流程。
- `SITECRAFT_BASE=http://127.0.0.1:3153 node --test --experimental-strip-types tests/t144-incremental-enrichment.test.ts`：原实现 PASS；临时删除 `codeFactMaterials` 的历史补充输入后，11:02:07 UTC 在第三步明确失败「第三步写页丢失第二步的事实来源」；撤回变异，11:02:38 UTC 同检查 PASS。日志 `route-mutant-red.log` / `route-final-green.log`，失败报告和原始工作台变异产物均保留；生产文件无变异残留。
- `SITE_STORE=fs DEEPSEEK_MODEL=deepseek-flash T144_ARTIFACTS=artifacts/t144/live-once node --experimental-strip-types scripts/check-incremental-enrichment.ts --live`：11:17:28 UTC，PASS；执行前已按上一段 source 加载环境。日志 `live-once.log`。
- `npm run typecheck`：11:12:36 UTC，PASS，`typecheck-final.log`；`npm run build`：11:12:06 UTC，PASS，`build-final.log`。
- `SITECRAFT_BASE=http://127.0.0.1:3153 npm test`（同工作树 dev server）：11:10:43 UTC，2650/2652 通过，**INCOMPLETE**，`test-3153-final.log`。T-090 的固定 hero case 读取未纳入仓库的 `.sitecraft-data/sites/561a1113-4dab-49b6-81dc-ab7e3eb712a5.json` 失败；T-113 固定的历史站点 ID 在新工作树读图片返回 404。两项测试未被跳过、弱化或搬旧数据绕过，交主控处理其资料依赖。首次未设置 SITECRAFT_BASE、指向其他工作树 3034 的失败日志也保留在 `test-final.log`。
- `project_map.py status --root .`：无结构问题、无过时 living doc，T-144 仍由 t144-build 领取。

外部邮箱送达未测试。最后一次数值边界修正完成，交主控直接验收；成对盲评已通过并勾选，代码审查/整仓测试复合项保持未勾选，票保持 open。
