# SiteCraft AI 执行计划

状态：grilling Round 18；Q27=A、Q26=B；P4 负责人盲评不过；版本 v0.12；**执行前门：工业基准页 + 最小需求引导**。需求事实以 [intent.md](./intent.md) 为准，主线以 [mainline.md](./mainline.md) 为准。旧 P0–P5 细账见 git 历史与 `.grilling/`。

## 要做成什么样

帮中小企业做出看起来像该行业自己建的网站：好看、不像套模板或套 AI 文案、事实不编造、改完能立刻在预览里看到。近期仍是内部 Demo，资料用模拟工业/设备/外贸包。

不在本阶段做：真实客户试点、公开自助上线、整仓合并 PR #4、模型直接写 HTML/CSS、跨模板自由拼装、把 jiro 源码或 MCP 接进生成运行时、把调研仓库未核许可就推进 `vendor/`。

## 用户看见什么

用户选的是**一类样子**，不是 Skill 名，也不是某一个内部模板 ID。行业来自资料，不占用主题卡。卡片张数按手头能本地预览的模板来，不预先锁死 4 套。

| 样子 | 看起来像 | 已有本地快照 | 无快照、先不挂卡 |
| --- | --- | --- | --- |
| 明亮产品 | 留白、产品先于故事 | `forge` | 同气质候补以后再核 |
| 工程工业 | 产品线、工况、询盘 | `screwfast` | |
| 蓝白目录 | 分类清楚、转化组件完整 | `landwind` | `atlas` 等待快照 |
| 灰底短路径 | 单页说清品类和询盘 | `tailwind-landing` | |
| 深色产品 | 功能/界面说明，深底 | `fresh` | `powerai`、`astro-starter` 待快照 |

`shadcn-landing` 的 `index.html` 是 Vite 空壳，不算可生成快照。`nextjs-landing` / `shadcn-landing2` 同样未挂卡。现在代码里四张卡仍按行业 1:1 绑模板（工业=Forge，外贸=Landwind），那是打通预览用的，不是目标形态。

## 页面怎么改

这轮先交付一张真正成立、可以反复生成的工业询盘首页，再把「怎么选对、怎么生成对」产品化。验收对象是模拟资料 **忻州重载减速机 P3I**，从现有工作台进入，最终能生成、修改、刷新后重新打开。它不是只调 `modulePlan` 顺序，也不是只做一张首屏截图。

开发侧可以修改 CSS、组件结构和必要的布局规则。重点先解决标题行宽与中文断行、统一内容对齐、列宽与区域间距、图文/无图两种布局、产品类别与加工方式的职责分离，以及移动端重排。**运行时模型仍不输出 HTML/CSS**；它负责理解资料、选择已实现的页面结构与布局变体，并通过现有 `commitOperations` 写草稿。

开源模板、区块和样式继续作为可审查素材。保留一个共享预览引擎，不另起渲染器，不跨族硬拼，不把未核许可的调研仓库推进 `vendor/`。旧的「只改声明槽位、未声明节点保持原样」不能作为成品规则：成品不得残留模板品牌、客户 Logo 墙、SaaS 定价、演示图、假评价或空链接；命中失败必须暴露为 `missing` 或明确降级，不能拿演示壳充数。

这轮不扩模板库、不做全族色卡、不做长问卷或自由调色，也不刷 12 组组合测试。需求引导升级为**最小可恢复的方案形成流程**：资料完整时直接展示预填摘要，资料模糊时只追问会改变页面结果的问题；生成前必须确认交付范围、主要行动、已选样式/色板和资料缺口。三套命名色卡与受限品牌色自定义属于后续切片，必须建立在同一页面已有真实可生成样张之上。

## 本次 GOAL：从模糊描述到确认后生成的工业询盘页

### 目标

