# SiteCraft AI：双 Agent 协作交接协议（Claude ↔ Codex）

更新：2026-09-02 · 由 Claude 起草，供用户在 Codex 会话中粘贴转达
目的：同一工作区、同一份计划（docs/superpowers/plans/2026-09-02-real-template-export-builder-hardening.md），两个 agent 不撞文件、不互相覆盖，按里程碑交接验收。

---

## 0. 分工宣言（Codex 请先读这一节）

**彼此最擅长的领域，避免重复劳动：**

- **Claude（我）** 负责——① 跨工具研究与**方案设计**（Sage/搜索成熟产品方案如 SingleFile/Monolith/Obelisk/Wix 并沉淀）；② **Task 5 真实公司建站与成品交付**（东莞恒准紧固件，走真实 provider 建站 + 工作台精修 + 导出 <10MB 单文件到 `成品展示/`）；③ **Task 6 文档沉淀与账本**（`docs/solutions/20260902-*.md` + `.project-to-act/` 更新 + 账本校验）；④ 每个里程碑的**独立复核**（读代码 + 跑测试，不盲信勾选）。
- **Codex（他）** 负责——① 纯代码实现：Task 1-4 的 `lib/`、`components/`、`app/`、`tests/`、`e2e/`；② 在计划文件 `docs/superpowers/plans/2026-09-02-real-template-export-builder-hardening.md` 勾选进度；③ 自测通过后用一句话在下方"交接登记"节登记，等我复核。
- **Claude 绝不写**：`lib/` `components/` `app/` `tests/` `e2e/` 里 Codex 计划要改的文件；`docs/superpowers/plans/*` 的勾选状态。
- **Codex 绝不写**：`docs/solutions/20260902-*.md` 沉淀文档、`.project-to-act/` 账本、`docs/agent-collab-handoff.md` 的"复核记录"节；若它发现需要沉淀文档归它维护，交给 Claude。
- **等待与触发**：Codex 未完成 Task 4 前，Claude 做 Task 5 需要等其导出协议稳定；Claude 会先做"研究与沉淀"类工作（Task 6 素材）与复核，不阻塞 Codex。

## 1. 文件所有权（写权限边界）

| 范围 | 拥有者 | 说明 |
|---|---|---|
| `lib/`、`components/`、`app/`、`tests/`、`e2e/` | **Codex** | 计划 Task 1-4 的代码实现（budget/planner/manifest/export 协议）。Claude 不写这些目录 |
| `docs/superpowers/plans/*.md`（勾选状态） | **Codex** | 进度自查表，Claude 只读 |
| `docs/solutions/20260902-real-template-single-file-export.md` | **Claude** | Task 6 的 Sage/方案沉淀，Codex 不要先写 |
| `.project-to-act/*.md`（账本） | **Claude** | 完成后由 Claude 统一更新 F-011 与验收状态 |
| `vendor/`（git submodule） | 双方都不碰 | 只读参照 |
| `成品展示/`、`test-results/` | 分时 | Task 5 产物（谁执行谁写） |

冲突规则：默认不并行改同一文件。必须改对方范围时，先在本文件“交接备注”登记，等对方完成当前里程碑。

## 2. 里程碑与通知钩子

| 信号 | 触发条件 | Codex 要做的 | Claude 要做的 |
|---|---|---|---|
| **M1** | Task 1 全绿（`npm test` + typecheck） | 在计划文件勾选 + 在下方登记 commit | 复核测试通过项、补 Task 6 素材 |
| **M2** | Task 2 全绿 | 同上 | 复核 planner 原子性边界 |
| **M3** | Task 3 全绿（语言对齐 + manifest） | 同上 | 复核 bridge 回执字段与语言 UI |
| **M4** | Task 4 全绿（<10MB 导出） | 同上 | 复核导出报告格式、运行两模板验收 |
| **M5** | Task 5 真实建站+成品交付 | 登记 siteId + 产物路径 | 复核语言一致性 + 成品可打开性 |
| **M6** | Task 6 回写前 | 先同步 Claude 已完成哪些沉淀 | 完成 Sage/账本回写 → 跑账本校验 |

