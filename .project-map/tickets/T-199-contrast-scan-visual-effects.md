---
id: T-199
title: 对比度扫描对滤镜、遮罩、裁切、描边与首行首字母变色一律判为无法测量
type: build
status: closed
blocked_by: [T-198]
claimed_by: codex-t199
supersedes:
---

## Why

T-196 的 review5（`artifacts/t196/review5.txt`）三档实测找到四项漏判：文字满足 T-196 的收口条件，访客却看不见，检查仍然放行。这四项是主线对比度扫描原有的通用缺口，正文同样受影响，不是 T-196 引入的。T-190 的 14 个真实站点里一处都没出现。

1. **首行、首字母变色**：正文的 ::first-line 或 ::first-letter 改成浅色，扫描仍按宿主元素的颜色测量。
2. **滤镜与遮罩**：filter:opacity() 或透明 mask 让文字几乎看不见，甚至完全消失。主线的滤镜、遮罩检查只在有 url 背景时才触发。
3. **描边**：-webkit-text-stroke 的白色描边盖住了字形。
4. **裁切**：clip-path:inset(50%) 把文字完全裁掉。

T-196 已经审到第六轮，每轮用自造的新 CSS 都能找到新缺口，所以本票不逐种分析，用白名单收口。

## What to build

1. **白名单收口**：文字自身或任一祖先只要出现下列情况，就统一判为「无法测量」并拒收，不分析实际效果：
   - filter（none 除外）；
   - mask-image（含 -webkit-mask-image）任一计算图层不是 none；全部图层为 none 时不算遮罩，mask 的其他参数不影响判断；
   - clip-path，T-195 认定的标准「仅屏幕阅读器」写法除外；
   - -webkit-text-stroke，宽度为 0 的除外；
   - 改了 color、background 或 opacity 的 ::first-line 或 ::first-letter。
2. **误拒上限**：用 `scripts/check-code-quality-offline.ts` 离线重检 T-190 的 14 站，新增拒因不超过 3 站。超过就停下，报构思主控。
3. **成对测试**：review5 的四项反例在父版上放行，修后拒收；每项再配一个不带这些属性的正常对照，确认不拒收。
4. **复审**：窄复审只查两件事：白名单之外是否还有这四类写法被测量放行，以及误拒是否超出上限。复审挑出的新类别，另记为已知缺口，不在本票追加。

## Acceptance

- [x] 成对测试先红后绿；14 站离线重检新增拒因不超过 3 站
- [x] spec 与 AGENTS.md 对比度扫描的表述同步
- 合并后主线验证通过；独立审查通过——主线验证已通过（见 Resolution 末尾）；审查一项不打勾：review1 为 NO_GO，P2-1（mask 误拒）修复后未再复审，由执行主控核对三项后合并；P2-2 记为已知代价，backdrop-filter 记为已知缺口。审查原文：`artifacts/t199/review1.txt`。

## Resolution

执行：codex-t199，2026-10-20。工作树 `sitecraft-ai-t199`，分支 `t199-contrast-effects-whitelist`，基线 `22aa7e37fd5e0a4a547d29b112a97143ec230a60`。本地授权范围 **PASS**；票保持 open，合并后主线验证与独立审查由主控处理，最后一项不勾选。下文时间均为 UTC，证据均在本工作树 `artifacts/t199/`，未提交这些被忽略的运行产物。

### 修法与边界

原扫描只在有 URL 背景时核对滤镜、遮罩；正文的首行／首字母则仍按宿主前景色计算。`scripts/visitor-layout-scan.js` 在正文与 CSS 生成文字共用的背景读取入口先检查文字自身、生成伪元素、宿主和全部祖先：非 none 的 filter、mask／mask-image、clip-path、非零宽描边，以及首行／首字母改变 color、background 或 opacity，统一返回 unmeasured、ratio=null 和效果类别／所在元素，不推断实际效果。删除原 URL 条件下的滤镜／遮罩分支；首行／首字母背景也归入同一检查，不保留另一套背景门禁。原 z-index、marker、实际绘制盒、其他叠层与分片完整性门禁继续执行。

