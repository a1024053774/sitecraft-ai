---
id: T-062
title: 区块库页面按草稿的区块顺序排
type: build
status: open
blocked_by: [T-054]
claimed_by: codex-build
supersedes:
---

## What to build

T-054 计划时发现：区块库页面（工程工业）不读草稿的 `sectionOrder`，`reorder_sections` 在这个样子上不起作用。区块顺序是遮字后最显眼的版式差异之一，也是用户会说的话（「把认证放到产品前面」）。让区块库拼页和预览桥按 `sectionOrder` 排可排的区块（导航、首屏、页脚固定），模型提示说明可以按资料调整顺序；撤销恢复顺序。

## Acceptance

- [ ] 对话「把认证放到产品前面」生效，撤销恢复；工作台预览和访客页一致
- [ ] 默认顺序的页面和现在逐像素一致
- [ ] 测试先写、改动前先失败；`npm run typecheck`、`npm test`、`npm run build` 通过；`check-published` 三档通过
- [ ] 代码审查通过
