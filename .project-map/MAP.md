# Project map

## Destination

工程工业样板经独立盲评通过；新建站点走需求对齐的多题卡片，在第 1 轮选样子和色彩集；工作台按方向 B 改版（含手机逐题抽屉、深浅主题）；中英文一起生成。完成标志是 T-016 至 T-032 全部关闭，并且 2026-09-28 浏览器实操验收发现的缺口（T-034 至 T-042）全部关闭。需求见 [intent.md](../docs/project/intent.md)，规格见 [spec.md](../docs/project/spec.md)，术语见 [CONTEXT.md](../CONTEXT.md)。

## Notes

- 规则以 [AGENTS.md](../AGENTS.md) 为准：优先级、生成路径的硬约束、本阶段不做的事、验收、Git。
- 下一步做什么只看 frontier：`python3 ~/.claude/skills/project-map/scripts/project_map.py status --root .`（脚本在 project-map skill 里）。开工前在票的 `claimed_by` 写上自己的名字；一次只做一张 build 票。
- 分工（[T-033](tickets/T-033-roles-after-claude.md)，取代 T-013）：负责人只定方向和需求，不做盲评和审核。Kiro 做规划与执行，并负责整合、提交和推送；Cursor 的两个 Grok agent 可分担执行；不同 harness 互相验收；前端盲评交给 Codex（Astra）；Claude Code 不排工。
- 现状（2026-09-28）：主链能走通。新建站点从模板页的四个样子背后模板进入（T-036、T-044），默认开启需求对齐，第 1 轮固定问样子和目录色彩集（T-034）；资料 → 对齐 → 确认 → `commitOperations` → 预览 → 修改/撤销 → 发布页 → 询盘都在浏览器里实测过。四个视觉族各有首页 overlay 和 6 套色彩集色板。2026-09-28 Codex 盲评 8 个样本（两份模拟资料 × 四个样子）2 PASS 6 NO_GO，主要问题是访客页的缺口说明和元话术（T-045）、首屏孤字和手机公司名截断（T-046），另指出同一样子换公司资料后品牌差异不明显（未定，见 Not yet specified）。之前逐轮的记录见 [plan-history.md](../docs/project/plan-history.md) 和 [review-2026-09-24.md](../docs/project/review-2026-09-24.md)，只供追溯。
- 查看生成站用 Chrome（[T-011](tickets/T-011-review-browser.md)）。移动端用浏览器的 375 / 768 / 1440 验收。
- 前端工作叠加这两个 skill：`skills/frontend-less-ai-tone/`、`skills/sitecraft-frontend-less-ai-tone/`。

## Decisions so far

- [T-001 生成路径怎么组页](tickets/T-001-generation-path.md)：样子 → 同族模块 → 整页；一个预览引擎；模型不写 HTML/CSS；草稿只走 `commitOperations`
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
- [T-033 2026-09-28 起谁做什么](tickets/T-033-roles-after-claude.md)：Kiro 规划执行，Grok 分担执行，跨 harness 互相验收，Codex 盲评，Claude Code 不排工
- [T-014 工程工业样板怎么做](tickets/T-014-sample-prototype-first.md)：先出两个方向的原型，盲评选一个，再实现
- [T-015 调研真实工业企业官网的版式](tickets/T-015-real-industrial-site-research.md)：首页是实拍加产品族入口，参数收在范围或选型工具里；没有照片就做不了现场图和证书墙
- [T-017 工程工业样板两个方向的原型](tickets/T-017-engineering-sample-prototypes.md)：盲评选「样本册」（白底产品族卡片、关键参数在卡上、完整参数收起），借用首屏规格条和独立询盘底
- [T-029 其余三个样子是否现在按工程工业样板改](tickets/T-029-push-sample-to-other-looks.md)：要，每个样子一张票，借结构不借外观

## Not yet specified

- 新开源素材的准入：需要先定准入流程和第一批候选。
- 子页面的同族 overlay、`fresh` kit。
- 按资料多少选择不同的区块变体。
- 生成站动效、改标题（评审 P0-5、P0-6）。
- 同一个样子里，不同公司怎么拉开品牌差异（2026-09-28 盲评：四对样本版式和颜色近乎复用）。
- 按现在的生成路径要不要重跑 12 组对照（intent §4；上次 2026-09-18 负责人盲评不过之后没有重跑）。

## Out of scope

- 公网部署、临时隧道、实机测试：本阶段只做内部 Demo，浏览器设备模式就够了。
- 修本机网络、Docker Registry、外部邮箱送达、生产数据库运维：不影响页面质量。
- 真实客户试点、整体合并 `hlanan886/sitecraft-ai#4`：本阶段只做内部验证。
- 模型直接写 HTML/CSS、跨视觉族拼接、第二套渲染器、本阶段原生 React 拼装：见 T-001。
- 自动清理数据：见 T-003。

## Living docs

| Doc | Covers | Verified |
| --- | --- | --- |
| [AGENTS.md](../AGENTS.md) | `package.json`, `scripts/check-published.mjs` | bd85882 |
| [CONTEXT.md](../CONTEXT.md) | `lib/site-document.ts`, `lib/site-operations.ts`, `lib/alignment.ts`, `lib/template-adapters/types.ts` | d0a49fd |
| [README.md](../README.md) | `package.json`, `docker-compose.yml`, `deploy/**` | |
| [docs/project/intent.md](../docs/project/intent.md) | `.project-map/tickets/T-00[1-9]-*.md`, `.project-map/tickets/T-01[0-4]-*.md` | |
| [docs/project/mainline.md](../docs/project/mainline.md) | `lib/template-adapters/types.ts`, `lib/template-adapters/registry.ts`, `lib/frontend-tone.ts` | b565bc5 |
| [docs/project/spec.md](../docs/project/spec.md) | `lib/alignment.ts`, `lib/site-document.ts`, `lib/site-operations.ts`, `app/workspace/**`, `app/api/**` | f6c19a5 |
| [docs/project/error-catalog.md](../docs/project/error-catalog.md) | `lib/user-errors.ts` | |
