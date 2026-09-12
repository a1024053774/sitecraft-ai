# Real Template Export and Builder Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让复杂外贸站点在分级预算内交付可编辑初稿，长指令原子提交，真实模板语言一致且能导出小于 10MB 的离线单文件，并用一家公司完成真实建站、工作台精修和成品交付。

**Architecture:** 生成链路只使用一个绝对 deadline，并把 25/45 秒作为慢请求提示而不是终止点；模型调用按阶段消费剩余预算，首稿自评退出关键路径。工作台把大指令确定性拆成有 scope 的小任务，全部成功后合并并只提交一次 revision。模板 manifest 同时驱动推荐、bridge、语言 UI 文案和导出；导出由已加载真实模板 iframe 自己序列化最终 DOM、内联同源资源并返回验证报告，不再使用 `SiteRenderer` 或 Forge 专用字符串替换。

**Tech Stack:** Next.js 16.3.1 App Router、React 19、TypeScript、Zod、SSE、Web Platform DOM/CSS/Blob APIs、node:test、Playwright

## Global Constraints

- 保留并审查 DeepSeek 同步进来的未提交改动，不回滚用户文件，不自动 Git commit。
- 所有行为改动先写测试并观察预期 RED，再写最小实现得到 GREEN。
- 不把单纯延长 timeout 当作提速；正常目标约 30 秒，服务端硬截止 75 秒、客户端硬截止 78 秒。
- 任意模型重试、fallback、recovery、chat 子任务共用原 absolute deadline，不得重置预算。
- `SiteRenderer` 只能兜底，真实模板预览、导出和最终成品必须来自 vendor 静态模板。
- 所有新文件、截图、报告和最终 HTML 均放在 `D:`；最终成品放 `D:/sitecraft-ai/成品展示/`。
- 离线导出不得包含远程图片、字体、脚本、CSS、iframe、API 请求；普通导航链接单独报告。
- A-001 至 A-004 保持待检查；真实 provider 未执行前不得写成通过。

---

### Task 1: 分级生成预算与真实提速

**Files:**
- Create: `lib/generation-budget.ts`
- Create: `tests/generation-budget.test.ts`
- Modify: `app/generate/page.tsx`
- Modify: `app/api/sites/[siteId]/generate/route.ts`
- Modify: `lib/site-generator.ts`
- Modify: `lib/ai-provider.ts`
- Modify: `lib/ai-self-eval.ts`
- Modify: `tests/site-generator.test.ts`
- Modify: `tests/ai-provider-deadline.test.ts`
- Modify: `e2e/specs/generate-flow.spec.ts`

**Interfaces:**
- Produces: `GENERATION_BUDGET`，包含 `slowNoticeMs: 25_000`、`extendedNoticeMs: 45_000`、`mainStageMs: 30_000`、`recoveryWindowMs: 18_000`、`recoveryTaskMs: 9_000`、`fallbackMinimumMs: 25_000`、`commitReserveMs: 5_000`、`serverDeadlineMs: 75_000`、`clientHardDeadlineMs: 78_000`。
- Produces: `stageTimeoutMs({ deadlineAt, capMs, reserveMs, now })` 和 `canStartFallback({ deadlineAt, now })`。
- Consumes: 所有 provider 的 `signal/deadlineAt/maxAttempts`；服务端先于客户端终止并发送唯一 `done`。

