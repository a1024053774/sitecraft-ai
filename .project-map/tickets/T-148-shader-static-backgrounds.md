---
id: T-148
title: Shader 渲染成静态底图，作为系统素材供模型按编号引用
type: build
status: open
blocked_by: [T-145]
claimed_by: Codex (T-148 executor)
supersedes:
---

## Why

T-146：没有授权实拍照片的站点只能做无图或 CSS 示意版，首屏容易显得空或千篇一律。Shaders（MIT）可以由系统离线渲染出抽象底图，不需要放开「无脚本、无动效」的约束。

## What to build

1. **准入**：核对 `shaders` npm 包（shader-effects-inc/shaders）的版本、LICENSE 和实际渲染效果，只用开源包里的效果。先挑 8–12 个适合工业、设备和 B2B 站点的克制候选，主控过目后最终准入 6 个：grid、dot-grid、linear-field、radial-field、paper-grain、blue-grain；simplex-field、fractal-grain、wavelet-field 因云斑／污渍／色带排除，stone-grain 因与纸纹难区分排除。每个效果按风格（精密 / 纪实）各准备两组配色，对齐风格 token。截图放 `artifacts/`，grid 去掉中心小方块观感，linear/radial 修正可见色带后入库（2026-10-10 主控确认）。
2. **离线渲染**：写一个脚本，在无头 Chrome（AGENTS.md 里的 `CHROME_PATH`）里用 WebGPU 渲染定格帧，导出 1440、768 和 375 三档 WebP，每张控制在 200KB 以内。产物、参数和来源一起入库，作为系统素材（类似 `lib/code-site-icons.ts` 的图标）。运行时不加载 shader 库，也不在生成时渲染。无头 Chrome 跑不了 WebGPU 时如实报告，不换成别的渲染路径绕过去。
3. **接入**：系统底图使用独立的编号前缀和用途（抽象背景），许可和署名由系统汇总。提交入口校验：底图只能用在背景位置（CSS `background-image` 引用系统地址，或带 `data-system-backdrop` 的元素），不能当产品图、设备图或现场图，上面的正文仍按实际叠底核对对比度。核心规范加一两句：底图是可选的抽象背景，按风格选用，不默认每站都用。
4. 同步 `CONTEXT.md`（新术语）、`mainline.md` 和 `spec.md`。

## Acceptance

- [x] 准入记录（来源、版本、许可、选用与排除理由）写进素材目录的 SOURCE.md 和 Resolution
- [x] 提交入口测试：底图用在背景位置通过；冒充产品图、外链 shader 脚本、引用不存在的编号会被拦；先在已知坏的实现上失败
- [ ] 和 T-149 合用一轮 `npm run eval:new-route`，独立盲评：换公司判同模板仍 ≤50%；新旧成对比较的结论写进 Resolution（T-143 口径）；底线检查拒收率不上升（本轮主控明确延期，不调用 DeepSeek）
- [x] 抽查站点 1440/768/375 截图看过；Astra 审查通过；typecheck、test、build 通过

## Resolution

**PASS（本轮授权的素材修正与第 1–4 步实现）；INCOMPLETE（整票联合质量评估）。** 主控已批准六类素材并授权接入；status 保持 open，不关票、不推送。本轮唯一功能提交为 `feat: add static WebGPU system backdrops (T-148)`，父提交 `a598f42fde7bd033dfda1880f463d55195f1686d`；验证对应这份本地提交的候选源码，最终 SHA 见最终汇报与 `artifacts/t148/final-verification.json`。T-147 的 `5d4ff22` 未搬入本分支；主控先合并 T-147，再处理共同文件冲突。

