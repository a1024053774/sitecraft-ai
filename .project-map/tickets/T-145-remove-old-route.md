---
id: T-145
title: 删除旧区块库路线，旧站点一次性转成新路线的第一个版本
type: build
status: closed
blocked_by: []
claimed_by: t145-build
supersedes:
---

## Why

T-127 定下：新路线跑通后，旧的区块库拼页、adapter、白名单 operation 整套删除，不留兼容层；旧站点一次性转成静态页面存为第一个版本。T-128 到 T-144 已在主线跑通新路线。旧路线仍占大量代码（`lib/site-operations.ts` 3108 行、`lib/blocks/`、`lib/template-*`、`lib/site-document.ts`、`lib/site-migration.ts` 等），也是全套测试里 T-090、T-113 依赖本机旧数据和负载误报的来源。负责人 2026-10-09 要求按顺序先做这一项。

## What to build

1. **盘点**：列出只属于旧路线的代码、API 分支、组件、脚本（含 `check-published`）、测试、文档与 `vendor/` 的引用关系；找出新路线仍在用的共享部分（需求对齐、会话、图片与许可、署名、询盘线索存储、批注等），共享部分保留。盘点结果写进 Resolution，删除前先报给主控确认范围。
2. **转换旧站点**：只把批准清单里的 13 个主线演示站转成第一个版本，活跃代码只有中文 home，保留原 section 与顺序；旧英文保留在转换产物和源 JSON。作者「旧站转换」、事实状态「旧站转换未做模型校对」。离线 CLI 的可信输入走唯一提交入口清理与全部确定性检查，不调用 DeepSeek；不过则只存失败元数据，列表和打开显示「旧站转换失败：原因」，不存版本、不伪造默认站。已有 code-site 不覆盖，重跑不重复建版本。4 个含用户上传的旧站不转换、数据保留并显示明确未转换状态。PostgreSQL 新站存储不在本票范围。
3. **删除旧路线**：按已批准盘点移除旧代码、API 分支、组件、脚本、测试、夹具、字体、vendor 全部 23 个子模块及许可记录，不留兼容层或开关。主数据新增和清理的精确路径清单在本地验证完之后另报主控，主控确认后才操作主工作区；13 个演示源 JSON、4 个上传保护站及全部新路线数据保留。
4. 同步 AGENTS.md（去掉旧路线 check-published 的验收说明等）、`CONTEXT.md`（删除旧路线术语）、`mainline.md`、`spec.md`、`intent.md` 中已失效的内容；`MAP.md` 现状更新。

## Acceptance

- [x] 盘点清单与主控确认的删除范围写进 Resolution
- [x] 本机旧站点转换结果统计（成功、检查有问题、无法读取）写进 Resolution；抽查若干转换后的站点在工作台能打开、预览、对话修改、恢复版本，1440/375 截图看过；旧 JSON 未被改动
- [x] 旧路线代码、测试、文档已删除，`rg` 找不到残留引用；全套测试不再依赖本机旧站点数据
- [x] Astra 审查通过；typecheck、test、build 通过

## 负责人决定（2026-10-09）

- `vendor/` 整体移除（代码引用与目录、许可记录一起删）。
- 本机旧站点记录多为历次测试残留，「没用的话就清掉」：只把主线演示站（`check-published` 主线清单约十余个）转成新路线第一个版本；其余测试残留的旧站点记录及其关联的会话、批注、线索、风格检查目录清掉。删除前执行者先列出清单与数量交主控核对；含用户真实上传的不删。
- 主控确认第一段范围：批准代码清单和 13 站仅中文 home 转换、旧英文归档；失败导入只存元数据、不存版本。批准清理 8,372 个旧记录、关联 2,632 个会话目录、12 个 leads、153 个 public-material 上传目录、12 个 quality/p4、209 个无活动使用者的 profile，另含 7 个无归属会话目录和 1,058 个旧 shadow JSON；同 ID 新路线数据保留。顺序为 worktree 只读副本 Tracer bullet → 其余 12 站 → 删除旧代码/vendor → 测试/typecheck/build → 报正式写入/清理精确路径并等待最后确认。本票不扩建 PG 新站存储或英文功能，不派审查、不关票、不推送。

