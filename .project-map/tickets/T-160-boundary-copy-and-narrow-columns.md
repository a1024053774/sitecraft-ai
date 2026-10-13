---
id: T-160
title: 边界说明不再原样写成页面文案，文字不被挤成过窄的列
type: build
status: open
blocked_by: []
claimed_by: Codex (t160-education-rerun)
supersedes:
---

## Why

T-158 三站盲评（餐饮、培训、工业各一，真实感 5–6/10）共同扣分：

1. **边界说明原样上页**：资料里约束写作的句子（「不写成固定季节菜单」「不叠加自行推导的折扣」「不是第三个系列」）被当成顾客文案；「不承诺」「不考级」类声明过密，读起来像规则告知。根因有两层：T-157 的模拟资料把写作约束混在事实句里；核心规范只说「保留否定和边界」，没说边界是用来约束不写什么、只在访客需要时用自然的公司口吻说一次。
2. **过窄的文字列**：培训内容页 375 下一句被挤成每行约两字，工业首页「供货案例」的需求/边界列在 1440 和 375 都碎行。现有底线检查只查溢出、重叠、对比度和长行，不查过短行。

「待补充」集中出现也被扣分，但它是已定规则（让客户看到还需补什么），本票不改；如要改由负责人另开决定票。

## What to build

1. T-157 三家非工业资料：把写给网站作者的约束句（「不写成…」「不把…写成…」「不据此增加…」）从事实句里拆出，放进资料末尾的「页面要求」或删掉；事实与真实的否定（如「不设包间」「不承接宴席」）保留。工业四家同查一遍，只改明显是写作指令的句子，改动列在 Resolution。
2. 核心规范加一句通用原则：资料里的边界与否定用于约束不写什么；对访客有用的限制用公司口吻在相关位置说一次，不逐条罗列，不把写作要求放进页面。保持文件短。
3. 提交入口的机械质量反馈加「过窄文字列」：正文块在 375/768/1440 下每行平均字数过低（阈值由测试先定，中文按字、英文按词）记为质量反馈，和 T-147 行长同类：进入版本检查和评估统计，**不拒收、不触发修正轮**。先列失效方式（表格单元格、按钮、标签不算正文等），红绿测试在父提交上失败。
4. 同步 mainline、spec、CONTEXT。

## Acceptance

- [x] 资料拆分前后对照，事实未删
- [x] 过窄列反馈的红绿测试；用 T-158 两站的已存代码离线跑出反馈（培训内容页 375、工业首页案例区应被标出），不调用模型
- [ ] 真实验证（预算主控报批，约 2 站 quick 18 万 token）：餐饮与培训重生成，与 T-158 版成对盲评「更像这家店/机构」不变差，且边界类原样文案减少
- [x] typecheck、test、build 通过

## 离线验收合同（实现前固定）

主控转达 Astra 对 `66a3054` 的 NO_GO 后，本次仍由 Codex (t160-build) 处理三类 P2；先在该提交复现，再做一个新的本地提交，不关票。新增失效方式：价格语义不能豁免容器/混合段落的说明正文，纯价格值仍豁免；`display:contents` 无盒不等于文字不可见，真正隐藏/折叠仍排除；CSS 多栏的分栏片段不能因纵坐标相同合成一行。保持原中英文阈值与质量反馈口径。配对用例通过真实 `checkSiteCode`，并直接重跑 Astra 交付的 `reproduce.mjs`；本次不改资料、核心规范、生成流程或阈值。

目标是减少写作约束混入事实，以及记录碎行正文；不改生成路线、存版门槛、待补充政策，也不调用真实模型。**Ubiquitous language**：统一称「过窄文字列」，字段 `narrowColumns`。**Tracer bullet**：真实 Chrome → 提交入口 → 已保存版本 → 评估统计先贯通。**Deep modules**：沿用现有质量反馈入口，不增设平行检查 API。

失效方式与阈值：

