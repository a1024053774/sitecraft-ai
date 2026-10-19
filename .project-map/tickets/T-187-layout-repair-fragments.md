---
id: T-187
title: 版面类修正发出的片段数超过回复上限，修正必然失败
type: build
status: open
blocked_by: []
claimed_by: codex-t187
supersedes:
---

## Why

T-183 第 1 轮 industrial/precision（2026-10-18，原文分析见 T-183 Resolution）：行业列表分隔符 `<span class=sep>/</span>` 用线条色 #b6c0c7，对比度 1.85，三档都不达标。

- **第 1 轮修正**：模型没有改这个颜色。
- **第 2 轮修正**：版面类拒因把整页叶子元素、页头页脚和 CSS 共 98 个片段一起发给模型。模型原样回填 98 条，但回复 schema 最多只收 80 条（`lib/code-site-repair.ts:14-16`），校验必然失败，报「模型未返回有效的局部修正」。

结果是一个只需改一处颜色的对比度问题，因为修正入口的片段数和上限对不上，最后没存下版本。这属于主流程问题（优先级 2）。

## What to build

1. **先查根因**：
   - 版面类拒因（对比度、溢出、重叠等）发给模型的片段是怎么选的；
   - 为什么对比度不足要发整页叶子元素；
   - 80 的上限从哪来；
   - 两者是否该由同一处决定。
   查清后写进 Resolution。
2. **在根因层修**：
   - 片段选择应以拒因实际涉及的元素和 CSS 声明为准；
   - 发出的片段数不能超过回复允许的条数，否则在发送前就明确拒收并说明原因，不能先发出去再必然失败。
   - 不放宽严格校验，不重试掩盖。
3. **装饰性元素**：修正提示要让模型能处理装饰性分隔符这类元素的对比度。如果分隔符这类非正文装饰本就不该按正文对比度判，按 T-089 的现行规则核实，写明结论，不擅自改检查标准。
4. **成对测试**：用这站保存的原文与站点代码做夹具，先在旧实现上复现必然失败，再验证修复后通过。
5. **真实探针**：在 industrial/precision 上跑一次，预算网关显式 `SITECRAFT_TOKEN_LIMIT=300000`，用新账本。

## Acceptance

- [x] 根因写进 Resolution，附原文定位
- [x] 成对测试先红后绿；真实探针结果如实记录
- [ ] typecheck、test、build 通过；独立 fast 审查通过

## Resolution

执行阶段 **PASS**：严格声明边界实现候选 `39ec3fa3357b4b394ca63bf74711aca5ff8f786c` 已完成红绿、50/50 定向、18/18 runner、883/883 全量、typecheck、build 和唯一真实探针，保存 v1。整票仍为 **INCOMPLETE**，只剩未授权的独立 fast 审查，票保持打开。第一步实现为 `85982a968bf65111baf5867f49fbcb9b2f710996`（父提交 `618cb587246ffadf31d1de8a8d76f3ed93f425f9`），后续测试合同提交为 `8ca265e2d319ddeea47e74551f1c123150319748`；各轮失败证据均保留。最终执行证据索引为 `artifacts/t187/step2-retry2/result.json`。执行者 codex-t187；时间均为纽约时间。

根因与原文定位：

- 原现场为主工作区 `artifacts/t183/round1-full/private/case-1/code-site.json` 的 `run.attempts[0..1]`、`run.repairFailure.response` 与 `run.modelCalls`；归因见主线 T-183 的「失败站原文归因」。两次尝试都有首页三档各三条 `/（1.85，需 4.5）`，第二次修正原文有 98 条 replacements，CSS 仍保留 `.sep{color:var(--line-2)}`。
- 父版本 `lib/code-site-repair.ts` 的 `layoutIssues` 只按页面判断；`layout && !node.childElementCount` 开放该页全部叶子元素，公共 header/footer 也满足页面条件，并额外开放完整 style。原注释是避免重复发送祖先子树，但没有把拒因定位到实际失败元素，所以一个分隔符颜色问题扩大到 98 个片段。
- `git show b8174f0:lib/code-site-repair.ts` 表明 80 条限制在引入局部修正时已写进回复 schema；项目中未见更详细的数量依据。发送端没有对应限制，与回复端脱节；这不是提高模型输出额度能解决的问题。现由同一个 `repairFragmentLimit` 同时约束片段发送与严格回复，超过 80 条在调用模型前说明实际数量并拒收，不放宽协议、不重试。
- T-089 的正文标准仍是普通文字 4.5:1、大字 3:1；现行 `visitor-layout-scan.js` 将没有其他语义角色的可见 span 归为 body，提交入口对非标题统一要求 4.5；也不通过 aria-hidden 隐藏候选文字。没有分隔符豁免。本票保留标准，在提示中允许调整装饰字符颜色或只移除装饰字符，业务内容与顺序保留。

