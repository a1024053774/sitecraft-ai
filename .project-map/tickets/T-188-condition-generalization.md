---
id: T-188
title: 模型把条目条件概括进导语或挪到相邻条目：事实拒因与整站失败
type: build
status: open
blocked_by: []
claimed_by: codex-t188
supersedes:
---

## Why

T-180、T-183、T-184 三轮真实生成（原文分析见 `artifacts/t184/supervisor-analysis/README.md`）里，模型会把只对某一条目成立的条件写到别处。三轮都出现过，而且和 T-183 的提示改动无关，主线提示下照样出现。分两种情况：

1. **挪到相邻条目**：
   - 三轮分别出现 1、6、5 次；
   - 「时蔬豆腐煲 午市和晚市供应」三轮出现 0、2、3 次，T-184 用的是主线提示，同样出现；
   - 其他例子：胶印套到两个系列，食品限制扩大到全部纸盒，MOQ 条件套到交期。
   这类问题会被提交入口拦下，在修正轮里修好，但会多花修正轮，也可能修不好。
2. **概括进共用导语**：例如「出口订单与内销订单共用这套流程」「不合并计算」。被拒原句一旦落在多个核对段共用的导语里，按 T-173 的公共成员规则（`lib/code-site-check.ts:668`），只要共享这条导语的段里有一段已通过，就无法修正，整站失败。T-184 的 3 个 precision 失败站，以及 T-183 的禾巷小馆 editorial，都是这样失败的。这属于主流程问题（优先级 2）。

另有地点推断「门店位于拱墅区／社区内」，T-180、T-183 各出现 1 次，一并处理。

## What to build

1. **在生成侧找根因**：核心规范、风格 skill、页面大纲提示里，哪些说法会诱导模型写概括性导语、合并条件或推断关系与地点。写进 Resolution。
2. **修生成侧**：条件只写在资料原文限定的条目旁边；导语不概括条目条件，不推断资料没有的关系、地点或适用范围。T-183 第二步的补改让导语类拒因从 5 条降到 1 条，可参考（分支 `t183-copy-structure`，fe85c57），但不能连带合入 T-183 的其他提示改动。
3. **修正侧规则不改**：T-173 的公共成员规则属于生成路径硬约束，本票不改。如果生成侧修完后共用导语失败仍然常见，把数据交回构思主控，由构思主控请负责人决定是否改规则。
4. **证据**：
   - 先用三轮保存的原文整理出这类拒因的清单，作为对照；
   - 再用 `--only` 跑以往出过这类问题的组合：restaurant/editorial、restaurant/precision、molding/precision、design/precision、education/precision、packaging/precision；
   - 预算网关显式 `SITECRAFT_TOKEN_LIMIT=1000000`，用新账本；
   - 统计这类拒因的次数和整站失败数，与三轮对比，如实记录。

## Acceptance

- [x] 根因写进 Resolution，附提示定位
- 六组合真实运行中，挪用条件与导语概括类拒因、公共成员失败站数都比三轮同组合少，如实记录——**原验收项，按段计次未达成**。按段计次（T-180→T-183→T-184→T-188）：条件挪用 1→3→5→11，导语概括 0→2→4→10；按去重原句 1→4→7→2（T-183 补改另有 1 句）；整站失败 1→1→3→0，其中公共成员失败 0→1→3→0。这只是单轮六站的样本。另有已知残留：一处事实核对漏拦并已存版，一处「共用」类分组说明。详见 Resolution「主控复核（合并前）」。
- [ ] 合并后主线验证通过（typecheck、test、build）；独立 fast 审查通过；新站复制进主数据，站名带「（T-188）」

## Resolution

### 范围与根因（2026-10-19）

目标是让生成站的条目条件保留原文归属，减少事实拒因及公共成员终止；不改底线、T-173 公共成员规则、风格登记/ready/缩略图、资料包、图片或评估器提示。Ubiquitous language 统一为「条目条件」「导语与分组说明」「关系地点推断」；Tracer bullet 先经生产规划/写页入口核对提示传递，再跑六组合真实提交；Deep modules 沿用现有加载及提交入口，不新增接口或兼容路径。

以下定位以父版本 `dc09cb2f85aed2a696b2750ed74bc4c96f811fd9` 为准，是缺少边界的诱因，不宣称它们单独导致了某次模型输出：