## Resolution

### INCOMPLETE / READY_FOR_ASTRA_REVIEW

执行者 t145-build。89feb29 的 Astra 审查为 NO_GO；按主控授权修复两项 P2、清除两项 P3 残留并同步文档，本轮技术验证 PASS，新的独立复审尚未进行。票保持 open，不派审查、不关票、不推送。初始 HEAD 56c6cef，按主控指令 fast-forward 到 94b64bf；原代码提交 89feb29，已批准的主数据执行记录提交 c31f76c。本轮修复另做一个本地提交，最终 SHA 见 artifacts/t145/astra-fixes/delivery.json。主工作区数据已经执行完毕，本轮不再读取、写入或清理它。

第一段盘点和第二段删除范围由主控在本会话明确确认，见「负责人决定」。转换只覆盖主线清单 13 个站，活跃版本仅中文 home；旧英文归档。失败不存版本，只保留可见失败元数据。主控已核对 artifacts/t145/main-data-plan.json，负责人明确同意新增 30 路径、清理 12,455 路径，最后确认门已通过。

### 最终实现与已批准范围

旧拼页、adapter、草稿、迁移、白名单 operation、受限样式、旧 quality 对照及其 API/组件全部移除。删除清单为 54 个旧 lib 文件及 site-store、141 个旧专用测试、27 个旧脚本、旧夹具、旧字体、visitor-host.css、23 个 vendor 子模块、.gitmodules、OPEN_SOURCE_TEMPLATES、旧模板许可研究记录和 Dockerfile 的 vendor COPY。显式路径见 [代码清单](../../artifacts/t145/code-inventory-94b64bf.json) 与 code-removal-complete.txt。vendor 副本没有 .git 元数据，git rm 将父工作树修改误判成子模块脏改动；只移除本 worktree 的 Gitlinks 和目录，未操作共享 .git/modules 或主工作区 vendor。

共享代码保留并改依赖：结构化需求问题、选择/确认与会话恢复；模型配置/图片分析；图片归属、许可、署名；系统图标和询盘线索；批注线程 CRUD；用户确认删除；资料导入、通用错误和 SMTP。所有站点存在性、列表、预览、发布与版本操作读同一个代码记录；新建只收 name，不写旧 shadow JSON，不隐式新建默认站。旧批注点改桥和选择性 operation 撤销已删除。原生 PostgreSQL 站点版本存储不在本票范围，未扩建或实测。

Deep modules：code-site-store 统一拥有代码记录、检查、版本与导入元数据；旧 site-store 整个删除。Ubiquitous language：转换、失败条目、上传保护站、完整版本在代码和当前文档使用同一含义。confirm_ops 只是既有代码会话的持久化确认标识，不包含旧 schema、执行器或兼容分支。

离线导入 CLI 使用 commitSiteCode 的可信输入；公开 PUT 的严格 schema 拒绝导入字段，普通生成、手改与恢复继续做模型事实校对。导入执行清理、结构/链接/图片许可、数字/联系方式及 375/768/1440 溢出、重叠、对比度和行长检查，不调用模型，明确记录旧站转换未做模型校对。检查不通过不存版本；失败或保护元数据与正常站点在同一存储列举，打开返回同一原因，无默认草稿、假预览。

已有记录不覆盖。首次记录从完整临时文件采用不可覆盖的原子发布，防止浏览器检查期间另一进程先建记录；导入会话采用每站固定 legacy-import 标识，重复/中断执行不增会话。重跑失败元数据仍返回失败，不误报 CLI 成功。SITECRAFT_DATA_ROOT 是验证和离线导入进程的实际数据根目录配置，不能由 HTTP 请求改变。