- 连续正文被挤成多行却不溢出；至少 3 个实际渲染行，中文至少 8 个汉字、平均每行严格少于 6 字；纯英文至少 8 词、平均每行严格少于 3 词。英文按完整词计数，断词跨行不重复计词，inline 节点间空格与 br 分词保留。少于 8 汉字/词或少于 3 行不报；等于阈值不报。
- 首次离线扫描发现营业时间混合数字时只数汉字会误报；先增加 `mixed-normal` 和 `inline-words` 反例并复现红灯，再让中文均值沿用现有行长的非空白字符口径（含数字和标点），正文资格仍至少 8 汉字，阈值不变。首次误报保留在 `artifacts/t160/offline-1/`。
- 不以整块宽度或整页平均代替实际文字行；最近块级/独立排版容器分别测量，不能合并并排 flex/grid 子项、inline-block；普通 inline 强调不拆开句子，不重复计父子。
- 表格单元格（含后代）、标题、按钮/控件、导航、短标签、价格、型号/参数字段、联系方式、系统署名不算正文；`caption` 的说明句与 `dd` 的正文仍测，不能豁免整个 table/dl。
- display:none、visibility:hidden、祖先 opacity:0 等不可见文字不算；字体加载完成后按三个视口分别测，短尾行随整段平均，正常宽度的段落不误报。
- 新反馈保存数量、文字、可定位节点及计量原因，不能进入 issues、拒收或修正；旧版本即使有 T-147 反馈但无新字段也算未测，不能进入已测分母或产生 NaN。

阈值是本票保守机械信号，不代表审美结论。红灯使用尚未修改行为的父提交 `2c4bb92`；真实坏样本作为独立离线验收，不据实现输出编写预期。

## Resolution

Codex (t160-build)：离线实现与修复检查 PASS；负责人批准的本次真实验证 **BLOCKED**（见下节）。票保持 open，独立成对盲评尚未完成。本次只运行一次获批的两站 quick，未补跑或绕过提交入口。真实密钥仅在预算网关进程 source 主工作区 .env.local，没有复制、打印或软链。基线按本次授权只读主工作区两个指定站点 JSON；主数据未写入。新站点、失败候选、原始账本及全部证据保留。

### 资料拆分对照

全部改动为将作者要求移到各包末尾「页面要求」，没有删除原业务事实、否定、条件、数字、时间、缺口或授权边界；原有独立「图片使用」段保留。

| 资料包 | 原事实段中的作者要求 → 末尾页面要求 | 留在事实段的内容 |
| --- | --- | --- |
| 工业 | 产品中的「不是第三个商品」→ 加工方式不单列为第三个商品/系列 | 两种减速机、按图加工、安装/散单限制及全部规格与案例边界 |
| 外贸 | 交付段「不把批次报告写成产品认证」→ 页面要求 | 材料报告随订单约定提供、认证状态、温度/压力与不同供应方混装边界 |
| 注塑 | 无明显作者指令需要拆分，原文不改 | 透光率只对应既定材料厚度、不能等同整灯光效等属于真实技术限定 |
| 纸包装 | 简介「请把纸盒和内托分开介绍」→ 页面要求 | 纸盒和内托起订量与交期不同；没有食品直接接触许可、不接裸装食品包装 |
| 餐饮 | 纯素/无麸质宣传、固定季节菜单、推导折扣/人均价/外送、误用停止点菜时间、地图距离、把流程写成认证、由外带增加网站功能、擅补资质/评价 → 页面要求 | 菜单、价格、午晚市供应、不保证同品种/素汤、共用厨房和调味料、过敏原及交叉接触限制、24 座/不设包间、不承接宴席包场等、收费与点菜时间、全部待补充 |
| 培训 | 旅游活动包装、赠课优惠、材料清单的网页呈现/假下载、把示范当成绩、无来源对比图、名师职称宣传、所有课写成零基础、无条件退款 → 页面要求 | 年龄和课程前提、课次/费用、整期收取不拆售、材料自备、教具不能带走、示范不是学员成果、授权限制、不考级不发证、不保证进度/就业、不承诺补课及退款缺口 |
| 设计 | 由服务名推导其他服务、免费/低价/无限修改、周期相加/保证日期、印刷效果保证、作品匿名呈现/假 Logo 和示意冒充作品、销售增长、团队奖项/驻场响应/到店承诺 → 页面要求 | 三项服务及实际排除范围、按项目核算无统一套餐、周期起算和不包含时间、版权和作品授权缺口、实际岗位、地址时间及资质缺口 |

