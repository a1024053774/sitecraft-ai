---
id: T-065
title: 当前生成流程的基线：三份资料各真实生成两次并统一截图
type: build
status: open
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

- [ ] 6 个站都由真实流程生成（或如实记录失败原因和失败时的日志），summary 文件列出每个站的上述字段
- [ ] 6 个站的 `check-published` 中英文三档报告都在，失败项逐条列出
- [ ] 渲染脚本能一条命令重渲任意站；6 个站的截图齐全，每张都打开看过，没有载入态、空白或截断
- [ ] Resolution 写明运行的命令、时间（纽约时间）和所在提交