### 转换与数据保护

源数据为 /Users/luckye/Documents/Code/sitecraft-ai/.sitecraft-data。13 个 ID 来自主工作区 artifacts/handoff/mainline-12-sites.txt（实际 13 项，非旧脚本 DEFAULT_SITES 的 3 项），每个 source JSON 用独立只读副本验证，未调用会写回迁移的旧 store。精确 ID、目录与前缀清单见 [数据盘点](../../artifacts/t145/data-inventory-94b64bf-v2.json)。

Tracer bullet 为 561a1113-4dab-49b6-81dc-ab7e3eb712a5 的 5 产品注塑制造站：只读源 → 旧 bridge 已填 DOM → 提交入口 → 首版 → 工作台/预览 → 对话修改 → 恢复/刷新 → 幂等。随后导出其余 12 站，再删除旧代码/vendor。旧渲染的来源内容核对中英文均缺项 0；中文 home 保留实际 section 与顺序，不根据旧计划的三个 section 编造三页。英文仅保存到各 export 目录的 en-original/en-static 与源 JSON。

初次转换暴露数字读取把独立单元格 NAK80 与 1 拼成 NAK801 的根因；在正文读取层加入语义容器边界，不放宽数字规则。同源参数条目计数由源数组提供，不从渲染结果生成答案。初次拒收、未完成源计数、导出脚本转义错误、启动参数及截图等待失败产物都保留；最终证据不引用它们为 PASS。旧浏览器 helper 的非本轮 orphan 回收已删除，最终浏览器只管理自己启动的进程。

最终候选在全新隔离目录 artifacts/t145/final-data 重跑：13/13 应用，确定性失败 0、无法读取 0；39 个页面/视口结果均无溢出、重叠或对比度问题。各站首版作者为旧站转换，事实状态为未做模型校对。重复 CLI 返回 13 个 existing，不新增版本。4 个上传保护站只建未转换状态元数据，未读取或改写其图片/原站数据；列表/打开原因一致。

### 原实现证据（89feb29）

命令均在本票实现之后运行；各产物的 UTC 完成时间见 artifacts/t145/verification-summary.json。最终生产实现对应 89feb29；下面产物含时间、命令或可复现脚本。worktree 浏览器验证使用 AGENTS 指定的 chrome-headless-shell 154，Turbopack、3154、SITE_STORE=fs。没有真实 DeepSeek、外部邮件、PG、部署或实机验证；对话链使用明确标记的本地 HTTP 模型替身，只证明协议与真实提交边界，不证明真实模型生成质量。

