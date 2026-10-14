---
id: T-166
title: 提交检查不再打开站点列表首页
type: build
status: closed
blocked_by: []
claimed_by: Codex (t166-check-origin)
supersedes:
---

## Why

`lib/code-site-check.ts` 每次提交检查先让 Chrome 打开 `${SITECRAFT_BASE}/` 来取得 HTML 源。首页会列出全部站点；主目录已有 4,223 个 code-sites（多数是全量测试建的），空闲时首页就要 6–8 秒。全量测试多个 Chrome 并发时，`Page.navigate` 超过 30 秒：2026-10-14 主线 `5d69145` 三次全量都是 356–379/434，失败几乎全是该超时，单独跑同一文件全过（日志 `artifacts/merge-5d69145/`）。真实使用中站点一多，每次提交检查也会变慢。

## What to build

1. 检查器改为打开一个不读站点数据、不带应用脚本的最小 HTML 源（例如 `public/` 下的静态空白页），保持现有 origin 校验和后续 `setDocumentContent`/资源拦截不变。
2. Dockerfile runtime 复制完整 `public/`；检查器须先确认 HTTP 200、HTML 类型、固定标记和无脚本，静态页缺失或无效即报错，不继续检查候选。
3. 不删除、不清理主目录 `.sitecraft-data`（用户数据，T-003）。测试写入主数据目录的问题只记录，不在本票改。

## Acceptance

- [x] 测试证明检查器不再请求站点列表首页（例如用本地 HTTP 源记录请求路径），并且首页很慢时检查仍在时限内完成；先在父版本上失败
- [x] Dockerfile runtime 复制完整 public；静态页缺失或无效明确失败，新增测试先在 abca092 上失败
- [x] 主线标准全量 `npm test`、typecheck、build 通过
- [x] 独立 sol 实例代码审查通过

## Resolution

状态：**INCOMPLETE**（全票）。主控转达的新 sol 审查对 `abca092` 给出 NO_GO/P2：runtime 漏复制 public，静态页缺失时应用 404 仍被当作检查源。本次修复与聚焦验证已通过，待主线全量和独立复审；按主控要求不跑全量浏览器测试、不重建 Docker 镜像、不自行启动审查，票保持 open。

本次提交与此 Resolution 同一提交，父提交 `abca0921e033db600b9c024cff6ed72b49f954f8`；主题 `fix: 校验检查静态源并随镜像复制 public（T-166）`。精确 SHA 用 `git log -1 --format=%H -- .project-map/tickets/T-166-check-origin-page.md` 读取。以下证据针对本次工作树代码，只有票据记录在测试后回写。

- Dockerfile runtime 增加完整 `/app/public` → `./public` 复制，包含检查源、风格缩略图和系统底图。配置测试检查 runtime 阶段；未构建或运行 Docker 镜像，不把配置验证当作镜像实测。
- 静态页增加 `sitecraft-code-check=v1` meta 标记。原 origin/readyState 校验后、候选清理前，检查 HTTP 200、`text/html`、该标记与无 script；不符即抛「提交检查静态页缺失或无效（/code-check.html），本次未保存版本。」后续 `setDocumentContent` 和资源拦截保留。
- 17 处既有 HTTP 替身经 `tests/fixtures/code-check-document.ts` 读取真实静态页作为输入，原断言与 JSON 异常场景保留；真实事实回归脚本同样读取该文件，未执行真实模型脚本。反例 HTML、状态和拒绝期望独立写在 T-166 测试中，不从静态页生成期望值。
- 本次环境：工作树 `/Users/luckye/Documents/Code/sitecraft-ai-t166`，随机端口 `SITECRAFT_BASE=http://127.0.0.1:59223`，`SITE_STORE=fs`；`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell`。dev server 为 `npm run dev -- --hostname 127.0.0.1 --port 59223`；测试自身的 HTTP 源也用随机端口。
- **abca092 红灯，2026-10-14 04:25 UTC**：上述 BASE/Chrome 下 `node --test --experimental-strip-types tests/t166-check-origin.test.ts`，2/8、退出 1；`artifacts/t166/review-red-abca092.log`、`artifacts/t166/origin-1791951929480-74728/checks.json`。当时 Dockerfile、检查器与静态页均未改。缺失页使用本工作树普通 Next 服务真实生成、带应用脚本的 404；原检查器继续接受。其他 HTML、有标记的 404、带应用脚本的标记页也被接受；非 HTML 原先已被拒，但要到候选渲染阶段才报旧错误。runtime 复制配置测试同样红灯。
- **同一命令转绿，04:26 UTC**：8/8、退出 0、0 skipped；`artifacts/t166/review-green.log`、`artifacts/t166/origin-1791951984095-75239/checks.json`。缺失/错误源均明确拒绝，正常页和首页持续阻塞两项仍通过。
- **补充聚焦，04:27 UTC**：相同 BASE/Chrome 下 `node --test --experimental-strip-types tests/t166-check-origin.test.ts tests/t145-import-cli.test.ts tests/t148-system-backdrops.test.ts tests/t152-restore-facts.test.ts`，25/25、退出 0、0 skipped，日志 `artifacts/t166/review-focused.log`。覆盖离线导入、三档底图加载与对比度、恢复沿用及无效 JSON 源拒绝。
- **本次 build/typecheck，04:27 UTC**：`npm run build`、随后 `npm run typecheck` 均退出 0，日志 `artifacts/t166/review-build.log`、`artifacts/t166/review-typecheck.log`。没有同时启动 build 与 typecheck。
- T-148 的 1440/768/375 截图位于 `artifacts/t148/boundary-1b208ee1-23e0-45bd-a9f7-2914a96566d0/site-{width}.png`，三张均已打开：底图和正文已载入，不是空白或载入态；不作审美结论。提交检查的三档结果在本轮 `checks.json`，未用截图代替检查结果。

此前失败证据继续保留：`artifacts/t166/red-parent-ab6cd1c.log`；abca092 前两轮全量均 435/436，分别为漏适配的 T-145 路径断言与 T-162 完成后状态被覆为中断，日志 `artifacts/t166/npm-test.log`、`artifacts/t166/npm-test-final.log`。T-162 的 `artifacts/t162/self-contained-1791951236401-36892/` 保留时序和已打开的失败截图；本次不扩改 workflow，不以聚焦通过覆盖旧全量失败。

未推送、未调用真实 DeepSeek、未载入 `.env.local`、未清理任何 `.sitecraft-data`。`git diff --check` 通过，中文 UTF-8 回读正常；`project_map.py status --root .` 的 Problems 和 Stale living docs 均为 0。主线全量与独立复审由主控安排。

### 关票（主控）

独立 sol 实例 t166-review：abca092 NO_GO（镜像漏复制 public、404 被当检查源），efef2f8 复审 PASS。2026-10-14 00:35 前后（纽约时间）主控在主线 `58f2827`（含 T-162/T-165/T-166 合并）无其他 Chrome 测试时运行 `SITECRAFT_BASE=http://127.0.0.1:3034 CHROME_PATH=… npm test` **465/465**（119 s），`npm run typecheck`、`SITE_STORE=fs npm run build` 通过；日志 `artifacts/merge-58f2827/`。 全量耗时由约 8 分钟降至 2 分钟。
