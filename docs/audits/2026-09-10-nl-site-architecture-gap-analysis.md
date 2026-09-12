# AI 自然语言建站：架构差距与痛点分析

**日期**：2026-09-10
**方法**：① 本项目代码实读取证（`file:line`）；② Exa 联网调研市面产品与 2026 年学术文献；
③ 对照分析。
**证据分级**：`[码]` = 本项目代码可验证 · `[研]` = 外部公开资料 · `[推]` = 我的推断

---

## 一、结论先行

**1. 架构方向没走错，而且恰好撞上了 2026 年的 SOTA 范式。**
我们做的「模板骨架冻结 + 槽位注入内容」，在学术上叫 **scaffold-driven structured generation**。
arXiv《WebGen-R1》结论是：**让 LLM 只在预校验模板里生成可变部分**，能把 7B 模型拉到
接近 DeepSeek-R1 (671B) 的功能成功率 `[研]`。
Webflow 2026-05 发布的 Components 2.0 Slots（命名槽位）一个月内 62% 用户采纳、组件编辑量 -47% `[研]`
——和我们 `lib/template-manifests/` 的设计几乎同构。

**2. 但我们只做了这个范式的第 1 步（共 3 步），停在了最没有回报的位置。**
WebGen-R1 的三段是：静态校验 → **构建并渲染** → **VLM 视觉评审**。
我们有第 1 段（`template-slot-guard.ts` 的槽位预检，做得不错），
**第 2、3 段完全缺失**——生成完从不回头看渲染结果 `[码]`。

**3. 你说的「完成度太低」，是全行业未解的问题，不是你的实现 bug。**
调研到的每一份 2026 年建站指南都在说同一句话：
"AI 出初稿只要 3 分钟，**但你的大部分时间会花在替换占位图和重写文案上**" `[研]`。
**正因为没人解掉，谁解掉谁就有护城河。**

---

## 二、差距有多大：分三层看

### 第 1 层：架构范式 —— **零差距，甚至略优** `[推]`

| | 市面主流 | 我们 | 判断 |
|---|---|---|---|
| 生成范式 | Lovable/Bolt 走**真代码生成**；Wix 走**自研 LLM**；Hostinger/10Web 走模板 | 模板骨架 + 槽位内容注入 | 与研究界结论一致 |
| 结构可靠性 | 代码生成有构建失败风险 | 模板已构建，**结构天然不会坏** | 我们更稳 |
| 槽位契约 | Webflow 2026-05 才发 Slots | 我们已有 `TemplateSlotBinding` | 平手，方向对 |
| 操作校验 | — | 操作白名单 + 长度硬校验 + 破坏性确认 + 逆操作 | **领先** |

**这一层不该自卑。** 我们不可能也不该跟 Lovable 比"生成真代码"——那是另一个赛道。

### 第 2 层：生成质量闭环 —— **差距最大** `[码]`

| 能力 | 市面 | 我们 |
|---|---|---|
| 渲染后回看 | Lovable：客户端 AST + HMR 实时回显；学术界：VLM 视觉评审 +17.8% `[研]` | **无。生成完直接提交** `[码]` |
| 视觉一致性 | Wix **brand kit**；Vercel 发布 **design.md + 公共样式表** `[研]` | **无。配色一律取模板值** `[码]` |
| 结构可变 | Wix 拖拽 / Lovable 改代码 | **冻结**。生成 scope 不含增删卡/重排 `[码]` |
| 图片 | 各家用 stock 库 + 部分 AI 生图 | **无 AI 生图**；22 模板仅 12 个首屏图可换 `[码]` |

### 第 3 层：垂直行业纵深 —— **差距大，尤其对「代建服务」定位** `[推]`

调研到最贴近你商业模式的竞品是 **AB客**（外贸 B2B 智能建站）`[研]`，它的护城河是：

- **150+ 行业模板**，自动匹配目标市场偏好（欧美极简 / 中东奢华 / 东南亚色彩）
- **行业语义库**：机械/工业/化工/五金术语，自动生成**技术规格页、参数表、合规字段
  （RoHS / CE / REACH）**，目标是"看起来像专业外贸工程师写的，而不是机器翻译"
- 47+ 语种站群、SEO 自动提交与自修复、365 天无人值守内容更新
- **全链路询盘闭环**：访客轨迹 → 行为回放 → 询盘质量评分

**我们的 22 个模板有 category，但没有行业字段 schema。** 这是"看起来专业"与"看起来像 AI 写的"的分水岭。

---

## 三、痛点清单（按「影响 × 修复成本」排序）

### 🔴 P0-1：默认草稿是硬编码的 Forge 英文演示文案，且会泄漏到成品

**证据** `[码]`：每次生成 `baseDraft = cloneDraft(defaultDraft)`（`lib/site-generator.ts:83`），
`defaultDraft` 是写死的 Forge 英文示例（`lib/site-document.ts:178-261`，hero = "Built for the next standard."）。
LLM 只产操作去覆盖它；**任何 LLM 没覆盖到的槽位，就留着这句英文演示文案上线**。

这正是那篇《AI Slop 2026》描述的成熟形态 AI 垃圾的配方 `[研]`——而且是我们**确定性地、每次**注入的。

