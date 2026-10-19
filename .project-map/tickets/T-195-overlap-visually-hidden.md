---
id: T-195
title: 重叠扫描把视觉隐藏的文字算作可见，修正两轮仍被拒
type: build
status: closed
blocked_by: []
claimed_by: codex-t195-review2-fix
supersedes:
---

## Why

T-190 新基线第一轮的 packaging/precision 两轮修正后仍被底线检查拒收，排查见 `artifacts/t190/r2-round1-failure-diagnosis.md` 第 2 节。

- **疑似原因**：重叠扫描（`scripts/visitor-layout-scan.js:160` 起）判断可见性时，没有排除 `clip: rect(0 0 0 0)` 这类视觉隐藏，把隐藏的表格 caption 当成可见文字算进了重叠。修正两轮拒因不变。
- **来源**：可见性逻辑来自 1b9ac7f（09-30）。
- **证据程度**：原扫描的矩形没有保存，目前只是高度疑似，还没有用浏览器独立证明。

## What to build

1. **复现**：用保存的候选在浏览器里重放扫描，不调用模型。确认被判重叠的元素是哪一个，以及它为什么被算作可见。没有复现，就如实写「未复现」，并找出真实拒因。
2. **在根因层修**：可见性判断按访客实际能看到的为准，排除常见的视觉隐藏写法：
   - clip 或 clip-path 为零区域；
   - 1px 尺寸加 overflow hidden；
   - opacity 为 0；
   - visibility hidden。
   屏幕阅读器可读、但视觉上隐藏的文字不参与重叠判断。同时要保证真正可见的重叠不被漏掉，不能用一刀切的排除来掩盖问题。
3. **影响面**：说明对比度、溢出等其他底线检查是否共用同一个可见性函数，共用的话一并核对。
4. **成对测试**：
   - 视觉隐藏的 caption：旧实现误判重叠，新实现通过；
   - 真实可见的重叠：仍然拒收；
   - 半隐藏的边界用例：例如 clip 非零但很小，要写明怎么判。

## Acceptance

- [x] 复现结论写进 Resolution
- [x] 成对测试先红后绿，真实重叠仍拒
- 合并后主线验证通过；独立 fast 审查通过——主线验证已通过（见 Resolution 末尾）；审查一项不打勾：复审 3 结论 NO_GO；4 项 P2 经 `git show db87731` 核实都是本票之前就存在的缺口，已转 T-196；本票改动范围内的两条排除规则经三轮复审未挑出问题。审查原文：`artifacts/t195/review1.txt`、`review2.txt`、`review3.txt`。

## Resolution

本地实现已完成；票保持 open，等待合并后主线验证及独立 fast 审查。本次按负责人要求不开审查实例、不调用真实模型、不跑全量、runner 回归或 build。

### 复现与根因

从只读 C7 记录的 `run.attempts[0]` 提取候选、模拟资料和图片元数据到 `tests/fixtures/t195-packaging-hidden-caption.json`；图片沿用仓库已有的 packaging 夹具。原记录和主工作区数据均未写入。

Tracer bullet：保存候选 → 生产 `renderSiteCode` → 真实 Chrome 的 `scanVisitorLayout` → 生产 `checkSiteCode`。后者使用 `legacyImport: true`，只验证确定性底线，不调用事实模型、不保存版本。测试 HTTP 服务仅提供生产静态检查页及已登记的本地图片，意外请求会使测试失败。

父版本 `db87731` 重放确认：home、sampling 三档均无重叠；products 的 375／768／1440 均为 6 对，提交检查仅返回三条 `products/<宽度> 文字重叠`。每档都是三个 caption（折叠彩盒、瓦楞运输盒、纸浆模塑内托规格参数）分别碰到各自首行 th 和 td。375 下首个 caption 的盒子为 1×1，`clip: rect(0px, 0px, 0px, 0px)`、`overflow:hidden`，但文字 Range 仍返回 120×18 的未裁切矩形。三个 caption 的 Range 宽分别为 120／135／150px；扫描器把未绘制文字与首行交叠的 3px 高区域计入了重叠。

原始配对、caption 盒子、Range 和计算样式见 `artifacts/t195/replay-1792417815177-8458/c7-scan.json`，原提交拒因见同目录 `c7-checks.json`。375／768／1440 的截图均已打开查看：caption 不可见，规格文字没有这些碰撞。诊断中的疑似误报已由本次浏览器重放证实。

### 修复及边界

