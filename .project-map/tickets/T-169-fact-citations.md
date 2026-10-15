---
id: T-169
title: 高风险事实在工作台标出资料出处
type: build
status: open
blocked_by: []
claimed_by: Codex (t169-resume)
supersedes:
---

## Why

2026-10-14 负责人决定：像模型回答带来源角标那样，在工作台里给生成站的高风险企业事实标出资料出处。现在事实核对拒收时会给"段落原句：资料原句"，但**通过的声明不留依据**，用户看不出页面上"服务 30 家客户""取得 ISO 9001"凭的是资料哪一句。目标是"更真"：用户能逐条核对，系统也能证明出处不是模型编的。

## What to build

1. **范围只限高风险类别**：客户与合作方、资质认证、业绩与数量、价格与收费、时间与交期承诺、效果、评价。普通介绍、标题、导航不标出处。
2. **核对返回出处**：整站与局部事实核对在通过一条高风险声明时，同时返回其所依据的资料原句。不新增模型调用，沿用现有核对调用与非思考/思考模式设置。
3. **出处由代码验真**：引文必须能在本次核对所用资料原文中找到（NFKC 并压缩空白后做子串匹配，不做模糊匹配）。找不到即视为无依据，作为拒因进入现有最多两轮修正；仍不过如实告知用户，不静默放过。
4. **绑定版本**：出处随该版本的检查结果保存；按 T-154 复用核对段时一并复用出处，资料或整组内容变化则整组重核、旧出处不沿用。没有该字段的旧版本显示"未记录出处"，不当成零条。
5. **只在工作台展示**：预览中标出有出处的声明，悬停或点选显示"资料原句"；定位沿用 T-162 的锚点方式（版本、页面、DOM 路径与文字快照），不往站点代码里写任何属性。发布页、版本历史外的公开路径、英文版都不出现标记。
6. 同步 `docs/project/spec.md`、`mainline.md` 与 AGENTS.md 中事实核对相关句；新术语"资料出处"写进 `CONTEXT.md`。

非目标：不给每句文案溯源；不证明资料本身真实；不另调第二个模型核对。

## Failure modes

实现前的合同失败方式清单（2026-10-14）：

- 编造、空白或来自网页／其他输入字段的引文被当作资料出处；跨字段跳过标签拼接也被误收。必须在本次 materials 内找到连续原句，语义支持仍由同一次模型核对负责。
- 真引文只差全半角或连续空白被误拒；除 NFKC 与空白压缩外的近似文字被误收。
- 核对返回遗漏出处数组、错误类别或不在该核对段的声明，却存为已记录；普通介绍被要求逐句标记。
- T-154 只复用通过结论而丢出处，或拼接不同核对轮的证据；旧版本缺字段被解释成零条。
- 资料改一字、整组增删改或重排后仍沿用旧出处；恢复版本时错用当前版本的出处。
- 局部修改仍核整站、丢失范围外出处，或新段的 DOM 路径变化后标记落到别处；未知旧依据被补成已核对。
- 页面切换、历史版本、刷新、缩放和滚动后标记与文字快照失配；375 的资料原句面板出界或截断。
- 为标记修改站点 HTML，或标记泄漏到预览独立 URL、发布页和英文版。
- 系统表格标签使同一行的跨单元格声明被误拒，或剥掉行界后把独立行拼成声明；声明匹配的处理误用于资料引文。编号盖住表格价格，或在抽屉退出过渡中截图。
- 编造引文的拒因未进入现有两轮修正，或修正耗尽仍保存版本。

验收先跑非浏览器核对协议合同测试的预期红态；提交入口和工作台测试在主控释放 Chrome 后跑，再逐项回退对应改动确认可检错。证据留在 gitignore 的 artifacts/t169/。

## Acceptance

