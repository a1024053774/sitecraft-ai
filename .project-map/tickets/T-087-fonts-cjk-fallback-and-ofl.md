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

- [x] 测试先写，并在父提交上能加载、在断言处失败：四个样子的字体栈都含中文回退；发布页没有外部字体请求；数据角色使用等宽字体（红测见 `artifacts/t087-red.txt`、`artifacts/t087-red-en.txt`；最终测试见 `artifacts/t087/fulltest-r2.txt`）
- [x] 四个样子 × 1440 / 768 / 375 截图（中英文各一套），对比改动前后，存 `artifacts/t087/`，每张打开看过；三家 `check-published` 通过（改动前见 `artifacts/t087/before/`，改动后见 `artifacts/t087/after-r2/` 和 `artifacts/t087/after-r2/contact-sheets/`；发布检查见 `artifacts/t087/published-check-r2-final2/report.json`）
- [x] `npm run typecheck`、`npm test`（经 `fulltest.sh`）、`npm run build` 通过（`artifacts/t087/fulltest-r2.txt`）
- [ ] 独立审核 agent 盲评字体改动前后（不是执行者），结果写进 Resolution
- [ ] 代码审查通过
- [ ] Claude 验收

## Resolution

- 中文回退先独立提交于 `4af51bc`：四个生产样子 token 统一显式包含 `PingFang SC`、`Hiragino Sans GB`、`Noto Sans SC`、`Microsoft YaHei`，中文字体没有自托管。
- 英文字体在 `804d3f3` 实现并由 `53b0522` 更新 project-map 验证点：工程工业用 Geist/Geist Mono，样本目录用 Manrope/JetBrains Mono，明快样子用 Sora 标题 + Manrope 正文 + JetBrains Mono 数据，灰底短路径用 Geist/Geist Mono。kit 固定 `fontFamilyId` / `headingFontFamilyId` / `dataFontFamilyId`，模型没有 `font-family` 写入路径；规格、型号、单位等数据角色走 `--site-data-font`。
- 字体源固定到 Vercel Geist 与 Google Fonts 仓库的 commit，生成 Latin-only woff2 实际字重，五个字体目录各带完整 `OFL.txt`、版权/版本/来源 `SOURCE.md`。预览 iframe 的 asset route 提供同源字体；工作台的旧 Google Fonts import 也改为同源字体，三家发布页网络报告只看到 localhost `.woff2` 请求（`artifacts/t087/published-font-requests-final.json`）。
- 红测命令：`node --test --experimental-strip-types tests/t087-fonts.test.ts` 在父提交 `8c960f0` 失败并保存为 `artifacts/t087-red.txt`；中文提交后英文红测失败保存为 `artifacts/t087-red-en.txt`。最终相关测试 19/19 通过。
- 最终验证（纽约时间 2026-10-03）：`npm run typecheck`、`npm run build` 通过；`zsh /Users/luckye/Documents/Code/sitecraft-ai/artifacts/research/threads-2026-10-03/briefs/fulltest.sh /Users/luckye/Documents/Code/sitecraft-ai-t087 3057 /Users/luckye/Documents/Code/sitecraft-ai-t087/artifacts/t087/fulltest-final.txt` 输出 `ℹ pass 669`, `ℹ fail 0`, `ℹ cancelled 0`；`SITECRAFT_BASE=http://localhost:3057 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node scripts/check-published.mjs --out artifacts/t087/published-check-final` 三家 × 三档宽度通过。
- 截图使用父提交 `8c960f0` 的临时 3059 server 与最终 3057 server，四个样子、中英文、1440/768/375 各 24 张；脚本等待预览 bridge、`document.fonts.ready` 和稳定整页高度，并验证目标字体状态为 `loaded`。每张已在 `artifacts/t087/contact-sheets/` 打开检查，中文由 CJK 回退栈正常显示。
- 独立盲评、代码审查和 Claude 验收尚未完成，票保持 `open`。

### T-087 r2（2026-10-03，纽约时间）

- 代码审查指出工作台 CSS 被根布局带进发布宿主；已在 `a1a1b2d` 恢复起点 `app/globals.css`（Manrope 400–800、DM Mono、Noto Sans SC）并把它复制为 `public/workspace.css`，`components/workspace-style-gate.tsx` 在 `fb94043` 中只向工作台路径挂载该 CSS；发布/模板预览宿主改用无字体的 `public/visitor-host.css`（`dbeac79`），iframe 继续走区块库同源字体。发布 HTML 不再出现 `app_globals`，工作台仍加载 `workspace.css`。
- `nordic-store` 的无关字体 token 已恢复为起点值；四个生产样子不变。
- `scripts/subset-site-fonts.py` 固定 FontTools/pyftsubset、Unicode 范围、变量字体实例化字重和输出文件；`scripts/check-site-fonts.py` 通过 fontTools cmap 审计四个 kit 的实际字体，断言无 CJK、含 `© ® ° ± × – — €`，并逐 kit 验证数据字体映射。每个 `SOURCE.md` 记录同一复现命令和工具版本。
- 标题根因修复在 `dc95f57`：T-063 的字符宽度估算改为用实际加载字体测量最长 run；catalog 开启 `fitText: "container"`，工程工业增加窄屏标题上限 `clamp(30px, 8vw, 34px)`，fit 标题用 `text-wrap: balance` 且保留 keep-all，forge 将 `word-break` 从 `break-all` 改为 `normal`，避免英文词中断。T-063、区块布局和短路径适配测试通过。
- r2 证据：改动后截图和联系表在 `artifacts/t087/after-r2/`；`check-published` 输出 `artifacts/t087/published-check-r2-final2/report.json`；主线 12 站检查输出 `artifacts/t087/mainline-r2-final2/`（`NEW_failures=0`）；最终 `fulltest.sh` 输出 `artifacts/t087/fulltest-r2.txt`，`671 pass / 0 fail`；最终 build 和 typecheck 通过。
- 负载高峰期间曾有一次 workspace motion 间歇失败，原始输出保留在 `artifacts/t087/fulltest-r2-failure.txt`；同一测试独立重跑 `workspace-motion-r2-final.txt` 为 5/5，降低负载后 fulltest 重跑为 671/671，未改测试辅助文件。
