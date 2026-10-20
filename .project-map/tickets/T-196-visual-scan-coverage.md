---
id: T-196
title: 视觉扫描与访客实际看到的不一致：aria/details 预处理、微小元素、生成文字
type: build
status: open
blocked_by: []
claimed_by: codex-t196e
supersedes:
---

## Why

T-195 第三次窄复审（`artifacts/t195/review3.txt`）在 375、768、1440 三档实测复现了 4 项漏检，并用原样渲染做了对照。执行主控用 `git show db87731` 核过，4 项在 T-195 之前就存在。它们会让真实的重叠、溢出或低对比度通过底线检查：

1. **aria-hidden 被统一删掉**：扫描前删除所有 aria-hidden（`lib/code-site-check.ts:300`、`:623`）。作者 CSS 若用这个属性控制显示，检查看到的就是另一种样式状态。
2. **details 被强制展开**：扫描前把所有 details 强制展开（`:299`、`:623`）。只在关闭状态下可见、展开后隐藏的 summary 完全不检查。
3. **微小元素被跳过**：宽或高小于 1px 的元素直接跳过（`scripts/visitor-layout-scan.js` 原第 183 行）。其中的文字仍按正常字号绘制，越界时溢出检查漏掉。
4. **生成文字不进扫描**：CSS 生成文字（::before/::after）不进入重叠和对比度扫描，扫描只遍历真实的 Text 节点。

## What to build

1. **先复现**：用复审给的探针，经生产入口 `checkSiteCode` 在三档逐项复现，写进 Resolution。
2. **逐项在根因层修**：检查看到的应当是访客实际看到的状态。
   - **预处理**：说明为什么要删 aria-hidden、展开 details（原用途，例如检查折叠内容）。原用途需要保留的，改为在访客默认状态和展开状态下各扫一次，而不是只扫改写后的状态。
   - **微小元素**：不按盒子尺寸跳过，按实际绘制的文字判断。
   - **生成文字**：纳入对比度与重叠检查，定位与反馈沿用 T-173 对 CSS 生成文字的位置规则。若定位做不到，就明确拒收并说明原因。
3. **不能放宽**：不放宽现有检查。T-195 定下的两条排除规则保持不变。
4. **成对测试**：每项一个先红后绿的用例；并保证现有主线站点不会因此大面积误拒，抽 T-190 新基线的 14 站离线重检（`scripts/check-code-quality-offline.ts`），结果写进 Resolution。

## Acceptance

- [x] 4 项逐一复现结论写进 Resolution
- [x] 成对测试先红后绿；T-190 的 14 站离线重检结果如实记录
- [ ] 合并后主线验证通过；独立审查通过

## Resolution

本地实现、成对回归及 14 站离线对照完成；最终 29 文件 303／303 定向测试通过。票保持 open；合并后主线验证与独立审查未执行，不能据此宣布整票或页面审美通过。

### 四项复现

输入仅从主工作区只读 `artifacts/t195/review3-probes/*.json` 提取 `code`，保存在 `tests/fixtures/t196-review3-inputs.json`，不带预期扫描答案。经生产 `checkSiteCode`（`legacyImport:true`，不调用事实模型、不存版本）逐项复现。父版本为 `4708f86`；三档均为 375／768／1440。

| 缺口 | 原探针 | 父版本实际结果 | 修复后结果 |
| --- | --- | --- | --- |
| aria 属性改变 CSS 状态 | aria-visibility、aria-display | 两个输入三档均被接受，重叠／低对比度均为 0 | 三档均检出原样可见碰撞和低对比度并拒收 |
| details 只扫展开态 | details-summary-isolated、details-summary-visibility | 两个输入三档均被接受，关闭时 summary 的问题漏掉 | 默认态拒因保留；展开内容继续检查 |
| 微小／零盒文字越界 | overflow-tiny、overflow-zero | 三档均接受，溢出为 0；文字左缘实际为 -10px | 两组三档均以横向溢出拒收 |
| CSS 生成文字漏测 | pseudo-visible、pseudo-visibility-restored | 三档均接受，重叠／低对比度为 0；恢复 visible 的伪元素确实绘制 | 三档均测得重叠及低对比度；保存 T-173 位置并明确拒绝不安全修正 |

aria-control、正常尺寸负向溢出及正向溢出另作对照；每组只消除碰撞、低对比度或越界后必须通过，不以“一律拒绝”作修复。期望来自原样访客状态、文字范围和复审原输入，没有用实现输出生成答案。

父版本红态：`artifacts/t196/parent-red.log`，4 项全部失败；标准入口证据 `artifacts/t167/test-run-1792433736207-61427/`，逐项结果及原样截图 `artifacts/t196/probes-1792433745583-63025/`。首轮修复同一四组用例 4／4 通过，见 `first-green.log` 和 `probes-1792433897317-89216/`。两轮各 33 张三档原图保留，完整页面与实际绘制区域的汇总图已打开核对；没有哈希、字节或像素比对。

### 根因与最终实现

