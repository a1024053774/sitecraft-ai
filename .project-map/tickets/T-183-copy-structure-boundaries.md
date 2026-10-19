---
id: T-183
title: 生成文案去说明书化：固定字段组与边界复读
type: build
status: closed
blocked_by: []
claimed_by: codex-t183-fix
supersedes:
---

## Why

T-180 质量基线（2026-10-18，`artifacts/t180-r2/`）mixed 盲评中，生成页 13/13、5/5 都被认出是生成站，门槛是不超过 50%。前 5 个缺口里有两条是写作层的问题：

- **缺口 1（14 站）**：条目都套用「需要／可以点／边界」「需求／提供／边界」这类固定字段组，服务、菜单、课程都写成了规则文档。
- **缺口 4（8 站）**：「不包含／不保证／不承接」这类边界陈述在首屏副句、条目和侧栏里反复出现，成了版面主角。

现行核心规范 `skills/site-code-core/SKILL.md` 有几处可能在推这两种写法：

- 第 6 行写「让人尽快看懂……服务边界」；
- 第 12 行写「保留……交付边界」；
- 第 14 行虽然写了「说一次」，但没有约束字段组的形状。

本票先查清根因，再在提示层修。

## What to build

1. **先找根因**：读 T-180 两轮的盲评理由原文和代表站源码，确认这两类写法分别来自哪里：核心规范或风格 skill 的哪句话、页面大纲字段，还是资料本身的结构。把对应关系写进 Resolution。不按猜测改。
2. **在根因所在层改**（核心规范、风格 skill 或大纲提示），要求做到：
   - 条目的组织方式跟着资料内容走，不给每个条目套同一组字段标签；
   - 对访客有用的限制，按资料在相关位置说一次，不放大成首屏副句、侧栏或每个条目的固定一栏。
3. **不能放松的地方**：
   - 不能放松事实、出处、「待补充」和底线检查；
   - 资料里的否定与条件仍须保留在相关位置，不能为了好看删掉事实。
   - 不能为单个样本加例外，不能按行业写死映射。
4. **成对证据**：
   - 跑 `npm run eval:new-route` 默认 full 矩阵，`--previous` 指向 T-180 重跑的第 1 轮 `artifacts/t180-r2/round1-full`；
   - 再用 `--only` 跑 T-180 第 2 轮的六组合；
   - 预算网关显式 `SITECRAFT_TOKEN_LIMIT=3000000`，用新账本；
   - 评估在包含 T-185 修复的主线上跑，失败站同样如实保留。
5. **盲评**：mixed、company、comparison 三个包分别交给 3 个不同的新 fast 实例，各实例不读其他包。

## Acceptance

- [x] Resolution 写清两类写法的根因对应关系（理由原文与源码定位）
- [x] 改动后两轮评估的命令、提交、用量和成败站数写进 Resolution
- 跨轮比较盲评中，缺口 1、4 的同类问题站数下降，且没有新增事实或出处失败；mixed 盲评结果如实记录——**原验收项，未达成**。同口径缺口 1：10/18 → 17/17；缺口 4：9/18 → 12/17；「字段」一词：6 → 2 站。缺口转 T-184 评估，之后由构思主控决定是否另开票。
- typecheck、test、build 通过；独立 fast 审查通过；新站复制进主数据，站名带「（T-183）」——**原验收项，未交付**。typecheck、test、build 已通过（第二阶段 `d7ad632`、第三阶段 `20c2842`）；因为不合并，最终改动没有做独立 fast 审查。新站已复制进主数据，站名带「（T-183）」，见 Resolution 末尾。

## Resolution

结论与阶段状态：**NO_GO，不合并，关票**。提示改动保留在分支 t183-copy-structure 作记录，不进主线；固定口径脚本 scripts/eval-gap-keywords.py 单独落到主线，供 T-184 使用。

构思主控选择 B。理由：第二步合并条件不满足，补跑 education/documentary 也改变不了结论；缺口计数变差，mixed 识别率没变，comparison 9/15 只略好，又新增了事实风险。缺口转 T-184 评估，之后由构思主控决定是否另开票。主线侧关票、脚本提取、数据处理和推送由主控执行，本次仅修改票据并本地提交。

第一阶段提交 `3127df2`，负责人确认独立阶段审查 GO；随后 rebase 到含 T-185 的主线 `e002c6c`，候选为 `d7ad6322dc738ea36eebaaeafdf28bdca5b49a4c`，提示内容未变。第二阶段已完成 runner 回归、两轮全量、typecheck、build 与两轮真实评估；评估有失败站及包缺项。第三阶段由 `codex-t183-fix` 补明条目条件的限定对象，第一步提示合同红绿已完成；第二步在负责人指定的 `20c2842` 上完成四项门控，餐饮站存版前又出现一次范围扩大类事实拒因，即使正常修正后存版，仍不满足合并条件，已停止并保留 education/documentary 未测。主控已收回六个旧提示盲评包的结果，本次未重做整轮盲评或启动审查；主数据复制见 Resolution 末尾。

**独立盲评与同口径缺口计数。** 原始结果及解盲输出只读于主工作区 `/Users/luckye/Documents/Code/sitecraft-ai/artifacts/t183/blind-results/`，汇总为该目录 `unblind-summary.txt`。以下计数只取 mixed 中生成页的理由，每站计一次；分母是实际有结果的生成页，不把缺失站记为通过。

| 固定口径 | T-180 | T-183（旧提示） |
| --- | --- | --- |
| 缺口 1 | 10/18 | 17/17 |
| 缺口 4 | 9/18 | 12/17 |
| 理由含「字段」一词 | 6/18 | 2/17 |

缺口 1、4 均未下降；仅「字段」一词从 6 站降到 2 站，不能据此判定缺口改善。T-183 两轮 mixed 分别 12/12、5/5 被识别为生成，识别率仍为 100%；官网对照误判均为 0（0/13、0/5）。company 判同模板为 0/30、0/4；comparison 9/15 选 T-183，其中 education/precision、design/editorial 两对选基线，理由是基线各条目字段一致、便于核对。这些均为旧提示的结果，本次补改不重做整轮盲评。

