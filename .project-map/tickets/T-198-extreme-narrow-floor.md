---
id: T-198
title: 实现极端窄列拒收：平均每行不到 2 个字的文字块进入底线检查
type: build
status: closed
blocked_by: []
claimed_by: codex-t198
supersedes:
---

## Why

按 T-197 的决定，一字一行的竖排文字（例如 T-186 case-2 的表格 caption）属于底线失败，不能只作质量反馈。

## What to build

1. **在现有窄列测量上增加一档底线**：沿用 T-160 的测量规则，包括最近独立文字容器、可见性、多栏分片、display:contents 的处理，以及豁免项（单元格、控件、导航、短标签、独立纯价格值）。
   - 拒收条件：可见文字块至少 3 行，且平均每行不到 2 个非空白字符。
   - 判定以中文为主；纯英文按词数，标准由执行者按 T-160 的口径给出依据，写进 Resolution。
   - 375、768、1440 三档分别判定，任一档命中即拒收。
2. **修正流程**：拒因进入现有的底线修正流程，按节点定位反馈给模型，与对比度、溢出共用最多两轮。仍然不过，就如实告诉用户，不存版本。
3. **不扩大范围**：普通窄列与行长反馈保持「只作质量反馈」，阈值不变。
4. **防误拒**：
   - 用 `scripts/check-code-quality-offline.ts` 离线重检主数据里 T-190、T-184、T-186 的新路线站点，列出会被新规则拒收的站与位置。
   - 逐个打开对应截图，确认都是真正的竖排或碎排，不是误判。
   - 如果误判较多，就停下报构思主控。
5. **成对测试**：
   - T-186 case-2 的 caption：旧规则存版，新规则拒收；
   - 正常的窄标签、价格单元格：不拒收；
   - 正好 2 字每行的边界用例：写明怎么判。
6. **规则文字**：合并时同步更新 AGENTS.md「验收」与 mainline 中 T-160 的表述。

## Acceptance

- [x] 成对测试先红后绿；离线重检结果与截图核对写进 Resolution
- [x] AGENTS.md 与 mainline 规则文字已同步
- 合并后主线验证通过；独立审查通过——主线验证已通过（见 Resolution 末尾）；审查一项不打勾：review1、review2 均为 NO_GO，review2 的四项按构思主控口径修复后未再复审，由执行主控核对四项后合并。审查原文：`artifacts/t198/review1.txt`、`review2.txt`。

## Resolution


执行：codex-t198；2026-10-20。**PASS（本次执行范围）**。工作树 `/Users/luckye/Documents/Code/sitecraft-ai-t198`，分支 `t198-extreme-narrow-floor`，基线 `8d6dc2f762bd37a7b464591f6d592a5b871e2845`。本票保持 open；合并后主线验证与独立审查交主控，最后一项未勾选。所有时间以下均为 UTC（纽约 EDT 减 4 小时）。交付代码、测试与规则在本票同一个本地提交，完整 SHA 可由 `git log -1 --format=%H -- .project-map/tickets/T-198-extreme-narrow-floor.md` 读取，并写在 `artifacts/t198/verification.json`。

### 判定与改法

- **英文口径**：沿用 T-160 的英文字母词及词内撇号计数（`[A-Za-z]+(?:['’][A-Za-z]+)*`），至少 8 词才测；断词跨行不会重复计词。纯英文至少 3 行且平均严格少于 2 词/行即拒收。依据是 T-160 已按词衡量英文正文、反馈阈值为 3 词/行；此次把负责人给定的 2 作为同一计量单位下的极端底线，避免用英文字母数把逐词碎排当正常正文。
- **中文与边界**：仍至少 8 汉字才测，分子为全部非空白 Unicode 字符，含数字和标点；至少 3 行且平均严格小于 2 才拒收，比较原始比值，不用显示的小数判门槛。恰好 2 字/行或 2 词/行不拒收，仍可能触发普通窄列反馈。测试用 8 字/4 行与 8 词/4 行验证边界，9 字/5 行与 8 词/8 行作拒收对照；两行、短标签、纯价格、价格单元格与控件/导航作非拒收对照。
- **根因层**：在现有 T-160 测量结果里保留极端子集，按默认可见页面、最近独立容器、文字 Range、contents 和分栏片段计行；不改原测量、豁免或普通 6 字/3 词反馈阈值。每页每档的极端结果携带实际 DOM key，进入同次 `readCodeLayoutRepairs`；T-187 继续收集源码快照、失败叶子元素与相关声明，不按问题文案反查或扩到容器/整页。`scripts/visitor-layout-scan.js` 未改。
- **Tracer bullet**：本地 HTTP 模型替身经生产生成工作流调用写页、提交检查、片段修正和存版；修好宽度时 1 轮后存版，返回仍过窄的有效声明时恰好 2 轮修正、3 次候选检查后报错且无版本。没有改轮次数量、工作流、存版入口或事实模型合同。after 仅由测试接管执行，不宣称实际 Next after 集成或真实模型效果通过。**Deep modules** 保持已有提交/修正接口；**Ubiquitous language** 统一称为「极端窄列」。
- AGENTS 验收、mainline、spec 与 CONTEXT 已同步。AGENTS 的 T-196 长段只保留规则；测试细节移至 spec 第 6 节，现有伪元素、首行首字母和叠层规则未改，不涉及 T-199。

### 红绿与门控

统一浏览器环境：

```sh
export CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell
npm test -- --browser-concurrency=1 tests/t198-extreme-narrow-floor.test.ts
```

