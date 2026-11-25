---
id: T-226
title: 解决生成站风格雷同与页面同质化：配方化风格、滑杆解耦与跨风格盲评机制
type: decide
status: closed
blocked_by: []
claimed_by: Antigravity
supersedes:
---

## Question

已上线的 4 套风格缩略图与公开真实样品看起来像同一个模板（换公司、换风格都高度撞脸）。在不放松事实核对、安全底线和可测量布局检查的前提下，问题具体出在哪些代码与规范上，如何分阶段改造并经独立跨模型盲评验证？

## 问题证据（逐项核查真实产物）

1. **4 张已上线的风格缩略图（[public/style-previews/](../../public/style-previews/)）**：
   - `precision.webp`、`documentary.webp`、`editorial.webp`、`neighborly.webp` 全部采用「约 64–68px 浅底单行顶栏（左企业名、右 2–4 个文字导航、1px 底边线）」；
   - 首屏高度趋同：几乎都是「左上小号眉题（kicker）→ 左对齐黑体 H1 → 1–2 行说明 → 单个实心矩形按钮 → 1px 横线 → 二比一双栏」；
   - 配色与字体收敛：`documentary`、`editorial`、`neighborly` 三者底色全落在暖米白，三者都出现相似的铁锈红／赭褐按钮或强调色；文字均为系统默认黑体。
2. **6 套公开真实样品（[landing/samples/](../../landing/samples/)）的 HTML/CSS 对照**：
   - **底色收敛**：`restaurant`（`#F8F2E8`）、`education`（`#f7f3ea`）、`design`（`#faf6ee`）、`tea`（`#f8f4e9`）四套几乎同为暖纸白，仅 `molding`（`#ffffff`）与 `export`（`rgb(244, 246, 247)`）偏白灰；**0 套深色全域画布**、**0 套高对比纯黑白粗框网格**；
   - **容器与顶栏克隆**：全部使用 `max-width: 1080–1160px` 居中容器 + `min-height: 64–68px` 单行两端对齐顶栏 + `1px solid` 底边线；
   - **区块套路与沿革模块克隆**：`restaurant`（`.entry--lead` + 2 列 `.entry-grid`）、`education`（`.cat-lead` + 2 列 `.cat-row`）、`design`（`.svc-feature` + 2 列 `.svc-pair`）复刻同一「上 1 宽卡 + 下 2 平分栏」排法；`restaurant`、`design`、`tea`、`precision` 的沿革／动态全部写成「左固定窄列年份 + 右单句 + `1px solid` 顶边线」；
   - **字体回退失效**：6 套正文全部是 16px 系统黑体；`export`/`restaurant` 虽然写了 `"Songti SC", STSong, SimSun, serif`，但漏写了 Linux/Docker 实际预装的 `"Noto Serif CJK SC"` / `"Source Han Serif SC"`，跨平台衬线表现弱且正文中英全无字体变化。
3. **本地历史站点数据统计（`.sitecraft-data/code-sites/`）**：
   - 共 372 条站点记录（140 站有生成版本），凡带有 `preferences` 的 **320 站**，滑杆全为 `{layout: 5, density: 6}`（无一例外），其中 `auto` 189、`precision` 61、`documentary` 39、`editorial` 16、`neighborly` 15。

## 根因定位（已对照源码与规则核实）

1. **核心规范权重压倒风格，且把页头与配色一刀切写死**：
   - `lib/code-site-model.ts`（第 21–30 行 `rules()`）每次将 `skills/site-code-core/SKILL.md`（约 5.1KB）+ `SKELETONS.md`（约 3.8KB）+ `frontend-less-ai-tone/SKILL.md`（约 2.3KB）共约 11.2KB 共用规则放在前部，而单个风格 `SKILL.md` 仅 1.3–2.1KB；
   - `skills/site-code-core/SKILL.md` 第 18、22 行直接限制所有风格：**「首屏导航桌面一行，高度不超过 72px」「选择一个强调色和中性底色」「每页需要入口时只设一个主要入口」**。这三条把居中刊头、双层导航栏、左侧目录索引、深色画布、多强调对比块等结构一次性封死，只剩「64px 顶栏 + 浅底 + Kicker/H1/单按钮 + 1px 横线」这一条安全窄缝。
