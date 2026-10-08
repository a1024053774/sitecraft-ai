---
id: T-129
title: 版本历史面板（Notion 式）：左侧按时间分组，右侧预览，可恢复、可命名
type: build
status: open
blocked_by: [T-128]
claimed_by: t129-build
supersedes:
---

## What to build

工作台打开「版本历史」：左侧列出这个站的所有版本，可按 1 分钟 / 10 分钟 / 1 小时 / 天分组，每条显示时间、作者（你 / 助手）、一句话摘要、检查状态，可以给版本命名并在列表里标出；右侧显示所选版本的预览，可切 1440 / 768 / 375，当前版本有标记。点「恢复到这个版本」生成一个新版本，原有版本都不丢。模型能读旧版本：在对话里说「产品区改回某个版本那样」，它从旧版本取回那部分并提交为新版本。

## Acceptance

- [x] 在有 10 个以上版本的站点上：分组切换、预览切换、命名、恢复都在 1440/768/375 截图里看得到并逐张看过
- [x] 恢复后版本数加一，被恢复内容与旧版本一致，之后的版本仍在列表里
- [ ] 对话「把某区改回某版本那样」用真实 DeepSeek 跑通一次，结果截图
- [ ] Astra 代码审查通过；typecheck、test、build 通过

## Resolution

执行者：t129-build；基于 07c0e61，分支 t129-version-panel。Astra 对 f0035fb 判 NO_GO：V20 型号被正则误当成版本编号；并要求修正 DST 分桶、强化区域恢复证据。已按主控改为模型结构化选择参考版本，相关 50 项、默认 Turbopack build/typecheck 与三档面板检查 PASS；复审由主控安排。真实 DeepSeek 新选择与写作路径仍 BLOCKED（HTTP 402），票保持 open，不推送；全量 npm test 由主控合并后在主工作区执行。实现与本文合在本票唯一的本地提交（本次 amend）；提交标识通过 `git log -1 --format=%H -- .project-map/tickets/T-129-version-history-panel.md` 读取。

### 实现

- 版本历史从既有工作台状态读完整版本，沿用 `code-preview` 的指定版本沙盒；按本地时间的 1 分钟、10 分钟、1 小时、天分组，显示时间、作者、摘要、检查状态、名称与当前版本标记，支持各页和三档宽度。分钟/小时桶保留各自 UTC 偏移，标题显示偏移，回拨的相同墙上时间不合并；天仍按本地日期。375 用上下两区，列表与预览各自滚动。
- `PATCH versions/<versionId>` 只修改名称元数据；名称最多 80 字，空串清除，不改代码、请求、检查、修订号或当前版本 ID。与提交共用站点锁，拒绝附带代码的请求。
- `POST history/restore` 扩展既有历史入口，携带 `versionId` 与 `baseRevision`，恢复调用原 `commitSiteCode`；过期 409，检查拒绝 422，不存版、不回退。通过后新增完整版本，保留全部历史。
- 每次对话修改，模型先读版本目录（编号、名称、摘要、时间、作者，不含代码），在 `referenceRevisions` 数组中声明参考编号，可为空；系统不从用户消息解析编号或判断型号。系统先校验全部声明，再取出完整旧代码给写作步骤作为不可信数据，并把合法 ID 保存到运行记录；修正轮次沿用同一参考。不存在的声明结束后台任务、在进度和对话里报错，不调用写作、不存版。生成、写作、修正、提交入口保持原路径；未加入风格卡、批注、截图打磨、英文、旧路线删除或新依赖。

### 本次证据

环境：工作树 `/Users/luckye/Documents/Code/sitecraft-ai-t129`，SITE_STORE=fs，真实 Next 入口 http://127.0.0.1:3141，CHROME_PATH 使用负责人指定的 chrome-headless-shell。主控已把 node_modules 软链换成本工作树的真实 npm ci；执行者使用默认 Turbopack，不再传 `--webpack`，也未修改 Next 配置。之前软链与 Webpack 的失败输出先另存至 `artifacts/t129/before-turbopack-20261008T024910Z/`，再更新同名验证输出。首次改回默认启动后，typecheck 仍读到旧 guard，输出保留为 `typecheck-turbopack-initial.txt`；停掉自有服务，把旧 `.next` 移至 `.artifact-work/next-webpack-20261008T025259Z`，由默认 Turbopack 重新生成全部缓存与类型后通过。旧缓存仅作可恢复的环境保留，不作验收证据。

| 验收项 | 状态与证据 |
| --- | --- |
| 超过 10 版的面板、分组、预览、命名、恢复与刷新 | PASS（受控事实校对）：默认 Turbopack 的 `artifacts/t129/astra-fix-ui/report.json`，2026-10-08T03:24:00.774Z–03:24:30.942Z。初始 22 版；三档各 8 张截图，24 张全部逐张打开，记录 `astra-fix-ui/viewed.json`。分钟/小时的 GMT 偏移标题可见；命名、恢复和刷新控件没有横向溢出。此前 UI 输出全部保留，不覆盖。 |
| 恢复一致、版本加一、之后的版本保留 | PASS（受控事实校对）：同一 report 的三次恢复分别 22→23、23→24、24→25，逐次断言新增代码与第 3 版完整代码一致、restoredFrom 指向第 3 版、原有 ID 全保留。原提交入口每次重新跑三页 × 三宽 Chrome 检查，溢出、重叠、对比度、行长均为 0，结果随版本和 report 保存；事实校对 HTTP 受控，不冒充真实事实审核。 |
| 对话区域恢复用真实 DeepSeek 跑通 | BLOCKED：先前 2026-10-08T02:18 真实写作尝试返回 HTTP 402，未存版，记录为 `artifacts/t129/real-reference/report.json` / `outcome-1440.png`。按主控指令本次不重试；新增模型版本选择阶段尚未真实跑通，不引用旧调用证明新路径。 |
| Astra 与仓库检查 | 本地 typecheck / build / 50 项相关检查 PASS；f0035fb 的 NO_GO 已修正，独立复审 INCOMPLETE，由主控安排。全量 npm test 留给主控合并后执行。 |