**固定口径脚本。** `scripts/eval-gap-keywords.py` 是以后各轮缺口 1、4 计数的固定口径。源为上述目录的 `gap14.py`，G1、G4 正则及计数、输出函数逐字保留，仅将硬编码路径改为可重复的 `<轮次标签> <private 目录> <mixed result.json>` 三元组；同标签按首次出现顺序汇总。只用 Python 标准库，原脚本和主工作区结果保持只读。2026-10-19 09:14:30 JST 用迁移后的脚本复算，exit 0，完整输出与原脚本相同，保存于本工作树 `artifacts/t183/gap-keywords.txt`；对应本节所在提交（父提交 `3e342d4b34a614a6b8171bdb310265ca9e2242e1`，最终 SHA 随交付汇报）。精确复现命令：

```sh
python3 scripts/eval-gap-keywords.py \
  T-180 /Users/luckye/Documents/Code/sitecraft-ai/artifacts/t180-r2/round1-full/private /Users/luckye/Documents/Code/sitecraft-ai/artifacts/t180-r2/round1-full/blind-results/mixed-result.json \
  T-180 /Users/luckye/Documents/Code/sitecraft-ai/artifacts/t180-r2/round2-selected/private /Users/luckye/Documents/Code/sitecraft-ai/artifacts/t180-r2/round2-selected/blind-results/mixed-result.json \
  T-183 artifacts/t183/round1-full/private /Users/luckye/Documents/Code/sitecraft-ai/artifacts/t183/blind-results/r1-mixed-result.json \
  T-183 artifacts/t183/round2-selected/private /Users/luckye/Documents/Code/sitecraft-ai/artifacts/t183/blind-results/r2-mixed-result.json \
  > artifacts/t183/gap-keywords.txt
```

根因调查（基线 `a6e06d7`）：observed 是盲评、资料、大纲及 HTML 可直接核对的关系；inferred 是提示如何放大它们，未以模型消融证明因果。主控资料只以绝对路径只读核对，不复制 mapping 或身份资料到审查包。

| 问题与盲评原句 | 资料 → 大纲 → 源码定位（observed） | 提示层对应与判断（inferred） |
| --- | --- | --- |
| 固定字段组，round1 mixed `1930931cfbcd`：「下方把用餐情境分为重复的“需要、可以点、边界”三栏」。company `14c4ad9c3136` 也指出「以两种用餐情形的需求、可点、边界三栏说明为中心」。 | `round1-full/private/case-10/materials.txt` 第 22–23 行原本就是两个场景的「需求／提供／边界」。同目录 `code-site.json` 的 `plan.pages[home].outline` 只要求两个场景与菜单入口，没有规定三栏；`versions[0].code.pages[home].html` 的两处 `article.scene > dl.facts` 实际生成相同的三个 `dt`。generate 的 repairRound=0，固定字段在初写时已存在。 | 来源字段被当成页面栏目；核心第 12 行无条件「规格用 table 或 dl」未区分规格与场景，`application-paths` 图少/无图句列「场景名称、约束与业务链接」。documentary 仅要求字图尺度，无三字段合同，不能归因于该风格写死模板。 |
| 固定字段组，round2 mixed `64fd97e71651`：「两张浅色圆角卡片都严格使用“需求、提供、边界”三段结构」。company `12fef7824f90` 同样指出「卡片内部重复“需求／提供／边界”字段」。 | `round2-selected/private/case-4/materials.txt` 第 21–22 行给出同构学习场景；`plan.pages[home].outline` 第 2 句已规定「各自带出需求、对应课程与不承诺的部分」；首页 `.scenes .scene > dl.scene-facts` 两次照搬三标签。generate 的 repairRound=0。 | 大纲先把来源字段固化成条目结构，写页继续执行。`planSchema.pages[].outline` 原 description 只约束短句与空间关系，未要求按内容组织或确定限制归属；neighborly 要求名称、价格、条件、时间贴近项目，但未要求三段结构。修在共享核心与大纲，不按教育行业设例外。 |
| 固定字段组及边界复读，round2 mixed `7bd7e238546a`：「三个服务条目都先列工作内容，再列不包含的事项，右侧说明又强调范围和计费边界」。company `e72231e096b4` 指出服务「各自纵列名称、说明及范围，右侧同时放带竖线的项目与收费说明」。 | `round2-selected/private/case-5/materials.txt` 第 5–12 行在首屏说明、简介、三项服务及收费中分别包含条件。`plan.pages[home].outline` 第 1、2、5 句把首屏排除印刷、各条「一项限制」和窄栏边界都排入；`.hero .lead`、`.svc-list li .limit`（三处）、同节 `aside.note` 分别落实。generate 的 repairRound=0。 | 核心第 6 行把「服务边界」列为全站设计目标，第 12 行要求保留交付边界，第 14 行虽说一次但未约束位置与字段形状。`capability-led` 强调限制并以「交易边界」收尾；editorial 要窄栏说明且入口指向「适用限制」，提供重复边界的空间引导。事实有来源，问题是层级与重复；不能删条件来修。 |
| 去掉标签仍同构，round2 mixed `40c22585bbe8`：「两种用餐场景均按需求、价格、限制、链接展开，且多处突出“不保证”“不包含”“不经营”等边界」。company `50a774d0ce47` 确认餐馆双栏情境、工作室服务侧注的组织差异，均未判为同模板。 | `round2-selected/private/case-1/materials.txt` 第 22–23 行仍为场景三字段；`plan.pages[home].outline` 要两个场景入口，第 3 句另写「不经营酒吧或宴会厅」。`.paths-grid a.path` 两处依次为 `.path-need`、`.offer`、`.small`、`.more`，`.about`、`.compare`、`.closing` 又展开相关限制。generate 的 repairRound=0。 | 不是删除“边界”标签就能解决：需在规划和写页阶段同时禁止每条固定字段组与重复放大。部分限制不同且对点菜有用，保留在相关项目；不把所有否定统称重复而删除。 |

