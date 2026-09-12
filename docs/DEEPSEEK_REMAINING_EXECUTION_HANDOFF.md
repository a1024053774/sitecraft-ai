# SiteCraft AI 剩余任务执行交接

> 给 DeepSeek 的执行文档。请先阅读本文件，再阅读：
> - `.project-to-act/PROJECT_OVERVIEW.md`
> - `.project-to-act/PROJECT_PROGRESS.md`
> - `.project-to-act/PROJECT_ACCEPTANCE.md`
> - `OPTIMIZATION_DECISIONS.md`
> - `docs/superpowers/plans/2026-09-03-sitecraft-comprehensive-optimization.md`
>
本文件描述当前工作区的真实剩余任务。不要把历史计划中已经完成的 Task 0-4、Task 6/7，以及 Task 5/8 的确定性部分重新实现一遍；Task 5/8 的真实运行时闭环仍在范围内。也不要因为测试定位器过时而改动生产数据契约。

## 1. 目标和边界

目标：在保留现有链路的前提下，完成剩余真实运行时验证，让“中文自然语言建站 + 模板填充 + 工作台 AI 微调”具备可审计的性能、并发、安全和浏览器验收证据。

现有主链路必须保持：

```text
DeepSeek -> SiteIntent -> 模板推荐 -> SiteDraft JSON -> SiteOperation 校验
-> revision/CAS 提交 -> 模板 iframe 预览 -> 工作台 AI 微调
-> 人工确认 -> immutable release 发布
```

明确不做：

- 不引入 WebContainers、Sandpack 或任意代码沙箱；当前产品填充既有模板，不生成任意 JSX/HTML/JS。
- 不替换现有 SSE 协议；只补齐幂等、顺序、取消和证据。
- 不引入新的全局状态库，不重写 Next.js 页面结构。
- 不增加长期运行端口。开发固定 `3000`，单套 Playwright 使用 `3210`，并行测试只能使用临时端口且结束后停止。
- 不提交密钥、原始企业资料、完整用户对话或未脱敏日志。

## 2. 当前已验证状态

以下结论已有新鲜证据，不要重复实现：

- `npm test`：`288/288` 通过。
- `npm run typecheck`：退出码 `0`。
- `npm run build`：退出码 `0`，Next.js `16.3.1`，14 个页面生成。
- `git diff --check`：退出码 `0`。
- 生成取消契约：`3/3` 通过。
- 关键定向 Playwright：`7/7` 通过，覆盖确认页模板切换、新标签已填预览、桌面/移动板块状态、22 模板列表、局部重生成取消。
- 真实 analyze smoke：首次请求 `200`，同 key 重放 `200`，重放耗时约 39ms；这只证明单实例 analyze 重放。
- 真实 chat 并发 smoke：一个 `200`、一个 `409 request_inflight`，最终 revision 只增加一次；这只证明单实例并发。
- strict 权限专项：缺上下文 `401`、跨 workspace/viewer 写操作 `403` 已通过。
- 发布/回滚专项：immutable release、质量门、revision 冲突、回滚和公开页 iframe 已通过。

证据索引已经写入 `.project-to-act/PROJECT_ACCEPTANCE.md` 的 `E-024`。截图位于 `test-results/`，包括：

- `test-results/steps/chromium-workspace-change-diff-desktop.png`
- `test-results/steps/chromium-workspace-mobile-preview.png`
- `test-results/steps/chromium-publish-rollback-desktop.png`

## 3. 当前不能宣称的结论

以下项目未完成，任何报告必须写成“未验证”或“阻塞”：

