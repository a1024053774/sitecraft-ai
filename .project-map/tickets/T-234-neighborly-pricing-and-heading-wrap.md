---
id: T-234
title: 邻里日常价目直出、展示标题防单字换行与暗房首屏实拍配方收紧（零模型调用）
type: build
status: closed
blocked_by: []
claimed_by: Antigravity
supersedes:
---

## What to build

在不触发任何真实模型重跑（零模型 token）的前提下，沉淀第二阶段三项真实生成观察与根因，并在不改动提交入口检查器与硬约束的前提下收紧对应生成配方与核心规范：

1. **留档 `restaurant/neighborly`（`e576238b`）相对 `T-190` 基线（`2c11a272`）质量差异的根因**：
   - `e576238b` 运行记录为 `attemptsCount: 1`、`modelCalls: ['plan', 'write', 'facts']`、`0` 次底线修正、`0` 次事实核对拒收；首页主动省略了招牌菜明码价格（如 `32元/份`、`38元/份`），菜单页也省略了主食配米饭等共用规则的汇总表。该问题属于 `plan`+`write` 阶段的展示组织取舍，而非事实核对误拒。本票不重跑 `restaurant/neighborly`。
2. **收紧 `skills/site-code-neighborly/SKILL.md`**：
   - 明确要求：首页精选推荐的菜品、课程或服务条目旁必须直接写出对应资料中的明确价格、供餐/服务时段与关键适用条件，不得延后到二级页再补价目；当菜单或价目资料存在共用包含/加配边界（如套餐含主食/米饭、包材或服务不包含项）时，在菜单或价目页用清晰汇总表或结构化提示区集中呈现。
3. **收紧 `skills/site-code-core/SKILL.md`**：
   - 针对 `design/neighborly`（`c371d85d`）大号展示标题无 `text-wrap: balance` 导致末尾「构」字单字孤立换行的问题，明确要求中文展示标题（`h1`、`h2` 及首屏展示型 `<span>` 标题行）配合 `text-wrap: balance`（副标题用 `pretty`）并控制 `clamp()` 与容器测宽，避免尾行只剩 1 个汉字孤立成行。
4. **收紧 `skills/site-code-darkroom/SKILL.md`**：
   - 明确有授权实拍图时，首页暗底开场优先将实拍照片干净嵌入暗面首屏舞台并与主标题/关键指标并置，无图首屏（纯超大标题与等宽关键指标）仅保留给确无授权实拍图的站点。
5. **同步活文档与配方合同测试**：
   - 在修改任何 `skills/` 或 `docs/` 文件前先在 [tests/t227-style-recipes.test.ts](../../tests/t227-style-recipes.test.ts) 增加合同断言并捕获红灯日志（`artifacts/t234/red-recipes.log`），随后同步更新 `skills/` 与 [mainline.md](../../docs/project/mainline.md)。

## Acceptance

- [x] 已在修改 `skills/` 与 `docs/project/mainline.md` 前于 `tests/t227-style-recipes.test.ts` 增加 `T-234` 合同断言并保存红灯失败日志（`artifacts/t234/red-recipes.log`）
- [x] 已于本票留档 `restaurant/neighborly`（`e576238b`）相对 `T-190` 基线（`2c11a272`）零修补/零事实拒收的根因分析（不重跑 `restaurant/neighborly`）
- [x] `skills/site-code-neighborly/SKILL.md`、`skills/site-code-core/SKILL.md`、`skills/site-code-darkroom/SKILL.md` 与 `docs/project/mainline.md` 已按上述合同精确更新，零改动生成检查器与提交入口
- [x] `npm run typecheck`、`tests/t227-style-recipes.test.ts` 与 `tests/t153-style-preferences.test.ts`、`design_integrity.py` 及独立 Antigravity `claude-sonnet-4-6` 只读审查全部通过（零模型生成 token）

## Resolution

- **修改摘要（0 新增生成模型 token）**：
  - [skills/site-code-core/SKILL.md](../../skills/site-code-core/SKILL.md)：要求中文展示标题（`h1`、`h2` 与首屏大字展示 `<span>` 标题行）配合 `text-wrap: balance`（副标题可用 `pretty`）并控制 `clamp()` 尺度与容器测宽，避免尾行只剩 1 个汉字孤立成行（对应 `design/neighborly` `c371d85d` 尾行单字折行现象）。
  - [skills/site-code-neighborly/SKILL.md](../../skills/site-code-neighborly/SKILL.md)：要求首页精选推荐菜品/课程/服务条目旁直接写出对应价格、时段与关键适用条件（不得延后到二级页再补），菜单/价目页对共用包含或加配边界（如米饭/包材）提供清晰汇总表或结构化提示区；已留档 `restaurant/neighborly`（siteId `e576238b-7349-4e1b-8cbf-6e3f5f0a449c`）`attemptsCount: 1`、`modelCalls: ['plan', 'write', 'facts']`、`0` 次底线修正、`0` 次事实拒收的根因（未重跑）。
  - [skills/site-code-darkroom/SKILL.md](../../skills/site-code-darkroom/SKILL.md)：明确有授权实拍图时首页暗底开场优先将实拍照片嵌入暗面首屏舞台并与主标题/指标并置，无图首屏只留给无图站点。
  - [docs/project/mainline.md](../../docs/project/mainline.md) 与 [tests/t227-style-recipes.test.ts](../../tests/t227-style-recipes.test.ts)：同步活文档与配方合同校验，未改动 `lib/`、`scripts/` 或提交入口检查器。
- **验证证据**：
  - 修改前红灯：`artifacts/t234/red-recipes.log`（`RED_EXIT=1`，6/7 已有测试通过、新增 `T-234` 测试失败）。
  - 离线校验：`npm run typecheck` 通过（`artifacts/t234/typecheck.log`）；`scripts/run-tests.ts` 运行 `tests/t227-style-recipes.test.ts` 与 `tests/t153-style-preferences.test.ts` 12/12 全部通过（0 失败，`artifacts/t234/green-tests.log`）；`design_integrity.py --cwd . --format json` 无发现（`artifacts/t234/design-integrity.json`）。
- **独立只读审查**：Antigravity `claude-sonnet-4-6`（`--mode plan`，会话 `a4dfac69-81d2-4cc0-8ccd-c95517fc6633`，`artifacts/t234/claude-review.txt`）结论 **PASS**（0 缺陷）。
