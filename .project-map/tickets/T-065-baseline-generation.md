---
id: T-065
title: 当前生成流程的基线：三份资料各真实生成两次并统一截图
type: build
status: closed
blocked_by: [T-064]
claimed_by: codex-build
supersedes:
---

## What to build

T-064 的第一组：在当前提交上，不改任何生产代码，量出「用户全选推荐项」时的真实生成结果。

- 三份模拟资料（`lib/simulated-packs.ts` 的 industrial、export、molding）各走两次完整的需求对齐生成，真实 DeepSeek，依次跑、不并行。每一题都选标了推荐的选项，没有推荐就选第一个；**样子题也选推荐项，不强制工程工业**（这和 `artifacts/t061/accept-runs.mjs` 不同，可以复制它改一份放到 `artifacts/t065/`）。
- 每个站记录：siteId、草稿版本、样子、色板、`blockVariants`、`sectionOrder`、页面计划、模型调用记录（沿用 accept-runs 的观测字段，不记资料原文、prompt 和密钥）。
- 每个站跑 `check-published`（中英文，三档），结果原样保留；不通过也不重跑掩盖，写清哪里不通过。
- 写一个可复用的渲染脚本 `artifacts/t065/render.mjs <siteId>... --out <dir>`：访客页中文 1440 / 768 / 375 整页截图、同三张的遮字版（每行文字盖灰条，沿用 `artifacts/t054/build-blind.mjs` 的做法）、英文 1440 / 375 整页截图。截图前确认预览已就绪、整页高度稳定；T-066、T-067 都用这个脚本。
- 这一步**不打盲评包**，也不给截图起随机代号；输出放在 `artifacts/t065/baseline/<pack>-<run>/`。

不改：`lib/`、`app/`、`scripts/` 里的任何文件；不手改模型生成的草稿；检查不放宽。DeepSeek 或 Chrome 连不上只试一次，然后报告需要负责人做什么。

## Acceptance

- [x] 6 个站都由真实流程生成（或如实记录失败原因和失败时的日志），summary 文件列出每个站的上述字段
- [x] 6 个站的 `check-published` 中英文三档报告都在，失败项逐条列出
- [x] 渲染脚本能一条命令重渲任意站；6 个站的截图齐全，每张都打开看过，没有载入态、空白或截断
- [x] Resolution 写明运行的命令、时间（纽约时间）和所在提交

## Resolution

2026-10-02 12:04:45 EDT（America/New_York），在提交 `f58511d91aaf0e88c3745e14c2e16550fb56c4d6`（分支 `family-kit-assembly`）上完成。没有创建 commit、没有 push，也没有停止或重启已在 3034 端口运行的 dev server。

真实生成按顺序运行：

```sh
node --experimental-strip-types artifacts/t065/generate.mjs 2>&1 | tee artifacts/t065/generate.log
```

生成汇总和每站记录在 `artifacts/t065/baseline-summary.json`、`artifacts/t065/baseline-generation.jsonl` 以及各站的 `baseline/<pack>-<run>/generation.json`。六站均 `result: applied`，没有 DeepSeek 网络失败；模型调用记录只保留 accept-runs 观测字段，没有资料原文、prompt 或密钥。

| 站 | siteId | 样子 | 色板 | 布局（blockVariants） | pagePlan |
| --- | --- | --- | --- | --- | --- |
| industrial-1 | `5488ffa0-7f02-47fb-8a87-7a1010d88f04` | 工程工业 (`engineering-industrial`) | `engineering-warm-orange` | 默认（`{}`） | 首页 / 产品 / 联系 |
| industrial-2 | `3447743e-10f5-4312-8f20-97da4a24ab5f` | 工程工业 (`engineering-industrial`) | `engineering-warm-orange` | 默认（`{}`） | 首页 / 产品 / 联系 |
| export-1 | `8d90525e-813f-432e-8b7b-f9341c71e77f` | 工程工业 (`engineering-industrial`) | `engineering-warm-orange` | `hero=statement` | 首页 / 产品 / 联系；独立认证页、资料下载页不支持 |
| export-2 | `700b5b39-e72b-4484-b88a-f76e212daf6a` | 工程工业 (`engineering-industrial`) | `engineering-warm-orange` | 默认（`{}`） | 首页 / 产品 / 联系；独立认证页、资料下载页、认证页不支持 |
| molding-1 | `4f5389e7-6054-43dc-bca9-e744ff6d4467` | 工程工业 (`engineering-industrial`) | `engineering-warm-orange` | `products=grouped` | 首页 / 产品 / 联系；生产与质检、常见问题独立页不支持 |
| molding-2 | `10f47272-a7bd-4bdc-a567-99c444f99fef` | 工程工业 (`engineering-industrial`) | `engineering-warm-orange` | `hero=statement, products=grouped` | 首页 / 产品 / 联系；产品、生产与质检、常见问题、联系独立页不支持 |

