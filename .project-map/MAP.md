# Project map

## Destination

2026-10-07 换路线（[T-127](tickets/T-127-route-model-writes-site.md)）：模型直接写站点代码，harness 管版本、提交入口、底线检查和评估。完成标志：新路线在工作台跑通「资料 → 风格 → 生成 → 对话修改 → 版本恢复」，换公司的独立盲评不再判为同一模板、新旧成对盲评选新版（T-143；混排只作参考），用户补充资料后站点能逐步丰富，旧区块库路线已删除。需求见 [intent.md](../docs/project/intent.md)，主线见 [mainline.md](../docs/project/mainline.md)，术语见 [CONTEXT.md](../CONTEXT.md)。

## Notes

- 规则以 [AGENTS.md](../AGENTS.md) 为准：优先级、生成路径的硬约束、本阶段不做的事、验收、Git。
- 下一步做什么只看 frontier：`python3 ~/.claude/skills/project-map/scripts/project_map.py status --root .`（脚本在 project-map skill 里）。开工前在票的 `claimed_by` 写上自己的名字；一次只做一张 build 票。
- 分工（[T-049](tickets/T-049-roles-2026-09-29.md)，取代 T-033）：负责人只定方向和需求。Claude 规划、验收、整合推送；Codex（`codex-build` 等）和 Sonnet 5.5 子 agent 执行（Kiro 2026-10-01 起不再使用）；Codex Astra 审代码；Codex gpt-6.1-sol 盲评；Grok 做杂活；云端会话在 `cloud/*` 分支做票。
- 现状（2026-10-10）：站点代码路线提供生成、对话修改、完整版本与恢复，评估入口为 eval:new-route。T-145 已移除旧运行路径和 vendor，主数据 13 站转换与批准的残留清理已完成；Astra NO_GO 的结构失败与查询导航问题修复后等待复审。当前页面质量按 T-143 的换公司与成对比较标准判断；历史见 [plan-history.md](../docs/project/plan-history.md)。
- 查看生成站用 Chrome（[T-011](tickets/T-011-review-browser.md)）。移动端用浏览器的 375 / 768 / 1440 验收。
- 前端工作叠加这两个 skill：`skills/frontend-less-ai-tone/`、`skills/sitecraft-frontend-less-ai-tone/`。

## Decisions so far

