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
- 当前运行时代码 `97b1734b14dd66e6dba54c981b98abefbdf76e19` 的发布调查（2026-10-05 UTC）：12 个当前 v3 有效站点在 `/tmp` 隔离副本中执行原版 `check-published.mjs`；36 行为 12 站 × 3 视口，每行包含中英文结果（72 张截图），`0 failures`、中英文事实 `missing=0`。报告完成时间 `2026-10-05T19:50:35Z`；完整命令、报告和截图归档于 gitignore 的 `artifacts/t109/check-published-boundary-2eaedf9/valid-12/`，汇总见该目录上一级的 `summary.md`。原始 stdout 未单独保存，`run.log` 是报告派生结果。源站点资料未改。
- 带图验收仍为 INCOMPLETE：当前 5 个带图片记录的站点中，`overlay-p3i-thick-20260925` 和 `blind-p3i-20260920-withimage` 迁移失败；`p3-img-hx4k` 三档因旧 Forge/demo 文案失败且均 `photoCount=0`；两个 `t2chat-*` 草稿无图片引用，三档虽通过但均 `photoCount=0`。所有图片记录的 `usageCategory` 缺失，未形成真实带图站 `photoCount>0` 的通过证据。逐站清单、报告和命令保存在 `artifacts/t109/check-published-boundary-2eaedf9/`。
- 原始 overlay 失败保留：2026-10-05T19:37:47Z，现有 3034 服务返回 HTTP 500，`SiteMigrationError` 指向 `history.107fc3d5-6b32-4631-a732-8d61989a3b6e.productTarget` 的 `intro`，旧 history target 被按 SKU 匹配而没有唯一产品；原始日志仍在 `artifacts/t109/check-published-incomplete-d27d0818951ee06f2577ec172c526ab1fa759be1.log`，本次响应与边界摘要归档于 `artifacts/t109/check-published-boundary-2eaedf9/`。未改脚本、旧数据或检查规则绕过失败。
- 状态保持 `open`，`claimed_by` 保持 `blocks-build`；两个验收框均未勾选，带图发布边界、独立代码审查与 Claude 验收仍待完成。本次只记录文档和证据，不推送，`.claude/` 未跟踪目录保留。
