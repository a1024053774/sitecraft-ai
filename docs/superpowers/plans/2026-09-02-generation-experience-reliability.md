# Generation Experience Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让自然语言建站在能力协商、模板推荐、初稿预览和生成等待四条链路上都给出真实、有限且可验证的结果。

**Architecture:** 保留现有 Next.js App Router、SSE 和结构化站点草稿。新增纯函数负责候选模板分散与进度计算；确认页只把无法独立呈现的 FAQ 自动映射到联系板块；跨标签预览使用同源、带时间戳的短期 localStorage 草稿；执行请求由一个 AbortController 覆盖创建站点、读取 revision 和 SSE 三段。45 秒先作为慢请求告警与恢复检查点，更晚的硬截止才负责取消并进入可重试终态。

**Tech Stack:** Next.js 16.3.1、React 19、TypeScript、node:test、Playwright

## Global Constraints

- 不新增依赖，不改变 22 个模板白名单。
- 不伪造百分比完成度：进度由真实板块终态和当前阶段计算，时间只提供封顶补充。
- 45 秒是慢请求告警与恢复检查点，不再直接终止仍可能成功的真实 provider 请求；更晚硬截止仍须覆盖整条链路，取消后保留已创建站点和恢复指针。
- “模板原貌”和“已填内容预览”必须使用准确文案，不承诺开源静态模板能消费它不认识的占位符。
- 所有新增行为先由 Playwright 失败测试证明，再写实现。

---

### Task 1: 能力协商与模板候选

**Files:**
- Create: `lib/generation-experience.ts`
- Modify: `app/generate/page.tsx`
- Test: `e2e/specs/generate-flow.spec.ts`

**Interfaces:**
- Produces: `buildTemplateRecommendations(templates, intent)` 返回主推荐优先、同类与跨类兼顾且由业务种子稳定轮换的 3 个候选。
- Produces: `adaptIntentLimits(intent)` 把 FAQ 独立板块限制转换为联系板块自动适配提示，并确保 `contact` 在 `coreSections` 中。

- [x] **Step 1: 写失败测试**：相同主模板但不同业务描述得到不同候选；FAQ 限制显示为自动适配而非拒绝。
- [x] **Step 2: 运行聚焦 Playwright**：确认当前候选数组相同且 FAQ 自动适配文案不存在。
- [x] **Step 3: 写最小实现**：稳定哈希只用于轮换，不随机；FAQ 仅匹配权威限制文本，不吞掉其他限制。
- [x] **Step 4: 重跑聚焦测试**：候选与能力适配通过。

### Task 2: 已填内容预览

**Files:**
- Modify: `app/generate/page.tsx`
- Modify: `app/templates/[templateId]/preview/page.tsx`
- Test: `e2e/specs/generate-flow.spec.ts`

**Interfaces:**
- Consumes: `SiteDraft` 的现有 schema 与 `templateId` 白名单。
- Produces: `{ savedAt, draft }` 的同源短期预览快照；模板 ID 不匹配或超过 10 分钟则忽略。

- [x] **Step 1: 写失败测试**：从确认页打开新标签后能看到用户公司名和“已填内容预览”。
- [x] **Step 2: 运行聚焦 Playwright**：确认 `sessionStorage + noreferrer` 无法跨标签传递。
- [x] **Step 3: 写最小实现**：改用 localStorage 短期快照，预览页校验后用 `SiteRenderer` 渲染结构化草稿；无快照时继续展示模板原貌 iframe。
- [x] **Step 4: 重跑聚焦测试**：确认两个预览语义不再混淆。

### Task 3: 有限等待与真实进度

**Files:**
- Create: `lib/generation-experience.ts`
- Modify: `app/generate/page.tsx`
- Modify: `app/globals.css`
- Test: `e2e/specs/generate-flow.spec.ts`

**Interfaces:**
- Produces: `getGenerationProgress(input)`，输出 0-96 的显示进度；只有服务端终态才显示 100。
- Produces: 贯穿三个 fetch 的单一 `AbortController`，45 秒触发后返回确认页并保留站点恢复指针。

- [x] **Step 1: 写失败测试**：生成中出现 progressbar；永不关闭的 SSE 在虚拟 45 秒后进入明确超时终态。
- [x] **Step 2: 运行聚焦 Playwright**：确认当前无进度条且计时无限增长。
- [x] **Step 3: 写最小实现**：统一控制器、绝对计时器、`finally` 清理；进度条使用真实板块完成数和 phase。
- [x] **Step 4: 重跑聚焦测试**：确认不会越过 45 秒仍停留 generating。

### Task 4: 回归、视觉与项目证据

**Files:**
- Modify: `.project-to-act/PROJECT_PROGRESS.md`
- Modify: `.project-to-act/PROJECT_FEATURES.md`
- Modify: `.project-to-act/PROJECT_ACCEPTANCE.md`

**Interfaces:**
- Consumes: Tasks 1-3 的通过结果与截图。
- Produces: F-010、A-009 和新鲜证据索引，不改变 A-001 至 A-004。

- [x] **Step 1: 运行生成流 E2E**：Chromium 全部通过，桌面和移动端无框架错误与横向溢出。
- [x] **Step 2: 运行全量单测、类型检查和生产构建**：全部退出码 0。
- [x] **Step 3: 检查截图**：进度条、超时提示、已填内容预览和候选卡片无重叠。
- [x] **Step 4: 更新账本并校验**：官方校验器返回 `valid: true`。

---

### Task 5: 真实 provider 阈值适配与关键路径提速

**Trigger:** 用户真实测试表明，45 秒到达时仍没有可用网站。此前测试只验证了有限终态机制，没有验证 45 秒阈值适合真实 provider。

- [ ] **Step 1: 写失败测试**：45 秒进入慢请求提示和恢复态但不中止；更晚硬截止才取消整条链路，并保留恢复指针。
- [ ] **Step 2: 调整分级预算**：解耦慢请求告警、服务端恢复与客户端硬截止，确保 `AbortSignal` 只在真正截止时传播。
- [ ] **Step 3: 记录真实时间线并提速**：采集创建、首事件、首屏、板块和最终提交耗时，缩短阻塞关键路径，正常目标保持约 30 秒。
- [ ] **Step 4: 回归与真实验收**：重跑单测、E2E、类型检查和构建，再用真实 provider 连续样本验证 P50/P95、交付率、部分交付率与超时率。
