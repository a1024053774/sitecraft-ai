---
id: T-145
title: 删除旧区块库路线，旧站点一次性转成新路线的第一个版本
type: build
status: open
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
- [ ] 本机旧站点转换结果统计（成功、检查有问题、无法读取）写进 Resolution；抽查若干转换后的站点在工作台能打开、预览、对话修改、恢复版本，1440/375 截图看过；旧 JSON 未被改动
- [x] 旧路线代码、测试、文档已删除，`rg` 找不到残留引用；全套测试不再依赖本机旧站点数据
- [ ] Astra 审查通过；typecheck、test、build 通过

## 负责人决定（2026-10-09）

- `vendor/` 整体移除（代码引用与目录、许可记录一起删）。
- 本机旧站点记录多为历次测试残留，「没用的话就清掉」：只把主线演示站（`check-published` 主线清单约十余个）转成新路线第一个版本；其余测试残留的旧站点记录及其关联的会话、批注、线索、风格检查目录清掉。删除前执行者先列出清单与数量交主控核对；含用户真实上传的不删。
- 主控确认第一段范围：批准代码清单和 13 站仅中文 home 转换、旧英文归档；失败导入只存元数据、不存版本。批准清理 8,372 个旧记录、关联 2,632 个会话目录、12 个 leads、153 个 public-material 上传目录、12 个 quality/p4、209 个无活动使用者的 profile，另含 7 个无归属会话目录和 1,058 个旧 shadow JSON；同 ID 新路线数据保留。顺序为 worktree 只读副本 Tracer bullet → 其余 12 站 → 删除旧代码/vendor → 测试/typecheck/build → 报正式写入/清理精确路径并等待最后确认。本票不扩建 PG 新站存储或英文功能，不派审查、不关票、不推送。

## Resolution

### INCOMPLETE / READY_FOR_MAIN_DATA

执行者 t145-build。代码与 worktree 技术验证 PASS；主工作区正式数据新增、清理，以及主控另派的独立审核尚未执行。票保持 open，不派审查、不关票、不推送。初始 HEAD 56c6cef，按主控指令 fast-forward 到 94b64bf；本票代码、测试与文档合并为一个本地提交，最终 SHA 写入 gitignore 的 artifacts/t145/delivery.json。

第一段盘点和第二段删除范围由主控在本会话明确确认，见「负责人决定」。转换只覆盖主线清单 13 个站，活跃版本仅中文 home；旧英文归档。失败不存版本，只保留可见失败元数据。主数据最后确认门来自主控第 6 项指令，不能以已批准删除范围替代实际路径确认。

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

### 本次证据

命令均在本票实现之后运行；各产物的 UTC 完成时间见 artifacts/t145/verification-summary.json。最终生产实现对应本票唯一提交；下面产物含时间、命令或可复现脚本。浏览器使用 AGENTS 指定的 chrome-headless-shell 154，Turbopack、3154、SITE_STORE=fs。没有真实 DeepSeek、外部邮件、PG、部署或实机验证；对话链使用明确标记的本地 HTTP 模型替身，只证明协议与真实提交边界，不证明真实模型生成质量。

