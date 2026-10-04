---
id: T-102
title: 只读路径不再顺手创建空站点
type: build
status: open
blocked_by: []
claimed_by: codex-build
supersedes:
---

## What to build

`lib/site-store.ts` 的 `getSite` 是「读不到就用默认草稿新建并写盘」。以下只读路径都调用它：

- 访客页 `app/published/[siteKey]/page.tsx`（两处）：打开一个不存在或打错的发布地址，不返回 404，而是写出一个默认空站点文件，并给访客渲染「未命名企业」的空模板页。
- `GET /api/sites/[siteId]/draft`：读草稿时站点不存在也会新建。
- `app/api/quality/cells/route.ts`：按固定 id（`p4-sw-bright`、`p4-long` 等）读质量对照站点，缺失时同样写出默认空站点。

实例：2026-10-03 另一个 worktree 里 `566fcfc1` 在站点文件复制进来之前被访问（多半是 `check-published` 打开了它的发布页），于是写出 19:07 的 7KB 空草稿；之后复制脚本因「文件已存在」跳过，12 站 `check-published` 测的是空站。

后果：访客看到演示壳（违反成品否决项）、磁盘上累积用户没有建过的站点（本项目不做自动清理）、检查工具在站点缺失时静默测空页。

改为：只有用户明确新建（`POST /api/sites`）才创建站点；只读路径用 `getExistingSite`，不存在时访客页返回 404、草稿接口返回 404 和清楚的错误、质量对照报告缺失的站点 id，都不写盘。对话 / 提交路径若站点不存在，按「站点不存在」报错，不隐式新建。先确认工作台新建流程（新建站点、刷新恢复）不依赖 GET 隐式创建，若依赖，改为显式创建，不保留第二条路径。

## Acceptance

- [x] 测试先写、改动前先失败（行为级）：访问不存在的发布地址返回 404 且不产生站点文件；GET 不存在站点的草稿返回 404 且不写盘；质量对照缺站时报告缺失且不写盘；工作台新建 → 生成 → 刷新恢复的主流程仍通过
- [x] `npm run typecheck`、`npm test`（0 失败）、`npm run build` 通过；12 站 `check-published` 通过（基线 `artifacts/merge-32a4ee9/check-published/report.json`，逐行实测条数不少于基线）
- [ ] 代码审查通过；Claude 验收

## Resolution

2026-10-04（America/New_York），codex-build：

- 先行夹具修复已单独提交 `2f4a00a`：父提交在干净 worktree 上的 `tests/t100-structured-output.test.ts` 以 `ENOENT` 失败，证据 `artifacts/t102/t100-fixture-red-parent.txt`；提交 `tests/fixtures/t100-structured-output-raw-calls.json` 后两项通过。grep 显示 tests 中唯一读取 `artifacts/` 输入的测试就是该文件，其余命中均为输出目录或注释。
- T-102 行为红测先于代码失败，见 `artifacts/t102/red-reads-parent.txt`：草稿 GET、发布页、质量矩阵和聊天缺站均未返回缺失错误。实现改为读路径使用 `getExistingSite`；POST 创建仍显式初始化，草稿 PUT、聊天、图片、历史和质量路径的缺站请求均返回 `site_not_found`，不写站点文件。工作台显式 POST 新建后可重新读取草稿。
- 当前行为测试 `tests/t102-reads-do-not-create-sites.test.ts` 6/6 通过，日志 `artifacts/t102/green-reads-t102-final.txt`。
- 最终全量首次在高负载下只剩已知 workspace motion 失败（776 项中 775 通过，见 `artifacts/t102/npm-test-rerun.txt` 和 `uptime-npm-test-rerun.txt`）；低负载 focused motion 通过，随后全量 **776/776、0 失败**，见 `npm-test-rerun2.txt`。typecheck/build 均退出 0，见 `typecheck-final.txt`、`build-final.txt`。
- 12 站 check-published 使用主工作区只读复制的站点 JSON和正确的 zsh 数组传参，36 行、0 失败。`artifacts/t102/check-published-diff.txt` 对照 `artifacts/merge-32a4ee9/check-published/report.json`：当前各行 `textContrast`、`bodyLineLength`、`facts` 条数均不少于基线，失败集合相同为空；报告在 `artifacts/t102/check-published-final-array/report.json`。
- 本地 dev server 3062 已停止；project-map status 复核无 stale。T-102 代码、测试和 Resolution 待本次提交，未 push。
