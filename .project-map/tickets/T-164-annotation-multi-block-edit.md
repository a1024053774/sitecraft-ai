---
id: T-164
title: 多条批注一次修改成一个版本（多区块合同）
type: build
status: open
blocked_by: [T-163]
claimed_by: Codex
supersedes:
---

## Why

T-161 第 3 步：把同一版本上的多条批注一次交给系统，得到一个完整新版本。它把 T-152 的单个 `selectedTarget` 扩大成用户明确选中的区块集合，改变了硬约束里的局部修改合同。

## 开工前须负责人确认

1. 多区块合同（下面「What to build」第 1–3 条）；
2. 真实模型验证的 DeepSeek 用量上限。主控报批后才开工，不默认沿用以前的额度。

## 负责人确认（2026-10-15）

- 多区块合同按下面「What to build」第 1–3 条执行：任一组失败整体不存版本，不存部分版本（负责人选「就按这个做」）。
- 真实模型验证 DeepSeek 用量上限 8 万（`SITECRAFT_TOKEN_LIMIT=80000`），可覆盖最多两组不同的区块组合；超出或被截断即停下报构思主控，不自行重跑。

## What to build

1. 同一区块的多条意见按添加顺序合成一组；祖先和后代区块重叠时，先请用户确认用同一个范围，不在写回时互相覆盖。
2. 每组只发送该段 HTML、匹配的 CSS、页面大纲、资料原文和风格要点；所有候选在原版本上组装成一个完整版本，提交入口核对允许的区块集合（取并集）和所有范围外影响，包括共享 CSS 和交互态。
3. 任一组冲突或底线检查失败时，不存部分版本；各条批注的结果分别显示，失败的意见保留。最多两轮修正、事实核对复用条件照现有合同。不能把多条请求拼进整站重写来冒充局部修改。
4. 可参考 BaoCut 画板批注里「标注集合随消息发送、只移除本次发送的 id」的做法（`design-annotations.ts`、草稿 store），来源标注同 T-163。组装算法先用最小坏例验证（两个共用样式的区块 + 另一页面），不预设新的抽象。
5. 同步 AGENTS.md「局部修改」一条、`mainline.md`、`spec.md`、`CONTEXT.md`。

## Acceptance

- [x] 负责人确认合同与用量上限的记录写进本票
- [x] 坏例测试：合法两处修改通过；共享 CSS 外溢被拒；重叠目标按确认处理；任一组失败不产生新版本；先在父版本或 mutant 上失败
- [ ] 真实 chat 入口跑一次多区块修改，用量写进 Resolution；修改结果由独立盲评实例对比原版和修改版
- [ ] Astra 审查通过；typecheck、test、build 通过

## Resolution

2026-10-16 合同 D 的 A 方案已实现，本轮状态 **INCOMPLETE**（本提交，父版本 `2007923`）：提交入口在站点锁内按需把已有 `site.materials` 逐字登记为“原始资料”，使用所有已登记非上传来源的下一可用序号。已有有效来源包含这份原文时不重复登记；有效快照只有后续消息而缺原始资料时仍补入本次核对。新版只经原句验真后保存出处及来源快照；旧版本、旧检查和旧快照均不回写。原始资料与批注沿用同一序号分配，夹具中首次两条批注为 1、2，首次提交登记原始资料为 3，下一批为 4、5；不重编号既有消息。缺失原句和空资料仍拒收，未加入旧事实免核路径，上传源被替换后的旧出处也不能复活。AGENTS.md 只同步这条业务规则，测试细节在本票与 spec.md。

本轮 Tracer bullet 为旧站 annotationBatch → 本地模型替身 → 原句核对 → 新版出处 → 三档工作台显示。`tests/t164-original-materials.test.ts` 用两页、无来源登记及版本来源快照、有逐字 materials 的旧站夹具复现 `32e0ab93` 的数据形态；初版代码经 legacyImport 提交入口保存，不旁路写代码。批次调用生产 chat POST，沿用 T-162 随机端口服务与本地模型替身、受控 after 调度，不称为真实 Next after 集成。正例断言重做事实核对、只增一个完整版本、原文及旧版不变、不重复登记、出处为“原始资料”；反例在资料另有米饭 3 元的情况下仍拒绝无原句支持的包装费“每单3元”，确保不是只靠新增数字门禁；空资料旧站仍不登记原文且显示缺来源提示。补充只读边界断言已有后续消息的历史快照不阻止原始资料进入本次核对。

父版本红证据：`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t164-original-materials.test.ts tests/t169-production-contract.test.ts` 于 2026-10-16T08:33:42.462Z 得到 10 通过、2 个业务断言失败（批次 complete 实为 error；生产提交 applied 实为 rejected，均为旧原句无出处），日志 `artifacts/t164/original-materials-parent-valid-red.log`，报告与临时数据根记录 `artifacts/t167/test-run-1792139601272-84346/report.json`。更早一次空资料夹具在建首版时即失败的日志 `original-materials-parent-red.log` 原样保留，只算夹具设置失败，未计作业务红证据。补充快照边界于 09:16:06.376Z 先用标准入口的 `--test-name-pattern='快照只有后续消息'` 在未修边界实现上失败（实际仅后续消息、缺原始资料），日志 `original-materials-partial-snapshot-red.log`、报告 `artifacts/t167/test-run-1792142164626-19628/report.json`；其余被筛出的用例不计通过。

最终实现验证：`CHROME_PATH=上述路径 npm test -- tests/t164-original-materials.test.ts tests/t169-production-contract.test.ts tests/t164-multi-block-edit.test.ts` 于 2026-10-16T09:18:34.486Z **29/29、零跳过**，日志 `artifacts/t164/original-materials-final-regressions.log`、报告 `artifacts/t167/test-run-1792142271277-20284/report.json`。此前原始资料、生产来源合同、批注合同 D、出处回归合计 26/26（`original-materials-focused.log`）。`node --test --experimental-strip-types scripts/t167-runner-regressions.ts` 于 08:40:33Z 4/4（`original-materials-runner.log`）；最终 `npm run typecheck` 于 09:21:00Z 通过（`original-materials-frozen-typecheck.log`），`SITE_STORE=fs npm run build` 于 09:22:49Z 通过（`original-materials-build.log`）。Chrome 三档 1440/768/375 的最终出处弹层均显示“原始资料”和逐字原句，空资料保留“未提供可引用的原句”；截图及请求、版本输出在 `artifacts/t162/self-contained-1792142273176-20299/`。