T-195 的 `fullyHidden` 两条排除规则未改，完整有盒 sr-only 的 inset(50%)／零 rect 裁切仍通过；none、零宽描边、仅改字重的安全正文首行／首字母仍通过。没有新增同色、零强度滤镜、inset(0) 等效果豁免，也没有修改生成站代码、预览或发布。

`lib/code-site-layout-repair.ts` 接收扫描器同次记录的效果位置；正文仍保存 T-187 的字段、路径和元素快照，生成文字仍保存 T-173 的 pageId／width／path／pseudo。未知效果的完整声明影响范围无法核实时明确拒绝修正，不猜测声明或开放祖先／整页，也不新增修正入口。body 的空扫描 key 仅在诊断显示时写成 body，保留原定位约定。`codeRepairFragments` 的生产拒绝路径有实际断言。

Tracer bullet：独立页面输入 → 生产 checkSiteCode → 清理和静态渲染 → Chrome 三档扫描及结构化拒因 → 既有修正范围拒绝。Deep modules：沿用一个测量入口和既有修正模块；Ubiquitous language：统一使用“视觉效果白名单”“无法测量”和“完整修正范围”。

`tests/t196-visual-coverage.test.ts` 按本票合同同步：原先专门放行的“首行变色但 marker 实际不变”现在保守拒收；去掉首行变色的正常编号仍通过。其他 marker 背景测试的安全基线去掉这条变色，只隔离各自要验证的条件，没有删除原反例。spec 第 6 节与 AGENTS.md 已同步；AGENTS 只写规则。CONTEXT 与 mainline 的相关术语各补一条规格指引，project-map 无过期 living doc。

### 红绿与截图

`tests/fixtures/t199-review5-inputs.json` 仅复制主工作区只读 review5 的七个反例与 safe-before 的 code，不带 expected、扫描答案或原报告。`tests/t199-contrast-effects.test.ts` 的 50 项通过真实生产 checkSiteCode 检查三档，legacyImport:true 仅省略模型事实核对，不存版本；本地临时 HTTP 服务只提供检查文档，意外请求使测试失败。期望来自原样访客截图及本票合同。

| 输入 | 22aa7e3 三档 | 最终候选三档 | 打开截图后的判定 |
| --- | --- | --- | --- |
| dom-firstline-low | 放行，contrastIssues=0 | first-line color 无法测量，拒收 | 整行浅灰对白底 |
| dom-firstletter-low | 放行，contrastIssues=0 | first-letter color 无法测量，拒收 | 首字母 V 过浅 |
| before-filter-opacity | 放行，contrastIssues=0 | filter 无法测量，拒收 | 生成文字近白 |
| ancestor-filter-opacity | 放行，contrastIssues=0 | filter 无法测量，拒收 | 祖先滤镜使文字近白 |
| before-mask-transparent | 放行，contrastIssues=0 | mask／mask-image 无法测量，拒收 | 生成文字消失 |
| before-text-stroke | 放行，contrastIssues=0 | text-stroke 无法测量，拒收 | 白描边盖住字形 |
| before-clip-path | 放行，contrastIssues=0 | clip-path 无法测量，拒收 | 生成文字被裁掉 |

七个正常对照、DOM 首行／首字母只改字重、none／零描边和两种完整 sr-only 均通过。另测 DOM／生成文字自身与深层祖先的四种效果、首行／首字母三类属性、嵌套和媒体规则，以及未知范围不进入修正。blur(0px)、全黑 mask、inset(0) 和同色描边也按合同拒收；这些是保守条件，不冒称实际低对比度。

统一聚焦命令：

```sh
export CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell
npm test -- --browser-concurrency=1 tests/t199-contrast-effects.test.ts
```

