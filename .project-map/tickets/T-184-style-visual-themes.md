---
id: T-184
title: 风格视觉主题与首屏构图：摆脱细线均一和左字右空
type: build
status: open
blocked_by: [T-183]
claimed_by: codex-t184
supersedes:
---

## Why

T-180 质量基线（2026-10-18，`artifacts/t180-r2/`）发现两类视觉问题：

- **缺口 2（14 站）**：只靠细横线、统一字号和留白分层级。整站反复落到「米白衬线」或「白底蓝按钮」两套样子，看不出行业自己的视觉主题。
- **缺口 3（约 9 站）**：首屏左边是标题和按钮，右边一大块空白；或者产品大图很大，旁边的短列表很轻，图文重量不平衡。

核心规范第 18 行写的是「能用表格、细线和留白分组，就不套卡片」，可能是缺口 2 的来源之一。本票接在 T-183 后面做，两张票都会改 skill 文件，分开做才能分别评估效果。

## What to build

1. **先找根因**：对照代表站源码，以及核心规范和四个风格 skill（`skills/site-code-*/SKILL.md`），查清两类问题的来源，写进 Resolution。
2. **改风格 skill**：让每种已登记风格都有可区分的层级手段（字阶对比、色块与底色分区、图文比例、密度节奏等，由各风格自己定）。首屏按资料实际有没有图、有没有可用事实来构图，没有图就不留出空的图位。
3. **底线不变**：
   - 不加载字体或外部资源，不加紫蓝渐变、发光、玻璃这类已禁止的效果；
   - 对比度、溢出、重叠检查不变；
   - 风格登记与缩略图规则不变。改动已有风格的 ready 状态前，须先有独立盲评支持。
4. **证据**：T-183 判 NO_GO，没有合并（构思主控 2026-10-18 决定），本票以主线现有提示为基线，即 T-180 时的提示加上 T-185 的修改。评估流程与 T-183 相同：默认 full 矩阵的 `--previous` 指向 `artifacts/t180-r2/round1-full`，六组合的 `--previous` 指向 `artifacts/t180-r2/round2-selected`；用新账本，显式设 `SITECRAFT_TOKEN_LIMIT=3000000`；三个盲评包分别交给独立实例。缺口计数统一用固定口径脚本 `scripts/eval-gap-keywords.py`，对 T-180、T-183、T-184 三轮一起重算：T-180 与 T-184 对比，T-183 只作参考。不再引用 T-180 票里的 14/8。

## Acceptance

- [x] 根因对应关系写进 Resolution
- [ ] 跨轮盲评中缺口 2、3 的同类站数下降，mixed 被认出比例如实记录；列出 comparison 选择结果，以及固定口径脚本对三轮重算的缺口 1、4 计数
- [ ] typecheck 与 T-184 合同测试通过（全量由主控最终合并时执行，本票不跑 runner/build）；独立 fast 审查通过；新站复制进主数据，站名带「（T-184）」

## Resolution

状态：**INCOMPLETE**。第一步提示修改与第二步新门控、两轮真实评估已执行；共 17 站存版、3 站失败，六包中一包齐全。服务已按终态规矩手动关闭。独立审查、盲评和主数据复制未执行，票保持 open，不作审美通过判断。基线为 `618cb58`，没有采用未合并的 T-183 提示。

### 根因与代表站对应

只读核对主工作区 `artifacts/t180-r2/{round1-full,round2-selected}/blind-results/{mixed,company}-result.json`，按对应 `private/mapping.json` 解盲；查看下表六站的 `code-site.json`，打开 round1 的 case-3、case-6 与 round2 的 case-5、case-6 的 `home-fold-1440.png`。这些是诊断用的旧证据，不是本次修改的效果证据。

