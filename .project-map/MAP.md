# Project map

## Destination

工程工业样板经独立盲评通过；新建站点走需求对齐的多题卡片，在第 1 轮选样子和色彩集；工作台按方向 B 改版（含手机逐题抽屉、深浅主题）；中英文一起生成。完成标志是 T-016 至 T-032 全部关闭，并且 2026-09-28 浏览器实操验收发现的缺口（T-034 至 T-042）全部关闭。2026-09-29 起加上：四个样子迁到区块库 + 站点样式并经盲评通过（T-048），工作台交互照原型 B 改齐（T-052）。需求见 [intent.md](../docs/project/intent.md)，规格见 [spec.md](../docs/project/spec.md)，术语见 [CONTEXT.md](../CONTEXT.md)。

## Notes

- 规则以 [AGENTS.md](../AGENTS.md) 为准：优先级、生成路径的硬约束、本阶段不做的事、验收、Git。
- 下一步做什么只看 frontier：`python3 ~/.claude/skills/project-map/scripts/project_map.py status --root .`（脚本在 project-map skill 里）。开工前在票的 `claimed_by` 写上自己的名字；一次只做一张 build 票。
- 分工（[T-049](tickets/T-049-roles-2026-09-29.md)，取代 T-033）：负责人只定方向和需求。Claude 规划、验收、整合推送；Codex（`codex-build` 等）和 Sonnet 5.5 子 agent 执行（Kiro 2026-10-01 起不再使用）；Codex Astra 审代码；Codex gpt-6.1-sol 盲评；Grok 做杂活；云端会话在 `cloud/*` 分支做票。
- 现状（2026-10-01）：工程工业已迁到 SiteCraft 区块库（T-053）：首屏、产品、询盘可按资料换布局（大标题加参数条、按类别分组、参数对比表、联系条），模型按资料选、条件不够时拒绝并说明；盲评总体明显好于旧 overlay。工作台按原型 B 改版（T-052）。DeepSeek 推理预算和截断提示已修（T-061、T-058）。站点样式已做（T-054）：只在用户提外观要求时写，白名单加三档检查；整站生成不写样式（两轮盲评：自动套方向不如不套）。四个生产样子均已迁到区块库并删掉旧 overlay；产品参数值中英双语（T-060），工程工业长标题和公司名按长度缩字号（T-063），草稿区块顺序（T-062）已接入四个样子，只在用户明说时调整。2026-10-02 负责人定：放开版式自由度之前，先量当前生成页的绝对质量和现有区块库的上限（[T-064](tickets/T-064-quality-baseline-before-freedom.md)，T-065 至 T-068），再修寻址和摘要（T-069、T-070）。T-068 两轮评分评审编造内容、结论互相矛盾，负责人决定不再评（[T-071](tickets/T-071-recommend-per-company-and-block-pool.md)）：样子和色彩集按公司资料推荐（T-072），区块库由 Sonnet 5.5 批量做布局、每个过 AI 味审查后进库（T-073 起）。之前逐轮的记录见 [plan-history.md](../docs/project/plan-history.md)，只供追溯。
- 查看生成站用 Chrome（[T-011](tickets/T-011-review-browser.md)）。移动端用浏览器的 375 / 768 / 1440 验收。
- 前端工作叠加这两个 skill：`skills/frontend-less-ai-tone/`、`skills/sitecraft-frontend-less-ai-tone/`。

## Decisions so far