以上路径相对主控证据根 `/Users/luckye/Documents/Code/sitecraft-ai/artifacts/t180-r2/`；盲评原文分别在各轮 `blind-results/mixed-result.json`、`company-result.json`，仅用各轮 `private/mapping.json` 核对上述身份，没有复制映射文件。另核对两轮其余生成样本理由：工业参数、课程规格的规整排法与同模板判定并不等价，不能禁止真实规格比较表；mixed 被识别为生成与 company 判为不同骨架也可同时成立。

REALITY GATE：PASS（仅提示改动方向）。目标是从资料内容组织条目并让限制就近出现；非目标是删除否定、改样式体系、改校验或用离线替身判断美观。已观察到资料标签直出、规划先固化、写页无标签仍同构三条链。未知：各条提示的独立贡献及新页面质量，留待 T-185 后真实评估与独立盲评。Deep modules：复用现有 rules/planSchema，不增加包装、平行 API 或页面后处理。

离线验收合同（改提示前记录）：通过实际 `planSiteCode` / `writeSiteCode` 请求检查核心、风格和骨架规则；以同一事实的字段资料／自然段资料成对输入，覆盖四风格及 auto。可失败的情况为：固定字段禁令没到请求、限制被提升为首屏/侧栏/固定列、大纲字段或骨架重新引导固定栏目、原资料中的否定/条件/待补充被改写、事实原句与既有入口限制丢失。替身只接收请求并返回合法响应，不判断或模拟文案改善；新测试先在未改提示的基线上跑红，再原命令跑绿。

本阶段改动：核心规范移除“服务边界”作为全站开场目标，区分实际规格与内容条目，要求按资料内容组织、不照搬标签，明确否定与条件也是事实，合并重复但不删不同限制。大纲系统提示与 `outline` 字段说明同时注明限制所属内容；骨架卡说明内容关系不是固定栏目，收窄 `application-paths` 与 `capability-led` 的限制强调；editorial 入口指向业务细节，限制就近保留。其余三风格没有强制字段组原句，未改。事实核对、出处协议、待补充、提交入口与底线检查代码均未改；没有样本例外、行业映射或新依赖。四份 living docs 同步当前提示合同。

本次验证于 2026-10-19 06:13–06:15 JST 执行，对应本 Resolution 所在的单功能提交（父提交 `a6e06d746c634f20c119bedbfb9048d47c2593fa`；最终 SHA 随本阶段交付汇报）。证据位于本工作树 `artifacts/`，没有写主目录数据。

| 命令 | 结果与证据 |
| --- | --- |
| `npm test -- tests/t183-copy-contract.test.ts`（改提示前） | 预期 RED，退出 1，4/4 在合同断言失败：条目规则、大纲字段、骨架栏目、editorial 入口。`artifacts/t183/contract-red.log`，`artifacts/t167/test-run-1792357993870-8041/report.json`，实际请求 `artifacts/t183/prompt-contract-2f12a556-84a8-48a9-b247-e3fb1fd8f986/requests.json`。失败数据根按入口规则保留，未覆盖红态。 |
| `npm test -- tests/t183-copy-contract.test.ts`（改提示后） | GREEN，退出 0，4/4。`artifacts/t183/contract-green.log`，`artifacts/t167/test-run-1792358031807-13055/report.json`。随后将“仅规格可比较”的表述收窄为“实际信息按比较需要共用表头”，避免误禁正常比较；最终候选由下一行覆盖。 |
| `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t183-copy-contract.test.ts tests/t135-plan-contract.test.ts tests/t135-skeletons.test.ts tests/t158-general-prompts.test.ts` | PASS，退出 0，19/19，无跳过。`artifacts/t183/related-tests.log`，`artifacts/t167/test-run-1792358059509-18066/report.json`；最终请求 `artifacts/t183/prompt-contract-3b80bda6-6eef-4e59-a422-b63ab3800a31/requests.json`。T-135 仍经生产确认/提交/刷新入口，T-158 保留事实/来源请求合同；模型全部为本地替身。 |
| `npm run typecheck` | PASS，退出 0，`artifacts/t183/typecheck.log`。标准测试启动 Next 自动追加的 `.next-test/dev/dev/types` 配置已精确撤回，再运行 typecheck；没有把无关配置变更带入提交。 |
| `git diff --check`；`python3 /Users/luckye/Documents/SKILLS/project-map-skill/project-map/scripts/project_map.py status --root .` | PASS；Problems 0、Stale living docs 0，T-183 仍由 codex-t183-fast 认领且保持 open。 |

第一阶段证据边界：以上只证明提示通过实际请求传递、原始资料保留及既有离线合同未破坏，不证明模型会遵循、更不证明审美改善。该阶段真实模型调用 0、付费用量 0；未启动网关、真实评估、全量、build 或审查/盲评实例，未复制新站到主数据。

### 第二阶段：固定候选验证与真实评估

执行者 `codex-t183-fast`；以下时间全部为 **2026-10-18 EDT（UTC−04:00）**，对应本机 2026-10-19。所有检查和两轮评估的 HEAD 均为 `d7ad6322dc738ea36eebaaeafdf28bdca5b49a4c`；两份 `private/round.json` 均记录 `dirty=false`。本阶段没有修改生产代码、提示、测试、预算或断言，只更新本票与本工作树 gitignore 的产物。Tracer bullet 验收沿用资料→大纲→写页→检查→存版的真实入口；Deep modules 沿用既有提交入口；Ubiquitous language 沿用“页面大纲、核对段、资料出处”。

先完成以下门控，全部 PASS 后才启动真实模型：

