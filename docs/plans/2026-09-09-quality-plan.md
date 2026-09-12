# SiteCraft-ai 计划（2026-09-09 · 重构版）

> **本文件是项目当前状态的唯一真相源**（执行依据）。
> 历史累积计划 `~/.claude/plans/ai-velvet-quiche.md`（1330 行）保留为历史记录，不再作执行依据。
>
> 本轮重构依据：`strategy-red-team` + `identify-assumptions-existing` + `pre-mortem` 三个 skill 的输出
> （见 §3），以及用户确认的商业路线。

---

## 1. 商业路线（决定一切优先级）

**用户 2026-09-09 确认：代建服务** —— 我们/团队帮客户做站，一客一交付。

**这个决定改写了优先级**：

| 项 | 自助 SaaS 下 | **代建服务下** |
|---|---|---|
| 多租户隔离 | P0（必做） | **可延后**（一客一项目，不共存） |
| 配额 / 限流 | P0（防滥用） | 可延后 |
| 留存 / 删除 API | P0（合规） | 可延后（合同约定） |
| 自助注册/登录 | P0 | 不需要 |
| **交付物能否拿走** | 重要 | **命门** |
| **交付物能否收到询盘** | 重要 | **命门** |
| **交付物是否像客户的站** | 重要 | **命门** |

**代建模式的关键成功因子**：**单站交付效率**。如果每站都要手动改文案、传图、调样式，
规模化就无从谈起——这是 E2/E3 两个「没人说出口的担忧」的落点（见 §3）。

---

## 2. 设计原则（判定任务是否该做的尺子）

| # | 原则 | 出处 | 违反的表现 |
|---|---|---|---|
| 1 | **模板无关性**——机制对新模板自动生效 | 用户：「后期还要加其他模板」 | 为现有 22 模板写一次性逻辑 |
| 2 | **内容落进模板原生结构**——通用兜底是缺陷不是解法 | A 板块主线 | 注入通用卡片墙/表单块 |
| 3 | **fail-closed 优先**——未声明 = 不支持 | P3.2 红队结论 | 启发式猜测、静默兜底 |
| 4 | **机械可证**——每个验收有命令 + 期望输出 | `verification-before-completion` | 「看起来对了」 |
| 5 | **不重复做**——前置已满足的不再开工 | §5 | A1（伪需求）、P3.4（已完成） |
| 6 | **交付闭环优先**（本轮新增） | 代建模式 | 功能做完了但用户拿不走 |

---

## 3. 本轮 skill 分析结论

### 3.1 承重假设（四维魔鬼代言人）

| # | 假设 | 维度 | 信心 | 证据 |
|---|---|---|---|---|
| A1 | 用户能放进真实素材 | Value | **低** | 仅 12/22 模板可换首屏图；产品图无上传入口 |
| A2 | 用户看到的是「真模板」 | Value | **低** | `!important` 覆盖字体/圆角/间距（22/22） |
| A3 | AI 内容优于默认草稿 | Value | **低** | 实测 6 份草稿内容完全相同（= 默认值） |
| A4 | 发布的站能收到询盘 | Value | **低** | 22 模板仅 2 个自带可用表单 |
| A5 | 导出能交付给客户 | Usability | **低** | `grep '/export/'` 零命中，导出页无入口 |
| A6 | 用户能找回自己建的站 | Usability | **低** | 首页硬编码 3 个假站点 |
| A7 | 多客户可共存 | Viability | **低** | 默认 relaxed 回退 demo；store 用模块常量 |
| A8 | 能力声明与实现一致 | Viability | **低** | 设置页 `onClick` 0 次 |
| **A9** | **机制对新模板自动生效** | Feasibility | **中** | 22/22 manifest 齐全、catalog 单一来源 —— **站得住** |

### 3.2 Pre-Mortem（假设 14 天后上线然后失败）

**Tigers（真风险）**：T1 拿不走成品 / T2 找不到自己的站 / T3 收不到询盘 / T4 认不出模板
—— 全部 **Launch-Blocking**；T5 放不进图 / T6 设置页死按钮 / T7 无租户隔离 —— Fast-Follow。

**Paper Tigers（被夸大的担忧）**：
- 「推荐模板是换肤皮」→ **不准确**。推荐卡片用的是真实 `OpenSourceTemplateFrame`；
  真问题是它渲染了 **AI 内容而非模板原件**（见 §4-T4）。
