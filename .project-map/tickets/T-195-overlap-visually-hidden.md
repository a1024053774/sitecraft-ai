---
id: T-195
title: 重叠扫描把视觉隐藏的文字算作可见，修正两轮仍被拒
type: build
status: open
blocked_by: []
claimed_by: codex-t195
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
- [ ] 合并后主线验证通过；独立 fast 审查通过

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