| 顺序与原命令 | 起止时间（EDT） | 结果与本次证据 |
| --- | --- | --- |
| `node --test --experimental-strip-types scripts/t167-runner-regressions.ts` | 18:05:39–18:06:03 | PASS，18/18，无跳过；`artifacts/t183/stage2-runner-regressions.log`。起止取该日志创建/最后写入时间。 |
| `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test`（第一轮） | 18:06:09–18:18:03 | PASS，857/857，非浏览器 114、浏览器 743，并发 2，无跳过；`artifacts/t183/stage2-full1.log`，`artifacts/t167/test-run-1792361170100-25015/report.json`。 |
| 同上（第二轮） | 18:18:10–18:34:03 | PASS，857/857，分池与并发不变，无跳过；`artifacts/t183/stage2-full2.log`，`artifacts/t167/test-run-1792361891522-18315/report.json`。 |
| `npm run typecheck` | 18:34:11–18:34:18 | PASS，exit 0；`artifacts/t183/stage2-typecheck.log`。此前精确撤回 Next 自动追加的 `.next-test/dev/dev/types`、`.next/dev/dev/types` 两项 include，没有带入配置改动。 |
| `npm run build` | 18:34:21–18:34:36 | PASS，exit 0；`artifacts/t183/stage2-build.log`。 |

两轮全量均自然结束，没有中途终止或重跑；启动前分别运行 `memory_pressure`，空闲 62%、52%；build 前 47%，两次评估前 45%、44%。未停止其他工作树的服务。标准入口为每轮创建、核对并保留独立数据根，不使用主目录 `.sitecraft-data`。

**模型与存储隔离。** 应用 origin `http://127.0.0.1:53024`，预算网关 `http://127.0.0.1:53025`，数据根为本工作树 `artifacts/t183/eval-data/`；health 已核对 cwd、dataRoot、development-file 与 deepseek-flash，见 `artifacts/t183/stage2-health.json`、`stage2-config.json`。应用以清空继承环境的普通 Next dev 启动，只持 `DEEPSEEK_API_KEY=local-budget-gateway` 占位凭据，模型地址仅指向本地网关；工作树没有 `.env.local`。真实密钥只在网关进程通过 `set -a; source /Users/luckye/Documents/Code/sitecraft-ai/.env.local; set +a` 载入，source 输出丢弃，随后只运行 `node --experimental-strip-types scripts/t153-real-budget.ts`，显式设置 `DEEPSEEK_BASE_URL=https://api.deepseek.com`、`DEEPSEEK_MODEL=deepseek-flash`、`SITECRAFT_BASE`、`SITECRAFT_BUDGET_BASE`、`SITECRAFT_TOKEN_LIMIT=3000000`、`T153_BUDGET_DIR=artifacts/t174/t183-copy-eval`。凭据没有进入应用、日志或提交；没有修改网关或评估器。

唯一新账本 **`artifacts/t174/t183-copy-eval/usage.json`** 从 0 连续记到 **1,986,808 / 3,000,000 token**，剩余 **1,013,192**，未重置、另开或重跑失败站。`default`／`high` 仅为两轮账本标签，估算分别为 2,000,000／900,000，没有改变风格或默认 5/6 滑杆。73 次调用全部 HTTP 200、正常结束，用量未知 0，上游中断 0、HTTP 错误 0；输入 791,316、输出 1,195,492 token。应用记录与账本逐轮用量、调用总数一致，见 `artifacts/t183/stage2-completion-summary.json`。

真实评估原命令（两轮的 `--previous` 均为主工作树绝对路径，评估器接受；未修改路径处理）：

```sh
SITECRAFT_BASE=http://127.0.0.1:53024 SITECRAFT_TOKEN_LIMIT=3000000 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm run eval:new-route -- --previous /Users/luckye/Documents/Code/sitecraft-ai/artifacts/t180-r2/round1-full --out artifacts/t183/round1-full
SITECRAFT_BASE=http://127.0.0.1:53024 SITECRAFT_TOKEN_LIMIT=3000000 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm run eval:new-route -- --only education/editorial,design/editorial,restaurant/editorial,restaurant/neighborly,education/neighborly,design/neighborly --previous /Users/luckye/Documents/Code/sitecraft-ai/artifacts/t180-r2/round2-selected --out artifacts/t183/round2-selected
```

| 轮次 | 起止时间（EDT） | 用量（输入／输出） | 调用 | generated／error／rejected／blocked | 运行状态 |
| --- | --- | --- | --- | --- | --- |
| 默认 full 14 组合 | 18:35:13–19:31:30 | 1,451,866（601,260／850,606） | 53 | 12／2／0／0 | INCOMPLETE，exit 1 |
| 指定六组合 | 19:31:55–19:55:05 | 534,942（190,056／344,886） | 20 | 5／1／0／0 | INCOMPLETE，exit 1 |

逐站结果；`—` 表示没有保存版本，不补造版本 ID。原始站点、调用、回复、拒因、尝试和截图分别保留在各轮 `private/case-N/`，实际站点数据保留在上述独立数据根。