- 父版红态：14:20:26.349–14:20:49.807，退出 1，50 项中 13 通过、37 失败；七个原反例全部确实放行。部分首行背景原已拒收，但未满足新类别／位置合同，不能把全部 37 项都称为漏判复现。`parent-red.log`、`parent-red-command.json`；原样检查和截图 `probes-1792506029857-54399/`。
- 首次修后：14:23:02.547–14:23:30.208，退出 0，50/50；`first-green.log`，截图与观察 `probes-1792506184733-56485/`。
- 最终同组复测：14:32:08.399–14:33:02.989，T-199 仍为 50/50；`final-followup.log`，检查、观察和截图 `probes-1792506752753-69044/`。`red-green-observations.json` 汇总七个反例的红绿原始观察，不作为期望。

红态、首次绿态和最终态各 54 张三档原图，均通过 `red-contact-{1..4}.png`、`green-contact-{1..4}.png`、`final-contact-{1..4}.png` 打开核对。每张保留原尺寸左侧 375×300 区域；全部标题、文字和容器均完整位于此区域，原宽完整截图仍在对应 probes 目录。截图中的消失文字旁仍有已加载标题；未把载入态当证据。重建：`python3 artifacts/t199/make-contact-sheets.py <probes目录> <标签>`。没有固定等待、哈希、字节或像素比较。

失败证据未覆盖：补查时曾给首行／首字母额外加入八个 filter／mask／clip-path／stroke 断言，`parent-fragment-red.log` 与 `fragments-green.log` 保留。独立 Chrome 直接读取 `fragment-computed.json` 确认这八项在这两个分片上的计算值为 none／0，并非本票明确要求的分片 color／background／opacity 情形；撤回该错误扩展假设及对应测试，未增加来源声明解析器，也未放宽本票的效果规则。此轮失败不算有效产品红绿证据。

### 14 站离线误拒对比

只读选取主工作区 `.sitecraft-data/code-sites/` 中站名含“（新资料 T-190）”的全部 14 站，复制记录及其图片到本工作树 `artifacts/t199/offline-data/`。`manifest.json` 固定 siteId／currentVersionId；`source-verification.json` 逐字段和值核对副本与源记录，无哈希或字节比较。T-184 按站名选出 17 站；T-186 从其 eval 与 eval-r2 保存记录取并集，共 7 站，包含替换前的结果，未丢弃失败样本。

`offline.mjs` 只提供随机端口的本地检查页、复制图片与生产静态预览，实际调用未改动的 `scripts/check-code-quality-offline.ts --manifest artifacts/t199/manifest.json --samples <本工作树>/artifacts/t199/offline-data/code-sites --out <新目录>`。不启动普通 dev、不访问 3034、不读 .env、不调用模型、不写版本。生产检查使用复制数据根，主工作区数据和 artifacts 全程只读。

```sh
# CHROME_PATH 同上；基线时生产扫描源码仍为 22aa7e3
node --experimental-strip-types artifacts/t199/offline.mjs artifacts/t199/offline-before
# 最终候选
node --experimental-strip-types artifacts/t199/offline.mjs artifacts/t199/offline-after-final
python3 artifacts/t199/compare-offline.py offline-after-final offline-comparison-final.json
```

- 基线：14:21:31.928–14:22:19.475，退出 0。
- 最终候选：14:33:38.887–14:34:31.557，退出 0；元数据仍写 HEAD=22aa7e3、dirty=true，表示未提交候选，不冒称提交后重跑。
- 完整结果分别为 `offline-before/`、`offline-after-final/` 的 results／summary／screenshots；精确命令、cwd、Chrome、起止时间、退出码在对应 `*-command.json`，日志为同名 `*.log`。较早的 `offline-after/` 与 `offline-comparison.json` 也保留。

| 集合 | 站数／页面视口 | 改前通过 | 最终通过 | 改前／改后拒因数 | 新增拒因站点 |
| --- | --- | --- | --- | --- | --- |
| T-190 | 14／129 | 14 | 14 | 0／0 | 0 |
| T-184（仅记录） | 17／150 | 16 | 16 | 15／15 | 0 |
| T-186（仅记录） | 7／66 | 5 | 5 | 32／32 | 0 |

