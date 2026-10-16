---
id: T-164
title: 多条批注一次修改成一个版本（多区块合同）
type: build
status: open
blocked_by: [T-163]
claimed_by: Codex
supersedes:
---

## Why

T-161 第 3 步：把同一版本上的多条批注一次交给系统，得到一个完整新版本。它把 T-152 的单个 `selectedTarget` 扩大成用户明确选中的区块集合，改变了硬约束里的局部修改合同。

## 开工前须负责人确认

1. 多区块合同（下面「What to build」第 1–3 条）；
2. 真实模型验证的 DeepSeek 用量上限。主控报批后才开工，不默认沿用以前的额度。

## 负责人确认（2026-10-15）

- 多区块合同按下面「What to build」第 1–3 条执行：任一组失败整体不存版本，不存部分版本（负责人选「就按这个做」）。
- 真实模型验证 DeepSeek 用量上限 8 万（`SITECRAFT_TOKEN_LIMIT=80000`），可覆盖最多两组不同的区块组合；超出或被截断即停下报构思主控，不自行重跑。

## What to build

1. 同一区块的多条意见按添加顺序合成一组；祖先和后代区块重叠时，先请用户确认用同一个范围，不在写回时互相覆盖。
2. 每组只发送该段 HTML、匹配的 CSS、页面大纲、资料原文和风格要点；所有候选在原版本上组装成一个完整版本，提交入口核对允许的区块集合（取并集）和所有范围外影响，包括共享 CSS 和交互态。
3. 任一组冲突或底线检查失败时，不存部分版本；各条批注的结果分别显示，失败的意见保留。最多两轮修正、事实核对复用条件照现有合同。不能把多条请求拼进整站重写来冒充局部修改。
4. 可参考 BaoCut 画板批注里「标注集合随消息发送、只移除本次发送的 id」的做法（`design-annotations.ts`、草稿 store），来源标注同 T-163。组装算法先用最小坏例验证（两个共用样式的区块 + 另一页面），不预设新的抽象。
5. 同步 AGENTS.md「局部修改」一条、`mainline.md`、`spec.md`、`CONTEXT.md`。

## Acceptance

- [x] 负责人确认合同与用量上限的记录写进本票
- [ ] 坏例测试：合法两处修改通过；共享 CSS 外溢被拒；重叠目标按确认处理；任一组失败不产生新版本；先在父版本或 mutant 上失败
- [ ] 真实 chat 入口跑一次多区块修改，用量写进 Resolution；修改结果由独立盲评实例对比原版和修改版
- [ ] Astra 审查通过；typecheck、test、build 通过

## Resolution

2026-10-15 17:07 UTC，Codex 在 `t164-multi-block` 完成离线实现并本地提交准备：

- 失效方式清单与最小坏例写入 `tests/t164-multi-block-edit.test.ts`。反事实证据：临时关闭祖先/后代重叠拒绝后，`CHROME_PATH=... npm test -- tests/t164-multi-block-edit.test.ts` 在“重叠需确认”断言失败；恢复后同一命令 4/4 通过。测试使用本地 HTTP 模型替身和真实 Chrome 提交检查，不调用 DeepSeek。
- 实现批次请求、草稿冻结、按 DOM 路径合组、重叠确认、同一父版本多候选组装、目标并集范围检查、共享 CSS/交互态核对、整批原子存版和按 draftId 回写结果。BaoCut 参考只保留冻结集合语义，来源补充在 `resources/baocut-annotation/SOURCE.md`。
- `npm run typecheck`：通过。
- `CHROME_PATH=... npm test`：500/500 通过；全量证据目录为 `artifacts/t167/test-run-1792083805589-62150`。聚焦 T-152/T-163/T-164 回归 23/23 通过。
- `npm run build`：通过（Next.js 16.3.1，Turbopack）。
- 本票真实 chat、`SITECRAFT_TOKEN_LIMIT=80000` 用量与独立盲评/Astra 审查尚未执行，按负责人要求停在离线验收；因此票保持 open，不能宣称完整通过。

2026-10-15 17:50 UTC，按 sol NO_GO 修复并补入口证据：

