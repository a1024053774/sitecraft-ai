---
id: T-105
title: 下线模板画廊，「AI 建站」直接进工作台新建站点
type: build
status: closed
blocked_by: [T-102]
claimed_by: codex-build
supersedes:
---

## What to build

T-104 第 ① 步。侧边栏「AI 建站」现在进 `/templates` 模板画廊（`components/template-gallery.tsx`、`app/(workspace)/templates/page.tsx`、`app/templates/[templateId]/preview`），给用户展示一墙开源模板。改为：「AI 建站」直接在工作台新建站点（用 T-102 的显式 `createSite`），用户在需求对齐卡里选样子和色彩集作为预设。删除模板画廊页、单个模板展示页及只为它们服务的组件和测试；`vendor/` 快照留在仓库当拆区块素材，不再对用户展示。

- **不能删**：`/api/templates/[templateId]/preview` 和 `OpenSourceTemplateFrame` 是工作台和访客页的预览引擎（T-001 一个预览引擎），只删画廊用途的入口；删前列出每个被删文件的所有引用。
- 可改范围：`components/app-sidebar.tsx`、画廊相关页面与组件、新建站点入口、相关测试和文档。禁止改：`lib/template-adapters/preview-bridge.ts`、`lib/blocks/**`、`lib/site-store.ts`（除调用 `createSite`）、`lib/ai-provider.ts`。

## Acceptance

- [x] 测试先写、改动前先失败（行为级）：点「AI 建站」进入工作台新建流程且出现需求对齐卡；`/templates` 返回 404 或重定向到工作台；预览引擎和访客页不受影响
- [x] Chrome 1440 / 768 / 375 截图看过新入口；`npm run typecheck`、`npm test`（0 失败）、`npm run build`、13 站 `check-published` 通过（13 站报告仍有 3 条已知 T-103 注塑英文页失败）
- [x] 代码审查通过；Claude 验收

## Resolution

2026-10-04（America/New_York），codex-build，代码 commits `824a461c87ba68d1f423678217d42f05c85d43dc`、`91d15af59b17be801eafa26e00478b9624356729`：

- 红测先在父提交 `fa1631c3887fcf30fceb0602e3dab7f19ab91c66` 的行为夹具上失败，记录在 `artifacts/t105/red-retire-template-gallery-parent-fa1631c.txt`；失败点是 `?new=1` 仍打开默认站点、画廊入口文件仍存在。删前完整引用清单见 `artifacts/t105/references-before-delete.txt`。
- 侧边栏、首页新建按钮和快速开始全部进入 `/workspace?new=1`。工作台用 `forge` 作为初始化种子调用显式 `POST /api/sites`，地址换成 `?site=<id>` 后立即启动需求对齐卡，卡片显示样子和 4 套色彩集；刷新恢复同一站点。`?template=<id>` 现在统一拒绝并提示旧入口已下线，不会 POST 建站；对应行为测试已改为拒绝断言。
- 删除 `components/template-gallery.tsx`、`app/(workspace)/templates/page.tsx`、`app/templates/[templateId]/preview/page.tsx` 及只服务单个预览页的 `tests/visitor-host.test.ts`；`tests/dashboard-cleanup.test.ts` 去掉画廊断言。保留 `/api/templates/[templateId]/preview`、资产路由和 `OpenSourceTemplateFrame`，工作台、发布页、质量页仍走同一预览引擎。
- `artifacts/t105/browser-entry-ready-91d15af.log` 和 `browser-entry-ready-report.json` 首行/报告绑定 `91d15af`；`/templates` 为 404、预览 API 为 200，三档报告均为 `previewState=ready`、`previewHydrated=true`、连续 5 次高度稳定，截图 `ai-new-ready-1440.png`、`ai-new-ready-768.png`、`ai-new-ready-375.png` 已逐张查看。
- 相关入口测试 12/12 通过；有效全量测试为 **782/782、0 失败**，见 `npm-test-91d15af.txt`。父提交的 legacy `?template=` 红态见 `red-template-legacy-824a461.txt`。
- `npm run build`、build 后 `npm run typecheck` 均退出 0，证据为 `build-91d15af.txt`、`typecheck-91d15af.txt`。
- 13 站 `check-published` 在最终 SHA 上为 39 行、3 个失败，报告 `check-published-91d15af/report.json`、日志 `check-published-91d15af.log`；失败均来自新增 `t097-real-936749b-molding` 的已知 T-103 英文行长、参数卡溢出/截断和页头公司名截断，本票未改动这些区块。

### 合回主线与关闭（Claude，2026-10-04 EDT）
- Astra r1 NO_GO（`?template=` 第二条建站入口仍在、375 截图为载入态），r2 PASS（`artifacts/review-astra-t105-r2.md`）。合并主线 `c2724ce`（另合 `e51e6b2`：T-102 测试改用共享 base）。主工作区 3034 在 `c937685`：build、typecheck 通过，全量 790/790，13 站 `check-published` 39 行 0 失败且测量完整（`artifacts/merge-c937685/`）。T-104 第 ① 步完成。Claude 验收关闭。