- 主控素材决定：保留 grid、dot-grid、linear-field、radial-field、paper-grain、blue-grain；排除 simplex/fractal/wavelet（云斑像污渍或 AI 网格渐变，fractal 纸色 1440 有明显同心色带）与 stone（和纸纹难区分）。来源、版本、许可、选用／排除理由及全部参数写在 `resources/shader-backdrops/`，旧候选与失败证据保留。
- 实际入库：shaders@4.0.4/MIT 仅 devDependencies；六类 × 精密／纪实各两配色 = 24 个 `bd_` 编号、72 张静态 WebP。`lib/code-site-backdrops.ts` 与 `public/system-backdrops/` 不加载 shader JS，模型收到按风格过滤的可选编号，核心规范明确底图可选、不默认每站使用，不当产品／设备／现场图。CONTEXT、mainline、spec、README、AGENTS 已同步。
- grid 不是有意画中心方块：源码只画横纵线与填充。关闭 softness、thickness=1.2、quality=95 后，只剩细线；没有将同时改多个参数归因为某单一 GPU／编码缺陷。linear 用极弱静态 FilmGrain/quality95；radial 的浅色 grain=0.1、深色=0.015、quality97，抑制原图环带，仍不增加动效。
- 最终渲染：2026-10-10 **05:03:59–05:04:09 UTC**；`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node scripts/render-shader-backdrops.mjs artifacts/t148/selected-v4 --install`。指定 Chrome154.0.8037.92、Apple metal-3、非 fallbackAdapter；无替代渲染路径。72 张均实际解码为三档（1440×720、768×480、375×520），每档24张，最大 **94,190 字节**，均 ≤200,000 字节。全72张、六张分效果对照及总览已逐张打开。
- 对照与渲染参数：`artifacts/t148/selected-v4/comparison.png`、`index.html`、`*-review.png`、`report.json`。匿名素材视觉审核原先在钢灰 radial1440发现环带并判 NO_GO（`visual-review-result.txt`）；修正后四配色获独立 gpt-6.1-sol 定向复核 PASS（`visual-review-radial-final-result.txt`）。网格／linear 四配色在原审核通过。结论只覆盖修改素材，不代表整站盲评或联合 eval 通过。
- 唯一入口：CSS 仅放行精确登记的 background/background-image 地址；容器 `data-system-backdrop` 自动选择三档。未知编号、外链 shader、产品／设备／现场图语义位置、其他资源用途和缺图拒收不存版。实际 WebP 解码取得全图RGB上下界，与同容器多层 CSS 背景／透明度保守合成；滤镜、内阴影、伪元素、独立遮罩等无法可靠测量的叠层明确拒收，不按 palette 或纯色占位放行。预览与发布共用静态渲染器，署名和 MIT 全文由系统汇总；恢复经过原 commitSiteCode，没有新存版入口。
- 新测试先跑红：`CHROME_PATH=<上述指定路径> node --test --experimental-strip-types tests/t148-system-backdrops.test.ts` 的原实现 **5/5失败**（`boundary-before-contract.log`），包括合法CSS误拒、实际白字浅图误收、缺图误收与标记未解析。伪元素／独立遮罩追加反例在坏实现 **2/2失败**（`scrims-before.log`）。Astra发现元素及祖先内阴影漏拦 P1 后，两种正常提交反例在坏实现 **2/2失败、实际存成applied**（`inset-before.log`）；修正后相同入口全专项 **9/9通过，拒收版本数为零**（2026-10-10 05:10:02 UTC，`boundary-inset-fixed.log`）。事实模型仅为本地 HTTP 夹具，Chrome/资源/FS/提交/恢复均真实。
- Astra 独立技术审核：完整冻结候选审核发现上述一个 P1，FAIL 原报告在 `astra-final-before.txt`；根因层修正后，独立真实 Chrome 在 05:10:28 / 05:10:33 UTC 核对容器和文字元素自身内阴影，三个视口均 passed:false/contrastIssues:1，定向复核 **PASS**（`astra-final-after.txt`），无该范围遗留问题。未新增回退、旁路或异常吞掉的成功结果。
- 最终检查：`npm run build` **PASS**（05:10:03 UTC，`build-inset-fixed.log`）；`CHROME_PATH=<上述指定路径> SITECRAFT_BASE=http://127.0.0.1:3158 SITE_STORE=fs npm test` **243/243 PASS，无跳过**（05:10:37 UTC，`test-inset-fixed.log`）；build 完成后顺序 `npm run typecheck` **PASS**（05:12:05 UTC，`typecheck-inset-fixed.log`）。曾同时跑 build/typecheck 导致 Next 重建 `.next/types` 时 TS6053，日志 `typecheck-complete.log` 保留；没有改配置绕过检查，改为顺序运行。
- 实际 HTTP 页面：`CHROME_PATH=<上述指定路径> node --experimental-strip-types .artifact-work/t148-http-final.mjs`，05:12:08 UTC，在本 worktree 的3158打开 code-preview 与 published，各1440/768/375共六张截图；确认对应静态文件、可见正文、署名、无脚本／横溢出，刷新保持恢复版本，全部截图已打开（`artifacts/t148/http-final/`）。这是 localhost 发布路由检查，不是外部部署。
- `project_map.py status`：0结构问题、0 stale living docs；中文文件 UTF-8 窄改，git diff --check 通过。未读写主工作区 .sitecraft-data、未载入密钥、未调用 DeepSeek、未运行 eval:new-route。

剩余：主控合并 T-147 后整合本提交；与 T-149 的联合 eval、真实模型使用效果、拒收率和整站质量比较按本轮授权延期，未检查项保持未勾选，不把整票写成完成。
