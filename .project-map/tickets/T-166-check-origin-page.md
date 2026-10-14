---
id: T-166
title: 提交检查不再打开站点列表首页
type: build
status: open
blocked_by: []
claimed_by: Codex (t166-check-origin)
supersedes:
---

## Why

`lib/code-site-check.ts` 每次提交检查先让 Chrome 打开 `${SITECRAFT_BASE}/` 来取得 HTML 源。首页会列出全部站点；主目录已有 4,223 个 code-sites（多数是全量测试建的），空闲时首页就要 6–8 秒。全量测试多个 Chrome 并发时，`Page.navigate` 超过 30 秒：2026-10-14 主线 `5d69145` 三次全量都是 356–379/434，失败几乎全是该超时，单独跑同一文件全过（日志 `artifacts/merge-5d69145/`）。真实使用中站点一多，每次提交检查也会变慢。

## What to build

1. 检查器改为打开一个不读站点数据、不带应用脚本的最小 HTML 源（例如 `public/` 下的静态空白页），保持现有 origin 校验和后续 `setDocumentContent`/资源拦截不变。
2. 不删除、不清理主目录 `.sitecraft-data`（用户数据，T-003）。测试写入主数据目录的问题只记录，不在本票改。

## Acceptance

- [x] 测试证明检查器不再请求站点列表首页（例如用本地 HTTP 源记录请求路径），并且首页很慢时检查仍在时限内完成；先在父版本上失败
- [ ] 主线标准全量 `npm test`、typecheck、build 通过
- [ ] 独立 sol 实例代码审查通过

## Resolution

状态：**INCOMPLETE**。实现与聚焦验证完成；标准全量仍有一项 T-162 失败，独立审查由主控安排，票保持 open。本次不推送，不调用真实 DeepSeek，不载入 `.env.local`，不清理任何 `.sitecraft-data`。测试写入主数据目录的问题仍留在本票范围外。

本次提交与此 Resolution 同一提交，父提交为 `ab6cd1cc17b3eebc0823fa18912f4591b358645f`；提交主题为 `fix: 提交检查使用静态 HTML 源（T-166）`。下述运行均针对本次工作树代码，只有验收记录在测试后回写。精确 SHA 可用 `git log -1 --format=%H -- .project-map/tickets/T-166-check-origin-page.md` 读取。

- 检查器改为请求 `/code-check.html`，文件位于 `public/`，不读取站点数据、不带应用脚本。origin 校验、`setDocumentContent` 与后续资源拦截不变。5 处既有 HTTP 替身的允许路径同步更新；4 份 living docs 窄改同步当前行为。
- 浏览器验证使用本工作树随机端口 `SITECRAFT_BASE=http://127.0.0.1:50953`、`SITE_STORE=fs`，`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell`。dev server 由 `npm run dev -- --hostname 127.0.0.1 --port 50953` 启动；新测试读取显式 BASE，另自建随机端口 HTTP 源，非首页请求转给本工作树普通 dev server。
- **父版本红灯**（2026-10-14 04:07 UTC）：`node --test --experimental-strip-types tests/t166-check-origin.test.ts`，0/2。正常首页场景实际请求 `/`；持续阻塞场景超过预先设定的 20 秒期限。候选检查器当时未修改。记录：`artifacts/t166/origin-1791950846894-26204/checks.json`、`artifacts/t166/red-parent-ab6cd1c.log`。首次 tee 早于目录创建而未建立日志，日志文件保存原终端输出，未重跑红灯。
- **同一测试转绿**（04:08 UTC）：相同命令 2/2；首页持续阻塞时约 0.29 秒完成，两个场景都只请求静态源，HTTP 200、`text/html`、无脚本，375/768/1440 检查全部完成。记录：`artifacts/t166/green-focused.log`、`artifacts/t166/origin-1791950891240-26436/checks.json`。
- **首轮标准全量**（04:09–04:12 UTC）：上述 BASE/Chrome 环境下 `npm test`，435/436，退出 1，0 skipped。唯一失败是 T-145 CLI 替身仍把非 `/` 请求计为意外调用；保留 `artifacts/t166/npm-test.log`，修正其允许路径后继续验证。
- **最终聚焦**（04:12 UTC）：`node --test --experimental-strip-types tests/t145-import-cli.test.ts tests/t166-check-origin.test.ts`，4/4、退出 0；`artifacts/t166/focused-final.log`。
- **构建与类型检查**（04:12–04:13 UTC）：`npm run build` 退出 0，日志 `artifacts/t166/build-final.log`；随后 `npm run typecheck` 退出 0，日志 `artifacts/t166/typecheck-after-build.log`。此前并行启动这两项时，build 重建 `.next/types` 导致 typecheck 缺文件；该调度失败保留在 `artifacts/t166/typecheck-final.log`，未改代码或放宽检查。
- **第二轮标准全量**（04:13–04:15 UTC）：相同 BASE/Chrome 环境下 `npm test`，435/436、退出 1、0 skipped；日志 `artifacts/t166/npm-test-final.log`。启动两轮前均确认没有其他 Chrome 测试进程。T-145 已通过；T-166 两项通过，整轮负载下阻塞首页场景约 0.67 秒，记录 `artifacts/t166/origin-1791951240048-37169/checks.json`。不再重跑整轮掩盖失败。

剩余失败：`tests/t162-mobile-reveal.test.ts:61` 的 375 跨页线程定位用例等待 `annotation-draft` 消失 20 秒后失败。`artifacts/t162/self-contained-1791951236401-36892/timings.json` 中同一 run 在 04:14:07.292Z 为 complete，04:14:07.321Z 又变为 error（「生成进程已中断」）；`lib/code-site-workflow.ts` 的 state 分支按读取时的 running 状态判中断，`runStep` 写回只校验 run ID，未防止完成后的状态被覆盖。这指向完成与状态读取的竞态，不是 `Page.navigate` 超时；本票不扩改 workflow 或 T-162 测试，交主控转 T-162 处理。失败截图 `artifacts/t162/self-contained-1791951236401-36892/mobile-journey-failure-375-4f582d5c-bb27-4776-bf03-7be4e7561673.png` 已打开，显示当前 v2 及仍保留的中断草稿；不作为审美结论。

`git diff --check` 通过；中文文件以 UTF-8 回读正常；`project_map.py status --root .` 的 Problems 与 Stale living docs 均为 0。未自行启动独立审查。
