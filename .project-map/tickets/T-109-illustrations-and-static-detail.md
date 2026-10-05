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

- 独立盲评结论保留：`artifacts/blocks-pool/t109-equipment-line-art/review-1.md` 的设备线稿 ACCEPT；`artifacts/blocks-pool/t109-product-line-art/review-2.md` 的产品卡底部细线 ACCEPT；`artifacts/blocks-pool/t109-hero-r4/review-3.md` 的首屏线稿 REJECT。最终成品只保留设备无图位的同族内联 SVG 示意与产品卡底部细线。
- 当前代码提交 `97b1734b14dd66e6dba54c981b98abefbdf76e19`：engineering、bright/forge、catalog、short-path 四个 look 分别声明 `--site-diagram-stroke`（2px、1px、2px、1px）；equipment schematic 的 CSS `stroke-width` 直接读取该 token，覆盖 SVG 原有 4px presentation attribute。线宽随样子 token 的 P2 已在根因层解决，没有新增 renderer 或外部资源。
- 当前 focused test 覆盖四个生产 look、zh/en、无图/带图、1440/768/375，并保留 hero nameplate、无 hero schematic、product bottom rule、`--site-rule`；新增 schematic `--site-diagram-stroke` 非空、实际 computed SVG stroke width 为正且与 token 数值一致的断言。最终 focused 证据：`artifacts/t109/green-t109-97b1734b14dd66e6dba54c981b98abefbdf76e19.log`，完整 SHA/UTC/命令/退出码在首行。
- 当前候选的 counterfactual 红测：在缺少 stroke token 的 `de47ad33fe69cc2a4d54371f5e955182ddbe31d6` 上，用同一最新 focused test 因 schematic stroke token 为空而失败；证据为 `artifacts/t109/red-t109-stroke-token-de47ad3.log`。更早 parent 的示意缺失红测仍保留在 `artifacts/t109/red-t109-current-test-parent-3ac64c2.log`。
- 当前候选 `97b1734b14dd66e6dba54c981b98abefbdf76e19` 的全量验证：`artifacts/t109/final-typecheck-97b1734.log`（`npm run typecheck`，PASS）、`artifacts/t109/final-build-97b1734.log`（`npm run build`，PASS；保留既有 Turbopack warning）、`artifacts/t109/final-npm-test-97b1734.log`（`npm test`，810/810，PASS）。T-074 fragment token ratchet 的 `KNOWN_GAPS` 已清空，所有当前 fragment token 在四个 look 解析通过。
- 发布边界仍为 INCOMPLETE：真实 `check-published.mjs` 对带图站的既有尝试返回开发服务 HTTP 500，随后预览 iframe/Chrome DevTools 等待超时，未生成 report；没有改脚本绕过，记录保留在 `artifacts/t109/check-published-incomplete-d27d0818951ee06f2577ec172c526ab1fa759be1.log`。
- 状态保持 `open`，`claimed_by` 保持 `blocks-build`；未勾选最后验收框，等待独立代码审查与 Claude 验收。未推送，`.claude/` 未跟踪目录保留。
