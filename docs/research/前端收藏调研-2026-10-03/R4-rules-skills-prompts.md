# R4：设计规范、Skills、提示词库 → SiteCraft 去 AI 味规则与区块审查

调研时间：2026-10-03（纽约时间）。范围：Notion「前端」的「规范」「提示词生成前端网站」「Skills」；本地项目规则/票据；Jiro 公开页面/API；oil-oil 三个仓库。Notion 页面已读取；仓库以浅克隆读于 /tmp/sitecraft-research-rs-rules/；Jiro 页面、API、条款用网页抓取读取。未把第三方代码、素材或提示词原文写入项目。

## 1. 结论摘要

1. 把“主任务、一个主行动、证据层级、状态闭环”补进生成规则，收益高于继续增加禁用词。
2. 将 20 条军规中可测的五项接入区块进库、站点样式提交前和 check-published.mjs；沿用 baseline 比较，避免把审美偏好当硬门。
3. 借 oil-ui 的“认品类→定调性→先定骨架→实际画面对比→独立裁切审查→做减法”改进 T-073；不把其自由 CSS/HTML、外部素材和风格家族放进 SiteCraft 运行时。
4. Jiro 当前页面显示 1,122 components + 101 templates；抓到的 1,223 项中 293 项标为免费。匿名 API 对免费条目的 prompt/code 为空且 promptGate=login。
5. oil-ui/oil-cli 是 MIT，oiloil-ui-ux-guide 是 Apache-2.0；可改写方法并保留许可证/版权。Jiro 条款允许客户成品使用，禁止单独再分发、爬取或 AI 训练。

## 2. 资料清单

| 资料 | 网址 / 版本 | 许可/权利 | 价值 | 依据 |
|---|---|---|---|---|
| 人人都是UI设计师-20条设计军规（Notion+PDF） | https://app.notion.com/p/73ffaa7adad88244aa7d0146157edb13；原文 https://x.com/longhaiqwe123/status/2106216781174251724 | 页面称整理自 X 与《Refactoring UI》；未核实原书/配图可再分发 | 高 | 20 条规则和 Visual Checklist 可直接映射到区块审查和发布页检查；不复制全文。 |
| 小程序设计（Notion+PDF） | https://app.notion.com/p/3eefaa7adad880dab99bdbabb645a698；作者 Adrian Punk（@AdrianPunk115）；Notion 没给该篇原始 X URL | 个人整理，原文/PDF 许可未核实 | 中 | 可迁移主要任务、依赖顺序、状态、空状态、结果回查；小程序平台和交易机制不迁移。 |
| Jiro | https://jiro.build/components；https://jiro.build/；API 例 https://jiro.build/api/components/why-choose-us-01-finsyc；条款 https://jiro.build/terms-conditions | 条款 4、6：允许个人/商业及客户成品；禁止单独转售/再分发、爬取、竞品服务、训练 ML/AI；内容归 Jiro/许可方 | 中 | 只借公开 section 分类、描述、tags、依赖和工作流；prompt/code 需登录。 |
| oil-ui | https://github.com/oil-oil/oil-ui；commit dba584210a02198c07f2c4e22739c0eeb3231570；本地 /tmp/sitecraft-research-rs-rules/oil-ui/ | MIT，须保留版权和许可 | 高（方法）/低（直接代码） | 方向卡、差异检验、真实截图、独立审查、素材与动效取证；自由 HTML/CSS/JS 和 SiteCraft 运行时冲突。 |
| oiloil-ui-ux-guide | https://github.com/oil-oil/oiloil-ui-ux-guide；commit f32bc2bd210a6693f86841816a531ab511b258b4；本地 /tmp/sitecraft-research-rs-rules/guide/ | Apache-2.0；改作保留许可证/版权/NOTICE 条件并标改动 | 中 | UX Hard Rules 与 Style Lens 分层，适合作审查框架。 |
| oil-cli | https://github.com/oil-oil/oil-cli；commit b6fb811d42a72d327e5060518347b125d9a098ca；本地 /tmp/sitecraft-research-rs-rules/oil-cli/ | MIT | 低 | 仅安装/更新 Skill，不是生成运行时依赖。 |