- 原 caption 夹具来自 `c06fc9e3` 的 `ddefcab0-3bce-4d66-b0d4-64031eb4b420`：首张规格表与原公共 CSS 原样提取，去掉无关图片和区块，补协议必需的最小首页；来源登记在 `tests/fixtures/t198-t186-caption.json`。完整原站另做离线重检，不以提取夹具代替原站。
- **红灯**：12:26:52–12:26:55，`red-final.log`，3/3 预期失败：caption 实际 `applied` 并存版，边界坏例实际通过，contents/分栏没有底线拒因。加入生成工作流证明后，12:33:28–12:33:31 对同一基线补跑完整 4 项，`red-complete.log` 4/4 预期失败；生成工作流实际 `complete`，本应两轮后拒收。对照期间仅将两个运行文件恢复为 `git show 8d6dc2f:lib/code-site-check.ts` 和 `git show 8d6dc2f:lib/code-site-layout-repair.ts` 原文，其余运行代码仍是基线；结束后恢复候选，没有回滚认领或其他工作。
- **绿灯**：12:32:53–12:33:00，`green-workflow-second.log`，相同完整用例 4/4 通过；最终候选也在下列相关回归中 4/4 通过。实际原 caption 经提交入口成为可见失败元数据而无版本；原叶子通过 T-187 改为足宽横排后经同一入口存版。
- 早期夹具遗漏首页、金额夹具用 br 分割导致不再匹配 T-160 完整金额格式，以及替身空替换被严格协议拒收的准备失败均原样保留（`red.log`、`red-confirmed.log`、`green-first.log`、`green-workflow.log`），不当作红灯依据，没有放宽生产检查。
- **相关回归**：12:34:51–12:36:02，退出 0，70/70、0 fail/cancel/skip，浏览器文件并发 1：

```sh
npm test -- --browser-concurrency=1 tests/t198-extreme-narrow-floor.test.ts tests/t160-narrow-columns.test.ts tests/t187-repair-fragments.test.ts tests/t187-repair-routing.test.ts tests/t196-visual-coverage.test.ts
npm run typecheck
```

回归日志 `artifacts/t198/targeted-tests.log`，标准入口完整报告、身份、检查日志复制到 `artifacts/t198/targeted-run/`；原始入口目录 `artifacts/t167/test-run-1792499692011-54797/` 保留。typecheck 于 12:36:08 退出 0，日志 `artifacts/t198/typecheck-final.log`。没有跑全量、runner 或 build，没有开审查/盲评实例。Next 自动改动的 tsconfig.json 不提交。

### 只读离线重检

主数据仅从 `/Users/luckye/Documents/Code/sitecraft-ai/.sitecraft-data` 读取；38 站与其图片复制到本树 `artifacts/t198/offline-data/`。没有改名、清洗或写回源快照，没有写主工作区 artifacts。完整站点/版本清单 `artifacts/t198/offline-manifest.json`，复制过程 `artifacts/t198/prepare-offline.py`。本树普通 dev 使用 3198，NODE_ENV=test 不加载 .env.local；离线脚本与服务均使用副本根，由生产 `checkTestIdentity` 核对 cwd/dataRoot 后登记 `offline-identity.json`，health 为 503（未配真实模型）也核对身份。

```sh
NODE_ENV=test SITE_STORE=fs SITECRAFT_TEST_IDENTITY_FILE=$PWD/artifacts/t198/offline-identity.json SITECRAFT_DATA_ROOT=$PWD/artifacts/t198/offline-data npm run dev -- --port 3198
SITECRAFT_BASE=http://127.0.0.1:3198 SITECRAFT_DATA_ROOT=$PWD/artifacts/t198/offline-data node --experimental-strip-types --input-type=module -e 'import {checkTestIdentity} from "./scripts/test-identity.ts"; import {writeFile} from "node:fs/promises"; await writeFile("artifacts/t198/offline-identity.json",JSON.stringify(await checkTestIdentity(),null,2));'
NODE_ENV=test SITE_STORE=fs SITECRAFT_TEST_IDENTITY_FILE=$PWD/artifacts/t198/offline-identity.json SITECRAFT_DATA_ROOT=$PWD/artifacts/t198/offline-data SITECRAFT_BASE=http://127.0.0.1:3198 node --experimental-strip-types scripts/check-code-quality-offline.ts --manifest artifacts/t198/offline-manifest.json --samples artifacts/t198/offline-data/code-sites --out artifacts/t198/offline-result-final
```

最后的 out 必须使用新目录复现，以免覆盖本轮证据。12:36:40–12:37:28 命令退出 0；检查段 12:36:40.824–12:37:19.650。**38/38 站、345 个视口、0 重检错误、0 模型调用**。T-184 17 站与 T-190 14 站均未命中新规则；T-186 7 站中仅第一轮 molding 的两处 caption 命中，修复后 `2c1bb9a1` 未命中。原脚本第一次已完成全部测量，随后因为内部站名带 T-184/T-190 后缀而正文不带后缀，在截图公司核对时报错，退出 1；完整 `offline.log` 与 `offline-result/` 保留。窄改截图核对名的来源为资料中的显式「公司名」，保留公司核对；没有改变任何检查结果。上述最终命令已连截图步骤完整通过。

