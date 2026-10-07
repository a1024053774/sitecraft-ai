---
id: T-122
title: 修 T-110 暴露的两个缺陷：参数标签看不见、短路径注塑规划截断
type: build
status: closed
blocked_by: []
claimed_by: t122-build
supersedes:
---

## What to build

- bright / catalog / short-path 生成站里参数标签 `dt` 正文对比度约 1.0:1（发布检查已报，`artifacts/t110-run/published/*/report.json`），基本看不见。在区块 CSS / token 层修到 ≥ 4.5:1，不加豁免、不改门槛。
- short-path × 注塑资料在需求对齐规划阶段 HTTP 502 truncated（站点 `d0a855e5-7e2f-4288-8e72-2a7895a25150`，`artifacts/t110-run/`）。查清是规划输出超出预算还是提示过长，在根因层修，不加重试。
- Astra 对 `0909f29` 的完整验收为 NO_GO：合法英式产能误拒。只补设备单位与产能谓词中 `moulding` / `molding` 的拼写等价，保留既有 `mould` / `mold` 等价及数量、单位、周期、限定成组核对；使用真实原句做父版红证据，再经真实 DeepSeek 确认两条源产能落稿。负责人要求单独提交此修复。

## Acceptance

- [x] 两处各有行为测试，先在父提交上失败
- [x] short-path × 注塑用真实 DeepSeek 重新走一次需求对齐 + 生成成功；三个样子的生成站发布检查不再报 `dt` 对比度
- [x] 追加英式拼写回归在 `0909f29` 上失败，修后等价表达接受、错数量/单位/周期/约数与设备周期仍拒绝；真实 DeepSeek 两条源产能中英落稿
- [x] `npm run typecheck`、`npm test`、`npm run build`、13 站 `check-published` 通过；代码审查通过；Claude 验收

## Resolution

**英式产能窄修复 PASS；整票 INCOMPLETE。** `0909f29` 的完整 Astra 审查为 NO_GO（主工作区 `artifacts/review-astra-t122.md`），对比度与预算修复通过，但英式拼写误拒两条产能。追加修复已通过父版红/修后绿、相关测试 1587/1587、typecheck、全量 2501/2501、build、真实产能读回与独立 Astra 窄范围复审。新真实生成另有质检同句校验拒绝，4/5 条落稿，原始整站失败保留，不宣称整站资料保留通过；完整生成验收与 Claude 关票仍未完成。未修改质检逻辑，不改变 T-121 的版式方向。

对比度与预算的源码候选为 `e4ee31d48c8501aaf1c5d91de6cd68baec9fb840`，其与 `0909f29` 只差票据记录。较早运行日志的父 SHA 表示提交前工作树，`artifacts/t122/candidate-binding.log` 提供文件时间、源码候选和 server 工作区绑定。此次英式拼写追加以 `0909f29` 为父版，较早日志同样记录父 SHA 与提交前工作树，红证据与修复后证据分开保留。