- [x] 先列出失败方式清单（编造引文、引文只差空白或全半角、引文来自另一字段、复用段带旧出处、资料改后旧出处残留、局部修改后出处错位），再按清单写测试；每条测试在回退对应实现后失败
- [x] 确定性测试：真实原句通过；编造原句、跨字段拼接原句被拒并进入修正轮；资料改一个字后旧出处不沿用
- [x] 本地替身端到端：生成一站含至少 3 条高风险声明，工作台 1440/768/375 截图逐张看过，出处标记与原句显示正确，发布页无任何标记
- [x] T-165 关票后，在负责人批准的 `SITECRAFT_TOKEN_LIMIT` 内跑一次真实小资料生成，记录出处条数、验真失败条数与 token 用量
- [ ] `npm run typecheck`、`npm test`、`npm run build` 通过；独立审查实例通过

## Resolution

当前 **INCOMPLETE**，票保持 open：语义合并、风格准入、出处验真及表格声明绑定已完成本地验证；最新全量 **505/506**，只剩 T-172 的英文保真误拒。48,000 token 真实小跑已成功保存版本并完成三档工作台出处检查。独立审查、页面盲评由主控安排，执行者未自开审查、不推送。

接手 `0383dba`，按主控指令合入 `family-kit-assembly`（来源 `2d905f8`），合并提交 `d1e508a`。保留 T-169 的分段、局部及出处结构，在 `checkSiteCode` 和三个 `auditCodeFacts` 签名中保留 `style`，整站与局部都传递当前风格；模型调用前执行 T-159 准入，不保留主线单独的 localEdit 旧分支。无需模型的恢复、撤销和手改照常。T-159 三处证据目录改为递归创建，避免新工作树缺少 artifacts/t159 时 ENOENT；未改变断言或存储守卫。预算网关仅增加 t169 目录白名单。

Tracer bullet 继续经生产 chat POST、原提交入口、FS 版本及工作台；替身的 after 受控，不称为真实 Next after 集成通过。Deep modules 沿用原模型核对与提交入口，未增加调用或存版路径。Ubiquitous language 继续使用「资料出处」「资料原句」「核对段」。真实小跑走实际 Next dev/after 与标准评估流程。

### 本轮验证（2026-10-14，UTC）

