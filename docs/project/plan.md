# SiteCraft AI 执行计划

状态：grilling Round 15 写入；版本 v0.6。需求事实以 [intent.md](./intent.md) 为准，主线以 [mainline.md](./mainline.md) 为准。旧 P0–P5 细账见 git 历史与 `.grilling/`。

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

12 组对照要等主题卡按上表挂上、至少两套以上样子能整页生成之后再打。现在只有 Forge/Landwind 首屏对照，不能当 Demo 已验收。

## 待合并：前端去 AI 味 Skill

Round 14 / Q22 记下，本轮规划一并入库。

- 文件：`skills/sitecraft-frontend-less-ai-tone/SKILL.md`、`SOURCE.md`，运行时 `lib/frontend-tone.ts`（`sitecraft-frontend-less-ai-tone@0.2.0`），`lib/ai-provider.ts` 已引用。
- 主对话还要核：prompt 里两层都在用、用户选项不出现 Skill 名、禁止吐 CSS、测试钉版本。不要再平行写一套规则。

## 当前进度（对照工作区 `02c5c83`）

已有（P0–P3 骨架和 P4 前置，不是整站 Demo）：聊天与会话恢复、需求对齐、草稿只走 `commitOperations`；四张主题卡能切到真实模板（工业 Forge、外贸 Landwind）；声明槽位写入；同一份 A17/B84 换主题后首屏布局和正文都会变。

还没有：工作台整段生成（资料→主题→对齐→出站→对话改）；图片识别与素材授权；Q18 需求驱动多页；`tailwind-landing` / `fresh` 同等落点；12 组截图盲评；90 天清理和表单收件；样子盘改挂；同族区块显隐。

## 下一步（一次一块，给主对话执行）

1. 核 `sitecraft-frontend-less-ai-tone` 已进生成 prompt，本机 `DEEPSEEK_MODEL=deepseek-flash`。
2. 把工作台主题卡改成上表样子盘，每张卡只挂已核快照；不再按行业 1:1 绑死。
3. 在 `forge` / `screwfast` / `landwind` 上按 KonsTuck/Lozitick 清单显隐同族区块；槽位规则不变。需要新区块时用上表配方写进该模板自己的 HTML，不跨模板粘贴。
4. 给 `tailwind-landing` / `fresh` 补与 Landwind 同级的声明首屏落点，再谈 12 组对照。
5. 用一张真实预览截图打通 `deepseek-flash` 看图。
6. 用模拟工业/外贸包跑完整工作台生成。不要先开 12 组审美评测，也不要去搬 jiro 源码。
