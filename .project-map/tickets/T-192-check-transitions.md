---
id: T-192
title: 检查文档里作者写的过渡让计算样式读到旧值
type: build
status: open
blocked_by: []
claimed_by: codex-t192
supersedes:
---

## Why

T-191 的复审（`artifacts/t191/review2.txt`）发现：同一份文档里切换视口时，作者写的 `transition: display allow-discrete` 会让 `getComputedStyle` 读到旧值，三档并集漏掉了真实的分隔。T-191 改回每档重新装载，绕开了这种情况。

T-191 Resolution 里「其他三档计算样式路径的只读排查」还列出了三处同一档文档内的风险，都没有复现过：

1. 动态状态探针（T-164/T-178）在 `DOM.focus` 或 `forcePseudoState` 之后，立即读取完整计算样式，没有等待，也没有停用作者写的过渡；
2. T-173 的 CSS 影响核实，临时改声明后立即重读；
3. 提交检查扫描前会展开 details、移除 aria-hidden，之后不等过渡结束。

生成站常写 `transition: color .2s` 这类悬停过渡。如果在过渡刚开始时读取，读到的还是旧状态，局部修改的范围外交互样式变化就可能被漏判为「没变」，提交入口的范围检查等于失效。这关系到主流程的正确性。全站渲染器没有全局停用过渡的规则。

## What to build

1. **先复现**：对三处各做一个最小夹具，经实际入口运行，证明会读到过渡前的值，或者证明不会。
   - 例如 hover 时颜色带 `.2s` 过渡，候选改了范围外元素的 hover 颜色；
   - 例如 details 展开后带过渡的元素。
   结果逐处写进 Resolution。
2. **修复复现了的地方**：只在检查用的隔离文档里停用过渡和动画。源与候选按同一方式处理，不改生成站代码、预览或发布。
   - 停用时要明确的边界：`transition` 和 `animation` 属性本身的计算值也会被比较。要说明它们怎么比，不能因为停用而丢掉「候选改了过渡声明」这类范围外变化。
   - 无法确定的情况明确拒收，不靠等待固定时长来规避。
3. **没复现的地方**：如实写「未复现」，不修。
4. **成对测试**：复现了的每处先在旧实现上红，修复后绿。

## Acceptance

- [x] 三处是否复现逐一写进 Resolution，附夹具与命令
- [x] 复现处的成对测试先红后绿；源与候选的过渡声明变化仍会被检出
- [ ] 合并后主线验证通过；独立 fast 审查通过

## Resolution

### 范围与复现结论（2026-10-19，执行 codex-t192）

本次处理检查器在同一隔离文档内改变状态后读到作者过渡旧值的问题，关系到局部修改是否越界和提交检查是否如实拒收。生成站代码、预览、发布、模型准入及已有动态读取预算不变。只处理本票三处；三处均经实际入口复现，没有将源码推断当作复现。

| 位置 | 最小夹具与实际入口 | 父版本观察 | 修复后期望 |
| --- | --- | --- | --- |
| T-164/T-178 动态状态探针 | 源区块一个链接，候选在同区块加第二链接；既有 `main:has(a:nth-of-type(2):hover) .outside` 将区块外正文由 `#222` 改成 `#900`，正文有 `transition:color 1s step-end`。经 `commitSiteCode`、真实 Chrome 与独立临时存储运行 | 原样提交允许；新增第二链接的越界候选也被保存，无过渡对照正确拒收 | 原样提交仍允许；有／无过渡的越界候选均拒收，版本数不增加 |
| T-173 CSS 声明影响核实 | 单处 `.fee::before` 的 `content:"免运费。"` 带 `transition:content 1s step-end allow-discrete`；经 `checkSiteCode`、真实事实 HTTP 替身与 CSS 扰动核实 | 单处合法可修声明被误拒为「无法核实实际影响位置」；无过渡对照能返回明确 CSS 修正成员 | 单处声明能核实；同声明波及已通过的乙店段时仍以「允许成员并集之外」拒收 |
| 提交检查展开内容 | `details[open] summary`，以及移除 `aria-hidden` 后的 `.reveal`，最终颜色均为白底 `#eee`，切换前为 `#222`，带 `transition:color 1s step-end`。经 `checkSiteCode` 的真实三档扫描 | 两种有过渡候选均错误通过；无过渡对照均拒收 | 375／768／1440 均记录对比度问题并拒收 |

