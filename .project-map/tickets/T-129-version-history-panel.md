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
- [x] 对话「把某区改回某版本那样」用真实 DeepSeek 跑通一次，结果截图
- [x] Astra 代码审查通过；typecheck、test、build 通过

## Resolution

原实现由 t129-build 执行，Astra 复审通过并合并为 52c0df6，合并验收见下。此次 followup 从本地主线当前 HEAD e14d171 建分支 t129-followup，处理非法编号的中文提示并补跑真实模型。中文提示与通用交互检查及本地 57 项检查、默认 Turbopack build/typecheck PASS。充值后真实 DeepSeek 仅发送一次修改请求，选中第 11 版并存为第 27 版。主控已判定：请求“产品区”没有限定页面，首页“产品与加工”入口同属产品区，一并恢复成第 11 版是合理理解，按通过处理。按该范围重放已存 v26/v27，产品区外均保持，真实项已勾选；票保持 open，关票交主控，不重发模型请求、不推送。本次代码、测试与文档合在一个本地提交（amend）；提交标识用 `git log -1 --format=%H -- .project-map/tickets/T-129-version-history-panel.md` 读取。

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
| 对话区域恢复用真实 DeepSeek 跑通 | PASS（主控范围判定 + 已存版本重放）：原真实调用 `artifacts/t129/followup-real-ready/report.json`，2026-10-08T05:26:28.535Z–05:26:57.636Z，真实选择第 11 版、写作和事实校对通过、26→27。主控确认首页产品入口也在未点名页面的“产品区”范围内。加强的断言读取 v26/v27/参考 v11，`artifacts/t129/visibility-recheck/report.json` 为 PASS：首页与产品页产品区匹配 v11；范围外规范化 outerHTML（含 href、全部属性）整段保持，链接、按钮、询盘及输入控件的可见性、非零布局矩形与中心命中结果前后一致。三页共 15 个范围外交互元素的三项结果均为 true。工作台及产品页三档、当前/旧版对照共 8 张全部看过，`followup-real-ready/viewed.json` 保留。旧失败与较弱的检查结果不覆盖；本次没有新模型请求或存版。 |
| Astra 与仓库检查 | 原实现 Astra PASS，合并后全量 2554/2554；此次中文错误提示与交互检查修复及本地 57 项、默认 build/typecheck PASS。后续合并与检查由主控安排。 |

验收站 `1f8a5a6b-a1d1-42af-898f-6e0b086a3d35` 的初始 11 版均通过真实 draft PUT handler → `commitSiteCode` → Chrome → 存储创建，未旁路写版本。资料与站点代码是明示的手改夹具；初始 fixture 的规划与事实校对 HTTP 在测试进程受控。面板浏览器脚本起独占 3141 的真实 Next 服务，只有事实校对 HTTP 受控，writer 请求会明确返回 503，不生成假模型结果。真实调用单独使用实际密钥配置的服务。

