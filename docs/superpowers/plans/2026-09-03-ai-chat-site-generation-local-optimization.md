# AI 对话与自然语言建站局部优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with review checkpoints. 对抗性审查必须在全部优化完成后执行。

**Goal:** 在不替换现有 `SiteDraft`、`SiteOperation`、SSE、真实模板 iframe 和 PostgreSQL JSONB 架构的前提下，提高中文输入的模板匹配率、真实 DeepSeek 首稿交付速度、AI 对话修改准确性和工作台反馈清晰度。

**Architecture:** 保留当前“Intent → 任务规划 → 结构化操作 → 校验 → revision 提交 → 模板预览”主链路。新增的能力只作为前置语义约束、操作前置条件、事件元数据和前端反馈层；不让 renderer、聊天状态或模型输出绕过 `commitOperations`。

**Tech Stack:** Next.js 16.3.1、React 19、TypeScript、Zod、Node SSE、PostgreSQL JSONB、node:test、Playwright。

## Global Constraints

- 内部团队使用，重要企业事实先保留人工确认状态，不阻塞当前初稿生成。
- 性能目标：首屏可用约 15 秒、核心初稿约 30 秒、整站最多约 90 秒；这些目标必须用真实 DeepSeek 样本校准，不得用 mock 结果宣称达标。
- 只做局部优化；不引入 WebContainers、任意代码生成、多智能体或通用 renderer 重写。
- 普通 AI 对话只能生成白名单 `AIOperation`，最终写入仍经过 Zod、槽位校验、风险确认和 revision 提交。
- 每个实现批次先写失败测试，再写最小实现，再运行局部测试；批次完成后运行相关全量测试。
- 对抗性审查、真实浏览器展示验收和发布判定放在所有实现批次之后。

---

### Task 1: 中文意图与模板语义匹配

**Files:**
- Modify: `lib/site-model.ts`（模板类型增加 `matchingProfile`）
- Modify: `lib/template-catalog.ts`（22 个模板补充行业、受众、站点类型、风格、双语和能力标签）
- Modify: `lib/site-intent.ts`（中文别名归一化和候选排序）
- Test: `tests/golden-intent.test.ts`

**Interfaces:**
- Consumes: 当前 `SiteIntent`、模板白名单和 `getTemplate`。
- Produces: `normalizeIntentForMatching(intent)`、`scoreTemplateMatch(intent, template)`、稳定的 top-3 推荐及可解释 reason。

- [ ] **Step 1: 写失败测试**
  - 使用“工业视觉检测、自动化产线、面向欧洲采购商”等中文输入，断言归一化为 `industrial_automation`、`overseas_b2b_buyers`、`product_catalog`。
  - 断言英文模板名不影响中文匹配。
  - 断言不支持产品目录的模板在产品型企业输入中扣分。
  - 断言推荐结果全部来自模板白名单。
- [ ] **Step 2: 运行测试确认失败**
  - Run: `node --test --experimental-strip-types tests/golden-intent.test.ts`
  - Expected: 新增断言因 `matchingProfile` 和评分函数不存在而失败。
- [ ] **Step 3: 实现最小匹配层**
  - 增加中文/英文别名到规范 taxonomy 的映射。
  - 使用行业 35%、受众 20%、站点类型 15%、产品目录 10%、询盘 10%、双语 5%、风格 5% 的加权评分。
  - 保留现有 `resolveTemplate` 作为白名单和默认兜底，不移除旧调用。
  - 推荐 reason 必须引用实际命中的能力标签，不能只写“适合企业官网”。
- [ ] **Step 4: 运行测试确认通过**
  - Run: `node --test --experimental-strip-types tests/golden-intent.test.ts tests/site-intent.test.ts`
  - Expected: 原有意图测试和新增中文匹配测试全部通过。
- [ ] **Step 5: 记录样本基线**
  - 使用 7 组已有中文场景加 6 组新增脱敏场景，记录 top-1/top-3、reason 一致性和模板能力命中情况。

### Task 2: 生成前槽位约束与首稿质量门

