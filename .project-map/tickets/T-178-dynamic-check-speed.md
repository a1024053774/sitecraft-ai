---
id: T-178
title: 加快局部修改动态状态检查（不改检查语义）
type: build
status: open
blocked_by: []
claimed_by: Codex
supersedes:
---

## Why

T-175（2026-10-17）在禾巷小馆 v2 首页（10 个可交互元素）实测：动态状态检查空闲时每档已用 2.6–3.6 秒，占每档 5 秒上限的 50–70%，主要耗时在完整计算样式读取。检查在服务端提交入口的 Chrome 里运行，服务端负载升高时正常批注会被判超时拒收，直接伤到主流程「修改」。构思主控决定先优化速度，上限暂不调。

## 构思主控决定（2026-10-17）

T-175 先暂停，这张票提前做，用新的 sol 实例执行。依据是 T-175 的实测结果（证据在 t175 工作树的票 Resolution 与 `artifacts/t175/`）：
- 测试文件并发降到 1、同一轮没有其他测试 Chrome 重叠时，禾巷小馆首页样式读取空闲约 2.7 秒，负载下约 4.6 秒，第二轮 375 档在 5.02 秒超时；
- 并发 2、4、6 也都有失败。
所以光限制测试并发不能稳定通过，要在检查本身提速。验收另加一条有负载的要求，见下方 Acceptance。

## What to build

1. 先按段测出耗时分布（强制状态、样式读取、比较、视口切换），结果写进 Resolution。
2. 只做不改语义的优化：例如每个「元素×状态」在页面内一次批量读取全部范围外元素与已生成伪元素的完整计算样式，减少 CDP 往返；复用同一视口下的布局。比较对象仍是完整计算样式，不缩减属性集合、不跳元素、不删状态、不减视口。
3. 目标：禾巷小馆首页空闲时每档 ≤1.5 秒，并记录每档 5 次分布；5 秒/15 秒上限与超时拒收不变。

## Acceptance

- [ ] T-164/T-173 的动态检查坏例（:has(:focus)、兄弟组合器、祖先 hover/active、伪元素、自定义属性、媒体查询）全部仍被拒，正常对照仍通过；优化前后对同一组输入结论逐项一致
- [x] 耗时分布与目标对比写进 Resolution；不调用 DeepSeek
- [ ] 有负载时（同时跑一轮全量），禾巷小馆三档都稳定低于 5 秒，并记录分布
- [ ] typecheck、test、build 通过；独立 sol 审查通过

## Resolution

状态：**INCOMPLETE**。本次先完成负责人要求的计时口径核对。完整读取的耗时已有未截断分布，试验候选未达到每档 1.5 秒，也不能宣称稳定提速；不据此下「完整读取无法达到 1.5 秒」的结论。试验生产改动已恢复，差异保留在 `artifacts/t178/unaccepted-candidate.patch`，当前生产检查与父版本相同，5 秒／15 秒及超时拒收均未改。本票保持 open、claimed_by 为 Codex。全量、负载轮、build 和独立审查均未完成，重任务未运行。

### 计时口径核对

