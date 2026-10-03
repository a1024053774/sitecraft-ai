---
id: T-093
title: 联系方式和认证区块的图标变体，盲评决定去留
type: build
status: open
blocked_by: [T-092, T-081]
claimed_by:
supersedes:
---

## What to build

在 [T-092](T-092-icon-set-and-registry.md) 的注册表上，为联系方式（`lib/blocks/fragments/contact.ts`）和认证（`lib/blocks/fragments/sections.ts`）各做一个带图标的变体。走 T-073 区块池流水线（区块 HTML/CSS 是 sonnet-blocks 的范围），T-081 合回主线后再开始。

- 图标是辅助锚点：低对比、在文字旁边，不当主视觉；每个图标旁都有文字，不出现只有图标的按钮或空的装饰位。
- 图标由区块固定挂载，按 slot 唯一命中；事实文字照旧来自草稿。资料里没有的联系方式或证书不显示图标。
- 四个样子都要成立（工程工业用直角端点变体，如 T-092 规范有）。

## Acceptance

- [ ] 测试先写，并在父提交上能加载、在断言处失败：资料缺某项联系方式时对应图标不出现；图标版与文字版槽位一一对应
- [ ] 四个样子 × 1440 / 768 / 375 截取文字版与图标版的单区块裁切图，存 `artifacts/t093/`；独立审核 agent 盲评（不告诉哪张是新的），不比文字版好就删除图标变体，结论写进 Resolution
- [ ] 三家 `check-published` 中英文三档通过；`npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收

## Resolution