`git log -S`／`git blame` 定位到 `9e0042b`：两项预处理从 T-128 首次底线扫描起存在；该提交没有单独解释删除 aria 的注释。`66a3054` 在质量读取器中明确注明“剩余完整性检查展开隐藏 disclosure 内容”，并把原样正文列宽检查放在展开之前。T-192 的既有成对测试还明确要求去 aria 后按最终颜色检查，因此该揭示态合同必须保留。

- 质量读取器在完成后恢复它改动的 open、aria 属性。底线扫描先读保留作者属性的访客默认态；存在关闭的 details 时，再读保留 aria 的展开态；有 `aria-hidden="true"` 时，额外保留原有去 aria 的揭示态完整性检查。各态拒因与文字记录合并去重，不用后一个状态覆盖前一个状态；每次状态改变后沿用 T-192 的停用效果方法，保留作者过渡／动画声明，不靠固定等待读取旧值。
- T-195 的两条排除规则保持不变：文字自身最终 visibility 非 visible；或有盒元素满足完整标准 sr-only 写法。没有恢复 opacity、content-visibility 或部分裁切的快捷排除。微小盒不再按 1px 尺寸跳过，Text Range 同时参与水平边界检查；原 1px 越界容差、2px 重叠容差、字体 em 盒、对比度阈值与独立 scrollWidth 检查未放宽。
- `readGeneratedLayout` 从同次 Chrome DOMSnapshot 取得 ::before／::after／::marker 的实际文字行，不插入模拟 DOM、不拿宿主盒冒充文字范围。扫描使用伪元素自身的 visibility、颜色、字号和背景，生成文字同样参与重叠、对比度及水平越界。快照／位置／文字行无法可靠读取即明确拒收；独立扫描未提供生成文字布局时，非空生成 content 留下无法测量记录。
- 生成文字失败位置使用 T-173 的 `pageId/width/path/pseudo`，path 从 documentElement 开始，写入 `layoutRepairs.generatedPositions`。现有版面修正器不能核实伪元素声明的完整影响范围，故保留明确 reason 并拒绝自动修正，不开放宿主或整页，不猜 CSS 声明。安全生成文字仍可通过，不是遇到伪元素就一律拒收。
- 英文原文与译文读取相同的默认、展开及揭示状态，避免只在默认态出现的相同 CSS 数值被误报新增。相同已存 CSS 的正例和改变单位的负例保留在第四组成对测试中。

Tracer bullet：复审输入 → 生产清理／renderSiteCode → 真实 Chrome 原样绘制及布局 → 生产 checkSiteCode 三档拒因。Deep modules：生成文字模块隐藏快照索引与 DOM 路径映射，只给扫描器实际文字行。Ubiquitous language 统一为“默认态／展开态／揭示态”和“生成文字位置”。

### 回归证据与命令

统一环境：本工作树，Chrome 使用负责人指定的 154 headless shell；所有浏览器任务串行。标准入口运行命令：

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- --browser-concurrency=1 tests/t196-visual-coverage.test.ts
npm run typecheck
```

- 首轮相关 27 文件完整跑完，267 项中 265 通过、T-192 去 aria 的两项失败；`related-first.log` 及 `artifacts/t167/test-run-1792433990352-97740/` 完整保留。根因是删掉了原有揭示态检查，已经补回；没有改测试期望。
- 英文集成探针的初次夹具用了未清理 CSS，附带 CSS 不一致拒因，见 `translation-integration-red.log`，不把该附带失败冒充有效回归。改为已通过提交检查的原文后，`translation-normalized-red.log` 仅剩默认态相同 CSS 数值被误报的三档拒因；补齐原文状态读取后，T-151／T-192／T-196 共 22 项通过，见 `integration-green.log`。这些是集成中发现并修复的问题，不冒称父版本的新缺陷。
- 最终相关文件由直接扫描／checkSiteCode／layout repair 调用及测试夹具依赖检索取并集，含 T-089、T-128、T-133、T-138、T-145、T-147、T-148、T-151、T-154、T-159、T-160、T-166、T-169、T-170、T-173、T-178、T-187、T-191、T-192、T-194、T-195、T-196，共 29 文件。完整显式列表与可复跑命令在 `artifacts/t196/related-files.json`、`run-related.py`；该脚本仅执行标准 `npm test -- --browser-concurrency=1 <显式文件>`，不替代入口或存储身份核验。最终于 2026-10-19 18:31:59–18:41:08 UTC 完整执行，303／303 通过，失败／取消／跳过均为 0，退出 0。证据见 `related-final.log`、`related-final-command.json` 和 `/Users/luckye/Documents/Code/sitecraft-ai-t196/artifacts/t167/test-run-1792434720323-79738/`；最终四组原样截图位于 `artifacts/t196/probes-1792435249872-29871/`，33 张完整页面及实际绘制区域均已通过汇总图打开核对。

最终 `npm run typecheck` 在恢复开工时 tsconfig 配置后通过，退出 0；日志 `artifacts/t196/typecheck-final.log`。确认时间：2026-10-19T22:54:46.915645+00:00。

### T-190 的 14 站离线对照

从主工作区 `.sitecraft-data/code-sites/` 只读选择站名含“（新资料 T-190）”的全部 14 站，复制这些记录及相应图片到本工作树 `artifacts/t196/offline-data/`。manifest 固定原 currentVersionId；没有写回主工作区数据或 artifacts。

首两次检查均完成 14 站／129 个页面视口组合，底线拒因均为 0，但其后截图因站名筛选备注不在访客页中而失败。保留 `offline-before/`、`offline-after/` 及日志，不把这两次脚本退出当成功。只在复制记录的 name 中去掉该备注，code、资料、图片、版本不变，然后重新完整运行原离线脚本；没有删掉截图断言或更换站点。

`artifacts/t196/offline.mjs` 仅提供同源静态检查页、本地图片和生产静态渲染的预览，并调用原 `scripts/check-code-quality-offline.ts --manifest artifacts/t196/manifest.json --samples <本工作树副本>/code-sites --out <新目录>`。父版本回放时由 `parent-offline.py` 串行、临时装入 `4708f86` 的检查器／扫描器／版面定位器，原编辑保存在进程内并在 finally 恢复；不建第二份源码证据。

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell python3 artifacts/t196/parent-offline.py
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --experimental-strip-types artifacts/t196/offline.mjs artifacts/t196/offline-final
```