- 对照来源为 T-175 的 `serial-stability/1/result.json` 与同轮 `artifacts/t175/run-1792247932307-30697/state-1440.json`。当前目录未找到该成功轮原始 `checks/`，但保存的版本仍有两侧分段指标；不把其他轮诊断冒充本轮。源 v2 为 `91191b41-483b-4ed8-adba-4d956fad032f`，候选 v3 为 `4ca32c17-5104-4215-abb1-6b0c0f9e290e`。逐字段核对后，v2 的 header、footer、css、pages 与本票夹具相同；v3 也已作为只读计时夹具保存。两版 CSS 相同，首页 HTML 不同。
- `499c1cf` 与本票父版本 `c4a72e5` 的 `code-site-check.ts`、`code-site-local-edit.ts`、`code-site-browser.ts` 无行为差异；`code-site.ts` 仅相差 T-175 的版本类型字段。存储提交的直接调用使用 `current.code` 与候选，锚点为 home 的 `[5]`，本次按该同一范围重放。
- 现计时脚本直接调用生产 `checkSiteCode`，不手写动态检查流程。`legacyImport: true` 只用于跳过模型事实核对，不存版本；动态分支、清理、范围与样式比较仍由生产函数执行。资料使用夹具原文及原批注，不调用 DeepSeek，不读 `.env.local`，不写主工作区数据。
- 每轮只创建源、候选各一个独立 Chrome，两侧按生产函数并行各跑一次；同轮复用三档，下一轮重新冷启动两只 Chrome。源 Chrome 的初始启动不在动态时钟内，首个 375 档包含候选 Chrome 的启动，均与生产定义相同。并非每档重新启动。
- 视口为 375／768／1440，height=1000、deviceScaleFactor=1、mobile=false。当前每侧有 162 个 DOM 元素、10 个可聚焦元素；每档四态、76 次强制状态。父版本每侧每档 215 次 CDP 往返，试验候选 216 次（额外安装一次读取函数）。每侧每轮实际观察到 123 次样式快照，即三档各 41 次；全部 30 个探针均 completed=true。
- 源检查页为本地 HTTP 提供的仓库 `public/code-check.html`，由生产入口核验 HTTP 200、HTML 类型、固定标记及无脚本。计时没有重放工作台 UI，也不包含模型或存储；T-175 原轮另有工作台浏览器。此边界区别保留，不能写成完整工作台性能复现。
- 仅计时脚本的 `--uncapped` 向现有内部参数传入 `Number.POSITIVE_INFINITY`。无固定等待、无 5 秒裁切；动态总时长包含分类、两侧完整探针、首次候选启动和最终比较。两侧并行，分段不能直接相加。视口 CDP 调用单列，首次候选设定已部分计入动态时钟。
- 早先手写驱动把 v2 同时作为两侧输入、跨五轮复用浏览器，最初还未从检查页建立源文档；其约 5 秒结果多数是截止拒收。原始 `before-idle/`、`before-profiled/`、`candidate-one/`、`candidate-two/`、`candidate-three/`、`before-origin/`、`after-idle/` 全部保留，仅作过程诊断，不作为完整耗时、稳定提速或性能上限证据。

### 未截断分布

2026-10-17 UTC，父版本从 15:37:43 开始五轮，候选从 15:40:47 开始五轮。单位秒，按实际执行顺序列出全部五次，不删除慢样本。两版均完成 15／15 档、30／30 探针，完整比较无范围外变化。

| 宽度 | T-175 原轮同一场景 | 当前父版本五次 | 试验候选五次 |
| --- | ---: | --- | --- |
| 375 | 2.767 | 5.905 / 5.826 / 5.864 / 5.981 / 6.008 | 5.725 / 6.054 / 5.112 / 5.801 / 4.828 |
| 768 | 2.694 | 5.533 / 5.632 / 5.542 / 5.564 / 5.971 | 6.896 / 4.888 / 5.126 / 4.943 / 4.715 |
| 1440 | 2.632 | 5.588 / 5.474 / 5.674 / 5.899 / 5.782 | 6.530 / 5.017 / 5.668 / 5.901 / 4.683 |

每档 1.5 秒目标均未满足。旧轮 2.6–2.9 秒与当前父版本完整分布的差异仍未定位，不能用负载均值解释，也不能据当前数值断言完整读取达不到目标。15:43:01 又经标准 `npm test` 进程做一组父版本对照，三档完整耗时为 5.803／5.311／5.194 秒，仍未复现旧轮速度；一组对照不作为五次分布。只读检查未发现低电量模式或已记录的温控警告，未修改系统设置；这也不足以排除运行环境影响。

