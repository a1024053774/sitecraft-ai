---
id: T-083
title: 浏览器测试一律用 SITECRAFT_BASE，并确认测的是当前工作区的代码
type: build
status: closed
blocked_by: []
claimed_by: codex-build
supersedes:
---

## What to build

T-079 合并时发现：12 个浏览器测试文件写死 `127.0.0.1:3034`（`tests/brand-word-wrap.test.ts`、`bright-browser-layout`、`catalog-layout-rules-browser`、`landwind-products-rows-browser`、`short-path-hero-fit`、`site-creation`、`short-path-variants-browser`、`site-style-check`、`t063-hero-title-fit`、`t057-rework`、`t075-prefix-behavior` 等）。在 worktree 里用自己的 dev server（3035 / 3036 / 3037）跑全量时，这些测试实际打到主工作区的 3034，测的是主工作区的代码；T-079 分支上一条本该失败的测试因此「通过」了，合并后才暴露。

- 所有浏览器测试和 `tests/helpers/` 统一从 `SITECRAFT_BASE` 取地址（缺省 3034），不再写死端口。
- 浏览器测试开始前确认 dev server 服务的是当前工作区：例如 dev server 暴露一个只在开发环境可用的标识（工作区路径或 git HEAD），测试启动时比对，不一致就直接失败并说明，而不是悄悄测别的代码。不能为此在生产路径加东西。
- T-077 的浏览器锁按端口分，保持不变。

## Acceptance

- [x] 测试先写、改动前先失败：在 SITECRAFT_BASE 指向另一个工作区的 dev server 时，浏览器测试直接失败并说明原因（而不是通过）
- [x] `grep` 不到写死的 3034 浏览器地址；主工作区全量 `npm test`、typecheck、build 通过；在一个 worktree 里用自己的端口跑一次全量也通过
- [x] 代码审查通过；Claude 验收

## Resolution

2026-10-03（America/New_York），codex-build：

- 先写的 `tests/t083-browser-base.test.ts` 在改动前运行于旧 3034 服务，因 `/api/health` 没有开发态工作区标识而失败，原始输出保存在 `artifacts/t083/red-base-behavior.txt`。实现后把测试进程放在 `../sitecraft-ai-blocks-pool`、把 `SITECRAFT_BASE` 指向主工作区 3034，得到真实错配失败（服务路径与测试工作区路径明确列出），输出见 `artifacts/t083/red-base-mismatch.txt`。
- 根因修在测试边界：`tests/helpers/workspace-browser.ts` 的 `base` 统一读取 `SITECRAFT_BASE`（缺省 3034），`assertWorkspaceServer()` 在 `openBrowser()` / `openWorkspace()` 获取浏览器锁前请求 `/api/health`，要求开发态 `testIdentity.cwd` 与当前 `process.cwd()` 相同；缺失标识、服务不可达或路径不一致都直接报错。12 个直接导航的浏览器测试、站点样式检查、T-075 行为夹具和锁恢复夹具都改用同一基址；剩余的 3034 文本只在共享默认值和隔离锁恢复夹具中出现，没有写死的浏览器导航地址。
- `/api/health` 仅在 `NODE_ENV !== "production"` 时增加 `testIdentity.cwd`；本机 `next dev` / 测试环境即使未设置 `NODE_ENV` 也会返回该字段，这是只服务本机开发测试的边界，`next start` 的生产运行设置 `NODE_ENV=production` 后不会返回测试标识。`docs/project/spec.md` 已记录该契约，`.project-map/MAP.md` 的 spec 覆盖范围和 Verified 已同步（`71c5a6f`）。
- 主工作区（`SITECRAFT_BASE=http://127.0.0.1:3034`、指定 Chrome for Testing 路径）全量 `npm test` 641/641 通过，输出见 `artifacts/t083/npm-test-main.txt`；`npm run typecheck` 和 `npm run build` 通过，输出见 `artifacts/t083/typecheck.txt`、`artifacts/t083/build.txt`。
- 在 `../sitecraft-ai-blocks-pool` 先将 `family-kit-assembly` 快进到本票提交 `63e7149`，用 3046 的独立 dev server 跑全量。第一次结果 `artifacts/t083/npm-test-worktree.txt` 为 634/641，7 项是该 worktree 缺少主工作区 ignored 模板 `dist/` 快照（并保留了一次既有 motion 时序失败）；补齐仅供测试读取的 ignored `fresh/genai/tailcast/dist` 后，第二次同端口全量 `artifacts/t083/npm-test-worktree-r2.txt` 为 647/647 通过。worktree 原有及后续出现的区块库/预览桥未提交改动均未触碰。
- `project_map.py status --root .`：Problems 0，Stale living docs 0。代码、测试和 living docs 已合入同一个本地 commit，未 push。

独立审核与验收（2026-10-03 EDT）：Astra PASS（`artifacts/review-astra-t083.md`，`39495fb`；blocks-pool 上的 `63e7149` 是同一份代码）。浏览器测试统一用 `SITECRAFT_BASE`，开始前比对 `/api/health` 的开发态 `testIdentity.cwd`，不一致直接失败（fail-closed：符号链接或大小写不同会误拒，不会误放）。红测在父提交上行为级失败；主线 641/641、blocks-pool worktree 647/647。已知部署注意事项：NODE_ENV 未设置的开发服务器若暴露到网络，`/api/health` 会返回本机绝对路径——本阶段只做本机 Demo，不构成问题；若以后做部署，部署票要确认 `NODE_ENV=production`。Claude 验收关闭。