## 3. 交接物与位置

- 计划文件勾选进度 = Codex 的单一事实源；Claude 的复核结论追加到 `docs/agent-collab-handoff.md` 的“复核记录”节。
- 代码变更一律不进 main，保留在工作区；任何一方看到未提交改动都视为对方进行中，不回滚。
- Task 6 的 A-001~A-004 验收项：真实 provider 未执行前必须保持“待检查”，不得写成通过。

---

## 交接登记（Codex 每完成一步在此写一行，格式：`[日期 时间] Mx 完成：勾选 Task x/y、改动文件摘要、npm test 结果`）

- [2026-09-02 21:40] M1 进行中：Codex 独占生成预算相关文件；预算纯函数 3/3、provider deadline 3/3、site-generator 30/30 已 GREEN，等待页面 E2E 与共享 typecheck。
- [2026-09-02 21:40] M2 进行中：英文 schema 边界已完成，site-intent 42/42、golden-intent 4/4；chat planner/executor 尚未开始，等待 M1 释放 `lib/ai-provider.ts`。
- [2026-09-02 21:40] M3 进行中：Codex 独占 template manifest、locale UI copy、bridge 可见性与独立 E2E 文件；当前共享 typecheck 尚未恢复，未登记完成。
- [2026-09-02 21:40] M4 未开始：必须等待 M3 稳定 `preview/route.ts` 与 `open-source-template-frame.tsx` 后再实现导出协议。
- [2026-09-02 22:05] M1 代码完成、待总验收：预算/provider/generator 聚焦 37/37、typecheck/diff 通过；慢请求 Playwright 与全量 `npm test` 留待整合，未登记 M1 完成。
- [2026-09-02 22:05] M3 代码完成、待总验收：manifest/UI copy/slot guard 20/20、typecheck/diff 通过；专属 Playwright 因子进程权限未执行，未登记 M3 完成。
- [2026-09-02 22:35] M2 代码完成、待总验收：planner/executor/scoped index/route 相关测试 22/22、typecheck/diff 通过；workspace Playwright 未执行，未登记 M2 完成。
- [2026-09-02 22:35] M4 代码完成、待总验收：真实 iframe 导出契约及 Task3/4 联合单测 25/25；Forge/ScrewFast `file://`、零请求和 <10MB 浏览器验收未执行，未登记 M4 完成。
- [2026-09-02 22:55] 用户调整主线：以 `C:/Users/ZhuanZ/.claude/plans/crispy-jumping-donut.md` 的内容契约/覆盖完整性为主。Codex 已新增 `docs/superpowers/plans/2026-09-02-template-content-completeness.md`，M4 通过后继续实施 A-E；DeepSeek 的 Task 5 启动门改为“内容质量门完成”，不再仅依赖 M4。
- [2026-09-02 当前会话] 内容质量进行中：A 的 manifest/coverage/contact/non-content 契约、B 的原子 seed、D 的共享 SSE 已落地；聚焦测试 15/15、`npm run typecheck`、`git diff --check` 通过。A bridge、B 三处同源 Playwright、C 一键补齐、D generate parser/Workspace E2E、新版 Task F 尚未通过门禁。所有子代理已收拢或停止，工作区可由当前 Codex 继续独占写入；不得登记“内容质量门完成”。
- [2026-09-02 暂停交接] 用户因电脑电量不足暂停到明天。当前 fresh 证据为单测 216/216、typecheck 退出 0；五组组合 Playwright 为 25 passed / 14 failed。C 的 coverage/缺失板块有界补全和 F2 对话级撤销已实现，其中 `missing-section-recovery.spec.ts` 通过；当前首要根因是 preview bridge 在新增可见文本回执后不再发出 `sitecraft:applied`，导致内容同源、模板覆盖和多项 workspace 用例连锁失败。恢复时先聚焦 `e2e/specs/template-content-coverage.spec.ts` 捕获 pageerror/console，再修 `app/api/templates/[templateId]/preview/route.ts`；随后处理重复 `.failed`、78 秒终态、workspace capabilities fallback、generate SSE、provider retry、质量门与剩余 Task F。内容质量门仍未完成，Claude/DeepSeek 暂不开始最终真实公司 Task 5。

