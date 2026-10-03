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