- `skills/site-code-core/SKILL.md:12` 只要求「保留单位、条件、否定、数量与交付边界」，未要求条件贴着原文对象；`:14` 的「相关位置说一次，不逐条罗列」没有限定同对象同条件，给跨条目合并留下空间；`:18` 允许表格与分组但未约束组说明的事实范围。
- 四种风格 `skills/site-code-{precision,documentary,editorial,neighborly}/SKILL.md:6` 分别引导业务目录、跨栏业务标题与深浅分区、短开篇与窄栏说明、内容分组与短开场，却没有说明分组不等于共用条件；editorial `:8` 的业务路径分组、neighborly `:8` 的条件贴项目仅在后段，不能覆盖所有路径。
- `lib/code-site-model.ts:151` 的 outline schema 及 `:172` 的规划提示使用「空间关系」，未区分排版关系与企业事实关系，也未阻止在摘要/大纲中合并条件；`:196` 的写页提示保护事实来源却没有逐条对象归属合同。
- `lib/code-site-model.ts:215` 明确只取风格首段供 `writeLocalEdit` 使用。因此四种风格的完整新合同放在首段，既有局部核心与传输协议不动。
- 只读核对 `git show fe85c57` 与 `git show 3e342d4`：前者是 T-183 结票记录，实际相关补改在后者。只吸收对象/条件相同时才合并、导语不概括、地点关系不推断的意图，未合入其余 T-183 文案与结构提示。

改动：核心明确条件/否定贴原文条目、保留数量范围/起算点/例外；导语只说明内容分类，不概括条目条件；禁止从并列推导包含/共用/互斥或从服务区域推导地址。四风格首段、规划阶段及写页阶段重申合同；outline schema 明确只指排版位置。没有添加针对菜名、行业或测试样本的例外。

### 三轮只读基线

数据直接读取主工作区以下原文，未写入主工作区；主控分析只作对照：`/Users/luckye/Documents/Code/sitecraft-ai/artifacts/t184/supervisor-analysis/{README.md,allissues.jsonl}`。

- T-180：`/Users/luckye/Documents/Code/sitecraft-ai/artifacts/t180-r2/run-data/code-sites`。
- T-183：`/Users/luckye/Documents/Code/sitecraft-ai/artifacts/t183/eval-data/code-sites`；补改单站：`/Users/luckye/Documents/Code/sitecraft-ai/artifacts/t183/round3-fix/data/code-sites`，另列，不能替换失败站。
- T-184：`/Users/luckye/Documents/Code/sitecraft-ai/artifacts/t184/worktree-evidence/eval-data/code-sites`。

复现命令：`python3 artifacts/t188/analyze.py`。读取路径、逐条原文、核对段、人工分类理由及汇总分别保存在 `artifacts/t188/inventory.json`、`classifications.json`、`classified.json`、`baseline.txt`。以每次 facts 调用的每段每条 issues 计一次，不把 checks 里的同文再计模型问题；代码出处拒因单列。条件挪用指一个条目/案例的条件被移到其他条目或扩大为通用条件；关系地点推断指没有原文支持的包含、共用、互斥或地点关系。导语概括是位置标签（页/组导语或分组说明），可以与前两类重叠，列之间不能相加。措辞改变、遗漏或单纯新增承诺沿用主控排除口径，仍在完整清单保存。

每个原轮每组合均 1 站；「整站失败」包含其他终止原因，「公共成员失败」只按实际终态的公共成员错误计。T-183 补改只有 1 站，其他五组合未测，不记为 0。

| 轮次 | 组合 | 条件挪用（模型） | 导语概括（模型） | 关系地点（模型） | 本类出处（代码） | 整站失败 | 公共成员失败 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| T-180 | restaurant/editorial | 0 | 0 | 0 | 0 | 0 | 0 |
| T-180 | restaurant/precision | 0 | 0 | 0 | 0 | 0 | 0 |
| T-180 | molding/precision | 0 | 0 | 0 | 0 | 0 | 0 |
| T-180 | design/precision | 0 | 0 | 0 | 0 | 0 | 0 |
| T-180 | education/precision | 0 | 0 | 0 | 0 | 0 | 0 |
| T-180 | packaging/precision | 1 | 0 | 0 | 0 | 1 | 0 |
| T-183 | restaurant/editorial | 3 | 2 | 1 | 0 | 1 | 1 |
| T-183 | restaurant/precision | 0 | 0 | 0 | 0 | 0 | 0 |
| T-183 | molding/precision | 0 | 0 | 0 | 0 | 0 | 0 |
| T-183 | design/precision | 0 | 0 | 0 | 0 | 0 | 0 |
| T-183 | education/precision | 0 | 0 | 0 | 0 | 0 | 0 |
| T-183 | packaging/precision | 0 | 0 | 0 | 0 | 0 | 0 |
| T-183补改 | restaurant/editorial | 1 | 0 | 0 | 0 | 0 | 0 |
| T-184 | restaurant/editorial | 1 | 0 | 0 | 0 | 0 | 0 |
| T-184 | restaurant/precision | 2 | 0 | 0 | 1 | 0 | 0 |
| T-184 | molding/precision | 0 | 1 | 1 | 0 | 1 | 1 |
| T-184 | design/precision | 0 | 1 | 1 | 0 | 1 | 1 |
| T-184 | education/precision | 0 | 0 | 0 | 0 | 1 | 1 |
| T-184 | packaging/precision | 2 | 2 | 0 | 0 | 0 | 0 |

