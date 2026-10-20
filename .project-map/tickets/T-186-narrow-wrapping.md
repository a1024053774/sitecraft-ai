---
id: T-186
title: 375 下时间、参数与标签碎折行
type: build
status: open
blocked_by: [T-190]
claimed_by: codex-t186b
supersedes:
---

## Why

T-180 company 盲评发现约 7 站在 375 宽度下出现碎折行：营业时间的起止值被拆开，「10:00—17:00」、开放日「周四」单独换到一行，减速机的长参数串多次折行，桌面页脚的邮箱也被断开。代表截图：

- restaurant/editorial：`artifacts/t180-r2/round2-selected/private/case-1/home-375.png`
- education/documentary：`artifacts/t180-r2/round1-full/private/case-12/home-375.png`
- industrial/documentary：`artifacts/t180-r2/round1-full/private/case-2/home-375.png`

2026-10-19 构思主控改排期：等 T-190 新资料基线出来，按固定口径确认 375 碎折行仍存在再做；不存在则关票并写明。

## What to build

1. **先查根因**：对照源码，看问题出在模型写的 CSS（栏宽、white-space、标签和值的排法），还是核心规范缺少相应约束。
2. **在根因层修**：可以是提示约束（时间区间、短标签、型号、邮箱不拆开；长参数串在窄屏改为上下排列等），也可以是确定性的系统样式。修法以不引入横向溢出为前提。
3. **只作质量反馈**：如果新增机械检查，只作为质量反馈，不拒收、不触发修正轮（与 T-160 一致）。
4. **证据**：在 T-184 之后的主线上，用 `--only` 跑代表组合，预算 `SITECRAFT_TOKEN_LIMIT=1000000`。375、768、1440 截图都要逐张打开看过，company 盲评交独立实例。

## Acceptance

- [x] 根因写进 Resolution
- [ ] 代表组合 375 截图不再出现上述碎折行，同时无横向溢出；盲评如实记录
- [ ] typecheck、test、build 通过；独立 fast 审查通过

## Resolution

执行：codex-t186，2026-10-19。上一轮结论 INCOMPLETE：六站真实生成已结束，molding出现表题竖排回归；本轮由codex-t186b接续修复。遵循本次负责人指令，不跑全量、runner、build，不开审查或盲评实例；原验收中这些项交主控处理，未勾选。工作树基于 4708f86；未修改 T-196 占用的 `scripts/visitor-layout-scan.js` 与 `lib/code-site-check.ts`。

### 根因与改法

本次直接改善生成站可读性。Tracer bullet 取生产规划、写页和局部修改入口的实际模型请求；Deep modules 保持既有提示加载接口，不新增系统样式或检查 API；Ubiquitous language 将这些现象统一称为「语义短串碎折行」。不按行业硬编码，不新增机械反馈、拒收条件或修正轮。

只读判定：`/Users/luckye/Documents/Code/sitecraft-ai/artifacts/t186/judgement.md`。下表路径前缀 B 为 `/Users/luckye/Documents/Code/sitecraft-ai/artifacts/t190/baseline-worktree-evidence/`；行号指向实际当前存版的源字段，不修改原 JSON。为便于逐条读 CSS，本工作树 `artifacts/t186/baseline/<组合>/` 另存按原换行展开的 HTML/CSS；这些是只读摘录，不是修改后的站点。