- 「模板资源 404」→ **不是产品 bug**。`astroplate` 不是模板 id（id 是 `atlas`），404 是正确行为。

**Elephants（没人说出口的担忧）**：
- **E1 目标用户是谁** → **已答：代建服务**（§1）
- **E2 拿不到成品的情况下，用户会复用吗** → 无留存数据，`generation_records` 只有技术指标
- **E3 相比凡科/上线了，差异化还剩什么** → AI 写文案 + 别人的模板 + 图不能换 = 卖点不清

---

## 4. 待做：四个 Launch-Blocking（用户已定顺序）

### T1 交付物拿不走 —— 导出无入口

**证据**：`components/real-template-export-button.tsx`（「下载真实模板」）**只在**
`app/export/[siteId]/page.tsx:56` 使用；`grep '/export/' app/ components/` **零命中**——无任何页面链接到它。

**改法**：工作台（`app/workspace/page.tsx`）加「导出/下载」入口，复用现有 `RealTemplateExportButton`。

**验收**：工作台能一键下载单文件站点；下载产物能脱离本机打开。

---

### T2 找不到自己建的站 —— 首页是演示态

**证据**：`app/page.tsx:21-46` `sites` 是硬编码 3 个假站点；`grep fetch|api/sites app/page.tsx` 零命中；
KPI `03/24/18` 与「↑ 比上月多 18%」全为常量；`:154` 链接三元两边相同。

**改法**：首页改为读 `/api/sites` 真实数据；无站点时显示空状态 + 「新建站点」。
KPI 改为真实统计（可复用 `lib/generation-record.ts` 的指标）。

**验收**：建站后回首页能看到该站；KPI 随真实数据变化。

---

### T3 收不到询盘 —— 20/22 模板无可用表单

**证据**：`scripts/scan-lead-forms.mjs`（静态）+ `scripts/probe-lead-form.mjs`（渲染）**双探针一致**：
仅 astrogent、shadcn-landing2 自带 `name`/`email`/`message` 齐全的表单。

**改法（三层，模板无关，遵循原则 1/2/3）**

**① 契约层** —— `lib/template-manifests/types.ts` 的 `contact.formAction` 增加 `selector?: string`
- 有 `selector` → **只接管提交，不注入任何 DOM**
- 无 `selector` → 进入 ②

**② 渲染层** —— 无原生表单时补全
- 继承模板设计（不覆盖），用独立标记 `data-sitecraft-lead-form`（**不用** `generated-content`，避免污染门禁语义）
- 双语 + 校验 + 三态反馈复用 `TEMPLATE_UI_COPY` / `activeUiCopy.form.*`

**③ 数据层** —— 已就绪不改：`POST /api/public/[siteKey]/leads` → `lib/lead-store.ts`

**「彻底」判据**：P4 新模板写一行 `selector` 即自动接管，**零代码接入**。

**验收**：`probe-lead-form.mjs` 22/22；新增 e2e 落库断言。

> ⚠️ **2026-09-12 更正——这个「✅ 阻断权」当时是假的。**
> `probe-lead-form.mjs` 从未接进 `package.json`，也**从不设非零退出码**，
> 探针自身遇到注入异常时还会**直接崩溃退出**（打印一段像环境问题的 `bridge_apply_timeout` 栈）。
> 结果：它本该拦的缺陷——`preview/route.ts` 里 `copy is not defined` 导致
> 22 个模板里 20 个的发布站**没有询盘表单**——静默活了三天，
> 直到客户旅程真机实测才被发现。
> 现已补齐：`npm run test:lead-form` 走 `package.json`，缺表单/注入失败一律**非零退出**
> （已用负向测试验证：还原缺陷 → 退出码 1；修复到场 → 退出码 0）。

**已知技术债（重做时消除）**：现有注入块引用了 `applyTemplateUiCopy` 内部的 `copy` 变量（作用域 bug → bridge 中断）。

---

### T4 认不出模板 —— designTokens 覆盖模板设计

**证据**：
- `lib/site-generator.ts:61` 每次生成**无条件**写 `set_design_tokens`
- **`app/generate/page.tsx:220` 前端也在发送 `designTokens`**（第二条路径，red-team 发现）
- `app/api/templates/[templateId]/preview/route.ts:355` 注入：
  `body{font-family!important}` / `button,[class*=card]{border-radius!important}` / `main>section{padding!important}`