| 提示侧原因 | 代表站源码与原盲评对应 | 本次处理 |
| --- | --- | --- |
| 核心第 18 行把“表格、细线和留白”设为通用优先手段，精密工程再次要求“细线分组”；反卡片约束没有配合其他层级手段。 | `round1-full/private/case-3`（export/precision；mixed `18bc45fb64c3`）：`.section + .section` 统一 1px 顶线，h2 为 22px、h3 为 16.5px；原评“各区都依靠黑体标题、固定留白和浅色横线组织”。`case-13`（design/precision；`cedfa0c23c6f`）也被指出服务目录与沿革继续用细线分行。 | 核心改为按内容用途使用表格与细线，层级交给风格的字阶、底色、图文比例与疏密；精密工程用明确字阶和可选深色规格带区分目录与核对细节。 |
| 画册已有衬线与栏宽，邻里已有色面，但没有清楚区分重点业务、正文与告示的视觉分量，也没有约束全页逐节画线。 | `round2-selected/private/case-5`（design/editorial；`7bd7e238546a`）：`.section` 每节顶线，`.svc-list h3 a` 再加底线；原评“米白底、衬线大标题和细横线组成非常均一的排版系统”。`case-6`（design/neighborly；`e52ed8ef64d0`）：`.section` 和 `.service` 顶线重复，服务标签下另画短线；原评“整页主要依赖统一字号、米白底和细线组织”。company 评同时指出两种风格的站点骨架有差异，因此没有把问题归为固定骨架。 | 画册补纸色分区、跨栏与主业务名称的字阶；邻里补招牌、开敞价目、紧凑告示的分量关系，保留各自原有字体、配色与入口顺序。 |
| “没有图不留占位框”只排除了显式图框，没有规定纯文字首屏怎样使用整页宽度。 | `round1-full/private/case-3` 的 `.hero .wrap` 只有 h1、短说明、按钮，没有空图元素，但说明 `max-width:36em`，首屏仍使用整页宽度和上下 padding；原评“右侧留下整块空白”。`case-11`（education/precision；`a7a0d70f09f1`）也被指出标题、说明集中左侧。 | 四种风格均说明无图首屏如何由真实业务内容占宽或上下衔接，内容不足时收紧成短开篇，不靠新增事实或重复文案填满。 |
| 实拍风格只强调照片大小有主次，没有要求同时考虑原图长宽、主体和旁文长度。 | `round1-full/private/case-6`（molding/documentary；`272ef505b0df`）：`.atlas-grid` 为 2fr/1fr、`align-items:start`，`.figure img` 仅设 width:100%，旁边四条短列表为约 1rem；高幅原图随宽栏放大，列表在上部结束。原评“照片占据很长的纵向空间，右侧短条目集中在上半部，图文重量明显失衡”。 | 实拍首段明确按原比例、主体和文字量决定图文比例；短列表旁收小图宽或把文字移到图下，不靠裁掉主体凑高；无图改由黑体跨栏标题和已有内容的深浅分区承重。 |

`lib/code-site-model.ts` 的 `rules()` 将核心、去 AI 味规范、所选风格及滑杆发给规划与整站写页；没有固定首屏 DOM。`writeLocalEdit()` 只取风格去掉 frontmatter 后的首段，因此新增层级与无图构图要点都放在该首段，不改加载器或局部修改边界。滑杆仍只调排法，不改内容；风格登记、ready 状态、缩略图、资源与底线检查实现均未改。这些对应关系确认了可调整的提示诱因；能否降低缺口 2、3 仍需真实跨轮盲评。

### 第一阶段验证

时间均为 America/New_York（EDT，UTC-04:00），2026-10-18。