只改扫描器的绘制范围判断，未修改生成站 HTML、CSS、修正器或提交准入规则。`paintBoundsFor` 在扫描器内部集中处理祖先状态和裁切范围，属于一个隐藏实现细节的 Deep modules 接口；Ubiquitous language 统一为“视觉隐藏”和“露出片段”。

- 排除零区域的有效 `clip:rect`、`clip-path:inset`、零半径 circle／ellipse、共线或退化 polygon，以及双轴裁切且实际盒子不超过 1×1 的常见视觉隐藏写法。opacity 0、visibility 隐藏、display none、未展开内容及祖先透明隐藏继续排除；后代显式恢复 visibility 时按后代实际状态判断。
- 非零矩形裁切按露出片段计算，沿用原本 x、y 均须大于 2px 的重叠容差。1px 宽的非零 clip 不算重叠，但仍测对比度；4px 宽的露出碰撞仍拒。0.25px×20px 的 overflow 裁切也保留对比度，避免 `clientWidth` 整数取整把它误当零区域。仅 1px 宽、没有 overflow 裁切的文字不能豁免。
- 绝对／固定定位后代的包含块在 overflow 祖先之外时，不把该祖先误当裁切边界。变换后的非零裁切保留测量；clip 坐标及零区域判定使用变换前的边框盒，不能拿缩放后的矩形把可见文字判为零。
- 非零的非矩形路径、无法解析的复杂形状、变换后的非零裁切不作精确多边形裁切，保守保留测量，可能继续报重叠；不因带有 clip-path 就豁免。滚动条区域同样保守保留。本票不声称覆盖所有 CSS 裁切形状。

重叠、对比度、元素溢出和正文行长共用上述绘制范围。对比度先确认文字 Range 仍有露出片段，元素溢出按裁切后的范围测量。文档级 `horizontalScroll` 独立读取实际 scrollWidth，保持不变：不可见元素若真的撑出页面滚动条，仍会报告。`readCodeQuality`（包括 T-160 过窄文字列、T-147 规格裁剪等反馈）有自己的可见性判断，未改动；其相关真实 Chrome 回归一并执行。

### 测试证据

