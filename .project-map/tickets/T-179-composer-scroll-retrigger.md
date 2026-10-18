---
id: T-179
title: 批注浮层腾位后，用户手动滚动不应被再次推回
type: build
status: open
blocked_by: []
claimed_by: Codex
supersedes:
---

## Why

T-175 第三轮独立审查（2026-10-18）读源码推断：批注浮层为避开历史回看栏和「返回当前版本」自动腾位后，用户在预览里小幅往上滚，可能再次触发腾位，把阅读位置推回去。尚未实测，但若成立会直接伤到「修改/回看」的手感。

## What to build

1. 先实测：375/768/1440 三档，打开批注线程、触发一次腾位后，用真实滚轮小幅上滚与下滚，记录预览滚动位置是否被程序改写。
2. 不复现：把对照断言留作回归，写明结论关票。复现：只在用户主动滚动后停止自动腾位，直到用户再次点选目标或重新打开浮层；不改生成站代码，不放宽 T-162/T-175 已有的遮挡与可见性断言。
3. 顺带把 T-175 移交的小项改掉：「同一节点多占位」用例的两个预期片段改成两个不同出处。

## Acceptance

- [x] 手动滚动对照断言三档成对（自动腾位仍生效 / 用户滚动后不被推回），复现时先在父版本失败
- [x] T-162 mobile-reveal、scroll-edge、review-regressions 与 T-175 遮挡断言回归通过，截图逐张看过
- [ ] 不调用 DeepSeek；typecheck、test、build 通过；独立 fast 审查通过

## Resolution

**INCOMPLETE，2026-10-18 UTC**。功能候选提交为 `be8af2cc0cbdc7182a897142cf48c89cafb16b5b`（父提交 `d90ffc2`）。三档定向检查、指定的原有回归、runner 与 typecheck 通过；该候选上的一次全量出现原有用例失败后，Codex 误把「当前项自然跑完后不再进入下一项」理解成中止当前全量，主动发送 SIGTERM；这不符合负责人原意。此轮未自然跑完，不重跑、不启动 build。结果见 [验收汇总](../../artifacts/t179/final-validation.json)、[全量报告](../../artifacts/t179/full/report.json) 和 [日志](../../artifacts/t179/full/tests.log)。本次收尾提交只更新 Resolution，不改代码或测试。独立审查仍由主控另派，最后一项验收保持未勾选。

实测结论：父版本 `4781659` 在 768/1440 复现用户上滚后被程序推回，375 不复现。首次只测量的 [脚本和数据](../../artifacts/t179/measurement-1792289031509-45580/) 与 [报告](../../artifacts/t179/baseline-measurement/report.json) 保留；上滚输入为 -48，内层 scrollTop 分别为 375 `2271→2223`、768 `1927→1879→1919`、1440 `1673→1625→1658`，外层保持 `203/85/0`。浮层 top 分别为 `761→761`、`739.875→749`、`738.015625→749`。下滚 +48 三档均保留原生位移。

需求断言先在 `4781659` 的产品代码上失败：[父版本报告](../../artifacts/t179/parent-red/report.json)、[脚本与数据](../../artifacts/t179/measurement-1792289094226-46179/)。场景增加一句意见，确保三档都实际触发首次腾位；375 通过，768/1440 在原生位移断言失败，首次腾位三档均通过。前一候选失败的 [报告](../../artifacts/t179/focused-green/report.json) 及 [继续诊断的报告](../../artifacts/t179/diagnose-reopen/report.json) 都保留，没有覆盖或重跑掩盖。

两项恢复失败的原因及处理：

- 375 是产品逻辑：手动滚动后收起再展开，只清除 userScrolled，却保留 lastReveal，面板恢复原高度后被误认为已定位。诊断时目标底部 `772.06`、面板顶部 `742`，且没有 expand 阶段的腾位。现在在重新点选／定位／展开时同时清除上次定位标识；展开后目标底部 `732.124`、面板顶部 `742`，恢复避让。
- 768 是测试场景：pick helper 在点击前执行 scrollIntoView，使目标顶部 `545.83984375`、面板底部 `537.828125`，本来就可在上方放下，不产生 scrollBy 是合法结果。现在先用真实滚轮制造遮挡，再原位真实点击同一标题，不让 helper 预先消除场景；仍要求实际腾位、完整浮层和目标避让。修后目标底部 `680.264892578125`、面板顶部 `688`，捕获到重新点选后的自动腾位；375 也取消原用例的宽度豁免，三档统一检查。