- 创建契约红：node --test --experimental-strip-types tests/t145-code-only-entry.test.ts → entry-contract-red.txt，旧接口仅 name 返回 400，而要求 201；最终同用例通过。entry-red.txt 是最初 cwd/scan 设置失败，未算契约红。
- 数字边界红/绿：CHROME_PATH=<指定路径> node --test --experimental-strip-types tests/t145-legacy-import.test.ts → cell-boundary-red.txt / cell-boundary-green.txt；来源 NAK80 与 1 独立，旧读取误造 801。边界修正后同检查通过。
- 最终反证：python3 artifacts/t145/import-mutants.py artifacts/t145/final-mutants-complete → 三个坏实现均在行为断言失败：覆盖已有导入记录（同时移除 lookup 和原子发布保护）、失败也存版本、普通 PUT 跳过事实校对。输出保留对应 -red.txt 与 import-mutants.json。只移除 lookup 的 mutant 被原子发布保护拦住，保留在 final-mutants，不伪称它破坏了行为。
- CLI 失败重跑反证：把重复失败的退出码判断改成只识别 unavailable 后，node --test --experimental-strip-types tests/t145-import-cli.test.ts 失败，见 failed-cli-rerun-mutant-red.txt；正确实现包含在最终全量。
- 导入：CHROME_PATH=<指定路径> SITECRAFT_DATA_ROOT=<本 worktree>/artifacts/t145/final-data SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:3154 node --experimental-strip-types scripts/import-legacy-site-code.ts --input artifacts/t145/exports-batch/candidates.json --out artifacts/t145/final-import-fresh.json；同输入重跑 → final-import-repeat.json；保护条目 → final-protected-fresh.json。final-import.json 是原验证目录的 existing 观察，不用作重新检查证据。
- 真实 HTTP 对话/恢复：node artifacts/t145/tracer-flow.mjs --out artifacts/t145/final-tracer-flow.json → PASS，版本 1→2→3，恢复后刷新与五产品保留。模型仅 localhost 3155 替身，调用日志在 local-provider-calls.ndjson，没有 DeepSeek 请求。
- 最终浏览器：CHROME_PATH=<指定路径> node --experimental-strip-types artifacts/t145/capture-final.ts → final-ui/report.json；三家公司发布页 1440/375、工作台 1440/768/375 共 9 张，全部打开记录在 viewed.json；保护条目 4/4 一致。最后的工具条包含性修正后另跑 capture-toolbar.ts，三档按钮在工具条内、不越界，截图逐张打开。本执行者仅自查，不给独立审美 verdict。
- 全量：CHROME_PATH=<指定路径> SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:3154 npm test → npm-test-final-toolbar.txt，232/232、失败/取消/跳过均 0；typecheck → typecheck-last.txt；SITE_STORE=fs npm run build → build-delivery.txt。首轮及隔离数据服务与 handler 数据根不一致的运行失败保留，不引用旧通过产物替代最终结果。
- retired-reference-last.txt：限定 lib/app/components/scripts/tests 的旧模块引用扫描 0 行；没有保留旧运行开关。历史研究/票不为零命中改写。原资料照片、系统图标、规范来源许可保留。UTF-8 回读、git diff --check、project-map status 通过；没有 hashes 或字节/像素比较。

### 正式主数据：PASS

[精确路径清单](../../artifacts/t145/main-data-plan.json) preparedAt 2026-10-09T15:41:21Z，保留原准备产物不改写。主控核对并批准后，于 2026-10-10T03:53:33Z–03:54:03Z 正式执行，生产代码仍为 89feb29。执行前与导入后重新核对上传、新路线归属和活动 profile；30 个新增目标均不存在，4 个保护站仍排除，1,079 个已有代码记录没有归属冲突，209 个 profile 无活动使用者。

| 操作 | 实际结果 |
| --- | --- |
| 新增代码记录 | 13 个转换首版 + 4 个保护元数据，共 17 个文件；没有覆盖已有文件 |
| 新增导入会话 | conversations/<13 演示 ID>/legacy-import.json，共 13 个文件 |
| 删除旧记录 | sites 9,430 个 JSON（8,372 残留 + 1,058 shadow） |
| 删除旧会话 | 2,639 个目录（2,632 关联 + 7 无归属） |
| 删除其他残留 | leads 12 文件、public-material uploads 153 目录、quality/p4 12 文件、site-style-check 209 目录；annotations 0 |
| 合计 | 新增 30、删除 12,455、跳过 0、失败 0；清单外操作 0 |

13/13 转换通过完整确定性检查，失败 0、无法读取 0；39 个页面/视口检查无溢出、重叠或对比度问题。每站只有中文 home 和第 1 版，作者为旧站转换、事实状态为旧站转换未做模型校对。4 个保护站只新增未转换元数据，不生成版本。1,079 个既有新路线 JSON 按数据内容核对未变，13 个原演示 JSON 与只读副本仍一致；对清单外 2,302 个既有文件核对路径及文件元数据，没有消失或改动，没有意外新增文件。4 个保护站原数据、同 ID 新路线会话与上传全部保留。主数据现有 code-sites 1,096 个，旧 sites 只余 13 个演示源与 4 个保护源。