| 组合 | 源码位置（B 下）与根因 |
| --- | --- |
| industrial/documentary | `r2/round1-full/private/case-2/code-site.json:66` 首页 `.prod-meta` 将六项规格放进一个文本 span，含「中心距」「底脚/法兰」；`:61` 的 CSS 只设 display:block、14px，无字段子元素、短串保护或手机重排。`.wrap` 在 375 仅剩 339px，虽然整体网格折为一列，串内仍按中文默认规则任意断行；对应摘录 `industrial-documentary/home.html:25`、`css.css:35`、`:112`。未设置 word-break、overflow-wrap 或该处 min-width；不是强制断词导致。产品页逐项 dl 能完整呈现，说明长串排法才是差别。 |
| molding/documentary | `r2/round1-full/private/case-6/code-site.json:76` 的结构件 li 把重量与机台范围接成一句，`90–800 t` 中普通空格允许单位独行；`:91` 的 FAQ 左标签「贸易条款」仍占 22% 栏宽。`:71` 的 `.spec-terms th{width:22%}` 配 16px 右内边距，在 339px 内容栏约只剩 59px 文字空间，15px 四字标签放不下，手机没有覆盖；对应摘录 `home.html:43`、`faq.html:35`、`css.css:88-92`。相关元素没有 nowrap、独立数值单元或最小标签宽，word-break/overflow-wrap 未设置。 |
| packaging/documentary | `r2/round1-full/private/case-8/code-site.json:81` 的订购表保留包装名、MOQ、交期、起算点四列，数量单位和时间范围是未保护的文本；`:66` 的 `.spec` 宽100%、左右各12px单元格内边距，手机只将包装列从8.5em改为7em并取消 nowrap，其他列未重排，内容栏335px被四列共同压缩。不是设置大 min-width 撑出的溢出，而是把数字、单位和产品名压碎；对应摘录 `sampling.html:9`、`css.css:68-75`、`:137`。`.contact-plain .mail{word-break:break-all}` 另有邮箱风险，但判定中的邮箱这次完整；不能把它当成本表根因。 |
| restaurant/editorial | `r3/round2-selected/private/case-1/code-site.json:81` 的到店页导语 `.lede` 将午晚时段和停止点菜时间连成一段；`:66` 的导语默认 17px、max-width:34em，375 时由手机规则 `@media(max-width:768px)` 改为 16px（`artifacts/t186/baseline/restaurant-editorial/css.css:87`），并由两侧 20px 留白收窄至 335px，时间没有独立 span 或 nowrap，连接符后是合法换行点。无该处 min-width、break-all 或 anywhere；对应摘录 `visit.html:1`、`css.css:11`、`:81`。同页下方营业表完整，不能据此忽略导语。 |
| restaurant/neighborly | `r3/round2-selected/private/case-2/code-site.json:65` 公共页脚把日期、两个时段、休息日和停止点菜时间都塞进同一 p；`:66` 的页脚14.5px、max-width:52em，手机 `.wrap` 留白后335px，晚市17:00–20:30没有短串保护，仍按连接符换行。对应摘录 `footer.html:1`、`css.css:90-93`。`.info-table .num` 已有 nowrap 只保护营业表，页脚未复用；`.facts dd{overflow-wrap:anywhere}` 不匹配页脚，不是此处直接原因。 |
| education/editorial | `r3/round2-selected/private/case-3/code-site.json:65` 页脚把周中和周末时间写在同一 p，`:66` 的14px文字在335px内未保护时间范围。`:81` 学习须知 `.plain-table` 的首列9em、15px字、16px右内边距，约119px可用文字宽，小于「周一、周二与周四」八字的120px，故单独剩「四」；手机没有覆盖该表。对应摘录 `footer.html:11`、`guide.html:42`、`css.css:88-90`、`:99`。表格是auto布局，未设最小标签宽，相关 white-space 默认为normal，word-break/overflow-wrap 未设置。 |

共性缺口在 `skills/site-code-core/SKILL.md:22`：原规则只有多列折叠、三档不溢出，不保护时间、数量单位和标签内部。documentary、editorial、neighborly（以及同一运行合同的 precision）风格首段也没有这些约束。`lib/code-site-model.ts:20` 的 rules 同时服务 planSiteCode/writeSiteCode；`:215` 的 writeLocalEdit 只取风格首段，因此本次核心加详细规则，四种风格首段补同一条简明合同，保持首段截取逻辑不变。优先上下排字段、窄屏表格变字段行，完整短串仅局部保护，长邮箱独占行；不以隐藏、裁切、横向滚动或难读小字掩盖宽度问题。未添加确定性系统样式，故没有「旧站经系统样式修复」的主张或对应夹具。

### 提示合同与门控

新增 `tests/t186-narrow-wrapping.test.ts`，期望来自本票需求，经过生产 planSiteCode/writeSiteCode/writeLocalEdit 截获实际请求；四种风格分别检查核心与风格规则及局部首段，还保留原资料与12288输出合同。只能证明提示送达，不能证明模型遵从或审美通过。