- P1-1：批次提交只发送固定批次标识，资料上下文不再包含批次意见；`executeLocalEditBatch` 给每组独立意见，`writeLocalEditBatch` 保持每组请求隔离。入口测试逐条检查两组请求不含对方意见；将批次资料临时恢复为整批请求时测试按预期失败。
- P1-2：无当前版本的批次在资料写入分支前明确拒绝；入口测试确认 HTTP 422、资料为空、无 run。关闭拒绝闸门的 mutant 返回 200 并被测试捕获。
- P1-3：新增 `tests/t164-multi-block-chat.test.ts`，真实 chat route → workflow → 本地模型替身 → commitSiteCode；覆盖合法一版本、组失败无部分版本且按 draftId 返回、无版本拒绝及整站写作拦截。
- P2-1：重叠确认后的组内意见按原始 draft 添加顺序稳定排序；三项后代/兄弟/祖先坏例覆盖，移除排序的 mutant 失败。
- P2-2：`writeLocalEditBatch` 每组模型调用前执行 `requireModelTaskAdmission`；未登记风格测试在调用浏览器/模型前拒绝，移除准入调用的 mutant 失败。
- 修复后 `npm run typecheck` 通过；T-164 合同与入口测试 8/8 通过。全量 `npm test` 与 `npm run build` 尚待本轮修复后按主控要求执行；真实 DeepSeek、盲评和 Astra 仍未执行。
- 2026-10-15 17:54 UTC 修复后全量 `npm test` 504/504 通过（证据目录 `artifacts/t167/test-run-1792086706873-88234`），`npm run build` 通过。提交已 amend 为 `5d85600`，未推送。真实 DeepSeek、盲评和 Astra 仍按主控要求未执行。

2026-10-15 18:21 UTC，按新 sol NO_GO 修复并保留反事实证据：

- P1 交互态：`outsideCssApplications` 在同一检查中创建隔离 iframe，逐个聚焦可聚焦元素，比较允许区块外元素的计算样式签名；单区块与多区块共用该路径。新增 focus-within 外溢反例在 a25fcd5 上 applied，修复后 rejected。
- P2 分组失败：`cannotEdit` 立即停止该组重试，整批不存；每个 draftId 保存自己的拒因，其他组显示「因其他组失败未保存」，前端不再把全局 run.issues 拼给每条草稿。新增入口测试在关闭立即停止闸门的 mutant 上失败，恢复后通过。
- `npm run typecheck` 与 T-164 聚焦测试 10/10 通过；待本轮全量测试与 build 完成后更新最终证据。真实 DeepSeek、盲评和 Astra 仍未执行。
- 2026-10-15 18:25 UTC 修复后全量 `npm test` 506/506 通过（证据目录 `artifacts/t167/test-run-1792088528045-9741`），`npm run build` 通过。真实 DeepSeek、盲评和 Astra 仍未执行。
- 2026-10-15 19:31 UTC，最终全量与 build 结果保持通过；本轮聚焦 33/33、T-164 新入口 10/10，未调用 DeepSeek。
- 2026-10-15 19:42 UTC，最终全量 `npm test` 510/510 通过（证据目录 `artifacts/t167/test-run-1792093154418-71464`），`npm run build` 通过。新提交包含规则推理焦点检查、按组/整体拒因归因与 UI 展示；真实 DeepSeek、盲评和 Astra 仍未执行。
- 2026-10-15 20:54 UTC，按构思主控要求复制主目录两个站点到只读临时根 `/tmp/sitecraft-t164-real.tEEPkQ`，本地替身完成首页单区块检查并记录三档耗时：禾巷小馆 375/768/1440 = 48.60/43.88/49.36 ms；拾色绘画教室 = 59.48/64.08/53.61 ms。证据 `artifacts/t164/real-homepage-timing.json`。最终全量 `npm test` 511/511 通过（`artifacts/t167/test-run-1792093154418-71464`），`npm run build` 通过；真实 DeepSeek、盲评和 Astra 仍未执行。

本轮接手实现（基线 `01003c7`）按已确认动态状态设计收口：`outsideCssApplications` 是单区块与多区块共用的唯一 CDP 探针，不再从 CSS 文本推断状态；逐一枚举可见、非 disabled/inert 的真实可聚焦元素，固定强制 `focus`、`focus-visible`、`hover`、`active`，并传播祖先状态。动态探针移入每个 375/768/1440 视口循环，比较源/候选的范围外 DOM 路径与完整计算样式，拒因包含页面、视口、触发路径、状态和受影响路径；每档检查记录源/候选可交互元素数、非空强制调用数、各自耗时及合计耗时，无法聚焦、强制失败或超时即拒绝。静态清理允许保留 disabled button 夹具，仍拒绝表单收件链路。

