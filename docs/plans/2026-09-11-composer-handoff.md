# 拼装引擎：实施交接文档

> ⚠️ **本文档已被 [`docs/PRODUCT-BASELINE.md`](../PRODUCT-BASELINE.md) 取代**（2026-09-12）。
> 冲突时以基线为准；本文保留作为决策过程的历史记录，**不删、不再维护**。

> **给执行会话的独立指令。** 本文自包含，不需要读之前的对话记录。
> 项目：`d:\sitecraft-ai`（AI 建站，Next.js 16 + TS strict + 单测 + Playwright）
> 日期：2026-09-11 · 目标：**把「模型出 DSL → 我们拼装出网站」这条链跑通**

---

## 0. 先读这一节（否则会做错方向）

### 0.1 这件事的性质

**不要写**「模型直接生成 HTML/CSS」的代码。原因是实测出来的，不是偏好：

| 实测项 | 开推理 | 关推理 |
|---|---|---|
| completion_tokens | **16000（打满上限，被截断）** | 2942 |
| reasoning_tokens | **14465（占 90%）** | 0 |
| 实际代码 | 4286 字符（**断的**） | 8530 字符（完整） |
| `data-sitecraft-slot` 槽位 | **0 个** | 23 个 |

同一模型、同一张图、同一套提示词，**只改一个参数**，产出从"截断残页"变成"完整页面"。

**结论**：让模型写代码，系统的稳定性就系于**模型的临时状态**。所以：

```
模型只出 DSL（几十行 JSON：选组件 + 排序 + 填内容 + 配色）
        ↓
拼装器（我们写死的确定性代码）→ HTML（槽位自动带上）
```

**产出物由我们的代码决定，不由模型决定。** 这是整个方案的地基。

### 0.2 「槽位」是什么，为什么它是命门

模板 HTML 里的节点带 `data-sitecraft-slot="hero.title"` 这样的属性。系统的**就地编辑、覆盖统计、质量门禁、忠实度校验**全部依赖它。

**模型写代码时槽位靠"求它记得写"（实测会 0 个）；拼装时槽位是拼装器打上去的（必然正确）。**

### 0.3 核心资产是什么

**不是"截图解析能力"，是"稳定的组件库 + 拼装引擎"。** 截图解析是可替换的入口；组件库和拼装引擎才是别人抄不走的。**所有决策以此为最高优先级。**

### 0.4 不做什么（有证据，别自作主张）

| 不做 | 证据 |
|---|---|
| **逆向 22 个模板的 HTML** | 它们是 Astro/Next 构建产物（编译过的 JSX、打包的 CSS），抽不出可复用组件 |
| **用 `components/site-renderer.tsx` 当组件库底子** | 全仓**零 import**（死代码）、**无 `data-sitecraft-slot`**、无版式变体、`features.items` 从未渲染 |
| **资质墙 / 参数表 / 产品分类格** | 24 个模板零命中或近乎零命中（详见 §3.3） |
| **一次性改 `navigation` schema + 21 个适配器** | 影响面是 21 个文件按位置索引硬绑 5 键，会引发大规模回归（详见 §7） |

---

## 1. 已核实的现状（不要重复调研）

| 环节 | 状态 | 证据 / 路径 |
|---|---|---|
| 单测基线 | **514 条全绿** | `npm test` |
| 模板数量 | 目录 22 = catalog 22，一致 | `vendor/open-source-templates/`（22 个目录）、`lib/template-catalog.ts` |
| 运行时模板目录 | 已有 2 个（fengji / jinggong） | `.sitecraft-data/generated-templates/` |
| HTML → 模板（落盘+注册+槽位补全+门禁） | ✅ **现成，且注释写明就是为本场景写的** | `app/api/templates/runtime/route.ts` |
| 不重启进程即可用 | ✅ 现成 | 同文件 `:201-207` |
| 用新模板建站 | ✅ 现成 | `POST /api/sites`，校验走 `allTemplates()`（`app/api/sites/route.ts:10`） |
| 下游整条链（预览/就地编辑/导出/发布） | ✅ **一行不改** | 只要产出**带槽位属性的自包含 HTML** |
| 存图 | ✅ 现成 | `POST /api/product-images`（FormData `file`，5MB，MIME 白名单） |
| Playwright 截长图 + 中文字体 | ✅ **已实测**：1088×2454、中文完全清晰、PNG 42KB | 见 §9「必须避开的坑」 |
| **拼装器** | ❌ **必须从零写** | 全仓无 `renderToString`、无 `renderXxxHtml` |
| **多模态调用** | ❌ **全仓零先例** | analyze 的 zod schema 只有 4 个文本字段 |