**这是全清单里最便宜、最该立刻修的一条。**

### 🔴 P0-2：没有渲染回检环 —— 生成了但从不看

**证据** `[码]`：生成链路 `generateDraftOperations` → `validateGenerationOperations` → `commitOperations`，
**没有任何一步渲染或截图**。只有静态校验。
后果：布局溢出、图文错配、板块空转、中英混排——**只有用户肉眼能发现**。
而 `partial` / `missingSections` / `coverage` 这些指标是**统计操作数量**，不是看效果。

**讽刺的是资源已经就位**：`preview/route.ts` 的 bridge script 会回传 `applied` 报告，
我上一轮已经做了 `lib/rendered-structure.ts` 把它序列化成结构摘要进 prompt `[码]`。
**离"截图 + VLM 评审"只差一次截图和一次模型调用。**

### 🟠 P1-3：没有品牌层，配色字体无入口

**证据** `[码]`：`designTokens` 字段存在但 2026-09-09 起生成链路已不再下发
（`lib/site-generator.ts:52-60`），前端预览写死 `designTokens:null`；`design-variants.ts` 只收敛
字体/圆角/密度，**配色一律取模板值**。chat 的 `aiOperationSchema` 里**根本没有** `set_design_tokens`。

Vercel 的教训值得抄 `[研]`：他们试过"把设计写成 prompt 描述"，结果
**"每个模型读同一份描述，生成的页面千差万别"**；最终解法是**发布一份有界的样式表 + 文档化类名**，
让 agent 只用这些类名，而且**样式表本身不进模型上下文**（省 token）。

### 🟠 P1-4：结构冻结 —— 想加个板块只能换模板

**证据** `[码]`：生成 scope 白名单只有 `set_text / update_card / update_product /
set_section_visibility / set_template / set_design_tokens`（`lib/site-operations.ts:524-527`）。
`reorder_sections` **不在任何生成 scope 内**，板块顺序由模板 manifest 决定。
注意 `regenerate-structure`（mode=all）**是允许** add/remove card 的——但**首次生成不给用**，
且已发现卡死风险（`tests/template-slot-contract.test.ts:85`）。

### 🟠 P1-5：商品目录闭环断裂 —— AI 永远写不出产品

**证据** `[码]`：`replace_products` 不在任何生成 scope（`site-operations.ts:524-527`），
但 `products` 是**模板级必填**（`shared.ts:87-93`）→ 新站无商品时**静默隐藏整个产品板块**
（`site-generator.ts:90`）。

对制造业/外贸客户，产品板块就是主菜。AB客 的核心卖点恰恰是"产品页批量生成" `[研]`。

### 🟡 P2-6：兜底是纯硬编码，与用户业务无关

**证据** `[码]`：Batch A 失败时 `fastSkeletonOperations` 把 companyName 当 hero.title、
CTA 写死"获取询盘"（`site-generator.ts:327-342`）。

### 🟡 P2-7：模板选择其实是规则系统，AI 自主度有限

**证据** `[码]`：`categoryFromKeywords` 关键词先定 category（`site-intent.ts:450-455`），
模型推荐的 `recommendedTemplateId` **仅当落在该 category 白名单内才采用**，
否则用 `DEFAULT_TEMPLATE_FOR_CATEGORY`（`site-intent.ts:545-581`）。
22 个模板里真正参与"被 AI 选"的，每个 category 只有那几个。

### 🟡 P2-8：会话记忆不持久

**证据** `[码]`：`globalThis` 内存 Map，TTL 30 分钟、上限 500（`lib/ai-session.ts:54-67`）。
重启即丢，多实例不共享。

### 🟢 P3-9 / 10：撤销是单步、无草稿分支

`[码]`：会话式撤销只要后面有任何别的改动就拒绝（`site-store.ts:554-561`）；
无三方合并，冲突只能刷新重试。

---

## 四、贴合本项目的补足设计（具体到能开工）

> 排序原则：**复用已有机制 > 新增机制**。每条都标出可复用的现成资产。

### 🥇 设计 1：渲染回检环（critic-in-the-loop）

**为什么是它**：学术实测 **3 轮反馈 +17.8%**，且 Claude 4.5 Sonnet 自改进场景下
**86% 的任务在 ≥1 轮后取得最佳结果** `[研]`。这是投入产出比最高的一条。

**为什么我们做得起**：资产已就位——
- `app/api/templates/[templateId]/preview/route.ts` 已能渲染任意模板 + 注入草稿 + 回传 `applied`
- `lib/rendered-structure.ts`（我上一轮建的）已能把渲染结果序列化成结构摘要
- `lib/ai-provider.ts:216` 已有 `requestStructuredOperations` 可复用作评审调用

**做法**：
```
生成完成 → 提交前
  → 渲染 + 截图（每板块一张，或整页分段截图）
  → VLM 评审：给「用户意图 + 截图 + 渲染结构摘要」
  → 输出结构化问题清单（哪个板块、什么问题、严重度）
  → 只对 severity=high 的板块自动重生成一次（复用 regenerateSectionOperations）
  → 仍不达标则标记「待人工」而非硬塞
```
**关键约束**：**评审要看视觉，不能只看结构**。文献指出纯结构校验会漏掉
"视觉完美但事件处理是坏的"，而纯视觉校验会漏掉"看不见的功能逻辑"——
所以是**双通道**：VLM 看截图 + 结构摘要看 DOM `[研]`。

