# R3：UI 组件库、设计索引、管理后台模板 → 区块库与工作台

调研日期：2026-10-03（EDT）。Notion 来源为「Threads / 学习 / 前端」页面（MCP fetch 时间 2026-10-03 15:46 UTC）；代码仓库为当前工作区，外部仓库源码放在 /tmp/sitecraft-research-rs-ui/，未写入项目。
调研状态：INCOMPLETE（清单、源码和可见许可已整理；Kobra/Kinetics/Reverse UI/Skecher UI 等许可边界与外站运行时未核实，见风险与未知）。

## 1. 结论摘要

1. 生成站最值得借鉴的是 Arc UI 的免费源代码、Beautiful UI（独立的 slev12397/beautiful-ui 仓库）的表格/流程结构、Space UI 的数据/时间线结构；都只能手工移植为 SiteCraft 区块库，不能把 React 运行时塞进访客页。
2. 生成站动效先候选 Transitions.dev 的命名空间 CSS；Kinetics 适合继续研究，但仓库没有可见 LICENSE，暂不准入。先定「生成站动效」规格，再做区块级 CSS。
3. 工作台优先参考 Beautiful UI（独立仓库，MIT）+ beUI（独立仓库，MIT）+ shadcn-admin（MIT）+ Arc UI 免费部分（MIT）；它们正好覆盖需求对齐、对话、历史、站点表格和命令搜索，不需要替换现有 Next.js/React 技术栈。
4. Kobra、Reverse UI、Planes、Skecher UI 的许可证或付费源代码边界未核清；Componentry 的部分组件还带 GSAP 单独许可，均只能做视觉/交互研究。
5. Design Index 是发现入口，不是素材许可来源；目录中的图片、字体、图标、商标仍需逐项核验，不能因为被收录就进入 vendor。
6. 目前没有对这些外站做浏览器三档渲染实测；以下「已读源码」结论不等于 SiteCraft 已准入。

## 2. 资料清单

> 许可列只记录官网条款或仓库 LICENSE 能确认的内容；看不到原文写「未核实」。源码仓库的提交是本次调研时的浅克隆 HEAD。