- 合同预期：核心不通用优先细线，四种风格分别声明层级与无图构图，资料不足时收紧，实拍处理大图与短列表，局部首段保留关键规则。新增测试先于提示修改；不把测试绿灯当作页面质量证据。
- 命令：`node --test --experimental-strip-types tests/t184-style-visual.test.ts`。21:07:39，基线提示 **0 通过 / 6 失败**，退出 1；失败对应旧细线优先句、精密缺深色层级、实拍缺系统黑体引导、画册缺纸色分区、邻里缺招牌分量、局部首段缺层级要点。原始输出：`artifacts/t184/phase1/contract-red.log`。
- 同一命令，21:08:19，修改后 **6 通过 / 0 失败**，退出 0；输出：`artifacts/t184/phase1/contract-green.log`。测试经生产 `planSiteCode` / `writeSiteCode` 截获实际提示，fetch 只在内存中提供合法传输对照，不运行服务、浏览器或真实模型；局部首段检查是静态合同检查，没有运行局部编辑或证明其页面效果。
- `git diff --check` 通过；文本回读为 UTF-8、无 BOM、LF，无替换字符；`python3 /Users/luckye/Documents/SKILLS/project-map-skill/project-map/scripts/project_map.py status --root .` 报 Problems 0、Stale living docs 0。
- 对应提交为包含本 Resolution 的 `T-184: clarify style hierarchy and first-screen composition` 功能提交，父提交 `618cb58`；完整 SHA 由执行者在提交后汇报。没有独立证据提交。

第一步截至当时未运行真实模型或全量门控；后续执行与负责人更新的门控规则见下节。

### 第二阶段：新门控与真实评估

执行者 codex-t184。以下时间均为 America/New_York（EDT，UTC-04:00）。本阶段候选固定为 `6586d9d836ae806a097d85e274c9c7290c272824`，两份 `private/round.json` 均记录该提交与 `dirty=false`。生成提示及生产代码沿用 `aaa7ea1`；两提交之间只改了 `tests/t184-style-visual.test.ts` 的钩子管理，全部断言与测试主体未改。Tracer bullet 沿用资料 → 大纲 → 写页 → 检查 → 存版的真实入口；Deep modules 沿用既有提交入口；Ubiquitous language 沿用“风格、页面大纲、核对段、资料出处”。

**当前门控（负责人更新规则）。** 只跑 typecheck → T-184 合同测试单文件，均通过后进入真实评估。本轮没有重跑 runner、全量或 build；全量留给主控最终合并时执行。

| 命令 | 起止时间（2026-10-19 EDT） | 结果与证据 |
| --- | --- | --- |
| `npm run typecheck` | 00:10:04–00:10:06 | PASS，exit 0；`artifacts/t184/phase2-final/typecheck.log`。 |
| `node --test --experimental-strip-types tests/t184-style-visual.test.ts` | 00:10:06–00:10:06 | PASS，exit 0，6/6，无跳过；`artifacts/t184/phase2-final/contract.log`。 |

**引用前次全量，保留失败。** `aaa7ea1` 上的 runner 于 2026-10-18 22:10:36–22:11:05 通过 18/18，全量于 22:11:13–22:28:06 通过 **869/869**（非浏览器 123、浏览器 746，浏览器并发 2，无跳过），证据为 `artifacts/t184/phase2/{runner,full-test}.log` 与 `artifacts/t167/test-run-1792375873731-34600/report.json`。随后 typecheck 在 22:28:25 因测试钩子类型失败，原文仍在 `artifacts/t184/phase2/typecheck.log`；第一次钩子改法的单文件 2/6 失败仍在 `artifacts/t184/hook-fix/focused-test.log`。`6586d9d` 把环境快照和 after 清理移到顶层，钩子修复后的 typecheck 与单文件 6/6 日志在 `artifacts/t184/hook-fix-top-level/`。本次引用不冒充新提交的全量通过，旧失败均未覆盖。前次 Next 自动追加的两项 tsconfig include 已精确撤回，差异留在 `artifacts/t184/phase2/generated-tsconfig.diff`，本阶段没有配置改动。

