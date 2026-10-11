---
id: T-158
title: 核心规范与事实核对去掉工业 B2B 预设，按资料判断访客与重点
type: build
status: closed
blocked_by: [T-157]
claimed_by: Codex (t158-build)
supersedes:
---

## Why

T-156 定为任何行业的展示型官网。`skills/site-code-core/SKILL.md` 第 6 行把身份定为「为工业、零部件、外贸 B2B 企业做官网」、访客是采购工程师/OEM 采购/贸易商；事实核对提示（`lib/code-site-model.ts` 的 `auditCodeFacts`）围绕参数、交期、起订量、认证、排产；英文翻译提示面向海外 B2B 采购；风格与骨架卡里也有工业措辞。

## What to build

1. 核心规范：身份改为中小企业与机构的官网设计师；访客、页面任务和视觉重点由模型按资料判断（如餐饮的菜单与到店、诊所的项目与资质、工厂的产品与采购）。事实红线保持，承诺类清单改成通用的价格、时间、资质、承诺、效果、客户与评价。不写行业例外名单，保持文件短。
2. 事实核对提示同样通用化；核对段、整组沿用、拒收规则不变。
3. 英文翻译提示去掉「海外 B2B 采购」预设，按资料行业用常规商务英语；保真规则不变。
4. 骨架卡与三个现有风格只删行业写死的措辞，风格方向不变；风格是否适用非工业由 T-159 决定。
5. 系统部件不扩充：不加预约、菜单或价目部件；营业时间、地址、价目按资料以普通 HTML 排出。
6. 同步 `mainline.md`、`spec.md`、`CONTEXT.md`。

## Failure modes

第一阶段先验证以下失效方式（真实模型与审美另由主控安排）：

- 整站或局部事实提示漏掉价格、时间、资质、承诺、效果、客户与评价，未要求无数字的说法逐项对照资料原句。
- 无来源的「无痛治疗」「包教包会」「当天出餐」未随核对段或选中段进入请求，或混入事实来源；组编号、条件与原文传递被改坏。替身只检查请求合同，不证明模型语义拦截能力。
- 核心、骨架或风格仍将访客固定为工业采购；翻译仍预设海外 B2B，而不是按原文业务使用常规商务英语。
- 通用化时弱化工业规格、单位、条件、否定与承诺边界，或增加无依据的询盘、预约和系统部件。
- 替身只接受非工业页面，工业回归未能经过同一规划、写页和提交入口。新合同必须在父提交上因对应缺项失败。

第一阶段采用 Tracer bullet：请求合同红绿 → 两家替身整站生成 → 全量检查。Deep modules：保留现有模型入口和核对逻辑，只改规范措辞，不另加抽象。Ubiquitous language：沿用资料、核对段、局部修改、提交入口；不引入行业例外名单。

第二阶段失效方式（付费运行前）：预算目录拒绝 T-158；目录放宽后越出本工作树的票号目录；累计预算估计超限仍允许开始；上游错误或未知用量之后继续调用；工业旧基线缺页或不是改动前真实 quick；盲评截图泄露 A/B 来源；用量漏算修正/事实阶段；只列 code-site 而漏列会话或上传数据。负责人批准唯一一次三站 quick、累计硬上限 300,000 total token；不为改善结果重跑，不删生成站，不自评审美。

## Acceptance

- [x] 先列失效方式，事实核对的红绿测试用非工业承诺句（在旧提示的已知坏行为或替身上失败）
- [x] 真实生成（预算主控报批，预计每站 quick 约 9 万 token）：T-157 的 2 家非工业 + 1 家工业回归；非工业站交新实例盲评「像不像这家店/机构自己建的」，工业站与改动前成对盲评不变差
- [x] Astra 审查通过；typecheck、test、build 通过

### 第一阶段（负责人限定：不调用真实模型，不关票）

