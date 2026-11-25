---
id: T-228
title: 第一阶段（2/2）：评估集支持跨风格与全池「不雷同」盲评包及预算网关适配
type: build
status: closed
blocked_by: [T-226]
claimed_by: Antigravity
supersedes:
---

## What to build

落实 [T-226](T-226-style-diversity-direction.md) 第一阶段的评估与盲评工具链升级，解决现行评估只跑两个近似风格且仅在单风格内部比较、漏检「换风格仍像同模板」的问题（按最终 `T-226` 确认范围交付）：

1. **跨风格成对与全池归簇「不雷同」盲评包（`scripts/eval-set-report.ts`）**：
   - 在现有 `review/mixed`、`review/company`（保留向后兼容，可补充针对页头/首屏/底面/分隔线雷同的检查要点）和 `comparison-review` 之外，当评估矩阵包含 >= 2 种风格时，额外生成独立的 `review/diversity/` 盲评包：
     - **跨风格成对题（`crossStylePairs`）**：优先对同一家公司不同风格、以及不同公司不同风格配对匿名截图（含 1440 与 375），交评审判定 `sameTemplate: true/false`，并要求在 `reason` 中逐项比对页头形式、首屏构图、底面明暗、区块分隔手法；
     - **全池同模板归簇题（`clusterSamples`）**：从本轮已生成的各公司×各风格首页 1440 截图中抽取 6–8 张完全匿名打乱的样本，要求评审根据整体骨架与视觉语言归 cluster，检查最大「像同一套模板」簇的样本数是否超过阈值（如 <= 2 站）。
   - 沿用既有防泄密机制：`paddedPng` 对齐文件字节、`orderedSampleDirectory` 强制目录创建时间顺序、`uniformTimes` 归零时间戳、`private/mapping.json` 隔离身份。
2. **评估命令行扩展与解盲统计（`scripts/eval-new-route.ts` 与相关脚本）**：
   - 支持评估矩阵显式传入跨风格组合（配合 `SITECRAFT_EVAL_STYLES` 评估 `pending` 候选）并在 `private/round.json` / `private/blind-coverage.json` 记录 `diversity` 包覆盖完整度；
   - 新增只读解盲汇总工具或扩展 `analyze-code-usage.ts` / `eval-set-report.ts` 导出函数，根据评审返回的 JSON（搭配 `private/mapping.json`）客观计算：`同风格 sameTemplate%`、`跨风格 sameTemplate%`、`最大同模板簇大小` 与 `成对新版胜率`。
3. **预算网关支持 OpenAI Responses（`scripts/t153-real-budget.ts`）**：
   - 现行 `scripts/t153-real-budget.ts` 第 44–47、79 行仅支持 `deepseek-flash` 与 `https://api.deepseek.com`。按 [T-226](T-226-style-diversity-direction.md) 负责人已批复的方案 A（第二阶段 `gpt-6.2-sol` 6 站探针、`SITECRAFT_TOKEN_LIMIT=850000`），按同等的「出网前估算输入 + 完整预留 `max_output_tokens` + 凭据脱敏 + 不可重置持久账本」原则支持 `AI_PROVIDER_FORMAT=openai-responses`（`/responses` 路由与 `response.usage` 核对），放行对应评估票目录前缀，并确保不破坏原有 DeepSeek `tests/t153-budget.test.ts`。

## Acceptance

- [x] `buildBlindPackage` 在多风格评估结果上能生成完整、独立匿名的 `review/diversity/`（含 `prompt.txt`、`tasks.json`、`index.html` 与对齐尺寸/时间戳的 PNG），单风格评估不虚构跨风格对
- [x] 解盲汇总函数能对模拟评审输出正确统计同风格与跨风格 `sameTemplate` 比例、最大模板簇大小和成对胜率（含 `tests/t130-eval-set.test.ts` 与 `tests/t130-blind-privacy.test.ts` 风格的离线红绿单测）
- [x] `scripts/t153-real-budget.ts` 支持 `openai-responses`（`/responses`、出网前输入估算与完整预留 `max_output_tokens`、凭据脱敏、超限拒收与持久化账本），并通过离线本地 HTTP 替身单测；`tests/t153-budget.test.ts` 现有 DeepSeek 用例继续全部通过
- [x] `npm run typecheck` 与新增／相关定向测试通过（0 真实模型调用）