| 轮次／组合 | outcome | 站点 ID | 版本 ID | token |
| --- | --- | --- | --- | --- |
| 1 industrial/precision | error | `576d4ba7-04cf-49d7-abcd-d861288a494d` | — | 88,427 |
| 1 industrial/documentary | generated | `4b880d0f-874b-44c7-823f-a2a88bef9936` | `b47d90fa-5240-4242-941f-c40290f34493` | 86,827 |
| 1 export/precision | generated | `3cafa927-3a77-4262-a6b8-b2e11fdf333d` | `270e4945-ab75-4584-9df7-66e58457f34b` | 84,564 |
| 1 export/documentary | generated | `a57b9ee1-94b0-46b6-a808-60e5994eb134` | `e26682a1-7184-45bf-81ae-cfcb189198af` | 90,928 |
| 1 molding/precision | generated | `54367685-3fa7-4028-ac0e-de105d13babf` | `67b0318a-7c3d-4d5d-8bbf-0c825d9d80b5` | 115,040 |
| 1 molding/documentary | generated | `78195b85-d335-434a-b420-23f645f147fd` | `3d31aaee-b436-45a5-8cd6-2d44227898d9` | 140,444 |
| 1 packaging/precision | generated | `3d65b5e6-81c4-43bd-98ea-dcd9345a19e3` | `5faf1ed1-ecc8-4216-99bf-dfd065cda199` | 136,571 |
| 1 packaging/documentary | generated | `1e6119fb-19e5-4466-9bda-ed5107b47ea9` | `7689ab75-d11d-49d0-980e-d385563899af` | 107,447 |
| 1 restaurant/precision | generated | `e90035b7-3c7d-4d03-8d65-c5cc57477853` | `009f6d03-358a-4609-9862-c99fb5277d43` | 79,437 |
| 1 restaurant/documentary | generated | `ee1cbb4d-21ea-415d-93eb-f6023eaa4f5f` | `5719d6cf-c909-47ee-9850-dc9f824123c3` | 127,846 |
| 1 education/precision | generated | `b8d4dc89-adc3-4ab7-b0d2-309e2d762c2d` | `11270428-2069-433c-afd3-aa25c5372ff7` | 95,966 |
| 1 education/documentary | error | `fc62f923-29b0-4397-b6e3-c85284b72a2f` | — | 102,822 |
| 1 design/precision | generated | `5456977c-a736-4f0a-8eb6-05164ed51b7e` | `18dd1c1c-c0a0-4a0b-978c-3be5d78cf308` | 97,181 |
| 1 design/documentary | generated | `db7e4ed0-d3f6-4357-a57a-e6009f878142` | `30e85845-003b-43a0-bc4c-5ec9601ce072` | 98,366 |
| 2 restaurant/editorial | error | `b148ee9d-f144-4749-92f7-14ea26e0b15c` | — | 93,586 |
| 2 restaurant/neighborly | generated | `36e80ec0-5283-4507-b812-0babf4d83ae6` | `6cd37530-37d8-417a-8091-b5d7a3566985` | 84,016 |
| 2 education/editorial | generated | `f51dfb4c-b2a3-44a3-bea8-a859c9942cd4` | `31fe3107-b50f-4ef4-a232-acd5c75d19a1` | 80,398 |
| 2 education/neighborly | generated | `7301f3bf-9583-4529-87ba-76405adb7beb` | `0910d58e-8b97-4274-b9ec-b1e82f5864d9` | 104,850 |
| 2 design/editorial | generated | `f9f3c79d-372b-402f-91e6-a9422acf6236` | `896bc2dc-f1a7-49c1-8c51-264e12fb53fc` | 94,630 |
| 2 design/neighborly | generated | `aa90f316-ae5e-4827-94df-ec2d6b9c5a8e` | `55d42789-84ae-45df-8fcc-1e49915d3eeb` | 77,462 |

**事实、出处与失败边界。** 下列计数区分终态失败、修正中曾被拒与未测，不能相加当成失败站总数；模型事实问题数按保存的核对回复 `results[].issues` 逐条统计，出处拒因按提交尝试记录统计。

| 轮次 | 进入事实核对 | 模型事实拒因 | 缺有效出处拒因 | 事实／出处相关终态失败 |
| --- | --- | --- | --- | --- |
| 1 | 13/14 站 | 4 站、4 条，均修正后成功 | 2 站、2 条，与前列重叠，均修正后成功 | 1 站：education/documentary 出处声明归属协议错误（2 项） |
| 2 | 6/6 站 | 2 站、6 条；education/neighborly 1 条修正成功，restaurant/editorial 5 条未能进入安全修正 | 已记录尝试中 0 条 | 1 站：restaurant/editorial 事实修正公共成员范围拒收 |

首轮 industrial/precision 首次及修正后均有首页三档对比度不足（1.85，要求 4.5），第二次局部修正回复无效而报 error，没有进入事实核对，不能记为事实通过。education/documentary 的“含练习用纸”“画笔、颜料与调色盒自备”两项 claim 不在当前核对段，协议立即拒收。第二轮 restaurant/editorial 的事实问题包括配菜被改成配餐、分食人数与对象范围扩大、把蔬菜品种条件扩大到面类、米饭单点对象扩大及推断门店位置；公共成员仍被已通过核对段使用，提交入口拒绝扩大修正，未存版本。17 个成功版本均有本次 `checks.passed=true` 与完整资料出处检查；这不证明审美改善，也不把上述失败抵销成“没有新增事实或出处失败”。

**审包路径与完整性。** 以下路径均相对本工作树；只读取 `private/blind-coverage.json` 和文件存在性，未读 `review/`、`comparison-review/` 内容。两轮 Bluefrog 对照分别因 `net::ERR_CONNECTION_CLOSED`、页面入场或转场未结束而未保存，不补抓、不修网络。第一轮复用上一轮可用的 13 份官网对照，第二轮复用 5 份；缺失对照如实计入分母。

| 轮次 | review/mixed | review/company | comparison-review |
| --- | --- | --- | --- |
| 1 | `artifacts/t183/round1-full/review/mixed/`：12 生成＋13 官网＝25/28，缺 3 份 | `artifacts/t183/round1-full/review/company/`：30/42 对；缺 industrial/precision、education/documentary 相关 12 对 | `artifacts/t183/round1-full/comparison-review/`：11/14 对；industrial/precision、education/documentary 本轮失败，packaging/precision 上轮失败 |
| 2 | `artifacts/t183/round2-selected/review/mixed/`：5 生成＋5 官网＝10/12，缺 2 份 | `artifacts/t183/round2-selected/review/company/`：4/6 对；缺 restaurant/editorial 相关 2 对 | `artifacts/t183/round2-selected/comparison-review/`：4/6 对；restaurant/editorial 本轮失败，restaurant/neighborly 上轮失败 |

两轮六个包均为 **INCOMPLETE**，未以评估器退出或目录存在冒充齐备。首轮 139 张、第二轮 55 张，共 194 张已保存截图逐张解码载入 19 份缩略总览并打开，均非空，仅检查载入，不作审美判断；索引与清单为 `artifacts/t183/nonempty-sheets/inventory.json`、`stage2-viewed-screenshots.json`。原始截图没有裁改或覆盖；未生成的失败站截图不补造。

