---
id: T-138
title: 降低每次生成与评估的 DeepSeek 用量
type: build
status: open
blocked_by: []
claimed_by: t138-build
supersedes:
---

## Why

负责人 2026-10-09：DeepSeek 钱包撑不住，尽量减少用量。一整轮 8 组合评估 60–120 万 token；T-134 一轮 122.5 万（write 60.7 万、facts 34.8 万、polish 22.6 万、plan 4.5 万）。修正轮多半来自模型编造无来源的承诺或政策，每多一轮就多一次写整站和一次事实校对。

## What to build

先用已有轮次的用量记录（T-133 基线、T-132、T-134、T-135 的 private/ 调用记录，不新调模型）算清楚 token 花在哪：各用途的输入/输出、推理 token 占比、修正轮占比、单站平均。然后在根因处减：

1. 修正轮只改被拒的部分：把拒因对应的句子删掉或改写成资料原话，不重写整站；交回模型的上下文只带必要内容。
2. 写页提示里把「无来源的承诺、报价、交期、付款、售后、认证类说法一律不写」放到显著位置，减少首稿被拒。
3. 事实校对与规划等不需要长推理的调用，评估是否改用非思考模式或更小的输出上限；不影响结果才改，用成对数据说明。
4. 评估命令加一个快速档：4 个组合（每家一种风格）、只生成首页和产品页，用于日常验证；整轮 8 组合只在做决定时跑。

## Acceptance

- [ ] Resolution 有改前用量拆分（来自已有记录）和改后快速档一轮的用量拆分，单站平均 token 至少下降三分之一，最终拒收率不上升
- [x] 修正轮的局部修改不绕过提交入口和底线检查；有测试，坏实现（整站重写或跳过检查）失败
- [ ] Astra 审查通过；typecheck、test、build 通过

## Resolution

INCOMPLETE（真实联合评估未运行）：Astra 已对 `b8174f0` 复核 PASS。按主控要求，本执行分支合并本地 `family-kit-assembly` 的 `6f069ee`，冲突与集成验证 PASS；合并提交留在 `t138-tokens`，不推送、不关票、不派审查，保持当前模型。真实 DeepSeek 调用仍为 0，快速档不运行，由主控在本地主线做唯一一次联合用量与质量验证。本次合并 SHA、两父提交和验证命令/时间在 `artifacts/t138/merge-family/verification.json`。

### 改前用量（只读已有记录）

2026-10-09，运行以下命令，不调用模型。完整拆分、来源及不一致记录在 `artifacts/t138/baseline-usage.json`：

```bash
node --experimental-strip-types scripts/analyze-code-usage.ts \
  /Users/luckye/Documents/Code/sitecraft-ai-t133/artifacts/t130/round-2026-10-08T07-59-10-005Z \
  /Users/luckye/Documents/Code/sitecraft-ai-t132/artifacts/t130/round-2026-10-08T13-55-52-008Z \
  /Users/luckye/Documents/Code/sitecraft-ai-t134/artifacts/t130/round-2026-10-08T18-08-06-860Z \
  /Users/luckye/Documents/Code/sitecraft-ai-t135/artifacts/t130/round-2026-10-08T19-20-37-063Z \
  > artifacts/t138/baseline-usage.json
```

采用 `private/case-N/code-site.json` 的逐次调用；没有候选记录的未运行项使用原轮次记录。输入与输出均为上游报告，输出包含推理，不把推理再加到总量。

| 轮次 | 用途 | 次数 | 输入 token | 输出 token | 合计 token |
| --- | --- | ---: | ---: | ---: | ---: |
| T-133 | plan | 8 | 31,648 | 12,746 | 44,394 |
| T-133 | write | 13 | 107,017 | 281,686 | 388,703 |
| T-133 | facts | 13 | 45,216 | 125,856 | 171,072 |
| T-132 | plan | 8 | 36,848 | 14,686 | 51,534 |
| T-132 | write | 19 | 223,550 | 441,516 | 665,066 |
| T-132 | facts | 19 | 80,246 | 189,379 | 269,625 |
| T-134 | plan | 8 | 31,896 | 12,846 | 44,742 |
| T-134 | write | 20 | 212,808 | 393,823 | 606,631 |
| T-134 | facts | 22 | 98,038 | 232,448 | 330,486 |
| T-134 | polish | 5 | 100,469 | 125,298 | 225,767 |
| T-135 | plan | 4 | 17,572 | 10,007 | 27,579 |
| T-135 | write | 6 | 59,761 | 103,547 | 163,308 |
| T-135 | facts | 6 | 17,650 | 41,735 | 59,385 |