标准测试只在命令环境设置 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell`，均经 `npm test` 自建随机端口、临时数据根与 .next-test，核对 cwd/dataRoot 后运行；没有回退主目录、放松守卫或加载 .env.local。下列日志在 artifacts/t169/；精确入口参数、时间及临时根同时保存在每轮 artifacts/t167/test-run-*/report.json。代码基线为 d1e508a 加本次续接改动，交付 SHA 与日志关联在提交后写入 artifacts/t169/resume-commit.json。

- 17:09:54：`npm test -- --import ./artifacts/t169/parent-admission.mjs tests/t159-local-fact-admission.test.ts` 在父版本 0383dba 的检查器及模型函数上 **0/2，退出 1**，拒绝缺失且局部仍存版（t159-local-parent-contract-red.log）。17:11:18：`npm test -- tests/t159-*.test.ts tests/site-delete.test.ts tests/site-images.test.ts tests/t136-session-summary.test.ts tests/t145-code-only-entry.test.ts tests/t145-legacy-import.test.ts` **47/47，退出 0**（t159-eight-storage-green.log）：包含原先等待 T-167 的 8 项失败用例。最后全量中 T-159 **25/25**，普通 pending 风格局部提交及字符串/分段核对在模型 HTTP 前拒绝、请求数为零；复用核对段的恢复、撤销、手改照常。
- 17:22:50：`npm test -- --import ./artifacts/t169/table-parent.mjs --test-name-pattern='表格' tests/t169-fact-citations.test.ts tests/t169-citations-browser.test.ts` 在 d1e508a 对应实现上 **0/2，退出 1**（table-ui-parent-red.log）。同一行的价格声明被表格标签隔断。修复仅在声明匹配与 DOM 绑定时移除系统 TABLE/THEAD/TBODY/TFOOT/TH/TD 标签，保留 TR 行界；资料引文仍只做 NFKC 与空白压缩。本地整站及局部合同验证真行通过、跨独立行拼接及带标签假引文拒绝，实际提交入口绑定最小行而非整表。17:21:47 的对应无 import 命令 **2/2，退出 0**（table-paired-green.log）；后续全量继续通过这两项。17:36:47：`npm test -- --import ./artifacts/t169/claim-mutant.mjs --test-name-pattern='声明必须' tests/t169-fact-citations.test.ts` 更新后的声明反事实命中真实断言失败（claim-mutant-current-red.log），非导入错误。前实例的协议红态与逐项反事实日志仍保留。
- 17:35:50：`npm test -- --test-name-pattern='表格中的' tests/t169-citations-browser.test.ts` 的新增几何断言失败：价格右缘 286.70，编号左缘 263.36（table-marker-red.log）。将编号移到行右侧空白后，17:36:28 同命令 **1/1，退出 0**（table-marker-green.log），三档价格均无遮挡；站点 HTML 不改。
- 17:39:28：最终 `npm test` **504/506，退出 1**（npm-test-delivery-full.log），取消/跳过/TODO 均 0。T-169 **9/11**：协议 **6/6**，浏览器 **3/5**。普通出处交互 Runtime.evaluate 超时，完整场景仅留下 1440/768 截图，具体等待点尚未复现定位；另一失败是「取得 ISO 9001 认证。」→「ISO 9001 certified.」的 T-172 已知缺口，旧版未知状态及恢复断言已执行，英文切换未执行。保留 t159-t169-final.log 的同类超时和此前全量日志，不以中途 505/506 覆盖本轮结果。截图曾捕获 768 抽屉仍在退出过渡，现已等待实际有限动画完成，不扩大等待上限、不加固定 sleep。补上超时条件的错误上下文后，17:41:30 的 `npm test -- --test-name-pattern='本地替身' tests/t169-citations-browser.test.ts` **1/1**（ui-timeout-diagnostic.log），但没有复现超时，不能算稳定性修复证明。
- 普通出处的最终定点三档截图 browser-1791999669128/workspace-{1440,768,375}.png、表格出处三档截图 browser-1791999480555/table-workspace-{1440,768,375}.png 及 table-marker-green 对应 browser-1791999371620 三张均逐张打开；有网页、编号和资料原句。失败轮产生的截图也保留并打开，不将缺图或过渡中的图计为完整证据。发布及独立预览无标记的断言在定点场景通过。仅检查内容、定位与可操作性，不自评审美。
- 17:44 前后核对：`npm run typecheck` **PASS**（typecheck-delivery-final.log）；`SITE_STORE=fs SITECRAFT_DATA_ROOT=/Users/luckye/Documents/Code/sitecraft-ai-t169/artifacts/t169/build-delivery-final-data npm run build` **PASS**（build-delivery-final.log）。只撤掉 Next 测试入口重复追加的 .next-test/dev/dev/types include，保留既有 .next-test/dev/types；没有额外配置改动。project-map status 为 **0 problems / 0 stale living docs**。中文文档回读 UTF-8，窄改；所有重任务串行，启动前以 ps 核对无其他测试 Chrome/node --test/next build。

### 唯一一次真实小跑：INCOMPLETE

17:14:44 启动，`SITECRAFT_TOKEN_LIMIT=80000`，轮次 default、估算 50,000；按逐次实际用量结算，不将三次 65,536 输出上限求和当作门禁。旧 preflight.json 仍保留，但其 233,725 的求和不是本轮停止依据。网关进程按授权的 `set -a; source /Users/luckye/Documents/Code/sitecraft-ai/.env.local; set +a` 载入密钥，未写入文件、日志或提交；应用与评估进程没有载入该文件。

`node artifacts/t169/run-real-eval.mjs` 调用标准 `npm run eval:new-route -- --quick --only restaurant/precision --out <本轮目录>/eval`，通过 artifacts/t169/minimal-pack.mjs 仅替换餐饮输入为短模拟资料，最终资料含标准两页要求共 **139 字符**；保留标准规划、确认、提交、布局检查及审包规则。应用随机 origin 为 http://127.0.0.1:55296，网关为 http://127.0.0.1:55297，数据根为本轮核对的临时目录 /var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-t169-real-jGT339；未写主目录 .sitecraft-data。完整命令环境在本轮 command.json。

- siteId：`b14c0b3e-f8d1-4853-9325-aaf32b9bda91`；**已保存版本 0**，不能当作已生成站点。
- 候选已验真并绑定的出处 **4 条**；资料引文验真失败 **0 条**，声明归属误拒 **1 条**。菜单行「家常饭 每份 18 元」被系统表格标签隔断，随后局部修正无法定位该拒因，本次未存版；上述本地红绿修复覆盖此结构，真实模型未重跑验证。
- 实际 token **32,045 / 80,000**：规划 7,792、写页 16,126、事实核对 8,127，共 3 个 HTTP 200 请求，无截断、无重跑、无未知用量。预算余量未用于第二次生成。
- 证据目录 artifacts/t169/authorized-2026-10-14T17-14-08-098Z/：usage.json、citation-summary.json、eval/private/case-1/code-site.json、eval/private/summary.json 保留真实失败、候选与本轮底线结果；真实审包为 INCOMPLETE，没有生成站截图或审美通过结论。标准评估的真实官网对照截图及其审包副本均已打开。

网关仅在 run 为 error 且三次请求全部 complete、进行中请求为 0 后手动停止；本轮普通 dev 服务也已停止。未修改 T-151；T-172 留作已知缺口。剩余事项是主控安排的独立审查；未关票、未推送。

### 2026-10-15 后续执行

- 根因诊断：保留 `npm-test-delivery-full.log`、`t159-t169-final.log`、`timeout-diagnostic-current.log` 等历史失败。单独运行 T-169 出处浏览器用例的 23 个等待条件全部完成；T-169 与 T-162 受控并发也完成出处交互，唯一失败仍为 T-172。历史全量超时时，另一工作树 T-163 同时运行 `tests/t163-area-drafts.test.ts` 并占用同一台机器的 headless Chrome；本轮多次门禁观察到该进程，冲突时退出码 125 并保留现场。等待 T-163 结束、df 仍有 17GB 后重跑全量，`npm test` **505/506，退出 1**，取消/跳过/TODO 均 0，唯一失败为 T-172 的 ISO 英文保真拒绝（`npm-test-root-cause-fixed.log`）。因此全量超时根因是跨工作树浏览器资源争用，不是产品等待条件；修复动作是按门禁等待冲突进程结束，不调大测试超时、不跳过用例。
- 真实站点首次工作台检查另发现测试脚本等待条件缺陷：真实版本同一出处有多个 DOM 目标，编号数大于 3，脚本等待 `markers.length === 3` 导致 `Runtime.evaluate` 超时。保留失败 `workspace-diagnostic.log`；检查脚本改为等待 `>=3` 后，三档逐条核对通过，未触碰产品代码或重新调用模型。
- 真实小跑：df 门禁可用 16GB；无其他 Chrome/node --test/next build；应用 `http://127.0.0.1:52024`、预算网关 `http://127.0.0.1:52025`，同一 139 字符最小资料包，`SITECRAFT_TOKEN_LIMIT=48000`。标准 `npm run eval:new-route -- --quick --only restaurant/precision` 生成成功，run 为 complete，版本 1 已保存；网关在三次请求 complete 且无 in-flight 后手动停止。
  - siteId：`1e472b8b-925a-4d0c-8b17-ddeda84c00f3`；versionId：`fb27e8cd-8122-4961-9b80-6cabbffcb03f`。
  - 资料出处 **3 条**；资料引文验真失败 **0 条**；实际 token **34,889 / 48,000**（规划 7,202、写页 17,671、事实核对 10,016），三次 HTTP 200，均未截断。
  - 工作台 1440/768/375 三档逐条点开 3 条出处，面板原句与资料一致，几何均在视口内且无横向溢出；截图逐张打开：`authorized-48k-2026-10-15T11-09-54-215Z/workspace/workspace-{1440,768,375}.png`，报告为 `workspace/report.json`。标准 eval 审包齐备但独立审查仍交主控。
