# 三入口体验收口 · 执行提示词（DeepSeek 用 · 总纲 v2）

> 用法：整段复制，成为你后续所有工作的唯一任务来源。分阶段执行，
> 每阶段做完停下等放行。所有纪律承接 `AGENTS.md` 契约军规与 `docs/glossary.md`。
> **v2 变更**：基于 2026-09-12 真机 UI 走查（本地 3000 端口实测 + 截图取证）修订，
> 删掉了三处与现状不符的假设，新增两处实测确认的真缺口。

---

## 产品定义（写进 PRODUCT-BASELINE.md 第一句）

本产品 = durable.com + wegic.ai 两家能力的融合自助 SaaS：
**三个建站入口都是设计内能力**——①自然语言建站 ②截图转模板 ③链接(URL)转模板。
产出统一锚定 22 个真实开源模板原件（适配器路线）；template-composer 拼装器只服务
截图/URL 链路，**永不进 NL 主链**。首批用户：制造业/外贸中小企业+国内小微，
楔子是"中文业务→地道英文站"和"一句话到底"。

## 实测确认的现状（2026-09-12 浏览器走查，别重新发明也别推翻）

- 首页是工作台式管理页（侧边导航 + 最近站点 + "开始一个新项目"CTA），
  **不是营销落地页，也不是单文本框**——现有信息架构清晰，不动。
- /generate 已是 STEP 01/03 三步向导：textarea + 4 个预填示例 chip +
  可折叠"粘贴公司简介"区。小白不会写 prompt 的问题已由 chip 解决，
  **不要改成三格表单**。
- 模板库"做新模板"弹窗（CreateTemplateDialog）质量已达标：双 tab、
  用户语言文案（"复刻成新模板/原样搬下来"）、版权提示、断点续做（resuming）。
- 生成链路后端已是 SSE（analyze/execute 均有），**但前端把流当一次性用**：
  `app/generate/page.tsx:405-407、624-642、774` 都是 buffer 收完后
  `reverse().find()` 取最后一个事件——流式语义存在，实时呈现不存在。
- 截图/URL 弹窗等待态只有一个 spinner（create-template-dialog.tsx:309-311），
  而后端 pending-job 已有 startJob/advanceJob/finishJob 步骤语义——
  **接口有进度，前端没渲染**。
- e2e 现状 100 passed / 6 failed：templates.spec.ts 两条是断言过严
  （期望 22 实得 35，运行时沉淀模板所致），本轮修。
- 巨型文件军规生效中：workspace/page.tsx(88KB)、generate/page.tsx(72KB)
  拒收新代码——**先拆后写**（本轮恰好要动 generate 页，拆分是前置）。

## 竞品可取之处（结合实测修订后）

**学 Durable：**
1. 板块级再生成的入口露出（后端能力已有，前端要把"只重生这一块"做到
   工作台预览的板块悬浮菜单里）；
2. 先见网站后注册的摩擦降低——**先只读调研现有 access 模型是否允许
   免登录看生成结果**，冲突就停下报告，不许私改鉴权。

**学 Wegic：**
1. **等待时"有人在场"**（本轮核心，见阶段 3）：把 SSE/job 进度渲染成
   步骤叙事（"正在读你发的图…"→"正在认产品…"→"正在选配色…"），
   替代 spinner 和"buffer 完再一次性刷新"；
2. 改完所见即所得：任何修改立刻反映预览，零"保存并生效"中间态
   （现有 inline-edit 链路已接近，走查确认后只补差口）。

**明确不模仿（写进基线文档）：**
- Durable 产出同质化——我们用 22 真实模板原件正是为避开，不回填；
- Wegic 整页重生成——增量 operations 模型是对的，不换位；
- 推倒现有首页/向导/弹窗结构——实测已达标，本轮是补流式体验，不是重做 IA。

---

## 阶段 0 · 还债收尾（一次做完）

1. `docs/PRODUCT-BASELINE.md`：产品定义原文 + 上面"实测确认的现状"，
   各旧文档开头加"已被基线取代"指针（不删旧文档）。
