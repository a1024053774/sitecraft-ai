# SiteCraft AI 全链路优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with review checkpoints. 对抗性审查必须在全部优化批次完成后执行。

**Goal:** 在不替换现有“DeepSeek → SiteDraft → SiteOperation → 模板 iframe”主架构的前提下，建立可控的中文建站、AI 对话微调、模板匹配、发布回滚、权限隔离、性能观测和证据验收闭环。

**Architecture:** 保留现有 `SiteDraft`、`SiteOperation`、`commitOperations`、SSE 和本地模板快照。新增能力放在六个边界：输入事实层、模板能力层、生成编排层、对话操作层、草稿/发布版本层、证据与观测层。任何模型输出都必须经过 schema 校验、槽位校验、权限校验、revision 校验和风险确认后才能写入。

**Tech Stack:** Next.js 16.3.1 App Router、React 19、TypeScript、Zod、Node SSE、PostgreSQL JSONB、node:test、Playwright。

## Global Constraints

- 内部团队使用；本阶段不引入完整 SaaS 账号体系，但生产 API 必须具有可替换的 workspace/actor 权限门禁。
- 不允许模型生成或执行任意 HTML、CSS、JS、JSX；只允许白名单 `SiteOperation` 和 design tokens。
- 保留本地文件存储开发模式；生产 PostgreSQL 走迁移，不直接修改线上表结构。
- 新字段优先可选和向后兼容；旧草稿、旧 SSE 客户端和旧模板仍可读取。
- 重要企业事实先标记 `requiresReview`，不阻塞低风险初稿，但未确认事实不能进入发布版本。
- 性能目标仅作为待校准假设：首屏约 15 秒、核心初稿约 30 秒、完整初稿最多约 90 秒；必须用真实 DeepSeek 样本验证。
- 每个任务遵循 TDD：失败测试 → 最小实现 → 局部验证 → 全量验证；不得用 mock 结果代替真实 provider 结论。
- 对抗性审查、真实浏览器验收和 ready 判定只能在 Task 0–10 完成后执行。

## 现状缺口与优先级

| 优先级 | 缺口 | 证据或根因 | 不处理的后果 |
|---|---|---|---|
| P0 | 生成质量没有统一质量门 | 当前主要验证 JSON/状态，缺少槽位完整性、事实风险、占位词和中英文一致性评分 | 初稿可渲染但不可用，质量问题无法定位 |
| P0 | AI 修改仍需字段级目标保护 | revision 可防整稿覆盖，但不能完全防止卡片重排、目标越权和旧值覆盖 | “改第二个服务”可能改错对象 |
| P0 | 发布与草稿边界不完整 | 当前有发布展示页，但缺少独立 release 快照和回滚契约 | 用户可能把未确认事实发布，发布后无法可靠回滚 |
| P0 | 权限隔离不是统一 API 门禁 | 存储层使用固定 `DEFAULT_WORKSPACE_ID`，路由层没有统一 actor 校验 | 内部多用户或多站点时存在跨站访问风险 |
| P0 | 真实 provider 阈值未校准 | 45 秒硬截止已被真实交互证伪，现有指标混入自动化流量 | 误报超时，无法判断真实成功率和 P95 |
| P1 | 中文到英文模板的语义桥接不足 | 主要依赖关键词和模型推荐，模板能力画像未成为强约束 | 推荐理由与页面结构不一致 |
| P1 | Prompt/模型/模板版本不可复现 | 生成记录缺少完整的 prompt、manifest、provider 配置版本 | 无法解释某次质量退化，也无法回归 |
| P1 | 前端状态覆盖不完整 | 已有部分交付和失败状态，但差异、冲突、恢复、发布确认不统一 | 用户不知道系统改了什么、下一步做什么 |
| P1 | 测试证据与运行环境不稳定 | Playwright 曾复用 3210 遗留服务；失败矩阵尚未完整执行 | “测试通过”可能不是当前代码行为 |
| P2 | 任意代码沙箱不是当前主线 | 产品目标是模板填充，不是代码生成 | 现在引入会增加安全和依赖负担 |