父版本完整回放：2026-10-19 18:30:44–18:31:15 UTC，退出 0；最终候选：18:31:20 开始，退出 0。两边各 14／14 通过、129 个页面视口组合、0 个回放错误、0 条底线拒因。没有大面积新拒因；逐站拒因集合均从空集保持为空集。完整版本 ID 在 `manifest.json`，结果在 `offline-before-complete/results.json`、`offline-final/results.json`，逐站差异在 `offline-comparison.json`。两边各 6 张 1440／768／375 的完整截图均通过汇总图打开核对，原图保留。悬停、点击区等非阻断质量反馈仍如实保留，技术通过不代表审美通过。

| 站点（原站名均带新资料备注） | siteId 前八位 | 视口组合数 | 父版拒因 → 本候选拒因 |
| --- | --- | --- | --- |
| 青禾纸包装 | 02058cac | 9 | 0 → 0 |
| 禾巷小馆 | 2c11a272 | 9 | 0 → 0 |
| 外高桥流体接头 | 3938dc82 | 9 | 0 → 0 |
| 忻州重载减速机 | 50f563f6 | 6 | 0 → 0 |
| 折页设计工作室 | 519b44cd | 9 | 0 → 0 |
| 外高桥流体接头 | 61601e66 | 9 | 0 → 0 |
| 拾色绘画教室 | 641e5b8b | 9 | 0 → 0 |
| 禾巷小馆 | 961cd7a2 | 9 | 0 → 0 |
| 拾色绘画教室 | a44ba7c8 | 9 | 0 → 0 |
| 拾色绘画教室 | aa40ead3 | 9 | 0 → 0 |
| 宁海精密注塑模具 | aaf4ff61 | 12 | 0 → 0 |
| 宁海精密注塑模具 | bd77156a | 12 | 0 → 0 |
| 禾巷小馆 | cb04f202 | 9 | 0 → 0 |
| 拾色绘画教室 | ce92cb36 | 9 | 0 → 0 |

### 交付边界

基线 `4708f86a764fcbe34686849e760c9a6bdfe27a58`；上述候选结果来自本票提交前的工作树，离线元数据明确记 dirty=true，最终代码与本票合为一个本地提交。最终 SHA 随交付回报。

没有调用真实模型、运行真实评估、开审查实例或推送；没有跑全量、runner 回归、build、公网或实机。离线与受控服务只证明确定性边界，不充当真实模型事实校对或独立审查。tsconfig.json 的 Next 自动添加路径已恢复为开工时配置，不纳入提交。


### 2026-10-19 独立审查三项 P2 修复（codex-t196b）

审查输入为主工作区只读 `artifacts/t196/review1.txt`（目标 `7826057`，NO_GO）及 `review1-probes/`。仅复制九份探针的 `code` 到 `tests/fixtures/t196-review1-inputs.json`，不复制扫描答案。新增三组成对用例，仍经生产 `checkSiteCode` 三档检查；`legacyImport:true`，不调用模型、不存版本。期望来自访客的实色叠底、正常 DOM 文字及 T-195 的保守合同，没有哈希、字节或像素比对，也没有固定等待。

1. **宿主外叠底**：宿主背景不等于文字所在位置的背景。除背景实色与全部已知叠底相同、覆盖与否不改变颜色的情形外，只对完整覆盖实际文字行的背景盒叠加；完全不相交的背景层不参与（可能向画布铺底的 html／body 仍保守拒收）；部分覆盖、特殊形状、无法核实的伪元素背景盒或独立叠层明确标为无法测量。深底灰字原探针修后在 375／768／1440 均报告 1.94，反向浅底白字均为 1.00；移回宿主内及外部安全白字对照均通过。
2. **非空生成内容缺行**：每次扫描把非空 before／after／marker content 与快照位置核对，不把空列表视为完整性证明。缺条目与缺实际文字行均产生带 T-173 位置的拒因，测量原因进入提交检查反馈。content-visibility:hidden 不新增排除；visibility:hidden、完整 sr-only 与可测安全生成文字仍有通过对照。
3. **真实文字伪元素包装**：快照沿祖先查找真正的 before／after／marker 生成目标，first-letter／first-line 包装的真实 DOM 文字继续使用原 DOM 文字路径，安全页通过。生成内容的特殊分片无法核实时保守拒收，不用其余字符冒充完整测量。

