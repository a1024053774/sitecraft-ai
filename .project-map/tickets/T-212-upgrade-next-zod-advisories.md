---
id: T-212
title: 升级 Next.js 与 zod，消除已公开的依赖漏洞
type: build
status: closed
blocked_by: []
claimed_by: Claude
supersedes:
---

## What to build

2026-11-14 静态扫描时，`npm audit --omit=dev` 报了 5 项生产依赖漏洞（1 项严重、4 项高危）：

- `next` 16.3.1（package.json 写死版本）：严重级，共 13 条通告，修复版 16.4.6。其中包括 Windows 主机上的未授权远程代码执行、图片优化接口在 AVIF／SVG 下的远程代码执行与 SSRF、缓存投毒。项目没用 `next/image`、`next/og`、`use cache` 和 Server Actions，但 `/_next/image` 默认仍对外提供。
- `zod` 4.4.3：高危，校验超大的受限集合时会耗尽内存。服务端用它校验请求体，修到 ≥4.6.6 仍在 `^4` 范围内。
- `sharp` 0.35.3（随 next）、`source-map-js` 1.2.1（随 postcss）、`@xmldom/xmldom` 0.8.14（随 read-excel-file，xlsx 只在访客浏览器里解析）：随锁文件一起更新。

本票把这些依赖升到无已知严重和高危漏洞的版本，保持现有行为不变。AGENTS 要求先读 `node_modules/next/dist/docs/` 里 16.4 的升级说明，核对破坏性变更后再动代码。

不做：不改 `next.config.ts` 的 images 配置，不换框架，不加新依赖。Windows 服务重建涉及完整镜像重建，按 T-208 须负责人当次授权才能进行。

**unknown**：Windows 服务是跑在 Docker 的 Linux 容器里还是原生 Windows 上，这决定「Windows 主机远程代码执行」那条通告是否适用，须实际核对，不能推断。

## Acceptance

- [x] 升级后 `npm audit --omit=dev` 没有严重和高危项；剩余项逐条写明无法修复的原因
- [x] 读过 Next 16.4 的升级说明，Resolution 列出涉及本项目的变更及处理方式
- [x] `npm run typecheck`、`scripts/t167-runner-regressions.ts` 以及覆盖请求校验与路由的定向测试通过；全量测试在合并后的主线上跑一次
- [x] 按 AGENTS 在 Windows 执行 `npm run build` 并通过；工作台、预览在 Chrome 1440／768／375 三档打开正常，截图放 `artifacts/t212/` 并逐张查看
- [x] 记录 Windows 服务的实际运行方式，说明 Windows 主机远程代码执行通告是否适用；是否重建并部署由负责人当次决定，结果写入 Resolution

## Resolution

2026-11-14（纽约时间，下同），提交 21aec51a。

- 升级：`next` 16.3.1 → 16.4.6，`zod` ^4.4.3 → ^4.6.7；锁文件随之更新 sharp 0.35.5、source-map-js 1.2.2、@xmldom/xmldom 0.8.15。`npm audit --omit=dev` 与 `npm audit`：found 0 vulnerabilities，没有剩余项。
- 升级说明：读了 `node_modules/next/dist/docs/` 中 16.4 的升级说明。唯一的破坏性变更是移除 `experimental.appNewScrollHandler`，本项目未使用，因此无需改代码。peer 依赖全部满足。
- Windows 服务运行方式：`docker version` 显示 Server 为 linux/amd64，`sitecraft-web-1` 运行在 Linux 容器内，所以「Windows 主机远程代码执行」通告不适用于现行服务。本票未重建、未部署正式服务（T-208：需负责人当次授权）；新版本要等负责人决定后再上线。
- Mac：`npm run typecheck` 通过；`node --test --experimental-strip-types scripts/t167-runner-regressions.ts` 18/18 通过；不需要浏览器的定向测试通过。Mac 上的 chrome-headless-shell 缓存已不存在，所以浏览器用例改在 Windows 跑。
- Windows：源码打包后，在基于 `sitecraft:local` 的临时 Linux 容器里跑标准检查（typegen、typecheck、runner、`npm test`）。
  - 第一轮（21:36 结束）：148/148 与 1103/1104 通过。唯一失败的用例是「T-162 375：收起线程面板保留意见摘要和高亮，展开保持同一目标」：在负载下等待草稿消失时超时（24.7s）。改前结果保留在 Windows `D:\sitecraft-t212\evidence\full-1-t167\test-run-1794709242315-1944` 和 `full-1-dataroot`。
  - 单独复跑该用例两次均通过（5.6s、7.4s）。
  - 第二轮全量（21:53 结束）：148/148 与 1104/1104，共 1252/1252 通过，证据在 `D:\sitecraft-t212\evidence\full-2-t167\test-run-1794710327856-1944`。
  - 第一轮的超时是负载下的偶发等待超时，没有改用例上限，也没有跳过。
- 构建：在 Windows 上运行 `docker build --target build`（Dockerfile 的构建阶段执行 `npm run build`），结果 `✓ Compiled successfully`，构建通过（21:55）。
- 截图：在 Windows 临时容器里起 dev server，用 Chrome 拍了工作台和预览各三档（1440／768／375），存在 `artifacts/t212/shots/`，六张逐张查看过，页面正常，没有载入态或截断。dev.log 显示工作台、code-preview、draft 请求均为 200。
- 审查：Codex gpt-6.1-sol（high，未开 fast，只读）结论 PASS，无发现。