全量未通过，失败证据完整保留。两次均在报告主控后运行 `CHROME_PATH=上述路径 npm test`，跑前检查 df/ps、无其他工作树重任务，未改变并发、等待时限、动态每档 5 秒/合计 15 秒上限或跳过用例：

| 全量结束时间（UTC） | Node 统计 | 证据与本次发现 |
| --- | --- | --- |
| 2026-10-16T08:50:27.646Z | 总 636；619 通过、16 失败、1 取消、0 跳过；入口实际执行 635 | `artifacts/t164/original-materials-full.log`；`artifacts/t167/test-run-1792140096765-88354/report.json`。T-164 两项旧范围测试的事实替身仍返回旧 `{issues:[]}` 协议，已改用现有 factAuditReply 编码；其余包含动态检查 5 秒拒绝、T-162 页面等待、T-163 ECONNRESET、T-169/T-171 页面载入等待及本票正例 120 秒超时。 |
| 2026-10-16T09:09:08.042Z | 总 636；620 通过、14 失败、2 取消、0 跳过；入口实际执行 634 | 修正上述两项替身后定向 16/16（`original-materials-scope-fixture-green.log`）才重新运行完整矩阵；旧协议两项不再失败。完整记录 `artifacts/t164/original-materials-full-after-fixture.log`、`artifacts/t167/test-run-1792140991150-2746/report.json`，仍有 T-152/T-164 动态 5 秒拒绝、T-159 服务启动 30 秒及 T-162/T-163 界面等待/取消，不能视为通过。 |

第一轮收尾采样 Load 约 29、物理可用内存约 126M、压缩内存约 4.8G，只能说明当时资源紧张，尚不能据此证明所有失败的因果。没有原样重跑来覆盖失败，没有放宽上限、修系统或杀其他用户进程。补充快照边界调整在这两次全量之后完成，当前预期 637 项完整矩阵尚未重新验证；仅上述最终 29 项、typecheck、build 可作为最终实现通过证据，不再启动第三轮全量。全量失败根因及完整矩阵验收仍未完成，票保持 open。

本轮 240 张原始截图均已逐张打开（T-130 分发复制图不重复计数），清单 `artifacts/t164/original-materials-screenshot-views.json`。全量失败画面、发送冻结态仅作诊断，清单列出的载入态排除最终预览验收，不重拍覆盖、不作审美结论。本轮未调用 DeepSeek、未载入 .env.local、未写主目录数据、未推送或自行开审查；前次真实用量证据保留如下，不重复记费。独立复审与余量真实运行均等主控安排。

2026-10-16 一次真实多区块验证结果 **INCOMPLETE**（产品实现 `d312698`，当轮 `2007923` 仅给预算网关白名单加入 t164 并记录结果）：第一组终态拒收且未存版，按主控条件立即停止，没有重跑、换意见或发送第二组。授权为两组合计 `SITECRAFT_TOKEN_LIMIT=80000`、共用一个账本；累计实付 17329，剩余 62671 未动用。跑前 df 可用约 10GiB，ps 无其他 chrome-headless-shell／node --test／next build；本轮模型、Chrome 工作串行。

底稿只读复制自主目录 `.sitecraft-data/code-sites/32e0ab93-d3c5-470e-b4cd-16180fd5ba8b.json` 及对应会话文件，到 `mktemp -d` 创建的 `/tmp/sitecraft-t164-real-approved.diEBFA`，没有图片文件需要复制。运行 siteId 仍为 `32e0ab93-d3c5-470e-b4cd-16180fd5ba8b`，只在临时根更新任务与批注；主目录及临时根当前均只有 v1 `60cde704-7364-461c-a236-9af8933c5b4c`，没有“修改后版本”。独立 Next 应用使用随机端口、NODE_ENV=test，不加载 .env.local；真实密钥仅按授权命令 `set -a; source /Users/luckye/Documents/Code/sitecraft-ai/.env.local; set +a` 进入网关进程，应用只连本地网关。账本 `artifacts/t164/blind-20261016T054417Z/private/budget/usage.json` 保留全部 3 次已结算调用；任务 error 且零 in-flight 后才手动停网关，截图结束后停独立应用。

| 组合 | 真实批注范围 | 请求数 / token | 存版与拒因 |
| --- | --- | --- | --- |
| 第一组 | 同页共用 `.section`：首页 `[2]` 营业时段＋`[5]` 收费口径；第二条补充“外带包装费现在确定为每单2元。” | 3 / 17329：两次局部写作 9699、4524，一次非思考事实核对 3106 | HTTP 202 后任务 error；未存版。既有营业时间、米饭及含税收费的原句不在可引用出处集合，按整体检查拒绝；无内部修正轮、无手动重跑 |
| 第二组 | 预定首页 `[4]` 用餐场景＋菜单页 `[3]` 午市组合 | 0 / 0 | NOT_RUN；第一组拒收后按约定停止，未产生第二个网关 round 或任务 |