---

## 2. 目标与非目标

### 本阶段目标（按顺序，**前六步完全不碰模型**）

```
① DSL 规范
② 组件库 9 个 + 基础样式
③ 拼装器（DSL → 完整 HTML）
④ ★ 手写一份 DSL，拼出一个完整站 —— 第一个能用眼睛验收的里程碑
⑤ 风格预览（同一 DSL 换 3 组 token → 拼 3 版 → Playwright 截长图）
⑥ Recipe × 22（半自动提取）
⑦ 接模型（有截图 / 无截图两条轨）
⑧ 四段确认界面
```

**④ 是关键节点**：拼出来像，后面就是接模型的问题；拼出来不像，**组件库方向错了，模型再好也救不回来**。

### 非目标（本阶段明确不做）

- 抠图（从截图提取图片）、多图合成
- 断点恢复、48 小时清理、任务状态字段
- `navigation` schema 数组化 + 21 个适配器改造（见 §7）
- 静态区协议（`data-sitecraft-static`）
- `/api/product-images` 的既有 SVG XSS 洞（**已知，本阶段不修**；缓解：`accept` 只允许 png/jpeg/webp）

---

## 3. 组件库规格（**这是本文最重要的一节**）

### 3.1 为什么是 9 个

依据：**22 个开源模板 + 2 个行业模板逐个体检**的板块出现率。

| # | 组件 | 版式 | 出现率 | 对应 SiteDraft |
|---|---|---|---|---|
| 1 | `navbar` | 5 链接 + 可选 CTA + 移动端汉堡 | 22/22 | `navigation` |
| 2 | `footer` | 多列链接组 + 底栏 | 22/22 | （静态） |
| 3 | `hero` | **① `split`（左文右图）② `cover`（背景大图居中）** | 21/21 | `content.hero` |
| 4 | `features` | **① `grid`（三列图标卡）② `alternating`（左右交替图文）** | 21/21 | `content.features` |
| 5 | `services` | `cards`（三列服务卡） | 15/21 | `content.services` |
| 6 | `about` | `split`（左文右图，可选图标卡） | 12/21（工业站标配） | `content.about` |
| 7 | `products` | `grid-4`（四列 SKU 卡片网格） | 首页仅 fengji，但**五节模型必装** | `content.products` |
| 8 | `contact` | **① `split`（左信息右表单）② `centered`（居中表单）** | B2B 转化核心 | `content.contact` |
| 9 | `cta` | 居中标题 + 1-2 按钮 | 几乎所有落地页收尾 | （静态） |

**hero 与 features 必须做两式**——实测单式只覆盖约一半模板。

### 3.2 ⚠️ 每个组件的槽位契约（**做错了内容就填不进去**）

系统的槽位白名单 `KNOWN_TARGETS`（`lib/template-runtime.ts:244`）**只认这 13 个**：

```
hero.title  hero.subtitle
about.title  about.body
features.title  features.items
services.title  services.items
contact.title  contact.body  contact.email  contact.phone  contact.address
```

外加**唯一的三级槽** `products.<sku>.<name|summary>`（单独处理）。

**每个组件必须打的槽位**：

| 组件 | 必须打 | 说明 |
|---|---|---|
| `navbar` | **不打槽位** | 见 §7「导航槽位现状」——打了也会被系统丢弃 |
| `hero` | `hero.title` · `hero.subtitle` | **`hero.title` 是全系统唯一的硬性必填槽**（`REQUIRED_RUNTIME_SLOTS`），漏了直接过不了门禁 |
| `about` | `about.title` · `about.body` | `about.body` 是长文本位 |
| `features` | `features.title` · `features.items` | **集合槽，见 §3.4 的编号规则** |
| `services` | `services.title` · `services.items` | 同上 |
| `products` | `products.<sku>.name` · `products.<sku>.summary` | **必须用真实 SKU**，见 §3.4 |
| `contact` | `contact.title` · `contact.body` · `contact.email` · `contact.phone` · `contact.address` | 五个槽，`email`/`phone` 打在 `<a href="mailto:">`/`<a href="tel:">` 上，`address` 打在 `<address>` 上 |
| `cta` | **不打槽位** | 内容随站点级配置走 |
| `footer` | **不打槽位** | 同 navbar |