测试/eval：`t157-non-industrial-cases` 仍通过真实 prepare-only CLI 检查 quick/full 资料；现在读取末尾页数要求，并核对前面的作者要求完整保留。历史真实回复夹具不改写，避免丢失当时的原始资料证据。

### 规范与反馈

核心规范替换同义旧句为：「资料里的边界与否定用于约束不写什么；对访客有用的限制用公司口吻在相关位置说一次，不逐条罗列，不把页面要求、建站指令与图片使用要求写进页面。」没有新增行业例外。mainline、spec、CONTEXT 及 AGENTS 的质量反馈清单同步。

`narrowColumns` 复用提交入口的质量反馈，保存数量、文字、DOM 定位和平均字/词数，评估按项统计触发和已测分母；阈值保持不变。`66a3054` 的独立 Astra 结论为 NO_GO，原复现及失败日志保留在 `artifacts/t160-review-20261011/`；本次按三类 P2 一起修复：

- **价格范围**：取消 price/fee 及 data-price/data-fee 的祖先豁免。只在独立正文块的完整文字匹配金额格式时豁免纯价格值；带标签、条件、说明或正文后代的价格容器照常测量。纯价格（含内联强调）、同段价格加说明、容器后代正文、价格后附收费条件均有配对反例；旧测试把「课程学费每期…」当价格值的预期已按主控标准修正。
- **文字可见性**：按实际文字 Range 的矩形和祖先 display/opacity/content-visibility/折叠状态判定，保留 visibility 的实际继承结果；`display:contents` 没有盒子不会再丢弃文字，也不充当独立排版容器。嵌套 contents、flex 内 contents、正常宽度和真正隐藏内容成对测试。
- **多栏行计量**：找到正文自身或祖先的 CSS 多栏容器，按 column-count/column-width、内边距和列间距区分分栏片段，再在各列内合并同一行。覆盖直接多栏、祖先多栏、column-width、RTL，以及单栏和 column-span:all 对照，不再仅用相同纵坐标合行。

正文仍按最近块级/独立排版容器分组；caption 与 dd 保留，表格单元格、标题、控件、导航、声明参数及短文案等排除。测量先于底线核对展开隐藏内容；没有新增拒因、修正轮或存版旁路。`tests/t160-narrow-columns.test.ts` 已进入默认 `npm test`，AGENTS 登记三类自动回归检查，防止再次用短价格或单一布局样本证明整类豁免。mainline、spec、CONTEXT 同步当前规则。

### 本次证据

所有命令在此 worktree，公共环境为 `SITECRAFT_BASE=http://127.0.0.1:3188 SITE_STORE=fs CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell`。以下 UTC 时间均为 2026-10-11；本次日志统一在 `artifacts/t160/astra-fix/`，最终 SHA 写入同目录 verification 文件。`66a3054` 是本次已知坏父提交，不是修复后的验收版本。