| 分组 | 站点 ID | 名称 | 实测视口 | 新极端窄列 |
| --- | --- | --- | ---: | --- |
| T-184 | `04f0c96c-41fc-4514-8466-a053c8d1588c` | 忻州重载减速机（T-184） | 6 | 0 |
| T-184 | `1f3071c4-d265-49c5-9b43-b9f10834278b` | 外高桥流体接头（T-184） | 9 | 0 |
| T-184 | `1fbd7776-8308-4ba4-bca1-6fa4efdf1a7e` | 忻州重载减速机（T-184） | 6 | 0 |
| T-184 | `229d3ee1-e6f0-4037-a4ec-58e57b810a59` | 拾色绘画教室（T-184） | 9 | 0 |
| T-184 | `2f0f15cf-1f58-40a7-b331-922d0557c1b0` | 青禾纸包装（T-184） | 9 | 0 |
| T-184 | `406c3fc7-991b-4e00-bffa-3b88b09f988c` | 拾色绘画教室（T-184） | 9 | 0 |
| T-184 | `469e99dd-068b-43dc-9a2d-175374857109` | 折页设计工作室（T-184） | 9 | 0 |
| T-184 | `4d25bc86-4674-4259-a098-86b4fd69fcfc` | 禾巷小馆（T-184） | 9 | 0 |
| T-184 | `6146ce80-a9f0-44d1-babb-75fac05876e8` | 折页设计工作室（T-184） | 9 | 0 |
| T-184 | `7f3b3a84-46f6-4c66-b4f4-b9892aedf92e` | 外高桥流体接头（T-184） | 9 | 0 |
| T-184 | `9965c198-76f4-4421-9971-c87c9853ffb2` | 青禾纸包装（T-184） | 9 | 0 |
| T-184 | `b7aedbde-a131-43e8-8950-7ce12b7f31e4` | 禾巷小馆（T-184） | 9 | 0 |
| T-184 | `c2ed93b2-5151-4ab8-835a-6f815ee4cfb7` | 禾巷小馆（T-184） | 9 | 0 |
| T-184 | `d5d846e5-6324-4ac8-9aec-707f036fd30c` | 禾巷小馆（T-184） | 9 | 0 |
| T-184 | `e40b8af3-8cbe-44a8-9530-e8bd8789d003` | 拾色绘画教室（T-184） | 9 | 0 |
| T-184 | `e679ef51-0e42-4d29-8e8c-273372cea6fc` | 宁海精密注塑模具（T-184） | 12 | 0 |
| T-184 | `f6b5fb49-d9ad-4512-883d-fe88f4ce0cbe` | 折页设计工作室（T-184） | 9 | 0 |
| T-186 | `04608952-e796-440f-a440-8c358b782579` | 禾巷小馆 | 9 | 0 |
| T-186 | `2c1bb9a1-3798-449c-9f26-eebd1b6bfc26` | 宁海精密注塑模具 | 12 | 0 |
| T-186 | `9e8fec79-a983-46be-ab02-e29228517b7a` | 拾色绘画教室 | 9 | 0 |
| T-186 | `a31b4b28-e618-4e79-b1d8-c8a6982361f4` | 忻州重载减速机 | 6 | 0 |
| T-186 | `b78de6c0-6619-4011-ba5c-ad3b0caa89b4` | 禾巷小馆 | 9 | 0 |
| T-186 | `c06fc9e3-0d70-45a8-aa11-bd85127ee5b1` | 宁海精密注塑模具 | 12 | 2 处（375） |
| T-186 | `fd5a142f-9193-43b0-8ada-0c97742f7440` | 青禾纸包装 | 9 | 0 |
| T-190 | `02058cac-8139-478a-895e-d91a56393cec` | 青禾纸包装（新资料 T-190） | 9 | 0 |
| T-190 | `2c11a272-fdb1-461b-a72e-ef5460015313` | 禾巷小馆（新资料 T-190） | 9 | 0 |
| T-190 | `3938dc82-0570-46d0-b846-febef50b3dab` | 外高桥流体接头（新资料 T-190） | 9 | 0 |
| T-190 | `50f563f6-bdba-44fe-934a-43b1ae266a00` | 忻州重载减速机（新资料 T-190） | 6 | 0 |
| T-190 | `519b44cd-042e-4c85-a8f7-811893629dba` | 折页设计工作室（新资料 T-190） | 9 | 0 |
| T-190 | `61601e66-9634-4fa1-a173-e5c2c086b782` | 外高桥流体接头（新资料 T-190） | 9 | 0 |
| T-190 | `641e5b8b-2db4-493a-8179-2ce4f5a78cf4` | 拾色绘画教室（新资料 T-190） | 9 | 0 |
| T-190 | `961cd7a2-1bdb-49d0-a824-cee927a93747` | 禾巷小馆（新资料 T-190） | 9 | 0 |
| T-190 | `a44ba7c8-9e61-4a46-ad4e-dcf951583159` | 拾色绘画教室（新资料 T-190） | 9 | 0 |
| T-190 | `aa40ead3-7f76-4fa8-9558-7b51c9988eae` | 拾色绘画教室（新资料 T-190） | 9 | 0 |
| T-190 | `aaf4ff61-b68d-4161-a3cb-b4a2473baf7e` | 宁海精密注塑模具（新资料 T-190） | 12 | 0 |
| T-190 | `bd77156a-35ca-40f1-b899-ae014ac55455` | 宁海精密注塑模具（新资料 T-190） | 12 | 0 |
| T-190 | `cb04f202-3f43-41cf-bb80-4562505b3dca` | 禾巷小馆（新资料 T-190） | 9 | 0 |
| T-190 | `ce92cb36-d374-4244-bc2b-3232fd9841dc` | 拾色绘画教室（新资料 T-190） | 9 | 0 |