### 3.3 数量与容量上限（**写死在这些地方，别超**）

来源：`lib/site-document.ts`

| 约束 | 值 |
|---|---|
| 任一文案（title / body / summary） | **≤ 1000 字符/语言** |
| 卡片数组（features.items / services.items） | **≤ 12 条** |
| `products` 数组 | ≤ 1000 |
| `navigation` | **固定 5 键的对象**（不是数组） |
| `sectionOrder` | **长度必须 = 5** |

### 3.4 🔴 槽位编号规则（最容易做错的一处）

**集合槽用数字索引，且 `.title` 与 `.body` 必须成对：**

```html
<!-- ✅ 正确 -->
<article data-sitecraft-slot="features.items.0.title">高效节能</article>
<p       data-sitecraft-slot="features.items.0.body">比同类产品省电 30%</p>
<article data-sitecraft-slot="features.items.1.title">…</article>
<p       data-sitecraft-slot="features.items.1.body">…</p>

<!-- ❌ 错误：只有 title 没有 body，注入后一半是空的（门禁判 blocker） -->
```

**产品槽必须用真实 SKU：**

```html
<!-- ✅ 正确 -->
<h3 data-sitecraft-slot="products.TDS-48RD.name">TDS-48RD 离心风机</h3>
<p  data-sitecraft-slot="products.TDS-48RD.summary">风量 4800m³/h，全压 1200Pa</p>

<!-- ❌ 错误：会被当成 sku="0"，就地编辑失效 -->
<h3 data-sitecraft-slot="products.0.name">…</h3>
```

### 3.5 🔴 全部样式必须走 CSS 变量（**否则行业差异失效**）

**组件里不许出现硬编码的圆角、间距、颜色。** 原因：行业差异**不是组件差异，是参数差异**——同一个产品网格，机械行业要 `radius: sharp` + 深灰蓝，食品行业要 `radius: rounded` + 暖橙。**组件写死了圆角，换 token 就失效。**

**必须使用的变量名**（与 `app/api/templates/[templateId]/preview/route.ts:334-365` 的 `applyDesignTokens` 一致）：

```
--sitecraft-primary     主色
--sitecraft-secondary   辅色
--sitecraft-accent      强调色
--sitecraft-font        字体族
--sitecraft-radius      圆角基准
--sitecraft-section-space  节间距
```

**可选的枚举**（`designTokensSchema`，`lib/site-document.ts:48`）：

| token | 取值 |
|---|---|
| `fontStyle` | `sans` \| `editorial` \| `technical` |
| `radius` | `sharp` \| `soft` \| `rounded` |
| `density` | `compact` \| `balanced` \| `spacious` |
| `primary` / `secondary` / `accent` | `#rrggbb` |

### 3.6 产出物形态（**必须满足，否则下游全挂**）

拼装器产出的模板目录长这样，**和现有运行时模板完全一致**：

```
<templateId>/
  index.html                    入口（必须叫这个名）
  styles.css                    样式（必须自包含）
  sitecraft.template.json       登记单（见 §5）
```

**约束**：

| 约束 | 为什么 |
|---|---|
| `index.html` 必须在**目录根**（不是 `dist/`） | `getTemplateStaticRoot`（`lib/template-static.ts`）会依次找 `dist/index.html` → `index.html` → `.next/...`，根目录直接放是对的 |
| **CSS 必须自包含** | 导出时整页样式会被内联（`buildOfflineHtml`），外部依赖会断 |
| **CSS ≤ 40KB** | 质量门的可测量代理：用了设计系统 CSS 会很小，没用会膨胀 |
| **无外链关键资源** | 国内访问会挂起等待 |

### 3.7 必须验的三个状态

每个组件都要过：

1. **三种 radius**（`sharp` / `soft` / `rounded`）下都不难看
2. **三种 density**（`compact` / `balanced` / `spacious`）下都不塌
3. **移动端**（至少一个 `@media` 断点）