- 16:10：不改 Astra 的输入或脚本，执行 `node --experimental-strip-types artifacts/t160-review-20261011/reproduce.mjs`，**预期退出 1**；375/768/1440 均遗漏 fee-paragraph、fee-descendant、contents-container、columns（`reproduction-red.log`）。16:16 对最终实现执行同一命令，**退出 0，三档 missing 均为空**（`reproduction-final-green.log`）；脚本生成的 JSON 仍硬编码 candidate=66a3054，真实候选由本票 diff 和 verification 文件标识。
- 16:14:38：`node --test --experimental-strip-types tests/t160-narrow-columns.test.ts` 对 `66a3054` 的 `lib/code-site-check.ts` 执行，**5 PASS / 新增三类测试全部 FAIL**，退出 1（`parent-final-red.log`）；只在内存保留本票文件、临时读取父版本，结束即还原。当前实现已通过同一测试。`price-condition-red.log` 另保留金额后附条件的中间红灯，修法为只匹配完整金额，不泛接受斜杠后的任意文案。
- 16:14:11：`node --test --experimental-strip-types tests/t160-*.test.ts tests/t147-code-quality.test.ts`，**23/23 PASS**（`focused-final.log`），包含资料拆分、价格/可见性/多栏配对、真实存版仍通过且无拒因/修正、评估未测分母及 T-147 原有五项反馈。
- 16:15–16:17：最终 `npm run typecheck`、`npm test`、`npm run build` 均退出 0；**417/417 测试通过，无跳过**。日志为 `typecheck-final.log`、`test.log`、`build.log`，退出状态与最终提交号写入 verification 文件。UTF-8/LF、无替换字符与 `git diff --check` 检查通过；project-map status 无问题、无过时 living doc。
- 16:15：`node --experimental-strip-types artifacts/t160/replay.ts artifacts/t160/astra-fix/offline-final --checks-only` 对最终代码重跑三站，**18/18 已测、硬拒因 0、模型调用 0**。结果与统计在 `offline-final/`。本次 `node --experimental-strip-types artifacts/t160/replay.ts artifacts/t160/astra-fix/offline` 另保存 9 张整页截图，均逐张打开、内容完整载入，静态渲染器和快照代码未改。原复现脚本本次生成的图片也已打开；16:12 的中间空白截图保留但不作证据，最终 16:15 复现截图正常。旧证据保持原样，没有改写或覆盖。

| 站点 | 375 | 768 | 1440 | 说明 |
| --- | --- | --- | --- | --- |
| 工业首页 | 6 | 6 | 5 | 供货案例需求与边界列命中；产品页三档均 0 |
| 培训课程页 | 1 | 1 | 0 | 「学费按完整一期收取，不按单次课拆售。」18 个非空白字符 / 9 行 = 2 字/行；首页三档均 0 |
| 餐饮首页与菜单 | 0 | 0 | 0 | 首轮营业时间误报已以通用混合数字规则修复；原结果 `offline-1/` 保留 |

本次重新运行仍为 2/3 站触发、19 个页面/视口实例，与 66a3054 的三站结果相同；不是沿用旧结果。三条 Astra 反例已红绿验证，主控已在下方审查中记录已知限制；本段只说明离线技术结果，不宣布审美通过。真实运行的授权、停止原因和交付见下一节。


### 真实验证与交付（2026-10-12 UTC / 2026-10-11 纽约时间）

负责人批准 DeepSeek **150,000 total token 硬上限**。实际只启动一次：
`npm run eval:new-route -- --quick --only restaurant/documentary,education/documentary --out artifacts/t160/real-20261012014829Z`。
运行基于 `13e5422`，唯一执行脚本改动为预算网关允许 `artifacts/t160/`，未改核心规范、资料或测量器。`tests/t153-budget.test.ts` 的 T-160/150000 目录合同先在原实现失败，再通过本地 HTTP 入口验证 150001 被拒、零上游调用、账本终止，最终 4/4 PASS；日志 `artifacts/t160/real-setup/budget-{red,green}.log`。

环境：`SITECRAFT_BASE=http://127.0.0.1:3188 SITECRAFT_BUDGET_BASE=http://127.0.0.1:3189 SITECRAFT_TOKEN_LIMIT=150000 SITE_STORE=fs`，CHROME_PATH 沿用 AGENTS 指定路径，应用数据根固定本工作树 .sitecraft-data。网关 `T153_BUDGET_DIR=artifacts/t160/budget-20261012014829Z`，只登记一次 /round default/150000。只有网关通过 `set -a; source /Users/luckye/Documents/Code/sitecraft-ai/.env.local; set +a` 载入密钥；应用只用网关地址和占位凭据。启动前核对 /api/health 的 cwd、模型与存储。