- 父提交 `c96fb627c9f349fda66b4cff9bc9161ee4e041d2` 的红证据：`2026-10-07T14:01:09Z`，`SITECRAFT_BASE=http://127.0.0.1:3065 CHROME_PATH=<AGENTS 指定的 headless shell> node --test --experimental-strip-types --test-name-pattern T-122 tests/structured-output-budget.test.ts tests/t122-spec-label-contrast.test.ts`，两处均失败。证据 `artifacts/t122/focused-red-photo.log`；之前未触发参数条的两次测试结果仍保留，未充当红证据。
- 颜色根因：参数条硬编码半透明白色，浅底的 bright / catalog / short-path 实测约 1.0:1。改为现有 `--site-plate-muted`，不修改扫描器、门槛或豁免。行为测试实际渲染有图片区块的默认首屏，检查四个样子、六套色板、中英与三档宽度的 4 个参数标签。
- 规划根因：主工作区 `.next/dev/logs/next-development.log` 中 T-110 上游 trace `6f3cd7ab3de5be056c87aee802db3901` 记录 HTTP 200、输入 3757、输出 8192、推理 8192、`finish=length`、45531ms，输出预算被推理耗尽；原 HTTP 502 记录仍在 `artifacts/t110-run/generation/short-path-molding/start-response.json`。规划改为 65536 tokens、单次 300 秒、合计 360 秒，与整站生成保持一致。思考默认不变，截断仍单次失败，不加重试。
- 修复后相关测试：`2026-10-07T14:01:47Z`，`node --test --experimental-strip-types tests/structured-output-budget.test.ts tests/t122-spec-label-contrast.test.ts tests/bright-look-tokens.test.ts tests/palette-catalog.test.ts`，16/16 PASS；证据 `artifacts/t122/focused-green.log`。所有执行日志首行含 SHA、命令和 UTC 时间；本提交的代码与该检查时的 T-122 工作区一致。
- 预算修复后的真实 DeepSeek：`2026-10-07T14:02:43Z`，`node --experimental-strip-types artifacts/t122/real-short-path-molding.mjs`，start → select → state → confirm → draft 入口走通，站点 `63d1c535-ff4c-4199-9a8b-18f28142384a`，`deepseek-flash`，revision 2→3、26 operations、139 实际落点；五类资料产品、5 条质检、5 条沿革和双语状态已核对。证据 `artifacts/t122/real-deepseek.log`、`artifacts/t122/real-short-path-molding/`。英式拼写误拒使该次两条产能没有落稿，不能把 applied 视为资料完整保留。密钥通过 `SITECRAFT_ENV_FILE` 指定的主工作区 `.env.local` 只加载进 dev server 进程。
- typecheck：`2026-10-07T14:02:44Z`，`npm run typecheck`，PASS，`artifacts/t122/typecheck.log`。build：`2026-10-07T14:09:20Z`，`npm run build`，PASS，`artifacts/t122/build.log`。
- 13 站发布检查：`2026-10-07T14:07:07Z`，`SITECRAFT_BASE=http://127.0.0.1:3065 CHROME_PATH=<AGENTS 指定的 headless shell> node artifacts/t122/published-mainline.mjs`，按主工作区 `artifacts/handoff/mainline-12-sites.txt` 原清单逐站运行 `node scripts/check-published.mjs --out artifacts/t122/published-mainline <13 个原始 siteKey>`；完整命令首行在 `artifacts/t122/published-mainline.log`，39 档、78 张中英截图全部 PASS。
- 缺陷样本发布检查：`2026-10-07T14:09:11Z`，同一环境下 `node scripts/check-published.mjs --out artifacts/t122/published-affected 04d51c67-c013-4fab-bee2-742840e1375b 1fccb967-e78c-4b14-8d02-1ad3b204802d c542f476-9521-4c80-94a8-359d6b43894f 63d1c535-ff4c-4199-9a8b-18f28142384a`，12 档、24 张中英截图全部 PASS。原 T-110 bright / catalog / short-path 标签的最低实测值分别为 5.94 / 6.91 / 5.96:1，新注塑站为 6.21:1；报告 `artifacts/t122/published-affected/report.json`。共 102 张截图逐张打开，页面至页脚完整；这只证明实现自查，不宣称美学盲评通过。
- 对比度与预算的窄范围 Astra 审查：候选 `e4ee31d`，两个测试文件 11/11 PASS，结论 `artifacts/t122/independent-review.txt`。该窄结论未覆盖两条产能的完整保留；完整审核结论以 `artifacts/review-astra-t122.md` 的 NO_GO 为准，不代替 Claude 验收，不重做 T-110 盲评。
- 全量首次运行：`2026-10-07T14:02:55Z`，负载 10.88 时启动 `npm test`，2491/2492；唯一失败为 T-113 固定原始输入站点在 worktree 缺失，GET 图片目录返回 404。保留 `artifacts/t122/full-test.log`。从主工作区补齐相同的三个站点和上传文件（`2712b46f-e375-4447-90df-11c411e7c5ca`、`80f53a96-b2d4-4368-ac7d-5d2ed613ffef`、`8142e99f-55be-406f-87a3-cf26308eef76`），没有改工具或换样本；`2026-10-07T14:12:15Z` 复跑 `node --test --experimental-strip-types tests/t113-published-credit-collector.test.ts` 已通过，证据 `artifacts/t122/t113-input-restored.log`。`2026-10-07T14:13:24Z` 负载 3.89 时以相同 `npm test` 重跑全量，`14:17:44Z` 结束：2492/2492 PASS、零跳过、exit 0；证据 `artifacts/t122/full-test-input-restored.log`。首次运行的固定截图和测量产物保留，T-103 重跑另指定 `T103_CHECK_OUT=artifacts/t122/full-rerun-t103`。
- 英式拼写回归：`2026-10-07T14:26:49Z`，`node --test --experimental-strip-types --test-name-pattern 'T122 British capacity' tests/t118-capacity-grounding.test.ts`，`0909f29` 上原句与两种单点英式拼写共 3 个合法用例误拒；`14:27:04Z` 同一命令修后 9/9 PASS。证据 `artifacts/t122/british-red.log`、`british-focused-green.log`。生产变更仅两个既有语法位置的 `molding` → `mou?lding`，没有改数量、单位、周期、限定、父规格关系或事实来源门。
- 追加相关测试：`2026-10-07T14:27:50Z`，`node --test --experimental-strip-types tests/t118-capacity-grounding.test.ts tests/site-operations.test.ts`，1587/1587 PASS；typecheck：`14:28:44Z`，`npm run typecheck`，PASS；build：`14:30:52Z`，`npm run build`，PASS。证据 `artifacts/t122/british-related.log`、`british-typecheck.log`、`british-build.log`。
- 追加真实 DeepSeek：`2026-10-07T14:27:49Z`，`node --experimental-strip-types artifacts/t122/real-short-path-molding.mjs artifacts/t122/real-british-molding`，start → select → state → confirm → draft 返回 applied，站点 `17a08199-30f9-4e8c-866a-d1fcfecb0e71`。中英产能保留模具年产约 180 套、月注塑能力约 600 万件，英文为 `Mold output about 180 sets per year; 42 injection molding machines (90–800 t), monthly injection molding capacity about 6 million pieces.`。`14:30:52Z` 用 `node artifacts/t122/british-capacity-readback.mjs` 从真实 API 再读回，同分句的数量、单位、年/月周期及约数断言 PASS。证据 `british-real-deepseek.log`、`real-british-molding/`、`british-capacity-readback.log`、`british-capacity-readback.json`。原生成检查在质检 4/5 条处失败（拒绝理由为「外观与功能全检」标题或说明未匹配同句），该次完整检查仍为 INCOMPLETE，原始失败未覆盖、未改草稿补齐、未重试模型；此限制须在完整生成验收前解决。
- 追加全量：负载曾高于 12，未启动；`2026-10-07T14:30:34Z` 负载 9.19 时启动 `npm test`，`14:33:55Z` 结束：2501/2501 PASS、零跳过、exit 0，日志 `artifacts/t122/british-full-test.log`。旧固定产物保留在 `artifacts/t122/before-british-full/`，本次 T-103 输出为 `artifacts/t122/british-full-t103`。
- 追加访客渲染检查：`2026-10-07T14:33:10Z`，`SITECRAFT_BASE=http://127.0.0.1:3065 CHROME_PATH=<AGENTS 指定的 headless shell> node scripts/check-published.mjs --out artifacts/t122/british-published 17a08199-30f9-4e8c-866a-d1fcfecb0e71`，三档中英通过，六图逐张打开至页脚完整；证据 `artifacts/t122/british-published.log`、`british-published/report.json`。该检查以已落稿事实为基准，不抵销质检缺失。
- 追加 Astra 窄范围复审：冻结候选 `cedc1d89344aacc81732c0a7fd6213899decfcb6`，PASS；独立输入 217 套/年、31 台（100–750 t）、830 万件/月的英美拼写均接受，六种错误关系拒绝；`14:34:57Z` 由真实 GET 再核对两条中英产能与设备规格。报告 `artifacts/t122/british-independent-review.txt`；候选源码与较早工作树的时间/身份绑定记录在 `british-candidate-binding.log`。审查明确保留整站生成 INCOMPLETE。此后仅更新票据记录，未改源码。

### 合回主线与关闭（Claude，2026-10-07 EDT）
- 独立 Astra：对比度（`--site-plate-muted`，四样子六色板 ≥4.5:1）与规划预算（推理耗尽输出预算，8192→65536，无重试）PASS；继承的英式 `moulding` 产能误拒由 `c3e7431` 修复（`mou?lding`，成组核对未放宽），主控核对改动。合并主线 `993808a`；全量 2501/2501、build、typecheck、13 站 `check-published` 通过（`artifacts/merge-993808a/`）。遗留：真实注塑生成质检流程 5 步落稿 4 步，另记后续。Claude 验收关闭。