- [x] **Step 1: 写预算纯函数 RED**：断言 provider timeout 是 `min(stage cap, remaining - 5s)`；fallback 在 24,999ms 不启动、25,000ms 启动；5 秒保存预留永远不能被模型消费。
- [x] **Step 2: 运行 RED**：`node --test --experimental-strip-types tests/generation-budget.test.ts`，确认失败原因是接口不存在。
- [x] **Step 3: 实现预算模块并接线**：客户端 25/45 秒只更新慢请求提示，78 秒才 abort；route 75 秒；A/B 单次 30 秒；恢复最多并发 2、单次 9 秒、总窗口 18 秒；provider 删除固定 90 秒，统一读取剩余预算。
- [x] **Step 4: 把首稿模型自评移出提交关键路径**：保留 schema、操作白名单、事实和槽位等确定性校验；生成 `done` 不等待自评，异步结果只能形成建议/观测，不能改已提交 revision。
- [x] **Step 5: 写并跑生成 RED/GREEN**：覆盖 29 秒主成功、主超时后 partial、fallback 阈值、恢复峰值 2、永不结束自评不阻塞、75 秒服务端终态先于 78 秒客户端取消。
- [ ] **Step 6: 视觉验证慢请求状态**：Playwright 用虚拟时钟断言 25 秒显示“仍在生成”、45 秒显示“正在恢复/可先进入已有站点”，均不出现“已停止等待”；78 秒才进入可重试终态。

### Task 2: 英文 schema 边界与工作台长指令原子拆分

**Files:**
- Create: `lib/chat-task-planner.ts`
- Create: `lib/chat-task-executor.ts`
- Create: `tests/chat-task-planner.test.ts`
- Create: `tests/chat-task-executor.test.ts`
- Modify: `lib/draft-index.ts`
- Modify: `lib/ai-provider.ts`
- Modify: `app/api/sites/[siteId]/chat/route.ts`
- Modify: `tests/draft-index.test.ts`
- Modify: `tests/site-intent.test.ts`
- Modify: `e2e/specs/workspace.spec.ts`

**Interfaces:**
- Produces: `ChatTask = { id: string; instruction: string; scopes: ChatScope[]; depth: number }`，`instruction.length <= 600`、总数 `<= 12`。
- Produces: `planChatTasks(message, selectedTarget)`、`executeChatTaskPlan({ tasks, deadlineAt, signal, runTask, maxConcurrency: 2 })`、`mergeChatTaskResults(results, { maxOperations: 32 })`。
- Modifies: `buildDraftIndex(draft, message, scope)` 只带目标板块、命中 SKU、必要站点元数据和相关隐藏/排序/设计字段。
- Modifies: `requestStructuredOperations` 返回明确 `output_truncated`，并接受 `signal/deadlineAt/scope/maxAttempts/maxTokens`。

- [x] **Step 1: 补英文 schema RED/GREEN**：覆盖 companyName 60/61、industry 120/121、summary 400/401、英文最大边界 ready JSON 和 `need_info` 兼容。
- [x] **Step 2: 写拆分与 scoped index RED**：六板块+四产品被拆成多 scope；“第二张产品卡/SKU”仍保留完整目标上下文，无关板块不进入 prompt。
- [x] **Step 3: 实现确定性 planner 和 scoped index**：优先按板块词、编号、SKU、选中目标和句界拆分；不可定位时保留单任务，不额外调用 planner 模型。
- [x] **Step 4: 写执行器 RED**：并发峰值不超过 2；`finish_reason=length` 拆成更小任务，不允许相同 message+scope 原样重试；共享 deadline。
- [x] **Step 5: 实现执行、合并和冲突校验**：完全重复操作去重；同目标不同值、聚合超过 32、任一必要任务失败均整体拒绝；破坏性确认只在聚合后出现一次。
- [x] **Step 6: Route 原子提交 GREEN**：所有批次成功后只调用一次 `commitOperations`，revision/history 各 +1；第 N 批失败、截断无法继续、revision drift 时草稿字节不变。
- [ ] **Step 7: 工作台 E2E**：真实 UI 提交多板块长指令，逐项状态可见，最终只有一个历史记录；取消、冲突、确认和超时后输入恢复可用。

### Task 3: 模板 manifest、语言对齐和可见槽位契约

**Files:**
- Create: `lib/template-manifest.ts`
- Create: `lib/template-ui-copy.ts`
- Create: `tests/template-manifest.test.ts`
- Modify: `lib/template-catalog.ts`
- Modify: `lib/generation-experience.ts`
- Modify: `app/api/templates/[templateId]/preview/route.ts`
- Modify: `components/open-source-template-frame.tsx`
- Modify: `lib/template-slot-guard.ts`
- Modify: `e2e/specs/generate-flow.spec.ts`
- Create: `e2e/specs/template-language-bridge.spec.ts`

