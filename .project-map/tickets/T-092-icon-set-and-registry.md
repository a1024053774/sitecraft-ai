---
id: T-092
title: 自制第一批区块图标和图标注册表（联系、认证）
type: build
status: open
blocked_by: [T-084]
claimed_by: rs-iconfont
supersedes:
---

## What to build

依据 [R5 调研](../../docs/research/前端收藏调研-2026-10-03/R5-icons-fonts.md) 3.1–3.3 节。只做图标数据，不改区块 HTML/CSS（接入在 [T-093](T-093-contact-certification-icon-variants.md)）。

- **规范**：参考 Cursor 图标文章的方法定一份短规范——24px 网格、描边粗细、端点和圆角、光学修正、一概念一图标的概念表。工程工业样子需要直角端点的变体时在规范里写明。
- **来源**：Lucide（ISC，工作台已在用）里有的概念直接取它的路径并保留 ISC 声明；Lucide 没有的（例如认证证书、检测报告、出口资质）由执行者按规范自己画。负责人给的 Amicons、Smallbits 只是风格参考，不描摹、不复制它们的路径或文件。
- **注册表**：新文件 `lib/blocks/icon-registry.ts`，每个图标存 id、语义、viewBox、路径、默认尺寸、来源与许可；模型只能选 id，不能提交 SVG、路径或 URL。
- 第一批只覆盖联系（邮箱、电话、地址、表单提交）和认证（证书、检测报告、资质状态）需要的概念，并出一张 16 / 20 / 24px 的预览图。

## Acceptance

- [ ] 测试先写，并在父提交上能加载、在断言处失败：每个图标有来源和许可字段；注册表拒绝未登记的 id；路径只含 SVG 几何命令，不含文字、外链或脚本
- [ ] 16 / 20 / 24px 预览图（浅底、深底各一张）存 `artifacts/t092/`，打开看过；独立审核 agent 看过预览图和参考作品，确认风格一致、小尺寸可辨认、自画图标不是参考作品的描摹
- [ ] `npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收

## Resolution