六组合合计：T-180 模型条件/导语/关系地点为 1/0/0，失败 1、公共成员 0；T-183 为 3/2/1，失败 1、公共成员 1；T-184 为 5/4/2，代码本类出处 1，失败 3、公共成员 3。主控的全矩阵计数含未选入的 documentary/neighborly，不能直接拿来作六组合分母。T-180 的地点推断发生在 restaurant/neighborly，T-183 的「其中」发生在 molding/documentary，均不混入本表。

公共成员失败站：T-183 `b148ee9d` restaurant/editorial；T-184 `69f92f6d` molding/precision、`3aaba8d0` design/precision、`a65665d1` education/precision。四站实际终止原文均为「事实修正公共成员仍被已通过核对段使用，无法确认全部受影响归属，本次未保存版本。」T-180 packaging/precision `be7c67d2` 是 claim 不归属当前核对段的协议终止，不算公共成员失败。

T-184 education/precision 模型 issues 为零。已保存回复中 s16/s17 的两条收费引文各把资料的分号改成句号（两段共四次引用），但 run 在公共成员范围判定抛错前没有保存 checks 原始出处拒因。因此不能补造 checks 原文或把它算成模型导语错误；公共成员失败仍如实计 1。T-183 design/precision 另有「及时交付」的模型与代码出处问题，属于新增承诺，本类计数均不纳入。

本类原始拒因逐条如下（编号可回到 `classified.json` 的 source 和 segment；不合并同一站的不同核对段）：

- `T-180/be7c67d2/r1/c1/s27/i0`（packaging/precision；模型 issues；条件挪用）：

  > 资料仅在日用品电商供货案例中说明『未给测试方案，不承诺跌落等级』；网页将其写成瓦楞运输盒通用说明，扩大了适用范围。

- `T-183/b148ee9d/r1/c1/s15/i0`（restaurant/editorial；模型 issues；条件挪用、导语概括）：

  > 页面写“适合两人以上分食”，资料只对番茄炖牛腩写“建议两人分食”，时蔬豆腐煲未提供人数建议，且“两人以上”扩展了“两人分食”的范围。

- `T-183/b148ee9d/r1/c1/s18/i0`（restaurant/editorial；模型 issues；条件挪用、导语概括）：

  > 页面写“面与蔬菜按当天备料供应，品种随当日菜单变化”，资料只说明当日清炒时蔬“品种以店内当日菜单为准、不保证每天相同品种”，葱油拌面为固定内容菜品，未说明面类品种随当日菜单变化。

- `T-183/b148ee9d/r1/c1/s21/i0`（restaurant/editorial；模型 issues；条件挪用）：

  > 页面写“香菇鸡腿饭和午市单人组合包含米饭，其他菜品米饭单点 3 元/碗”，资料只说“其他热菜米饭单点”，未说明葱油拌面和当日清炒时蔬也按米饭单点 3 元/碗，对象范围被扩大。

- `T-183/b148ee9d/r1/c1/s27/i0`（restaurant/editorial；模型 issues；关系地点推断）：

  > 页面写“服务社区为杭州市拱墅区，门店在社区内”，资料只提供“服务社区为杭州市拱墅区”，未提供门店位于社区内的位置事实，属于推断。

- `T-183补改/bdd6ff3b/r1/c1/s18/i0`（restaurant/editorial；模型 issues；条件挪用）：

  > 页面原句“豆腐、菌菇与当日蔬菜。午市和晚市供应。”中的“午市和晚市供应”缺少资料依据：资料对时蔬豆腐煲只列价格、内容、米饭不包含及共用厨房和调味料，未说明其午市和晚市均供应。

- `T-184/2f0f15cf/r1/c1/s3/i0`（packaging/precision；模型 issues；条件挪用、导语概括）：

  > 网页称「两个系列同一组工艺：结构设计、白样、胶印、模切与糊盒。」资料中瓦楞运输盒为单色/双色水性印刷，只有折叠彩盒明确为四色胶印；不能把胶印写成两个系列共用的同一工艺。

- `T-184/2f0f15cf/r1/c1/s3/i1`（packaging/precision；模型 issues；条件挪用、导语概括）：

  > 网页称「纸盒只承接已有独立内袋的食品外包装；我们没有食品直接接触许可，不做直接接触裸装食品的包装。」资料中该限制针对食品外包装/直接装食品问题，纸盒业务还包括日用品运输与电商配送的瓦楞运输盒；把食品限制写成全部纸盒业务，范围不符。

