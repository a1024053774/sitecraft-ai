---
id: T-243
title: 零 token 统计真实生成「确定性拒收、不进修正轮」比例与分类结论
type: build
status: closed
blocked_by: [T-242]
claimed_by: Antigravity
supersedes:
---

## What to build

按 [T-242](T-242-style-compositions-and-diverse-packs-direction.md) 第 3 项决定，在零模型调用、零检查器规则改动的前提下，从仓库现有全部真实任务记录（`.sitecraft-data/code-sites/*.json` 与 `artifacts/**/private/case-*/code-site.json`，按 `run.id` 去重并剔除替身/夹具调用）统计真实整站生成中因「确定性拒收、不进修正轮」而直接失败的比例：

1. **编写可重复执行的统计脚本 `scripts/audit-rejection-rates.ts`**：
   - 扫描全部真实生成任务（主口径：`kind === 'generate'` 真实模型运行，同时分别给出含外部网络/截断中断的全量分母与仅含已产出候选进入校验的有效生成分母；附带列出 `edit` 任务对照）；
   - 将每次真实生成终止态精确划分为：`passed-first-draft`、`passed-after-repair`、`external-or-interrupted`（HTTP/网络错误、输出截断、进程中断）、`exhausted-repair-rounds`（走满两轮修正仍未过底线）、`repair-reply-rejected`（已进入修正轮调用模型但返回空修改/越界而终止）、`deterministic-no-repair`（仍有剩余修正额度却因确定性拒收直接终止、未进下一轮修正）；
   - 对 `deterministic-no-repair` 按拒因类别分列：`pseudo-element`、`contrast-or-visual-effect`、`fact-protocol`、`identity-or-page-contract`、`repair-scope-unverifiable`、`other-deterministic`，并区分全历史、现行严门禁期（`>= 2026-10-20`）与近期配方轮次（`T-226+`）。
2. **输出客观报告与结论（`artifacts/t243/rejection-stats.json`、`artifacts/t243/rejection-stats.md`）**：
   - 只出统计数字、样本明细和结论，本票不改任何检查器或提交入口规则；
   - 根据实测比例判断是否高到值得讨论放宽：若确实偏高，按负责人指示另开一张 `open` 决定票列出具体数据与可选最小方案供负责人裁定。
3. **红绿测试验证**：
   - 新增 `tests/t243-rejection-stats.test.ts`，先跑断言级红测再实现通过，覆盖各拒因类别归类准确性、去重与替身剔除逻辑及真实数据统计完整性。

## Acceptance

- [x] 先写断言级红测 `tests/t243-rejection-stats.test.ts`（保存红测日志），覆盖伪元素、视觉效果对比度、事实协议、主体/页面合同、修正范围无法核实、修正回复无效、走满两轮修正及外部中断等全部分类与 `run.id` 去重逻辑
- [x] `scripts/audit-rejection-rates.ts` 零模型调用扫描 `.sitecraft-data/code-sites/` 与 `artifacts/` 真实任务记录，生成 `artifacts/t243/rejection-stats.json` 与 `artifacts/t243/rejection-stats.md`，按类别给出精确分子、分母、比例及是否需开决定票的结论（不修改任何检查器规则）
- [x] `npm run typecheck`、`tests/t243-rejection-stats.test.ts`、`design_integrity.py` 及独立 `claude-sonnet-4-6` 只读审查全部通过

## Resolution

已完成（2026-11-26 10:46 EST，零模型 token，零检查器改动）：

1. **样本与总体比例**（详见 `artifacts/t243/rejection-stats.md` 与 `rejection-stats.json`）：
   - 扫描 `397` 份站点快照（原始任务记录 `634` 条 → 按 `run.id` 去重 `387` 条 → 剔除替身/夹具 `111` 条 → **真实模型任务 `276` 条**，其中整站生成 `generate` **`129`** 条、外部/中断 `4` 条、**进入候选校验有效分母 `125` 条**）。
   - **全历史（`125` 次有效生成）**：通过 `119` 次（`95.2%`：首稿直接通过 `85` + 经修正轮通过 `34`）；走满两轮修正失败 `0` 次；已进入修正轮调用模型但因当时 UTF-8 乱码故障返回空 `replacements: []` 而拒收 `2` 次（`1.6%`，编码问题已修复）；**真正「确定性拒收、未进入修正轮」共 `4` 次，占有效生成 `3.2%`（占全量 `129` 次的 `3.1%`）**。
   - **现行严门禁期（`>= 2026-10-20`，有效生成 `18` 次） / `T-226+`（有效生成 `15` 次）**：未进修正轮的确定性拒收均为 **`2` 次**（分别占 `11.1%` 与 `13.3%`），另有上述已修复的编码空修补 `2` 次。
2. **按拒因类别拆分（未进修正轮的 `4` 次确定性拒收）**：
   - `pseudo-element`（伪元素生成文字/叠层无法核实修正范围）：全历史 **`2 / 125 (1.6%)`**，`T-226+` **`2 / 15 (13.3%)`** —— 其中 `bef9b944`（`packaging/darkroom`）系系统部件 `.sc-image-credits` 的 `summary::marker` 被污染（已在 `T-236` 根因隔离修复），`3f5dd749`（`industrial/indexgrid`）系横向步骤 `li+li::before` 碰撞 `outside` `::marker`（已在 `T-241` 配方层禁用）；
   - `contrast-or-visual-effect`（`T-199` 滤镜/遮罩/描边/首行变色无法测量拒收）：**`0 / 125 (0.0%)`**；
   - `fact-protocol`（严格函数/编号/二选一协议拒收）：全历史 **`1 / 125 (0.8%)`**（`2026-10-18` `cd1e9e19` 旧协议时期），**`T-210` 上线后为 `0 / 18 (0.0%)`**；
   - `identity-or-page-contract`（主体全名/漏页/写页格式拒收）：**`0 / 125 (0.0%)`**；
   - `repair-scope-unverifiable`（修正前节点定位/超上限拒收）：全历史 **`1 / 125 (0.8%)`**（`2026-10-14` `b14c0b3e`，`T-187` 结构化定位上线前），**`>= 2026-10-20` 为 `0 / 18 (0.0%)`**。
3. **结论**：没有任何一类硬约束呈现持续高发误杀（仅有的 2 例近期伪元素碰撞已分别在 `T-236` 系统隔离与 `T-241` 配方层解决），**无需放宽硬约束，不另开规则放宽决定票**。
4. **验证与独立审查**：红测 `artifacts/t243/red-test.log` → 绿测 `artifacts/t243/green-tests.log`（`3/3` 通过）、`artifacts/t243/typecheck.log`（`0` 错误）、`artifacts/t243/design-integrity.json`（`findings: []`）；独立 `claude-sonnet-4-6` 只读审查会话 `4f07c3fd-b3ba-42eb-a91b-9a46089d6b44`（`artifacts/t243/claude-review.txt`）结论 **`Verdict: PASS`**。
