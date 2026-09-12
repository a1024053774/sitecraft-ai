# Template Content Completeness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户输入、生成草稿和真实模板可见内容成为同一事实源；生成结束时能确定性识别模板示例残留与缺失字段，并让用户一键补全而不是在工作台逐项救火。

**Architecture:** 扩展现有 `TemplateManifest` 为精确语义槽位契约，使用本地确定性覆盖检查代替关键路径 LLM 自评。站点创建即持久化用户已确认的 name/template/locale，站点创建后所有预览都从服务端 revision 读取。缺失内容通过现有生成器的多板块补全模式一次提交，工作台错误恢复与 SSE 解析统一到可复用边界。

**Tech Stack:** Next.js 16.3.1 App Router、React 19、TypeScript、Zod、SSE、node:test、Playwright

## Global Constraints

- 本计划是 `C:/Users/ZhuanZ/.claude/plans/crispy-jumping-donut.md` 的实施版，只实现当前 Task 1–4 尚未覆盖的内容。
- 保留已完成的 75s/78s 预算、chat 原子拆分、manifest locale 基线与真实单文件导出，不重写这些模块。
- 生成关键路径不得新增全量 LLM 自评；覆盖检测必须是本地确定性逻辑。
- 所有新行为先观察 RED，再最小实现 GREEN；不新增固定 sleep。
- 不修改 `vendor/`；不把 `SiteRenderer` 当成真实模板完成证据。
- 不自动 commit；`.project-to-act`、`docs/solutions` 和复核记录继续由 DeepSeek/Claude 维护。
- `C:/Users/ZhuanZ/.claude/plans/crispy-jumping-donut.md` 的“范围决定（用户确认，2026-09-02）”优先于该文件后部残留的旧“不做清单”：副语言补齐、对话级撤销、iframe 沙箱和高性价比 a11y 纳入本轮；登录鉴权、图片/logo 管线和全面安全/a11y 审计后置。

## Current Execution Snapshot (2026-09-02)

| Area | Status | Fresh evidence / remaining gate |
|---|---|---|
| A contract + local coverage | Code landed, bridge regression blocking gate | Manifest/coverage/contact/non-content unit tests pass; preview bridge currently does not emit `sitecraft:applied`, so the two-template E2E still fails |
| B atomic seed + content source | Code landed, browser gate regressed behind A | `site-seed-draft` and typecheck pass; content-source E2E passed before the A bridge change and failed after it, so server draft ownership is retained while the bridge is repaired |
| C coverage event + fill missing | Code landed, UI cleanup pending | Coverage/missing sections and bounded two-section recovery are implemented; `missing-section-recovery.spec.ts` passes, but the terminal pending list duplicates the live `.failed` state |
| D workspace recovery | Mostly landed, combined browser gate pending | Shared SSE, chat error recovery, regenerate cancellation, near-bottom scrolling and dialog focus/ESC are implemented; generate parser unification and post-bridge Workspace E2E remain |
| F newly included P2 scope | Conversational undo landed; remainder pending | Deterministic conversational undo has unit coverage; secondary locale, complete iframe sandbox acceptance, generate a11y and provider observability remain |

### Paused Resume Point (2026-09-02, user device battery)

- Last fresh broad evidence: `npm test` = 216/216 passed; `npm run typecheck` exited 0.
- Last combined browser evidence: 25 passed / 14 failed across coverage, content-source, missing-section recovery, generate flow and workspace specs.
- Primary failure cluster: `app/api/templates/[templateId]/preview/route.ts` no longer emits `sitecraft:applied` after the visible-text coverage block was added. This also makes preview content appear unchanged and causes several workspace failures downstream.
- First action on resume: capture the preview route page error/console error for `template-content-coverage.spec.ts`, add or retain a regression that fails with `bridge_apply_timeout`, repair the bridge, then rerun that single spec before touching downstream workspace failures.
- Next independent defects after bridge: remove duplicate live-failed/terminal-pending UI, restore the explicit 78-second terminal state, add local capability fallback in workspace, unify generate SSE parsing, migrate all providers to deadline-aware limited retry, wire fact/structure checks, then complete Task F and the full acceptance gate.
- Do not start the final real-company Task 5 until the content-quality browser gate is green. Do not modify `vendor/`, auto-commit, or overwrite existing shared changes.

Do not mark the content-quality gate complete until all browser and real-content gates below have fresh evidence.

---

### Task A: 精确语义槽位与模板示例残留检测

**Files:**
- Modify: `lib/template-manifest.ts`
- Create: `lib/template-content-coverage.ts`
- Create: `tests/template-content-coverage.test.ts`
- Modify: `app/api/templates/[templateId]/preview/route.ts`
- Modify: `components/open-source-template-frame.tsx`
- Modify: `tests/template-manifest.test.ts`
- Create: `e2e/specs/template-content-coverage.spec.ts`

