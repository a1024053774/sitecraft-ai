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
- [ ] 代码审查通过；Claude 验收

## Resolution

- 红测证据：`artifacts/t062/red-rework-p1.txt` 显示未知键导致 schema 失败，并在绕过 schema 的模型校验中原样进入 order；原始 T-062 红测仍在 `red-step1.txt`、`red-step2.txt`、`red-step3.txt`。修复提交：`25acf4b`。
- P1 修复：模型 JSON 在 schema 前统一过滤未知顺序键，`validateAIOperations` 用 `effectiveBlockOrder` 补齐缺省区块并在摘要 notes 写明忽略项；draft route 和 `applySiteOperations` 入口再次过滤，草稿永远只写 `MovableBlockId`。绿测记录为 `artifacts/t062/green-rework-p1.txt`，组合回归锁定重排后换变体时实体/模板同组且实体唯一。
- 默认顺序时桥仍不移动节点；显式顺序只作用于四个区块库样子。应用行业与加工能力整组移动，首屏、导航、页脚固定，导航右侧询盘按钮保持原位。
- 最终验收均在 `25acf4b` 之后生成：`npm test` 535/535、0 失败/0 跳过（`artifacts/t062/full-rework-25acf4b.log`）；`npm run typecheck` 和 `npm run build` 通过（对应日志）。
- 默认逐像素对照：工程工业 66/66、明亮产品/蓝白目录/灰底短路径各 9/9 零差异；报告目录 `artifacts/t062/{engineering,forge,landwind,tailwind}-default-25acf4b/`，基线为 T-062 开工前 `eb95da0`。
- 显式顺序发布检查 `artifacts/t062/published-order-25acf4b/` 在中英文三档通过，真实 DOM 顺序断言无失败。
