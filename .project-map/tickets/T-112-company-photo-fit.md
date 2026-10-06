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

**INCOMPLETE：T-112整体。** 数据准备及 `0ad88aa0cb232e5d439dadae0d062e527bd2302a` 的三包实际发布功能检查通过；最终成品配图审核为NO_GO，仅剩工业插齿机图与外贸三通图在大屏展示时清晰度不足。两张素材交给新窗口 `photo-clarity` 处理，其他素材与全部旧站、原始证据保持不变。

- 最终原版CLI三包各运行一次、均exit0，18张截图已自查；108条逐图观察的唯一落点、用途、可见性、decode及署名/许可/来源通过，F01+F03在六个工业视图中为双图，输入前后不变。真实命令、完整SHA、UTC、stdout及setup错误原件在 `artifacts/t112/final-0ad88aa/README.md`。功能通过不等于照片清晰度通过。
- 新独立实例逐张查看18图及原尺寸局部后，注塑PASS；工业 `equipment-gear-shaping-machine.jpg`（`img_82a18c979c014cfaa664b09d`，自然682×998、1440图框594×445.5）在1440模糊；外贸 `product-compression-tee.jpg`（E02）在1440/768模糊。其他图片未见该范围内的否决项。原NO_GO、原截图和局部图保存在 `artifacts/acceptance/20261006-photo-layout-0ad88aa/frozen-review/review.md`。

- 固定交接：`artifacts/t112/20261006-data-preparation/README.md`；`verification.json`、`new-sites.json`、逐请求/响应、每图HTTP取证、原值比对及fixture-before/fixture-admitted均保留。首批、补搜、草案、独立报告和原失败截图不覆盖。
- 工业6图：原减速机产品、箱体加工（equipment，“齿轮箱箱体加工”）、插齿机、B01、F01+F03。外贸6图：E02/E01/E14/E12/F02/E07。两包四类齐全；所有旧JPEG保留原字节，未覆盖。B02/B03/E13排除活动manifest。
- 来源/用途独立结论保留在 `artifacts/t112/independent-20261006/20261006T061547Z/review.md`、`incremental-01-062605Z/review.md`、`incremental-02-063149Z/review.md`。F03只限与F01形成现有双图facility图库，不能唯一大首屏或显式hero/product单图；限制记录在manifest/LICENSES，最终三档实际组合仍待确认。E12只作零件清洁行业素材；原公司能力仍为“钝化与清洁包装”，未增加超声波等事实。
- 独立交接核验 `artifacts/t112/independent-20261006/handoff-065005Z/review.md` 为PASS：12/12文件及API图片响应与已审图片字节一致，作者、精确许可、来源、修改链及使用限制未丢失；未以散列代替实际比对。这个结论不代替最终整页与F03实际组合验收。
- 仅经真实API读取两份原草稿，POST创建新站后PUT/replace_draft经commitOperations导入。工业新站 `51b104d3-19a1-4aa2-bd67-a1be38e57566`，来自 `80f53a96-b2d4-4368-ac7d-5d2ed613ffef`；外贸新站 `7b2ba653-8112-4f8e-96d6-3871ade54b8a`，来自 `8142e99f-55be-406f-87a3-cf26308eef76`。除明确的T112站名与提交元数据，草稿字段逐值相同；两份原草稿均无imageId引用，映射为空，没有跨站图片引用。
- 原 `scripts/upload-company-images.mjs --base-url http://127.0.0.1:3034 --pack <pack> --site-id <newId>` 各上传6张；artifact预加载器只捕获原fetch请求/响应，未修改上传入口。12次POST均201；GET逐字段及逐imageId二进制回读均200并匹配fixture。完整作者/机构credit、精确许可URL、来源、attribution和原修改链已保留。原上传器未传图注，不宣称页面已呈现图注。
- 复核命令 `python3 artifacts/t112/20261006-data-preparation/verify-preparation.py` 通过，保存新的verification-02，原站草稿/上传均未改变。最初核验器把source预设成external的错误保留于 `verification-attempt-01-failure.json`，已按现有public-material契约修正，不当产品红、不重复上传。
- 本轮显式改动限工业/外贸各manifest/LICENSES和10个新增JPEG（12活动图中2张既有JPEG沿用）；另只更新本票Resolution。源码、renderer、脚本、tests配置、molding、旧站及原上传不改。fixture/新站输入和票的外部证据保持冻结；实际最终发布截图/三档验收未执行，验收整体不关闭。