正式命令与证据：

- `python3 artifacts/t145/main-apply/apply-main-data.py --preflight` → preflight.json；`--apply` → [执行汇总](../../artifacts/t145/main-apply/application.json)。脚本只按已批准绝对路径执行，通过现有 `scripts/import-legacy-site-code.ts` / commitSiteCode 导入；没有直接复制验证版本。CLI 命令、退出码与结果见 import-demos.json、import-protected.json，均退出 0。删除逐项记录在 deletions.ndjson，每个目标检查当前归属，上传目录及 profile 在删除前再查保护/活动状态，不停止他人进程、不做前缀通配符删除。
- postcheck.json 核对删除日志与批准清单的路径集合一致：12,455 条均已删除，无重复、无名单外路径，30 个批准新增文件均存在，失败项为空。
- 本分支以 `SITE_STORE=fs SITECRAFT_DATA_ROOT=/Users/luckye/Documents/Code/sitecraft-ai/.sitecraft-data SITECRAFT_BASE=http://127.0.0.1:3155 npm run dev -- --port 3155` 启动 Turbopack；CHROME_PATH 为 AGENTS 指定路径，模型密钥环境变量为空。`CHROME_PATH=<指定路径> node --experimental-strip-types artifacts/t145/main-apply/inspect-main.ts` → ui/report.json，2026-10-10T03:55:32Z 完成。从实际列表链接打开 561a1113-4dab-49b6-81dc-ab7e3eb712a5 与 89f55641-6e28-45c4-a9f9-440a94171d3c：draft/预览均 200，工作台显示第 1 版及未模型校对标记，375 预览分别保留源资料的 5、2 个产品。保护站 blind-p3i-20260920-withimage 在列表与打开页都显示「旧站点未转换，含用户上传，已保留」，draft 返回 422 且无默认预览。8 张截图全部打开，见 ui/viewed.json；17 个新增记录在抽查前后未变。

主控已在执行前实时核对：删除清单中的会话与 code-site 同编号为 0 条，153 个上传目录的 290 张图片均有元数据，因此本次数据执行安全；一次性 prepare-main-data-plan.py 不修改、不重跑。3155 临时服务已停止；3034 未操作。主数据执行阶段未改生产代码，未调用 DeepSeek、未推送、未关票。此处 PASS 只指已授权的主数据执行与技术抽查。

### 审查修复与当前证据

本轮只修复主控转交的 89feb29 审查项，不扩展导入范围、存储或功能。Tracer bullet 为离线 CLI 的混合批次：三个结构错误候选 → 提交入口 → 失败条目；后续有效候选 → 确定性检查 → 第一个版本。Deep modules：检查器区分候选结构失败与浏览器执行故障，提交入口继续负责保存元数据，CLI 无新兼容分支或捕获全部异常的后备路径。Ubiquitous language：仍使用转换失败条目、完整版本、新建站点。

- P2 结构失败：实际渲染文档缺少 main 内的 h1 时返回检查失败，由 commitSiteCode 存「旧站转换失败：原因」，没有版本。非 HTML 的浏览器文档仍作为执行故障报错。新测试经真实 CLI 与 Chrome 处理缺 main、缺 h1、h1 在 main 外三个 schema 合法候选，逐一核对磁盘失败元数据；后续有效站正常存首版，整批仍退出 1。
- P2 查询导航：工作台通过 Next 的 useSearchParams 响应查询变化，重新加载时清除上一入口状态/错误；按站点编号重建工作台状态。按当前 Next 16.3.1 随包指南添加 Suspense，生产构建通过。新测试用 Chrome 的 Input.dispatchMouseEvent 点击实际「新建站点」链接，验证当前文档保持、URL 换为新 ID、真实 draft 可读、刷新保持 ID；三档各自创建不同站点。测试先核对开发服务 cwd，拒绝写其他工作区。
- P3：删除 visitor-layout-scan.js 对已删 hero-word-break-scan.js / check-published 的同步说明，以及 globals.css 的无调用 legacy-look-warning。实际 AGENTS 验收第 2 条在 89feb29 已无旧 check-published 句子；本轮核对其缺席并补上结构检查。intent.md 与 MAP 写入已完成的主数据现状，解除 intent.md 复核提示；CONTEXT、mainline、spec 同步结构失败和查询导航的当前契约。