T-190 逐站结果（完整版本 UUID 在 manifest 与 comparison 中；以下短 ID 区分同名站）：

| 站名 | siteId 前八位 | 页面视口 | 新增拒因／位置／截图判定 |
| --- | --- | --- | --- |
| 青禾纸包装（新资料 T-190） | 02058cac | 9 | 0／无／不适用 |
| 禾巷小馆（新资料 T-190） | 2c11a272 | 9 | 0／无／不适用 |
| 外高桥流体接头（新资料 T-190） | 3938dc82 | 9 | 0／无／不适用 |
| 忻州重载减速机（新资料 T-190） | 50f563f6 | 6 | 0／无／不适用 |
| 折页设计工作室（新资料 T-190） | 519b44cd | 9 | 0／无／不适用 |
| 外高桥流体接头（新资料 T-190） | 61601e66 | 9 | 0／无／不适用 |
| 拾色绘画教室（新资料 T-190） | 641e5b8b | 9 | 0／无／不适用 |
| 禾巷小馆（新资料 T-190） | 961cd7a2 | 9 | 0／无／不适用 |
| 拾色绘画教室（新资料 T-190） | a44ba7c8 | 9 | 0／无／不适用 |
| 拾色绘画教室（新资料 T-190） | aa40ead3 | 9 | 0／无／不适用 |
| 宁海精密注塑模具（新资料 T-190） | aaf4ff61 | 12 | 0／无／不适用 |
| 宁海精密注塑模具（新资料 T-190） | bd77156a | 12 | 0／无／不适用 |
| 禾巷小馆（新资料 T-190） | cb04f202 | 9 | 0／无／不适用 |
| 拾色绘画教室（新资料 T-190） | ce92cb36 | 9 | 0／无／不适用 |

新增拒因站点 **0**，新增拒因位置无，因此没有需要逐个核对的新增拒因对应截图；没有用其他截图冒充该判定。未触发“超过 3 站即停止”阈值，没有放宽规则。T-184 的 1 个原失败和 T-186 的 2 个原失败及逐条拒因完整保留，不计为本票新增，也不宣称它们通过。离线回放只证明确定性检查，不等于模型事实核对、站点审美或独立审查通过。

### 定向门控与交付

```sh
# CHROME_PATH 同上，所有浏览器文件串行
npm test -- --browser-concurrency=1 \
  tests/t199-contrast-effects.test.ts tests/t196-visual-coverage.test.ts \
  tests/t195-hidden-overlap.test.ts tests/t089-contrast-line-length.test.ts \
  tests/t148-system-backdrops.test.ts tests/t187-repair-fragments.test.ts \
  tests/t187-repair-routing.test.ts tests/t173-repair-scope.test.ts \
  tests/t198-extreme-narrow-floor.test.ts tests/t160-narrow-columns.test.ts
npm test -- --browser-concurrency=1 \
  tests/t199-contrast-effects.test.ts tests/t198-clipped-visible-lines.test.ts \
  tests/t198-overflow-ancestors.test.ts
npm run typecheck
```

- 第一组：14:28:34.815–14:31:25.582，10 文件 182/182，退出 0，`final-targeted-corrected.log`。之后仅补 body 在拒因中的显示名，没有改变测量规则。
- 最终补充组：14:32:08.399–14:33:02.989，3 文件 83/83，退出 0，`final-followup.log`。两组去重共 **12 文件、215 项**，失败／取消／跳过均为 0。
- 最终 typecheck：14:32:09.573–14:32:14.754，退出 0，`final-typecheck.log`。标准测试入口报告副本在 `standard-reports/`；原入口目录分别为 `artifacts/t167/test-run-1792506515096-62995/`、`artifacts/t167/test-run-1792506728719-68570/`。
- `final-targeted.log` 保留一次文件名误写导致的 ENOENT，14:28:10.777–14:28:11.977，退出 1，未执行测试；随后使用实际存在的文件完成上面两组，不冒称该失败为通过。

