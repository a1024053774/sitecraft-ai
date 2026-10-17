---
id: T-176
title: 测试不再把临时产物堆进 artifacts 和 /tmp
type: build
status: closed
blocked_by: []
claimed_by: Codex
supersedes:
---

## Why

2026-10-17 清理磁盘时发现：每轮全量测试在 `artifacts/t130/` 留下 `privacy-*`（每个约 45MB）、`api-fixture-*`、`cli-fixture-*` 各一个，已累积 96 轮共约 4.3GB；`artifacts/t167/test-run-*` 累积 375 个；审查与诊断留下的 `/tmp/sitecraft-*` 临时数据根 56 个。负责人这台机器磁盘与内存都紧，已两次因空间不足手动清理。属于优先级 3 的小修，不能挤占页面质量工作。

## What to build

1. `tests/t130-blind-privacy.test.ts:12`、`tests/t130-run-records.test.ts:82`、`tests/t130-eval-set.test.ts:70` 的临时目录改到本轮 SITECRAFT_DATA_ROOT 之下（T-167 入口已提供），或在 `test.after` 删除；若评估代码要求输出位于 `artifacts/` 才能做隐私检查，就按该要求只在失败时保留并在报告里给路径。
2. 全量入口按时间保留最近 5 轮 `artifacts/t167/test-run-*`（含新一轮，不分成败）；窗口外仅删除成功轮，失败或中断证据继续保留并输出路径。清理根由入口脚本所在工作树确定，cwd 不一致在删除前拒绝；清理、登记及本轮运行期间持有工作树独占锁，并发入口直接拒绝，不等待、不重试，正常和异常退出释放。
3. AGENTS.md「Git」段缓存清理一句补上 `/tmp/sitecraft-*` 临时数据根：主控收尾时删除对应票的临时根。
4. 不改测试判断条件，不跳过任何用例。

## Acceptance

- [x] 连跑两轮全量后 `artifacts/t130/` 无新增 `privacy-*`/`*-fixture-*`；最近 5 轮全部保留，窗口外仅删成功轮；人为制造一次失败，失败轮目录保留并输出路径
- [x] typecheck、test、build 通过；独立 sol 审查通过

## Resolution

状态：PASS。主控转述第三轮独立复审 `f657bd8` 通过，无阻断问题；两条非阻断用例已补齐，生产入口未再改动。补充用例定向 10/10、runner 回归 4/4、typecheck 与主控指定的一轮全量（733 项）通过，票关闭。分支 `t176-test-litter`，本提交父版本 `f657bd8`；新提交，不 amend、不推送。

