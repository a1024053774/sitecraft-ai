---
id: T-190
title: 模拟资料按真实企业写法重整并建立新基线
type: build
status: open
blocked_by: []
claimed_by: codex-t190-baseline-r2
supersedes:
---

## Why

见 T-189：模拟资料本身把字段模板（需求／提供／边界）、大量否定限制和不齐整的条目条件喂给了模型，与缺口 1、4 和横向挪用条件直接相关。负责人 2026-10-19 决定按真实企业的写法重整，补品牌、动态和图片素材，让站点有素材写出运营感。

## What to build

1. **重写 `lib/simulated-packs.ts` 的七家资料**，像企业自己整理给建站方的材料：
   - **写法**：
     - 不用统一的「需求／提供／边界」「内容／交付／边界」字段格式；
     - 限制和否定只保留真实经营必需、访客需要知道的，每家不超过 3–4 条；
     - 同类条目的条件写齐，或明确只适用于哪一条，不留会诱导挪用的空缺。
   - **新增素材**：
     - 品牌名称与标识的文字说明（标识样式、主色）；
     - 每家 3–5 条带日期的动态，如新品、展会、营业调整、课程开班，均为模拟内容并带模拟标注；
     - 资料能撑起的栏目线索。
   - **事实底线不变**：模拟标注、「待补充」缺口、模拟邮箱域名都保留，规则见 `docs/project/intent.md` 第 4 节。
2. **图片**：每家补到能撑起首屏和主要栏目的数量，逐张核来源、许可和题材是否一致，按现有图片登记与署名流程处理（参照 T-112、T-137 的登记方式）。许可不清的不用；可以没有图，不能冒充实拍。
3. **评估器**：mixed 盲评提示去掉「须≤50%」，改为「仅作参考」；company 不变。
4. **生成侧不改**：本票不改核心规范或风格 skill，以免和资料变化混在一起、分不清效果。如果资料改动和 T-188 的生成侧改动同时进主线，基线要在两者都合并后再跑，并在 Resolution 写明。
5. **新基线**：
   - 跑 `npm run eval:new-route` 默认 full 矩阵，加 T-180 第 2 轮的六组合；
   - 预算网关显式 `SITECRAFT_TOKEN_LIMIT=3000000`，用新账本；
   - 新旧资料的跨轮成对比较（comparison）交给独立实例，同公司同风格配对；mixed、company 照常各交一个新实例；
   - 用固定脚本统计缺口站数，与 T-180 对比。
6. **主数据**：新站复制进主数据，站名带「（新资料 T-190）」。

## Acceptance

- [x] 七家资料按上述写法重写，模拟标注与缺口保留；新增图片逐张有来源与许可记录
- [ ] 新基线两轮的命令、提交、用量、成败站数写进 Resolution；comparison 结果与固定口径缺口计数（对比 T-180）如实记录
- [x] 合并后主线验证通过（typecheck、test、build）；独立 fast 审查通过（见 Resolution「主控：合并与主线验证」）

## Resolution

**第一步 PASS，整票 INCOMPLETE，保持 open。** 执行者 `codex-t190`，2026-10-19。功能提交 `fe33e5b25dda09e869d8e1a9b9d28220dfd200f3`，基于 `dc09cb2`；本节在后续本地交接提交中登记实测结果。负责人本次只授权资料、图片、评估提示与定向门控。新基线须等本改动和 T-188 都合并后由主控另行安排，本次没有执行新基线、主数据复制或任何真实模型调用；后两项验收保持未勾选，不关票。

### 改前问题与本次资料

已读 T-189、intent 第 4 节、T-112/T-137 图片登记，以及主工作区只读的 `artifacts/t184/supervisor-analysis/README.md`。七家都带内部字段框架，行业案例或服务反复以「需求／交付／边界」等字段排列；餐馆、培训、设计还把大批页面禁令塞进材料。下表的否定数按正文提示词出现数计：`不(?!锈钢|同)|没有|未取得|仅限|只承接`，排除开头模拟声明、图片许可说明和页面声明；包含问句，属于保守的文本合同检查，不冒称覆盖全部条件的语义判定。原始逐行结果见 `artifacts/t190/before-materials.json`，同口径改前改后结果见 `materials-summary.json`。

| 资料 | 改前字段与条件问题 | 否定提示词 改前→改后 | 正文字数 改前→改后 | 活动图 改前→改后 |
| --- | --- | --- | --- | --- |
| 工业 | 三项案例统一字段；现场安装、起订重复；案例的买方责任夹在通用能力中 | 10→2 | 1690→1851 | 8→8 |
| 外贸 | 三项案例统一字段；辅助气路用途、介质相容性与各自接口条件容易扩为全目录条件；起订与交期需分别确认 | 11→4 | 1625→1856 | 8→8 |
| 注塑 | 三项案例统一字段；PMMA 2 mm 透光率与整灯效果边界需留在自身条目；模具总交期汇总丢失起算与类别区别 | 6→2 | 2498→2776 | 8→8 |
| 纸包装 | 三项案例统一字段；四色胶印、直接接触食品与运输测试条件容易在彩盒、瓦楞和内托间挪用 | 18→3 | 1912→1917 | 6→6 |
| 餐馆 | 菜品与用餐场景套字段；豆腐煲缺供应时段、份量建议空缺，易挪用邻菜；页面禁令过密 | 26→3 | 1887→1859 | 0→3 |
| 教育 | 课程和学习场景按字段排列；材料、选课前提、开放时间与课表条件分散，重复否定多 | 34→4 | 2180→2153 | 0→2 |
| 设计 | 服务及项目记录套字段；服务起算点与等待时间集中汇总，作品授权与制作责任容易扩大 | 25→4 | 2395→2295 | 0→2 |

改后各家以业务叙述组织，品牌名称、标识样式与主色齐备，各有三条 `YYYY-MM-DD（模拟动态）` 和栏目线索。价格、规格、设备、流程与既有缺口保留；邮箱仍为 luckye.online。豆腐煲明确午晚市供应、米饭单点、份量人数待补充；其余菜各自写供应时段及米饭口径。纸包装逐项写印刷、起订与交期；课程逐项写前提、材料与下一期缺口；设计服务逐项写起算点和另计时间。案例条件随对应项目叙述，不再另列边界模板。所有工作台封套与评估输入均完整，最终评估输入最长 3513 字，未提高 4000 字上限或截断。

### 图片与评估输入

原四包 30 张图重读既有 manifest/LICENSES 并逐项打开本地联系表，题材仍对应新资料，沿用原用途限制；未把历史来源页核验说成本次联网重核。记录在 `artifacts/t190/existing-images/records.json`，四张联系表均已查看。

新增七图登记在 `fixtures/simulated-packs/{restaurant,education,design}/manifest.json` 和各自 `LICENSES.md`：餐馆为豆腐、香菇、番茄食材，教育为水彩盘与画笔、石墨等画笔材料，设计为空白封面书册、纸页排版样张。新增图逐张核 Commons 文件页、API、具体许可页、原图 EXIF/IPTC/XMP 权利字段，并打开完整本地配图；记录来源 URL、作者、许可、核对时间、处理链、题材及生成站与下载包的再分发依据。CC0、公有领域与 CC BY-SA 允许相应复制、改作及商业再分发；BY-SA 图片衍生物保留原许可与署名。本次“生成器使用”指随生成站嵌入及导出，不推导模型训练许可。照片全部是题材配图，未冒充门店、课堂或客户作品。

新增来源和下载各在本工作树新建的空目录，处理脚本在目录外，读取均用隔离的 `python3 -I`。原图、来源、许可页、权利字段和核对记录在 `artifacts/t190/downloads/`。未准入的番茄图存在作者字段未澄清对应；彩铅图与课程材料不够对应；另一纸张图不足以承担所需题材。许可字段脚本的两次 KeyError、缺 defusedxml 时 XMP 未读的警告及初次结果均保留；最终另直接读取并核对原始 XMP 权利文字，未把空解析结果当无权利声明。书册来源已有封面去字与调亮处理已记入署名。水彩图依据 Commons 所记 Flickr 原作及历史许可审核，本次没有声称重新连通 Flickr。拒收清单见 `rejected-images.json`。

评估器只为图片读取复用每包既有登记根，仍走原 multipart 上传与署名入口。真实 CLI 配本地 HTTP 夹具在生成前明确 503 停止，14 个组合共观察到 74 次上传，按公司为 8/8/8/6/3/2/2 张、每种风格各一遍；原文、图注与用途限制均到达提交消息。该证据只证明输入接线，轮次仍如实 INCOMPLETE。mixed 输出提示去掉识别率门槛并写「仅作参考」，company、comparison 提示未改。`skills/`、生成提示与运行时底线规则均未改。

### 本次门控与反事实

以下命令均在本工作树运行。最终门控针对功能提交 `fe33e5b25dda09e869d8e1a9b9d28220dfd200f3`；唯一额外未提交文件为 Next 自动修改的 tsconfig.json，按负责人要求排除。证据集中在 `artifacts/t190/`。

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t190-materials-contract.test.ts

CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t190-materials-contract.test.ts tests/simulated-packs.test.ts tests/t137-materials.test.ts tests/t137-eval-images.test.ts tests/t130-eval-set.test.ts tests/t140-review-materials.test.ts tests/t142-material-inputs.test.ts tests/t157-non-industrial-cases.test.ts tests/t160-materials.test.ts

npm run typecheck
```

- 父版本合同红灯：07:00:53 UTC 结束，在任何资料、图片或评估提示改动之前，dc09cb2 的实际实现为 7 通过、9 失败；失败对应七家字段模板、菜单逐项米饭口径（该用例先在“香菇鸡腿饭应有自己的米饭口径”失败，未执行到豆腐煲时段断言）、mixed 门槛，日志 `contract-red.log`。豆腐煲时段缺失由独立审查用 `git show dc09cb2:lib/simulated-packs.ts` 在内存中单独反例核对，见 `artifacts/t190/review1.txt`。
- 图片路径反事实：暂时换回 dc09cb2 的原 `scripts/eval-new-route.ts`，保留新登记输入，执行 `npm test -- tests/t137-eval-images.test.ts`（同一 CHROME_PATH）；07:10:59 UTC 结束。实际餐馆上传为空，预期是登记的三张图，测试失败；`finally` 原样恢复本次代码，日志 `upload-path-red.log`。未以重试或漏传豁免绕过错误。
- 首次相关检查的两处旧测试写法绑定失败完整保留在 `related-green-attempt1.log`；改为核对项目条件归属与收费事实后通过。新合同的否定检测还覆盖“不包含”“不颁发”等普通写法，未仅枚举少数否定短语。
- 最终定向检查：07:13:22–07:13:29 UTC，**49/49 PASS**、0 跳过，退出 0，见 `related-final.log`、`final-run/report.json`。最终本地夹具上传记录在 `final-run/upload-observations.json`，所有模型用量记录为空。入口自建本工作树服务和临时数据根；虽按保守依赖归入浏览器池，这些用例只用本地夹具，没有启动 Chrome 截图或大批浏览器测试。
- 最终 typecheck：07:13:14 UTC 结束，退出 0，见 `typecheck-final.log`。UTF-8、LF、无 BOM/替换字符与 `git diff --check` 通过。
- `docs/project/spec.md` 同步当前资料、图片数量、mixed 口径和基线安排，MAP 登记对应覆盖路径；`project_map.py status --root .` 无问题、无 stale living docs。

未跑全量、runner 回归、build、真实生成、生成站底线/三档截图或新基线；未开审查或盲评实例。主工作区资料与 artifacts 只读，未写主数据、未推送。页面质量效果与新旧成对比较仍未知，由后续合并评估验证。

**BY-SA 图片的使用边界（主控核对，2026-10-19 EDT，回应构思主控要求）。**

本票四张 CC BY-SA 图片：豆腐、香菇（4.0），纸页（3.0），水彩（2.0）。

系统登记的文件是来源图整幅等比缩放、重新编码的版本，没有裁切、补绘或调色。画笔图另有来源方 Hohum 的既有调色，已记录；它是公有领域，不属于 BY-SA。各 `attribution` 写明了 “full-frame resized/JPEG re-encoded derivative. Same source license retained.”，各包 `LICENSES.md` 也写明 BY-SA 衍生图片保留原许可，署名、来源与改动说明随图片提供。这些图不当作新作品，不改许可。

系统不会自动生成裁切或调色后的新图片文件：上传、预览、发布和站点包使用的都是同一份登记文件。生成站的 CSS（例如 `object-fit: cover`）可能在显示层裁掉一部分画面，`lib/code-site-check.ts` 只把 product 图的这种裁切记为质量反馈。即便被显示层裁切，仍按原 BY-SA 许可署名。

站点包由 `lib/code-site-export.ts` 的 `buildStaticSitePackage` 生成，内含原登记文件与 `LICENSES.txt`，每张图写入 Attribution（含作者、来源 URL、具体许可版本与改动说明）、License 和 License URL。

### 标签含义补改（2026-10-19，回应 T-188 P2）

**本次补改 PASS；整票仍 INCOMPLETE、open。** 执行者 `codex-t190`，基于 `330b13399637ccb2bede0718da6ea415425178f3`，本节与补改代码一同本地提交；对应提交可用 `git log -1 --format=%H -- lib/simulated-packs.ts` 定位。本轮门控后未再修改资料或测试代码。未执行后续真实基线和主线验收，不勾选剩余 Acceptance。

先读本票全部 Resolution 与 BY-SA 主控补记，以及主工作区只读 `artifacts/t188/review1.txt`。P2 的原始反例是已保存页面把服务社区标成地址，本次只清除输入资料的歧义，不声称已证明生成器或事实核对能泛化拦截该错误。

逐行审计保存在 `artifacts/t190/label-audit.md`，完整列出基准的 **245 行**（工业 33、外贸 35、注塑 47、纸包装 34、餐馆 32、教育 32、设计 32），包含所有冒号、空格分隔与分号串联子字段，并逐行写明保留/改写及理由。共改写 **9 个原始行**（这是 4df23f9 轮次的统计；复审 P2 更正后累计为 10 行，补入设计 L368 → 当前 L376「地址与工作时间」，见下文更正段）；改前行号与改后落点均在审计中：

| 基准 `330b133` 行号 | 改动与依据 |
| --- | --- |
| L265 | 餐馆拆成门牌地址、服务社区、到店时间、通行条件；服务社区仍为杭州市拱墅区，明说门店所在区未提供，未推断门店所在地。 |
| L58 | 工业 MOQ 只保留 20 台，排产起算条件和未知交期/样机另列。 |
| L110–111 | 外贸的认证与材料报告分行；原报告的“认证中”原样保留。起订量改为确认口径，交期确认及贸易/付款缺口另列，没有补固定 MOQ 或天数。 |
| L156、L163–164 | 透光率标签限定 PMMA 2 mm 厚试样；模具年产能与注塑月产能分列，42 台及吨位留在主设备行；设备清单不再标加工能力。 |
| L205、L212 | 彩盒用途标签说明两类礼盒均已有独立内袋，依据原接单提醒；设备与工序改为生产与检测设备，原机台和检测数量保留。 |

其余保留项包括逐项已有/认证中的状态、原来明确陈述的教育/设计所在地、仅为应用行业而非客户名单的清单、各产品起订/交期/价格的范围，以及“适合”“常见对象”的非唯一性质。没有新增高风险事实；模拟标注、既有待补充缺口和 luckye.online 邮箱不变。生成提示、运行时核对、图片与许可文件未改。

`tests/t190-materials-contract.test.ts` 新增五类源资料合同：地点角色、起订事项归属、产出与设备类别、认证与报告类别、多材料指标的试样条件。通用断言不以现有地名、公司名、金额或改后整句作答案；这不是自然语言语义或真实生成效果的完备检查。grep 后同步 `tests/simulated-packs.test.ts` 的产能/设备字段，`tests/t157-non-industrial-cases.test.ts` 的地点/时间分字段检查，以及 `tests/t160-materials.test.ts` 的起订与交期归属检查。`docs/project/spec.md` 同步标签角色说明；既有教育图许可记录补记不改变规格中的图片数量和用途，MAP 复核到本次父提交。

所有命令均在本工作树执行；测试命令统一设置：

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t190-materials-contract.test.ts

npm run typecheck

CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t190-materials-contract.test.ts tests/simulated-packs.test.ts tests/t137-materials.test.ts tests/t157-non-industrial-cases.test.ts tests/t160-materials.test.ts tests/t142-material-inputs.test.ts
```

证据目录 `artifacts/t190/label-followup-20261019/`，命令、CHROME_PATH、UTC 起止时间、退出码和候选关系另存各项 `*-command.json`：

- **先红**：07:50:21–07:50:24 UTC，源资料仍为 `330b133`，仅新增断言；21 项执行，原有 16 通过、新增 5 失败，均为对应语义 AssertionError。日志 `contract-red.log`；入口 `artifacts/t167/test-run-1792396222250-75990/report.json`。
- **最终合同重验父版本**：07:52:56–07:53:02 UTC，修正起订标签匹配以覆盖“起订量确认”等后缀后，再以 `git show 330b133:lib/simulated-packs.ts` 的原始资料运行同一合同，仍为 16 通过、5 个预期失败；日志 `contract-red-final.log`，入口 `artifacts/t167/test-run-1792396378126-91838/report.json`。候选先保存为 `candidate-before-parent-check.ts`，`finally` 恢复，未并行运行其他测试或丢弃失败证据。
- **后绿**：07:59:04–07:59:17 UTC，`npm run typecheck` 退出 0，见 `typecheck-final.log`。07:59:17–07:59:28 UTC，六个相关定向文件 **41/41 PASS、0 跳过**，其中 T-190 合同 21/21，见 `related-final.log`；入口 `artifacts/t167/test-run-1792396758786-60391/report.json`。health 虽为无真实模型的 503，`testIdentity.cwd` 和独立临时 dataRoot 已核对；所有用例完成。

