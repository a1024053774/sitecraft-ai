---
id: T-137
title: 加厚四家模拟公司资料，接近真实中小厂官网的内容量
type: build
status: open
blocked_by: []
claimed_by: t137-build
supersedes:
---

## Why

基线、T-132、T-134 三轮盲评里，「混在真实官网里被认出」始终全中；评审理由从版式转向内容：同一条事实在首屏、摘要、参数表各写一遍，文案在解释词义。模拟公司只有十几条事实、0–3 张授权图，模型要撑满 3–5 页只能重复。负责人 2026-10-09 同意加厚模拟资料。

## What to build

把 `lib/simulated-packs.ts` 的四家（industrial、export、molding、packaging）资料补到真实中小厂官网的量级，仍明确标为模拟、不对应任何真实企业：公司沿革（几个年份事件）、两到三个项目或供货案例（客户用行业描述，不写真实公司名、不写评价）、加工与质检流程细节、设备清单与数量、产品的典型应用与选型说明、常见问题及答案、交付与包装、联系与询盘要求。每家缺的事实仍写「待补充」，不让模型去编。资料是给模型的原始输入，口吻像客户提供的资料，不像网页文案。

图片：在现有 `tests/fixtures/company-images/<pack>/` 基础上，按同样的来源与许可核验流程（manifest 记录来源、作者、许可、核验日期）为每家补到 6–10 张授权行业图片；纸包装目前没有图，补齐。许可不明的不收。

评估集对应的资料随之更新（`npm run eval:new-route` 读取的同一来源），旧资料不另留第二份。

## Acceptance

- [x] 四家资料各自的事实条目与授权图片数写进 Resolution，与改前对照；每张新图有 manifest 来源与许可记录
- [x] 资料中没有真实企业名称、真实联系方式或虚假评价；缺口用「待补充」
- [ ] 相关测试、typecheck、build 通过；本票不跑真实评估（评估与 T-138、T-135 合并成一轮由主控安排）

## Resolution

INCOMPLETE（本次三项修正及指定检查 PASS；完整验收待主控）。执行者 `t137-build`，2026-10-09。以 `42563e9` 为基线，按 Astra 对 `41052c6` 的 NO_GO 修正，并 amend 为一个本地功能提交；本节随该提交交付，确切 SHA 见执行汇报。不关票、不派审核、不推送。

事实条目按资料行计，含明确的待补充缺口；不计资料性质、目标、首屏提示、主按钮、页面与图片使用说明。同一行的规格、沿革和流程不拆计，供货案例一行计一条。图片只计活动 manifest，不计保留的旧 JPEG 或拒收档案。

| 公司 | 事实条目（改前 → 改后） | 正文字数（改前 → 改后） | 授权图（改前 → 改后） | 每个风格实际上传数 | 案例 / FAQ |
| --- | --- | --- | --- | --- | --- |
| industrial | 10 → 28 | 538 → 1718 | 6 → 8 | 8 | 3 / 4 |
| export | 10 → 28 | 520 → 1677 | 6 → 8 | 8 | 3 / 4 |
| molding | 25 → 37 | 1671 → 2548 | 6 → 8 | 8 | 3 / 6 |
| packaging | 15 → 30 | 923 → 1950 | 0 → 6 | 6 | 3 / 5 |

四家均有沿革、三个行业供货案例、加工与质检流程、带数量的设备、每类产品的应用与选型、FAQ、交付与包装和询盘要求。保留原产品与规格，不写真实客户名称或评价；联系方式仅为 `-sim.test` 邮箱，其他缺口写「待补充」。封套正文仍为 2782 / 2741 / 3612 / 3014 字，没有提高 4000 字上限或截断。

图片准入修正：

