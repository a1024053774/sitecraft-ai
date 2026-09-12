# SiteCraft AI 健康审查报告：AI 对话 + 自然语言建站链路

> 审查日期：2026-09-03　审查方式：agentops-awesome-list 健康检查（只读）
> 审查对象：一句话自然语言建站 → 意图理解 → 模板匹配 → 确认页 → 生成 → 工作台 AI 对话这条核心链路
> 依据基线：`C:\Users\ZhuanZ\.claude\skills\agentops-awesome-list\references\complete-agent-architecture.md`

## 审查任务书

- **审查范围**：`app/generate` 页 analyze（意图理解/need_info/ready 分支）→ 模板匹配 → confirm（确认页/预览 iframe）→ execute（整站生成/局部重生成）→ 工作台 AI 对话与撤销链路；配套服务端 `generate/chat/draft` 路由、幂等/SSE/预算层。**不含**：模板 iframe 资源服务（template-static/base 前缀，已由并行会话处理）、发布/回滚、权限隔离、询盘导出——这些各有独立会话与证据。
- **必查组件**：默认全量对照完整架构基线（见下），按 T3 档取舍。
- **必跑测试（实际跑）**：
  - `npm test` → **288/288 通过** `[test]`
  - `npx tsc --noEmit` → **退出码 0** `[test]`
  - `npx playwright test e2e/specs/generate-flow.spec.ts --project=chromium --workers=1` → **20/20 通过**（含"收到 done 后即使 SSE 不关闭也立即完成生成"）`[test]`
  - 真实浏览器（Edge headless + 锐科精密真实输入）→ 22s 到确认页、主按钮可点、点生成进入 generating `[test]`
  - 未跑：完整全量 Playwright 套件（Wave 2 需在代码冻结后串行跑）→ 标注 `unverified`
- **基线对照**：HEAD `c20e2a1` vs 工作区未提交改动（68 文件，+4217/-600）。核心可靠性组件（request-idempotency/sse-events/sse-response/generation-experience/generation-budget/request-context/prompt-registry）为新增未跟踪文件。 `[baseline]`
- **已知决策**：SSE 信封（requestId/taskId/sequence/payload）为叠加字段、生成页无需解包 payload——已确认，不算缺陷。真实 DeepSeek 慢（P95 未知）是既有阻塞，非本审查引入。

## 体检结论

- **判定**：`risky`（非 ready）
- **适用模板**：T3（生产项目——写文件、调外部 LLM API、可能影响真实建站数据）
- **一句话结论**：链路"设计意图清晰、契约匹配、单测与定向 E2E 覆盖良好"，但**运行时稳定性组件存在真实缺口**——本次修掉了「analyze 收到 done 后 busy 永久残留 → 按钮 disabled 卡死」根因（代码层面唯一能让 busy 恒 true 的路径），此外仍有未验证项（真实 provider P95、need_info 第二轮 400、SSE 缺抗缓冲头）使判定为 risky 而非 ready。
- **置信度**：high（修复经真实浏览器 + 20 条定向 Playwright 验证）

## 用户目标与审查边界

- **我理解的目标**：这条「自然语言建站 + AI 对话」链路太不稳定，用户要一份针对它的健康报告，把稳定性缺口和已修/待修问题讲清楚。
- **已向用户确认**：报告对象 = AI 对话 + 自然语言建站链路；成功标准 = 修好"卡住"即可（已达成）。
- **当前假设**：以当前工作区（含 busy 修复 + Codex 会话的 preview/template-static 改动）为基线。
- **不在本次范围**：模板 iframe 资源/CDN 被墙、发布/权限/询盘导出、Codex 全量回归。

## Complete Architecture Baseline