| 轮次 | 已报告总量 | 每个已启动站平均 | 修正用量（含后续事实校对） | 修正占比 | 最终拒收 |
| --- | ---: | ---: | ---: | ---: | --- |
| T-133 | 604,169 | 75,521（8站） | 173,413 | 28.7% | 0/8；8站生成 |
| T-132 | 986,225 | 123,278（8站） | 426,961 | 43.3% | 0/8；8站生成 |
| T-134 | 1,207,626 | 150,953（8站） | 466,204 | 38.6% | 汇总为2/7；4生成、1错误、1未运行，最后候选仍为 running |
| T-135 | 250,272（部分） | 62,568（4站，含被阻塞项） | 92,229 | 36.9% | 0/3；3生成、1被402阻塞、4未运行 |

T-134 原 `round.json`/`report.json` 只有 1,091,963 token，最后一站只登记 plan；候选快照另有 115,663 token。票原有“122.5万”是历史概要，现有调用记录只能核实上述 120.8 万，不补造缺失用量，也不把 running 算成功。生成阶段修正 265,515，打磨后修正 200,689；首轮打磨与随后的事实校对不算修正轮。

T-133/T-132/T-134 的 34/46/55 次调用都没有推理用量记录。T-135 的 15 次有记录调用报告推理 110,764，占这些调用输出 155,289 的 71.3%；另1次失败调用未知。规划/事实校对无非思考模式或低上限的同输入成对证据，因此保留思考模式与 65536 上限；不以重放旧回答代替模型能力对比。新增记录只保存上游推理 token 数，不保存思考文字。

### 改动与本地证据

本地合并：`git merge --no-commit family-kit-assembly`，两父提交为 T-138 `b8174f0` 与本地主线 `6f069ee`。四处冲突均按行为合并：`lib/code-site.ts` 同时保留 skeleton/skeletonOrder、response 结束原因/回答长度/推理元数据及 repair 用途、usage.reasoningTokens、repairFailure；T-128/T-130 的 provider 夹具同时支持 strict `submit_page_plan` 与局部修正 JSON，并保留原计数、拒收、版本、用量断言。T-136/T-138 规划夹具适配同一 strict 协议，T-136 历史长纲完整拆为每项不超过120字的数组，不截断、不放宽生产 schema。T-129 保留原区域与版本断言：初稿携历史参考，repair 不再重传整站。自动合入的生产模型代码保持唯一调用入口：规划走 beta strict 函数输出，其余 JSON 调用保留首稿事实红线与 DOM/字符区间修正。资料/全部图片、事实去重、快速档及分用途统计均保留。

合并后运行 `CHROME_PATH=<AGENTS指定路径> SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:3150 node --test --experimental-strip-types tests/t128-*.test.ts tests/t129-*.test.ts tests/t130-*.test.ts tests/t133-*.test.ts tests/t135-*.test.ts tests/t136-*.test.ts tests/t137-*.test.ts tests/t138-*.test.ts`，133/133、0跳过（`merge-family/related-final.log`）。联合断言核对 skeleton 保存/8张卡顺序/strict tool_calls 元数据与 write→facts→repair 的用量记录；两种推理元数据均保留。用 TypeScript AST 检查 T-138 原断言及 T-135/T-137 相对共同基点新增的断言，缺失0（`branch-assertion-preservation.json`）。另跑资料包与图片覆盖两文件，12/12（`dependencies-with-server.log`）；第一次附加检查被本执行者提前停3150做build而中断，失败日志保留，恢复同一服务/场景后重新检查，没有换输入或放宽断言。`npm run typecheck`、`npm run build` 通过（`typecheck-final.log`、`build.log`）。所有日志位于 `artifacts/t138/merge-family/`，记录时间见 `verification.json`。真实模型、真实快速档与全仓测试本次均未运行。

首稿提示显著禁止无来源的承诺、报价、交期、付款、售后和认证说法。修正调用使用 `repair` 用途，只发送资料、拒因和对应 DOM 节点：text/title 是纯文字，Text 节点按文字区间写入、由 DOM 转义；element 是原层级的一个完整元素，标签须闭合；style 是一个完整、无属性的 style 元素，CSS 须闭合。布局只发送叶子元素和公共样式，避免祖先重复带整页。模型输出不得按 HTML 字符位置拼接。未知编号、重复编号、重叠/变化的节点、整站 JSON 和定位不到的拒因明确失败。只有拒因全部属于入口已完成的清理、没有剩余节点时，允许模型明确返回空替换；未知拒因不能借这个分支通过。

