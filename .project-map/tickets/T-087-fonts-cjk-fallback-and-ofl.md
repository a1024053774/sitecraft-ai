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

- [x] 测试先写，并在父提交上能加载、在断言处失败：四个样子的字体栈都含中文回退；发布页没有外部字体请求；数据角色使用等宽字体；字体晚到时序、Python 3.9 子集脚本、forge Sora cmap 和四样子标题矩阵的红绿证据见 `artifacts/t087/red-r3-focused.txt`、`artifacts/t087/cmap-r3-python39.json`、`artifacts/t087/focused-r3-merged.txt`、`artifacts/t087/fulltest-r3-merged.txt`
- [x] 四个样子 × 1440 / 768 / 375 截图（中英文各一套），改动后存 `artifacts/t087/after-r3/`，联系表在 `artifacts/t087/after-r3/contact-sheets/`，脚本检查 `document.fonts.status`、对应字体 `loaded`、预览就绪和稳定整页高度；三家 `check-published` 见 `artifacts/t087/published-check-r3/report.json`
- [x] `npm run typecheck`、`npm test`（经 `fulltest.sh`）、`npm run build` 通过（`artifacts/t087/typecheck-r3-merged.txt`、`artifacts/t087/fulltest-r3-merged.txt`、`artifacts/t087/build-r3-merged.txt`）
- [ ] 独立审核 agent 盲评字体改动前后（不是执行者），结果写进 Resolution
- [ ] 代码审查通过
- [ ] Claude 验收

## Resolution

- 当前交付由 `ceb57e2`（T-087 第 3 轮修复）和合并 `c443a4e` 后的 `d37e4bc`（未改 `MERGE-REQUESTS.md`）组成。中文仍由 `PingFang SC`、`Hiragino Sans GB`、`Noto Sans SC`、`Microsoft YaHei` 回退，中文字体不自托管；四个生产样子继续使用各自固定的 OFL 拉丁字体和 `--site-data-font` 数据角色。
- `lib/template-adapters/preview-bridge.ts` 不再在 slot 写入时用回退字体测量标题；先登记 fit 目标，等待 `document.fonts.ready` 后测量，`FontFaceSet` 的 `loadingdone` 再次测量并更新 `--sitecraft-title-run` / `--sitecraft-brand-run`。`tests/t063-hero-title-fit.test.ts` 的延迟 FontFaceSet 夹具在 ready 前无写入、ready 后首次写入、loadingdone 后重写。
- `scripts/subset-site-fonts.py` 去掉 Python 3.10 专有的 `zip(strict=...)`，保留权重/文件数量校验；项目 Python 3.9.6 可编译。`scripts/check-site-fonts.py` 按 body/heading/data 角色审计四个 kit，forge 明确审计 `sora-700-latin.woff2`；每个文件仍断言无 CJK 且含 `© ® ° ± × – — €`。
- `tests/t087-look-title-behavior.test.ts` 真实打开四个预览样子，覆盖中文/英文和 1440/768/375，等待字体加载后断言标题有行框、无视口溢出/裁切、无 `break-all`，并检查对应 heading/data 字体可加载。
- 证据（纽约时间 2026-10-04，验证时 HEAD `d37e4bc`）：红测命令 `node --test --experimental-strip-types tests/t087-fonts.test.ts tests/t063-hero-title-fit.test.ts --test-name-pattern='T-063 uses declared|committed Latin subsets|font subset recipe'` 输出 `artifacts/t087/red-r3-focused.txt`；聚焦绿测命令 `SITECRAFT_BASE=http://localhost:3057 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --test --experimental-strip-types tests/t063-hero-title-fit.test.ts tests/t087-fonts.test.ts tests/t087-look-title-behavior.test.ts tests/template-preview-bridge.test.ts` 输出 `artifacts/t087/focused-r3-merged.txt`；`python3 -m py_compile scripts/subset-site-fonts.py scripts/check-site-fonts.py && python3 scripts/check-site-fonts.py` 输出 `artifacts/t087/cmap-r3-python39.json`；`npm run typecheck` 输出 `artifacts/t087/typecheck-r3-merged.txt`；`npm run build` 输出 `artifacts/t087/build-r3-merged.txt`；`zsh /Users/luckye/Documents/Code/sitecraft-ai/artifacts/research/threads-2026-10-03/briefs/fulltest.sh /Users/luckye/Documents/Code/sitecraft-ai-t087 3057 /Users/luckye/Documents/Code/sitecraft-ai-t087/artifacts/t087/fulltest-r3-merged.txt` 为 `734 pass / 0 fail / 0 cancelled`；`zsh /Users/luckye/Documents/Code/sitecraft-ai/artifacts/research/threads-2026-10-03/briefs/check-mainline-sites.sh /Users/luckye/Documents/Code/sitecraft-ai-t087 3057 /Users/luckye/Documents/Code/sitecraft-ai-t087/artifacts/t087/mainline-r3-merged` 退出 0，`rows=36 known_failures=0 NEW_failures=0`，报告为 `report.json`；三家 `SITECRAFT_BASE=http://localhost:3057 CHROME_PATH=... node scripts/check-published.mjs --out artifacts/t087/published-check-r3` 为 `report.json`；截图命令 `SITECRAFT_BASE=http://localhost:3057 T087_OUT=/Users/luckye/Documents/Code/sitecraft-ai-t087/artifacts/t087/after-r3 T087_PHASE=after-r3 CHROME_PATH=... node /tmp/t087-capture.mjs` 生成 24 张 after-r3 截图和联系表，脚本检查 preview ready、整页高度稳定和字体 `loaded`，每张已打开检查。
- 独立盲评、代码审查和 Claude 验收仍未完成，票保持 `open`。