**停止原因**：培训初稿首页「成人业余绘画 · 线下小班 · 杭州市西湖区」在三档的对比度均为 4.21（要求 4.5），触发第 1 轮修正。网关在出网前拒绝该请求：剩余 51,510 token 无法按完整请求 UTF-8 字节数 + 8192 预留输入，并留下至少 4096 输出，记录 `Remaining authorization cannot reserve this request and a usable output allowance` 后终止。应用显示的 HTTP 502 是**本地预算拒绝**，不是 DeepSeek 402 或网络错误。5 次真实调用均 HTTP 200、正常结束，共 **98,490 / 150,000 token**，没有未知上游用量；该修正请求未出网、未计费。未放宽预留、拆请求、手改颜色、调用恢复或重跑；培训未存版本、未做事实核对。

| 站点 / 阶段 | 输入 token | 输出 token（含思考） | 其中思考 | total token |
| --- | ---: | ---: | ---: | ---: |
| 餐饮 / 规划 | 8,755 | 1,897 | 1,226 | 10,652 |
| 餐饮 / 写页 | 9,831 | 23,246 | 16,623 | 33,077 |
| 餐饮 / 事实核对 | 5,724 | 3,782 | 3,542 | 9,506 |
| 培训 / 规划 | 8,955 | 1,674 | 992 | 10,629 |
| 培训 / 写页 | 10,142 | 24,484 | 17,481 | 34,626 |
| 培训 / 修正 | 0 | 0 | 0 | 0（本地拦停） |

餐饮合计 **53,235**，新核 26 段、沿用 0 段，0 修正，首轮底线 PASS，存 v1。培训合计 **45,255**，事实核对未运行、核对段数未测；run 进入 repairRound=1，但模型实际修正 0 次，只保留初稿拒收候选。两站各 2 页 × 375/768/1440 的窄列反馈全部为 0；培训的 6 项是候选检查，不能当成已存版本通过。各阶段调用、所有 viewports、其他质量反馈和拒因见本轮 `report/{restaurant,education}.json`。账本与应用的 5 次上游记录逐次对齐，本地拒绝另计。

**机械指令句对比**：先冻结 `private/instruction-rubric.json`，把末尾页面要求按句号/分号/逗号拆分；分别报告完整分句及从首个「不」开始的指令短语，正向要求保留全句。只去空白和标点，不做同义匹配；在三档采集默认展开状态下的 innerText 和可见 CSS 生成字符串，同一指令跨宽度去重。本次没有未解析 CSS 生成内容。旧基线固定 T-158 v1。原句、短语、页码、宽度及可见全文见 `report/instruction-comparison.json`、`report/report.txt`。

| 站点 | 指令分句数 | 完整分句：T-158 → 本轮 | 指令短语：T-158 → 本轮 |
| --- | ---: | --- | --- |
| 餐饮 | 12 | 0 → 0 | **3 → 0**（本轮为已存版本） |
| 培训 | 10 | 1 → 0 | **2 → 0**（本轮为拒收候选） |

T-158 命中的来源原句及短语：

- 餐饮菜单：「时蔬豆腐煲不能按严格纯素或无麸质菜品宣传」→「不能按严格纯素或无麸质菜品宣传」。
- 餐饮菜单：「当日清炒时蔬不写成固定季节菜单」→「不写成固定季节菜单」。
- 餐饮菜单：「午市组合不叠加自行推导的折扣」→「不叠加自行推导的折扣」。
- 培训首页：「示范作品不写成成功率或考级成绩」→「不写成成功率或考级成绩」。
- 培训课程页：「不把所有课程写为零基础皆可」完整命中。

本轮两份页面均无上述逐字命中；这不能证明没有改写后的作者口吻或限制声明不过密，该判断留给盲评。

**成对包**：包名、A/B 归属和查看顺序随机，映射在同包 private/mapping.json，不写进评审提示。每包两版 × 首页/内容页 × 1440/375，共 8 张图；questions.md 使用负责人指定的两个问题并允许持平。只把各自 review/ 交不同新评审：

- 餐饮：`artifacts/t160/real-20261012014829Z/packages/91ac2b17/review/`。
- 培训：`artifacts/t160/real-20261012014829Z/packages/a05a4d94/review/`。**本轮为拒收候选**，私有映射记录 accepted=false、versionId=null、factAudit=not-run 和三条对比度拒因，只供视觉对比，不能判为成功生成。