**终态与关闭。** 首轮退出后核对 14 站 run 均终态、网关在途 0，见 `artifacts/t183/stage2-round1-terminal.json`，再用原网关与账本进入第二轮。第二轮评估器 19:55:05 退出；19:55:12 经实际 draft 接口核对全部 20 站的所有 run 均终态、73 次网关调用完成且在途 0，见 `stage2-pre-stop-terminal.json`。随后手动 SIGINT 停网关 pid 14033（exit 130）与 dev pid 13736（exit 0），19:55:34 确认两端口均关闭，见 `stage2-shutdown.json`；账本 `stopped=false` 保留原义，未伪造预算错误。没有重启网关、重发失败站、读审包内容、派审查实例、写主目录数据或推送。后续独立盲评、质量裁决与主数据复制交回主控，本实例交付后停在 idle。

### 第三阶段：限定对象补改（第一步）

执行者 `codex-t183-fix`。负责人批准在 T-183 内窄改，目标是合并重复限制时保留限定对象与条件，单个条目的条件保留原对象与数量范围，分组导语只说明内容分类、不概括条目条件，也不推断资料未明确的地点或关系。仅修改核心规范既有段落，同步主线文档对应说明；大纲已加载该核心规范，无须另改提示。未改事实核对、校验、上限或提交入口，未加白名单、样本例外或行业映射。Tracer bullet 仅验证规划与写页的实际模型请求；Deep modules 沿用现有入口；Ubiquitous language 沿用条目、分组导语与限定对象。真实模型遵循情况仍未知。

本步时间为 **2026-10-19 JST（UTC+09:00）**，对应本节所在提交（父提交 `2714e60519c25ce9f11084860f1c6e20fe95cf6b`，最终 SHA 随交付汇报）。单文件只使用自建本地模型替身，不启动 Chrome 或应用服务，不调用站点存储，因此按负责人授权直接运行 Node，不绕过存储身份校验。

| 时间（JST）与命令 | 结果与证据 |
| --- | --- |
| 09:12:10–09:12:12；`node --test --experimental-strip-types tests/t183-copy-contract.test.ts > artifacts/t183/fix-contract-red.log 2>&1` | 预期 RED，exit 1，8 项中原有 4 项通过、新增 4 项分别在对应合同断言失败，无跳过；此时核心提示与 `2714e60` 相同。日志 `artifacts/t183/fix-contract-red.log`；实际请求 `artifacts/t183/prompt-contract-dc9f3013-c5fb-4284-b50c-9f2b5e4fff7e/requests.json`。 |
| 09:12:29–09:12:30；`node --test --experimental-strip-types tests/t183-copy-contract.test.ts > artifacts/t183/fix-contract-green.log 2>&1` | GREEN，exit 0，8/8，无跳过；四项新合同均覆盖四风格及 auto、两种资料形状与规划/写页两个实际请求。日志 `artifacts/t183/fix-contract-green.log`；实际请求 `artifacts/t183/prompt-contract-112db665-3438-4e69-8884-a2a251c88ddd/requests.json`。 |

本步状态：PASS（仅提示合同）；整票仍为 INCOMPLETE。红绿证明提示传递，不证明模型遵循或页面质量改善。T-182 正在做全量验收，按负责人要求未运行 runner 回归、npm test、typecheck 或 build，未启动 dev、Chrome、预算网关、真实生成、审查或盲评，未写主工作区数据，真实模型调用与付费用量均为 0。已收回的六个盲评包是旧提示的结果，本次补改不重做整轮盲评。第二步门控及 restaurant/editorial、education/documentary 各一次重跑均未开始，等待负责人通知；既有账本未读取、重置或另开。执行主控的下节归因原文完整保留。

第二步合并条件（负责人补充决定）：restaurant/editorial 与 education/documentary 都须存下版本，且两站均无新的范围扩大类事实拒因，包括限定对象被扩大、换了对象、推断资料里没有的地点或关系。任一站不满足即停止并报告负责人，不重跑；即使两站满足，缺口目标仍为未达成。runner 回归、npm test 全量一轮、typecheck、build 全部通过才开始真实重跑；继续使用原账本 `T153_BUDGET_DIR=artifacts/t174/t183-copy-eval` 及显式 `SITECRAFT_TOKEN_LIMIT=3000000`，不重置或另开。逐站记录 outcome、站点 ID、版本 ID、用量和事实拒因原文，education/documentary 单独说明 claim 越段是否出现。所有 run 终态且网关在途为 0 后才手动停网关和 dev。执行结果如下。

### 第三阶段：第二步门控与真实重跑（NO_GO）

执行者 `codex-t183-fix`；时间为 **2026-10-19 JST（UTC+09:00）**。负责人通知 T-182 已在主线合并，并指定本轮继续在 `20c28424f97397b5609734c462c8416e44636cde` 执行，不 rebase；本节所在提交仅登记结果，父提交为该 SHA。这是当轮分支验证，不能当作含 T-182 的主线验证。全部产物在本工作树 `artifacts/t183/round3-fix/`，标准测试报告仍在入口分配的 `artifacts/t167/`。Tracer bullet 经资料、规划、确认、写页、事实修正、提交、预览存下真实版本；Deep modules 沿用同一生产入口；Ubiquitous language 沿用条目、限定对象与核对段。

| 顺序与命令 | 起止时间（JST） | 结果与本次证据 |
| --- | --- | --- |
| `node --test --experimental-strip-types scripts/t167-runner-regressions.ts` | 09:35:37–09:36:03 | 18/18，exit 0，无跳过；`round3-fix/runner-regressions.log`（本表路径前缀为 `artifacts/t183/`）。 |
| `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test` | 09:36:17–09:47:37 | 861/861，exit 0；非浏览器 114、浏览器 747，并发 2，无跳过；`round3-fix/full-test.log`、`artifacts/t167/test-run-1792370178203-92756/report.json`。 |
| `npm run typecheck` | 09:47:46–09:47:54（退出观察时间） | exit 0；`round3-fix/typecheck.log`。先只撤回 Next 自动追加的 `.next-test/dev/dev/types`、`.next/dev/dev/types` 两项 include，恢复 `20c2842` 的配置。 |
| `npm run build` | 09:47:56–09:48:05 | exit 0；`round3-fix/build.log`。 |

