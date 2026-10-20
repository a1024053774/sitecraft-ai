---
id: T-198
title: 实现极端窄列拒收：平均每行不到 2 个字的文字块进入底线检查
type: build
status: open
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
- [ ] 合并后主线验证通过；独立审查通过

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