T-158 图直接复用主工作区 `artifacts/t158/real-20261011T123145Z/private/case-{2,3}/`。本轮餐饮走预览采集；培训仅将运行记录中的原候选经同一静态渲染器离线截图，没修代码或存版，三档图在 private/rejected-education/。本轮 15 张唯一截图（两站整页 12、餐饮首屏 1、默认官网对照 2）和 A/B 包 16 张均逐张打开，完整载入；旧图在包中逐张核对。报告/配包命令：`node --experimental-strip-types artifacts/t160/report-real.mjs artifacts/t160/real-20261012014829Z artifacts/t160/budget-20261012014829Z`，不调用模型。

**数据保留**：共 4 个实际文件，全部绝对路径与分类见 `artifacts/t160/real-20261012014829Z/report/data-files.json`，沿用 T-158 格式。均在本 worktree；没有上传、leads 或 annotations 文件。

| 站点 | siteId | versionId | 状态 |
| --- | --- | --- | --- |
| 餐饮 | 32e0ab93-d3c5-470e-b4cd-16180fd5ba8b | 60cde704-7364-461c-a236-9af8933c5b4c | 完整 v1 + 会话 |
| 培训 | 8ccff20c-094b-451e-b9b7-cdbf630f8a17 | 无（null） | 失败运行、候选、拒因 + 会话；无版本 |

本次脚本修改后的 npm run typecheck、npm test（418/418，0 skipped）、npm run build 全部退出 0，日志在本轮 report/{typecheck,test,build}.log；所有命令显式设置本工作树 SITECRAFT_BASE 和 SITE_STORE=fs，浏览器测试另设 CHROME_PATH。原始 eval 状态保持 BLOCKED，网关已停止。最终本地提交号和核对结果写入本轮 report/verification.json；不推送、不关票。后续是否继续培训生成或改预算策略由主控决定；本次授权的一次运行已使用，不自动消费剩余额度。

## 主控审查（2026-10-11，纽约时间）

- Astra 对 `66a3054` NO_GO（价格豁免扩散、display:contents 跳过、多栏合行），`e324f3f` 已红绿修复。复核仍 NO_GO，三条更偏的边界：中文大写金额（「人民币壹仟贰佰捌拾元整/期」）在 4em 宽字段被误报；`display:contents` 叠加 `content-visibility:hidden` 的祖先导致漏测；外层 `transform: scale()` 的多栏仍跨列合行。复现在 `artifacts/t160-review-e324f3f/`。
- 主控决定不再迭代：该项只是质量反馈，不拒收、不触发修正（与 T-147 行长同类），按 T-120 不为验收工具的边角写法连续修补。以上三条作为已知限制保留；若真实生成站里出现对应误报/漏报再开票。

### 培训单站补跑（2026-10-13，UTC / 纽约时间）：PASS

Codex (t160-education-rerun)：按负责人本次批准的 **100,000 total token 硬上限**，只重新生成拾色绘画教室一站一次。开工只读主工作区票中的「主控验收（2026-10-13）」及指定 T-158 站点；没有修改网关、资料、核心规范或生成代码，没有再次消费上轮额度，没有重跑掩盖失败。此前失败候选与账本保留。本节是补跑交付结果，票仍 open，真实验证勾选留给 Claude 主控整合；不推送。

**命令与时间**：代码候选为本工作树分支 `t160-boundary-copy` 的 `80cae11e5f7e1f62d6d8babb1dfd974c648d39d1`，运行时唯一未提交差异是本票 claimed_by。2026-10-13 **15:07:02.805 UTC / 11:07:02.805 纽约时间**启动：

`npm run eval:new-route -- --quick --only education/documentary --out artifacts/t160/real-edu-20261013T150614Z`

