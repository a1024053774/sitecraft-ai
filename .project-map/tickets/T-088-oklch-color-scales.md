---
id: T-088
title: 用 OKLCH 把种子色展开成完整色阶，替换自定义品牌色的 HSL 算法
type: build
status: open
blocked_by: [T-084]
claimed_by: rs-color
supersedes:
---

## What to build

依据 [R2 调研](../../docs/research/前端收藏调研-2026-10-03/R2-color-sets.md) 第 4、6 节。不新增用户可选的色彩集。

- 新增 `lib/color-scale.ts`：HEX ↔ OKLCH、超出 sRGB 时降低彩度、从种子色生成中性色和主色色阶、角色分配（background / surface / text / muted / border / diagram / tint / accent / accentStrong / accentSoft），逐项检查 WCAG 对比度（正文、次要文字、白字按钮），找不到达标档时拒绝并给出原因。不新增依赖。
- `lib/custom-brand-color.ts` 改用它生成自定义品牌色色板，保留 source / sourceColor / 调整说明，撤销行为不变。输出仍是现有的 token 角色字段，`TemplateKitTokens` 不加新字段；只有出现第二个真实使用者时才加色阶数据。
- 现有 24 套色板（6 套色彩集 × 4 个样子）数值不变，回归测试保证。

## Acceptance

- [x] 测试先写，并在父提交上能加载、在断言处失败：用 R2 的 S007、S021、C16 和 3 个难色（很浅的黄、很亮的绿、接近黑的蓝）当输入，正文 ≥ 4.5:1、白字按钮 ≥ 4.5:1；无法达标时返回拒绝原因而不是静默改色；现有 24 套色板不变
- [x] 工作台输入 3 个自定义品牌色，四个样子 × 1440 / 768 / 375 截图存 `artifacts/t088/`，每张打开看过；三家 `check-published` 通过
- [ ] `npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收

## Resolution

2026-10-03 14:40 EDT，rs-color：

- 新增 `lib/color-scale.ts`，实现 HEX↔OKLCH、sRGB 色域内降低彩度、11 档中性/主色阶、角色映射和逐项 WCAG 4.5:1 检查；失败返回 reason/failures，不静默改色。
- `lib/custom-brand-color.ts` 改用该模块，保留现有 `CustomPalette` 角色、source/sourceColor、调整说明和 `commitOperations` 撤销路径；未改 `TemplateKitTokens` 或 registry 的 24 套预设数值。
- 红测：`node --test --experimental-strip-types tests/t088-color-scales.test.ts` 在父提交加最小桩时 2 项行为断言失败、24 套基线断言通过，原始输出 `artifacts/t088-red.txt`。修复后同测 4/4 通过；与现有自定义色板/24 套回归合跑 10/10 通过。
- 工作台证据：真实 UI 输入 `#f4fbff`、`#111827`、`#39ff88`，四个样子各在 1440/768/375 等待 preview hydrated 后截图，共 12 张，报告和截图在 `artifacts/t088/workbench-4/`；三张代表截图已打开查看，12 张已用 contact sheet 检查。
- 发布页：`SITECRAFT_BASE=http://localhost:3052 CHROME_PATH=... node scripts/check-published.mjs --out artifacts/t088/published-check`，三家样板 9/9 宽度检查通过，报告在 `artifacts/t088/published-check/report.json`。
- `npm run typecheck` PASS；`npm run build` PASS。全量 `npm test` 首轮 658 项中 652 通过、6 项资产读取失败，逐项单测后均通过；第二轮 658 项中 657 通过、1 项 `workspace-interaction` 动效检查受无头 Chrome 时序影响失败，随后聚焦该文件在当前代码 5/5 通过。父提交对照输出在 `artifacts/t088/workspace-interaction-parent.txt`，父提交动效本身通过但 server identity 超时于另一测试；因此全量 npm test 仍记为 INCOMPLETE，未勾第三项。