本次未跑全量、独立 runner 回归或 build，未调用真实模型、开审查/盲评实例或做生成站截图；未读 `.env.local`、写主工作区数据、改主工作区 artifacts 或推送。保留原有 `tsconfig.json` 自动改动并排除提交。此处 PASS 仅指获授权的资料消歧、审计与定向门控；真实生成是否仍把服务社区写成地址，需要后续由主控另行安排验证。

**补改窄复审与更正（主控，2026-10-19 EDT）。** 独立窄复审 NO_GO，见主工作区 `artifacts/t190/review2.txt`：P0、P1、P3 均无，P2 两项，主控在本分支更正。

1. 拆分产能行时把能力口径写成了“模具年产量”。资料只给生产能力，没有实际产出记录，已改回“模具年产能：约 180 套”。
2. 审计漏掉了设计资料：“地址与开放时间”的值只给工作时间，标签暗示对外开放，与餐馆“地址＋服务社区”属同类歧义。已改为“地址与工作时间”，原时段与“来访接待条件待补充”保留，不补造开放时段。

`artifacts/t190/label-audit.md` 已更正对应两行的判断。`tests/t190-materials-contract.test.ts` 新增两条通用断言：资料中不得出现“产量”类标签；“开放时间”标签的值须明确给出开放或营业时段。这两条在 `4df23f9` 上 2 项失败（`artifacts/t190/review2-fix-red.log`），更正后通过。`tests/simulated-packs.test.ts` 与 `tests/t157-non-industrial-cases.test.ts` 只同步字段名，仍要求实际时段和缺口存在。定向门控 37/37 + 6/6（`review2-fix-green.log`），typecheck 退出 0（`review2-fix-typecheck.log`）。

### T-159 本地替身图片上传回归修复（2026-10-19）

**本次回归修复 PASS；整票仍 INCOMPLETE、open。** 执行者 `codex-t190-t159-fixture`，工作树 `/Users/luckye/Documents/Code/sitecraft-ai-t190fix`，分支 `t190-t159-fixture`，基于 `8602b37`。修复与本节在同一个本地提交中；对应 SHA 可用 `git log -1 --format=%H -- tests/fixtures/t159-entry.ts` 定位。门控后没有再改替身或测试代码，仅补写本节。新基线及合并后主线验收仍由主控安排，不勾选剩余 Acceptance。

原因：T-190 为餐馆、教育、设计分别新增 3／2／2 张图片后，标准评估 CLI 会先上传图片。`tests/fixtures/t159-entry.ts` 只识别 chat、draft、history，且把所有正文当作 JSON。图片请求因此在 confirm-gate 的确认拦截中触发 multipart JSON 解析错误，在另外三个文件中触发空路由匹配的 TypeError，尚未到达原有准入断言。

修复只改该替身：导入生产 `app/api/sites/[siteId]/images/route.ts` 的 POST 处理函数，将 `/api/sites/:id/images` 接到它；HTTP 正文用 Buffer 收集，原样转发字节和 content-type（含 multipart boundary）。仅 application/json 正文参与 JSON 解析及确认拦截；非 JSON 请求记录 `body: null`、原 content-type 和正文长度，不记录二进制正文。图片经生产校验、许可登记及隔离存储，未伪造上传成功；沿用 T-187 经生产路径注册夹具图片的原则。没有修改评估 CLI、产品代码、图片或任何测试断言，也无需同步路由数或上传数期望。

以下命令均在本工作树运行，测试统一使用指定 Chrome；日志均保留 UTC 起止时间、命令、候选关系及退出码：

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t159-confirm-gate.test.ts tests/t159-eval-entry.test.ts tests/t159-http-diagnostics.test.ts tests/t159-ready-style.test.ts

npm run typecheck

CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t159-confirm-gate.test.ts tests/t159-eval-entry.test.ts tests/t159-http-diagnostics.test.ts tests/t159-ready-style.test.ts tests/t159-task-admission.test.ts tests/t137-eval-images.test.ts tests/t190-materials-contract.test.ts
```

- **先红**：09:50:17–09:50:29 UTC，未改动的 `8602b37` 执行四个文件，9 项中 5 通过、4 项按上述原因失败，退出 1。日志 `artifacts/t190/t159-red.log`；入口报告 `artifacts/t167/test-run-1792403418358-48374/report.json`，失败数据根仍保留。
- **typecheck**：09:52:09–09:52:18 UTC，退出 0，日志 `artifacts/t190/t159-typecheck.log`。
- **后绿**：09:52:18–09:52:57 UTC，七个指定文件 **46/46 PASS、0 跳过**，退出 0；其中原四文件 9/9、任务准入 13/13、评估图片 1/1、资料合同 23/23。日志 `artifacts/t190/t159-green.log`；入口报告 `artifacts/t167/test-run-1792403538911-67133/report.json`。入口核对的 cwd 为本工作树，独立临时 dataRoot 为 `/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-test-7TYA6u`，health 503 未被误写为真实模型已配置。
- **生产上传观察**：`artifacts/t159/ready-entry-5769dc16-681f-4dd0-9db1-97018da8b762/entry.json` 记录餐馆三张图全部返回 201，保留 multipart content-type，body 均为 null；隔离数据根中可读到三份生产图片登记记录。`t137-eval-images` 仍覆盖七家公司两种风格的全部登记图片，包含新增的 3／2／2 张。

本次只验证本地替身与生产 handler 的接线、既有准入和资料合同，不证明实际 Next after 集成、真实模型行为或页面质量。未跑全量、独立 runner 回归或 build，未开审查实例、调用真实模型、读取 `.env.local`、写主工作区数据或 artifacts，也未推送。Next 自动修改的 `tsconfig.json` 保留在工作树且排除提交。`git diff --check`、UTF-8／LF／无 BOM／无替换字符检查通过；`project_map.py status --root .` 无问题、无 stale living docs。

### 主控：合并与主线验证

本票随 T-191 分支合入主线（`79f8a91`）。独立审查记录：第一步 review1 GO；补改 review2 NO_GO，主控更正后 review3 GO；t159 替身修复 review4 GO。

**主线验证（执行主控，2026-10-19 EDT）。** 共跑了两轮，按标准检查命令依次运行 runner → `npm test` → `SITE_STORE=fs npm run build` → `npm run typecheck`，期间没有其他重活。

- 第一轮在本地合并 `8602b37` 上（T-188 合并 `80c6ae7`，T-191 连同 T-190 合并 `79f8a91`），05:26:47–05:43:04：runner、build、typecheck 均退出 0；全量非浏览器 146/146，浏览器 **799/804，失败 5 项**，见 `artifacts/t191/main-verify.out` 与 `artifacts/t191/main-verify/`。
  - 4 项 t159 失败是 T-190 带进来的回归：评估 CLI 新增的图片上传请求没有被 t159 本地替身路由。已在 `c276f1b` 改为由替身调用生产图片上传处理函数，独立复审 GO，见 `artifacts/t190/review4-t159.txt`。
  - 1 项是 `tests/t179-composer-scroll.test.ts` 的 375 档，属于既有问题：执行主控单独复跑，在当前主线、`80c6ae7`、`b7393fc`、`dc09cb2` 四个提交上都失败，而 `dc09cb2` 在同日 02:26–02:51 的验证中是通过的。日志见 `artifacts/t191/diag-t179-*.log`。为此开了 T-193，查明是产品缺陷（高目标按中心定位，没有约束底边）并修复，独立审查 GO。
- 第二轮在合并上述两项修复后的 `dcf60e1` 上（t159 修复合并 `92116e5`，T-193 合并 `dcf60e1`），06:08:08–06:25:22：runner、build、typecheck 均退出 0；全量非浏览器 **146/146**，浏览器 **806/806**，无失败、取消或跳过，T-179 也在内。见 `artifacts/t193/main-verify.out` 与 `artifacts/t193/main-verify/`。

第一轮并非全部通过；这里只认第二轮的结果。

工作树证据复制到 `artifacts/t190/worktree-evidence/`、`worktree-t167/`，t159 修复的证据复制到 `artifacts/t190/worktree-evidence-t159fix/`、`worktree-t167-t159fix/`。票保持 open：第 2 项「新基线」尚未运行。

### 新基线执行前阻塞（2026-10-19 UTC，codex-t190-baseline）

**本次 BLOCKED；整票仍 INCOMPLETE、open。** 工作树 `/Users/luckye/Documents/Code/sitecraft-ai-t190b`，分支 `t190-baseline`，候选提交 `64090c4558488a84639e481f5892027f1a711a19`，已包含本票新资料、T-188、T-191、T-193。本节与 claimed_by 在同一个本地提交中；可用 `git log -1 --format=%H -- .project-map/tickets/T-190-simulated-packs-rewrite.md` 定位。没有改代码、提示或资料，没有勾选新基线验收项。

#### 已完成的门控

下列命令均在本工作树、上述候选上执行，日志及命令、起止时间、退出码记录在 `artifacts/t190/baseline-control/`：

| 命令 | UTC 起止时间 | 结果与证据 |
| --- | --- | --- |
| `npm run typecheck` | 10:30:15.740–10:30:24.104 | 退出 0；`typecheck.log`、`typecheck-command.json` |
| `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t190-materials-contract.test.ts` | 10:30:24.105–10:30:28.524 | 23/23 通过，0 失败、取消或跳过，退出 0；`materials-contract.log`、`materials-contract-command.json`；标准入口报告在 `artifacts/t167/test-run-1792405824630-16686/report.json` |

未运行全量、runner 或 build。Next 自动修改的 `tsconfig.json` 留在工作树且不提交。

#### 阻塞根因与可复核证据

`scripts/eval-new-route.ts:157–158` 在访问 health 或创建站点之前调用 `compareRounds`；`scripts/eval-set-report.ts:108–112` 要求同组合的 `materials` 逐字相同，否则抛出原文：

> 评估资料或组合已变化，不能把两轮当成成对比较。

这与本次获授权的「新资料对 T-180 旧资料」比较冲突。只读预检直接执行原评估入口的资料组装段，再调用生产 `compareRounds`，不进入入口的存盘、HTTP、浏览器或模型路径：

```sh
node --experimental-strip-types artifacts/t190/baseline-control/comparison-preflight.mjs
```

2026-10-19 10:31:19.295 UTC，第一轮 14/14、第二轮 6/6 组合键均与指定 T-180 轮次对应，资料则 **20/20 不相同**；两轮均得到上述原始错误。新资料长度分别为工业 2917、外贸 2948、注塑 3492、纸包装 2748、餐馆 2118、教育 2356、设计 2476，未触及 4000 字限制。逐组合长度、对应关系及原始错误在 `comparison-preflight.json`，命令输出在 `comparison-preflight.log`。首次辅助预检漏传 `MATERIALS_CHAT_LIMIT`，在比较函数之前报 ReferenceError；失败记录保存在 `preflight-first-attempt.json`，未把它当作产品失败或正式评估轮次。

按负责人「若评估中发现需要改代码，停下报我」的范围限制停止。没有删除 `--previous`、改写旧基线材料、绕过比较门禁或换路径执行生成。需要主控先修正跨资料比较入口的合同，再安排后续执行；本次没有修复授权。

#### 两轮状态、用量与交接包

以下是获授权但**尚未执行**的命令，不是本次评估实测记录。预留的随机应用地址为 `http://127.0.0.1:60741`，本地网关地址为 `http://127.0.0.1:60742`，二者均未启动；数据根预留为本工作树 `artifacts/t190/eval-data`，新账本预留为 `artifacts/t174/t190-baseline/usage.json`，均未创建。两轮共用的授权上限为 3000000 token，本次没有读取 `.env.local` 或初始化网关。