- 首次夹具解析遗漏生产提示附加行，失败保存在 `artifacts/t186/contract-red.log`；这是测试夹具错误，不作为产品红证据，未修改产品行为。
- 修正夹具后，在父版本4708f86的原提示上运行 `CHROME_PATH=… npm test -- tests/t186-narrow-wrapping.test.ts --browser-concurrency=1`：4/4因「时间区间保持完整」断言失败。证据 `artifacts/t186/contract-red-2.log` 和 `artifacts/t167/test-run-1792434170531-17420/`。之后才修改提示。
- 同一新测试连同 `tests/t184-style-visual.test.ts`、`tests/t188-condition-scope.test.ts` 经标准 npm test 入口，浏览器池串行：19/19通过，无取消或跳过。证据 `artifacts/t186/contract-green.log` 和 `artifacts/t167/test-run-1792434201949-21879/`。
- `npm run typecheck` 退出0，见 `artifacts/t186/typecheck.log`。未运行全量、runner、build、独立审查或盲评，遵照本次指令；tsconfig.json的Next自动改动不提交。

### 单次真实评估准备

`curl -m 15 -sS -o /dev/null -w 'HTTP %{http_code}\\n' https://api.deepseek.com/` 唯一次检查退出0，HTTP401，证明端点可达，不代表凭据调用已验证。拟跑本票指定六组合，仅一次，失败站不重跑。T-190第一轮14组合、第二轮6组合均与本次六组合集合不同，`scripts/eval-set-report.ts:125` 明确要求集合一致，`--previous-materials-changed` 也不豁免集合，因此不加 `--previous`，不做伪成对比较。

### 单次评估执行与图像核对

代码候选先提交为 `dd1827d`。应用 `http://127.0.0.1:65223`，预算网关 `http://127.0.0.1:65224`；health 核对 cwd 为本工作树、dataRoot 为本工作树 `artifacts/t186/eval-data`，见 `artifacts/t186/health.json`。应用显式覆盖 DeepSeek/AI 两组凭据为 `local-budget-gateway`；真实密钥只在网关子进程按授权 source 主工作区 `.env.local`，source 输出丢弃。网关新账本 `artifacts/t174/t186-narrow-eval/usage.json`，显式 `SITECRAFT_TOKEN_LIMIT=1000000`，调用前零用量、零调用，并登记唯一 default 轮。