## 文件与边界总览

| 边界 | 主要文件 | 责任 |
|---|---|---|
| 输入与事实 | `lib/site-intent.ts`、`lib/site-model.ts`、`lib/fact-check.ts` | 归一化中文输入、区分用户事实与模型推断 |
| 模板能力 | `lib/template-catalog.ts`、`lib/template-manifest.ts`、`lib/template-slot-guard.ts` | 模板画像、槽位契约、兼容降级 |
| 生成编排 | `lib/site-generator.ts`、`lib/ai-provider.ts`、`lib/generation-budget.ts` | 分阶段生成、预算、部分交付、provider 重试 |
| 对话修改 | `lib/chat-task-planner.ts`、`lib/chat-task-executor.ts`、`lib/site-operations.ts` | 目标解析、风险分类、操作执行和逆操作 |
| 存储与发布 | `lib/site-store.ts`、`lib/postgres.ts`、`app/api/sites/[siteId]/draft/route.ts`、`app/published/[siteKey]/page.tsx` | 草稿 revision、release 快照、回滚 |
| API 与权限 | `app/api/sites/route.ts`、`app/api/sites/[siteId]/**`、`lib/request-context.ts` | workspace/actor 校验、幂等和错误格式 |
| 前端反馈 | `app/generate/page.tsx`、`app/workspace/page.tsx`、`components/generation-health-panel.tsx` | 阶段状态、差异、冲突、发布确认 |
| 证据与验收 | `tests/**`、`e2e/specs/**`、`playwright.config.ts`、`docs/audits/**` | 回归、对抗、截图、日志、性能证据 |

---

### Task 0：建立基线、契约清单和安全测试夹具

**Files:**
- Create: `docs/audits/2026-09-03-comprehensive-baseline.md`
- Create: `tests/fixtures/adversarial-inputs.ts`
- Modify: `e2e/scripts/preflight.mjs`
- Modify: `playwright.config.ts`
- Test: `tests/contract-baseline.test.ts`

**Interfaces:**
- Produces: 当前 API、事件、草稿、模板 manifest、发布路径的契约清单；`AdversarialInput` 固定夹具；干净 webServer 启动方式。

- [ ] **Step 1: 固化当前基线**
  - 记录 `npm test`、`npm run typecheck`、`npm run build` 的退出状态和测试数量。
  - 记录当前 `SiteDraft`、`SiteOperation`、SSE 事件和生成记录字段，明确哪些字段可选。
- [ ] **Step 2: 建立失败输入夹具**
  - 为非法 JSON、空请求、超长中文、混合语言、未知操作、未知模板、未知 target、恶意 HTML、prompt injection 提供固定输入，不写入真实客户资料。
- [ ] **Step 3: 修正 Playwright 生命周期**
  - `CI=1` 时始终启动测试专用服务；测试前探测 3210–3217，发现非测试服务直接失败并打印 PID/端口，不静默复用。
- [ ] **Step 4: 运行基线测试**
  - Run: `npm test`
  - Run: `npm run typecheck`
  - Run: `npm run build`
  - Expected: 基线结果记录完成；不以历史证据替代本次运行结果。

### Task 1：输入事实层与中文意图归一化

**Files:**
- Modify: `lib/site-model.ts`
- Modify: `lib/site-intent.ts`
- Modify: `lib/fact-check.ts`
- Modify: `app/api/sites/[siteId]/generate/route.ts`
- Test: `tests/site-intent.test.ts`、`tests/fact-check.test.ts`、`tests/golden-intent.test.ts`

**Interfaces:**
- Add: `type FactSource = "user" | "model" | "template";`
- Add: `type SiteFact = { key: string; value: string; source: FactSource; confidence: "confirmed" | "inferred" | "missing"; requiresReview: boolean; };`
- Add: `normalizeUserBrief(input: string): NormalizedBrief`，输出行业、受众、站点类型、语言、产品/服务清单和事实列表。

