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

- 红测证据：`artifacts/t062/red-step1.txt` 覆盖旧五项列表和旧 `reorder_sections` schema；`artifacts/t062/red-step2.txt` 覆盖桥忽略显式顺序；`artifacts/t062/red-step3.txt` 覆盖提示、精简上下文和发布页顺序断言。实现分为 `cf45b48`（数据、schema、operation、`effectiveBlockOrder`）、`b23dfe9`（adapter 分组、桥排序、导航/菜单/页脚导航）、`a5058a4`（提示、精简上下文、check-published 顺序断言），文档提交为 `2890d5a`。
- 桥在默认草稿没有 `sectionOrder` 时直接返回，默认节点不移动；显式顺序只作用于区块库四个样子。应用行业与加工能力整组移动，组内遵循请求顺序；首屏、导航、页脚固定，导航右侧询盘按钮保留原位。旧五项列表在读取时删除，不保留兼容字段或旧操作语义。
- 最终验收均在 `2890d5a` 之后生成：`npm test` 532/532、0 失败/0 跳过（`artifacts/t062/full-final-2890d5a.log`）；`npm run typecheck` 和 `npm run build` 通过（对应日志）。
- 默认页逐像素对照：工程工业 66/66、明亮产品 9/9、蓝白目录 9/9、灰底短路径 9/9 均零差异；报告目录分别为 `artifacts/t062/engineering-default-eb95da0/`、`forge-default-eb95da0/`、`landwind-default-eb95da0/`、`tailwind-default-eb95da0/`。对照基线为 T-062 开工前 `eb95da0`，旧计划中的 `98f713b` 已过时，未用于不相称的旧 overlay 对照。
- 非默认顺序版面扫描覆盖四个样子 × 6 种顺序 × 1440/768/375，共 72 组，新增横向溢出、文字重叠均为 0；报告 `artifacts/t062/order-scan-a5058a4/report.json`。
- 工作台真实 DeepSeek 对话使用工程工业站点 `bb35a941-087c-4ed6-8ef9-e5ff24417289`，消息「把认证放到产品前面」实际保存 v8，随后撤销回 v9；改前、改后、撤销截图分别为 `artifacts/t062/workspace-order-before.png`、`workspace-order-after.png`、`workspace-order-undo.png`。改后工作台摘要明确写出认证、产品、并排组、合作方式、常见问题、询盘的新顺序。
- 同一站点的访客页顺序检查在中英文三档均通过：默认报告 `artifacts/t062/published-final-2890d5a/`，显式「认证在产品前」报告 `artifacts/t062/published-order-2890d5a/`；顺序断言由 `scripts/check-published.mjs` 执行，所有页面检查无失败。
- 工作台高度复核：在同一站点默认顺序与显式顺序分别等待 `data-preview-state=ready` 后测量，两个状态的 iframe 外层高度均为 760px、iframe 内 `document.documentElement.scrollHeight` 均为 3551px，顺序分别为默认与「认证、产品、应用行业、加工能力、合作方式、常见问题、询盘」；记录见 `artifacts/t062/workspace-height-default.json`、`workspace-height-reordered.json`。因此没有重排后高度不同的代码回归，疑点是固定 760px 工作台预览框的滚动位置/截图时序，不新增桥高度同步逻辑。重拍截图前先等待 ready，再把 iframe 内页滚到底，改前/改后/撤销证据为 `artifacts/t062/workspace-order-before-r3.png`、`workspace-order-after-r3.png`、`workspace-order-undo-r3.png`；截图均包含预览底部和页脚，改后图显示认证先于产品，三张生成时间晚于本轮复核。
