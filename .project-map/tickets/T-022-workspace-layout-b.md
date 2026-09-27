---
id: T-022
title: 工作台改版：方向 B 布局与深浅主题
type: build
status: open
blocked_by: [T-019]
claimed_by:
supersedes:
---

## What to build

按原型方向 B 改工作台：预览居中，对话在右；样子盘和色板从左栏移走，改为对话里的卡片，以及输入框旁的「样子」「配色」按钮。深浅两套主题默认跟随系统，可以从 6 套色彩集选工作台强调色，与站点配色无关。同时清理评审 P1-7 到 P1-10 的问题：对话被挤压、看不出改了哪里、手机工具栏溢出、对内信息摆在用户面前。

## Acceptance

- [ ] 1440 宽：预览居中，对话在右，对话区占满剩余高度
- [ ] 深浅主题和强调色切换生效，站点预览的颜色不受影响
- [ ] 一次对话修改后，预览里标出改动的位置
- [ ] 界面上不出现模板 ID、模型名或英文开发标签
- [ ] 1440 / 768 截图交独立审核 agent 验收
- [ ] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [ ] 独立审核 agent（不是做这张票的 agent）验收通过，结论记在 Resolution

## Resolution

实现：工作台桌面布局改为预览主区 + 右侧对话区；样子/配色通过对话区按钮展开；新增跟随系统的深浅主题、6 套色彩集强调色切换，站点 iframe 仍使用草稿自己的 palette；内部模型名和 API 标签不再展示。

证据：`node scripts/check-workspace-layout.mjs overlay-p3i-thick-20260925 artifacts/workspace-t022-final`，1440/768 均读回右侧对话、居中预览、样子/配色按钮、主题和强调色控件，内部标签检查为 false；截图已查看。

实现提交：待提交后填写 SHA。
