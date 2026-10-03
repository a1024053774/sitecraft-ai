---
id: T-087
title: 字体：补中文回退栈，英文按样子用自托管的 OFL 字体
type: build
status: open
blocked_by: [T-084, T-081]
claimed_by: exec-t087
supersedes:
---

## What to build

依据 [R5 调研](../../docs/research/前端收藏调研-2026-10-03/R5-icons-fonts.md) 3.5–3.6 节。T-081 合回主线后再从主线拉分支（两边都改 `lib/blocks/looks/*`）。

1. **中文回退**：样本目录（landwind）、明快（forge）、灰底短路径（tailwind-landing）三个 kit 的 `font` token 现在没有中文字体名（`lib/template-adapters/registry.ts`），补成和工程工业一致的中文回退（苹方、Noto Sans SC、微软雅黑等）。先单独提交。
2. **英文字体**：每个样子一组 OFL 字体，首选：工程工业 Geist + Geist Mono；样本目录 Manrope + JetBrains Mono；明快 Sora 标题 + Manrope 正文；灰底短路径 Geist + Geist Mono。等宽字体只用于参数、型号、单位这些数据角色。字体由 token 或 kit 数据里的固定 id 选择，模型不能写 `font-family`（`lib/blocks/site-style.ts` 已禁止，保持）。
3. **自托管**：woff2 由本站同源提供，只加载实际用到的字重并做拉丁子集；每个字体的 OFL 许可文件、版权、版本随字体文件放在一起。发布页不出现 Google Fonts 等外部字体请求。中文字体本票不自托管。

## Acceptance

- [ ] 测试先写，并在父提交上能加载、在断言处失败：四个样子的字体栈都含中文回退；发布页没有外部字体请求；数据角色使用等宽字体
- [ ] 四个样子 × 1440 / 768 / 375 截图（中英文各一套），对比改动前后，存 `artifacts/t087/`，每张打开看过；三家 `check-published` 通过
- [ ] 独立审核 agent 盲评字体改动前后（不是执行者），结果写进 Resolution；`npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收

## Resolution