**隔离与预算。** 普通 dev 使用 `http://127.0.0.1:51785`、本工作树 `artifacts/t184/eval-data/`；health 核对 cwd、dataRoot、development-file 与 deepseek-flash，记录在 `artifacts/t184/phase2-final/{config,health}.json`。应用清空继承环境，仅持占位凭据并连接 `http://127.0.0.1:51786` 网关。真实密钥只在网关子进程中以 `set -a; source /Users/luckye/Documents/Code/sitecraft-ai/.env.local; set +a` 载入，source 输出丢弃；网关运行 `scripts/t153-real-budget.ts`，显式设置上游、deepseek-flash、`SITECRAFT_BASE`、`SITECRAFT_BUDGET_BASE`、`SITECRAFT_TOKEN_LIMIT=3000000` 及 `T153_BUDGET_DIR=artifacts/t174/t184-style-eval`。本执行者仅让网关子进程载入真实密钥；应用与评估器未载入真实密钥，未写主工作区 `.sitecraft-data`。

唯一新账本 `artifacts/t174/t184-style-eval/usage.json` 从 0 连续记到 **1,978,049 / 3,000,000 token**，剩余 **1,021,951**；输入 761,811、输出 1,216,238。70 次调用全部 HTTP 200、完成，用量未知 0，账本与各站调用数及用量逐轮一致。没有重置、另开、重发或重跑失败站；原流程内的底线修正照常执行并留证。`default` / `high` 是两轮的记账标签，估算 2,000,000 / 900,000，不改变默认 5/6 滑杆。

真实评估命令：

```sh
SITECRAFT_BASE=http://127.0.0.1:51785 SITECRAFT_TOKEN_LIMIT=3000000 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm run eval:new-route -- --previous /Users/luckye/Documents/Code/sitecraft-ai/artifacts/t180-r2/round1-full --out artifacts/t184/round1-full
SITECRAFT_BASE=http://127.0.0.1:51785 SITECRAFT_TOKEN_LIMIT=3000000 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm run eval:new-route -- --only education/editorial,design/editorial,restaurant/editorial,restaurant/neighborly,education/neighborly,design/neighborly --previous /Users/luckye/Documents/Code/sitecraft-ai/artifacts/t180-r2/round2-selected --out artifacts/t184/round2-selected
```

| 轮次 | 起止时间（2026-10-19 EDT） | generated / error / rejected / blocked | token（输入 / 输出） | 调用 | 状态 |
| --- | --- | --- | --- | --- | --- |
| round1-full | 00:11:04–01:08:04 | 11 / 3 / 0 / 0 | 1,403,485（541,304 / 862,181） | 47 | INCOMPLETE，exit 1 |
| round2-selected | 01:08:32–01:32:26 | 6 / 0 / 0 / 0 | 574,564（220,507 / 354,057） | 23 | INCOMPLETE，exit 1 |

**逐站结果。** 三个 error 均无保存版本；版本列“—”表示没有版本，事实列“—”表示未记录事实或出处拒因。原始站点、全部响应、检查尝试和截图在各轮 `private/case-N/`；完整逐站用量、模型拒因与提交检查拒因原文汇总于 `artifacts/t184/phase2-final/completion-summary.json`，不以最终存版覆盖曾出现的拒因。所有 17 个保存版本的 checks.passed 均为 true，375/768/1440 各页面的 overflow、overlaps、contrastIssues 均为 0；这些来自本次提交检查，截图未逐张人工打开，不作完整 UI 或审美通过判断。