以上串行、各一次、自然结束。标准测试身份已核对 cwd 与独立数据根（health 503 因测试进程不配真实模型，非身份失败）；没有使用主工作区数据。四项门控全部通过后才启动真实网关与 dev。应用地址 `http://127.0.0.1:53024`，网关 `http://127.0.0.1:53025`，独立数据根为本工作树 `artifacts/t183/round3-fix/data/`，见 `health.json`、`start-state.json`。应用清空继承环境，仅持 `local-budget-gateway` 占位凭据；真实密钥只在网关进程通过原主工作区 `.env.local` 载入，输出丢弃。网关命令仍为 `node --experimental-strip-types scripts/t153-real-budget.ts --resume`，显式设置原账本、模型、上游地址及 3,000,000 上限；没有重置或另开账本。剩余未用标签 `low` 仅登记本次 500,000 token 估算，不改变默认 5/6 滑杆，见 `budget-round.json`。

本次定向诊断使用的 `round3-fix/replay-case.ts` **偏离了标准评估入口**。原因是现有 `eval:new-route` 的子集仍按每家公司抓两份官网，混排要求却按组合数计，两站子集会让审包数量对不上；评估器在一站 error 后会自动继续下一站，做不到失败即停。执行者为逐站停止而使用 gitignore 内的重放脚本，未修改评估器。

- 与标准入口一致：同一套生产 chat 的资料、select、confirm、draft 入口；同一套候选证据与截图函数 `saveCandidateEvidence`、`captureEvalPage`，并复用 `requireWholeSitePlan`；同样的资料、三页请求、风格与 5/6 滑杆。资料逐字沿用第二阶段保存的 `materials.txt`，没有直接调用模型或写站点存储。
- 与标准入口不一致：不抓官网对照，不出审包，不走 `eval:new-route` 的汇总与 `round.json`。本次只保存单站候选、运行记录、局部汇总及截图，不能冒充标准评估整轮通过，也未重做整轮盲评或启动评审。

实际只执行以下餐饮站命令一次：

```sh
SITECRAFT_BASE=http://127.0.0.1:53024 SITECRAFT_BUDGET_BASE=http://127.0.0.1:53025 SITECRAFT_TOKEN_LIMIT=3000000 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --experimental-strip-types artifacts/t183/round3-fix/replay-case.ts artifacts/t183/round2-selected/private/case-1 artifacts/t183/round3-fix/restaurant-editorial > artifacts/t183/round3-fix/restaurant-editorial.log 2>&1
```

| 组合 | outcome | 站点 ID | 版本 ID | token | 判定 |
| --- | --- | --- | --- | --- | --- |
| restaurant/editorial | generated，09:49:47–09:56:22 | `bdd6ff3b-bbac-40bb-9e4b-00eda6b86416` | `054d28bc-e5f3-4771-8a5d-1f4aa72a2fc3`（v1） | 135,487（输入 40,808／输出 94,679） | NO_GO：存版前出现新的范围扩大类事实拒因，正常修正成功不抵销该拒因。 |
| education/documentary | not-run | — | — | 0 | 依停止条件未启动；本轮 claim 不在本核对段是否再现为**未测**，不能写成未出现。 |

第二步补改后，分组导语类拒因从第二轮的 5 条降到本次 1 条；剩下这 1 条是条目之间横向挪用条件，给未注明供应时段的时蔬豆腐煲补上其他菜品的两市供应条件，仍新增事实风险。餐饮站首轮事实核对共 31 段，s18 唯一拒因原文为：

> 页面原句“豆腐、菌菇与当日蔬菜。午市和晚市供应。”中的“午市和晚市供应”缺少资料依据：资料对时蔬豆腐煲只列价格、内容、米饭不包含及共用厨房和调味料，未说明其午市和晚市均供应。

原资料只给香菇鸡腿饭、番茄炖牛腩、当日清炒时蔬明确注明两市供应，时蔬豆腐煲未注明；给后者补上同一供应条件扩大了其限定对象，属于本次禁止的范围扩大类事实拒因。后台按既有额度自动做一次局部事实修正，再核 4 段无拒因，最终通过同一提交入口存版；执行者没有重发、重跑或改写候选。5 次新模型调用全部 HTTP 200、正常结束，用量未知 0；两次事实回复、输入映射、两次提交尝试均保留在 `restaurant-editorial/code-site.json`，拒因摘录在 `restaurant-editorial/fact-issues.json`。没有 claim 越段或出处协议错误，但这只覆盖已运行的餐饮站。

最终版本三页 × 375/768/1440 的溢出、重叠、对比度问题均为 0，`checks.passed=true`；三页三档 9 张原始 Chrome 截图逐张打开，均为已载入、非空、含完整页脚的页面，见同目录 `home-*`、`menu-*`、`visit-*`。这只确认技术与载入证据，不宣布审美通过。

09:56:46 经实际 draft 接口确认 plan、generate 两个 run 都为 complete，账本 78 次调用均 complete、在途 0，见 `pre-stop-terminal.json`。随后手动 SIGINT 停网关（exit 130）与 dev（exit 0），09:57:10 确认两端口均关闭，见 `shutdown.json`。原账本从 1,986,808 连续增加到 **2,122,295 / 3,000,000 token**，剩余 **877,705**，`stopped=false` 仍表示未触发预算终止，不冒充进程存活。汇总为 `completion-summary.json`。education/documentary 没有创建站点、调用模型或补跑；没有新增审查实例、盲评包或主数据复制，没有推送。

本轮合并条件 **NO_GO**，保留失败证据后停止。构思主控据此选择 B，关票且不合并提示改动，分支保留作记录。缺口 1、4 的同口径数字与六个旧提示盲评包结论不变；未达成与未交付的原验收项在 Acceptance 中保留，缺口转 T-184 评估，之后由构思主控决定是否另开票。

### 失败站原文归因（执行主控，只读）

