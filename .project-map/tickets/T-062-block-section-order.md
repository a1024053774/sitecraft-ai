---
id: T-062
title: 区块库页面按草稿的区块顺序排
type: build
status: closed
blocked_by: [T-054]
claimed_by: codex-build
supersedes:
---

## What to build

T-054 计划时发现：区块库页面（工程工业）不读草稿的 `sectionOrder`，`reorder_sections` 在这个样子上不起作用。区块顺序是遮字后最显眼的版式差异之一，也是用户会说的话（「把认证放到产品前面」）。让区块库拼页和预览桥按 `sectionOrder` 排可排的区块（导航、首屏、页脚固定），模型提示说明可以按资料调整顺序；撤销恢复顺序。

## Acceptance

- [x] 对话「把认证放到产品前面」生效，撤销恢复；工作台预览和访客页一致
- [x] 默认顺序的页面和现在逐像素一致
- [x] 测试先写、改动前先失败；`npm run typecheck`、`npm test`、`npm run build` 通过；`check-published` 三档通过
- [x] 代码审查通过；Claude 验收

## Resolution

- 红测证据：`artifacts/t062/red-rework-p1.txt` 显示未知键导致 schema 失败，并在绕过 schema 的模型校验中原样进入 order；原始 T-062 红测仍在 `red-step1.txt`、`red-step2.txt`、`red-step3.txt`。第一轮修复为 `25acf4b`，最终重构提交为 `d8ea048`。
- P1 当前实现：`aiOperationSchema` 的 reorder order 接受字符串键，`validateAIOperations` 直接过滤未知键、去重、用 `effectiveBlockOrder` 补齐并在摘要 notes 写明忽略项；`siteOperationSchema`、draft route 和 commit 入口保持严格，只接受 `MovableBlockId`。已删除 `parseModelJson` 的隐藏属性传递和提交侧 sanitize。绿测记录为 `artifacts/t062/green-rework-p1.txt`，组合回归锁定重排后换变体时实体/模板同组且实体唯一。
- 默认顺序时桥仍不移动节点；显式顺序只作用于四个区块库样子。应用行业与加工能力整组移动，首屏、导航、页脚固定，导航右侧询盘按钮保持原位。
- 最终验收均在 `d8ea048` 之后生成：`npm test` 535/535、0 失败/0 跳过（`artifacts/t062/full-final-d8ea048.log`）；`npm run typecheck` 和 `npm run build` 通过（对应日志）。
- 默认逐像素对照：工程工业 66/66、明亮产品/蓝白目录/灰底短路径各 9/9 零差异；报告目录 `artifacts/t062/{engineering,forge,landwind,tailwind}-default-25acf4b/`，基线为 T-062 开工前 `eb95da0`。
- 显式顺序发布检查 `artifacts/t062/published-order-25acf4b/` 在中英文三档通过，真实 DOM 顺序断言无失败。
- 本轮只改模型/提交边界和测试，没有改预览桥或 CSS；因此沿用 `25acf4b` 后生成的默认对照与显式顺序 `check-published` 证据，未重复运行视觉检查。

- 代码审查：Astra 复审 PASS（候选 `63c6bc9`，`artifacts/review-astra-t062.md`）。工作台「改后」截图预览框截止处为 iframe 固定 760px 内部滚动，非高度失同步（`artifacts/t062/workspace-height-*.json`）；默认顺序四个样子逐像素不变。

Claude 验收关闭（2026-10-01）。