| 轮次 / case / 组合 | outcome | 站点 ID | 版本 ID | token | 事实记录 |
| --- | --- | --- | --- | --- | --- |
| round1-full / 1 / industrial/precision | generated | `04f0c96c-41fc-4514-8466-a053c8d1588c` | `6087ec72-257f-4034-8bf7-c1e29d3d5faf` | 71,985 | — |
| round1-full / 2 / industrial/documentary | generated | `1fbd7776-8308-4ba4-bca1-6fa4efdf1a7e` | `c0f079a4-8b3b-440e-b63f-c5c654fd67c7` | 84,683 | — |
| round1-full / 3 / export/precision | generated | `7f3b3a84-46f6-4c66-b4f4-b9892aedf92e` | `6e0a753b-f07b-4e97-9f80-53d0055c1583` | 88,924 | — |
| round1-full / 4 / export/documentary | generated | `1f3071c4-d265-49c5-9b43-b9f10834278b` | `f59fe578-a5d5-457b-9a34-83a0b58113d0` | 81,617 | — |
| round1-full / 5 / molding/precision | error | `69f92f6d-32ca-4f9e-8ba8-b2a33a20b4e5` | — | 136,090 | F1 |
| round1-full / 6 / molding/documentary | generated | `e679ef51-0e42-4d29-8e8c-273372cea6fc` | `bf5492f7-7433-4d88-89f4-7e1ceb8e658f` | 116,009 | — |
| round1-full / 7 / packaging/precision | generated | `2f0f15cf-1f58-40a7-b331-922d0557c1b0` | `36958c18-e9cf-4cfb-916e-f9bc7519d155` | 113,448 | F2 |
| round1-full / 8 / packaging/documentary | generated | `9965c198-76f4-4421-9971-c87c9853ffb2` | `fdd13a3b-c545-48d0-a6a8-c0ae60479f1f` | 104,359 | — |
| round1-full / 9 / restaurant/precision | generated | `d5d846e5-6324-4ac8-9aec-707f036fd30c` | `d75662a0-ac3e-48a2-9217-23382acb1f27` | 128,331 | F3 |
| round1-full / 10 / restaurant/documentary | generated | `4d25bc86-4674-4259-a098-86b4fd69fcfc` | `3baee3ad-102e-4620-81df-61f3229d324b` | 83,376 | — |
| round1-full / 11 / education/precision | error | `a65665d1-ba4a-4a0d-ac84-8ffd5c54465a` | — | 86,491 | F4 |
| round1-full / 12 / education/documentary | generated | `e40b8af3-8cbe-44a8-9530-e8bd8789d003` | `3a37bd9f-4eb7-4fc4-960f-7185d57ed17a` | 101,742 | — |
| round1-full / 13 / design/precision | error | `3aaba8d0-771c-43a0-b068-656e3a7ec5dc` | — | 108,564 | F5 |
| round1-full / 14 / design/documentary | generated | `f6b5fb49-d9ad-4512-883d-fe88f4ce0cbe` | `2003316c-b1dc-4225-b51b-e0c25ada2823` | 97,866 | — |
| round2-selected / 1 / restaurant/editorial | generated | `c2ed93b2-5151-4ab8-835a-6f815ee4cfb7` | `9c769726-f2c2-487c-9319-84db7a5f0a03` | 120,221 | F6 |
| round2-selected / 2 / restaurant/neighborly | generated | `b7aedbde-a131-43e8-8950-7ce12b7f31e4` | `af2ead1e-8262-4bbf-8b76-c531d238eed9` | 89,918 | — |
| round2-selected / 3 / education/editorial | generated | `229d3ee1-e6f0-4037-a4ec-58e57b810a59` | `603ede5e-3378-4eb2-b266-96126cedf80e` | 97,388 | — |
| round2-selected / 4 / education/neighborly | generated | `406c3fc7-991b-4e00-bffa-3b88b09f988c` | `0d5c03c1-8e79-46f3-bffe-9bb82f188c8a` | 108,032 | F7 |
| round2-selected / 5 / design/editorial | generated | `469e99dd-068b-43dc-9a2d-175374857109` | `748c965a-4357-4f10-8e52-9d6eec0b72b1` | 91,912 | — |
| round2-selected / 6 / design/neighborly | generated | `6146ce80-a9f0-44d1-babb-75fac05876e8` | `ed3bc12d-0626-47db-8504-f1f7ecf04787` | 67,093 | — |

**事实与出处原文。** F1、F4、F5 最终均 error，保存的终止原文相同：

> 事实修正公共成员仍被已通过核对段使用，无法确认全部受影响归属，本次未保存版本。

以下逐字保留各段原始拒因；同一内容在不同段出现时分别记录。JSON 汇总保留每次调用和提交检查的重复出现位置。

**F1 — round1-full / case-5 / molding/precision（error）**

模型原文，production / s49（调用 2）：