执行命令（完整环境与截图再生入口）：

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t186-narrow-wrapping.test.ts tests/t184-style-visual.test.ts tests/t188-condition-scope.test.ts --browser-concurrency=1
npm run typecheck
SITECRAFT_BASE=http://127.0.0.1:65223 SITECRAFT_TOKEN_LIMIT=1000000 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm run eval:new-route -- --only packaging/documentary,restaurant/editorial,restaurant/neighborly,education/editorial,molding/documentary,industrial/documentary --out artifacts/t186/eval
```

最后一条已执行，本票授权仅一次，不能为复验而重发；原命令亦保存在 `artifacts/t186/eval/command.sh`。页面由生产提交入口存版；没有手改站点或旁路写版本。

截图原件均在 `artifacts/t186/eval/private/case-N/`，每页包含375、768、1440三档，另有首页首屏1440。长图按原像素连续切段、顺序排入多列后逐张打开，段头显示原始纵坐标；只改变摆放，不改内容或作图像比较。脚本 `python3 artifacts/t186/inspect-screens.py`，查看片在 `artifacts/t186/inspection-v2/`（工业站首批为 `inspection/`，首屏另直接打开原件）；打开清单在 `artifacts/t186/visual-opened.json`。下面只判断本票碎折行及可见性，不给审美通过结论。

| 组合／案例 | 三档打开范围 | 375碎折行与溢出结论 |
| --- | --- | --- |
| industrial/documentary／case-1 | home、products共6张整页，另1张首屏 | 参数由长串改为逐字段排列；中心距、底脚/法兰、范围与数量单位、邮箱完整，已查两页未发现目标碎折行。最终提交入口6个页面视口组合overflow=0、overlaps=0。 |
| molding/documentary／case-2 | home、products、production、faq共12张整页，另1张首屏 | 原首页机台范围90–800 t已完整；FAQ以完整问答呈现贸易条款，无原短标签碎尾；邮箱完整。但products-375出现两处caption「多腔热流道模具规格参数」「透明光学注塑件规格参数」单字竖排，故该站仍有碎折行，不能判通过。768/1440正常，最终提交入口12个组合overflow=0、overlaps=0，不能用这两个零替代碎折行判定。 |

molding新碎列的直接根因在本轮真实版本的CSS：`artifacts/t186/generated-source/case-2/css.css:117` 将table/tbody/tr/th/td改为block，却遗漏caption；caption保留table-caption，在匿名表格布局中收缩。对应 `products.html:14` 与`:87`，截图 `eval/private/case-2/products-375.png`。这是模型响应对「表格改字段行」执行不完整；最小方向是同次重排覆盖caption的显示与可用宽度，保留表题，不删内容。无需改T-196的两个文件。本轮不改已生成版本、不补跑，不把这个失败藏在「原位置改善」中；后续提示补强和效果验证交主控另定。


### 第一轮最终记录（codex-t186b接续核对）

命令与候选为上文的六组合完整档、dd1827dc1d4da7f8e1c9c1a3339417a0bc96bb08；round记录dirty=true，当时含票据、主线说明与Next自动tsconfig改动，没有第二套提示代码。开始2026-10-19 14:25:03.283 EDT（18:25:03.283Z）；最后生成run在14:53:11.678 EDT complete，最终round.json/summary.json在14:55:42 EDT落盘。评估退出1，最终INCOMPLETE。账本 `artifacts/t174/t186-narrow-eval/usage.json` 实付662,439 token，20次调用全部complete、HTTP200，无截断、重发或上游中断。

| case／组合 | outcome | 站点ID | 版本ID | generate起止（UTC，updatedAt为终态时间） |
| --- | --- | --- | --- | --- |
| 1／industrial/documentary | generated | `a31b4b28-e618-4e79-b1d8-c8a6982361f4` | `809ae093-209f-4613-b104-c5ae0d4d85ce` | 2026-10-19T18:25:22.572Z → 2026-10-19T18:30:14.421Z |
| 2／molding/documentary | generated | `c06fc9e3-0d70-45a8-aa11-bd85127ee5b1` | `ddefcab0-3bce-4d66-b0d4-64031eb4b420` | 2026-10-19T18:30:47.715Z → 2026-10-19T18:34:08.454Z |
| 3／packaging/documentary | generated | `fd5a142f-9193-43b0-8ada-0c97742f7440` | `9432da84-12bf-483f-8560-7e864a4c285a` | 2026-10-19T18:34:48.529Z → 2026-10-19T18:39:12.861Z |
| 4／restaurant/editorial | generated | `b78de6c0-6619-4011-ba5c-ad3b0caa89b4` | `64db5ab2-2133-49ca-9bee-363ec77b8245` | 2026-10-19T18:39:50.682Z → 2026-10-19T18:45:03.238Z |
| 5／restaurant/neighborly | generated | `04608952-e796-440f-a440-8c358b782579` | `0b417058-ec5c-44ca-91eb-1a3e06a71655` | 2026-10-19T18:45:43.683Z → 2026-10-19T18:49:05.434Z |
| 6／education/editorial | generated | `9e8fec79-a983-46be-ab02-e29228517b7a` | `77959e79-ba34-45a7-b0b4-bd06f14bd8dc` | 2026-10-19T18:49:32.618Z → 2026-10-19T18:53:11.678Z |

六站12个plan/generate run均complete，每站一个版本。除education/editorial外五站首次checks.issues均为空；education首次拒因原文如下，正常修正后第二次issues为空，最终六站检查均passed=true：

> “教师分别指出每位学员的观察与画面组织问题”中的“每位学员”资料未明确；资料原句为“教师分别指出观察与画面组织问题”，不能确认是对每位学员逐一指出。
>
> “公开作品与课堂展示材料待作品授权补齐后整理”把课堂展示材料一并说成待作品授权补齐；资料仅说公开作品区待作品授权补齐后整理，课堂展示材料按实际授权整理。

外部对照错误原文（不重跑、不修网络）：

- 对照 molding/1：AssertionError [ERR_ASSERTION]: 页面未载入或为空：https://www.saihao.com/
- 对照 restaurant/1：AssertionError [ERR_ASSERTION]: 页面入场或转场未结束，本次未保存截图
- 对照 education/0：AssertionError [ERR_ASSERTION]: 截图含未加载图片：https://www.neworiental.org/（1 !== 0）

盲评包：`artifacts/t186/eval/review/company/` 含4个换公司题、6站首页的12张375/1440图片，tasks.json引用均实际存在，company子包可交主控；`review/mixed/`共13项，但完整覆盖检查失败：`mixed 池需要每站一份独立真实官网，共6份；来源不能重复`。整体review.complete=false；`comparison-review/`未请求跨轮比较。齐全性来自 `private/blind-coverage.json` 及文件存在性，不代表盲评通过；本执行者未开审核或盲评实例。

执行主控2026-10-19 14:56:36 EDT经draft接口确认12个run终态与网关在途0后，向网关29496和dev29557发送SIGINT并确认端口关闭；记录 `artifacts/t186/eval-control/stopped-by-supervisor.txt` 及六份draft快照。接续者未重新启动第一轮服务或评估。构思主控随后看过六站375截图并指出molding回归；本轮第二次评估的375截图由另派非执行者判定。

### 本轮回归修复范围

认领codex-t186b。目标是完整处理表格到字段行的转换，验收是实际模型提示含完整合同、原case-2结构在浏览器中复现竖排并能用规范内写法正常成行、三档不溢出；真实模型效果交本轮唯一molding评估和非执行者判图。Tracer bullet继续经过生产planSiteCode/writeSiteCode与浏览器渲染；Deep modules保留既有rules/writeLocalEdit接口；Ubiquitous language区分表题caption、图注figcaption与字段行，不混称。

现场五类规格区中实际有2个table/caption和3组dl，并非5个caption。375/products的T-160 narrowColumns=2，其余页面视口均0；最终issues为空且已存版。因此这类一字一行当前仅触发质量反馈，不拒收、不触发修正轮。是否将极端窄列改为拒收属于底线变更，由构思主控另问负责人，本票不改。

### 本轮红绿证据与提示改动

新增只含现场CSS及products原文的 `tests/fixtures/t186-molding-products.json`，记录来源case-2和版本ddefcab0-3bce-4d66-b0d4-64031eb4b420，不含资料、密钥或站点存储写入。`tests/t186-table-reflow.test.ts` 通过生产静态渲染器和真实Chrome复现，按逐字Range的实际行位置计算每行字数；期望来自「表题正常成行，不得一字一行」，不用截图、像素或字节比较。负对照保留原代码，正对照直接读取核心规范中发给模型的CSS示例，不在测试里另藏修复样式。扩展夹具加thead/tfoot、colgroup/col和figure/figcaption，保留tbody的th scope及标签与值；只验证完整两列字段行写法，不宣称示例适用于未经重组的多列表。

在修改提示前，dd1827d上运行 `CHROME_PATH=… npm test -- tests/t186-table-reflow.test.ts tests/t186-narrow-wrapping.test.ts --browser-concurrency=1`，`artifacts/t186/reflow/red-2.log` 为6/6红：现场caption每行[1,1,1,1,1,1,1,1,1,1,1]；扩展夹具列布局盒仍保留；四种风格缺caption等关联元素提示。原始red.log另保留了扩展夹具预期错误（加表头后旧代码不必仍是单字竖排），不将其作为产品红证据。两轮失败目录分别为 `artifacts/t167/test-run-1792450663540-46297/` 和 `test-run-1792450710195-51120/`。

之后在核心规范补完整两列字段行示例：caption、thead、tbody、tfoot、tr、th、td共同转block并占满宽度，colgroup/col只停用布局盒，figure与figcaption也核对宽度；多列/跨行跨列表先保留行列标题对应再用HTML字段重组。正常两列表优先保留原生表格。不删表题、表头、表尾，不用CSS生成字段名。四种风格首段同步简明合同，writeLocalEdit仍只取首段，没有新增运行时样式或检查。

修后标准定向入口包括table-reflow、narrow-wrapping、t184-style-visual、t188-condition-scope，浏览器并发1，21/21通过，无跳过或取消，见 `artifacts/t186/reflow/green.log`、`artifacts/t167/test-run-1792450759499-57620/`。真实原结构两个caption在375/768/1440均为[11]；扩展结构两个caption均[11]、两个figcaption均[7]，表头表尾可见、行头scope及对应值未变、列宽盒停用，三档横向溢出均false。测量和渲染HTML保存在 `artifacts/t186/reflow/browser-1792450767249-58404/`。`npm run typecheck`退出0，见 `artifacts/t186/reflow/typecheck.log`。这是提示送达和示例可执行的证据，不等于模型遵从或真实截图已通过。未跑全量、runner、build或审核实例。

第二轮唯一授权：molding/documentary，输出 `artifacts/t186/eval-r2`，新账本 `artifacts/t174/t186-narrow-eval-r2`，SITECRAFT_TOKEN_LIMIT=200000。本轮唯一curl连通性检查退出0、HTTP401；端点可达，实际凭据调用以网关记录为准。375截图只记录路径，交主控另派非执行者逐张看。

### 第二轮真实评估与交接

执行候选 `88b0f24508aeffcda2063f5bbd02b0acbd1bae64`，仅跑下列命令一次，未加previous（上一轮六组合与本轮单组合集合不同），未重跑失败站或修改生成版本：

```sh
SITECRAFT_BASE=http://127.0.0.1:60350 SITECRAFT_TOKEN_LIMIT=200000 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm run eval:new-route -- --only molding/documentary --out artifacts/t186/eval-r2
```

独立数据根为本工作树 `artifacts/t186/eval-r2-data`，随机应用端口60350、网关60351；health核对cwd/dataRoot，见 `health-r2.json` 与 `services-r2.json`。应用只持占位凭据local-budget-gateway，真实密钥仅在网关子进程source载入且丢弃source输出。新账本 `artifacts/t174/t186-narrow-eval-r2/usage.json` 显式上限200000，初始调用0，唯一default轮登记后开始。实际共101,442 token、3次调用，均complete、HTTP200、正常finish_reason，无修正轮、截断、上游错误或重试。

开始2026-10-19 19:01:47.618 EDT（23:01:47.618Z）；plan终态19:02:07.713 EDT，generate终态19:05:31.979 EDT。case-1 molding/documentary的outcome=generated，站点 `2c1bb9a1-3798-449c-9f26-eebd1b6bfc26`，版本 `f450a0f7-13c0-4dce-a147-ba3ea8332b44`；首次attempt检查passed=true、issues=[]，仅一个版本。这里只记录提交检查结果，不把它当成caption视觉已通过。

评估进程退出1，总状态INCOMPLETE，round.errors=[]；`private/blind-coverage.json` 记录mixed=3、company=0、paired=0，review.complete=false，原文为「mixed 池需要每站一份独立真实官网，共1份；来源不能重复」。包路径 `artifacts/t186/eval-r2/review/mixed/` 与 `review/company/`；单公司没有换公司配对题，不能将本轮company路径称为齐备可盲评。未请求跨轮比较，未启动任何审核或盲评实例。

四页三档共12张整页截图及1张首页首屏均已落盘。**本轮375截图未由执行者打开或判定**，以下交主控另派非执行者逐张查看：

- `artifacts/t186/eval-r2/private/case-1/home-375.png`
- `artifacts/t186/eval-r2/private/case-1/products-375.png`
- `artifacts/t186/eval-r2/private/case-1/production-quality-375.png`
- `artifacts/t186/eval-r2/private/case-1/faq-375.png`

768与1440同目录、同页名前缀；所有路径均核对文件实际存在，只证明产物齐全，不证明碎折行消失。生成响应、检查及原始用量在 `private/case-1/code-site.json`、`report.json` 与新账本中保留；`eval-r2.log` 记录评估器总状态。

评估退出后另经生产draft接口确认2个run均complete，并经网关status确认3个调用complete、在途0，保存 `artifacts/t186/eval-r2-control/draft.json` 与 `gateway-terminal.json`；随后手动向网关71367和dev71373发SIGINT。2026-10-19 19:07:53.564 EDT确认60350、60351均关闭，见 `eval-r2-control/stopped.json`。应用与网关会话均已退出。

交接状态INCOMPLETE：代码和定向门控通过，本轮唯一真实生成完成；真实375效果待非执行者判图，整体审包覆盖未通过，票保持open。没有改T-196占用文件、没有推送、没有写主工作区数据或artifacts。tsconfig.json仅Next自动变化，保留且排除提交。全量、runner、build、独立审查依本次指令未运行；本票不改变T-160反馈为拒收规则。

**独立审查（主控记录，2026-10-19 EDT）。** 新实例独立审查 GO，见主工作区 `artifacts/t186/review1.txt`：P0–P2 均无；P3 一项为 restaurant/editorial 根因说明的手机字号，已在上文更正。company 盲评（第一轮 6 站包，新实例）4 对判同模板 0，揭盲见主工作区 `artifacts/t186/blind-results/company-unblind.txt`；该包中的 molding/documentary 为出现 caption 竖排回归前的第一轮版本。molding/documentary 修复后单站重跑的截图由非执行者实例逐张判读，回归已消失，见 `artifacts/t186/judgement-r2.md`。

**company 盲评口径（构思主控决定，2026-10-19 EDT）。** company 盲评采用第一轮 6 站包的结果（4 对判同模板 0）。该包中的 molding/documentary 是 caption 竖排回归修复前的版本。没有重评，原因有两个：第二轮只重跑了 molding 一站，评估器生成的 company 包为空；company 判断的是不同公司之间是否像同一模板，而本次修复只改窄屏下 caption 的显示方式，不影响骨架判断，手工拼包不值得。
