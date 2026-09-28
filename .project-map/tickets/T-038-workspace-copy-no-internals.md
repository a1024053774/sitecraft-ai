---
id: T-038
title: 工作台提示不露字段路径和内部词
type: build
status: open
blocked_by: [T-034, T-036]
claimed_by: kiro
supersedes:
---

## What to build

- 生成后的提示直接列字段路径，例如「未显示：goal.zh、about.title.zh、contact.phone.zh；可改已映射字段：contact.phone.zh→hero.cta」。
- 资料弹窗写「commitOperations」和「模板快照里已有对应 HTML」。
- 未支持页面的说明写「独立 HTML」「声明区块」。

spec §3.4：不向用户暴露字段路径。

## Acceptance

- [ ] 提示里没显示、可改的内容用中文区块名（例如「关于我们正文」「电话」），不出现字段路径
- [ ] 资料弹窗、未支持页面说明和工作台提示里没有 commitOperations、HTML、slot、字段路径这类词
- [ ] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [ ] 1440 浏览器截图
- [ ] 另一个 harness 的审核 agent 验收通过，结论记在 Resolution

## Resolution