实现：扫描与拒因同时记录实际失败元素的字段、路径、快照和相关作者 CSS 声明；修正只开放这些叶子元素及声明，容器保持只读，缺少定位或快照变化即拒收。CSS 以当前源码声明为单位，包含 background 简写，不发送浏览器展开的空值长属性；写回范围核验也使用同一声明单位。原文与两份站点代码夹具在 `tests/fixtures/t187-industrial-repair.json`；原图复用已有 industrial 图片夹具，生产 `saveSiteImage` 在本轮临时数据根登记原图及许可，`readSiteImage` 实际供图，仅在内存中重绑生产分配的图片编号。未改主工作区数据，未调用真实模型。

验证（2026-10-18 EDT）：

- 21:08，父实现执行 `CHROME_PATH=<AGENTS.md 中的路径> npm test -- tests/t187-repair-fragments.test.ts`：1/6 通过、5 项按预期失败；保存现场重现 98 个可写片段，81 条场景先发模型再被接收端拒收。日志 `artifacts/t187/red.log`。
- 21:10，第一次修复定向运行 50/51，通过原 T-138 与 T-173 修正范围用例；剩余失败为变量 background 简写被 CSSOM 展开成空值长属性。21:12 的专项断言重现该问题，日志 `green-attempt-1.log`、`red-shorthand.log`。仅回退写回核验的声明枚举时，合法 background 修改被误判越界；反事实在 `red-shorthand-writeback.log`，原实现已在 finally 恢复。同轮也暴露图片尚未登记的夹具准备缺漏，随后按负责人确认补齐生产登记，没有放宽检查。
- 21:14:57 开始，执行 `CHROME_PATH=<AGENTS.md 中的路径> npm test -- tests/t187-repair-fragments.test.ts tests/t138-repair-fragments.test.ts tests/t138-token-repair.test.ts tests/t173-repair-scope.test.ts`：**53/53 通过**。日志 `artifacts/t187/green-attempt-2.log`；入口证据目录 `artifacts/t167/test-run-1792372498310-25343/`。本轮保存现场只开放 5 个片段：三个失败分隔符、`.sep` 的 color 和 body 的 background。修正后经同一个提交入口存版，两页 × 三档的溢出、重叠及对比度均为 0；确定性导入明确标记 `legacy-unreviewed`，不冒充模型事实核对。80 条可发送并接收，81 条零模型请求；同文高对比度分隔符不获可写权限，溢出、重叠、快照失效及实际 background 简写写回均有对照。

### 第二步：固定候选门控失败后停止

负责人授权的顺序为 runner → 全量一轮 → typecheck → build → industrial/precision 唯一真实探针，任一步失败就停止且不重跑。本轮没有修改生产代码、测试、断言或上限；完整全量自然结束。Next 自动追加的 `.next-test/dev/dev/types/**/*.ts` 与 `.next/dev/dev/types/**/*.ts` include 在退出后精确撤回，不带入配置改动。

| 顺序与实际命令 | 起止时间（2026-10-18 EDT） | 结果与证据 |
| --- | --- | --- |
| `node --test --experimental-strip-types scripts/t167-runner-regressions.ts` | 21:17:36–21:17:55 | **PASS 18/18**，exit 0，无跳过；`artifacts/t187/step2/runner.log`、`runner-result.json`。 |
| `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test` | 21:18:37–21:31:57 | **失败，856/871 通过、15 失败**，exit 1，无跳过或取消；非浏览器 123/123，浏览器 733/748，并发 2。`artifacts/t187/step2/full.log`、`full-result.json`；原生统计在 `artifacts/t167/test-run-1792372718395-68055/report.json`。 |
| `npm run typecheck` | — | 未执行：前一步失败。 |
| `npm run build` | — | 未执行：前一步失败。 |
| industrial/precision 真实探针 | — | 未执行：前置门控失败。 |