2. **4 个风格文件 80% 以上是逐字复制的防御套话，真正风格配方极薄**：
   - 为配合 `lib/code-site-model.ts` 第 232 行 `writeLocalEdit()` 只截取风格文件第一段（`.split('\n\n')[0]`），历史修复把窄屏 `nowrap`、表格 `caption/thead/tbody/tfoot` 块级化、条件贴条目等通用规则全部塞进每个风格的第一段；
   - 结果每个风格真正有区分度的句子只剩两三句抽象形容（「冷静、精确」「浅米底、深褐字」），既没有具体的明度／色相角色 token、字阶比、页头／首屏原型，也没有**显式的反套路禁令**（如禁止再画 Kicker + 左对齐 H1 + 单按钮）。
3. **滑杆中档规则在默认位置覆盖并抹平风格自带尺度（`lib/code-site-styles.ts` 第 30–48 行）**：
   - `codeSliderRules()` 开头写明「覆盖风格默认尺度」，而 `layout=5, density=6` 落入第 2 档（4–7）。因此无论选 `documentary`（风格默认 8/10, 4/10）还是 `editorial`，在系统提示末尾都会被统一改写为**「主次栏约为二比一… 桌面区块上下留白约 48–64px」**，把风格原生比例与节奏抹平。
4. **已有 4 种风格同处「浅底安静目录」同一象限，且同风格内无子变体**：
   - 现有 4 种风格只有明度微差的白／米白底，缺乏暗色展示画布、瑞士强网格编号索引、满幅匾额／双栏价目牌等显著不同视觉语法；同一风格面对不同公司也不提供子色板或首屏骨架轮换，两家公司选同一风格必撞色撞型。
5. **评估盲评体系漏检「跨风格撞脸」（`scripts/eval-set-report.ts` 与 `scripts/eval-new-route.ts`）**：
   - `eval-new-route.ts` 第 68 行默认只跑 `precision` 与 `documentary` 两种接近的风格，且全设为 `layout: 5, density: 6`；
   - `eval-set-report.ts` 第 278–286 行生成 `review/company` 时只在**同一风格内部**两两配对，从不把不同风格摆在一起检查是否像同一模板；第 178 行提示词还写着「配色或字体接近不等于同一模板」。
6. **CSS 清理器已知缺陷加剧页面发白（`T-223` 第 6 条）**：
   - `lib/code-site-check.ts` 第 26–38 行 `safeCss` 在 Chrome 154 下将「`background: var(--x)` 后跟同族长属性」序列化为空声明（已在 `landing/samples/tea/` 实发），令本应分出底色层次的区块变白。该点属 `T-223` 代码缺陷，应在第二阶段实跑前修复。

## 分阶段方案

### 第一阶段：提示架构重构、设计配方化、新增候选风格与跨风格盲评包（0 真实模型 token、0 硬约束/检查放宽、0 新素材/依赖）

1. **解耦核心规范与局部修改合同**：
   - 将窄屏断行、表格字段行、事实条件贴条目等通用规则收敛回 `skills/site-code-core/SKILL.md` 与 `skills/site-code-core/LOCAL-EDIT.md`，禁止在各风格 `SKILL.md` 重复堆砌防御套话；
   - 修订 `skills/site-code-core/SKILL.md` 第 18、22 行中过度同质化的一刀切条款（移除「首屏导航桌面一行、高度不超过 72px」「中性底色加单一强调色」「只设一个入口」的统一造型束缚），改为「导航栏形态、底色体系、字阶比例与首屏构图由所选风格配方决定；核心规范只守事实、无动效、对比度、三档不溢出不重叠、列表可测量矩形背景与系统部件协议」。
   - 保留 `AGENTS.md` 中的全部「生成路径的硬约束」和提交入口检查逻辑**一字不动**。