| 基线组件 | T3 要求 | 状态 | 当前证据 | 缺口 / 理由 |
|---|---|---|---|---|
| System boundary | required | adequate | [read] 项目范围清晰：填充既有模板非任意生成；有 PROJECT_OVERVIEW | 边界文档完善，够 T3 |
| Task intake | required | adequate | [read][test] analyze/need_info/rejected/ready 分支完整；generate-flow 测模糊需求进澄清、越界拒绝 | 意图→追问/拒绝收敛健全 |
| Identity/session scope | required | adequate | [read][test] sessionId/sitecraft-session、workspace 上下文（request-context） | 会话/站点作用域有 |
| Agent loop | required | adequate | [read] analyze→confirm→execute 编排，多轮迭代 previousIntent | 是 Web 表单编排非自主 agent loop，够用 |
| Planner | lightweight | not-needed | — | 无自主规划需求（固定流水线） |
| Router | lightweight | adequate | [read] resolveTemplate/rankTemplateMatches 模板路由 + 兜底 | 模板匹配有白名单兜底 |
| Executor | required | strong | [read][test] execute 有 deadline/abort/partial/恢复/幂等；generate-flow 20/20 | 生成编排最强的一环 |
| Reflector | lightweight | weak | [read] 质量门 evaluateDraftQuality + 部分交付 recovery | 有质量复盘但无"自我修正迭代"闭环（可接受） |
| Terminator | required | **weak→adequate** | [read] 本次修复：收到合法 done 同步 setBusy(false)，finally 兜底；generate-flow 测"SSE 不关闭也完成"通过 | **刚修**：此前 busy 残留无终态 → 按钮卡死；现已有可靠终态复位 |
| Typed messages | required | adequate | [read] zod schema + SSE 信封契约匹配 | 两端契约已确认一致 |
| State schema | required | strong | [read] SiteDraft/history/revision/CAS 语义清晰 | 强 |
| Tool schema | required | adequate | [read] chat 白名单操作 + 槽位守卫 | 操作受控 |
| Artifact schema | lightweight | adequate | [read] draft/revision/history 有版本 | 够 T3 |
| Handoff schema | not-needed | not-needed | — | 无多 agent 交接 |
| Model layer | required | adequate | [read] prompt-registry 版本指纹、structured output、fallback(本地) | provider 版本可追溯 |
| Context assembly | required | adequate | [read] history cap(10)、extraContext、previousIntent 增量 | 有多轮上下文保留 |
| Working memory | lightweight | adequate | [read] 前端 React state + sessionStorage 恢复 | 够用 |
| Short-term memory | lightweight | adequate | [read] ACTIVE_GENERATION 恢复草稿 | 刷新恢复有 |
| Long-term memory | not-needed | not-needed | — | 产品不做 agent 长期记忆 |
| Tool layer | required | adequate | [read] 幂等/超时/取消/abort 已有 | 工具副作用受控 |
| Code/workspace sandbox | not-needed | not-needed | — | 只填充模板无代码沙箱需求 |
| Project ledger | lightweight | adequate | [read] .project-to-act 全套 | 项目有账本 |
| Evidence system | lightweight | strong | [read] E-xxx 证据 + test-results 截图 + 本报告 | 证据链完整 |
| Gate system | required | adequate | [read] 发布质量门/权限门已有 | 有发布门禁 |
| Workspace/artifacts | required | adequate | [read] 站点草稿/发布快照分离 | 够 T3 |
| Agent registry | not-needed | not-needed | — | 单 agent 产品 |
| Role matrix | not-needed | not-needed | — | 无多 agent |
| Task routing | not-needed | not-needed | — | 无 agent 路由 |
| Coordination state | not-needed | not-needed | — | 无多 agent 共享状态 |
| Conflict arbitration | lightweight | adequate | [read] revision/CAS 冲突接管 + 幂等 409 | 用户内容冲突有保护 |
| Handoff lifecycle | not-needed | not-needed | — | 无 |
| A2A boundary | not-needed | not-needed | — | 无 agent 间协议 |
| MCP/tool boundary | not-needed | not-needed | — | 无 MCP |
| Observability | required | adequate | [read] generation-record 存证、metrics、设置页健康指标 | 有观测但缺分析期阶段心跳（见问题） |
| Evaluation | required | **weak** | [read][test] 有单测 288 + 定向 E2E 20，但真实 provider 性能无样本、无 golden 回归套件 | 真实样本是文档阻塞项 |
| Guardrails/security | required | adequate | [read][test] 权限隔离测试、槽位守卫、脱敏 | strict 模式未接真实网关签名（已知） |
| Deployment/runtime | required | weak | [read] 预算常量 75s/78s 已配，但真实 P95 未校准 | 慢请求真实分布未采集 |
| Operations/runbook | required | **weak→adequate** | [read] 本次修复针对 stuck-run（busy 残留）；有 recovery/partial 恢复 | 卡死恢复刚补强 |
| Self-evolution | not-needed | not-needed | — | 产品无自我进化 |

## 缺失组件清单

| 优先级 | 缺失/弱组件 | 为什么重要 | 建议补齐方式 |
|---|---|---|---|
| P0 | Terminator（busy 终态复位） | **本次卡死根因**：analyze 收到 done 后 await reader.cancel 挂起 → busy 恒 true → 按钮禁用 | ✅ 已修：收到合法 done 同步 setBusy(false)，finally 兜底，`void reader.cancel()` |
| P0 | 追问轮 previousIntent 契约 | **"需求分析请求失败"根因**：need_info 部分意图回传被严格 schema 400 | ✅ 已修：previousIntent 宽松 schema（空串清洗+缺省），merge 兼容，coreSections 清洗 |
| P0 | 慢请求阶段可见性 | analyze 阶段（10–40s+）无中间进度，用户感知"卡死" | 服务端 analyze 发多段阶段 status（如"正在分析行业…/生成文案…"）+ 前端心跳兜底 |
| P1 | SSE 抗缓冲 | 无 `X-Accel-Buffering:no` 头，代理/中间层可能吞流尾 | sse-response.ts 补头 |
| P1 | need_info 第二轮健壮性 | 追问补全后若 previousIntent 缺字段可能 400 | 服务端 previousIntent 校验放宽或前端补全缺省字段 |
| P2 | 真实 provider 性能样本 | 预算 75s 无真实数据校准，阻塞 ready | 采集 12+ 脱敏样本 P50/P95（交接文档工作流 C） |
| P2 | golden 回归套件 | 改动靠人工发现回归 | 把"收到 done SSE 不关闭即完成"等固化为回归测试（已有一条） |