Jiro 数量核对：页面导航显示 1,122 components、101 templates；RSC 数据合计 1,223 项，isPremium=false 共 293 项：287 components（269 marketing-blocks、18 ui-components）和 6 templates（Solra×2、Finsyc×1、Velara AI×1、Kelo×2）。对 Finsyc 免费区块/模板 API 的匿名响应有 description、dependencies、thumbnail/video、hasPrompt/hasCode=true，但 prompt/code=null、promptGate=login。KonsTuck 等建设公司条目为 premium；当前免费目录没有工业模板。

## 3. 逐项深挖

### A. 20 条军规与 Visual Checklist 对照

证据路径均为当前项目文件；“部分覆盖”表示有原则但没有独立判定。

| # | 结论 | 现有覆盖 |
|---:|---|---|
| 01 个性一致 | 部分 | frontend-less-ai-tone 的样子/主行动/记忆点；SiteCraft skill 的 visualBrief/同族模块；无跨区块自动一致性。 |
| 02 先灰度后上色 | 没覆盖 | 无灰度候选或去色门。 |
| 03 文字层级不只靠字号 | 部分 | skill 规定字阶/颜色角色；site-style.ts 只限制字号、字重、行高范围。 |
| 04 弱化竞争元素 | 部分 | 主行动和不让每块同等权重；无视觉权重检查。 |
| 05 少标签 | 不适用作全局硬规 | B2B 参数/条款/证书需要标签；只能区块人工判断。 |
| 06 操作层级/单主按钮 | 部分 | skill 要求主行动和动作型 CTA；check-published 只测 hero CTA 去询盘，不测多个 primary。 |
| 07 留白 | 部分 | token 和间距白名单；无拥挤/呼吸空间关系判断。 |
| 08 不无意义撑满 | 部分 | max-width/gutter 与横向溢出；无正文舒适宽度门。 |
| 09 组间距大于组内 | 没覆盖 | 无语义组输入；只校验 gap 数值。 |
| 10 移动端非等比缩放 | 部分 | 375/768/1440；检查孤字和词内断行；无字号比例检查。 |
| 11 45–75 字/行、行高随行长 | 部分 | visitor-text-fit 检查裁切/overflow；不测 45–75 与动态行高。 |
| 12 baseline | 没覆盖 | 无 baseline 计算或声明组。 |
| 13 完整色阶 | 部分 | 样子/色板与 --site-* token；无角色色阶完整度。 |
| 14 正文 4.5:1 | 部分 | template-adapters 部分色板 ≥4.5；workspace contrast 为 4.5；visitor site-style 仅 3:1 新增遮挡门。 |
| 15 不只靠颜色 | 部分 | 状态有文字值；无灰度/多通道发布页检查。 |
| 16 少量强调边框 | 没覆盖 | 允许 border，但不审查使用量/位置。 |
| 17 图片文字对比 | 部分 | 检查 hero photo 是否被覆盖；未测亮暗背景文字对比。 |
| 18 图标/截图尺寸 | 部分 | 检查坏图和真实视口 fit；无图内文字可读性。 |
| 19 慎用边框 | 没覆盖 | 无重复边框/留白与线重复的 DOM 规则。 |
| 20 空状态 | 部分 | skill 有空状态原则；发布页无空状态 CTA/无关控件统一检查。 |

Visual Checklist 结论依次为：产品个性部分、去色后层级没覆盖、主次辅动作部分、避免撑满部分、组间距没覆盖、移动端收敛部分、45–75 部分、baseline 没覆盖、4.5 部分、状态多通道部分、图片文字部分、实际尺寸部分、空状态 CTA 部分。现有强项是事实保真、三档溢出/重叠和模板残留否决，并非完整视觉审计。

