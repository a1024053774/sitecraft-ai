---
id: T-240
title: 风格整页构图 tracer bullet（darkroom/neighborly）与 40 万预算四站评估盲评
type: build
status: closed
blocked_by: [T-239, T-242, T-244]
claimed_by: Antigravity
supersedes:
---

## What to build

按负责人决定 [T-242](T-242-style-compositions-and-diverse-packs-direction.md) 重做 `T-240`：去掉上一版在写页与核心规范里堆砌的「严禁左文右图 / 严禁同比例 `.split` / 严禁 4 等列年份横条」等负向禁令，改用正向的**风格整页构图**机制（以 `darkroom` 与 `neighborly` 作 tracer bullet，其余 `ready` 风格本轮不动），并在单一新账本（`SITECRAFT_TOKEN_LIMIT=400000`）下完成 4 站真实生成、客观结构指标统计与隔离 `claude-sonnet-4-6` `company` 盲评：

1. **调整公共层并建立风格「整页构图」共用机制（`lib/code-site.ts`、`lib/code-site-model.ts`、`skills/site-code-core/SKILL.md`、`skills/site-code-core/SKELETONS.md`、`scripts/diagnose-site-structure.ts`）**：
   - **移除负向版式禁令，保留三项有效解绑**：删除 `SKILL.md`、`SKELETONS.md` 与 `lib/code-site-model.ts` 中上一版新增的「严禁左文右图」「严禁同比例 `.split`」「严禁 4 等列年份横条」等禁令；保留 ① 风格配方排在 `SKELETONS.md` 之前加载、② 放宽骨架卡适用门槛、③ 说明资料中的「栏目线索」仅代表全站话题提示而非首页固定顺序；
   - **大纲阶段选择并记录风格整页构图（`CodePlan.composition`）**：`readStyleCompositionIds(style)` 从风格 `SKILL.md` 的 `## 整页构图` 章节读取该风格声明的 2–3 种整页构图编号；`submit_page_plan` 新增必填 `compositionId`（对已声明整页构图的风格用严格枚举约束，对本轮未改动的 `ready` 风格兼容 `style-native`）与 `compositionReason`，持久化在 `CodePlan.composition: { id, reason }`；`writeSiteCode` 正向指示按大纲选定的整页构图组织首屏立住方式、区块取舍、先后顺序、栏数与疏密节奏；
   - **扩展 `scripts/diagnose-site-structure.ts`**：抽取并统计每站 `plan.composition` 分布，支持 `--site-ids` 对本轮新生成站点单独计算跨公司区块序列相似度、骨架分布与构图分布。
2. **Tracer bullet 配方改造（仅改 `darkroom` 与 `neighborly`，其余 4 个 `ready` 风格零改动）**：
   - `skills/site-code-darkroom/SKILL.md`：新增 `## 整页构图` 三种互异结构——`darkroom-ledger-matrix`（暗台参数矩阵直入型）、`darkroom-rail-showcase`（左侧固定暗轨配右侧主次错落展柜型）、`darkroom-stage-dossier`（宽幅暗幕工艺/案例档案型）；
   - `skills/site-code-neighborly/SKILL.md`：新增 `## 整页构图` 三种互异结构——`neighborly-menu-board`（黑板双栏价目直出型）、`neighborly-errand-guide`（到访时段与办事指南先行型）、`neighborly-story-shelf`（铺面日常主次货架型）；
   - `precision`、`documentary`、`editorial`、`craftposter` 四个 `ready` 风格配方文件本轮一字不改。
