---
id: T-100
title: 模型第一次结构化输出几乎每次都过不了 schema
type: build
status: open
blocked_by: []
claimed_by: field-build
supersedes:
---

## What to build

T-096 复核时发现（`sitecraft-ai-fields/artifacts/t096/failure-analysis-264c953.json`、`repro-schema-fields.txt`）：真实 DeepSeek 的 `structured_operations` 第一次响应在当前提交 6/6、主线 `7f0f4b4` 工业 3/3 都是整份 schema 校验失败，靠产品自带的一次重试才过；重试也失败时用户看到「模型返回的方案无法安全校验，草稿没有修改」，T-096 的一轮真实运行三站里两站这样失败。这是主线既有问题，不是 T-096 引入。

失败字段集中且稳定：目录 / 行业等条目的 `items.N.body`、`intro`，产品的 `sku`，偶有设备 `spec`，全是 `invalid_type`。说明 schema 与提示 / 示例对这些字段的形状说法不一致（例如双语对象 vs 字符串、`null` vs 省略），不是模型随机出错。

在根因层修：用已保存的原始响应逐条列出模型实际写成了什么、schema 要什么、提示和示例怎么说的，把三者对齐到一个说法（改提示 / 示例，或在 schema 层明确这些字段允许的形状，比如可空双语字段统一 `null`），不加新的重试、不在解析时静默改写模型输出、不放宽事实核对。

## Acceptance

- [ ] 先写出字段清单：每个失败字段的模型实际形状、schema 期望、提示 / 示例原文（`artifacts/t100/`）；用已保存的原始响应做离线测试，在父提交上行为级失败
- [ ] 真实 DeepSeek（需账户有余额）：三份资料各 3 次直接结构化生成，统计第一次就过 schema 的比例，修改前后对照，原始响应存档；目标是第一次通过成为常态，达不到就如实写剩下的失败字段
- [ ] 三家 `check-published` 中英文三档通过；`npm run typecheck`、`npm test`（0 失败）、`npm run build` 通过；代码审查通过；Claude 验收