统一命令（每次只传一个文件，Chrome 路径使用负责人指定版本）：

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t195-hidden-overlap.test.ts
npm run typecheck
```

- 期望来自访客实际可见性，夹具不保存预期扫描答案；没有哈希、字节或像素比对，没有固定等待。页面按加载事件、字体就绪与图片 decode 完成后扫描。
- 父版本红态：`artifacts/t195/parent-final-red.log`，7 项中 5 失败、2 通过；C7 隐藏误判、零区域、半隐藏、共用检查及小数边界失败；真实可见 caption 和定位／变换对照通过。早期红态及调试失败日志也全部保留。
- 修复绿态：`artifacts/t195/acceptance-green.log`，7 项全部通过。新增的变换及定位保护还在中间候选失败过，见 `edge-before-fix.log`、`scaled-inset-before-fix.log`，未把这些调试失败冒充父版本缺陷。
- C7 修复后九个页面／视口组合的 overlaps、overflow、contrastIssues 均为 0，确定性检查通过；让 caption 可见后，products 三档仍被拒收。结果及已打开查看的三档截图在 `artifacts/t195/replay-1792418336997-22433/`。
- grep 从直接扫描调用和 `checkSiteCode` 调用追到 T-089、T-128、T-133、T-138、T-145、T-147、T-148、T-151、T-160、T-166、T-169、T-170、T-178、T-187、T-191、T-192；19 个相关文件的 177 项用例逐个通过，最终清单及每文件日志保存在 `artifacts/t195/final-related/`。加上 T-195，共 20 个定向文件、184 项通过。
- 最终 typecheck 通过，日志：`artifacts/t195/typecheck-original-config.log`。Next 自动修改的 tsconfig 已恢复，不进入提交。

未执行项：合并后主线验证、独立 fast 审查。完成它们后才能勾选最后一项并关闭本票；本地确定性检查通过不代表模型事实核对或页面审美通过。

### 2026-10-19 独立审查修复：仅证明全隐藏，不估算部分可见区域

本节取代上文“非零矩形裁切按露出片段计算”的规则。独立结论为主工作区只读文件 `artifacts/t195/review1.txt`，目标为 `fa7070405584456bc262fb2d8519c20c144f3b24`，结论 NO_GO，两项 P2：独立 `scale` 和祖先变换未被识别，错误地把非零 inset 当成全隐藏；`overflow:clip` 忽略非零 `overflow-clip-margin`，包括 1×1 提前隐藏分支。两者都能让实际可见的重叠及低对比度通过生产检查。

主控在本轮明确更正方向：不继续枚举属性来计算部分可见区域。生产扫描删除 `paintBoundsFor`、裁切矩形求交和按变换后／变换前尺寸推算裁切面积的路径，不保留旧分支。`fullyHidden` 只回答是否有明确的全隐藏依据；否则 `measuredRect` 保留浏览器的完整文字 Range。**误拒优于漏判**，普通裁剪、嵌套裁剪、contain 或变换本身都不是排除理由。

接受的精确排除条件如下；状态沿祖先链检查，visibility 使用文字所属元素的最终计算值，以允许后代显式恢复 visible：

- 元素自身计算后的 visibility 非 visible；自身或任一祖先 display:none、content-visibility:hidden、opacity 恰为 0；未展开 details 中不属于首个 summary 的内容。script、style、template、noscript 内容继续不参与。`aria-hidden=true` 只表达无障碍语义，不再作为视觉隐藏依据。
- 生效于 absolute／fixed 元素的 `clip:rect(...)`：四个坐标中，某一对相向坐标都能解析为相同单位的数字，且 right≤left 或 bottom≤top。auto 或无法解析的坐标不参与该轴证明，不代入盒子尺寸。
- `clip-path:inset(...)`：1–4 个值都为百分比或零，按 CSS 四边展开后，任一轴的相向百分比之和≥100%；round 不改变该零面积结论。不据像素 inset 与元素宽高比较来排除。
- `clip-path:circle(...)` 半径为明确的零，或 ellipse 的任一半径为明确的零；polygon 至少三个可解析点，每轴的非零坐标单位一致，且全部共线或重合。不把混合单位或复杂路径推算成零面积。
- 1px 标准裁切写法：实际边框盒宽、高均≤1px，双轴 overflow 都为 hidden／clip，裁切确实约束该后代，且盒子为 block、inline-block、flow-root、flex、inline-flex、grid、inline-grid 或 table-caption；body／html 不用此捷径。若任一轴为 clip，还须 overflow-clip-margin 的计算值为 `0px` 或 `padding-box 0px`；其他参考盒、非零值或未知值均保留测量。hidden 不受该属性影响。自身及祖先不能有 transform、独立 scale／rotate／translate、perspective、contain 或非 1 的 zoom；存在这些情况就不用 1px 捷径。绝对／固定定位后代的包含块在裁切祖先之外时同样不能使用。

前述零面积证明和完全隐藏状态不依赖变换尺寸，因此在变换存在时仍可排除；其余不能证明的情况都保留完整 Range。重叠原有的 2px 容差、字体 em 盒、对比度阈值和文档 scrollWidth 检查未改。重叠、对比度、元素溢出与正文行长共同使用该保守规则；T-160 等质量反馈仍用自己的读取逻辑。

Tracer bullet 继续经过生产 renderSiteCode → 真实 Chrome 扫描 → 生产 checkSiteCode（legacyImport:true），不调用事实模型、不保存版本。Deep modules 的边界收敛为全隐藏布尔判断，删除部分裁切状态；Ubiquitous language 使用“确定全隐藏”和“保守保留测量”。

红绿证据与命令（时间均为 UTC）：

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- --browser-concurrency=1 tests/t195-hidden-overlap.test.ts
npm run typecheck
```

