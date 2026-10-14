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
- [x] 同目录普通 dev 运行时，标准入口独立启动且不改变普通服务（19a99bb 红灯）
- [x] 启动失败报告 Next 原因与日志路径（父版本入口红灯）
- [x] 主目录既有 artifacts 结构下构建不 panic（dfb9d5e 红灯、带修复绿灯）
- [x] 全量 test、typecheck、build 通过
- [x] .next-test 同时被 Docker 构建上下文与 Git 排除（9b62be0 红灯）
- [ ] 独立 sol 实例代码审查通过

## Resolution

本轮聚焦检查 PASS，整票 INCOMPLETE：9b62be0 独立 sol 复审为 NO_GO（P2），遗漏 Docker 构建上下文中的 .next-test 排除项；本轮已补齐，待主控复审。票保持 open、claimed_by Codex；执行者未自开审查、未推送。本轮父提交 9b62be0b8d7232ce0eefede32dc1e06832d0dc74，提交 SHA、命令、时间及产物索引在提交后写入 artifacts/t167/dockerignore-review-fix-report.json。所有历史失败和临时数据继续保留。

本轮仅改 .dockerignore、现有 Docker 配置断言及本票：.gitignore 原本已有 .next-test，确认后与 .dockerignore 一并由断言保护。2026-10-14 运行 npm test -- --test-name-pattern=Docker tests/t166-check-origin.test.ts；9b62be0 上先添加断言，因 .dockerignore 缺少排除项而失败（1 项执行、1 失败，退出 1），日志 artifacts/t167-dockerignore-9b62be0-red.log；补齐后同命令 1/1 通过、退出 0，日志 artifacts/t167-dockerignore-fixed-green.log。按主控要求仅跑此聚焦用例，未跑 build、全量、typecheck 或 Chrome。

NFT 证据缺口：没有与 58f2827 在同目录、同环境下的追踪数量及清单精确对照。已有的旧 .next“4606→604”记录不能替代该对照，不能据此宣称追踪规模已恢复到 58f2827。保留已实测的 panic 红灯和构建成功绿灯；本轮不补跑或补造对照。

当前标准入口每轮新建临时 SITECRAFT_DATA_ROOT，自启同工作树随机端口 dev 服务；health 的 cwd/dataRoot 一致后登记存储许可，再载入测试。测试服务经 SITECRAFT_TEST_DIST_DIR 独用 .next-test，普通服务继续用 .next 及原端口。清除继承的 NODE_TEST_CONTEXT，按 Node 每文件 summary 统计实际执行数，零用例失败。启动或身份核对失败先关闭本轮服务，再报告 Next 原始输出、原因和 dev.log 路径。