**Interfaces:**
- Produces: `TemplateManifest = { id; runtime; nativeLocales; outputLocales; uiLocalization; slots; exportPolicy; requiredVisibleSlots }`。
- Produces: `buildTemplateUiCopy(locale, companyName)`，显式提供 navigation、FAQ、表单 label/placeholder/submit/success、footer 文案。
- Produces: bridge 回执 `{ revision, appliedSlots, visibleSlots, missingSlots, incompatibleReasons }`。

- [x] **Step 1: 写 manifest/locale RED**：英语模板 + 中文草稿不得静默混排；推荐器只能把 locale 兼容模板列为主推荐，不兼容模板必须给出切换原因。
- [x] **Step 2: 实现 manifest 基线**：所有白名单模板有保守默认能力；Forge、SMALL BIS、ScrewFast、NEXT LANDING、SHADCN PRO 提供已验证覆盖；不再靠模板标题英文正则推断语言。
- [x] **Step 3: 写 bridge UI copy RED**：导航、FAQ 标题/问题、表单 label/placeholder/按钮、footer 与 `locale` 一致且公司名更新；未映射板块返回 `missingSlots`，不得静默成功。
- [x] **Step 4: 用 manifest 接线 bridge**：模板专用 selector/binding 放 manifest；bridge 只执行声明式绑定，并在 DOM 中验证 brand、hero、CTA 等文本指纹可见。
- [x] **Step 5: 修正 ready 语义**：iframe 加载、revision 回执、必需槽位应用、可见文本验证同时满足才进入 ready；否则 partial/incompatible 并推荐兼容模板。
- [ ] **Step 6: Playwright 多语言验收**：SMALL BIS 英文草稿全英文；中文草稿自动使用中文能力完整模板或明确提示；FAQ 合并到产品/联系区域但内容仍可见；硬编码 footer/表单不再混用语言。

### Task 4: 通用真实模板离线单文件导出

**Files:**
- Create: `lib/template-export-contract.ts`
- Create: `components/real-template-export-button.tsx`
- Create: `tests/template-export-contract.test.ts`
- Create: `e2e/specs/real-template-export.spec.ts`
- Modify: `app/export/[siteId]/page.tsx`
- Modify: `app/api/templates/[templateId]/preview/route.ts`
- Modify: `components/open-source-template-frame.tsx`
- Deprecate: `scripts/export-real-forge.mjs`（保留为迁移参考，不再作为正式入口）

**Interfaces:**
- Produces: `sitecraft:export-request` / `sitecraft:export-result` bridge 协议；输入 `{ templateId, siteId, locale, maxBytes: 10_000_000 }`，输出 `{ html: Blob; report }`。
- Produces: `ExportReport = { templateId; locale; bytes; inlinedAssets; compressedImages; externalRequests; navigationLinks; removedRuntimeScripts; warnings }`。
- Consumes: 当前 iframe 已应用并通过可见性校验的最终 DOM；不调用 preview HTTP 重新抓取，不回退 `SiteRenderer`。

- [x] **Step 1: 写导出契约 RED**：错误 template/site/revision 拒绝；Blob 必须是 `text/html`；报告区分资源外链和普通导航链接。
- [ ] **Step 2: 写真实导出 RED**：通过 Forge 与 ScrewFast/SMALL BIS 两种模板导出；`file://` 打开无远程请求、无 console error、品牌/hero/产品文本可见，截图不是 SiteRenderer。
- [x] **Step 3: 实现 iframe 内标准 DOM 导出**：clone 最终 DOM；移除 Next/Astro runtime 与 bridge；把可访问样式表、图片、背景图和字体转为内联 style/data URI；保留最小 FAQ 折叠脚本；询盘表单改为明确离线状态。
- [x] **Step 4: 图片压缩和体积门槛**：在 iframe canvas 中按显示尺寸下采样并转 WebP/JPEG，资源去重；超过 10MB 返回带最大资源列表的错误，不生成伪成功文件。
- [x] **Step 5: 修改导出页**：页面渲染真实 `OpenSourceTemplateFrame`，只有 `ready` 后允许下载；显示文件大小、离线资源、语言和缺失槽位报告。
- [ ] **Step 6: 两模板 GREEN**：导出文件均小于 10MB，断网/`file://` 可打开，关键内容和设计保持，所有非导航网络请求为 0。

