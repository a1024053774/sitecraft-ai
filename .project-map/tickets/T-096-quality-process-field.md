---
id: T-096
title: 质检流程（有序步骤）：草稿字段到页面
type: build
status: open
blocked_by: []
claimed_by: field-build
supersedes:
---

## What to build

T-078 第二批。按 T-079 / T-081 打通的同一模式做「质检流程」：`content.qualityProcess` 有序步骤列表，每步有稳定 `id`、标题 `{zh, en}`、说明 `{zh, en}`（可为空）。顺序就是资料里的先后，模型不重排、不补步骤。

- 只有注塑资料有（「质检流程：来料检验（树脂批次与嵌件尺寸）；试模后首件全尺寸检测；过程巡检每 2 小时抽检；外观与功能全检；出货抽检并附检测报告。」）；工业、外贸没有时整块不出现，不把「认证」「加工能力」里的内容搬过来冒充步骤。
- 事实核对沿用 T-079 / T-081 的实现（去指令后同一句的完整分句或原文连续子串；英文按 T-082 只核数字、代码、单位），不另写一套。
- 与现有「认证」「加工能力」「设备」的关系写进 spec：质检流程是有先后的检验动作，设备是机器（「三坐标测量机」归设备），同一事实不在两处重复。
- operation（整组替换 / 单条更新 / 删除 / 调整顺序若需要）、撤销、`check-published` 事实覆盖、默认朴素布局（四个样子 token、唯一槽位、无条目隐藏）、文档同步，要求同 T-081。worktree 补齐 vendor 后全量 0 失败，「已知失败」要逐条核对原因。

布局由 sonnet-blocks 之后按流水线另做，不在本票。

## Acceptance

- [x] 测试先写、改动前先失败（行为级）：步骤顺序保持资料顺序；资料没有质检流程时区块不出现；同一事实不在质检流程和设备 / 认证里重复
- [x] 真实 DeepSeek：三份模拟资料各走一次生成，记录写入的步骤（`artifacts/t096/`），没有编造步骤或数字
- [ ] 三家 `check-published` 中英文三档通过；`npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收

## Resolution

2026-10-03，执行提交 `264c953` 已完成质检流程纵向切片，等待 Astra 代码审查与 Claude 验收：

- `content.qualityProcess` 是有序稳定 id 条目（双语 `title`、可空双语 `body`），`replace_quality_process` / `update_quality_process` / `remove_quality_process` / 明确的 `reorder_quality_process` 均走 `commitOperations`，inverse 恢复 `englishReady` 和顺序。
- 事实核对复用 T-079/T-081 的去指令同句分片、英文数字/代码/单位机械规则；质检标题和说明必须来自同一「质检流程」分句，和设备/认证事实重复时整步拒绝；没有条目时整块隐藏。
- 区块库新增四样子共用的默认「质检流程」行布局，加入 `sectionOrder` / `hiddenSections` / adapter sections / family-modules probe / token kit；每一步标题和非空说明在预览页各只有一个槽位。
- 先写的行为红证据在 `artifacts/t096/red-parent-quality-process.txt`：父提交上 5 项加载成功但以行为断言失败（schema 字段、operation、事实核对、published-facts、区块隐藏/槽位）；修复后 `node --test --experimental-strip-types tests/quality-process.test.ts` 5/5 通过。
- 真实 DeepSeek 当前提交完整三站结果在 `artifacts/t096/real-industrial.json`、`real-export.json`、`real-molding.json`、`summary.json`（`commit: 264c953`）：工业/外贸无质检步骤；注塑写入 5 步，顺序与资料一致，无资料外数字。模型 schema 失败的完整失败轮次保存在 `artifacts/t096/retry-264c953-failure-1/`，没有静默改写。
- `SITECRAFT_BASE=http://127.0.0.1:3061 CHROME_PATH=... node scripts/check-published.mjs --out artifacts/t096/published-check-264c953 10c435c2-912d-44d7-a2e4-d65f3d00b4da de79633a-b962-450e-9453-660b34e209ac b256d804-669e-4285-acd2-f09b83dae1f2`：9 个中英文三档组合通过，三站事实缺失均为 0；截图与报告在该目录。
- `npm run typecheck`、`npm run build` 通过。唯一一轮全量 `npm test` 为 669/670：`tests/workspace-interaction.test.ts` 的 motion 场景在高负载下失败（原始日志 `artifacts/t096/npm-test-final-264c953.txt`）；按协调规则未修改测试，低负载单独重跑为 5/5（`artifacts/t096/workspace-interaction-rerun-264c953.txt`），不能把原全量失败抹掉。