新规则拒收的唯一站：`c06fc9e3-0d70-45a8-aa11-bd85127ee5b1`，版本 `ddefcab0-3bce-4d66-b0d4-64031eb4b420`，位置均在 `pages/products/html`，只命中 375：

| 文字 | 源码 childNodes 路径 | 实测 | 截图判定 |
| --- | --- | --- | --- |
| 多腔热流道模具规格参数 | `[0,3,1,1,3,1]` | 11 字 / 11 行 = 1.00 | 375 一字一行；768、1440 正常横排 |
| 透明光学注塑件规格参数 | `[0,9,1,1,5,1]` | 11 字 / 11 行 = 1.00 | 375 一字一行；768、1440 正常横排 |

`artifacts/t198/screenshots/c06fc9e3-0d70-45a8-aa11-bd85127ee5b1-products-{375,768,1440}.png` 及六张 caption 局部截图均逐张打开，确认两个命中都是真实竖排，误拒 **0 站**。修复后 molding `2c1bb9a1-3798-449c-9f26-eebd1b6bfc26` 的产品页三档整页截图也逐张打开，未见该竖排；截图脚本 `artifacts/t198/capture.mjs`，复现命令 `node --experimental-strip-types artifacts/t198/capture.mjs`（同一 CHROME_PATH、3198 本树服务），用载入事件、字体和图片 decode 确认就绪。原始截图观测与节点矩形在 `screenshots/capture.json`，判图记录 `screenshot-judgement.json`。离线脚本另外自动采集的 6 张反馈截图也逐张打开，完整载入。

总体被现有底线拒收的是 2 站，不能全部算作新规则：除上述 molding 外，`a31b4b28-e618-4e79-b1d8-c8a6982361f4`（忻州重载减速机）有 home/products 三档原生编号对比度 4.33、要求 4.5，共 30 条原有对比度拒因，极端窄列 0。未为它修改 T-196 或放宽对比度。完整结果见 `offline-result-final/results.json`、`summary.json`，本票未调用事实模型、未新建任何真实版本，不宣称离线重检为模型事实或独立审美通过。

### review1：F1 修复与构思主控可见行口径（2026-10-20）

执行 codex-t198，基于 `7a5223d8e6d364c1400198e6cc690d5ea6bd490a`。独立审查原结论 **NO_GO**，完整报告 `/Users/luckye/Documents/Code/sitecraft-ai/artifacts/t198/review1.txt` 已读；阻断项仅 F1：祖先 overflow 裁掉的文字仍按完整 12 行计入新增拒收。原报告与 followup-candidate／followup-parent 的结果、截图只读，未改写。**本轮 PASS（修复执行范围）**，不冒充独立复审通过；票仍 open，合并后主线验证与独立审查项仍未勾选。以下时间均为 UTC。

**来源与边界**：构思主控于 **2026-10-20** 补充决定，优先于此前尝试静态核实 inset 裁剪的建议：极端窄列是新增拒收，判不准时不拒收，退回 T-160 质量反馈；误拒会阻断正常站存版。这是本轮规则来源，已写入 spec 第 6 节，AGENTS 验收段只补一句规则，mainline 与 CONTEXT 同步。

**修法**：只改原 `readCodeQuality` 窄列测量层。对可确定的情况，将 Range 矩形与所有 overflow 非 visible 祖先的实际内侧裁剪盒按对应轴求交；没有交集的文字不计行，逐字交集同时决定可见字符，英文同一词跨行或部分可见仍只计一次。普通窄列也使用可见行和字符，正文资格与 6 字／3 词、极端严格小于 2 的阈值不变。display:contents 的零盒不作为裁剪盒；没有修改其 content-visibility:hidden 排除逻辑。对文字块、实际文字父元素及祖先的 clip-path／mask-image／transform（含独立 translate／rotate／scale）非 none、contain 非 none、column-count／column-width 非 auto、content-visibility 非 visible，统一不做极端拒收；保留 T-160 原质量计量，过窄反馈注明「可见行无法确定」。不解析形状、不修缩放多栏坐标，不新增文案关键词分类、修正入口或修正轮；T-187、提交入口与 visitor-layout-scan.js 均未改。

**Tracer bullet** 由独立审查原输入经生产 checkSiteCode 三档检查并保存截图；既有生产生成／片段修正／存版回归继续通过。**Deep modules** 保持局部测量函数及既有提交、修正接口；**Ubiquitous language** 用「可见行无法确定」表示只反馈、不新增拒收的情况。

新增 `tests/t198-clipped-visible-lines.test.ts`：

| 独立截图输入 | 访客实际可见行 | 7a5223d | 修后 |
| --- | ---: | --- | --- |
| clip-zero | 0 | 三档均误报 12 字／12 行并拒收 | 三档均无极端窄列，普通窄列 0 |
| clip-one-line | 1 | 同上 | 同上 |
| clip-two-lines | 2 | 同上 | 同上 |
| visible-control | 12 | 三档均拒收 | 三档仍为 12 字／12 行并拒收 |

clip-path、mask、transform、contain、column-count、column-width、content-visibility 七组均包含自身／祖先两种位置，各自与去掉声明的输入成对运行三档：声明存在时无极端拒收且反馈注明「可见行无法确定」，去掉后仍拒收。另以裁掉长首行后可见 8 字／8 行、裁掉碎尾行后留下三行各 8 字验证分子分母都来自可见文字，不能只减少行数却继续计隐藏字符。期望来自独立访客截图、显式行内容和构思主控规则，没有读取生产计数器作为答案。原 caption 夹具与 2 字／词边界不变；原多栏用例依据新决定只将拒因预期改为「仅反馈且标注无法确定」，保留原四条质量反馈计数及 contents／flex 拒收对照，没有删除多栏输入。