spec、AGENTS、CONTEXT、mainline 与本票保存后已回读检查中文与差异，`git diff --check` 通过；project-map 为 0 问题、0 过期文档。未跑全量、runner 回归、build、真实模型或评估，未开审查／盲评实例，未推送或 force-push，未使用 rm 命令。所有自建本地服务和测试入口服务均已关闭，未碰 3034。tsconfig.json 的 Next 自动修改保留但不提交。本地提交 SHA 随交付回报；提交包含指定 Co-Authored-By。合并后主线验证与独立审查仍待主控，本票不关闭。


### 2026-10-20 review1：仅修 P2-1 无图遮罩误拒

执行：codex-t199；修复基线 `55fb6f1f50df5556712c65819c2acdb33404f4c2`。完整读取主工作区只读 `artifacts/t199/review1.txt` 及其 O／F 原输入。本节为本轮本地修复证据，前面的首次交付记录保留。review1 独立结论仍为 **NO_GO**，本轮只处理负责人指定的 P2-1；未开新审查实例，不把自查 PASS 当作复审通过。票保持 open，最后一项不勾选。下列时间均为 UTC，运行证据前缀 R 为本工作树 `artifacts/t199/review1-fix/`。

#### 修法

原条件把 `mask` 简写的序列化文本与单个 none 比较：尺寸、模式、位置参数会改变该文本，即使没有遮罩图像也拒收；`mask-image:none,none` 同样被误认成有图。仅替换 `scripts/visitor-layout-scan.js` 共用效果检查中的这一条条件：读取计算后的 mask-image 与 -webkit-mask-image，复用现有 `splitTopLevel` 逐层判断；任一层不是 none 就以既有 mask 无法测量原因拒收，所有图层均为 none 时不算遮罩。不再读取 mask 简写，不分析图像颜色、强弱或合成结果；mask-size／mask-mode／mask-position 不参与判断。

正文、生成文字和祖先继续走同一条件。没有改 sr-only、完整分片、z-index、底图、其他视觉效果或修正范围门禁，没有新修正入口。AGENTS 只同步规则；spec 与 What to build 同步实际图层口径和测试说明。Tracer bullet 仍是原输入 → 生产 checkSiteCode → Chrome 三档扫描 → 原样截图及结构化拒因；Deep modules 复用现有分层函数，Ubiquitous language 区分“无图遮罩”和“有图遮罩”。

#### 成对红绿与截图

`tests/fixtures/t199-review1-mask-inputs.json` 只复制独立 O／F 中指定的八个 *-input.json，不含 expect、检查输出或报告结论。原 T-199 测试新增 12 项：五个指定无图输入、生成文字全 none 列表与祖先前缀无图参数两个补充对照、三个指定有图输入，以及非 none 图像处于首层／末层的两种混合列表。期望来自本轮合同和实际访客绘制，不由实现输出生成。无图对照除提交通过外，还要求实际文字条目保留、measured 且比值至少 4.5，防止删除文字后冒称通过。

| 输入 | 55fb6f1 三档 | 修后三档 |
| --- | --- | --- |
| mask-none-size | mask 无法测量，误拒 | 通过，正常测量 |
| mask-none-mode | mask 无法测量，误拒 | 通过，正常测量 |
| mask-none-position | mask 无法测量，误拒 | 通过，正常测量 |
| mask-none-generated | mask 无法测量，误拒 | 通过，正常测量 |
| mask-none-list | mask 无法测量，误拒 | 通过，正常测量 |
| mask-none-list-generated | mask 无法测量，误拒 | 通过，正常测量 |
| webkit-mask-none-ancestor | mask 无法测量，误拒 | 通过，正常测量 |
| webkit-mask-shorthand | mask 无法测量，拒收 | mask 无法测量，仍拒收 |
| webkit-mask-image-generated | mask 无法测量，拒收 | mask 无法测量，仍拒收 |
| mask-shorthand-ancestor | mask 无法测量，拒收 | mask 无法测量，仍拒收 |
| mask-mixed-first／mask-mixed-last | mask 无法测量，拒收 | mask 无法测量，仍拒收 |

