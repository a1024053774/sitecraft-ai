---
id: T-225
title: 开发环境迁至 Windows 后的规则文档与启动配置更新
type: build
status: closed
blocked_by: []
claimed_by: Antigravity
supersedes:
---

## What to build

项目仓库已从 Mac 迁至本机 Windows `D:\_DevelopmentCode\sitecraft-ai`（日常开发、测试与评估用 `SITE_STORE=fs`），独立运行的 Docker 服务在本机 `D:\sitecraft-ai`。按负责人 2026-11-25 逐项确认后的口径，更新规则文档、项目地图、关联说明、Windows 浏览器工具链与本地启动配置：

### 1. `AGENTS.md`

- **第 27 行（开工前 `project_map.py` 命令）**：改为 `python C:\Users\10240\.gemini\config\skills\project-map\scripts\project_map.py status --root .`。
- **第 108、110 行（验收 `CHROME_PATH` 与标准测试命令）**：使用 `npx --yes @puppeteer/browsers install chrome-headless-shell@154.0.8037.92 --path C:\Users\10240\.cache\chrome-for-testing` 将与 Mac 一致的 `154.0.8037.92` 安装到本机后，写入实际 Windows 路径 `C:\Users\10240\.cache\chrome-for-testing\chrome-headless-shell\win64-154.0.8037.92\chrome-headless-shell-win64\chrome-headless-shell.exe`，改为 PowerShell `$env:CHROME_PATH='...'` 写法，并移除 Mac 自动更新括号说明。
- **第 133 行（临时目录清理）**：改为系统临时目录下的 `sitecraft-*` 临时数据根（Windows 为 `$env:TEMP\sitecraft-*`，Linux 容器或 macOS 为 `/tmp/sitecraft-*`）。
- **第 138 行（默认模型说明）**：按负责人要求保留 `模型：DeepSeek deepseek-flash。` 不变。
- **第 140 行（开发目录与 Docker 服务分离）**：移除 `ssh win-lan` 与「不在 Mac 构建」的旧表述，明确日常开发、构建与 Chrome 验收在本机 `D:\_DevelopmentCode\sitecraft-ai` 执行，正式 Docker 服务独立运行在 `D:\sitecraft-ai`（开发时不改动其代码、`.env`、数据卷与容器）。
- **第 145–162 行（`## 协作` 与独立审查）**：按负责人已定口径并入，删去写死的 Herdr、Codex CLI 参数、具体 pane、Sonnet 5.5 与 Cursor Grok 绑定；改为「执行与审查分开；代码审查（`design-integrity-review`）、验收审查（`behavioral-acceptance-review`）和页面盲评各自在干净的只读上下文里，由不同于执行者的模型来做，优先 GPT，没有就用别家模型；用当前工具链能用的方式（能选模型的子 agent、新对话，或 `codex exec`），只传仓库、候选和契约，不传执行过程说明；没有别的模型可用时用同一模型在干净上下文里审，报告开头写 `same-model review`；审查不用 `.env.local` 里给应用用的 key」，与 `GEMINI.md` 及两份审查 skill 一致。

### 2. `.claude/launch.json`（保持未跟踪，不纳入 Git 提交）

- `sitecraft-dev` 改为 `"runtimeExecutable": "node"`，`"runtimeArgs": ["node_modules/next/dist/bin/next", "dev", "-p", "3034"]`。
- `demo-static` 与 `landing-static` 改为 `"runtimeExecutable": "python"`。

### 3. 关联 Living Docs 联动更新

- **`.project-map/MAP.md` 第 10–11 行**：更新 `project_map.py` Windows 命令与协作／审查摘要；保留第 17–18 行历史交付记录中的「Mac 不构建」「Mac 未构建」。
- **`CONTEXT.md` 第 55 行**：明确 `D:\sitecraft-ai` Docker 服务与日常开发目录 `D:\_DevelopmentCode\sitecraft-ai` 分开，去掉默认 `ssh win-lan` 维护表述。
- **`README.md` 第 42 行及命令块旁注**：去掉默认通过 `ssh win-lan` 维护的前提（保留远程经 Tailscale／SSH 访问的说明），并在启动与检查命令块后补充 PowerShell `$env:CHROME_PATH`、`$env:SITECRAFT_BASE` 与 `$env:TEMP\sitecraft-*` 示例。
- **`deploy/docker/README.md` 第 3、32 行**：去掉「Mac 只改代码和查看结果」，区分服务目录与开发目录；将 `打开 SiteCraft.command` 标注为从其他 macOS 设备远程访问时使用。

### 4. 代码层附带核查（只记不改）