访客检查在 `SITE_STORE=fs` 的 3034 dev server 上依次运行，Chrome 使用 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell`。六个 `check-published/report.json` 均退出码 0、中文和英文 1440 / 768 / 375 的 `failures` 均为空：

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell SITECRAFT_BASE=http://127.0.0.1:3034 node scripts/check-published.mjs --out artifacts/t065/baseline/industrial-1/check-published 5488ffa0-7f02-47fb-8a87-7a1010d88f04
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell SITECRAFT_BASE=http://127.0.0.1:3034 node scripts/check-published.mjs --out artifacts/t065/baseline/industrial-2/check-published 3447743e-10f5-4312-8f20-97da4a24ab5f
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell SITECRAFT_BASE=http://127.0.0.1:3034 node scripts/check-published.mjs --out artifacts/t065/baseline/export-1/check-published 8d90525e-813f-432e-8b7b-f9341c71e77f
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell SITECRAFT_BASE=http://127.0.0.1:3034 node scripts/check-published.mjs --out artifacts/t065/baseline/export-2/check-published 700b5b39-e72b-4484-b88a-f76e212daf6a
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell SITECRAFT_BASE=http://127.0.0.1:3034 node scripts/check-published.mjs --out artifacts/t065/baseline/molding-1/check-published 4f5389e7-6054-43dc-bca9-e744ff6d4467
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell SITECRAFT_BASE=http://127.0.0.1:3034 node scripts/check-published.mjs --out artifacts/t065/baseline/molding-2/check-published 10f47272-a7bd-4bdc-a567-99c444f99fef
```

### 渲染缺陷与修复

第一次 `render.mjs` 试跑只得到 1440 / 768 / 375 × 900：脚本量的是外层发布页，而 sandbox iframe 初始固定为 900px，外层的 `scrollHeight` 没有反映 iframe 内的整页高度。现有错误证据保存在每站 `render-viewport-only/`，首试 CDP 目标发现问题另记在 `artifacts/t065/render-first-attempt.log`。

修复后的 `artifacts/t065/render.mjs` 改为读取 iframe 文档稳定的 `scrollHeight`，再复制 `check-published.mjs` 的做法设置外层 viewport、发布页壳层和 iframe 的高度后截图。第二次试跑发现移动英文页 OOPIF 首屏以下尚未绘制，保存在每站 `render-height-fixed-attempt/` 和 `artifacts/t065/render-height-fixed-attempt.log`；随后加入逐滚动带预热并回到顶部（遮字截图在覆盖文字后再次预热），最终六站重渲命令为：

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell SITECRAFT_BASE=http://127.0.0.1:3034 node artifacts/t065/render.mjs <siteId> --out artifacts/t065/baseline/<pack>-<run>/render
```

该命令按上表六个 `siteId` 逐站执行；每站得到中文 1440 / 768 / 375、三张遮字版、英文 1440 / 375，共 48 张。`artifacts/t065/render-dimensions.txt` 逐张记录了最终图与同宽度 `check-published` 图的尺寸：最终中文图与检查图相同或相差 24–41px，英文桌面相同，英文手机相差 84–219px，全部为数千像素整页高度，已不再是 900px 视口。

最终 48 张图均通过 `view_image` 逐张打开查看；没有载入态、空白段或截断。遮字版的灰条覆盖了每行文字，整页底部均可见询盘和页脚。

Claude 验收（2026-10-02 12:10 EDT）：复核 48 张最终截图高度均为数千像素整页（无 900px 视口图），抽看 export-1 中文 1440 与 molding-1 中文 768 遮字版，整页到页脚、无载入态和截断；六份 `check-published/report.json` 的 failures 均为空。本票只产出 artifacts，不涉及代码，不需要代码审查。
