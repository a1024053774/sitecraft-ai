---
id: T-244
title: 新增 4 份不同体裁、无栏目线索的多样化虚构资料包并接入 eval --only
type: build
status: closed
blocked_by: [T-242]
claimed_by: Antigravity
supersedes:
---

## What to build

按 [T-242](T-242-style-compositions-and-diverse-packs-direction.md) 第 2 项决定，在保持现有 7 套 `T-190` 模拟资料包（`lib/simulated-packs.ts`）及默认 14 组合评估基线一字不改的前提下，新增 4 份体裁明显不同、行业不重复且不含「栏目线索」顺序暗示字段的虚构资料包：

1. **新增 `lib/diverse-packs.ts`（4 种体裁 × 4 个新行业，零「栏目线索」）**：
   - `luthiery`（**口述式大段文字** `oral-narrative`）：弦乐器修复与手工提琴工坊（`松风提琴修复工坊`），两段连贯口述自然长文，无键值冒号列表、无「沿革/FAQ/模拟动态/栏目线索」；
   - `vetclinic`（**零散的要点笔记** `scattered-notes`）：社区伴侣动物内科与牙科诊所（`白桦林宠物内科诊所`），备忘录式短横线零散笔记，接诊时段、术前条件、收费与缺口穿插记录，无章节编排或「栏目线索」；
   - `metrology`（**旧官网复制正文** `legacy-web-copy`）：第三方温湿度与压力计量校准实验室（`衡准计量校准实验室`），带旧站面包屑残行与平铺说明段、纯文本量程行及送检窗口说明，无「栏目线索」；
   - `acoustic`（**一页宣传册式文案** `brochure-copy`）：小型声学空间与排练房隔音构造社（`静界声学构造社`），三折页宣传单短章文案，交代构造做法、勘测抵扣条件与施工边界，无「栏目线索」。
   - 每份均保留显式 `资料性质：模拟` 声明、可由 `T-210` 提取的唯一主体名称、`*.luckye.online` 模拟邮箱、贴条目的限定条件与显式 `待补充` 缺口，不写未证实夸大宣传词，总长远低于 `MATERIALS_CHAT_LIMIT`（`4000`）。
2. **按需接入 `scripts/eval-new-route.ts`（仅 `--only` 模式）与 `scripts/eval-set-report.ts`**：
   - 默认不带 `--only` 运行 `eval-new-route.ts` 时仍仅遍历既有 7 套 `simulatedPacks`（14 组合不变）；当 `--only` 显式指定 `<diversePackId>/<style>` 时可加载对应多样化资料包（无图包按既有无图规则运行，附公开官网对照供 `controls` 使用），并在 `requireWholeSitePlan` 核对所点名页面数；同步更新 `docs/project/spec.md`。
3. **红绿测试验证**：
   - 新增 `tests/t244-diverse-packs.test.ts`（先红后绿），验证：① `lib/simulated-packs.ts` 7 套基线与默认 14 组合 `eval-new-route.ts --prepare-only` 完全不变；② 4 套新资料包行业不重复、体裁结构互异（连贯口述段、短横线要点、旧网页面包屑平铺正文、宣传折页章）、**零「栏目线索」**、主体名可被 `siteSubject` 唯一提取、满足长度与模拟标识约束；③ `eval-new-route.ts --prepare-only --only luthiery/darkroom,vetclinic/neighborly` 正常生成评估轮次与盲评包。

## Acceptance

- [x] `lib/simulated-packs.ts` 零改动，既有 `tests/simulated-packs.test.ts`、`tests/t130-eval-set.test.ts`、`tests/t190-materials-contract.test.ts` 全部保持通过
- [x] 先写断言级红测 `tests/t244-diverse-packs.test.ts`（保存红测日志），覆盖 4 份新资料包的体裁差异、行业不重复、零「栏目线索」、`siteSubject` 主体提取与 `eval-new-route.ts --only` 接入
- [x] `lib/diverse-packs.ts`、`scripts/eval-new-route.ts`、`scripts/eval-set-report.ts` 与 `docs/project/spec.md` 同步完成，`npm run typecheck`、`design_integrity.py` 及独立 `claude-sonnet-4-6` 只读审查全部通过

## Resolution

已完成（2026-11-26 10:57 EST，零模型 token）：

1. **新增 4 份体裁与行业各异、无「栏目线索」的虚构资料包**（`lib/diverse-packs.ts`）：
   - `luthiery`（`松风提琴修复工坊`）：口述式连贯长段文字（`oral-narrative`），乐器手工修缮行业；
   - `vetclinic`（`白桦林宠物内科诊所`）：备忘录式零散短横线要点笔记（`scattered-notes`），社区伴侣动物内科与牙科；
   - `metrology`（`衡准计量校准实验室`）：旧官网复制粘贴平铺正文与纯文本量程行（`legacy-web-copy`），第三方计量校准；
   - `acoustic`（`静界声学构造社`）：三折页宣传册短章文案（`brochure-copy`），小型声学空间与排练房隔音改造。
   - 全部 4 份资料包均不含「栏目线索」或章节顺序提示，均带显式 `资料性质：模拟`、`siteSubject` 唯一可提取主体名、`*.luckye.online` 模拟邮箱、贴条目的限定条件与 `待补充` 缺口。
2. **评估入口隔离接入**：`lib/simulated-packs.ts` 零 diff；`scripts/eval-new-route.ts` 仅在显式指定 `--only` 时纳入 `diversePacks`，默认不带 `--only` 仍严格保持 14 个基线组合；`scripts/eval-set-report.ts` 的 `requireWholeSitePlan` 支持核对新包页数；`docs/project/spec.md` 已同步。
3. **验证与独立审查**：红测 `artifacts/t244/red-test.log` → 绿测 `artifacts/t244/green-tests.log` 与 `green-t244-typefixed.log`（`t244`、`simulated-packs`、`t130`、`t160`、`t190` 共 37 项测试全部通过）、`artifacts/t244/typecheck.log`（`0` 错误）、`artifacts/t244/design-integrity.json`（`findings: []`）；独立 `claude-sonnet-4-6` 只读审查会话 `d8e25459-cfc2-4384-9648-204498b4e29d`（`artifacts/t244/claude-review.txt`）结论 **`Verdict: PASS`**。