文字修正按实际 Text 节点分组，每组按原始偏移倒序应用，其他节点插在提案中不能改变应用顺序；同节点区间重叠直接拒绝，相邻区间允许。范围核验不跳过整个 Text 节点，而是根据原区间、修正长度分别提取修改前后的未选字符区间（前缀、间隙、后缀），逐段核对所有字符；同时核对新长度与每个选中区间的实际结果。元素整节点替换仍只排除该元素子树。修改前后核对范围外 DOM 的节点类型、文本、属性、命名空间与注释，再从完整候选重新解析每页，对照独立以 DOM 节点构建的预期文档。越界回复立即终止，完整回复与拒因保存在 `run.repairFailure`，不重发、不存版。通过后仍由原 `commitSiteCode` 清理、事实校对和三档检查，最多两轮。公共页头页脚在校对文本中各保留一次，页面标题、正文、辅助属性及 CSS 生成文案仍完整检查。

- `CHROME_PATH=<AGENTS指定路径> node --test --experimental-strip-types tests/t138-token-repair.test.ts`：改前整站写作3次，期望1次而失败；改后首稿1次、局部修正2次，第一次修正的新承诺被真实提交入口拒收，第二次才存版。页头页脚重复校对检查由3次对2次的失败转为通过。红态分别保存于 `artifacts/t138/original-rewrite-red.log` 和 `artifacts/t138/facts-dedup-red.log`；最终受控运行记录保存在 `artifacts/t138/repair-*/result.json`。
- Astra 的 P1 原始复现 `artifacts/t138/repair-c9db80bf-b1c8-488a-ba70-901723939984/result.json` 保留：`<!--` 吞掉“不接食品接触零件”却存版。2026-10-09 用 `CHROME_PATH=<AGENTS指定路径> node --test --experimental-strip-types tests/t138-dom-scope.test.ts` 在 `fc11345` 重现，9项均失败，日志 `p1-dom-red.log`；原因都是 HTML 被解释或越界回复创建了版本，没有环境或导入错误。
- Astra 在 `0cb64dd` 的复现 `artifacts/t138/dom-scope-a396023d-*/independent-interleaved-text.json` 保留：A1→B→A2 改坏同一文本节点内未被拒的“不接食品接触零件”仍存版。2026-10-09，`CHROME_PATH=<AGENTS指定路径> node --test --experimental-strip-types --test-name-pattern='interleaved|adjacent' tests/t138-dom-scope.test.ts` 在该提交上复现：正向交错文字错误存版，正向相邻区间多一轮错误修正，反向通过；红态 `p2-interleaved-red-complete.log`。提案次序改变结果的根因是跨节点比较器不构成全序，范围核验又跳过了整个 Text 节点；两个机制均已在原层修正，没有用事实校对兜底。
- 本次相关40项通过（0跳过），`artifacts/t138/p2-related-frozen.log`。包括正/反交错提案、正/反相邻区间（含删除）、部分重叠区间与原13项完整提交安全检查。交错与相邻案例一次修正后真实存版、三档全部检查，未选字符及其他页面保持；同节点部分重叠直接拒绝。原 `<!--`、`</p><p>`、`<script>`、未闭合标签作为 text 只显示文字；作为 element 则拒绝并保存回复；完整标签重解析后越界仍拒绝；合法单元素与完整 style 可存版，未闭合 CSS 不能。原版本恢复、长拒因、失败完整归档断言保留，清理后空替换仍检查三页×三档。
- 字符范围守卫独立故障注入：只删除未选范围的“不”并补句号，保持总长度和选中区间内容不变，真实提交仍拒绝且留 `repairFailure`（`p2-corruption-guard-green.log`）；恢复“整节点跳过”的坏实现会把错误候选存版，测试失败（`p2-mutant-skip-text-red.log`）。故意改组内正序也失败（`p2-mutant-ascending-red.log`）。测试过程向节点目录注入合法定位但重叠的第二区间，完整提交直接拒绝（`p2-overlap-submit-green.log`）；去掉重叠守卫则不能给出直接重叠拒因，回归失败（`p2-mutant-no-overlap-red.log`）。命令：`P2_MUTANT=<corrupt|skip-text|ascending|overlap|no-overlap> T138_RANGE_CORRUPTION=1`（overlap 用 `T138_RANGE_OVERLAP=1`，ascending 不设两者）`NODE_OPTIONS='--import <本工作树>/artifacts/t138/p2-mutants.mjs' CHROME_PATH=<AGENTS指定路径> node --test --experimental-strip-types --test-name-pattern='interleaved.*forward' tests/t138-dom-scope.test.ts`。故障只作用于测试进程，工作树不被替换。
- 运行反例：`P1_MUTANT=<reparse|syntax|css> NODE_OPTIONS='--import <本工作树>/artifacts/t138/p1-mutants.mjs' CHROME_PATH=<AGENTS指定路径> node --test --experimental-strip-types --test-name-pattern=<reparents|element repair.*span|unclosed stylesheet> tests/t138-dom-scope.test.ts`。去掉整站重解析、元素闭合或 CSS 闭合验证，对应测试均因坏候选存版失败；日志 `p1-mutant-{reparse,syntax,css}.log`。loader 只改测试进程读入的源码，不改工作树；原 fc11345 失败及早期反例日志仍保留。
- `CHROME_PATH=<AGENTS指定路径> node --experimental-strip-types artifacts/t138/p1-context-replay.ts`：改动后已有29个被拒候选均可定位；原整站代码上下文558,023字符，节点上下文86,382字符，减少84.5%。结果 `p1-context-replay.json` / `p1-context-summary.json`；只证明代码上下文缩短，不能当作真实 token 降幅、修正成功率或美观通过。
- 2026-10-09 本次修改后的验证（运行时 HEAD 为 `0cb64dd`，工作树含文字区间修复，amend 结果与运行时间记在 `verification-p2.json`）：`npm run typecheck`、`npm run build` 通过，日志 `p2-typecheck-frozen.log`、`p2-build.log`。相关命令：`CHROME_PATH=<AGENTS指定路径> node --test --experimental-strip-types tests/t138-dom-scope.test.ts tests/t138-repair-fragments.test.ts tests/t138-token-repair.test.ts tests/t130-run-records.test.ts tests/t129-version-history.test.ts tests/t136-session-summary.test.ts tests/t130-model-usage.test.ts tests/t138-quick-eval.test.ts`。原截图仅是 fc11345 的受控夹具证据，本次以完整提交与实际 DOM/字符检查为准，不引用旧图宣布本次通过。
- 本次按主控要求跑相关检查，未重跑全仓测试。原 `npm test` 为2596/2598、0跳过（`artifacts/t138/test-final.log`），不是本次改动的全仓通过证据：T-090 缺旧站点 `561a1113-4dab-49b6-81dc-ab7e3eb712a5` 文件，T-113 固定旧站点图片接口404。仍不搬其他树数据、不改检查或跳过它们；全仓测试不能写成 PASS，不因两项旧检查阻塞本票页面质量工作。原失败证据均保留，只停止本执行者的进程。