- [ ] **Step 1: 写失败测试**
  - 中文行业同义词归一化到稳定 taxonomy；英文模板名不会污染行业判断。
  - 用户未提供的客户数量、认证、营收和排名必须是 `inferred` 或 `missing`。
  - 空输入和超长输入返回可理解的校验错误，不调用 provider。
- [ ] **Step 2: 实现最小归一化层**
  - 保留原始输入摘要，增加规范字段；不删除现有 `SiteIntent` 字段。
  - 对企业名、联系方式、SKU 等用户明确字段加 `source: "user"` 并锁定。
- [ ] **Step 3: 接入生成前检查**
  - 生成路由先校验 `NormalizedBrief`，失败返回统一 `{ success: false, error: { code, message } }`。
- [ ] **Step 4: 运行测试**
  - Run: `node --test --experimental-strip-types tests/site-intent.test.ts tests/fact-check.test.ts tests/golden-intent.test.ts`

### Task 2：模板语义画像、槽位版本和推荐解释

**Files:**
- Modify: `lib/template-catalog.ts`
- Modify: `lib/template-manifest.ts`
- Modify: `lib/template-slot-guard.ts`
- Modify: `lib/site-intent.ts`
- Create: `tests/fixtures/template-match-cases.ts`
- Test: `tests/template-manifest.test.ts`、`tests/template-slot-guard.test.ts`

**Interfaces:**
- Add: `type MatchingProfile = { industries: string[]; audiences: string[]; siteTypes: string[]; styles: string[]; locales: string[]; capabilities: Array<"catalog" | "inquiry" | "bilingual" | "blog" | "caseStudy">; aliases: string[]; };`
- Add: `scoreTemplateMatch(brief: NormalizedBrief, template: Template): { score: number; reasons: string[]; penalties: string[] }`。
- Add: `buildTemplateCapabilitySummary(templateId: string, locale: SiteDraft["locale"]): TemplateCapabilitySummary`。

- [ ] **Step 1: 为 22 个模板补齐画像**
  - 每个模板至少声明行业、站点类型、支持语言和三个真实能力标签；信息不确定时标为“不支持”，不能凭模板名字推断。
- [ ] **Step 2: 扩展槽位契约**
  - 槽位包含 `semanticType`、`aliases`、`locales`、`maxLength`、`required`、`editable` 和 `manifestVersion`。
- [ ] **Step 3: 实现候选评分**
  - 行业 30%、受众 20%、站点类型 15%、能力 20%、语言 10%、风格 5%；只从白名单返回 Top 3。
  - 推荐理由必须引用命中的画像字段；缺失能力必须列为 penalty。
- [ ] **Step 4: 写回归测试**
  - 覆盖工业制造、机械设备、科技、专业服务、外贸、产品目录和服务咨询七类脱敏样本。
- [ ] **Step 5: 运行测试**
  - Run: `node --test --experimental-strip-types tests/template-manifest.test.ts tests/template-slot-guard.test.ts tests/golden-intent.test.ts`

### Task 3：生成编排、内容质量门和部分交付

**Files:**
- Modify: `lib/ai-provider.ts`
- Modify: `lib/site-generator.ts`
- Modify: `lib/generation-budget.ts`
- Modify: `lib/template-content-coverage.ts`
- Create: `lib/content-quality.ts`
- Test: `tests/site-generator.test.ts`、`tests/content-quality.test.ts`、`tests/generation-budget.test.ts`

**Interfaces:**
- Add: `type ContentQualityReport = { missingSlots: string[]; overLimitSlots: string[]; placeholderHits: string[]; languageMismatches: string[]; unverifiedFacts: string[]; score: number; publishable: boolean; };`
- Add: `evaluateDraftQuality(draft: SiteDraft, manifest: TemplateManifest): ContentQualityReport`。
- Add: `generateSiteInStages(args): AsyncIterable<GenerationStageEvent>`，阶段固定为 `intent | hero | core | secondary | commit | done`。