**命令与红绿**（同前文 CHROME_PATH）：

```sh
npm test -- --browser-concurrency=1 tests/t198-clipped-visible-lines.test.ts
npm run typecheck
npm test -- --browser-concurrency=1 tests/t198-clipped-visible-lines.test.ts tests/t198-extreme-narrow-floor.test.ts tests/t160-narrow-columns.test.ts tests/t187-repair-fragments.test.ts tests/t187-repair-routing.test.ts tests/t196-visual-coverage.test.ts
```

- 13:05:30–13:05:44：在 7a5223d 运行时上先红，19 项中 18 项预期失败、12 行对照通过；0／1／2 行均实际误拒，七组自身／祖先均未执行新保守门禁，裁剪字符用例也失败。`artifacts/t198/review1/red.log`，标准入口 `test-run-1792501530477-83258`；此时运行代码尚未改，只有原有 tsconfig 自动改动和新增测试。
- 13:08:14–13:08:32：首次修后，新 19 项及原 caption／边界／生成流程均通过；旧多栏断言仍预期拒收，按本次新决定同步后才通过。该失败日志 `green-first.log` 保留，不算整组绿灯。
- 13:09:13：typecheck 退出 0，`typecheck.log`。13:09:15–13:10:37：最终相关回归 **89/89**，0 fail/cancel/skip，退出 0，浏览器文件并发 1；`targeted-tests.log`。标准入口目录 `artifacts/t167/test-run-1792501755329-86951/`，红绿报告副本分别在 `artifacts/t198/review1/runner-red/`、`runner-green/`。本轮未跑全量、runner 回归或 build，未调用真实模型、未开审查或盲评实例。

红灯目录 `review1/contract-1792501532125-83298/` 和最终绿灯目录 `review1/contract-1792501820720-88663/` 的 0／1／2／12 行 × 三档截图已逐张打开：正文隐藏是样本故意裁掉的结果，标题完整载入；显示状态与独立审查截图一致，计数变化来自修复而不是页面内容被改写。JSON 与截图均保留，不覆盖早期失败。

**同 38 站前后重检**：沿用前文已复制的 `offline-data/` 和原 `offline-manifest.json`，不重写主工作区数据或任何旧结果。仍用本树 3198 dev、NODE_ENV=test、同一副本根和经 checkTestIdentity 核对的 cwd/dataRoot；本轮身份记录在 `artifacts/t198/review1/offline-identity.json`，health=503（无真实模型）也已核对身份。基线在修改运行代码之前重新测量，元数据 commit 为 7a5223d，dirty=true 仅因为新增测试及 tsconfig；候选在修改后的同一工作树测量，元数据仍为该父提交加未提交候选，最终交付 SHA 写 `review1/verification.json`，不把它们称作干净归档。

```sh
NODE_ENV=test SITE_STORE=fs SITECRAFT_TEST_IDENTITY_FILE=$PWD/artifacts/t198/review1/offline-identity.json SITECRAFT_DATA_ROOT=$PWD/artifacts/t198/offline-data npm run dev -- --port 3198
SITECRAFT_BASE=http://127.0.0.1:3198 SITECRAFT_DATA_ROOT=$PWD/artifacts/t198/offline-data node --experimental-strip-types --input-type=module -e 'import {checkTestIdentity} from "./scripts/test-identity.ts"; import {writeFile} from "node:fs/promises"; await writeFile("artifacts/t198/review1/offline-identity.json",JSON.stringify(await checkTestIdentity(),null,2));'
NODE_ENV=test SITE_STORE=fs SITECRAFT_TEST_IDENTITY_FILE=$PWD/artifacts/t198/review1/offline-identity.json SITECRAFT_DATA_ROOT=$PWD/artifacts/t198/offline-data SITECRAFT_BASE=http://127.0.0.1:3198 node --experimental-strip-types scripts/check-code-quality-offline.ts --manifest artifacts/t198/offline-manifest.json --samples artifacts/t198/offline-data/code-sites --out artifacts/t198/review1/offline-candidate
python3 artifacts/t198/review1/compare-offline.py
```

上述 CLI 基线 out 为 `review1/offline-parent`；复现须另取新 out，避免覆盖。基线 13:06:16–13:07:05、候选 13:12:12–13:13:01 均连截图步骤退出 0；两轮各 **38 站／345 视口／0 重检错误／0 模型调用**，14 个 T-190、17 个 T-184、7 个 T-186 的站点与版本逐项一致。比较脚本逐项比较站点、版本、页／宽度和源码字段、路径、元素快照，未做哈希、字节或像素比对。

| 范围 | 7a5223d 新规则命中 | 修后命中 | 新增／减少 |
| --- | ---: | ---: | --- |
| T-190 14 站 | 0 | 0 | 0／0 |
| T-184 17 站 | 0 | 0 | 0／0 |
| T-186 7 站 | molding 1 站 2 处 | 同 1 站 2 处 | 0／0 |

所有候选命中均能在基线中找到相同位置，没有增加。原 molding `c06fc9e3-0d70-45a8-aa11-bd85127ee5b1`、版本 `ddefcab0-3bce-4d66-b0d4-64031eb4b420` 的 `products/375`，仍为 `pages/products/html` 路径 `[0,3,1,1,3,1]`「多腔热流道模具规格参数」及 `[0,9,1,1,5,1]`「透明光学注塑件规格参数」，各 11 字／11 行；768、1440 正常。两处未落入不确定条件，没有样本例外。`2c1bb9a1` 修复站仍无新命中；`a31b4b28` 仍只有 30 条原有编号对比度拒因。完整输入清单不变，完整前后结果与摘要在 `review1/offline-{parent,candidate}/`，位置比较见 `review1/offline-comparison.json`。