在当前干净基线 `e6b2370` 上，完成一个端到端、可恢复的工业建站切片：用户只说「我们做减速机，想做官网」或上传完整 P3I 资料，系统先归纳业务与缺口，再让用户确认主要行动、交付范围、视觉方向、一个已验证的默认色板和缺图处理；确认后通过现有工作台、`commitOperations` 和共享预览引擎生成忻州重载减速机 P3I 的完整询盘首页。页面能在桌面/移动端成立，修改、刷新和重新打开后仍保持同一方案。

### 关键状态与规则

- 需求引导的问题围绕业务和访客，不先让客户选择模板 ID 或 Skill 名。
- 设计偏好可以推荐；企业事实（认证、产能、客户、电话、地址等）只能来自资料，否则显示「待补充」。
- 已有完整资料时不重复访谈；描述模糊时只问会改变页面规划或主行动的问题。
- 关闭面板是暂停，刷新后可恢复；普通回车不能绕过确认门；聊天入口不能绕过同一份已确认方案直接生成。
- 选中的方案字段必须真实驱动页面；换色只改已实现的颜色变量，不顺便改字体、布局、产品或文案。
- 开发侧可以改 CSS、组件结构和布局；运行时模型不输出 HTML/CSS，不另起渲染器。

### 阶段与门

1. **事实与能力核验**：冻结当前工业页面，列出资料、素材许可、页面结构、问答状态、视觉字段和现有引擎阻塞。缺关键证据时停在 `INCOMPLETE`。
2. **页面基准与色板样张**：先做完整人工指定页面，再在同一页面上验证默认色板至少能改变背景、文字、边框、按钮和移动端对比度；基准页不过，不进入问答扩展。
3. **最小需求引导**：实现业务归纳、主要行动、交付范围、资料缺口、视觉方向和缺图处理的可恢复确认状态；完整资料走预填，模糊输入走有限补问。
4. **方案驱动生成**：确认后的同一份方案驱动默认生成、草稿修改和预览恢复；不得硬编码公司名、手改最终 HTML 或静默缩减用户明确要求的页面。
5. **三层验收**：同时验证页面质量、需求引导和选择生效。保存当前 assemble、人工基准、自动生成三份同条件整页结果，覆盖长标题、缺图、两类产品、桌面/移动端、刷新和继续修改。

### 本 GOAL 明确不做

不做三套色卡与自由品牌色编辑、不做全行业问答、不扩五张样子卡、不继续准入模板、不恢复 stash 中的 family-kit 实验、不允许运行时任意 HTML/CSS、不以模型自评或选择器命中替代人眼验收。

### 本 GOAL 冻结结果（2026-09-20）

工业垂直切片已在 `family-kit-assembly` 的干净候选上完成：模糊的减速机请求和完整 P3I 资料都会先进入业务目标、样式、交付范围/缺图策略确认；确认后的同一方案通过 `commitOperations`、共享 preview bridge 和本地工业 overlay 生成询盘首页。工程橙色板已由 kit token 实际写入 CSS custom properties，页面保留两类资料确认的产品，缺图使用无图示意，不残留模板演示壳或未提供事实。

当前证据包括历史失败基线、人工基准页、自动生成页、修改后 revision 3 回读和 Cua 桌面/390px 移动复核；机器门禁为 `npm test` 177/177、`npm run typecheck`、`npm run build` 全部通过。等待上传图片后继续、多色板/自由调色和完整独立人工盲评仍明确留在后续切片。

### 后续切片：上传图片后继续（2026-09-20）

已补上最小可恢复图片分支：用户选择「先补充产品图」后，方案停在 `image-upload` 状态并写入会话；图片上传到当前站点并通过归属校验后，系统继续同一 `conversationId`，将图片经受控 `set_product_image`/`set_image_slot` operation 放进待确认提案。产品卡会在预览中显示已上传图片。等待图片时刷新或重新打开仍从服务端状态恢复，不会直接调用模型或修改草稿。

## Jiro 怎么用（2026-09-17 实测后的决定）