夹具位于 `tests/t192-check-transitions.test.ts`。`step-end` 使过渡期间维持旧值，预期来自范围合同与对比度底线，不等待固定时长，不以生产输出生成答案。事实 HTTP 替身只控制语义拒因及捕获输入；实际 CSS、状态、扫描与存储均未替代，不据此声称真实模型理解或审美通过。

### 修复边界

共用 `stopCodeCheckMotion` 在检查隔离文档中用 `document.getAnimations()` 刷新待处理样式并枚举元素／伪元素的实际效果，然后取消效果，再枚举确认。仍有效果或 API 无法执行即明确拒收，不重试、不等待、不注入覆盖规则、不改变 DOM 或作者 CSSOM 声明。取消动画效果的浏览器语义参考 [Web Animations 规范](https://www.w3.org/TR/web-animations-1/#cancel-an-animation)。

动态探针在准备及完整读取前调用；源与候选共用同一路径，静态分支也如此。T-173 在原值、临时扰动值、恢复值的每次读取前调用，原有恢复校验、交互／不明作用域拒收仍保留。展开 details／移除 aria-hidden 的扫描、事实分隔预采集及翻译源生成文字读取在同类状态改变后调用，避免同一检查文档内留下未停用的效果；不改变 T-160 在展开前测窄列的顺序。重放 CLI 的每档新装载策略不变，本票不改 CLI。

transition／animation 的作者声明及完整计算属性没有被覆盖或剔除。范围外仅 `transition-duration` 或 `animation-duration` 随候选新触发者变化的反例仍被实际检查拒收。真实探针另验证元素与 `::before` 的动画颜色效果被取消而 `animation-name`／`animation-duration` 原值保留；该隔离探针夹具直接含 @keyframes，仅验证探针，不扩大站点清理准入。取消能力失效时须明确拒收的故障注入也使用真实 Chrome。

Tracer bullet：提交入口 → 真实 Chrome → 检查结果与版本读回。Deep modules：三处共用一个效果取消函数，没有平行扫描器、后备路径或兼容分支。Ubiquitous language：区分「过渡／动画效果」与「作者声明」，前者只在隔离检查内取消，后者仍接受完整范围比较。

### 验证记录

**状态：INCOMPLETE；本地实现及获准门控 PASS。** 合并后主线验证及独立 fast 审查由主控另行安排，末项不勾选，票保持 open，claimed_by 保留 codex-t192。对应实现是本票、代码、测试及 living docs 所在的同一个本地提交（分支 `t192-check-transitions`，父提交 `64090c4558488a84639e481f5892027f1a711a19`）；最终 SHA 随交付报告提供，不另建证据提交。以下均是该提交内容改动后的本轮实测，运行后未再改变生产代码。

所有时间为 2026-10-19 EDT。浏览器均使用本票指定的 Chrome 154 headless shell；标准 npm test 入口自建隔离服务与数据根并核对身份，health 503 的 cwd/dataRoot 也已核对。没有复用主工作区服务、端口或数据。

| 检查 | 时间与结果 | 本工作树证据 |
| --- | --- | --- |
| 最终父版本反事实 | 06:52:19–06:52:34，14 项执行、7 项预期失败、7 项对照通过，exit 1 | `artifacts/t192/final-parent.log`、`final-parent-report.json`；原入口目录 `artifacts/t167/test-run-1792407136476-70257/` |
| 最终候选同文件绿灯 | 06:52:47–06:52:59，14/14，失败／取消／跳过均 0，exit 0 | `artifacts/t192/final-current.log`、`final-current-report.json`；原入口目录 `artifacts/t167/test-run-1792407166229-73496/` |
| 既有相关定向 | 06:34:38–06:51:41，串行 32 次调用包含新增夹具当时的 13 项；剔除该次重复后，既有 31 文件共 285/285，失败／取消／跳过均 0 | `artifacts/t192/focused-20261019-063438/` 下逐文件日志、`results.json`、`summary.json`、`load.txt` |
| 最终 typecheck | 06:52:24–06:52:29，exit 0 | `artifacts/t192/typecheck-final.log`、`typecheck-final.json` |

最终新增 14 项与既有 285 项去重合计 **32 文件、299/299**。每份浏览器定向调用只选一个文件，没有并行跑文件。每次开始前均用 `memory_pressure | tail -1` 与 `pgrep -f chrome-headless-shell | wc -l` 检查；出现一次 Chrome 14 个进程时等到 5 个才继续，详见 load.txt。没有因负载改超时、放宽断言、重试失败或跳过用例。

实际命令：

```sh
export CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell
# 最终反事实：loader 只在内存用 git show 64090c4 载入三个原生产文件。
NODE_OPTIONS='--import=./artifacts/t192/parent-loader.mjs' npm test -- tests/t192-check-transitions.test.ts
# 同一最终夹具，读取当前生产文件。
npm test -- tests/t192-check-transitions.test.ts
npm run typecheck
# 逐文件调用标准 npm test，含运行前负载门槛；不另建测试入口。
python3 artifacts/t192/run-focused.py
```

`parent-loader.mjs` 仅拦截 `lib/code-site-check.ts`、`lib/code-site-local-edit.ts`、`lib/code-site-fact-segments.ts` 的模块加载，使用 `git show 64090c4:<路径>` 的原文；测试与其余依赖保持当前文件，不 checkout、不回退工作树。最终七个失败分别是 hover 越界存版、单处 CSS 影响误拒、共享 CSS 影响误拒、动画效果旧值、取消能力失效仍继续、details 与 aria 展开漏掉对比度问题；没有用导入或服务故障充当红灯。首次改生产代码前的 10 项复现已得到 6 通过／4 个对应缺陷失败，原始日志在 `artifacts/t167/test-run-1792405958420-34484/`。更早 8 项运行中无过渡 CSS 对照的断言误读了字段，已改成读取 factSegments 内 factRepair 并在未改生产代码时重跑；该失败原件 `artifacts/t167/test-run-1792405922024-30049/` 保留，没有覆盖。

定向范围经 rg 检索实际调用及 helper 引用后选定：

- 动态与局部提交：t164-dynamic-gate、t164-multi-block-edit、t164-review-seven、t178-full-style-equivalence、t178-read-budget、t152-local-edits、t152-scope-regressions。
- CSS 事实与版面：t173-repair-scope、t173-citation-repair、t173-fact-boundary、t173-fact-members、t160-narrow-columns、t147-code-quality、t187-repair-fragments、t187-repair-routing。
- 受影响工作流：t162-inline-annotation、t162-mobile-reveal、t162-scroll-edge、t162-review-regressions、t162-element-hint、t164-multi-block-chat、t164-original-materials、t164-overlap-confirmation、t164-local-output-limit。
- 读取与保真：t154-fact-segments、t191-fact-label-boundary、t191-display-transition、t191-replay-fact-segments、t191-replay-display-transition、t151-generated-fidelity、t175-stale-placeholder。

上述名称均对应 `tests/<名称>.test.ts`；每个实际 `npm test -- tests/<名称>.test.ts` 命令及起止时间列在 results.json。只涉及 Chrome 启动就绪的 t173-port-readiness、只涉及模拟资料的 t160-materials 不属于本次改动路径，没有按票号扩跑。新增夹具的输入、完整检查结果、事实 HTTP 捕获与探针快照保存在 `artifacts/t192/check-transitions-*/evidence.json`。

已同步 AGENTS 的机械回归指针、CONTEXT 的检查文档术语、mainline 及 spec 当前合同；git diff --check 与 project_map.py status 通过（Problems 0、Stale living docs 0）。本票没有改 UI／预览样式，不作审美通过声明。未读 .env.local、未调用真实模型、未开审查实例、未推送；主工作区 .sitecraft-data 未写、主工作区 artifacts 只读。未跑全量、runner 回归或 build。tsconfig.json 的 Next 自动改动保留在工作树中，不纳入提交。
