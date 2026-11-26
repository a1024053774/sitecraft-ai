---
id: T-241
title: 查清 industrial/indexgrid 伪元素未进修正轮依据并补齐 indexgrid 横向步骤分隔线规范
type: build
status: done
blocked_by: [T-238]
claimed_by: Antigravity
supersedes:
---

## What to build

在零模型调用下查清 [T-238](T-238-darkroom-indexgrid-re-eval-and-promotion.md) 中 `industrial/indexgrid`（`case-1`）为何在触发 `伪元素叠层无法核对实际底图` 后直接报 `error` 而未进入下一轮版面修正，并补齐 `indexgrid` 配方中的横向步骤分隔线规范：

1. **核实并写明 `industrial/indexgrid` 未进第二轮修正的代码链路与硬约束依据**：
   - 核查 `artifacts/t238/eval-4sites/eval/private/case-1/report.json`、`lib/code-site-layout-repair.ts` 与 `lib/code-site-repair.ts`：确认 `round: 0` 因 `已去掉属性 style-placeholder` 正常进入了第 1 次 `repair`（`11,847` token）；`round: 1` 三档扫描在 `home/768` 与 `home/1440` 检出横向 `<ol class="steps">` 的 `.steps li+li::before` 空分隔盒与第 `2.`～`5.` 项 `outside` `::marker` 文字盒相交，触发 `伪元素叠层无法核对实际底图`；
   - 证明并非 `T-187` 漏定位伪元素：`readCodeLayoutRepairs`（`lib/code-site-layout-repair.ts:95-106`）已精确解析并记录 `generatedPositions`（含 `pageId`、`width`、宿主 `path` 与 `pseudo: "::marker"`），随后按硬约束主动写入 `record.reason = "CSS 生成文字在 ...；当前无法核实伪元素声明修正的完整影响范围，本次拒收，不扩大到宿主或整页修改"`，由 `codeRepairFragments`（`lib/code-site-repair.ts:136-140`）确定性拒收终止；
   - 依据：[AGENTS.md:65](../../AGENTS.md#L65)（「失败位置沿用 T-173／T-187，无法核实修正范围即拒收，不新增修正入口」）与 [docs/project/spec.md:134,136,138](../../docs/project/spec.md#L134)（「也不新增伪元素修正入口」「当前版面修正无法核实伪元素声明的完整影响范围时明确拒收」「无法测量的原因随生成文字拒因保存；不开放额外修正范围」）；故不改动检查器与 `layoutRepairs` 拒收合同。
2. **补齐 `skills/site-code-indexgrid/SKILL.md` 横向步骤分隔线规范**：
   - 在 `skills/site-code-indexgrid/SKILL.md` 首段配方明确：横向步骤条的分隔线改用单元格自身的 `border` 或网格 `gap`（底色沟槽），不要用 `li::before` / `li+li::before`（避免非祖先/兄弟伪元素绘制盒与 `outside` `::marker` 相交触发无法测量拒收）；同步更新 [docs/project/mainline.md](../../docs/project/mainline.md)。
3. **红绿测试验证（零模型 token）**：
   - 新增 `tests/t241-indexgrid-divider-and-pseudo-boundary.test.ts`：先跑红测验证配方新增约束，再用真实隔离 Chrome 复现 `industrial/indexgrid` 的 `.steps li+li::before` 横向 `ol`，验证（a）`layoutRepairs` 确实定位并写出 `generatedPositions`（`::marker`）且 `codeRepairFragments` 按硬约束确定性拒收；（b）改用单元格自身 `border` 配 `column-gap` 分隔后三档（`375/768/1440`）全部通过测量与底线检查。本轮不为 `indexgrid` 单独重跑真实生成。

## Acceptance

- [x] 票据 Resolution 完整写明 `industrial/indexgrid` 在 `T-238` 的实际轮次、`readCodeLayoutRepairs` 定位记录与 `AGENTS.md:65` / `spec.md:134,136,138` 硬约束直接拒收依据
- [x] 先写红测 `tests/t241-indexgrid-divider-and-pseudo-boundary.test.ts`（保存红测日志），覆盖 `indexgrid` 配方分隔线禁令及隔离 Chrome 下 `li+li::before` 定位拒收与单元格 `border` 通过对照
- [x] `skills/site-code-indexgrid/SKILL.md` 与 `docs/project/mainline.md` 同步更新，不触碰检查器阈值或新增伪元素修正入口
- [x] `SITE_STORE=fs npm run build`（`.next <= 2GB`）、`npm run typecheck`、相关回归测试、`design_integrity.py`、`project_map.py status --root .` 及独立 `claude-sonnet-4-6` 只读审查全部通过

## Resolution

已完成（2026-11-26 06:01 EST，零模型 token）：

1. **`T-238` `industrial/indexgrid` 未进第 2 轮版面修正的根因与规则依据**：
   - 核实 `artifacts/t238/eval-4sites/eval/private/case-1/report.json`：`round: 0` 因 `已去掉属性 style-placeholder` 实际进入了第 1 次 `repair`（`11,847` token）；`round: 1` 三档扫描在 `home/768` 与 `home/1440` 捕获 `.steps li+li::before` 绘制盒与 `2.`～`5.` 项 `outside` `::marker` 文字盒相交，产出 16 条 `伪元素叠层无法核对实际底图`。
   - **并非 `T-187` 漏定位伪元素**：`lib/code-site-layout-repair.ts:95-106` 的 `readCodeLayoutRepairs` 已匹配 `/(?:::before|::after|::marker)$/` 并把 `{ pageId, width, path, pseudo: "::marker" }` 写入 `record.generatedPositions`，随后按规则显式赋 `record.reason = "CSS 生成文字在 ...；当前无法核实伪元素声明修正的完整影响范围，本次拒收，不扩大到宿主或整页修改"` 并早退；`lib/code-site-repair.ts:136-140` 读到 `repair.reason` 后确定性抛出拒收（且本例冲突绘制盒位于兄弟规则 `.steps li+li::before`，即便放开 `li` 或 `::marker` 也无法在不扩大范围的前提下安全覆盖非祖先伪元素规则）。
   - **硬约束依据**：`AGENTS.md:65`（「失败位置沿用 T-173／T-187，无法核实修正范围即拒收，不新增修正入口」）及 `docs/project/spec.md:134,136,138`（「也不新增伪元素修正入口」「当前版面修正无法核实伪元素声明的完整影响范围时明确拒收，不开放宿主或整页改写」「无法测量的原因随生成文字拒因保存；不开放额外修正范围」）。因此保持检查器与修正边界不变。
2. **配方补齐与真实 Chrome 验证**：
   - 更新 `skills/site-code-indexgrid/SKILL.md` 首段与 `docs/project/mainline.md`：明确横向步骤条分隔线改用单元格自身 `border` 或网格 `gap`（原生 `ol` 的 `outside` `::marker` 在 `ol` 设实色底与 `>=36px` `column-gap`、`li` 透明底配 `border-right` 或顶边线，避免相邻 `li` 实色底与 `outside` `::marker` 重叠触发 `visitor-layout-scan.js:455-462` 的 `独立叠层无法核对实际底图`），禁用 `li::before`、`li+li::before` 或 `li::after`。
   - 红绿测试证据：`artifacts/t241/red-test.log`、`artifacts/t241/red-recipe-only.log`（红测）→ `artifacts/t241/green-tests.log`（`tests/t241-indexgrid-divider-and-pseudo-boundary.test.ts` 2/2 + `tests/t227-style-recipes.test.ts` 9/9，共 11/11 全绿）、`artifacts/t241/typecheck.log`（`0` 错误）、`artifacts/t241/build.log`（`.next` `842.99 MB <= 2GB`）、`artifacts/t241/design-integrity.json`（`findings: []`）。
3. **独立跨模型只读审查**：Antigravity `claude-sonnet-4-6` 会话 `f0166aee-2dc0-4b96-a61f-671d2d697a4e`（`artifacts/t241/claude-review.txt`，`MODELS_USED=["claude-sonnet-4-6"]`）给出 `Verdict: PASS`。