3. **新账本 `SITECRAFT_TOKEN_LIMIT=400000` 四站真实运行、客观统计与隔离 `claude-sonnet-4-6` `company` 盲评**：
   - 运行 4 站（会超出 `400,000` 即停，停服前保存 `terminal-before-stop.json`）：`packaging/darkroom`（旧包 × `darkroom`）、`luthiery/darkroom`（新口述包 × `darkroom`）、`industrial/editorial`（旧包 × 未改动 `ready` 风格回归）、`vetclinic/neighborly`（新要点笔记包 × `neighborly`）；
   - 用 `diagnose-site-structure.ts --site-ids` 输出 4 个新站的客观数字：验证跨公司首页区块序列相似度明显低于基线 `64.0%`，且骨架卡/整页构图选用分布不再塌缩成两种；
   - 将匿名 `review/company` 包复制到 `$env:TEMP` 独立目录，由全新无项目绑定的 `claude-sonnet-4-6` 会话执行 `company` 盲评并通过宿主 `transcript.jsonl` 审计（`0` 越界、PNG 全读、每轮至多 1 个 sample ID）；按客观数字与盲评结果将 `darkroom` 升级为 `ready` 并同步活文档。

## Acceptance

- [x] 先写并跑红测 `tests/t240-plan-skeleton-dehomogenization.test.ts`（保存重做红测日志 `artifacts/t240/red-rework.log`），覆盖：无堆砌负向禁令、`darkroom`/`neighborly` 各含 3 种整页构图且其余 4 个 `ready` 风格未改动、`planSiteCode` 严格枚举并保存 `CodePlan.composition`、`diagnose-site-structure.ts` 可统计构图分布与子集相似度
- [x] 单一新账本 `SITECRAFT_TOKEN_LIMIT=400000` 内完成 `packaging/darkroom`、`luthiery/darkroom`、`industrial/editorial`、`vetclinic/neighborly` 四站真实生成（累计实耗 `332,727` 计费 token，停服前核验无在途请求 `terminal-before-stop.json`），确认未改动 `ready` 风格回归正常
- [x] 新生成 4 站经 `diagnose-site-structure.ts` 实测跨公司首页区块序列相似度降至 `43.9%`（`artifacts/t239` 11 站基线为 `64.0%`）、复合结构签名相似度降至 `11.7%`（11 站基线为 `19.8%`），骨架/构图分布为 3 类骨架 + 3 种不同构图；隔离 `claude-sonnet-4-6` 完成 `darkroom` 与 `neighborly` 两对 `company` 盲评（`0/2` 判同模板，`sameTemplate=false`）并通过宿主 `transcript.jsonl` 审计，`darkroom` 按 `craftposter` 标准升级为 `ready` 并同步活文档
- [x] `SITE_STORE=fs npm run build`（`.next` `835.6 MB <= 2GB`）、`npm run typecheck`、19 组定向回归测试、`design_integrity.py`、`project_map.py status --root .` 及独立 `claude-sonnet-5-5-high` 只读审查（`70db270c` → 修复复审 `02b93dd0` `Verdict: PASS`）全部通过

## Resolution

- **红绿验证与曳光弹边界（2026-11-26 EST）**：
  - 红测证据：`artifacts/t240/red-rework.log`（`T240_REWORK_RED_EXIT=1`，0/3 通过）；绿测证据：`artifacts/t240/rework-typecheck.log` 与 `artifacts/t240/rework-offline-tests.log`（13 个离线测试套件全部通过）。
  - 精确保持曳光弹范围：`git diff -- skills/site-code-{precision,documentary,editorial,craftposter}/SKILL.md` 为空；仅 `skills/site-code-darkroom/SKILL.md` 与 `skills/site-code-neighborly/SKILL.md` 新增 `## 整页构图`（各 3 种整页构图），`skills/site-code-core/SKILL.md`、`SKELETONS.md` 与 `lib/code-site-model.ts` 已去除负向版式禁令。