```sh
export CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell
# 红态在生产扫描仍为 55fb6f1 时运行；修后使用同一命令
npm test -- --browser-concurrency=1 tests/t199-contrast-effects.test.ts
npm test -- --browser-concurrency=1 tests/t196-visual-coverage.test.ts tests/t195-hidden-overlap.test.ts tests/t148-system-backdrops.test.ts
npm run typecheck
```

- 红态：14:56:49.835–14:57:24.380，退出 1；62 项中 55 通过、7 失败，失败均为上表七个无图误拒，指定五项各三档均复现。`R/parent-red.log` 与 `parent-red-command.json`；检查、观察、原图在本工作树 `artifacts/t199/probes-1792508211697-89166/`。
- 同组绿态：14:58:26.851–14:59:02.787，退出 0；62/62，失败／取消／跳过均为 0。`R/first-green.log` 与 `first-green-command.json`；检查、观察、原图在 `artifacts/t199/probes-1792508308624-91285/`。
- 相关回归：14:59:29.741–15:01:08.360，退出 0，3 文件 57/57；`R/related.log` 与 `related-command.json`。两组去重共 **4 文件 119 项通过**，包括原 T-196 分片门禁与 T-195 sr-only 检查。
- typecheck：14:58:28.000–14:58:29.527，退出 0；`R/typecheck.log` 与 `typecheck-command.json`。通过后未再修改生产代码或测试。

`R/red-green-observations.json` 保存这 12 组的红绿原始结果；标准入口的报告、身份、dev.log 与统计副本在 `R/standard-reports/`。新增场景两轮各 36 张三档原图，均通过 `R/red-contact-{1..3}.png`、`R/green-contact-{1..3}.png` 打开核对：七个无图输入文字完整、清晰；透明有图遮罩使文字消失；黑色混合图层虽可见仍按合同拒收。汇总取原尺寸左侧 375×300 区域，全部探针内容位于该区域，完整原图保留；无固定等待、哈希、字节或像素比较。重建命令：`python3 artifacts/t199/review1-fix/make-contact-sheets.py <probes目录> <red或green>`。

#### T-190 的 14 站：相对 55fb6f1 新增拒因 0

本轮重新只读复制主工作区站名含“（新资料 T-190）”的全部 14 站及图片到 `R/offline-data/`；`R/manifest.json` 固定 siteId／currentVersionId，`R/source-verification.json` 逐字段和值核对源记录与副本。本轮基线在生产代码尚为 55fb6f1 时新跑，不沿用上节 22aa7e3、dirty=true 的旧结果，也不将旧结果改名充当新基线。

`artifacts/t199/review1-offline.mjs` 沿用本地随机端口包装，仅提供检查文档、复制图片与生产静态预览，实际调用未改动的 `scripts/check-code-quality-offline.ts --manifest artifacts/t199/review1-fix/manifest.json --samples <本工作树>/artifacts/t199/review1-fix/offline-data/code-sites --out <新目录>`。没有模型调用、版本写入或主工作区数据写入。

```sh
# CHROME_PATH 同上，基线／改后与浏览器测试串行
node --experimental-strip-types artifacts/t199/review1-offline.mjs artifacts/t199/review1-fix/offline-before
node --experimental-strip-types artifacts/t199/review1-offline.mjs artifacts/t199/review1-fix/offline-after
python3 artifacts/t199/review1-fix/compare-offline.py
```

- 55fb6f1 基线：14:57:41.721–14:58:06.784，退出 0；`R/offline-before.log`、`offline-before-command.json`、`offline-before/results.json` 与 summary。
- 最终候选：15:01:28.885–15:01:58.144，退出 0；`R/offline-after.log`、`offline-after-command.json`、`offline-after/results.json` 与 summary。元数据为 HEAD=55fb6f1、dirty=true，表示本轮未提交修复候选，不冒称提交后重跑。
- 两边均 **14/14 通过、129 个页面视口、0 条拒因、0 个回放错误**；按每个输入版本的实际页数与 375／768／1440 三档核对覆盖。`R/offline-comparison.json` 保存逐站原拒因、新增拒因和位置；**新增拒因站点 0、新增拒因位置无**，不需要新增位置截图判定。本次要求的新增拒因 0 已满足，没有放宽有图遮罩或 sr-only 例外。

