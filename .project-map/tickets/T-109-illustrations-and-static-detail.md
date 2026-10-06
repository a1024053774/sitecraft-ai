---
id: T-109
title: 同风格示意图与静态细节质感
type: build
status: closed
blocked_by: [T-107, T-108, T-112, T-113, T-115, T-116, T-117]
claimed_by: codex-control
supersedes:
---

## What to build

T-104 第 ④ 步。资料没图而版式需要图的位置，用 Codex 按样子 token 画的线稿式 SVG 示意图，风格要符合当前页面，能看出是示意、不冒充实拍；并做静态细节质感（排版层级、数字 / 参数排法、分隔线与表面处理、卡片细节），不做动效。示意图和细节改动都过盲评，示意图不过就删。

## Acceptance

- [x] 四样子示意图与无图版独立盲评；符合风格且不输才保留，不通过则按本票规则删除
- [x] 12 站 + 带图资料站 `check-published` 通过；全量、typecheck、build 通过；代码审查通过；Claude 验收

## Resolution

**PASS。** 当前产品源码已删除未通过盲评的设备占位线稿，保留实际设备清单、数量层级和授权照片图库；T-112照片适配/许可/清晰度、T-113精确去重/署名/页脚、T-115/T-116行业说明去冗余，以及T-117真实截图边界均已完成。本票关闭，下一步是T-110，尚不宣称两种盲评或整个生成产品已通过。

- 四样子设备线稿在固定数据和排版下与无示意版比较，24组全部选择无示意版；线稿缺少设备辨识信息并增加220–286px。按T104及本票“不过就删”规则，直接删除markup、专属样式/token、SVG文件与桥接分支，没有隐藏开关或保留旧路径。原判、解盲表、48张设备区与24张整页证据在 `artifacts/t109/final-schematic-review-e22bcee/` 和 `artifacts/t109/final-schematics-e22bcee/`。
- 删除后不同gpt-6.1-sol实例逐张打开6个无图站的36张原图及原像素细节，设备名称/数量/规格、三档中英阅读、上下接缝与页脚完整性PASS，报告 `artifacts/t109/no-image-final-visual-bcd2949/`。不同Astra的删除行为审查PASS，覆盖288个独立预览状态、七站49个发布状态，以及旧示意恢复/隐藏整个设备区的负例：`artifacts/t109/removal-astra-bcd2949/review.txt`。
- 最终捕获源码候选 `20515c0d1d1ab433acec8957af1f0951b4a9b840` 通过typecheck、build和全量908/908、零跳过。原版 `node scripts/check-published.mjs --out artifacts/integration/20261006-20515c0/published-20 <20个固定站ID>` 于2026-10-06 13:56:32–14:01:36Z单次运行，60行含中英120视图均零失败、missingFacts为0，逐图URL/分类/可见/decode与署名门通过，捕获期间无丢失观测，无浏览器重启/重试。顺序先原失败注塑、当前工业/外贸，再固定13站和四样子无图站；没有更换失败输入。
- 120张最终PNG与 `cd88e83` 那批已逐张打开、另核120张原像素底边及9张差异图56个原尺寸区域的有效图片完全逐RGB相同。对应关系在 `artifacts/integration/20261006-20515c0/pixel-equality-to-opened.json`；原独立捕获完整性报告在 `artifacts/integration/20261006-cd88e83/visual-open-audit/`。这是相同实际图像内容的可核验关联，不伪称重新打开了120个文件，也不代替页面质量的独立结论。
- T117的新Astra对最终候选独立审查PASS，宿主−2px、包围盒不变的祖先翻转、页脚0.75px与另一个祖先−3.25px均被明确拒绝，正常无图/仅图/显式隐藏通过。完整证据及限制见 `artifacts/t117/astra-20515c0/review.txt`。此前空白假绿、文字位移和宿主位移NO_GO原样保留；原间歇白页物理因果仍未知，捕获内容采样不声称OCR或完整语义。
- 当前照片站仍为注塑 `2712b46f-e375-4447-90df-11c411e7c5ca`、工业 `7eee7add-e46b-4194-aa14-2d4b5e029e8d`、外贸 `224e7c90-2268-4a3c-a6b5-02bc28b28fdc`。许可/用途/清晰度边界见已关闭T112；本次未改照片。无文字但有分类照片仍显示、显式隐藏优先，以及T116仅省略获授权行业复述的规则保留。

总索引为 `artifacts/integration/20261006-20515c0/verification-summary.json`，各命令原stdout、UTC、完整源码提交与退出码均留存。41变体的入库矩阵仍绑定0ad88aa，本次未改声明或几何门，不冒充重跑该矩阵。旧T107重复图片/零照片报告和overlay历史迁移失败未删除或改写；旧palette迁移造成的站点列表500仍为已知未修限制，不宣称完整新建/对齐流程或生产发布通过。没有公网、实机、邮件送达验证或推送。
