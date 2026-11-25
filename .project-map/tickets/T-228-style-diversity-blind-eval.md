---
id: T-228
title: 第一阶段（2/2）：评估集支持跨风格与全池「不雷同」盲评包及预算网关适配
type: build
status: open
blocked_by: [T-226]
claimed_by:
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

- [ ] `buildBlindPackage` 在多风格评估结果上能生成完整、独立匿名的 `review/diversity/`（含 `prompt.txt`、`tasks.json`、`index.html` 与对齐尺寸/时间戳的 PNG），单风格评估不虚构跨风格对
- [ ] 解盲汇总函数能对模拟评审输出正确统计同风格与跨风格 `sameTemplate` 比例、最大模板簇大小和成对胜率（含 `tests/t130-eval-set.test.ts` 与 `tests/t130-blind-privacy.test.ts` 风格的离线红绿单测）
- [ ] `scripts/t153-real-budget.ts` 支持 `openai-responses`（`/responses`、出网前输入估算与完整预留 `max_output_tokens`、凭据脱敏、超限拒收与持久化账本），并通过离线本地 HTTP 替身单测；`tests/t153-budget.test.ts` 现有 DeepSeek 用例继续全部通过
- [ ] `npm run typecheck` 与新增／相关定向测试通过（0 真实模型调用）