本轮只重跑 T-190 的 14 站；没有重跑 T-184／T-186，也不把上节的旧统计冒称本轮结果。此离线技术结果不证明模型事实核对、审美或独立复审通过。

#### 保留的边界与交付

- **P2-2：已知代价，不修。** 来源是 review1 报告的 F／B 对照及 T-196 的完整分片门禁：生成文字的 ::first-line 只改字重／字号时，选择器匹配仍使实际分片样式无法确认；::first-letter 的相应变化仍可能使快照完整性无法确认。报告在 22aa7e3 与 55fb6f1 上都记录三档保守拒收，不归因本次 mask 误拒。负责人本轮明确保留该边界；本轮没有重跑这四个独立 F／B 输入，未改 `uncertainFirstLine` 或 `readGeneratedLayout`，已运行既有 T-196 回归，不能以截图清晰为由绕过完整性门禁。
- **backdrop-filter：白名单之外的已知缺口，不修。** 来源为 review1 的 A 核对与“已知缺口”一节；它不是 filter 别名，不在本票五类统一规则内。该报告只确认未被本白名单统一拦截，两个标准属性样本的文字仍清晰，不能据此声称已复现不可读漏判。本轮不扩展类别，不添加兼容或豁免路径。

本轮 P2-1 授权范围 **PASS**，spec 与 AGENTS 同步，project-map 无问题或过期文档。旧失败与新红态完整保留，主工作区 artifacts／.sitecraft-data 只读。未跑全量、runner 回归、build、真实模型或评估；未开审查／盲评实例，未读 .env／.env.local，未碰 3034，未使用 rm，未推送或 force-push。自建服务均在结束后关闭。保留 tsconfig.json 的既有 Next 自动改动，不纳入提交；使用显式路径 git add，提交保留指定 Co-Authored-By。最终本地 SHA 随交付回报；独立复审与合并后主线验证继续交主控，本票不关闭。

### 主控验收与关闭

执行主控，2026-10-20 EDT。窄复审一轮，新实例（gpt-6.1-sol high）。

- review1 NO_GO：在 49 个以上输入中，五类写法里凡是实际生效的都没有被测量放行。P2-1 是本次新增的误拒：mask 判断拿整个简写字符串和 none 比较，导致只设 mask-size、mask-mode、mask-position 或 `none, none` 列表的正常文字被拒收。P2-2 是父版已有的保守拒收，即生成文字的首行或首字母只改字重、字号，来自 T-196 的完整分片门禁，记为已知代价。backdrop-filter 不在五类白名单内，记为已知缺口。
- 按构思主控决定（2026-10-20），P2-1 修完不再复审，由执行主控核对三项，均满足：① 7 个无图遮罩输入（review1 的 5 个加执行者补的 2 个）在 55fb6f1 上三档被拒，2e06ade 上三档通过；② webkit-mask-shorthand、webkit-mask-image-generated、mask-shorthand-ancestor 三个有图遮罩输入仍拒收（`tests/t199-contrast-effects.test.ts` 62/62，本人在 2e06ade 上重跑）；③ T-190 的 14 站 129 个页面视口与 55fb6f1 对比，新增拒因 0。
- 分支 `t199-contrast-effects-whitelist`（`2e06ade`）以 `--no-ff` 合并为 `7202ec6`。主线验证在合并后的 `7202ec6` 上运行，2026-10-20 11:07:00–11:22:36 EDT，运行前停了 3034 服务，期间没有其他浏览器测试进程。typecheck、runner 回归、build 均退出 0；全量 1003/1003 通过，无失败、取消或跳过。日志见 `artifacts/main-verify-7202ec6/`，标准入口目录 `artifacts/t167/test-run-1792508838070-8741/`。
