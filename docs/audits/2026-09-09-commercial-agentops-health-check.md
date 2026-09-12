# SiteCraft-ai AI 建站链路 — Agent 架构体检报告

**日期**：2026-09-09
**档次**：T4 企业级（商业级要求，用户指定）
**方法**：agentops-awesome-list 完整架构基线 + 只读取证 + 测试实跑

---

## 审查任务书

- **审查范围（含）**：AI 建站链路（意图 → 模板匹配 → 生成 → 草稿 → 预览 → 发布）、多租户/身份/配额、评测/门禁/可观测/护栏、内容交付面。
- **审查范围（不含）**：模板适配器逐个精修（A 板块已单独收口）、P4/P5 新模板供给、UI 视觉细节。
- **必查组件**：`references/complete-agent-architecture.md` 全部 43 项基线。
- **必跑测试（实际跑了）**：`npm test` → **437 项全绿**；`npx tsc --noEmit` → **0 错误**（`[test]`）。
  - 未跑：Playwright e2e（需 dev server 与更长时长）、`npm run build`、Docker（PG 一致性，属发布前 F1）。
- **基线对照**：当前分支 `feat/nl-site-generation`，未做 `origin/main` diff（该分支为唯一开发线，无并行基线）。
- **已知决策（不重新争论）**：
  1. 颜色选择器已移除，配色一律取模板自带值（用户 2026-09-09）
  2. 并发限制属官方临时设置，不为此改架构（用户 2026-09-08）
  3. 成品展示目录不合格，不对其做改写（用户 2026-09-09）
  4. 「后期还要加其他模板」——机制必须模板无关（用户 2026-09-09）

---

## 体检结论

- **判定：blocked**
- **适用模板**：T4（用户明确「商业级要求」）
- **一句话结论**：**AI 建站链路本身是这套系统里最扎实的部分（437 项测试全绿、契约与门禁齐全），但承载它的平台层只有「单租户演示级」的骨架——身份可伪造、租户未分区、无配额、无留存、红队用例不执行、停滞守卫未接线。以商业级交付，阻断项在平台层而非 AI 层。**
- **置信度**：high（关键结论均经我二次复核，非仅 agent 转述）

---

## 用户目标与审查边界

- **我理解的目标**：以商业级（可对外售卖/交付）标准审查 AI 建站能力，找出不能交付的硬缺口。
- **已向用户确认**：档次 = 商业级（T4）；上一轮已确认「机制要模板无关」「询盘要做彻底」。
- **当前假设**：多用户、多租户、面向真实客户、发布公开站点、询盘含客户隐私数据。
- **不在本次审查范围内**：模板供给（P4）、视觉打磨、性能压测。

---

## 完整架构基线