2. **把现有 4 套风格重写为可执行「设计配方」并加入风格内分化**：
   - 每套风格第一段写清：**色彩角色区（底面／文字／主强调／次表面，要求高对比余量与明确的色板选项）**、**字体栈（含跨平台 macOS/Windows/Linux CJK 回退如 `Noto Serif CJK SC` 与等宽数字栈）**、**专属页头形态（如左侧索引边栏、居中刊头、通栏色带条等，彼此错开）**、**首屏构图与区块分隔语言**，以及**反雷同禁令**（按风格错开，禁止无条件退回「左上 Kicker + H1 + 短导语 + 单按钮 + 1px 横线」）；
   - 修复 `lib/code-site-styles.ts` 的 `codeSliderRules()`：滑杆处于中间档（4–7）或等于风格自带尺度时不覆写风格本身的版式比例与留白节奏，仅在 1–3（规整／疏朗）或 8–10（大胆／紧凑）时作为显式用户覆盖；
   - 在写页提示（或按风格配方的 2–3 套经对比度验算的色板／页头变体）里显式要求根据公司业务特性择其一，避免同风格不同公司都落到同一种铁锈红与同一组栏宽。
3. **新增 3 个强对比象限的 `pending` 候选风格（经 `SITECRAFT_EVAL_STYLES` 隔离评估）**：
   - `darkroom`（**暗色展陈**）：深墨炭画布（底色 `#121518`–`#1a1f24`，正文 `#edf0f3`，单信号色 `#f59e0b` 或 `#38bdf8` 均已核算 4.5:1+ 对比度），无边框大图／大参数指标首屏，直角实色列表背景守 `T-208`；
   - `indexgrid`（**瑞士索引**）：高反差纯白纸（`#ffffff`）与浓黑（`#111111`）2px/3px 外露结构网格线、双栏或左侧目录带、等宽数字索引与表头重墨反白，禁止圆角与柔和浅灰卡片；
   - `craftposter`（**风物招牌**）：顶栏采用通栏深主色或暖墨色招牌匾额（居中双层或对称信息条）配大字重横额首屏与双线框价目／日程票面排法（区别于 `neighborly` 的柔和分栏）。
   - 三者均登记 `preview: { status: 'pending' }`，未通过独立盲评绝不向普通进程或 `auto` 暴露。
4. **评估集升级「跨风格／全池不雷同」盲评机制（`scripts/eval-set-report.ts` 与 `scripts/eval-new-route.ts`）**：
   - 在保留现有 `review/mixed`、`review/company`（改名为同风格换公司）与 `comparison-review` 之外，新增 `review/diversity` 盲评包：
     - **跨风格成对题**：同一公司（或不同公司）分别用不同风格生成，两张匿名 1440+375 截图配对判定 `sameTemplate: true/false`；
     - **全池同模板归簇题**：一组 6–8 张涵盖不同公司与风格的匿名首页图，要求盲评者基于真实版式（页头结构、首屏语法、配色与底面、分隔方式）把「看起来出自同一套模板」的页面归入同一簇并给出具体视觉依据；
     - 修正 `prompts.company` 对页头、首屏套路、底面明度趋同的审视引导。

### 第二阶段：受控真实模型评估、独立盲评与风格准入（需负责人批准预算后再执行）

1. 执行前先修好 `T-223` 中直接危害视觉保真与浪费修正额度的确定性缺陷（尤其第 6 条 `safeCss` 丢失 `background: var(--x)`、第 1 条日期数字等价、第 4 条 `<wbr>` 允许元素）。
2. 在本机使用 `gpt-6.2-sol`（OpenAI Responses）按批准的 `SITECRAFT_TOKEN_LIMIT` 跑受控真实探针矩阵（建议选差异最大的 3 家公司：`molding` 工业有图、`restaurant` 餐饮有图、`design` 服务无图，覆盖新旧代表风格）。
3. 交由**不同于生成模型（`gpt-6.2-sol`）的干净只读模型上下文**（若工具链无其他模型家族可用，按规则标明 `same-model review`）盲评 `paired`、`company` 与 `diversity`。
4. 通过验收的候选风格提取真实版本首屏缩略图写入 `public/style-previews/` 与 `SOURCE.md`，再在独立代码状态决定哪些 `pending` 风格升为 `ready`、旧缩略图是否以新真实版本替换。

