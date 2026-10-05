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
- 红测：在合并 T-090 的父提交 `3ac64c27bde3c32aa8387e7aa66181bd48419aac` 上，`tests/t109-illustrations-static.test.ts` 行为级失败（无图设备没有示意），证据首行绑定 SHA、命令和 UTC 时间：`artifacts/t109/red-t109-parent-3ac64c2.log`。修复后同一测试在最终 SHA 通过，并纳入全量。
- 主线：先快进合并 `family-kit-assembly`（`3ac64c27bde3c32aa8387e7aa66181bd48419aac`，含 T-090），功能提交为 `65ba3d517a2e1b6761d4b1a23b2d823dbb7854cb`。同步规则写入 `docs/project/mainline.md` 与 `docs/project/spec.md`；没有修改 `preview-bridge.ts`。
- 最终 SHA 证据（每份文件首行均写完整 SHA、命令、UTC 时间）：
  - build：`artifacts/t109/build-65ba3d5.log`，`npm run build`，PASS。
  - typecheck：`artifacts/t109/typecheck-65ba3d5.log`，`npm run typecheck`，PASS。
  - 全量：`artifacts/t109/npm-test-full-65ba3d5.log`，3035/headless-shell 环境下 `npm test`，810/810，PASS；同一时段只运行这一条全量。
  - 13 站：`artifacts/t109/check-published-65ba3d5.log` 与 `artifacts/t109/check-published-65ba3d5/report.json`，从主工作区清单逐站复制后运行，39/39 viewport rows、0 failures，PASS。基线逐行比较：`artifacts/t109/check-published-65ba3d5/compare-baseline.txt` 对 `/Users/luckye/Documents/Code/sitecraft-ai/artifacts/merge-104982b/check-published/report.json`，body-line 测量 955 对 955，逐行不少于基线。
  - 带图/无图对照：`artifacts/t109/hero-final-65ba3d5.log` 及其 crops（首屏无图为默认铭牌、带图为资料图，6/6 扫描通过）；`artifacts/t109/equipment-image-compare-65ba3d5.log` 及其截图（设备无图 `schematic=block`、带图 `schematic=none`，三档均通过）；设备区块扫描另见 `artifacts/t109/equipment-final-65ba3d5.log`。
- 状态保持 `open`，`claimed_by` 保持 `blocks-build`；不勾选最后一项，等待独立代码审查与 Claude 验收。