T-195 最终两条排除规则未改：文字自身最终 visibility 非 visible；或有盒元素满足完整标准 sr-only 写法。`fullyHidden`、1px 越界容差、2px 重叠容差、字体 em 盒与对比度阈值均未放宽。Tracer bullet 仍为独立探针 → 生产静态渲染 → Chrome 布局 → 生产提交检查；Deep modules 保持快照模块的小接口，Ubiquitous language 沿用“生成文字位置”。

#### 本轮红绿证据

以下时间均为 UTC；命令从本工作树执行，Chrome 使用负责人指定的 154 headless shell，浏览器任务串行。

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- --browser-concurrency=1 tests/t196-visual-coverage.test.ts
npm run typecheck
```

- **HEAD 7826057 红态**：23:05:38.956–23:06:05.264，7 项中原四组通过、新三组失败，退出 1。两种宿主外低对比输入三档均漏检；缺快照行输入三档被接受；安全 first-letter 抛出误拒。日志 `artifacts/t196/review1-fix/head-7826057-red.log`；标准入口 `artifacts/t167/test-run-1792451135323-9408/`；原样输出与截图 `artifacts/t196/probes-1792451139659-9958/`。
- **首次修改结果如实保留**：23:06:27.106–23:06:52.948，6／7 通过，缺行已拒收但反馈未带具体原因，未满足新增断言，退出 1；`first-green.log` 虽沿用工作文件名，其内容是失败，不作为通过证据。补齐反馈后同命令于 23:06:59.483–23:07:27.409 达到 7／7、退出 0，见 `second-green.log` 与 `artifacts/t167/test-run-1792451217538-19633/`。
- 该轮 51 张三档完整截图在 `artifacts/t196/probes-1792451220041-20058/`，全部通过 `artifacts/t196/review1-fix/green-{375,768,1440}-{0,1,2}.png` 的完整页面与文字区域汇总图打开核对。截图用于核实绘制状态，不替代提交检查或审美判断。

- **生成首字母组合的补充红绿**：首轮 29 文件于 23:07:48.933–23:16:12.419 完成，306／306、退出 0（`related.log`、`related-command.json`、`artifacts/t167/test-run-1792451266497-26587/`）。随后查看 Chrome 原始快照，确认生成首字母位于宿主下，与 before 并列；只检查祖先会遗漏这一个字符。用审查组合输入派生“首字母白字白底、其余黑字”的对照，实际截图已打开（`fragment-before-375.png`），当时候选错误接受，原快照及结果保存在 `fragment-snapshot.json`、`fragment-before-check.json`。新增断言在 23:16:31.502–23:16:55.962 得到 6／7、退出 1（`fragment-red.log`、`artifacts/t167/test-run-1792451789788-61294/`）。修后保留分片所属生成位置，但不把其余字符的文字行当作完整覆盖；扫描明确报告无法测量。无生成内容的安全 first-letter／first-line 仍通过。
- **追加相关对照发现并修正误拒**：检索 first-letter／first-line 的调用与夹具后，追加 T-164、T-178 两文件。12 文件于 23:17:15.099–23:21:03.707 得到 129／131、退出 1（`final-targeted.log`、`artifacts/t167/test-run-1792451832272-63097/`）；两项均是 T-164 原安全夹具的 before／after 自身白底被保守误拒，没有改动断言。修法是对任意相同实色证明覆盖与否不改变叠底，其余无法核实的情况仍拒收；不为样本颜色或测试名称设置例外。


#### 最终相关门控与 14 站重检

- 首轮 29 文件的 306 项通过后，末次仅收紧生成首字母分片并补足相同实色的覆盖证明；最终重跑受影响的 12 文件（含负责人指定的十个文件及 T-164、T-178 伪元素对照），2026-10-19T23:21:27.387Z–2026-10-19T23:25:11.644Z，**131／131 通过**，失败／取消／跳过均为 0，退出 0。日志 `artifacts/t196/review1-fix/final-targeted-green.log`，完整命令及时间 `final-targeted-command.json`，标准入口 `artifacts/t167/test-run-1792452085148-94035/`。最终命令如下；不是全量入口或独立 runner 回归。

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- --browser-concurrency=1 \
  tests/t196-visual-coverage.test.ts \
  tests/t195-hidden-overlap.test.ts \
  tests/t160-narrow-columns.test.ts \
  tests/t187-repair-fragments.test.ts \
  tests/t187-repair-routing.test.ts \
  tests/t191-display-transition.test.ts \
  tests/t191-fact-label-boundary.test.ts \
  tests/t192-check-transitions.test.ts \
  tests/t173-repair-scope.test.ts \
  tests/t089-contrast-line-length.test.ts \
  tests/t178-full-style-equivalence.test.ts \
  tests/t164-review-seven.test.ts
```

