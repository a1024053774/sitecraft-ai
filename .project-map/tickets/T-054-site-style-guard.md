---
id: T-054
title: 站点样式：模型写结构化样式规则，校验加三档检查
type: build
status: open
blocked_by: [T-053]
claimed_by: codex-build
supersedes:
---

## What to build

按 [spec.md §4](../../docs/project/spec.md) 的「站点样式」和「三档检查」实现做法 A：草稿加站点样式规则表，operation `set_site_style`（整份替换、inverse 恢复前一份），服务端校验白名单（[T-051 调研](../../docs/research/区块素材与CSS校验调研-2026-09-29.md) §3.3）、从结构生成带前缀的 CSS 放进 `@layer site-style`，提交前在常驻无头 Chrome 里按 375 / 768 / 1440 对比基线检查新增溢出、重叠和被藏的槽位文字，不过就拒绝并说明。模型的 operation 白名单和提示里加上它。

先把会失败的方式列出来再写测试，至少覆盖：`content`、`list-style-type:"…"` 等任何字符串值、`u\72 l(` 转义、`image-set()`、`@import`、`!important`、`position:fixed`、超出清单的区块/部件、超出上限、`min-width` 撑破 375、负边距造成重叠。

## 实现决定（Claude，2026-09-30，依据 Kiro 的计划 `artifacts/kiro-t054-plan.md`）

执行交给 Codex（Herdr 里的 `codex-build`，GPT-6-Astra），照 Kiro 的计划分步做；Kiro 积分不够，只写了计划。

- 版式方向配方：开发侧写好 3 个方向（规格为主、目录为主、工厂实力），每个 12–20 条白名单规则、三份资料三档检查过；模型选一个方向，再按用户要求加规则。仍是「模型写受限的站点样式」，只是不从零写。`set_site_style` 整份替换「方向 + 规则」。服务端先按资料算出「建议方向」写进提示，模型可按用户的话改。
- CSS 由我们的序列化函数在预览文档里生成，桥和检查用同一段代码；不透传模型原文。区块样式在 `@layer sc-blocks`，站点样式在其后的 `@layer site-style`；缺口和显隐靠不开放 `display` 和 `!important` 保住。spec 相应措辞随第 1 步修改。
- 白名单按计划收窄：不放 `display`、`order`、十六进制颜色、渐变、阴影；导航和页脚不开放。
- 三档检查只查访客首页（中文三档，有英文时英文也查），含对比度；只拒绝新增问题；规则表为空时不开浏览器。撤销和重做不查（撤销必须永远能退回），之后内容变长导致的问题靠 check-published 发现。
- 样式那一条不占模型 24 条上限（24 + 1，对齐方案 27 → 28）。
- dev server 启动时带 `CHROME_PATH`（可写进 `.env.local`）；没有 Chrome 时样式修改被拒并说明，其余修改照常。
- T-053 遗留 c1：选了参数对比表时首屏不放参数条。c2：「目录为主」方向加重参数条。
- 区块顺序（`sectionOrder` 在区块库页面不生效）另开 T-062，不在本票。

## Acceptance

- [ ] 上面每种坏规则都被拒绝，测试在没有校验的实现上先失败
- [ ] 用 DeepSeek 实跑：对三份模拟资料各提一次样式要求（例如「首屏更有分量」「参数表更紧凑」），生成的规则通过校验并在三档都不破版；故意要一个会撑破手机宽度的改法时被拒绝，用户看到原因
- [ ] 撤销、重做、刷新恢复对样式都成立
- [ ] 盲评（Codex gpt-6.1-sol）：三份模拟资料在工程工业下，遮住文字只看版式（`-masked` 截图），能看出是三家不同的公司（2026-09-30 从 T-053 移来的硬性验收）；且不差于 T-053
- [ ] `npm run typecheck`、`npm test`、`npm run build` 通过；Codex Astra 代码审查通过；Claude 验收
