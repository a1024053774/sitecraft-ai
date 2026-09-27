---
id: T-020
title: 6 套色彩集 × 4 个样子的色板
type: build
status: open
blocked_by: [T-018]
claimed_by: claude
supersedes:
---

## What to build

把现有 16 套按样子命名的色板归入 6 套色彩集，补齐缺的部分，共 24 套；每套检查对比度（正文和按钮白字都 ≥ 4.5:1），检查写成可以重跑的脚本。换色彩集走白名单 operation，可以撤销，不改版式和内容。工程工业族的色板在 T-018 定下新版式之后再调。

## Acceptance

- [x] 4 个样子 × 6 套色彩集都有色板，对比度脚本全部通过
- [x] 换色彩集后预览变色，版式和内容不变，撤销能恢复
- [ ] 每个样子挑 2 套色彩集截图（1440 / 375），交独立审核 agent 看是否协调
- [ ] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [ ] 独立审核 agent（不是做这张票的 agent）验收通过，结论记在 Resolution

## Resolution

2026-09-27，Claude。

- 色彩集写进 `lib/site-document.ts`（`colorSetCatalog`），色板 ID 为 `<样子前缀>-<色彩集>`，共 24 套；颜色值在各族 adapter 的 `kit.palettes`。工程工业的工程暖橙沿用原 `engineering-orange` 的颜色。每个样子有默认色彩集（工程工业：工程暖橙；其余：青花瓷）。
- 旧的 16 个色板 ID 在 `normalizeDraft` 读取时换成最接近的色彩集（本地存储里有 114 份草稿在用旧 ID），代码注释写明了删除条件。
- 删除了只对应旧色板的外部来源表；质量保证改为 `tests/palette-catalog.test.ts`：6 个色彩集在每个样子都有色板；正文和次文字对背景、表面，以及按钮白字对「overlay CSS 里主按钮实际用的 token」都 ≥ 4.5:1（原测试只查 accentStrong，漏了三个用 accent 的族）；旧 ID 读取后落到对应色彩集且不丢草稿。该测试在改动前的 HEAD 上失败。
- 工作台色板选择器改称「色彩集」，切换提示不再写死「工程工业版式」。

证据：
- `node scripts/seed-palette-samples.mjs` 用减速机样板的内容、只经 `replace_draft` → `set_visual_brief` → `set_palette` 建了 8 个样板（每个样子 2 套色彩集），`node scripts/check-published.mjs --out artifacts/published-check/t020-palettes <8 个站点>` 24/24 通过，截图同目录（1440 / 768 / 375）。
- 换色彩集与撤销：对 `palette-sample-engineering-patina` 经草稿 API 换成松石，内容长度与模板不变；调用撤销接口后回到铜锈。
- 在只含本票改动的 HEAD worktree 里：typecheck、build 通过；测试除 `tests/chat-route-conversation.test.ts`（该文件在纯 HEAD 上同样失败并会卡住，已转 Astra）外 226/226 通过。