- **先红，HEAD fa70704**：生产代码尚未修改时运行新增及更新用例，2026-10-19 14:18:02–14:18:24，退出码 1，10 项中 5 失败、5 通过。日志 `artifacts/t195/review-fix/head-fa70704-red.log`，标准入口报告 `artifacts/t167/test-run-1792419479963-1421/report.json`，扫描与提交结果 `artifacts/t195/replay-1792419482374-1865/`。其中 P2 探针属于既有缺陷复现；小片段由“不重叠”改为“保守检出”的失败属于主控更正后的合同红态，二者不混称。
- **修后绿**：同一命令，2026-10-19 14:19:53–14:20:15，退出码 0，10／10 通过。日志 `artifacts/t195/review-fix/conservative-first-green.log`，标准入口报告 `artifacts/t167/test-run-1792419591768-24383/report.json`，扫描、提交结果及原图 `artifacts/t195/replay-1792419594064-24795/`。
- 原 scale:.5 + inset 探针及祖先变体修前在三档均 overlaps=0、contrastIssues=0、passed=true；视觉等价的 transform 对照三档各为 1／1 并拒收。修后这四种写法三档均为 1／1 并拒收。独立 rotate、translate 与对应 transform、自身及祖先的对照也逐项通过，并核对访客可见位置命中 probe。
- 原 20×20、margin=100px 探针及 1×1 变体，修前三档均被错误接受，修后三档各为 1／1 并拒收。margin=0 的 1×1 标准裁切对照仍为 0／0 并通过；20×20 的 margin=0 虽然实际文字已被浏览器裁掉，但不满足明确排除条件，按新合同保守拒收。这是有意保留的误拒，不冒称这些文字实际可见。
- C7 原 caption 确为 `position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)` 的标准写法；修后九个页面／视口组合 overlaps、overflow、contrastIssues 均为 0，生产确定性检查通过。取消隐藏的 caption 对照 products 三档各 6 对重叠并拒收。标准 sr-only、零面积裁切仍排除；非零部分裁切、变换后 1px 盒、祖先变换、contain、嵌套裁剪及定位逃逸对照均保留测量。
- 绿态 C7 的 375／768／1440 三张完整截图已打开核对；红绿两轮各 24 张探针截图通过 `artifacts/t195/review-fix/red-probe-contact-sheet.png`、`green-probe-contact-sheet.png` 逐项查看有效绘制区域，原图保留。未做哈希、字节或像素比对，没有固定等待；按加载事件、字体与图片 decode 完成后读取。
- typecheck 退出码 0，日志 `artifacts/t195/review-fix/typecheck.log`；保留会话开始前已有的 tsconfig.json 自动变更，不纳入提交。

上一轮清单中的 19 个相关文件于 2026-10-19 14:21:06–14:23:55 串行运行浏览器测试，177／177 通过，退出码 0；日志 `artifacts/t195/review-fix/related-19.log`，标准入口报告 `artifacts/t167/test-run-1792419664448-35932/report.json`。加上 T-195，本轮指定门控为 20 个定向文件、187 项全部通过。可复运行命令：

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- --browser-concurrency=1 \
  tests/t089-contrast-line-length.test.ts tests/t160-narrow-columns.test.ts \
  tests/t187-repair-fragments.test.ts tests/t187-repair-routing.test.ts \
  tests/t147-code-quality.test.ts tests/t148-system-backdrops.test.ts \
  tests/t138-repair-fragments.test.ts tests/t133-floor-checks.test.ts \
  tests/t128-code-boundary.test.ts tests/t145-legacy-import.test.ts \
  tests/t151-backdrop-merge.test.ts tests/t151-generated-fidelity.test.ts \
  tests/t166-check-origin.test.ts tests/t170-remove-inquiry.test.ts \
  tests/t169-production-contract.test.ts tests/t178-read-budget.test.ts \
  tests/t191-fact-label-boundary.test.ts tests/t191-display-transition.test.ts \
  tests/t192-check-transitions.test.ts
