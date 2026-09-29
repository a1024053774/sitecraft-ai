---
id: T-051
title: 区块素材与模型 CSS 校验方案调研
type: research
status: open
blocked_by: []
claimed_by: cloud
supersedes:
---

## Question

T-048 倾向「自有区块库 + 模型写受限 CSS」。开工前要三类事实：

1. **区块清单**：B2B 工业、外贸站首页和子页常见哪些区块，每种区块有哪 2–3 种常见排法（例如参数表：单品表 / 多品对比 / 收起式）。在 [工业官网版式调研-2026-09-26.md](../../docs/research/工业官网版式调研-2026-09-26.md) 基础上补，不重做。
2. **开源区块库**：找 2–3 个可当素材的库（例如 HyperUI、Preline、Flowbite、Meraki UI），逐个记录版本、仓库地址、代码许可、图片/图标/字体各自的许可、是否依赖 Tailwind、移植成纯 CSS 自定义属性的难度。调研不等于准入：不进 `vendor/`，不复制它们的文字和图片。
3. **CSS 校验方案**：运行时模型写一份 CSS，怎样保证它只作用于站点区块、加不进文字和外部资源、不破坏三档宽度。要回答：用什么解析（先查项目现有依赖，再看 postcss / css-tree 等）；属性和选择器白名单怎么定；必须禁掉的（`content`、`url()`、`@import`、外部 `@font-face`、`expression`/`behavior`、`position: fixed` 等）；作用域怎么做（前缀、`@scope`、iframe 隔离）；大小上限；怎样在无头浏览器里检测 375/768/1440 的横向溢出和文字重叠，成本多大。给出 2–3 个可选做法和推荐。

## Resolution

（调研结果写到 `docs/research/区块素材与CSS校验调研-2026-09-29.md`，这里写 3–6 条结论和链接。）