- [x] 核心、局部、骨架与三个风格规范去掉行业身份，文件均未变长；整站/局部事实提示与英文语气同步，核对段、沿用、拒收与保真逻辑不改
- [x] 本地替身跑通 restaurant/documentary 与 industrial/precision 的 quick 评估；完整资料与通用提示经实际请求核对，三档截图逐张打开
- [x] typecheck、全量 test、build 通过，mainline、spec、CONTEXT 与 AGENTS 的对应事实口径同步

### 第二阶段（负责人批准累计 300,000 total token，仅一次真实运行）

- [x] 预算网关支持本工作树 T-158 目录并有父实现红绿证据；三站只运行一次，用量不超过批准上限
- [x] 每站分阶段用量、事实核对段数、修正和底线结果进入报告；站点与全部数据文件保留并列清单
- [x] 两个非工业独立包和一个工业随机 A/B 包齐备，映射只在 private；不自评审美
- [x] typecheck、408 项全量 test、build 通过；本地提交，不推送、不关票

## Resolution

第一阶段技术检查 PASS（2026-10-11，`23b11d7`）；第二阶段一次真实生成及盲评包准备 PASS，见下文。完整 T-158 仍 INCOMPLETE：非工业审美及工业质量回归尚待主控交独立盲评，保留 open 与 claimed_by，不推送、不关票。第一阶段独立行为验收结论在 `artifacts/t158/acceptance-review.txt`；第二阶段的独立证据审核在本轮 `report/acceptance-review.txt`，均不代替审美盲评。第一阶段提交与证据对应关系在 `artifacts/t158/delivery.json`；第二阶段精确 SHA 在本轮 `report/delivery.json`，也可用 `git log -1 --format=%H -- .project-map/tickets/T-158-generalize-core-and-facts.md` 查询。

### 第一阶段规范与替身证据

规范句前后要点：

- 「为工业、零部件、外贸 B2B 企业做官网；访客是采购工程师/OEM 采购/贸易商」→「中小企业与机构的官网设计师；按资料判断访客、页面任务与视觉重点」。
- 报价、交期、付款、售后、认证的行业清单 → 价格、时间、资质、承诺、效果、客户与评价；无数字的流程和政策仍逐项找资料原句，无来源仍拒收，不加入样本例外。
- 「面向海外采购的 B2B 官网」→「按原文的行业与业务语境使用常规商务英语、美式拼写和准确术语」。copper/dispatch 的保真示例、数字/单位/名称与严格短编号协议均保留；只同步旧测试中的语气断言。
- 工程师产品目录/对车间有信心的工厂/工业产品画册 → 业务目录/授权现场照片/品牌画册。网格、配色、字体、栏宽、照片尺度与入口优先级不改；骨架按业务与场景组织，工业规格仍保留单位、条件、否定与边界。营业时间、地址、价目用普通 HTML，不增加预约、菜单或价目系统部件。

检查均在基线 `1814617` 应用本次改动后执行（评估记录 dirty=true）。所有命令显式使用以下环境，不载入 `.env.local`，不调用 DeepSeek，不读写主工作区数据：

```sh
export SITECRAFT_BASE=http://127.0.0.1:3184
export SITECRAFT_FIXTURE_BASE=http://127.0.0.1:3185
export CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell
export SITE_STORE=fs
```

