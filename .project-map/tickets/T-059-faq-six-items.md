---
id: T-059
title: 常见问题在访客页放到 6 条
type: build
status: open
blocked_by: [T-053]
claimed_by: kiro
supersedes:
---

## What to build

草稿的常见问题默认就有 6 条，但工程工业的页面只有 3 个槽位；注塑厚资料包（T-050）有 5 组问答，访客页丢掉 2 组。在区块库的常见问题区块里放到 6 条（缺口条目按缺口规则不显示），模型提示同步说明可以写到 6 条。T-053 里为保持新旧对照只差排法，没有一起做。

## Acceptance

- [ ] 注塑资料生成后访客页显示 5 组问答，P3I、P3E 只显示实际写入的条目，没有空壳
- [ ] `check-published` 三档通过，截图打开看过
- [ ] 测试先写、改动前先失败；`npm run typecheck`、`npm test`、`npm run build` 通过
- [ ] 代码审查通过；Claude 验收
