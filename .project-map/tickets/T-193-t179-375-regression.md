---
id: T-193
title: T-179 的 375 首次腾位用例在旧提交上也开始失败
type: build
status: open
blocked_by: []
claimed_by: codex-t193
supersedes:
---

## Why

2026-10-19 05:26–05:43 EDT，主线验证在 8602b37 上跑全量，`tests/t179-composer-scroll.test.ts` 的 375 档「首次腾位须避开目标」失败，768 与 1440 通过。执行主控单独复跑这个测试，375 档在四个提交上都失败：

- 当前主线；
- 80c6ae7；
- 合并前的 b7393fc；
- dc09cb2。

dc09cb2 在同日 02:26–02:51 的主线验证里是通过的，同一份代码现在失败，说明和环境或时间有关。

失败截图里预览区是空白，批注线程显示「来自旧版本，请重新点选」。日志在 `artifacts/t191/diag-t179-*.log`，现场在 `artifacts/t191/main-verify/`。

这个用例覆盖主流程（预览批注与对话框腾位），不能只当作测试不稳定处理。

## What to build

1. **查根因**：失败原因可能在下面几处，查清是哪一处，写进 Resolution，附日志定位。不改等待上限，不放宽断言。
   - 测试本身：夹具、时间相关数据、数据根、端口；
   - 产品：版本判定把当前版本当成旧版本，或者预览没有加载出来；
   - 环境：Chrome、负载、磁盘。
2. **产品缺陷**：根因在产品就修产品，补成对测试。
3. **测试缺陷**：根因在测试就按实际入口修测试，证明它仍能拦住 T-179 原本要拦的问题。
4. **环境问题**：根因在环境，就如实写明，并给出可复现的条件。

## Acceptance

- [x] 根因写进 Resolution，附现场定位
- [x] 修复后该用例三档通过，且能拦住 T-179 原问题（先红后绿）
- [ ] 合并后主线验证通过；独立 fast 审查通过

## Resolution

2026-10-19，执行者 codex-t193。父版本 `8602b377fca9e2a7a8a9a663f1b2d75124104600`；修复及下述本地门控对应候选 `ea3f28bf41f1588febc61f821e7df5a70e5cb2c5`。时间均为 UTC。本次目标是恢复批注定位后的目标避让，同时保留用户原生滚动；不改生成站、模型、等待上限或既有断言。

**REALITY GATE：PASS（修复方向）**。根因属于产品：手机意见面板缩小预览可见区后，目标高于可见区时仍按中心定位，没有约束底边。宿主滚动条占宽改变缩放，导航滚动条占高改变工具栏高度，暴露了已有缺陷。系统为何切换滚动条形态未查明；本次不修系统，也不把它归为只能靠环境处理的失败。

### 三类排查与现场对照

主工作区以下资料只读，根记为 `M=/Users/luckye/Documents/Code/sitecraft-ai`。