- [ ] **Step 1: 写失败测试**
  - 缺少 Hero 或联系入口时 `publishable=false`。
  - 超长标题、英文占位词、未确认事实和中英文不一致均能定位到具体 slot。
  - Hero 完成后，即使 secondary 失败，也产生可进入工作台的部分草稿。
- [ ] **Step 2: 实现生成前约束**
  - 将模板能力摘要和每个 slot 的长度/语言要求传入对应 provider 调用。
  - 确定性用户事实直接映射；模型只补写表达，不重写锁定字段。
- [ ] **Step 3: 实现核心优先编排**
  - Hero、核心服务/产品、联系区作为第一交付批次；次要板块限并发生成。
  - 保留当前 fail-open，但将每个失败板块写入 `missingSections` 和质量报告。
- [ ] **Step 4: 加入安全文本处理**
  - 所有外部文本按纯文本处理；HTML、iframe、事件属性和脚本标签进入拒绝或转义路径。
- [ ] **Step 5: 运行测试**
  - Run: `node --test --experimental-strip-types tests/site-generator.test.ts tests/content-quality.test.ts tests/generation-budget.test.ts`
  - Run: `npm test`

### Task 4：对话目标解析、授权范围和字段级 CAS

**Files:**
- Modify: `lib/chat-task-planner.ts`
- Modify: `lib/chat-task-executor.ts`
- Modify: `lib/site-operations.ts`
- Modify: `lib/template-slot-guard.ts`
- Modify: `lib/site-store.ts`
- Modify: `app/api/sites/[siteId]/chat/route.ts`
- Test: `tests/chat-task-planner.test.ts`、`tests/chat-task-executor.test.ts`、`tests/site-operations.test.ts`、`tests/conversational-undo.test.ts`

**Interfaces:**
- Extend: `SiteOperation` with optional `targetId?: string`, `itemId?: string`, `expectedValue?: string`, `locale?: "zh-CN" | "en-US"`。
- Add: `resolveOperationTarget(draft, reference): { targetId: string; confidence: "exact" | "ambiguous" | "missing" }`。
- Add: `validateOperationScope(operation, context): ScopeValidation`。

- [ ] **Step 1: 写失败测试**
  - 服务重排后按 `itemId` 仍命中原卡片。
  - `expectedValue` 不匹配时不写入、不增加 revision。
  - 选中 Hero 却返回 Services 操作时整组拒绝。
  - “刚才那个标题”没有历史定位时返回澄清，不调用 provider。
  - “只改中文/不要动英文”严格限制 locale。
- [ ] **Step 2: 实现稳定目标**
  - 新请求优先 `itemId/targetId`；旧 index 仅在唯一匹配时兼容。
  - 冲突响应只返回摘要、目标 ID、当前 revision 和下一步，不泄露完整敏感文本。
- [ ] **Step 3: 运行测试**
  - Run: `node --test --experimental-strip-types tests/chat-task-planner.test.ts tests/chat-task-executor.test.ts tests/site-operations.test.ts tests/conversational-undo.test.ts`

### Task 5：风险分级、幂等和 SSE 一致性

**Files:**
- Modify: `lib/chat-task-executor.ts`
- Modify: `lib/sse-events.ts`
- Modify: `app/api/sites/[siteId]/chat/route.ts`
- Modify: `app/api/sites/[siteId]/generate/route.ts`
- Modify: `app/workspace/page.tsx`
- Test: `tests/sse-events.test.ts`、`tests/generation-cancellation-contract.test.ts`

**Interfaces:**
- Add: `type SseEnvelope = { requestId: string; taskId: string; sequence: number; revision: number; type: string; payload: unknown; }`。
- Add: `class EventDeduper { accept(event: SseEnvelope): boolean; close(taskId: string): void; }`。
- Add: `risk: "low" | "medium" | "high"` to planned operations.

