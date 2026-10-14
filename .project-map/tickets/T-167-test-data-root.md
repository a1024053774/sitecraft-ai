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
- [x] 原始 Node 测试入口未配置或未核对数据根时，在任何 JSON 写入前拒绝（e7cee62 红灯）
- [x] 继承 NODE_TEST_CONTEXT 仍实际执行用例，零实际用例即失败（e7cee62 红灯）
- [x] 全量 test、typecheck、build 通过
- [ ] 独立 sol 实例代码审查通过

## Resolution

当前执行检查 PASS，整票 INCOMPLETE：e7cee62 的独立 sol 审查为 NO_GO，两项 P1 已修复，待主控对本次提交复审。票保持 open、claimed_by Codex；未自行开审查、未推送。本次修复父提交 e7cee62043bf6572a577236354da8538b5feff4b；新提交 SHA、运行命令、时间和证据路径在提交后写入 artifacts/t167/review-fix-report.json。原 artifacts/t167/final-report.json 和所有历史失败目录保留。

当前实现：标准入口每轮创建独立临时 SITECRAFT_DATA_ROOT，启动同工作树随机端口服务；health 的 cwd/dataRoot 核对成功后，在临时根登记本轮身份，再载入测试。五类 FS 存储共用 storage-directory 策略，原始 Node 测试也不能回退默认目录或使用未核对根；隔离存储夹具使用本轮根的子目录，普通开发仍按原合同使用默认目录。入口清除继承的 NODE_TEST_CONTEXT，并用 Node 每文件 summary 统计实际执行数，排除文件包装、跳过、取消及 TODO 项；零用例抛错，报告为 INCOMPLETE，不能用子进程退出 0 宣布通过。

本次证据（2026-10-14，UTC）：

- P1 红灯：在未改 e7cee62 实现时运行 node --test --experimental-strip-types tests/t167-storage-guard.test.ts。临时 cwd 中，原始 conversation-store 测试未配置数据根却写入 6 个 JSON；显式未核对根写入 1 个；两项断言均失败。原始输出 artifacts/t167-p1-e7cee62-red.log，数据和报告保存在 artifacts/t167/raw-unconfigured-e00e86be-3d2d-4ed5-a6f2-6542e4230dd7/、raw-unverified-64a75865-9f45-49d6-af62-fe3d5b0668b5/。不在主工作区复现。
- P1 绿灯：同命令 2/2 通过，未配置/未核对两种测试访问均写入 0 个 JSON；普通开发正对照仍写入 1 个。日志 artifacts/t167-p1-fixed.log；最终全量再次运行两项。
- P2 红灯：在 e7cee62 上运行 node --test --experimental-strip-types scripts/t167-runner-regressions.ts，分别通过真实 npm test 入口带入 child-v8 标记、用名称筛选排除全部正文用例；前者 skipping running files 却退出 0，后者只算文件包装也退出 0，两项均被回归检查拒绝。原始输出 artifacts/t167-p2-e7cee62-red.log。
- P2 绿灯：同命令 2/2 通过，实际业务用例执行且报告实际执行数大于 0；零正文用例时入口退出非 0，executed=0、status=INCOMPLETE。最新日志 artifacts/t167-p2-final-green.log，完整子进程证据 artifacts/t167/runner-regression-3cb93cdf-50cf-40dc-8cdf-4d44886487f8/ 和 runner-regression-9d98451c-489c-4b0b-a287-8f0fac55de02/。入口回归独占同工作树 dev server、不启动 Chrome，按 AGENTS 单独运行。
- 第一次修复后全量：469 项、467 通过、2 失败，原始日志 artifacts/t167-review-full.log 和本轮数据保留。两项离线 CLI 夹具另建在 artifacts 的数据根被守卫拒绝；只把它们的数据目录分配迁到已核对根的独立子目录，输入/输出仍留 artifacts，失败元数据、退出码和批次继续等业务断言不变。定向 npm test -- tests/t145-import-cli.test.ts 2/2 通过，日志 artifacts/t167-cli-fixed.log。
- 最终全量：NODE_TEST_CONTEXT=child-v8 SITECRAFT_DATA_ROOT="$PWD/.sitecraft-data" CHROME_PATH=<AGENTS 中 Chrome 路径> node --experimental-strip-types scripts/t167-check-test-isolation.ts。469/469 通过，失败/取消/跳过/TODO 均 0，175.8 秒；实际执行数和 Node 原始统计见对应 test-run 报告与 summaries.ndjson。日志 artifacts/t167-review-final-full.log；本工作树对照 code-sites 151→151，报告 artifacts/t167/isolated-1791956878664/report.json。主目录实际读回 4373→4373，报告 artifacts/t167-review-final-main-count.json。
- 原始 6e0ccfe 标准入口的 code-sites 数量红灯 0→151 仍保存在 artifacts/t167/parent-red-1791952824542/；未请求主目录 3034。新候选未增加主目录数据。
- npm run typecheck、npm run build 通过，日志 artifacts/t167-review-typecheck-cli.log、artifacts/t167-review-build.log。首次 typecheck 的环境对象类型错误原始输出 artifacts/t167-review-typecheck.log 保留；无放宽或跳过。

浏览器检查前均按 ps 和主控窗口串行安排，结束后报告结果及主目录读回数。无 UI/预览代码改动、不自评审美；未调用 DeepSeek、未加载 .env.local，未改业务存储合同、未删除主目录或父版本对照数据。当前规则、术语、mainline、spec 和 living-doc 覆盖路径已同步。