```

本轮未运行全量、runner 回归、build、真实评估或真实模型，未启动审查实例。本节只是本地修复证据，独立复审和合并后的主线验收仍未完成，票保持 open，最后一项不勾选。

### 2026-10-19 第二次复审修复：仅保留两条排除规则

依据只读复审 `/Users/luckye/Documents/Code/sitecraft-ai/artifacts/t195/review2.txt`，HEAD `d7433940defc6698347df1399417ae8d4629e485` 存在两项 P2：普通 inline／display:contents 上未生效的 content-visibility:hidden 被当成全隐藏；display:contents 上未生效的 opacity:0 也使后代退出检查。两者均让访客实际可见的重叠及单独低对比度被生产入口接受。原始输入只读提取到 `tests/fixtures/t195-review2-visible.json`，不含扫描答案，不执行原探针脚本，也不写主工作区 artifacts。

**负责人本轮再次收窄的合同取代前面所有排除条件。** 逐项复核后，`fullyHidden` 仅保留：

1. **文字所在元素自身的最终计算 visibility 不是 visible。** 继承所得的 hidden 同样成立；不检查祖先 visibility 来覆盖后代的 visible。inline、display:contents 祖先都遵守继承与单独覆盖规则，测试包含这两种祖先下恢复 visible 的对照。
2. **自身或祖先是有盒元素，且完整满足标准 sr-only 写法。** 只认 block、inline-block、flow-root、flex、inline-flex、grid、inline-grid、table-caption；普通 inline 与 display:contents 不走该排除。必须实际存在盒片段、每片宽高均不超过 1px、双轴 overflow 计算值均为 hidden／clip，并且有 `clip:rect(0 0 0 0)` 或 `clip-path:inset(50%)`。旧 clip 还要求 absolute／fixed，保证它实际适用；不把普通流里的无效 clip 声明当作证明。其他显示类型或无法完整满足这些条件时保守保留。display:none 祖先本身没有可用盒片段，不凭尺寸为零通过此条件；其文字没有 Range 时自然没有几何可扫描，不增加 display 快捷排除。

其余原条件逐项删除：opacity 恰为 0、content-visibility:hidden、display:none 状态捷径、未展开 details、script／style／template／noscript 标签名捷径；独立的零 clip、任意百分比轴向和为零的 inset、零 circle／ellipse、共线 polygon；仅 1×1 加双轴 overflow 的捷径。相应长度／形状解析、定位逃逸列表、变换与 contain 不确定性列表、overflow-clip-margin 特判一并删除，没有兼容分支。transform、独立 scale／rotate／translate、contain、嵌套裁切等本身均不提供排除依据。

取舍明确：除这两条规则外，即使浏览器实际上没有绘制，也保留完整文字 Range，允许误拒。原来 margin=0 的 1×1 overflow:clip 对照由于缺少 clip／clip-path，现在也拒收；有盒 opacity:0、正常 block 的 content-visibility:hidden、单独零裁剪均同样处理。这些是负责人新合同的预期，不冒称它们实际可见。没有恢复部分裁切求交、坐标推算或变换尺寸换算。字体 em 盒、2px 重叠容差、对比度阈值和独立的文档 scrollWidth 检查保持原样。

Tracer bullet 沿用生产 renderSiteCode → 真实 Chrome 扫描 → 生产 checkSiteCode（legacyImport:true），只验证确定性底线，不调用事实模型、不保存版本。Deep modules 仍是扫描器内部的全隐藏布尔判断；Ubiquitous language 统一为“完整 sr-only 排除”与“保守保留测量”。重叠、对比度、元素溢出和正文行长共用此规则，质量反馈自己的读取路径未改。

#### 红绿证据与 C7

时间均为 UTC，命令均从本工作树执行：

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- --browser-concurrency=1 tests/t195-hidden-overlap.test.ts
npm run typecheck
```

- **HEAD d743394 红态**：生产扫描器未改时，最终测试矩阵于 14:55:44.922–14:56:21.700 执行，13 项中 7 通过、6 失败，退出码 1。日志 `artifacts/t195/review2-fix/head-d743394-final-red.log`，标准入口报告 `artifacts/t167/test-run-1792421743649-23922/report.json`，原始扫描及生产检查结果 `artifacts/t195/replay-1792421745160-24312/`。其中复审 P2 是既有缺陷红态；opacity／其他裁剪不再排除的失败是负责人新合同的红态，二者分开判读。最初一次红态也完整保留在 `head-d743394-red.log`，没有覆盖失败结果。
- **修后同命令绿态**：14:56:35.329–14:57:19.107，13／13 通过，退出码 0。日志 `artifacts/t195/review2-fix/two-rules-first-green.log`，标准入口报告 `artifacts/t167/test-run-1792421794007-35377/report.json`，扫描及生产检查结果 `artifacts/t195/replay-1792421795570-35787/`。typecheck 退出码 0，日志 `artifacts/t195/review2-fix/typecheck.log`。
- 三份复审独立输入分别做 hidden／visible 或 opacity 0／1、碰撞／单独低对比度成对变体，共 12 组。三档均命中实际文字位置；碰撞组均有重叠和低对比度，单独组无重叠但仍有低对比度，生产入口全部拒收。另有完整 sr-only、缺失尺寸／overflow／零裁剪、单轴裁切、inline／contents 无效 sr-only、visibility 继承及覆盖的 16 组生产入口对照。
- 上轮 scale:.5 的自身／祖先与 transform 等价写法，以及 rotate、translate 共 12 组仍三档拒收重叠与低对比度；overflow-clip-margin=100px 的 20×20／1×1 仍拒收。margin=0 同样保守拒收，真实浏览器命中结果单独保留，没有用未命中推导排除。
- **C7 原夹具符合新规则**：`.visually-hidden` 为 absolute、1×1、overflow:hidden、clip:rect(0 0 0 0)，无需为它增加条件。原候选 home／products／sampling × 375／768／1440 的 overlaps、overflow、contrastIssues 全为 0，生产确定性检查通过。取消 caption 隐藏后 products 三档各 6 对重叠并拒收，其他页面仍为 0；`c7-checks.json`、`visible-caption-checks.json` 保存完整结果。
- 绿态 C7 三档完整截图均已打开核对。两轮红态及绿态各 33 张探针截图的实际绘制区域通过 `artifacts/t195/review2-fix/*.grid.png` 打开查看，原图保留；红态 C7 截图汇总在 `red-c7-grid.png`。截图仅用于查看绘制，不作哈希、字节或像素比对。测试依靠页面事件、字体就绪和图片 decode，不加固定等待。