**Interfaces:**
- Extends: `TemplateManifest.slots`，每个 binding 声明 `target`、`selector`、`contentType`、`required`、`maxLength`、`demoFingerprints`。
- Produces: `ContentCoverageReport = { filledTargets; aiFilledTargets; pendingTargets; residualDemoSlots; unmappedRequiredTargets }`。
- Produces: `classifyDraftCoverage({ draft, manifest, appliedTargets })` 与 `detectTemplateDemoResidue({ manifest, visibleTexts })`。
- Extends: bridge 回执增加 `visibleTextsBySlot` 和 `residualDemoSlots`，只返回声明槽位的短文本，不返回整页 HTML。

- [x] **Step 1: 写语义 manifest RED**：Forge/SMALL BIS 与一个 React/Next 模板必须声明 hero/about/features/services/products/contact 的精确 target；target 必须存在于 SiteDraft schema，禁止孤儿槽位。
- [x] **Step 2: 写覆盖分类 RED**：非空用户字段为 filled、历史 AI appliedTarget 为 aiFilled、defaultDraft/空值/lorem/模板示例公司名为 pending 或 residual demo。
- [x] **Step 3: 实现精确 binding 与本地覆盖器**：只遍历 manifest 声明字段；默认文案比较使用权威 `defaultDraft`，模板示例使用 manifest fingerprints。
- [ ] **Step 4: Bridge 接线**：应用内容后读取声明节点的可见短文本，回报 residual demo；无法读取或隐藏节点不得算 filled。
- [ ] **Step 5: 两模板 E2E**：注入完整草稿后关键 target 可见且 demo residue 为 0；故意漏 about/products 时报告准确 pending，不静默 ready。

### Task B: 站点创建即持久化与三处预览同源

**Files:**
- Modify: `app/api/sites/route.ts`
- Modify: `lib/site-store.ts`
- Modify: `lib/postgres.ts`
- Modify: `app/generate/page.tsx`
- Modify: `app/templates/[templateId]/preview/page.tsx`
- Modify: `components/client-preview-frame.tsx`
- Create: `tests/site-seed-draft.test.ts`
- Create: `e2e/specs/content-source-consistency.spec.ts`

**Interfaces:**
- Produces: `SiteSeed = { name; templateId; locales; initialDraft }`，由现有 SiteDraft schema 校验后传给 `createSite(seed)`。
- Produces: 站点创建后的预览 URL 使用 `siteId`；预览页读取 `GET /api/sites/:siteId/draft` 的当前 revision。
- Keeps: 站点创建前的 10 分钟 localStorage 草稿仅作为临时确认预览，创建后不得再作为权威源。

- [x] **Step 1: 先读权威字段定义并写 seed RED**：确认 SiteDraft 的 companyName/templateId/locales 实际字段语义；创建记录后这些字段必须与确认页一致，revision 初始值遵循现有 store 约定。
- [x] **Step 2: 修改 file/Postgres create 边界**：同一 schema 生成初始 draft；异常不产生半个站点；不伪造 history change。
- [ ] **Step 3: 写预览同源 RED**：生成完成后确认页、独立预览和工作台显示相同 companyName/hero/products/revision；刷新 iframe 仍一致。
- [ ] **Step 4: 实现 siteId 预览源**：服务端 draft 成为唯一事实源；localStorage 快照只在没有 siteId 时生效，过期/模板不符继续拒绝。
- [ ] **Step 5: 中断场景 GREEN**：生成在内容返回前中断，站点仍保留用户 name/template/locale，不回到 forge 默认信息。

### Task C: 生成覆盖报告与一键补全缺失板块

**Files:**
- Modify: `lib/site-generator.ts`
- Modify: `app/api/sites/[siteId]/generate/route.ts`
- Modify: `app/generate/page.tsx`
- Modify: `lib/generation-record.ts`
- Modify: `tests/site-generator.test.ts`
- Modify: `e2e/specs/generate-flow.spec.ts`
- Create: `e2e/specs/missing-section-recovery.spec.ts`

**Interfaces:**
- Produces: full/partial `done` 事件包含 `coverage` 与 `missingSections`；coverage 可从当前 draft、manifest、history appliedTargets 重算。
- Produces: `regenerateMissingSectionsOperations({ sections, ... })`，并发上限 2，共享 absolute deadline，成功操作合并后只提交一次 revision。
- Produces: UI 命令“仅补全缺失板块”，只发送当前 pending sections，不修改已完成板块。