第一组实际调用于 2026-10-16T05:48:11.053Z 开始、05:48:57.962Z 完成记录，runId `5facc742-ab8a-4364-96b7-79a25c9502ee`。三个上游请求均 HTTP 200、finishReason=stop，未截断、未超额；一次实际生产 chat `annotationBatch` POST，使用真实 Next after。命令为 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --experimental-strip-types artifacts/t164/blind-20261016T054417Z/private/run-real.ts first`；该阶段有已开始即拒绝再次发送的标记。批注原文、请求、任务、候选检查与拒因分别保留在该目录 private/ 下的 `first-request.json`、`first-state.json`、`first.log`、`outcome.json`；不把脚本非零退出改成通过。

拒收根因：底稿既无 `factSources`，v1 也无 `factSourceSnapshot`；`codeFactSourceMaterials` 以有效版本的来源快照为基线，缺少时只加入本次两条批注。因此完整材料上下文中的原始营业／收费原句不能在本次 sourceMaterials 中验真。新事实“外带包装费每单 2 元。”在未通过的候选检查里确实绑定 `source={type:message,messageIndex:2}` 和首页 `[5,0,1,0,2]`；但 `factCitations.complete=false`、整批未存版，工作台仍显示 v1 与“未提供可引用的原句”。合同 D 的“新事实出处存版及显示”本轮尚未验收通过，不补造旧资料快照或绕过门禁。动态检查不是本次拒因：375／768／1440 为 2359.6／2275.9／2204.7ms，合计 6840.2ms；各侧 I=10、force=76、CDP=215，未放宽上限。

盲评材料：`artifacts/t164/blind-20261016T054417Z/review/` 只有第一组原版与拒收候选的 A/B 三档截图、批注原文及阅读说明（两页全图＋两处批注和范围外区块，共 30 张）；`private/mapping.json` 明确记录 source／rejected-candidate、stored=false、afterVersion=null 与第二组未运行。候选只由生产 `renderSiteCode` 只读绘制，没有经旁路写入版本，不能称为已应用的修改版。另有 3 张三档真实工作台拒绝画面；33 张均已逐张打开，清单 `private/screenshot-views.json`，未自行盲评或判断审美。首个工作台截图脚本误用 .code-error 定位而超时，`capture-refused.log` 原样保留；只改用真实终态 code-progress 补采工作台画面，静态 30 张没有重拍，没有新增模型调用。

本次白名单小改后的标准预算回归 `CHROME_PATH=上述路径 npm test -- tests/t165-token-reserve.test.ts tests/t165-tokenizer-adversarial.test.ts` 23/23（`artifacts/t164/real-approved-budget-regressions.log`），`npm run typecheck` 通过（盲评目录 `private/typecheck.log`）。本次真实拒收后未再跑全量／build，不引用前轮结果冒充本次通过；真实验收与第二组仍未完成，票保持 open。未推送。

第九轮修复（基线 `5a43e9e`，claimed_by 仍为 Codex）：普通批量发送始终显式传 false，只有“确认按较大区块合并后发送”传 true；“待确认”状态只控制确认按钮是否显示。服务端 z.boolean 可选字段与合组前置检查已经拒绝缺省／false，无须增加平行门禁。Tracer bullet 经三档真实 Chrome 点选祖先／后代、添加两条意见、重复普通发送、明确确认、真实 chat 与存版验证；不改变合组、动态检查语义与性能预算。

新增 `tests/t164-overlap-confirmation.test.ts` 先在 `5a43e9e` 运行 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t164-overlap-confirmation.test.ts`：三档均在第二次普通发送的 actual true / expected false 业务断言失败，服务端缺省／false／再次缺省连续拒绝通过（1/4）。日志 `artifacts/t164/review-nine-overlap-parent-red.log`，报告／数据根 `artifacts/t167/test-run-1792127939994-24152`，原始请求和失败截图在 `artifacts/t162/self-contained-1792127941418-24163`；未通过重跑、跳过或修改期望掩盖。

第九轮验证对应本提交（父 `5a43e9e`）：同一标准定向命令于 2026-10-16T05:20:40Z 4/4 通过（`artifacts/t164/review-nine-overlap-green.log`、`artifacts/t167/test-run-1792128009604-24720`）。三档真实点选形成 `[2,0]` 与 `[2,0,1]` 的祖先／后代，两次普通发送均实际 false、HTTP 422、任务及版本不增加、两条草稿保留；确认按钮才实际 true、HTTP 202、一次合组写作并保存一个新版本。服务端另以 `[2]`／`[2,0]` 验证缺省／false／再次缺省始终拒绝，没有把前一次重叠提示视作后续确认。原始请求、任务和六张定向截图在 `artifacts/t162/self-contained-1792128010930-24725`。沿用 T-162 随机端口本地模型替身和生产 chat POST，helper 控制 after 调度，不将其称为实际 Next after 集成。

- `npm run typecheck` 于 2026-10-16T05:20:56Z 通过（`artifacts/t164/review-nine-typecheck.log`）。
- `node --test --experimental-strip-types scripts/t167-runner-regressions.ts` 于 2026-10-16T05:21:21Z 4/4（`artifacts/t164/review-nine-runner.log`）。
- `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test` 于 2026-10-16T05:25:23.390Z 633/633、零跳过（`artifacts/t164/review-nine-full.log`、`artifacts/t167/test-run-1792128112102-25585/report.json`）。
- `SITE_STORE=fs npm run build` 于 2026-10-16T05:26:03Z 通过（`artifacts/t164/review-nine-build.log`）。全量与 build 前均 df/ps 检查无其他重任务，串行执行；本轮未调用 DeepSeek、未推送、未自行开审查。

本轮原始截图 128 张（父版本红 3、定向绿 6、全量 119）已逐张打开，清单 `artifacts/t164/review-nine-screenshot-views.json`；失败及刻意冻结的发送状态只作流程诊断，三档确认后截图均已载入，不作审美判定。本轮离线修复与验证 **PASS**；真实模型与独立审查仍由主控安排，票保持 open。

2026-10-16 CSSOM 轮离线交付：冻结实现 `77ddcf1`（已正常合并 `family-kit-assembly` 的 `20e64b7`），该轮执行验证 **PASS**。真实 DeepSeek 修改与独立审查仍按主控安排，票保持 open，未推送。

