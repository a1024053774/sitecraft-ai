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
- [ ] typecheck、test、build 通过；独立 fast 审查通过；新站复制进主数据，站名带「（T-184）」

## Resolution

状态：**INCOMPLETE**。codex-t184 已完成第一步的提示修改与本地合同红绿验证；第二步等负责人通知及重活排队许可。票保持 open，不作审美通过判断。基线为 `618cb58`，没有采用未合并的 T-183 提示。

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

完整 runner 回归、npm test、typecheck、build、真实评估及本次三档截图尚未运行；独立审查、盲评、缺口计数和主数据复制未执行。本轮没有载入真实密钥、写主工作区数据或启动重活，按负责人要求提交后停在第一步。
