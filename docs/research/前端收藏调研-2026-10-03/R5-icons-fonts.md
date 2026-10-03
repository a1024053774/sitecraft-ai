# R5 图标库与字体调研（2026-10-03）

## 1. 结论摘要

- **图标现在不做全站铺开。** T-051 的“第一版不用图标”仍合理；先保留工作台 `lucide-react`，只为联系、认证这两个结构化区块做一个可撤回的局部试验，避免生成页变成通用 AI 仪表盘。
- **Amicons / Smallbits 不能直接作为生成器内置素材。** 两套都允许商业成品/客户项目，但都禁止原始文件再分发；Amicons 还把“核心 SaaS 集成”列为需单独议价，必须取得书面许可才可用于生成站。
- **若加图标，优先复用现有 Lucide（ISC）并内联 SVG。** Tabler（MIT）和 Phosphor（MIT）可作为备选；不要引入图标字体或 CDN。SVG 由区块库固定，模型只选择白名单图标 ID。
- **字体推荐先用 OFL/Apache 的英文字体 + 系统/自托管中文字体。** 工程工业：Geist/Inter + JetBrains Mono；样本目录：Manrope/Archivo + JetBrains Mono；明快：Sora + Manrope；短路径：Geist/Archivo + JetBrains Mono。
- **Fontshare 的 ITF FFL 不是生成器再分发许可。** 新版条款允许商业使用和自托管，却禁止向第三方 SaaS、模板编辑器或类似服务提供字体文件；Satoshi、Clash Display、Ranade、Cabinet Grotesk、Chillax 确认为 ITF FFL，只能作内部试排，不能直接准入发布页；Migha、Mersad 本次改为未核实。
- **当前区块库四个样子均没有外部字体加载。** `TemplateKitTokens.font` 只写系统栈；工作台自己的 `app/globals.css` 通过 Google Fonts CDN 加载 Manrope、DM Mono、Noto Sans SC，与发布页路径分开。
- **Awwwards“20 Best”页面当前实际有 27 个 Google 字体卡片；Free Fonts 集合当前抓到 159 个去重条目。** 逐项许可表以官方发布处为准；只看到 Awwwards 条目的项目明确标为“未核实”，不作为准入依据。

## 2. 资料清单