13:13:55 运行 `CHROME_PATH=<同上> node --experimental-strip-types artifacts/t198/review1/capture.mjs`，保存本轮原 molding、修复 molding 产品页三档整页图及原 caption 六张局部图，共 12 张，已全部逐张打开，确认 375 两处仍是真竖排；`review1/screenshots/capture.json` 保留观测。两轮离线脚本自动保存的反馈截图也全部打开。未把上轮截图当作本次测量通过的替代。

**继续暂缓的既有限制**：review1 同时发现 K1（display:contents 祖先加 content-visibility:hidden，浏览器仍画字而旧资格层跳过）和 K2（缩放多栏仍跨列合行），均继续按 T-160:158–159 的负责人决定暂缓，真实生成再出现时另开票；本轮没有修复其质量计数或宣称解决。review1 的 english-only-control／english-with-han 还确认：原本会拒收的长英文前加 1 个汉字后，会因 T-160 的 `(han || words) < 8` 既有资格条件整体放行；这是长混合正文的资格盲区，不冒充短标签，也不在本轮改变中文至少 8 汉字的合同。本次保守门禁会让这些复杂情况不承担新增拒收，但不消除上述既有测量限制。

### review2：overflow 裁剪适用范围与统计（2026-10-20）

执行 codex-t198，基于 `82fad022144660b15b1bf993390d8abff4e0fc3c`。完整读取 `/Users/luckye/Documents/Code/sitecraft-ai/artifacts/t198/review2.txt`（718 行）及原输入、结果；独立复核原结论为 **NO_GO**，四项 P2 分别是定位逃逸、inline overflow、body 向视口传播和 overflow-clip-margin。报告和主工作区探针只读。本轮只改原窄列测量与检查结果中的计量证据，不改提交、T-187 修正入口、轮数或 T-199 范围；不调用真实模型、不另开审查。沿用 evidence-first-testing、project-map 与 document-writing 的证据和文档流程。以下时间均为 UTC。

**INCOMPLETE（口径示例待主控确认）**：修复、红绿、门控和 38 站统计已完成；尚未将 absolute-contained-two 的「统一定位链保守退出」与同条末尾「按求交结果判定」视为已经一致，具体差异见下文。当前候选按第 3 条实现，供主控直接复核，不把未确认项写成 PASS。

**规则来源与修法**：构思主控口径的延伸，**2026-10-20**；以本轮最后补充为准：

- inline、contents、html、body 的 overflow 直接跳过，既不构造局部裁剪框，也不单凭该 overflow 标记无法确定；仍继续向上检查其他属性及有效裁剪框。因此 F2、F3 恢复三档拒收，不再把它们列为保守放行的代价。
- 其他有盒祖先的 overflow 非 visible 时，只有 overflow-clip-margin 未设置或计算值为 `0px`，且文字父元素到该祖先之间（含自身）没有 absolute／fixed／sticky 定位，才按相应轴与文字矩形求交。定位链或非零 clip-margin 统一退出极端拒收；同一正文块的原因去重，T-160 过窄反馈注明「可见行无法确定（定位逃逸／clip-margin 等）」；原 clip-path、mask、transform、contain、多栏及 content-visibility 规则保留。
- 先按最近独立正文块归集原本有 Range 文字的节点，再统一判断整个块是否无法确定；裁剪只在逐字测量中使用，避免先丢掉节点后再决定整个块的可见行口径。普通窄列仍为 6 字／3 词，极端严格少于 2，正文资格及豁免不变。
- `absolute-contained-two` 的两行截图已核对。它自身为 absolute，按上述统一规则也保守退出、不拒收；**没有为它增加定位包含块例外，也不声称该例已经按两行求交测量**。用户同条末尾另写了该例按求交判定，执行时已提出这一冲突，并明确采用第 3 条统一保守规则继续；此差异保留供主控确认。inline-block 两行对照仍实际求交、不产生窄列反馈。

**Tracer bullet** 仍从冻结输入经生产 checkSiteCode 完成三档检查并保留 JSON，原生成／提交／片段修正回归验证同一入口。**Deep modules** 保持原接口；统计附在同次质量反馈，不建立第二套测量。**Ubiquitous language** 继续使用「极端窄列」「可见行无法确定」。AGENTS 验收段仅改一句规则；spec 第 6 节写明适用条件、统计口径及来源，mainline、CONTEXT 窄改同步。

**成对输入与截图期望**：新增 `tests/t198-overflow-ancestors.test.ts` 与 `tests/fixtures/t198-review2-overflow.json`，冻结 review2 的原 SiteCode，测试不读取探针的结果或计数作为答案。原始三档图与本树重新采集的三档图均已逐张打开，保存于 `artifacts/t198/review2/visitor-screenshots/`：

