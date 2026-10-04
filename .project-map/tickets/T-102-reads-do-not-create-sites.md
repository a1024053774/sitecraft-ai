---
id: T-102
title: 只读路径不再顺手创建空站点
type: build
status: closed
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
- [x] 代码审查通过；Claude 验收

## Resolution

2026-10-04（America/New_York），codex-build，最终代码 SHA `93ffbfc3acab10e9879d2362d67a823d12d6f02d`：

- P1 根因收口已在代码 commit `8a4a35b` 完成：生产代码只保留 POST `/api/sites` 的 `createSite`；FS/Postgres commit、history、selective undo、chat 和 quality-run 缺站均拒绝，不再用 `createRecord`/INSERT 补空站。P2-a 在最终代码 SHA `93ffbfc` 将 actionStream、普通 SSE 和 commit 内层 catch 的 `Site not found:` 映射为 `site_not_found` 与“找不到这个站点”用户文案；长请求期间站点消失行为测试已通过。
- 入口/竞态行为测试最终 28/28 通过；绑定最终代码 SHA 的 `artifacts/t102/npm-test-final-93ffbfc.txt` 在第 447 行记录“a long chat request that loses its site reports site_not_found”，第 448 行记录“confirming an alignment plan after the site disappears reports site_not_found”。父实现红测 `red-reads-parent.txt` 保留。
- `npm test` 最终 **779/779、0 失败**，见 `npm-test-final-93ffbfc.txt`；build → typecheck → build 均退出 0，见 `build-final-93ffbfc.txt`、`typecheck-final-93ffbfc.txt`、`build-final2-93ffbfc.txt`。
- 12 站 check-published 对照沿用主工作区 handoff ID、强制复制站点和 zsh 数组参数；低/高负载均 36 行、0 失败，textContrast/bodyLineLength/facts 条数不低于 `artifacts/merge-32a4ee9/check-published/report.json` 基线，逐行对照见 `artifacts/t099/check-published-merge-failure-diff.txt`。
- 在最终代码 SHA `93ffbfc3acab10e9879d2362d67a823d12d6f02d` 上重新运行了本票要求的 12 站证据：`artifacts/t102/check-published-93ffbfc/report.json` 共 36 行、0 失败；日志 `artifacts/t102/check-published-93ffbfc.log` 首行是 `SHA=93ffbfc3acab10e9879d2362d67a823d12d6f02d UTC=2026-10-04T18:07:56Z COMMAND=check-published 12 sites`。
- 合并主线 `fa1631c` 后，质量矩阵红态由测试依赖主工作区资料暴露：`p4m-a` 等真实矩阵站点仍会被读取，旧 history 记录迁移时因 `productTarget=intro` 无唯一 SKU 匹配抛 `SiteMigrationError`，所以接口是 500；原测试只删 `p4-sw-*` 补充站点，既没有命中实际矩阵缺站，也可能删掉主工作区的真实文件。红态与堆栈分别保留在 `artifacts/t102/red-quality-matrix-500-fa1631c.txt`、`artifacts/t102/root-cause-quality-migration-fa1631c.txt`。
- 质量矩阵缺站行为测试改为在独立 `mkdtemp` 工作目录的子进程中加载真实路由，复制唯一需要的 scanner 脚本，断言空矩阵返回 404，并核对主工作区 `p4m-a.json` 的存在状态不变；绿色证据见 `artifacts/t102/green-quality-isolated-final.txt`，首行绑定最终提交 SHA。
- `readRecord` 对已有 `historySchemaVersion < 3` 记录仍会迁移并写回，这是既有的历史迁移契约；本票不把读取宣称为绝对无写。缺站不会触发该迁移。
- project-map status 无 stale；本次 Resolution 单独本地提交，未 push。票状态保持 open，等待 Astra/Claude 验收。

### 合回主线与关闭（Claude，2026-10-04 EDT）
- Astra 四轮（r1–r3 NO_GO：第二条隐式建站路径、SSE 缺站错误泛化、证据未绑定提交；r4 只剩 Resolution 引用旧证据，已改为引用 `npm-test-final-93ffbfc.txt` 第 447–448 行，主控核对）。合并主线 `fa1631c` 后质量矩阵缺站测试在主工作区失败（主工作区旧站点 `p4m-a` 迁移报错致 500，且旧测试会删真实数据目录的 `p4-*` 文件），`7e36ad9` 改为独立临时 cwd 子进程。主工作区 3034 在 `7e36ad9`：build、typecheck 通过，全量 781/781，12 站 `check-published` 36 行 0 失败且测量完整（`artifacts/merge-7e36ad9/`）。已知：测试默认端口写成 3062，另行修正；主工作区 `p4m-a` 迁移失败使内部质量页 500，优先级 3，未排票。Claude 验收关闭。