#### 本轮相关门控与交付范围

上一轮 Resolution 的 19 个相关文件，加上复审实际使用的两个 T-191 回放文件，取并集共 21 个相关文件；14:57:32.880–15:00:44.776 串行执行，180／180 通过，退出码 0。日志 `artifacts/t195/review2-fix/related-union.log`，标准入口报告 `artifacts/t167/test-run-1792421851506-43287/report.json`。加上本轮 T-195 的 13 项，共 22 个定向文件、193 项通过。相关命令：

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- --browser-concurrency=1 \
  tests/t089-contrast-line-length.test.ts tests/t160-narrow-columns.test.ts \
  tests/t187-repair-fragments.test.ts tests/t187-repair-routing.test.ts \
  tests/t147-code-quality.test.ts tests/t148-system-backdrops.test.ts \
  tests/t138-repair-fragments.test.ts tests/t133-floor-checks.test.ts \
  tests/t128-code-boundary.test.ts tests/t145-legacy-import.test.ts \
  tests/t151-backdrop-merge.test.ts tests/t151-generated-fidelity.test.ts \
  tests/t166-check-origin.test.ts tests/t170-remove-inquiry.test.ts \
  tests/t169-production-contract.test.ts tests/t178-read-budget.test.ts \
  tests/t191-fact-label-boundary.test.ts tests/t191-display-transition.test.ts \
  tests/t192-check-transitions.test.ts tests/t191-replay-display-transition.test.ts \
  tests/t191-replay-fact-segments.test.ts
```

本地修复及上述门控 PASS。保留会话开始前已有的 tsconfig.json 自动改动，不纳入提交；没有修改生成站代码、主工作区数据或原审查 artifacts。未运行全量、runner 回归、build、真实模型或评估，没有启动审查实例，没有推送。独立复审及合并后主线验证尚未完成，本票仍 open，最后一项不勾选；本地 PASS 不代表整票验收或审美通过。

### 主控验收与关闭

执行主控，2026-10-19 EDT。共三轮独立审查，每轮都是新实例。

- 第 1 轮 NO_GO（`artifacts/t195/review1.txt`）：独立 `scale` 属性与 `overflow-clip-margin` 两处漏判。构思主控随后改定保守方向：只排除能确定整段不可见的文字。
- 第 2 轮 NO_GO（`review2.txt`）：在 inline 或 `display:contents` 上，`content-visibility:hidden` 不生效；`display:contents` 上的 `opacity:0` 也不会让后代透明。构思主控把可见性排除收窄为两条：元素自身的计算 visibility 不是 visible；以及生成盒子元素上的标准 sr-only 写法。
- 第 3 轮 NO_GO（`review3.txt`）：两条规则本身没有被挑出问题。4 项 P2——扫描前删除 aria-hidden、强制展开 details、跳过小于 1px 的元素、生成文字不进入扫描——经 `git show db87731` 核实都早于本票，已转 T-196。

分支 `t195-hidden-overlap`（`788f08b`）以 `--no-ff` 合并为 `e252623`。主线验证在合并后的 `e252623` 上运行（T-190 基线分支合并 `c12f8f8`，T-194 合并 `89dff07`，T-195 合并 `e252623`），2026-10-19 13:51:21–14:10:33 EDT，期间没有其他重活。runner、build、typecheck 均退出 0；全量非浏览器 146/146、浏览器 863/863，无失败、取消或跳过。见 `artifacts/t195/main-verify.out` 与 `artifacts/t195/main-verify/`。 工作树证据复制到 `artifacts/t195/worktree-evidence/` 与 `worktree-t167/`。