- [T-001 生成路径怎么组页](tickets/T-001-generation-path.md)：样子 → 同族模块 → 整页；一个预览引擎；草稿只走 `commitOperations`（已被 T-048、T-127 先后取代）
- [T-002 页面怎么规划](tickets/T-002-page-planning.md)：用户点名的页面 > 模型按业务规划 > 首页/产品服务/联系；三页不是上限
- [T-003 数据由谁删除](tickets/T-003-data-deletion.md)：只有用户明确选择才删除，不自动清理
- [T-004 需求对齐何时开启、一张卡问几题](tickets/T-004-alignment-default-and-shape.md)：新建站点默认开启；一张卡 1–4 题，一次提交，最多 3 轮
- [T-005 配色怎么给用户选](tickets/T-005-color-sets.md)：6 套色彩集 × 4 个样子的色板，另支持自定义品牌色
- [T-006 行业和样子怎么对应](tickets/T-006-industry-look-recommendation.md)：按行业标推荐和理由，不限制可选范围
- [T-007 生成站视觉从哪里改起](tickets/T-007-visual-sample-first.md)：先用工程工业做样板，重做现有 overlay，再推开；新素材准入在后
- [T-008 工作台怎么布局、用什么主题](tickets/T-008-workspace-layout-theme.md)：方向 B；手机逐题底部抽屉；深浅主题和强调色
- [T-009 中英文怎么生成，缺的内容怎么显示](tickets/T-009-bilingual-and-gaps.md)：`{zh, en}` 一起写（「一起生成」已被 T-127 取代：英文在用户满意后再问）；`To be provided`；缺口规则
- [T-010 模拟资料包要多厚，照片用什么许可](tickets/T-010-simulated-pack-thickening.md)：加厚并标为模拟；CC0/公有领域/CC-BY/CC-BY-SA，内容必须对得上
- [T-011 生成站用什么浏览器看](tickets/T-011-review-browser.md)：用 Chrome；预览被拦截时报错并提示
- [T-012 待办以哪里为准](tickets/T-012-todo-source.md)：project-map 取代 plan.md
- [T-013 谁做什么，谁来审核](tickets/T-013-roles-and-review.md)：Claude 做界面，Astra 做逻辑，Grok 做审核和调研；负责人不做审核（已被 T-033 取代）
- [T-033 2026-09-28 起谁做什么](tickets/T-033-roles-after-claude.md)：Kiro 规划执行，Grok 分担执行，跨 harness 互相验收，Codex 盲评，Claude Code 不排工（已被 T-049 取代）
- [T-014 工程工业样板怎么做](tickets/T-014-sample-prototype-first.md)：先出两个方向的原型，盲评选一个，再实现
- [T-015 调研真实工业企业官网的版式](tickets/T-015-real-industrial-site-research.md)：首页是实拍加产品族入口，参数收在范围或选型工具里；没有照片就做不了现场图和证书墙
- [T-017 工程工业样板两个方向的原型](tickets/T-017-engineering-sample-prototypes.md)：盲评选「样本册」（白底产品族卡片、关键参数在卡上、完整参数收起），借用首屏规格条和独立询盘底
- [T-029 其余三个样子是否现在按工程工业样板改](tickets/T-029-push-sample-to-other-looks.md)：要，每个样子一张票，借结构不借外观
- [T-048 生成站怎么摆脱 4 个固定版式](tickets/T-048-generation-direction-block-library-css.md)：区块库 + token + 受限站点样式（已被 T-127 取代）
- [T-051 区块素材与 CSS 校验调研](tickets/T-051-block-material-and-css-guard-research.md)：结构参考 HyperUI、Meraki UI；站点样式走做法 A（结构化规则，不加依赖）；Preline 不用；第一版不用图标
- [T-064 放开自由度之前先量什么](tickets/T-064-quality-baseline-before-freedom.md)：先做绝对质量基线和专家对照，按事先写好的规则判读；不按数量扩布局；撤销要能挑着撤；批注契约等评分后写 spec
- [T-071 评分之后怎么走](tickets/T-071-recommend-per-company-and-block-pool.md)：不再加评分轮次；推荐随公司变；区块布局批量做，每个过 AI 味审查（只看单区块裁切图）才进库；需要新字段的内容区块另写 spec
- [T-078 草稿加新字段](tickets/T-078-new-draft-fields-for-content-blocks.md)：先做商业条款、设备（带数量），结构化字段、模型只按资料抽取、事实检查覆盖；质检流程和沿革第二批
- [T-082 英文页事实核对到什么程度](tickets/T-082-english-fact-fidelity.md)：只做数字 / 代码 / 单位的机械检查，专有名词是否译对记为已知限制
- [T-049 2026-09-29 起谁做什么](tickets/T-049-roles-2026-09-29.md)：Claude 规划验收，Codex/Sonnet 执行（Kiro 已停用），Astra 审代码，gpt-6.1-sol 盲评，Grok 杂活，云端做 T-050–T-052
- [T-084 前端收藏调研之后怎么用](tickets/T-084-threads-research-decisions.md)：批注按 komo 交互骨架加稳定 slot 锚点开工；加 OKLCH 色阶不加色彩集；中文回退 + 英文 OFL 自托管；正文 4.5:1 升硬门；联系/认证图标自制试验；付费 UI 库不用

- [T-104 T-084 这批之后做什么](tickets/T-104-after-research-batch.md)：两种盲评（混排猜不出、换公司看不出同模板）；测试真图 + 同风格示意图；vendor 模板只拆区块补 4 个样子；下线模板画廊、入口改工作台；只做静态细节不做动效
- [T-114 手机页脚怎么排](tickets/T-114-mobile-footer-layout.md)：375px 单列；768/1440px 保留同基线，手机检查间距、断行和溢出

- [T-111 验收入口必须拒绝漏测](tickets/T-111-acceptance-observed-coverage.md)：真实CLI、逐图可见与decode、实际DOM和slot覆盖均有独立红绿证据

- [T-115 行业说明如何去冗余](tickets/T-115-industry-description-redundancy.md)：省略无新增事实的复述，保留有效说明，中英文一致且可撤销

- [T-120 冻结验收工具链](tickets/T-120-freeze-verification-chain.md)：验收工具完善属优先级 3，不连开基础设施票、不做哈希 / 字节 / 像素比对；T-110 回到 T-104 原口径

- [T-121 盲评 NO_GO 之后的方向](tickets/T-121-after-blind-no-go.md)：按内容排版、每家骨架不同（已被 T-127 取代）