- 最终 `npm run typecheck` 退出 0，日志 `artifacts/t196/review1-fix/typecheck-complete.log`，日志完成时间 2026-10-19T23:22:19.853896+00:00。三项审查回归的原 HEAD 红态及所有中间失败均保留，未改成通过。
- 最终 T-196 的 54 张三档原图在 `artifacts/t196/probes-1792452282700-9005/`，通过 `review1-fix/final-{375,768,1440}-{0,1,2}.png` 九张完整页面与文字区域汇总图全部打开核对；首字母白字白底变体明确拒收，真实正文安全对照仍通过。
- 重检前再次只读核对主工作区站名含“（新资料 T-190）”的全部 14 站：固定版本与 `artifacts/t196/manifest.json` 对应，副本除站名去备注外与源记录一致。沿用本工作树 `offline-data/` 及原 `offline.mjs`，调用原 `scripts/check-code-quality-offline.ts`；未写主工作区数据或 artifacts。命令如下：

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --experimental-strip-types artifacts/t196/offline.mjs artifacts/t196/review1-fix/offline-final
```

- 离线确定性检查于 2026-10-19T23:25:15.329Z–2026-10-19T23:25:40.841Z 完成，进程退出 0：**14／14 通过、129 个页面视口组合、0 条底线拒因、0 个回放错误**。与先前 14 站结果按 siteId／versionId 与拒因逐项核对，无新增误拒；见 `review1-fix/offline-comparison.json`、`offline-final/results.json`、`offline-final/summary.json` 与 `offline.log`。原脚本保存的 6 张三档截图均已逐张打开，不是载入态、空白页或截断截图；非阻断质量反馈保留，不把技术通过写成审美通过。离线元数据为 7826057 加本轮未提交修复，测试后未再改生产代码；不冒称在最终提交 SHA 上重新跑过。

本轮授权内本地修复与门控 **PASS**。`claimed_by` 为 `codex-t196b`，票保持 open，最后一项继续不勾选，等待主控独立复审与合并后主线验收；本轮未开审查实例。未调用真实模型、未读 `.env.local`、未跑全量／runner／build、未推送或 force-push、未使用 rm；没有写主工作区 `.sitecraft-data` 或 artifacts。保留开工时已有的 tsconfig.json 自动改动，不纳入提交。本轮源码、测试、夹具与记录合为本地提交，SHA 随交付回报。

### 2026-10-20 第二轮独立复审三项 P2 修复（opencode-t196d）

复审输入为主工作区只读 `artifacts/t196/review2.txt`（目标 `375557c`，NO_GO）及 `review2-probes/`。三项 P2 都在原样访客状态复现：`::marker` 的 `content:normal` 被当作空内容；空宿主 `::after` 的首字母分片丢失；同宿主无字伪元素的背景叠层只在 url 背景时检查。另保留复审“额外边界”中的 first-line 继承问题，不把它冒称本轮新增 P2。方向沿用 T-195 的保守合同：Chrome 实际绘制了非空文字就必须进入检查；文字完整性、所属生成目标、实际叠底和绘制顺序任一无法确定时给出“无法测量”，不返回可能错误的比值。T-195 两条排除规则、1px／2px 容差与阈值均未改。

#### 修法

1. **原生 marker**：生成文字枚举不再跳过 `content:normal`；`display:list-item` 且 `listStyleType` 非空时按原生列表标记处理。已有快照文字不再用 computed content 二次过滤，非空实际文字一律保留，缺行仍按完整性拒收。原生编号与显式编号各有低对比拒收／安全通过成对用例，counter／attr 生成保留原对。
2. **first-letter 分片**：`readGeneratedLayout` 对 `::before` 和 `::after` 都沿祖先核对 first-letter 宿主；分片无法可靠归属或不能证明按自身样式测量时，对对应生成位置清空 rects 并明确拒收，不拿剩余字符冒充完整测量。真实 DOM 的 first-letter／first-line 仍走原文字路径；空宿主 after + first-letter 有先红后绿成对回归，移除分片后安全对照通过。
3. **背景叠层**：生成文字路径对宿主及祖先的其他 `::before`／`::after` 都核对绘制层，不再只在存在 url 背景时执行；`content:""` 不能证明没有背景、边框、阴影或滤镜。只有同一实色覆盖与否都不改变叠底时忽略该层；其余无法证明覆盖和绘制顺序时报告“伪元素叠层无法核对实际底图”。没有绘制层的 `content:""` 安全对照通过。该同实色判断只用于证明颜色不变，P2-3 的白色叠层在深底上仍三档拒收，安全前景对照也不返回错误比值。
4. **first-line 额外边界**：作者样式中的 `::first-line`／`:first-line` 规则按大小写不敏感识别；生成文字宿主或祖先命中而快照不能证明分片实际样式时明确拒收。`::marker` 不受该规则影响，避免原生编号被 first-line 误拒；真实 DOM 安全首行／首字母对照保持通过。

首轮相关定向测试跑出 132／135：3 项 T-164 既有夹具在初始提交时因原生 marker 被同宿主白底 `::before`／`::after` 和 first-line 规则误拒。没有放宽 P2-3，而是把“其他伪元素层”改为仅在同一实色覆盖不改变叠底时忽略；marker 不套用 first-line 不确定性。失败日志原样保留，修后 T-164 14／14、T-196 11／11，最终 135／135。

#### 红绿与门控

统一环境：本工作树，Chrome 使用负责人指定的 154 headless shell；浏览器任务全部串行。时间均为 UTC。

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- --browser-concurrency=1 tests/t196-visual-coverage.test.ts
npm run typecheck
```