```sh
SITECRAFT_BASE=http://127.0.0.1:60741 SITECRAFT_TOKEN_LIMIT=3000000 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm run eval:new-route -- --previous /Users/luckye/Documents/Code/sitecraft-ai/artifacts/t180-r2/round1-full --out artifacts/t190/round1-full

SITECRAFT_BASE=http://127.0.0.1:60741 SITECRAFT_TOKEN_LIMIT=3000000 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm run eval:new-route -- --only education/editorial,design/editorial,restaurant/editorial,restaurant/neighborly,education/neighborly,design/neighborly --previous /Users/luckye/Documents/Code/sitecraft-ai/artifacts/t180-r2/round2-selected --out artifacts/t190/round2-selected
```

第一轮 14 个组合与第二轮 6 个组合均未运行；没有评估起止时间、逐站 outcome、站点 ID 或版本 ID。模型调用与用量均为 0；没有模型事实拒因、提交检查拒因或失败站终止原文，不能把执行前的比较错误当成这些数据。没有后台 run 或网关在途请求，也没有需要停止的 dev／网关进程；health、run 终态与端口关闭验收未执行，不声称通过。

仅检查以下目录及各轮 `private/blind-coverage.json` 是否存在，没有读取任何盲评包内容：

| 预期路径 | 齐全性 |
| --- | --- |
| `artifacts/t190/round1-full/review/mixed/` | 不存在，未生成 |
| `artifacts/t190/round1-full/review/company/` | 不存在，未生成 |
| `artifacts/t190/round1-full/comparison-review/` | 不存在，未生成 |
| `artifacts/t190/round2-selected/review/mixed/` | 不存在，未生成 |
| `artifacts/t190/round2-selected/review/company/` | 不存在，未生成 |
| `artifacts/t190/round2-selected/comparison-review/` | 不存在，未生成 |

两份覆盖文件同样不存在，存在性检查记录在 `artifacts/t190/baseline-control/not-started.json`。没有固定口径缺口计数、新旧审美结论或技术生成通过结论；独立审查及盲评均未启动。未写主工作区 `.sitecraft-data` 或 artifacts，未推送。

### 显式跨资料比较开关与定向门控（2026-10-19 UTC）

**本次开关实现与定向门控 PASS；整票仍 INCOMPLETE、open。** 执行者 `codex-t190-baseline`，分支 `t190-baseline`，基于 `65a96df811c979ecd91ab06c0723fbf449f0fc9d`。评估脚本、测试、规格同步和本节在同一个本地提交中；对应 SHA 可用 `git log -1 --format=%H -- scripts/eval-new-route.ts` 定位。最终门控后没有再改评估脚本或测试。按主控本次安排，提交后停止，独立窄复审由主控另派；未经复审 GO 及后续通知，不执行真实基线。

#### 比较合同与记录

- 新增 `--previous-materials-changed`，必须同时显式指定 `--previous`。未开时，资料不同仍拒收；开启只豁免 `materials` 的差异，不改变默认矩阵、风格选择、滑杆值或生成输入。
- `compareRounds` 先核对 profile、无重复的组合集合和逐组合的 pack/style 归属，再分别核对实际偏好的 style、layout/density、页面要求，以及已有风格登记的 skill 路径、预览 revision/versionId；任何已知值不同仍拒收，且在访问 health、创建站点或调用模型前停止。组合按 key 对应，不依赖数组顺序；重复、增减或替换组合均拒收。
- 新轮次保存实际使用的偏好、资料末行的页面要求和当前登记元数据，select 直接使用同一份偏好。旧轮次的滑杆不在 round.json 时，只读 `private/case-N/code-site.json`，先核对 siteId，再使用快照中的实际偏好；只将 ENOENT 视为文件未记录，解析、读取和身份错误照常拒收，不重试或补写旧记录。旧页面要求读取资料最后一行，不拿模型最终生成的页数代替用户页面要求。
- 现有 T-180 两轮共 20 个私有站点快照均能按 siteId 对应，实际偏好均为 layout=5、density=6，风格与各组合一致；这是只读记录核对，没有启动评估。两轮 round.json 及站点快照均没有风格登记版本。未来比较这些记录时，`previous.styleRegistration` 将列入逐组合 `unverifiedFields`，不猜测旧登记版本。当前登记只提供 skill 路径与预览 revision/versionId，没有独立的 skill 正文版本号；预览版本不证明风格正文版本一致。其他缺失条件同样逐项登记，包括缺 profile 或登记对象中缺少的版本子字段；旧 profile 缺失时保留原有 full 默认档位检查，同时注明未显式记录。
- 比较通过后在当前私有 `round.json` 的 `comparison` 数组和 `private/comparison.json` 按 key 保存实际 `materialsChanged`、`currentMaterials`／`previousMaterials` 的 length 和 source。来源指向各自轮次 `private/round.json#/cases/N/materials`；数组重排后仍指向实际下标。资料相同的组合写 false，不冒充变化。`round.json` 另存本次显式开关值；核对阶段和最终输出共用同一个比较函数。旧轮次文件不改写。
- comparison 盲评提示、盲评包生成代码、产品代码、生成提示与公司资料均未修改；新增元数据只进入私有记录，不将资料全文或来源标记放进盲评包。`docs/project/spec.md` 仅同步上述评估合同。

**comparison 比的是『新资料 + T-188/T-191 改动』对『旧资料 + 旧代码』的整体效果，分不出资料与代码各自的贡献。** 本次实现不提供这种归因，也没有审美结论。

#### 先红后绿与最终门控

证据在本工作树 `artifacts/t190/materials-switch/`；每条执行记录均有 UTC 起止时间、完整命令、退出码与父提交。测试统一设置下列 Chrome，标准入口仍自建隔离 dev、数据根和 `.next-test`，health 的 503 只表示没有真实模型，不作为模型已配置的证据：

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t190-previous-materials.test.ts

npm run typecheck

CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t130-blind-privacy.test.ts tests/t130-eval-set.test.ts tests/t133-eval-evidence.test.ts tests/t133-floor-checks.test.ts tests/t137-eval-images.test.ts tests/t140-review-materials.test.ts tests/t142-material-inputs.test.ts tests/t147-code-quality.test.ts tests/t157-non-industrial-cases.test.ts tests/t160-narrow-columns.test.ts tests/t190-materials-contract.test.ts tests/t190-previous-materials.test.ts
```

新测试的预期来自主控本次合同，用固定的两组合、偏好和登记版本做对照。纯比较用例逐项在新旧两侧变更条件；同时检查资料相同与不同的情况，防止拒收只是被资料差异掩盖。CLI 用例通过真实评估入口读取旧私有快照，资料变化且其余一致时到达本地 health；health 明确 503，在生成前停止，仍检查 round/comparison 的持久化记录。不开开关和改动旧快照滑杆的对照均在 health 前拒收，没有站点、模型或外部截图请求。这些用例证明比较门禁和记录接线，不证明真实生成、页面质量或模型效果。

- **65a96df 先红**：10:36:36.028–10:36:44.561 UTC，只新增测试，评估脚本仍为父版本；17 项中 3 通过、14 失败，退出 1。正例在原资料门禁被拒，CLI 原文为 `Unknown option '--previous-materials-changed'`；其他失败包含 style、滑杆、登记信息与重复组合未被独立拦截，以及缺少比较元数据。profile 用例原有拒收仍成立，红灯只因缺少逐项字段拒因，不冒称父版本会放过 profile。日志 `contract-red.log`、`contract-red-command.json`，入口报告 `artifacts/t167/test-run-1792406196822-65468/report.json`。
- 初次新合同转绿及首轮相关门控保存在 `contract-green-attempt1.log`、`related-final.log`。补查部分元数据时，缺 versionId 被当成不一致而没有列为未知，10:40:46.109–10:40:51.464 UTC 为 16 通过、1 失败，退出 1；证据 `partial-metadata-red.log`、`partial-metadata-red-command.json`，入口 `artifacts/t167/test-run-1792406446953-90318/report.json`。修正为逐字段核对并明确列出缺失项，失败记录与临时数据根保留。
- **最终同组新合同**：10:41:01.142–10:41:05.932 UTC，17/17 通过，0 失败、取消或跳过，退出 0；`contract-green-final.log`、`contract-green-final-command.json`，入口 `artifacts/t167/test-run-1792406461949-93242/report.json`。
- **最终 typecheck**：10:41:05.947–10:41:09.262 UTC，退出 0；`typecheck-frozen.log`、`typecheck-frozen-command.json`。
- **最终相关门控**：10:41:09.281–10:41:46.143 UTC，12 个文件 **94/94 通过**（非浏览器 24、浏览器池 70），0 失败、取消或跳过，退出 0；`related-frozen.log`、`related-frozen-command.json`，入口 `artifacts/t167/test-run-1792406469999-94598/report.json`。其中资料合同 23/23，新比较合同 17/17。`rg -l 'compareRounds|eval-set-report' tests --glob '*.ts'` 找到的全部 9 个既有引用文件均已包含；额外覆盖真实 CLI 的图片上传与资料输入两处调用者。完整检索和选中清单在 `related-test-selection.json`，未改既有断言。

本次未运行全量、runner 或 build，未读取密钥或调用真实模型，未执行新基线、开审查／盲评实例或读真实盲评包内容。未写主工作区数据或 artifacts，未推送；`tsconfig.json` 的既有 Next 自动改动保留且不提交。票仍 open，基线验收保持未勾选。

### 新基线首次实跑（2026-10-19 UTC，codex-t190-baseline-run）

**本次 BLOCKED；整票仍 INCOMPLETE、open。** 工作树 `/Users/luckye/Documents/Code/sitecraft-ai-t190b`，分支 `t190-baseline`，实跑提交 `556a73f15285c9f8ee0bf8f7cc64aae859701e89`。按负责人本次授权执行；没有修改代码、提示或资料。第一轮只执行一次，首次规划调用上游失败，余下组合未运行；没有重跑失败站、重置账本或启动第二轮。本节与认领字段一同本地提交，交接提交可用 `git log -1 --format=%H -- .project-map/tickets/T-190-simulated-packs-rewrite.md` 定位。

#### 本次门控、隔离与命令

证据目录为本工作树 `artifacts/t190/baseline-run-control/`。两项门控针对上述提交串行运行；各自 `*-command.json` 保存命令、提交、UTC 起止时间和退出码，日志为同名 `.log`：

| 命令 | UTC 起止时间 | 结果 |
| --- | --- | --- |
| `npm run typecheck` | 10:57:20.870–10:57:22.866 | 退出 0 |
| `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t190-materials-contract.test.ts` | 10:57:22.867–10:57:25.424 | 23/23 通过，0 失败、取消或跳过，退出 0 |

标准测试入口报告为 `artifacts/t167/test-run-1792407443367-98657/report.json`，测试临时数据根为 `/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-test-ZelwRF`。没有运行全量、runner 或 build。

普通 dev 使用随机地址 `http://127.0.0.1:52854`、`SITE_STORE=fs`，数据根显式为 `/Users/luckye/Documents/Code/sitecraft-ai-t190b/artifacts/t190/eval-data`；网关地址为 `http://127.0.0.1:52855`。应用仅持 `local-budget-gateway` 占位凭据，模型地址指向该网关，未加载主工作区环境文件。真实密钥只在网关子进程中通过 `set -a; source /Users/luckye/Documents/Code/sitecraft-ai/.env.local >/dev/null 2>&1; set +a` 载入；未读取、打印或复制密钥内容。网关运行 `node --experimental-strip-types scripts/t153-real-budget.ts`，显式 `SITECRAFT_TOKEN_LIMIT=3000000`、`T153_BUDGET_DIR=artifacts/t174/t190-baseline`，没有使用 `--resume`。账本是本次新建，原先不存在。

10:57:56.682 UTC，health HTTP 200，`testIdentity.cwd`、`dataRoot` 均精确匹配上述工作树与数据根，模型为已配置的 `deepseek-flash`，写页／事实／修正思考模式分别为 enabled／enabled／disabled，存储为 development-file；网关初始 spent=0、calls=[]、stopped=false、limit=3000000。见 `services.json`、`health-initial.json`。为第一轮登记网关标签 `default`，estimate=1307632，取自指定 T-180 第一轮上游报告的用量合计；标签只用于预算账本，没有改变各站 layout=5、density=6。两轮原计划共用这一本账本，第二轮没有登记或调用。

**第一轮实际执行的命令：**

```sh
SITECRAFT_BASE=http://127.0.0.1:52854 SITECRAFT_TOKEN_LIMIT=3000000 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm run eval:new-route -- --previous /Users/luckye/Documents/Code/sitecraft-ai/artifacts/t180-r2/round1-full --previous-materials-changed --out artifacts/t190/round1-full
```

10:58:11.788–10:58:53.547 UTC，评估器退出 1，轮次为 **BLOCKED**；见 `round1-command.json`、`round1-eval.log` 和 `artifacts/t190/round1-full/private/round.json`。首次规划在 10:58:14.754 UTC 进入网关，应用记录该调用耗时 10585ms。工业站八张图片均经原入口上传后，规划即失败，未进入确认、写页或提交检查。

**第二轮原授权命令，未执行：**

```sh
SITECRAFT_BASE=http://127.0.0.1:52854 SITECRAFT_TOKEN_LIMIT=3000000 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm run eval:new-route -- --only education/editorial,design/editorial,restaurant/editorial,restaurant/neighborly,education/neighborly,design/neighborly --previous /Users/luckye/Documents/Code/sitecraft-ai/artifacts/t180-r2/round2-selected --previous-materials-changed --out artifacts/t190/round2-selected
```

第二轮没有起止时间、评估器退出码或轮次文件。首次上游失败后网关已 stopped=true，且用量未知；原网关不接受后续调用，新进程也不允许恢复这笔未知用量，因此停止，没有绕过网关或换账本继续。需负责人恢复网关进程到 `api.deepseek.com` 的连通性，再另行安排后续执行；本次没有诊断或修改网络、代理、VPN、DNS 等系统配置。

#### 逐站结果与用量

下表 `—` 表示未创建。第一轮为 0 generated、1 blocked、13 not-run；第二轮六站全部未运行。没有版本 ID，没有成功生成站，不能作为新基线完成。

| 轮次 | 组合 | outcome | 站点 ID | 版本 ID | 模型调用／用量 |
| --- | --- | --- | --- | --- | --- |
| 1 | industrial/precision | blocked | `035968dd-2e20-438f-87d5-670de1ac9f15` | — | 1 次规划，用量未知 |
| 1 | industrial/documentary | not-run | — | — | 未调用 |
| 1 | export/precision | not-run | — | — | 未调用 |
| 1 | export/documentary | not-run | — | — | 未调用 |
| 1 | molding/precision | not-run | — | — | 未调用 |
| 1 | molding/documentary | not-run | — | — | 未调用 |
| 1 | packaging/precision | not-run | — | — | 未调用 |
| 1 | packaging/documentary | not-run | — | — | 未调用 |
| 1 | restaurant/precision | not-run | — | — | 未调用 |
| 1 | restaurant/documentary | not-run | — | — | 未调用 |
| 1 | education/precision | not-run | — | — | 未调用 |
| 1 | education/documentary | not-run | — | — | 未调用 |
| 1 | design/precision | not-run | — | — | 未调用 |
| 1 | design/documentary | not-run | — | — | 未调用 |
| 2 | education/editorial | not-run | — | — | 未调用 |
| 2 | design/editorial | not-run | — | — | 未调用 |
| 2 | restaurant/editorial | not-run | — | — | 未调用 |
| 2 | restaurant/neighborly | not-run | — | — | 未调用 |
| 2 | education/neighborly | not-run | — | — | 未调用 |
| 2 | design/neighborly | not-run | — | — | 未调用 |