- `npm run typecheck` 通过（`artifacts/t164/cssom-frozen-typecheck.log`）；`node --test --experimental-strip-types scripts/t167-runner-regressions.ts` 4/4（`cssom-final-runner.log`）。
- `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test` 于 2026-10-16T04:36:52.380Z 结束，629/629、零跳过；原 588 项、本轮新增 18 项、主线 T-171 的 23 项均通过。完整报告与每次检查的计数／分段耗时在 `artifacts/t167/test-run-1792125196953-78421`，主日志 `artifacts/t164/cssom-frozen-full.log`。
- `SITE_STORE=fs npm run build` 于 2026-10-16T04:38:15.939432+00:00 通过（`artifacts/t164/cssom-frozen-build.log`）。全量与 build 前均检查 df/ps，未与其他 chrome-headless-shell、node --test、next build 重任务并跑。

本轮三次全量与 T-169 定向产生的 342 张原始截图已逐张打开查看，清单为 `artifacts/t164/screenshot-views-final.json`，不作审美结论；T-130 分发包内的复制图不重复计数。最终全量的 `artifacts/t162/self-contained-1792125247266-82051/rejected-1440-0cb69242-5417-4eda-b9d8-0528140b6deb.png` 中预览仍显示“正在载入版本2...”，只保留为拒绝流程诊断，排除出最终预览验收；同轮其他已载入的三档画面保留，不重拍覆盖该结果。

完整负载诊断保存在 `artifacts/t164/load-diagnosis.json`：共 200 次动态范围检查，其中 95 次仅完整静态基线、105 次完整四态；完成项最大 1501.0ms，两个未完成项对应预期预算拒绝测试。T-162 四个线程定位任务均 complete，12 档为 static，实际强制 0、每侧探针 CDP 6（I 未枚举，记 null），全档耗时 132.9–535.6ms；原行为每侧 I=3、强制 28、CDP 79 的无谓工作已消除。原 585/588 的日志保留；当时没有逐阶段记录，不能复原其具体 CPU 时间。T-169 两项在无动态并行任务的受控延迟中仍失败，确认有独立的文档／按钮就绪竞态，已分别修复，不把三项一概归因于 CPU。

两个真实首页在 2026-10-16T04:22:19.269Z 完成各视口 5 次（共 30 次）确定性检查，数据 `32e0ab93`／`8bf7cb44` 只读复制到 `/tmp/sitecraft-t164-gate-array-real.khdFKH`。测量覆盖生产 `checkSiteCode` 的 CSSOM 判定、候选浏览器启动、完整探针与比较；所有图片／布局检查也通过。`legacyImport` 仅关闭模型事实调用，不写版本；没有调用 DeepSeek。原始分段与每次计数为 `artifacts/t164/real-homepage-timing.json`，详细 CDP 日志目录 `artifacts/t164/real-homepage-gate-1792124462147-59434`；本次源／候选计数均一致，往返数按各自探针记录，CSSOM 判定耗时另列。

复现命令：`ROOT=/tmp/sitecraft-t164-gate-array-real.khdFKH COMMIT=77ddcf1 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --experimental-strip-types artifacts/t164/real-homepage-gate-timing.ts`（辅助服务自行使用随机端口并提供 public 中的真实底图）。

| 真实首页 | 视口 | min / 中位 / max（ms） | 每侧可交互元素 / 强制 / CDP 往返 |
| --- | --- | --- | --- |
| 禾巷小馆 | 375 | 2412.9 / 2537.2 / 2673.0 | 10 / 76 / 215 |
| 禾巷小馆 | 768 | 2240.6 / 2327.7 / 2633.0 | 10 / 76 / 215 |
| 禾巷小馆 | 1440 | 2232.4 / 2336.9 / 2546.4 | 10 / 76 / 215 |
| 拾色绘画教室 | 375 | 2275.2 / 2334.6 / 2602.7 | 7 / 58 / 169 |
| 拾色绘画教室 | 768 | 2079.0 / 2205.3 / 2351.2 | 7 / 58 / 169 |
| 拾色绘画教室 | 1440 | 2131.2 / 2191.1 / 2395.7 | 7 / 58 / 169 |

禾巷小馆三档合计 min / 中位 / max = 7021.6 / 7077.5 / 7852.4ms；拾色绘画教室三档合计 min / 中位 / max = 6485.4 / 6829.0 / 7154.1ms。30 次均低于每档 5000ms、三档 15000ms；有动态规则时每侧每档仍读取基线及四态 × I 的全部快照（41／29），未靠少读状态或样本筛选达标。超时明确拒绝且不存版本的入口回归仍通过。

2026-10-15 17:07 UTC，Codex 在 `t164-multi-block` 完成离线实现并本地提交准备：

- 失效方式清单与最小坏例写入 `tests/t164-multi-block-edit.test.ts`。反事实证据：临时关闭祖先/后代重叠拒绝后，`CHROME_PATH=... npm test -- tests/t164-multi-block-edit.test.ts` 在“重叠需确认”断言失败；恢复后同一命令 4/4 通过。测试使用本地 HTTP 模型替身和真实 Chrome 提交检查，不调用 DeepSeek。
- 实现批次请求、草稿冻结、按 DOM 路径合组、重叠确认、同一父版本多候选组装、目标并集范围检查、共享 CSS/交互态核对、整批原子存版和按 draftId 回写结果。BaoCut 参考只保留冻结集合语义，来源补充在 `resources/baocut-annotation/SOURCE.md`。
- `npm run typecheck`：通过。
- `CHROME_PATH=... npm test`：500/500 通过；全量证据目录为 `artifacts/t167/test-run-1792083805589-62150`。聚焦 T-152/T-163/T-164 回归 23/23 通过。
- `npm run build`：通过（Next.js 16.3.1，Turbopack）。
- 本票真实 chat、`SITECRAFT_TOKEN_LIMIT=80000` 用量与独立盲评/Astra 审查尚未执行，按负责人要求停在离线验收；因此票保持 open，不能宣称完整通过。

2026-10-15 17:50 UTC，按 sol NO_GO 修复并补入口证据：