- [ ] **Step 1: 写失败测试**
  - 重复、乱序、旧 revision 事件不会覆盖新状态。
  - `done` 后事件被丢弃；Abort 后不再 commit。
  - 删除、隐藏、换模板、排序和批量修改必须确认。
  - 重复点击相同 `idempotencyKey` 只产生一次提交和一次历史记录。
- [ ] **Step 2: 实现事件元数据**
  - 保留现有事件名，仅增加 envelope 字段；服务端 sequence 单调递增。
  - 前端按 `taskId` 合并，并在 done 后锁定终态。
- [ ] **Step 3: 实现请求幂等**
  - chat/generate 请求接收可选 `idempotencyKey`；服务端缓存已完成结果，重复请求返回原结果。
- [ ] **Step 4: 运行测试**
  - Run: `node --test --experimental-strip-types tests/sse-events.test.ts tests/generation-cancellation-contract.test.ts tests/chat-task-executor.test.ts`

### Task 6：草稿、发布版本和回滚闭环

**Files:**
- Modify: `lib/postgres.ts`
- Modify: `lib/site-store.ts`
- Create: `lib/release-store.ts`
- Create: `app/api/sites/[siteId]/publish/route.ts`
- Create: `app/api/sites/[siteId]/releases/route.ts`
- Create: `app/api/sites/[siteId]/releases/[releaseId]/rollback/route.ts`
- Modify: `app/published/[siteKey]/page.tsx`
- Modify: `app/workspace/page.tsx`
- Create: `tests/release-store.test.ts`
- Test: `e2e/specs/publish-rollback.spec.ts`

**Interfaces:**
- Add: `type Release = { releaseId: string; siteId: string; workspaceId: string; version: number; draft: SiteDraft; contentHash: string; status: "published" | "superseded"; createdAt: string; publishedBy: string; }`。
- Add: `createRelease(args): Promise<Release>`、`getPublishedRelease(siteKey)`、`rollbackRelease(args)`。

- [ ] **Step 1: 写失败测试**
  - 发布读取的是草稿快照，不会随草稿继续编辑而变化。
  - 未确认事实、缺少 required slot 或质量门失败时拒绝发布，并返回具体缺口。
  - 发布后可查看历史版本；回滚后公开页立即使用上一版本。
  - revision 冲突时发布失败且不创建 release。
- [ ] **Step 2: 增加数据库迁移**
  - 新建 `sitecraft_releases` 表，主键为 `(workspace_id, release_id)`，索引 `(workspace_id, site_id, version DESC)`。
  - 迁移脚本可重复执行；本地文件模式用 `.sitecraft-data/releases` 保存相同结构。
- [ ] **Step 3: 接入发布 API**
  - 发布前读取最新草稿、运行 `evaluateDraftQuality` 和事实确认检查；成功后原子写 release。
  - 公开页只读取 `getPublishedRelease`，禁止回退到未发布草稿。
- [ ] **Step 4: 增加前端发布确认**
  - 显示版本号、缺口、事实待确认项和回滚入口；重复确认使用 idempotency key。
- [ ] **Step 5: 运行测试**
  - Run: `node --test --experimental-strip-types tests/release-store.test.ts`
  - Run: `npx playwright test e2e/specs/publish-rollback.spec.ts --project=chromium --workers=1`

### Task 7：统一请求上下文和站点级权限隔离

**Files:**
- Create: `lib/request-context.ts`
- Modify: `lib/site-store.ts`
- Modify: `lib/lead-store.ts`
- Modify: `app/api/sites/route.ts`
- Modify: `app/api/sites/[siteId]/**/route.ts`
- Modify: `app/api/leads/**/route.ts`
- Modify: `app/api/generation-records/route.ts`
- Test: `tests/request-context.test.ts`、`tests/tenant-isolation.test.ts`

