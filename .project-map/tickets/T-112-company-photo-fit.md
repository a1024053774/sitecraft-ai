---
id: T-112
title: 纠正工业与外贸模拟资料照片的业务错配
type: build
status: open
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
- [ ] 通过原上传接口和发布页检查验证修正后的资料包；旧站、旧报告和失败证据未被覆盖，T-109 引用实际新证据

## Resolution

**PASS：两张清晰候选准入及本轮数据准备；INCOMPLETE：T-112整体。** photo-clarity，2026-10-06；运行HEAD `a0a1128596e15e196efb078ac80203547cb71866`（负责人确认渲染/检查源码仍同 `0ad88aa0cb232e5d439dadae0d062e527bd2302a`），数据于 `2026-10-06T08:23:55.298748+00:00` 冻结。未commit/push、未运行最终check/截图或全量/build，票保持open；等待主控统一提交绑定后的最终信号。

- 两张固定候选的独立许可/业务/指定实框清晰度复核为PASS：`artifacts/t112/clarity-review/review.md`。工业限通用CNC equipment题材；外贸限小型卡套直通，316/型号与包装仍是同框推断，不新增公司材质证书、型号或尺寸事实。外贸许可核对依据保存的Flickr一手响应，审核者在线访问失败一次，未写成在线成功。原大屏原图NO_GO不改写。
- 活动manifest仅工业第3张从`equipment-gear-shaping-machine.jpg`替为`equipment-multitasking-cnc.jpg`（B-C1，1600×1200/269168字节，Whoisjohngalt，CC BY-SA 4.0），外贸第1张从`product-compression-tee.jpg`替为`product-compression-union.jpg`（C-C1，1600×1200/267775字节，Jason Woodhead，CC BY 2.0）；使用准确新身份/题名。已审JPEG直接拷贝并逐字节核对，不重新处理。完整作者、精确许可、来源及处理链随fixture/API保留。
- 其余十个active条目、照片和顺序逐值/逐字节不变，两包各6张、四用途。全部旧JPEG、旧许可和原失败证据保留；F01+F03双facility受限组合、E12不新增超声波工艺边界不变。manifest根部仅校正衍生件说明并加新独立报告引用。显式改动为两张新增JPEG、两包manifest/LICENSES及本Resolution；无源码/renderer/测试/配置/T115改动。
- 真实API分别由原失败站`51b104d3-19a1-4aa2-bd67-a1be38e57566`和`7b2ba653-8112-4f8e-96d6-3871ade54b8a`新建复验副本：工业`7eee7add-e46b-4194-aa14-2d4b5e029e8d`（T112 20261006 clarity industrial），外贸`224e7c90-2268-4a3c-a6b5-02bc28b28fdc`（T112 20261006 clarity export）。POST201→PUT/replace_draft/commitOperations applied→GET逐值比较；实际差异仅新站siteName，文字/产品/样子/样式/行业名称及说明全部相同，未写草稿文件或跨站图片引用。
- 原`node scripts/upload-company-images.mjs --base-url http://127.0.0.1:3034 --pack <pack> --site-id <newId>`各运行一次：工业UTC `2026-10-06T08:19:00.091Z`、外贸`2026-10-06T08:21:55.041Z`，均exit0、各6 POST201。`python3 artifacts/t112/clarity-admission/verify-pack.py industrial`（UTC `08:21:04.602850`）和`... export`（UTC `08:21:55.390585`）均exit0：逐对象作者、URL、精确许可、attribution/credit、用途、尺寸/字节及POST/GET核对通过，12新图JPEG、12原失败站JPEG直接比对通过，两张候选另与独立已审原字节相同，未新增散列。
- 原失败站草稿/图片对象及原二进制保持不变；新草稿上传后不变。最终8次GET200在冻结目录再次与已验证原值匹配。交接及完整命令/UTC/输入比较、逐POST/GET、准入前后包快照、新站映射、冻结输入在`artifacts/t112/clarity-admission/README.md`、`verification.json`、`frozen-inputs.json`、`new-sites.json`。
- 工业首次artifact工具误要求成功响应必有`rejected: []`，真实PUT已applied而该字段按既有契约在无拒绝时省略；原响应、exit1错误及原脚本保留。修正工具后仅补GET核验既有副本，无重复POST/PUT/导入/上传、无换站掩盖。详细原因见新交接；未改产品源码或旧结果。
- 原素材成品NO_GO保留于`artifacts/acceptance/20261006-photo-layout-0ad88aa/frozen-review/review.md`；原三包18图及108条功能观察保留于`artifacts/t112/final-0ad88aa/`。早前12图准入及API链原件仍在`artifacts/t112/20261006-data-preparation/`和`independent-20261006/`，不删除、不覆盖。这些旧结果不代替本轮新站的最终发布验收。
