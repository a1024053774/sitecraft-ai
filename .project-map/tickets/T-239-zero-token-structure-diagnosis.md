---
id: T-239
title: 零 token 真实生成站区块与大纲序列同质化诊断及可重跑脚本
type: build
status: closed
blocked_by: [T-238]
claimed_by: Antigravity
supersedes:
---

## What to build

在不调用任何模型的前提下，新增可重复运行的结构诊断脚本 `scripts/diagnose-site-structure.ts`（含单元测试 `tests/t239-diagnose-site-structure.test.ts`），对主工作区 `.sitecraft-data/code-sites/` 中全部真实生成站点（覆盖 `ready` 与 `pending` 全部 7 种风格及 T-190、T-226、T-235、T-238 等各轮次）执行解析与量化对比，输出可复现的 JSON 与中文诊断报告：

1. **HTML 区块序列抽取（逐站逐页）**：
   - 解析真实生成站（排除无版本、旧站离线转换 `legacy-import` 及本地替身 `fixture`）的每页 HTML 与配套 CSS；
   - 抽取每个顶层内容区块的：区块语义类型（如 `hero`、`catalog`、`process`、`cases`、`facility`、`timeline`、`updates`、`faq`、`terms`、`contact` 等）、桌面栅格栏数（`1`、`2`、`3`、`4+`）、图文/主次左右位置（如 `single`、`text-left-media-right`、`media-left-text-right`、`title-left-content-right`、`multi-col`）、是否含年份沿革（`hasTimeline`）、是否含日期动态（`hasUpdates`）。
2. **Plan 大纲序列抽取（逐站逐页）**：
   - 从每站 `plan` 记录抽取 `skeleton.id`、`skeletonOrder` 及每页 `outline` 分句序列，将每条大纲分句映射到同一套语义区块标签，计算同站「`plan` 大纲序列 vs `write` HTML 区块序列」的一致率与偏移点。
3. **三项核心问题给出客观数据结论**：
   - 跨公司、跨风格的首页及全站区块序列相似度矩阵（含 T-190 投入品牌/沿革/动态新资料前后的分期对比，以及 T-226/T-235/T-238 新批次对比）；
   - 判定跨公司同构究竟在 **`plan` 阶段就已经形成**（大纲序列本来就高度雷同），还是到 **`write` 阶段才出现**（大纲不同但写出来一样）；
   - 逐文件逐句审查 `skills/site-code-core/SKILL.md`、`skills/site-code-core/SKELETONS.md`、`skills/frontend-less-ai-tone/SKILL.md`、`lib/code-site-model.ts`（`planSiteCode` / `writeSiteCode` 提示词）以及输入侧对照 `lib/simulated-packs.ts`，列出客观上规定或诱导该顺序的具体原句与精确行号位置。

## Acceptance

- [x] 新增零 token 可重复运行脚本 `scripts/diagnose-site-structure.ts` 与单元测试 `tests/t239-diagnose-site-structure.test.ts`（先红后绿验证区块类型、栏数、左右位置、年表/动态识别与相似度计算）
- [x] 对 `.sitecraft-data/code-sites/` 全部真实生成站（含 `ready` 与 `pending` 风格及 T-190/T-226/T-235/T-238 各轮）产出完整数据与诊断报告（`artifacts/t239/structure-diagnosis.json`、`artifacts/t239/structure-diagnosis.md`），明确给出跨公司/跨风格相似度矩阵、`plan` vs `write` 形成阶段判定，以及逐句原文与行号定位
- [x] `npm run typecheck`、新增及关联测试、`design_integrity.py`、`project_map.py status --root .` 及独立 `claude-sonnet-4-6` 只读审查全部通过

## Resolution