- 原契约红：`CHROME_PATH=<指定路径> T129_ARTIFACT_DIR=artifacts/t129 node --test --experimental-strip-types tests/t129-version-history.test.ts` → `contract-red.txt`，恢复 404 与缺少旧版本上下文，exit 1。
- 反事实：`mutants/report.json` 记录 2026-10-08T02:22:15Z–02:23:09Z 的四个定向变异，均 exit 1，逐项 AssertionError 在同名 txt；分别使命名修改 footer、分组恒为天、修正调用省略 references、恢复改用当前修订号。各变异跑 `node --test --experimental-strip-types --test-name-pattern=<对应测试名称> tests/t129-version-history.test.ts`，finally 恢复源码，没有复制源码作证据。
- 本轮审查红：`CHROME_PATH=<指定路径> node --test --experimental-strip-types tests/t129-version-history.test.ts` → `astra-fix/red.txt`，f0035fb 上 V20 返回 400（应正常接受）、两次 01:55 合并、缺失模型声明阶段、无效声明继续存版，exit 1。原始红与历史变异保留，不覆盖。
- 新坏实现：`astra-fix/mutants/report.json` 与四份同名 txt，均 exit 1：取错版本/不用旧代码都在实际存版产品区应为第 3 版表格处失败；修正调用丢参考、DST 合并也失败。每项执行 `node --test --experimental-strip-types --test-name-pattern=<对应测试名称> tests/t129-version-history.test.ts`，finally 还原源码；时间 2026-10-08T03:19:32Z–03:19:51Z。
- 最终相关检查：`CHROME_PATH=<指定路径> node --test --experimental-strip-types tests/t129-version-history.test.ts tests/t128-code-boundary.test.ts` → `astra-fix/related-final.txt`，50/50，exit 0，在四项变异全部还原之后运行。成对回归经真实 chat handler → 模型 HTTP 边界（受控）→ 写作 → 提交入口 → Chrome → 文件存储；V20 正常修改且参考为空，第 3 版参考回收旧表格与产品间距，首页/联系/页头页脚/当前 V20 与加工区保留。预期来自手改输入；受控 writer 消费实际传入的旧代码，未返回硬编码答案。不存在的模型声明报错，写作调用和存版均为 0。DST 覆盖纽约 2026-11-01 的 01:55 -04:00 / -05:00，分钟、10 分钟、小时各为两桶，天仍一桶。
- 面板复现：先用上面的 T129 测试命令生成 fixture；3141 空闲时运行 `SITECRAFT_BASE=http://127.0.0.1:3141 T129_RUN_NAME=<新输出目录> CHROME_PATH=<指定路径> node --experimental-strip-types scripts/check-version-history.mjs --controlled`。脚本使用默认 Turbopack，运行会新增恢复版本与修改标签，服务与 Chrome 只关闭自己启动的进程。
- 全量 `npm test` 按既定做法由主控合并后在主工作区执行；两项固定本机资料仅在主工作区存在，独立工作树不复制这些记录，也不为此另开工具票。先前的全套失败与四项服务就绪后的针对性复验保留在 `npm-test-final.txt` / `warm-failures.txt`，属于历史，不替代主控的合并后全量验收，也不作为本票本地阻塞。
- 默认构建：`npm run build` → `astra-fix/build-final.txt`，exit 0，Turbopack 编译、类型验证与页面生成通过；随后顺序运行 `npm run typecheck` → `astra-fix/typecheck-final.txt`，exit 0。没有 `--webpack`、ignoreBuildErrors 或源码类型规避；旧文件均保留。

本次 followup 的证据均在 `artifacts/t129/followup/`，旧输出没有覆盖：