---

## 4. DSL 规范

### 4.1 形状

**一份 DSL = 一条有序的板块链 + 内容 + token。**

```json
{
  "siteName": "鼎力风机设备",
  "templateId": "craft-20260911-a3f2",
  "tokens": {
    "primary": "#1f3a5f",
    "secondary": "#4a6b8a",
    "accent": "#e8a33d",
    "fontStyle": "technical",
    "radius": "sharp",
    "density": "compact"
  },
  "blocks": [
    { "type": "navbar",   "variant": "simple" },
    { "type": "hero",     "variant": "split" },
    { "type": "features", "variant": "grid" },
    { "type": "products", "variant": "grid-4" },
    { "type": "about",    "variant": "split" },
    { "type": "contact",  "variant": "split" },
    { "type": "cta",      "variant": "centered" },
    { "type": "footer",   "variant": "columns" }
  ],
  "content": { "…": "见 §4.2，形状 = SiteDraft" }
}
```

### 4.2 内容形状**就是 SiteDraft**

**不要新造内容模型。** `content` 字段直接复用 `siteDraftSchema`（`lib/site-document.ts:86`）——这样建站时 `POST /api/sites` 的 `initialDraft` 可以**原样传**，一行转换都不用写。

### 4.3 类型定义放哪

**新建 `lib/template-composer.ts`**，导出：

```ts
export type ComposerBlock = { type: ComponentType; variant: string };
export type ComposerDsl = { siteName: string; templateId: string; tokens: DesignTokens; blocks: ComposerBlock[]; content: SiteDraft };
export type ComponentType = "navbar" | "hero" | "features" | "services" | "about" | "products" | "contact" | "cta" | "footer";
export function composeTemplate(dsl: ComposerDsl): { html: string; css: string };
```

**纯函数，不碰 `node:fs`**（参考 `lib/template-runtime.ts` 的分工模式——那边纯注册表、`lib/template-runtime-loader.ts` 才碰 fs）。

---

## 5. 登记（**不要新写，复用现成的**）

落盘 + 注册这段**已经完整存在**，注释原文：「阶段 B 的产出物走的是**同一个入口**——AI 只负责产出 HTML，落盘与契约注册这段复用，不另立一套」。

**用 `POST /api/templates/runtime`**（`app/api/templates/runtime/route.ts`）。它已经做了：

| 它做什么 | 不做会怎样 |
|---|---|
| 槽位补全（`postProcessPrecipitatedTemplateHtml`，`:119`） | 模型漏写的槽位能救回来 |
| 质量门（`:124`，**在任何写盘之前**判） | 不合格的模板不会留下"磁盘上有、注册表里没有"的垃圾目录 |
| 写盘（`:150-191`） | — |
| **重置扫描标记 + 重新装载**（`:201-207`） | **不重启进程即可用**（注释明写："要求重启 dev server 会让整个功能不可用"） |

**入参**：`templateId`（`^[a-z0-9][a-z0-9-]{0,39}$`，且不能与现有 22 个基线模板或 fengji/jinggong 撞名）、`name`、`category`、`description`、`html`、`assets`（CSS 放这）、`tags`、`colors`。

**不要带 `skipQualityGate`**——让门禁真判。不合格会返 `422 + blockers`，那是**喂回模型重试的反馈**。

---

## 6. 行业预设（token 样本库）

**行业差异 = 参数差异，不是组件差异。** 所以不扩组件、不扩模板，**扩 token 预设**。

```ts
// lib/industry-presets.ts
export const INDUSTRY_PRESETS = {
  machinery:  { primary: "#1f3a5f", accent: "#e8a33d", fontStyle: "technical", radius: "sharp",   density: "compact" },
  legal:      { primary: "#1b2a4a", accent: "#a8853f", fontStyle: "editorial", radius: "sharp",   density: "spacious" },
  food:       { primary: "#c85a2a", accent: "#f0c04a", fontStyle: "sans",      radius: "rounded", density: "balanced" },
  // …
} as const;
```

**初始 6-10 个**，依据：22 个模板提炼出的 token 样本（见 §8 的 Recipe 提取）。

---

## 7. 导航栏：现状与既定策略（**别在这里踩坑**）

