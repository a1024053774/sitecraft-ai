# 会话交接快照（2026-09-13 · 契约治理→三入口体验线）

> 新会话读本文件 + 队列文档即可原位续起，不依赖旧聊天上下文。
> **当前压在 DeepSeek 手上、未回报的指令原文**：队列文档最后一节
> "当前在手任务（= 0.6 复测裁决）"——整块可直接原样重发，无副作用。

## 双线现状

**线一：契约治理（已结项）**——基线/普查/改名/别名层四阶段全部完成，
总收口报告：`docs/plans/2026-09-12-contract-governance-final-report.md`。

**线二：三入口体验收口（进行中）**——执行队列与全部批次提示词：
[`docs/deepseek-execution-queue.md`](deepseek-execution-queue.md)（含"动态更正"与
0.6 裁决记录）。v2 总纲：`docs/build-ux-master-prompt-for-deepseek.md`。

## 协作模式（固定）

用户让 DeepSeek 在仓库执行，千问独立复审（复跑测试、回插坏样本验证门禁、
核对 commit 范围、必要时真开浏览器实测），通过才放行下一批。
裁决话术直接给"可粘贴块"。纪律见 AGENTS.md 契约军规 11 条 + 附则
（A1 假实验、A2 假测量——时序也算）。

## 进行到哪：0.6 执行完毕，**待关账裁决**（2026-09-13 晚 · 最新）

1. **本批全部落地**（DeepSeek 侧执行，工作区就绪、未提交）：
   - **四条 shadcn-landing2 实例**已实例级 `test.skip`：`shadcn-pro-preview`、
     `template-content-coverage`、`template-language-bridge`、**`coverage-scan`（本批新挖出的第 4 个受害实例）**；
   - `probe-empty-rate.mjs` 带退出码 + 收编 `test:e2e:strict`（三道护栏：
     理由必填入日志 / 限期 T-13 / 不得作默认路径）；
   - **修好 strict 入口**（此前从未真跑起来过，三大根因见队列「执行发现」）；
     首跑 **8 passed (3.4s)**，并自证默认全套仍排除（108 条不含 strict spec）；
   - `next-env.d.ts` 已还原；`tsc --noEmit` = 0 错。
2. **最终 3 连跑（环境干净后唯一有效的一次）**：
   `RUN1 98 passed/8 skipped/2 failed · RUN2 100/8/0 · RUN3 100/8/0`。
   RUN1 两条 = `generate-flow:283`（时序型偶发，现场完整保留），
   **已登记 T-16 ②**、随 T-16 移交 T-13 批——**不阻塞关账**（用户 2026-09-13 裁决）。
3. **待办**：① 关账裁决（千问，依据 = 上表 + T-16 登记 + 四条隔离）；
   ② B3 影响分析报告已交（`docs/plans/2026-09-13-b3-impact-analysis.md`），
   **5 个待裁决问题在队列末节**；③ 提交时机与范围（工作区 8 改 9 新，内容就绪）。
4. 关键防误读：**全套绿 ≠ T-14 已修**（本轮实证：两次 3 连跑结果不同）；
   判据是 `probe-empty-rate` 归零。

## 待办台账（glossary 待办区为准）

T-13 生产鉴权两端贯通（前端带头+后端转发，含登录态设计，先方案后码）·
T-14 shadcn-landing2 白屏疑云（**已隔离·待 T-13 修复**；**红率调研移交 T-13 批**）·
T-15 背景式 hero 点选不可达 ·
T-16 跨用例状态污染（**已移交 T-13 批，由红率数据定夺撤销或坐实**）·
**T-17 dev 口径可见 `[object Object]`（复审新登记）** ·
T-1/T-2/T-3/T-4/T-10/T-12 慢性项 · D-2/D-3 排 B4 后 · **B3 宽修：第一批只读影响分析待交** · B5 流式体验 ·
B6 板块再生成 · 渲染回检环/Recipe = 新迭代按需立项。

## 产品定义（一切取舍的依据）

durable+wegic 融合自助 SaaS；三入口（NL/截图/URL）都是设计内能力；
产出锚 22 真实模板原件；拼装器不进 NL 主链。见
`docs/PRODUCT-BASELINE.md` 与项目记忆。

## 环境备忘

PG 容器 5433（compose 已改映射，勿改回 5432）；e2e 全量约 5-6 分钟（复审实测 9.0m）；
npm test 基线 778；dev server 用户自管（3000）。

**复审残留（可直接复用，勿重建）**：
- `D:\sitecraft-verdict`：HEAD 工作树（纯 HEAD 源码；`vendor/` 用 junction 接到主仓），
  曾以 3211 跑 `next start` 做"工作区改动无关"对照。
- `e2e/scripts/probe-empty-rate.mjs`：**间歇率扫描器**（`node … 20 [URL]`），
  **已由用户裁决收编进 `test:e2e:strict` 入口，EMPTY≥1 非零退出**。
- 另：`probe-a2.mjs`（A2 解析器口径）、`probe-stability.mjs`（冷加载扫描）为一次性产物。
- **测 3210 前先查进程归属**（`wmic` 看命令行）——复审方曾测到 worktree 残留进程。