- 非法编号的红/绿：`CHROME_PATH=<指定路径> node --test --experimental-strip-types --test-name-pattern='illegal model reference numbers|V20 product model|model-selected old product area' tests/t129-version-history.test.ts`，e14d171 的 `.parse` 把英文 Zod 明细交给用户，`reference-validation-red.txt` 2 PASS / 1 FAIL，exit 1；改为 `safeParse` 与专用中文 Error 后，`reference-validation-green.txt` 3/3，exit 0。坏实现是未修复的主线；0、负数、小数、字符串编号均明确失败，写作/存版为 0，合法空参考与合法旧版恢复仍通过。
- 相关检查：`CHROME_PATH=<指定路径> node --test --experimental-strip-types tests/t129-version-history.test.ts tests/t128-code-boundary.test.ts` → `related-final.txt`，51/51，exit 0；`npm run build` → `build-final.txt`，exit 0；随后 `npm run typecheck` → `typecheck-final.txt`，exit 0。结束时间 UTC 分别为 2026-10-08T05:25:34Z、05:35:15Z、05:37:15Z。
- 手改输入：`node artifacts/t129/followup/prepare-current.mjs` 经真实 3141 的 `PUT draft` 与原提交入口，把当前产品区改为灰底表格，25→26；公司资料不变，其他页面不动，真实 DeepSeek 事实校对及三档底线检查通过。`manual-input.json` 保存回执；没有旁路写存储。
- 首次真实命令预检：`SITECRAFT_BASE=http://127.0.0.1:3141 T129_RUN_NAME=followup-real CHROME_PATH=<指定路径> node --experimental-strip-types scripts/check-version-history.mjs --real-reference --reference-revision 11` → `real-reference.log` / `artifacts/t129/followup-real/report.json`。禁脚本预览里的异步绘制回调被 sandbox 阻止，Runtime.evaluate 超时；当时没有发出 chat 请求或模型选择/写作调用。失败保留。把预检改成同步读取字体状态，不解除 sandbox、不降低检查。
- 唯一真实对话：相同命令仅将输出名换成 `T129_RUN_NAME=followup-real-ready` → `real-reference-ready.log` / `artifacts/t129/followup-real-ready/report.json`。2026-10-08T05:26:28Z 开始，发出一次“把产品区改回第 11 版那样，保留其他内容”。所选版本 ID 为 `5a0338ac-2786-4715-b477-504ad01770c2`，新版本 ID 为 `104e52c3-2cf4-4e08-bf00-0030c108c91e`。原脚本把首页产品入口误当成范围外，因此 exit 1；此原始结果保留，未重发模型请求。主控明确范围后用同一数据重新断言，见下。
- 范围判定依据（主控，2026-10-08）：用户请求“产品区”未点名页面；首页“产品与加工”入口同属产品区。模型一并恢复其上下间距 28→44 是合理理解，遵循“引导而非限制”，不能用未告知模型的产品页唯一范围误判。新的验收规则是：有 `--page <pageId>` 时，仅该页产品区允许恢复，其他页完整保留；不点名页面时，各页已声明的产品区可恢复，产品区以外始终保留。脚本的产品选择器仅描述本次手改夹具：首页的产品页入口与产品页 `#products`，不是生成路线的区块白名单。
- 同一保存版本的只读重放：`SITECRAFT_BASE=http://127.0.0.1:3141 T129_RUN_NAME=scope-recheck-final CHROME_PATH=<指定路径> node --experimental-strip-types scripts/check-version-history.mjs --assert-saved --before-revision 26 --after-revision 27 --reference-revision 11` → `scope-recheck-final.log` / `artifacts/t129/scope-recheck-final/report.json`，2026-10-08T05:57:50.411Z–05:57:52.379Z，exit 0，PASS。只 GET 版本与 code-preview，不调用模型、不写存储；截图来自已有真实调用，未伪造新生成证据。本次只改验收脚本和文档，生产代码及此前 51 项、typecheck/build 结果不变；该历史结果保留，现行交互检查的重放证据见下。
- 成对范围检查：同一重放命令加 `--page products`，输出 `scope-named-page-negative.log` / `artifacts/t129/scope-named-page-negative/report.json`，exit 1，在首页产品入口 28→44 处拒绝，证明点名页面不会放宽到别页。另在浏览器观察值中分别制造页头页脚、单独页脚、联系页、其他区块变化（不改已存版本），四项都被范围外断言拒绝；`scope-negatives.json`、`scope-negative-*.log` / 同名 report 保存 AssertionError，源码 finally 还原，再跑最终正例通过。
- 范围外整段 HTML 与交互状态：剔除允许变化的产品区后，比对整个 body 的规范化 outerHTML，保留 href、class、表单 action 与全部其他属性；属性排序、纯排版空白归一化，仅去掉本系统 code-preview 链接自动生成的 version 参数，保留 page 目的地与其他值。Astra 对 281c228 指出，控件自身的 display/visibility/pointer-events 无法检测祖先隐藏；现行检查已换成通用浏览器判断：逐个把范围外交互元素滚入视口，读取 `element.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})`、布局矩形宽高是否均大于 0、中心 `elementFromPoint` 是否命中自身或后代，三个结果在前后版本必须一致；观察后恢复滚动位置。点名页面时，其他页产品区仍完整包含在范围外。没有增加逐个 CSS 属性或祖先规则。
- 持久回归：`CHROME_PATH=<指定路径> T129_CHECK_TEST_OUT=artifacts/t129/visibility-fix/<red或green> node --test --experimental-strip-types tests/t129-version-history-check.test.ts`。独立只读 HTTP 输入经过真实 CLI 与 Chrome；只在 after 预览的 head 注入 `main > div{display:none}` 或 `header{display:none}`，body HTML 不变。281c228 的旧脚本两例均 exit 0、误判 PASS，测试整体 exit 1，时间分别 2026-10-08T11:41:50Z / 11:41:51Z；`artifacts/t129/visibility-red.txt` 与 `visibility-fix/red/` 保存原结果。修正后两例均 exit 1，因范围外交互结果改变被拒绝，时间 11:42:28Z；`visibility-green.txt` 与 `visibility-fix/green/` 保存结果，整组 6/6 PASS。正例与此前错误联系链接、询盘 pointer-events 负例也覆盖在同一持久测试中；询盘安排在首屏以下，要求检查滚动后的命中。更早的链接和 pointer-events 漏报证据仍保留在 `artifacts/t129/interaction-fix/`，未覆盖。该回归由 `npm test` 自动包含，测试没有模型请求或存储写入，不冒充真实生成。
- 真实保存数据重放：`SITECRAFT_BASE=http://127.0.0.1:3141 T129_RUN_NAME=visibility-recheck CHROME_PATH=<指定路径> node --experimental-strip-types scripts/check-version-history.mjs --assert-saved --before-revision 26 --after-revision 27 --reference-revision 11` → `artifacts/t129/visibility-recheck.txt` / `visibility-recheck/report.json`，2026-10-08T11:42:27.602Z–11:42:30.303Z，exit 0，PASS。只 GET 已存版本与预览，没有真实模型请求或改写验收站版本。加强交互检查后，真实结果仍满足主控的范围判定。
- 本轮相关检查：`CHROME_PATH=<指定路径> T129_CHECK_TEST_OUT=artifacts/t129/visibility-fix/related node --test --experimental-strip-types tests/t129-version-history.test.ts tests/t128-code-boundary.test.ts tests/t129-version-history-check.test.ts` → `artifacts/t129/visibility-related.txt`，57/57，exit 0；`npm run typecheck` → `visibility-typecheck.txt`，exit 0；`npm run build` → `visibility-build.txt`，默认 Turbopack，exit 0；`node --check scripts/check-version-history.mjs` 通过。本轮结束时间（UTC）：typecheck 2026-10-08T11:42:59Z、相关检查 11:43:24Z、默认构建 11:43:29Z。全量 npm test 仍由主控合并后在主工作区跑。本次脚本、持久测试与文档 amend 到原来的同一个提交，最终 SHA 由本文开头的 git log 命令读取。