- T-130 三个临时目录仍写入本轮 `SITECRAFT_DATA_ROOT/t130/`，评估代码允许该输出位置；AGENTS 的临时数据根收尾规则保留。两部分经独立审查无问题，未改旧用例判断条件。
- 清理根从 `import.meta.url` 得到，先核对真实 cwd；错误工作树在创建、清理或登记前即拒绝。`artifacts/t167/.run-tests.lock` 按行记录 pid 与启动时间，覆盖清理、登记和本轮运行；存活 pid 直接拒绝并列出路径与 pid，ESRCH 或不可解析记录可接管。每个竞争者以一次 O_APPEND 完整登记，首个存活声明获锁，并发失败者只关闭自己的描述符，不删除另一轮的新锁；普通退出释放，强制退出留下的锁在下次接管。按时间保留最新五轮（含新一轮，不分成败），仅删除窗口外成功目录；窗口外失败或报告不完整的目录保留并打印路径，不再挤占窗口内成功轮。README、spec 与 AGENTS 的入口验收合同已同步，AGENTS 的 Git 收尾规则未改。
- 2026-10-17 09:43 UTC，生产入口仍为 `0eb81d8` 时运行 `CHROME_PATH=<AGENTS 指定路径> npm test -- tests/t176-test-output.test.ts`：4 项中 3 项按预期失败（错误保留规则、错误工作树、并发入口），退出 1；符号链接边界对照通过。红证据：`artifacts/t176/review-red-0eb81d8/{tests.log,report.json}`，原标准入口目录 `artifacts/t167/test-run-1792230194905-42841/`，数据根 `/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-test-wfLc97/`。预期来自本次审查要求，不由实现输出生成。
- 2026-10-17 09:45 UTC，最终代码经同一标准入口定向检查 4 项全部通过，退出 0；证据 `artifacts/t176/review-green/{tests.log,report.json}`，标准入口目录 `artifacts/t167/test-run-1792230312302-44186/`。夹具以文件事件闸门冻结首轮，确认并发第二轮未登记或删除目录；同时检查错误 cwd 不改变两个工作树、正常与异常结束释放互斥、失败轮移出最近五轮后仍保留。四个入口相关脚本作为临时项目的可执行夹具，Next 用最小 health 替身；不代表真实 Next 集成或模型证据。
- 2026-10-17 09:45 UTC，`node --test --experimental-strip-types scripts/t167-runner-regressions.ts`：4 项通过，退出 0；真实 Next 服务覆盖正常存储、零用例拒绝、普通 dev 共存和启动异常。证据为 `artifacts/t167/runner-regression-792fae9b-71de-45e0-a165-0d9d54d15a23/`、`runner-regression-083692b4-1291-46ba-8ccb-a9a000075c9d/`、`coexisting-dev-2dcadc96-50f5-41c1-8947-31948e508848/`、`runner-regression-b5384834-21bd-436d-acc7-08a3223b9b47/`（均在 `artifacts/t167/` 下）。`npm run typecheck`、`git diff --check` 通过；本轮首次类型检查失败已修正，日志 `artifacts/t176/review-typecheck-first-failure.log`。
- 初次实现的父版本红证据 `artifacts/t176/parent-final-regression-red.log`、类型检查失败记录及 T-130 定向清单继续保留；初次保留规则被本次审查纠正，不把旧规则的绿结果当作当前规则的验收依据。原有 `tsconfig.json` 的 Next 自动改动不进入本提交。
- 等待主控回复「可以跑」后再串行执行两轮全量 `CHROME_PATH=<AGENTS 指定路径> npm test` 及 `npm run build`，每项前核对内存与全机重任务进程；结果追加进本 Resolution，独立复审由主控另派。无 UI 改动，不作审美结论，未调用真实模型或其他外部服务。