- 请求合同红绿：`node --test --experimental-strip-types tests/t158-general-prompts.test.ts tests/t157-non-industrial-cases.test.ts`。改实现前 2/7 PASS、5 项预期失败（`contract-red-confirmed.log`）：整站/局部缺通用类别、工业身份、B2B 翻译及替身不认产品页；修改后 7/7（`contract-green.log`）。三个无来源承诺句作为待核内容，与带未知尾部值的资料分开传递；断言来自负责人要求，替身不判断语义。首份 `contract-red.log` 含一项不必要的槽位顺序假设，改为独立核对短编号与原文集合后重新记录有效红灯。
- 更新旧提示断言后的反证：`python3 artifacts/t158/check-parent-model.py`，仅暂用父提交的模型文件，finally 恢复当前文件；18 项中 5 项因旧事实类别/B2B 提示失败，退出 1，见 `parent-model-red.log`。脚本和失败证据保留，不复制源码作为证据。
- 替身：`node --experimental-strip-types scripts/t157-model-fixture.ts --out artifacts/t158/provider-final`。应用：`SITECRAFT_DATA_ROOT=/Users/luckye/Documents/Code/sitecraft-ai-t158/.sitecraft-data DEEPSEEK_BASE_URL=http://127.0.0.1:3185 DEEPSEEK_API_KEY=local-fixture-only DEEPSEEK_MODEL=local-fixture-only AI_API_KEY='' npm run dev -- --hostname 127.0.0.1 --port 3184`。共 6 次本地请求，完整原文在 `provider-final/requests.json`。
- 最终评估：`npm run eval:new-route -- --quick --only restaurant/documentary,industrial/precision --out artifacts/t158/eval-final`，PASS，两站四页各存首版，共 12 个页面/视口检查，零拒因、零修正；报告、版本快照与底线结果在 `eval-final/private/`。`SITECRAFT_BASE=http://127.0.0.1:3184 node artifacts/t158/verify-eval.mjs artifacts/t158/eval-final artifacts/t158/provider-final` 再从真实 API 核对资料、页集合与已存版本，并检查发出的核心/事实提示，PASS。12 张三档整页图、2 张首屏与 2 张对照图共 16 张均打开看过，只确认载入与流程。替身直接排资料，且事实回复为空问题；其工业页包含资料中的配图说明，不代表真实生成、语义合规或美观通过，不提交盲评。
- 最终检查：`npm run typecheck`（`typecheck-final.log`）、`npm test`（407/407、0 skipped，`test-final.log`）、`npm run build`（`build-final.log`）均 PASS；时间 2026-10-11 11:32–11:35 UTC。全量初次 404/407 的原始失败保留在 `test-run-1.log`；恢复 T-141 原授权句，更新 T-142 事实清单与 T-151 语气断言后全量转绿，未弱化功能或保真检查。最后一次规范文字调整后已重新跑评估与全部检查，早期 `eval-run-1/` 保留但不作最终证据。
- `git diff --check` 与 `project_map.py status --root .` 通过，living docs 过时项为 0。所有修改文件按 UTF-8 回读，未引入 BOM、替换字符或换行风格变化。

### 第二阶段真实运行与交付（2026-10-11）

负责人批准 300,000 total token 后，仅运行一次三站 quick；运行基于 `23b11d7`，唯一运行脚本改动是预算网关允许本工作树 `artifacts/t158/` 子目录，原累计预留、停止与不可重置账本的行为不变。目录合同在改动前 2/3 PASS、T-158 目录启动失败（`artifacts/t158/budget-directory-red.log`），修改后 3/3 PASS（`budget-directory-green.log`）；新测试还通过实际网关 HTTP 入口确认 300,001 的估计被拒绝、无上游调用且不能继续启动。未读取主工作区 `.sitecraft-data`。

运行目录：`artifacts/t158/real-20261011T123145Z/`。实际模型调用 12:34–12:42 UTC；完整原始评估、每轮候选与底线结果在 `private/`，每站细表、汇总、独立 API 回读及文件清单在 `report/`。命令：

```sh
export SITECRAFT_BASE=http://127.0.0.1:3184
export SITECRAFT_BUDGET_BASE=http://127.0.0.1:3186
export SITECRAFT_TOKEN_LIMIT=300000
export CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell
npm run eval:new-route -- --quick --only restaurant/documentary,education/documentary,industrial/precision --out artifacts/t158/real-20261011T123145Z
```