**Files:**
- Modify: `lib/template-manifest.ts`（补齐槽位语义、别名、语言、长度和可编辑性）
- Modify: `lib/template-slot-guard.ts`（暴露生成前 capability summary）
- Modify: `lib/ai-provider.ts`（将企业事实、模板能力和内容约束注入对应任务）
- Modify: `lib/site-generator.ts`（确定性字段映射、核心板块优先和质量门）
- Modify: `lib/fact-check.ts`（保留人工确认状态，不阻塞低风险初稿）
- Test: `tests/template-manifest.test.ts`, `tests/template-slot-guard.test.ts`, `tests/site-generator.test.ts`, `tests/fact-check.test.ts`

**Interfaces:**
- Consumes: `TemplateManifest`、`SiteIntent`、`SiteDraft`、`SiteOperation`。
- Produces: `buildTemplateCapabilitySummary(templateId, locale)`、`buildContentPlanInput(...)` 和可提交/待确认的内容检查结果。

- [ ] **Step 1: 写失败测试**
  - 断言生成 prompt 包含当前模板支持槽位、不可用槽位、语言和长度限制。
  - 断言模板不支持的目标在模型调用前被标记为不可提交。
  - 断言公司名、SKU、联系方式等确定性字段不需要模型重复生成。
  - 断言未确认认证/客户数量等事实被标记为 `unverified`，而不是静默发布。
- [ ] **Step 2: 运行相关测试确认失败**
  - Run: `node --test --experimental-strip-types tests/template-manifest.test.ts tests/template-slot-guard.test.ts tests/site-generator.test.ts tests/fact-check.test.ts`
- [ ] **Step 3: 实现最小前置约束**
  - 为每个槽位增加 `semanticType`、`aliases`、`locales`、`maxLength`、`required`、`editable`。
  - 将模板能力摘要仅传给相关板块任务，避免每个任务携带完整草稿。
  - 将首屏、联系区和核心能力设为第一交付批次；自评和润色移出关键路径。
  - 保留现有 fail-open 部分交付，但把事实风险通过 `missingFacts`/`requiresReview` 返回前端。
- [ ] **Step 4: 运行局部和全量单测**
  - Run: `node --test --experimental-strip-types tests/template-manifest.test.ts tests/template-slot-guard.test.ts tests/site-generator.test.ts tests/fact-check.test.ts`
  - Run: `npm test`
- [ ] **Step 5: 记录生成质量基线**
  - 使用脱敏中文企业样本记录槽位命中、占位词、超长文案、事实待确认和中英文完整性。

### Task 3: AI 对话目标稳定性与字段级冲突保护

**Files:**
- Modify: `lib/site-operations.ts`（卡片更新支持稳定 `itemId` 和可选 `expectedValue`）
- Modify: `lib/chat-task-planner.ts`（把“第几个/刚才那个”解析为稳定目标）
- Modify: `lib/template-slot-guard.ts`（目标关联校验保留 selected target 约束）
- Modify: `lib/site-store.ts`（提交前做字段级前置值检查）
- Modify: `app/api/sites/[siteId]/chat/route.ts`（返回结构化冲突原因）
- Modify: `app/workspace/page.tsx`（冲突提示和原始指令保留）
- Test: `tests/site-operations.test.ts`, `tests/chat-task-planner.test.ts`, `tests/conversational-undo.test.ts`

**Interfaces:**
- Consumes: 当前 `AIOperation`、`selectedTarget`、`baseRevision`。
- Produces: 稳定 `itemId/targetId` 定位、`expectedValue` compare-and-swap、字段级 conflict 结果。

- [ ] **Step 1: 写失败测试**
  - 调整卡片顺序后，按原 `itemId` 更新仍命中同一卡片。
  - 当前字段不等于 `expectedValue` 时拒绝覆盖且 revision 不增加。
  - 选中 hero 时模型返回 services 操作，草稿和历史均不变化。
  - “刚才那个标题”无历史时返回澄清，不调用 provider。
- [ ] **Step 2: 运行测试确认失败**
  - Run: `node --test --experimental-strip-types tests/site-operations.test.ts tests/chat-task-planner.test.ts tests/conversational-undo.test.ts`
- [ ] **Step 3: 实现最小兼容改造**
  - 新请求优先使用 `itemId/targetId`；旧 index 请求仅在可唯一解析时兼容。
  - `expectedValue` 只作为前置条件，不改变逆操作和历史结构。
  - 冲突结果包含 `targetId`、当前值摘要、原因和最新 revision，但不返回敏感原文。
- [ ] **Step 4: 运行局部和全量单测**
  - Run: `node --test --experimental-strip-types tests/site-operations.test.ts tests/chat-task-planner.test.ts tests/conversational-undo.test.ts`
  - Run: `npm test`

