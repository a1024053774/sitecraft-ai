---
id: T-147
title: good-css 可机判条目做成提交入口的质量反馈检查
type: build
status: open
blocked_by: []
claimed_by:
supersedes:
---

## Why

T-146：good-css 只写进规范文字没有效果（T-132）。改用提交入口的机械检查，让检查发现的问题进入现有的反馈与修正链路。

## What to build

从 T-132 调研（gitignore 的 `artifacts/research-good-css/report.md`，47 条提炼；good-css revision 6d16d2fd27f4892e2aea4b5c5c2b016f45be7eef）里挑出能由浏览器或 DOM 机器判断的条目，在 `lib/code-site-check.ts` 现有的视口检查里实现，第一版全部作为质量反馈，不触发修正轮。先做以下这些，判断不了的条目不做：

- 长规格、型号、参数值被截断（`text-overflow: ellipsis`、`-webkit-line-clamp`、固定高度加 `overflow: hidden` 把文字截掉）；
- `:hover` 样式没有包在 `@media (hover: hover) and (pointer: fine)` 里，导致触屏上出现粘住的悬停态；
- 375 下可点击元素的点击区小于 44×44（行内正文链接除外）；
- sticky 或 fixed 页头会挡住锚点目标（没有 `scroll-margin-top` 或 `scroll-padding-top`）；
- 带 `data-image-id` 的产品图用了 `object-fit: cover`，并且实际被裁掉了主体（只按图片用途 product 判断，现场图的有意裁切不算）。

检查结果写进版本检查与评估统计，格式和行长反馈一致。SOURCE 记录放 `skills/site-code-core/SOURCE.md`（没有就新建），写明来源、revision 和 MIT 全文，不复制原站示例代码。

## Acceptance

- [ ] 每项检查先列出失效方式，再按清单写红绿测试：坏样例触发、好样例不触发，并在已知坏的实现上失败
- [ ] 用评估集现有站点或已存版本离线跑检查（不调用 DeepSeek），统计每项触发率并人工抽查误报，写进 Resolution；触发率最高的两项附 1440/375 截图
- [ ] Resolution 给出建议：哪些项值得升为底线（误报低、和盲评破绽对得上），由主控决定，本票不升级
- [ ] Astra 审查通过；typecheck、test、build 通过；mainline 评估四层的描述同步
