---
id: T-109
title: 同风格示意图与静态细节质感
type: build
status: open
blocked_by: [T-107, T-108, T-112, T-113, T-115, T-116]
claimed_by: codex-control
supersedes:
---

## What to build

T-104 第 ④ 步。资料没图而版式需要图的位置，用 Codex 按样子 token 画的线稿式 SVG 示意图，风格要符合当前页面，能看出是示意、不冒充实拍；并做静态细节质感（排版层级、数字 / 参数排法、分隔线与表面处理、卡片细节），不做动效。示意图和细节改动都过盲评，示意图不过就删。

## Acceptance

- [ ] 示意图只出现在资料无图的位置；四个样子各自风格一致；盲评与无图版对比不输
- [ ] 12 站 + 带图资料站 `check-published` 通过；全量、typecheck、build 通过；代码审查通过；Claude 验收

## Resolution

**INCOMPLETE：设备占位线稿被独立盲评否决，正按本票“不过就删”规则移除。** T-090/T-111/T-112/T-113/T-115/T-116均已关闭。上一次完整检查的源码基线 `e22bcee69a2219e79ca48621b5da5738644fca57` 已通过894/894全量、build、typecheck及固定13站加当前三包的96个中英文视图；全部missingFacts为0、逐图覆盖与decode通过，命令/UTC/完整SHA/退出码见 `artifacts/integration/20261006-e22bcee/verification-summary.json`。84张未变页面与此前已查看有效图直接逐像素相同；工业/外贸12张新访客页及12张工作台视口图由不同gpt-6.1-sol实例逐张打开并通过T116行业区盲评。同一基线的四样子、三档双语共24组对照已完成；新的独立gpt-6.1-sol实例逐张看过48张设备区原图和24张整页上下文，24组全部选择无示意版。设备数据/层级相同，线稿没有额外设备辨识信息，却增加220–286px高度；解盲记录与原始审查为 `artifacts/t109/final-schematic-review-e22bcee/`。据此执行删除，不重评同候选，也不把旧局部评审当作当前通过。删除后的源码须重新冻结并完成相关检查、真实同站全页验证和独立审查，上述基线绿测不替代新候选。

删除候选已固定在 `artifacts/t109/remove-rejected-schematic/frozen-candidate/`：设备线稿markup、专属样式/token、SVG文件与桥接显示分支直接移除，共8个源码/测试文件。新合同在生产代码未改的 `67a49da` 上因设备SVG仍存在而红，同一Tracer bullet删除后转绿；相关45/45测试覆盖四样子、三设备布局、三档、三次语言切换与六种媒体状态，共648个浏览器状态。提交前typecheck通过，明确记录为工作树候选，不冒充旧SHA运行码。补充自制采集器未完成，导入/iframe/隐藏空img/空数据/类别映射的错误原样保留；正式同站发布与独立审查由主控接管，不引用这些失败驱动作为产品通过证据。

T-110两种盲评属于本票完成后的下一步，目前NOT_RUN，不将它写成本票的循环前置条件。照片许可、业务适配与大屏清晰度沿用已关闭T112的限定结论和原图输入，本轮未改照片。41变体的原入库检查仍绑定 `0ad88aa`；此次未改声明、collector或几何门，不重复该入库矩阵。

- `97b1734b14dd66e6dba54c981b98abefbdf76e19` 实现设备无图时的双语标注线稿，有图时隐藏线稿，四样子线宽2/1/2/1px。旧区块盲评保留于 `/Users/luckye/Documents/Code/sitecraft-ai-blocks-pool/artifacts/blocks-pool/t109-*/`，不替代当前整页验收。
- 原注塑 Tracer bullet 上传前无图通过，上传6图后只有5图可见：检测图已加载但被空 capabilities 隐藏。原始接口、stdout、红测与截图在 `artifacts/t109/20261006-photos/run-ebc97b3-01/`，`result.md`为索引。首次工作树green的runtimeSha元数据误指基线，异常原样保留并说明。
- `e422fc7` 保留有分类照片的产品、设备、检测区块，并由真实图片接口逐imageId核对URL、类别落点、实际可见及decode；显式隐藏单列豁免，泄露仍失败。独立审核发现删除catalog后旧intro残留，以及多产品图片错误计算hero豁免；有效父版红测为 `run-e422fc7-review-red-03`（05:14:45–49Z，14项12pass/2fail）。`f53dc1eaf3466ee499f2ae95e3f2f8df4676a286` 修复后相关19/19绿，真实API删除、undo/redo、语言切换和损坏图片decode均覆盖。独立Astra复审37/37观察通过，报告 `artifacts/t109/20261006-review-r2/review.md`，已核实四文件对应最终提交。
- `f53dc1e` 的同一注塑站 `2712b46f-e375-4447-90df-11c411e7c5ca`（revision4、6图、每语言114事实）、工业 `80f53a96-b2d4-4368-ac7d-5d2ed613ffef`（revision3、8图、44事实）和外贸 `8142e99f-55be-406f-87a3-cf26308eef76`（revision3、7图、43事实）于2026-10-06 05:29:33–05:31:01Z复验。7条命令包括输入GET核对、三次原版 `node scripts/check-published.mjs --out <pack-published> <siteId>` 与三次逐图检查；全部exit0、无浏览器重试。18个视图missingFacts为0、逐图可见且decode、每图单次落位、设备schematic=false，metadata匹配manifest。确切命令、SHA、UTC、原始报告/18张截图及逐图JSON在 `artifacts/t109/20261006-photos/run-f53dc1e-01/verification-summary.json`。
- 同一 `f53dc1e` 的 `npm test` 839/839、typecheck、build及固定13站发布检查39/39（每行含中英文）通过，原始日志在 `artifacts/integration/20261006-f53dc1e/`。后续页面/素材改动需要自己的最终证据；照片员工自查截图不等于独立审美通过，独立审核发现的底部截图完整性问题由T-113验证。
- 独立视觉 NO_GO 在 `artifacts/acceptance/20261006-visual-f53dc1e/review-output/review-with-product-scope.md`：工业/外贸图片错配、重复正文、图片署名拥挤、开发标记及手机页脚可读性。原文公司名和模拟.test邮箱已按既定规则排除，不作为缺陷。T-114负责人选择手机单列，由T-113执行。T-110混排盲评尚未执行。
- 旧T-107重复图片、photoCount为0的报告和overlay迁移失败完整保留，本票未改旧站、未删除旧数据，也不声称修复它们。三包资料始终经API/commitOperations及原上传接口写入。未推送。本票没有新的模型生成主流程证据；T116另有一次真实provider边界检查，不能外推完整需求对齐/新建对话。