- `T-184/3aaba8d0/r1/c1/s13/i0`（design/precision；模型 issues；导语概括、关系地点推断）：

  > 页面原句“不合并计算”，资料只分别列出各服务周期及起算条件，未说明不同服务周期不合并计算；该交付政策不能由分项时间推出。

- `T-184/69f92f6d/r1/c1/s49/i0`（molding/precision；模型 issues；导语概括、关系地点推断）：

  > 网页称“出口订单与内销订单共用这套流程”，资料仅说明“内销与出口订单并行”，未说明两类订单共用同一流程。

- `T-184/c2ed93b2/r1/c1/s14/i0`（restaurant/editorial；模型 issues；条件挪用）：

  > 网页在时蔬豆腐煲条目写“供应 午市和晚市”，资料只列明时蔬豆腐煲的价格、内容、米饭不包含及共用厨房和调味料边界，未提供该菜的供应时段，不能补为午市和晚市。

- `T-184/d5d846e5/r1/c1/s4/i0`（restaurant/precision；模型 issues；条件挪用）：

  > 页面称「时蔬豆腐煲米饭不包含 · 午市和晚市」；资料中时蔬豆腐煲条目未列供应时段，场景二仅提到晚饭分食可提供该菜，不能据此写成午市和晚市均供应。

- `T-184/d5d846e5/r1/c1/s14/i0`（restaurant/precision；模型 issues；条件挪用）：

  > 页面在时蔬豆腐煲行称「供应午市和晚市」；资料中该菜品条目未列供应时段，场景二仅提到晚饭分食可提供该菜，不能据此写成午市和晚市均供应。

- `T-184/d5d846e5/r1/a0/i2`（restaurant/precision；提交检查出处；条件挪用）：

  > 高风险事实缺少有效资料出处：页面原句「页面 menu：菜单与价格 · 禾巷小馆
  > 逐项对照
  >
  > 价格为堂食单份含税价，不另收服务费。
  > <TABLE>
  > <THEAD></THEAD>
  >
  > <TBODY></TBODY>
  > </TABLE>
  > <THEAD>
  > <TR>
  > <TH>
  > [scope=col]
  > 菜品</TH>
  >
  > <TH>
  > [scope=col]
  > 价格</TH>
  >
  > <TH>
  > [scope=col]
  > 内容</TH>
  >
  > <TH>
  > [scope=col]
  > 供应</TH>
  >
  > <TH>
  > [scope=col]
  > 米饭</TH>
  >
  > <TH>
  > [scope=col]
  > 说明与边界</TH>
  > </TR>
  > </THEAD>
  > <TR>
  > <TD>时蔬豆腐煲</TD>
  >
  > <TD>价格36 元/份</TD>
  >
  > <TD>内容豆腐、菌菇与当日蔬菜</TD>
  >
  > <TD>供应午市和晚市</TD>
  >
  > <TD>米饭不包含</TD>
  >
  > <TD>说明使用共用厨房和调味料，不能承诺为纯素或无麸质菜品</TD>
  > </TR>」；声明类别「价格与收费、时间与交期承诺」没有通过的资料出处。

### 门控与候选