1. **测试、时间、数据根和端口**：新建站点经提交入口保存 v1、创建绑定 v1 的线程，再保存 v2，见 `tests/t179-composer-scroll.test.ts:13`。没有沿用夹具内的旧时间或版本编号；`capturedAt` 只是采集时间，线程定位和当前版判定不按日期。父版原用例在本树随机端口 `63655`、独立临时数据根仍稳定复现；health 虽为 503，但入口核对的 cwd 与 dataRoot 均一致，见 `artifacts/t167/test-run-1792403458681-53619/report.json:1`。没有访问主工作区 `.sitecraft-data`。
2. **预览载入与版本判定**：通过样本 `M/artifacts/t179/measurement-1792392482850-6194/initial-ready-375.json:37` 和失败样本 `M/artifacts/t179/measurement-1792403030857-35520/initial-ready-375.json:37` 都显示「来自旧版本」，其 `stage/frame` 都为零尺寸；截图均处于对话面板。375 的 `.builder-shell .mobile-hidden` 本就隐藏预览（`app/globals.css:443`），不是空文档。线程绑定 v1、当前为 v2，这条提示正确；产品按版本 ID 比较（`components/code-workspace.tsx:458`），不是误判日期。本次父版保留的数据核对见 `artifacts/t193/parent-version-identity.json:3`：当前 v2 为 `93019c8b…`、v1 为 `c37f5fc4…`。普通服务依次返回 v2→v1→v2 的预览 HTTP 200，见 `artifacts/t167/test-run-1792403458681-53619/dev.log:20`、`:22`、`:23`。重新点选时 iframe 为 complete、正文标题存在、URL 回到 v2，见 `artifacts/t179/measurement-1792403464175-54612/repicked-375.json:30`。
3. **首次腾位、环境与几何输入**：原主线日志 `M/artifacts/t191/main-verify/test.log:1831` 的断言栈落在原测试第 202 行，即回到当前版后的重新点选，不能把断言名「首次腾位」误认成第一次打开线程。所对照失败样本的 `expanded-375.json` 面板顶为 742、目标底为 735.4665，没有相交；实际失败在 `repicked-375.json`。通过样本 `M/artifacts/t179/measurement-1792392482850-6194/repicked-375.json:11`、`:18` 为面板顶 675、目标底 673.124；失败样本 `M/artifacts/t179/measurement-1792403030857-35520/repicked-375.json:11`、`:18` 为 675、675.4665，相交 0.4665px。两者 iframe 内部滚动均为 2271，但宿主预览区高度为 418／433，顶边为 249／234。Chrome 路径及版本固定为用户指定的 154.0.8037.92；本次没有 Chrome 退出、磁盘写失败或等待超时，开跑读到磁盘剩余约 5.2GiB、load 5.49。没有证据把确定的几何差异归因于负载；不调整超时。

### 决定方向的受控实验

在父版产品不变时，新增两个 375 用例，仅用 CSS 改工作台 `.code-preview-stage` 和 `.site-page-nav` 的滚动条占宽／占高，不改 iframe 内容、目标高度或生成站版本。两侧都执行完整真实旅程，实际滚动条尺寸须与实验输入相符。预期仍来自原需求：目标与面板不相交、真实滚轮按 deltaY 移动、没有腾位回推，展开和重新点选能重新腾位；不以测得坐标作为答案。

| 父版输入 | iframe 缩放／渲染宽 | 导航占高／预览区高度 | 重新点选目标底／面板顶 | 结果 |
| --- | --- | --- | --- | --- |
| 宿主滚动条 0px | 0.872／327px | 36／433px | 675.4665／675 | 避让断言失败，逐项复现今天失败样本 |
| 宿主滚动条 15px | 0.832／312px | 51／418px | 673.124／675 | 通过，逐项复现早先通过样本 |

证据为 `artifacts/t179/measurement-1792403650723-84036/repicked-375-scrollbar-{0,15}.json`，面板／目标在第 11／18 行，缩放在第 47 行，实际视口在第 60 行。日志 `artifacts/t193/isolated-scrollbar-parent-red.log:21`、`:27`、`:29`：原生 375 与固定 0px 均失败，768、1440、15px 均通过。JSON、截图均已对照。初次尝试把滚动条样式施加到整个工作台，连意见面板高度也变化，且错误要求无水平溢出的预览区占高 15px，不能隔离变量；该次输出完整保留在 `artifacts/t193/scrollbar-parent-red.log`，不作为上述结论的证据。最终实验只覆盖两个滚动容器，并核对导航的实际水平滚动条占高。

### 修复与反例

`components/code-preview-selection.tsx:164` 保留原入口：短目标继续居中，目标过高时按预览实际 `clientHeight` 约束底边。用户主动滚动后的保护、重新点选与展开的恢复机制都不变；不增加版本、不改站点 HTML/CSS，没有重试或后备入口。`AGENTS.md` 登记这组机械拦截。