本次输出结束时间（UTC）：审查红 2026-10-08T03:14:23Z；相关检查 03:24:38Z；三档 UI 03:24:30Z；默认构建 03:26:16Z；typecheck 03:26:50Z。最终验证之后没有再改生产代码。

### 还差什么

真实项已按主控明确的范围通过并勾选；本次没有新模型调用。剩余合并、独立验收与关票由主控安排，本执行者未宣布审美通过。

T-128 已知的 line-height:0 完全重叠与 filter 后对比度限制保持原样，本票未扩大底线检查范围。

### 合并验收（Claude）

Astra：f0035fb NO_GO（正则把型号 V20 当第 20 版，普通修改 400；主控要求改为模型按版本目录结构化声明参考版本）→ 4459c81 收窄复核 PASS（新实例 t129-astra2，2026-10-07 23:42 EDT；独立反例 18/18）。非阻断建议：`lib/code-site-model.ts:59` 模型返回非法编号时 Zod 英文错误直接显示给用户，应转成简短中文——随真实 DeepSeek 补跑一并处理。合并为 52c0df6，主工作区 3034：`npm run typecheck`、`SITECRAFT_BASE=http://127.0.0.1:3034 CHROME_PATH=<指定路径> npm test` 2554/2554、`npm run build` 通过（输出 gitignore 的 `artifacts/merge-52c0df6/`）。

合并时未完成的真实项，充值后的 followup 与主控范围判定下的保存版本重放已通过，依据与证据见上；原 402 和旧范围断言失败保留为历史。