五类 store 的目录保持直接 path.join 表达式，storageGuard 只核验许可，不再返回供 FS 使用的未知路径；原始 Node 测试未配置或未核对根仍在读写前拒绝。守卫的运行时 path.resolve、existsSync/readFileSync 参数及 health 身份 path.resolve 标注 turbopackIgnore；注释写明原因及移除条件。[Next 16.3.1 源码](https://github.com/vercel/next.js/blob/v16.3.1/turbopack/crates/turbopack-ecmascript/src/references/mod.rs)中 PathResolve 本身会添加目录追踪（fs 参数忽略支持见 [官方 PR 95144](https://github.com/vercel/next.js/pull/95144)），仅忽略两处 fs 参数不能覆盖它；只保留四处注释而仍由闭包返回 store 路径也会 panic。修复不排除 artifacts，不删除或移动 artifacts/.sitecraft-data，不放松守卫。

9b62be0 的既有证据（2026-10-14，UTC；并非本轮重跑）：

- dev 共存红灯：19a99bb 上先起本工作树普通 dev，再经真实 npm test 入口运行 conversation-store；Next 报已有同目录 dev，入口仅 fetch failed，用例失败。日志 artifacts/t167-coexist-19a99bb-red.log。绿灯：node --test --experimental-strip-types scripts/t167-runner-regressions.ts，4/4 通过；日志 artifacts/t167-final-entry-regressions.log，普通服务端口、数据根和存活状态均经前后 health 读回核对。
- 启动报错红灯：保留独立 distDir，只恢复 19a99bb 的 scripts/run-tests.ts，并设置 SITECRAFT_TEST_DIST_DIR=.next-test；以 .next-test 文件制造实际 ENOTDIR。同一个 startup failure 用例因仅收到 fetch failed 而失败，日志 artifacts/t167-startup-cause-parent-red.log；每次结束恢复源码及缓存。修后同用例通过，日志 artifacts/t167-startup-cause-final-green.log。
- 构建红灯：主控在主目录 dfb9d5e 执行 SITE_STORE=fs npm run build，清空 .next 后仍出现 NftJsonAsset → traced_module_data_for_graph → FileSource Invalid file type Directory。原始日志 ../sitecraft-ai/artifacts/merge-dfb9d5e/build-clean-next2.log。目录保留 338 个指向目录的符号链接和 14 个断链（主控调查）。本工作树小目录夹具构建成功，不能当红灯；其原始产物仍保留。
- 构建组合诊断：主目录只恢复 store 的直接路径可 build；加回守卫、只忽略两处 fs 参数仍 panic（artifacts/t167/main-guarded-static-green-1791982017635/，目录名不代表结果，report.code=1）；只做四处忽略但保留闭包返回路径也 panic（main-four-annotations-only-1791982279973/，FATAL 后仅停止本轮挂起进程，code=143）。③组合通过（main-resolve-ignore-probe-1791982221912/，code=0）。每次临时改动立即 checkout，未写主数据。
- 最终构建绿灯：node --experimental-strip-types scripts/t167-build-trace-regression.ts --project /Users/luckye/Documents/Code/sitecraft-ai，内部执行 SITE_STORE=fs npm run build；将本次生产代码、Next 配置及 tsconfig 临时应用到主目录 ac6ae51 后通过，构建与回归均 code=0。报告 artifacts/t167-main-final-build-green-report.json，原始构建日志 artifacts/t167/build-trace-7a06fec5-226f-4d2c-a3a1-4c8cad044a5a/build.log。完成后精确 checkout 恢复，主目录 git status 仅 ?? .claude/；code-sites 4373→4373。
- 曾额外添加“所有 nft 不能含 artifacts”的断言，构建本身 code=0，但此附加检查不成立；直接可配置存储路径仍会匹配 artifacts 中对应 store 的夹具，并非本票要求。保留 artifacts/t167/build-trace-6b1dae34-9dd7-4f15-8df1-a811adb61573/ 和 t167-main-final-build-report.json；断言的大数组格式化挂起后只停止自己的辅助进程，code=-15，主目录已恢复。回归已按本票合同收敛为既有结构下 build 成功，未改生产修复来绕过失败。
- 最终全量：NODE_TEST_CONTEXT=child-v8 SITECRAFT_DATA_ROOT="$PWD/.sitecraft-data" CHROME_PATH=<AGENTS 中 Chrome 路径> node --experimental-strip-types scripts/t167-check-test-isolation.ts。469/469 通过，失败/取消/跳过/TODO 均 0，115.3 秒；日志 artifacts/t167-coexist-trace-final-full.log，test-run-1791982883555-75118/report.json 与 summaries.ndjson 记录实际执行数。本工作树 code-sites 151→151（isolated-1791982883377/report.json），主目录实际读回 4373→4373（t167-coexist-trace-final-main-count.json）。全量结束即报告主控。
- npm run typecheck 通过，日志 artifacts/t167-coexist-trace-final-typecheck2.log。本轮 56 张界面截图和 213 张隐私测试照片截图（含打包副本）均逐张打开，未做哈希/像素比较、不作审美结论；清单 artifacts/t167-final-screenshot-inspection.json。

原始隔离数量红灯（6e0ccfe，本工作树对照 0→151）、P1 原始 Node 写入红灯（e7cee62，6/1 个 JSON）及 P2 零用例红灯（e7cee62）分别保存在 artifacts/t167/parent-red-1791952824542/、t167-p1-e7cee62-red.log、t167-p2-e7cee62-red.log。最终全量继续覆盖 P1；入口 4 项回归继续覆盖 P2。早先 CLI 夹具隔离根被守卫拒绝的全量失败也保留在 t167-review-full.log，未跳过断言。

浏览器前按 ps 核对并使用主控窗口，构建与全量串行。未调用 DeepSeek；测试 NODE_ENV=test 不加载 .env.local，主目录诊断 build 按本轮明确授权由 Next 正常读取其构建环境，未读取或打印密钥。标准命令、术语、mainline、spec 和 living-doc 覆盖路径已同步；独立审核由主控安排。
