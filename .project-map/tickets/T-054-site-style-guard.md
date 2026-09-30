---
id: T-054
title: 站点样式：模型写结构化样式规则，校验加三档检查
type: build
status: open
blocked_by: [T-053]
claimed_by:
supersedes:
---

## What to build

按 [spec.md §4](../../docs/project/spec.md) 的「站点样式」和「三档检查」实现做法 A：草稿加站点样式规则表，operation `set_site_style`（整份替换、inverse 恢复前一份），服务端校验白名单（[T-051 调研](../../docs/research/区块素材与CSS校验调研-2026-09-29.md) §3.3）、从结构生成带前缀的 CSS 放进 `@layer site-style`，提交前在常驻无头 Chrome 里按 375 / 768 / 1440 对比基线检查新增溢出、重叠和被藏的槽位文字，不过就拒绝并说明。模型的 operation 白名单和提示里加上它。

先把会失败的方式列出来再写测试，至少覆盖：`content`、`list-style-type:"…"` 等任何字符串值、`u\72 l(` 转义、`image-set()`、`@import`、`!important`、`position:fixed`、超出清单的区块/部件、超出上限、`min-width` 撑破 375、负边距造成重叠。

## Acceptance

- [ ] 上面每种坏规则都被拒绝，测试在没有校验的实现上先失败
- [ ] 用 DeepSeek 实跑：对三份模拟资料各提一次样式要求（例如「首屏更有分量」「参数表更紧凑」），生成的规则通过校验并在三档都不破版；故意要一个会撑破手机宽度的改法时被拒绝，用户看到原因
- [ ] 撤销、重做、刷新恢复对样式都成立
- [ ] 盲评（Codex gpt-6.1-sol）：三份模拟资料在工程工业下，遮住文字只看版式（`-masked` 截图），能看出是三家不同的公司（2026-09-30 从 T-053 移来的硬性验收）；且不差于 T-053
- [ ] `npm run typecheck`、`npm test`、`npm run build` 通过；Codex Astra 代码审查通过；Claude 验收
