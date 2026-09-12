# 东莞华固精密制造演示站实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 使用 `screwfast` 本地开源模板和完整中文模拟数据，生成可发布、可离线双击打开的东莞华固精密制造有限公司演示站 HTML。

**Architecture:** 通过 `/api/sites` 一次性写入符合 `SiteDraft` schemaVersion 2 的完整草稿，使用本地文件存储避免数据库依赖；以 manifest 质量门确认无缺槽、占位与语言混杂后发布，再由 `/export/{siteId}?lang=zh` 内的 `OpenSourceTemplateFrame` 通过 postMessage 内联模板资源并下载独立 HTML。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript、仓库内 `vendor/open-source-templates/screwfast` 快照、Playwright/浏览器验收、`evaluateDraftQuality`。

## Global Constraints

- 只使用真实开源模板 iframe，禁止 `SiteRenderer` 换肤近似渲染。
- 只输出中文；导航和正文均填入中文，导出语言固定 `zh`。
- 不出现 Lorem、example.com、待补充、模板默认标题或无关板块。
- 模拟企业为东莞华固精密制造有限公司，数据虚构但前后一致，不写未经确认的数字/认证/性能声明。
- 产品简介必须包含材料、规格、标准或应用等可采购参数。
- 导出文件写入 `成品展示/东莞华固精密制造-成品.html`。

### Task 1: 准备本地演示运行环境

**Files:**
- Create: `.env`

- [x] 提供不含真实密钥的本地文件存储配置，启动时确认依赖已安装。

### Task 2: 创建完整中文 SiteDraft

**Files:**
- Runtime data: `.sitecraft-data/sites/<generated-id>.json`
- Optional helper: `scripts/build-huagu-demo.mjs`

- [ ] 调用 `POST /api/sites`，提交 `templateId: screwfast`、`locales: ["zh"]` 和所有导航、内容、联系方式、产品字段。
- [ ] `GET /api/sites/{id}/draft` 读取最新 revision，必要时仅用 `PUT` 增量修正。

### Task 3: 质量门与发布

**Files:**
- No source changes; use `lib/content-quality.ts` and `lib/template-manifest.ts`.

- [ ] 运行 `evaluateDraftQuality`，确保 `publishable === true` 且四个问题数组为空。
- [ ] 用最新 revision 调用 `/publish`，若含事实声明则显式传 `factsConfirmed: true`；本演示文案避免数字和认证断言，因此应直接通过。

### Task 4: 真实模板导出与浏览器验收

**Files:**
- Create: `成品展示/东莞华固精密制造-成品.html`
- Create: `成品展示/东莞华固精密制造-验收说明.md`

- [ ] 打开 `/export/{id}?lang=zh`，等待 iframe 报告与草稿 revision 一致。
- [ ] 触发 `RealTemplateExportButton` 或等效 `sitecraft:export-request`，保存 postMessage 返回的完整 HTML。
- [ ] 使用浏览器检查页面身份、非空、无框架错误、控制台、桌面/移动首屏和询盘入口；扫描导出 HTML 禁用词和模板残留。

### 验收命令

```text
npm run typecheck
npm test
npm run build
```

并对最终导出文件执行文本扫描和 Playwright 截图检查。