| 基线组件 | T4 要求 | 状态 | 当前证据 | 缺口 / 不做的理由 |
|---|---|---|---|---|
| System boundary | required | **weak** | `docs/audits/`、`documentation/automation.md` 声明了非目标与不可读边界 | 无形式化「任务类/拒绝类」清单；`limits`（越界能力）只提示不拦截（`site-intent.ts:210`） |
| Task intake | required | **adequate** `[test]` | `site-intent.ts:60-231` 规则预分类 + LLM `ready/need_info/rejected`；追问/拒答有 schema 强制 | 判定靠 prompt，无代码侧确定性触发；无意图准确率回归指标（golden 仅 5 例） |
| Identity/session scope | required | **missing** | `request-context.ts:74-76` 从 3 个**客户端 header** 取身份 | 无登录/SSO/session；header 可任意伪造；无 users 表 |
| Agent loop | required | **weak** | `site-generator.ts:340-534` 固定批次 A/B + recovery | **无全局迭代上限**；停滞守卫未接线（见下） |
| Planner | required | **adequate** `[read]` | `generation-reliability.ts:84-106` `planSectionGroups`；`chat-task-planner.ts:107-136` 拆分（depth≥4 停） | 生成路径无计划修订触发 |
| Router | required | **weak** | `site-intent.ts:416-428` 关键词定类 → `:518-554` 模板解析 → `:487-511` Top3 评分 | **无置信度阈值/门控**：score 只展示不决策，全低分也不弃权；模板层无拒绝路径 |
| Executor | required | **adequate** `[test]` | `ai-provider.ts:498/234` 重试（2/3 次，4xx 不重试）；`ai-retry.ts:39-71` 退避；`ai-provider.ts:522-543` 超时/取消；`request-idempotency.ts:29-49` 幂等 | 幂等存储是**内存 Map**（多实例/重启失效）；无调用级幂等 |
| Reflector | required | **missing** `[trace]` | `ai-self-eval.ts` 存在，但**生产零调用**：`chat/route.ts:298-299` 硬编码 `selfEvaluated=false`；`site-generator.ts:193,671` 标 `@deprecated` 恒返空 | **Reflector 是死代码**；无自评→重生成闭环 |
| Terminator | required | **weak** | `site-generator.ts:665-681` `failedSections.size===0` 否则 `partial` | **partial 仍照常 commit**，无阻断/补偿；无「连续 partial 放弃」阈值 |
| Typed messages | required | **adequate** `[test]` | `aiChangeSchema`（≤20 ops）`site-operations.ts:155-159` | — |
| State schema | required | **weak** | `siteDraftSchema` + `schemaVersion: z.literal(2)` `site-document.ts:86-140` | **无显式迁移链/upcaster**；v1→v2 靠 `normalizeDraft` ad-hoc 兜底 |
| Tool schema | required | **strong** `[test]` | `aiOperationSchema` / `siteOperationSchema` 分离 `site-operations.ts:127-152`；`validateAIOperations` 白名单 `:419-473`；`set_asset` 明确不进 AI schema `:114-125` | 无 function-calling 层；`replace_draft` 可经 `PUT /draft` 调用，边界依赖调用方 |
| Artifact schema | required | **weak** | `release-store.ts:41-43` contentHash sha256；版本自增 + superseded `:115,128` | **contentHash 读取时不校验**；发布快照无校验和验证；无内容寻址存储 |
| Handoff schema | required | **not-needed** | 单 agent 架构 | 无多 agent 交接场景（见「过度工程警告」） |
| Model layer | required | **adequate** `[test]` | `prompt-registry.ts:17-58` 版本+指纹；`ai-provider.ts` 结构化输出+修复重试 | 无模型按风险选择；prompt 无回滚 API |
| Context assembly | required | **weak** | `draft-index.ts` 压缩（商品>20 截断）；本轮新增 `rendered-structure.ts` | 无 token 预算硬约束；无引用/来源标注 |
| Working memory | required | **adequate** `[read]` | 草稿对象即工作状态，`buildDraftIndex` 注入 | — |
| Short-term memory | required | **adequate** `[test]` | `ai-session.ts` 会话摘要 30 分钟 TTL；最近 6 轮对话透传 | — |
| Long-term memory | required（治理） | **missing** | 无跨会话企业事实存储 | T4 要求带治理的长期记忆；当前每次重建 |
| Tool layer | required | **adequate** `[test]` | 白名单 + 幂等 + 重试 + 超时 + 取消 | 无 dry-run；无人工审批门（批量提交，用户无法逐条批准） |
| Code/workspace sandbox | required | **not-needed** | AI 无任意代码执行能力（只有 JSON 操作） | 架构上不存在该风险面 |
| Project ledger | required | **weak** | `.project-to-act/PROJECT_PROGRESS.md` 存在 | **未纳入 git**（`docs/`、`.project-to-act/` 全未跟踪）；无 decision id / operation record |
| Evidence system | required | **weak** | `generation-record.ts:16-26` provenance（provider/model/prompt 指纹/build） | 无 claim→evidence 映射；无证据 id / 过期 / 冲突处理 |
| Gate system | required | **adequate** `[test]` | 发布门 `publish/route.ts:64-78` → `policyDecision`（422）；质量门 `content-quality.ts:244-289` | **无评测门/证据门**：发布不校验 golden 通过率、红队结果、provenance 完整性；资产门只警告不阻断（`publish-gates.ts:32-45`） |
| Workspace/artifacts | required | **weak** | 草稿/发布快照按 `siteId` 存；`release-store` 版本化 | **按 workspace 隔离缺失**（见 P0-1）；无 artifact 归属/保留/导出删除策略 |
| Agent registry | required | **not-needed** | 单 agent | — |
| Role matrix | required | **weak** | `request-context.ts:36-46` 三角色权限映射 | 角色来自 header，与真实身份无绑定；无 admin；设置页写「仅 Owner」与三角色矛盾 |
| Task routing | required | **weak** | 同上 Router | 无路由 eval；无 fail-closed（无 agent 授权时不会拒绝） |
| Coordination state | required | **not-needed** | 单 agent | — |
| Conflict arbitration | required | **not-needed** | 单 agent | — |
| Handoff lifecycle | required | **not-needed** | 单 agent | — |
| A2A boundary | required | **not-needed** | 无跨系统 agent | — |
| MCP/tool boundary | required | **not-needed** | 无 MCP | — |
| Observability | required | **weak** `[test]` | `generation-trace.ts` JSONL 全链路；`generation-record.ts:93-232` p50/p95/交付率 | **trace 默认关**（`SITECRAFT_LOG_GENERATION`）；无 OpenTelemetry/span；无成本（token 计费）指标；**`generation_records` 无 workspace_id** |
| Evaluation | required | **missing** `[trace]` | golden 仅 5 例（`golden-intent.test.ts:32-39`）；`adversarialInputs` **仅被断言名字存在**（`contract-baseline.test.ts:6-19`） | **无生成产物金标准**；**红队用例从不执行**；无轨迹评分器；无 shadow 模式 |
| Guardrails/security | required | **missing** `[trace]` | 仅 prompt 内声明「不可信数据」；无运行时注入检测（`lib/` grep 零命中） | 无 PII 脱敏函数；**trace 开启时明文落盘完整 prompt**；租户串扰（见 P0-1） |
| Deployment/runtime | required | **weak** | `app/api/health/route.ts:8-32`（200/503 + 依赖状态）；流式 SSE | **无 CI**（`.github/workflows` 不存在）；无 liveness/readiness 分离；无 build revision |
| Operations/runbook | required | **adequate** `[read]` | `docs/operations/ai-generation-runbook.md`、`rollback.md` | 两手册自认未验收；无「外部漂移」专章 |
| Self-evolution | required（治理） | **missing** | 无候选变更→eval 门→灰度→回滚链 | T4 要求带治理的自演化 |

