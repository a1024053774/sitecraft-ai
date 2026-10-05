---
id: T-109
title: 同风格示意图与静态细节质感
type: build
status: open
blocked_by: [T-107, T-108]
claimed_by: blocks-build
supersedes:
---

## What to build

T-104 第 ④ 步。资料没图而版式需要图的位置，用 Codex 按样子 token 画的线稿式 SVG 示意图，风格要符合当前页面，能看出是示意、不冒充实拍；并做静态细节质感（排版层级、数字 / 参数排法、分隔线与表面处理、卡片细节），不做动效。示意图和细节改动都过盲评，示意图不过就删。

## Acceptance

- [ ] 示意图只出现在资料无图的位置；四个样子各自风格一致；盲评与无图版对比不输
- [ ] 12 站 + 带图资料站 `check-published` 通过；全量、typecheck、build 通过；代码审查通过；Claude 验收

## Resolution

- 盲评结论：`artifacts/blocks-pool/t109-equipment-line-art/review-1.md` 的设备线稿 ACCEPT；`artifacts/blocks-pool/t109-product-line-art/review-2.md` 的产品卡底部细线 ACCEPT；`artifacts/blocks-pool/t109-hero-r4/review-3.md` 首屏线稿 REJECT；检测线稿、通用图片占位和产品线稿按 T-104 删除。最终只保留设备无图位的同族内联 SVG 示意（旁标「示意」）与产品卡底部细线，首屏恢复默认铭牌/照片逻辑。
- 红测：在已知坏 parent `3ac64c27bde3c32aa8387e7aa66181bd48419aac` 的独立 worktree 上，用当前 focused 测试真实失败（无图设备示意为 `display: none`）；完整日志（SHA、UTC、命令、退出码 1）为 `artifacts/t109/red-t109-parent-3ac64c2.log`。
- 修复提交：`d27d0818951ee06f2577ec172c526ab1fa759be1`。`lib/template-adapters/preview-bridge.ts` 在唯一渲染路径按 locale 更新设备示意的可见 label 和 `aria-label`；`equipment.ts` 仅接入已有 `--site-diagram`、`--site-surface`、`--site-rule` token，保留既有 SVG 的 4px 固定线宽。当前 token 没有独立线宽语义，因此“线宽随样子 token”仍是 P2 未证明项，没有凭空新增 token。
- focused 测试补回已接受的静态结果断言后，在新提交 `df797a09f779787536ae4caa5240b548bd6b4ea5` 通过：`artifacts/t109/green-t109-df797a09f779787536ae4caa5240b548bd6b4ea5.log`。除三档宽度 × 四个生产样子（screwfast、forge、landwind、tailwind-landing）× zh/en 无图和同一第七参数 `images` 的带图分支外，每个真实预览条件还断言无图 hero 保持 `nameplate`、nameplate 未隐藏且没有 hero schematic 的 before/after 伪元素；产品卡存在且 `box-shadow` 保留非 `none` 的底部细线。带图显示资料图并隐藏设备示意，无图显示对应 locale 的「示意」/`Schematic` 与 aria-label，横向溢出断言仍通过。
- 同一修复提交的 broader checks（每份日志首行绑定完整 SHA、命令和 UTC）：`artifacts/t109/typecheck-d27d0818951ee06f2577ec172c526ab1fa759be1.log`（`npm run typecheck`，PASS）、`artifacts/t109/build-d27d0818951ee06f2577ec172c526ab1fa759be1.log`（`npm run build`，PASS；保留既有 Turbopack 动态路径 warning）、`artifacts/t109/npm-test-full-d27d0818951ee06f2577ec172c526ab1fa759be1.log`（`npm test`，810/810，PASS）。
- 发布边界仍为 INCOMPLETE：`artifacts/t109/check-published-incomplete-d27d0818951ee06f2577ec172c526ab1fa759be1.log` 记录真实 `check-published.mjs` 对带图站 `overlay-p3i-thick-20260925` 的尝试。开发服务返回 HTTP 500，随后预览 iframe 和 Chrome DevTools 等待超时，未生成 report；没有改脚本绕过。四样子/无图与带图渲染由上述 focused 浏览器测试证明，真实发布页规则尚未证明。
- 状态保持 `open`，`claimed_by` 保持 `blocks-build`；未勾选最后验收框，等待独立代码审查与 Claude 验收。当前没有使用旧的 `equipmentMask` 日志冒充本次测试。