- **HEAD 375557c 红态**：上一执行者已在同一工作树完成并保留，2026-10-19T23:39:14.283Z–23:40:00.980Z，11 项中 4 项失败（三项 P2 加 first-line 额外边界），退出 1；日志 `artifacts/t196/review2-fix/head-375557c-complete-red.log`，标准入口 `artifacts/t167/test-run-1792453151483-96491/`。本轮遵守不 checkout／reset，没有重跑 HEAD 红态。
- **首次绿态**：23:40:23.831Z–23:41:04.963Z，11／11 通过，退出 0；`first-green.log`、`artifacts/t167/test-run-1792453221636-4472/`。随后本轮补强同实色豁免和 marker first-line 排除，重新跑 T-196 与 T-164：2026-10-20T01:27:57.388Z–01:28:40.185Z，25／25 通过，退出 0；`t196-t164-green-final.log`、`artifacts/t167/test-run-1792459675720-53000/`。
- **最终相关定向**：2026-10-20T01:29:21.861Z–01:31:45.836Z，12 文件 **135／135 通过**，失败／取消／跳过均为 0，退出 0；`targeted-green-final.log`、`artifacts/t167/test-run-1792459760098-54496/`。命令：

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- --browser-concurrency=1 \
  tests/t196-visual-coverage.test.ts tests/t195-hidden-overlap.test.ts tests/t160-narrow-columns.test.ts \
  tests/t187-repair-fragments.test.ts tests/t187-repair-routing.test.ts tests/t191-display-transition.test.ts \
  tests/t191-fact-label-boundary.test.ts tests/t192-check-transitions.test.ts tests/t173-repair-scope.test.ts \
  tests/t089-contrast-line-length.test.ts tests/t178-full-style-equivalence.test.ts tests/t164-review-seven.test.ts
```

- **最终 typecheck**：2026-10-20T01:28:43Z 完成，退出 0；`opencode-typecheck-final.log`。最终门控 **PASS**。

#### T-190 的 14 站离线对照

沿用只读复制的 `artifacts/t196/offline-data/`、固定 `manifest.json` 与 `scripts/check-code-quality-offline.ts`，只写本工作树 `review2-fix/`。改动前于 2026-10-19T23:37:09.484Z–23:37:30.483Z 运行（生产扫描器／生成布局读取器为 HEAD `375557c`，测试夹具已在工作区），改动后于 2026-10-20T01:28:47.977Z–01:29:02.826Z 运行最终代码；两次均 14 站、129 个页面视口组合、14／14 通过、0 条底线拒因、0 个回放错误，siteId／versionId 集合相同，逐站 `issues` 与 `qualityFeedback` 完全一致。**新增拒因站点 0（上限 3）**。中间一次 `offline-after` 在同实色豁免收紧前运行，不作为最终证据，原样保留。

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --experimental-strip-types artifacts/t196/offline.mjs artifacts/t196/review2-fix/offline-after-final
```

| 站点 | siteId 前八位 | 视口组合 | 改动前拒因 → 改动后拒因 |
| --- | --- | --- | --- |
| 青禾纸包装 | 02058cac | 9 | 0 → 0 |
| 禾巷小馆 | 2c11a272 | 9 | 0 → 0 |
| 外高桥流体接头 | 3938dc82 | 9 | 0 → 0 |
| 忻州重载减速机 | 50f563f6 | 6 | 0 → 0 |
| 折页设计工作室 | 519b44cd | 9 | 0 → 0 |
| 外高桥流体接头 | 61601e66 | 9 | 0 → 0 |
| 拾色绘画教室 | 641e5b8b | 9 | 0 → 0 |
| 禾巷小馆 | 961cd7a2 | 9 | 0 → 0 |
| 拾色绘画教室 | a44ba7c8 | 9 | 0 → 0 |
| 拾色绘画教室 | aa40ead3 | 9 | 0 → 0 |
| 宁海精密注塑模具 | aaf4ff61 | 12 | 0 → 0 |
| 宁海精密注塑模具 | bd77156a | 12 | 0 → 0 |
| 禾巷小馆 | cb04f202 | 9 | 0 → 0 |
| 拾色绘画教室 | ce92cb36 | 9 | 0 → 0 |

结果与对比见 `review2-fix/offline-before/`、`review2-fix/offline-after-final/`、`offline-before.log`、`offline-after-final.log`、`offline-comparison.json`。截图断言、非阻断质量反馈和原有脚本未改；技术通过不表示审美通过。

#### 交付边界

`tests/fixtures/t196-review2-inputs.json` 只逐份复制 `review2-probes/` 的 `code`，未复制扫描答案；16 份输入已与探针逐份核对相等。未调用真实模型、未读 `.env.local`、未开审查实例、未跑全量／runner／build、未推送或 force-push、未使用 rm；没有写主工作区 `.sitecraft-data` 或 artifacts。`tsconfig.json` 的 Next 自动改动保留且不提交。本轮源码、测试、夹具、spec 与票据合为本地提交；票保持 open，最后一项继续不勾选，等待主控独立复审与合并后主线验收。本轮门控 **PASS**，提交 SHA 随交付回报。