| Notion 一级标题 / 项目 | 网址 | 许可核验 | 对 SiteCraft 价值 | 备注 |
|---|---|---|---|---|
| 图标库：Minor Adventures / Amicons、Smallbits 产品页 | [minoradventures.co/#products](https://www.minoradventures.co/#products) | 产品页 + 各自许可页已读；非开源 | 中（工作台高、生成站低） | 适合研究图标系统、格式与视觉语言；生成器再分发需书面许可 |
| 图标库：The Making of Cursor's Icons | [文章](https://www.minoradventures.co/blog/the-making-of-cursors-icons) | 文章已读；许可只针对 Cursor 客户交付，非素材许可 | 高 | 可直接指导 SiteCraft 的网格、尺寸档、笔画和命名/审查流程 |
| 字体：Free Fonts - Awwwards | [集合](https://www.awwwards.com/awwwards/collections/free-fonts/) | Awwwards 仅索引；逐项见下表，未核实不准入 | 中 | 用于发现候选和视觉方向，不把“free”当许可 |
| 字体：20 Best Google Web Fonts | [文章](https://www.awwwards.com/20-best-web-fonts-from-google-web-fonts-and-font-face.html) | 官方 Google Fonts specimen / 仓库许可；见下表 | 高 | 当前页面抓到 27 项，均列出 |

### 2.1 Amicons / Smallbits 资料卡

| 项目 | 内容与格式 | 价格（页面当前值） | 许可与 SiteCraft 判断 |
|---|---|---|---|
| **Amicons 2.0** | 760 个图标、3,040 个变体；24px 网格、2px 笔画；Mono/Fill 两种填充与 Round/Sharp 两种风格；Figma components + 优化 SVG。产品页没有 React 包、icon font 或动态动画交付说明；“变体”是静态文件风格，不是运行时动效。来源：[产品页](https://amicons.design/)。 | Free：300 图标/1,200 变体；Pro 一次性：Personal $89、Startup $199、Middle Company $449、Big Company $899、Huge Company $1,799、Enterprise 定制；页面称含终身更新。 | 许可页允许无限商业/个人项目、网站/应用、客户交付并可改色；但禁止销售/分享原始文件、模板打包，也把“**SaaS platform integration where icons are core to your product**”列入需联系定制许可。生成器把 SVG 放进多个客户发布页，属于高风险的再分发/平台集成；**未取得书面定制许可前，不准入生成站**。工作台内部可按团队席位购买后使用，但不得把下载包或原始 SVG 发给客户。许可原文：[Amicons License Agreement](https://amicons.design/licenses)；条款补充：[Terms](https://amicons.design/terms)。 |
| **Smallbits** | 290+ 个像素图标，8×8 网格；官网只显示下载全部、作者、License、Terms，产品是 Figma/SVG 静态资源；没有 React 包、icon font 或动态版本说明；商店列表还标出免费 Figma 文件和 SVG。来源：[产品页](https://smallbits.design/)；[Minor Adventures 商店列表](https://minoradventures.lemonsqueezy.com/)。 | Free。 | 许可允许个人/商业项目、无限客户项目、网站/app 成品和修改；但禁止转售/再分发原始文件、再许可、模板/UI kit/theme 打包，且禁止做竞品图标集。内联 SVG 仍可被访客提取，是否构成“redistribution/sublicensing”需要作者确认；**工作台可内部试用，生成站须先书面确认**。许可原文：[Smallbits License Agreement](https://smallbits.design/license)。 |

**授权结论：** “可以用于 client work/end products”不能自动覆盖“SiteCraft 作为生成器把同一文件发给很多客户”的场景。即使只内联 path、不提供下载按钮，也应把运行时可访问的 SVG 当作再分发风险处理。

## 3. 逐项深挖

### 3.1 Cursor 图标文章：可迁移的系统方法

文章描述的是一个有所有权、有验收工具的图标系统，而不是“挑一套漂亮 SVG”：

- **尺寸档与光学尺寸：** 16px 图标在 16px 网格、1.25px 笔画，目标覆盖约 12–20px；22px 起切换到 24px 网格、1.5px 笔画，并增加细节。不能把一个 16px 图标简单放大到 32px。
- **几何规则：** 以角段和圆角为主，少用自由曲线；统一圆角端点；闭合形状优先；斜杠直接切过，不用假阴影；物体保持自然长宽比，不强行塞成正方形；有方向的构图统一“左下到右上”。
- **光学修正：** 线条交汇处做 optical break；拥挤处减细笔画；不同语义的点使用不同尺寸；重叠元素之间至少留约 3 个 16px 网格单位，避免小尺寸糊成一团。
- **两种风格与复用：** 最终交付 16/24 两档 × outline/filled 两种风格；重复出现的文件夹、箭头、徽章、加减号等由同一套母形维护。文章给出的实现是 icon font，但同时交付 SVG、字体、源 Figma 和伴随检索站。
- **新概念流程：** 先从概念词和 tags 搜索已有图标；维护“一概念一图标”的概念表，避免同一语义长出两个图标；若必须新增，至少做一个尺寸/风格组合，展平为单一路径，再通过自动化命名、codepoint、字体编译、站点数据和文档更新流水线发布。
- **迁移与验证：** Cursor 用旧 codepoint 到新图标的映射表和迁移看板，状态包含待处理、已处理、移除、已配对；在真实设备以绝对尺寸查看，而不是只在 Figma 放大检查。

**给工作台/区块库的规范建议：** 先定 `icon-id → 语义 → 24px viewBox → stroke/fill → 使用区块` 的数据表；为 16/20/24px 设清晰尺寸档，默认 1.5–2px，禁止模型自由提交 SVG；建立 concepts/aliases 表；每次新增只允许一处语义落点，并在 375/768/1440 预览检查。Cursor 的“icon font + codepoint migration”适合有大量历史引用的成熟产品，SiteCraft 新增少量区块图标时用内联 SVG 更简单。

### 3.2 开源图标候选（许可证已核实）

| 候选 | 当前/来源 | 格式与实现 | 官方许可关键事实 | 适合 SiteCraft 的用法 |
|---|---|---|---|---|
| **Lucide** | 项目已装 `lucide-react` 0.511.0（`package.json:15`；已读 `node_modules/lucide-react/package.json`） | React 组件输出 inline SVG；另有 SVG、静态包和多框架包；无内置动态版本 | 官方 README/License：[ISC](https://github.com/lucide-icons/lucide/blob/main/README.md)、[license](https://lucide.dev/license)。官方描述为可商用/个人使用。 | 工作台继续用；若区块库要加，抽取少量 path 数据进固定区块，避免让运行时模型输出 JSX/HTML。 |
| **Tabler Icons** | [官方仓库](https://github.com/tabler/tabler-icons)，当前 README 写 6,200+；24×24、2px | 原始 SVG、React/Vue/Svelte/Angular 包、sprite、webfont | 官方 README 与 [Tabler license](https://tabler.io/license) 为 MIT；MIT 允许修改、发布、再分发但保留版权/许可。 | 若需要制造业更多物件覆盖可评估；不要与 Lucide 并存为两套默认风格。优先 inline SVG，不用 webfont。 |
| **Phosphor** | [官方 React 仓库](https://github.com/phosphor-icons/react) | React/SVG；多 weight（thin/light/regular/bold/fill/duotone 等），可运行时调 size/weight/color | [MIT License](https://github.com/phosphor-icons/react/blob/master/LICENSE)；图标包与 React 包均可商用再分发，保留许可。 | 视觉表现丰富、容易显得“产品/AI”；只适合工作台或明确的明快样子，不作为四个发布样子的默认。 |

**图标格式结论：** 选 inline SVG 而不是 icon font。SVG 可继承 `currentColor`、按 token 改尺寸/颜色、可写 `aria-hidden`/label，且不会引入字体加载、Unicode 映射、基线和外部 `@font-face`；同时可以在服务端把每个图标固定成一条可审查 path 数据。图标字体只在需要兼容大量历史 codepoint 时有价值，Cursor 的场景才值得承担该复杂度。

### 3.3 现状核对与“现在加不加”

- 工作台的 `app/workspace/page.tsx:5-29` 直接导入 `lucide-react`：撤销/重做、发布、删除、上传、设备切换、主题切换、关闭等均为 Lucide React SVG；`package.json:15` 是 `^0.511.0`。
- T-051 Resolution 已写“区块库第一版不用图标”；当前 `lib/blocks/fragments/` 的服务、认证、询盘、产品区块使用文字、边线、编号和状态文字，没有 icon slot；这正是避免模板味的原因。
- **最值得做的小范围：** `contact` 的邮箱/电话/地址、`certifications` 的证书状态行。它们是结构化语义，图标可作为低对比、非主视觉的辅助锚点。`services` 已有步骤编号，“再加一排通用齿轮/箭头”收益小；`products` 参数表、hero 规格条不加图标，避免每个 SKU 都变成卡片模板。
- **是否已经到了？** 还没有到“全站加图标”；但已经到了做一个局部、可盲评的 contact/certification 试验：同一视觉族、同一套 SVG、无外部资源，比较“文字版 vs 图标版”在四样子和三档宽度的绝对质量。试验通过后再开 build 票，不改变 T-051 的第一版默认结论。

### 3.4 Awwwards 两页字体逐项清单

#### Awwwards Free Fonts（当前 5 页、159 个去重条目）

Awwwards 是发现页，不是字体许可方；下表的 Awwwards 链接只用于定位原条目。只有标成“已核实”的行才引用了字体官方发布处；其余行必须在准入前打开原作者/发行方的 LICENSE，不能按 “Free” 推断商用或再分发。

| # | 字体/条目 | 来源 | 许可 |
|---|---|---|---
| 1 | Galgo Condensed by Giulia Boggio | [Awwwards条目](https://www.awwwards.com/inspiration/galgo-condensed) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 2 | Aalto Display Font | [Awwwards条目](https://www.awwwards.com/inspiration/aalto-display-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 3 | Unique Typeface | [Awwwards条目](https://www.awwwards.com/inspiration/unique-typeface) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 4 | Geist by Vercel | [Awwwards条目](https://www.awwwards.com/inspiration/geist-by-vercel) | OFL 1.1（已核实）（[官方来源](https://vercel.com/font)） |
| 5 | Round 8 by atipo | [Awwwards条目](https://www.awwwards.com/inspiration/round-8-by-atipo) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 6 | NOHEMI Typeface | [Awwwards条目](https://www.awwwards.com/inspiration/nohemi-typeface) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 7 | Absans Font | [Awwwards条目](https://www.awwwards.com/inspiration/absans-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 8 | Dirtyline 36Daysoftype 2022 | [Awwwards条目](https://www.awwwards.com/inspiration/dirtyline-36daysoftype-2022) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 9 | Humane | [Awwwards条目](https://www.awwwards.com/inspiration/humane) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 10 | Pangram Sans Rounded - Free Font | [Awwwards条目](https://www.awwwards.com/inspiration/pangram-sans-free-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 11 | Junicode bold condensed | [Awwwards条目](https://www.awwwards.com/inspiration/junicode-bold-condensed) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 12 | PP Mori | [Awwwards条目](https://www.awwwards.com/inspiration/pp-mori) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 13 | Saint Regus - Free Display Typeface | [Awwwards条目](https://www.awwwards.com/inspiration/saint-regus-free-display-typeface) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 14 | Manuscribe Free | [Awwwards条目](https://www.awwwards.com/inspiration/manuscribe-free) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 15 | Harmond free display typeface | [Awwwards条目](https://www.awwwards.com/inspiration/harmond-free-display-typeface) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 16 | Wagon Display Typeface | [Awwwards条目](https://www.awwwards.com/inspiration/wagon-display-typeface) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 17 | Milky Walky | [Awwwards条目](https://www.awwwards.com/inspiration/milky-walky) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 18 | Ranade | [Awwwards条目](https://www.awwwards.com/inspiration/ranade) | ITF Free Font License 2.0（已核实；商用免费但不可再分发/不可供第三方 SaaS 使用）（[实际许可页](https://fontshare.com/licenses/itf-ffl)） |
| 19 | Bigilla display serif typeface designed by Jérémie Gauthier | [Awwwards条目](https://www.awwwards.com/inspiration/bigilla-display-serif-typeface) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 20 | Mamen Chisa | [Awwwards条目](https://www.awwwards.com/inspiration/mamen-chisa) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 21 | Mango Grotesque Variable Font | [Awwwards条目](https://www.awwwards.com/inspiration/mango-grotesque-variable-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 22 | Vegawanty font | [Awwwards条目](https://www.awwwards.com/inspiration/vegawanty-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 23 | Bosch Display free font | [Awwwards条目](https://www.awwwards.com/inspiration/bosch-display-free-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 24 | Neue Metana Next | [Awwwards条目](https://www.awwwards.com/inspiration/neue-metana-next) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 25 | Flaviotte Font | [Awwwards条目](https://www.awwwards.com/inspiration/flaviotte-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 26 | Canobis – Psychedelic Typeface | [Awwwards条目](https://www.awwwards.com/inspiration/canobis-psychedelic-typeface) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 27 | IF Durer Font | [Awwwards条目](https://www.awwwards.com/inspiration/if-durer-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 28 | HK Grotesk Wide | [Awwwards条目](https://www.awwwards.com/inspiration/hk-grotesk-wide) | OFL 1.1（已核实）（[官方来源](https://github.com/drinking-code/HK-Grotesk-Web)） |
| 29 | OffBit - Free Font | [Awwwards条目](https://www.awwwards.com/inspiration/offbit-free-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 30 | Vercetti Regular Font | [Awwwards条目](https://www.awwwards.com/inspiration/vercetti-regular-font) | Licence Amicale V.0.2（已核实；商用免费，字体文件/衍生物不得改用其他许可）（[官方来源](https://filipposfragkogiannis.com/fonts/vercetti-regular/)） |
| 31 | Wriggle - Free Font | [Awwwards条目](https://www.awwwards.com/inspiration/wriggle-free-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 32 | MONIQA TYPEFACE by Rajesh Rajput | [Awwwards条目](https://www.awwwards.com/inspiration/moniqa-typeface-by-rajesh-rajput) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 33 | Projekt Blackbird - Free Sans Serif Font | [Awwwards条目](https://www.awwwards.com/inspiration/projekt-blackbird-free-sans-serif-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 34 | Remboy Typeface | [Awwwards条目](https://www.awwwards.com/inspiration/remboy-typeface) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 35 | Black Sansa Thin - Free Retro Display Font | [Awwwards条目](https://www.awwwards.com/inspiration/black-sansa-thin-free-retro-display-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 36 | Heming a Free Variable Monotype Font | [Awwwards条目](https://www.awwwards.com/inspiration/heming-a-free-variable-monotype-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 37 | DX Sitrus display font | [Awwwards条目](https://www.awwwards.com/inspiration/dx-sitrus-display-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 38 | Magilio - Free serif font | [Awwwards条目](https://www.awwwards.com/inspiration/magilio-free-serif-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 39 | Fornite Light - Free Serif Font | [Awwwards条目](https://www.awwwards.com/inspiration/fornite-light-free-serif-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 40 | Resist Sans Neo-Grotesque Font | [Awwwards条目](https://www.awwwards.com/inspiration/resist-sans-neo-grotesque-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 41 | Comic Cat | [Awwwards条目](https://www.awwwards.com/inspiration/comic-cat) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 42 | Gavency | [Awwwards条目](https://www.awwwards.com/inspiration/gavency) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 43 | Chillax | [Awwwards条目](https://www.awwwards.com/inspiration/chillax) | ITF Free Font License 2.0（已核实；商用免费但不可再分发/不可供第三方 SaaS 使用）（[实际许可页](https://fontshare.com/licenses/itf-ffl)） |
| 44 | Cotta - Free Elegant Serif Font | [Awwwards条目](https://www.awwwards.com/inspiration/cotta-free-elegant-serif-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 45 | Clash Display Variable Font | [Awwwards条目](https://www.awwwards.com/inspiration/clash-display) | ITF Free Font License 2.0（已核实；商用免费但不可再分发/不可供第三方 SaaS 使用）（[实际许可页](https://fontshare.com/licenses/itf-ffl)） |
| 46 | Cabinet Grotesk Variable Font | [Awwwards条目](https://www.awwwards.com/inspiration/cabinet-grotesk-variable-font) | ITF Free Font License 2.0（已核实；商用免费但不可再分发/不可供第三方 SaaS 使用）（[实际许可页](https://fontshare.com/licenses/itf-ffl)） |
| 47 | São Torpes Free Display Font | [Awwwards条目](https://www.awwwards.com/inspiration/sao-torpes-free-display-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 48 | Goku | [Awwwards条目](https://www.awwwards.com/inspiration/goku) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 49 | Migha - Free font | [Awwwards条目](https://www.awwwards.com/inspiration/migha-free-font)；[实际发布页](https://themeui.net/migha-free-variable-font/) | **未核实**（本次未读到原作者许可；Awwwards 的 Visit Resource 指向 ThemeUI，不是 Fontshare） |
| 50 | Satoshi Variable Font | [Awwwards条目](https://www.awwwards.com/inspiration/satoshi-variable-font) | ITF Free Font License 2.0（已核实；商用免费但不可再分发/不可供第三方 SaaS 使用）（[实际许可页](https://fontshare.com/licenses/itf-ffl)） |
| 51 | Branch Modern Ligature | [Awwwards条目](https://www.awwwards.com/inspiration/branch-modern-ligature) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 52 | Rayken Stylish Serif-Font | [Awwwards条目](https://www.awwwards.com/inspiration/rayken-stylish-serif-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 53 | Meshed Display | [Awwwards条目](https://www.awwwards.com/inspiration/meshed-display) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 54 | Baunk font | [Awwwards条目](https://www.awwwards.com/inspiration/baunk-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 55 | Rockstar Display | [Awwwards条目](https://www.awwwards.com/inspiration/rockstar-display) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 56 | OTF Glusp: Free Display Font | [Awwwards条目](https://www.awwwards.com/inspiration/otf-glusp-free-display-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 57 | HK Grotesk Regular | [Awwwards条目](https://www.awwwards.com/inspiration/hk-grotesk-regular) | OFL 1.1（已核实）（[官方来源](https://github.com/drinking-code/HK-Grotesk-Web)） |
| 58 | THUNDER typeface | [Awwwards条目](https://www.awwwards.com/inspiration/thunder-typeface) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 59 | Bigilla: A display serif typeface with ligatures and alternates | [Awwwards条目](https://www.awwwards.com/inspiration/bigilla-a-display-serif-typeface-with-ligatures-and-alternates) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 60 | Calfine - Free Font | [Awwwards条目](https://www.awwwards.com/inspiration/calfine-free-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 61 | Avenue Mono | [Awwwards条目](https://www.awwwards.com/inspiration/avenue-mono) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 62 | Mersad - Free Variable Typeface | [Awwwards条目](https://www.awwwards.com/inspiration/mersad-free-variable-typeface)；[实际发布页](https://www.behance.net/gallery/145150505/Mersad-Free-Variable-Typeface) | **未核实**（本次未读到原作者许可；Awwwards 的 Visit Resource 指向 Behance，不是 Fontshare） |
| 63 | Maghfirea - Free Font | [Awwwards条目](https://www.awwwards.com/inspiration/maghfirea-free-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 64 | Newake sans-serif font | [Awwwards条目](https://www.awwwards.com/inspiration/newake-sans-serif-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 65 | Neutral Face - Sans serif free font | [Awwwards条目](https://www.awwwards.com/inspiration/neutral-face-sans-serif-free-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 66 | Triakis - Free Regular Weight Font | [Awwwards条目](https://www.awwwards.com/inspiration/triakis-free-regular-weight-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 67 | Super Duper - free font | [Awwwards条目](https://www.awwwards.com/inspiration/super-duper-free-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 68 | Harmony - Free Serif typeface | [Awwwards条目](https://www.awwwards.com/inspiration/harmony-free-serif-typeface) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 69 | Nighty - Free Font | [Awwwards条目](https://www.awwwards.com/inspiration/nighty-free-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 70 | Creme Espana - Free calligraphy  font | [Awwwards条目](https://www.awwwards.com/inspiration/creme-espana-free-calligraphy-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 71 | Kenoky & Coffekan - Free Fonts | [Awwwards条目](https://www.awwwards.com/inspiration/kenoky-coffekan-free-fonts) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 72 | Eskool - free display typeface | [Awwwards条目](https://www.awwwards.com/inspiration/eskool-free-display-typeface) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 73 | WILD WORD - Bold free font | [Awwwards条目](https://www.awwwards.com/inspiration/wild-word-bold-free-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 74 | Rebeqa - Free Font | [Awwwards条目](https://www.awwwards.com/inspiration/rebeqa-free-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 75 | Subjectivity - Display geometric font family | [Awwwards条目](https://www.awwwards.com/inspiration/subjectivity-free-display-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 76 | Luthon Southard Font Duo | [Awwwards条目](https://www.awwwards.com/inspiration/luthon-southard-font-duo) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 77 | Neue Metana font by Dirtyline Studio | [Awwwards条目](https://www.awwwards.com/inspiration/neue-metana-font-by-dirtyline-studio) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 78 | Sonder Regular - Free Font | [Awwwards条目](https://www.awwwards.com/inspiration/sonder-regular-free-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 79 | Fogtwo No5 by gluk | [Awwwards条目](https://www.awwwards.com/inspiration/fogtwo-no5-by-gluk) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 80 | Free Faces - Free typefaces collection | [Awwwards条目](https://www.awwwards.com/inspiration/free-faces-free-typefaces-collection) | 非单字体资源；不作素材许可结论 |
| 81 | Kate typeface designed by Jérémie Gauthier | [Awwwards条目](https://www.awwwards.com/inspiration/kate-typeface) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 82 | Karen Funny Cartoon Font | [Awwwards条目](https://www.awwwards.com/inspiration/karen-funny-cartoon-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 83 | Tropikal Typeface font | [Awwwards条目](https://www.awwwards.com/inspiration/tropikal-typeface-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 84 | Archia regular font | [Awwwards条目](https://www.awwwards.com/inspiration/archia-regular-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 85 | SK Falcon typeface | [Awwwards条目](https://www.awwwards.com/inspiration/sk-falcon-typeface) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 86 | Dx Rigraf font by Dirtyline Studio | [Awwwards条目](https://www.awwwards.com/inspiration/dx-rigraf-font-by-dirtyline-studio) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 87 | Disket Mono - Display monospaced, grid based typeface | [Awwwards条目](https://www.awwwards.com/inspiration/disket-mono-display-monospaced-grid-based-typeface) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 88 | Fontshare - Type Foundry | [Awwwards条目](https://www.awwwards.com/inspiration/fontshare-type-foundry) | 非单字体资源；不作素材许可结论 |
| 89 | The Polite Type - Educational free font | [Awwwards条目](https://www.awwwards.com/inspiration/the-polite-type-educational-free-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 90 | Elanor Font by Dirtyline Studio | [Awwwards条目](https://www.awwwards.com/inspiration/elanor-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 91 | Archivo Narrow Regular - Free Font | [Awwwards条目](https://www.awwwards.com/inspiration/archivo-narrow-regular-free-font) | OFL 1.1（已核实，Google Fonts）（[官方来源](https://fonts.google.com/specimen/Archivo+Narrow)） |
| 92 | Intro Script Font | [Awwwards条目](https://www.awwwards.com/inspiration/intro-script-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 93 | Kalmansk - free font | [Awwwards条目](https://www.awwwards.com/inspiration/kalmansk-free-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 94 | Casta font | [Awwwards条目](https://www.awwwards.com/inspiration/casta-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 95 | Scalter free typeface | [Awwwards条目](https://www.awwwards.com/inspiration/scalter-free-typeface) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 96 | Shrimp free sans serif font | [Awwwards条目](https://www.awwwards.com/inspiration/shrimp-free-sans-serif-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 97 | Vinson free font | [Awwwards条目](https://www.awwwards.com/inspiration/vinson-free-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 98 | Nafta free font by Krisjanis Mezulis | [Awwwards条目](https://www.awwwards.com/inspiration/nafta-free-font-by-krisjanis-mezulis) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 99 | SK-Modernist: A Geometric Avant Garde like typeface | [Awwwards条目](https://www.awwwards.com/inspiration/sk-modernist-a-geometric-avant-garde-like-typeface) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 100 | Rolest script font | [Awwwards条目](https://www.awwwards.com/inspiration/rolest-script-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 101 | Pulchella free font | [Awwwards条目](https://www.awwwards.com/inspiration/pulchella-free-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 102 | Resin free font | [Awwwards条目](https://www.awwwards.com/inspiration/resin-free-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 103 | Tribes free font | [Awwwards条目](https://www.awwwards.com/inspiration/tribes-free-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 104 | Lincoln/MITRE retro computer font | [Awwwards条目](https://www.awwwards.com/inspiration/lincoln-mitre-retro-computer-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 105 | Ramona free display font | [Awwwards条目](https://www.awwwards.com/inspiration/ramona-free-display-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 106 | Lezerno - Uppercase Free Font | [Awwwards条目](https://www.awwwards.com/inspiration/lezerno-free-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 107 | Maragsâ - Display typeface | [Awwwards条目](https://www.awwwards.com/inspiration/maragsa-display-typeface) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 108 | Mak free font | [Awwwards条目](https://www.awwwards.com/inspiration/mak-free-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 109 | Longline Quart display font | [Awwwards条目](https://www.awwwards.com/inspiration/longline-quart-display-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 110 | Leiko free font | [Awwwards条目](https://www.awwwards.com/inspiration/leiko-free-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 111 | Voklea - Free Display Font | [Awwwards条目](https://www.awwwards.com/inspiration/voklea-free-display-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 112 | Faune typeface family | [Awwwards条目](https://www.awwwards.com/inspiration/faune-typeface-family) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 113 | Bagnard Sans | [Awwwards条目](https://www.awwwards.com/inspiration/bagnard-sans) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 114 | Le Super Serif Typeface | [Awwwards条目](https://www.awwwards.com/inspiration/le-super-serif-typeface) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 115 | Nimbus Sans - The Real Free Helvetica | [Awwwards条目](https://www.awwwards.com/inspiration/nimbus-sans-the-real-free-helvetica) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 116 | Supremacy - Free Display Typeface | [Awwwards条目](https://www.awwwards.com/inspiration/supremacy-free-display-typeface) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 117 | MAK. | [Awwwards条目](https://www.awwwards.com/inspiration/mak) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 118 | Variablefonts.io - How to start with variable fonts | [Awwwards条目](https://www.awwwards.com/inspiration/variablefonts-io-how-to-start-with-variable-fonts) | 非单字体资源；不作素材许可结论 |
| 119 | Restora - old style serif font | [Awwwards条目](https://www.awwwards.com/inspiration/restora-old-style-serif-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 120 | Obrazec | [Awwwards条目](https://www.awwwards.com/inspiration/obrazec) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 121 | Bagnard Regular - Free Font | [Awwwards条目](https://www.awwwards.com/inspiration/bagnard-regular-free-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 122 | Okta Neue | [Awwwards条目](https://www.awwwards.com/inspiration/okta-neue) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 123 | Centrion - Free Font | [Awwwards条目](https://www.awwwards.com/inspiration/centrion-free-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 124 | Moustique serif typeface | [Awwwards条目](https://www.awwwards.com/inspiration/moustique-serif-typeface) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 125 | Elegant display typeface - Stanley | [Awwwards条目](https://www.awwwards.com/inspiration/elegant-display-typeface-stanley) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 126 | Dx Gaster - Free Serif Font | [Awwwards条目](https://www.awwwards.com/inspiration/dx-gaster-free-serif-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 127 | Westfalia Free Font | [Awwwards条目](https://www.awwwards.com/inspiration/westfalia-free-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 128 | Getting the Most Out of Variable Fonts on Google Fonts | [Awwwards条目](https://www.awwwards.com/inspiration/getting-the-most-out-of-variable-fonts-on-google-fonts) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 129 | Hagrid Variable Font | [Awwwards条目](https://www.awwwards.com/inspiration/hagrid-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 130 | Emberly Typeface | [Awwwards条目](https://www.awwwards.com/inspiration/emberly-typeface) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 131 | Basier Mono | [Awwwards条目](https://www.awwwards.com/inspiration/basier-mono) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 132 | Escucha (+ Consuela font duo) | [Awwwards条目](https://www.awwwards.com/inspiration/escucha-consuela-font-duo) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 133 | Telegraf Free Font | [Awwwards条目](https://www.awwwards.com/inspiration/telegraf-free-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 134 | Kenfolg serif typeface | [Awwwards条目](https://www.awwwards.com/inspiration/kenfolg-serif-typeface) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 135 | Fat Font | [Awwwards条目](https://www.awwwards.com/inspiration/fat-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 136 | Calama | [Awwwards条目](https://www.awwwards.com/inspiration/calama) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 137 | Loki - Sans Serif Brush | [Awwwards条目](https://www.awwwards.com/inspiration/loki-sans-serif-brush) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 138 | Fibre Free Vintage Font | [Awwwards条目](https://www.awwwards.com/inspiration/fibre-free-vintage-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 139 | Borsok | [Awwwards条目](https://www.awwwards.com/inspiration/borsok) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 140 | Nimitz | [Awwwards条目](https://www.awwwards.com/inspiration/nimitz) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 141 | Recollet Retro Bold Script Font | [Awwwards条目](https://www.awwwards.com/inspiration/recollet-retro-bold-script-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 142 | Salsa BT by Bastarda Design Studio | [Awwwards条目](https://www.awwwards.com/inspiration/salsa-bt-by-bastarda-design-studio) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 143 | Argesta Hairline with cool discretionary ligatures. | [Awwwards条目](https://www.awwwards.com/inspiration/argesta-hairline-with-cool-discretionary-ligatures) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 144 | VTF Lack | [Awwwards条目](https://www.awwwards.com/inspiration/vtf-lack) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 145 | Barcelony Font | [Awwwards条目](https://www.awwwards.com/inspiration/barcelony-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 146 | Made Saonara font | [Awwwards条目](https://www.awwwards.com/inspiration/made-saonara-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 147 | Inter typeface family | [Awwwards条目](https://www.awwwards.com/inspiration/inter-typeface-family) | OFL 1.1（已核实，Google Fonts）（[官方来源](https://fonts.google.com/specimen/Inter)） |
| 148 | Labour Union | [Awwwards条目](https://www.awwwards.com/inspiration/labour-union) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 149 | Cervanttis | [Awwwards条目](https://www.awwwards.com/inspiration/cervanttis) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 150 | Blaze Type - Typefaces Foundry | [Awwwards条目](https://www.awwwards.com/inspiration/blaze-type-typefaces-foundry) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 151 | Romantic Orche Script | [Awwwards条目](https://www.awwwards.com/inspiration/orche-script) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 152 | Technique Sans Free Font | [Awwwards条目](https://www.awwwards.com/inspiration/technique-sans-free-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 153 | Zoika | [Awwwards条目](https://www.awwwards.com/inspiration/zoika) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 154 | Soulcraft | [Awwwards条目](https://www.awwwards.com/inspiration/soulcraft) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 155 | Free Font: Skyscapers by Fuadhasan | [Awwwards条目](https://www.awwwards.com/inspiration/free-font-skyscapers-by-fuadhasan) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 156 | Fontshare - Free fonts Type Foundry | [Awwwards条目](https://www.awwwards.com/inspiration/fontshare-free-fonts-type-foundry) | 非单字体资源；不作素材许可结论 |
| 157 | Trispace | [Awwwards条目](https://www.awwwards.com/inspiration/trispace) | OFL 1.1（已核实，Google Fonts）（[官方来源](https://fonts.google.com/specimen/Trispace)） |
| 158 | Monument Extended font | [Awwwards条目](https://www.awwwards.com/inspiration/monument-extended-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |
| 159 | Mattone Font | [Awwwards条目](https://www.awwwards.com/inspiration/mattone-font) | 未核实（Awwwards 仅索引；原作者许可未核到，不准入） |

#### Awwwards “20 Best Google Web Fonts”（页面当前 27 个卡片）

Google Fonts 官方资料说明其新提交项目必须使用 SIL OFL 1.1；Google 字体仓库也保留 Apache-2.0 字体。以下许可按 Google Fonts 官方 specimen/仓库核对：

| # | 字体 | 官方来源 | 许可 |
|---|---|---|---|
| 1 | Sora | [Google Fonts](https://fonts.google.com/specimen/Sora) | OFL 1.1 |
| 2 | Hahmlet | [Google Fonts](https://fonts.google.com/specimen/Hahmlet) | OFL 1.1 |
| 3 | JetBrains Mono | [Google Fonts](https://fonts.google.com/specimen/JetBrains+Mono) | OFL 1.1 |
| 4 | Andada Pro | [Google Fonts](https://fonts.google.com/specimen/Andada+Pro) | OFL 1.1 |
| 5 | Epilogue | [Google Fonts](https://fonts.google.com/specimen/Epilogue) | OFL 1.1 |
| 6 | Inter | [Google Fonts](https://fonts.google.com/specimen/Inter) | OFL 1.1 |
| 7 | Encode Sans | [Google Fonts](https://fonts.google.com/specimen/Encode+Sans) | OFL 1.1 |
| 8 | Manrope | [Google Fonts](https://fonts.google.com/specimen/Manrope) | OFL 1.1 |
| 9 | Lora | [Google Fonts](https://fonts.google.com/specimen/Lora) | OFL 1.1 |
| 10 | BioRhyme | [Google Fonts](https://fonts.google.com/specimen/BioRhyme) | OFL 1.1 |
| 11 | Playfair Display | [Google Fonts](https://fonts.google.com/specimen/Playfair+Display) | OFL 1.1 |
| 12 | Archivo | [Google Fonts](https://fonts.google.com/specimen/Archivo) | OFL 1.1 |
| 13 | Roboto | [Google Fonts](https://fonts.google.com/specimen/Roboto) | Apache-2.0 |
| 14 | Cormorant | [Google Fonts](https://fonts.google.com/specimen/Cormorant) | OFL 1.1 |
| 15 | Spectral | [Google Fonts](https://fonts.google.com/specimen/Spectral) | OFL 1.1 |
| 16 | Raleway | [Google Fonts](https://fonts.google.com/specimen/Raleway) | OFL 1.1 |
| 17 | Work Sans | [Google Fonts](https://fonts.google.com/specimen/Work+Sans) | OFL 1.1 |
| 18 | Lato | [Google Fonts](https://fonts.google.com/specimen/Lato) | OFL 1.1 |
| 19 | Anton | [Google Fonts](https://fonts.google.com/specimen/Anton) | OFL 1.1 |
| 20 | Old Standard TT | [Google Fonts](https://fonts.google.com/specimen/Old+Standard+TT) | OFL 1.1 |
| 21 | Oswald | [Google Fonts](https://fonts.google.com/specimen/Oswald) | OFL 1.1 |
| 22 | Montserrat | [Google Fonts](https://fonts.google.com/specimen/Montserrat) | OFL 1.1 |
| 23 | Poppins | [Google Fonts](https://fonts.google.com/specimen/Poppins) | OFL 1.1 |
| 24 | Nunito | [Google Fonts](https://fonts.google.com/specimen/Nunito) | OFL 1.1 |
| 25 | Source Sans Pro | [Google Fonts](https://fonts.google.com/specimen/Source+Sans+Pro) | OFL 1.1 |
| 26 | Oxygen | [Google Fonts](https://fonts.google.com/specimen/Oxygen) | Apache-2.0 |
| 27 | Open Sans | [Google Fonts](https://fonts.google.com/specimen/Open+Sans) | Apache-2.0 |

Google Fonts 许可依据：[Google Fonts license-file 指南](https://github.com/googlefonts/googlefonts.github.io/blob/main/gf-guide/license-file.md)（新项目要求 OFL 1.1，仓库元数据保留 `OFL`/`APACHE2` 类型）、[Google Fonts 官方开发者页](https://developers.google.com/fonts)。OFL/Apache 均允许作为网页字体随网站/软件分发，但发布字体文件时仍需随包保留对应 LICENSE/版权与 Reserved Font Name 条款。

### 3.5 Fontshare 许可复核方法与原文证据

这次复核没有把 Fontshare 的页面标题或第三方转载当作许可原文。工具链和实际网址如下：

- 用 `web.search`/`web.open` 打开 Fontshare 家族页（例如 [Clash Display](https://www.fontshare.com/fonts/clash-display)）确认页面标注 `Closed Source / ITF Free Font License`；用终端 `python3` 的 `requests` 读取 [Fontshare API](https://api.fontshare.com/v2/fonts?limit=100) 的 `license_type`。2026-10-03 返回 `itf_ffl` 的目标家族是 Ranade、Cabinet Grotesk、Satoshi、Chillax、Clash Display；这五个没有被 API 标为 OFL。Migha、Mersad 不在该 API 清单中，不能据此判为 OFL。
- 直接打开 [ITF FFL 许可路由](https://fontshare.com/licenses/itf-ffl) 时，`web.open` 和 `requests` 都只返回 `Enable javascript to use this application`。随后用终端 `requests` 下载站点静态资源 [main.d962d2d8.js](https://fontshare.com/js/main.d962d2d8.js) 和许可路由组件 [261.d962d2d8.js](https://fontshare.com/js/261.d962d2d8.js)；原文在 `main.d962d2d8.js` 的 `lib.freeLicenses.itf_ffl.spyTable.sections`（`limitations-of-usage` / `third-party-use` 等条目），版本字段为 `Version 2.0 - 17 Aug 2026`。因此以下短引是 JS 包中许可正文的逐字片段，每处不超过 15 个英文词。
- 许可正文关键短引（来源均为 `main.d962d2d8.js` 的 `lib.freeLicenses.itf_ffl.spyTable`）：
  - “You may not provide the Font Software directly to external designers”
  - “Any third party wishing to use the Font Software must obtain their own copy”
  - “You may not host, serve, embed or otherwise make the Font Software available”
  - “through any website, application, online service, SaaS platform, design tool, template editor”
  - 同一段还写明第三方要从 Fontshare 自行取得副本并受该许可约束；这就是生成器把字体随客户发布页提供时的冲突点。
- Migha 与 Mersad 不在这次 API 返回的 Fontshare 100 家族中；Awwwards 的 Visit Resource 分别是 [ThemeUI](https://themeui.net/migha-free-variable-font/) 和 [Behance](https://www.behance.net/gallery/145150505/Mersad-Free-Variable-Typeface)。本次没有读到这两处的原始许可正文，所以两行改为“未核实”，不再贴 Fontshare FFL。

### 3.6 四个样子的当前字体栈

| 样子 / adapter | 代码位置 | 当前 `font` token | 中文现状 |
|---|---|---|---|
| 工程工业 engineering / `screwfast` | `lib/template-adapters/registry.ts:260`；色板重复同值 | `-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif` | 明确覆盖苹方、冬青/思源/微软雅黑，四个里最稳。 |
| 样本目录 catalog / `landwind` | `registry.ts:466-487` | `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif` | 没有 `Noto Sans SC`/微软雅黑显式项，中文依赖系统回退，需补中文栈。 |
| 明快 bright / `forge` | `registry.ts:136-156`，之后由 `forgeKit` 接到 `brightLook` | `ui-sans-serif,system-ui,sans-serif,"Apple Color Emoji","Segoe UI Emoji",Segoe UI Symbol,"Noto Color Emoji"` | 没有中文字体名；浏览器会自行 fallback，字面和英文宽度不可控。 |
| 灰底短路径 short-path / `tailwind-landing` | `registry.ts:353-373`；之后接到 `shortPathLook` | `ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif` | 没有 `Noto Sans SC`/苹方显式项，中文与英文高度/宽度可能漂移。 |

共同实现：`lib/blocks/fragments/base.ts:9` 用 `font-family: var(--site-font)`；`lib/blocks/compose.ts:12-28,47` 把 kit 的 `font` 写成 `--site-font`；`lib/template-adapters/preview-bridge.ts:1583` 在预览运行时重写该 token。四个 `lib/blocks/looks/*.ts` 主要定义字号、行高、字距和密度，不各自加载字体。工作台另有 `app/globals.css:1,32` 的 Google Fonts `@import`（Manrope、DM Mono、Noto Sans SC），只影响工作台外壳，不能视作发布页字体方案。

### 3.7 推荐字体组合（可转 build 票）

许可均为 OFL/Apache，中文建议使用系统苹方/微软雅黑/`Noto Sans SC`；若发布页必须跨机器完全一致，再考虑自托管并随站点携带许可证。数字/型号单独使用 mono 只在参数、SKU、交期等数据角色上，不要把整页变成代码界面。

| 样子 | 组合 1（首选） | 组合 2（备选） | 适用理由 | 许可与体积 |
|---|---|---|---|---|
| 工程工业 engineering | 标题/正文 **Geist Sans**；参数 **Geist Mono**；中文 `Noto Sans SC`/苹方 | **Inter** + **JetBrains Mono**；中文 `Noto Sans SC` | Geist/Inter 中性、数字清楚，Mono 只标参数，与规格条和型号索引相配，不会像 SaaS 营销卡。 | Geist [OFL 1.1](https://github.com/vercel/geist-font)；Inter/JetBrains Mono/Noto Sans SC OFL。Latin woff2 约几十到数百 KB（按字重/子集计）；中文全字库通常是 MB 级，需子集。 |
| 样本目录 catalog | **Manrope** 标题/正文；**JetBrains Mono** 数字；中文 `Noto Sans SC` | **Archivo** 标题/正文；**JetBrains Mono**；中文 `Noto Sans SC` | Manrope 的几何但不夸张，适合目录行和参数表；Archivo 更中性，数字宽度稳定。 | Manrope/Archivo/JetBrains Mono/Noto Sans SC OFL。当前 Google CSS 实测 Manrope 400/500/600/700/800 的 6 个 woff2 合计约 74.8 KB（仅该 CSS 返回的子集，2026-10-03）；中文全字库仍需另测。 |
| 明快 bright | **Sora** 标题；**Manrope** 正文；**JetBrains Mono** 仅参数；中文 `Noto Sans SC` | **Manrope** 一套（标题加大、正文常规）+ `Noto Sans SC` | Sora 的大 x-height 给首屏活力，Manrope 保持正文亲和；只在结构化数字上用 mono，避免三种字形抢注意力。 | Sora/Manrope/JetBrains Mono/Noto Sans SC OFL。只加载实际字重；Sora 可用 variable woff2。 |
| 灰底短路径 short-path | **Geist Sans** 标题/正文；**Geist Mono** 型号/单位；中文 `Noto Sans SC` | **Archivo** 标题 + **Inter** 正文 + JetBrains Mono；中文 `Noto Sans SC` | 短路径的大标题需要紧凑、清晰字面；Geist/Archivo 在窄宽度较可控，Mono 给工程参数明确锚点。 | Geist/Archivo/Inter/JetBrains Mono/Noto Sans SC OFL。优先 variable/子集，避免把全字库塞进每个发布页。 |

## 4. 落到 SiteCraft

### 图标

1. **保持现状（T-051）**：工作台继续 `lucide-react`，不动 `commitOperations` 或预览引擎；许可证属于依赖本身，发布工作台时保留依赖声明。
2. **局部图标试验（建议新 build 票，依赖负责人确认盲评门槛）**：在 `lib/blocks/catalog.ts` 给 `contact` / `certifications` 增加固定的 icon slot/part 数据；在 `lib/blocks/fragments/contact.ts`、`sections.ts` 里由开发侧挂 inline SVG。模型只能选 `icon-id`，不能写 SVG、URL、path 或文字。每个落点仍由 block variant 的声明 marker 唯一命中，事实文字照旧来自 draft。
3. **图标注册表**：可放 `lib/blocks/icon-registry.ts`（只存审查过的 path、viewBox、默认尺寸和 aria 策略），由 `preview-bridge.ts` 以数据映射挂载；不要把第三方完整图标包放进草稿或 operation。若复用 Lucide，先核对其 path 数据和 ISC notice；若换 Tabler/Phosphor，保留 MIT notice。
4. **不要把图标选择做成自由 CSS/字体 operation**：`lib/blocks/site-style.ts:61-63` 已禁止 `content`、`font-family`、`background-image`、position、overflow 等；图标是区块结构的一部分，不应让样式 operation 改写。
5. **验收成本**：用同一草稿、四个样子、375/768/1440，比较 contact/certification 的图标版与文字版截图；检查图标不挤压中文、语义图标旁仍有文字、无空的装饰 slot。若盲评认为更像模板，就删除试验票，不扩面。

### 字体

1. **先修 token 数据，不改 prompt**：在 `lib/template-adapters/registry.ts` 的四套 kit/palette `font` 值落入推荐组合；`lib/blocks/compose.ts` 和 `preview-bridge.ts` 已有 `--site-font` 通道，页面会实际变化，符合“设计选择必须落到 token”的硬约束。
2. **中文策略**：先把四套系统栈补成同一套中文 fallback（至少 `"PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif`），再决定是否自托管；不要把 Google Fonts CDN 写进发布页或模型 CSS。工作台的 `app/globals.css` 外部 `@import` 与生成站隔离，若发布页采用自托管，应新增 first-party `@font-face`，不能复用 CDN URL。
3. **自托管路线**：只准入 OFL/Apache 字体，按页面真实中英文字符子集出 woff2；把对应 LICENSE/OFL、版权、版本和子集脚本记录在同一 build 票。字体文件应由站点同源提供；不把字体放进 draft、operation、提示词或外部资源字符串。
4. **视觉 brief/token**：在 `visualBrief` 或 kit token 中写 `fontFamilyId`（例如 `engineering-geist`, `catalog-manrope`）和数字角色 token（例如 `--site-data-font`）；adapter 只接受 registry 中的 ID，不能让模型提交任意 CSS `font-family`。`site-style.ts` 已禁 `font-family`，这是正确的边界。
5. **发布页规则**：`docs/project/mainline.md:23,37` 要求站点样式不含外部资源、素材许可分别核验；因此 Google Fonts CDN 只可继续用于工作台开发壳，不能作为生成站运行时依赖。自托管字体的首屏体积、中文子集缺字和许可文件交付需在浏览器三档检查中记录。

## 5. 风险与未知

- **Amicons/Smallbits 的生成器授权仍是关键未知。** 产品页允许客户端成品，但原始文件再分发、模板打包、SaaS 集成边界没有针对 SiteCraft 的书面解释；在作者确认前不得进 `vendor/`、区块库或生成运行时。
- **Fontshare FFL 风险已明确，证据来自 `main.d962d2d8.js` 的 `lib.freeLicenses.itf_ffl.spyTable`，实际许可页为 [fontshare.com/licenses/itf-ffl](https://fontshare.com/licenses/itf-ffl)。** ITF FFL 2.0 的限制包括：不得把字体提供给第三方、不得通过 SaaS 平台/模板编辑器提供字体文件；“免费商用”不能推导为生成器再分发许可。Migha、Mersad 尚未核实，不归入 FFL 结论。
- **Awwwards Free Fonts 159 条中大多数未核验。** 本报告列出条目用于审查队列；没有原作者 LICENSE 的项目都是未准入状态，不能用作后续 token。
- **字体文件体积与中文覆盖未完整实测。** 本次只实测 Google CSS 返回的 Manrope 5 个字重子集合计约 74.8 KB；Noto Sans SC 全字库和各候选完整 woff2 尚未下载/子集化，不能把估算体积当验收证据。
- **现有工作台 Google Fonts CDN 尚未改动。** 这是项目已有开发壳依赖，不等于发布页允许外部资源；外部依赖的真实网络失败本次未做浏览器实测。
- **新增图标需要独立盲评。** 本调研没有宣称图标版审美通过；负责人不能作为盲评人，必须交给独立审核 agent。
- **负责人需决定的两点：** (1) 是否向 Minor Adventures 询问“生成器/SaaS 多客户成品 + inline SVG”的定制授权；(2) 图标试验是否只做联系/认证两个区块，还是连同设备/能力区块一起评估。字体方面无需改变主线方向，但准入前需决定首批自托管英文字体与中文子集策略。

## 6. 证据与复现

- 只读核对：`python3 /Users/luckye/Documents/SKILLS/project-map-skill/project-map/scripts/project_map.py status --root .`；`package.json`；`app/workspace/page.tsx`；`app/globals.css`；`lib/blocks/fragments/base.ts`；`lib/blocks/looks/*.ts`；`lib/blocks/compose.ts`；`lib/template-adapters/registry.ts`；`lib/template-adapters/preview-bridge.ts`；`lib/blocks/site-style.ts`；`docs/project/mainline.md`；`.project-map/tickets/T-051-block-material-and-css-guard-research.md`。
- 外部资料：Minor Adventures/Amicons/Smallbits 产品与许可页、Cursor 图标文章、Lucide/Tabler/Phosphor 官方仓库/许可页、Awwwards 两个指定页面及各条目 URL、Google Fonts 官方 specimen/许可指南、Fontshare 家族页、API、`main.d962d2d8.js`/`261.d962d2d8.js` 与 [ITF FFL 路由](https://fontshare.com/licenses/itf-ffl)（链接均在正文）。
- 文件体积实测命令（只在 `/tmp`/内存中下载字体 CSS/woff2）：Google Fonts CSS 的 Manrope 400/500/600/700/800 返回 6 个 woff2，合计约 74,804 bytes；没有把第三方字体文件写入项目。