### 验收前复核（2026-10-03）

- 失败轮的用户可见结果已核对：工业和注塑在需求对齐的「选择」请求中收到 `invalid_output`，草稿没有提交；界面显示「模型返回的方案无法安全校验，草稿没有修改。重新提交或缩小需求范围；未经校验的内容不会写进页面。」当前问题卡仍保留，可重新选择/提交。确认请求随后也以 error 结束。
- 这不是「20台」逐字核对拒绝：当前提交和父提交 `7f0f4b4` 对 `20台` / `20 units` 的 `replace_commercial_terms` 都是 accepted、`rejected=[]`（`artifacts/t096/grounding-current-07827d6.json`、`grounding-parent-7f0f4b4.json`）。失败轮的完整模型 JSON 在整体 Schema 校验阶段被拒绝；过滤后的调用记录只剩商业条款/设备/质检 operation，不能把过滤结果当成拒绝原因。原始字段证据见 `artifacts/t096/repro-schema-fields.txt`。
- 复现统计：当前 `264c953` 同资料工业/注塑各 3 次，6/6 最终在第二次尝试返回 `edit`，但 6/6 第一次响应都发生整体 Schema 类型错误；父提交 `7f0f4b4` 工业 3/3 最终在第二次尝试成功，注塑 3 次均遇 DeepSeek HTTP 402（余额/额度耗尽，未拿到模型响应）。这说明该失败是主线已有的结构化输出稳定性问题，T-096 没有引入，也没有用质检核对放宽或重试掩盖；暂不改产品路径，待负责人另开 provider/schema 稳定性票。
- 汇总已重新生成：`artifacts/t096/real-*.json` 和 `summary.json` 现在直接包含 `qualityProcess`；工业/外贸为 `[]`，注塑为 5 步（与持久化草稿和页面一致）。失败分析与复现目录：`artifacts/t096/failure-analysis-264c953.json`、`repro-current-264c953/`、`repro-parent-7f0f4b4/`。

### Astra P1/P2 返工（2026-10-03）

- `qualityProcessEnglishMatches` 现在复用 `commercialUnitsMatch`；共享单位表补了资料实际使用的「小时 ↔ hour/hours/hrs/h」，并收紧中文「件」只在数字单位上下文计为 piece，避免「注塑件/嵌件」词内误判。数字相同但「每 2 小时抽检」译成「Sample every 2 days」会拒绝。
- `renderQualityProcess` 现在只有在 `data-sitecraft-section="qualityProcess"`、唯一的 `data-sc-block="qualityProcess"` 实体、唯一 grid marker 且变体为 `rows` 时才渲染；marker-only/无效变体不写 DOM、不写 `applied`。未改 `renderEquipment` 或 `renderCommercialTerms`。
- 先写红证据：[red-quality-unit-before-fix.txt](../../artifacts/t096/red-quality-unit-before-fix.txt)、[red-quality-marker-before-fix.txt](../../artifacts/t096/red-quality-marker-before-fix.txt)；修复提交 `46278a5` 后 quality/equipment/commercial-terms **42/42**，quality-process **7/7**，`npm run typecheck` 通过；全量 `npm test` 为 **675/675**，日志 `artifacts/t096/npm-test-t096-p1.txt`。
- T-096 真实 DeepSeek 生成与失败分析的运行时提交统一绑定为 `264c953`（`summary.json`、`failure-analysis-264c953.json`、本票文字一致）；`4474076`、`07827d6`、`4574089` 仅为后续 T-096 文档记录。注塑父提交对照已在充值后补跑，见下方 `7f0f4b4` 证据。