### 第三阶段（可选备选）：系统自托管开源中文字体

- 仅当第二阶段独立盲评反馈「系统默认黑体仍导致各风格视觉质感趋同」时启用。
- 采用与 `systemBackdrops` 相同的机制（`lib/code-site-dom.ts` 与 `renderSiteCodeCss` + 导出 ZIP 本地引用，**绝不向模型开放任意外部 `@font-face` URL**），只在 `lib/code-site-styles.ts` 按风格按需挂载本地字体子集文件（`public/system-fonts/`）并记录完整 `OFL.txt`。

## 每阶段验收标准

1. **第一阶段验收（全部离线／本地确定性验证）**：
   - `npm run typecheck` 通过；
   - 新增与更新的契约测试（滑杆保留风格默认尺度、子色板／变体确定性分化、核心规范不含单一 72px/浅底限型、`pending` 候选严格隔离、`diversity` 盲评包时间防泄密与成对/归簇解盲逻辑、`tests/t221-provider-formats.test.ts`）全部通过；
   - 执行者自查不宣布审美通过。
2. **第二阶段验收（独立不同模型盲评，含「不雷同」硬门槛）**：
   - **跨风格不雷同**：跨风格配对的 `sameTemplate: true` 比例 **≤ 15%**；6–8 张匿名首页全池归簇中，被判为同一模板的最大簇规模 **≤ 2 站**；
   - **同风格换公司不雷同**：同一风格不同公司配对，`sameTemplate: true` 比例由 T-143 的 `≤ 50%` 收紧至 **≤ 33%**；
   - **质量不退化（`paired`）**：同一公司×同一原有风格的改前 vs 改后成对盲评，新版获选率 **≥ 2/3**；且提交入口底线检查一次通过率与最终保存率不低于现有基线（已知非本轮修改引入的 `T-223` 缺陷已在跑前修复）。
   - **上新门槛**：拟转 `ready` 的风格必须有真实生成版本号、576×400 WebP 缩略图及可查 `SOURCE.md`。
3. **第三阶段验收（若启动）**：
   - `public/system-fonts/` 完整保留许可证原件、离线导出 ZIP 无外链可双击加载字体、Chrome 三档对比度与行高回归全绿，且有图版 vs 无托管字体版 `paired` 盲评明显偏好托管字体版。

## 需负责人拍板的具体事项（含具体方案与数字）

1. **硬约束与检查器边界**：确认第一阶段**不改 `AGENTS.md`「生成路径的硬约束」与 `lib/code-site-check.ts` 对比度／溢出／事实／`T-208` 门禁**（只改 `skills/site-code-core/SKILL.md` 的布局造型约束与提示组装）；并确认同意同步更新旧测试 `tests/t153-style-preferences.test.ts` 与 `tests/t184-style-visual.test.ts` 中写死「仅有 4 风格 key」「中档固定发二比一/48–64px」的字面断言（`codeStyleOptions` 对普通用户的 4 个选项在中途不会私自放开）。
2. **第二阶段真实模型预算上限（第一阶段完成后另行开跑，现请先选择矩阵规模并批准 `SITECRAFT_TOKEN_LIMIT`）**：
   - 基于 `T-221`（`gpt-6.2-sol` OpenAI Responses）单站实测基线：`plan` 14–15k + `write` 18–24k + `facts` 60–85k + 偶发 1 轮 `repair` 11k ≈ **10.5–13.5 万 token／站**（3–4 次调用）。
   - **方案 A（最小探针，6 站）**：2 家公司（`molding`、`restaurant`）× 1 原有风格对比（2 站）+ 3 个新候选风格与 1 个重做原有风格（4 站），预计 **18–24 次调用**，显式设 `SITECRAFT_TOKEN_LIMIT=850000`（85 万 token）。
   - **方案 B（交叉探针，9 站）**：3 家跨行业公司（`molding` 有图、`restaurant` 有图、`design` 无图）× 3 组强对照（重做原有 1 + 新候选 2），预计 **27–36 次调用**，显式设 `SITECRAFT_TOKEN_LIMIT=1250000`（125 万 token）。
   - 同时请确认：**现有本地预算网关 `scripts/t153-real-budget.ts` 目前第 44–47、79 行写死了 `deepseek-flash` 与 `https://api.deepseek.com` 的 `/chat/completions`**。若第二阶段用 `gpt-6.2-sol`（OpenAI Responses）按规则走预算网关，是否授权在 `T-228` 中为其增加 `openai-responses`（`/responses`、按 `max_output_tokens` 预留及凭据脱敏）的等价记账门禁？