2026-10-03 15:10 EDT，主控退回后补证：

- `lib/custom-brand-color.ts` 的 adjustmentNote 改为用户语言，不再出现 OKLCH/sRGB/WCAG；新增断言覆盖，相关单测 11/11 通过。
- 重新按三个颜色分别跑真实工作台：`artifacts/t088/workbench-r2/report.json` 记录 36 张截图，三色各四个样子 × 1440/768/375；375 截图先点击「预览」标签，报告中 36 张均 hydrated、frame 宽高非零且 stableHeight=true。三个 contact sheet 为 `f4fbff-contact.png`、`111827-contact.png`、`39ff88-contact.png`，均已打开查看；三种输入均保存成功并显示“已按你的主色生成整套配色，并把按钮颜色调深一点，保证白字看得清”。
- 使用 `/Users/luckye/Documents/Code/sitecraft-ai/artifacts/research/threads-2026-10-03/briefs/fulltest.sh /Users/luckye/Documents/Code/sitecraft-ai-t088 3052 artifacts/t088/npm-test-r3.txt`（通过 bash 调用以避开脚本在 zsh 下使用保留变量 status 的包装器退出问题），输出为 659/659 PASS；全量输出在 `artifacts/t088/npm-test-r3.txt`。

2026-10-03 15:20 EDT，第二次返工：

- 强调色改为优先取与种子 OKLCH 明度最接近、且白字 ≥4.5:1 的档；种子本身达标且不贴近正文时直接保留。`#111827` 现在保持为 accent，adjusted=false；浅色和亮绿色种子按实际方向调深。三种方向说明由实际明度差生成，新增测试覆盖，单测 11/11 通过。
- 使用 `tests/fixtures/pack-drafts.ts` 的 `packDraft("molding")` 注塑厚资料站点（5 个产品、参数、行业、能力、认证）重截：报告 `artifacts/t088/workbench-molding-r3/report.json`，36 张截图均 hydrated、frame 非零、stableHeight=true；`f4fbff-contact.png`、`111827-contact.png`、`39ff88-contact.png` 已打开查看。三色调整结果见 `adjustment-notes.json`。
- `bash /Users/luckye/Documents/Code/sitecraft-ai/artifacts/research/threads-2026-10-03/briefs/fulltest.sh /Users/luckye/Documents/Code/sitecraft-ai-t088 3052 artifacts/t088/npm-test-r4.txt` 输出 659/659 PASS；当前提交的 typecheck/build 输出为 `artifacts/t088/typecheck-r4.txt`、`artifacts/t088/build-r4.txt`。

2026-10-03 20:20 EDT，独立代码审查 P1 修复：

- 增加 accentText 与 plate-copy 语义分离：按钮使用 accentText，浅色参数块使用正文色，工程工业深色参数块使用 accentText；实际落点检查覆盖按钮、参数块、次按钮、链接和标签。commitOperations 在 set_custom_palette 提交边界复用 validateColorPalette，非法色板返回 rejected 且不写草稿。
- border 改为 neutral-300（索引 3）；测试改用独立 WCAG 实现与外部 OKLCH 参考值，并加入深色/浅色哨兵和实际四样子落点断言。红测旧实现输出在 artifacts/t088/button-contrast-red.txt。
- 注塑厚资料站点最终截图报告为 artifacts/t088/workbench-molding-r7/report.json，三色 × 四样子 × 三档共 36 张；f4fbff-contact.png、111827-contact.png、39ff88-contact.png 已打开查看，export-catalog 不再出现空预览。
- 交付前 fulltest.sh 输出 artifacts/t088/npm-test-r5.txt（661/661 PASS）；主线 12 站检查用 zsh 调用 check-mainline-sites.sh，报告 artifacts/t088/mainline-check-r4/report.json，rows=36、known_failures=0、NEW_failures=0。