公共环境为 `SITECRAFT_BASE=http://127.0.0.1:3188 SITECRAFT_BUDGET_BASE=http://127.0.0.1:3189 SITECRAFT_TOKEN_LIMIT=100000 SITE_STORE=fs`，CHROME_PATH 为 AGENTS 指定 chrome-headless-shell；应用数据根为本工作树 `.sitecraft-data`。预算命令为 `node --experimental-strip-types scripts/t153-real-budget.ts`，新账本目录 `T153_BUDGET_DIR=artifacts/t160/budget-edu-20261013T150614Z`，只登记一次 `/round default/100000`。密钥仅通过负责人指定的 `set -a; source /Users/luckye/Documents/Code/sitecraft-ai/.env.local; set +a` 载入网关进程，应用只用占位凭据和预算网关地址。启动前 health 确认 cwd、文件存储与 deepseek-flash；本次无 402、网络错误或本地预算拦停，网关完成三次调用后已主动停止。

**用量与提交入口**：三次上游调用均 HTTP 200、正常结束，应用用量与网关逐次一致，无未知用量。累计 **53,886 / 100,000 total token**；输出已包含思考 token，不能重复相加。

| 阶段 | 输入 token | 输出 token（含思考） | 其中思考 | total token |
| --- | ---: | ---: | ---: | ---: |
| 规划 | 8,955 | 1,539 | 774 | 10,494 |
| 写页 | 10,225 | 22,666 | 15,674 | 32,891 |
| 事实核对 | 6,508 | 3,993 | 3,771 | 10,501 |
| 修正 | 0 | 0 | 0 | 0 |

2026-10-13 15:09:14.050 UTC 保存完整 v1：新核 **24 段**、沿用 **0 段**，repairRound=0、实际模型修正 **0 次**，首稿底线 PASS、拒因为空。首页和课程页各 375/768/1440 共 **6/6 已测**：溢出、重叠、对比度拒因与**过窄文字列均为 0**。其它非拒收反馈如实保留：首页未门控悬停每档 3，课程页每档 2；375 两页点击区偏小各 4；课程页正文长行在 768 为 1、1440 为 2。完整检查与核对段见本轮 `report/education.json`，不是把全部质量反馈写成零。

**作者指令句统计**：先复用并冻结上轮培训资料「页面要求」中的 10 个分句；逐字匹配仅去空白和标点，完整分句与从首个「不」起的短语分开计，同一指令跨三个宽度去重，不做同义推断。默认可见 innerText 与 CSS 生成文字均采集，没有未解析 CSS 生成内容。T-158 指定站 v1 的完整分句 **1 → 0**，指令短语 **2 → 0**；旧命中为首页「不写成成功率或考级成绩」及课程页「不把所有课程写为零基础皆可」。原句、各页各宽度与可见全文见 `report/instruction-comparison.json`，摘要见 `report/report.txt`；零命中只证明这 10 条逐字要求未上页，不替代作者口吻的盲评。

**重复限制统计**：生成结果出现前，从原资料冻结 20 组业务限制。每页独立展示位置计 1，同句近义表述不重复计；公共页脚在两页出现计 2，三个视口不叠加。以 1440 为主计数，三档计数一致。以下均为 **T-158 → 本次**：

| 同类限制声明 | 次数 |
| --- | --- |
| 不做考级、艺考或升学培训 | 3 → 2 |
| 不颁证／没有考试证书 | 4 → 6 |
| 不承诺统一进度、期限内水平或完成课即专业水平 | 3 → 4 |
| 教具仅供课堂、不能带走 | 3 → 2 |
| 示范作品不是学员成果 | 1 → 2 |
| 未授权不公开学员资料 | 1 → 2 |
| 开放时间不是课程课表 | 4 → 2 |
| 不提供单独补课承诺 | 2 → 2 |

20 组总出现 **36 → 34** 处，重复组数 **9 → 8**，每组首次之外的重复出现 **16 → 14** 处。再按相同原句拆细：「不颁发学历、考级或职业资格证书」**1 → 3**（新版 FAQ 加两页公共页脚）；「不给所有人统一进度承诺」**1 → 2**（新版首页与课程页均出现）；「不做考级与升学培训」**1 → 1**。因此没有宣称「同一限制只说一次」已满足。20 组及每处摘录见 `report/restriction-comparison.json`／`.md`，同句计数见 `report/exact-statement-comparison.json`；这些是已登记限制的计数，不是所有否定词或全部业务边界的穷尽统计。