### Task 4: 对话事务、风险分级和 SSE 事件元数据

**Files:**
- Modify: `lib/chat-task-executor.ts`（一次请求的事务边界和风险分组）
- Modify: `lib/site-operations.ts`（集中风险分类）
- Modify: `app/api/sites/[siteId]/chat/route.ts`（事件统一增加 request/task/sequence/revision）
- Modify: `lib/sse-events.ts`（可选的 sequence 去重辅助）
- Modify: `app/workspace/page.tsx`（按 taskId 合并状态，done 后锁定终态）
- Test: `tests/chat-task-executor.test.ts`, `tests/sse-events.test.ts`, `tests/generation-cancellation-contract.test.ts`

**Interfaces:**
- Consumes: 当前任务拆分、并发上限 2、SSE `status/done` 和 AbortSignal。
- Produces: `risk: low|medium|high`、`requestId`、`taskId`、`sequence`、`revision` 和明确事务结果。

- [ ] **Step 1: 写失败测试**
  - 低风险文本修改可直接提交；删除、隐藏、换模板等高风险操作进入确认。
  - 同一请求内任一高风险操作未确认时，整组不提交。
  - 重复或乱序事件不会覆盖新状态。
  - Abort 后不产生新的 commit。
- [ ] **Step 2: 运行测试确认失败**
  - Run: `node --test --experimental-strip-types tests/chat-task-executor.test.ts tests/sse-events.test.ts tests/generation-cancellation-contract.test.ts`
- [ ] **Step 3: 实现最小事件和事务层**
  - 保留当前业务事件名称，不迁移 Vercel AI SDK。
  - 每个请求生成 requestId，每个拆分任务生成 taskId，单调增加 sequence。
  - 前端丢弃旧 revision、重复 sequence；done 后停止接受同一 task 的状态覆盖。
- [ ] **Step 4: 运行局部和全量单测**
  - Run: `npm test`

### Task 5: 生成页和工作台的渐进式反馈

**Files:**
- Modify: `app/generate/page.tsx`（核心板块优先状态、慢请求告警、缺口提示）
- Modify: `app/workspace/page.tsx`（修改范围、差异、冲突恢复）
- Modify: `components/generation-health-panel.tsx`（指标口径显示）
- Modify: `app/globals.css`（只补充必要的稳定尺寸和状态样式）
- Modify: `lib/generation-experience.ts`（阶段文案和进度口径）
- Test: `tests/generation-experience.test.ts`, `e2e/specs/generate-flow.spec.ts`, `e2e/specs/workspace.spec.ts`

**Interfaces:**
- Consumes: Task 2 的 `missingFacts`/slot report、Task 4 的 SSE metadata、现有 preview fallback。
- Produces: 首屏可用、核心板块、部分交付、失败恢复、修改前后差异和可理解的下一步操作。

- [ ] **Step 1: 写失败测试**
  - 首屏完成后页面可以进入工作台，其他板块继续生成。
  - 页面显示真实阶段而不是虚构百分比。
  - 部分交付明确显示缺失板块和重试入口。
  - AI 修改消息显示目标范围和修改结果。
  - 桌面/移动端在内容变长时不产生横向溢出。
- [ ] **Step 2: 运行局部测试确认失败或记录现状**
  - Run: `node --test --experimental-strip-types tests/generation-experience.test.ts`
  - 对现有 Playwright 用例先只做测试设计，不在本批次前执行最终对抗验收。
- [ ] **Step 3: 实现最小 UI 反馈**
  - 首屏、核心板块、完整初稿使用明确状态标签。
  - 慢请求只显示告警，不提前把仍在执行的请求标为失败。
  - 增加文本/卡片级 diff，不重做整个工作台布局。
  - 失败保留原始指令，提供重试或进入工作台入口。
- [ ] **Step 4: 运行单测和生产构建**
  - Run: `npm test`
  - Run: `npm run typecheck`
  - Run: `npm run build`

### Task 6: 真实 provider 性能观测和预算校准

**Files:**
- Modify: `lib/generation-record.ts`（补齐阶段时间戳和 provider 统计字段）
- Modify: `lib/generation-budget.ts`（慢请求阈值、硬截止和核心交付保留时间）
- Modify: `app/api/sites/[siteId]/generate/route.ts`（记录时间线并确保取消传播）
- Modify: `app/settings/page.tsx`（展示首屏、核心、完整交付指标）
- Test: `tests/generation-budget.test.ts`, `tests/generation-record.test.ts`, `tests/ai-provider-deadline.test.ts`