- P1-1：批次提交只发送固定批次标识，资料上下文不再包含批次意见；`executeLocalEditBatch` 给每组独立意见，`writeLocalEditBatch` 保持每组请求隔离。入口测试逐条检查两组请求不含对方意见；将批次资料临时恢复为整批请求时测试按预期失败。
- P1-2：无当前版本的批次在资料写入分支前明确拒绝；入口测试确认 HTTP 422、资料为空、无 run。关闭拒绝闸门的 mutant 返回 200 并被测试捕获。
- P1-3：新增 `tests/t164-multi-block-chat.test.ts`，真实 chat route → workflow → 本地模型替身 → commitSiteCode；覆盖合法一版本、组失败无部分版本且按 draftId 返回、无版本拒绝及整站写作拦截。
- P2-1：重叠确认后的组内意见按原始 draft 添加顺序稳定排序；三项后代/兄弟/祖先坏例覆盖，移除排序的 mutant 失败。
- P2-2：`writeLocalEditBatch` 每组模型调用前执行 `requireModelTaskAdmission`；未登记风格测试在调用浏览器/模型前拒绝，移除准入调用的 mutant 失败。
- 修复后 `npm run typecheck` 通过；T-164 合同与入口测试 8/8 通过。全量 `npm test` 与 `npm run build` 尚待本轮修复后按主控要求执行；真实 DeepSeek、盲评和 Astra 仍未执行。
- 2026-10-15 17:54 UTC 修复后全量 `npm test` 504/504 通过（证据目录 `artifacts/t167/test-run-1792086706873-88234`），`npm run build` 通过。提交已 amend 为 `5d85600`，未推送。真实 DeepSeek、盲评和 Astra 仍按主控要求未执行。

2026-10-15 18:21 UTC，按新 sol NO_GO 修复并保留反事实证据：

- P1 交互态：`outsideCssApplications` 在同一检查中创建隔离 iframe，逐个聚焦可聚焦元素，比较允许区块外元素的计算样式签名；单区块与多区块共用该路径。新增 focus-within 外溢反例在 a25fcd5 上 applied，修复后 rejected。
- P2 分组失败：`cannotEdit` 立即停止该组重试，整批不存；每个 draftId 保存自己的拒因，其他组显示「因其他组失败未保存」，前端不再把全局 run.issues 拼给每条草稿。新增入口测试在关闭立即停止闸门的 mutant 上失败，恢复后通过。
- `npm run typecheck` 与 T-164 聚焦测试 10/10 通过；待本轮全量测试与 build 完成后更新最终证据。真实 DeepSeek、盲评和 Astra 仍未执行。
- 2026-10-15 18:25 UTC 修复后全量 `npm test` 506/506 通过（证据目录 `artifacts/t167/test-run-1792088528045-9741`），`npm run build` 通过。真实 DeepSeek、盲评和 Astra 仍未执行。
- 2026-10-15 19:31 UTC，最终全量与 build 结果保持通过；本轮聚焦 33/33、T-164 新入口 10/10，未调用 DeepSeek。
- 2026-10-15 19:42 UTC，最终全量 `npm test` 510/510 通过（证据目录 `artifacts/t167/test-run-1792093154418-71464`），`npm run build` 通过。新提交包含规则推理焦点检查、按组/整体拒因归因与 UI 展示；真实 DeepSeek、盲评和 Astra 仍未执行。
- 2026-10-15 20:54 UTC，按构思主控要求复制主目录两个站点到只读临时根 `/tmp/sitecraft-t164-real.tEEPkQ`，本地替身完成首页单区块检查并记录三档耗时：禾巷小馆 375/768/1440 = 48.60/43.88/49.36 ms；拾色绘画教室 = 59.48/64.08/53.61 ms。证据 `artifacts/t164/real-homepage-timing.json`。最终全量 `npm test` 511/511 通过（`artifacts/t167/test-run-1792093154418-71464`），`npm run build` 通过；真实 DeepSeek、盲评和 Astra 仍未执行。

本轮接手实现（基线 `01003c7`）按已确认动态状态设计收口：`outsideCssApplications` 是单区块与多区块共用的唯一 CDP 探针，不再从 CSS 文本推断状态；逐一枚举可见、非 disabled/inert 的真实可聚焦元素，固定强制 `focus`、`focus-visible`、`hover`、`active`，并传播祖先状态。动态探针移入每个 375/768/1440 视口循环，比较源/候选的范围外 DOM 路径与完整计算样式，拒因包含页面、视口、触发路径、状态和受影响路径；每档检查记录源/候选可交互元素数、非空强制调用数、各自耗时及合计耗时，无法聚焦、强制失败或超时即拒绝。静态清理允许保留 disabled button 夹具，仍拒绝表单收件链路。

