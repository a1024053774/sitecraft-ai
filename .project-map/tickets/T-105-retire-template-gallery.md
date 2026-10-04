---
id: T-105
title: 下线模板画廊，「AI 建站」直接进工作台新建站点
type: build
status: open
blocked_by: [T-102]
claimed_by: codex-build
supersedes:
---

## What to build

T-104 第 ① 步。侧边栏「AI 建站」现在进 `/templates` 模板画廊（`components/template-gallery.tsx`、`app/(workspace)/templates/page.tsx`、`app/templates/[templateId]/preview`），给用户展示一墙开源模板。改为：「AI 建站」直接在工作台新建站点（用 T-102 的显式 `createSite`），用户在需求对齐卡里选样子和色彩集作为预设。删除模板画廊页、单个模板展示页及只为它们服务的组件和测试；`vendor/` 快照留在仓库当拆区块素材，不再对用户展示。

- **不能删**：`/api/templates/[templateId]/preview` 和 `OpenSourceTemplateFrame` 是工作台和访客页的预览引擎（T-001 一个预览引擎），只删画廊用途的入口；删前列出每个被删文件的所有引用。
- 可改范围：`components/app-sidebar.tsx`、画廊相关页面与组件、新建站点入口、相关测试和文档。禁止改：`lib/template-adapters/preview-bridge.ts`、`lib/blocks/**`、`lib/site-store.ts`（除调用 `createSite`）、`lib/ai-provider.ts`。

## Acceptance

- [ ] 测试先写、改动前先失败（行为级）：点「AI 建站」进入工作台新建流程且出现需求对齐卡；`/templates` 返回 404 或重定向到工作台；预览引擎和访客页不受影响
- [ ] Chrome 1440 / 768 / 375 截图看过新入口；`npm run typecheck`、`npm test`（0 失败）、`npm run build`、12 站 `check-published` 通过
- [ ] 代码审查通过；Claude 验收