- [T-001 生成路径怎么组页](tickets/T-001-generation-path.md)：样子 → 同族模块 → 整页；一个预览引擎；草稿只走 `commitOperations`（「模型不写 CSS」和「一个样子一份 overlay」被 T-048 取代）
- [T-002 页面怎么规划](tickets/T-002-page-planning.md)：用户点名的页面 > 模型按业务规划 > 首页/产品服务/联系；三页不是上限
- [T-003 数据由谁删除](tickets/T-003-data-deletion.md)：只有用户明确选择才删除，不自动清理
- [T-004 需求对齐何时开启、一张卡问几题](tickets/T-004-alignment-default-and-shape.md)：新建站点默认开启；一张卡 1–4 题，一次提交，最多 3 轮
- [T-005 配色怎么给用户选](tickets/T-005-color-sets.md)：6 套色彩集 × 4 个样子的色板，另支持自定义品牌色
- [T-006 行业和样子怎么对应](tickets/T-006-industry-look-recommendation.md)：按行业标推荐和理由，不限制可选范围
- [T-007 生成站视觉从哪里改起](tickets/T-007-visual-sample-first.md)：先用工程工业做样板，重做现有 overlay，再推开；新素材准入在后
- [T-008 工作台怎么布局、用什么主题](tickets/T-008-workspace-layout-theme.md)：方向 B；手机逐题底部抽屉；深浅主题和强调色
- [T-009 中英文怎么生成，缺的内容怎么显示](tickets/T-009-bilingual-and-gaps.md)：`{zh, en}` 一起写；`To be provided`；缺口规则
- [T-010 模拟资料包要多厚，照片用什么许可](tickets/T-010-simulated-pack-thickening.md)：加厚并标为模拟；CC0/公有领域/CC-BY/CC-BY-SA，内容必须对得上
- [T-011 生成站用什么浏览器看](tickets/T-011-review-browser.md)：用 Chrome；预览被拦截时报错并提示
- [T-012 待办以哪里为准](tickets/T-012-todo-source.md)：project-map 取代 plan.md
- [T-013 谁做什么，谁来审核](tickets/T-013-roles-and-review.md)：Claude 做界面，Astra 做逻辑，Grok 做审核和调研；负责人不做审核（已被 T-033 取代）
- [T-033 2026-09-28 起谁做什么](tickets/T-033-roles-after-claude.md)：Kiro 规划执行，Grok 分担执行，跨 harness 互相验收，Codex 盲评，Claude Code 不排工（已被 T-049 取代）
- [T-014 工程工业样板怎么做](tickets/T-014-sample-prototype-first.md)：先出两个方向的原型，盲评选一个，再实现
- [T-015 调研真实工业企业官网的版式](tickets/T-015-real-industrial-site-research.md)：首页是实拍加产品族入口，参数收在范围或选型工具里；没有照片就做不了现场图和证书墙
- [T-017 工程工业样板两个方向的原型](tickets/T-017-engineering-sample-prototypes.md)：盲评选「样本册」（白底产品族卡片、关键参数在卡上、完整参数收起），借用首屏规格条和独立询盘底
- [T-029 其余三个样子是否现在按工程工业样板改](tickets/T-029-push-sample-to-other-looks.md)：要，每个样子一张票，借结构不借外观
- [T-048 生成站怎么摆脱 4 个固定版式](tickets/T-048-generation-direction-block-library-css.md)：自有区块库 + 设计 token + 模型写受限站点样式（不写 HTML 和文字）；工程工业先迁，其余逐个迁，旧 overlay 盲评通过后删
- [T-051 区块素材与 CSS 校验调研](tickets/T-051-block-material-and-css-guard-research.md)：结构参考 HyperUI、Meraki UI；站点样式走做法 A（结构化规则，不加依赖）；Preline 不用；第一版不用图标
- [T-064 放开自由度之前先量什么](tickets/T-064-quality-baseline-before-freedom.md)：先做绝对质量基线和专家对照，按事先写好的规则判读；不按数量扩布局；撤销要能挑着撤；批注契约等评分后写 spec
- [T-071 评分之后怎么走](tickets/T-071-recommend-per-company-and-block-pool.md)：不再加评分轮次；推荐随公司变；区块布局批量做，每个过 AI 味审查（只看单区块裁切图）才进库；需要新字段的内容区块另写 spec
- [T-078 草稿加新字段](tickets/T-078-new-draft-fields-for-content-blocks.md)：先做商业条款、设备（带数量），结构化字段、模型只按资料抽取、事实检查覆盖；质检流程和沿革第二批
- [T-082 英文页事实核对到什么程度](tickets/T-082-english-fact-fidelity.md)：只做数字 / 代码 / 单位的机械检查，专有名词是否译对记为已知限制
- [T-049 2026-09-29 起谁做什么](tickets/T-049-roles-2026-09-29.md)：Claude 规划验收，Codex/Sonnet 执行（Kiro 已停用），Astra 审代码，gpt-6.1-sol 盲评，Grok 杂活，云端做 T-050–T-052

## Not yet specified

- 新开源素材的准入：需要先定准入流程和第一批候选。
- 子页面的同族 overlay、`fresh` kit。
- 英文页专有名词（地名、公司名、产品名）的中英对照：T-082 记为已知限制，等英文页成为验收重点时再定。
- 生成站动效、改标题（评审 P0-5、P0-6）。
- 圈画批注的契约：内容身份与显示位置、批注同时记「当时看到什么」和「现在指向哪里」、锚点失效状态、圈画命中关系、批注 / 修改事务 / 挑着撤的关系（T-064；等 T-068 之后写 spec，不先做界面）。

## Out of scope

- 公网部署、临时隧道、实机测试：本阶段只做内部 Demo，浏览器设备模式就够了。
- 修本机网络、Docker Registry、外部邮箱送达、生产数据库运维：不影响页面质量。
- 真实客户试点、整体合并 `hlanan886/sitecraft-ai#4`：本阶段只做内部验证。
- 模型写 HTML 或文字、不受限的 CSS、未经移植的外部区块直接拼进页面、第二套渲染器、本阶段原生 React 拼装：见 T-001、T-048。
- 自动清理数据：见 T-003。

## Living docs

| Doc | Covers | Verified |
| --- | --- | --- |
| [AGENTS.md](../AGENTS.md) | `package.json`, `scripts/check-published.mjs`, block-library preview path | 04ae4df |
| [CONTEXT.md](../CONTEXT.md) | `lib/site-document.ts`, `lib/site-operations.ts`, `lib/alignment.ts`, `lib/template-adapters/types.ts`, block-library preview path | bf05c40 |
| [README.md](../README.md) | `package.json`, `docker-compose.yml`, `deploy/**` | |
| [docs/project/intent.md](../docs/project/intent.md) | `.project-map/tickets/T-00[1-9]-*.md`, `.project-map/tickets/T-01[0-4]-*.md` | |
| [docs/project/mainline.md](../docs/project/mainline.md) | `lib/template-adapters/types.ts`, `lib/template-adapters/registry.ts`, `lib/frontend-tone.ts`, block-library preview path | bf05c40 |
| [docs/project/spec.md](../docs/project/spec.md) | `lib/alignment.ts`, `lib/site-document.ts`, `lib/site-operations.ts`, `app/workspace/**`, `app/api/**`, `tests/helpers/workspace-browser.ts`, block-library preview path | bf05c40 |
| [docs/project/error-catalog.md](../docs/project/error-catalog.md) | `lib/user-errors.ts` | 00a083e |