### B. 可自动检查的规则

| 检查 | 位置 | 输入/判定 | 误报 |
|---|---|---|---|
| 普通文字 4.5:1 | 区块进库、check-published；样式提交沿 baseline 差异 | 实际 DOM、合成背景（含图片/透明层）、文本角色；普通正文 <4.5 失败，大字/图标分阈值，无法测图片背景报告未测 | 排除装饰/隐藏；不把当前 3:1 当正文门。 |
| 正文行长/行高 | check-published；区块 crop | Range 分行、body/heading/table 角色、font-size/line-height；正文约 45–75 字或 20–35em，表格/SKU/按钮豁免 | 中文短参数和无空格；按角色和 section marker 豁免。 |
| baseline | 区块进库 | catalog 声明 baseline 组，比较同一 flex/grid 行文本基线，差 ≤1–2px，三档均成立 | 只测声明组，不扫描全页；图标/多语言另声明。 |
| 亲疏间距 | 区块进库；样式提交只测新增关系 | semantic groups、矩形和 computed gap；同组更近、组间更远 | 表格/导航/等距网格关闭；候选说明语义组。 |
| 单 primary CTA + 动作文案 | check-published；模型 schema | 可见 primary、按钮文本、href；每页/首屏最多一个 primary，拒绝“立即体验/Learn More” | B2B 可有规格表+询盘；另一个标 secondary，冲突报告 REVIEW。 |
| 灰度状态 | check-published/工作台状态测试 | 去色截图或状态属性；成功/失败/处理中/缺口/选中仍可读 | 只测状态组件，不测装饰。 |
| 图片文字对比 | 区块进库/已准入图片 | 像素采样+文字区域，或 textOverlay=false/安全区声明；否则 REVISE | 先限静态图；动态图报告未测。 |

前五优先：对比度、行长/行高、baseline、间距、主 CTA。

### C. 小程序设计可迁移部分

- 迁移“页面主要任务”：T-002 已是用户点名页面 > 按业务规划 > 无法确定时首页/产品服务/联系；建议内部每页补一句任务和完成结果。
- 将“先知道什么、什么限制选择、完成后去哪找回”作为需求对齐 goal/pages/other 的问题来源；工业 B2B 的限制项来自介质、压力、规格、MOQ、交期、出口路径等资料。
- 工作台的需求对齐未完成、资料缺口、预览失败、询盘成功/失败、撤销/重做都应有原因、状态、下一步；状态不能只靠颜色。
- 不迁移底部 TabBar、日期/库存/支付/配送/播放器/课程/社区/会员、WXML/WXSS、rpx、固定付款栏；八种小程序类型不能变成八个 SiteCraft 样子。

### D. oil-ui 与 T-073

已读 SKILL.md 和 references 规则：先认品类/标杆；五个调性刻度（能量、完成度、密度、分量、严肃度）；具体材质/场景/角色引擎；先定首屏骨架；方向卡写北极星、取舍、骨架、字体、色彩、主视觉、控件、动效、记忆点和主动放弃；同轮骨架互异、骨架/字体/色彩/主视觉最多一项相同；实看 desktop/mobile、裁切图、独立评审、最后做减法。

可借用：
1. T-073 candidate.md 增加品类/参照、区块主任务、一个记忆点、与旧布局的结构差异、主动不做的装饰。
2. 审查先描述 crop 看见的结构，再给 ACCEPT/REVISE/REJECT；T-073 已有。
3. 保留候选 crop、同区块默认对照、整页 context、三档和三家资料；这与 T-073 现状一致。
4. 把同族、事实、非整页快照列为不可改约束。
5. 动效记忆点只作开发侧可选观察；运行时仍禁止模型写 CSS/HTML/JS。

