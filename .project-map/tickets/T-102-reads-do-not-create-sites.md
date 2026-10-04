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

- [ ] 测试先写、改动前先失败（行为级）：访问不存在的发布地址返回 404 且不产生站点文件；GET 不存在站点的草稿返回 404 且不写盘；质量对照缺站时报告缺失且不写盘；工作台新建 → 生成 → 刷新恢复的主流程仍通过
- [ ] `npm run typecheck`、`npm test`（0 失败）、`npm run build` 通过；12 站 `check-published` 通过（基线 `artifacts/merge-32a4ee9/check-published/report.json`，逐行实测条数不少于基线）
- [ ] 代码审查通过；Claude 验收