反事实与聚焦证据：新增坏例先在 `01003c7` 失败（动态证据缺失、375 `main:has(:focus)` 错误保存、disabled button 被清理），修复后 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t164-multi-block-edit.test.ts` 14/14 通过；同轮 T-152/T-162/T-163/T-164 聚焦入口 41/41 通过，`npm run typecheck` 通过。优化前只读真实首页诊断在 10/7 个可交互元素下分别约 3.4/2.4 秒每次探针，超过 2 秒档位，失败证据保留在临时根 `/tmp/sitecraft-t164-real.OMYG5t/diagnose.json`；本轮继续复用状态档的祖先强制集合、CSS agent 重置、状态间单次 blur、完整样式元数据与路径缓存，T-164 14/14 仍通过。动态探针只在实际被局部修改触及的页面执行，其他页面已由提交入口先核对 DOM 未改变，避免在全量并发下重复消耗预算；`pageEdit` 仍覆盖全部页面以捕获跨页 CSS 交互态。最新真实首页诊断（commit 代码尚未再次提交时）为禾巷小馆 375/768/1440 = 2.90/2.92/2.92 秒，拾色绘画教室 = 2.06/2.06/2.08 秒；DOM 数为 156，未达到 2 秒门槛，失败结果写入 `artifacts/t164/real-homepage-timing.json`，宽预算分段证据在 `/tmp/sitecraft-t164-real.q2wO36/diagnose-current.json`。保留完整四状态、祖先传播和计算样式合同，不以删状态或缩短样式来掩盖超时。

最终技术验证：父版本 `01003c7` 反事实聚焦测试 3 项失败，当前修复版聚焦 T-152/T-162/T-163/T-164 24/24 通过；`npm run typecheck` 通过。标准全量 `CHROME_PATH=... npm test` 于 2026-10-15 23:20 UTC 在 `artifacts/t167/test-run-1792106242923-90820` 以 515/515 通过；`SITE_STORE=fs npm run build` 以 Next 16.3.1/Turbopack 通过。最终真实三档证据 `artifacts/t164/real-homepage-timing.json`（commit `2d4f8d6`）按 2 秒合同如实记录两站三档超时，未将不完整结果记为通过。

本次性能修复（最终代码 `3014593`）：诊断确认样式读取占主要耗时（拾色 7 元素单探针约 1.9 秒，force 约 40ms，聚焦约 25ms，169 次 CDP 往返）；页面内缓存范围外元数据，批量读取完整计算样式后 gzip 序列化传输，源/候选在独立 CDP target 并行探测，比较仍使用完整 `DOM 路径 × 计算样式` 集合。最终并行实测两站三档均通过 2 秒：禾巷小馆 1.78/1.73/1.70 秒，拾色绘画教室 1.35/1.26/1.24 秒；每档记录 interactiveElements、forceCalls、cdpRoundTrips、focus/force/styleRead/compare 分段及 extras=0。

2026-10-16 当前离线实现（第七轮基线父版本 `7fde85b`；第八轮基于 `3e192f9` 窄改，正常追加提交）：

- 预算保持动态探针与完整比较合计每档 5 秒、三档 15 秒，超时明确拒绝且不存版本。原 2 秒上限因禾巷 1440 曾为 2.63 秒、暖运行 1.60–1.70 秒而在抖动下误拒，负责人已选定 5/15 秒，本轮未调整。
- 范围外纳入选中区块祖先自身；只排除选中区块及其后代。祖先全部属性采用浏览器 CSS Typed OM 的真实计算值（含 auto／百分比），因此背景、明确高度等规则变化被拒，而区块内自然增高仍可保存。未用尺寸白名单或剥规则。最初直接比较 resolved 像素值曾使两条合法正例失败，证据 `artifacts/t164/review-seven-ancestors-full.log`（21/23）保留；改用完整计算值后两项恢复通过。
- 伪元素：`::before`、`::after` 每态检查 content/display；`::marker` 每态检查宿主的 list-item 状态。不存在时记录存在性，出现／消失也参与比较，已生成者读取全部属性。`::first-line`、`::first-letter` 始终比较完整样式，避免生成文字没有 DOM 文本却漏检排版片段。选择／高亮、文本片段目标、原生控件、滚动条伪元素需额外状态或不属于无脚本展示站合同，仍列为已知边界；多元素同时处于不同状态、跨元素并发 hover/active、UA 状态矩阵和脚本状态仍不覆盖。
- 比较键为范围外 DOM 路径、伪元素种类、存在性与全部计算属性，不包含触发元素。每态完整读取；仅省去已在无状态基线集合中的重复条目以减少序列化。固定标准属性名按 CSSOM 枚举顺序缓存，每态重新读取完整自定义属性后缀及真实值，覆盖新增、移除、等数量替换与只改值；不缓存候选属性集合。
- 每条批注原文在站点锁内按添加顺序登记为独立用户消息来源，分配各自序号。本组写作只追加本组原文，整批提交带全部批注原文与来源，成功版本保存事实来源快照；后续修改可继续引用本次补充。固定的“批量局部修改”不再冒充事实来源。
- 模型输入 `edits` 按每条 draftId 传递原意见和独立元素提示；祖先／后代确认合组时，将元素路径重绑到最终组范围，不复用第一条提示。相关 CSS 的伪类／伪元素规则由 CSSOM 原样保守纳入，其他规则直接交浏览器匹配，不剥伪类字符串，`:has(:focus)` 不再导致 422。
- 新增 `tests/t164-review-seven.test.ts` 经真实 POST chat 路由或提交入口覆盖上述问题。11 项在 `7fde85b` 全部失败（`artifacts/t164/review-seven-parent-eleven-red.log`），包含祖先背景／明确高度、五类伪元素、已有自定义属性仅改值、批注事实及后续沿用、每条元素提示、`:has(:focus)` 合法批次。原 7 项及 9 项红记录保留。一次误与 T-171 重叠启动的运行已主动中止，`review-seven-intermediate.log` 不计为验证结果。
- `npm run typecheck` 通过；本轮中间聚焦 41/41 通过，最终 T-164 聚焦 27/27 通过（`artifacts/t164/review-seven-final-focused.log`），包含原有“合法两处修改”“无动态 CSS 新增链接”正例；未削弱原断言。
- 新伪元素读取最初在真实两站六档触发 5 秒拒绝，日志 `review-seven-diagnostic.log`、`review-seven-optimized-diagnostic.log` 及临时根 `/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-t164-seven-diagnostic-l60xw8u1` 保留。根因是每态经 CSSOM 索引重复枚举标准属性名；只缓存浏览器固定标准名并逐态重读全部属性值及实时自定义属性后，单次诊断禾巷 2.14–2.29 秒、拾色 1.81–1.85 秒，详见 `review-seven-cached-properties.log`。四状态、触发元素、祖先传播、伪元素及三个视口均保留。

本轮性能目标：在全量自身负载下减少无效动态探测，保持范围核对语义与每档 5 秒、三档 15 秒上限。非目标是减少状态、元素或视口，也不扩大时间预算。Tracer bullet 沿真实提交入口验证 CSSOM 判定 → 探针 → 范围比较 → 存版；Ubiquitous language 中“跳过动态探测”不表示跳过静态范围外样式比较。

实施前等价性依据：源与候选都由浏览器解析作者样式表，递归读取全部 CSSOM selectorText（包括未激活的 @media 与嵌套规则）；若都没有 :hover、:focus、:focus-visible、:focus-within、:active，包含 :has/:is/:not 内的这些状态也没有，则强制这四种状态不会改变作者规则的匹配。脚本已禁止，强制状态不改变 DOM、声明或媒体条件；UA 默认交互样式沿用既有边界。因此保留两份文档的完整静态基线比较即可得到相同作者样式影响结论；静态 :has(a) 与兄弟选择器随 DOM 改动产生的外溢仍由基线捕获。有任一动态规则则沿用四状态、全部可交互元素、祖先传播、全部伪元素和三档视口的完整探测，不按媒体是否激活裁剪。不能读取 CSSOM 时不能证明无动态规则，必须报错。静态分支不枚举可聚焦元素，计数记 null（未测），强制次数为 0，不能伪记无交互元素。

诊断先于优化：标准入口把每次动态探针的起止、可交互元素数、已发出的强制次数、CDP 往返和分段耗时写入本轮 artifacts/t167/test-run-*/checks；浏览器记录 CDP 方法起止与错误类别，不记录参数或页面内容。先在未启用 CSSOM 跳过条件时运行一次全量诊断，核对 T-162 超时与 T-169 两项 UI 失败的时间线；不预先认定共同根因。新增入口测试先在 aa390b3 行为上证明零强制条件失败，再实现条件；同时证明动态规则不能误跳、静态外溢仍拒绝，并与完整探测对照。

完整样式读取的进一步优化依据：每个状态仍读取全部标准属性与当态自定义属性；只将基线的按名 Map 查找改为按相同排序后的属性名逐项比较数组，并复用排序结果。每次先重新读取完整自定义属性后缀；仅当其逐项名称与基线相同时复用属性名顺序，不缓存自定义属性的存在性或值。名称增删／同数量换名时重新排序，完整当前值、伪元素存在性和比较键不变。这样省去每个改变条目的重复 localeCompare 排序及逐属性 Map 查询，不裁剪属性、状态、元素或视口。优化前生产 checkSiteCode 测量在拾色第四轮触及 5 秒；保留 real-homepage-gate-timing.log，不把前八轮成功样本冒充完整 30 次结果。

本轮阶段证据（父 aa390b3，合并最新主线前）：原行为只加诊断的全量 588/588（183.3 秒；artifacts/t164/load-diagnostic-full.log、artifacts/t167/test-run-1792116660769-71195/checks），304 次源／候选探针中 302 完成、2 次为预期拒绝用例，完成最大 1.242 秒；没有复现原三项，不能用本轮通过抹去原 585/588。T-162 夹具没有作者动态规则，却原先每侧强制 28 次，属于可免除的开销；T-169 在无并行动状态任务的受控延迟中仍复现，具有独立的文档／按钮就绪竞态。Page.navigate 只确认导航提交；现由同一 session 的 Page.loadEventFired 等待新文档，再监听 DOM 条件；点击先等节点，再等字体与动画，不延长任何等待上限。

新 CSSOM 入口测试在父行为上有效红 0/11（dynamic-gate-parent-red-fixture-fixed.log）：无动态规则仍实际发出 72 次强制，其余动态条件缺模式证据。为独立证明“不漏动态规则”，故意令 CSSOM 分类恒为 false 的 mutant 只通过静态两项、9 项按实际强制次数为 0 失败（dynamic-gate-missed-rules-mutant.log），已恢复。优化后合计 T-164 41/41（dynamic-gate-array-focused.log），含完整探测结果对照和静态 :has(a) 外溢拒绝。T-169 两项受控延迟先红（t169-readiness-red-gated-node.log：导航提前返回、scrollIntoView 空节点），修后该文件 9/9（t169-readiness-green.log）。标准入口回归 4/4（dynamic-gate-runner.log）。首个门禁夹具缺本地替身的设置失败日志 dynamic-gate-parent-red.log、首个载入夹具被生成页 CSP 阻断后终止的 t169-readiness-red.log 均保留，不计为业务红证据。

继续定位：array 版真实测量再次超时，原日志 real-homepage-gate-array-timing.log 及 real-homepage-gate-1792118189291-93329/partial.json 保留。未改产品上限的无上限诊断仅用于测量（style-parts-uncapped-diagnostic.log、real-homepage-gate-1792118565645-97588/）：每侧实际读取约 1.76–2.00 秒，序列化约 6–9ms、压缩约 42–61ms、解码约 21–33ms，瓶颈仍为读取。Typed OM 迭代实验更慢，未采用；压缩也不是主因，不引入新编码分支。

未保留的实验：命名 getter 在小实验有少量收益，但引入固定读取函数与额外一致性分支，最终仍使用原生 getPropertyValue；Typed OM 迭代更慢，也未采用。完整作者匹配关系与范围外实际伪类状态相同才复用快照的试验，在两站 30 次完整检查中实际复用次数全部为 0；单档最大 4.462 秒、三档最大 10.143 秒虽均达标，但没有减少指定真实样本的读取工作量，因此已撤回该路径及其专用计数断言。最终没有匹配关系缓存、CSS 函数白名单或状态／元素／视口裁剪；有任一动态规则始终逐态完整读取。

实验失败证据保留：author-relations-parent-red.log、author-relations-unsafe-mutant.log、author-relations-empty-match-mutant.log、author-relations-scope-red.log、author-relations-final-unsafe-mutant.log（14 项按实际调用或 applied/rejected 断言失败）、author-relations-final-empty-mutant.log（第二个区块内触发元素漏检）均不删除。列表特异性、:scope、嵌套、伪元素以及第二个内部触发元素的 5 个业务坏例留在最终提交入口测试中，防止未来优化重犯；仅与已撤回路径绑定的读取次数断言一并移除。无动态规则的正反例继续对照实际强制四态的完整探针。auto 内容可见性夹具首次未通过源版本检查，日志 author-relations-ua-focused.log（56/57）保留，不算业务红证据；修为未使用的合法声明后实验验证 57/57，最终收窄后 46/46（cssom-final-focused.log）。

第八轮增量：出处清理改用全部 localTargets 的并集，逐个过滤旧定位，保留并集外定位，再由新核对内容重新绑定；不再依赖首个新段落。组装阶段只捕获 CodeRepairError，其他异常原样终止任务，不转成组内修正意见。

新增三项真实 chat 入口回归先在 `3e192f9` 失败（`artifacts/t164/review-eight-parent-red.log`）：保留 18/19 点两处事实被报重复；删除第二处后旧 19 点出处仍存在；一次真实浏览器工厂读取不到 CHROME_PATH 后任务错误完成、局部写作 4 次并存第二版。红产物 `artifacts/t164/review-seven-1792114756066-40622/evidence.json` 保留。修复后同一入口与 T-164/T-169 聚焦 28/28 通过（`review-eight-focused.log`），Chrome 故障时明确 error、仍仅 2 次局部写作、仅原一版、repairRound=0、attempts=[]；绿色产物 `artifacts/t164/review-seven-1792114828662-41799/evidence.json` 保留。保留两处时第一处换了段落包装，断言新定位为 [0,1,0]；删除第二处时断言 19 点原文和 [1,1] 旧定位同时消失。

第八轮验证对应实现 `449f16f`：`npm run typecheck` 通过；标准入口回归 `node --test --experimental-strip-types scripts/t167-runner-regressions.ts` 4/4 通过（`artifacts/t164/review-eight-runner.log`）；定向 28/28 通过；`SITE_STORE=fs npm run build` 于 2026-10-16T01:56:43.081930+00:00 通过（`artifacts/t164/review-eight-build.log`）。

全量 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test` 于 2026-10-16T01:53:29.119Z 以 585/588 结束，3 项失败，该轮完整验收为 **INCOMPLETE**。原始日志 `artifacts/t164/review-eight-full.log`、报告／数据根路径 `artifacts/t167/test-run-1792115159735-46784` 保留；没有重跑、跳过用例或放宽上限。