### 2026-10-20 第三轮复审 P2／P3 修复（codex-t196e）

输入为主工作区只读 `artifacts/t196/review3.txt`（目标 `8d131f5`，结论 **NO_GO：一项 P2、一项 P3**）及 `review3-probes/current-relaxation-refined.ts`。review3 由 DeepSeek 的独立实例审查，上一轮执行者 opencode 也为 DeepSeek；本轮执行者为 codex-t196e，按负责人指令未开审查实例。目标只修复生成文字叠层漏判及离线摘要完成时间；不增加矩形覆盖或绘制顺序推断，不调用模型，不改变 T-195 两条排除规则、容差或阈值。

#### 修法与独立期望

- **P2**：删除 `scripts/visitor-layout-scan.js` 中其他伪元素层的 `comparable`／`layerBase`／`sameSolid` 放宽。宿主或祖先存在其他 before／after 绘制层，而不能证明它位于生成文字下方且不影响实际叠底时，一律返回「伪元素叠层无法核对实际底图」，不返回比值。仅对其他绘制层收紧，原有宿主实际背景测量路径不变。marker 不受 first-line 影响的处理原样保留。
- 新夹具 `tests/fixtures/t196-review3-overlay-inputs.json` 只从独立探针复制五份站点代码，不带检查答案。三个覆盖层反例分别为完全不透明白层在上、65% 半透明白层在上、65% 半透明白层覆盖宿主宽度的 55%；三档访客截图分别可见文字消失、整体变浅和局部变浅。每例保留 content:""，仅移除覆盖层背景绘制作为安全对照；拒收期望来自这些访客状态及负责人指定的保守合同。另补 marker 浅灰／深色与相反 first-line 颜色的成对保护用例，红态即通过，不冒称本轮修复了 marker 缺陷。
- **P3**：只在本工作树把 `artifacts/t196/review2-fix/offline-comparison.json` 的 `after.completedAt` 从 null 改为该目录 `offline-after-final/summary.json` 的原值 `2026-10-20T01:29:02.826Z`。语义核对确认其余字段全部相同，没有改任何测试结果。原摘要与修正副本分别保存到本轮 `review2-offline-comparison-original.json`、`review2-offline-comparison-corrected.json`；主工作区 artifacts 未写入。
- T-164 两个旧夹具原有白底 before／after 与原生列表编号同宿主，按收紧合同无法证明叠层顺序，初始存版被明确拒收。仅去掉该组夹具的基线背景；焦点态仍改颜色和背景，范围外完整样式改变、拒因定位及不存版本断言全部保留。未为夹具放宽生产规则。

Tracer bullet 仍为独立页面输入 → 生产静态渲染 → Chrome 实际布局 → checkSiteCode 三档检查；Deep modules 不新增接口，直接删除不可靠分支；Ubiquitous language 沿用“生成文字位置”与“无法测量”。同类问题由上述三个红绿用例机械拦截，检查说明已补入 AGENTS.md，当前合同已同步到 spec 第 6 节。

#### 红绿与门控（UTC）

所有浏览器检查在本工作树串行，统一使用下列 Chrome；`review3-fix/*-command.json` 保存完整命令、cwd、开始／完成时间和退出码，`*.log` 保存原始输出。

```sh
export CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell
# 在 HEAD 8d131f5、生产代码未改时取得缺陷红态
npm test -- --browser-concurrency=1 tests/t196-visual-coverage.test.ts
# 首次相关门控，保留两项夹具失败
npm test -- --browser-concurrency=1 tests/t196-visual-coverage.test.ts tests/t164-review-seven.test.ts tests/t195-hidden-overlap.test.ts
# 最终相关门控
npm test -- --browser-concurrency=1 \
  tests/t196-visual-coverage.test.ts tests/t195-hidden-overlap.test.ts tests/t160-narrow-columns.test.ts \
  tests/t187-repair-fragments.test.ts tests/t187-repair-routing.test.ts tests/t191-display-transition.test.ts \
  tests/t191-fact-label-boundary.test.ts tests/t192-check-transitions.test.ts tests/t173-repair-scope.test.ts \
  tests/t089-contrast-line-length.test.ts tests/t178-full-style-equivalence.test.ts tests/t164-review-seven.test.ts
npm run typecheck
```