**成对包与独立盲评**：`artifacts/t160/real-edu-20261013T150614Z/packages/004bc796/review/`。包名、A/B 归属与查看顺序分别用 randomBytes/randomInt 随机；每版首页＋课程页 × 1440/375 共 8 张图，questions.md 沿用负责人指定两问并允许持平，来源与归属只在同包 `private/mapping.json`。旧图复用主工作区 `artifacts/t158/real-20261011T123145Z/private/case-3/`；新图从已保存版本预览采集。新版两页三档、首屏、官网对照共 8 张及包内 8 张均逐张打开，已完整载入。

新的独立 Codex gpt-6.1-sol 实例只收到该 review/，没有提供映射、统计、代码或历史；选择 **B 更像这家机构自己建的网站**，认为课程信息更便于选课，A 的 375 收费说明过窄，A 的限制提醒更显密集。主控映射 B 为本次 v1。原始意见在 `report/blind-review.md`：评审「两版都未见明显写给作者的指令」的观感与旧版逐字命中 2 条分别保留，未按统计改写或再评；「待补充」是既定规则，不作为本票拒因。执行者只核对截图完整性，没有自行宣布审美通过。

**数据保留**：siteId=`8bf7cb44-2059-4786-9496-54e7b419ae97`，versionId=`a3c38741-0637-44f5-b10c-29079fe352c2`，conversationId=`be45c8b8-9b55-486e-9c7e-90f69aee330d`。通过 draft API 再读取核对当前版本。实际文件共 2 个，均在本工作树；绝对路径与分类按前轮格式写入 `report/data-files.json`：

- `.sitecraft-data/code-sites/8bf7cb44-2059-4786-9496-54e7b419ae97.json`
- `.sitecraft-data/conversations/8bf7cb44-2059-4786-9496-54e7b419ae97/be45c8b8-9b55-486e-9c7e-90f69aee330d.json`

没有上传、annotations 或 leads 文件，不清理站点，不写主工作区数据。T-158 对照固定为 siteId=`e39b32b0-5eab-40b8-b228-3dc70ffc3c57` 的 v1，versionId=`91ef296b-57e1-4e33-8efd-5f95c07ac406`。

**检查与复现材料**：上述公共环境下 `npm run typecheck`、`npm test`、`npm run build` 均退出 0，2026-10-13 UTC 日志最后写入时间分别为 15:07:48、15:10:14、15:08:15；**418/418、0 fail、0 skipped**，日志在本轮 `report/{typecheck,test,build}.log`。生成入口的精确命令保存在 `command.sh`，一次性统计／配包命令为 `node --experimental-strip-types artifacts/t160/report-edu-20261013T150614Z.mjs artifacts/t160/real-edu-20261013T150614Z artifacts/t160/budget-edu-20261013T150614Z`（显式 SITECRAFT_BASE、SITECRAFT_TOKEN_LIMIT=100000、CHROME_PATH）；重复声明统计命令为 `node --experimental-strip-types artifacts/t160/restrictions-edu-20261013T150614Z.mjs artifacts/t160/real-edu-20261013T150614Z`，均不调用模型。授权、原始预算账本、运行日志、脚本和结果完整保留，没有覆盖旧证据。

本次实测 DeepSeek 与评估集的新东方官网对照；PostgreSQL/Mailpit、部署和外部邮件未测，均不属于本次范围。UTF-8、差异检查、project-map status 与本节所在的最终本地提交 SHA 记录在本轮 `report/verification.json`；生成及测试对应代码提交仍为 `80cae11`，本次只提交本票追加结果，不推送、不关票。

独立 Codex GPT-6 Astra 按 behavioral-acceptance-review 做只读证据审计，结论 **PASS（仅本次单站补跑与交付）**；逐次用量、draft 持久版、20 组统计、随机化脚本与完整检查日志均核对一致，未重复调用模型、测试或审美评审。原文在 `report/acceptance-review.txt`，不外推为跨样本或产品发布结论。