```text
网页称“出口订单与内销订单共用这套流程”，资料仅说明“内销与出口订单并行”，未说明两类订单共用同一流程。
```

**F2 — round1-full / case-7 / packaging/precision（generated）**

模型原文，home / s3（调用 2）：

```text
网页称「两个系列同一组工艺：结构设计、白样、胶印、模切与糊盒。」资料中瓦楞运输盒为单色/双色水性印刷，只有折叠彩盒明确为四色胶印；不能把胶印写成两个系列共用的同一工艺。
```

模型原文，home / s3（调用 2）：

```text
网页称「纸盒只承接已有独立内袋的食品外包装；我们没有食品直接接触许可，不做直接接触裸装食品的包装。」资料中该限制针对食品外包装/直接装食品问题，纸盒业务还包括日用品运输与电商配送的瓦楞运输盒；把食品限制写成全部纸盒业务，范围不符。
```

**F3 — round1-full / case-9 / restaurant/precision（generated）**

模型原文，home / s4（调用 2）：

```text
页面称「时蔬豆腐煲米饭不包含 · 午市和晚市」；资料中时蔬豆腐煲条目未列供应时段，场景二仅提到晚饭分食可提供该菜，不能据此写成午市和晚市均供应。
```

模型原文，menu / s14（调用 2）：

```text
页面在时蔬豆腐煲行称「供应午市和晚市」；资料中该菜品条目未列供应时段，场景二仅提到晚饭分食可提供该菜，不能据此写成午市和晚市均供应。
```

提交检查原文（attempt 0）：

```text
高风险事实缺少有效资料出处：页面原句「页面 menu：菜单与价格 · 禾巷小馆
逐项对照

价格为堂食单份含税价，不另收服务费。
<TABLE>
<THEAD></THEAD>

<TBODY></TBODY>
</TABLE>
<THEAD>
<TR>
<TH>
[scope=col]
菜品</TH>

<TH>
[scope=col]
价格</TH>

<TH>
[scope=col]
内容</TH>

<TH>
[scope=col]
供应</TH>

<TH>
[scope=col]
米饭</TH>

<TH>
[scope=col]
说明与边界</TH>
</TR>
</THEAD>
<TR>
<TD>时蔬豆腐煲</TD>

<TD>价格36 元/份</TD>

<TD>内容豆腐、菌菇与当日蔬菜</TD>

<TD>供应午市和晚市</TD>

<TD>米饭不包含</TD>

<TD>说明使用共用厨房和调味料，不能承诺为纯素或无麸质菜品</TD>
</TR>」；声明类别「价格与收费、时间与交期承诺」没有通过的资料出处。
```

**F4 — round1-full / case-11 / education/precision（error）**

模型原始 `issues` 全空，原运行没有独立保存代码拼出的底层出处拒因；不能补造为模型拒因。对保留回复及唯一来源做只读定位，s16、s17 均把 quote 写成「自带材料不影响课程学费。」；来源对应处是「自带材料不影响课程学费；」，句号替换分号后未逐字命中。claim 本身在来源中存在。此定位只调用纯函数 `findFactSource`，没有重跑站点、模型、浏览器或存版；诊断与原始错误分开存于 `artifacts/t184/phase2-final/education-precision-quote-diagnostic.json`，不冒充原运行已留存的底层完整拒因。

**F5 — round1-full / case-13 / design/precision（error）**

模型原文，home / s3（调用 2）：

```text
页面原句“对象为有既定结构的日用品纸盒”，资料为“常见对象 有既定结构的日用品纸盒”，把常见适用范围写成固定对象，范围限定不准确。
```

模型原文，home / s3（调用 2）：

```text
页面原句“按交付内容逐项核算”，资料收费口径为“按项目范围、应用数量与交付内容逐项核算”，遗漏项目范围与应用数量，收费依据不完整。
```

模型原文，services / s13（调用 2）：

```text
页面原句“不合并计算”，资料只分别列出各服务周期及起算条件，未说明不同服务周期不合并计算；该交付政策不能由分项时间推出。
```