- 2026-10-17 本次重任务验收（代码提交 `36972e4d9c271cda5381da01329f7215d3bd28fa`）：经主控回复「可以跑」后，严格按全量 1 → 全量 2 → build 串行完成。每项前实际执行 `memory_pressure` 与 `ps -Ao pid=,ppid=,command=`，内存空闲依次为 46% / 49% / 48%，均无其他无头 Chrome 测试、Node 测试或 Next 构建；未加载 `.env.local`、未配置真实模型。准入、日志与清单均在 `artifacts/t176/heavy-36972e4/`。
- 全量命令两次均为 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test`。第 1 轮 09:49:12–09:54:36 UTC、第 2 轮 09:55:10–10:01:09 UTC，均退出 0，727 项通过，0 失败、0 跳过。入口报告分别为 `artifacts/t167/test-run-1792230553204-47802/report.json` 与 `artifacts/t167/test-run-1792230910656-59626/report.json`；数据根分别为 `/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-test-IQcObR` 与 `/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-test-ImHnk5`。完整日志及报告副本见 `full-1.log`、`full-2.log`、`full-1-result.json`、`full-2-result.json`。
- `npm run build`：10:01:21–10:01:36 UTC，退出 0；证据 `build.log`、`build-result.json`。上述重任务未改实现或用例判断条件；此前本候选的 typecheck 与入口回归已通过。Next 自动修改的 `tsconfig.json` 继续保留在工作区，不进入验收记录提交。
- 两轮前后清单核对：`artifacts/t130/` 均无新增 `privacy-*` / `api-fixture-*` / `cli-fixture-*`。两轮均保留最近五轮全部目录，窗口外成功轮被删除，旧失败证据保留；当前为最近五轮加七份窗口外失败证据，共 12 个目录。证据 `before.json`、`after-full-1.json`、`after-full-2.json`、`verification-full-1.json`、`verification-full-2.json`；没有为压低目录总数删除失败证据。
- 人为失败：全量中的 T-176 回归使用最小 health 替身及临时 `fail.test.ts`，让真实 Node 用例抛出 `T176_EXPECTED_FAILURE`，入口返回非零，报告 `testCode: 1` / `INCOMPLETE`；提交代码与判断条件未改。失败目录 `/private/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-test-IQcObR/t176-ZKxOjo/artifacts/t167/test-run-1792230817110-56859/` 在随后五轮成功运行、第二轮全量与 build 完成后仍存在，入口日志输出了保留路径。原日志、报告与入口输出副本见 `injected-failure/`，完整核对见 `verification-full-1.json`、`summary.json`（均在本次证据目录下）。产物核查首次读取夹具预设的无报告中断目录报错，已保存 `verification-first-attempt-error.log` 并修正读取，没有重跑测试或隐藏失败。
- 本次验证结果 PASS；票整体仍为 INCOMPLETE，仅独立 sol 复审待主控安排，未勾选包含独立审查的第二项验收。代码、主工作区数据和真实外部依赖均未作额外改动；本次追加的验收结果本地提交，不推送。

- 2026-10-17 残留锁修复（父版本 `91145db`）：实现只改 `scripts/run-tests.ts` 的入口锁及其直接依赖导入，保留既有工作树校验、清理窗口、T-130 迁移与运行流程。锁新增 `{pid, startedAt}` 记录；对存活持有者拒绝、对 ESRCH 或无法解析的记录接管并明确输出。接管在同一文件原子追加完整声明，按首个存活声明决定唯一持有者，避免先读旧锁后删除另一轮新锁的竞态。读取拒绝符号链接，登记后核对文件描述符仍属于锁路径；未新增锁 API、依赖、等待或重试。
- 新增反例先在 `91145db` 的未改入口运行标准命令 `CHROME_PATH=<AGENTS 指定路径> npm test -- tests/t176-test-output.test.ts`：8 项中 4 项按预期失败，分别为死亡 pid 接管、不可解析记录接管、活跃 pid 拒绝诊断、并发接管唯一持有者；原有 4 项通过。最终带闸门的红日志 `artifacts/t176/stale-lock-gated-red-91145db.log`；初次红证据 `artifacts/t176/stale-lock-red-91145db/` 保留。并发闸门放在实际 ESRCH 探测边界，让两进程均确认同一 pid 不存在后再同时放行，不依赖固定 sleep 或实现里的特定锁原语。
- 2026-10-17 10:19 UTC，同一标准定向命令：8/8 通过，退出 0；证据 `artifacts/t176/stale-lock-green/{tests.log,report.json}`，入口目录 `artifacts/t167/test-run-1792232387990-93304/`。`node --test --experimental-strip-types scripts/t167-runner-regressions.ts`：4/4 通过，退出 0；产物为 `artifacts/t167/runner-regression-731d66cf-1fa1-43e9-840f-ba8dd5635ca1/`、`runner-regression-ac1b253d-7c53-4cb1-b36a-b7800b1fe4a1/`、`coexisting-dev-569d1ee5-8dc9-4c60-9992-53bb92f7c17f/`、`runner-regression-2f91bf51-c423-4078-881b-1eab1800f573/`。`npm run typecheck` 通过。AGENTS、README 和 spec 已同步锁协议；Next 自动改动的 `tsconfig.json` 不提交。
- 并发夹具首次闸门版本曾因嵌套字符串语法错误未能载入；这些失败保留在 `artifacts/t176/stale-lock-final-red-91145db.log` 及入口目录 `artifacts/t167/test-run-1792232304487-92292/`，不作为缺陷红证据。修正夹具后才取得上述最终红绿结果，未绕过或削弱判断条件。
- 前次两轮全量及 build 仅证明代码提交 `36972e4`，不作为本次锁改动的完整验收依据；第一项验收重新留待本候选全量验证。按主控最新要求只需再跑一轮全量：先回报 READY_FOR_HEAVY，等待「可以跑」，跑前仍核对 memory_pressure 与 ps。本轮未启动全量或 build，独立复审由主控另派。

- 2026-10-17，主控在本轮消息中转述第三轮独立复审 PASS，无阻断问题，并明确放行补齐 EPERM、旧时间戳但 pid 存活两条用例后运行一轮全量。新增用例只改 `tests/t176-test-output.test.ts`；已审查的生产入口仍为 `f657bd8`，没有再改锁协议或运行流程。
- 两条补充用例分别使用隔离进程探测替身返回 EPERM、以及真实存活 pid 搭配 `2000-01-01` 时间戳；均核对拒绝、锁路径和 pid 输出、没有登记新轮次、原锁未改写。先在 `91145db` 旧入口取得红结果，再分别临时加入“EPERM 当成残留”和“超过一分钟就忽略持有者”两个退化变体，各执行完整定向文件 10 项：均恰好 9 通过 / 1 失败，且只拦截对应新增用例；随后恢复原入口。证据 `artifacts/t176/optional-lock-cases/{parent-91145db.log,mutant-eperm-as-stale.log,mutant-timestamp-expiry.log,red-results.json}`。这些是测试检错反证，不代表已通过复审的实现存在上述缺陷。
- 2026-10-17 10:37–10:38 UTC，标准定向命令 `CHROME_PATH=<AGENTS 指定路径> npm test -- tests/t176-test-output.test.ts`：10/10 通过，0 跳过，退出 0；证据 `artifacts/t176/optional-lock-cases/green-{tests.log,report.json}`。`node --test --experimental-strip-types scripts/t167-runner-regressions.ts`：4/4 通过，退出 0，日志 `artifacts/t176/optional-lock-cases/runner.log`；`npm run typecheck` 通过。没有修改原有测试的判断条件。
- 10:38:59 UTC 首次重任务准入：内存空闲 45%，ps 发现两个 Node 测试进程（15997、16006），因此未启动全量；再次查询时二者已退出。10:39:33 UTC 再执行 `memory_pressure` 和 ps，空闲 50%，无其他无头 Chrome、Node 测试或 Next 构建，才启动本轮全量。首次检查记录独立保存在 `artifacts/t176/heavy-f657bd8/full-preflight-blocked.json` 与对应 memory-pressure 日志，未覆盖；本轮全量实际只执行一次。
- 全量命令：`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test`。2026-10-17 10:39:33–10:45:01 UTC，733 项全部通过，0 失败、0 跳过，退出 0；入口原报告 `artifacts/t167/test-run-1792233573509-17716/report.json`，数据根 `/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-test-4YDDZ7`。完整日志、报告副本、准入记录和结果在 `artifacts/t176/heavy-f657bd8/`。
- 本轮产物核对：T-130 无新增 `privacy-*` / `api-fixture-*` / `cli-fixture-*`；保留目录集合严格符合最近五轮加窗口外失败证据，当前共 27 个目录（最近 5 轮及窗口外 22 份失败证据），没有为压低数量删除失败轮。人为失败目录 `/private/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-test-4YDDZ7/t176-MJnJgo/artifacts/t167/test-run-1792233844192-27943/` 报告 `testCode: 1` / `INCOMPLETE`，经过随后五轮成功运行仍保留，入口输出了保留路径；副本见本轮证据目录的 `injected-failure/`。`summary.json` 记录核对结果，工作树锁已释放。
- 本轮按主控放行范围仅追加一轮全量，不追加 build；既有 build 通过记录保留在上文。主控确认的独立复审结果与本轮验证均 PASS，全部验收项已勾选。证据、红日志与原始失败目录保留；Next 自动改动的 `tsconfig.json` 不进入提交，未推送。