- **完成时间**：2026-11-26 05:20 EST（零模型 token）
- **新增脚本与红绿测试**：
  - `scripts/diagnose-site-structure.ts`：使用已有依赖 `parse5` 与 `postcss`（0 新增依赖），扫描 `.sitecraft-data/code-sites/` 共 `390` 个记录（排除无版本 `239`、旧站离线转换 `13`、本地替身/手工夹具 `20`），纳入全部 **`118` 个真实模型生成站**（`pre-t190: 82`、`t190-deepseek: 22`、`t222-tea: 3`、`t226-t238-gpt: 11`，覆盖全部 7 种风格）。
  - `tests/t239-diagnose-site-structure.test.ts`：先红（`artifacts/t239/red-test.log`，`RED_EXIT=1`）后绿（`artifacts/t239/green-tests.log`，`4/4` 通过），验证桌面栏数（忽略窄屏 `max-width` 媒体查询）、图文与标题左右位置、复合首屏拆解、`plan` 分句抽取与阶段相似度归因。
- **三项核心诊断结论（详见 `artifacts/t239/structure-diagnosis.md` 与 `structure-diagnosis.json`）**：
  1. **跨公司、跨风格区块序列相似度矩阵**：在 `T-226～T-238`（`gpt-6.2-sol`）批次中，同风格跨公司与跨风格之间的首页区块语义类型相似度均处于 **`66.7%–80.0%`** 高位带（`craftposter×craftposter 80.0%`、`craftposter×darkroom 78.9%`、`darkroom×darkroom 71.1%`、`darkroom×indexgrid 70.4%`、`indexgrid×indexgrid 66.7%`）；换风格改变了配色、字重与框线，未改变整页区块序列主轴。
  2. **`plan` 阶段 vs `write` 阶段形成判定**：**宏观区块选择与顺序在 `plan` 阶段即已形成，`write` 阶段进一步把局部栅格几何收敛为同一套双栏/四列排法**。`T-226～T-238` 全部 `11` 站的单站内部 `plan↔HTML` 序列平均一致度达 **`80.2%`**，跨公司 `plan` 序列相似度已达 **`64.9%`**（`write` HTML 为 `64.0%`）：`8/11`（`72.7%`）在 `plan` 阶段即排成 `hero → catalog` 开场，`9/11`（`81.8%`）在 `plan` 阶段即把 `timeline → updates` 锁在首页末尾（HTML 中 `10/11 = 90.9%` 同时将沿革与动态放在首页）。同时在 `write` 阶段，模型看见资料中的品牌标识描述后把原本 `plan` 写「通栏」的首屏画成 `2:text-left-media-right`（如 `darkroom` 双站），并把沿革固定排成 4 列网格、动态与内文区块重复套用 `.split`（`2:title-left-content-right`）。
  3. **客观规定/诱导该顺序的逐句定位（共 13 处经程序逐字核验）**：核心根因在**所有风格共用的公共层**——`skills/site-code-core/SKELETONS.md:5`（显式写明骨架决定首屏、业务入口与区块顺序，风格只管尺寸、颜色和字阶）、`SKELETONS.md:6,9,22,23,34,35`（排除条件把 `11/11` 站点挤压进 `capability-led` `7` 站与 `application-paths` `4` 站，`118` 站中 `custom=0`，且两张卡均规定「定位首屏 + 紧接业务/场景目录带 → 能力/过程」）、`lib/code-site-model.ts:44,196,220,221`（将 `SKELETONS.md` 置于风格 skill 之前、固定 1–6 句等量分句槽位），并与 `lib/simulated-packs.ts`（T-190 统一加入品牌图形描述、4 条沿革、3 条模拟动态及末尾 `栏目线索`）产生共振。
- **验证与独立审查**：`npm run typecheck`（`artifacts/t239/typecheck.log`）零错误，`tests/t239-diagnose-site-structure.test.ts` `4/4` 全绿（`artifacts/t239/green-tests.log`），`design_integrity.py` `findings: []`（`artifacts/t239/design-integrity.json`），独立只读审查会话 `26ad2dff-05d5-40cc-b87b-24df882bac41`（`claude-sonnet-4-6`，`artifacts/t239/claude-review.txt`）结论 `Verdict: PASS`。