1. 真实 DeepSeek 的 P50/P95、首事件、首屏、核心板块、完整初稿、预览同步、超时率、部分交付率和完整交付率。
2. 多进程/多实例幂等；当前幂等存储主要是进程内 TTL 状态。
3. chat/execute 的真实多标签、取消后恢复、重复/乱序 SSE 和 provider 超时恢复。
4. 两个消息级撤销浏览器场景；现有 E2E helper 直接写本地存储，而服务运行时读 PostgreSQL。
5. 所有模板在真实鼠标指针命中下都能选中 iframe 内内容；当前局部重生成通过了 DOM click，但物理 pointer hit-test 仍有残余风险。
6. 按用户要求逐项记录的完整对抗性审查矩阵。
7. 真实内部网关签名接入；strict 目前依赖受控请求头。
8. 账本自动校验脚本；摘要提到的 `scripts/init_project_management.py` 当前仓库不存在。

## 4. 并行执行拓扑

可以并行准备的工作流如下。每个工作流只修改自己列出的文件，避免并行写同一业务文件。

```text
Wave 1（可并行）
  A. 持久化幂等/多实例证据       -> tests + DB/运行时验证
  B. 撤销 E2E 真实服务接线       -> e2e/helper 或测试夹具
  C. 真实 DeepSeek 性能样本      -> metrics script + 脱敏报告
  D. 对抗性测试夹具与报告结构    -> e2e/specs/adversarial-*.spec.ts
  E. iframe 物理 pointer 调查     -> 单一模板/浏览器复现

Wave 2（必须在 Wave 1 代码变更合并后串行）
  F. 全量单测、类型检查、生产构建、完整 Playwright

Wave 3（必须最后执行）
  G. 完整对抗性审查、截图/控制台/网络证据、账本更新和最终结论
```

并行规则：

- 同一文件只能由一个工作流修改；发现重叠先停止并合并，不要覆盖别人的变更。
- 每个行为变更先写失败测试并确认 RED，再写最小生产代码，再跑 GREEN。
- 不要为了让测试通过而放宽权限、操作数量、模板槽位或事实校验。
- 每个工作流完成后先报告文件、命令、退出码和未验证项，再进入 Wave 2。

## 5. 工作流 A：多实例幂等和真实运行时一致性

**目的：**证明同一个 `route + site + idempotencyKey` 在多进程/多实例下不会重复 provider 调用、重复 revision 提交或重复 history。

**先读：**

- `lib/request-idempotency.ts`
- `app/api/sites/[siteId]/chat/route.ts`
- `app/api/sites/[siteId]/generate/route.ts`
- `lib/site-store.ts`
- `lib/postgres.ts`
- `tests/request-idempotency.test.ts`
- `tests/request-idempotency-contract.test.ts`

**执行步骤：**

1. 先写一个能在两个独立 Node 进程中发送相同 key 的失败测试；断言 provider/commit 只发生一次，第二个请求得到可解释的 `409` 或原始终态。
2. 先运行该测试确认它因当前进程内存隔离而失败。
3. 只有确认 PostgreSQL 连接和现有 schema 后，才选择最小持久化方式。不得凭字段名猜表结构；先读 `lib/postgres.ts` 和迁移/建表代码的权威定义。
4. 保留 TTL、payload hash、scope 隔离、早退释放和完成结果重放语义。
5. 测试取消、provider timeout、没有 `done`、同 key 不同 payload、跨 site 和跨 route。

**验收：**

```text
同 key 同 payload：最多一次 provider/commit，一条 history。
同 key 不同 payload：409，不覆盖原任务。
取消/超时：不会永久占用 key，TTL 后可重试。
跨 site 或 chat/generate scope：互不串 key。
```

**允许修改：**`lib/request-idempotency.ts`、相关 API route、`lib/postgres.ts`、对应迁移和 `tests/request-idempotency*.test.ts`。如果必须改数据契约，记录迁移和回滚方式。

## 6. 工作流 B：撤销 E2E 接线

**目的：**验证工作台真实页面看到的是服务端 history，而不是测试进程私有存储。

**先读：**

- `e2e/specs/workspace.spec.ts:317`
- `e2e/specs/workspace.spec.ts:341`
- `e2e/helpers/api.ts`
- `app/api/sites/[siteId]/draft/route.ts`
- `app/api/sites/[siteId]/chat/route.ts`
- `lib/site-store.ts`
- `tests/conversational-undo.test.ts`