### 7.1 现状（已核实）

| 事实 | 位置 |
|---|---|
| `navigation` 是**5 个固定键的对象**，不是数组 | `lib/site-document.ts:98` |
| **21 个适配器按位置索引硬绑这 5 个键** | `const navKeys = ['about','features','products','services','contact']` 然后 `navigation.${navKeys[i]}.zh`（`lib/template-adapters/lonestone.ts:103/117`、`atlas.ts:53/68`、`awesome.ts:97/100`…） |
| **导航槽位可能压根没被系统认出来** | `KNOWN_TARGETS`（`lib/template-runtime.ts:244`）**一条 `navigation.*` 都没有**，而 `normalizeSlotTarget` 只认这个白名单 → 适配器打的 `navigation.about.zh` 在 `collectSlotTargetsFromHtml` 那层被丢弃 |
| 槽位命名两套并存 | 适配器写三段式 `navigation.about.zh`，系统规范是两段式 `hero.title` |

### 7.2 本阶段策略（**分两刀，不要一次性改**）

| 阶段 | 做什么 |
|---|---|
| **本阶段** | 拼装器 + 组件库**内部直接用 `NavItem[]`**，**完全不碰 schema**；`navbar` 组件**不打槽位** |
| **下一刀** | schema 正式改数组 + 21 个适配器逐个改 + 契约测试更新 |

**理由**：一次性改会引发大规模回归（21 个文件 + 契约测试），**而它不阻塞拼装路线**。

**已知代价**：本阶段拼出来的站，导航**在生成时有 N 项的能力，但工作台编辑不了第 6 项以后**（写回草稿时仍是 5 键对象）。**这是"编辑"的问题，不是"生成"的问题**，可接受。

---

## 8. Recipe 提取（第 ⑥ 步）

**22 个旧模板的新身份不是"模板"，是三种原料**：需求调研 / token 样本 / 验收基准。

### 8.1 提取什么

```json
{
  "id": "screwfast",
  "components": [
    { "type": "hero",     "variant": "split" },
    { "type": "features", "variant": "alternating" },
    { "type": "products", "variant": "grid-4" }
  ],
  "tokens": { "primary": "#1f5a3d", "fontStyle": "technical", "radius": "soft" }
}
```

**⚠️ 只有这两类字段。不要加「文案风格」**——拼装器只吃结构和 token，不吃"文案偏活泼还是稳重"；那是**提示词层**的事，混进来会导致"改文案风格要去改 Recipe"的错误路径。

### 8.2 怎么提取（**半自动，比纯目测准得多**）

```
① Playwright 打开模板 → 从 DOM 【读】板块顺序
   （模板本就有 data-sitecraft-scope / 语义标签，这是事实不是猜测）
② 从 CSS 【读】配色（模板自带 CSS 变量，也是事实）
③ 模型只补它才懂的那一步：每个板块选了【哪种版式】
   （DOM 说不清"左文右图 vs 大图居中"，得看图）
④ 人工扫一遍（22 份 × 十几行）
```

**前两步是"读数据"不是"生成"，准确率 100%；模型只做最需要判断的一步。** 成本：22 次截图 + 22 次小模型调用 ≈ 几毛钱。

### 8.3 用拼装器验证

每提取一份，就用 §4 的拼装器**拼一遍**，和原模板并排看像不像。**这是拼装器的第一个真实测试集。**

### 8.4 意外收获

提取时会**如实暴露"哪些板块我们表达不了"**（FAQ 约 11/21、testimonials 约 10/21、定价表约 9/21）——那是**用数据说话的"下批组件清单"**。

---

## 9. 必须避开的坑（都是实测踩过的）

