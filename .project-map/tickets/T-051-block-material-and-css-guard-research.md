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

2026-09-29 cloud（Claude Code 云端会话）。全文：[区块素材与CSS校验调研-2026-09-29.md](../../docs/research/区块素材与CSS校验调研-2026-09-29.md)。

1. 区块清单在 2026-09-26 版式调研上补成首页 15 种、子页 6 种，每种 2–3 个排法；区块库第一版先做「无照片也成立」的变体（首屏纯文字 + 规格条、设备清单、行业图标/文字、认证文字行）。
2. 可当结构参考的是 [HyperUI](https://github.com/markmead/hyperui)（MIT，提交 `2b5aebb`）和 [Meraki UI](https://github.com/merakiuilabs/merakiui)（MIT，提交 `fe0472e`）：区块源码在仓库里、基本不带 JS；都靠 Tailwind，要按我们的类名和 `--sc-*` token 手工重写。演示图都是外链 Unsplash/Freepik 等，一律不用；图标许可没核完。[Preline](https://github.com/htmlstreamofficial/preline) 叠了带「竞争产品」和署名条款的 Fair Use License，要负责人判断前不借；[Flowbite](https://github.com/themesberg/flowbite) 的开源仓库里没有区块。
3. 「加不进文字」不能只禁 `content`：Chromium 141 实测 `list-style-type:"…"` 也能显示文字；postcss 会原样保留 `u\72 l(` 这类转义，正则黑名单会漏。所以用白名单：选择器只能是区块/部件，at-rule 只放断点 `@media`，值里禁一切字符串、反斜杠和非 ASCII，禁 `url()`/`image-set()` 等资源函数和 `!important`，`position`/`overflow`/`transform`/`opacity` 等列入禁用。
4. 作用域用服务端前缀改写 + 服务端加的 `@layer`；`@scope`（Chrome 118、iOS Safari 17.4、Firefox 146 起）等目标浏览器定了再加；预览已是 sandbox iframe，风险在站点文档内部。
5. 三档检查沿用 `scripts/check-published.mjs` 的原始 CDP 做法，不加浏览器依赖。合成页实测：Chrome 冷启动约 0.86 s，三档检查约 0.2 s；`scrollWidth` 和元素边界两种溢出检查都要（`nowrap` 只有前者查得到），文字框两两相交能查出负边距重叠；只拒绝相对基线新增的问题。真实页面估计 1–3 s，要常驻 Chrome 进程。
6. 推荐做法 B：模型写 CSS 文本，服务端用 postcss 解析、按白名单转成结构化规则存进 operation，页面 CSS 从结构重新生成，不透传原文。不想加依赖就退到 A（模型直接输出结构化规则）。C（css-tree 语法校验）不推荐。待定：是否加 `postcss`/`postcss-value-parser` 直接依赖、Preline 条款、图标用哪套。