密钥仅在网关进程通过 `set -a; source /Users/luckye/Documents/Code/sitecraft-ai/.env.local; set +a` 载入；`T153_BUDGET_DIR=artifacts/t158/budget-20261011T123145Z`，模型固定 `deepseek-flash`，上游固定官方 API。本地网关先用 `/round` 登记一次 default、估计 270,000；应用以 `SITE_STORE=fs`、本工作树绝对 `SITECRAFT_DATA_ROOT`、`DEEPSEEK_BASE_URL=http://127.0.0.1:3186` 和非密钥的网关占位凭据启动。9 次真实调用全部 HTTP 200，上游账本与应用记录逐次一致，总 **192,496 / 300,000 token**（剩余 107,504 未使用）。没有重跑、修正、截断、402、网络错误或未知用量；完成后停止预算网关。最终账本保留在本轮 `private/budget/usage.json`。

| 站点 | 规划 total | 写页 total | 事实核对 total | 修正 total / 轮数 | 总 total | 新核 / 沿用段 | 底线结果 |
| --- | ---: | ---: | ---: | --- | ---: | --- | --- |
| 忻州重载减速机（industrial/precision） | 10,935 | 39,025 | 19,868 | 0 / 0 | 69,828 | 32 / 0 | 首轮 PASS，2 页 × 3 宽度，无拒因 |
| 禾巷小馆（restaurant/documentary） | 10,542 | 36,018 | 10,499 | 0 / 0 | 57,059 | 29 / 0 | 首轮 PASS，2 页 × 3 宽度，无拒因 |
| 拾色绘画教室（education/documentary） | 10,369 | 41,732 | 13,508 | 0 / 0 | 65,609 | 24 / 0 | 首轮 PASS，2 页 × 3 宽度，无拒因 |

各阶段输入、输出及思考 token 在 `report/{industrial,restaurant,education}.json`，思考量已包含在输出量内，不重复计费。18 个页面/视口结果的溢出、重叠与对比度拒因均为 0；行长及其他质量反馈保留在各站 attempts.viewports，机械通过不代表审美通过。24 张本轮截图（18 张整页、3 张首屏、3 张既有官网对照）及旧工业基线 4 张均逐张打开，内容已载入；未评判页面质量。

只把以下各包的 `review/` 交评审，兄弟 `private/mapping.json` 由主控保管，含来源、版本 ID 与用量：

- 非工业包：本轮 `packages/65e8b1e5/review/`、`packages/da2af3c0/review/`，各为首页与内容页 1440/375 四张图和中性 `questions.md`。
- 工业 A/B 包：本轮 `packages/5702037f/review/`，A/B 已随机分配，各有首页与产品页 1440/375。旧基线为主工作区 `artifacts/t130/round-2026-10-09T10-14-09-315Z`，提交 `faa0e567`，siteId `7e07b43d-5476-4db7-9d8e-d38d3d723b86`，versionId `dfdbcbfc-bce7-4006-a157-f13444b39543`；是最近的真实 industrial/precision quick，资料文本与本次完全一致，未重新生成旧版。配包脚本为 `artifacts/t158/package-real.py`，实际执行一次，拒绝覆盖旧包。

三站均保留在本工作树 `.sitecraft-data`，各只有一个 v1。逐个绝对文件路径共 22 条在 `report/data-files.json` 与 `report/report.txt`，便于主控按原相对路径拷贝；工业站包含 8 张上传图片及 8 份许可元数据，没有省略未展示的上传图。本次没有 `sites/`、annotations 或 leads 关联文件，非工业两站没有上传文件。

| 站点 | siteId | versionId | 文件数 |
| --- | --- | --- | ---: |
| 工业 | `7beb2cf7-db89-4317-9e10-8d5463578f6a` | `c45d0d39-71a9-48d1-ac85-5704c260e40a` | 18 |
| 餐饮 | `41d66eba-1358-4a23-8864-b2ddc837de0b` | `6480b054-fcac-4020-add9-b13222f0d6e5` | 2 |
| 培训 | `e39b32b0-5eab-40b8-b228-3dc70ffc3c57` | `91ef296b-57e1-4e33-8efd-5f95c07ac406` | 2 |

