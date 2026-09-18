# SiteCraft AI 执行计划

状态：grilling Round 15 写入；2026-09-18 用户决定取代 Q17=A；版本 v0.7。需求事实以 [intent.md](./intent.md) 为准，主线以 [mainline.md](./mainline.md) 为准。旧 P0–P5 细账见 git 历史与 `.grilling/`。

## 要做成什么样

帮中小企业做出看起来像该行业自己建的网站：好看、不像套模板或套 AI 文案、事实不编造、改完能立刻在预览里看到。近期仍是内部 Demo，资料用模拟工业/设备/外贸包。

不在本阶段做：真实客户试点、公开自助上线、整仓合并 PR #4、模型直接写 HTML/CSS、跨模板自由拼装、把 jiro 源码或 MCP 接进生成运行时。

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

同一视觉族里由模型挑选要出现的区块；用不到的区块隐藏或保持模板原样，不把外站 HTML 拼进来。区块内部仍只改声明槽位。找不到、命中多个、没登记的位置报告 `missing`。草稿只走 `commitOperations`。

原生 React/shadcn 系统改造仍留在后续决策门（D5）。本阶段不新写跨源模块拼装器。

## Jiro 怎么用（2026-09-17 实测后的决定）

来源：首页、[/components/free](https://jiro.build/components/free)、[/templates/free](https://jiro.build/templates/free)、工业分类和若干详情页。会话 `31efb674-560a-49b7-8fb2-3b864fe3705a`。条款页 404，**只当内部 Demo 配方**。

最大价值是架构课，不是素材库。首页原文：**Inconsistent Sections — “Each block looks like a different site stitched together”。** 先 Master Prompt 再贴单块 ≈ 先锁族 token 再填槽。KonsTuck / Lozitick 是「同名族一整套」绑在一起，而且全 Premium。把 Forge 导航接到 Luma Features 上，就是他们自己批评的做法。

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

不要接 [jiro MCP](https://jiro.build/mcp) 到建站运行时，不要把 Copy Prompt 当生产提示词。

## 质量怎么看

文案和版式走同一条路径，内部规则是 `sitecraft-frontend-less-ai-tone`。事实只来自用户资料或「待补充」。模型不输出 CSS。看成品用 `deepseek-flash` 看真实预览截图，人工仍做审美拍板。

12 组对照已在 `/quality` 按 3 个模拟包 × A/B/C/D 现场跑过，见下方 P4 账。模型自评不是审美 oracle。不能当 Demo 已验收。

## 待合并：前端去 AI 味 Skill

Round 14 / Q22 记下，本轮规划一并入库。

- 文件：`skills/sitecraft-frontend-less-ai-tone/SKILL.md`、`SOURCE.md`，运行时 `lib/frontend-tone.ts`（`sitecraft-frontend-less-ai-tone@0.2.0`），`lib/ai-provider.ts` 已引用。
- 主对话还要核：prompt 里两层都在用、用户选项不出现 Skill 名、禁止吐 CSS、测试钉版本。不要再平行写一套规则。

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

**P4（12 组对照，2026-09-18）**：冻结基线 `deepseek-flash`、`sitecraft-frontend-less-ai-tone@0.2.0`、样子盘、声明槽位与 `pagePlan`。三份独立模拟包（明确标「模拟」、互不撞 nonce）各跑 A/B/C/D，共 12 格，全部现场 DeepSeek，记号写入草稿。对照页 `/quality` 是评分入口：同资料只换流程组，可 `?blind=1` 隐藏分组并打乱。模型审查不是审美通过证明。作者自评界面在，样本 n=12，阈值未校准。不要据此声称客户偏好、行业真实性或转化。这不是 Demo 验收。

| 包 | nonce | A 默认 | B 审美锁样子 | C 资料样子+区块 | D C+审查有限修 |
| --- | --- | --- | --- | --- | --- |
| 工业制造 | `P4M-K8VT` | live，forge / 明亮产品 | live，tailwind-landing / 灰底短路径 | live，screwfast / 工程工业 | live，screwfast；修 1 轮 |
| 外贸目录 | `P4X-R3LW` | live，forge / 明亮产品 | live，tailwind-landing / 灰底短路径 | live，landwind / 蓝白目录 | live，landwind；用缩小后的真实首屏重试视觉审查已通过；C↔D `unchanged`，未换样子 |
| 专业服务 | `P4S-Q7HN` | live，forge / 明亮产品 | live，tailwind-landing / 灰底短路径 | live，fresh / 深色产品 | live，fresh；C↔D 文案有限变化 |

B 的真实差异是生成前 `commit set_visual_brief` 锁灰底短路径，不是给 prompt 换标签。A↔B、B↔C 的样子指纹是 `look-differed`。C↔D 是 `copy-only` 或 `unchanged`，不能把 D 当成又换了一套样子。外贸/服务的 A 相对默认草稿是 `copy-only`（仍落默认明亮产品/forge）。补充证据：同一工业草稿切明亮产品/工程工业为 `look-differed`；超长标题 46 字。12 组资料都没有产品图。

点测：`http://127.0.0.1:3034/quality` 点击 12 格「预览」后 iframe 均完成草稿落点，声明首屏可见对应包记号或主标题；未声明壳（ScrewFast Logo、Get Figma file、Discover、合作 Logo 等）保持原样，没有猜写。`?blind=1&seed=19` 标签为「样本 1–4」，分组隐藏，评分下拉可点。工作台 Look board 有「12组对照」入口。`/published/:id` 改为服务端带入草稿，不再先渲染空壳；12 张首屏在 hydration 后再截，截图在 gitignore 的 `artifacts/p4-quality-comparison/`。开发机 `127.0.0.1` 需 `allowedDevOrigins`，否则 Next 会 403 掉 client chunk，预览按钮点了也不载 iframe。外贸 D 组缩小真实首屏后视觉审查已通过；C↔D 仍是 `copy-only` / `unchanged`。

本机 `.env.local` 为 `DEEPSEEK_MODEL=deepseek-flash`。`npm test` 134 通过。`tsc` / `next build` 仍需临时排除 gitignore 的 `artifacts/sitecraft-ai-pr4-b54eca6`，未把该 exclude 写进已提交 `tsconfig.json`。

**P5 表单收件（2026-09-18）**：发布页右下角表单 `POST /api/public/:siteKey/leads` 落库，工作台 `/leads` 读同一条原文。成功提示不是收件证据；以收件箱可见的客户留言为准。蜜罐字段只回执、不入库。未知 `siteKey` 返回 404，且不因此新建站点草稿。设置页不再写 `lydia@sitecraft.ai` 当收件地址。邮件转发、Mailpit、生产 PostgreSQL 询盘表均未实测，标 `UNVERIFIED`。模板里的演示表单（如 web3forms）不会进收件箱；没有把 FAQ/询盘结构写进各 MIT 模板 HTML。这不是 Demo 验收。

| 项 | 结果 |
| --- | --- |
| 站点 | `p5-inbox-hx7k`，发布页 `http://127.0.0.1:3034/published/p5-inbox-hx7k` |
| 发送 | 点开「发送询盘」，留言 `P5LEAD-CLICK-HX7K 发出去必须能在收件箱读到` |
| 收件 | `/leads?site=p5-inbox-hx7k` 与 `GET /api/leads?site=p5-inbox-hx7k` 读到同一条：`click@p5lead.test` / `lead_24327262ca6848719006d114` |
| 拒绝 | 对不存在站点 POST 返回 404，`.sitecraft-data/sites/` 不出现该 id |
| 驱动 | 开发机 `SITE_STORE=fs`；`npm test` 141 通过 |

`tsc` / `next build` 仍需临时排除 gitignore 的 `artifacts/sitecraft-ai-pr4-b54eca6`。不要据此宣称 Demo 已验收。

## 数据删除（2026-09-18）

用户决定（取代 2026-09-15 的 Q17=A）：删除须由用户明确选择；系统不得替用户主动删除对话、草稿、上传或站点。不实现 90 天自动清理，也不保留可暂停的自动清理开关。已发布站点仍由用户控制，不得静默删除。工作台里还没有删除入口，用户目前仍不能在产品里选删。

## 下一步（一次一块，给主对话执行）

1. ~~核 `sitecraft-frontend-less-ai-tone` 已进生成 prompt，本机 `DEEPSEEK_MODEL=deepseek-flash`。~~
2. ~~把工作台主题卡改成上表样子盘。~~
3. ~~在 `forge` / `screwfast` / `landwind` 上按清单显隐同族区块。~~
4. ~~给 `tailwind-landing` / `fresh` 补声明首屏落点。~~
5. ~~用一张真实预览截图打通 `deepseek-flash` 看图。~~
6. ~~用模拟工业/外贸包跑完整工作台生成。~~ 不要据此宣称 Demo 已验收。
7. ~~Q18 需求驱动页面：pagePlan + 真快照 URL / 页内区块，默认三项不是上限。~~
8. ~~P3 图片识别与素材授权流水线。~~
9. ~~12 组对照（P4）。~~
10. ~~表单收件（P5）：询盘发出去、收件箱能读到同一条。~~ 邮件转发未接通。工作台还没有用户手动删除入口。不要搬 jiro 源码。不要据此宣称 Demo 已验收。