全量身份已核对本工作树 cwd 与独立数据根 `/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-test-Tsade0`，原失败数据根与日志保留，没有读写主工作区 `.sitecraft-data`。本轮 T-187 的八项用例全部通过，但不能代替全量通过。

15 项失败归为两处未同步的测试合同：

- `tests/t138-dom-scope.test.ts:151`、`:159` 两项：旧替身仍把完整 `<style>…</style>` 作为第一个 CSS 片段的 `after`，新合同只接收指定声明值，所以两项都报「局部修正 CSS 修正不是有效的单个声明值」。合法旧用例因未存版失败；未闭合旧用例仍拒收且保留回复，但拒因不再是旧预期的「CSS 未闭合」。原文在 `artifacts/t138/dom-scope-19470e11-1506-4355-bb19-42e2577c2f66/valid-style.json` 与 `unclosed-css.json`；对应测试站 ID 分别为 `978a8bd6-68bd-4085-b1b2-4f9bdf119413`、`8acf2ee1-d474-41b9-91e4-ef34bc7e4d72`，均无版本。这些是替身测试站，不是真实探针。
- `tests/t159-task-admission.test.ts` 的 13 个 action 均在 prepare 阶段失败：`tests/fixtures/t159-commit-protocol.ts:32` 的 CDP 替身只返回旧扫描对象，没有新增 `repairs`；`lib/code-site-check.ts:630` 读取 `layout.repairs.length` 时抛 TypeError。示例进程原文在 `artifacts/t159/task-contract-quick-446ab524-3ca2-4993-b9c2-3e599c4dd160/prepare-process.json`。这是替身协议缺项；不能在产品加空数组 fallback 来掩盖。后续同步替身时还须保留 `manual-invalid` 的实际溢出诊断，不能统一返回无拒因。

真实探针记录：保存的 `materials.txt` 已只读核对，与原 `report.materials`、`code-site.materials` 逐字相同；原偏好为 precision、layout 5、density 6。单站回放及仅记录片段数量的应用侧观察脚本已准备在 gitignore 的 `artifacts/t187/step2/`，但没有启动。探针站点 ID、版本 ID 均未创建，真实模型调用及付费 token 用量为 **0**；新账本 `artifacts/t174/t187-repair-probe` 未创建，未加载真实密钥，真实网关与 dev 未启动。是否触发版面修正、实际发送几个片段、最后是否存版均为 **未测**，不能写成“未触发”或“通过”。没有重跑失败站，没有开启审查或盲评实例，不推送。

该轮证据索引为 `artifacts/t187/step2/result.json`。后续负责人已授权同步这两处测试合同，保留所有拒收与准入反例，再从定向检查开始重跑完整门控；本轮失败日志与数据根不覆盖。

### 测试合同同步与 style 路径边界

`8ca265e` 的合同同步仅改 `tests/t138-dom-scope.test.ts` 和 `tests/fixtures/t159-commit-protocol.ts`，不改产品代码、不加空数组 fallback、不放宽 80 条上限。T-138 的合法对照按选择器 `p` 与属性 `color` 选择可写声明，只返回 `#111`；对照仍须经原提交入口存版、两页三档通过且正文与其他页面保留。反例分别返回完整 `<style>p{color:#111}</style>`、原未闭合 `<style>p{color:#111</style>`、非法值 `not-a-color`、未闭合值 `rgb(17,17,17`，要求一轮即拒收、零版本并原样保存回复；该轮前三项通过，最后一项暴露未闭合值被存版，见下节，不降低其断言。

旧未闭合样式断言是 `/CSS.*未闭合/`，对应原整份 style 写回分支的拒因原文为「局部修正的 CSS 未闭合，本次未保存版本。」；新声明合同对完整／未闭合 style 元素和非法颜色值在 `CSS.supports(property, after)` 处拒绝，实际拒因原文为「局部修正CSS 修正不是有效的单个声明值，本次未保存版本。」。未闭合的 rgb 函数值却没有被该检查拒绝，不能概括成所有未闭合值已受保护。此前全量留下的新拒因与原回复仍在上节两个失败产物中，不把旧预期改写成旧运行事实。

