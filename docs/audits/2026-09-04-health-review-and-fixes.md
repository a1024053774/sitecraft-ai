# SiteCraft AI 全量审查修复报告（2026-09-04）

> 审查方式：agentops-awesome-list 健康检查（只读）+ 后续按建议修复
> 审查对象：全量工作区（HEAD `c20e2a1` 之后 67 文件 +4451/-680 + 131 未跟踪）
> 配套报告：`2026-09-04-full-template-slot-coverage.md`（并行会话，槽位接入视角）

## 体检结论（审查时）

- **判定**：risky（非 ready）
- **适用模板**：T3
- 核心链路可靠、单测 291/291 绿，但模板内容质量保护有静默空洞（空指纹）、新特性未闭环、测试资产污染。

## 审查任务书

- 范围：全量工作区（含并行会话同日改动，审查以当时状态为准）
- 必跑测试：`npm test` 291/291 ✓、`tsc --noEmit` ✓、generate-flow 41/42（1 失败已根因）
- 基线对照：`git diff c20e2a1`（feature 分支相对最近提交）
- 已知决策（不重审）：SSE 信封叠加字段、forge 注入层 Route B、SiteRenderer 移除、验收降档"功能实测即可"

## 发现的问题与修复

### P0-1：18 个 manifest demo 指纹全空 → 发布门禁残留检测静默失效
- **发现**：新接入的 18 个模板 manifest 全部 `contentSlots({})`，`demoFingerprints` 为空。`classifyDraftCoverage`/`detectTemplateDemoResidue` 对空指纹 `some()` 恒 false → 发布质量门拦截不了"模板自带的演示/占位内容"。
- **修复**：从真实页面采集证据（注入空草稿 → 桥跳过覆盖 → 读回可见 demo 文案），为 18 个 manifest 填真实指纹。
- **验证**：真机 5 模板（atlas/powerai/kindred/astrofy/shadcn-landing）注入空草稿后 `residualDemoSlots` 正确检出 hero/about demo。`[test]`

### P0-2：bridge 模板字面量漏 `${}` 插值 → ReferenceError（本次最重要的重构回归）
- **发现**：重构 preview route 时 `adapterSanitize.sections` 与 `adapter?.designTokenCss` 两个 TS 变量作为**裸文本**写进 bridge 脚本模板字面量，未 `${}` 插值。浏览器执行 bridge 时 `ReferenceError: adapter is not defined`。
- **触发面**：凡 draft 带 designTokens（「已填内容预览」弹窗路径）或 variant=published（离线导出路径）必崩。工作台不炸只因其 draft 无 tokens 且非 published。
- **连带**：real-template-export 双超时挂死的**真实根因**（此前误判为纯外网不可达）——published 变体 applyContent 必调 sanitize → 抛错 → applied 永不回报 → 30s 超时。
- **修复**：改 `${JSON.stringify(...)}` 序列化插值（数据服务端固化进脚本）。
- **验证**：弹窗测试 fail→pass；export forge/screwfast 双 ok:true（<7s）；generate-flow 20/20。`[test]`

### P0-3：`X-Sitecraft-Preview-Source` header merge-loss
- **发现**：HEAD 的 local-index 分支返回 `X-Sitecraft-Preview-Source: local-open-source-snapshot`，重构后统一 `previewHeaders()` 时丢失 → nextjs-landing-preview/shadcn-pro-preview 两条（并行会话新 spec 按 HEAD 行为断言）稳定失败。
- **修复**：`previewHeaders` 恢复该头，local/upstream 分支分别标记，4 个调用点补参。
- **验证**：nextjs-landing-preview fail→pass。`[test]`

### P1：export 外网 fetch 无超时
- **发现**：`buildOfflineHtml` 内联资源的 fetch 无超时，不可达外网主机（github/twitter 等被墙）会让整个导出挂死。
- **修复**：`resourceFetch` 统一 8s `AbortSignal.timeout`（防御层；export 已由 P0-2 根治）。
- **权衡**：跨域资源超时后被跳过（不内联），离线文件完整性打折——按"功能基本实现"验收标准可接受，后续可补重试/降级内联。`[read]`

### P1：诊断/外网 spec 混入默认回归
- **发现**：coverage-probe（0 断言）/coverage-scan（仅打印）/real-template-export（依赖外网）进默认 `npx playwright test`，全量回归有噪音且必挂。
- **修复**：`playwright.config.ts` 加 `testIgnore` 排除 3 个；仍可显式 `npx playwright test <file>` 运行。`[read]`

### P2：ai-retry 测试覆盖净损失
- **发现**：`tests/ai-retry.test.ts` 相对 HEAD 删掉了超时重试的核心断言（timeout→retry→success、双超时返回），只剩 attempt-count 测试（实现未变但回归保护没了）。
- **修复**：恢复 4 条端到端断言（timeout 重试成功/双超时/抛错归一为 timeout/4xx 不重试）。`[test]`

### P2：design-tokens spec 陈旧 locator
- **发现**：3 条设计变量视觉验收期望 `.workspace-preview`/`.rendered-site`，产品已移除 SiteRenderer 降级（与 workspace.spec 33 同决策）。
- **修复**：locator 对齐 `.preview-stage`。4/4 过。`[test]`

### P2（审查后补做）：SSE 缺抗缓冲头
- `sse-response.ts` 的 `SSE_HEADERS` 补 `X-Accel-Buffering: no`（generate/chat 共用，一处全覆盖），防反代缓冲吞流尾。SSE 测试 5/5 过。`[test]`

## 验证汇总

| 套件 | 结果 |
|---|---|
| `npm test` | 295/295 ✓（含 ai-retry 新增 4 条）|
| `tsc --noEmit` | 0 错误 ✓ |
| generate-flow | 20/20 ✓ |
| real-template-export | forge/screwfast 双 ok:true ✓ |
| design-tokens-visual | 4/4 ✓ |
| nextjs-landing-preview | ✓ |
| 全量默认 Playwright | **64 过 4 挂**（4 挂全为移交项）|

## 移交项（未修，有归属）

| 项 | 归属 | 说明 |
|---|---|---|
| access-isolation.spec | 并行会话 WIP | 期望 `x-sitecraft-*` 权限头，API 未实现该特性；需并行会话实现或砍断言 |
| shadcn-pro-preview（原貌页 `.grid` 样式）| 并行会话新 spec | 无草稿路径的样式应用断言失败，与桥修复无交集 |
| workspace.spec 321/345 | 既有已知 | 测试进程 store 隔离（交接文档工作流 B），需统一测试进程 `SITE_STORE` |
| analyze 慢阶段分步进度 | 未竟优化 | 慢请求感知问题（卡死 bug 已修，10-40s 等待仍无中间进度）；成本低-中，未做 |
| 真实 provider 性能样本 | 未竟优化 | 75s 预算无数据校准，ready 主要阻塞；需真实 key 采集 P50/P95 |

## 审查后桥脚本健康确认

bridge 模板字面量内已无裸 TS 引用（3 处剩余均为合法 `${}` 插值：`${adapterHeroFn}`/`${adapterServicesFn}`/JSON 序列化数据）。`[read]`

> 除上述修复外未改其他源码；本报告为审查+修复产物存档。