- **真实四站生成与预算执行（总上限 `400,000` token，实耗计费 `332,727` token）**：
  - 早期网络未通现场 `artifacts/t240/eval-3sites`（`0` token）与本轮首次尝试 `artifacts/t240/eval-4sites`（`industrial/editorial` `5a3d672d` 完成 `plan` `13,552` token 后，第 2 次 `write` 在 109.1s 遇瞬态 `fetch failed` 停止；同时发现 `vcahospitals.com` 对照站含懒加载未完成图片并更新为实测干净的 `bondvet.com`）均完整保留，停服前写入 `artifacts/t240/eval-4sites/terminal-before-stop.json`（`inFlightCalls: 0`）。
  - 扣除首轮计费及未返回调用保守余量后，以 `SITECRAFT_TOKEN_LIMIT=360000` 在 `artifacts/t240/eval-4sites-r2` 执行单次重跑：4 站 12 次上游调用（`gpt-6.2-sol`，`openai-responses`）全部 `HTTP 200` 且 **4 站全部零修补一次通过底线检查**，本账本实耗 `319,175` token（两账本合计计费 `332,727 <= 400,000` token），停服前核验无在途请求并保存 `artifacts/t240/eval-4sites-r2/terminal-before-stop.json`：
    1. `industrial/editorial`（未改动 `ready` 风格回归，站点 `7f8cbbfc-4146-4c3b-b37e-6f78a0de220d`，`v1`: `fd6a69ca-81d6-430c-bf6c-4c0d93b2bdc5`）：`109,075` token（`plan` 13,390 + `write` 21,246 + `facts` 74,439），`composition: null`，`skeleton: capability-led`；
    2. `packaging/darkroom`（旧包 × `darkroom`，站点 `c8cdbb5e-4aee-43e6-8fc0-5ab3cddf4c7b`，`v1`: `8589bae2-5d6f-43ac-8f1e-483b1519c4e5`）：`111,027` token（`plan` 14,496 + `write` 23,822 + `facts` 72,709），选定 `composition: darkroom-ledger-matrix`（标尺顶栏 + 通栏大字紧接三栏规格矩阵 + 七比五双栏打样与装载记录 + 单栏接单提醒，沿革与动态移入内页），`skeleton: product-atlas`；
    3. `luthiery/darkroom`（T-244 口述包 × `darkroom`，站点 `d48fdf27-7913-4331-8f98-6854929007ae`，`v1`: `f61cd84a-66d4-42c8-b05f-1b7e7a6b579f`）：`51,514` token（`plan` 11,515 + `write` 16,382 + `facts` 23,617），选定 `composition: darkroom-rail-showcase`（桌面左侧固定暗色导航竖轨 + 右侧主画布大字与换弓毛价签 + 主次双卡结构修复/琴码更换 + 双格接待时段），`skeleton: capability-led`；
    4. `vetclinic/neighborly`（T-244 要点笔记包 × `neighborly`，站点 `02417c3f-1b29-41d8-8dc9-bb087c44be70`，`v1`: `6b8bd67e-5a09-46e3-9673-b16351c3d82a`）：`47,559` token（`plan` 11,450 + `write` 15,214 + `facts` 20,895），选定 `composition: neighborly-errand-guide`（深绿牌匾顶栏 + 顶部三格门诊时段/接诊边界/候诊准备告示卡 + 无框精选收费行 + 位置与邮箱收束），`skeleton: custom`。
- **客观结构诊断数字（`artifacts/t240/post-eval-diagnosis/structure-diagnosis.{json,md}`，对照 `artifacts/t239/structure-diagnosis.json` 的 `recentGptSites` 11 站 / 49 对基线）**：
  - 命令：`node --experimental-strip-types scripts/diagnose-site-structure.ts --site-ids 7f8cbbfc-4146-4c3b-b37e-6f78a0de220d,c8cdbb5e-4aee-43e6-8fc0-5ab3cddf4c7b,d48fdf27-7913-4331-8f98-6854929007ae,02417c3f-1b29-41d8-8dc9-bb087c44be70 --out-dir artifacts/t240/post-eval-diagnosis`
  - 4 个新生成站（6 对跨公司配对）跨公司 `plan` 大纲序列平均相似度：**`33.3%`**（`T-226～T-238` 11 站基线为 `64.9%` / `0.6486`，下降 `31.6` 个百分点）；
  - 4 个新生成站跨公司 `HTML` 首页区块类型序列平均相似度：**`43.9%`**（`T-226～T-238` 11 站基线为 `64.0%` / `0.6401`，下降 `20.1` 个百分点）；
  - 4 个新生成站跨公司 `HTML` 复合结构签名（`type:columns:mediaPosition`）平均相似度：**`11.7%`**（`T-226～T-238` 11 站基线为 `19.8%` / `0.1983`，下降 `8.1` 个百分点）；
  - 骨架卡分布：`{"capability-led": 2, "product-atlas": 1, "custom": 1}`（打破此前 11/11 塌缩进两张卡且历史 118 站 `custom=0` 的锁定）；
  - 整页构图分布：`{"darkroom-ledger-matrix": 1, "darkroom-rail-showcase": 1, "neighborly-errand-guide": 1, "none": 1}`（两家 `darkroom` 站点按资料体裁自动分流至两种完全不同的构图）。