来源：首页、[/components/free](https://jiro.build/components/free)、[/templates/free](https://jiro.build/templates/free)、工业分类和若干详情页。会话 `31efb674-560a-49b7-8fb2-3b864fe3705a`。条款页 404，**只当内部 Demo 配方**。

最大价值是架构课和提示词设计，不是把免费整页当工业皮肤。首页原文：**Inconsistent Sections — “Each block looks like a different site stitched together”。** 先 Master Prompt 再贴单块 ≈ 先锁族 token 再组该公司页面。KonsTuck / Lozitick 是「同名族一整套」绑在一起，而且全 Premium。把 Forge 导航接到 Luma Features 上，就是他们自己批评的做法。

免费整页气质不像工业，**提示词仍要看**：怎么锁一族 token、怎么约束单块、怎么禁止跨源硬拼。学写法，不因皮不对就丢掉。Copy Prompt 不当生产提示词。

**免费整页 6 张，工业 0 张。** Finsyc 理财可看「克制浅色族」，不能当工业样子卡。Kelo / Velara AI / Solra 瑜伽不用。Finsyc 整页免费，同族约 13 块里 11 块锁 Premium：整页当样品，拆开要钱。

**Premium 工业站只借模块清单，不搬皮：**

| 套件 | 清单（用来显隐本地区块） | 不要 |
| --- | --- | --- |
| KonsTuck 施工 | 项目、服务、为什么选我们、FAQ、询盘 | 橙底工地实拍、假奖项数字 |
| Lozitick 物流 | 方案、询盘→提货→分拣→运输、伙伴、行业、FAQ | 飞机图、未授权 Logo |

侧栏 Industrial Business 另外两张是 VC 和摄影工作室，分类标错了。

**采用的免费组件（只借结构，丢掉演示图、假数据、荧光色）：**

| 组件 | 借什么 | 接到哪一类样子 |
| --- | --- | --- |
| Why Choose us 01 Finsyc | 左说明 + 标签 + 右列表，装饰最少 | 明亮产品、工程工业 |
| FAQ 2 Column Straight | 浅底左说明、右手风琴；去掉粉色动效 | 明亮产品、蓝白目录 |
| Footer 01 Luma | 浅色多列页脚 | 浅色族 |
| Features 01 Luma | 浅底 2×4 格；丢掉电影院 mockup 和 LipSync | 蓝白目录、灰底短路径 |
| Contact Us 02 Orbit | 左 FAQ、右询盘表；按钮色跟当前族 | 浅色询盘页 |
| FAQ 01 Luma | 深底左说明 + 右手风琴，答 MOQ/认证/交期 | 深色产品 |
| Features 02 Luma / Why Choose Us 01 Velara | 深底能力或 2×3 格 | 深色产品 |
| Footer 01 Velara | 深底多列；去掉超大字标 | 深色产品页脚 |

How it Works 04 Kelo / 01 Luma 只借「分步」计数。工业履约步骤对照 Lozitick 四步，不搬 Kelo 立体预览或发光图标。

**明确不用：** 果汁/AI/健身 Header 与 Hero、假金额 About、个人肖像、液态玻璃、光束/星球 CTA、SaaS 定价表、Stripe/GitHub 标志墙、健身房荧光表单。首屏和导航继续用当前 MIT 模板的壳。

不要接 [jiro MCP](https://jiro.build/mcp) 到建站运行时，不要把 Copy Prompt 当生产提示词。提示词设计可以学。

## 开源目录/工业素材（2026-09-18 调研，未准入）

会话 `d55f6e7c-b51f-491f-bb6f-5f14cf955f6a`。摘录：[开源目录与工业模板素材-2026-09-18.md](../research/开源目录与工业模板素材-2026-09-18.md)。Q26=B 之后这些仓库是素材候选：外贸优先核 Nordic-Store、Shop Homepage、tailwind-ecommerce；制造业公开整页很少，AstroFlow 可试。未克隆、未构建。代码 MIT ≠ 图/字体。调研 ≠ 安装。

## 质量怎么看

文案和版式走同一条路径，内部规则是 `sitecraft-frontend-less-ai-tone`。事实只来自用户资料或「待补充」。模型不输出 CSS。看成品用 `deepseek-flash` 看真实预览截图，人工仍做审美拍板。

12 组对照已在 `/quality` 按 3 个模拟包 × A/B/C/D 现场跑过，见下方 P4 账。模型自评不是审美 oracle。不能当 Demo 已验收。

## 已收口：前端去 AI 味 Skill

通用规则在 `skills/frontend-less-ai-tone/`（可写 CSS/HTML，但要先定方向）。SiteCraft 叠加层在 `skills/sitecraft-frontend-less-ai-tone/`：成品是这家公司的页面，开源模板当素材，运行时是 `sitecraft-frontend-less-ai-tone@0.3.0`，生成路径不吐 CSS。P4 对照冻结的是 `@0.2.0`。对照实验在 gitignore 的 `artifacts/frontend-tone-experiment/`。规则存在不等于审美通过，也不等于 Demo 已验收。

## 当前进度（对照工作区 `7df6f18` 之后的 Block 6）

已有（P0–P3 骨架、P4 前置，以及本块工作台主路径；仍不是整站 Demo 验收）：聊天与会话恢复、需求对齐、草稿只走 `commitOperations`；样子盘按快照挂卡；声明槽位写入；同族区块显隐；`tailwind-landing` / `fresh` 已有声明首屏；`deepseek-flash` 看过真实预览图。

**Block 6（P3 主路径，2026-09-18）**：用两份互不碰撞的模拟包在工作台点选跑通，不是 prompt 里写死答案，也不是测试把静态预览截图塞进去。

| 项 | 工业包 | 外贸包 |
| --- | --- | --- |
| 站点 | `p3-industrial` | `p3-export` |
| 资料 | 【模拟】忻州重载减速机P3I，记号 `P3I-NX7Q` | 【模拟】外高桥流体接头P3E，记号 `P3E-MW4R` |
| 样子 | 工程工业 → `screwfast`（`set_visual_brief`） | 蓝白目录 → `landwind` |
| 对齐 | 开启；点选「工程工业」；同一 `conversationId` 恢复后点「确认并应用」 | 开启；答案为「跳过」；同一会话确认后应用 |
| 生成 | 聊天提交资料 → `deepseek-flash` 出 operations → `commitOperations` | 同上 |
| 模型 | `deepseek-flash`，约 27s / 23s | `deepseek-flash`，约 28s |
| 草稿 | 生成落到 v3/v4；对话改主按钮到 v5「索取P3I-EDIT交期」；撤销后主按钮回到「获取减速机规格表」 | 生成 v3；改主按钮到 v4「索取P3E-EDIT样品」；撤销后回到「索取接头样品册」 |
| 声明首屏 | 标题/说明/主按钮写入 `P3I-NX7Q` 与规格表 CTA | 品牌名/标题/说明/主按钮写入 `P3E-MW4R` |
| 未声明壳 | ScrewFast Logo、Contact Sales Team、Trusted by Industry Leaders、合作 Logo 保持原样 | Get Figma file、Airbnb/Google 等 Logo、「Work with tools you already use」保持原样 |
| missing | `contact.*` 等非首屏声明槽位 missing，并提示可映射到 `hero.cta`；没有当精确命中 | 同左 |
| 额外页面 | 资料只要求首页/产品/联系作当前模板区块 | 模型写明独立认证页与资料下载页当前不支持，未假装开通 |

本机 `.env.local` 为 `DEEPSEEK_MODEL=deepseek-flash`。生成走了真实模型，不是 mock 当 Demo。截图在 gitignore 的 `artifacts/p3-workspace-journey/`。工作台补了「提供公司资料」面板和 `?site=` 隔离，仍走现有 `/chat` + `commitOperations`。`npm test` 108 通过。`npm run typecheck` / `npm run build` 仍会被 gitignore 的 `artifacts/sitecraft-ai-pr4-b54eca6` 拖失败；排除该目录后本仓库 TypeScript 为 0 错，Next 编译成功。未把 artifacts exclude 写进已提交的 `tsconfig.json`。

当时还没有表单收件；P5 已补。2026-09-18 起，删除须由用户明确选择，系统不得替用户主动删除；不再做 90 天自动清理。不要据此宣称 Demo 已验收。

**Q18（P3 剩余，2026-09-18）**：页面规划按「用户点名 → 模型按业务规划 → 仍不确定才用首页/产品或服务/联系」。默认三项不是上限。草稿增加 `pagePlan`，只走白名单 `set_page_plan`；落点由服务端 `resolvePagePlan` 决定，模型不能指定 placement。独立 URL 只服务快照里已有的 HTML（`forge` 的 About/Services/Contact，`screwfast` 的 products/contact）；没有对应文件就 404，不克隆首页。`landwind` 等单页快照只在同一模板里切换声明区块。工作台与 `/published/:siteKey` 读同一份 pagePlan。

| 条件 | 站点 | 结果 |
| --- | --- | --- |
| 用户点名额外页 | `q18-ask-extra` 点「额外页面」发聊天 | `source=user`；首页/产品/联系落地；认证页与资料下载页写入 unsupported，未假装开通 |
| 用户只要一页 | `q18-ask-single` 点「只要首页」 | 导航只剩首页，没有垫回三项 |
| 未指定页面 | `q18-ask-default` 点「未指定页面」 | `source=model`，规划出首页/产品/服务/关于/联系（多于三项）；无 HTML 的详情/认证/案例页说明原因 |
| 默认三项对照 | `q18-default` | `source=default`：首页（route）/产品（forge 落到已声明 services 区块）/联系（Contact HTML） |
| 多页 + 真 URL | `q18-extra` | 4 个身份；About/Contact 为独立快照页；认证与资料下载 unsupported |
| 不能假 URL | `q18-landwind` | 全部 section；`?pagePath=Contact` 返回 404 `missing-snapshot-page` |

预览路由带 `X-Sitecraft-Preview-Page`。点测覆盖工作台、发布页、桌面与 390 宽。截图在 gitignore 的 `artifacts/q18-pages/`。本块未跑图片流水线。

**P3 图片流水线（2026-09-18）**：工作台上传真实产品 JPEG → magic bytes → 站点目录 `.sitecraft-data/uploads/{workspace}/{siteId}/` → 可选 `deepseek-flash` 看图摘录事实 → 只经 `commitOperations` 写入已声明唯一 `src` 槽。没有槽位报告 missing，不猜写 Logo 或其他 img。模板演示图即使带上已上传 `imageId` 也会被拒绝。分析不改 revision，不写 HTML/CSS。

| 项 | 结果 |
| --- | --- |
| 站点 | `p3-img-hx4k`，样子工程工业 → `screwfast` |
| 照片 | Wikimedia 工业齿轮箱实拍 JPEG 2708×1988，约 852KB，magic `ffd8ff`，现场叠了记号 `P3IMG-HX4K`；不是 1×1，不当模板库存 |
| 归属 | `img_f9d049a53f16493193db5a13`，`license=user-provided`，GET 带 `X-Sitecraft-Image-Site`；跨站 `p3-export` 读同一 id 为 404 |
| 看图 | 现场 `deepseek-flash` 约 6.5s；抄到 `P3IMG-HX4K`；名称/分类为「待补充」；缺口含价格、认证、产能等；revision 仍为 2 |
| 落点 | `set_image_slot` 写入 `content.hero.image` 到 v4；预览里声明首屏 src 换成 `/api/sites/p3-img-hx4k/images/img_f9d049a53f16493193db5a13` |
| 未声明图 | 头像、features、施工图等仍是模板 `_astro` 资源；`undeclaredOwned` 为空 |
| 拒绝 | 1×1 PNG 400；`./images/hero.png` 在 bind 阶段 422「模板演示图没有客户授权」 |

截图与 JSON 在 gitignore 的 `artifacts/p3-image-pipeline/`。`next start` 生产模式仍走 PostgreSQL，未配 `DATABASE_URL` 时 `getSite` 不会退回本地文件；开发机点测以 `SITE_STORE=fs` 的 3034 草稿为准。不要据此宣称 Demo 已验收。

**P4（12 组对照，2026-09-18）**：冻结基线 `deepseek-flash`、`sitecraft-frontend-less-ai-tone@0.2.0`、样子盘、声明槽位与 `pagePlan`。三份独立模拟包（明确标「模拟」、互不撞 nonce）各跑 A/B/C/D，共 12 格，全部现场 DeepSeek，记号写入草稿。对照页 `/quality` 是评分入口：同资料只换流程组，可 `?blind=1` 隐藏分组并打乱。模型审查不是审美通过证明。作者自评界面在，样本 n=12，阈值未校准。不要据此声称客户偏好、行业真实性或转化。这不是 Demo 验收。活规则已升到 `@0.3.0`，不要把 P4 冻结基线改写成新规则。

| 包 | nonce | A 默认 | B 审美锁样子 | C 资料样子+区块 | D C+审查有限修 |
| --- | --- | --- | --- | --- | --- |
| 工业制造 | `P4M-K8VT` | live，forge / 明亮产品 | live，tailwind-landing / 灰底短路径 | live，screwfast / 工程工业 | live，screwfast；修 1 轮 |
| 外贸目录 | `P4X-R3LW` | live，forge / 明亮产品 | live，tailwind-landing / 灰底短路径 | live，landwind / 蓝白目录 | live，landwind；用缩小后的真实首屏重试视觉审查已通过；C↔D `unchanged`，未换样子 |
| 专业服务 | `P4S-Q7HN` | live，forge / 明亮产品 | live，tailwind-landing / 灰底短路径 | live，fresh / 深色产品 | live，fresh；C↔D 文案有限变化 |

B 的真实差异是生成前 `commit set_visual_brief` 锁灰底短路径，不是给 prompt 换标签。A↔B、B↔C 的样子指纹是 `look-differed`。C↔D 是 `copy-only` 或 `unchanged`，不能把 D 当成又换了一套样子。外贸/服务的 A 相对默认草稿是 `copy-only`（仍落默认明亮产品/forge）。补充证据：同一工业草稿切明亮产品/工程工业为 `look-differed`；超长标题 46 字。12 组资料都没有产品图。

点测：`http://127.0.0.1:3034/quality` 点击 12 格「预览」后 iframe 均完成草稿落点，声明首屏可见对应包记号或主标题；未声明壳（ScrewFast Logo、Get Figma file、Discover、合作 Logo 等）保持原样，没有猜写。`?blind=1&seed=19` 标签为「样本 1–4」，分组隐藏，评分下拉可点。工作台 Look board 有「12组对照」入口。`/published/:id` 改为服务端带入草稿，不再先渲染空壳；12 张首屏在 hydration 后再截，截图在 gitignore 的 `artifacts/p4-quality-comparison/`。开发机 `127.0.0.1` 需 `allowedDevOrigins`，否则 Next 会 403 掉 client chunk，预览按钮点了也不载 iframe。外贸 D 组缩小真实首屏后视觉审查已通过；C↔D 仍是 `copy-only` / `unchanged`。

**P4 负责人盲评（2026-09-18，不过）**：12 格五维分数在 `/quality` 本机 `localStorage`。工业/外贸默认组（forge）行业匹配与可读多为 1；外贸蓝白目录组主要行动为 1（页上仍是 `$29/$99/$499` 与 Get started）。整页复检：landwind 在写入铸件标题后仍留 Airbnb/Google/Microsoft Logo 墙、ITSM 文案和 SaaS 定价；screwfast 首屏标题换成「按图浇注球墨铸件」后导航仍是 ScrewFast、Log in、12.8k Reviews 和 ScrewFast 包装图；forge 铸件标题压在笔记本/代码首屏上，下方仍是 Lorem、`Company@email.com`。这不是评分 UI 缺提交按钮，是当时规则故意不碰未声明壳。Q26=B 已废弃该成品规则。Demo 审美未过。生成路径改完前不要再跑 12 组、不要扩 24。

本机 `.env.local` 为 `DEEPSEEK_MODEL=deepseek-flash`。`npm test` 134 通过。`tsc` / `next build` 仍需临时排除 gitignore 的 `artifacts/sitecraft-ai-pr4-b54eca6`，未把该 exclude 写进已提交 `tsconfig.json`。用户已把该项列入 Demo 收尾。

**P5 表单收件（2026-09-18）**：发布页右下角表单 `POST /api/public/:siteKey/leads` 落库，工作台 `/leads` 读同一条原文。成功提示不是收件证据；以收件箱可见的客户留言为准。蜜罐字段只回执、不入库。未知 `siteKey` 返回 404，且不因此新建站点草稿。设置页不再写 `lydia@sitecraft.ai` 当收件地址。邮件转发、Mailpit、生产 PostgreSQL 询盘表均未实测，标 `UNVERIFIED`。forge Contact、landwind 询盘区和 screwfast 首页联系区写入了 `data-sitecraft-inquiry` 表结构；iframe 预览 CSP 为 `form-action 'none'`，提交经 preview-bridge `postMessage` 由发布页代发到同一收件箱。模板演示表单（如 web3forms）已从 forge Contact 快照去掉，不会进收件箱。这不是 Demo 验收。

| 项 | 结果 |
| --- | --- |
| 站点 | `p5-inbox-hx7k`，发布页 `http://127.0.0.1:3034/published/p5-inbox-hx7k` |
| 发送 | 点开「发送询盘」，留言 `P5LEAD-CLICK-HX7K 发出去必须能在收件箱读到` |
| 收件 | `/leads?site=p5-inbox-hx7k` 与 `GET /api/leads?site=p5-inbox-hx7k` 读到同一条：`click@p5lead.test` / `lead_24327262ca6848719006d114` |
| 拒绝 | 对不存在站点 POST 返回 404，`.sitecraft-data/sites/` 不出现该 id |
| 驱动 | 开发机 `SITE_STORE=fs`；`npm test` 141 通过 |

`tsc` / `next build` 仍需临时排除 gitignore 的 `artifacts/sitecraft-ai-pr4-b54eca6`。不要据此宣称 Demo 已验收。

## 数据删除（2026-09-18）

用户决定（取代 2026-09-15 的 Q17=A）：删除须由用户明确选择；系统不得替用户主动删除对话、草稿、上传或站点。不实现 90 天自动清理，也不保留可暂停的自动清理开关。已发布站点仍由用户控制，不得静默删除。工作台预览栏有「删除本站」，设置页「手动删除」列出已保存站点；都要输入站点编号才真正删除。删除区每行可回工作台或发布页；悬停后以浮层加载一份发布页预览，不单独留白，也不预先打开全部 iframe。打开已删站点的工作台仍会按现有 `getSite` 新建一份空草稿，这不是自动清理。

## 下一步（先完成基准页，再扩展产品）

### 0. 清理与冻结（本轮已完成）

- 已将未验收的 family-kit / admission 实验完整保存为可恢复 stash：`pre-goal-family-kit-20260920`；它不进入当前基线，也不作为已完成证据。
- 当前基线为提交 `e6b2370`，工作树恢复干净。后续只从这条基线做窄改，不继续沿用那批跨 30 个文件的临时组装代码。
- 在任何实现前保存当前工业 assemble 的桌面、平板、手机整页截图和草稿快照；记录模板、资料、素材、模型和视口，作为 `current` 对照。

### 1. 事实、素材与引擎边界（第 1–2 个工作日）

读取忻州重载减速机 P3I 的完整模拟资料，列出可用产品类别、加工方式、规格字段、询盘边界、图片/文件及其来源和许可。同步审计现有 `preview-bridge`、adapter、`commitOperations` 和工作台入口：确认开发侧能改 CSS/组件，运行时仍由受控操作驱动；记录无法表达的布局或内容关系，不先发明 schema。

必须留下：事实与素材清单、页面结构草图、当前结果基线、引擎阻塞清单。缺资料必须写成「待补充」或采用无图/精简版，不能以模板演示素材补齐。

### 2. 人工明确指定的工业基准页（第 3–5 个工作日）

在现有工作台和共享预览链路中先做一张人工指定结构的完整页面，允许提交必要的 CSS、组件结构和布局规则。

- 首屏回答「提供什么、面向谁、下一步做什么」；核验记号保留在事实/核验层，不占据访客主标题。
- 产品类别只展示资料确认的类别；加工方式单列为业务协作方式，不塞进产品卡凑数。
- 有规格才展示参数；没有就告诉访客询盘需要提供哪些信息。
- 有明确来源和权限的产品图才使用图文版；否则使用紧凑无图版，不保留空图位，不冒充工厂实拍。
- 询盘入口只承诺当前实际能力；没有接通收件服务时，明确为演示状态，不显示虚假的已收件。
- 不出现模板品牌、客户 Logo 墙、SaaS 定价、假评价、演示图、假认证/产能/客户名单、空链接或重复占位文案。

负责人先做人眼验收，桌面和移动端都必须过关；基准页不过，不进入扩套件或扩样子卡。

### 3. 默认生成复现基准页（第 6–8 个工作日）

把已过关的页面结构接回资料绑定、模型规划、草稿修改和预览恢复。默认生成不得依赖硬编码公司名或手改最终 HTML；仍通过 `commitOperations`，仍由共享预览引擎渲染。模型只选择已实现的结构/布局变体并填入有依据的内容，不输出 HTML/CSS。

至少覆盖：缺图、缺可选资料、长中文标题、只有两类产品、刷新后继续修改、工作台与发布页读取同一草稿。所有未支持的页面要求仍按 `pagePlan` 明确说明，不得静默缩成首页。

### 4. 同条件对照与收口（第 9–10 个工作日）

使用相同资料、素材、视口和模型保存三份结果：当前 assemble、人工基准、自动生成。整页匿名并排检查桌面/移动端，记录结构差距、事实差距、布局差距和持久化证据。只有这张工业页通过后，才恢复族内模块、色卡、生成前对齐和新目录素材的后续工作。

这轮不刷 `/quality` 12 组，不以“隐藏成功”“选择器命中”或模型自评替代人眼判断；SMTP、`tsconfig` 收尾和新素材准入顺延到基准页通过后的独立模块。

### 完成条件

本切片只有在以下证据齐全时才标记 `PASS`：事实/素材清单；当前、人工、自动三份同条件整页证据；桌面与移动端浏览器检查；长标题/缺图/两类产品/刷新修改回读；相关测试、`npm run typecheck`、`npm test`、`npm run build` 结果；冻结候选的独立结构/行为复核。否则标为 `INCOMPLETE`、`BLOCKED` 或 `NO_GO`，不以代码存在或测试数量代替页面质量。

不要搬 jiro 源码，不要整仓 merge PR #4，不要把未核许可的调研仓库推进 `vendor/`，也不要在基准页通过前扩充套件或样子卡。

## 独立整页盲评（2026-09-20）

使用同一份 P3I 资料建立无图版和带图版候选，覆盖长标题、两类产品、桌面/390px 移动视口和刷新回读。唯一发现的视觉问题是带图版商品网格中一张有图、一张无图时内容基线不齐；已修为同高媒体区，并在缺图卡显示「产品图待补充」。盲评证据与截图位于 `artifacts/industrial-visual-blind-review-2026-09-20/`，本轮命名切片结论为 `PASS_LIMITED_SLICE`。