| 输入 | 访客画面与需求 | 82fad02 | 修后 |
| --- | --- | --- | --- |
| absolute-two-visible、fixed-two-visible、clip-margin-two-visible | 各 24 字／12 行，正好 2 字，不能拒收 | 每档误算 12 字／12 行并拒收 | 三档不拒收，质量反馈注明原因 |
| absolute-escape、fixed-escape | 实际完整 12 行；复杂定位按保守门禁 | 漏掉全部文字，无窄列反馈 | 三档不拒收，注明定位逃逸；去掉 overflow 仍三档拒收 |
| clip-margin | 实际可见 8 行一字一行；扩张区不再推算 | 漏掉全部文字，无窄列反馈 | 三档不拒收，注明 clip-margin；去掉 overflow 仍三档拒收 |
| inline-overflow、body-propagation | 实际完整 12 行，局部 overflow 不适用 | 三档漏拒 | 三档拒收；移除 overflow 的对照也拒收 |
| overflow-inline-block-two | 实际仅 2 行，真实有盒裁剪 | 不拒收 | 求交后仍不拒收；完整 12 行对照拒收 |
| absolute-contained-two | 实际仅 2 行；含 absolute 定位链 | 不拒收 | 统一保守退出，仍不拒收，见上文差异说明 |

另覆盖 sticky 与 overflow 同链的保守反馈、去掉 sticky 后仍拒收、html／contents overflow 跳过，以及按块／原因去重的统计（3 块中 2 块不确定，满足 8 字资格的 2 块中 1 块不确定）。原 caption、中文／英文正好 2 的边界、正常标签／价格、review1 的 0／1／2／12 行及七类不确定条件对照均保留。

**红绿命令与日志**（CHROME_PATH 同本票前文）：

```sh
npm test -- --browser-concurrency=1 tests/t198-overflow-ancestors.test.ts
npm run typecheck
npm test -- --browser-concurrency=1 tests/t198-overflow-ancestors.test.ts tests/t198-clipped-visible-lines.test.ts tests/t198-extreme-narrow-floor.test.ts tests/t160-narrow-columns.test.ts tests/t187-repair-fragments.test.ts tests/t187-repair-routing.test.ts tests/t196-visual-coverage.test.ts
```

- 13:39:57–13:40:01，改运行代码前在 82fad02 上先红：12 项中 9 项预期失败、3 项通过，`review2/red.log`；三个 A 类输入的三档 JSON 均实际误拒。F2、F3 均漏拒，F1-B、F4-B 缺无法确定说明，sticky 仍按极端拒收。标准入口 `test-run-1792503595936-10150`，不是环境失败。
- 13:41:45–13:41:50，加入统计合同后在同一未改运行代码的基线上补跑，13 项中 10 项预期失败（统计字段缺失），`red-statistics.log`，入口 `test-run-1792503704189-11998`。
- 13:46:26–13:46:32，修后新 14 项全部通过，`green.log`，入口 `test-run-1792503985152-16529`。本轮先跑过原相关 89 项回归，全部通过；最终冻结候选的合并定向门控及入口报告见 `review2/targeted-tests.log`、`runner-green/`。typecheck 退出 0，`typecheck.log`。未跑全量、runner 回归或 build。tsconfig.json 的既存 Next 自动改动不提交。

**同 38 站重检**：继续只读本树既有副本和原清单，T-184 17 站、T-190 14 站、T-186 7 站，站点／版本逐项与基线一致；具体清单见本票前表及 `artifacts/t198/offline-manifest.json`。本树 3198 服务仍以 NODE_ENV=test、SITE_STORE=fs 和副本数据根启动，checkTestIdentity 核对 cwd/dataRoot，health 503 仅因未配置真实模型。身份文件为 `review2/offline-identity.json`。

```sh
NODE_ENV=test SITE_STORE=fs SITECRAFT_TEST_IDENTITY_FILE=$PWD/artifacts/t198/review2/offline-identity.json SITECRAFT_DATA_ROOT=$PWD/artifacts/t198/offline-data npm run dev -- --port 3198
SITECRAFT_BASE=http://127.0.0.1:3198 SITECRAFT_DATA_ROOT=$PWD/artifacts/t198/offline-data node --experimental-strip-types --input-type=module -e 'import {checkTestIdentity} from "./scripts/test-identity.ts"; import {writeFile} from "node:fs/promises"; await writeFile("artifacts/t198/review2/offline-identity.json",JSON.stringify(await checkTestIdentity(),null,2));'
NODE_ENV=test SITE_STORE=fs SITECRAFT_TEST_IDENTITY_FILE=$PWD/artifacts/t198/review2/offline-identity.json SITECRAFT_DATA_ROOT=$PWD/artifacts/t198/offline-data SITECRAFT_BASE=http://127.0.0.1:3198 node --experimental-strip-types scripts/check-code-quality-offline.ts --manifest artifacts/t198/offline-manifest.json --samples artifacts/t198/offline-data/code-sites --out artifacts/t198/review2/offline-candidate
python3 artifacts/t198/review2/compare-offline.py
python3 artifacts/t198/review2/summarize-visibility.py
CHROME_PATH=<同前> node --experimental-strip-types artifacts/t198/review2/capture.mjs
CHROME_PATH=<同前> node --experimental-strip-types artifacts/t198/review2/capture-contract.mjs
```

基线命令 out 为 `review2/offline-parent`，运行代码修改前 13:40:35–13:41:15 完成测量；候选 13:47:00–13:47:40 完成测量，两轮随后自动截图也退出 0。每轮 **38 站／345 视口／0 重检错误／0 模型调用**；元数据均为父提交加 dirty 工作树，基线 dirty 来自新增测试及 tsconfig；没有将其冒充干净归档。复现须使用新 out，脚本拒绝覆盖已有目录。