### 待合入主线的唯一联合真实运行

快速档固定工业/precision、外贸/documentary、注塑/precision、纸包装/documentary，只请求 `home` 与 `products`。来源事实不截断，图片许可和原提交检查照常运行；四份真实官网对照。`--quick` 与整轮互不成对比较；模型失败（含402）一次即停止后续组合，不自动重发。

T-138 单票原粗估18–26万 token，依据 T-133 对应四组合首稿/规划/校对已花219,825 token，截取首页与产品页后代码体积为原站80–96%。这不是合入 T-137 资料加厚与 T-135 骨架卡后的费用承诺，联合运行前须由主控按合并后的输入重估；不把页数减半当作用量减半。无修正12次调用，全部两轮修正最多28次；现有每次输出上限65536，合计输出硬上限1,835,008 token，另加输入，长推理或多轮拒收可超估算。

与 T-133 全8站平均相比，下降三分之一要求快速档平均不超过50,347；对应四个风格组合的原平均69,523，较严格的对应组合目标为46,349。页数改变，二者仅是费用参照，不是同输入成对效果或审美证据。待实跑补改后分用途用量、最终拒收率和是否达标；未放行前不勾选第一项。Astra 审查由主控另派，执行者不派。

主控指示：三票审过并一起合入主线后，才由主控在主线服务上运行一次，用量与质量同时验证。本执行者不运行，3150 单票命令不是当前待执行项。命令形式为：

```bash
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell \
SITECRAFT_BASE="$SITECRAFT_BASE" npm run eval:new-route -- --quick
```

服务密钥仅用 `set -a; source /Users/luckye/Documents/Code/sitecraft-ai/.env.local; set +a` 加载到进程；`SITE_STORE=fs`，默认 Turbopack。此候选尚未真实测 DeepSeek 修正、省量与拒收率；不宣称审美通过。