- **隔离 `claude-sonnet-4-6` `company` 盲评与 `darkroom` 升级（`artifacts/t240/blind-audit-proof.json`、`artifacts/t240/unblinded-company-report.json`）**：
  - 组合 `packaging/darkroom` + `luthiery/darkroom`（两站均为本轮新整页构图机制生成）与 `restaurant/neighborly`（`T-226` `e576238b` 旧站对照）+ `vetclinic/neighborly`（本轮新机制生成）为完整匿名包 `artifacts/t240/combined-company-4sites/review/company`，复制到独立临时目录并由全新 `claude-sonnet-4-6` 会话（`e666d2db-0cc0-42a0-9457-ca8c682043e6`）仅评阅 `company` 包（故 `--unblind --company` 报告中 `clusters` 字段保持未评阅状态）。
  - 宿主审计结果：`outsideAccessesCount = 0`、`uniquePngsReadCount = 8/8`、`missingPngs = []`、`maxSamplesPerTurn = 1`；解盲汇总 `sameStyle: { total: 2, sameTemplate: 0, undecided: 0, rate: 0 }`：
    - `darkroom` 配对（`0492917aa514`）：`sameTemplate: false`（左侧垂直暗轨导航 + 单栏报价卡 + 两列展柜 + 两列时间表 vs 顶部横栏导航 + 横排大标题 + 三栏规格参数对照 + 两列打样/装载记录）；
    - `neighborly` 配对（`6309cf5f2b53`）：`sameTemplate: false`（深绿顶栏 + 等宽三栏门诊/接诊/候诊告示卡 + 无框收费行 vs 深棕红顶栏 + 左大标题右栏首屏 + 时间线/动态区块）。
  - 按 `craftposter` 标准从 `luthiery/darkroom`（`d48fdf27-7913-4331-8f98-6854929007ae` / `v1` `f61cd84a-66d4-42c8-b05f-1b7e7a6b579f`，纯虚构文字与生成 HTML/CSS，零照片再分发）提取 `576×400` `public/style-previews/darkroom.webp`，在 `lib/code-site-styles.ts` 与 `public/style-previews/SOURCE.md` 登记 `darkroom` 为 `ready`，并同步 `AGENTS.md`、`CONTEXT.md`、`README.md`、`docs/project/mainline.md`、`docs/project/spec.md`。
- **工程门控与独立审查**：
  - `SITE_STORE=fs npm run build` 通过（`artifacts/t240/final-build.log`，`.next` `835.6 MB <= 2GB`）；`npm run typecheck` 零错误（`artifacts/t240/final-typecheck.log`）；19 组回归套件 `97/97` 通过（`artifacts/t240/final-regression-tests.log`）及复审 5 组套件 `19/19` 通过（`artifacts/t240/rereview-tests.log`）；`design_integrity.py` `findings: []`（`artifacts/t240/design-integrity.json`）；`project_map.py status --root .` 零问题、零过期活文档。
  - 独立 `claude-sonnet-5-5-high` 首轮只读审查（`70db270c-08ce-4355-b267-75e63a30a168`，`artifacts/t240/claude-review-round1.txt`）指出票据基线笔误、两处残余负向措辞与 `auto` 无构图风格枚举漏洞；逐项修复补测后，独立 `claude-sonnet-5-5-high` 定向复审（`02b93dd0-f353-40c1-bb3d-9d0da3a7dc18`，`artifacts/t240/claude-review.txt`）结论为 **`Verdict: PASS`**。