新账本 `artifacts/t174/t190-baseline/usage.json`：limit=3000000、spent=0、stopped=true，共 1 次调用，state=failed、purpose=submit_page_plan、error=`fetch failed`，没有上游 usage 或 HTTP 状态。该次保守输入预留 27182、输出上限 65536、合计预留 92718 token；预留不是实际消耗。应用收到的是网关 HTTP 502，调用 usage=null；**账本 spent=0 仅表示未收到可记账用量，不证明实际用量或计费为零**。其余 19 组合均无调用。逐站汇总在 `baseline-result.json`，失败站原始任务及调用记录在 `artifacts/t190/round1-full/private/case-1/code-site.json`，没有以最终存版覆盖失败记录。

#### 全部拒因、终止原文与停服确认

本次没有模型事实拒因、出处拒因或提交检查拒因：首次规划失败，事实调用为 0、generate attempts 为 0，未运行提交检查。此处是未到达相应阶段，不是事实或提交检查通过。

失败站的应用终止原文为：

> DeepSeek 请求失败（HTTP 502），本次未保存版本。

应用保存的 HTTP 错误正文为 `{"error":{"message":"fetch failed"}}`，requestIdHeader 与 requestId 均为 null；网关原始失败原文为 `fetch failed`。第一轮 `round.errors` 还完整保留以下真实官网对照采集失败，没有重拍或改截图工具：

> 对照 restaurant/1：AssertionError [ERR_ASSERTION]: 页面入场或转场未结束，本次未保存截图

10:59:28.792 UTC，在评估器结束后重新 GET 实际 `/api/sites/035968dd-2e20-438f-87d5-670de1ac9f15/draft`，HTTP 200；唯一 run `bc793894-7f2b-4050-9739-db2be5c0818e` 为 plan/error，step 为上述终止原文，issues=[]，currentVersionId=null、versions=[]。同次 GET 网关 `/status`，确认 in-flight=0、stopped=true；见 `terminal-before-stop.json` 与 `terminal-draft-035968dd-2e20-438f-87d5-670de1ac9f15.json`。这不是只根据评估器退出判断后台已完成。

核对后才在 10:59:36.868 UTC 手动对网关 PID 99335 和 dev 进程组 PID 99336 发送 SIGINT，10:59:37.135 UTC 确认 52854／52855 两端口均已关闭；见 `shutdown.json`。没有后台 running run、网关在途请求或遗留监听端口。

#### 六包齐全性与跨资料比较记录

只读取第一轮 `private/blind-coverage.json` 和检查目录存在性；没有读取任何 `review/` 或 `comparison-review/` 的包内容，也没有启动审查或盲评实例。

| 预期路径（相对本工作树） | 存在性与齐全性 |
| --- | --- |
| `artifacts/t190/round1-full/review/mixed/` | 目录存在；不齐全，生成站截图为 0 |
| `artifacts/t190/round1-full/review/company/` | 目录存在；不齐全，company=0 |
| `artifacts/t190/round1-full/comparison-review/` | 目录存在；不齐全，paired=0，14 项缺图 |
| `artifacts/t190/round2-selected/review/mixed/` | 不存在，未运行 |
| `artifacts/t190/round2-selected/review/company/` | 不存在，未运行 |
| `artifacts/t190/round2-selected/comparison-review/` | 不存在，未运行 |

第一轮覆盖记录 complete=false、review.complete=false、comparison.requested=true、comparison.complete=false；mixed=13 是覆盖记录中的包计数，不是成功生成站数。review.missing 共 57 项，comparison.missing 共 14 项，完整原文保留在上述覆盖文件。第二轮覆盖文件不存在。

第一轮 `private/round.json` 记录本次开关开启；其 comparison 数组与 `private/comparison.json` 中，14/14 组合 `materialsChanged=true`，每项均保存 currentMaterials／previousMaterials 的 length、各自 round.json 的精确 source 路径，`unverifiedFields` 均为 `["previous.styleRegistration"]`。没有伪造旧风格登记版本；14 项 visualPairAvailable 均为 false。第二轮没有 comparison 记录，不能借第一轮推断为已执行比较。摘要见 `baseline-result.json`，原记录保留不改。

comparison 的对象仍是「新资料 + T-188/T-191 等当前代码」对「旧资料 + 旧代码」的整体效果，不能归因各自贡献。本次没有成对审美结果、company 质量结论或固定口径缺口计数；没有新生成站可供统计，未把零存版写成缺口下降。新基线验收保持未勾选，未复制主数据。未推送，未写主工作区 `.sitecraft-data` 或 artifacts；既有 `tsconfig.json` 自动改动保留且排除提交。

### 主控：开关合并与第一次基线因网络中断失败

评估器开关 `--previous-materials-changed`（`556a73f`）经独立窄复审 GO，见 `artifacts/t190/review5-switch.txt`。合并后主线验证在 `f5c5762` 上运行（T-192 合并 `a809d62`；T-190 基线分支合并 `f5c5762`，含评估器开关 `556a73f` 与网络中断记录 `bd2009b`），时间 2026-10-19 07:03:12–07:19:58 EDT，期间没有其他重活。runner、build、typecheck 均退出 0；全量非浏览器 146/146、浏览器 837/837，无失败、取消或跳过。见 `artifacts/t192/main-verify.out` 与 `artifacts/t192/main-verify/`。

**第一次基线运行失败（网络中断），记录原样保留。** 2026-10-19 约 07:00 EDT，第一轮首次规划调用上游时报 `fetch failed`，原因是本机连不上 `api.deepseek.com`；执行主控 07:02 EDT 用 curl 复测，15 秒连接超时，github.com 返回 200。网关随即停止，账本 `artifacts/t174/t190-baseline/usage.json` 为 stopped=true，只有 1 次调用。该次调用预留了 92,718 token，没有上游 usage 或 HTTP 状态，**实际用量和是否计费都未知**；账本 spent=0 不代表没有消耗。其余 19 个组合没有运行，第二轮没有启动，也没有生成任何页面或版本。旧账本和失败记录原样保留，执行记录见上文 `bd2009b` 一节，工作树证据复制到 `artifacts/t190/baseline-r1-blocked/worktree-evidence/`。

**重跑安排（构思主控决定）。** 网络恢复、并由执行主控用 curl 复测通过后，新开账本 `artifacts/t174/t190-baseline-r2`，额度 3,000,000，第一轮和第二轮都从头跑。上一次没有生成出任何页面，所以重跑不是在掩盖失败；如果再次断开，就停下报告，不反复重试。


### 新基线第二次实跑（2026-10-19 UTC，codex-t190-baseline-r2）

**本次 BLOCKED；整票仍 INCOMPLETE、open。** 执行者 `codex-t190-baseline-r2`，工作树 `/Users/luckye/Documents/Code/sitecraft-ai-t190b`，分支 `t190-baseline`，实跑提交 `62560f612129bed5e2b2233a1a405fc89d0a096b`，包含已合并的新资料、T-188/T-191/T-192/T-193 与获 GO 的显式跨资料比较开关。第一轮仅执行一次，在设计 precision 的事实调用读取上游响应时中断；网关随即停止，未重跑失败站，未启动第二轮。没有改代码、提示或资料，没有启动审查／盲评实例。本节与认领字段在同一个本地交接提交中，SHA 由本次交接回报；新基线验收不勾选、不关票。

#### 门控与运行隔离

证据全部位于本工作树的新目录 `artifacts/t190/r2/`，控制记录在 `control/`。旧账本 `artifacts/t174/t190-baseline/`、旧输出目录与第一次失败记录均原样保留，没有覆盖、删除或恢复旧账本。

| 命令 | UTC 起止时间（2026-10-19） | 结果与证据 |
| --- | --- | --- |
| `npm run typecheck` | 11:25:12.014753–11:25:17.968538 | 退出 0；`control/typecheck.log`、`typecheck-command.json` |
| `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t190-materials-contract.test.ts` | 11:25:17.969256–11:25:20.478893 | 23/23 通过，0 失败、取消或跳过，退出 0；`control/materials-contract.log`、`materials-contract-command.json` |

标准入口报告 `artifacts/t167/test-run-1792409118472-51279/report.json`，测试数据根 `/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-test-6BxDRk`。按授权没有运行全量、runner 或 build。