- 当前票仍 **INCOMPLETE**：只剩 T-172 已知失败，独立审查未执行；未推送。

### P1/P2 审查修复（2026-10-15）

- P1-1/P1-2 先在 `c6c8bad` 上跑红：`npm test -- tests/t169-fact-citations.test.ts` 为 6/8，新增“空 citations”与“页面要求伪引文”两项失败，日志 `artifacts/t169/p1-parent-red.log`。修复后结构化合同 **12/12 PASS**（`p1-contract-final-green.log`）：逐段 `factCategories` 覆盖缺出处拒收；`materials` 保留完整上下文给模型，独立 `factMaterials/sourceMaterials` 只作为代码验真来源。
- P2 定向浏览器：`CHROME_PATH=… npm test -- --test-concurrency=1 --test-name-pattern='本地替身|空出处|表格中的' tests/t169-citations-browser.test.ts` **3/3 PASS**（`p1-p2-browser-focused-final.log`）。覆盖 1440/768/375 出处面板、空出处不存版、表格跨单元格绑定、面板不越过预览区/对话栏边界。弹层改为读取 `.preview-stage` 边界，监听外层滚动，目标离开预览区时关闭，并把对话栏层级置于弹层之上。
- `npm run typecheck` **PASS**（`p1-p2-typecheck-4.log`）。本轮未重跑全量/build（主工作区由 T-170/主控独占 Chrome 与重任务）；此前全量证据不能代表本次审查修复后的最终全量，票保持 **INCOMPLETE**。本轮未发真实请求。