验收站 `1f8a5a6b-a1d1-42af-898f-6e0b086a3d35` 的初始 11 版均通过真实 draft PUT handler → `commitSiteCode` → Chrome → 存储创建，未旁路写版本。资料与站点代码是明示的手改夹具；初始 fixture 的规划与事实校对 HTTP 在测试进程受控。面板浏览器脚本起独占 3141 的真实 Next 服务，只有事实校对 HTTP 受控，writer 请求会明确返回 503，不生成假模型结果。真实调用单独使用实际密钥配置的服务。

- 原契约红：`CHROME_PATH=<指定路径> T129_ARTIFACT_DIR=artifacts/t129 node --test --experimental-strip-types tests/t129-version-history.test.ts` → `contract-red.txt`，恢复 404 与缺少旧版本上下文，exit 1。
- 反事实：`mutants/report.json` 记录 2026-10-08T02:22:15Z–02:23:09Z 的四个定向变异，均 exit 1，逐项 AssertionError 在同名 txt；分别使命名修改 footer、分组恒为天、修正调用省略 references、恢复改用当前修订号。各变异跑 `node --test --experimental-strip-types --test-name-pattern=<对应测试名称> tests/t129-version-history.test.ts`，finally 恢复源码，没有复制源码作证据。
- 本轮审查红：`CHROME_PATH=<指定路径> node --test --experimental-strip-types tests/t129-version-history.test.ts` → `astra-fix/red.txt`，f0035fb 上 V20 返回 400（应正常接受）、两次 01:55 合并、缺失模型声明阶段、无效声明继续存版，exit 1。原始红与历史变异保留，不覆盖。
- 新坏实现：`astra-fix/mutants/report.json` 与四份同名 txt，均 exit 1：取错版本/不用旧代码都在实际存版产品区应为第 3 版表格处失败；修正调用丢参考、DST 合并也失败。每项执行 `node --test --experimental-strip-types --test-name-pattern=<对应测试名称> tests/t129-version-history.test.ts`，finally 还原源码；时间 2026-10-08T03:19:32Z–03:19:51Z。
- 最终相关检查：`CHROME_PATH=<指定路径> node --test --experimental-strip-types tests/t129-version-history.test.ts tests/t128-code-boundary.test.ts` → `astra-fix/related-final.txt`，50/50，exit 0，在四项变异全部还原之后运行。成对回归经真实 chat handler → 模型 HTTP 边界（受控）→ 写作 → 提交入口 → Chrome → 文件存储；V20 正常修改且参考为空，第 3 版参考回收旧表格与产品间距，首页/联系/页头页脚/当前 V20 与加工区保留。预期来自手改输入；受控 writer 消费实际传入的旧代码，未返回硬编码答案。不存在的模型声明报错，写作调用和存版均为 0。DST 覆盖纽约 2026-11-01 的 01:55 -04:00 / -05:00，分钟、10 分钟、小时各为两桶，天仍一桶。
- 面板复现：先用上面的 T129 测试命令生成 fixture；3141 空闲时运行 `SITECRAFT_BASE=http://127.0.0.1:3141 T129_RUN_NAME=<新输出目录> CHROME_PATH=<指定路径> node --experimental-strip-types scripts/check-version-history.mjs --controlled`。脚本使用默认 Turbopack，运行会新增恢复版本与修改标签，服务与 Chrome 只关闭自己启动的进程。
- 全量 `npm test` 按既定做法由主控合并后在主工作区执行；两项固定本机资料仅在主工作区存在，独立工作树不复制这些记录，也不为此另开工具票。先前的全套失败与四项服务就绪后的针对性复验保留在 `npm-test-final.txt` / `warm-failures.txt`，属于历史，不替代主控的合并后全量验收，也不作为本票本地阻塞。
- 默认构建：`npm run build` → `astra-fix/build-final.txt`，exit 0，Turbopack 编译、类型验证与页面生成通过；随后顺序运行 `npm run typecheck` → `astra-fix/typecheck-final.txt`，exit 0。没有 `--webpack`、ignoreBuildErrors 或源码类型规避；旧文件均保留。

本次输出结束时间（UTC）：审查红 2026-10-08T03:14:23Z；相关检查 03:24:38Z；三档 UI 03:24:30Z；默认构建 03:26:16Z；typecheck 03:26:50Z。最终验证之后没有再改生产代码。

### 还差什么

负责人补足 DeepSeek 余额，按原要求 source 主工作区 `.env.local`，在 3141 启动真实配置服务后，运行 `SITECRAFT_BASE=http://127.0.0.1:3141 T129_RUN_NAME=real-funded CHROME_PATH=<指定路径> node --experimental-strip-types scripts/check-version-history.mjs --real-reference --reference-revision 11`，再逐张查看结果，核对产品区采用旧版、其余区域保留。使用第 11 版是因为当前验收站已经完整恢复到第 3 版，第 11 版与当前内容有差异；脚本拒绝相同代码作为有效修改场景。真实存版也只说明调用完成，脚本仍标 INCOMPLETE，直到区域正确性得到实际核对。新输出目录保留原 402 失败证据。Astra 与独立视觉审核由 Claude 安排；本执行者未宣布审美通过。

T-128 已知的 line-height:0 完全重叠与 filter 后对比度限制保持原样，本票未扩大底线检查范围。