普通 dev 使用随机地址 `http://127.0.0.1:63467`、`SITE_STORE=fs`，数据根精确为 `/Users/luckye/Documents/Code/sitecraft-ai-t190b/artifacts/t190/r2/eval-data`；预算网关地址为 `http://127.0.0.1:63468`。应用仅持 `local-budget-gateway` 占位凭据，模型地址只指向该网关；本工作树没有 `.env`、`.env.local`、`.env.development` 或 `.env.development.local`。真实密钥只在网关子进程中由 `set -a; source /Users/luckye/Documents/Code/sitecraft-ai/.env.local >/dev/null 2>&1; set +a` 载入，未读取、打印或复制密钥内容，未进入应用、文件、日志、提交或 prompt。网关运行 `node --experimental-strip-types scripts/t153-real-budget.ts`，显式 `SITECRAFT_TOKEN_LIMIT=3000000`、`T153_BUDGET_DIR=artifacts/t174/t190-baseline-r2`；该目录原先不存在，没有使用 `--resume`，两轮原计划共用这一本新账本。

11:25:51.353011 UTC，health HTTP 200，`testIdentity.cwd`／`dataRoot` 精确匹配本工作树与上述根，模型为 configured=true 的 `deepseek-flash`，write／facts／repair 思考模式为 enabled／enabled／disabled，存储为 development-file；初始账本 limit=3000000、spent=0、stopped=false、rounds=[]、calls=[]。见 `control/services.json` 与 `health-initial.json`。第一轮登记网关标签 `default`、estimate=1307632，取自指定 T-180 第一轮上游报告的用量合计；仅用于预算登记，不改变 layout=5、density=6。第二轮没有登记标签或调用。

#### 两轮命令与时间

第一轮实际执行：

```sh
SITECRAFT_BASE=http://127.0.0.1:63467 SITECRAFT_TOKEN_LIMIT=3000000 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm run eval:new-route -- --previous /Users/luckye/Documents/Code/sitecraft-ai/artifacts/t180-r2/round1-full --previous-materials-changed --out artifacts/t190/r2/round1-full
```

第一轮 11:26:02.253517–12:12:19.609721 UTC（07:26:02–08:12:19 EDT），评估器退出 1，轮次 **BLOCKED**；命令、提交、进程与起止时间保存在 `control/round1-command.json`，日志 `round1-eval.log`，轮次原记录 `artifacts/t190/r2/round1-full/private/round.json`。评估器退出后另行核对实际 draft 和网关，才执行停服，详见下文。

第二轮原授权命令，**未执行**：

```sh
SITECRAFT_BASE=http://127.0.0.1:63467 SITECRAFT_TOKEN_LIMIT=3000000 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm run eval:new-route -- --only education/editorial,design/editorial,restaurant/editorial,restaurant/neighborly,education/neighborly,design/neighborly --previous /Users/luckye/Documents/Code/sitecraft-ai/artifacts/t180-r2/round2-selected --previous-materials-changed --out artifacts/t190/r2/round2-selected
```

第二轮没有起止时间、退出码、轮次目录或模型调用。第一次上游响应中断后即停止，不另建账本或恢复停止账本继续；需要负责人确认网关到上游的响应可完整返回，并另行安排后续执行。本次没有再次探测或修改网络、代理、VPN、DNS 等配置。

#### 逐站 outcome、站点／版本与用量

以下 token 是收到的上游报告；设计 precision 的数值仅含已知两次调用，另一次未知。`—` 表示未创建。第一轮为 **9 generated、2 error、1 rejected、1 blocked、1 not-run**；generated 仅表示技术生成及截图完成，不是审美结论。第二轮六组合均 not-run。

| 轮次 | 组合 | outcome | 站点 ID | 版本 ID | 调用数／未知 | 输入／输出／合计 token |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | industrial/precision | error | `b874a6db-0b78-47d1-9bac-53b755d4cc82` | — | 1／0 | 9661／2714／12375 |
| 1 | industrial/documentary | generated | `50f563f6-bdba-44fe-934a-43b1ae266a00` | `ab9bf158-a646-4898-b4d8-4e1805610ad0` | 5／0 | 52541／49163／101704 |
| 1 | export/precision | generated | `3938dc82-0570-46d0-b846-febef50b3dab` | `4e9e1e40-80ab-4931-8cf6-5b86d8edaad4` | 4／0 | 47461／89550／137011 |
| 1 | export/documentary | generated | `61601e66-9634-4fa1-a173-e5c2c086b782` | `bd53829c-d953-4f2c-953d-7d072108358b` | 3／0 | 34891／57141／92032 |
| 1 | molding/precision | generated | `aaf4ff61-b68d-4161-a3cb-b4a2473baf7e` | `64c1fbe0-f71e-44bf-87d1-2464d0a81bb7` | 5／0 | 69487／56699／126186 |
| 1 | molding/documentary | generated | `bd77156a-35ca-40f1-b899-ae014ac55455` | `7671981b-10d4-43dc-a1ef-c696dac38161` | 4／0 | 73105／61274／134379 |
| 1 | packaging/precision | rejected | `e9439e3b-5ef0-4e39-b53a-1ec1f077352c` | — | 4／0 | 43681／38453／82134 |
| 1 | packaging/documentary | generated | `02058cac-8139-478a-895e-d91a56393cec` | `3cc0de85-b101-4f1a-b6dd-ca72f398f61d` | 4／0 | 52129／77590／129719 |
| 1 | restaurant/precision | generated | `cb04f202-3f43-41cf-bb80-4562505b3dca` | `23dbf8db-c2ed-4ad1-8b44-1ab04b2fe383` | 3／0 | 32054／50865／82919 |
| 1 | restaurant/documentary | error | `25c98617-d0ee-4405-baff-35ab196078d0` | — | 2／0 | 19973／40333／60306 |
| 1 | education/precision | generated | `641e5b8b-2db4-493a-8179-2ce4f5a78cf4` | `89b93b37-4c92-45f3-b37a-78a18c2b712c` | 4／0 | 42620／43737／86357 |
| 1 | education/documentary | generated | `a44ba7c8-9e61-4a46-ad4e-dcf951583159` | `adb5d592-5d60-4c2a-8b87-9aaf6c20154f` | 3／0 | 32000／55499／87499 |
| 1 | design/precision | blocked | `c63838fd-9b02-4e51-b5be-f89a725fa296` | — | 3／1 | 19899／30400／50299 |
| 1 | design/documentary | not-run | — | — | 0／0 | 0／0／0 |
| 2 | education/editorial | not-run | — | — | 0／0 | 0／0／0 |
| 2 | design/editorial | not-run | — | — | 0／0 | 0／0／0 |
| 2 | restaurant/editorial | not-run | — | — | 0／0 | 0／0／0 |
| 2 | restaurant/neighborly | not-run | — | — | 0／0 | 0／0／0 |
| 2 | education/neighborly | not-run | — | — | 0／0 | 0／0／0 |
| 2 | design/neighborly | not-run | — | — | 0／0 | 0／0／0 |

新账本 `artifacts/t174/t190-baseline-r2/usage.json`：limit=3000000、spent=1182920、stopped=true，共 45 次调用，其中 44 次有完整 usage、1 次未知；已知输入 529502、输出 653418、合计 **1182920 token**，与逐站及评估汇总一致。最后一次为第 45 次、purpose=facts、thinking=enabled、inputSegmentCount=26，12:10:45.988 UTC 开始，读取响应时失败，state=failed、error=`terminated`。网关已经收到上游 HTTP 200，但没有完整响应正文或 usage；应用收到网关 HTTP 502。其保守输入预留 35913、输出上限 65536、合计预留 101449 token，**预留不是实际消耗，实际总用量和该次是否计费未知，不能把账本 spent 当作完整总消耗**。网关不重试，也没有对该调用恢复或另发请求。旧账本未知用量同样没有被清零或并入本账本伪作已知。

逐站摘要与完整原文索引在 `control/baseline-result.json`；每站初始候选、全部修正候选、模型调用与原始事实回复保存在 `round1-full/private/case-N/code-site.json`，停服前实际接口快照在 `control/terminal-draft-<siteId>.json`，不是仅根据最终版本反推失败记录。

#### 全部模型事实拒因与提交检查拒因原文

本轮共 10 次模型事实调用。9 次完整回复分别覆盖 18／42／37／65／72／42／36／27／29 个编号（共 368），每条 `results[].issues` 均为空，finish_reason 均为 stop，**没有已返回的模型事实拒因**；完整原始 HTTP 回复仍保留，没有删改。第 10 次是设计 precision，上游响应中断，没有可解析的模型事实回复或拒因；不能将其记为事实通过。工业 precision 在规划阶段失败，纸包装 precision 和餐馆 documentary 在确定性检查阶段终止，未到达模型事实调用；第二轮也未调用事实模型。下面“资料没有的数字”属于提交入口的确定性拒因，不冒充模型拒因。

本轮 11 站留下 21 次完整提交检查，12 次被拒、9 次通过；12 次拒收共 **46 条原文（保留重复项与次序）**，如下全部列出。次数按原始候选为第 1 次、每次修正递增；后续存版没有覆盖早先拒因。另有设计 precision 的检查在事实 HTTP 错误中异常终止，没有完整检查结果，不能计入 21 次或记为通过。