修后固定 0px 的目标底为 667.4665、面板顶仍为 675，见 `artifacts/t179/measurement-1792403749183-2520/repicked-375-scrollbar-0.json:11`、`:18`；两种滚动条、原三档共 5/5 通过。另仅临时移除桌面腾位的 `!userScrolled.current` 条件，重现 T-179 原始故障：768 上滚应停在 1901，实际被推到 1942；1440 应为 1647，实际 1686，均被原生位移断言拒绝，见 `artifacts/t193/original-regression-mutant.log:44`、`:62`。反例退出 1 是预期红灯，不作为门控通过；脚本在 finally 中按原字节恢复，`git diff --exit-code -- components/code-preview-selection.tsx` 确认恢复后才进入其余门控。复现脚本与候选／反例源码保存在 `artifacts/t193/check-original-regression.py`、`candidate-code-preview-selection.tsx`、`mutant-code-preview-selection.tsx`；`original-regression-mutant.json` 记录候选提交、时间和恢复结果。

### 本地门控与移交

所有浏览器命令均只额外设置：

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell
```

以下命令逐项串行，经标准入口自建独立服务和数据根；没有并行运行其他浏览器文件。候选为上文 `ea3f28b`，后续只补票内证据，不改运行代码。

| 命令 | UTC 时间 | 结果与证据 |
| --- | --- | --- |
| `npm test -- tests/t179-composer-scroll.test.ts`，父版原三档加观测 | 09:50:58–09:51:53 | 2/3，375 预期红；`artifacts/t193/parent-red.log` |
| 同命令，父版加限定滚动条对照 | 09:54:07–09:55:03 | 3/5，原生 375 与 0px 预期红；`artifacts/t193/isolated-scrollbar-parent-red.log` |
| 同命令，修复候选 | 09:55:46–09:57:00 | 5/5；`artifacts/t193/t179-green.log`、`artifacts/t167/test-run-1792403746471-1986/report.json` |
| `python3 artifacts/t193/check-original-regression.py`，内部仍用上述定向命令 | 09:57:10–09:58:09 | 反例被拒，768／1440 红；已恢复，见上述反例日志 |
| `npm run typecheck` | 09:58:15–09:58:23 | 退出 0；`artifacts/t193/typecheck.log` |
| `npm test -- tests/t162-mobile-reveal.test.ts` | 09:58:23–09:59:04 | 3/3；`artifacts/t193/t162-mobile.log`、`artifacts/t167/test-run-1792403904395-16291/report.json` |
| `npm test -- tests/t162-scroll-edge.test.ts` | 09:59:04–09:59:28 | 3/3；`artifacts/t193/t162-edge.log`、`artifacts/t167/test-run-1792403945389-20700/report.json` |
| `npm test -- tests/t175-thread-placement.test.ts` | 09:59:28–10:00:04 | 3/3；`artifacts/t193/t175-placement.log`、`artifacts/t167/test-run-1792403969020-23961/report.json` |

**本地门控 PASS**：typecheck 退出 0，四份定向测试合计 14/14，无跳过或取消。typecheck 与 t162-mobile、t162-edge、t175-placement 三份测试的精确命令、提交、起止时间及退出码见 `artifacts/t193/local-gates.json`；T-179 用例的 5/5 运行见上文第 87 行所引 `t179-green.log` 与 `test-run-1792403746471-1986/report.json`。T-179 修后 40 张截图已通过 10 张带原文件名的联系表逐图查看，索引 `artifacts/t193/t179-screenshot-index.json`；T-162／T-175 的 21 张通过 6 张联系表逐图查看，索引 `artifacts/t193/related-screenshot-index.json`。三档批注与定位证据均有实际正文和可操作面板；定位前对话态和 scroll-edge 主动把目标滚出视野后的空白只作对应交互的证据，不冒充生成站质量验收。没有审美通过结论。

本次未读 `.env.local`、未调用真实模型、未开审查实例、未运行全量／runner／build、未推送；未使用 rm 命令，主工作区 artifacts 只读、`.sitecraft-data` 未写。Next 自动修改的 `tsconfig.json` 留在工作树且不提交。project-map 状态检查为 Problems 0、Stale living docs 0。**整票 INCOMPLETE**：独立审查与合并后主线验证由主控执行，最后一项验收仍未勾选，票保持 open；不能把本地门控通过写成整票关闭。

**独立审查（主控记录，2026-10-19 EDT）。** 新实例独立审查 PASS/GO，见主工作区 `artifacts/t193/review1.txt`：P0–P2 均无；P3 一项是本节证据索引没有覆盖 T-179 运行，已在上一段更正。