**Interfaces:**
- Add: `type AccessContext = { workspaceId: string; actorId: string; role: "editor" | "reviewer" | "viewer"; }`。
- Add: `resolveAccessContext(request): AccessContext | AccessError`。
- Change store reads/writes to require `{ siteId, access }` or an equivalent scoped repository method。

- [ ] **Step 1: 写失败测试**
  - 未登录/缺少内部访问上下文返回 401 或 403。
  - workspace A 不能读取或修改 workspace B 的草稿、生成记录和询盘。
  - viewer 不能执行 chat、generate、publish、rollback。
  - 公开站点只能按发布 `siteKey` 读取，不接受任意 siteId。
- [ ] **Step 2: 实现最小权限适配层**
  - 开发环境允许显式 `DEFAULT_WORKSPACE_ID`；生产环境禁止隐式 demo workspace，必须由现有内部网关或受控 header 提供上下文。
  - 所有站点/询盘/生成记录 API 在进入 store 前完成 scope 校验。
- [ ] **Step 3: 运行测试**
  - Run: `node --test --experimental-strip-types tests/request-context.test.ts tests/tenant-isolation.test.ts`

### Task 8：Prompt、模型、模板和生成记录可复现

**Files:**
- Modify: `lib/ai-provider.ts`
- Modify: `lib/generation-record.ts`
- Modify: `lib/site-store.ts`
- Create: `lib/prompt-registry.ts`
- Create: `tests/prompt-registry.test.ts`

**Interfaces:**
- Add: `type GenerationProvenance = { model: string; provider: string; promptVersion: string; manifestVersion: string; templateId: string; buildRevision: string; inputHash: string; }`。
- Add: `getPrompt(name: PromptName, version: string): PromptDefinition`。

- [ ] **Step 1: 写失败测试**
  - 每次生成记录都包含模型、provider、promptVersion、manifestVersion、模板 ID 和 build revision。
  - 相同输入和版本可以定位到相同 prompt 定义；缺失版本不能静默使用未知 prompt。
- [ ] **Step 2: 实现版本登记**
  - 将 prompt 文本和输出 schema 分离登记，生成记录只保存版本和脱敏 input hash，不保存密钥或完整敏感原文。
- [ ] **Step 3: 运行测试**
  - Run: `node --test --experimental-strip-types tests/prompt-registry.test.ts tests/generation-record.test.ts`

### Task 9：生成页、工作台和发布页反馈闭环

**Files:**
- Modify: `app/generate/page.tsx`
- Modify: `app/workspace/page.tsx`
- Modify: `app/published/[siteKey]/page.tsx`
- Modify: `components/generation-health-panel.tsx`
- Modify: `lib/generation-experience.ts`
- Modify: `app/globals.css`
- Test: `tests/generation-experience.test.ts`
- Test: `e2e/specs/generate-flow.spec.ts`、`e2e/specs/workspace.spec.ts`

**Interfaces:**
- Add UI state union: `"idle" | "analyzing" | "hero-ready" | "core-ready" | "partial" | "completed" | "failed" | "cancelled" | "conflict"`。
- Add diff model: `ChangePreview { targetId: string; before: string; after: string; locale: string; risk: string; }`。

- [ ] **Step 1: 写失败测试**
  - 首屏完成可进入工作台，次要板块继续生成。
  - 部分交付、取消、冲突和失败都有明确的下一步。
  - AI 修改前显示影响范围，修改后显示字段级差异。
  - 生成页、工作台、模板推荐、模板预览和发布预览在桌面/移动端无横向溢出。
- [ ] **Step 2: 实现反馈状态**
  - 阶段文案绑定真实 SSE 事件；慢请求只告警，不伪装成失败。
  - 使用固定尺寸 skeleton 和 `min-width: 0` 等布局约束，避免长中文/英文造成跳动。