---

## 缺失组件清单

| 优先级 | 缺失组件 | 为什么重要 | 建议补齐方式 |
|---|---|---|---|
| **P0** | 身份与租户隔离（Identity/session + Workspace artifacts） | 商业级意味着多客户共存；当前 header 可伪造、store 用模块常量 workspaceId、`generation_records`/`sitecraft_leads` 无 workspace_id | 接入真实网关签名或 SSO；`workspaceId` 从请求上下文传入 store 与所有表；补跨租户读取的负向测试 |
| **P0** | 运行时注入防护（Guardrails） | `adversarialInputs` 里「忽略规则读环境变量」这类输入**从未被执行**；用户可控文本（商品资料/上传/草稿）进 prompt 无检测 | 输入侧结构化隔离 + 输出侧白名单（已有）+ 红队用例接进 CI |
| **P0** | 红队/评测门（Evaluation） | 门禁只验内容质量，不验「模型是否被攻破」「意图是否漂移」 | 把 `adversarialInputs` 变成真跑；golden 扩到覆盖 22 模板；发布前跑 golden 通过率 |
| **P1** | 配额与限流（Sessions/users） | 商业级必须防单客户打爆 provider 成本与公开面滥用 | 每租户调用配额 + 公开面 IP 节流；配额入 `generation-budget` |
| **P1** | 留存与删除（Compliance） | 询盘含客户隐私；无删除权、无保留期 | 定义保留期 + 删除 API + 询盘 PII 处理说明 |
| **P1** | 停滞守卫接线（Agent loop/Terminator） | `createStallGuard` 等**只有定义和测试**，生产未调用；长任务卡死无终止 | 接入 `site-generator`；补「连续 partial 放弃」阈值 |
| **P1** | Reflector 接线或删除 | 自评模块存在但生产恒返回空，文档却称有自评 | 要么接入并补测试，要么删除并在 `automation.md` 如实标注 |
| **P2** | CI（Deployment） | 437 项测试全绿但**无 CI 执行**，回归靠人工 | 接 CI：`tsc` + `npm test` + build 作为合并门 |
| **P2** | 项目台账入版本控制 | 计划/进度/审计全在仓库外或未跟踪 | 将 `docs/` 与 `.project-to-act/` 纳入 git（用户已决定移入） |
| **P2** | 存证可观测补齐 | `generation_records` 无操作者、无 workspace_id | 加 `workspace_id`/`actor_id` 列；trace 默认开的脱敏开关 |

