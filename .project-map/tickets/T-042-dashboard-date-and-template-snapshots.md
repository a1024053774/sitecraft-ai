---
id: T-042
title: 首页写死的日期和模板页缺样式的缩略图
type: build
status: closed
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
- [x] 另一个 harness 的审核 agent 验收通过，结论记在 Resolution

## Resolution

2026-09-28 11:29 EDT，grok-b。首页去掉写死的「Site studio / 08.21」。GENAI（`powerai`）快照已在本地：来源 [ctrimm/astro-genai-startup-theme](https://github.com/ctrimm/astro-genai-startup-theme) `1382095595c6d6af8d6db44b9eebd965ba1f54fb`，MIT（Copyright 2025 Automate Army）。样式文件在 `dist/_astro/`，HTML 按 GitHub Pages 的 `base: /astro-genai-startup-theme` 引用，读取时去掉这层前缀。TAILCAST（`astro-starter`）来源 [matt765/Tailcast](https://github.com/matt765/Tailcast) `85843e5feaa46bdee05e180cf0c76f12408d7557`，MIT（Copyright 2022-2026 Mateusz Wyrębek）；Inter 来自快照里已有的 `@fontsource/inter`，SIL OFL 1.1，没有新加字体文件。样式表改为 `crossorigin="anonymous"`，CSS 里的根路径 `url(/...)` 改到模板资源路由，资源响应带 `Access-Control-Allow-Origin: *`，沙箱预览才能加载字体。

红态（实现前）：`node --test --experimental-strip-types tests/template-snapshot-assets.test.ts`，5 失败：首页仍有 `08.21`；`/astro-genai-startup-theme/_astro/about.yA3EGTjS.css` 读不到；CSS 仍是 `url(/_astro/...)`；样式表没有 `crossorigin`；字体响应没有 CORS 头。

绿态：同一命令 5 通过。`npm run typecheck` 通过。`npm test` 265/265 通过（第一次并行跑到 264/265，`guided image wait resumes the same saved task after a site upload` 失败，单独重跑和整套重跑都通过；该测试不在本票文件里）。`npm run build` 通过。

浏览器（未重启 3034 上的 dev server）：1440 宽 Chrome。首页截图没有日期戳。模板页 GENAI 缩略图有紫粉渐变和导航，TAILCAST 缩略图是深色首屏和按钮。本地快照资源请求没有 4xx。截图：`artifacts/t042/dashboard-1440.png`、`artifacts/t042/templates-1440.png`、`artifacts/t042/templates-genai-tailcast-1440.png`。

实现提交：`28d86321d47a2ee76d6cc71966bd29630d46cc2e`。

跨 harness 审核：Kiro，2026-09-28 11:42，NO_GO（`28d8632` 之后新跑）。

- 通过的部分：首页没有日期戳；GENAI 和 TAILCAST 缩略图有样式（`artifacts/t042-review-kiro/templates-genai-1440.png`）；`node --test --experimental-strip-types tests/template-snapshot-assets.test.ts` 5/5；GENAI 的 `about.yA3EGTjS.css` 200，TAILCAST 字体带 `Access-Control-Allow-Origin: *`；submodule SHA 与本票一致，GENAI `LICENSE` 为 MIT，TAILCAST `package.json` 写 MIT（仓库里的许可文件是小写 `license`）。
- 不通过：验收第 2 项是「每张挂 iframe 的缩略图都完整显示样式，没有 404 资源」。在 1440 打开 `/templates`、滚完整页，缩略图里仍有 11 个 404 和 3 个被 CORS 拦下的字体（`artifacts/t042-review-kiro/templates-console.json`）：
  - srcset 改写把前缀插到了最后一个斜杠：`/_astro/api/templates/lonestone/assets/hero-image.DwIC_L_T_1xrKIH.webp`、`/_astro/api/templates/moon/assets/astronaut.B8IC2jL3_Z1pTs8N.webp`、`/assets/images/home/screenshots/api/templates/kindred/assets/landing-1.webp`（`landing-2` 同）。根因是 `app/api/templates/[templateId]/preview/route.ts` 第 21 行 `(\bsrcset=["'][^"']*)\/(?!\/)` 贪婪匹配，只改一处且改错位置；每个 srcset 候选 URL 都要单独改。AstroWind 缩略图的首屏图因此显示成替代文字「AstroWind Hero Image」。
  - 根路径图片没走资源路由：ricofast `/assets/stack/{astro,figma,motion,node,tailwind}.jpg`，foxi `/_astro/cta-dark-bg.h-w07icx.webp`、`/_astro/testimonial-bg-01.CofysqBI.webp`。
  - 根路径字体没走资源路由、被 CORS 拦下：`/_astro/fonts/5288773a5a229461.woff2`（astrowind）、`/_astro/fonts/3827da0b0bf6b4db.woff2`、`/_astro/fonts/aef5e683e5734387.woff2`（astroplate）；这几条不在 `.css` 文件里，改写 CSS 覆盖不到，应查 HTML 里的内联 `<style>` / `style=` / preload。
- 复现：Chrome 1440 打开 `http://localhost:3034/templates`，逐屏滚到底，看控制台和网络面板的 4xx 与 CORS 报错。

2026-09-28 12:20 EDT，grok-b 按 NO_GO 修预览 HTML 改写。`prepareHtml` 不再用贪婪的 srcset 正则；每个 srcset 候选、内联 `style` / `<style>` 里的 `url(/...)`、以及 `src` / `href` / `poster` 的根路径都单独改到资源路由。红态：`node --test --experimental-strip-types --test-name-pattern "local preview rewrites every srcset" tests/template-snapshot-assets.test.ts` 失败，输出里仍有 `/_astro/api/templates/`。绿态：同一文件 6/6。`npm run typecheck` 通过。`npm test` 272/272 通过。`npm run build` 通过。1440 滚完 `/templates`（16 个 iframe，6 个未准入占位），缩略图网络没有模板资源 4xx 或 CORS；页面自身的 `/favicon.ico` 仍是 404，不在缩略图里。截图：`artifacts/t042/templates-1440.png`、`artifacts/t042/card-astrowind-1440.png`、`artifacts/t042/card-astroplate-1440.png`、`artifacts/t042/card-odyssey-1440.png`、`artifacts/t042/card-ricofast-1440.png`、`artifacts/t042/card-moon-1440.png`、`artifacts/t042/card-foxi-1440.png`。控制台记录：`artifacts/t042/templates-console.json`。

修复提交：`c7cc1e9807e8c66d1b465f4afbc135b8c429270e`

独立审核（复审）：Kiro，2026-09-28 13:53，PASS（`c7cc1e9` 之后新跑）。srcset 按候选逐个改写，HTML 内联 `url(/...)` 也走资源路由。Chrome 1440 打开 `/templates` 逐屏滚到底，控制台和网络没有 4xx、没有 CORS 报错（`artifacts/t042-review-kiro/templates-console-2.json` 为空）；lonestone、moon、kindred、ricofast、foxi、astrowind、astroplate 七个快照的 HTML 里没有未改写的根路径，引用的资源全部 200。AstroWind 首屏图和 Moon 宇航员图正常显示（`artifacts/t042-review-kiro/templates-after-fix-1440.png`）。`node --test --experimental-strip-types tests/template-snapshot-assets.test.ts` 6/6，`npm test` 283/283。