- [ ] **Step 1: 写 partial 覆盖 RED**：批 B 某板块失败时 done 精确列 missing/pending，已成功板块不被标为缺失。
- [ ] **Step 2: 写多板块补全 RED**：只调用 missing sections，并发峰值 2；成功项合并一次提交，其他 draft 字节不变。
- [ ] **Step 3: 实现 coverage 与补全模式**：预算不足时保留 pending；不启动全站重生成，不重置 deadline。
- [ ] **Step 4: 实现确认页/终态 UI**：常驻待补清单和一键补全按钮；补全中显示真实 section 状态，失败后可重试。
- [ ] **Step 5: E2E GREEN**：模拟 about/products 缺失，点击一次后只补两板块、revision +1、hero 不变、预览清单消失。

### Task D: 工作台错误恢复、取消与滚动控制

**Files:**
- Create: `lib/sse-events.ts`
- Create: `tests/sse-events.test.ts`
- Modify: `app/workspace/page.tsx`
- Modify: `app/generate/page.tsx`
- Modify: `e2e/specs/workspace.spec.ts`

**Interfaces:**
- Produces: `readSseEvents(reader, onEvent)`，保留半截 buffer，只解析完整 `\n\n` 事件。
- Produces: error 消息保存原始用户文本并提供重试回填；`submitRegenerate` 使用与 chat 相同的 AbortController 生命周期。
- Produces: 自动滚动只在用户已接近底部或本次用户刚发送消息时发生，历史回看不被 busy 更新抢走。

- [x] **Step 1: 写 SSE 半包 RED**：跨 chunk JSON 不抛错、不丢事件，done 后取消 reader 并 release lock。
- [ ] **Step 2: 统一 generate/workspace SSE 消费**：删除两份手写 parser，调用共享实现，保持现有 done/timeout 语义。
- [ ] **Step 3: 写错误重试与 regenerate cancel RED**：provider error 后原文可一键回填；regenerate 超时/卸载会 abort，busy 恢复，draft/history 不变。
- [ ] **Step 4: 实现滚动阈值**：用容器 `scrollHeight - scrollTop - clientHeight` 判断 near-bottom，不引入新 chat 组件或 markdown 依赖。
- [ ] **Step 5: Workspace E2E**：错误可重试、iframe capabilities 失败仍可发送、regenerate 可取消、向上查看历史时新 status 不抢滚动。

### Task E: 去重审计与内容质量总验收

**Files:**
- Modify only when proven duplicated: `lib/ai-retry.ts`, `lib/site-operations.ts`, label helpers
- Modify: `docs/superpowers/plans/2026-09-02-template-content-completeness.md`
- Modify: `docs/agent-collab-handoff.md`（仅 Codex 交接登记）

**Interfaces:**
- Produces: 每个候选死模块的真实非测试调用点清单；有调用则保留，无调用且无计划消费者才删除。

- [ ] **Step 1: 运行调用点审计**：逐一检查 ai-retry、abort-utils、template-manifest、generation-budget、template-ui-copy、template-export-contract、fact-check、structure-check；禁止凭文件名猜死代码。
- [ ] **Step 2: 只合并有行为等价证据的重复**：retry/operation validation/labels 若语义不同则保留并记录原因，不做顺手重构。
- [ ] **Step 3: 全量验证**：`npm test`、generate/workspace/content-source/coverage E2E、typecheck、diff、production build。
- [ ] **Step 4: 真实内容冒烟**：一句话建站后确认页/独立预览/工作台四个关键字段一致；缺失板块一键补齐后真实模板无示例残留。
- [ ] **Step 5: handoff 门禁**：只有本计划 A–E 验收通过后，登记“内容质量门完成”，DeepSeek 才开始原 Task 5 真实公司成品。

### Task F: 新版 P2 纳入范围

**Files:** follow existing ownership after Tasks A-D release their files; do not edit `vendor/`.

- [ ] **Step 1: 副语言增量补齐**：只补当前副语言缺失 target，后置执行，不阻塞首稿，不覆盖已有翻译。
- [ ] **Step 2: 对话级撤销**：支持“改回上一条”定位最近一次 AI change set，复用现有 history/inverse operations，不把 commit 级 undo 伪装成消息级撤销。
- [ ] **Step 3: iframe 沙箱**：限制 iframe 能力并收紧 postMessage 来源/消息契约；保持真实模板预览、导出和选区交互可用。
- [ ] **Step 4: 高性价比 a11y**：generate 表单 label、状态 aria-live、确认弹框焦点/ESC；不扩大为全站审计。
- [ ] **Step 5: DeepSeek 与可观测**：核对 JSON mode、maxTokens、AbortController、统一 retry、manifest 缓存；关键错误包含 sessionId/siteId/operation，补 chat/generate 分支测试。
