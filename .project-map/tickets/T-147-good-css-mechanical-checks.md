---
id: T-147
title: good-css 可机判条目做成提交入口的质量反馈检查
type: build
status: closed
blocked_by: []
claimed_by: Codex T-147
supersedes:
---

## Why

T-146：good-css 只写进规范文字没有效果（T-132）。改用提交入口的机械检查，让检查发现的问题进入现有的反馈与修正链路。

## What to build

从 T-132 调研（gitignore 的 `artifacts/research-good-css/report.md`，47 条提炼；good-css revision 6d16d2fd27f4892e2aea4b5c5c2b016f45be7eef）里挑出能由浏览器或 DOM 机器判断的条目，在 `lib/code-site-check.ts` 现有的视口检查里实现，第一版全部作为质量反馈，不触发修正轮。先做以下这些，判断不了的条目不做：

- 长规格、型号、参数值被截断（`text-overflow: ellipsis`、`-webkit-line-clamp`、固定高度加 `overflow: hidden` 把文字截掉）；
- `:hover` 样式没有包在 `@media (hover: hover) and (pointer: fine)` 里，导致触屏上出现粘住的悬停态；
- 375 下可点击元素的点击区小于 44×44（行内正文链接除外）；
- sticky 或 fixed 页头会挡住锚点目标（没有 `scroll-margin-top` 或 `scroll-padding-top`）；
- 带 `data-image-id` 的产品图用了 `object-fit: cover`，并且实际被裁掉了主体（只按图片用途 product 判断，现场图的有意裁切不算）。

检查结果写进版本检查与评估统计，格式和行长反馈一致。SOURCE 记录放 `skills/site-code-core/SOURCE.md`（没有就新建），写明来源、revision 和 MIT 全文，不复制原站示例代码。

## Acceptance

失效方式（实现前列出）：

- 截断：ellipsis 只有声明却未丢字时误报；多行 clamp 与祖先固定高度漏报；展开 details 后漏测；普通摘要被当成规格。按 table/dl 和声明的型号/参数字段测实际文字裁剪，不猜摘要语义。
- 悬停：嵌套 CSS 或分散在祖先 media 的能力门控漏读；逗号/OR/not 绕过门控；无匹配节点或空声明误报。
- 点击区：小导航/summary/系统控件漏报；正文内联链接误报；伪元素扩大命中区被忽略、外扩被裁剪仍算合格、邻接目标抢点。用真实 hit-test 校验连续 44×44 区域，只在 375 反馈。
- 锚点：只看 CSS 声明；sticky 尚未吸顶或文档尾部无法顶齐时误报；跨页锚点漏测；有偏移但仍被遮挡漏报。实际滚到标题、测页头遮挡，并恢复滚动位置。
- 产品图：把所有 cover 都当裁切；用途未声明或现场图误报；border/padding 被当图片内容区；图片没载入当裁切。只用已登记 product 用途与自然尺寸测原图裁切，DOM 不能断言主体被裁，反馈要求人工复核。
- 链路：反馈被放进 issues 后拒收/触发修正；版本或汇总丢字段；旧检查未运行却被当成零触发。测试通过真实提交入口存版及汇总，离线旧证据明确未测。

- [x] 每项检查先列出失效方式，再按清单写红绿测试：坏样例触发、好样例不触发，并在已知坏的实现上失败
- [x] 用评估集现有站点或已存版本离线跑检查（不调用 DeepSeek），统计每项触发率并人工抽查误报，写进 Resolution；触发率最高的两项附 1440/375 截图
- [x] Resolution 给出建议：哪些项值得升为底线（误报低、和盲评破绽对得上），由主控决定，本票不升级
- [x] Astra 审查通过；typecheck、test、build 通过；mainline 评估四层的描述同步

## Resolution

**PASS（执行交付）**。2026-10-10，Codex T-147。按派工保持 `status: open`，交 Claude 验收、关票和整合；不推送。本地交付为 `t147-goodcss-checks` 上包含本文的单一提交，可用 `git log -1 --format=%H -- .project-map/tickets/T-147-good-css-mechanical-checks.md` 定位。证据运行时基线为 `a598f42fde7bd033dfda1880f463d55195f1686d` 加本票已冻结改动；最终提交号见执行交付消息。