2. 补测试（军规：负向验证，先红后绿贴原文）：
   template-from-screenshot.ts、template-from-url.ts 两编排层 +
   from-screenshot、from-url、pending-jobs 三路由的单测。
3. e2e：templates.spec.ts 两条断言改为区分"内置 22"与"内置+沉淀 35"口径，
   禁止放宽成永真；新增"截图→生成→save→undo"、"URL→生成→save→undo"
   两条完整路径 spec（PG 后端显式带 DATABASE_URL=...5433...）。
4. 验收：tsc 0 错误；npm test 只增不减（以当日实际为基线）；
   全套 e2e 目标 0 failed（做不到逐条列归因证据，不许静默 skip）。

## 阶段 1 · 拆巨型文件（纯搬家，行为零变更）

generate/page.tsx（72KB，阶段 3 要动它，先拆）与 workspace/page.tsx（88KB）
按区块拆子组件进 components/。
- 每拆一块一个 commit，每 commit 前 typecheck+npm test 全绿；
- 只做搬家与 props 传递，禁止顺手改状态管理/渲染条件/样式；
- 拆完两文件各自 ≤40KB，文件头一行注释说明区块边界。

## 阶段 2 · 流式体验改造（本轮核心交付）

**2a. generate 页 SSE 实时消费**：把"buffer 收完 reverse().find 取尾"改为
逐事件到达即更新 UI——status 事件驱动步骤时间线（第几步/共几步/当前动作），
content_delta 到达即渲染（若有），done 才终态。分级提示（30/55 秒）与
120 秒终态的既有行为保持不回退（e2e generate-flow.spec.ts:142 锁着它）。
**2b. 弹窗等待态接 pending-job 进度**：from-screenshot/from-url 的
advanceJob 语义映射为步骤叙事渲染进 dialog-progress 区，替换裸 spinner；
保留"接着做"断点续做能力。
**2c. 入口汇合（轻量）**：/generate STEP 01 底部加一行"有截图或网址？
做新模板 →"直接挂现有 CreateTemplateDialog（同一组件实例，禁止复制第二份）。
模板库入口保留不动。

## 阶段 3 · 板块级再生成露出

工作台预览 iframe 的板块悬浮菜单加"重新生成这一块"，接既有局部重生成
API（workspace 已有 regenerate scope，走查确认调用链后接 UI）。
失败回退保持现有"拒单条保其余"语义，不许整批炸。

## 红线（违反 = 本阶段作废回滚）

1. 军规全量生效：禁手抄（B2 门禁会咬）、新检查必须负向验证、注入字符串禁反引号、
   批量替换先列撞名、git add 一律显式列文件。
2. 阶段 2/3 不动 NL 主链的生成逻辑与 lib 契约层——SSE 消费改造只动前端
   事件处理，后端事件协议如需增字段，先出方案等批准。
3. 视觉沿用现有 design tokens 与组件风格，不引入新 UI 库；本轮主题是
   "流式在场感"，不是换皮。
4. 鉴权、质量门（skipQualityGate）、数据迁移相关改动一律先出方案等批准。
5. 每阶段收口 commit 批 + 汇报（diff stat、测试原文、未尽事项点名）；
   没做完的活必须点名"没做、为什么"，不许沉默滑过。

## 验收标准（我方将真开浏览器独立复测）

- PRODUCT-BASELINE.md 存在且含"实测确认的现状"节。
- 五处新增单测有"先红后绿"原文；e2e 新增两条完整路径 spec 真实通过。
- generate/workspace 两文件 ≤40KB 且拆分前后行为 diff 为零。
- **流式实测**：我方发起一次真实生成，观察 DOM——等待期间步骤叙事文案
  至少变化 2 次（不接受一次性刷新）；截图/URL 弹窗同理。
- 板块悬浮菜单出现"重新生成这一块"且真实可用（我方实测点击）。
- npm test 只增不减；全套 e2e 全绿或剩余失败逐条有归因证据。
