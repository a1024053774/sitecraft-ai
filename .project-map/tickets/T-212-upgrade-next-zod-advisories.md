---
id: T-212
title: 升级 Next.js 与 zod，消除已公开的依赖漏洞
type: build
status: open
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

- [ ] 升级后 `npm audit --omit=dev` 没有严重和高危项；剩余项逐条写明无法修复的原因
- [ ] 读过 Next 16.4 的升级说明，Resolution 列出涉及本项目的变更及处理方式
- [ ] `npm run typecheck`、`scripts/t167-runner-regressions.ts` 以及覆盖请求校验与路由的定向测试通过；全量测试在合并后的主线上跑一次
- [ ] 按 AGENTS 在 Windows 执行 `npm run build` 并通过；工作台、预览在 Chrome 1440／768／375 三档打开正常，截图放 `artifacts/t212/` 并逐张查看
- [ ] 记录 Windows 服务的实际运行方式，说明 Windows 主机远程代码执行通告是否适用；是否重建并部署由负责人当次决定，结果写入 Resolution

## Resolution