冲突：
- oil-ui 允许自由 HTML/CSS/JS、图标/图片/动效；SiteCraft 只能受控意图和白名单 operation，草稿只走 commitOperations。
- oil-ui 的用户选风格家族不能替代 SiteCraft 用户选样子；必须落到 visualBrief、token、区块变体。
- 外部资产、字体、图片不能绕过 SiteCraft 事实与许可边界。
- 不另起渲染器；油 oil-ui 的完整动效/Pro 规则不应变成运行时接口。
- 开放的八个 style family 不能变成 SiteCraft 新卡片。

许可：oil-ui/oil-cli MIT；oiloil-ui-ux-guide Apache-2.0。可改写方法，复制文件需保留许可证/版权/NOTICE 并标明改动；示例图片、字体、图标、商标仍要单独核验。

### E. Jiro

公开可见的是 section 类别、组件/模板名、描述、tags、依赖、缩略图/视频、premium 标记。Finsyc 描述把产品品类、区块职责、形态和依赖分开。公开 JS/UI 显示 master prompt 先锁整套组件设计，再复制单块 prompt；匿名 API 返回 prompt/code=null、promptGate=login，所以具体间距/字体/动效句式未核实。

安全的抽象写法（不是 Jiro 原文）：全局视觉约束/组件族 → 单块品类与职责 → 布局/响应式 → 字体/颜色/密度层级 → 动效/依赖 → 排除项。

给 T-073 的提示改进：先写目标区块与访客任务，再写容器/列/行/间距；单列层级；响应式写成 1440/768/375 状态变化；交互写触发→结果→可回查/撤销；结尾列出禁止模板品牌、Logo 墙、假数字、定价、评价、演示图、外部资源、资料条件和不显示字段。给运行时模型的 visualBrief 可结构化主任务、首屏判断、密度、层级、表面、响应式倾向、一个记忆点，但必须映射目录/adapter/operation，不能放 Jiro prompt/code。

工业 B2B：当前免费目录无工业/建设模板；KonsTuck 是 premium，最多借公开栏目清单，不能借皮肤或 prompt。

## 4. 落到 SiteCraft

| 位置 | 建议 | 硬约束 | 成本 |
|---|---|---|---|
| skills/sitecraft-frontend-less-ai-tone/SKILL.md（另开规则票） | 加主任务、单主 CTA、状态多通道、事实优先、空状态原因/下一步；候选写品类/主任务/同族差异/记忆点/主动不做 | 符合；不开放 HTML/CSS/JS | 低 |
| lib/frontend-tone.ts | 与 skill 同步加 5–7 条短规则，版本升级；不塞 20 条原文 | 符合受控意图/operation | 低 |
| lib/blocks/catalog.ts、candidate.md、T-073/T-074 | 变体声明 semantic/baseline groups、主任务、资料条件、CTA 角色、不显示字段 | 符合 adapter 数据化、唯一槽位 | 中 |
| scripts/render-block.mjs | 加 baseline、亲疏间距 DOM 采样；保留三档、三家、crop/context/scan | 开发检查，不是第二渲染器 | 中 |
| lib/site-style-check.ts + scripts/visitor-layout-scan.js | 在已有 baseline、溢出、重叠、hero 断行、slot 3:1 上增加按角色的正文 4.5:1；无法测图片背景报告未测 | 符合三档门 | 中 |
| scripts/check-published.mjs | 加灰度状态、主 CTA 数量/动作、图片文字对比；保留事实/模板残留/询盘/手机/溢出检查 | 符合成品否决 | 中 |
| T-002 / alignment planner | 每页一句主任务/完成结果的结构化中间字段；用户卡片不显示 Skill | 符合需求对齐 | 低-中 |
| lib/blocks/site-style.ts | 暂不扩大自由 CSS；现有 40 rules/200 declarations/8KB/白名单/三档足够 | 符合 T-048，避免平行 API | 低 |

当前 check-published 已测：横向滚动、卡片越界、文字 overflow/ellipsis/clipped/viewport/covered/narrow-body/email、hero 断行、英文规格中文、公司名/header、hero 图片覆盖、装饰编号、手机导航、事实缺失、联系表单、hero CTA、坏图、照片与“非实拍”矛盾、禁止文案；--submit 还测询盘成功/失败、重复提交、超长消息保留。未测：4.5 对比度、baseline、亲疏间距、灰度状态、单一主 CTA、图片文字安全区、空状态 CTA。