- 推荐卡片 `variant="thumbnail"` 在预览路由**无任何分支**，走同一套 `applyContent` → **渲染 AI 内容而非模板原件**

**改法**（两处，缺一不可）
1. **停用无条件 tokens**：前端 `generate/page.tsx:220` 与后端 `site-generator.ts:61` 都改为不发送/不生成
2. **thumbnail 变体渲染模板原件**：不注入 draft 内容与 tokens；
   **注意**（red-team 风险）：不能简单跳过 `applyContent`，否则不发 `sitecraft:applied` 报告，
   调用方 `onPreviewStateChange` 会挂。需保留初始化 + 发报告，只是不注入内容。

**验收**：工作台预览的字体/圆角/间距 = `/templates/<id>/preview`；推荐卡片显示模板原件。

---

## 5. 延后与关闭

### 5.1 代建模式下延后（非不做，顺序靠后）

| 项 | 延后理由 |
|---|---|
| T7 多租户隔离 | 一客一项目，不共存；且 [request-context.ts:82](lib/request-context.ts#L82) 默认 relaxed 已挡住跨 workspace |
| 配额/限流 | 无滥用面 |
| 留存/删除 API | 合同约定即可 |
| T6 设置页死按钮 | 帮客户做站时不依赖设置页 |
| CI | 437 项测试每次手动跑，风险可控 |

### 5.2 已关闭（判定为无用功）

| 项 | 理由 |
|---|---|
| **P3.4 外链清理** | A3 已按「缺了版式就坏」判据清完致命项；剩余字体/交互 JS 按判据属降级可接受 |
| **P2.5 / P1.7 对 47 产物跑门禁** | 用户已定「成品展示不合格，没必要改写」 |
| **P3.6 打磨收手线** | `quality-speed` 矩阵结论已写入历史计划 |
| **A1 补本地快照** | `getTemplateStaticRoot` 已有根 `index.html` 兜底 |

### 5.3 Fast-Follow（交付四项之后）

T5 素材体系（产品图上传 + 内容图槽位）· T6 设置页接线或删除 ·
E2/E3（留存数据、差异化论证）· P4 行业模板（等素材）· F1 Docker 验证（发布前一次）

---

## 6. 本机环境事实（排查时先看这条）

- **必须用 `http://localhost:3000`**，不要用 `127.0.0.1`——Next.js 会拦 `/_next/hmr` 跨域，导致交互异常
- dev server 日志：`/tmp/dev2.log`
- 22 个模板的 **id**（不是源目录名）：forge/atlas/signal/kindred/powerai/landwind/lonestone/
  astro-starter/awesome/astrofy/astropaper/moon/astrogent/devportfolio/foxi/yukina/fresh/
  shadcn-landing/screwfast/tailwind-landing/nextjs-landing/shadcn-landing2
  （例：`atlas` 的源目录是 `astroplate`，用 `astroplate` 请求路由会 404 —— **这是正确行为**）

---

## 7. 验证口径

| 层 | 命令 | 阻断权 |
|---|---|---|
| 机械 | `npx tsc --noEmit` + `npm test`（当前 437 项） | ✅ |
| 覆盖 | `scripts/probe-template-coverage.mjs`（期望 22/22） | ✅ |
| 行为 | `scripts/probe-lead-form.mjs`（`npm run test:lead-form`）+ `scripts/scan-lead-forms.mjs` | ✅ |
| 旅程 | `scripts/journey-audit2.mjs`（全流程截图） | ⚠️ 人工确认 |

**判据优先级**：机械断言 > 行为验证 > 人工确认 > 视觉预筛。

---

## 8. 执行顺序

1. **T1 导出入口**（最小改动，交付闭环第一环）
2. **T3 询盘表单重做**（三层方案）
3. **T4 去 designTokens 覆盖**（两处 + thumbnail 变体）
4. **T2 首页接真实数据**

外加两个已定位的小改动（可并行）：
- **问题 1**：模板卡片点击直接进入建站并带 `templateId`（`app/templates/page.tsx:122`）
- **问题 3**：首页两入口合并，统一去 AI 建站（`app/page.tsx:111/115`）

> 每项完成贴真实输出并更新本文件。