### Task 5: 真实公司建站、工作台精修与成品交付

**Files:**
- Create: `test-results/real-e2e-20260902/real-generation.spec.ts`
- Create: `成品展示/东莞恒准紧固件-English-real-template.html`
- Create: `成品展示/东莞恒准紧固件-交付报告.md`

**Interfaces:**
- Consumes: 修复后的 `/generate`、`/workspace`、真实模板导出协议。
- Produces: 一个真实 siteId、完整 revision/history、可复测 URL、离线单文件和脱敏交付报告。

- [ ] **Step 1: 用合成公司 prompt 真实建站**：东莞恒准紧固件，15 年出口，不锈钢螺丝/精密螺栓/螺母/非标件，欧美采购经理，英文站，深绿/白/橙，产品/OEM/质量/应用/关于/FAQ/联系询盘。
- [ ] **Step 2: 记录真实性能**：intent latency、推荐模板、TTFA、TTFP、25/45 秒提示、终态、总耗时、fallback、板块状态、operations、siteId。
- [ ] **Step 3: 工作台真实 AI 精修**：强化海外采购价值主张、OEM/ODM、第二产品卡公差、非虚构质量/认证措辞、FAQ 合并；每轮核对 revision、预览、历史、撤销/重做。
- [ ] **Step 4: 对抗性精修**：模糊指代、中英文混合只改英文、快速重复、超长多板块、局部失败后继续；发现产品缺陷回到对应任务补 RED/GREEN。
- [ ] **Step 5: 导出真实成品**：选择通过语言与槽位验证的真实模板，生成 `<10MB` 单文件到 `成品展示`，用桌面/移动端截图和 `file://` 零请求验证设计、文本、表单离线状态。

### Task 6: 统一回归、Sage 回写与项目账本

**Files:**
- Modify: `docs/solutions/README.md`
- Create or Modify: `docs/solutions/20260902-real-template-single-file-export.md`
- Modify: `docs/solutions/20260902-perceived-streaming-generation.md`
- Modify: `.project-to-act/PROJECT_FEATURES.md`
- Modify: `.project-to-act/PROJECT_PROGRESS.md`
- Modify: `.project-to-act/PROJECT_ACCEPTANCE.md`

**Interfaces:**
- Produces: 新鲜证据 ID、相关文件 SHA-256、真实 provider 指标、导出报告；不改变 A-001 至 A-004。

- [ ] **Step 1: 全量验证**：`npm test`、所有生成/工作台/模板/导出 Chromium E2E、`npm run typecheck`、`git diff --check`。
- [ ] **Step 2: 生产构建与服务恢复**：安全停止本项目服务，`npm run build`，长驻启动空闲端口；`/generate`、主 CSS、两模板 preview、export 页均 200 且 console 无框架错误。
- [ ] **Step 3: Sage 沉淀**：记录 Monolith、SingleFile、Obelisk、Wix schema 等来源，写清采用/未采用、搜索失败渠道、项目验证证据、置信度和复用量。
- [ ] **Step 4: 更新 project-to-act**：记录 F-011 完成状态、新增真实导出/长指令/语言能力功能与验收；真实 provider 或成品未验证时必须保持进行中/阻塞。
- [ ] **Step 5: 运行账本校验**：`init_project_management.py --project-root D:/sitecraft-ai --validate` 返回 `valid: true`。