- **HEAD 红态**：2026-10-20T08:11:08.955969Z–08:11:40.235968Z，15 项中 12 通过、3 失败，退出 1；三个新覆盖层反例三档均被错误接受，issues 为空，安全对照全部通过。日志 `artifacts/t196/review3-fix/head-8d131f5-red.log`，标准入口 `artifacts/t167/test-run-1792483869349-13238/`，原样截图／观察 `artifacts/t196/probes-1792483871307-13244/`。这是业务漏判红态，不是环境或封装失败。
- **首次相关门控**：08:13:24.134619Z–08:14:45.259053Z，42 项中 40 通过、上述 T-164 两项初始夹具失败，退出 1；T-196 15／15、T-195 13／13 已通过。日志 `initial-targeted.log`，标准入口 `artifacts/t167/test-run-1792484004452-15094/`；失败证据完整保留。
- **最终相关门控**：08:15:19.076428Z–08:17:25.721027Z，12 文件 **139／139 通过**，失败／取消／跳过均为 0，退出 0；包含 T-196 15／15、T-164 14／14、T-195 13／13。日志 `final-targeted.log`，标准入口 `artifacts/t167/test-run-1792484119418-17442/`。三个覆盖层反例各三档明确无法测量、ratio=null，保留 content:"" 的无绘制层对照均通过；原有同宿主／祖先叠层用例继续通过。
- **最终 typecheck**：08:16:12.181171Z–08:16:13.743283Z，退出 0；`final-typecheck.log`。先前一次 08:13:51.634061Z–08:13:53.118599Z 的通过记录同样保留。
- 最终新增三组成对覆盖层与 marker 的 24 张三档原样截图位于 `artifacts/t196/probes-1792484215854-20049/`，已通过 `review3-fix/final-overlays-marker-{375,768,1440}.png` 的完整页面和文字区域汇总图逐张打开；红态三个覆盖层的 18 张成对原图同样已打开。没有哈希、字节或像素比对，没有固定等待。

#### T-190 的 14 站改前／改后离线对比

只读核对主工作区 `.sitecraft-data/code-sites/` 中站名含“（新资料 T-190）”的全部 14 站，currentVersionId 与 manifest 一致；现有本工作树副本除已去掉站名备注外，与源记录各字段相同，核对记录为 `review3-fix/source-verification.json`。沿用副本 `artifacts/t196/offline-data/`、原 manifest 与离线包装，不写主工作区数据。

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --experimental-strip-types artifacts/t196/offline.mjs artifacts/t196/review3-fix/offline-before
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --experimental-strip-types artifacts/t196/offline.mjs artifacts/t196/review3-fix/offline-after
```

包装只提供本地同源页和副本图片／预览，实际调用 `scripts/check-code-quality-offline.ts --manifest artifacts/t196/manifest.json --samples <本工作树>/artifacts/t196/offline-data/code-sites --out <各自新目录>`，legacyImport 离线确定性检查，无事实模型调用，不存版本。

- 改前完整命令：08:11:48.580482Z–08:12:12.022292Z，退出 0；summary 检查完成时间 08:12:03.333Z。
- 改后完整命令：08:12:39.780383Z–08:13:03.058451Z，退出 0；summary 检查完成时间 08:12:54.391Z。
- 两次均 **14／14 通过、129 个页面视口、0 条底线拒因、0 个回放错误**；siteId／versionId 集合、逐站拒因和质量反馈完全一致，**新增拒因站点 0（停止阈值为超过 3）**。元数据如实记 `commit=8d131f5`、dirty=true，改后是未提交修复候选，不冒称最终 SHA 重跑。

| 站点 | siteId 前八位 | 页面视口 | 改前拒因 → 改后拒因 |
| --- | --- | --- | --- |
| 青禾纸包装 | 02058cac | 9 | 0 → 0 |
| 禾巷小馆 | 2c11a272 | 9 | 0 → 0 |
| 外高桥流体接头 | 3938dc82 | 9 | 0 → 0 |
| 忻州重载减速机 | 50f563f6 | 6 | 0 → 0 |
| 折页设计工作室 | 519b44cd | 9 | 0 → 0 |
| 外高桥流体接头 | 61601e66 | 9 | 0 → 0 |
| 拾色绘画教室 | 641e5b8b | 9 | 0 → 0 |
| 禾巷小馆 | 961cd7a2 | 9 | 0 → 0 |
| 拾色绘画教室 | a44ba7c8 | 9 | 0 → 0 |
| 拾色绘画教室 | aa40ead3 | 9 | 0 → 0 |
| 宁海精密注塑模具 | aaf4ff61 | 12 | 0 → 0 |
| 宁海精密注塑模具 | bd77156a | 12 | 0 → 0 |
| 禾巷小馆 | cb04f202 | 9 | 0 → 0 |
| 拾色绘画教室 | ce92cb36 | 9 | 0 → 0 |

两轮 `offline-before/`、`offline-after/` 的 results／summary／screenshots、原始日志和 `offline-comparison.json` 均在本工作树 `artifacts/t196/review3-fix/`；两边各六张三档离线截图均通过 `offline-{before,after}-{ungatedHover,smallTargets}-view.png` 完整页面汇总图打开，非空白、载入态或截断截图。技术通过不表示审美或独立复审通过。

#### 本轮交付边界

本轮授权内修复与门控 **PASS**。`claimed_by: codex-t196e`，票保持 open，合并后主线验证及独立审查继续不勾选。未跑全量／runner／build、未推送或 force-push、未读 .env／.env.local、未调用真实模型、未开审查实例、未使用 rm；主工作区 artifacts 与 .sitecraft-data 均未写入。保留开工时已有的 tsconfig.json 自动改动，不提交。源码、测试、夹具、当前规则与本节记录合为本地提交，最终 SHA 随交付回报；日志和截图按项目约定留在 gitignore 的本工作树 artifacts。