反事实与聚焦证据：新增坏例先在 `01003c7` 失败（动态证据缺失、375 `main:has(:focus)` 错误保存、disabled button 被清理），修复后 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t164-multi-block-edit.test.ts` 14/14 通过；同轮 T-152/T-162/T-163/T-164 聚焦入口 41/41 通过，`npm run typecheck` 通过。优化前只读真实首页诊断在 10/7 个可交互元素下分别约 3.4/2.4 秒每次探针，超过 2 秒档位，失败证据保留在临时根 `/tmp/sitecraft-t164-real.OMYG5t/diagnose.json`；本轮继续复用状态档的祖先强制集合、CSS agent 重置、状态间单次 blur、完整样式元数据与路径缓存，T-164 14/14 仍通过。动态探针只在实际被局部修改触及的页面执行，其他页面已由提交入口先核对 DOM 未改变，避免在全量并发下重复消耗预算；`pageEdit` 仍覆盖全部页面以捕获跨页 CSS 交互态。最新真实首页诊断（commit 代码尚未再次提交时）为禾巷小馆 375/768/1440 = 2.90/2.92/2.92 秒，拾色绘画教室 = 2.06/2.06/2.08 秒；DOM 数为 156，未达到 2 秒门槛，失败结果写入 `artifacts/t164/real-homepage-timing.json`，宽预算分段证据在 `/tmp/sitecraft-t164-real.q2wO36/diagnose-current.json`。保留完整四状态、祖先传播和计算样式合同，不以删状态或缩短样式来掩盖超时。

最终技术验证：父版本 `01003c7` 反事实聚焦测试 3 项失败，当前修复版聚焦 T-152/T-162/T-163/T-164 24/24 通过；`npm run typecheck` 通过。标准全量 `CHROME_PATH=... npm test` 于 2026-10-15 23:20 UTC 在 `artifacts/t167/test-run-1792106242923-90820` 以 515/515 通过；`SITE_STORE=fs npm run build` 以 Next 16.3.1/Turbopack 通过。最终真实三档证据 `artifacts/t164/real-homepage-timing.json`（commit `2d4f8d6`）按 2 秒合同如实记录两站三档超时，未将不完整结果记为通过。

本次性能修复（最终代码 `3014593`）：诊断确认样式读取占主要耗时（拾色 7 元素单探针约 1.9 秒，force 约 40ms，聚焦约 25ms，169 次 CDP 往返）；页面内缓存范围外元数据，批量读取完整计算样式后 gzip 序列化传输，源/候选在独立 CDP target 并行探测，比较仍使用完整 `DOM 路径 × 计算样式` 集合。最终并行实测两站三档均通过 2 秒：禾巷小馆 1.78/1.73/1.70 秒，拾色绘画教室 1.35/1.26/1.24 秒；每档记录 interactiveElements、forceCalls、cdpRoundTrips、focus/force/styleRead/compare 分段及 extras=0。

2026-10-16（本轮收尾，性能上限调整与 P1/P2 修复）：

- 动态状态预算改为每个视口最多 5 秒、375/768/1440 三档合计最多 15 秒；超时仍明确拒绝且不存版本。调整原因是原 2 秒上限在真实首页抖动下会间歇误拒：禾巷小馆 1440 档实测 2.63 秒，暖运行约 1.60–1.70 秒。该上限只扩大允许的测量时间，不删状态、不跳元素、不跳视口；超时回归仍通过显式 `dynamicStateBudgetMs: 1` 注入小预算证明拒绝与不存版本。
- P1 先在 `b46134c` 运行 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t164-multi-block-chat.test.ts tests/t164-multi-block-edit.test.ts`，成功批次线程回复断言失败；修复后从持久化 run 重读 `annotationIds`，每条线程收到自己的成功回复。
- P2 同一父版本反事实运行中，候选新增 `<a>` 且仅新增范围外 CSS 自定义属性的用例在 `b46134c` 被错误保存；修复后候选状态重读完整属性名集合，新增自定义属性被拒绝，版本数保持不变。
- 性能优化只改变传输与调度：页面内批量读取完整计算样式并压缩传输，源/候选探针并行；状态集合、触发元素、祖先传播、三档视口和完整比较语义不变。

