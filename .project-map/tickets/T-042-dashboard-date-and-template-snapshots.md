---
id: T-042
title: 首页写死的日期和模板页缺样式的缩略图
type: build
status: open
blocked_by: []
claimed_by: grok-b
supersedes:
---

## What to build

- 首页首屏写死「Site studio / 08.21」（`app/page.tsx`）。
- 模板页 GENAI（`powerai`）缩略图标为「本地静态预览」，但快照里的 `_astro/about.yA3EGTjS.css` 返回 404，显示成没有样式的 HTML。`astro-starter` 的字体被 CORS 拦下。

GENAI 要么补齐本地快照，要么按 T-026 的规则标为「仅有上游演示 / 未准入」、不挂 iframe；不把缺样式的快照当可生成模板。

可改范围：`app/page.tsx`、`components/template-gallery.tsx`、`lib/templates*`、模板快照与其 API 路由。不改 `app/globals.css`（grok-a 在改）。

## Acceptance

- [x] 首页没有写死的日期或版本号
- [x] 模板页每张挂 iframe 的缩略图都完整显示样式，没有 404 资源；缺快照的模板不挂 iframe、不能进入生成
- [x] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [x] 1440 浏览器截图
- [ ] 另一个 harness 的审核 agent 验收通过，结论记在 Resolution

## Resolution

2026-09-28 11:29 EDT，grok-b。首页去掉写死的「Site studio / 08.21」。GENAI（`powerai`）快照已在本地：来源 [ctrimm/astro-genai-startup-theme](https://github.com/ctrimm/astro-genai-startup-theme) `1382095595c6d6af8d6db44b9eebd965ba1f54fb`，MIT（Copyright 2025 Automate Army）。样式文件在 `dist/_astro/`，HTML 按 GitHub Pages 的 `base: /astro-genai-startup-theme` 引用，读取时去掉这层前缀。TAILCAST（`astro-starter`）来源 [matt765/Tailcast](https://github.com/matt765/Tailcast) `85843e5feaa46bdee05e180cf0c76f12408d7557`，MIT（Copyright 2022-2026 Mateusz Wyrębek）；Inter 来自快照里已有的 `@fontsource/inter`，SIL OFL 1.1，没有新加字体文件。样式表改为 `crossorigin="anonymous"`，CSS 里的根路径 `url(/...)` 改到模板资源路由，资源响应带 `Access-Control-Allow-Origin: *`，沙箱预览才能加载字体。

红态（实现前）：`node --test --experimental-strip-types tests/template-snapshot-assets.test.ts`，5 失败：首页仍有 `08.21`；`/astro-genai-startup-theme/_astro/about.yA3EGTjS.css` 读不到；CSS 仍是 `url(/_astro/...)`；样式表没有 `crossorigin`；字体响应没有 CORS 头。

绿态：同一命令 5 通过。`npm run typecheck` 通过。`npm test` 265/265 通过（第一次并行跑到 264/265，`guided image wait resumes the same saved task after a site upload` 失败，单独重跑和整套重跑都通过；该测试不在本票文件里）。`npm run build` 通过。

浏览器（未重启 3034 上的 dev server）：1440 宽 Chrome。首页截图没有日期戳。模板页 GENAI 缩略图有紫粉渐变和导航，TAILCAST 缩略图是深色首屏和按钮。本地快照资源请求没有 4xx。截图：`artifacts/t042/dashboard-1440.png`、`artifacts/t042/templates-1440.png`、`artifacts/t042/templates-genai-tailcast-1440.png`。

提交与本 Resolution 在同一提交；SHA 以该提交为准。

跨 harness 审核：留空。
