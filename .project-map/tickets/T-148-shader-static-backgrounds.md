---
id: T-148
title: Shader 渲染成静态底图，作为系统素材供模型按编号引用
type: build
status: open
blocked_by: [T-145]
claimed_by:
supersedes:
---

## Why

T-146：没有授权实拍照片的站点只能做无图或 CSS 示意版，首屏容易显得空或千篇一律。Shaders（MIT）可以由系统离线渲染出抽象底图，不需要放开「无脚本、无动效」的约束。

## What to build

1. **准入**：核对 `shaders` npm 包（shader-effects-inc/shaders）的版本、LICENSE 和实际渲染效果，只用开源包里的效果。挑 8–12 个适合工业、设备和 B2B 站点的克制效果（低对比的网格、噪点、渐变场、金属或纸张质感一类），排除花哨、高饱和、明显的「AI 科技风」效果。每个效果按风格（精密 / 纪实）准备 2–3 组配色，对齐风格 token。挑选结果截图放 `artifacts/`，交主控过目后再入库。
2. **离线渲染**：写一个脚本，在无头 Chrome（AGENTS.md 里的 `CHROME_PATH`）里用 WebGPU 渲染定格帧，导出 1440、768 和 375 三档 WebP，每张控制在 200KB 以内。产物、参数和来源一起入库，作为系统素材（类似 `lib/code-site-icons.ts` 的图标）。运行时不加载 shader 库，也不在生成时渲染。无头 Chrome 跑不了 WebGPU 时如实报告，不换成别的渲染路径绕过去。
3. **接入**：系统底图使用独立的编号前缀和用途（抽象背景），许可和署名由系统汇总。提交入口校验：底图只能用在背景位置（CSS `background-image` 引用系统地址，或带 `data-system-backdrop` 的元素），不能当产品图、设备图或现场图，上面的正文仍按实际叠底核对对比度。核心规范加一两句：底图是可选的抽象背景，按风格选用，不默认每站都用。
4. 同步 `CONTEXT.md`（新术语）、`mainline.md` 和 `spec.md`。

## Acceptance

- [ ] 准入记录（来源、版本、许可、选用与排除理由）写进素材目录的 SOURCE.md 和 Resolution
- [ ] 提交入口测试：底图用在背景位置通过；冒充产品图、外链 shader 脚本、引用不存在的编号会被拦；先在已知坏的实现上失败
- [ ] 和 T-149 合用一轮 `npm run eval:new-route`，独立盲评：换公司判同模板仍 ≤50%；新旧成对比较的结论写进 Resolution（T-143 口径）；底线检查拒收率不上升
- [ ] 抽查站点 1440/768/375 截图看过；Astra 审查通过；typecheck、test、build 通过
