---
id: T-237
title: darkroom 无实拍图成立配方、indexgrid 按内容选排法解绑与 DeepSeek 更新前置条件
type: build
status: closed
blocked_by: [T-236]
claimed_by: Antigravity
supersedes:
---

## What to build

在启动 `500,000` token 新账本评估前，核清模拟资料包实拍图现状，先写配方测试并捕获红灯，随后收紧 `darkroom` 与 `indexgrid` 两套 `pending` 风格配方、登记 `deploy/docker/README.md` 的 DeepSeek 更新前置探针说明，并放行预算网关的新评估目录（本票 `0` 模型调用）：

1. **模拟资料包实拍图核查结论（不伪造实拍标注）**：
   - 经逐一核对 [lib/simulated-packs.ts](../../lib/simulated-packs.ts)、[scripts/eval-new-route.ts](../../scripts/eval-new-route.ts) 第 66 行及 `fixtures/simulated-packs/*/manifest.json`（及 `p3i-photos/MANIFEST.md`）、`tests/fixtures/company-images/*/manifest.json`：全部 7 套模拟资料包均**无**标为企业自有、已授权的实拍图（`0/7`），所有准入图片均为公开许可的行业/题材配图（明确注明「非本厂实拍」/「非本企业实拍」/「不是该公司的实拍」）。
2. **`skills/site-code-darkroom/SKILL.md`（无企业实拍图也能独立成立，按资料组织结构）**：
   - 明确在**没有企业自有实拍图**（仅含授权行业/题材配图，或完全无图）时，暗房陈列配方同样独立成立——有行业/题材配图时可将其作为带微光细框与如实说明的暗面标本/灯箱配图嵌入对应内容或开场，亦可直接用深浅炭底层次、亮白大尺度标题、单一信号色标尺与等宽规格/业务展牌构成完整暗房首屏；零图站点同样靠暗面层次、字阶与展牌矩阵立住视觉，绝不留浅灰空图位、不伪造实拍归属；同时页头、首屏与后续区块按资料重心选择不同排法，避免两家公司落入同一双栏套路。
3. **`skills/site-code-indexgrid/SKILL.md`（保留粗黑字、外露格线、等宽索引，解绑固定骨架与顺序）**：
   - 保留瑞士索引核心识别特征（外露 `1px–2px` 高对比结构实线、粗黑展示标题、等宽编号/参数索引、表头检索栏、`border-radius: 0` 与三套 `>= 4.5:1` 子变体）；
   - 删除固定「一格放跨格大号黑体标题，邻格放目录索引摘要」的单一左文右框首屏规定，明确**首屏、步骤/流程、沿革**及动态/页脚均按资料内容形态与所选骨架选择不同网格排法，不再规定固定的区块顺序或固定的左右两栏结构。
4. **Windows Docker 更新前置条件与预算目录准入**：
   - 在 [deploy/docker/README.md](../../deploy/docker/README.md)「更新与备份」写明前置条件：下次更新 Windows 本机服务之前，必须先用真实 DeepSeek 接口跑一次 `submit_fact_review` 最小探针确认通过（本轮不跑），并同步 [README.md](../../README.md) 与 [docs/project/mainline.md](../../docs/project/mainline.md)；
   - 在 [scripts/t153-real-budget.ts](../../scripts/t153-real-budget.ts) 放行 `t237`、`t238` 预算目录供下一票 `500,000` token 账本使用。

## Acceptance

- [x] 修改 `skills/` 与 `deploy/docker/README.md` 前已在 `tests/t227-style-recipes.test.ts` 新增 `T-237` 断言并保存红灯失败日志（`artifacts/t237/red-recipes.log`）
- [x] 已核实 7 套模拟资料包 `0/7` 含企业自有实拍图并留档；`site-code-darkroom/SKILL.md` 保证无企业实拍图（仅行业/题材配图或零图）时独立成立且不伪造实拍标注
- [x] `site-code-indexgrid/SKILL.md` 保留粗黑字、外露格线与等宽索引识别特征，将首屏、步骤、沿革改为按资料内容选排法且不再规定固定顺序与位置
- [x] `deploy/docker/README.md` 已写明下次更新 Windows 服务前须先用 DeepSeek 跑一次 `submit_fact_review` 最小探针；`npm run typecheck`、配方与预算相关测试、`design_integrity.py`、`project_map.py status --root .` 及独立 Antigravity `claude-sonnet-4-6` 只读审查全部通过

## Resolution

- **修改摘要（`0` 模型生成 token）**：
  - [skills/site-code-darkroom/SKILL.md](../../skills/site-code-darkroom/SKILL.md)：针对全部 7 套模拟包均无企业自有实拍图（`0/7`）的事实，明确无企业自有实拍图（仅行业/题材配图或零图）时暗房陈列独立成立、不伪造实拍归属，且页头/首屏/流程/沿革随资料形态变排法。
  - [skills/site-code-indexgrid/SKILL.md](../../skills/site-code-indexgrid/SKILL.md)：保留粗黑字、外露 `1px–2px` 格线、等宽编号索引与表头检索栏，去掉固定左大字右索引框首屏锁，改为首屏、步骤/流程、沿革按资料内容选排法且不规定固定顺序和位置。
  - [deploy/docker/README.md](../../deploy/docker/README.md)、[README.md](../../README.md)、[docs/project/mainline.md](../../docs/project/mainline.md)、[scripts/t153-real-budget.ts](../../scripts/t153-real-budget.ts)、[tests/t227-style-recipes.test.ts](../../tests/t227-style-recipes.test.ts)：写明下次更新 Windows 服务前须先用 DeepSeek 跑一次 `submit_fact_review` 最小探针，同步活文档并放行 `artifacts/t237`、`artifacts/t238`。
- **验证证据**：
  - 修改前红灯：`artifacts/t237/red-recipes.log`（`RED_EXIT=1`）。
  - 离线校验：`npm run typecheck` 通过（`artifacts/t237/typecheck.log`）；`scripts/run-tests.ts` 运行 `t228`、`t153`、`t227` 共 `20/20` 通过（非浏览器 `6/6` + 浏览器 `14/14`，0 fail，`artifacts/t237/green-tests.log`）；`design_integrity.py --cwd . --base b8db9edc --format json` 无发现（`artifacts/t237/design-integrity.json`）；`project_map.py status --root .` 退出码 `0`。
- **独立审查**：独立 Antigravity `claude-sonnet-4-6` 只读审查会话 [01beadb9](conversation://01beadb9-fe33-4d49-a3e8-743da242a687)（宿主 `transcript.jsonl` 核实 `modelsUsed: ["claude-sonnet-4-6"]`，`artifacts/t237/claude-review.txt`）结论为 **`Verdict: PASS`**（0 发现）。