分段中位数如下，单位毫秒；强制状态与完整样式读取按「源／候选」列出，比较为两侧结束后的实际比较，视口设定取生产 CDP 诊断中首页对应调用。`before-production-uncapped/timings.json` 早期的 viewportMs 还合计了后续页面，表中已用原始调用按首页顺序独立重算；原文件不覆盖。汇总为 `artifacts/t178/production-timing-summary.json`。

| 实现／宽度 | 强制状态 | 完整样式读取 | 比较 | 视口设定 |
| --- | --- | --- | ---: | ---: |
| 父版 375 | 63.3 / 49.2 | 5372.1 / 5395.2 | 35.7 | 4 |
| 父版 768 | 62.3 / 56.8 | 5326.5 / 5358.4 | 37.5 | 11 |
| 父版 1440 | 51.3 / 91.0 | 5453.0 / 5484.4 | 39.6 | 8 |
| 候选 375 | 76.9 / 83.9 | 5068.0 / 5111.4 | 38.9 | 4 |
| 候选 768 | 82.2 / 110.0 | 4775.5 / 4615.5 | 36.8 | 10 |
| 候选 1440 | 117.8 / 65.0 | 5412.7 / 5009.4 | 37.7 | 9 |

完整属性取值仍占主要时间。原始诊断保留 read／serialize／compress／decode，不能把压缩与传输优化当成已经解决属性读取；候选的波动也不能只选较快样本说明有效。

### 等价性与验证

- 父版本 85／85，试验候选 86／86：`t164-dynamic-gate`、`t164-multi-block-edit`、`t164-review-seven`、`t173-repair-scope`；包含 :has(:focus)、兄弟、祖先 hover/active、五类伪元素、自定义属性、媒体条件及正常对照。`scripts/t178-capture-checks.ts` 仅记录真实检查返回值，131 次检查的结论和拒因逐项一致，仅将随机站点／版本编号归一；无哈希、字节或像素比对。记录及复算脚本为 `artifacts/t178/equivalence-comparison.json`、`compare-conclusions.py`。
- 新增完整属性用例先在父版本 1／1 通过，确认测的是既有真实行为；它在强制状态仍生效时，用浏览器原生逐属性 getPropertyValue 核对元素及五类伪元素，包含同数量自定义属性换名、伪元素出现。对候选故意少读一项标准属性时，以「完整属性集合或值不一致」失败，恢复后 1／1 通过；不是先删属性再降低断言。日志为 `parent-full-style.log`、`mutant-full-style.log`、`final-full-style.log`。生产实现恢复后另跑同一用例，结果记在 `checkpoint-full-style.log`。
- `npm run typecheck` 已通过，测量脚本更新后的检查为 `artifacts/t178/typecheck-measurement.log`。全量、负载轮、build 未运行；没有独立审查，也没有审美通过声明。当前只同步 spec 的完整属性等价性证据，AGENTS 规则未变。

复现命令（CHROME_PATH 均为负责人指定的完整路径）：

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --experimental-strip-types scripts/t178-dynamic-timing.ts idle artifacts/t178/<本轮目录> --uncapped
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- scripts/t178-timing-entry.test.ts
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- --import ./scripts/t178-capture-checks.ts tests/t164-dynamic-gate.test.ts tests/t164-multi-block-edit.test.ts tests/t164-review-seven.test.ts tests/t173-repair-scope.test.ts tests/t178-full-style-equivalence.test.ts
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t178-full-style-equivalence.test.ts
npm run typecheck
python3 artifacts/t178/compare-conclusions.py
```

父版本测量对应 `c4a72e5`；候选测量对应未提交的试验差异 `unaccepted-candidate.patch`，该差异不在当前生产实现中。当前本地提交只保存本核对检查点及可复现夹具／工具／用例，不代表完成 T-178；提交后回执的 SHA、命令、时间保存到 `artifacts/t178/checkpoint-verification.json`。
