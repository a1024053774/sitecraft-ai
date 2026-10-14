---
id: T-167
title: 全量测试使用独立的临时数据目录
type: build
status: open
blocked_by: [T-166]
claimed_by: Codex
supersedes:
---

## Why

全量测试经 `SITECRAFT_BASE` 指向主目录 3034 dev server，测试站写进主目录 `.sitecraft-data`（2026-10-14 已约 4,200 个 code-sites，每轮数百个），拖慢首页并混入用户的真实站点。2026-10-14 构思主控决定：全量测试用独立数据目录，主目录 3034 只留给真实站点。已有测试站删不删由负责人决定，本票不动。

## What to build

1. 标准测试入口每轮建一个临时数据目录，测试用的 dev server（随机端口）和测试进程都设 `SITECRAFT_DATA_ROOT` 指向它；code-site、conversation、annotation、lead 各 store 已读该变量，不另加兼容层。
2. 测试只读 `SITECRAFT_BASE`、不写死端口的规则不变；测试开始前核对 dev server 的数据根与测试进程一致（沿用 health 的 testIdentity），不一致即拒绝运行，防止写进主目录。
3. 同步 AGENTS.md「验收」中的标准测试命令与本票。不删除主目录任何数据。

## Acceptance

- [x] 跑一轮标准全量后，主目录 `.sitecraft-data/code-sites` 数量不变；同一检查在父版本上失败（数量增加）
- [x] 数据根不一致时测试拒绝运行（有测试）
- [x] 全量 test、typecheck、build 通过
- [ ] 独立 sol 实例代码审查通过

## Resolution

执行检查 PASS，整票 INCOMPLETE：独立审查待执行主控安排，未关闭、未推送。对应代码为本票所在的本地功能提交，父提交 `6e0ccfe`；完整提交 SHA、命令、时间和证据路径登记在本工作树 gitignore 的 `artifacts/t167/final-report.json`，由提交后写入。

`npm test` 现在每轮创建新的临时数据根、自启本工作树随机端口 dev server，并把同一数据根与 SITECRAFT_BASE 传给测试进程。测试模块载入前核对 health 的 cwd/dataRoot，200 和未配置模型的 503 都要核对，不一致即拒绝。保留日志与临时数据供核查；不加载 .env.local、不配置真实模型、不删除已有数据。旧测试的落盘读取与清理路径改为 SITECRAFT_DATA_ROOT，移除测试里的固定端口回退。AGENTS、README、spec 与 living-doc 覆盖路径已同步。

本次证据（2026-10-14，UTC）：

- 父版本数量红灯：改实现前执行 `CHROME_PATH=<AGENTS 中的路径> node --experimental-strip-types scripts/t167-check-test-isolation.ts --parent`，标准 npm test 467 项、464 通过、3 失败；T-167 本工作树作为主目录对照，code-sites 从 0 增至 151，数量断言失败。未请求真实主目录 3034。原始日志和 04:42:51 报告在 `artifacts/t167/parent-red-1791952824542/`。
- 第一次隔离全量：对照数量 151→151，466/467 通过；原始日志在 `artifacts/t167-isolated-console.log`，失败数据和报告未覆盖。当时错根测试的子进程继承 Node 26 的 NODE_TEST_CONTEXT，递归 runner 跳过用例却返回 0；该次错根信号不作为守卫红灯证据。T-145 原有 cwd 落盘假设在父轮报 ENOENT，已改为读取配置的数据根，业务断言保留。
- 有效的错根红绿：清除子进程内部测试标记并断言 t083 真正执行，再临时使用父提交原样的 t083 守卫运行 `npm test -- tests/t167-test-data-root.test.ts`，实际执行但未拒绝错根，红灯保存在 `artifacts/t167-corrected-parent-guard.log`；随后原样恢复当前守卫，同命令 2/2 通过，绿灯在 `artifacts/t167-focused-green.log`，子输出分别保存在 `artifacts/t167/mismatch-*.log`。两次定向检查均未启动 Chrome。
- 最终标准全量：调用方显式传入本工作树 `.sitecraft-data` 后执行 `CHROME_PATH=<AGENTS 中的路径> node --experimental-strip-types scripts/t167-check-test-isolation.ts`；入口改用新的临时数据根。467/467 通过，失败/取消/跳过均为 0，耗时 152.9 秒；对照目录 151→151。最终日志在 `artifacts/t167-final-console.log`，05:00:23.681 数量报告在 `artifacts/t167/isolated-1791953869068/report.json`，身份与数据根在对应 `artifacts/t167/test-run-*/report.json`。真实主目录跑前、跑后读回均为 4373，记录在 `artifacts/t167-final-main-count.json`（04:57:48 / 05:01:39）。
- `npm run typecheck`、`npm run build` 通过；最终日志分别为 `artifacts/t167-typecheck-final.log`、`artifacts/t167-build-final.log`。首次 typecheck 的 NODE_ENV 对象类型推断错误已修正，原始失败输出保留在执行会话。

每轮浏览器测试前均用 ps 核对无其他工作树的 Chrome/node --test，并取得执行主控的测试窗口；全量结束即报告结果与主目录读回数量。未调用 DeepSeek，未改 UI/预览代码，不给出审美结论，也未自行启动审查实例。工作树对照的 151 个父版本测试站和全部失败证据保留给主控，不做清理。
