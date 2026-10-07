---
id: T-122
title: 修 T-110 暴露的两个缺陷：参数标签看不见、短路径注塑规划截断
type: build
status: open
blocked_by: []
claimed_by: t122-build
supersedes:
---

## What to build

- bright / catalog / short-path 生成站里参数标签 `dt` 正文对比度约 1.0:1（发布检查已报，`artifacts/t110-run/published/*/report.json`），基本看不见。在区块 CSS / token 层修到 ≥ 4.5:1，不加豁免、不改门槛。
- short-path × 注塑资料在需求对齐规划阶段 HTTP 502 truncated（站点 `d0a855e5-7e2f-4288-8e72-2a7895a25150`，`artifacts/t110-run/`）。查清是规划输出超出预算还是提示过长，在根因层修，不加重试。

## Acceptance

- [x] 两处各有行为测试，先在父提交上失败
- [x] short-path × 注塑用真实 DeepSeek 重新走一次需求对齐 + 生成成功；三个样子的生成站发布检查不再报 `dt` 对比度
- [ ] `npm run typecheck`、`npm test`、`npm run build`、13 站 `check-published` 通过；代码审查通过；Claude 验收

## Resolution

**执行 PASS；整票 INCOMPLETE，仅待 Claude 验收。** 相关测试、typecheck、全量、build、13 站发布检查与独立 Astra 审查均通过；保留最后一个验收框未勾选，不代替 Claude 关票。本票只修参数标签颜色与规划输出预算，不改变 T-121 的版式方向。

源码候选为 `e4ee31d48c8501aaf1c5d91de6cd68baec9fb840`。较早运行日志的父 SHA 表示提交前工作树；`artifacts/t122/candidate-binding.log` 记录两处修复的文件时间早于绿色和真实模型请求、源码对候选无 diff、3065 server 的工作区身份。Astra 独立核对了这项绑定。之后只更新本票验收记录，源码未变。

- 父提交 `c96fb627c9f349fda66b4cff9bc9161ee4e041d2` 的红证据：`2026-10-07T14:01:09Z`，`SITECRAFT_BASE=http://127.0.0.1:3065 CHROME_PATH=<AGENTS 指定的 headless shell> node --test --experimental-strip-types --test-name-pattern T-122 tests/structured-output-budget.test.ts tests/t122-spec-label-contrast.test.ts`，两处均失败。证据 `artifacts/t122/focused-red-photo.log`；之前未触发参数条的两次测试结果仍保留，未充当红证据。
- 颜色根因：参数条硬编码半透明白色，浅底的 bright / catalog / short-path 实测约 1.0:1。改为现有 `--site-plate-muted`，不修改扫描器、门槛或豁免。行为测试实际渲染有图片区块的默认首屏，检查四个样子、六套色板、中英与三档宽度的 4 个参数标签。
- 规划根因：主工作区 `.next/dev/logs/next-development.log` 中 T-110 上游 trace `6f3cd7ab3de5be056c87aee802db3901` 记录 HTTP 200、输入 3757、输出 8192、推理 8192、`finish=length`、45531ms，输出预算被推理耗尽；原 HTTP 502 记录仍在 `artifacts/t110-run/generation/short-path-molding/start-response.json`。规划改为 65536 tokens、单次 300 秒、合计 360 秒，与整站生成保持一致。思考默认不变，截断仍单次失败，不加重试。
- 修复后相关测试：`2026-10-07T14:01:47Z`，`node --test --experimental-strip-types tests/structured-output-budget.test.ts tests/t122-spec-label-contrast.test.ts tests/bright-look-tokens.test.ts tests/palette-catalog.test.ts`，16/16 PASS；证据 `artifacts/t122/focused-green.log`。所有执行日志首行含 SHA、命令和 UTC 时间；本提交的代码与该检查时的 T-122 工作区一致。
- 真实 DeepSeek：`2026-10-07T14:02:43Z`，`node --experimental-strip-types artifacts/t122/real-short-path-molding.mjs`，start → select → state → confirm → draft 通过，站点 `63d1c535-ff4c-4199-9a8b-18f28142384a`，`deepseek-flash`，revision 2→3、26 operations、139 实际落点；五类资料产品、5 条质检、5 条沿革和双语状态已核对。证据 `artifacts/t122/real-deepseek.log`、`artifacts/t122/real-short-path-molding/`。现有事实校验拒绝一条英文产能表达，未绕过；密钥通过 `SITECRAFT_ENV_FILE` 指定的主工作区 `.env.local` 只加载进 dev server 进程。
- typecheck：`2026-10-07T14:02:44Z`，`npm run typecheck`，PASS，`artifacts/t122/typecheck.log`。build：`2026-10-07T14:09:20Z`，`npm run build`，PASS，`artifacts/t122/build.log`。
- 13 站发布检查：`2026-10-07T14:07:07Z`，`SITECRAFT_BASE=http://127.0.0.1:3065 CHROME_PATH=<AGENTS 指定的 headless shell> node artifacts/t122/published-mainline.mjs`，按主工作区 `artifacts/handoff/mainline-12-sites.txt` 原清单逐站运行 `node scripts/check-published.mjs --out artifacts/t122/published-mainline <13 个原始 siteKey>`；完整命令首行在 `artifacts/t122/published-mainline.log`，39 档、78 张中英截图全部 PASS。
- 缺陷样本发布检查：`2026-10-07T14:09:11Z`，同一环境下 `node scripts/check-published.mjs --out artifacts/t122/published-affected 04d51c67-c013-4fab-bee2-742840e1375b 1fccb967-e78c-4b14-8d02-1ad3b204802d c542f476-9521-4c80-94a8-359d6b43894f 63d1c535-ff4c-4199-9a8b-18f28142384a`，12 档、24 张中英截图全部 PASS。原 T-110 bright / catalog / short-path 标签的最低实测值分别为 5.94 / 6.91 / 5.96:1，新注塑站为 6.21:1；报告 `artifacts/t122/published-affected/report.json`。共 102 张截图逐张打开，页面至页脚完整；这只证明实现自查，不宣称美学盲评通过。
- Astra 独立代码与行为审查：候选 `e4ee31d`，PASS；独立复跑两个测试文件 11/11 PASS，没有阻断性发现。原始结论保存于 `artifacts/t122/independent-review.txt`；范围仅为本票修复，不代替 Claude 验收，不重做 T-110 盲评。
- 全量首次运行：`2026-10-07T14:02:55Z`，负载 10.88 时启动 `npm test`，2491/2492；唯一失败为 T-113 固定原始输入站点在 worktree 缺失，GET 图片目录返回 404。保留 `artifacts/t122/full-test.log`。从主工作区补齐相同的三个站点和上传文件（`2712b46f-e375-4447-90df-11c411e7c5ca`、`80f53a96-b2d4-4368-ac7d-5d2ed613ffef`、`8142e99f-55be-406f-87a3-cf26308eef76`），没有改工具或换样本；`2026-10-07T14:12:15Z` 复跑 `node --test --experimental-strip-types tests/t113-published-credit-collector.test.ts` 已通过，证据 `artifacts/t122/t113-input-restored.log`。`2026-10-07T14:13:24Z` 负载 3.89 时以相同 `npm test` 重跑全量，`14:17:44Z` 结束：2492/2492 PASS、零跳过、exit 0；证据 `artifacts/t122/full-test-input-restored.log`。首次运行的固定截图和测量产物保留，T-103 重跑另指定 `T103_CHECK_OUT=artifacts/t122/full-rerun-t103`。