- [ ] **Step 3: 运行测试**
  - Run: `node --test --experimental-strip-types tests/generation-experience.test.ts`
  - Run: `npx playwright test e2e/specs/generate-flow.spec.ts e2e/specs/workspace.spec.ts --project=chromium --workers=1`

### Task 10：真实 provider 性能、成本和质量评估

**Files:**
- Modify: `lib/generation-budget.ts`
- Modify: `lib/generation-record.ts`
- Modify: `app/api/sites/[siteId]/generate/route.ts`
- Modify: `app/settings/page.tsx`
- Create: `scripts/run-real-generation-sample.mjs`
- Create: `tests/fixtures/golden-sites/*.json`
- Test: `tests/real-generation-metrics.test.ts`

**Interfaces:**
- Add timing fields: `requestCreatedAt`、`firstEventAt`、`heroCompletedAt`、`coreCompletedAt`、`commitStartedAt`、`committedAt`、`doneAt`。
- Add quality dimensions: `templateFit`、`slotCoverage`、`factSafety`、`languageConsistency`、`publishReadiness`。

- [ ] **Step 1: 写失败测试**
  - 自动化流量 `source=e2e` 不进入真实用户 SLA 分母。
  - 25 秒慢请求告警不终止请求；硬截止后仍返回唯一终态和已完成内容。
  - P50/P95 按站点语言、模板、provider 和 build revision 分组计算。
- [ ] **Step 2: 调整预算**
  - 先将 45 秒从硬终止改为软告警；硬截止保持可配置，待真实样本后校准，不承诺固定秒数。
  - 取消信号必须传到 provider、板块恢复和数据库提交路径。
- [ ] **Step 3: 运行脱敏真实样本**
  - 至少 12 个中文样本，覆盖工业制造、机械设备、科技、专业服务、外贸和产品目录。
  - 记录首屏、核心、完整耗时、P50/P95、完整交付率、部分交付率、超时率、取消率和成本估算。
- [ ] **Step 4: 质量评估**
  - 逐样本检查模板匹配、关键槽位、首屏清晰度、事实虚构、英文占位和工作台可编辑性。
  - 真实 provider 结果只写脱敏摘要和指标，不写 API Key、完整企业资料或原始对话。

### Task 11：完整对抗性审查、浏览器验收和证据报告

**Files:**
- Create: `e2e/specs/adversarial-chat.spec.ts`
- Create: `e2e/specs/adversarial-generation.spec.ts`
- Create: `e2e/specs/frontend-acceptance.spec.ts`
- Create: `docs/audits/2026-09-03-comprehensive-adversarial-review.md`
- Modify: `.project-to-act/PROJECT_ACCEPTANCE.md`
- Modify: `.project-to-act/PROJECT_PROGRESS.md`

**Interfaces:**
- Consumes: Tasks 0–10 的实际代码、API、事件、版本、权限和性能数据。
- Produces: `通过`、`阻塞`、`高风险`、`未验证` 四类证据，不修改业务代码迎合测试。

- [ ] **Step 1: 后端失败矩阵**
  - 空请求、超长中文、中英文混合、非法 JSON、缺字段、未知操作/模板/target、空 operations、超量 operations、超长文案、虚构事实、不支持槽位。
  - 目标越权、语言越界、无历史引用、索引重排、未确认删除/隐藏、混合风险操作。
  - 双标签页、旧请求晚返回、重复/乱序 SSE、无 done、取消、provider 超时、部分失败、revision 冲突、重复发送。
  - XSS、iframe、外链、prompt injection、任意代码、密钥读取、跨站和跨用户访问。
  - 每项记录输入、预期、实际、HTTP 状态、SSE 终态、revision、数据库写入和错误日志。
- [ ] **Step 2: Playwright 页面验收**
  - 生成页、工作台、模板推荐、模板预览、发布预览全部覆盖桌面和移动端。
  - 覆盖内容缺口、生成中、首屏完成、部分交付、失败、取消、revision 冲突、确认、diff、模板降级和中英文切换。
  - 每个场景检查截图、控制台、网络 4xx/5xx、横向溢出、截断、重叠、iframe 最新草稿和按钮状态。