新规则位置比较 **新增 0、减少 0**，仍仅 `c06fc9e3-0d70-45a8-aa11-bd85127ee5b1`、版本 `ddefcab0-3bce-4d66-b0d4-64031eb4b420` 的 `products/375` 两处：`pages/products/html` 路径 `[0,3,1,1,3,1]`「多腔热流道模具规格参数」与 `[0,9,1,1,5,1]`「透明光学注塑件规格参数」，均 11 字／11 行。768／1440 横排，无命中；两处均未进入无法确定。重新采集并逐张打开原 molding 三档整页及六张 caption 图、修复 molding 三档整页，共 12 张；375 两处确为竖排，误拒 0 站，修复版 `2c1bb9a1` 仍无命中。两轮 CLI 另存的 12 张自动反馈图也均逐张打开。图与观测在 `review2/screenshots/`、`visitor-screenshots/`；位置对比在 `offline-comparison.json`。

**不确定性统计**（2026-10-20 13:48:04 汇总）：同一次生产反馈的 `narrowColumnVisibility` 按「页／视口中的独立正文块」计数，三档各计一次，不冒充去重 DOM 总数；语义及价格豁免先排除，非空 Range 块在 overflow 求交前计入 testedBlocks，中文／英文既有 8 字／词资格在逐字测量后另列。短正文不是合格正文，原因在同块内去重，同块多原因可分别计入。

| 口径 | 受测文字块 | 可见行无法确定 | 占比 | 原因前列 |
| --- | ---: | ---: | ---: | --- |
| 全部非空受测正文块 | 14,682 | 27 | 0.184% | 多栏 24，定位逃逸 3 |
| 满足既有 8 汉字／8 词资格的块 | 8,280 | 3 | 0.036% | 多栏 3 |

clip-path、mask、transform、contain、content-visibility、clip-margin 在这 38 站本次受测块中均为 0；不以只数产生窄列反馈的块来缩小不确定分母。两种口径都没有超过 5%。完整分站数、原因和占比、stop=false 保存于 **`artifacts/t198/review2/visibility-statistics.json`**，汇总脚本在任一比例超过 5% 时会失败并要求停止，不提交；原版本没有统计字段不当成零。

**保守放行的已知代价**：F1-B 的 absolute-escape／fixed-escape 实际可见 12 行，F4-B 的 clip-margin 实际可见 8 行，按本次统一规则只反馈，不新增拒收；sticky 等同链定位也接受相同代价。不把这几例写成几何已修好，也不靠文案或样本例外放行。F2、F3 依最后修正已恢复拒收。K1、K2 继续按 T-160:158–159 暂缓，混合英文加一个汉字后整体退出资格的盲区仍保留。原 `a31b4b28` 仍有 30 条原生编号对比度拒因，未算成新窄列、未放宽其他底线；离线技术结果不代表事实模型或独立审美通过。

最终冻结候选于 **13:48:23–13:50:02** 完成上述七文件串行定向门控，**103/103 通过，0 fail/cancel/skip，退出 0**；入口 `test-run-1792504101968-18557` 的原始身份、报告和日志复制到 `review2/runner-green/`。最终 review1 四组 × 三档截图也逐张打开，仍分别可见 0／1／2／12 行。typecheck 退出 0，未以截图代替门控。本轮按统一保守定位链规则交付；上文 absolute-contained-two 的求交表述差异未隐去。

票仍 open，主控负责的合并后主线验证／独立审查未勾选。交付 SHA 和最终门控时间在 `artifacts/t198/review2/verification.json`，不推送。

### 主控验收与关闭

执行主控，2026-10-20 EDT。共两轮独立审查，每轮都是新实例（gpt-6.1-sol high）。

- review1 NO_GO：被祖先 overflow 裁剪、访客看不见的正文仍按全部行数拒收（F1）。按构思主控口径修复：可见行只按行框与裁剪框求交计算；clip-path、mask、transform、contain、多栏、content-visibility 判为「可见行无法确定」，只保留反馈。K1、K2 按 T-160 的决定继续暂缓。
- review2 NO_GO：定位逃逸、inline 上的 overflow、body 传播、overflow-clip-margin 四项。构思主控决定：inline、contents、html、body 的 overflow 直接跳过；clip-margin 非 0 和定位逃逸判为「无法确定」；不再复审，由执行主控核对四项。
- 执行主控在 4ed0347 上核对四项，均满足：① review2 的三个误拒输入三档都不拒收；② inline、body、html、contents 跳过后完整竖排仍拒收，T-186 caption 仍拒收（`tests/t198-extreme-narrow-floor.test.ts` 4/4、`tests/t198-overflow-ancestors.test.ts` 14/14，本人重跑）；③ 38 站 345 个视口的新规则命中改前改后均为 molding 的两处 caption，新增 0、减少 0；④「可见行无法确定」占 27/14682（0.18%），原因为多栏 24、定位逃逸 3，低于 5% 的上限。
- absolute-contained-two 一项，执行者报 INCOMPLETE：原因是主控任务单前后要求矛盾。执行者按定位逃逸保守退出；该例可见只有 2 行，两种处理都不拒收，主控接受。
- 分支 `t198-extreme-narrow-floor`（`4ed0347`）以 `--no-ff` 合并为 `39c6218`。主线验证在合并后的 `39c6218` 上运行，2026-10-20 09:57:49–10:14:35 EDT，运行前停掉了 3034 服务，期间没有其他浏览器测试进程。typecheck、runner 回归、build 均退出 0；全量 941/941 通过（非浏览器 29 个文件、浏览器 114 个文件，并发 2），无失败、取消或跳过。日志见 `artifacts/main-verify-39c6218/`，标准入口目录 `artifacts/t167/test-run-1792504688122-26572/`。