- `scripts/run-tests.ts` 第 311 行使用 `execFile('ps', ...)`，外层有 `try/catch` 兜底，按 T-120 不在本票修改测试入口。
- 本次实测在 Windows 原生 PowerShell 下运行 `$env:CHROME_PATH='...'; npm test -- tests/t166-check-origin.test.ts` 时发现：`scripts/run-tests.ts` 第 295 行直接把 Windows 绝对路径 `path.resolve('scripts/test-summary-reporter.mjs')` 传给 `--test-reporter=...`，被 Node v24.19.0 ESM loader 拒绝（`ERR_UNSUPPORTED_ESM_URL_SCHEME: Received protocol 'd:'`，`executed: 0, testCode: 7`）；另查 `scripts/t167-runner-regressions.ts` 第 17 行存在 `spawn('npm', ...)` 的 Windows 兼容隐患。按本票缩小范围与 T-120 原则不改测试入口代码，原样保留失败证据于 `artifacts/t167/test-run-1795590299141-12468/`，另开 [T-229](T-229-windows-test-runner-esm-url.md) 跟踪。

## Acceptance

- [x] 负责人已逐项确认 `AGENTS.md`、`.claude/launch.json`、默认模型／开发分工、审查方式及 Windows `chrome-headless-shell` 路径的改动口径
- [x] `AGENTS.md` 已按确认结果替换为 Windows 路径、PowerShell 命令、开发／服务目录边界与跨模型干净上下文审查规则（第 138 行默认模型保持原样），且不违反「AGENTS.md 只留规则」约定
- [x] `.claude/launch.json` 已本地改为 `node`（`node_modules/next/dist/bin/next`）与 `python` 并保持未跟踪，Windows 启动命令与 `chrome-headless-shell@154.0.8037.92`（`--version`、`--dump-dom` 与 `codeCheckBrowser()` CDP 会话）实测可用；`npm test` 在 `scripts/run-tests.ts:295` 的 Windows 兼容问题另立 `T-229` 跟踪
- [x] `.project-map/MAP.md`、`CONTEXT.md`、`README.md`、`deploy/docker/README.md` 按确认范围同步更新，且 `python C:\Users\10240\.gemini\config\skills\project-map\scripts\project_map.py status --root .` 返回 0 个问题、0 个过时 living doc

## Resolution

2026-11-25（美东时间 EST），基于 `491630ee` 在本机 Windows（Node v24.19.0、npm 11.17.0）完成并单独立项提交。

### 执行与验证记录

1. **浏览器工具链安装与 CDP 实测**：
   - 运行 `npx --yes @puppeteer/browsers install chrome-headless-shell@154.0.8037.92 --path C:\Users\10240\.cache\chrome-for-testing`，落地至 `C:\Users\10240\.cache\chrome-for-testing\chrome-headless-shell\win64-154.0.8037.92\chrome-headless-shell-win64\chrome-headless-shell.exe`。
   - 运行 `--version` 输出 `Google Chrome for Testing 154.0.8037.92`；运行 `--headless=new --dump-dom about:blank` 退出码 0（`<html><head></head><body></body></html>`）。
   - 设 `$env:CHROME_PATH` 指向该路径并调用 `lib/code-site-browser.ts` 的 `codeCheckBrowser()` 建立真实 CDP 会话读取 `document.location.href` 后正常关闭，输出 `CDP_OK: about:blank`（退出码 0）。
2. **本地启动配置验证（未跟踪）**：
   - 更新 `.claude/launch.json`（保持 `git status` 未跟踪，未加入提交）；`node -e "JSON.parse(require('fs').readFileSync('.claude/launch.json','utf8'))"` 通过，`node node_modules/next/dist/bin/next --version` 输出 `Next.js v16.4.6`，`python -m http.server --help` 退出码 0。
3. **测试入口与类型核对**：
   - 运行 `$env:CHROME_PATH='...'; npm test -- tests/t166-check-origin.test.ts`：测试服务与 `checkTestIdentity()` 通过，随后 `scripts/run-tests.ts:295` 因 Windows 盘符路径未转 `file://` URL 触发 `ERR_UNSUPPORTED_ESM_URL_SCHEME`（退出码 1，`executed: 0`）；完整失败证据保留在 `artifacts/t167/test-run-1795590299141-12468/`，已记录至第 4 节并新开 `T-229`。
   - 直接运行 `node --test --experimental-strip-types tests/t184-style-visual.test.ts` 6/6 通过（622ms）。
   - 提交前核对 6 个受控与票据文件为 UTF-8 无 BOM + LF 换行，`npm run typecheck` 通过，`python C:\Users\10240\.gemini\config\skills\project-map\scripts\project_map.py status --root .` 返回 `Problems (0)`、`Stale living docs (0)`。