**Interfaces:**
- Consumes: 真实 provider 请求、现有 generation records 和 F-011 指标。
- Produces: `firstEventAt`、`heroCompletedAt`、`coreCompletedAt`、`committedAt`、`doneAt`、P50/P95、完整/部分/超时率。

- [ ] **Step 1: 写失败测试**
  - 25 秒和 45 秒告警不关闭仍可能成功的请求。
  - 硬截止后只保留已完成内容并返回明确终态。
  - 取消后 provider 和恢复任务都停止。
  - 指标分母区分完整建站和局部重生成。
- [ ] **Step 2: 运行测试确认失败**
  - Run: `node --test --experimental-strip-types tests/generation-budget.test.ts tests/generation-record.test.ts tests/ai-provider-deadline.test.ts`
- [ ] **Step 3: 实现局部预算调整**
  - 先保留现有共享 deadline 和并发上限，再根据真实样本调整数值。
  - 不在没有真实样本前硬编码“30 秒必达”承诺。
  - 对内部团队显示耗时诊断，对最终用户显示可理解状态。
- [ ] **Step 4: 用脱敏真实 DeepSeek 样本验证**
  - 至少 12 个样本，覆盖工业、机械、科技、外贸、专业服务和产品目录场景。
  - 每个样本只记录脱敏摘要和阶段指标，不记录 API Key、完整客户资料或原始敏感文本。

### Task 7: 优化完成后的对抗性审查和前端验收

**Files:**
- Modify: `e2e/specs/adversarial-chat.spec.ts`（Create）
- Modify: `e2e/specs/adversarial-generation.spec.ts`（Create）
- Modify: `e2e/specs/frontend-acceptance.spec.ts`（Create）
- Modify: `playwright.config.ts`（确保验收不复用旧测试服务，保留明确的 webServer 生命周期）
- Test: 全部新增 spec、`npm test`、`npm run typecheck`、`npm run build`

**Interfaces:**
- Consumes: Tasks 1–6 的实际实现和事件/操作契约。
- Produces: 通过、阻塞、高风险、未验证四类证据，不修改业务代码以“迎合测试”。

- [ ] **Step 1: 先检查测试启动前置条件**
  - 确认 `.env.local` 存在、`node_modules` 完整、PostgreSQL 5432 可用。
  - 验证 3210 没有旧服务；测试期间不复用用户手动启动的 Next 进程。
- [ ] **Step 2: 运行后端对抗 spec**
  - 覆盖非法 JSON、未知操作、未知模板、目标越权、语言越界、revision 冲突、重复 SSE、取消、慢 provider、恶意 HTML 和 Prompt injection。
- [ ] **Step 3: 运行前端展示 spec**
  - 覆盖生成页/工作台桌面和移动端、首屏优先、部分交付、失败恢复、差异展示、模板预览、中英文切换、控制台和网络错误。
  - 保存截图、trace、控制台摘要和关键 API 状态。
- [ ] **Step 4: 运行全量验证**
  - Run: `npm test`
  - Run: `npm run typecheck`
  - Run: `npm run build`
  - Run: `npx playwright test --project=chromium --workers=1`
- [ ] **Step 5: 形成验收结论**
  - 任一核心生成失败、越权修改、revision 覆盖、关键页面重叠、无明确终态、真实 provider 无指标或发布不可回滚，都不能判定为 ready。
  - 输出每个场景的输入、预期、实际、HTTP 状态、SSE 终态、revision 是否变化、数据库是否写入和截图路径。

## 计划自检

- 已覆盖用户确认的内部团队范围、真实 DeepSeek 许可、15/30/90 秒目标和人工事实确认边界。
- 未把 JSON renderer、AI SDK、Zustand、WebContainers 作为当前必需依赖。
- 每个批次均有明确文件、接口、失败测试、实现和验证命令。
- 对抗性验收明确排在 Task 1–6 之后，不在优化前宣称通过。
- 当前已知阻塞：需要真实 DeepSeek 脱敏样本；Playwright 需要干净的 3210 服务和 PostgreSQL；抖音/小红书后端本轮不可用，不作为实施依据。
