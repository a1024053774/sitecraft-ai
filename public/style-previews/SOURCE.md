# 风格缩略图来源

精密工程、现场实拍取自本项目 2026-10-09 快速评估；品牌画册取自 T-153 本轮真实生成（2026-10-11 UTC，纽约 2026-10-10）。原图均为 1440×1000，等比缩至 576×400，WebP quality 88；未画图、未重排、未润饰页面。复现：`SITECRAFT_BASE=http://127.0.0.1:3170 node scripts/t153-style-previews.mjs <artifacts/t130/round-2026-10-09T10-14-09-315Z> artifacts/t153/approved/real-2026-10-11T03-58/private/default`。

风格、来源站点 ID、生成版本 ID、修订号与原始截图相对路径统一登记在 `lib/code-site-styles.ts`。三个示例均为 deepseek-flash 真实生成的 v1。截图展示特定资料产生的排法，不承诺每次生成相同布局。工业铭牌不在本票验证范围，未保留运行时选项。

- precision.webp：忻州重载减速机。含两张已登记的行业配图，不是本厂照片。
- documentary.webp：外高桥流体接头。此首屏没有照片，保留真实生成结果，不补图伪装效果。
- editorial.webp：同一份外高桥流体接头资料，版式 5、信息密度 6；经两轮事实修正后通过底线。首屏含 NOIRLab 机加工车间行业配图，不是该公司的实拍。

截图作为整体按 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) 提供，署名 SiteCraft AI 模拟资料评估；其中照片的原作者及处理链如下。站点内部 current-site-only 是生成站引用范围，不能把该字段当作再许可；此缩略图的图片使用依据是以下来源各自的 CC BY-SA 4.0 或 CC BY 4.0 许可。

## precision.webp 中的照片

- [Milling machines in the Xcentric Ripper Int. factory.jpg](https://commons.wikimedia.org/wiki/File:Milling_machines_in_the_Xcentric_Ripper_Int._factory.jpg)，Ana 2016，[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)。来源为官方 1280px 缩略图；本次保留网站内显示方式并随整张截图缩小、转为 WebP。
- [CNC Machine Facility.jpg](https://commons.wikimedia.org/wiki/File:CNC_Machine_Facility.jpg)，Antoniusaw，[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)。来源为官方 1280px 缩略图。原始公开全景有 Photoshop CS6 元数据，4032×1600（相机 EXIF 4032×3024），具体原始编辑步骤不详；本次保留网站内裁切并随截图缩小、转为 WebP。

照片准入及署名原件：`tests/fixtures/company-images/industrial/manifest.json`、`LICENSES.md`；站点截图对照原评估的 `private/case-1/uploads.json`。此处保留来源与许可，不把照片或商标的授权推导自代码许可。

## editorial.webp 中的照片

[NOIRLab HQ Machine Shop (6V6A0724-CC).jpg](https://commons.wikimedia.org/wiki/File:NOIRLab_HQ_Machine_Shop_(6V6A0724-CC).jpg)，NOIRLab/NSF/AURA/T. Slovinský，[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。来源为官方 1280px 缩略图；原公开图片有 Photoshop 23.4 元数据，具体编辑步骤不详。本次保留真实生成站的显示方式，截取首屏并等比缩小、转 WebP。原件准入和署名见 `tests/fixtures/company-images/export/manifest.json`、`LICENSES.md`，本次上传记录在真实生成目录的 `private/uploads.json`。该图片只能作行业配图，不据图宣称本公司的设备所有权或新增工艺。