2026-10-03 16:15 EDT，第三轮返工：

- 根因修复：新增可选 `accentText` 语义 token；四个样子的 `--site-plate-ink` 统一读取 `var(--site-accent-text)`，compose 与 preview bridge 都映射自定义色板的按钮文字色，预设色板缺省为白色。新增红测先在旧实现以 `#111827/forge` 失败，修复后四样子 × 六类种子全通过。
- 注塑厚资料站点重截在 `artifacts/t088/workbench-molding-r4/report.json`，三色 × 四样子 × 1440/768/375 共 36 张，按钮和次按钮已放大查看；contact sheet 为同目录三个 `*-contact.png`，三色 adjustment 记录在 `adjustment-notes.json`。
- `fulltest.sh` 输出 `artifacts/t088/npm-test-r5.txt`：660/660 PASS；typecheck/build 输出为 `artifacts/t088/typecheck-r5.txt`、`artifacts/t088/build-r5.txt`。

2026-10-04，rs-color，T-088 第四轮返工在并入最新主线后收口：

- 深色种子根因修复在 `lib/color-scale.ts`：白字对比度已达 4.5:1 且 OKLCH 明度属于深色的种子直接保留为 accent，sourceTooCloseToText 不再把它调浅。`tests/t088-color-scales.test.ts` 加入 `#121c28`、`#0b1220`、`#07111f` 的 adjusted=false / seed preserved 哨兵；先在旧实现上运行同一 focused signal，`#121c28` 在断言处得到 `#2b343f`，红测输出为 `artifacts/t088/deep-dark-sentinels-red.txt`，修复后定向测试 10/10 通过（`artifacts/t088/targeted-r6.txt`）。
- T-088 修复与测试由单一 commit `7ef4742` 承载，未改现有 24 套预设色板。随后将最新主线 `c443a4e` 合并进本分支，合并提交为 `24d9605`；`lib/site-store.ts` 冲突保留 T-085 的批注锁/撤销守卫，并把 T-088 的自定义色板提交边界校验接回本地与 PostgreSQL 两条路径。
- 预览空白复核：旧证据脚本只看 iframe 的历史 `data-previewHydrated`，没有检查外层 preview shell 的 error overlay，导致 `f4fbff-engineering-industrial-375` 曾把错误覆盖层当成就绪。最终脚本同时检查 shell `ready`、无错误覆盖层、非零且稳定 frame，再截图；`artifacts/t088/workbench-molding-r6/report.json` 为注塑厚资料站三色 × 四样子 × 1440/768/375 共 36 张，逐张及三个 contact sheet（同目录 `f4fbff-contact.png`、`111827-contact.png`、`39ff88-contact.png`）已查看，报告无 bad 项；重点图 `f4fbff-engineering-industrial-375.png` 为已渲染页面。
- 并入后验证（代码合并提交 `24d9605`；最终 HEAD `00e9867` 仅追加本 Resolution）：`bash .../fulltest.sh /Users/luckye/Documents/Code/sitecraft-ai-t088 3052 artifacts/t088/npm-test-r6-merged.txt` 通过 732/732；`npm run typecheck` 输出 `artifacts/t088/typecheck-r6-merged.txt`；`npm run build` 输出 `artifacts/t088/build-r6-merged.txt`；`zsh .../check-mainline-sites.sh /Users/luckye/Documents/Code/sitecraft-ai-t088 3052 artifacts/t088/mainline-check-r6-merged` 退出码 0，36 行、0 known、0 NEW，报告和逐行输出在该目录。

### 主控合并复验（Claude，2026-10-04 EDT）
- 合并主线 `e977567`。主工作区 3034：typecheck、build 通过，全量 732/732；12 站 `check-published` 36 行 0 失败，逐行实测条数不少于基线（`artifacts/merge-e977567/`）。调色板合法性检查在 store 与 `applySiteOperations` 各有一处，属加严、非绕过。