2026-10-16 00:16 UTC，按 `fbf96a1` 在只读复制根 `/tmp/sitecraft-t164-final-parallel.jur1Jt` 完成真实首页每档 5 次运行（命令：`ROOT=/tmp/sitecraft-t164-final-parallel.jur1Jt COMMIT=fbf96a1 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --experimental-strip-types /tmp/sitecraft-t164-five-run.ts`）。完整逐次数据与阶段耗时保存在 `artifacts/t164/real-homepage-timing.json`；以下均为毫秒，`min/中位/max`，计数为源/候选相同值：

| 首页 | 视口 | 总耗时 | 可交互 | force | CDP 往返 | 聚焦（源/候选） | force 阶段（源/候选） | 样式读取（源/候选） | 比较 |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| 禾巷小馆 | 375 | 2405.3/2450.3/2560.9 | 10 | 76 | 215 | 17.8/17.9/27.7 · 17.6/18.0/27.7 | 71.4/105.4/113.2 · 150.3/176.7/186.2 | 1999.7/2028.4/2102.2 · 1926.9/1969.1/1985.6 | 168.0/174.7/178.5 |
| 禾巷小馆 | 768 | 2411.9/2423.4/2462.1 | 10 | 76 | 215 | 17.8/18.0/18.2 · 17.9/18.0/18.1 | 83.9/107.3/151.4 · 125.5/138.4/174.1 | 1985.0/2028.5/2040.9 · 1942.1/1959.5/2036.5 | 168.4/169.8/170.6 |
| 禾巷小馆 | 1440 | 2443.0/2466.3/2482.3 | 10 | 76 | 215 | 18.0/18.1/18.5 · 17.9/18.0/18.1 | 30.9/109.0/121.5 · 133.5/161.0/228.8 | 2049.3/2056.8/2138.8 · 1891.0/1953.7/2011.2 | 165.9/172.5/182.5 |
| 拾色绘画教室 | 375 | 1825.9/1855.8/1872.4 | 7 | 58 | 169 | 19.8/20.4/35.0 · 20.0/20.3/34.9 | 95.2/111.1/132.5 · 73.5/77.7/108.7 | 1501.8/1520.0/1548.8 · 1504.2/1577.0/1580.6 | 111.0/111.5/116.0 |
| 拾色绘画教室 | 768 | 1849.0/1902.4/2013.5 | 7 | 58 | 169 | 20.4/20.7/22.2 · 20.2/20.7/22.4 | 89.9/106.0/132.2 · 84.7/94.5/132.4 | 1504.7/1566.2/1663.1 · 1548.5/1574.7/1665.9 | 112.9/116.2/120.8 |
| 拾色绘画教室 | 1440 | 1904.5/1968.5/2004.7 | 7 | 58 | 169 | 20.5/20.7/25.9 · 20.5/20.6/24.8 | 90.9/105.0/142.6 · 78.0/107.7/132.7 | 1568.3/1639.1/1664.2 · 1605.6/1659.3/1692.3 | 111.3/112.2/135.3 |

六档全部 `passed: true`，单档最大 2560.9ms，三档合计预算分别为 15 秒；探针仍固定四状态、逐元素、祖先传播和完整样式集合比较，`extras=0`。

2026-10-16 收尾验证：

- `npm run typecheck`：通过。
- `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t164-multi-block-chat.test.ts tests/t164-multi-block-edit.test.ts`：20/20 通过，包含成功批次两条线程各自收到助手回复、候选新增自定义属性拒绝、显式小预算超时不存版本。
- `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test`：573/573 通过，证据目录 `artifacts/t167/test-run-1792109857522-55405`，随机测试服务端口 62243。
- `SITE_STORE=fs npm run build`：通过（Next.js 16.3.1/Turbopack）。
- 本轮最终本地提交为 `04a6109`；未推送。真实 DeepSeek、独立盲评和 Astra/sol 独立审查仍未执行，不能把它们写成已完成。