| 资料 | 是什么 / 技术栈 | 许可、访问与源码 | 代表组件或版式 | 可否脱离 React 取 HTML/CSS | SiteCraft 价值 |
|---|---|---|---|---|---|
| [Design Index](https://designindex.xyz/)（现站搜索结果指向 [www.designindex.app](https://www.designindex.app/)，原 URL 本次抓取超时/内容类型异常） | 设计资源索引，不是组件运行库。可按 Inspo、Type、Assets、Tools、Color、Stock、News、Books 等分类发现资料；当前搜索结果显示约 124 条更新记录，第三方页面称其为可搜索目录。 | 目录可免费浏览；目录本身没有给被收录素材的再分发许可，也没有本项目可用的源码仓库。每个条目须回到原站核许可证。 | 版式/灵感：Are.na、Cosmos、Behance、Savee It、Visuelle；颜色：Khroma、Cosmos 按色号搜索；字体：TypeLab、Font Ninja 等（均作为发现线索）。 | 不适用；它是索引。 | **高（研究）**：减少凭印象挑素材的范围；不能直接当素材包。 |
| [Arc UI / uiarc](https://uiarc.dev/) | React 19 + TypeScript + Motion；免费仓库使用 CSS Modules 和设计/动效 token，可用于 Next.js/Vite，不要求 Tailwind；官网同时有 Pro。官网宣称 147 components、85 blocks；免费仓库 [kuratlielia/arc-library](https://github.com/kuratlielia/arc-library)（HEAD 7238f98）含 105 components、22 blocks。 | 免费源代码为 MIT；Pro 需账户/付费，Pro license 允许做产品但禁止把源代码作为组件库、模板、page builder 或公共生成器再分发。边界见 [terms](https://uiarc.dev/terms)、[license](https://uiarc.dev/license)。 | Line/Donut chart、Number field、Data grid、Command palette、Confirm morph、Scheduling/Triage blocks；免费仓库 README 还列 Billing toggle、Activity rings 等。 | **部分可行**：免费组件的 CSS Modules/markup 可人工改成静态区块；Motion、状态、键盘行为仍需 JS，不能直接进访客页。 | **高**：结构清楚、token 化、可移植性比 Tailwind-only 库好；工作台可借命令搜索/数据表。 |
| [Kobra](https://kobra.systems/) | React 19 + TypeScript + Tailwind v4 + Base UI + Motion；通过 shadcn registry 分发，官网比较页写 90+ application components、10 个 free，付费项 token-gated。 | 免费组件可浏览；Pro 可按单组件购买（页面示例 $19）或升级。官网公开页和抓到的代码页未找到完整 LICENSE/再分发条款；没有公开仓库链接。**未核实**。 | Agent 类：Question Card、Plan Card、Task List、Conversation、Message Scroller、File Diff；Content 类：Table、CRM Table、Grouped Table；还有 Command Menu、Drawer、Accordion。 | **不建议**：组件源是 JSX、Base UI、Motion 和 hooks；只能把静态层级当参考，行为需重写。 | **中（工作台研究）**：需求对齐卡、聊天状态、历史/任务反馈很贴近；许可证未核清前不复制代码。 |
| [Beautiful UI](https://www.beautifului.dev/) | React + TypeScript + Tailwind CSS v4 + Motion；官网首页没有 GitHub 链接；独立检索到公开仓库 [slev12397/beautiful-ui](https://github.com/slev12397/beautiful-ui)，本次 HEAD 44a274e。首页署名 TurboProduct design studio，许可证/README 版权行署名 Shane Levine，二者作者关系未核实。定位是 AI-native primitives。 | 官网 [/license](https://www.beautifului.dev/license) 明写 “MIT License”，Copyright (c) 2026 Shane Levine；原文许可 Software 允许 copy/modify/publish/distribute 等，但页面没有说明网站视觉、演示素材或第三方依赖都属于该 Software。仓库 README/LICENSE 同为 MIT；README 明确 SidebarNav 的 [@central-icons-react](https://centralicons.com) 是付费商业图标，须单独许可或替换。 | Loading State、Thinking、Streaming Text、Approval Card、Tool Chips、Task Rows、Chat、Prompt Bar、Recommendation/Context Cards、Diff/Records/Filter Table、Sidebar Nav、Search、Flowchart、Insight Cards。 | **不直接可行**：React/Motion 状态需要 JS；表格/卡片结构可人工变成区块。借 Sidebar 时先换成现有 lucide-react，并核每个依赖。 | **高**：最贴近工作台的对话、需求对齐、审批卡、表格；也是生成站表格/流程结构的好参考，但要清掉 AI 演示文案。 |
| [Kinetics](https://kinetics.colorion.co/) | 153 个 spring-physics 微交互；官网每项同时给 CSS、React、AI prompt 和 stiffness/damping。源码 [ckissi/kinetics](https://github.com/ckissi/kinetics)，HEAD 017498f，Astro 静态站，效果 CSS 在 public/css/effects-*.css。 | 仓库树与 README 未见 LICENSE 文件，官网页也未给明确授权。**未核实，不能准入**。README 还指出演示字体从 Google Fonts 加载，若移植要自托管并单独核字体许可。 | Card Resize、Accordion Spring（max-height + chevron）、Hover Lift、Toggle overshoot、Skeleton Shimmer、Bento Expand、Snap Rail、Sheen。 | **效果层可行**：简单效果本身有 copy-paste CSS；但未核许可，当前只能做候选研究。 | **高（动效研究）**：给出克制弹簧曲线和 CSS 方案；不复制整库。 |
| [beUI](https://beui.dev/) | React 19 + TypeScript + Tailwind CSS 4 + Motion；官网首页明确链接到 GitHub [starc007/ui-components](https://github.com/starc007/ui-components)，本次 HEAD aaf32be，130 components；官网署名 Created by Saurabh。与 Beautiful UI 是两个不同项目。 | 官网 FAQ 写明 public beUI MIT，可商用和修改并须保留版权/许可；Pro blocks/templates 是单独付费许可。依赖（如 @paper-design/shaders-react、lenis 等）仍需各自核验；本项目未发现 @central-icons-react 属于 beUI。 | Animated breadcrumbs、color selector、tabs、tooltip、sortable list、image viewer、date range picker、AI Message/Prompt/Approval、charts。 | **不直接可行**：大部分组件是 React + Motion + Tailwind；只可提炼静态结构/状态映射。 | **高（工作台研究）**：可借排序、图片/附件预览、日期/颜色选择，以及 Agent 消息状态；生成站只取结构。 |
| [Transitions.dev](https://transitions.dev/) | 纯 CSS transitions 集合；源码 [Jakubantalik/transitions.dev](https://github.com/Jakubantalik/transitions.dev)，HEAD 3bc5802。每项 CSS 片段有 token、t-* 命名空间和 prefers-reduced-motion guard；仓库自带 CLI/skill。 | CSS transitions/skills 可在个人和商业项目无限使用、修改并随产品交付；限制是不得把库本身作为竞争 transitions library/kit 再分发。CLI/agent/Refine tooling 为 MIT；Pro 内容另有席位/付费计划。原文见 [LICENSE](https://github.com/Jakubantalik/transitions.dev/blob/main/LICENSE)。 | Card resize、Number pop-in、Badge slide、Menu/Modal/Panel reveal、Icon swap、Success check、Error shake、Accordion、Tabs sliding、Skeleton loader、Toast、Toggle。 | **是**：这是它的主要交付形式；适合人工移植单个 CSS 片段，仍要改成 SiteCraft 的 --site-* token。 | **高（动效候选）**：有许可边界和 reduced-motion，最接近本项目纯 CSS 约束。 |
| [Astryx Design System](https://astryx.atmeta.com/) | React 19+ + StyleX；公开仓库 [facebook/astryx](https://github.com/facebook/astryx)，HEAD d2daa25，150+ accessible components、主题、模板、CLI。 | 仓库 LICENSE 为 MIT。演示里的商品、照片、头像、价格是示例内容，不随代码许可。 | Table/detail page、form wizard、navigation、VStack/Grid/Card、tokens/themes；官网 demo 还有 watch、cart、checkout、AI order chat。 | **不直接可行**：核心消费 API 是 typed React + StyleX，虽输出 CSS，仍需 React 组件和交互；模板结构可人工重写。 | **中**：设计 token、表格/详情/向导的结构有用；StyleX/React 迁移成本高，且默认电商 demo 不适合生成站。 |
| [EvilCharts](https://evilcharts.com/) | React/Next.js chart UI；仓库 [legions-developer/evilcharts](https://github.com/legions-developer/evilcharts)，HEAD ecbd6a5。依赖 Recharts 3、ECharts 6、Motion、Tailwind 4 等。 | 仓库 LICENSE 为 MIT；Recharts/ECharts/图标/演示资产须分别核许可证。 | Bar、Line、Area、Pie、Radar，动画/交互/响应式。 | **否**：图表依赖 React、Recharts/ECharts、数据状态和 canvas/SVG runtime。 | **低**：生成站不能凭空生成数字/图表；工作台若以后展示真实质检数据可研究，但当前不是主线。 |
| [Reverse UI](https://reverseui.com/) | 68 个动画组件；官网示例以 MUI/React source 为主，Tailwind variant 标为 coming soon；无公开仓库链接。 | 官网是 Premium/lifetime access；本次抓取未找到公开 LICENSE、terms 或再分发条款。**未核实，不能准入**。 | Proximity Navigation、Radial Menu、Aurora Footer、Particle Field、AI Chat、Timeline Progress、Track Invoices、Stock Chart、Shiny Text、Log Explorer、Dither/Shader/3D effects。 | **通常否**：MUI/React、canvas/WebGL、状态和资源依赖；简单 text/hover 才能人工改 CSS。 | **低**：视觉偏发光、粒子、shader、SaaS/AI 展示，与工业/外贸访客页和事实约束冲突。 |
| [Space UI](https://www.spaceui.one/) | React 19 + Tailwind CSS 4 + Motion + Base UI，shadcn registry 的 open component distribution；官网文档称直接复制到代码库。 | 官网页脚标 MIT；但头像 API、Tabler/Lucide 图标、sounds、emoji、WebGPU/生成资产需分项核验。没有单一源码仓库作为本次准入依据。 | Data Grid、Timeline、Filters、Status Badge、Kanban、Sortable、Phone Input、Resizable、Accordion、Morphing Search/Command Bar；另有 shaders、sounds、avatars。 | **否（组件本体）**：Base UI/Motion/React；部分 CSS fallback 可做静态装饰，但交互和资源不应搬入访客页。 | **中到高（结构研究）**：数据网格/时间线/筛选/状态很适合 B2B 信息层级；感官工具和头像不要进生成站。 |
| [Componentry](https://componentry.dev/) | React 19 + Tailwind CSS 4 + Framer Motion/Motion，Next.js 16/Turborepo；仓库 [harshjdhv/componentry](https://github.com/harshjdhv/componentry)，HEAD 4591f42。 | MIT；README 明确 image-trail、layered-stack 依赖 GSAP，须另遵守 GSAP license。 | Hero Geometric、Circuit Board、Case Study Flip Stack、Flight Status Card、Data/Calendar、Image Ripple/Trail、Orbit Card Stack、Scroll Choreography。 | **通常否**：3D/cursor/particle/GSAP 需要 JS；简单 hover/gradient 可人工 CSS。 | **中（视觉结构研究）**：少量 Hero/状态卡可启发区块；dither/aurora/particle 很容易变成 AI 默认皮。 |
| [Skecher UI](https://skecher-ui.com/) | React + TypeScript + Tailwind/shadcn registry + Motion；仓库 [CoDesign-Spa27/skecher-ui](https://github.com/CoDesign-Spa27/skecher-ui)，HEAD cbcac05，25+ motion components。 | README 只说 open source，仓库未见 LICENSE 类型/正文。依赖含 Three、OGL、shader、Nucleo 图标等，均须另核。**未核实**。 | Apple Mail Tabs、Sliding Panel、motion-focused controls；站点展示 shadcn CLI 源码。 | **否**：源代码是 React/Motion，且部分组件含 WebGL/资源依赖；只能看结构。 | **低到中**：交互细节可参考，许可和依赖不足以进入 SiteCraft。 |
| [Planes](https://useplanes.com/) | React + TypeScript + Tailwind + Motion；shadcn registry，公开页列 100+ interactive components、heroes、pricing sections、templates。 | 主要内容为付费 license：官网当前写 launch price $99（后续 $199），一个开发者、无限商业项目；Pro registry 需认证 key。页面未给可供本调研直接核验的完整再分发条款。 | Photo Stack、AI Chat、Physical Knob、Mega Menu、Date Picker、Pricing Table、Scenic Hero、Topography、Receipt Printer、Command Palette。 | **通常否**：React/Tailwind/Motion 源码；简单 marquee/hover 可重写。 | **低到中**：适合观察完整 Hero/应用组件，但付费许可、SaaS/landing 视觉和生成器再分发边界未核。 |
| [shadcn-admin](https://github.com/satnaing/shadcn-admin) | React 19 + Vite 8 + Tailwind CSS 4 + Radix + TanStack Router/Query/Table；仓库 HEAD e16c87f，package version 2.2.1。 | MIT LICENSE；README 明确不是 starter project，而是可复用 dashboard UI，代码部分改自 shadcn 示例。 | Built-in sidebar、global search command、10+ pages、table、light/dark、responsive、RTL、a11y。 | **部分可行**：布局 HTML/CSS 可手工参考；表格/路由/搜索/状态仍是 React runtime。 | **高（工作台）**：站点列表、历史、筛选/搜索、侧边栏和主题切换的布局参考；不能替换本项目 Next.js。 |

### Design Index 入口的筛选建议

这是索引研究，不是准入名单。只把下面几类当作下一轮搜索入口：

- **区块/版式**：优先搜索完整工业/制造/目录站，而不是孤立 SaaS bento；关注首屏、产品族、规格表、案例、询盘和条款的层级。
- **配色**：用 Khroma、Cosmos 等工具找色彩关系，最终落地仍必须写进 SiteCraft 色彩集/色板，不把工具的颜色生成器运行时带进页面。
- **字体**：用 TypeLab、Font Ninja 做识别/配对线索；字体只能用项目已有或已核许可名单，不能因为索引推荐就加载外链字体。
- **图标/动效**：先看授权和是否能用纯 CSS；图标库不要先放进生成站（T-051 已定第一版不用图标），动效只选克制的 hover、accordion、reveal、loading。

## 3. 逐项深挖

### 3.1 最适合生成站区块的结构参考

**Arc UI：数据密集但仍有产品层级。** 免费仓库 README 的 Data grid、line/donut chart、number field、billing toggle 展示了「标题/筛选/数据区/操作」的分层；迁移时只取结构和 spacing，不取 dashboard 假数字。对 SiteCraft 最直接的落点是产品型号索引、参数对比表、证书状态表和商业条款行。因为 Arc 免费部分是 CSS Modules + token、没有 Tailwind 强绑定，手写成 --site-* 比 Tailwind-only 库成本低。Pro 源码不能用于公开生成器，必须只看免费仓库或重新实现。

**Beautiful UI：结构与工作台重合。** 官网首页没有 GitHub 链接；独立检索到的公开仓库是 [slev12397/beautiful-ui](https://github.com/slev12397/beautiful-ui)（本次 HEAD 44a274e），README 与官网都把它描述为 Beautiful UI，官网页脚署名 TurboProduct design studio，许可证版权行署名 Shane Levine，二者关系仍未核实。Records Table、Filter Table、Flowchart、Insight Cards 和 Approval Card 很适合转成「资料有多少就显示多少」的 B2B 区块。它的示例用 gelato/供应商等演示事实，不能搬进访客页；AI-native 的 prompt bar、tool chips、streaming text 也不能原样出现在客户站。生成站只应移植 HTML 层级、表格行密度、状态层级和键盘焦点，写成 lib/blocks/fragments/*.ts 的静态片段；工作台可以在现有 React DOM 内借鉴交互。

**Space UI：补齐当前区块库的列表形态。** Data Grid、Timeline、Filters、Status Badge、Kanban、Resizable、Sortable 是可审查的结构候选。工业/外贸站只建议拿 Data Grid、Timeline、Filters、Status Badge 的信息架构；Liquid Metal、Silk Border、WebGPU、Sounds、Avatars 和 emoji 属于产品演示层，既增加许可面也会引入 AI/游戏化外观。Space UI 的源代码和依赖仍是 React runtime，必须人工移植。

**Astryx：用 token 和页面模式校正层级。** Astryx 的 Design Conventions 强调主题控制视觉值、组件控制结构，并列出 table/detail/form wizard 等模式；这对区块库的 token 角色、表格行高、标题/正文层级有参考价值。它本身是 StyleX/React 设计系统，且 demo 含商品价格和示例图片；不直接复制任何 demo 内容。

### 3.2 适合生成站的纯 CSS 动效候选

候选只供下一张决定票，当前不定规格：

1. **Accordion / details reveal**：用 max-height 或 grid-template-rows: 0fr → 1fr，配 chevron rotate；适合 FAQ、型号索引的折叠详情、商业条款展开。
2. **Card/row hover lift**：只改 transform: translateY、边线或很轻的 shadow；适合产品行/询盘按钮，不给每个区块自动加进场动画。
3. **Tabs/choice indicator**：用一个伪元素或真实 marker 的 transform 移动，适合工作台预览宽度、需求对齐步骤；访客页少用。
4. **Skeleton/shimmer**：只允许工作台载入态；访客页不能用假灰块掩盖缺失资料。
5. **Success/error feedback**：checkbox draw、success check、轻微 error shake 可用于工作台提交反馈；不要放在客户站首屏。

不建议用于生成站：粒子、WebGL/shader、3D tilt、canvas logo、gooey、sound、confetti、自动 logo carousel、长时间 ambient loop。它们要么需要运行时/外部资源，要么会把工业/外贸站推向 SaaS/游戏化视觉。所有候选都应有 prefers-reduced-motion 分支，且先通过单区块裁切图和 375/768/1440 检查。

### 3.3 工作台借鉴

现有工作台已经有：

- app/workspace/page.tsx:341-415：draft/history/alignment/mobilePane/theme/accent 状态；
- app/workspace/page.tsx:1304-1455：顶部栏、预览/对话切换、撤销重做、发布、历史、需求对齐多题卡；
- app/globals.css:204-310：三列顶栏、预览画布、对话列、历史行、状态提示；
- app/globals.css:313-355, 469-510：需求对齐卡、平板抽屉、手机底部抽屉、reduced-motion；
- package.json：已有 React 19、Next 16、lucide-react，没有 Framer Motion/Motion。

建议的交互映射：

- Beautiful UI（slev12397/beautiful-ui）的 Approval Card / Recommendation Card → 对照当前 .alignment-panel 和 .alignment-card，只借「推荐理由、状态、提交前确认」层级；不增加第二套对齐状态，不绕过现有结构化 selections。
- Kobra 的 Question Card / Command Menu / Plan Card → 只作为工作台原型参考；若要复制源代码，先补许可证核验。命令菜单可优先用现有 lucide-react 和原生 React 状态实现，避免把 @kmenu/react、Base UI、Motion 引入主线。
- shadcn-admin → 参考 app/sites/page.tsx、components/sites-table.tsx、components/app-sidebar.tsx 的站点列表、筛选、侧边栏和明暗/RTL处理；按现有 Next.js 路由和 CSS 实现，不能把 Vite/TanStack Router 当成替换方案。
- Arc UI → 参考 Command Palette、Data Grid、Confirm morph 的焦点/键盘/reduced-motion；免费 CSS Modules 比新增动画依赖更容易压进现有工作台 token。
- beUI → 参考 Attachment/Image Viewer、Date Range Picker、Approval/Message 的状态反馈；所有 copy-paste source 都要替换示例文案，并检查第三方依赖。

## 4. 落到 SiteCraft

### 4.1 生成站区块（优先级最高）

| 目标 | 建议落点 | 需要遵守的边界 | 成本 |
|---|---|---|---|
| 产品族/参数/型号索引 | lib/blocks/catalog.ts、lib/blocks/fragments/products.ts、lib/blocks/compose.ts | 继续用 slots、markers、parts、requires；只读草稿事实；产品 ≥3 的门槛沿用 T-073；不能把外站表格直接注入预览。 | 中：新布局需候选渲染、三档裁切、唯一槽位测试和 AI 味审查。 |
| 商业条款/设备/流程/认证 | lib/blocks/fragments/commercial-terms.ts、sections.ts；对应 T-078/T-081 | 只显示结构化资料；条款种类走固定双语词典；不复制 shadcn-admin 的示例数字、状态或价格。 | 中：现有区块已有 rows/table/steps 形态，主要是密度和折叠取舍。 |
| 询盘/联系条 | lib/blocks/fragments/contact.ts | 保持现有 split/panel/band、真实联系方式和表单 API；Beautiful UI/beUI/Kobra 只能提供信息层级参考，不能加入 AI chat/虚构评价。 | 低到中：结构已存在，需实测窄屏和长联系方式。 |
| 视觉族一致性 | lib/blocks/looks/*.ts、lib/blocks/site-style.ts | 只用现有 --site-* token；不把 Space UI 的圆角、shader、图标风格带入所有样子；T-071/T-073 的单区块审查继续有效。 | 中：每个候选要过四个 looks 的 token 解析和同族审查。 |

这符合 AGENTS.md 的「样子 → 区块库 + token → 完整页面」「一个预览引擎」「adapter 是可审查数据」「所有修改走 commitOperations」。任何外部代码若未经移植，不能直接拼进页面。

### 4.2 生成站动效（先研究，暂不写运行时方案）

- 候选 CSS 应写在对应 lib/blocks/fragments/*.ts 的静态 CSS，沿用 lib/blocks/fragments/types.ts:1-16 的 900/480 断点；不向 package.json 增加 Motion/Framer Motion。
- 复用 lib/blocks/fragments/base.ts:8-23 的基础规则和 reduced-motion 入口；动效只作用于已有 sitecraft-* / data-sc-part 节点。
- T-051 已决定站点样式走结构化 operation、第一版不用图标；模型不能把 Transitions/Kinetics 的 CSS 原文当作运行时输入。需要动效白名单、时长/属性上限、三档检查时，应另开「生成站动效」决定票，不能在这次调研中默认开启。
- 推荐第一批只评估：FAQ/型号详情展开、产品行 hover 边线、表单提交成功提示；拒绝 fixed、外部资源、content 造字、shader/canvas、自动播放长循环。

### 4.3 工作台

| 目标 | 现有文件 | 建议 |
|---|---|---|
| 需求对齐多题卡 | app/workspace/page.tsx:1257-1455、app/globals.css:313-355, 469-510 | 以 Beautiful UI/beUI/Kobra 的卡片层级做一次视觉细化；状态仍由现有 alignmentView、selections、commitOperations 驱动。 |
| 对话/进度/历史 | app/workspace/page.tsx:1362-1455、app/globals.css:250-310 | 借 Beautiful UI（slev12397/beautiful-ui）的 Streaming/Tool chips 结构和 Arc 的 calm motion；实际文案、状态和落点继续由现有 appliedTargets/history 生成。 |
| 站点列表/后台壳 | app/sites/page.tsx、components/sites-table.tsx、components/app-sidebar.tsx | 参考 shadcn-admin 的侧栏、全局搜索、表格、明暗/RTL；保留 Next.js App Router、现有 API 和 lucide-react。 |
| 预览与宽度切换 | app/workspace/page.tsx:1316-1360、app/globals.css:225-248 | Arc/Transitions 的 focus、reduced-motion 和 panel reveal 可手工写入现有 CSS；不引入第二个预览引擎。 |

成本估计：工作台视觉微调为低到中；新增命令搜索/数据表交互为中；任何新动画依赖或组件 registry 为高，且不符合当前「不为未来功能预置平行 API」的要求。

## 5. 风险与未知

1. **许可未清项目**：Kobra、Kinetics、Reverse UI、Skecher UI 的完整源代码/再分发条款未在本次可访问页面中核实；不能复制代码、放入 vendor 或作为生成器素材。
2. **付费源代码边界**：Arc Pro、Planes Pro、Reverse UI Premium 的「客户项目可用」不自动等于「生成器可把代码变成很多客户站」；Arc Pro 条款明确禁止 public generator/page builder，Planes/Reverse UI 还需拿到完整 license 原文。
3. **第三方资产**：Beautiful UI 的 SidebarNav 使用商业 [@central-icons-react](https://centralicons.com)（属于 slev12397/beautiful-ui，不是 beUI）；Space UI 的头像/声音/emoji/WebGPU、Componentry 的 GSAP、EvilCharts 的图表/图标依赖、Astryx/模板演示图片都要单独核验；MIT 代码不覆盖这些资产。
4. **事实风险**：EvilCharts、shadcn-admin、Beautiful UI、Kobra 的演示表格/图表含示例数字、品牌、客户/供应商名；SiteCraft 访客页不能保留任何未来自资料的数字、评价、Logo 墙或 SaaS 定价。
5. **视觉风险**：Space UI、Componentry、Reverse UI、Planes、Skecher UI 里大量 shader、粒子、玻璃、霓虹、3D、bento、AI chat 视觉很容易触发 frontend-less-ai-tone 的「默认皮」和 AI 千篇一律；只取结构或单个克制反馈，不取整套主题。
6. **版本漂移**：外站都在持续发布，报告中的提交/版本是本次快照；准入前应重新核 HEAD、LICENSE、依赖锁文件和实际渲染。
7. **未实测**：本次已读官网、LICENSE、README 和源码，但没有在 Chrome 中运行这些外部库，也没有跑 SiteCraft 375/768/1440 截图；响应式和可访问性结论仍需候选进区块池后按 T-073 流水线验证。
8. **负责人决策点**：是否开启「生成站动效」规格；若开启，先决定 CSS 属性/时长/循环/prefers-reduced-motion 白名单，再从 Transitions.dev 的单个片段开始做一张 tracer 票。当前不应因本报告直接改 package.json、引入 Motion 或把外部 registry 接入运行时。

