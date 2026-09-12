# 三角色协同：提示词 / 质检器 / 发布门的策略单一真相源

- 日期：2026-09-08
- 场景：修「待补充」语义时，必须同时改三处（提示词文案、质检器正则、发布门阻断项）才生效，漏一处静默失效。根因不是某个 case，而是三者各自独立实现同一套策略。
- 方向：AI 工程架构 / 内容治理
- 置信度：7（调研充分 + 红队验证；**方案本身尚未落地**，落地后按结果调整）
- 层级：复合
- 状态：方案已定，待执行
- 复用量：0
- 来源：[Policy-as-Prompt (NeurIPS 2025)](https://www.emergentmind.com/papers/2509.23994)、[Input/Output Guardrails](https://www.agentpatternscatalog.org/patterns/input-output-guardrails/)、[LLM-as-Judge](https://www.agentpatternscatalog.org/patterns/llm-as-judge/)、[Duda AI-ready templates](https://developer.duda.co/docs/building-ai-ready-templates)

## 问题

SiteCraft-ai 有三层内容治理：**提示词**（预防）→ **质检器**（诊断）→ **发布门**（执行）。骨架正确，但三者之间**没有共同契约**——同一套规则被编码三遍。

实证（2026-09-08）：
- 提示词四处教 AI「缺失事实写待补充」；质检器把「待补充」与 `lorem ipsum` 归为同一类扣分；发布门因此拦截发布 → **AI 越诚实越发布不了，编造假信息反而能过**
- 修复时必须改三处；今天新增 `metaCommentary` 检测时，同样改了两处才生效

## 借鉴方案

### 1. 策略树 = 单一真相源（Policy-as-Prompt）

把内容治理规则抽成 `lib/content-policy.ts` 的一棵树，**同一棵树产出三种产物**：

| 派生目标 | 消费方 |
|---|---|
| `promptRule` 文本 | 提示词注入 |
| `weight` / `severity` | 质检器计分与分类 |
| `policyDecision()` | 发布门放行/拦截 |

核心洞察：策略树让"提示词说了什么"与"代码拦了什么"**有共同来源**，可溯源、可审计。

### 2. 校验层在模型之外（Guardrails）

> "the model cannot police itself — the model is the very surface being defended."

校验器是可复用积木，通过 **single chokepoint** 集中执行 + 集中审计。我们的质检器/发布门已符合该结构，缺的是"共享积木"（策略树）。

### 3. 分数是辅助，不是判据（LLM-as-Judge）

> "scores are advisory unless calibrated against human judgement at known intervals."

- 结构化分数 **必须带 rationale**（调试线索 + 用户修复指引）
- 未做人工校准前，分数不该是唯一决策依据
- **反模式**：Reward Hacking（优化单一代理指标）、同模型族自评（judge 必须用不同模型族——我们只有 DeepSeek，故**不引入 LLM-as-Judge**）

### 4. 反面对照：Duda 不做发布校验

Duda 靠**模板构造 + opt-out 开关**（"skip element"、"Don't replace with AI"）约束 AI，**没有发布时校验**。启示：约束应尽量前移到模板声明层；但**我们不退化成无门禁**——现有门禁已验证有效（回扫 8 成品抓 3 缺陷）。

## 关键决策

- **策略树只管规则定义与判定，不碰约束合并**：`maxLength`（schema 硬上限，如 `hero.title`=160）与可读性推荐值（15 汉字）是**两个不同约束**，必须并存——超前者 `block`，超后者 `warn`。
- **severity 决定处置，owner 决定动作**：按责任方分类（ai/user/template）而非严重度，才能得到正确的处置动作。
- **发布门只问决策**：`policyDecision(report)` 返回 `{allowed, blockingRules[], message}`，不再手工列字段。
- **同源性必须有测试**：遍历策略树断言"提示词文本 ⊇ 质检判定 ⊇ 发布决策"三方一致；写不出这个断言 = 同源性没建立。
- **不做**：LLM-as-Judge（同模型族）、`hideUnlessFilled` 接线（22 模板 0 标注）、质检器容量校验（161 草稿 0 超容量）。

## 搜索策略

- **有效**：WebSearch 找方向 → WebFetch 读一手内容（`agentpatternscatalog.org`、`emergentmind.com`、`developer.duda.co`、`docs.temporal.io` 均可抓）
- **无效**：`raw.githubusercontent.com` / `r.jina.ai` 本机 curl 返回 000（网络层拦截）；`arxiv.org/pdf` ECONNRESET（读 HTML 摘要页可绕开）
- **坑**：`skipWebFetchPreflight` 被 cc-switch 覆盖会导致 WebFetch 全线失败——先查 `~/.claude/settings.json` 再重试，别白费轮次
- **关键词**：`guardrails validators architecture`、`policy as code single source of truth`、`LLM-as-judge rubric blocking vs warning`、`AI-ready templates content validation`

## 验证记录（证据链）

- `[read]` 4 篇一手资料已读全文并提炼，来源链接已标。
- `[test]` 红队攻击 5 条承重假设，其中 1 条**证实方案有硬伤**（`maxLength` ≠ 推荐值，统一会退化行为），3 项被砍。
- `[data]` 容量超限实测：161 份草稿 **0 次**超容量（实际最大 features=6/services=4）。
- `[data]` `hideUnlessFilled` 标注实测：22 个模板文件 **0 个**标注（仅类型定义）。
- 未验证：方案本身未落地；同源性测试能否写出未验证；工时未估。

## 落地版（待执行）

计划文件：`C:\Users\ZhuanZ\.claude\plans\ai-velvet-quiche.md`「三角色协同重构方案（2026-09-08 调研 + 红队修正版）」

MVP 三步：① 建 `lib/content-policy.ts` + 同源性测试 → ② 提示词从 `promptRule` 派生（删 4 处手写）→ ③ 发布门改调 `policyDecision`。

**验收锁死**：重构前后三场景分数完全一致（92/80/80），防行为漂移。
