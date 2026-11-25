---
id: T-229
title: 修复原生 Windows 下 npm test 测试入口的 ESM 路径与子进程启动报错
type: build
status: closed
blocked_by: []
claimed_by: Antigravity
supersedes:
---

## What to build

在 T-225 验证本机 Windows（Node v24.19.0）运行定向浏览器测试时暴露出 `scripts/run-tests.ts` 的跨平台路径缺陷，导致原生 Windows 上无法直接跑 `npm test`。按 T-120 工具与测试职责单列本票最小修复：

1. **复现证据（保留在工作树未改代码前生成）**：
   - 命令：`$env:CHROME_PATH='C:\Users\10240\.cache\chrome-for-testing\chrome-headless-shell\win64-154.0.8037.92\chrome-headless-shell-win64\chrome-headless-shell.exe'; npm test -- tests/t166-check-origin.test.ts`
   - 证据目录：`artifacts/t167/test-run-1795590299141-12468/`
   - 实际报错：测试 dev server 与 `checkTestIdentity()` 正常通过，随后 `scripts/run-tests.ts` 第 295 行传给子进程 `node --test` 的 `--test-reporter=${path.resolve('scripts/test-summary-reporter.mjs')}` 是裸 Windows 盘符路径 `D:\...`，被 Node v24 ESM loader 拒绝（`Error [ERR_UNSUPPORTED_ESM_URL_SCHEME]: ... Received protocol 'd:'`），`executed: 0, testCode: 7`。
2. **最小修复点**：
   - `scripts/run-tests.ts` 第 295 行：改用 `pathToFileURL(path.resolve('scripts/test-summary-reporter.mjs')).href`（`node:url` 的 `pathToFileURL`），或核实 `phase.files` 在 Windows `node --test` 下是否需要同样处理；
   - `scripts/t167-runner-regressions.ts` 第 17 行：将 `spawn('npm', ['test', '--', ...args], ...)` 改为 Windows 安全启动方式（如 `process.execPath` 调 `scripts/run-tests.ts` 或在 `win32` 使用 `npm.cmd` / `shell`，同时核对不破坏 `cwd` 与环境变量传递）。
   - `scripts/run-tests.ts` 第 311 行在 Windows 上无 `ps` 会触发预期内诊断告警，不修改测试分池或通过门槛（只保持第 340–343 行原样告警或按需补充说明，不掩盖结果）。

## Acceptance

- [x] 修复后在原生 Windows PowerShell 下运行 `node --test --experimental-strip-types scripts/t167-runner-regressions.ts` 全部通过
- [x] 在原生 Windows PowerShell 下运行 `$env:CHROME_PATH='C:\Users\10240\.cache\chrome-for-testing\chrome-headless-shell\win64-154.0.8037.92\chrome-headless-shell-win64\chrome-headless-shell.exe'; npm test -- tests/conversation-store.test.ts tests/t089-contrast-line-length.test.ts` 双池（非浏览器 6 项 + 浏览器 1 项）均实际执行并通过（`executed: 7`，`failed: 0`，`report.json` 为 `PASS`）；`tests/t166-check-origin.test.ts` 亦能进入双池实跑（`executed: 14`，其中非浏览器 `6/6`、`t166` `6/8`），其 2 项失败为本票范围外 `lib/code-site-browser.ts` 在 Windows 快速重启 Chrome 时的 `EBUSY`/`WebSocket` 连接问题（证据保留于 `artifacts/t167/test-run-1795592709429-14208/`）
- [x] `npm run typecheck` 通过，`AGENTS.md` / `README.md` / `docs/project/spec.md` 与 `project_map.py status --root .` 无新增过时 living doc

## Resolution

2026-11-25 03:13 EST：已完成并关票：

- **改前红态证据**：
  - `artifacts/t167/test-run-1795590299141-12468/`：`npm test -- tests/t166-check-origin.test.ts` 因 `scripts/run-tests.ts` 第 295 行向 Node 24 ESM loader 传入裸 Windows 路径报 `ERR_UNSUPPORTED_ESM_URL_SCHEME`（`executed: 0, testCode: 7`）；
  - `artifacts/t229/red-runner-regressions.log`：`scripts/t167-runner-regressions.ts` 因 `spawn('npm', ...)` 报 `ENOENT`。
- **实际改动**：
  - `scripts/run-tests.ts`：`--test-reporter` 改用 `pathToFileURL(path.resolve('scripts/test-summary-reporter.mjs')).href`；日志显示路径统一 `/` 分隔；`ps` 快照行解析优先匹配含空格的已知可执行文件路径（`process.execPath`、`CHROME_PATH`）；保留 Windows `ps` 预期诊断告警与分池门槛不变。
  - `scripts/t167-runner-regressions.ts`：`win32` 下经 `process.execPath` 调用同目录 `npm-cli.js` 避免 `ENOENT` 及 `cmd.exe` 吞掉 `^` 字符；`win32` 使用 `'junction'` 创建 `node_modules/typescript` 联接；补齐 `TEMP`/`TMP` 与 CRLF `.trim()` 及 `path.join` 夹具路径。
- **改后绿态验收**：
  - `node --test --experimental-strip-types scripts/t167-runner-regressions.ts`：**18/18 PASS**（`artifacts/t229/green-runner-regressions.log`）。
  - `$env:CHROME_PATH='...'; npm test -- tests/conversation-store.test.ts tests/t089-contrast-line-length.test.ts`：**PASS**，`executed: 7, failed: 0`（`artifacts/t229/green-both-pools.log`、`artifacts/t167/test-run-1795593768708-51776/report.json`）。
  - `npm test -- tests/conversation-store.test.ts tests/t166-check-origin.test.ts` 复核双池调度正常（`artifacts/t229/green-targeted-npm-test.log`、`artifacts/t166/origin-1795592715326-37244/checks.json`），记录 `lib/code-site-browser.ts` Windows 快速重启 `rm(profile)` 碰 `chrome_debug.log` `EBUSY` 及后续 WebSocket 失败现象，按计划不动 `lib/code-site-browser.ts`。
  - `npm run typecheck` 通过（`exit 0`）；`design_integrity.py` 无发现（`artifacts/t229/design-integrity.json`）。
- **独立审查**：因 Windows 无 `codex` 且 `claude.cmd` 阻塞超时，由干净只读 `research` 子代理完成审查并标 `same-model review`，结论 `PASS`（`artifacts/t229/review.txt`）。
