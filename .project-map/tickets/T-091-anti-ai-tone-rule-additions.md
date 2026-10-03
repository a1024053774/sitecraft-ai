---
id: T-091
title: 去 AI 味规则补主任务、单主按钮、状态不只靠颜色，区块候选说明借 oil-ui 方法
type: build
status: open
blocked_by: [T-084]
claimed_by:
supersedes:
---

## What to build

依据 [R4 调研](../../docs/research/前端收藏调研-2026-10-03/R4-rules-skills-prompts.md) 第 5 节，落在 T-084「规范在系统里怎么落地」的第 1、2 层。

- `skills/sitecraft-frontend-less-ai-tone/`：加入 5 条——先写页面和区块的主任务与可观察结果再选版式；每页一个主按钮，其他入口降级并写清动作；状态和资料缺口用文字、形状或图标表达，颜色只做加强；候选写一个记忆点、主动不做的装饰和与已有布局的结构差异；不把外部模板名或提示词当用户选项。每条注明来源。
- `lib/frontend-tone.ts`：同步加入对应的短规则，不放 45–75、4.5:1 这类数值（数值由 T-089、T-090 的浏览器检查执行）。
- T-073 区块候选说明模板（`candidate.md` 的字段要求，在 T-073 / 区块池流水线文档里）：加品类与参照、区块主任务、记忆点、结构差异、主动不做的装饰。
- 引用或改写 oil-ui（MIT）、oiloil-ui-ux-guide（Apache-2.0）的内容时保留许可要求的署名。

## Acceptance

- [ ] `lib/frontend-tone.ts` 的测试先写，并在父提交上能加载、在断言处失败：新规则出现在给模型的提示里，且提示里不含数值门槛
- [ ] 用真实 DeepSeek 对三份模拟资料各生成一次，确认新规则没让页面出现规则原文或数值（报告存 `artifacts/t091/`）
- [ ] `npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收

## Resolution