**可验证验收**：同一批 10 个测试 prompt，回检前后各跑一遍，
产出「问题板块数」「用户可见的占位文案数」两个数字，要求前者下降。

---

### 🥈 设计 2：把「槽位契约」升级成「有界词汇表」（对标 Vercel design.md）

**为什么**：Vercel 的核心洞察 `[研]`——**不要让模型描述设计，给它一份有界词汇表**。
他们发布公共样式表 + 文档化类名/token，agent 在 HTML 里只用这些名字，
**且样式表本身不进上下文**。

**我们的对应物**：`lib/template-manifests/<id>.ts` 里的 `TemplatePresentationBlock`
（`types.ts:85-104`）已经是"这个板块能装什么、怎么组织"的声明。
把它扩成每个模板一份**品牌变量清单**：主色/辅色/字体/圆角/密度/间距节奏——
**用户（或代建方）填一次，全站一致**。

**这解决了 §3-P1-3**，而且**不引入"AI 随机换肤"**（那正是我们 9-09 砍掉 designTokens 的理由）。
定位是 **brand kit**（Wix 已有，是标配），不是 AI 配色实验。

---

### 🥉 设计 3：制造业行业字段 schema（对标 AB客，接 `sourceMaterial`）

**为什么**：这是"看起来像专业外贸工程师写的"与"看起来像 AI 写的"的分水岭 `[研]`。
也是你 `promptProfile.starters` 里已经在做的事情的手工版
（"把首屏改成精密零部件出口企业"）。

**做法**：给 category=制造业/外贸目录 的模板挂**行业字段 schema**：
```
精密零部件: 材质 / 公差 / 表面处理 / 适用工况 / 认证(RoHS·CE·REACH) / 产能 / MOQ
```
让 AI 按字段写，而不是写通用文案。
**复用**：`lib/site-generator.ts:170` 的 `buildSourceMaterialBlock()`（上限 8000 字）
已经是事实基准通道，行业 schema 可以作为它的结构约束层。

---

### 设计 4：商品目录闭环（补 §3-P1-5）

`products` 是模板级必填却无人能填 → 静默隐藏。
把 `replace_products` 加进 generation scope，或**至少**在缺失时走「显式询问」
而不是静默隐藏。对制造业客户这是主菜。

---

### 设计 5（产品层）：把「有生产力的摩擦」做成显式设计

arXiv《Interrogating Design Homogenization in Web Vibe Coding》`[研]` 的结论：
**无摩擦生成会加剧设计同质化**——用户倾向于接受第一个"看起来还行"的统计平均值。
它提出的解法是 **productive friction**：AI 做**主动顾问**而非**沉默执行者**。

**我们已经有雏形**：`need_info` 追问流程（`app/generate/page.tsx:419`）。
但现在的追问是"信息不够所以问你"，应该升级成**"这是我要做的判断，你选一下"**——
比如生成后给 2 个不同的板块组织方案，让用户选，而不是闷头出一个。
**这是把"完成度低"从缺陷变成产品特色的路径。**

---

## 五、不确定度与证据边界

**我实际验证过的**：
- 本项目代码事实：Agent 实读取证，带 `file:line`
- 外部结论：Exa 检索到的论文与厂商博客原文摘录

**我没有验证的**（不要在决策中当作事实）：
- WebGen-R1 的 benchmark 数字是**论文自报**，我未复现
- Lovable/Wix 的架构描述来自**厂商博客与第三方评测**，非独立验证
- 市场对比里**我没有实际注册试用 AB客 / Creght / Wix Harmony**——
  这些是公开资料描述，可能优于或劣于实际体验
- 本报告**没有做我们产品的端到端实测**（上一轮会话有实测记录：22/22 模板无 404、
  442 项测试全绿；但"生成质量"本身本轮未实测）

**建议的下一步取证**：用 5-10 条真实制造业客户 prompt，跑一遍生成，
人工统计「需要手工改动的板块数」——这是量化"完成度太低"的基线，
也是设计 1（渲染回检环）的对照基准。

---

## 附：关键文件索引

| 职责 | 文件 |
|---|---|
| 生成编排 | `lib/site-generator.ts` |
| 意图理解 | `lib/site-intent.ts` |
| LLM 调用（唯一出网点） | `lib/ai-provider.ts` |
| 草稿模型（含硬编码默认草稿） | `lib/site-document.ts:178-261` |
| 操作白名单与校验 | `lib/site-operations.ts:524-534` |
| 槽位契约 | `lib/template-manifests/types.ts`、`lib/template-slot-guard.ts` |
| 会话记忆 | `lib/ai-session.ts` |
| 渲染回传（回检环的基础） | `app/api/templates/[templateId]/preview/route.ts` |
| 渲染结构摘要（已建） | `lib/rendered-structure.ts` |