### Astra r4 单位矩阵收口（2026-10-03）

- 单位短语全表：[artifacts/t096/unit-phrases.md](../../artifacts/t096/unit-phrases.md)；覆盖三份模拟资料中实际出现的数字单位、每/按单位和业务短语（年产约 180 套、月注塑能力约 600 万件等），词内名词与编号明确排除。
- 表驱动矩阵在 `tests/unit-matcher-matrix.test.ts`：每个共享单位覆盖数字邻接、每/按/per、词内用法、裸单位、错位单位，并单列资料业务短语；当前矩阵和相关测试共 49/49 通过。
- 提交 `5689a8d` 将 `commercialUnitsMatch` 收口为上下文单位规则：去掉词内豁免表和月/年宽窗口；单位只认数字邻接或每/按/per，补 per set、每万件/每吨/每千克及两条模拟资料业务短语。T-079/T-081 的既有商业条款、设备映射仍通过。
- 父提交 `d03e6b4` 的矩阵红证据：[red-unit-matrix-before-fix.txt](../../artifacts/t096/red-unit-matrix-before-fix.txt)；最终 typecheck 通过，全量 `npm test` **690/690**（`artifacts/t096/npm-test-t096-r4-final.txt`）。

### Astra r2 修复（合并主线后，2026-10-03）

- 在 `46278a5` 的行为红证据基础上，提交 `466d480` 修正共享单位规则：小时只接受数字紧邻的「小时/时」，英文 `h` 只接受同一数字上下文；「注塑件/嵌件」只作为词内名词豁免英文复数词，`每件/按件` 和数字件仍必须映射到 `piece(s)`。
- 新增负例：`同时检查` / `Check h`、`每件单独包装` / `Packed separately`；商业条款保留现有件↔piece 约束，设备保留 t↔kg 拒绝映射。红证据：[red-unit-lexical-before-fix.txt](../../artifacts/t096/red-unit-lexical-before-fix.txt)。
- 合并主线 `f540ff9` 后全量 `npm test` 为 683/684，唯一 T-099 motion 偶发；低负载单测通过。修复后最终全量 `npm test` **687/687**，日志 `artifacts/t096/npm-test-t096-r2-final.txt`；相关 46/46、typecheck 通过。

### Astra r3 修复（2026-10-03）

- 父提交 `466d480` 红证据保存在 `artifacts/t096/red-zero-parts-before-fix.txt`：`零件检查` / `Part inspection` 被错误拒绝。
- 提交 `d03e6b4` 将共享 `commercialUnitsMatch` 改为上下文单位规则：单位只在数字紧邻或 `每`/`按`/`per` 上下文中计入；英文 `part`、`component` 等词内名词不再触发 piece，数字件/每件/按件仍严格映射。小时规则保持数字邻近约束，已有万件、天、周、月、年、台、套、t、kg 映射继续通过。
- 新增正/负例与共享回归：零件/Part 通过，同时/Check h 拒绝，每件/Packed separately 拒绝，商业条款和设备的既有单位错配仍拒绝；相关测试 **47/47**，typecheck 通过。最终全量 `npm test` **688/688**，日志 `artifacts/t096/npm-test-t096-r3-final.txt`。

### 充值后的父提交对照（2026-10-04）

- 在主线父提交 `7f0f4b4` 的临时 detached worktree 上，对注塑资料直接结构化生成 3 次；命令、提交 SHA、密钥处理、每个 attempt 的原始请求/响应和 Schema 判定在 [artifacts/t096/real-parent-7f0f4b4/](../../artifacts/t096/real-parent-7f0f4b4/)。三次 HTTP 均为 200，第一次 Schema 通过 1/3；一次第二次尝试通过，另一次两次均失败并向用户返回 `invalid_output`。
- 失败字段与离线结论一致：`products[*].sku`、目录 `intro`、设备 `spec` 的形状错误；不是质检事实核对或单位核对拒绝。没有修改代码、没有新增重试；该父提交对照已完成但显示主线旧版第一次通过不稳定，票据总验收仍 **INCOMPLETE**。
