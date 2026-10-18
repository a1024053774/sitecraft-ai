---
id: T-185
title: 事实核对两类协议失败：claim 越段与 issues 返回对象
type: build
status: open
blocked_by: []
claimed_by:
supersedes:
---

## Why

T-180 重跑的 20 站里有 2 站在事实核对协议处失败，没有生成版本，影响主流程（优先级 2）。T-181 已经开始保存原始回复，这次两站的原文都存下来了：

- **packaging/precision（第 1 轮 case-7）**：claim 不属于当前核对段，报错为 `资料出处声明不在本核对段：折叠彩盒规格 折叠彩盒规格 [scope=row] 起订量 3000 个`。T-181 没有复现这个问题，这次复现了。原文在 `artifacts/t180-r2/round1-full/private/case-7/code-site.json`，即 facts 调用的 response.rawBody.body，同一文件里有 59 段的 factInput 映射。
- **restaurant/neighborly（第 2 轮 case-2）**：`results[12].issues[0]` 返回的是 object，合同要求 string（`lib/code-site-model.ts:340–343`）。见 `artifacts/t180-r2/numbered-failure-analysis.json`。

## What to build

1. **从原文找根因**：
   - 越段的 claim 带着重复的表头和 `[scope=row]` 标记，像是 claimTexts 或表格行文本的构造把表头、属性标记带进了可复制的文本，也可能是模型拼接了内容。用原文和 factInput 映射确认到底是哪一种。
   - issues 返回对象：确认提示或 schema 有没有让模型以为 issue 可以是结构体。
2. **在根因层修**：可以修 claimTexts 构造、提示措辞或协议 schema 描述。
3. **严格协议不放宽**：不宽松解析，不把 object 转成字符串收下，不重试掩盖。如果根因确实在模型这一侧、提示层没法消除，就如实写明，交回构思主控决定。
4. **成对测试**：用这两份真实原文做夹具，先在旧实现上复现失败，再验证修复后通过。
5. **真实探针**：在这两个组合上各跑一次，预算网关显式 `SITECRAFT_TOKEN_LIMIT=500000`，用新账本。

## Acceptance

- [ ] 两类失败的根因写进 Resolution，附原文定位
- [ ] 成对测试先红后绿；两组合真实探针结果如实记录（用量、成败）
- [ ] typecheck、test、build 通过；独立 fast 审查通过