---

## 架构地图

| 模块 | 当前证据 | 评分 | 说明 |
|---|---|---|---|
| 意图理解 | `site-intent.ts:60-231` | adequate | 规则+LLM 双段，追问/拒答有 schema |
| 模板匹配 | `site-intent.ts:416-554` | weak | 确定性优先但**无置信度门控** |
| 生成编排 | `site-generator.ts:340-681` | adequate | 批次+并发+恢复，但停滞守卫未接线 |
| 操作白名单 | `site-operations.ts:127-473` | strong | 按场景白名单 + 容量校验，AI 无法越界 |
| 草稿状态 | `site-store.ts:183-271` | adequate | revision 并发 + FOR UPDATE + 撤销重做 |
| 发布快照 | `release-store.ts:111-300` | adequate | immutable + contentHash + rollback |
| 质量门 | `content-policy.ts` + `content-quality.ts` | strong | 策略树单一真相源 + 同源性测试 |
| 交付面 | `published/[siteKey]/client.tsx` | weak | **经 iframe 加载预览路由交付**，非静态化；SEO 靠元数据 |
| 询盘闭环 | `lead-store.ts` + `preview/route.ts:1119-1131` | adequate | 落库+幂等+蜜罐；但无 workspace_id、无限流 |
| 身份/租户 | `request-context.ts:60-118` | **missing** | 默认 relaxed 回退 demo/editor |
| 评测 | `golden-intent.test.ts` | **missing** | 5 例；红队不执行 |
| 护栏 | 仅 prompt 声明 | **missing** | 无运行时检测/脱敏 |

---

## 功能审查报告

| 功能/能力 | 是否存在 | 完整度 | 主要问题 | 建议 |
|---|---|---|---|---|
| 一句话建站（意图→草稿） | 是 | 完整 | 意图判定靠 prompt；无准确率回归 | 扩 golden + 接入 CI |
| 多轮对话改稿 | 是 | 完整 | 撤销链路有已知 e2e 待归因 | 修 e2e |
| 模板原生注入 | 是 | 完整 | A 板块已收口 | — |
| 点选就地编辑 | 是 | 完整 | 代码与测试**未 git add** | 纳入版本控制 |
| 图片替换 | 是 | 完整 | 同上；上传端点无站点作用域、孤儿文件不回收 | 引用计数清理 |
| 询盘表单 | 部分 | **不完整** | 20/22 模板无可用表单；现有注入方案设计错误（待重做） | 按三层方案重做 |
| 发布与回滚 | 是 | 完整 | 无评测门 | 加 golden 门 |
| 多租户 | **否** | — | 见 P0-1 | 见缺失清单 |
| 配额/限流 | **否** | — | 无 | 见缺失清单 |
| 留存/删除 | **否** | — | 无 | 见缺失清单 |

---

## 关键问题

