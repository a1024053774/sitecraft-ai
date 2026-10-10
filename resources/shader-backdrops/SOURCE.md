# T-148 静态底图准入记录

核对日期：2026-10-10。主控看过候选对照页及 grid/wavelet/fractal 的 1440 原图，批准保留六类、排除四类，并授权第 3、4 步接入。运行时登记表在 `lib/code-site-backdrops.ts`，静态文件在 `public/system-backdrops/`；主控素材取舍和执行者自查不替代独立审美审核。

## 来源、版本与许可

- npm：[`shaders@4.0.4`](https://www.npmjs.com/package/shaders/v/4.0.4)，固定版本，放在 `devDependencies`；锁文件新增的依赖均为 dev。
- npm 元数据的仓库：[`shader-effects-inc/shaders`](https://github.com/shader-effects-inc/shaders)，包目录 `packages/shaders`；发布包地址：<https://registry.npmjs.org/shaders/-/shaders-4.0.4.tgz>。
- 核对了 npm `version / license / repository / dependencies`、实际安装包 `package.json`、`LICENSE`、候选组件的定义与 props；包内版权为 `Copyright (c) 2026 Shader Effects Inc.`，MIT 全文保存在 [LICENSE.txt](LICENSE.txt)。
- 上游 [README 的许可边界](https://github.com/shader-effects-inc/shaders#%EF%B8%8F-license) 明确：引擎、组件、框架绑定和 npm 包为 MIT；官网编辑器、预设、section 和平台功能另有条款。本轮不登录官网，不使用平台预设、付费素材、平台图片导出、CLI 或 MCP 服务。配色和参数是本项目自写。
- 使用包内 `shaders/js/bundle` 的自包含 ESM 和 `shaders/core/<effect>` 定义；这些只被离线 Node 脚本与其临时 localhost 渲染页加载。访客页与工作台无 shader import。图片只含程序生成的抽象图案，不含外部照片、纹理文件、字体、商标或图标。
- 新增传递依赖：`typegpu@0.12.3`（MIT）、`tinyest@0.3.4`（MIT）、`typed-binary@4.3.3`（MIT）、`tsover-runtime@0.0.7`（Apache-2.0）。代码许可按各安装包核对；访客只收到静态 WebP，静态渲染器自动汇总 Shader Effects Inc. / MIT 署名并随 HTML 保留 MIT 全文。

## 配色与风格

每个效果同样准备下列四组配色，即精密／纪实各两组。这里的「纪实」对应当前风格「现场实拍」，抽象背景不代表现场照片。强调色只记录未来配色关系，未画进底图，也未新增运行时 token。现有两个风格 skill 只规定颜色角色与方向，没有固定十六进制 token；本轮按其方向落到候选色值。

| 配色 | 底色 → 纹理／暗部 | 阅读示例字色 | 对齐依据／强调色 |
| --- | --- | --- | --- |
| 精密 · 钢灰 | `#f1f4f6` → `#dce4e8` | `#20262a` | 白／浅冷灰、石墨文字、钴蓝 `#235b9d` |
| 精密 · 浅工业绿 | `#eff4f1` → `#dce7df` | `#232824` | 浅冷灰带弱绿调、工业绿 `#2f654b` |
| 纪实 · 原纸 | `#f4f0e8` → `#dfd6c6` | `#292721` | 资料册暖浅底、氧化红 `#a3462c` |
| 纪实 · 车间石墨 | `#242829` → `#323838` | `#f2efe8` | 深浅区块交替、暖橙 `#d97345` |

## 主控保留的六类

六个效果的完整参数、seed、尺寸、颗粒与 WebP quality 见 [candidates.json](candidates.json)；每张输出对应关系在本次产物 `report.json`。系统编号是 `bd_<效果>_<配色>`，如 `bd_grid_precision-steel`；每个编号有三个宽度。精密／纪实各两套配色，共 24 个编号、72 张 WebP。

| 效果／包内组件 | 选用理由与修正 |
| --- | --- |
| `grid` / Grid | 细线坐标呼应工程图、参数目录，不是实际工程图纸。原 1440 中的中心小方块不是有意设计，包内源码只计算横纵线与填充；关闭 softness、thickness 调为 1.2、quality 提到 95 后，原尺寸只剩细线，没有中心方块。没有将多参数实验归因为单一编码或 GPU 缺陷。 |
| `dot-grid` / DotGrid | 稀疏小点与资料定位有关，比实线轻；关闭漂移、闪烁。暗色仍可辨认，避免密集星空。叠在单向色场上。 |
| `linear-field` / LinearGradient | 单轴同色明暗最朴素，不做多彩流体、光晕或网状渐变。加包内 FilmGrain 的极弱静态颗粒（strength 0.015 / bias 0 / animated false），quality 95，抑制 1440 的量化色带。 |
| `radial-field` / RadialGradient | 大半径偏心场把变化放在右侧，避免小光球；不暗示摄影棚现场。独立视觉审核仍在钢灰 1440 发现环带，原图和 NO_GO 保留；三个浅色配色的 FilmGrain strength 提为 0.1，深色维持 0.015，bias 0 / animated false / quality 97。四配色修正后的 1440 原图获独立复核 PASS，无明显环带／圆盘边界，颗粒克制；这不代表整站审美通过。 |
| `blue-grain` / BlueNoise | 细颗粒在原尺寸仍可见，缓解平色的塑料感；本轮最占体积，但最大仍为 94,190 字节。 |
| `paper-grain` / Paper | 单向色场的细微纸纹，位移为 0；适合资料册、包装资料。WebP 后纸纹非常弱，与基础色场接近；不当纸样照片。 |

点阵关闭 speed / speedVariance / twinkle。随机效果固定 seed=17，FilmGrain 不随时间变化。Paper 与 FilmGrain 都是包内 filter，按定义嵌套渐变子层，不改写包内 shader；其他三类保持 quality 82。

## 排除理由

排除是本轮范围筛选；未渲染的效果不宣称视觉验收。实际核过定义的效果与未采用类别分开写明。

| 效果／类别 | 核对与排除理由 |
| --- | --- |
| simplex-field / SimplexNoise | 主控排除：放大后是不规则云斑，读起来像污渍或 AI 网格渐变。旧候选保留在 artifacts，不进运行时登记表。 |
| fractal-grain / FractalNoise | 主控排除：不规则云斑像污渍或 AI 网格渐变；1440 纸色版还有明显同心色带。不通过改色或换名字重新入库。 |
| wavelet-field / WaveletNoise | 主控排除：放大后是不规则云斑，读起来像污渍或 AI 网格渐变。 |
| stone-grain / Stone | 主控排除：与 paper-grain 难区分，不保留重复的哑光颗粒。 |
| BrushedMetal | 已核定义；默认是 `sphere3D` 的 Shape Effects，含环境光，容易当成金属实物／产品示意，不是平面拉丝底纹。 |
| Chrome | 已核定义；镜面、光谱和色散会抢正文。PolishedMirror、Prism 同类，本轮不纳入。 |
| PerlinNoise | 已核定义；同属宽尺度不规则色场，按本次排除云斑的标准不纳入。 |
| GaborNoise、WorleyNoise | 已核定义；定向波纹、胞状纹理的存在感偏强，本轮不作为通用正文底。 |
| StudioBackground | 已核定义；摄影棚布景暗示现场。VolumetricFog、Smoke 也不作为照片替代。 |
| GradientNoise、Crosshatch | 实际 import 失败：4.0.4 exports 有子路径，包内入口文件却缺失。不补包、不改走内部路径。 |
| Neon、Aurora、Glow、Beam、Plasma | 未渲染；发光、高饱和光效不符合本轮克制要求。 |
| MeshGradient、MultiPointGradient、FlowingGradient | 未渲染；多点彩色／流体渐变容易形成默认 AI 背景，已有同色色场覆盖用途。 |
| ImageTexture、VideoTexture、WebcamTexture、Text | 未渲染；涉及外部输入、具象信息或字体，不属于自包含抽象底图。 |

## 离线渲染与本次证据

脚本：[render-shader-backdrops.mjs](../../scripts/render-shader-backdrops.mjs)。证据输出只准位于 `artifacts/t148/` 的**新目录**，已存在的目录拒绝覆盖。脚本先按安装包定义校验类型和 props，在端口 3158 临时提供 bundle 与渲染页，再启动独占 Chrome profile；完成后仅关闭自己的 Chrome 和服务。`--install` 只从 controller-selected 配置复制通过体积检查的 WebP，并生成静态登记表；没有站点数据访问或真实模型调用。

Chrome 使用项目指定的 `154.0.8037.92`，加 `--enable-gpu`（[Chromium 官方说明](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/gpu/using-gpu-hardware-in-headless-chrome.md)）。本次 adapter 为 `apple / metal-3`，`isFallbackAdapter=false`。等待 onReady、暂停动画、等待 GPU 队列完成后，用 Chrome 导出 WebP；每张硬上限按 200,000 字节执行。失败不切渲染器、不用软件 adapter、不改为 Canvas/CSS 产物、不降质量重试。GPU 错误／丢失即报告失败，未初始化则 BLOCKED。

主控选定后的渲染命令（2026-10-10，基于 `a598f42fde7bd033dfda1880f463d55195f1686d` 上的 T-148 改动；精确时间在 report.json）：

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node scripts/render-shader-backdrops.mjs artifacts/t148/selected-v4 --install
```

再次运行须选另一个新输出目录，并先让 3158 空闲。尺寸为 1440×720、768×480、375×520（按首屏横幅／窄屏背景分别设置高度，每档实际重渲染，非裁切或放大）。72 张 WebP 全部导出，单张上限 200KB。

- `artifacts/t148/selected-v4/comparison.png`：六效果 × 四配色的一页总览。
- `artifacts/t148/selected-v4/index.html`：全部 72 张三档原图的对照与可点击原尺寸链接；不含 shader 脚本，可离线打开。
- 同目录 `*-review.png`：每个效果的三档对照；`report.json` 保存来源、全部参数、Chrome／adapter、尺寸、体积、命令、时间和基线提交；`LICENSE.txt` 保存 shaders MIT。
- 前置 Tracer bullet：`artifacts/t148/tracer-bullet.webp / .json`。首次脚本启动的 ESM 解析失败记录和旧成功产物保留，当前结果不覆盖它们。

提交入口只放行精确登记的背景地址或容器标记；图片语义位置、未知编号、外链 shader 与无法加载的素材拒收。对比度从真实 WebP 解码取得整图 RGB 上下界，按 CSS 透明度、同容器多层背景保守合成；滤镜、内阴影、背景混合、伪元素或独立遮罩等无法可靠测量的叠层明确拒绝，不按 palette 或纯色占位放行。此界限可能拒绝仅特定裁切局部可读的设计，优先保证全图背景上的正文安全；复用既有提交入口，不增加存版路径。

执行者自查不宣称独立审美通过。本轮按主控要求不跑 eval:new-route、不调用 DeepSeek；与 T-149 的联合评估及真实模型使用效果尚未验证，不能据本地夹具宣布整票质量验收完成。