2026-10-18 EDT，执行主控只读各站 `private/case-N/code-site.json` 与 `report.json` 中已保存的回复原文、factInput 映射、提交尝试和 `repairFailure`，并对照 `artifacts/t180-r2` 同组合的保存记录；没有调用模型，也没有改代码。T-185 修过的两类是：claim 不在本核对段、issues 返回 object。

| 站 | 拒因类别与原文 | 是否 T-185 两类 | 与 T-183 改动的关系 |
| --- | --- | --- | --- |
| 第 1 轮 education/documentary（`round1-full/private/case-12`） | 事实协议：`核对段协议无效：资料出处声明不在本核对段：含练习用纸；资料出处声明不在本核对段：画笔、颜料与调色盒自备`。出错的是 s12（courses 页，g12）。这一段把字段标签和值分开写：「教室提供 / 练习用纸；…」「自备 / 画笔、颜料与调色盒」，claimTexts 里是「自备 画笔、颜料与调色盒」。模型给 s12 的两条 claim，一条是从 s16 收费表里抄来的「含练习用纸」，另一条把标签和值倒过来连写成「画笔、颜料与调色盒自备」。同样两句又分别出现在 s16、s27，都通过了。 | **是**，属于 claim 越段。T-185 改了提示以后又出现了一次，每轮 20 站里有 1 站。 | 不是 T-183 提示直接造成的。但出错的这段恰恰是 T-183 想去掉的固定字段组（次数与时长 / 班级人数 / 学费 / 适合 / 内容 / 不含 / 教室提供 / 自备），同一条材料限制在三处重复，说明改了提示以后，这种写法在这家资料里还在。T-180 同组合（`t180-r2/round1-full/private/case-12`）的事实核对 0 条拒因。 |
| 第 1 轮 industrial/precision（`round1-full/private/case-1`） | 底线修正：首页三档都报 `对比度不足或无法测量：/（1.85，需 4.5）`，对应的是行业列表里的分隔符 `<span class="sep">/</span>`，样式是 `.sep{color:var(--line-2)}`，`--line-2:#b6c0c7`。第 1 轮修正没有改这个颜色；第 2 轮修正回复在 `run.repairFailure.response` 里，共 98 条 replacements，原样回填了全部片段，CSS 片段里的颜色仍是 #b6c0c7。`lib/code-site-repair.ts:14-16` 的 `replacementSchema` 规定最多 80 条，超过就校验失败，于是报 `模型未返回有效的局部修正`（同文件第 333 行）。之所以有 98 条，是因为版面类拒因会把整页叶子元素、页头页脚和 CSS 都作为片段发出去（同文件第 129-156 行附近）。 | **否**，是新类别：版面修正发出的片段数超过回复 schema 的 80 条上限，模型照数回填就必然被拒；同时模型也没有改分隔符颜色。 | 无关。T-183 只改了文案结构相关的提示与 skill 文字，没有动对比度检查和修正路径。T-180 同组合（`t180-r2/round1-full/private/case-1`）的提交尝试没有拒因。 |
| 第 2 轮 restaurant/editorial（`round2-selected/private/case-1`） | 模型事实拒因 5 条，原文如下：s5「“配餐”与“配菜”对象不同」；s15「“适合两人以上分食”…时蔬豆腐煲未提供人数建议，且“两人以上”扩展了“两人分食”的范围」；s18「面与蔬菜按当天备料供应，品种随当日菜单变化…葱油拌面为固定内容菜品」；s21「其他菜品米饭单点 3 元/碗…对象范围被扩大」；s27「门店在社区内…属于推断」。最后报 `事实修正公共成员仍被已通过核对段使用，无法确认全部受影响归属`：s15、s18 是分组导语，同时也是 s16/s17、s19/s20 这几段（已通过）的公共成员，按 T-173 的范围规则不能修，于是拒收。 | **否**，是新类别：把单个条目的限制合并成分组导语，或者改写措辞，使限定对象扩大或换了对象。 | **很可能有关**。T-180 同组合（`t180-r2/round2-selected/private/case-1`）的事实核对 0 条拒因，那一版的条件写在各条目旁：「番茄炖牛腩 … 建议两人分食」「当日清炒时蔬 品种以店内当日菜单为准」「其他热菜米饭单点」。这一版新加了「可分食热菜：适合两人以上分食，米饭单点」「面与蔬菜按当天备料供应，品种随当日菜单变化」这类分组导语，把条目上的条件扩大到了整组。这与 T-183 核心规范新增的「重复表述合并，不删去不同的限制」「限制随对应业务就近说明」方向一致。只有这一个样本，算不上已证实。 |

后两站已单独报告构思主控，等待决定：开新票，还是在 T-183 里修。

**主控收尾（执行主控，2026-10-18 EDT）。** 分支 `t183-copy-structure`（`fe85c57`）保留不合并。主线只加两样：本票票据，以及 `scripts/eval-gap-keywords.py`（正则与 `artifacts/t183/blind-results/gap14.py` 逐字一致，重算结果与上文数字一致）。提示改动、合同测试以及 AGENTS.md、CONTEXT.md、mainline.md、spec.md 的同步文字都不进主线，主线提示仍是 T-180 时的版本加上 T-185 的修改。主数据复制：先备份 `.sitecraft-data/code-sites` 到 `artifacts/t183/main-data-backup-20261019100111/`（305 个文件），再用 `cp -n` 不覆盖地复制两轮评估成功的 17 站（第 1 轮 12 站、第 2 轮 5 站，取自工作树 `artifacts/t183/eval-data/`）和第三阶段的 restaurant/editorial `bdd6ff3b-bbac-40bb-9e4b-00eda6b86416`（取自 `round3-fix/data/`），包括各站的 code-sites、conversations，以及有图公司的 uploads/demo。站名都加了「（T-183）」，主数据站点数从 305 变为 323；在 3034 上抽查的 4 个站，code-preview 都返回 200。工作树里的 `artifacts/t183/`（672M）、账本 `artifacts/t174/t183-copy-eval/` 以及引用到的两个 `t167/test-run-*` 已复制到主工作区（后者放在 `artifacts/t183/worktree-t167/`）。