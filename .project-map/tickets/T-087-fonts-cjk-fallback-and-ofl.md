---
id: T-087
title: 字体：补中文回退栈，英文按样子用自托管的 OFL 字体
type: build
status: closed
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

- [x] 测试先写，并在父提交上能加载、在断言处失败：四个样子的字体栈都含中文回退；发布页没有外部字体请求；数据角色使用等宽字体；字体晚到时序、Python 3.9 子集脚本、forge Sora cmap、四样子标题矩阵和 visitor-host 控件样式的红绿证据见 `artifacts/t087/red-r3-focused.txt`、`artifacts/t087/cmap-r3-python39.json`、`artifacts/t087/focused-p1.txt`、`artifacts/t087/visitor-host-red.txt`、`artifacts/t087/fulltest-p1.txt`
- [x] 四个样子 × 1440 / 768 / 375 截图（中英文各一套），改动后存 `artifacts/t087/after-r3/`，与 `c443a4e` 结构同基线的 evidence-only before-r3 存 `artifacts/t087/before-r3/`，联系表在各自 `contact-sheets/`；脚本检查 `document.fonts.status`、对应字体 `loaded`、预览就绪和稳定整页高度；三家 `check-published` 见 `artifacts/t087/published-check-p1/report.json`
- [x] `npm run typecheck`、`npm test`（经 `fulltest.sh`）、`npm run build` 通过（`artifacts/t087/typecheck-p1.txt`、`artifacts/t087/fulltest-p1.txt`、`artifacts/t087/build-p1.txt`）
- [x] 独立审核 agent 盲评字体改动前后（不是执行者），有效结果为 `reviews/T-087-blind-3b.md`（PASS）；旧 `reviews/T-087-blind-3.md` 保留为基线错位失败证据
- [x] 代码审查通过（`reviews/T-087-review-4.md`，PASS，P0/P1=0）
- [x] Claude 验收

## Resolution

- 当前交付代码为 `ceb57e2`、合并主线 `c443a4e` 的 `d37e4bc`，以及 review-3 P1 修复 `b16bb63`；未改 `MERGE-REQUESTS.md`。中文回退和四个样子的 OFL 拉丁字体、`--site-data-font` 数据角色保持不变。
- `b16bb63` 在 `public/visitor-host.css` 增加模板预览实际使用的 `.icon-button`、`.primary-button`、`.secondary-button`、`.template-tag` 基础/焦点/悬停样式；`tests/visitor-host.test.ts` 先在缺失定义上红，修复后断言通过。预览宿主仍只静态加载 visitor-host CSS，没有重新加载工作台全局 CSS。
- review-3 盲评所见的 1440 产品卡右列摘要不是 T-087 字体回归：该 CSS 来自主线 `c4834d3`（T-101），且在 `c443a4e` 中；`git diff c443a4e..HEAD -- lib/blocks/fragments/products.ts` 为空。裸 `c443a4e` 缺少 T-087 自托管字体，故用未入库的 `/tmp/t087-capture-before-c443.mjs` evidence-only 副本跳过 `requiredFaces` 硬门生成 `artifacts/t087/before-r3/`，结构与 after-r3 对齐。
- `lib/template-adapters/preview-bridge.ts` 的标题测量等待 `document.fonts.ready`，并在 `loadingdone` 重测；`scripts/subset-site-fonts.py` 兼容 Python 3.9；cmap 审计覆盖 forge Sora；四样子矩阵测试覆盖中英文和 1440/768/375。
- 证据（纽约时间 2026-10-04，验证代码 HEAD `b16bb63`）：红测 `node --test --experimental-strip-types tests/visitor-host.test.ts` 输出 `artifacts/t087/visitor-host-red.txt`；聚焦绿测命令 `SITECRAFT_BASE=http://localhost:3057 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --test --experimental-strip-types tests/visitor-host.test.ts tests/t063-hero-title-fit.test.ts tests/t087-fonts.test.ts tests/t087-look-title-behavior.test.ts tests/template-preview-bridge.test.ts` 为 `37 pass / 0 fail`，输出 `artifacts/t087/focused-p1.txt`；`npm run typecheck` 输出 `artifacts/t087/typecheck-p1.txt`；`npm run build` 输出 `artifacts/t087/build-p1.txt`；`zsh /Users/luckye/Documents/Code/sitecraft-ai/artifacts/research/threads-2026-10-03/briefs/fulltest.sh /Users/luckye/Documents/Code/sitecraft-ai-t087 3057 /Users/luckye/Documents/Code/sitecraft-ai-t087/artifacts/t087/fulltest-p1.txt` 为 `735 pass / 0 fail / 0 cancelled`；`zsh /Users/luckye/Documents/Code/sitecraft-ai/artifacts/research/threads-2026-10-03/briefs/check-mainline-sites.sh /Users/luckye/Documents/Code/sitecraft-ai-t087 3057 /Users/luckye/Documents/Code/sitecraft-ai-t087/artifacts/t087/mainline-p1` 退出 0，`rows=36 known_failures=0 NEW_failures=0`；三家发布检查 `SITECRAFT_BASE=http://localhost:3057 CHROME_PATH=... node scripts/check-published.mjs --out artifacts/t087/published-check-p1` 为 `report.json`；`artifacts/t087/before-r3/` 为 c443a4e evidence-only 基线，`after-r3/` 为当前字体版本，均为 24 张截图并已打开检查。
- 独立盲评：`reviews/T-087-blind-3.md` 的 REVISE 结论来自旧 before 快照与 c443a4e 主线结构错位，保留作基线错位证据；使用 c443a4e evidence-only before-r3 后，`reviews/T-087-blind-3b.md` 判定 PASS。代码审查 `reviews/T-087-review-4.md` 判定 PASS，P0/P1=0；Claude 验收仍未完成，票保持 `open`。

### 主控合并复验与关闭（Claude，2026-10-04 EDT）
- 合并主线 `222da66`；与 T-088 的色板夹具语义冲突由 `510e46c` 修复（Astra PASS，`artifacts/review-astra-t088-fixture.md`）。路由移入 `app/(workspace)/` 后 MAP 的 spec 监视路径已改。字体许可：5 款均 OFL 1.1、无保留字体名，来源钉到上游提交。主工作区 3034：`1b83785`（fields 合并）build、typecheck 通过，12 站 `check-published` 36 行 0 失败且逐行实测条数不少于基线（`artifacts/merge-1b83785/`）；夹具修复后 `3264022` 全量 770/770（`artifacts/merge-3264022/`）。 Claude 验收关闭。