最终行为只在工作台实现：首次腾位保留；原生滚轮、触摸移动、滚动键或滚动条输入后停止自动腾位；再次点选、定位线程或展开时恢复。生成站 HTML/CSS 不变，不新建版本。T-175 同节点两个占位用不同出处逐项核对 snippet 与 quote，已在原有回归中通过。既有 T-162/T-175 遮挡与可见性断言未放宽。spec 只记录规则，AGENTS 只补一句同规则。

全部浏览器测试走标准 npm test 入口，运行者只设置 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell`；`artifacts/t179/run-check.py <标签> <命令>` 在每项开始前运行 memory_pressure 和 ps，低于 25% 不启动，并保留时间、提交和退出码。下表命令均以该脚本运行，标签对应报告目录。

| 标签／命令 | UTC 时间 | 结果与证据 |
| --- | --- | --- |
| `reopen-green`：`npm test -- tests/t179-composer-scroll.test.ts` | 02:09:39–02:10:03 | 3/3；[报告](../../artifacts/t179/reopen-green/report.json)、[三档脚本、几何与截图](../../artifacts/t179/measurement-1792289380202-51243/) |
| `related-regressions`：`npm test -- tests/t162-mobile-reveal.test.ts tests/t162-scroll-edge.test.ts tests/t162-review-regressions.test.ts tests/t175-thread-placement.test.ts tests/t175-stale-placeholder.test.ts` | 02:10:18–02:12:47 | 27/27；[报告](../../artifacts/t179/related-regressions/report.json)、[日志](../../artifacts/t179/related-regressions/tests.log) |
| `runner`：`node --test --experimental-strip-types scripts/t167-runner-regressions.ts` | 02:12:52–02:13:08 | 5/5；[日志](../../artifacts/t179/runner/command.log) |
| `typecheck`：`npm run typecheck` | 02:13:15–02:13:20 | 退出 0；[日志](../../artifacts/t179/typecheck/command.log) |
| `full`：`npm test` | 02:14:28–02:21:22；候选 `be8af2c`，启动前空闲 49% | INCOMPLETE，见下文；[报告](../../artifacts/t179/full/report.json)、[日志](../../artifacts/t179/full/command.log) |
| `build`：`npm run build` | 未运行 | 全量出现原有失败后按要求停止 |

定向及原有回归在 `be8af2c` 提交前的工作树运行，产品代码和测试与该候选相同。全量在 `be8af2c` 上运行一次；Codex 主动发送 `kill -TERM 55402`，使入口中途结束并拒绝启动末尾串行阶段，保留报告与临时数据根。已完成的 91 个文件原生汇总为 501 用例、495 通过、6 失败；尚未完成的 review-seven 文件在关闭前另输出 2 项失败，故日志共观察到 8 项失败，未完成项不能算通过。失败涉及 T-163 的 375 圈选草稿流程，以及 T-164 的 dynamic-gate、multi-block-edit、original-materials、review-seven；具体失败名称在验收汇总，完整输出在全量 tests.log。尚未判定各失败根因或与 T-179 的关系，不以负载猜测替代证据。验收截图均在最终产品改动后生成并逐张打开：T-179 定向 18 张，原有回归 37 张（T-162 的 scroll-edge 9、mobile-reveal 6、review-regressions 10，T-175 的 thread-placement 6、stale-placeholder 6）。[原有回归截图索引](../../artifacts/t179/related-screenshots.json) 保留精确路径。只证明交互和可见性，不自评审美；scroll-edge 的空白预览是目标滚出视野的夹具状态，不作生成站质量证据。此前 43 张测量／失败截图也都已逐张打开，原始结果保留。

未读 .env.local、未调用 DeepSeek、未使用 rm 命令、未写主目录 .sitecraft-data、未推送。Next 自动改动 tsconfig.json 留在工作树且不提交。wheel 以外的主动滚动输入未单独实测；模型替身不证明真实模型行为，本票不需要真实模型或外部依赖验证。

**八项失败的只读诊断（2026-10-18，未重跑、未修复）**

原始 `test:fail` 错误对象未归档：`scripts/test-summary-reporter.mjs` 只保存文件 summary，spec reporter 在中止后没有输出完整异常详情。因此八项的**原始错误首行均未保留**，不能冒充已取得。下表 E0/E1/E2 是依据唯一失败调用、动态诊断、保留的运行状态及源码还原的首行；第 6 项还由该站点第二次提交的 `run.step` 交叉核对。

- E0：`Error: Chrome 检查失败：Error: 等待失败：document.querySelector('[data-testid="code-preview"]')?.contentDocument?.querySelector('main h1') || window.__t162ReviewErrors?.length`
- E1：`Error: 局部动态状态检查超时，本次未保存版本。`
- E2：`AssertionError [ERR_ASSERTION]: 局部动态状态检查超时，本次未保存版本。`

读取列为「预先公布的完整读取计划 → 根据 CDP 序列与 reader 控制流还原的完成数」，均按源+候选列出，不是 getComputedStyle 调用数。完成数不是原始专用计数字段。耗时是该次 dynamic-check 总耗时，包含分类、Chrome 启动、准备、读取与收尾，不等于单纯读样式耗时。Chrome 列为已保存 browser 生命周期区间重建的「开始/期间峰值/结束」测试浏览器实例数；不是当时的 ps 瞬时采样，不含用户 Chrome 的 helper 进程，含启动和退出计时偏差，也不能保证覆盖未正常 close 的实例。原始 OS 瞬时并发进程数未采样。

| 序号 | 测试文件与完整用例名 | 首行（还原） | 是否动态预算超时／档位 | 完整读取：计划 → 完成 | 预算／实际耗时（ms） | Chrome 开始/峰值/结束 | 与 T-179 的关系 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `tests/t163-area-drafts.test.ts`：圈选与三条草稿：375 真实反向指针、编辑、移除、编号和刷新 | E0 | 否；UI 预览等待 | 不适用 | 20000 / 20737.496 | 12/13/11 | 组件关联未证实：初始预览等待，尚未圈选；载入时序的间接影响未排除 |
| 2 | `tests/t164-dynamic-gate.test.ts`：CSS 列表特异性或嵌套条件改变外部样式时拒绝：main:has(a:nth-of-type(2):focus) .outside,.outside{color:rgb(220,20,20)}.outside{color:#111} | E1 | 是；375，四态模式 | 5+9 → 0+0 | 5000 / 17374.690 | 12/13/11 | 无直接功能调用关联：未改动的后端检查超时；不是浮层逻辑失败 |
| 3 | `tests/t164-dynamic-gate.test.ts`：CSS 列表特异性或嵌套条件改变外部样式时拒绝：:scope:has(a:nth-of-type(2):focus) .outside{color:rgb(220,20,20)} | E1 | 是；375，四态模式 | 5+9 → 0+0 | 5000 / 5240.596 | 9/11/10 | 无直接功能调用关联：未改动的后端检查超时；不是浮层逻辑失败 |
| 4 | `tests/t164-multi-block-edit.test.ts`：候选新增链接触发范围外自定义属性也必须拒绝 | E1 | 是；375，四态模式 | 1+5 → 0+0 | 5000 / 16747.429 | 11/13/12 | 无直接功能调用关联：未改动的后端检查超时；不是浮层逻辑失败 |
| 5 | `tests/t164-multi-block-edit.test.ts`：动态探针在三档视口固定检查四种状态并记录强制调用证据 | E1 | 是；375，四态模式 | 5+5 → 3+4 | 5000 / 5057.635 | 8/11/11 | 无直接功能调用关联：未改动的后端检查超时；不是浮层逻辑失败 |
| 6 | `tests/t164-original-materials.test.ts`：旧站批次逐字核对原始资料，只给新版本保存出处，三档显示原始资料 | E2 | 是；1440，静态基线、共用预算 | 1+1 → 1+1 | 5000 / 5779.513 | 10/10/10 | 无直接功能调用关联：未改动的后端检查超时；不是浮层逻辑失败 |
| 7 | `tests/t164-review-seven.test.ts`：祖先规则在焦点态改变明确高度仍须拒绝 | E1 | 是；375，四态模式 | 1+5 → 0+0 | 5000 / 8887.966 | 10/11/6 | 无直接功能调用关联：未改动的后端检查超时；不是浮层逻辑失败 |
| 8 | `tests/t164-review-seven.test.ts`：区块外 ::before 的完整计算样式改变必须拒绝 | E1 | 是；375，四态模式 | 1+5 → 1+3 | 5000 / 5043.673 | 10/11/9 | 无直接功能调用关联：未改动的后端检查超时；不是浮层逻辑失败 |

超时位置：第 2/3/4/7 项在计划发布时已分别耗时 `17336/5229/16648/8882ms`，超过 5000ms，两侧只完成准备的 5 次 CDP 调用、styleRead 均为 0，尚未开始完整读取。第 5 项源侧完成 baseline/focus/focus-visible 后在 clear 校时超时；候选完成至 hover 后被清理打断。第 6 项两次静态完整读取已完成，候选 reader 收尾校时超时，第二次提交保存为 run.error，随后触发 complete 断言失败；尚未进入后续三档出处 UI。第 8 项源侧 baseline 后在无触发元素的状态清理阶段超时，候选完成至 focus-visible 后被清理打断。不能把这些异常误写为「外溢被允许」或「动态用例正常拒收通过」。

关系判断的边界：第 2–8 项走 `commitSiteCode → checkSiteCode → prepareOutsideCssApplications`，这些实现及失败测试文件相对 `4781659` 均未改动；检查浏览器使用无脚本 `/code-check.html` 并阻断 Next 资源，不加载 CodePreviewSelection。第 1 项同属工作台页面，唯一慢调用是 session 首次等待（CDP 20702ms、helper 20737.496ms），失败截图、timings 与源码定位到进入圈选前；没有浮层恢复逻辑触发的证据，但不能把这等同于证明载入时序完全无关。

两项测试改动分别排除：T-179 新用例本轮没有进入创建测量目录、运行用例与创建 Chrome 的路径；T-175 出处调整所在文件属于串行阶段，该阶段未启动，所以它没有运行。二者不是这次并发 Chrome 的新增来源。观察到 10–13 个区间重建的并发实例和多项预算超时，是同轮现象；没有受控实验，不能断言负载是唯一根因。没有跑父版定向：本轮遵照先不重跑，只读既有证据；第 1 项相关性保持未证实，不用不同并发下的一次父版通过替代全量因果证明。

入口提前结束的机制：不是失败后正常跑完，也没有证据表明入口自行崩溃或触发了全量超时。主动 SIGTERM 进入 `scripts/run-tests.ts` 的 stop handler，设置 interrupted=true，并终止测试子进程和 dev server；并行子进程关闭后，准备进入串行阶段时 `assert.ok(!interrupted)` 抛出「测试入口已取消，拒绝启动下一阶段」。正常失败只累计 testCode，原代码不会因此跳过串行阶段。此次人为中止使 116 个并行文件中仅 91 个留下完整 summary，25 个没有完整 summary（可能运行中、尚未运行或输出尚未刷新），3 个串行文件全部未执行。501 仅是完整文件 summary 的统计，不是完整实际执行总数；日志的 8 项也不是完整失败清单，原始异常详情与潜在后续失败均无法从本轮补齐。今后「失败就停」统一按当前项自然结束后不进入下一项执行，不向运行中的全量发 SIGTERM；用户明确要求取消除外。

诊断证据：[逐项数据与关系判断](../../artifacts/t179/failure-audit.json)、[只读指标提取脚本](../../artifacts/t179/failure-audit.py)、[375 首次预览等待失败截图](../../artifacts/t162/self-contained-1792289783018-60122/session-failure-375-1349c66a-6bb7-4641-8354-7c49df8e247d.png)。截图已打开，仅证明失败时工作台状态。当前只更新诊断与 Resolution，未改产品、测试、预算、超时上限或并发设置。