## 5. 具体增补建议（不直接改文件）

### skills/sitecraft-frontend-less-ai-tone/

1. 先写页面/区块主任务和可观察结果，再选版式。来源：小程序设计、T-002。
2. 每页只设一个 primary CTA，其他入口说明动作并降级。来源：军规 06、现有主行动规则。
3. 可见状态用文字/形状/图标表达，颜色只增强。来源：军规 15、小程序清单、oiloil guide UX Hard Rules 2/5。
4. 候选说明一个记忆点、主动不做的装饰、同族旧布局对照。来源：oil-ui design-direction/visual-review、T-071/T-073。
5. 不把 Jiro/oil-ui 模板名或 prompt 当用户选项；只写事实、层级、密度、响应式、资料边界。来源：AGENTS.md、SiteCraft skill、Jiro 条款 6.2/6.3。

### lib/frontend-tone.ts

建议同步加入：

- “先识别这一页的主任务和一个主要动作；Hero、产品/参数、能力、询盘分别承担不同证据。”
- “状态和资料缺口必须能被文字、图标或结构读懂，不能只用颜色。”
- “只用已选样子、视觉族和 visualBrief 支持的层级/密度；不要添加模板品牌、假数据、装饰编号或无事实区块。”
- “在 375/768/1440 的意图描述中说明如何重排信息；不要要求模型输出 CSS。”
- “候选区块必须写资料条件和唯一槽位；找不到目标报告 missing，不猜写。”

数值门由浏览器检查执行，不把 45–75、4.5 等全部数值塞给模型，避免它们变成页面文字。

## 6. 可以写成自动检查的前五条

1. 访客正文 4.5:1：visitor-layout-scan 合成实际背景，check-published 对普通文本拒绝 <4.5；大字/图标分阈值，图片背景无法测须报告未测。
2. 正文行长/行高：check-published 复用 Range 分行，按 body/heading/table 角色；45–75 仅正文，参数表/按钮/邮箱豁免并记录。
3. 声明组 baseline：区块进库按 catalog semantic/baseline groups 在三档比较 Range 基线；不扫描全页。
4. 组间 > 组内：候选声明组边界，渲染器测矩形间距；导航/表格/等距列表关闭。
5. 主 CTA：check-published 读取可见 primary 和动作文案；最多一个 primary，拒绝空泛文案，产品卡询盘标 secondary；两个合理动作报告 REVIEW。

## 7. 风险与未知

- 军规/小程序原文/PDF 是个人整理或社交媒体内容，未见可再分发授权；只转述规则，不复制图片和长引文。Jiro 禁止 prompt/code 单独再分发、爬取和 AI 训练。
- MIT/Apache 只覆盖 oil 仓库软件/规则；示例图片、字体、图标、商标单独核验。
- 未登录 Jiro，未读取 prompt 正文；master prompt + 单块 prompt 来自公开 JS/UI 提示，字段和数值未知。小程序 PDF 临时链接和 Notion 正文已读；未把二进制 PDF 放进仓库。
- visitor layout scan 的 3:1 是站点样式新增遮挡门，不是普通正文 4.5；提高门槛需按角色和图片背景分层。
- oil-ui 的多方向探索不能绕过负责人已确认样子目录、视觉族和区块库；新样子另开决定票。
- 负责人决定点：T-073 的方向卡/语义组/CTA 角色是否成为 catalog 必填；发布页普通文本 4.5:1 是否硬门；图片文字安全区是否增加槽位元数据。均可先在一个候选做 tracer。

状态：INCOMPLETE（调研结论与可执行建议完成；Jiro prompt 正文因登录门控未读取，原始小程序 X 链接在 Notion 未提供，许可保守按未核实/条款限制处理）。