**整份 style 片段没有完全移除。** `lib/code-site-repair.ts` 仍声明并接收 `kind=style`，提示也保留该种合同；`mentionedNumber(code.css)` 仍可在非结构化「资料没有的数字：N」拒因命中 CSS 数字时生成整份 style，并执行原完整元素与 CSS 闭合检查。T-187 只移除了版面拒因按页扩选整份 style 的路径，没有声称移除上述数字修正路径。当前变更不扩大到删除该历史路径。

结构化事实修正先用 `factRepairs` 提取对应的位置成员，再把这些成员已覆盖的 issues 从通用文字／数字匹配中排除；因此 T-173 的 CSS 文案成员仍走 `kind=css` 的指定 `content` 声明值，不走 `mentionedNumber` 的整份 style 路径。T-187 改用作者声明名进行范围外 CSS 快照比较，这一共享写回核验也用于事实 CSS 修正；对 `content` 这个实际长属性，声明单位与前后值保护保持不变，选择器、其他声明、DOM、同文其他行与既有影响范围核验仍须保留。对应已有用例为：

- `tests/t173-fact-members.test.ts` 的「根级伪元素按 CSS 声明修正，其他规则与伪元素声明不变」明确断言 `kind=css`／`property=content`、没有 style 片段，并实际改值后比较其余规则与 DOM；同文件的多规则及作用域无法归属反例仍要求模型请求为 0。
- `tests/t173-repair-scope.test.ts` 的 `css-one`、`css-both`、`css-mask-static`、`css-container-other` 正例仍实际改正 `content` 并存版；共享声明影响已通过段、另一页仅在 375／768／1440 生效、完整交互伪类与容器条件等反例仍在发送修正前拒绝。T-173 的事实成员归属、三档实际影响核验及交互条件规则未被本次测试同步改动。

上述 T-173 用例已在前一轮完整全量通过；新一轮仍由标准全量入口重跑，结果单独记录，不用旧证据替代新门控。

T-159 替身现在按同次 CDP 的 Emulation 宽度补齐 `repairs`：正常扫描返回空数组；`manual-invalid` 的真实溢出分支保留 `horizontalScroll=true`，并返回当前页面／宽度的「横向溢出」诊断及无法定位元素的明确原因，不统一伪造成通过。准入测试本身的全部断言与正反例不改。

### 同步后的定向门控：未闭合声明值被存版

