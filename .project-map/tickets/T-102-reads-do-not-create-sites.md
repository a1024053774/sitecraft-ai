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

2026-10-04（America/New_York），codex-build，最终代码 SHA `93ffbfc3acab10e9879d2362d67a823d12d6f02d`：

- P1 根因收口已在代码 commit `8a4a35b` 完成：生产代码只保留 POST `/api/sites` 的 `createSite`；FS/Postgres commit、history、selective undo、chat 和 quality-run 缺站均拒绝，不再用 `createRecord`/INSERT 补空站。P2-a 在本次最终 commit `d85e37d` 将 actionStream、普通 SSE 和 commit 内层 catch 的 `Site not found:` 映射为 `site_not_found` 与“找不到这个站点”用户文案；长请求期间站点消失行为测试已通过。
- 入口/竞态行为测试最终 28/28 通过，聊天回归 22/22 通过，证据 `behavior-final-271c3e3.txt`、`chat-route-conversation-p2.txt`。父实现红测 `red-reads-parent.txt` 保留。
- `npm test` 最终 **779/779、0 失败**，见 `npm-test-final-93ffbfc.txt`；build → typecheck → build 均退出 0，见 `build-final-93ffbfc.txt`、`typecheck-final-93ffbfc.txt`、`build-final2-93ffbfc.txt`。
- 12 站 check-published 对照沿用主工作区 handoff ID、强制复制站点和 zsh 数组参数；低/高负载均 36 行、0 失败，textContrast/bodyLineLength/facts 条数不低于 `artifacts/merge-32a4ee9/check-published/report.json` 基线，逐行对照见 `artifacts/t099/check-published-merge-failure-diff.txt`。
- `readRecord` 对已有 `historySchemaVersion < 3` 记录仍会迁移并写回，这是既有的历史迁移契约；本票不把读取宣称为绝对无写。缺站不会触发该迁移。
- project-map status 无 stale；本地文档 commit 待提交，未 push。票状态保持 open，等待 Astra/Claude 验收。