- [T-127 换路线](tickets/T-127-route-model-writes-site.md)：模型直接写站点代码；核心规范 + 用户选风格；Notion 式版本库、唯一提交入口、四层评估；英文在用户满意后再问；旧区块库路线跑通后删除
- [T-131 站点列表因旧记录读不出而整体 500](tickets/T-131-site-list-legacy-palette-500.md)：不再逐个修旧迁移；读不出的旧记录在列表里明确标「旧记录无法打开」，其余照常
- [T-139 待补充与模拟邮箱](tickets/T-139-placeholders-and-sim-domain.md)：「待补充」照常展示、盲评不计入破绽；模拟邮箱用 luckye.online
- [T-141 用户给什么就做什么](tickets/T-141-build-from-what-user-gives.md)：不默认加询盘、报价、邮箱联系和联系页；资料少就做得少，用户补充后再丰富
- [T-143 衡量标准](tickets/T-143-quality-metric.md)：以换公司不像同模板、新旧成对选新为准；混排只作参考
- [T-146 Shaders、good-css、Oil UI 怎么接](tickets/T-146-shaders-goodcss-oilui.md)：shader 只做系统渲染的静态底图；good-css 做成提交入口的机械反馈检查；Oil UI 的方法进规划，验证有效后再做多方向挑选

## Not yet specified

- T-128 之后的新路线批次（等第一批做完再切票）：风格卡与 skill 库（taste-skill / Impeccable 提炼、4 个样子改写成风格）；模板味检测（Impeccable 检测规则）；预览批注点改与快捷按钮；用户满意后生成英文版；Hairline 式线稿示意图；
- 生成用模型：先用 deepseek-flash；评估集显示到顶时再由负责人决定是否换。

## Out of scope

- [T-134](tickets/T-134-screenshot-polish.md) 截图打磨：成对 2/4 持平、用量约 2 倍，不合并（2026-10-09）
- [T-138](tickets/T-138-cut-deepseek-tokens.md) 单站降三分之一不可达：写页关思考盲评 2/2 变差、事实校对关思考 6/6 漏拦；已合并 repair 非思考与快速档，T-142 后快速档单站 91k（-10%）（2026-10-09）
- [T-135](tickets/T-135-reference-skeletons.md) 骨架卡已合并可用；8 组合整轮验收按 T-143 与预算不再跑，快速档用到 2–3 种骨架（2026-10-09）
- [T-132](tickets/T-132-core-spec-good-css.md) 只改规范文字（good-css + 生成感引导）：三种盲评无可测改善，不合并（2026-10-08）
- 公网部署、临时隧道、实机测试：本阶段只做内部 Demo，浏览器设备模式就够了。
- 修本机网络、Docker Registry、外部邮箱送达、生产数据库运维：不影响页面质量。
- 真实客户试点、整体合并 `hlanan886/sitecraft-ai#4`：本阶段只做内部验证。
- 自动清理数据：见 T-003。

## Living docs

| Doc | Covers | Verified |
| --- | --- | --- |
| [AGENTS.md](../AGENTS.md) | `package.json`, `lib/code-site*.ts`, `app/api/**` | 94b64bf |
| [CONTEXT.md](../CONTEXT.md) | `lib/alignment.ts`, `lib/code-site*.ts`, `lib/annotations.ts` | 94b64bf |
| [README.md](../README.md) | `package.json`, `docker-compose.yml`, `deploy/**`, `lib/code-site-store.ts`, `scripts/import-legacy-site-code.ts` | 94b64bf |
| [docs/project/intent.md](../docs/project/intent.md) | `.project-map/tickets/T-127-*.md`, `.project-map/tickets/T-141-*.md`, `.project-map/tickets/T-145-*.md` | c31f76c |
| [docs/project/mainline.md](../docs/project/mainline.md) | `lib/code-site*.ts`, `skills/site-code-*/SKILL.md`, `skills/site-code-core/SKELETONS.md`, `scripts/import-legacy-site-code.ts` | 94b64bf |
| [docs/project/spec.md](../docs/project/spec.md) | `lib/alignment.ts`, `lib/conversation-store.ts`, `app/(workspace)/**`, `app/api/**`, `lib/code-site*.ts`, `scripts/import-legacy-site-code.ts` | 94b64bf |
| [docs/project/error-catalog.md](../docs/project/error-catalog.md) | `lib/user-errors.ts` | 00a083e |