- 撤下 `Flachbettstanze.jpg`：页面作者 Goepfert Maschinen GmbH 与元数据作者/版权人 Frank Freihofer 冲突，不以页面 CC 标签推定权利清楚。替换为 Arielinson 自摄切纸机图，文件页、Commons API 和原始 JPEG EXIF 无冲突权利声明。
- 撤下两张以 VIÑA PATI 纸箱为主体的图，替换为 Richard Wheeler / Zephyris 的无品牌瓦楞纸板截面和 Jacek Halicki 的尺寸量具。按同一品牌主体标准，另撤下前景带印刷箱板的输送图；纸包装最终六张，覆盖 product / equipment / inspection。没有裁去标识或修图掩盖问题。
- 替换图逐张核对来源修订、许可页面、EXIF；卡尺的 EXIF Artist、IPTC Byline 和 XMP Creator 均与页面作者 Jacek Halicki 一致，另外两图未出现独立权利人字段，不将“无 EXIF”当作公有领域。具体来源、CC BY-SA 3.0/4.0、核验时间、署名和完整处理链见纸包装 manifest / LICENSES。切纸机来源图已有按钮圈注及模糊标签，照原图保留并记录，不作为安全认证或操作依据。
- 原六图的 T-112 审核范围仍仅覆盖各包原六图；不转借给新增图。其余 T-137 新图的来源页权利字段也复查了，没有发现另一组冲突声明。被撤下图片及旧准入记录保留于 gitignore 的 `artifacts/t137/revision/rejected/`，不进入活动上传集合。

评估接线修正：`scripts/eval-new-route.ts` 对四家公司都读取其 manifest 的全部准入图片，逐项检查许可来源和作者后走原上传接口；原来每家公司只选第一张 product / equipment、纸包装缺席的路径已删除。所有图片的文件名、图注和使用限制进入同一份资料，正文仍来自 `lib/simulated-packs.ts`；没有另存旧资料、没有新增评估模式或旁路。`docs/project/spec.md` 已同步。两种风格每家公司都上传 8 / 8 / 8 / 6 张，共 60 次图片上传；这由真实评估 CLI + 本地 HTTP 夹具观测，生成请求在夹具中明确拒绝，并非真实模型评估成功。

本次修正之后重新运行的证据（UTC；对应本 Resolution 所在 amended 提交）：

- `node --test --experimental-strip-types tests/t137-eval-images.test.ts`：在 `41052c6` 上失败，实际为 2 / 2 / 2 / 0 张，断言拒绝缺失 manifest 项（`artifacts/t137/revision/eval-images-red.log`，05:15 UTC）。修正后通过；每个风格都上传完整集合，许可字段、图注和限制也被观察核对；夹具禁止模型和外部官网调用，CLI 仍如实返回 INCOMPLETE。
- `node --test --experimental-strip-types tests/t137-materials.test.ts`：修图前新增拒收来源检查失败（`artifacts/t137/revision/image-admission-red.log`，05:17 UTC）；替换后通过。原来薄资料和禁用许可的失败证据仍保留，未覆盖或丢弃。
- `node --test --experimental-strip-types tests/t137-materials.test.ts tests/t137-eval-images.test.ts tests/t130-eval-set.test.ts tests/simulated-packs.test.ts tests/equipment.test.ts tests/commercial-terms.test.ts tests/history-field.test.ts tests/quality-process.test.ts tests/product-specs.test.ts`：85/85 通过（`artifacts/t137/revision/related-green.log`，05:19 UTC）。后续仅补充权利核验记录和文档，收尾相关检查见 `related-delivery.log`。
- `npm run typecheck`、`SITE_STORE=fs npm run build`：均退出 0，build 使用 Turbopack（`artifacts/t137/revision/typecheck.log`、`build.log`，05:19 UTC）。
- `CHROME_PATH=<AGENTS 指定路径> SITE_STORE=fs node --experimental-strip-types artifacts/t137/revision/materials-ui.ts`：确认 3149 服务为本工作树，四家公司各 8 / 8 / 8 / 6 张图片经真实上传接口保存，作者、许可、尺寸核对并由 Chrome 解码；资料输入完整，1440/768/375 共十二张截图已逐张打开（`artifacts/t137/revision/ui/report.json`、PNG，05:22 UTC）。未生成版本或模型任务；图片与资料输入检查不代表页面审美通过。
- UTF-8、LF、无 BOM/替换字符；`git diff --check` 与 `project_map.py status --root .` 无问题、无 stale living docs。

本次没有重跑完整 `npm test`。此前 `41052c6` 的全套结果为 2595/2599；其中本票相关 T-109 两图场景已修复并单测 5/5 通过。T-075 等待工作台元素超时、T-090 缺本地历史站点、T-113 固定历史站点返回 404 尚未复验；该旧结果不能当作 amended 提交的全套通过证据，第三项验收保持未勾选。旧失败与初次误用 3034 的日志均保留，不作为本次通过证据。

DeepSeek 0 次。真实 `eval:new-route` 生成、生成站底线检查和独立盲评均未运行，按负责人要求留到合并评估轮；未派再审，票保持 open，交主控复验。