### 2026-10-15 结构化 P1 重做

- `4af64ed` 父版本精确反事实：`P1_PARENT=1 npm test -- --import ./artifacts/t169/parent-4af-all.mjs --test-name-pattern='长期合作客户|同一行的页面要求|资料出处验真排除' tests/t169-fact-citations.test.ts`，**2 项预期红态**（`p1-4af-exact-red-2.log`）：长期合作客户空出处可漏过；同一行页面要求可作为 quote。
- 资料边界改为显式 `factMaterials` 与完整 `materials` 两份数据；模型同时接收完整上下文和原始事实资料，验真只读 `sourceMaterials`。旧记录缺 `factMaterials` 时不推断、不复用旧出处，恢复重新核对。页面要求不再靠行首或同一行规则过滤。
- P1-a 改为逐段必返 `factCategories` 合同：类别非空必须有同类别有效 citation；类别覆盖、编号、claim、quote 均由代码确定性校验。模型把「长期合作客户：甲方公司。」标成无企业事实时，替身仍返回原有 `issues`，资料无该句即拒收；剩余已知风险是模型可能错误返回空类别，代码不再用关键词正则猜语义，已记录为模型语义边界。`p1-4af-exact-red-2.log` 保留 4af 父版本两项精确红态，当前 `p1-contract-final-green.log` 覆盖对应绿态。
- 当前非浏览器合同 `tests/t169-fact-citations.test.ts` **12/12 PASS**，typecheck **PASS**（`p1-structured-typecheck-final-2.log`）。T-158 翻译用例本轮仅因未设置 CHROME_PATH 被底线检查入口拒绝，未启动 Chrome，日志 `p1-structured-t158.log`；不作为本次 P1 合同失败。
- 本轮未发真实请求；全量未在本次结构化重做后重跑，独立复审由主控安排。