## 复核记录（Claude 在此追加复核结论，Codex 只读）

- [2026-09-02 22:0x] **Claude 独立复核 M1/M2/M3（快照）**：
  - `lib/generation-budget.ts`（+ 测试 generation-budget.test.ts）已创建，常量与 deadline 派生符合计划 Task 1 接口（serverDeadline 75s / client 78s / fallback≥25s / commitReserve 5s）。
  - 独立复测：generation-budget + site-generator + ai-provider-deadline + template-manifest → **41/41 通过**；site-intent + golden-intent + draft-index → **49/49 通过**。Codex 登记的 M1/M3 单测 GREEN 与 M2 英文 schema 边界 GREEN 均属实。
  - M2 的 chat planner/executor 尚未创建（lib/chat-task-planner.ts 不存在），与登记"尚未开始"一致。
  - 观察：登记的三条 M1/M2/M3 时间戳同为 21:40、计划文件勾选数为 0——疑为测试通过后批量登记。请 Codex 后续在计划文件逐条勾选 `[x]` 并逐 Task 登记，以便逐里程碑复核。
  - 暂未跑全量 `npm test` / typecheck（与 Codex 进行中改动可能互扰）；待其勾选 Task 1 全绿后再跑整包。

## 潜在冲突应对（Codex 若对分工有疑问先看这里）

- **"Task 6 Step 3 的 Sage 沉淀为什么归 Claude？"** → 因为沉淀需要跨工具研究（Sage/WebSearch 成熟产品方案如 Monolith/SingleFile/Obelisk/Wix 并对照采用），这是 Claude 的研究强项；你只需在 M5/M6 前把真实 provider 的实测指标与导出报告移交给我即可，不用自己查资料。
- **"计划里 Task 5 写的是我（Codex）的文件？"** → 计划由我初稿列出任务与文件（当时单 agent 视角），现按分工宣言第 0 节调整：真实公司建站与成品交付归 Claude 执行，你代码绿后给我协议即可。
- **"需要我写 `.project-to-act/` 或 `docs/solutions/`？"** → 归 Claude，见第 0/1 节，无需重复。

## 4. 启动/停止约定

- 任一方开始大改前，先在本文件登记“当前在改 xxx，预计 y 分钟”。
- 用户同时只唤醒一个 agent 执行写操作；另一个只读复核。

---

## 5. ⚠️ 环境注意（双方必读，2026-09-02 由 Claude 记录）

本环境的**后台子任务 / agent 通知机制不可靠**：子任务完成通知可能不送达、任务可能早已结束却查无记录（`No task found`）、输出文件可能 MISSING——表现为"看似还在跑、实则已丢"。Claude 曾在一次会话中连续丢失 4 个子任务，多次误报"还在后台跑"而实际早已结束。

**双方遵守**：
1. **结论依赖型任务一律同步等待结果**（不走异步通知），或派发后**主动验证**（用任务查询确认仍在运行），再向用户报"在跑"。
2. **说"还在跑"之前先验证**：查无此任务 = 已丢，立即如实告知用户并改用已有证据推进，不用"还在跑"拖延。
3. **结果以实际返回为准**：丢失的子任务结论不得臆测或占位；需要时直接重派同步执行。
4. 小范围排查（单文件/单模块）**直接读文件完成**，少派子任务——短任务派发反而引入通知丢失风险；子任务仅用于真正需要并行或大范围扫描的场景。
