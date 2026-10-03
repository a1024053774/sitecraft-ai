---
id: T-083
title: 浏览器测试一律用 SITECRAFT_BASE，并确认测的是当前工作区的代码
type: build
status: open
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

- [ ] 测试先写、改动前先失败：在 SITECRAFT_BASE 指向另一个工作区的 dev server 时，浏览器测试直接失败并说明原因（而不是通过）
- [ ] `grep` 不到写死的 3034 浏览器地址；主工作区全量 `npm test`、typecheck、build 通过；在一个 worktree 里用自己的端口跑一次全量也通过
- [ ] 代码审查通过；Claude 验收