| 优先级 | 问题 | 为什么重要 | 建议修复 |
|---|---|---|---|
| **P0-1** | 身份可伪造 + 租户未分区 | `request-context.ts:82-84` 默认回退 `demo/editor`；`site-store.ts:56` 用模块常量 workspaceId；`generation_records`/`sitecraft_leads` 无 workspace_id | 网关签名/SSO + workspaceId 贯穿 store 与表 |
| **P0-2** | 红队用例从不执行 | `adversarialInputs` 仅被断言名字存在；prompt injection 无运行时防护 | 用例真跑 + 输入隔离 + CI 门 |
| **P0-3** | 无评测门 | 发布只验内容质量，不验意图漂移/注入/回归 | golden 扩覆盖 + 发布前通过率门 |
| **P1-1** | 停滞守卫是死代码 | 长任务卡死无终止；文档却称已生效 | 接线或如实修正文档 |
| **P1-2** | 无配额/限流 | 商业级成本与滥用风险 | 租户配额 + 公开面节流 |
| **P1-3** | 无留存/删除 | 询盘含隐私 | 保留期 + 删除 API |
| **P2-1** | 无 CI | 437 测试靠人工跑 | 接 CI 合并门 |
| **P2-2** | 项目台账未版本化 | 换机/协作即失忆 | 纳入 git |

---

## 优化建议

| 优先级 | 建议 | 预期收益 | 实施成本 | 验收方式 |
|---|---|---|---|---|
| P0 | 租户贯穿：`workspaceId` 从请求上下文传入 store 与全部表 | 从「单租户演示」变为「可多客户交付」 | 中 | 新增跨租户负向测试：A 租户读不到 B 的草稿/询盘/存证 |
| P0 | 红队用例接入 CI 并真跑 | 攻破面可证伪 | 低 | `adversarialInputs` 每条有断言；CI 红则阻断 |
| P0 | golden 扩到覆盖 22 模板 + 发布前通过率门 | 意图漂移可发现 | 中 | 发布前 golden 通过率 ≥ 阈值 |
| P1 | 停滞守卫接线 | 长任务不再无限等待 | 低 | 注入停滞后能终止并落 `run.outcome` |
| P1 | 配额 + 公开面限流 | 成本与滥用可控 | 中 | 超配额返回 429；e2e 断言 |
| P1 | 留存策略 + 删除 API | 合规基础 | 中 | 删除后数据不可读 |
| P2 | CI（tsc + test + build） | 回归自动化 | 低 | 合并门必须绿 |
| P2 | 项目台账入 git | 协作与可追溯 | 低 | `git ls-files docs/` 非空 |

---

## 过度工程警告（T4 下不需要的）

| 模块 | 现状 | 判定 |
|---|---|---|
| Multi-agent（registry/role matrix/coordination/arbitration/handoff） | 未实现 | **正确**——单 agent 架构，无并行/权限隔离/独立评测需求 |
| A2A / MCP | 未实现 | **正确**——无跨系统 agent 调用 |
| Code/workspace sandbox | 未实现 | **正确**——AI 无任意代码执行能力，风险面不存在 |
| 形式化状态机 | 未实现 | 可接受——revision + 布尔集足够，但需文档化状态转换 |

---

## 欠工程警告（T4 要求但缺失）

身份/租户隔离 · 配额限流 · 留存删除 · 红队执行 · 评测门 · 运行时注入防护 · CI · 长期记忆治理 · 自演化治理。

---

## 下一步

1. **修 P0-1（租户贯穿）**——这是商业级的第一道门；在它修好前，多客户交付不可行。
2. **把红队与 golden 变成真跑的门**（P0-2/P0-3）——当前「测试全绿」只证明既有行为不回归，不证明抗攻击与意图准确。
3. **接线停滞守卫 + 修 P3.5 询盘表单**（P1）——两处都是「文档承诺 ≠ 运行时事实」，修完需同步修正 `automation.md`。

---

> **方法学备注**：本报告对计划文件 `docs/plans/2026-09-09-quality-plan.md` §7 的一条断言做了复核——
> 该文件称 `renderedStructure` 未进提示词，**实测已被 `lib/ai-provider.ts:260` 消费**（`[trace]`）。
> 按 skill 要求「文档是待验证的主张，不是证据」，此处以代码为准并如实记录分歧。
>
> **本报告为只读审计产物，未修改任何源码、配置或运行时文件。**