- [ ] **Step 3: 运行统一命令**
  - Run: `CI=1 npm test`
  - Run: `CI=1 npm run typecheck`
  - Run: `CI=1 npm run build`
  - Run: `CI=1 npx playwright test --project=chromium --workers=1`
- [ ] **Step 4: 形成结论**
  - 任一核心生成失败、未授权修改、revision 覆盖、未确认高风险提交、页面重叠/溢出、无明确终态、真实 provider 无证据、虚构事实可发布、发布不可回滚或隔离无证据，均标记为阻塞，不得写 ready。

### Task 12：分批上线、回滚和文档同步

**Files:**
- Create: `docs/operations/ai-generation-runbook.md`
- Create: `docs/operations/rollback.md`
- Modify: `.project-to-act/PROJECT_OVERVIEW.md`
- Modify: `.project-to-act/PROJECT_FEATURES.md`
- Modify: `.project-to-act/PROJECT_PROGRESS.md`
- Modify: `.project-to-act/PROJECT_ACCEPTANCE.md`

- [ ] **Step 1: 采用 feature flag 分批启用**
  - `template_matching_v2`、`quality_gate_v1`、`chat_cas_v1`、`release_v1`、`access_scope_v1` 分开控制。
- [ ] **Step 2: 每批保留回滚点**
  - 先启用内部 canary workspace；发现质量、时延、权限或发布回归时关闭对应 flag，不回滚无关功能。
- [ ] **Step 3: 同步项目账本**
  - 只有具备新鲜测试证据的功能才标记“已完成”；真实 provider 未执行的项目标记“未验证”。
- [ ] **Step 4: 输出最终决策**
  - 明确哪些工作进入当前版本，哪些推迟到未来（如自由代码沙箱、通用 JSON renderer、复杂协作编辑）。

## 阶段门禁

| 阶段 | 必须满足 | 不满足时 |
|---|---|---|
| Gate 0 基线 | 测试服务不复用旧进程；基线命令和契约已记录 | 不进入功能改动 |
| Gate 1 生成可靠性 | 输入事实、槽位约束、质量报告、部分交付测试通过 | 不开放真实 provider 样本 |
| Gate 2 对话安全 | 目标授权、CAS、幂等、SSE 去重和取消测试通过 | 不开放复杂 AI 修改 |
| Gate 3 发布隔离 | release 快照、质量门、权限、回滚 E2E 通过 | 只能保留草稿预览，禁止发布 |
| Gate 4 真实校准 | 至少 12 个脱敏样本，P50/P95 和交付率可计算 | 不宣称性能达标 |
| Gate 5 最终验收 | 对抗矩阵、Playwright、控制台/网络和证据报告完整 | 只能输出阻塞/风险/未验证 |

## 明确不做的事项

- 当前不引入 WebContainers、Sandpack 或任意代码沙箱，因为产品输入是模板内容填充，不是自由代码生成。
- 当前不替换现有 SSE 为另一套协议；只增加 envelope、幂等和去重元数据。
- 当前不引入 Zustand 等全局状态库；只有当工作台状态跨页面复杂度被测试证明成为瓶颈时再评估。
- 当前不做完整外部用户计费、团队邀请和多租户管理；先完成内部 workspace/actor 隔离接口。

## 计划自检

- 已覆盖产品目标、中文模板匹配、初稿质量、AI 对话微调、实时预览、发布回滚、权限、安全、性能、成本、可观测性、测试和运营回滚。
- 所有 P0 缺口都有对应任务、文件边界、接口、失败测试和验收门禁。
- 对抗性审查明确排在 Task 0–10 之后；在此之前只运行开发回归测试，不宣称 ready。
- 真实 provider、PostgreSQL、浏览器环境和内部访问上下文是最终验收的外部前置条件，未满足时必须标记未验证。
