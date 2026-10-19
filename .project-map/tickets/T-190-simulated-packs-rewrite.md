---
id: T-190
title: 模拟资料按真实企业写法重整并建立新基线
type: build
status: open
blocked_by: []
claimed_by: codex-t190-t159-fixture
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