以下检查均在本轮修复后运行，生产实现对应包含本节的本地修复提交（父提交 c31f76c）；UTC 时间、命令、退出码和产物路径见 artifacts/t145/astra-fixes/verification.json。测试数据只在本 worktree 的 .sitecraft-data 或 artifacts 隔离目录，开发服务为 3154 / Turbopack / SITE_STORE=fs，CHROME_PATH 使用 AGENTS 指定的 chrome-headless-shell；未启动指向主数据的服务，没有 DeepSeek 请求。

- 修复前红：`node --test --experimental-strip-types tests/t145-import-cli.test.ts tests/t145-workspace-navigation.test.ts` → regression-red.txt，退出 1。新 CLI 用例因 missing-main 没有失败记录而失败，report 只有 executionError；导航用例真实点击后 URL 为 ?new=1、仍显示「打开一个站点」，documentRetained=true。失败目录为 cli-structure-24ec6e57-33f3-4601-b250-e864a34586c0、workspace-navigation-3c4431e5-5572-4330-b947-af5c781a8d2e，失败截图已打开。
- 修复后相关：同两文件加 `tests/t145-legacy-import.test.ts tests/workspace-new-site-entry.test.ts` → regression-green.txt，13/13，退出 0；无模型导入、普通 PUT 的事实校对、幂等与上传保护既有行为仍通过。
- 最终全量：`CHROME_PATH=<指定路径> SITE_STORE=fs SITECRAFT_DATA_ROOT= SITECRAFT_BASE=http://127.0.0.1:3154 DEEPSEEK_API_KEY= AI_API_KEY= npm test` → npm-test-final.txt，234/234、失败/取消/跳过均 0。CLI 结构批次完整结果在 cli-structure-a2cda5e8-3337-43b0-8424-4bf07e23e5b8；Chrome 导航报告在 workspace-navigation-a68c0e07-13fd-4c00-9f91-d1e660844cca，1440/768/375 三张截图全部打开。此前全量的 768 图在预览切换动画中保存，产物保留，不作为有效截图；测试补上预览状态与动画结束等待后重跑得到最终三图。
- `npm run typecheck` → typecheck-final.txt，退出 0；`SITE_STORE=fs SITECRAFT_DATA_ROOT= DEEPSEEK_API_KEY= AI_API_KEY= npm run build` → build-final.txt，退出 0。UTF-8 回读、git diff --check 和 project-map status 通过，Problems 0、stale living docs 0。

本轮修复与测试技术 PASS，不代表 Astra 复审或独立审美通过。主数据和一次性执行产物保持不动，不推送、不关票。

## 合并验收（Claude，2026-10-10）

Astra 首审 89feb29 NO_GO（P1 两项为一次性数据脚本，主控执行前实时核对通过；P2 两项、P3 两项在 8c1c0db 修复），复审 c31f76c..8c1c0db PASS。合并为 2ec5e14；主工作区删除未跟踪的 vendor/ 与 .git/modules/vendor（负责人决定整体移除）。主工作区 npm ci 后重启 3034：`npm run typecheck` 退出 0；`SITECRAFT_BASE=http://127.0.0.1:3034 CHROME_PATH=<AGENTS 指定路径> npm test` 234/234；`SITE_STORE=fs npm run build` 退出 0，输出在 artifacts/merge-2ec5e14/。主控查看了 561a1113 转换站工作台截图（第 1 版、旧站转换未做模型校对）。

