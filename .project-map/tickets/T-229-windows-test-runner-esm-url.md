---
id: T-229
title: 修复原生 Windows 下 npm test 测试入口的 ESM 路径与子进程启动报错
type: build
status: open
blocked_by: []
claimed_by:
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

- [ ] 修复后在原生 Windows PowerShell 下运行 `node --test --experimental-strip-types scripts/t167-runner-regressions.ts` 全部通过
- [ ] 在原生 Windows PowerShell 下运行 `$env:CHROME_PATH='C:\Users\10240\.cache\chrome-for-testing\chrome-headless-shell\win64-154.0.8037.92\chrome-headless-shell-win64\chrome-headless-shell.exe'; npm test -- tests/t166-check-origin.test.ts` 与一个非浏览器单测均实际执行用例并通过（`executed > 0`，`report.json` 为 `PASS`）
- [ ] `npm run typecheck` 通过，`AGENTS.md` / `README.md` / `docs/project/spec.md` 与 `project_map.py status --root .` 无新增过时 living doc