## Resolution

- **Completed at**: 2026-11-25 04:01 EST (UTC-5)
- **Changes**:
  - `scripts/eval-set-report.ts` 与 `scripts/eval-new-route.ts`：在多风格（>=2）评估轮次生成独立匿名 `review/diversity/` 盲评包（含跨风格 1440/375 成对对比 `crossStylePairs`、全池 1440 匿名归簇 `clusterSamples`、等字节 `paddedPng`、平衡 `birthtime`、统一 `mtime`/`atime` 与互斥编号），单风格与空轮次不生成跨风格包；新增 `summarizeBlindDiversity()` 与 `--unblind` 命令行汇总同风格/跨风格 `sameTemplate` 比例、同/跨公司拆分、簇分布及跨轮胜率，并严格拒绝跨题/跨角色/重复编号与显式缺失路径。
  - `scripts/t153-real-budget.ts`：保持原有 DeepSeek `max_tokens` 与 `tests/t153-budget.test.ts`/`tests/t165-*` 口径不变，新增 `AI_PROVIDER_FORMAT=openai-responses` 支持（`/responses` 与 `/v1/responses`、出网前输入估算与完整预留 `max_output_tokens`、`submit_local_edit` 禁降额、HTTPS 或显式 `SITECRAFT_ALLOW_LOCAL_PROVIDER=1` 本机替身、`response.usage` 累加、`status !== 'completed'` 截断停机、非 2xx 凭据脱敏与 `t226`/`t228` 目录白名单）。
  - `tests/t130-blind-privacy.test.ts` 与 `tests/t228-diversity-and-budget.test.ts`：覆盖 `review/diversity` 隐私对齐、HTML `article>section` 容器作用域、解盲统计与篡改拒收、`--unblind` CLI 与 OpenAI Responses 预算网关离线 HTTP 替身测试。
  - `CONTEXT.md` 与 `docs/project/spec.md`：同步盲评包、`summarizeBlindDiversity()` 与 OpenAI Responses 预算网关规格说明。
- **Verification**:
  - 红态证据：`artifacts/t228/red-tests.log`（实现前 `tests/t228-diversity-and-budget.test.ts` 0/5 通过、5/5 按预期失败）。
  - 绿态回归：`npm run typecheck`（exit 0）与 8 组定向单测 `t228-diversity-and-budget`（5/5）、`t130-eval-set`（7/7）、`t130-blind-privacy`（4/4）、`t140-review-materials`（5/5）、`t153-budget`（8/8）、`t159-style-eval`（1/1）、`t165-token-reserve`（14/14）、`t165-tokenizer-adversarial`（16/16），合计 60/60 全部通过（0 真实模型调用，见 `artifacts/t228/green-tests-verified.log` 与 `artifacts/t167/test-run-1795597172509-13768`）。注：之前一轮连跑额外夹带 `tests/t164-local-output-limit.test.ts` 时，`t164` 内两次遇到 Windows 既有 Chrome `chrome_debug.log` `EBUSY` 清理冲突（见 `artifacts/t228/green-tests-pass.log`），与本票 `scripts/` 无关，留待 Stage 3 评估。
  - 设计与审查：`artifacts/t228/design-integrity-v2.json`（仅 line 514 省略默认路径时的 `ENOENT -> null` 读取边界）；独立只读审查 `artifacts/t228/review.txt`（首轮 `FAIL` 检出 3 P2 + 1 P3，修复复审后 `STATUS: PASS`，0 缺陷，`same-model review`）。