2026-10-18 **21:34:48–21:35:26 EDT**，运行 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t138-dom-scope.test.ts tests/t159-task-admission.test.ts tests/t187-repair-fragments.test.ts`。结果 **40/41 通过，exit 1**，无跳过或取消。T-138 19/20、T-159 13/13、T-187 8/8；T-159 的 manual-invalid 与全部准入反例通过。日志 `artifacts/t187/step2-retry1/targeted.log`、时间记录 `targeted-result.json`，入口原生统计在 `artifacts/t167/test-run-1792373689512-96451/report.json`；旧失败全量日志不覆盖。

唯一失败为 `a CSS declaration rejects unclosed-css-value and records the unchanged response`：替身返回原文 `rgb(17,17,17`（缺右括号），但 `kind=css` 写回只用 `CSS.supports` 核实值，浏览器按 CSS 解析规则补足结尾后接受，实际 run 为 complete、版本通过并保存。这是产品边界缺陷，不是夹具缺漏。原始回复与结果在 `artifacts/t138/dom-scope-f84d1347-b4b9-4b1f-a9b7-a95f88dcc76f/unclosed-css-value.json`；测试站 ID `99c064d8-1194-4011-9446-4b68fb8545e4`，版本 ID `0a7a5034-ace5-46c2-8c9a-3d24f248b7e0`，均为本地模型替身测试证据。

按负责人“任何一步失败就停”要求，本轮不修产品代码，不换反例、不降低断言、不重跑，也未开始新的 runner／全量、typecheck、build 或真实探针。真实站点和版本仍未创建，真实模型调用及付费 token 为 0，新预算账本未创建。建议在指定 CSS 声明值进入 `CSS.supports` 之前核实引号、括号及转义边界，保留现有语义检查和严格拒收；这需要产品代码修改，交负责人确认后继续。

### 严格声明边界修复与红绿证据

负责人已确认声明值的严格合同：括号与引号必须闭合，值内禁止分号、花括号、注释起止符及反斜杠转义，不让浏览器补齐后算合法。`repairDom` 的 `kind=css` 在 `CSS.supports` 前执行 `closedDeclarationValue`，区分禁止字符、注释、转义、引号未闭合、括号未闭合／不成对并明确拒收，原文仍由 `CodeRepairError.response` 保留；不修补、不重试。合法 hex 与成对闭合 rgb 均实际修正后通过原提交入口。整份 style 的数字拒因路径及其原检查保持不变。

2026-10-18 **21:37:52–21:38:23 EDT**，改前运行 `CHROME_PATH=<AGENTS.md 的完整路径> npm test -- tests/t138-dom-scope.test.ts`，**18/29 通过、11 失败**。其中缺右括号的 rgb、带注释与反斜杠转义的值被旧实现接受存版；其余失败暴露新合同要求的明确边界拒因尚未实现，不能写成 11 个原本都会存版的缺陷。原普通非法值仍拒收，合法 hex/rgb 对照均通过。日志 `artifacts/t187/step2-retry2/boundary-red.log`，原生报告 `artifacts/t167/test-run-1792373872591-24124/report.json`。

**21:38:41–21:39:52 EDT**，改后运行 `CHROME_PATH=<AGENTS.md 的完整路径> npm test -- tests/t138-dom-scope.test.ts tests/t159-task-admission.test.ts tests/t187-repair-fragments.test.ts`，**50/50 通过**，无跳过或取消：T-138 29/29、T-159 13/13、T-187 8/8。新增反例仍检查零版本、仅一轮、明确拒因及完整原回复，不换坏值、不降低已有拒收断言。日志 `artifacts/t187/step2-retry2/targeted.log`，原生报告 `artifacts/t167/test-run-1792373922028-35599/report.json`；各命令完整路径与起止时间在同目录 `*-result.json`。本次源码与这些证据先冻结为本地提交，再按 runner → 全量一轮 → typecheck → build → 唯一真实探针顺序继续；旧轮日志全部保留。

### 第二步最终执行：全部门控与唯一真实探针

以下均在固定候选 `39ec3fa3357b4b394ca63bf74711aca5ff8f786c` 上串行、各一次运行；候选冻结时 `dirty=false`，见 `artifacts/t187/step2-retry2/candidate.json`。没有修改测试统计、并发、预算、断言或生产代码来绕过失败。T-173 的事实成员、CSS 声明修正与范围反例也在本轮全量重新通过。Next 自动生成的类型目录 include 精确撤回，工作树不带配置残留。

| 顺序与实际命令 | 起止时间（2026-10-18 EDT） | 结果与证据（相对 artifacts/t187/step2-retry2/） |
| --- | --- | --- |
| `node --test --experimental-strip-types scripts/t167-runner-regressions.ts` | 21:40:40–21:41:03 | **PASS 18/18**，无跳过，exit 0；`runner.log`、`runner-result.json`。 |
| `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test` | 21:41:14–21:56:51 | **PASS 883/883**，非浏览器 123、浏览器 760，并发 2，无跳过或取消，exit 0；`full.log`、`full-result.json`，原生统计 `artifacts/t167/test-run-1792374074635-54141/report.json`。 |
| `npm run typecheck` | 21:57:03–21:57:08 | **PASS**，exit 0；`typecheck.log`、`typecheck-result.json`。 |
| `npm run build` | 21:57:12–21:57:29 | **PASS**，exit 0；`build.log`、`build-result.json`。有一条 `lib/code-check-diagnostics.ts:8` 动态文件追踪范围过宽的警告，未在本票扩展处理。 |
| 下述单站真实回放命令 | 21:58:19–22:04:08 | **generated，exit 0**，只执行一次；`probe.log`、`probe-result.json`，完整站点与截图在 `probe-case/`。 |

真实探针原命令：

```sh
SITECRAFT_BASE=http://127.0.0.1:57660 SITECRAFT_BUDGET_BASE=http://127.0.0.1:57661 SITECRAFT_TOKEN_LIMIT=300000 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --experimental-strip-types artifacts/t187/step2-retry2/replay-case.ts /Users/luckye/Documents/Code/sitecraft-ai/artifacts/t183/round1-full/private/case-1 artifacts/t187/step2-retry2/probe-case
```

普通 dev 与预算网关启动命令分别为 `python3 artifacts/t187/step2-retry2/launch-process.py dev > artifacts/t187/step2-retry2/dev.log 2>&1`、`python3 artifacts/t187/step2-retry2/launch-process.py gateway > artifacts/t187/step2-retry2/gateway.log 2>&1`。应用进程清空继承环境，仅持 `local-budget-gateway` 占位凭据，模型地址只指向本地网关；实际 cwd、`development-file`、模型 `deepseek-flash` 与数据根 `artifacts/t187/step2-retry2/probe-data` 经 health 核对，见 `health.json` 与 `start-state.json`。工作树没有会被 dev 加载的 dotenv 文件。真实密钥只在网关进程以 `set -a; source /Users/luckye/Documents/Code/sitecraft-ai/.env.local; set +a` 载入，source 输出丢弃，随后运行原 `scripts/t153-real-budget.ts`；上游地址显式为 `https://api.deepseek.com`，`SITECRAFT_TOKEN_LIMIT=300000`，`T153_BUDGET_DIR=artifacts/t174/t187-repair-probe`。没有修改网关或把密钥交给应用、文件、日志或 prompt。

资料逐字沿用原现场 `materials.txt`，并分别与原 `report.materials`、`code-site.materials` 比较相同；同一份原图和原许可字段经生产上传入口重新登记。偏好完全相同：precision、layout 5、density 6。回放经生产 create／upload／chat select／confirm／draft 与唯一提交入口，不直接调用模型、不直接写站点存储。新站 ID **`1adeea0c-7fde-4de5-bba1-14a3fb0ee588`**，v1 ID **`4745bcc4-4ad6-4e08-83cf-00d4b63391ed`**。

**本次没有触发版面修正，版面发送片段数为 0；最终保存版本。** 两次候选的版面拒因均为 0。首轮有两处事实拒因：把“交期待协议确认后排产”扩大为“具体规格与全部交付条件均待确认”，以及把三个行业供货例项扩大成“各行业均可参见”。应用在同一次生成中做了一次事实修正，真实出站请求携带 **22 个 text 片段**、`layoutIssueCount=0`，没有重发整站；随后重核 2 段、沿用 38 段并通过，保存 v1。出站数量由只在应用进程运行的观察模块记录于 `repair-requests.ndjson`，只记数量、类型、时间与状态，不记请求正文、头或凭据。完整拒因、候选、事实原回复及核对映射均在 `probe-case/code-site.json`。本次真实探针没有覆盖“模型实际执行版面修正”的分支，不能把事实修正的 22 个片段冒充版面修正；版面路径的红绿证据仍来自保存现场的 98→5 成对 Chrome 用例。

唯一新账本 `artifacts/t174/t187-repair-probe/usage.json`：**136,939 / 300,000 token**，输入 **54,446**、输出 **82,493**，剩余 **163,061**；5 次调用全部 HTTP 200、用量已知、正常完成，应用记录与账本合计一致。逐次用量：规划 10,537，写站 49,264，首次事实核对 51,576，事实修正 9,297，事实重核 16,265。没有重置账本、再发一次探针或重跑失败站。

最终两页 × 375／768／1440 的溢出、重叠、对比度拒因均为 0，`checks.passed=true`；正文行长仍保留质量反馈，不当拒因。六张 `home-*`、`products-*` PNG 都在 Chrome 中载入并逐张打开看过，含正文和完整页脚，非空白或加载中截图；这只确认技术与载入证据，不宣布审美通过。

**22:05:22 EDT** 再经实际 draft 接口确认 plan run `cd74e17c-0f0d-4bef-a147-99ef88ef3419`、generate run `db64e9b1-3daa-48c0-a3d5-51b12c489828` 均为 complete，网关 5 次调用全部 complete、在途 0，见 `pre-stop-terminal.json`。随后手动 SIGINT 停网关 pid 69789（工具记录 exit 1）与 dev pid 69857（exit 0），**22:05:56** 确认两个端口均关闭，见 `shutdown.json`；账本 `stopped=false` 保留“未触发预算终止”的原义，不冒充进程仍在运行。数据只保留在本工作树的 artifacts，未复制进主工作区 `.sitecraft-data`；未发布、未推送、未开启审查或盲评实例。独立 fast 审查交主控安排，票不关闭。