五项在原 `checkSiteCode` 视口扫描中运行，保存在 `viewports.qualityFeedback` 的数量与 `details`（种类、节点、文本、原因）里；不进 `issues`，不拒收、不触发修正轮。`summarize` 分别汇总触发站/轮/实例和已测站/轮，旧版本缺字段表示未测。规格限明确 table/dl/型号参数字段，details 展开后测 Range 裁剪；hover 用 inert DOM 副本的悬停祖先链和浏览器选择器语义，跳过不成立的 supports；375 点击区包含伪元素的真实命中抽样；锚点实际滚动测遮挡，含跨页目标；产品图只用已登记 product 用途和自然尺寸测 cover 原图裁切。**主体自动识别无法可靠机判，未实施；裁切反馈明确要求人工复核，不能宣称主体损坏。**

未改规划/写页 prompt、核心 SKILL 的规划部分、系统素材或底图。来源、固定 revision 与完整 MIT 许可在 `skills/site-code-core/SOURCE.md`，不复制上游示例。

### 当前证据与复现

以下命令在此 worktree 运行。浏览器命令均设置 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell`；完整测试与离线回放另设置 `SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:3157`，服务为 `SITE_STORE=fs npm run dev -- --port 3157`。

- 红态：`node --test --experimental-strip-types tests/t147-code-quality.test.ts`，04:24:14 UTC，基线缺实现导致 12/12 契约断言失败，见 `artifacts/t147/red-contract.log`。初始图片夹具路径错误留在 `red.log`，不计为红态证据。
- 审查反例红态：`node --test --test-name-pattern='hover:' --experimental-strip-types tests/t147-code-quality.test.ts`，04:34:05 UTC，否定 hover 和 inactive supports 两项失败，见 `red-review.log`；`--test-name-pattern='ancestor and descendant'`，04:36:45 UTC，祖先/后代混合状态失败，见 `red-mixed-hover.log`。均在对应修复前运行。
- 最终 `npm test`，04:37:45 UTC，**248/248 PASS**（含 14 个 T-147 契约测试），见 `test-candidate.log`；`npm run typecheck`，04:37:11 UTC，PASS，见 `typecheck-candidate.log`；`SITE_STORE=fs npm run build`，04:37:49 UTC，PASS，见 `build-candidate.log`。最初全测因默认连接其他 worktree 的端口失败，完整保留在 `test-full.log`，改用分配的 3157 重跑，没有改断言或换验收路径。
- 最终离线：`node --experimental-strip-types scripts/check-code-quality-offline.ts --manifest artifacts/t147/corpus.json --samples .sitecraft-data/t147-samples --out artifacts/t147/offline-candidate`，04:37:11–04:37:56 UTC。重新运行需使用新的 `--out` 路径，避免覆盖证据。`results.json`、`summary.json` 与 `screenshots.json` 均在该输出目录。
- 误报抽查：`node --experimental-strip-types artifacts/t147/audit-delivered.mjs`；观察结果为 `manual-audit-delivered-observations.json`。产品裁切图通过 `capture-delivered-crops.mjs` 从真实 HTTP 预览裁取，七张图与清单为 `delivered-product-crop-*.png` / `delivered-product-crop-screenshots.json`；原图来自同站本地上传副本，均打开查看，不以像素/字节/哈希比对作验收证据。
- 独立 Astra 最终 **PASS**：`artifacts/t147/astra/candidate/review.txt`，原始提交结果与实际鼠标计算样式在同目录。审核者的七个独立输入覆盖正/负 hover、祖先/后代混合、`:has` 关系、同元素矛盾、inactive supports、正确联合门控；均经真实提交入口存一个版本，零运行、零拒因。前两候选失败证据保留在 `astra/` 与 `astra/reviewed/`，未覆盖。

### 离线触发率与误报抽查

从主数据 `code-sites` **仅只读复制**到本 worktree `.sitecraft-data/t147-samples`，再按 `corpus.json` 选当前版本：13 个旧站转换演示站（排除 `t145-import-*` 测试夹具）与 8 个近期 DeepSeek 评估站（已有真实 write 调用记录）。共 **21 站、29 页、87 个视口**。评估图的 60 份上传回执与原文件从已有评估 artifacts 复制到本 worktree；未读写主数据 uploads，未修改主站数据或样本版本。运行不调用 DeepSeek、不写版本；21/21 确定性检查通过、零回放错误，事实模型校对本次未测。

| 项目 | 触发站 / 已测站 | 旧转换 / 13 | 近期评估 / 8 | 实例数（按页与宽度计） |
| --- | --- | --- | --- | --- |
| 规格文字截断 | 0/21（0%） | 0 | 0 | 0 |
| 悬停未门控 | 21/21（100%） | 13 | 8 | 1011 |
| 375 点击区偏小 | 21/21（100%） | 13 | 8 | 386 |
| 锚点标题被遮挡 | 0/21（0%） | 0 | 0 | 0 |
| product cover 原图裁切 | 3/21（14.3%） | 0 | 3 | 21 |

产品图另按有已登记 product 图片的 8 站计算为 3/8（37.5%）；旧转换无此类图片，不能把其零触发解释成证明图片裁切安全。正文行长的已有反馈为 6/21 站、67 实例，不是拒因。

最高两项均选近期评估站 `7e07b43d-5476-4db7-9d8e-d38d3d723b86` 的 home：`offline-candidate/ungatedHover-…-home-{1440,768,375}.png` 与 `smallTargets-…-home-{1440,768,375}.png`，六张全页图均逐张打开，正文、图片和页脚完整；截图可观察手机页头小导航，静态图本身不证明触屏悬停状态。全部本票产出的截图均已打开。

抽查涵盖 2 个旧转换站与 4 个评估站，每类取不同位置：12 个 hover 反馈的 CSS 均缺联合能力门控，机械误报 **0/12**，不声称实际触屏粘住已测；12 个点击区反馈的实际元素框均有一边不足 44、无伪元素扩大区域，机械误报 **0/12**。其中 4 个是系统图片署名 summary；全样本共 16 个此类反馈，责任在系统部件，不能让模型修正文案消除它们。

375 的全部 7 个产品裁切实例（同图跨页分别计）均确认原图裁切：两张减速机图主要裁车辆/背景，未见减速机主体丢失；纸箱和纸浆内托四例有边缘裁切，内托首页另有说明覆盖；瓦楞截面一例主体影响不确定。**几何成立 7/7 不等于主体损坏 7/7**，因此该项不能升硬门。真实样本未触发截断或锚点遮挡，无正例可抽查，误报率未知；其坏/好样例证据来自浏览器契约测试，不能写成真实站误报为零。

### 给主控的底线建议

**本票不升级；当前证据不支持立即把任一新项升硬门。** 优先候选是明确型号/参数的实际丢字，其次是实际被页头遮挡的锚点标题：结果直接伤害采购核对与导航，但本次真实样本零触发，须有真实问题与独立盲评对应后再决定。点击区可优先讨论导航/主要入口范围；须先处理系统 summary 的责任和高触发率，不能把所有小独立链接直接变成模型修正负担。hover 缺门控本次机械误报低，但缺实际触屏后果与盲评对应证据，继续反馈。产品图几何裁切有明显语义误报风险，只保留人工核对提示。

已有 T-132 独立盲评 `artifacts/blind-t132-2026-10-08/x-result.json`（主工作区研究 artifacts）强调参数值/单位完整和手机页头排版，同时明确未验证导航、滚动与交互。本票的截断/点击/锚点方向与这些关注相关，**不等于五项已与该轮具体破绽逐一对应**；没有新增审美盲评，也不宣布审美通过。mainline 的评估四层、spec、CONTEXT 和 AGENTS 的现行检查语义已同步；`project_map.py status` 为 Problems 0、Stale living docs 0。

## 合并验收（Claude，2026-10-10）

合并为 7bceb3c。主控采纳建议：五项全部保持质量反馈，本票不升底线。另记：375 点击区偏小有 16 处来自系统图片署名 summary，属系统部件，后续另行处理，不交模型修。主工作区 `npm run typecheck` 退出 0；`SITECRAFT_BASE=http://127.0.0.1:3034 CHROME_PATH=<AGENTS 指定路径> npm test` 248/248；`SITE_STORE=fs npm run build` 退出 0，输出在 artifacts/merge-7bceb3c/。