- `tests/t162-mobile-reveal.test.ts:92`：1440/768 线程回看用例在局部任务完成断言失败。站点 `cec33f27-481f-489e-bc4a-ebdc16229561` 的任务记录明确为“局部动态状态检查超时，本次未保存版本”，selectedTarget 为单区块、没有 annotationBatch；错误发生在本轮未修改的 5 秒动态检查中。失败截图已打开查看，存于 `artifacts/t162/self-contained-1792115329171-51493/mobile-journey-failure-1440-cec33f27-481f-489e-bc4a-ebdc16229561.png`。该 helper 的现有 timings 记录 load 30.5–38.5，仅作运行上下文，不据此认定根因。
- `tests/t169-citations-browser.test.ts:91`：生成已完成，发布页等待 `main h1` 时 Runtime.evaluate 30 秒超时。
- `tests/t169-citations-browser.test.ts:143`：上传资料工作台用例读取尚不存在的按钮，scrollIntoView 抛 null 错误。两项 UI 失败未在本轮通过再次运行确认根因或与改动的关系，不能报通过。

全量及 build 前均检查 df/ps，启动时无其他 chrome-headless-shell、node --test 或 next build；全量期间核对只发现本轮标准入口。动态探针未改；负责人转述的第八位独立复测单档最大 3.51 秒、三档最大 8.94 秒已确认满足 5/15 秒，下面保留第七轮原始 30 次分布，不冒充本轮重新测量。