3. **第三阶段备选开源字体清单（本轮不引入，请确认是否先留待第二阶段盲评结果后再决定）**：
   - **Noto Serif CJK SC**（`googlefonts/noto-cjk` v2.003，**SIL OFL-1.1**，Bold/SemiBold 常用汉字子集 WOFF2 约 1.5–2.2 MB）；
   - **LXGW WenKai（霞鹜文楷）**（`lxgw/LxgwWenKai` v1.500，**SIL OFL-1.1**，Bold 子集 WOFF2 约 1.4 MB）；
   - **JetBrains Mono**（`JetBrains/JetBrainsMono` v2.304，**SIL OFL-1.1**，拉丁与数字表格子集 WOFF2 约 35 KB）。
4. **新增依赖**：无（全程 **0 新增 npm 依赖**）。

## 风险与不做什么

- **风险**：深色底（`darkroom`）或高反差纯黑白粗框（`indexgrid`）更容易在次级灰字或嵌套列表处触发 4.5:1 对比度与 `T-208` 无法测量拒收——应对是在风格配方直接提供经过对比度核验（>= 7:1 正文、>= 4.5:1 次级说明）的精确 hex 色值，并在配方中硬性注明列表/有底色块一律使用 `border-radius: 0` 直角实色。
- **不做什么**：
  - 不放松事实核对与逐字出处验真；
  - 不引入前端 JS 交互、滚动视差或 CSS 过渡动画（保持 T-104/T-192 无动效边界）；
  - 不从外部 CDN 加载 Google Fonts 或第三方 CSS/JS；
  - 不把未经真实生成与独立盲评的风格放进普通用户列表或「帮我选」；
  - 不扩张为电商、预约、会员等非展示型页面。

## Resolution

2026-11-25（美东时间 EST），负责人全部拍板确认并关闭本决定票：

1. **硬约束、测试断言与风格隔离**：第一阶段不修改 `AGENTS.md`「生成路径的硬约束」与提交入口检查规则（`lib/code-site-check.ts`）；已核实仓库根目录不存在 `REVIEW.md`（`Test-Path REVIEW.md` 为 `False`），授权在 [T-227](T-227-style-recipes-and-core-prompts.md) 中更新 `tests/t153-style-preferences.test.ts` 与 `tests/t184-style-visual.test.ts` 里绑定旧 4 风格 key 和中档滑杆字面量的断言，正面解决「默认滑杆 5/6 在提示末尾覆盖风格自带尺度」的根因。普通用户可见的 4 个风格在独立盲评通过前保持不变；新风格统一走 `pending` + `SITECRAFT_EVAL_STYLES`。
2. **第二阶段真实模型预算上限**：采用**方案 A（6 站探针）**，显式设 `SITECRAFT_TOKEN_LIMIT=850000`（超过 850,000 token 须停下请示负责人）。授权在 [T-228](T-228-style-diversity-blind-eval.md) 中扩展 `scripts/t153-real-budget.ts` 支持 `openai-responses` 的预算预留与账本记录。
3. **字体策略**：推迟到第二阶段独立盲评之后，凭真实盲评结果再决定是否启用第三阶段开源字体方案。
4. **零新增依赖与推进顺序**：全程 0 新增依赖；后续按 `T-229` → `T-227` → `T-228` → `T-223`（至少第 1、4、5、6、7、8 条，在第二阶段真实生成前完成）→ 第二阶段真实生成与跨风格盲评 → `T-221` 剩余 5 项顺序连续推进，页面质量只认不同于生成模型的独立盲评结论。