**F6 — round2-selected / case-1 / restaurant/editorial（generated）**

模型原文，menu / s14（调用 2）：

```text
网页在时蔬豆腐煲条目写“供应 午市和晚市”，资料只列明时蔬豆腐煲的价格、内容、米饭不包含及共用厨房和调味料边界，未提供该菜的供应时段，不能补为午市和晚市。
```

**F7 — round2-selected / case-4 / education/neighborly（generated）**

提交检查原文（attempt 0）：

```text
资料出处无依据：具体室内替代练习由当次课说明；引文「因天气调整城市速写地点时，具体室内替代练习由当次课说明。」未在本次资料原文中找到。
```

另有两站仅因布局进入修正：round1-full 的 education/documentary、round2-selected 的 education/editorial，初次提交原文均为 `courses/375 横向溢出`，各经既有一轮修正存版；不是新增模型事实拒因。其他站的原始事实回复和检查同样保留，不能从“generated”推导为从未发生拒因。

**六个盲评包。** 只读取 `private/blind-coverage.json` 和目录存在性，没有读取审包内容或派盲评。齐全性按本次覆盖元数据记录：

| 包路径 | 覆盖 | 是否齐全 |
| --- | --- | --- |
| `artifacts/t184/round1-full/review/mixed/` | 24 / 28 | INCOMPLETE |
| `artifacts/t184/round1-full/review/company/` | 27 / 42 | INCOMPLETE |
| `artifacts/t184/round1-full/comparison-review/` | 10 / 14 | INCOMPLETE |
| `artifacts/t184/round2-selected/review/mixed/` | 11 / 12 | INCOMPLETE |
| `artifacts/t184/round2-selected/review/company/` | 6 / 6 | 齐全 |
| `artifacts/t184/round2-selected/comparison-review/` | 5 / 6 | INCOMPLETE |

第一轮 mixed 缺 molding/precision、education/precision、design/precision 的生成截图及一份 restaurant/1 官网对照（原错误 `AssertionError [ERR_ASSERTION]: 页面入场或转场未结束，本次未保存截图`）；company 缺三个失败精密组合相关的 15 对；comparison 缺上述三站及上一轮失败的 packaging/precision 共 4 对。第二轮 mixed 缺 restaurant/1 对照（原错误 `Error: 页面导航失败：net::ERR_EMPTY_RESPONSE`）；company 六对齐全；comparison 缺 T-180 没有版本的 restaurant/neighborly 一对。两次对照失败均未重试，没有为截图工具另做修复。完整缺项在 `artifacts/t184/phase2-final/package-coverage.json`。

**终态与关闭。** 第一轮退出后，01:08:18 经实际 draft 接口核对 14 站的 28 个 run 均终态、网关在途 0，保存 `artifacts/t184/phase2-final/round1-terminal.json` 后才开始第二轮。第二轮 01:32:26 退出；01:32:58 再经实际接口核对全部 20 站的 40 个 run（37 complete / 3 error）与全部 70 次网关调用均终态、在途 0，保存 `pre-stop-terminal.json`。随后 01:33:13 手动向网关 pid 1128、dev pid 97536 的独立进程组发送 SIGINT；网关实际退出码 -2（SIGINT）、dev 退出 0，01:33:43 确认 51785、51786 两端口关闭，见同目录 `shutdown-request.json`、`{gateway,dev}-exit.json`、`shutdown.json`。账本 `stopped=false` 仅表示未触发预算停止，不表示进程仍运行。

两轮都没有重发失败站；没有读审包内容、派审查或盲评、复制主数据或推送。缺口 1/2/3/4 的本轮盲评计数、mixed 识别率与 comparison 偏好均未测；等待主控收回独立结果后按固定口径统一重算，不能用技术运行结果代替。三个失败站和五个不齐全的包如实保留，整票保持 INCOMPLETE / open。本次交付为包含此 Resolution 的本地记录提交（父提交 `6586d9d`，完整 SHA 随执行者汇报）。