冻结实现 `c6f8bc8` 后，2026-10-16T01:13:38.243Z 在只读复制根 `/tmp/sitecraft-t164-seven-real.51KwNb` 完成两个真实首页每档各 5 次测量。命令：`ROOT=/tmp/sitecraft-t164-seven-real.51KwNb COMMIT=c6f8bc8 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --experimental-strip-types artifacts/t164/real-homepage-timing.ts`。

全部原始样本、聚焦／强制／样式读取／比较阶段耗时及计数在 `artifacts/t164/real-homepage-timing.json`，运行日志为 `real-homepage-timing-c6f8bc8.log`；旧 JSON 另存 `real-homepage-timing-258fb02.json`，不覆盖失败证据。下表时间单位 ms，计数为每次源／候选各自相同的值。

| 首页 | 视口 | min / 中位 / max | 可交互 | 非空 force | CDP 往返 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 禾巷小馆 | 375 | 2091.7 / 2111.6 / 2241.6 | 10 | 76 | 215 |
| 禾巷小馆 | 768 | 2099.4 / 2203.0 / 2215.7 | 10 | 76 | 215 |
| 禾巷小馆 | 1440 | 2206.1 / 2228.3 / 2236.0 | 10 | 76 | 215 |
| 拾色绘画教室 | 375 | 1930.9 / 1935.2 / 1954.1 | 7 | 58 | 169 |
| 拾色绘画教室 | 768 | 1952.0 / 1983.1 / 2001.3 | 7 | 58 | 169 |
| 拾色绘画教室 | 1440 | 1991.4 / 2001.7 / 2015.3 | 7 | 58 | 169 |

全部 30 次单档 ≤5000ms、`extras=0`。各轮按相同样本序号相加的三档分布：

- 禾巷小馆：min/中位/max = 6525.9/6538.2/6547.4ms，全部 ≤15000ms。
- 拾色绘画教室：min/中位/max = 5898.5/5914.7/5955.4ms，全部 ≤15000ms。

第七轮既有验证（2026-10-16，实现 `c6f8bc8`）：`npm run typecheck` 通过；标准入口回归 `node --test --experimental-strip-types scripts/t167-runner-regressions.ts` 4/4 通过（`artifacts/t164/review-seven-runner.log`）；最终定向 27/27 通过；`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test` 585/585 通过（`artifacts/t164/review-seven-full.log`、`artifacts/t167/test-run-1792113281197-11873`）；`SITE_STORE=fs npm run build` 通过（Next.js 16.3.1/Turbopack，`artifacts/t164/review-seven-build.log`）。全量及 build 前均执行 df/ps 检查，重任务串行。两项均在主控新一轮独占窗口通知前结束，收到通知后未再启动浏览器或 build。

本轮离线修复与冻结验证已通过（见 Resolution 开头）；此前 585/588 的失败证据保留。真实 DeepSeek、独立盲评与独立 sol 审查仍由主控安排，票保持 open。未推送。