- 创建契约红：node --test --experimental-strip-types tests/t145-code-only-entry.test.ts → entry-contract-red.txt，旧接口仅 name 返回 400，而要求 201；最终同用例通过。entry-red.txt 是最初 cwd/scan 设置失败，未算契约红。
- 数字边界红/绿：CHROME_PATH=<指定路径> node --test --experimental-strip-types tests/t145-legacy-import.test.ts → cell-boundary-red.txt / cell-boundary-green.txt；来源 NAK80 与 1 独立，旧读取误造 801。边界修正后同检查通过。
- 最终反证：python3 artifacts/t145/import-mutants.py artifacts/t145/final-mutants-complete → 三个坏实现均在行为断言失败：覆盖已有导入记录（同时移除 lookup 和原子发布保护）、失败也存版本、普通 PUT 跳过事实校对。输出保留对应 -red.txt 与 import-mutants.json。只移除 lookup 的 mutant 被原子发布保护拦住，保留在 final-mutants，不伪称它破坏了行为。
- CLI 失败重跑反证：把重复失败的退出码判断改成只识别 unavailable 后，node --test --experimental-strip-types tests/t145-import-cli.test.ts 失败，见 failed-cli-rerun-mutant-red.txt；正确实现包含在最终全量。
- 导入：CHROME_PATH=<指定路径> SITECRAFT_DATA_ROOT=<本 worktree>/artifacts/t145/final-data SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:3154 node --experimental-strip-types scripts/import-legacy-site-code.ts --input artifacts/t145/exports-batch/candidates.json --out artifacts/t145/final-import-fresh.json；同输入重跑 → final-import-repeat.json；保护条目 → final-protected-fresh.json。final-import.json 是原验证目录的 existing 观察，不用作重新检查证据。
- 真实 HTTP 对话/恢复：node artifacts/t145/tracer-flow.mjs --out artifacts/t145/final-tracer-flow.json → PASS，版本 1→2→3，恢复后刷新与五产品保留。模型仅 localhost 3155 替身，调用日志在 local-provider-calls.ndjson，没有 DeepSeek 请求。
- 最终浏览器：CHROME_PATH=<指定路径> node --experimental-strip-types artifacts/t145/capture-final.ts → final-ui/report.json；三家公司发布页 1440/375、工作台 1440/768/375 共 9 张，全部打开记录在 viewed.json；保护条目 4/4 一致。最后的工具条包含性修正后另跑 capture-toolbar.ts，三档按钮在工具条内、不越界，截图逐张打开。本执行者仅自查，不给独立审美 verdict。
- 全量：CHROME_PATH=<指定路径> SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:3154 npm test → npm-test-final-toolbar.txt，232/232、失败/取消/跳过均 0；typecheck → typecheck-last.txt；SITE_STORE=fs npm run build → build-delivery.txt。首轮及隔离数据服务与 handler 数据根不一致的运行失败保留，不引用旧通过产物替代最终结果。
- retired-reference-last.txt：限定 lib/app/components/scripts/tests 的旧模块引用扫描 0 行；没有保留旧运行开关。历史研究/票不为零命中改写。原资料照片、系统图标、规范来源许可保留。UTF-8 回读、git diff --check、project-map status 通过；没有 hashes 或字节/像素比较。

### 正式主数据：等待最后确认

[精确路径清单](../../artifacts/t145/main-data-plan.json) preparedAt 2026-10-09T15:41:21Z，状态 AWAITING_CONTROLLER_APPROVAL：

| 操作 | 路径类别与数量 |
| --- | --- |
| 新增 | code-sites/<13 演示 ID>.json、code-sites/<4 保护 ID>.json，共 17 个记录；conversations/<13 演示 ID>/legacy-import.json，共 13 个会话；合计 30 路径 |
| 清理旧记录 | sites 下 9,430 个 JSON（8,372 残留 + 1,058 shadow） |
| 清理会话 | 2,639 个目录（2,632 关联 + 7 无归属） |
| 其他清理 | leads 12 文件、public-material uploads 153 目录、quality/p4 12 文件、site-style-check 209 目录 |

拟清理合计 12,455 个顶层精确路径；没有 code-sites 删除路径。准备时所有目标仍存在、没有新增保护/新代码冲突导致跳过，没有进程使用旧 profile；主数据 1,079 个既有新路线记录全部保留。13 个主源 JSON 与只读副本按数据内容核对未变化，4 个上传保护站的全部数据排除。正式执行前重新查保护关系、现有代码记录与活动 profile，名单外新数据保留，不做前缀通配符删除。

本段只准备清单，没有正式写入或删除主工作区任何用户数据。等待主控确认这份精确清单后才执行；独立 Astra/审美验收由主控安排，执行者不派、不关票、不推送。
