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
- [ ] 六组合真实运行中，挪用条件与导语概括类拒因、公共成员失败站数都比三轮同组合少，如实记录
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

- 2026-10-19 06:40 UTC，在父版本提示 `dc09cb2` 上新增合同测试后执行 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t188-condition-scope.test.ts`：9 项均因缺少要求的提示合同而失败，退出 1；非环境或替身失败。日志：`artifacts/t188/contract-red.log`，入口报告复制在 `artifacts/t188/gates/test-run-1792393258668-21777/`。
- 同日修改后，以相同 CHROME_PATH 执行 `npm test -- tests/t188-condition-scope.test.ts tests/t184-style-visual.test.ts`：15/15；日志 `artifacts/t188/contract-green.log`，报告 `artifacts/t188/gates/test-run-1792393297081-26923/`。
- 同日执行 `npm test -- tests/t135-plan-contract.test.ts tests/t153-style-preferences.test.ts tests/t158-general-prompts.test.ts`：16/16；日志 `artifacts/t188/affected-prompts.log`，本轮入口报告同样复制在 `artifacts/t188/gates/`。
- `npm run typecheck` 通过；日志 `artifacts/t188/typecheck.log`。本次按负责人规则未跑全量、runner 或 build；未开审查或盲评实例。测试只证明实际提示传递，不证明模型生成效果或审美。
- Next 自动修改 `tsconfig.json` 保留在工作树、不提交。定向入口所用临时数据根均由标准入口核对，没有写主工作区 `.sitecraft-data`。本票只在当前工作树生成证据。
- 真实评估待门控后的本地提交完成后执行，六组合各一次，失败站不重跑。统计与候选 SHA 在下一节补齐。合并后全量、独立审查及复制主数据由主控处理，本票暂不关闭。