## 架构地图（链路模块）

| 模块 | 当前证据 | 评分 | 说明 |
|---|---|---|---|
| generate 页 analyze | [read][test] | adequate | done→分支健全，busy 复位本次加固 |
| generate 路由服务端 | [read][test] | adequate | 信封/幂等/deadline 清晰 |
| 幂等层 request-idempotency | [read] | adequate | TTL/409/replay 语义，客户端每次新 key |
| 模板匹配 rankTemplateMatches | [read] | adequate | 纯函数白名单打分，兜底稳定 |
| confirm 预览 iframe | [read] | adequate | 8s 超时降级 SiteRenderer，不阻塞 |
| 工作台 AI 对话/撤销 | [read] | adequate | 有 revision/CAS/历史 |
| 存证观测 | [read] | adequate | generation_records + 设置页指标 |

## 功能审查报告

| 功能 | 存在 | 完整度 | 主要问题 | 建议 |
|---|---|---|---|---|
| 一句话→意图 | 是 | 高 | 无 | — |
| 模糊→追问 | 是 | 中 | need_info 补全轮可能 400 | 服务端放宽/前端补字段 |
| 越界→拒绝 | 是 | 高 | 无 | — |
| 模板推荐+预览 | 是 | 中 | powerai 等本地快照曾 404（并行会话已修 base 前缀） | 复验 |
| 整站生成 | 是 | 高 | 真实 provider P95 未校准 | 采集样本 |
| 局部重生成/补全 | 是 | 高 | 无 | — |
| 卡死自恢复 | 是（本次修复） | 中 | 见 Terminator | 加慢请求心跳 |
| 工作台 AI 改/撤销 | 是 | 高 | 无 | — |

## 关键问题

| 优先级 | 问题 | 为什么重要 | 建议修复 |
|---|---|---|---|
| **已修** | analyze 收 done 后 busy 残留卡按钮 | 确认页"生成"永远点不动 | ✅ busy 同步复位 + finally 兜底（本次改动） |
| **已修** | crypto.randomUUID 非安全上下文抛错 | 局域网 http 访问会同步崩 | ✅ newClientKey 降级（本次改动） |
| **已修** | 追问第二轮 previousIntent 空字段致 400 | 用户补全信息后报"需求分析请求失败"，无法建站 | ✅ previousIntent 改宽松 schema（空串清洗+缺省），merge 兼容；need_info 兜底 coreSections 去 hero（越界清洗） |
| 中 | analyze 阶段无中间进度 | 用户把慢当卡死 | 分阶段 status + 前端心跳 |
| 中 | SSE 无抗缓冲头 | 代理可能吞流尾 | sse-response.ts 补头 |
| 低 | 模板 iframe 外链 CDN 被墙 | 预览破旧/慢（非卡死根因） | 字体/图标自托管（可选） |

## 优化建议

| 优先级 | 建议 | 预期收益 | 成本 | 验收 |
|---|---|---|---|---|
| P0 | busy 复位不依赖 finally | 根治卡死 | 已做 | 真实浏览器 + Playwright 已验 |
| P1 | analyze 阶段 status 细化 | 消除"卡死"误判 | 低 | 观察 generate 页出现多段进度 |
| P1 | SSE 抗缓冲头 | 防流尾被吞 | 极低 | curl -N 走代理末字节到达 |
| P2 | 真实样本采集 | 校准预算、关 ready | 中(需 key) | 交接工作流 C |

## 下一步

1. ✅ 卡死已修，已在真实浏览器（锐科精密输入）+ 20 条定向 Playwright 验证走通。
2. 请你在真实 Edge 手动复测一次（硬刷新 Ctrl+Shift+R 确保新 bundle）确认无卡死。
3. 冻结并发改动后跑 Wave 2 全量回归（npm test / typecheck / build / 全量 Playwright）。
4. 决定是否处理 P1 慢请求心跳 + SSE 抗缓冲头。

> 本次为只读健康审查，除既定修复（app/generate/page.tsx busy 复位 + newClientKey）外未改动任何源码。