**industrial/documentary，第 1 次检查（2026-10-19T11:28:03.648Z）**

```text
home/375 对比度不足或无法测量：行业配图，非本厂实拍。（3.88，需 4.5）
home/375 对比度不足或无法测量：行业配图，非本厂实拍。（3.38，需 4.5）
home/375 对比度不足或无法测量：行业配图，非本厂实拍。（3.38，需 4.5）
home/768 对比度不足或无法测量：行业配图，非本厂实拍。（3.88，需 4.5）
home/768 对比度不足或无法测量：行业配图，非本厂实拍。（3.38，需 4.5）
home/768 对比度不足或无法测量：行业配图，非本厂实拍。（3.38，需 4.5）
home/1440 对比度不足或无法测量：行业配图，非本厂实拍。（3.88，需 4.5）
home/1440 对比度不足或无法测量：行业配图，非本厂实拍。（3.38，需 4.5）
home/1440 对比度不足或无法测量：行业配图，非本厂实拍。（3.38，需 4.5）
products/375 对比度不足或无法测量：行业配图，非本厂实拍。（3.38，需 4.5）
products/375 对比度不足或无法测量：行业配图，非本厂实拍。（3.38，需 4.5）
products/768 对比度不足或无法测量：行业配图，非本厂实拍。（3.38，需 4.5）
products/768 对比度不足或无法测量：行业配图，非本厂实拍。（3.38，需 4.5）
products/1440 对比度不足或无法测量：行业配图，非本厂实拍。（3.38，需 4.5）
products/1440 对比度不足或无法测量：行业配图，非本厂实拍。（3.38，需 4.5）
```

**industrial/documentary，第 2 次检查（2026-10-19T11:28:07.680Z）**

```text
home/375 对比度不足或无法测量：行业配图，非本厂实拍。（1.38，需 4.5）
home/375 对比度不足或无法测量：行业配图，非本厂实拍。（1.38，需 4.5）
home/768 对比度不足或无法测量：行业配图，非本厂实拍。（1.38，需 4.5）
home/768 对比度不足或无法测量：行业配图，非本厂实拍。（1.38，需 4.5）
home/1440 对比度不足或无法测量：行业配图，非本厂实拍。（1.38，需 4.5）
home/1440 对比度不足或无法测量：行业配图，非本厂实拍。（1.38，需 4.5）
```

**export/precision，第 1 次检查（2026-10-19T11:34:19.437Z）**

```text
products/375 文字重叠
products/768 文字重叠
products/1440 文字重叠
quality/375 文字重叠
```

**molding/precision，第 1 次检查（2026-10-19T11:42:06.055Z）**

```text
products/375 横向溢出
```

**molding/precision，第 2 次检查（2026-10-19T11:42:15.306Z）**

```text
products/375 横向溢出
```

**molding/documentary，第 1 次检查（2026-10-19T11:46:36.837Z）**

```text
products/375 文字重叠
products/768 文字重叠
products/1440 文字重叠
faq/375 文字重叠
faq/768 文字重叠
faq/1440 文字重叠
```

**packaging/precision，第 1 次检查（2026-10-19T11:50:44.794Z）**

```text
products/375 文字重叠
products/768 文字重叠
products/1440 文字重叠
```

**packaging/precision，第 2 次检查（2026-10-19T11:50:49.402Z）**

```text
products/375 文字重叠
products/768 文字重叠
products/1440 文字重叠
```

**packaging/precision，第 3 次检查（2026-10-19T11:50:54.313Z）**

```text
products/375 文字重叠
products/768 文字重叠
products/1440 文字重叠
```

**packaging/documentary，第 1 次检查（2026-10-19T11:53:45.773Z）**

```text
sampling/375 横向溢出
```

**restaurant/documentary，第 1 次检查（2026-10-19T12:01:56.067Z）**

```text
资料没有的数字：0013
资料没有的数字：3020
```

**education/precision，第 1 次检查（2026-10-19T12:03:27.782Z）**

```text
courses/375 横向溢出
```

其余完整检查的 issues=[]；没有省略其他非空提交检查拒因。失败 run 的 issues 再次保留了对应最终拒因，并不另算新一轮检查。

#### 失败站终止原文、上游中断与停服

**industrial/precision**（plan，run `9e1daba1-d1f9-4835-b54f-64061c3861b8`）：

> 页面大纲格式不正确，方案未保存。

**packaging/precision**（generate，run `8648ff44-09b6-43eb-9bc8-1106a4a4a908`）：

> 两轮修正后仍未通过底线检查，未保存版本。请查看完整问题，补充资料或调整要求后重试。

**restaurant/documentary**（generate，run `d57e59f1-95a5-4c3a-ba38-84c0b8f42d77`）：

> 局部修正无法定位底线拒因对应的代码节点，本次未保存版本。

**design/precision**（generate，run `d5be814a-4816-44cd-9c85-cd9a0f7e5c0b`）：

> DeepSeek 请求失败（HTTP 502），本次未保存版本。

设计 precision 保存的应用 HTTP 错误正文为 `{"error":{"message":"terminated"}}`，requestIdHeader 与 requestId 均为 null；网关原始失败为 `terminated`。这是上游已返回 HTTP 200 后响应读取中断的记录，未将其说成已完成事实核对或零消耗，也没有额外重试探测根因。

第一轮 `round.errors` 另保留以下真实官网对照截图失败原文，没有重拍或改变截图工具：

> 对照 restaurant/1：AssertionError [ERR_ASSERTION]: 页面未载入或为空：https://www.bluefrog.com.cn/

12:13:42.956255 UTC，在评估器退出后逐站 GET 实际 `/api/sites/<siteId>/draft`，13 个已创建站点全部 HTTP 200，25 个 run（13 plan、12 generate）全部为 complete／error；当前版本与逐站表一致。同期 GET 网关 `/status`，确认 stopped=true、in-flight=0。完整接口快照及每个 run 的 ID／step／issues 在 `control/terminal-draft-*.json`，汇总在 `terminal-before-stop.json`。这项确认独立于评估器退出码。

确认后，12:13:50.248054 UTC 手动向网关进程组 PID 54540、dev 进程组 PID 54541 发 SIGINT；12:13:50.504158 UTC 确认应用端口 63467、网关端口 63468 均关闭，见 `control/shutdown.json`。没有遗留 running run、网关在途请求或监听端口。

#### 六个盲评包与 materialsChanged

仅读取第一轮 `private/blind-coverage.json` 并检查六个包目录存在性，没有打开 `review/` 或 `comparison-review/` 中任何内容，未启动审查或盲评实例。

| 路径（相对本工作树） | 存在性与齐全性 |
| --- | --- |
| `artifacts/t190/r2/round1-full/review/mixed/` | 存在；不齐全，5 个组合缺生成截图，且少 1 份真实官网对照 |
| `artifacts/t190/r2/round1-full/review/company/` | 存在；不齐全，存在换公司题缺图 |
| `artifacts/t190/r2/round1-full/comparison-review/` | 存在；不齐全，paired=9，5 个组合缺成对截图 |
| `artifacts/t190/r2/round2-selected/review/mixed/` | 不存在，未运行 |
| `artifacts/t190/r2/round2-selected/review/company/` | 不存在，未运行 |
| `artifacts/t190/r2/round2-selected/comparison-review/` | 不存在，未运行 |

第一轮覆盖记录 complete=false、review.complete=false、comparison.requested=true、comparison.complete=false；mixed=22、company=16、paired=9 是覆盖文件中的计数，不是生成站数或审美通过数。review.missing 为 32 项，comparison.missing 为 5 项，总计 37 项，完整缺失原文留在覆盖文件及 `control/baseline-result.json`。缺图的五组合为 industrial/precision、packaging/precision、restaurant/documentary、design/precision、design/documentary。第二轮覆盖文件不存在，不借第一轮记录推断其齐全性。

第一轮 `private/round.json` 记录 previousMaterialsChanged=true；其 comparison 数组和 `private/comparison.json` 中 **14/14 项 materialsChanged=true**，每项保存 currentMaterials／previousMaterials 的 length 及两轮 round.json 中实际资料的精确 source 路径，unverifiedFields 均为 `["previous.styleRegistration"]`。未补造旧风格登记版本；visualPairAvailable 为 9 true／5 false，仅代表配图可用性。第二轮没有 comparison 记录。

comparison 的对象仍是“新资料 + T-188/T-191/T-192 等当前代码”与“旧资料 + 旧代码”的整体效果，不能分别归因资料和代码。本次没有审美结论、成对偏好或 company 质量结论；未运行固定口径缺口计数或复制主数据，不将技术 generated 写为质量通过。全部旧证据、新的失败候选和账本均保留。未推送、未 force-push，未写主工作区 `.sitecraft-data` 或 artifacts；Next 自动修改的 `tsconfig.json` 保留并排除提交。
