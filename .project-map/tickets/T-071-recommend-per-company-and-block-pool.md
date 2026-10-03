---
id: T-071
title: 评分之后怎么走：推荐随公司变，区块素材批量做并过「AI 味」审查
type: decide
status: closed
blocked_by: []
claimed_by: claude
supersedes: T-068
---

## Question

T-068 两轮评分都靠不住（评审编造页面上没有的内容，两轮对专家 vs 基线的结论相反）。还要不要再评？下一步做什么？

## Resolution

2026-10-02 负责人确认：

- **不再加评分轮次**，T-068 由本票取代。按 T-068 里能确定的证据往下走。
- **(a) 推荐随公司变**（[T-072](T-072-per-company-look-and-color-recommendation.md)）：6 个基线全是工程工业 + 工程暖橙，色彩集推荐写死为样子默认色板（`lib/alignment.ts` `lookCardColorOptions`），样子推荐只按行业标签。改成按这家公司的资料推荐样子和色彩集，并写出依据资料的理由。
- **区块素材批量做**（[T-073](T-073-block-pool-tracer.md) 起）：Sonnet 5.5 做区块库布局，另开一个审查窗口专门判断是不是「AI 千篇一律味」，过了才进区块库。这取代 T-064 里「不按数量扩布局」一条：可以多做，但每个候选都要过 AI 味审查、同族检查、三档检查和资料条件，审查不过的不进库。
- 做法（supervisor 定，负责人可改）：
  - Sonnet 5.5 在 Herdr 窗口里跑（Claude Code），在独立的 git worktree / 分支 `blocks-pool` 上工作，避免半成品区块影响主工作区里 Codex 的测试；通过审查和代码审查后由 Claude 合回主线。
  - AI 味审查用 Codex gpt-6.1-sol（Herdr 窗口 `codex-taste`），**只看单个区块的裁切图**（三家公司 × 三档宽度，外加同一区块现有布局的对照图），先描述看到的结构再下结论。整页长图缩小后看不清，是 T-068 评审编造内容的根因。
  - 判断依据：`skills/frontend-less-ai-tone/`、`skills/sitecraft-frontend-less-ai-tone/` 的否决项；是否像真实工业 / 外贸厂家官网；和页面其余部分是不是同一视觉族；和这个区块已有布局是不是只差一点；三档宽度是否成立。结论只有 ACCEPT / REVISE（最多 3 条具体修改）/ REJECT。
  - 第一批只做读现有草稿字段的布局。需要新草稿字段的内容区块（MOQ / 交期 / 产能等商业条款、质检流程、沿革时间线）另写 spec 后再做，因为要动草稿 schema、operation 和模型提示。
- 分工：执行用 Codex（`codex-build`）和 Sonnet 5.5；代码审查 Astra（gpt-6-astra）；AI 味审查 `codex-taste`（gpt-6.1-sol）。审查者不审自己参与的工作。
