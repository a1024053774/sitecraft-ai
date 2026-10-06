---
id: T-112
title: 纠正工业与外贸模拟资料照片的业务错配
type: build
status: closed
blocked_by: []
claimed_by: photo-clarity
supersedes:
---

## What to build

独立视觉审核发现已准入的工业、外贸照片包含无历史说明的档案场景、明显灰色遮挡，以及与小型不锈钢流体接头无关的巨型工件和旧工具。依据 T-104 的既定素材要求纠正来源选择，保留旧图片和失败证据供追溯；不改旧站点或删除用户上传。

范围为 `tests/fixtures/company-images/industrial/`、`export/` 的真实照片、manifest 和许可说明。注塑资料中已匹配的照片保留。每包仍为 6–10 张，四类用途齐全；来源限 T-106 已批准的许可类型。候选必须以图片内容和来源描述证明与当前模拟业务相符，不用遮挡、生成补图或不相关照片凑数。必要的图注只能来自来源材料，不编设备、材质或型号事实。

## Acceptance

- [x] 候选逐张核对业务对应、无明显遮挡/未解释的档案场景，原图来源、作者、许可和适用范围可追溯
- [x] 独立审核确认来源许可和视觉业务匹配；替换前后材料及原因均保留
- [x] 通过原上传接口和发布页检查验证修正后的资料包；旧站、旧报告和失败证据未被覆盖，T-109 引用实际新证据

## Resolution

**PASS，2026-10-06 主控验收关闭。** 最终素材候选为 `c4438b1f3fc9c5e729eeec2ca8ef49e7aa41f5c3`；渲染/检查源码与已通过887/887、build/typecheck及独立代码复审的 `0ad88aa0cb232e5d439dadae0d062e527bd2302a` 完全相同，本次没有重跑无关全量。范围为工业/外贸照片，不包含T-115语义内容取舍或T-110混排盲评。

- 两包各6张、四用途齐全。最终工业活动第3张为 `equipment-multitasking-cnc.jpg`（B-C1，1600×1200，269168字节，Whoisjohngalt / CC BY-SA 4.0），外贸第1张为 `product-compression-union.jpg`（C-C1，1600×1200，267775字节，Jason Woodhead / CC BY 2.0）。两图以已审原字节准入，准确命名为通用CNC/卡套直通；其余十项及顺序不变，旧JPEG/旧许可/失败站均保留。
- 独立来源、修改链、业务与实框清晰度PASS见 `artifacts/t112/clarity-review/review.md`。C的许可依据保存的Flickr一手响应，审核者当轮在线访问失败，未冒称在线成功；包装型号/316关联仍是同框推断，不是材质证书或新增公司规格。B不声称插齿机或公司机型/自动换刀能力。F01+F03双图限制、E12不新增超声波工艺事实继续有效。
- 通过真实POST创建→PUT/replace_draft/commitOperations→GET生成复验副本：工业 `7eee7add-e46b-4194-aa14-2d4b5e029e8d`，外贸 `224e7c90-2268-4a3c-a6b5-02bc28b28fdc`。相对原失败站，实际草稿差异仅siteName；公司文字、产品、样子、样式、行业说明保持逐值相同。原上传器每包一次、各6 POST201，GET元数据及新/旧JPEG直接字节核对通过。取证与候选提交对应见 `artifacts/t112/clarity-admission/README.md`、`commit-binding-c4438b1.json`。
- 冻结素材提交后，原版 `node scripts/check-published.mjs --out <pack/published> <siteId>` 在规定Chrome路径和3034下各运行一次，工业08:36:12–08:36:31Z、外贸08:39:02–08:39:21Z，均exit0、无浏览器重试。12个中英/三档视图的72条逐imageId观察全部通过：正确URL与用途、单次可见落点、await decode、自然尺寸、完整署名和同条source/license链接。前后GET输入不变，F01+F03在六个工业视图保持同一双图图库，无独占hero绑定。完整命令、UTC、SHA、stdout、12图及测量在 `artifacts/t112/clarity-final-c4438b1/README.md` 与 `verification-summary.json`。
- 独立实例再次查看这12张真实发布截图及12个原尺寸局部，确认B的1440设备图、C的1440/768接头图原模糊问题解除，其余档未见替换引入的严重裁切或遮挡；于08:47:30Z给出范围内PASS，见 `artifacts/t112/clarity-final-visual-c4438b1/review/review.md`。此前源图与实际成品NO_GO均未改写。
- 辅助工具的SyntaxError和首次全DOM图片decode失败完整保留。首次decode没有节点级日志，无法事后确证具体节点；同输入诊断运行的唯一错误为隐藏无src占位，原版门和后续逐上传图门均确认真实六图decode成功。修正只增加逐节点记录并保留错误，不豁免上传图或重跑已通过的原版CLI；事实/推断/限制及实际diff在最终目录 `decode-error-analysis.json`。准入时误要求可选rejected字段的旧工具错误同样保留，不当产品红。

没有改renderer、产品源码、测试、站点文字或T-115内容，也没有删除旧证据或推送。收尾仅更新当前清单的已验收状态与本票；原始冻结清单保留在各证据目录。
