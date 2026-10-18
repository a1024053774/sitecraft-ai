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

**INCOMPLETE，2026-10-18 UTC**。功能候选提交为 `be8af2cc0cbdc7182a897142cf48c89cafb16b5b`（父提交 `d90ffc2`）。三档定向检查、指定的原有回归、runner 与 typecheck 通过；该候选上的一次全量出现原有用例失败，按负责人规则停止，不重跑、不启动 build。结果见 [验收汇总](../../artifacts/t179/final-validation.json)、[全量报告](../../artifacts/t179/full/report.json) 和 [日志](../../artifacts/t179/full/tests.log)。本次收尾提交只更新 Resolution，不改代码或测试。独立审查仍由主控另派，最后一项验收保持未勾选。

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

定向及原有回归在 `be8af2c` 提交前的工作树运行，产品代码和测试与该候选相同。全量在 `be8af2c` 上运行一次；观察到原有失败后向测试入口发送 SIGTERM，使其拒绝启动末尾串行阶段，保留报告与临时数据根。已完成的 91 个文件原生汇总为 501 用例、495 通过、6 失败；尚未完成的 review-seven 文件在关闭前另输出 2 项失败，故日志共观察到 8 项失败，未完成项不能算通过。失败涉及 T-163 的 375 圈选草稿流程，以及 T-164 的 dynamic-gate、multi-block-edit、original-materials、review-seven；具体失败名称在验收汇总，完整输出在全量 tests.log。尚未判定各失败根因或与 T-179 的关系，不以负载猜测替代证据。验收截图均在最终产品改动后生成并逐张打开：T-179 定向 18 张，原有回归 37 张（T-162 的 scroll-edge 9、mobile-reveal 6、review-regressions 10，T-175 的 thread-placement 6、stale-placeholder 6）。[原有回归截图索引](../../artifacts/t179/related-screenshots.json) 保留精确路径。只证明交互和可见性，不自评审美；scroll-edge 的空白预览是目标滚出视野的夹具状态，不作生成站质量证据。此前 43 张测量／失败截图也都已逐张打开，原始结果保留。

未读 .env.local、未调用 DeepSeek、未使用 rm 命令、未写主目录 .sitecraft-data、未推送。Next 自动改动 tsconfig.json 留在工作树且不提交。wheel 以外的主动滚动输入未单独实测；模型替身不证明真实模型行为，本票不需要真实模型或外部依赖验证。