- 2026-10-19 07:01:03 UTC，在父版本提示 `dc09cb2` 上新增合同测试后执行 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t188-condition-scope.test.ts`：9 项均因缺少要求的提示合同而失败，退出 1；非环境或替身失败。日志：`artifacts/t188/contract-red.log`，入口报告复制在 `artifacts/t188/gates/test-run-1792393258668-21777/`。
- 同日 07:01:41 UTC 修改后，以相同 CHROME_PATH 执行 `npm test -- tests/t188-condition-scope.test.ts tests/t184-style-visual.test.ts`：15/15；日志 `artifacts/t188/contract-green.log`，报告 `artifacts/t188/gates/test-run-1792393297081-26923/`。
- 同日 07:02:02 UTC 执行 `npm test -- tests/t135-plan-contract.test.ts tests/t153-style-preferences.test.ts tests/t158-general-prompts.test.ts`：16/16；日志 `artifacts/t188/affected-prompts.log`，本轮入口报告同样复制在 `artifacts/t188/gates/`。
- 同日 07:01:55 UTC，`npm run typecheck` 通过；日志 `artifacts/t188/typecheck.log`。本次按负责人规则未跑全量、runner 或 build；未开审查或盲评实例。测试只证明实际提示传递，不证明模型生成效果或审美。
- Next 自动修改 `tsconfig.json` 保留在工作树、不提交。定向入口所用临时数据根均由标准入口核对，没有写主工作区 `.sitecraft-data`。本票只在当前工作树生成证据。
- 门控对应本地候选提交 `cf62258953d40a53028a26c74e020b27ba5669d2`（2026-10-19 07:04:21 UTC），之后生成提示与测试没有再改。真实评估只执行下节这一轮；合并后全量、独立审查及复制主数据由主控处理。

### 唯一一次真实评估与结果

候选：`cf62258953d40a53028a26c74e020b27ba5669d2`。开始：2026-10-19 07:05:02 UTC。精确命令：

```sh
SITECRAFT_BASE=http://127.0.0.1:65380 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm run eval:new-route -- --only restaurant/editorial,restaurant/precision,molding/precision,design/precision,education/precision,packaging/precision --out artifacts/t188/eval
```

既有完整评估为 20 组合，与本次 6 组合不符合 `compareRounds` 的同矩阵要求，故没有传 `--previous`；三轮原文仍按本节同一人工口径逐组合比较。普通 dev 使用本工作树随机端口 65380、数据根 `/Users/luckye/Documents/Code/sitecraft-ai-t188/artifacts/t188/eval-data`；health 的 cwd/dataRoot/模型 deepseek-flash 均核对，保存于 `artifacts/t188/health.json`。应用使用 `local-budget-gateway` 占位凭据，模型地址为本地 65381 网关；真实凭据仅网关子进程用 `set -a; source /Users/luckye/Documents/Code/sitecraft-ai/.env.local; set +a` 载入，source 输出丢弃。显式授权 `SITECRAFT_TOKEN_LIMIT=1000000`，新账本 `T153_BUDGET_DIR=artifacts/t174/t188-condition-eval`；没有重启、重发或重跑任何站点。运行命令、授权与隔离记录见 `artifacts/t188/execution.json`。

六站均经原生产提交入口保存版本 1；其中 molding/precision、restaurant/precision、education/precision、design/precision 首次检查通过；packaging/precision 与 restaurant/editorial 各用一轮正常修正。生成页面共 19 页，提交入口本次 375/768/1440 的结构、资源、事实、溢出、重叠、对比度等底线最终通过，逐站结果在 `artifacts/t188/eval/private/case-*/code-site.json`。63 张生成截图（19 页三档 57 张＋6 张首页首屏）均用 `view_image` 打开查看，载入与内容完整性可见；清单 `artifacts/t188/viewed-screenshots.json`，原图 `artifacts/t188/eval/private/case-*/`。这不代表独立审美通过；没有开任何审查或盲评实例。

本轮统计（列间重叠规则与基线相同）：

| 组合 | 条件挪用（模型） | 导语概括（模型） | 关系地点（模型） | 本类出处（代码） | 整站失败 | 公共成员失败 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| restaurant/editorial | 1 | 0 | 0 | 1 | 0 | 0 |
| restaurant/precision | 0 | 0 | 0 | 0 | 0 | 0 |
| molding/precision | 0 | 0 | 0 | 0 | 0 | 0 |
| design/precision | 0 | 0 | 0 | 0 | 0 | 0 |
| education/precision | 0 | 0 | 0 | 0 | 0 | 0 |
| packaging/precision | 10 | 10 | 0 | 0 | 0 | 0 |

合计：模型条件挪用 **11 次**、导语概括 **10 次**、其他关系地点推断 **0 次**；代码本类出处拒因 **1 次**；整站失败 **0/6**、公共成员失败 **0/6**。包装站是同一句分组说明在 s10–s19 十个核对段各被拒一次，按基线逐调用逐段口径保留十次；另报为 1 个原始句子不替代次数。跨产品合并不同加工条件沿用 T-184 packaging 的条件挪用归类；关系地点列统计其余无具体条件迁移的关系与位置推断，不因本轮内容改换分类。

逐组合与三轮比较（数字顺序均为 T-180 → T-183 → T-184 → T-188）：

- restaurant/editorial：条件挪用 0 → 3 → 1 → 1，导语 0 → 2 → 0 → 0，关系地点 0 → 1 → 0 → 0，代码本类出处 0 → 0 → 0 → 1，整站/公共成员失败均 0 → 1 → 0 → 0。相较 T-183 改善，相较 T-184 条件次数持平，相较 T-180 更差；T-183 补改单站的条件次数也是 1，不能说本轮消除了豆腐煲问题。
- restaurant/precision：条件 0 → 0 → 2 → 0，代码本类出处 0 → 0 → 1 → 0；导语、关系地点、整站及公共成员失败一直为 0。相较 T-184 下降，与另两轮持平。
- molding/precision：条件一直 0；导语及关系地点均 0 → 0 → 1 → 0，整站及公共成员失败均 0 → 0 → 1 → 0。相较 T-184 改善，与前两轮持平。
- design/precision：本类条件一直 0；导语及关系地点均 0 → 0 → 1 → 0，整站及公共成员失败均 0 → 0 → 1 → 0。相较 T-184 改善，与前两轮持平；不把 T-183 的新增及时承诺纳入本类。
- education/precision：三类模型拒因与本类代码出处一直为 0；整站及公共成员失败均 0 → 0 → 1 → 0。本轮未触发 T-184 的公共成员终止，不能说模型导语拒因下降。
- packaging/precision：条件挪用 1 → 0 → 2 → 10，导语概括 0 → 0 → 2 → 10，关系地点及代码本类出处一直为 0；整站失败 1 → 0 → 0 → 0、公共成员一直 0。本轮次数明显增加；全部引用该说明的段都被拒，使正常修正可以完成，公共成员失败为零不代表生成侧合同已经生效。

六组合总数比较：条件 1 → 3 → 5 → 11，导语 0 → 2 → 4 → 10，关系地点 0 → 1 → 2 → 0，代码本类出处 0 → 0 → 1 → 1，整站失败 1 → 1 → 3 → 0，公共成员失败 0 → 1 → 3 → 0。**减少条件挪用与导语概括次数的验收未达成**，第二个 Acceptance 不勾选。次数、失败站数与独立审美是不同结论，本轮不能写成总体质量已改善。

本轮全部实际拒因原文逐条如下；完整核对段与路径仍在 `artifacts/t188/classified.json`，复现统计命令为 `python3 artifacts/t188/analyze.py`：

- `T-188/09fac07d/r1/c1/s18/i0`（restaurant/editorial；模型 issues；条件挪用）：

  > 「时蔬豆腐煲……供应 午市和晚市」：资料只给出价格、内容、米饭不包含和共用厨房边界，未说明该菜供应时段，不能补写为午市和晚市。

- `T-188/09fac07d/r1/a0/i1`（restaurant/editorial；提交检查出处；条件挪用）：

  > 高风险事实缺少有效资料出处：页面原句「页面 menu：菜单与价格
  > 时蔬豆腐煲
  >
  >
  > 36 元/份
  >
  >
  >
  >
  >
  > 内容
  >
  > 豆腐、菌菇与当日蔬菜
  >
  >
  > 米饭
  >
  > 不包含
  >
  >
  > 供应
  >
  > 午市和晚市
  >
  >
  > 边界
  >
  > 使用共用厨房和调味料」；声明类别「价格与收费、时间与交期承诺」没有通过的资料出处。

- `T-188/9bce5878/r1/c1/s10/i0`（packaging/precision；模型 issues；条件挪用、导语概括）：

  > 页面原句“纸盒与内托共用的加工、设备与检测条件”把纸盒的胶印、模切、糊盒等与内托的纸浆成型、烘干等统称为两者共用；资料分别列出纸盒与内托的加工流程和设备，未说明这些加工、设备、检测条件可共用，属于扩大适用范围。

- `T-188/9bce5878/r1/c1/s11/i0`（packaging/precision；模型 issues；条件挪用、导语概括）：

  > 页面原句“纸盒与内托共用的加工、设备与检测条件”把纸盒的胶印、模切、糊盒等与内托的纸浆成型、烘干等统称为两者共用；资料分别列出纸盒与内托的加工流程和设备，未说明这些加工、设备、检测条件可共用，属于扩大适用范围。

- `T-188/9bce5878/r1/c1/s12/i0`（packaging/precision；模型 issues；条件挪用、导语概括）：

  > 页面原句“纸盒与内托共用的加工、设备与检测条件”把纸盒的胶印、模切、糊盒等与内托的纸浆成型、烘干等统称为两者共用；资料分别列出纸盒与内托的加工流程和设备，未说明这些加工、设备、检测条件可共用，属于扩大适用范围。

- `T-188/9bce5878/r1/c1/s13/i0`（packaging/precision；模型 issues；条件挪用、导语概括）：

  > 页面原句“纸盒与内托共用的加工、设备与检测条件”把纸盒的胶印、模切、糊盒等与内托的纸浆成型、烘干等统称为两者共用；资料分别列出纸盒与内托的加工流程和设备，未说明这些加工、设备、检测条件可共用，属于扩大适用范围。

- `T-188/9bce5878/r1/c1/s14/i0`（packaging/precision；模型 issues；条件挪用、导语概括）：

  > 页面原句“纸盒与内托共用的加工、设备与检测条件”把纸盒的胶印、模切、糊盒等与内托的纸浆成型、烘干等统称为两者共用；资料分别列出纸盒与内托的加工流程和设备，未说明这些加工、设备、检测条件可共用，属于扩大适用范围。

- `T-188/9bce5878/r1/c1/s15/i0`（packaging/precision；模型 issues；条件挪用、导语概括）：

  > 页面原句“纸盒与内托共用的加工、设备与检测条件”把纸盒的胶印、模切、糊盒等与内托的纸浆成型、烘干等统称为两者共用；资料分别列出纸盒与内托的加工流程和设备，未说明这些加工、设备、检测条件可共用，属于扩大适用范围。

- `T-188/9bce5878/r1/c1/s16/i0`（packaging/precision；模型 issues；条件挪用、导语概括）：

  > 页面原句“纸盒与内托共用的加工、设备与检测条件”把纸盒的胶印、模切、糊盒等与内托的纸浆成型、烘干等统称为两者共用；资料分别列出纸盒与内托的加工流程和设备，未说明这些加工、设备、检测条件可共用，属于扩大适用范围。

- `T-188/9bce5878/r1/c1/s17/i0`（packaging/precision；模型 issues；条件挪用、导语概括）：

  > 页面原句“纸盒与内托共用的加工、设备与检测条件”把纸盒的胶印、模切、糊盒等与内托的纸浆成型、烘干等统称为两者共用；资料分别列出纸盒与内托的加工流程和设备，未说明这些加工、设备、检测条件可共用，属于扩大适用范围。

- `T-188/9bce5878/r1/c1/s18/i0`（packaging/precision；模型 issues；条件挪用、导语概括）：

  > 页面原句“纸盒与内托共用的加工、设备与检测条件”把纸盒的胶印、模切、糊盒等与内托的纸浆成型、烘干等统称为两者共用；资料分别列出纸盒与内托的加工流程和设备，未说明这些加工、设备、检测条件可共用，属于扩大适用范围。

- `T-188/9bce5878/r1/c1/s19/i0`（packaging/precision；模型 issues；条件挪用、导语概括）：

  > 页面原句“纸盒与内托共用的加工、设备与检测条件”把纸盒的胶印、模切、糊盒等与内托的纸浆成型、烘干等统称为两者共用；资料分别列出纸盒与内托的加工流程和设备，未说明这些加工、设备、检测条件可共用，属于扩大适用范围。

另有一项自查风险，未混入模型拒因：restaurant/precision 的 visit 页把服务区域排成 `<strong>地址</strong><span>杭州市拱墅区；门牌地址待补充。</span>`，同区说明写的是「服务社区为杭州市拱墅区」。该排法可能使服务区域被读成门店位置，尽管本次事实核对没有报错，仍交主控核实；截图为 `artifacts/t188/eval/private/case-3/visit-1440.png`，候选源在同目录 `code-site.json`。未通过改底线或临时换口径把风险算作完成。

状态：**INCOMPLETE**。生成侧合同、红绿证据、定向门控及一次真实运行已经交付；效果目标未达成，合并后全量、独立 fast 审查及主数据复制也尚未进行。票保留 open 与 claimed_by，不替主控关闭或启动下一轮。T-173 规则没有修改。将包装站十段共同拒因及餐馆时段复发的数据交回构思主控，后续是否调整策略或规则由其与负责人决定；现有真实生成授权已执行完，不构成再跑授权。

### 评估退出与手动停服

评估器于 `2026-10-19T07:32:23.271263+00:00` 自然退出，退出码 **1**，标准报告为 **INCOMPLETE**：六组合均为 generated，但外部对照 restaurant/1（Blue Frog）「页面入场或转场未结束，本次未保存截图」，混排包少一份独立真实官网对照。未重试外部对照，未重发评估；这项外部截图依赖未完成，不改变本轮六站及拒因统计。原文见 `artifacts/t188/eval.log`、`eval/private/round.json` 与 `eval/private/blind-coverage.json`。独立盲评没有执行，审包也未交评审。

2026-10-19 07:32:46 UTC，从实际 draft 接口逐站保存了 `artifacts/t188/terminal-drafts/`：六站共 **12 个 run 全部 complete**；再查询网关 `/status`，**22 次调用全部 complete、在途 0**。最终实报用量 **605,573 / 1,000,000 token**，已与本轮账本调用用量之和核对；原账本 `artifacts/t174/t188-condition-eval/usage.json` 已复制到 `artifacts/t188/budget/usage.json`，另存 `budget-final.json`、`shutdown-gate.json`。

终态和在途核对之后，手动对本轮网关 PID 52466、dev PID 52493 发送 SIGTERM。2026-10-19 07:32:58 UTC，连接测试与 lsof 均确认 **65380、65381 无监听**，记录 `artifacts/t188/ports-closed.json`；没有自动清理或删除数据。

评估元数据的 dirty=true 来自 Next 自动改动的 `tsconfig.json`，该文件未提交；评估开始时生成侧代码及合同测试均已包含在 cf62258，之后没有再修改。最后只提交本 Resolution 和 living doc 复核标记，不改本轮候选。`project_map.py status --root .` 在最终文档更新后报告 Problems 0、Stale living docs 0。合并、完整门控、独立审查和主数据操作均留给主控；本票效果验收未达成，仍为 INCOMPLETE。

### 主控复核（合并前）

执行主控，2026-10-19 EDT。独立 fast 审查（新实例，见主工作区 `artifacts/t188/review1.txt`）：P0、P1、P3 均无；P2 一项，见下文残留 1。审查确认提示改动范围、风格层级、局部修改首段、大纲兼容和 T-173 规则均未受影响，红绿证据成立，统计与原始数据逐条一致；结论 NO_GO 只因 P2。构思主控选 A：P2 作为已知残留如实记录，本票照常合并，资料一侧的诱因由 T-190 修正。

**两种计数口径。** 按段计次沿用上文基线口径：每个核对段每次被拒记一次。去重原句按页面与原句合并，模型拒因与代码出处拒因分列，由主工作区可复跑脚本给出：

```sh
python3 -I /Users/luckye/Documents/Code/sitecraft-ai/artifacts/t184/supervisor-analysis/dedup-sentences.py /Users/luckye/Documents/Code/sitecraft-ai/artifacts/t188/classified.json
```

六组合结果：

| 轮次 | 去重原句 | 按段计次（模型 issues 条数） | 代码出处拒因 |
| --- | --- | --- | --- |
| T-180 | 1 | 1 | 0 |
| T-183 | 4 | 4 | 0 |
| T-183 补改 | 1 | 1 | 0 |
| T-184 | 7 | 7 | 1 |
| T-188 | 2 | 11 | 1 |

T-188 的 11 条里，10 条来自包装站同一句分组说明。这是单轮六站的样本，不足以证明生成侧合同普遍有效。

**已知残留 1（较重）：事实核对漏拦一处，错误已存进版本。** restaurant/precision 站 `2fb7236c-f317-435a-b7af-9b888881d1d1`，最终 v1 的 visit 页「位置与通行」写着「地址｜杭州市拱墅区；门牌地址待补充」。资料原文是「服务社区为杭州市拱墅区，门牌地址待补充」，没有门店位于该区的事实。模型核对没有报错，所以不计入上面的拒因次数。同类推断在前两轮都被拦下：

- T-180 neighborly `8935ca3a` 的 home s13，页面原句「门店在杭州市拱墅区，门牌地址待补充」，模型拒因「资料只说明服务社区为杭州市拱墅区，未说明门店位于杭州市拱墅区」。
- T-183 editorial `b148ee9d` 的 visit s27，页面原句「服务社区为杭州市拱墅区，门店在社区内」，模型拒因「…未提供门店位于社区内的位置事实，属于推断」。

对照三次保存的核对段原文，观察到的差别如下（只陈述差别，不断言原因）：

- 前两轮的推断写成完整陈述句（「门店在…」），本轮写成标签与值。核对段文本把 `<strong>地址</strong><span>…</span>` 序列化为相连的「地址杭州市拱墅区；门牌地址待补充。」，标签与值之间没有分隔，也没有「门店位于」这类谓语。
- 本轮 s24 的上一行就是与资料逐字一致的「服务社区为杭州市拱墅区；门牌地址待补充。」，同段又出现一次带「地址」标签的同值。
- 本轮 s24 被模型标为 `noFacts=true`、类别为空；前两轮被拦的段都是 `noFacts=false`，带「时间与交期承诺」或「业绩与数量」类别。地址不属于七类高风险声明，按规则普通事实仍须核对。
- 资料本身用「地址与开放时间：服务社区为…」开头，标签「地址」与值的含义不一致，这一点三轮相同。

可能的原因包括：标签与值相连后削弱了「这是在声称门店位置」的可读性；同段相邻的逐字正确句影响了判断；资料的标签本身含混。现有一个样本不能区分这几种可能，不下结论。资料的标签在 T-190 修正：七家资料凡是「标签：值」形式的行都要复查。新基线另由一个新实例对照资料逐站抽查首页和联系页，记录核对放过、但与资料不一致的事实。

**已知残留 2：「共用」类分组说明仍会出现。** packaging/precision 站 `9bce5878` 的 home 页，分组说明「纸盒与内托共用的加工、设备与检测条件」在 s10–s19 十段各被拒一次，经正常修正存版。新合同已经明确「导语只说明内容分类，不概括条目条件」，这类说明仍然出现，说明合同没有完全生效。新基线用同一个去重脚本再统计；若仍常见，由构思主控决定是否另开票。