| # | 坑 | 正确做法 |
|---|---|---|
| 1 | **`document.documentElement.scrollHeight` 不等于截出的像素高度**。实测两次按 DOM 高度推断，都得出错误结论 | **只信 `sharp` 读出的真实像素**，或用 `page.screenshot` 的返回值 |
| 2 | **中文在无头浏览器里可能渲染成方框** | 已实测通过（`-apple-system, "Microsoft YaHei", "PingFang SC"` 下 `measureText` 宽度 = 字号×字数）。**但换环境要重验**，做法：canvas `measureText` 比对期望宽度 |
| 3 | **`node:fs` 进客户端 bundle → Turbopack 构建直接失败** | 纯逻辑与 fs 操作**分开两个模块**（照抄 `template-runtime.ts` / `template-runtime-loader.ts` 的分工） |
| 4 | **Windows 路径分隔符**（同类坑已出现 3 次） | 路径前缀比较前**归一化两种分隔符**（`\\` 和 `/`） |
| 5 | **Bash heredoc 吞反斜杠**（实测把 `"\\jinggong"` 变成 `"\jinggong"`） | 写文件用 Write 工具，**不要用 heredoc 拼含转义的代码** |
| 6 | **模型关闭推理才有预算守契约** | 若本阶段要调模型：`reasoning_effort: "none"` + `enable_thinking: false`。**已有实现**：`lib/ai-provider.ts` 的 `shouldDisableReasoning()` / `withReasoning()` |

---

## 10. 验收标准

### 10.1 里程碑 ④（**第一个能用眼睛验收的节点**）

1. 手写一份 DSL（例如风机厂的）
2. 拼装 → 产出模板目录（`index.html` + `styles.css` + `sitecraft.template.json`）
3. **在浏览器里打开，肉眼可见一个完整的企业站**（导航/首屏/特性/产品/关于/联系/CTA/页脚）
4. **换 3 组 token 各拼一遍 → 三版并排看**，行业气质应有明显差异
5. 同一个站**改 `radius: sharp → rounded`、`density: compact → spacious` 各看一遍**，组件不塌

### 10.2 工程标准

| 命令 | 期望 |
|---|---|
| `npx tsc --noEmit` | **0 错误**（TS strict，禁 `any`） |
| `npm test` | **全绿（基线 514 条，不得减少）** |
| `npm run build` | **0 警告** |
| `npx playwright test e2e/specs/coverage-scan.spec.ts` | **22/22 不回退** |

**新功能要补单测**（拼装器是纯函数，测试成本很低，必须测）。

### 10.3 端到端（拼装器接上登记入口之后）

6. `POST /api/templates/runtime` → 201
7. `GET /api/templates/<id>/preview` → 200（能预览）
8. `POST /api/sites {templateId}` → 201（能建站）
9. 工作台里内容**填得进去**（槽位契约生效）
10. 发布 → `/published/<siteKey>` 不报错

### 10.4 失败路径也要验

11. 门禁不过的产物 → 能看到**具体的 `blockers`**（不是一句"失败了"）
12. 缺 `hero.title` 的 DSL → **被门禁拦下**

---

## 11. 分步交付（每步都要可验证）

| 步 | 交付 | 验证方式 |
|---|---|---|
| ① | `lib/template-composer.ts` 的类型定义 + DSL 规范 | `tsc` 通过 |
| ② | 9 个组件 + `lib/template-composer-styles.ts`（token 变量层） | §10.1 的第 3、5 条 |
| ③ | `composeTemplate(dsl)` 纯函数 | 单测：给定 DSL → 断言产出 HTML 含指定槽位 |
| ④ | **手写 DSL 拼一个站** | **§10.1 全部** |
| ⑤ | 风格预览 | 三张长图，中文清晰 |
| ⑥ | Recipe × 22 | 拼出来与原模板并排比对 |
| ⑦ | 接模型 | 失败路径 §10.4 |
| ⑧ | 四段确认界面 | 端到端走一遍 |

---

## 12. 风险（如实）

1. **组件库的覆盖面 = 产品能力上限。** 「复刻任意截图」**做不到**，能做到的是「用我有的组件拼出结构相近的站」。
2. **`navigation` 固定 5 键**是本阶段最窄的瓶颈（下拉/多级/顶栏电话都表达不了）。
3. **一次成功率未知**：目前**没有**「模型看图出 DSL」的任何数据。
4. **行业差异可能超出 token 能表达的范围**——若九个组件 + 27 种气质组合仍不足以覆盖，需要回头扩组件（**判据就是里程碑 ④**）。
5. **本阶段走全局注册表**（`POST /api/templates/runtime`），而用户既定决策是"客户模板存本站本地、不进全局库"。**这是一处已知偏离**，原因是现成入口就是全局的，改存储归属会牵动 `allTemplates()` 与预览链路。**留到下一刀。**