本阶段 `npm run typecheck`、`npm run build` PASS，日志 `artifacts/t158/phase2-{typecheck,build}.log`；`npm test` 408/408、0 skipped，日志 `phase2-test-final.log`。均显式使用本工作树 SITECRAFT_BASE 与 SITE_STORE=fs；浏览器测试另设置上述 CHROME_PATH。首次全量 407/408 的唯一失败是服务尚未启动时的本地端口 ECONNREFUSED（`phase2-test.log`）；服务就绪并核对 cwd 后原命令重跑，未改或跳过断言，也没有额外上游调用。检查运行于 12:31–12:36 UTC，在最后一次脚本修改之后；其后只整理报告与票记录。独立 Astra 对冻结候选 `28fb467` 的执行与证据包审核 PASS，报告在本轮 `report/acceptance-review.txt`；收尾仅在票里登记审核及明确测试环境表述，源码、测试和生成产物均未再改动。整票仍等待独立盲评，不以本次真实模型事实核对通过推断所有行业承诺都能被拦住。

## 主控盲评与合并（2026-10-11，纽约时间）

三个新 gpt-6.1-sol 实例，各在隔离目录只看自己的 review 包（映射在各包 private/）。真实运行 192,496 / 300,000 token，三站首轮通过、0 修正。

- **禾巷小馆（餐饮）**：真实感 5/10。没有采购、起订量、OEM、询盘等串行话术；菜名＋价格＋供应时段的菜单结构可信。扣分：页面把资料里的边界说明原样写成顾客文案（「不写成固定季节菜单」「不叠加自行推导的折扣」像写给作者的要求）；「待补充」集中出现；缺店面或菜品图，五步厨房流程过于突出。
- **拾色绘画教室（培训）**：真实感 5/10。无串行话术，课程、学费、材料自备说明最像真实教室。扣分：不考级、不承诺等边界声明过密；地址、教师、退费多处待补充；内容页 375「学费按完整一期收取」被挤成每行约两字的窄列。
- **工业回归（A=改动前 `dfdbcbfc`，B=本票 `c45d0d39`，随机 A/B）**：「更快找到产品和规格」新版明显领先；「更像这家公司」旧版小幅领先（6 vs 5），扣在新版「供货案例」窄列碎行，以及「不是第三个系列」这类制作说明留在页面。单样本，结论为一升一降，不判为通用化造成的明确倒退。

结论：去掉工业预设的目标达成（两家非工业站均无行业错位话术，工业站找产品更快）。共同问题移到 [T-160](T-160-boundary-copy-and-narrow-columns.md)：资料里的边界/禁止类说明被当成页面文案、文字被挤成过窄的列。站点已拷入主工作区 `.sitecraft-data` 供负责人查看：工业 `7beb2cf7-db89-4317-9e10-8d5463578f6a`、餐饮 `41d66eba-1358-4a23-8864-b2ddc837de0b`、培训 `e39b32b0-5eab-40b8-b228-3dc70ffc3c57`。
- 主线 `43b09ff`：`SITECRAFT_BASE=http://127.0.0.1:3034 CHROME_PATH=<本机 chrome-headless-shell> npm test` 407/408，唯一失败为 `tests/t151-generated-fidelity.test.ts`「rendered English CSS rejects new claim without digits」的 Chrome `Page.navigate` 超时（全量负载下的已知波动，本票未改英文保真逻辑）；同命令单独重跑该文件 4/4 通过。`npm run typecheck`、`SITE_STORE=fs npm run build` 通过。日志 `artifacts/merge-43b09ff/`（`rerun-flake.log` 是一次误跑全目录的中断记录，不作证据；有效重跑为 `rerun-t151-fidelity.log`）。