**安全约束：**不要为了测试把公开 `draft` API 的 `source` 随意放宽为客户端可伪造的 `ai`。优先通过真实 chat API、测试专用 provider 夹具或在同一服务进程内创建 history；若需要 test-only seed 接口，必须仅在 `NODE_ENV=test` 下启用、要求不可伪造的测试标记，并在生产构建中不可达。

**验收：**

- “改回上一条”页面显示撤销对象，revision 增加 2，标题恢复原值。
- AI 修改后插入人工修改，页面显示“AI 修改之后还有 1 项后续修改”，草稿和 history 不变。
- 两个场景都通过真实 `/api/sites/[siteId]/draft` 读取结果，不能直接调用测试进程的 `commitOperations()` 作为唯一证据。

## 7. 工作流 C：真实 DeepSeek 性能和初稿质量

**目的：**收集真实数据，不凭 mock 推断性能达标。

**先读：**

- `lib/generation-budget.ts`
- `lib/generation-record.ts`
- `app/api/sites/[siteId]/generate/route.ts`
- `app/generate/page.tsx`
- `docs/solutions/20260902-perceived-streaming-generation.md`

**执行步骤：**

1. 先写 `tests/real-generation-metrics.test.ts`，明确自动化流量不进入真实用户 SLA 分母，时间字段缺失时返回 `null` 而不是伪造 0。
2. 创建 `scripts/run-real-generation-sample.mjs`，使用 `.env.local` 中的 DeepSeek 配置；不输出 API key、原始输入和完整模型响应。
3. 至少采集 12 个脱敏中文样本：工业制造、机械设备、科技企业、专业服务、外贸企业、产品目录型企业各至少 2 个。
4. 每个样本记录：`requestCreatedAt`、`firstEventAt`、`heroCompletedAt`、`coreCompletedAt`、`committedAt`、`doneAt`、模板、语言、结果状态、missingSections、质量报告和估算 token/cost。
5. 汇总 P50/P95、超时率、部分交付率、完整交付率、取消率；按模板、语言、provider 和 build revision 分组。
6. 逐样本检查模板匹配、槽位覆盖、首屏表达、事实虚构、英文占位、中英文一致性和是否可进入工作台。

**性能结论规则：**

- 不把固定 30 秒写成承诺；先报告真实分布。
- 25 秒是慢请求提示点，不是自动失败点。
- 只有真实 provider 数据和完整交付统计齐全后，才能讨论是否达标。

**允许修改：**`lib/generation-budget.ts`、`lib/generation-record.ts`、生成路由、设置页、性能脚本和脱敏 fixtures。不得在日志中保存原始企业资料。

## 8. 工作流 D：完整对抗性审查

**目的：**用真实 API、SSE、数据库状态、浏览器截图和日志验收，而不是只检查 JSON 能否解析。

**新增或维护：**

- `e2e/specs/adversarial-chat.spec.ts`
- `e2e/specs/adversarial-generation.spec.ts`
- `e2e/specs/frontend-acceptance.spec.ts`
- `docs/audits/2026-09-03-comprehensive-adversarial-review.md`

每个场景必须记录以下字段：

```text
测试名称
输入（脱敏）
预期结果
实际结果
HTTP 状态
SSE 终态/sequence
草稿 revision 是否变化
数据库是否写入
关键错误日志（脱敏）
截图路径（如适用）
```

至少覆盖：

- 空请求、超长中文、中英混合、非法 JSON、缺字段、未知操作/模板/target。
- 空 operations、超量 operations、超长标题、虚构事实、不支持槽位。
- 选中 Hero 却修改 Services；只改中文；不要动英文；无历史引用；服务顺序改变。
- 未明确切换模板；删除/隐藏未确认；低风险和高风险操作混合。
- 双标签页、旧请求晚返回、重复/乱序 SSE、无 `done`、取消、provider 超时、部分失败、revision 冲突、重复发送。
- HTML/script/事件属性、Markdown iframe、Prompt injection、任意代码、读取密钥、跨站点/跨用户访问。

任何场景失败都不能被改成“通过”；写入报告的分类必须是 `通过`、`阻塞`、`高风险` 或 `未验证`。

## 9. 工作流 E：iframe 真实指针命中

**目的：**确认“点击模板内容进行 AI 微调”在真实鼠标操作下可用。

**先做浏览器复现：**

- 在 `forge`、`screwfast`、`nextjs-landing` 各选择 Hero、Services、Products。
- 使用 Playwright 普通 `.click()`，不要一开始使用 `force` 或 `dispatchEvent`。
- 记录 `elementFromPoint`、命中元素、是否收到 `sitecraft:select`、按钮是否出现。

如果确认是模板内部 overlay 拦截，只做最小的模板 bridge/CSS 修复，并新增失败测试；如果只是 Playwright 坐标受 iframe 缩放影响，保留生产代码不变，但在验收报告中说明 DOM click 与物理 pointer 的差异。

## 10. Wave 2 串行总回归

所有 Wave 1 工作流合并后，只启动一套验收服务，依次执行：

```text
npm test
npm run typecheck
npm run build
git diff --check
npx playwright test --project=chromium --workers=1
```

若任一命令退出非 0：

1. 停止后续发布判断。
2. 保存原始错误摘要、失败测试、截图和 trace。
3. 复现 -> 定位 -> 根因 -> 最小修复 -> 回归，不猜原因。

完整 Playwright 必须同时检查：

- 生成页桌面/移动端、工作台桌面/移动端。
- 模板推荐、模板预览、发布预览。
- 内容缺口、生成中、首屏完成、部分交付、失败、取消、revision 冲突、破坏性确认、diff、模板降级、中英文切换。
- 横向溢出、文本截断/覆盖、布局跳动、iframe 最新草稿、按钮状态、控制台错误、4xx/5xx 和重复请求。

## 11. Wave 3 最终验收和账本

最终审查必须在所有优化后执行，不能用历史 E-024 代替。

最终报告固定输出：

```text
通过：实际通过的场景、命令、退出码、通过数量
阻塞：失败场景、根因、是否阻塞发布
高风险：虽然通过但仍有残余风险
未验证：真实 provider、浏览器、数据库或网关条件不足的项目
下一步：只列解除阻塞所必需的工作
```

同时更新：

- `.project-to-act/PROJECT_ACCEPTANCE.md`
- `.project-to-act/PROJECT_PROGRESS.md`
- `.project-to-act/PROJECT_FEATURES.md`（只有功能状态变化时）
- `docs/audits/2026-09-03-comprehensive-adversarial-review.md`

每条新证据必须包含日期、命令、退出状态、文件/版本指纹、结果摘要、证据路径和有效期。不存在的校验脚本不得写成通过。

## 12. Ready 判定

只要出现以下任一项，最终结论必须是“不 ready”：

- 核心生成失败或无明确终态。
- revision 冲突可能覆盖用户内容。
- AI 可以修改未授权区域。
- 高风险操作未确认即可提交。
- 关键页面存在明显重叠或横向溢出。
- 真实 provider 没有性能证据。
- 初稿包含可发布的虚构企业事实。
- 发布版本无法回滚。
- 跨 workspace/跨用户隔离没有证据。
- 多实例幂等没有证据。

不要用“测试基本通过”“理论上可行”“应该没问题”替代证据。任何没有真实命令或实际页面证据的结论只能写“尚未验证”。

## 13. 推荐执行顺序和预计耗时

在 PostgreSQL、Chromium 和 DeepSeek key 可用的前提下：

- Wave 1 并行准备：约 45–90 分钟。
- Wave 2 全量回归：约 10–20 分钟。
- Wave 3 对抗性审查和证据整理：约 45–90 分钟。

最快的安全路径是先并行准备 A/B/C/D/E，合并后只做一次全量回归，再做一次最终对抗性审查。若真实 provider 不可用，C 只能标记未验证，不能通过 mock 代替。
