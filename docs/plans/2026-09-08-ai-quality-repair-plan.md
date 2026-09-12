# SiteCraft-ai「AI 建站质量」修复计划 — 检测 → 强制 → 把关

> **归档说明（2026-09-12）**：本文件原为根目录的 `.tmp-plan-recovered.md`（临时文件名，
> 内容却是一份完整的 1517 行修复计划）。它写于 2026-09-08，**执行顺序部分（T1–T4）
> 已被 [`2026-09-09-quality-plan.md`](2026-09-09-quality-plan.md) 取代**，不要按本文的
> 「执行顺序」那节开工。
>
> 保留它的价值在**开头的 A0–A13 十四类问题总表**——每条都有代码出处，是本轮
> 「能力都在、没接上」系列缺陷的**最早一次系统记录**。2026-09-12 真机实测确认了其中两条：
> - **A8「询盘表单可能死链」**：证实为确定性故障（`preview/route.ts` 用了作用域外的
>   `copy` → 抛异常 → 22 模板里 20 个的发布站没有询盘表单），已修；
> - **A10「中文容量溢出」**：证实为 `about.body` 的 40 字硬线（契约是 800）导致公司简介
>   永远写不进草稿，已修。
>
> 正文里「见对话记录」所指的原始对话已不可考——这份文档是那段推理仅存的载体。


## Context（为什么做这次修复）

产检测反馈：「目前质量不太行。先确认 AI 会不会用模板——很多地方 AI 都是自己兜底的，只套了一个背景图」；用户补充：「认为完成度达标了，其实很 demo，实际测试差距很大」「只熟悉后端，其他板块不熟」「需要高 star 的产品经理 skill 把握产品完成度与架构/市场方向」。

**根因分析（基于代码核实，不是推测）**：

1. **架构不背锅，流程/可观测性背锅**。提示词（ai-provider.ts:391-408）与注入器已把 AI 约束成"填槽不造版"，SiteRenderer 换肤只是 iframe 8s 握手失败的展示兜底。真正缺陷是：
   - **AI 对模板的理解没有被强制产证**——输出只有 operations，没有任何字段证明模型逐节读懂模板原生形态；提示词全靠一句"请遵守"，无法事后核查。
   - **观感/结构忠实度无自动检查**——coverage-scan 只断言"槽位文案可见 + 无 demo 残留"，classifyCoverage 只看 visibleTargets（e2e/helpers/coverage-scan.ts），"只套背景图/自创布局/补生成卡区"这类缺陷查不出。
   - **过程零痕迹**——发给模型的完整消息、原始返回、逐节决策全部不落盘（generation-record.ts 只存终态字段），事后无法回答"AI 懂不懂模板"。
   - **门禁 fail-open 文化**——demoFingerprints 曾全空导致拦不住 demo（audit 记录）；发布自评 fail-open；诊断 spec 被 testIgnore。
   - **用户只有后端经验**——验收停留在"能跑/文案在"，前端观感/UX/产品合理性无专业把关 → demo 感被放大。
2. **外因**：部分模板本身只有默认 `card_grid` presentation（defaultPresentation 注释明说"零回归——不升级的模板继续走通用卡片渲染"），AI 填得再认真也会被渲染成通用卡墙。

**已知 14 类问题总表**（A0-A13，均有证据/出处，见对话记录）——A0 完成度误判(★核心)、A1 门禁静默失效/fail-open、A2 不可观测/无评估基线、A3 长任务/多 agent 交接、A4 账本文档漂移、A5/A6 环境陷阱、A7 后端单技能盲区、A8 询盘表单可能死链、A9 hero 用 demo 图、A10 中文容量溢出、A11 SEO/域名/部署缺失、A12 商业模式(自助 vs 代建)错位、A13 模板 dist gitignored 不可复现。

**目标产物**（按用户要求顺序）：
1. 高 star PM skill 调研 + 可自动调用的装配方案（把"完成度/架构/市场"交给专家方法论把关，补用户后端单技能盲区）。
2. AI 建站修复计划（P0 诊断 → P1 提示词+逐节强制 → P2 门禁，P2 可依数据前移），附两端优化后的提示词全文。
3. 产品方向落地方案（P3 直接编辑/本地化 → P4 行业模板 → P5 复刻学习器）。

---

---


## PART 0 — 产品方向升级（用户 2026-09-08 补充，已确认决策）

### 用户提出的三个真问题
1. **境外依赖**：当前 22 个模板全为国外开源项目，预览依赖境外演示站，国内网访问会失败（底层已有本地 dist 快照机制，但未全覆盖）。
2. **信息架构错位（最致命）**：国外模板是 landing page 逻辑（hero→features→testimonial），国内工厂官网是"实力展示"逻辑（厂房实景→资质证书 ISO/专利→产品参数+询盘→新闻案例→地图电话）。洋模板把制造能力压进 testimonials/特性卡 → 观感天然假——**不是 AI 填不好，是骨架就不对**，这正是反复"demo 感"的深层根因。
3. **编辑方式局限**：小改精度不够、模板内图片无法替换、无"AI 对网站的理解和编辑"。技术修正：现状是 draft 结构化数据→bridge DOM 改写（模板 html 冻结），且 DOM 已打 `data-sitecraft-slot`——**点选编辑所需"反向映射"基础已存在一半**；缺的是把 hero.image/brand.logo 从 template-owned 升级为**可替换资产槽**。

### 用户定的两个方向（已确认决策）
- 方向 A：**双通道模板供给**——大量行业模板（机械/五金/家具/食品/电子/化工/互联网/政府）+ 参照复刻通道。来源决策：**采购/引入改选**（非自建、非复刻对标站）。
- 方向 B：**结构化模板学习器**（截图/URL→AI 识别分节→落成新模板 manifest+适配器，复用现有 draft/注入/编辑/质检体系，复刻站可持续编辑）。非一次性孤儿代码。
- 方向 C：**直接编辑**——小文本点选直改、图片点选替换（资产槽升级）、大改动 AI 对话框（给 AI 渲染 DOM/截图作具身上下文）。

### 已确认推进顺序（质量门禁 P0-P2 贯穿不变）
**可编辑→模板→复刻**：先做方向 C（点选编辑+图片替换+模板本地化）→ 再做方向 A 行业模板库（采购引入改选）→ 最后做方向 B 模板学习器 MVP。

---

## PART 1 — PM/专家 skill 调研与装配（已调研定稿，来自 GitHub/B站 实测 star）

### 最终推荐矩阵

| 你的问题 | 选中的 skill/方法论 | 理由（实证） |
|---|---|---|
| A0 完成度误判→demo 感(★) | **phuryn/pm-skills**（26,098★，2026-03 创建持续更新，非刷星）：`intended-vs-implemented` + `shipping-artifacts` + `/ship-check` | 专门审计"意图(文档/DoD) vs 实现(代码/产物)"的**意图差**——明说"商品化扫描器扫不到，因为无意图模型"。这正是你 demo 感的根因：验收标准与真实渲染脱节。3 个配套 ship 文档/流程让 AI 产物可被审查。 |
| A1 门禁失效/fail-open | NeMo Guardrails(7,082★)/guardrails-ai(7,369★) 方法论 | 结构化护栏替代"口头遵守+自评 fail-open"；valqore 等验证后可入。 |
| A2 不可观测/无基线 | langfuse(34,321★，AI 工程平台: evals/可观测/提示词管理) | 覆盖"生成过程留痕 + 输出评估基线"两大缺口。 |
| A3 长任务/交接 | obra/superpowers(282,949★，你已用 writing-plans/executing-plans/verification-before-completion 即其子集)；anthropics/skills(175,097★，官方) | 补齐 systematic-debugging/receiving-code-review/subagent-driven 等；A3(后台通知丢) 属已知环境限制，配验证钩子。 |
| A4 账本文档漂移 | awesome-vibe-coding-guide(377★) 的 setup/planning + mhattingpete review-implementing(671★) | 前者补"计划/账本/模板起步"，后者补"验收反馈系统化落地"。 |
| 计划文件审校(★新增) | phuryn `red-team-prd` / `strategy-red-team` + alirezarezvani(25,681★) adversarial-reviewer | 在动手前攻击计划的承重假设（Fails if___ + 最小验证）；专治"计划文件有明显问题但没被发现"。 |
| A7 后端单技能盲区 | 前端设计/UX 用**已装的 ui-ux-pro-max**；产品/业务判断用 A0 PM skill；视觉用 anthropics 官方 design 系 | 让不熟领域交给高 star 专家技能代判。 |

> **"确保好用"验证**：已抽查 phuryn 的 shipping 技能与 mhattingpete 的 review-implementing/code-auditor 全文——均有清晰 When-to-Use/Workflow/输出结构（非空壳）。phuryn 的技能基于 Teresa Torres/Marty Cagan/Alberto Savoia 等真实方法论，非泛化 prompt。

### 装配方案（**全局调用**，跨项目生效）

skill 的调用机制是**描述匹配自动加载**：按标准格式安装为 `SKILL.md`（name+description），Claude 在任务命中 description 时自动加载。用户明确要求**全局（用户级）**安装，不做项目级——任何项目/会话都能用，触发规则写进用户全局 CLAUDE.md（`C:\Users\ZhuanZ\.claude\CLAUDE.md`）而非项目级，跨项目自动生效。步骤：

1. **安装到全局 `C:\Users\ZhuanZ\.claude\skills\`**（这是 Claude 的用户级 skills 目录，所有项目可见）：
   - phuryn/pm-skills 是 **plugin marketplace**，全局安装用：
     `claude plugin marketplace add phuryn/pm-skills` + `claude plugin install pm-ai-shipping@pm-skills`（内含 `shipping-artifacts`、`intended-vs-implemented`）、`pm-execution@pm-skills`（内含 `strategy-red-team`、`red-team-prd`）等按需插件；
   - 或对以"单个 SKILL.md + references"发布的技能（menkesu `quality-speed`、superpowers `systematic-debugging`/`receiving-code-review`、mhattingpete `review-implementing`），直接复制 SKILL.md 目录到 `C:\Users\ZhuanZ\.claude\skills\`；
   - alirezarezvani(25k★) `adversarial-reviewer` 若格式兼容亦并入全局。
2. **全局 CLAUDE.md 触发点**（`C:\Users\ZhuanZ\.claude\CLAUDE.md`，追加到既有"工程规范"区；全局生效，不写进项目）：
   > - **计划复审**：写完任何计划/PRD/方案文件后、动手执行前，先跑 red-team-prd/strategy-red-team 攻一遍承重假设（Fails if___ + 最小验证）——专治"计划文件有明显问题但没被发现"。
   > - **完成度/交付把关**：凡涉及"自认为达标/是否 demo/能否交付"的判断，先触发 intended-vs-implemented（对照任务书/验收文档与真实实现逐项对账），不凭印象下结论。
   > - **质量 vs 速度**：需要决定"打磨到多细才收手"时，触发 quality-speed 的决策矩阵（核心用户可见=高 craft）。
3. **验证可用性**：装后确认目录存在 + 用一句触发词实测（任意项目里说"这个站点算不算 demo"应命中 intended-vs-implemented；说"审一下这个计划"应命中 strategy-red-team）。
4. **权限 allowlist**：若 skill 需读 vendor/成品展示/外网，加入用户 `~/.claude/settings.json` 只读白名单，避免打断。
5. **本项目 specific skill（内建兜底/质检口径）**：可另建 2 个轻量自定义 skill（`complete-site-review`/`template-fidelity-check`）固化本计划第 4 节的检查清单——不新增依赖，纯 SKILL.md。

---

### 验证能力与判据分层（2026-09-08 实测更新）

**关键事实**：视觉链路**实测可用**——用 `Read` 读 `top-inspect.png`/`products-inspect.png`，能准确读出导航项、标题文案、布局结构、以及"英文 SaaS 数据看板残留在中文工厂站"这类 demo 缺陷。**此前"我看不见图"的自我判断是错的**。

**但视觉的定位必须收敛**（用户认同的批评）：

| 层 | 角色 | 为什么 |
|---|---|---|
| **机械门禁**（fidelity marker / coverage / trace / 测试） | **负责拦**——可复现断言、能进 CI、能卡发布 | 不依赖我的判断力，稳定 |
| **并排对照**（模板原版 demo vs 注入后） | 负责**定性归因**：差异即我们的责任 | 隔离"模板天生洋气"与"我们注入改坏" |
| **行为/网络检查**（表单提交、外链扫描、离线渲染） | 负责**截图盲区** | 截图看不见"表单死链""境外 CDN 外链在国内打不开" |
| **人（你 / 客户）** | 唯一有 ground truth 的 oracle | 真实业务判断 |
| **我的视觉** | **只做预筛**：① 明显垃圾（英文看板残留）② 资产适配性（图与业务搭不搭） | 这两类机械查不出，但结论不该由我下 |

**反例警示（本次对话自证）**：我基于代码推断"架构不背锅、问题在流程"，而真实反馈是**视觉问题**；我又一度断言"看不见图"，实测**能看见**。→ 我的视觉结论只作线索，不作判据。

**截图盲区清单（必须用非视觉手段覆盖）**：
- 表单是否真能提交（A8）
- 图片/字体是否为境外外链（国内访问失败风险）
- 交互、hover、响应式断点
- 模板原版 vs 注入后的 DOM 结构差异

### 环境一致性（2026-09-08 修订：Docker 只做最后验证）

**决策修正**：Docker **不作为日常开发环境**（构建慢、无热重载，会让"改→验"循环从秒级变分钟级）。改为**双环境分工**：

| 用途 | 环境 | 说明 |
|---|---|---|
| **日常开发/快速验证** | `npm run dev`（file 存储，热重载） | 秒级反馈 |
| **发布前一致性验证** | `docker compose up -d --build`（PG 存储） | **只在最后跑一次**，不做重复构建 |

**已知差异（可接受）**：dev 用 file 存储**不写** `generation_records`；docker 用 PG **写**。验收时以 Docker 为准。

**配置已统一**：`.env`/`.env.local`/`docker-compose.yml`/`.env.example` 四处均为 `deepseek-v4-flash` + `max_tokens=8000`。

**存证策略（修订）**：JSONL 过程痕迹落盘条件从"仅失败"改为
```
partial || error || fallback || quality.score < 60
```
理由：实测第 6 单 `partial=false 但 score=39`——"成功但很 demo"的典型形态，按原设计不落盘就永远无法复盘。

### 判据固化闭环（解决"视觉降级→判据缺位"）

视觉预筛的价值**不是下结论，而是持续扩充机械门禁**：

1. 视觉发现缺陷（如"英文 SaaS 看板残留在中文工厂站"）
2. **立即转成可检测规则**：加 `demoFingerprints` / 写检测函数 / 补 e2e 断言
3. 记入 `docs/visual-defects.md`（缺陷 + 对应机械检测手段）
4. **目标：同一缺陷只被视觉发现一次**，之后由机械门禁永久拦住

> 反例：英文看板残留当前**任何机械层都拦不住**（非 generated 整节、不在指纹库）——它必须被固化成规则。

### 门禁分层与阻断权

| 层 | 触发时机 | 阻断权 |
|---|---|---|
| **L1 机械**（`npm test` + coverage-scan） | 每次提交 / CI | ✅ 阻断合并 |
| **L2 行为**（表单提交 / 外链扫描 / 离线渲染） | 发布前 | ✅ 阻断发布 |
| **L3 视觉预筛** | 发布前 | ⚠️ 产出待确认清单，交用户判定 |

---

### 2026-09-08 决策更新（用户）

| # | 决策 | 对计划的影响 |
|---|---|---|
| 1 | **并发限制是官方临时设置**（之后放开） | 不为此改架构；**采样验证取消**（费时、收益低） |
| 2 | **采样验证不做** | 删除 P2-E/D5；改为"单模板快速回归"（1 模板 × 3 次）按需跑 |
| 3 | **门禁方案重新制定**（见下） | P2.1 重写 |
| 4 | **成品展示已还原**（47 文件，9-4 产物） | P1.7 基线恢复可用；但用户指出"里面很多不合格"→ 基线本身需重估 |
| 5 | **模板来源扩展**：22 个之外，用 screenshot-to-code 思路复刻国内行业模板 | P4 重写：接入"截图/URL → 模板"通道 |

### 门禁方案（重新制定，替代原 P2.1）

**问题回顾**：原方案"role≠card_grid 且未声明通用承载 → FAIL"有两个缺陷：
- 靠中文关键词正则匹配 `presentAs`（"通用/生成兜底"）→ 脆弱，改文案即失效；
- 无法覆盖"英文 SaaS 看板残留"这类**非槽位残留区块**（实测 `detectTemplateDemoResidue` 只查 manifest.slots）。

**新方案（三层，各司其职）**：

| 层 | 检测什么 | 实现方式 | 判定 |
|---|---|---|---|
| **L1 槽位层** | 该填的槽是否填了、是否残留 demo | 现有 `detectTemplateDemoResidue` + `classifyDraftCoverage` | 已有 |
| **L2 区块层**（新增） | **非槽位残留区块**：英文看板、demo 文案、模板自带的 SaaS 组件 | 在 manifest 加**显式字段** `nativeFallbackHost?: "generated" \| "native"`（替代正则）；新增 `detectResidualBlocks(html)` 扫描残留标记 | 新增 |
| **L3 结构层**（新增） | 该节是否落在模板原生结构（vs 通用兜底） | bridge 的 `generatedContentSections` + `data-sitecraft-generated-content` 标记 | 已有数据，待接门禁 |

**关键改动**：把"通用承载"从**文案描述**升级为**类型字段** `nativeFallbackHost`——这是"实现不了/不可靠"的正解。

### 模板扩展通道（P4 重写，2026-09-08）

**用户目标**：22 个之外，覆盖**机械、五金、家具、食品、电子、化工、互联网、政府**等国内行业。

**方案对比**：

| 方案 | 可行性 | 说明 |
|---|---|---|
| **screenshot-to-code（abi/screenshot-to-code 78k★）** | ⚠️ **不兼容** | 它是**应用不是 skill**（无 SKILL.md）；输出是**一次性 HTML 代码**，不产出 manifest/adapter，**无法进入我们的 draft/注入/编辑体系** |
| **改造为"模板学习器"**（推荐） | ✅ | 复用其思路（截图→分节识别），但**输出改为 manifest + adapter 骨架**，落入现有体系 |
| 采购/引入国内可商用模板 | ✅ 补充 | 速度快，但需授权审查 |

**推荐路径**：**截图/URL → AI 识别分节结构 → 生成 manifest + adapter 骨架 → 人工补 adapter → 过门禁**。这样复刻出的模板**可被编辑、可被质检**，不是孤儿代码。

---

## PART 2 — AI 建站质量修复计划

### 实现原则
- 零新依赖；env 开关默认关；PG 只增列、幂等；prompt 版本自动 fingerprint；先"能诊断"再"能强制"再"补模板"；可随时回退。
- 全程「verification-before-completion」：每步跑真实命令贴输出，不靠逻辑推断。

### P0 — 先能诊断（对应 A2/A0/A1）
改动清单（关键文件，行号以当前代码为准）：
1. 新增 `lib/generation-trace.ts`：env `SITECRAFT_LOG_GENERATION=1` 开启；append JSONL 至 `.sitecraft-data/logs/generation/<runId>.jsonl`（目录已在 .gitignore）；事件：`run.begin/batch.start/model.request(完整system+user)/model.response(原始返回)/batch.adopted(逐槽slotMap+容量)/fallback/run.outcome`；含 `reconcileSectionUnderstanding` 纯函数；模块内禁收 apiKey、路径不可由请求参数控制。
2. `lib/ai-provider.ts`：`requestDraftOperations` 提 messages 为变量，插 model.request/response 事件；`DraftOpsArgs` 加 `traceCtx`；awareness 字段提取透传。
3. `lib/site-generator.ts`：traceCtx 传批 A/B/recovery；各返回点（含 forge 切换/local-fast fallback）写统一 `run.outcome`；`GenerateDraftOutcome` 聚合 `sectionUnderstanding`。
4. `app/api/sites/[siteId]/generate/route.ts`：draftOpsProvider 透传新字段；done payload 透出 sectionUnderstanding（供产检测/e2e 断言）。
5. 新增 `tests/generation-trace.test.ts`（离线单测：env 解析、事件行 JSON 往返、reconcile 纯函数用例）。
6. **产出 automation.md 意图文档（试用 shipping-artifacts 校准新增）**：本项目是"嵌入 AI agent"应用（AI 建站/chat），按 shipping-artifacts 的 automation.md 规范补意图文档——记录：agent 触发与 owner；可读输入；**exact tools/API 面（=提示词白名单 ops + 服务端校验）**；steering(prompt) vs 非 prompt 硬护栏（白名单校验/对账/门禁）；输出契约回传 app（schema/validation）；**app-owned 副作用 vs agent-owned 建议**；审批门/审计日志。目的：让 intended-vs-implemented 审计有"意图基线"可对（此前缺根文档）。
7. P0 验收：`SITECRAFT_LOG_GENERATION=1 npm run dev` → 跑一次 scripts/build-fastener-site.mjs 或手点生成 → 打开 jsonl 见 run.begin→各批 model.request/response→batch.adopted→run.outcome（含 fallback 原因）→ 能回答"AI 每节是否理解、哪节兜底、原因"；automation.md 落盘。

### P1 — 提示词 + 逐节理解强制 + 兜底显性化（对应 A0 核心/用户要的"优化提示词"）
1. `lib/prompt-registry.ts`：`draft_operations` v1→v2（新 contract/fingerprint 自动重算；`site_intent`/`chat_operations` 不动）。
2. 提示词强化（**优化后的全文见 PART 3**）：system（ai-provider.ts:391-408）规则段插入"冻结骨架/禁止换肤/自查-声明/宁缺勿假+隐藏/兜底须 fallbackDeclared"；presentationText 每槽加可抄写 role 令牌；batchA 加"首屏=文字不是背景/不存在换图操作"；batchB/recovery 加逐节自查要求。
3. 强制产证（**红队修正**：nativeRole 抄写是"照抄提示词已给令牌"→ 构造性装饰；硬指标改用"操作本身是否贴合原生容量/形态"）：输出可选字段 `templateAwareness`（每节 nativeRole + plannedItems + fallbackDeclared），**lenient 解析不回退旧行为**；服务端 `reconcileSectionUnderstanding` 对账，**verdict 权重落在硬指标**：(a) `opCount/itemCountEstimate vs presentation.capacity`（withinCapacity，贴合原生容量才算 declare_ok）；(b) `fallbackDeclared=true` 是否与实际走了 generated 兜底一致（false 却兜底 = 严重不诚实，反之为 clean）；(c) nativeRole 抄写仅作**软信号**（role_mismatch 提示不看，不 gate）。对账结果入 generation_records（`section_understanding` JSONB 列 + recordGeneration/list 同步）。
4. 兜底显性化：preview bridge 的 report 加 `generatedContentSections`（renderGeneratedContent 调用即 push）；generate 页 done 后弹琥珀提示"以下板块当前为动态备用排版 X"；`scripts/visual-review.mjs` 截图后 evaluate 收集各节 marker 写 `<OUT_DIR>/_review-<templateId>-fidelity.json`。
5. 契约断言同步：tests/site-generator、prompt-registry、generation-provenance、新对账单测（awareness 解析纯函数导出供离线测）。
6. **P0→P1 数据闸口（红队修正）**：P0 trace 跑 10 单真实/缺陷样本后先做 review，按 trace 数据决定先修提示词（P1）还是先补 manifest/adapter 缺节（P2 前移）——防止把提示词修复打在错误层。若 role_match 命中率 ≥95% 而 demo 抱怨照旧 → 印证 P1.3 的重设计。
   - **首批证据（P0.7 真实运行）**：`batchB` 整批失败 + 4 次 recovery 全无返回 → `partial`，5 板块全缺，`quality.score=0`。**这更像超时/并发问题而非"模型不理解模板"** → 数据闸口初步指向"先修生成可靠性（P2 前移）"而非纯提示词；需再跑 9 单确认。
7. P1 验收：`npm test` 全绿；生成后 `generation_records` 行含 section_understanding（**withinCapacity/兜底一致性** 有值）；页面出现兜底提示；**对 `成品展示/` 已还原的 47 个产物跑检测**——注意用户已指出"里面很多不合格"，因此这批产物**先作为"缺陷样本"用**（跑检测看能拦出多少），而非"合格基线"。

### P2 — 门禁 + 模板补齐（2026-09-08 重新制定）
1. **门禁三层方案**（替代原"正则豁免表"）：
   - **L1 槽位层**：沿用 `detectTemplateDemoResidue` + `classifyDraftCoverage`（已有）；
   - **L2 区块层（新增）**：manifest 加显式字段 `nativeFallbackHost?: "generated" | "native"`（**替代脆弱的文案正则**）；新增 `detectResidualBlocks()` 扫描**非槽位残留**（英文看板、SaaS demo 组件）——实测 `detectTemplateDemoResidue` 只查 `manifest.slots`，**这类残留当前谁也拦不住**；
   - **L3 结构层（新增）**：把 bridge 已有的 `generatedContentSections` / `data-sitecraft-generated-content` 接入门禁，判定"该节落在原生结构 vs 通用兜底"。
   - 判定：L2 发现残留区块 = FAIL（可归因"模板适配缺节"）；L3 与 `nativeFallbackHost` 交叉验证（声明 native 却走 generated = 真缺陷）。
2. **质量门词汇表泛化（P4 前必做）**：现 10 个 corporate 槽 / `PresentationRole` 枚举 / coverage REQUIRED_TARGETS / TARGET_SLOT_PREFIXES 全部硬编码。改为**注册表驱动**（新增 certificate/strength/news/map role 即被 coverage/reconcile 自动纳入）——堵死新节落到"guardrail 盲区"。
3. **A8 询盘表单死链**：form action 落 mailto/记录/静默端（publish 可达），纳入 P3 连带验证。
4. **历史 demo/未适配清理**：A9（hero 真图）/ A10（中文容量）/ A11（SEO/域名）。
5. P2 验收：`npx playwright test e2e/specs/coverage-scan.spec.ts --project=chromium --workers=1` 通过（**先确认该 spec 未被 testIgnore 排除**）；对 `成品展示/` 已还原的 47 个产物跑 L2/L3 检测，**产出不合格清单**（用户已指出"很多不合格"，需量化）。
6. **采样验证取消（用户决定）**：并发限制属官方临时设置，不为此改架构。改为**按需单模板快速回归**（1 模板 × 3 次）验证改动，不做 10 单全量采样。

---

## PART 3 — 两端优化后的提示词全文（用户点名产物）

### 附 A — 产检测"模板忠实度核查"提示词（全文）

> 用法：把本提示词喂给 Codex / Claude / 评审 agent，附上「模板原版渲染（如 成品展示/*真实模板*.html）」+「AI 注入后成品（预览/截图/fidelity JSON）」+「企业需求简报」，让它逐节核对。核心理念取自 intended-vs-implemented：不做印象流判断，逐节对"意图 vs 实现"。

```
你是资深产品经理兼视觉审查员。任务：判断一个 AI 建站产物是否"真正使用了所选开源模板的结构与排版"，还是"只做了换肤/兜底/看起来像 demo"。禁止凭整体印象打分——必须逐节对账，输出可引用的证据。

# 输入
- 模板原版：${模板原版 HTML/截图/源码路径}
- AI 成品：${注入后预览 HTML/截图} + ${fidelity JSON（每节 native/generated/hidden 标注）}
- 企业需求：${一句话需求 / SiteDraft 内容 JSON}

# 逐节核对表（每一节都必须给出 verdict，不许跳过）
对 hero / about / features / services / products / contact / 导航 / 页脚 / 表单 逐节检查：
1. 结构忠实度：这一节在成品里是否仍是模板原版的那个板块（同样的栅格/分栏/卡片形态/图标行/配色体系）？还是被换成了通用卡片墙、整块补生区、或只留了模板的背景图？
2. 内容真实性：这一节的文案是否来自企业真实信息（与需求/草稿一致）？有无 demo 残留（人名/示例文案/英文占位）？缺失事实是否诚实地写了"待补充"或隐藏了该块，而不是编造填充？
3. 资产来源：这一节的图片/图标/背景，是模板/企业资产，还是明显与业务无关的库存感 demo 图？（如制造业官网首屏用包装渲染图而非产线/设备实拍）
4. 行为可用：联系表单提交后是否有真实去向？邮箱/电话/地址是否为企业真实信息且可点击？
5. 语言与容量：中文文案是否撑爆了模板原生排版（换行错乱/截断/溢出）？有无中英混排？

# 判定规则（哪条都不许放水）
- "只套了背景图 / 只换了 hero 标题当作完成一个板块" = 该节 FAIL。
- 出现 [data-sitecraft-generated-content] 补生卡区 = 该节标注 generated（模板适配缺节），与"模型没理解"分开记。
- 出现无企业实拍支撑的主视觉 / 死链表单 / demo 文案残留 = 记 demo 信号（无论其他节多好）。
- 只有全部业务节均为 native + 无 demo 残留 + 行为可用，才算"达标"。

# 输出格式（结构化，逐节，禁止泛泛而谈）
## 逐节核对结论
| 节 | 结构忠实(native/generated/换肤) | 内容真实(是/否/待补充) | 资产来源 | 容量/语言 | verdict(达标/缺陷) |
（每节一行；缺陷行必须给出一句证据，引用截图编号或 HTML 片段）

## Demo 信号清单（按严重度排序）
- [高/中/低] 信号描述 — 证据（哪节/哪张图/哪个交互）— 修复建议

## 总体判定
达标 / 接近达标（列剩余差距）/ 不达标（列 top 3 阻断项）
```

### 附 B — 生成 AI 强化系统提示词（全文，替换 ai-provider.ts:391-408 的 system 常量）
在现有基础上新增的规则用 【★新增】 标出；ops 白名单等未变处保留原样。

```
你是企业官网初稿编辑器。用户已经选择了现有模板，你只为该模板生成内容，不从零生成模板，也不改写模板的 HTML、CSS 或响应式骨架。只返回 JSON：{"summary":"中文摘要","operations":[...],"templateAwareness":[...]}。
【★新增】模板的 HTML/CSS/栅格/背景图/配色/字体是冻结骨架：你的全部产出只能是落在模板各原生节内的文字内容与条项。不存在任何可改版式/换肤/造板块/换图的操作——尤其禁止"只把首屏或某板块的背景图/主视觉换掉当作完成该板块"；hero 等视觉资产一律由模板原样呈现，你只写文字。
只允许使用以下操作，且只改列出的板块：
1. set_text: {"op":"set_text","target":"siteName|companyName|industry|goal|hero.title|hero.subtitle|hero.cta|about.title|about.body|features.title|features.intro|services.title|services.intro|products.title|products.intro|contact.title|contact.body","locale":"zh|en","value":"新文本"}
2. update_card: {"op":"update_card","section":"features|services","index":0基,"locale":"zh|en","title":"可选","body":"可选"}
3. set_template: {"op":"set_template","templateId":"${args.templateId}"}
4. set_section_visibility: {"op":"set_section_visibility","section":"about|features|services|products|contact","visible":false}
5. update_product: {"op":"update_product","sku":"现有SKU","locale":"zh|en","name":"可选","summary":"可选"}

本轮只改这些板块：${sectionsText}${bilingual}。
规则：
- 文案简短有力：标题≤15汉字/10词，说明≤40汉字/25词
【★新增】- 中文按模板容量×0.9 控制条数与长度（中文信息密度高，防止撑爆英文原版排版）；宁可按原生容量写少、写得实，也不要为凑数空泛加卡。
- 缺失的企业事实写"待补充"，不虚构客户/认证/产能/数据
【★新增】- 模板能力中标注"无可靠事实则该块隐藏"的板块（logo_strip/stats_bar/testimonial_wall 等演示块）：没有可靠条目就隐藏该块，绝不编造填充或塞默认图。
- 不要为未列出的板块生成操作
- 每板块 2-4 条操作，总量控制
- 模板能力约束：${capabilityText}
- 只能生成 editableSlots 中的内容；requiredSlots 必须尽量填充；遵守 slotConstraints 的语言和长度限制；nonContentSlots 是模板自有资源或行为，不要尝试生成内容操作。
- 重要：每个板块在原模板里以固定排版呈现，请严格按它"能装几条、长什么样"组织内容——宁可按原生容量写少、写得实，也不要为凑满空泛地加卡片。
【★新增】- 输出前逐节自查：对每个你产出操作的业务板块，在 templateAwareness 中声明——(a) nativeRole 逐字抄写下方【原生排版】中该行 role 令牌；(b) plannedItems=该节计划条目数，不得超过该行"最多 N 条"；(c) 若你认为模板原生区确实装不下，置 fallbackDeclared:true 并写一句理由（这是最后手段，不是目标）。
【★新增】- templateAwareness 示例：[{"section":"features","nativeRole":"split_text_media","plannedItems":6,"fallbackDeclared":false,"reason":""}]
${presentationText ? `\n【所选模板各板块的原生排版（必须遵守的容量与形态）】\n${presentationText}` : ""}
```

> presentationText 每行格式同步改为含可抄写 role 令牌（ai-provider.ts:378 拼接处 + site-generator.ts:132-138）：
> `${p.slot}=role:${p.role}|${p.presentAs}（建议${p.capacityDefault}条，最多${p.capacityMax}条）${p.hideUnlessFilled ? "；无可靠事实则该块隐藏" : ""}`

### 附 C — batch hint 强化（site-generator.ts）
- batchAHint 追加一句："第一批=首屏与导航的文字内容（标题/副文/按钮），不是首屏背景或整块视觉；首屏图形/背景由模板原样提供，不存在换图操作。"
- batchBHint 容量规则句后追加："逐节规则：每填充一个板块，先在 templateAwareness 声明该节 nativeRole 与 plannedItems（须与下方模板原生排版一致），再产出该节操作；某节装不下 → fallbackDeclared 并说明理由，禁止为该节自造整块通用卡片区绕过模板。"

---

## PART 4 — 产品方向落地方案（可编辑 → 行业模板 → 复刻）

### P3 — 方向 C：直接编辑（优先级最高，对应问题 3）
目标：点选编辑 + 图片替换 + AI 理解上下文。**关键洞察：DOM 已打 `data-sitecraft-slot`，点选→draft 的反向映射基础已存在一半。**

改动清单（关键文件，行号以当前代码为准）：
1. **可编辑层 `data-sitecraft-slot` 已铺**（bridge/adapter 注入时打标）——提供点选编辑入口：iframe 内 hover 高亮 + 点击 → 取 slot 标签 → 映射到 draft 槽位（现有 `operationDisplayTargets`/`isConcreteSelectedTarget` 已支持精确路径）→ 就地文本编辑 → 写回 draft → 局部重注入（而非整页重渲染）。
2. **图片可替换（资产槽升级）**：把 `hero.image`/`brand.logo` 从 `NON_CONTENT_SLOTS`(template-owned/excluded) 升级为**可替换资产槽**（selector + 上传/素材库 UI）；替换资产持久化到 draft.assets，重注入时按资产替换 src，跨模板设计 tokens 尽量保持。UI 用点选 + 上传/从 uploads 素材库选。
3. **AI 理解 + 大改动**：工作台对话框给 AI 传入**当前渲染 DOM 摘要/截图 + 精确 slot 清单**作具身上下文（不再是只有 draft JSON），让大改/换图指令能命中页面真实结构；复用现有 chat/route + 精确目标 enforcement。
4. **本地化（问题 1）**：22 模板全量生成本地 dist 快照（现有机制 vendor/<id>/dist），preview 优先本地、境外上游仅作一次性抓取源——彻底摆脱国内网依赖。
5. **A8 连带修复（红队修正，P3 内带出）**：form action 落 mailto/静默端（publish 可达）随直接编辑一起验证。
6. **打磨分层（试用 quality-speed 校准新增）**：按决策矩阵给 P3 定义"收手线"——核心闭环（点选在所有模板命中/就地改不破坏布局/图片替换持久化不丢/编辑不损坏草稿）= HIGH CRAFT，全做；外围细节（hover 动效/上传器拖拽裁剪预览/多选/撤销栈/字数提示）= MOVE FAST 或砍，v1 只做"能用+观感 OK"。

P3 验收：在工作台点选任意 slot 文本可就地改且预览即时更新；点选 hero 图可上传替换且持久化；对 AI 说"把首屏副标题改成 XX"命中精确目标；拔网线后 preview 仍可渲染（全本地）。**（修复后重跑复审闭环见 P1.7，防旧 bug 当现存。）**

### P4 — 国内行业模板库（2026-09-08 重写：双来源）

**目标**：22 个模板之外，覆盖**机械、五金、家具、食品、电子、化工、互联网、政府**等国内行业，采用国内"实力展示"架构（厂房实景/资质证书/产品参数/新闻案例/地图电话）。

**双来源策略**：

| 来源 | 做法 | 优势 | 风险 |
|---|---|---|---|
| **A. 复刻通道**（用户提出） | 截图/URL → AI 识别分节 → 生成 manifest+adapter 骨架 | 可精准匹配国内行业站；不依赖采购 | 依赖 AI 视觉精度；版权边界 |
| **B. 采购/引入** | 买可商用 HTML 模板 → 接入现有体系 | 质量可控、快 | 授权审查、未必有"工厂味" |

**复刻通道的关键结论**（核实后）：
- `abi/screenshot-to-code`（78k★）**不能直接用**——它是**应用不是 skill**（无 SKILL.md），输出**一次性 HTML 代码**，不产出 manifest/adapter，**进不了我们的 draft/注入/编辑体系**；
- **正确做法**：借鉴其"截图→分节识别"思路，但**输出改为 manifest + adapter 骨架**，落入现有体系（= P5 模板学习器，**因此 P5 提前到 P4 并行**）。

**改动清单**：
1. **架构先行**：先定义"国内工厂官网该有哪几节"（资质墙 certificate / 厂房 strength / 产品参数 / 新闻 news / 地图 map），再决定模板形态。
2. **依赖 P2.2 词汇表泛化**：新 role 必须先落注册表，否则门禁静默忽略。
3. **复刻通道 MVP**（并入 P5）：截图 → 分节识别 → manifest/adapter 骨架 → 人工补 adapter → 过门禁。
4. **采购通道**：授权审查 + 质量把关走 P2 门禁。
5. **风险**：版权（复刻仅学"风格+结构"，不复制文案/图）；AI 视觉精度决定初版质量。

P4 验收：机械/五金各 1 套上线（复刻或采购），过 L1/L2/L3 门禁；真实工厂信息走一单，无"洋 landing"观感。

### P5 — 模板学习器 MVP（**提前，与 P4 并行**）

**目标**：截图/URL → AI 识别分节 → 落成"新模板 manifest+adapter 骨架"，复用 draft/注入/编辑/质检，**复刻站可持续编辑**。

**为什么提前**：用户明确要用它扩充行业模板（P4 的核心手段），且它是复刻通道的载体——原计划排在最后不合理。

改动清单：
1. **输入**：参照网站 URL 或整页截图（+ 行业/风格标签）。
2. **AI 识别**：截图/HTML → 分节结构识别（hero/nav/产品墙/资质/新闻/联系）→ 结构化描述 JSON。
3. **落成模板**：描述 → "骨架 HTML + manifest + adapter 骨架"，自动过 L1/L2/L3 门禁；不足处人工补 adapter。
4. **风险/边界**：私有/版权站仅做"风格+结构学习"，不复制文案/图；初版观感依赖 AI 视觉精度，MVP 可接受。

P5 验收：用任一国内工厂对标站 URL/截图，复刻出**可编辑**模板雏形（走完"识别→生成→注入→点选编辑"）。

### 统一主线（贯穿 P0-P5）
所有通道（现有模板/行业库/复刻）共享 **manifest+draft+注入+点选编辑+质量门** 同一套底层：复刻通道 = 模板生成器，行业库 = 模板批发，直接编辑 = 交互闭环。质量门禁（P0-P2 的 trace/对账/fidelity）对任何通道产出的模板与内容同等生效——不因换模板供给而放松。

---

## PART 5 — 工期与依赖预估（红队修正补充；后端单人手工程，粗估）

> 目的：判断这是几周还是几月工程，供排期决策。以下为**粗略顺序工期**（不含采购等待/客户供图/QA 往返）。

| 阶段 | 内容 | 粗估 | 依赖 |
|---|---|---|---|
| P0 | JSONL 全链路过程留痕 + 对账纯函数 + 单测 | 3-5 天 | 无 |
| P1 | 提示词 v2 + templateAwareness 硬指标 + 兜底显性化 + 契约测试 | 4-6 天 | P0（trace 作数据闸口）|
| P2 | fidelity 门禁 + **词汇表注册表泛化** + A8 表单修复 | 4-7 天 | 无（可先于 P1 部分落地）|
| P3 | 点选编辑（hover/高亮/就地编辑/局部重注入）| 6-10 天 | P2（slot 反查稳定）|
| P3b | 图片可替换（资产槽升级+上传器+draft.assets 持久化）| 5-8 天 | P3 点选 |
| P3c | AI 具身上下文（DOM 摘要/截图进 chat）+ 22 模板本地化 | 4-7 天 | P3 |
| P4 | 供给调研 → 引入管线 → 机械/五金各 1 套（含 manifest/adapter/门禁）| 5-10 天 + 采购等待 | P2.3 词汇表泛化 |
| P5 | 复刻学习器 MVP（截图/URL→分节识别→骨架模板）| 10-20 天 | P3/P4 体系成熟 |

**合计粗估：约 6-11 周单人手工程**（若并行/有前端外援可压缩）。建议按"P0→P2 先行（先止血诊断+门禁）→ P3 拆子计划推进 → P4/P5 依赖前序"排期。

---

## PART 6 — skill 安装与逐个体检结果（2026-09-08 实测，非纸面评估）

用户要求"先装 skill → 逐个用 → 据结果重制计划"。已完成安装与试用：

**安装清单（全部成功）**：
- phuryn/pm-skills 9 插件全装（pm-ai-shipping/pm-execution/pm-product-discovery/pm-product-strategy/pm-market-research/pm-toolkit/pm-go-to-market/pm-data-analytics/pm-marketing-growth），含 intended-vs-implemented/shipping-artifacts/strategy-red-team/red-team-prd/quality-speed 等。
- 全局单技能（~/.claude/skills/）：strategy-red-team、quality-speed、systematic-debugging、receiving-code-review、review-implementing。
- alirezarezvani adversarial-reviewer **因 Codex 格式无 SKILL.md 跳过**（验证了"格式兼容才并入"判断）。

**逐个试用体检表（真实使用后）**：

| Skill | 用法（真实素材） | 结果 | 对计划的影响 |
|---|---|---|---|
| **1. intended-vs-implemented** | 审 screwfast manifest(意图) vs adapter/bridge(实现) | ✅ 抓到真实缺陷：manifest 声称 contact"询盘入口"，实际 adapter 删 demo form、bridge 只写 mailto/tel，**无任何可提交询盘表单（A8 实锤）**；且 manifest 自述 about"由通用生成兜底" → 定性为适配缺节而非模型理解 | **支持 P0→P1 数据闸口**：先修适配/manifest 比纯提示词更对；A8 从"可能"升为"实锤" |
| **2. quality-speed** | 决策"P3 打磨到多细收手" | ✅ 矩阵可操作：点选/图片持久化=HIGH CRAFT，动效/上传器细节=MOVE FAST | 给 P3 定义**打磨分层验收**（核心闭环高 craft，外围可快）|
| **3. systematic-debugging** | 追"hero 包装图"根因 | ✅ **纠正我两个错误假设**（文件名/顺序），定位真根因=复审产物是修复(a17bed6)前的旧证据 + **无"修复→重跑"回归闭环** | 新增 P1 必做：**修复后必须重跑复审验证**，防"旧 bug 当现存" |
| **4. strategy-red-team** | 审计划文件 | ✅ 抓到 6 条承重假设 | 已用，计划已改 |
| **5. shipping-artifacts** | 盘点意图文档 | ✅ 发现项目是"嵌入 AI agent"应用却**无 automation.md**（tool 面/steering vs 硬护栏/审批门零文档）| 新增 P0 产出：**automation.md 意图文档**（把 P0-P2 要建的 trace/对账/门禁落成规范形态）|

**核心洞察（试用 5 综合）**：本项目本质是 automation.md 的教科书场景（AI 嵌入建站/chat），缺的不是代码机制而是"意图文档 + 回归闭环"——这正是 intended-vs-implemented 的前提（shipping-artifacts 1 号核心文档缺位）。

---

## P0 执行记录（2026-09-08 已完成并验收）

| 项 | 状态 | 证据 |
|---|---|---|
| P0.1 `lib/generation-trace.ts` | ✅ | 事件类型 + `extractSectionAwareness` + `reconcileSectionUnderstanding` 纯函数 |
| P0.2 ai-provider 接入 | ✅ | messages 提变量；model.request/response 事件（含原始返回）；无 runId 不落盘 |
| P0.3 site-generator 接入 | ✅ | run.begin/batch.start/batch.result/batch.adopted/fallback/run.outcome 全链路 |
| P0.3b 逐槽对账聚合（审查修正） | ✅ | reconcile 调用 + `GenerateDraftOutcome.sectionUnderstanding` |
| P0.4 route 透传 | ✅ | done payload 含 sectionUnderstanding |
| P0.5 单测 | ✅ | `tests/generation-trace.test.ts` 10 测试全绿；**全量 308 测试通过** |
| P0.6 automation.md | ✅ | `documentation/automation.md`（shipping-artifacts 规范，含 7 项已知缺口诚实标注）|
| P0.7 端到端验收 | ✅ | 真实 DeepSeek 生成（HTTP 200），JSONL 14 事件链路完整 |

**P0.7 验收发现（痕迹系统的第一个真实产出）**：
一次真实运行 trace 显示：`batchA ok(7 ops, hero 落 3 槽)` → **`batchB ok=False`** → 4 次 recovery 请求**全部无 model.response**（未返回即结束）→ `run.outcome: partial, missing=[about,features,services,products,contact]`；SSE 同时报 `quality.score=0, publishable=false`。
→ 这类"静默半失败"过去完全不可见；现在**可定位到批次、逐槽落地情况、降级路径**。这正是 P0 的目标。

---

## 计划审查记录（第二轮，2026-09-08，含代码证据）

| # | 发现 | 证据 | 处置 |
|---|---|---|---|
| 1 | **P2 门禁会误杀"意图即通用"的模板** | 实测 12 模板 30+ 槽的 `presentAs` 明确写"由通用承载"（forge/screwfast products、screwfast/astro-starter about/contact…）；`renderAdditionalProducts` 无条件调用 | ✅ 已修（P2.1 改为意图感知豁免表）|
| 2 | **P0 的"逐节可核查"承诺实现不完整** | 审查时 grep：site-generator 中 batch.start/batch.adopted 计数为 0，reconcile 无调用点 | ✅ 已修（P0.3b）|
| 3 | **P0.7 验收依赖真实 API，可能做不了** | 47 个测试全离线 mock；runbook 自认"真实 provider 样本未采集" | ✅ 已修：实测 `.env.local` key 连通（HTTP 200），走通真实路径；若不可用则降级 mock |
| 4 | **P1.7"重跑基线"缺可复现前提** | `成品展示/` 目录当前为空；模板 dist 被 gitignore | ⚠️ 待办：P1 前需用固定草稿 + 本地快照重建基线 |
| 5 | 计划文档结构劣化（PART 3/6 位置错乱） | — | ✅ 本次重排 |

**What's Well-Reasoned（本轮）**：根因判断经两轮独立验证（A8 由 intended-vs-implemented 证实；"适配缺节 vs 模型没理解"分流在 screwfake 成立）；P0 工程细节克制（flag 默认关、gitignore 实测覆盖、fail-open、无 apiKey、无 runId 不落盘）。

---

## 红队审校记录（strategy-red-team，2026-09-08）
Top Kill-Assumptions 处理状态：
1. 强制产证=抄写假阳性 → **已修**（P1.3 硬指标改为操作贴合容量/兜底一致性，nativeRole 降为软信号）
2. P4 新节落在门禁盲区 → **已修**（P2.3 词汇表注册表泛化前置）
3. P4 采购前提未验证且排最后 → **已修**（P4.1 供给调研前置 + 自建触发范围审查）
4. P0→P1 无数据闸口 → **已修**（P1.6 数据闸口 + 层判断）
5. 验收判据循环（LLM 审 LLM）→ **已修**（P1.7 已知失败产出重跑基线）
6. A8 与主旨矛盾 → **已修**（回主线 P2.5/P3.5）
自相矛盾点与 What's Well-Reasoned 见对话记录；PART 5 补工期预估。

## 装配与验证先行（执行序变更，2026-09-08 用户定）
用户要求：**先做安装 skill 的任务 → 用装好的 skill 逐个实际使用 → 依据使用结果重新制定计划**（而非直接进入 P0-P5 实现）。因此：

1. **安装批次**（按计划 PART 1 推荐）：
   - phuryn/pm-skills 全套（plugin marketplace）：`claude plugin marketplace add phuryn/pm-skills` → `claude plugin install pm-ai-shipping@pm-skills`（shipping-artifacts/intended-vs-implemented）、`pm-execution@pm-skills`（strategy-red-team/red-team-prd 已手动装、去重）、`pm-market-research@pm-skills`、`pm-product-discovery@pm-skills`、`pm-product-strategy@pm-skills` 等按需；
   - 单 SKILL.md 类（复制到 `~/.claude/skills/`）：menkesu `quality-speed`、superpowers `systematic-debugging`/`receiving-code-review`、mhattingpete `review-implementing`；
   - alirezarezvani `adversarial-reviewer` 若格式兼容并入。
2. **逐个实际使用（验证好用性）**：对每个新装 skill，用本项目真实材料触发一次（如 intended-vs-implemented 审"成品展示/恒固 vs 任务书"、quality-speed 决策"P3 打磨度"、systematic-debugging 复现一个已知 bug、red-team-prd 复审本计划）——验证描述匹配能自动加载、方法可用、输出有质量。
3. **据使用结果重新制定计划**：汇总各 skill 实际表现（命中/可用/质量/噪音），用它改进的计划方法论重制 PART 2/4 的执行方案（哪些方法值得内建、哪些不适用）；更新计划文件并让用户复审。
4. **全局 CLAUDE.md 触发点**（PART 1 装配步骤 2）随之落地。

> 注：`claude plugin eval` 可对已装 skill 跑用例打分（本项目尚无 evals/**case.yaml），可作为"好用性"的客观补充，可选。

**下一步**：经你批准后，按 **P0（诊断）→ P1.6 数据闸口 → 依 trace 数据决定 P1（提示词）还是 P2（适配/门禁）先行** 推进；P3 直接编辑拆出"资产槽升级"与"点选交互"两子计划；P4/P5 依赖前序体系成熟。推荐首跑：P0 → P2 门禁先行止血，P1 提示词跟进。
## 验证（端到端，按能力分层）

**环境前提**：本地跑 Docker（`docker compose up -d`），与 PR/他人环境一致（`SITE_STORE=postgres`，存证两边都写）。

1. **机械层（负责拦，进 CI）**：`npm test` + `npx playwright test e2e/specs/coverage-scan.spec.ts --project=chromium --workers=1`；断言 fidelity（意图感知豁免）、无 demo 残留、槽位覆盖。
2. **存证层**：Docker 环境跑真实生成 → 查 PG `generation_records`（outcome/partial/missing/fallback_reason/section_understanding 有值）；partial/error 时 JSONL 过程痕迹自动落盘。
3. **行为/网络层（截图盲区）**：表单提交可达性（A8）；图片/字体外链扫描（国内可访问性）；离线导出渲染。
4. **视觉预筛（仅作线索，不作判据）**：截图后我逐张看，只报两类——① 明显垃圾（英文看板残留、demo 文案）② 资产适配性（图与业务搭不搭）；产出"待人工确认清单"，**最终判定交给你/客户**。
5. **并排对照**：模板原版 demo vs 注入后成品，差异归因到"模板本身"或"我们改坏"。
6. **发布前**：机械门禁 + 行为检查全过才放行；视觉预筛结论作为参考项。

> **判据优先级**：机械断言 > 行为验证 > 人工确认 > 我的视觉预筛。任何"我觉得好看/难看"的结论都必须能被前一层证伪。

## 不做的（明确范围）
- A12 商业模式转型（工具 vs 代建）→ 用 PM skill 出判断框架，不改架构。
- 非质量问题（产品路线）不在本计划。
- ~~A8 询盘表单死链~~（红队修正后已回主线，见 P2.5/P3.5，不再单列排除）。

## 变更文件一览
新增：lib/generation-trace.ts、tests/generation-trace.test.ts、（可选 2 个自定义 SKILL.md）。
修改（P0-P2）：lib/ai-provider.ts、lib/site-generator.ts、lib/generation-record.ts、lib/prompt-registry.ts、lib/template-manifests/shared.ts(role 令牌)、app/api/sites/[siteId]/generate/route.ts、app/api/templates/[templateId]/preview/route.ts、scripts/visual-review.mjs、app/generate/page.tsx、e2e/helpers/coverage-scan.ts、tests/site-generator.test.ts、tests/prompt-registry.test.ts、tests/generation-provenance.test.ts、d:\sitecraft-ai\CLAUDE.md（装配触发点）。
修改（P3 直接编辑）：资产槽升级（template-manifests 类型 + NON_CONTENT_SLOTS）、iframe 点选交互组件、assets 持久化、chat 上下文加入渲染 DOM/截图、vendor 模板本地化快照。
新增（P4 行业模板）：vendor 引入管线脚本、8 行业模板目录、新 presentation role（certificate/strength/news/map）、manifest+adapter 生成。
新增（P5 复刻学习器）：模板识别/生成脚本（截图/URL→结构化描述→骨架模板）、合规审查。
> 采购/授权（P4）、A12 商业模式立项：不在本计划代码范围内，需单独排期。（A8 已回主线，见 P2.5/P3.5，不在此列。）


---

# 模块收口记录（2026-09-08 晚）— 提示词/质检器/发布门三端对齐

> 状态：**代码完成并单测全绿（360 项）**；剩 1 项 e2e 断言未收敛（见「明日待办 #1」）。
> 明天从这里继续。

## 一、本次解决的问题（根因链，均有代码证据）

**症状**：真实生成草稿 quality.score = 0 → 发布被拦。

**根因（三层互相打架 + 一个坏种子）**：

| # | 位置 | 问题 |
|---|---|---|
| 1 | `lib/ai-provider.ts` 四处 | 教 AI「缺失事实写**待补充**」 |
| 2 | `lib/content-quality.ts:25` | 把「待补充」与 `lorem ipsum` 归为**同一类扣分** |
| 3 | `app/api/sites/[siteId]/publish/route.ts:63` | 分数不达标 → **直接拦截发布** |
| 4 | `lib/site-document.ts` 默认草稿 | `hello@example.com`、`about.body` 含「…将明确标记为待补充」、`products.intro` 含「可通过表格导入并由 AI 修改」——**产品自带的假数据/内部说明** |

**后果**：AI 越诚实标注 → 越发布不了；编造假信息反而干净。**激励反转**。

## 二、设计决策（用户已拍板）

**核心原则：按「谁该负责」分类，而不是按「看起来像不像问题」分类。**

| 内容状态 | 例子 | 责任方 | 质检 | 发布门 |
|---|---|---|---|---|
| **伪造** | `example.com`、`lorem ipsum` | AI 造假 | 重扣 | **阻断** |
| **该写没写** | 首屏标题=`待补充`、正文空 | AI 偷懒 | 重扣 | **阻断** |
| **元说明** | 「…将明确标记为待补充」 | AI 写错位置 | 重扣 | **阻断** |
| **破版/语言漂移** | 标题撑爆排版 | AI | 中扣 | **阻断** |
| **事实缺失** | 电话/邮箱/地址 = 空 或 `待补充` | **用户** | 轻扣 | **不阻断**，发布时隐藏该字段 |

**质量分档（用户已定三档）**：≥90 可直接发 / 70-89 可发建议再改 / <70 建议先完善；有阻断项一律 blocked。

## 三、已完成改动（文件清单）

| 文件 | 改动 |
|---|---|
| `lib/template-content-coverage.ts` | 新增 `placeholderTargets`/`fabricatedTargets` 分类；`registerPlaceholderTolerantSemanticType` 注册表（只有 contact_phone/email/address 容忍「待补充」）；`isPlaceholderValue`（剥标记后残留≤10字）/`isGarbageValue`（example.com/net/org、*.example/.test/.invalid、lorem） |
| `lib/content-quality.ts` | 新增 `metaCommentaryTargets` 阻断项；`QUALITY_TIERS`/`qualityTier`/`QUALITY_TIER_LABELS` 三档；修复同一槽位 missing+placeholder 重复扣分 |
| `lib/site-operations.ts` | `validateGenerationOperations` 从**黑名单**改为**按场景白名单**（draft/regenerate/regenerate-structure）；新增容量校验（净增投影，add/remove 配对不误杀） |
| `lib/site-generator.ts` | 三处调用点传容量上下文与场景 |
| `app/api/templates/[templateId]/preview/route.ts` | `setTextOrHide` + `hideIfAllSlotsHidden` + `scrubPlaceholders`（发布态全页清扫，兜住 adapter 绕过路径）；`isPublishedVariant()` 实时判断（不能顶层缓存） |
| `app/api/sites/[siteId]/publish/route.ts` | 阻断项重定义；`factsOnly` 放行保留 |
| `lib/site-document.ts` | 默认草稿清理：email 改「待补充」、about.body/features.items[0]/products.intro 去掉内部说明语 |
| `app/workspace/page.tsx`、`app/generate/page.tsx` | 同步新字段 + 档位文案 |
| 测试 | `tests/site-operations.test.ts` +5、`tests/content-quality.test.ts` +3、`tests/template-content-coverage.test.ts` 契约更新、`e2e/specs/publish-rollback.spec.ts` +2 |

## 四、验证结果（真实输出）

```
npm test        → tests 360 / pass 360 / fail 0
npx tsc --noEmit → 无错误
三场景实测：
  A 仅事实缺失        | score=92  publishable=true   ← 可上线，缺口字段隐藏
  B 伪造邮箱          | score=80  publishable=false  ← 阻断
  C 首屏标题=待补充   | score=80  publishable=false  ← 阻断
```

## 五、明日待办（按优先级）

### 🔴 #1 收敛 e2e 断言「发布页隐藏待补充」（唯一未完成项）

**现象**：`e2e/specs/publish-rollback.spec.ts:157` 断言 `frame.getByText("待补充")).toHaveCount(0)` 失败。
快照显示 contact 区仍有 `generic [ref=e180]: 待补充`，而邮箱已渲染。

**已确认的事实**：
- `scrubPlaceholders()` 已定义且在 `variant === 'published'` 时调用（route.ts:182/869）
- 该「待补充」节点**不在** `[data-sitecraft-contact-details]` 内（浏览器 locator 找不到）
- 调试脚本因 iframe 帧获取问题未跑通（`page.frames()[1]` 为 undefined，需用 `frameLocator` 而非 `frames()`）

**下一步**：用 `page.frameLocator("iframe").locator("body").evaluate(...)` 定位该节点的**祖先链**与 `data-sitecraft-slot`，判断它是：
- (a) adapter `prepareFn` 写进 footer 的（则 `scrubPlaceholders` 应能覆盖，需查为何没生效——注意 `prepareTemplate()` 在 route.ts:675 执行，**早于** 869 的 scrub，顺序是对的）
- (b) 模板原生 DOM 里的文本（则需在 scrub 的候选选择器里补 `footer` 相关标签）

**修完后**：`npx playwright test e2e/specs/publish-rollback.spec.ts --project=chromium --workers=1`

### 🟡 #2 审计剩余项（已记录，未修）

1. `scripts/export-henggu.mjs:41,50` 仍有 `['hello@example.com', ...]` 替换残留——确认用途后清理
2. `documentation/automation.md:60` 文档过期：仍写「115s 服务端截止」，实际已改动态预算（115s–600s）
3. `automation.md:50` 声称的「操作白名单校验」硬护栏——本次已修（见 site-operations.ts），需同步更新文档措辞
4. 容量约束只覆盖 `features`/`services` 卡片；`products` 数量无上限（AI 无法加产品，风险低）

### 🟢 #3 回到主线

- **P3 直接编辑**（用户最高优先级）：点选编辑 + 图片替换
- **P4/P5 模板扩展**

## 六、方法论备注（供复用）

本次沿用「先建可观测 → 再定位 → 后加固」：先加 `generation-trace` 留痕，才发现 quality=0；再按 intended-vs-implemented 做三角色对账，才挖出「默认草稿自带假数据」这个更深的种子。**教训：默认值也是产品文案，必须与质检口径一起审。**

---

# 三角色协同重构方案（2026-09-08 调研 + 红队修正版）

> 状态：**待你审批后执行**。已过 sage 调研 + strategy-red-team 攻击，砍掉 3 项伪需求。

## Context（为什么做）

本次修复暴露的根本问题不是某个 case，而是：**提示词 / 质检器 / 发布门三者是"三份独立实现同一个策略"，而不是"三份实现同一个契约"**。

直接证据：修「待补充」语义时，我**必须同时改三处**（`ai-provider.ts` 四处文案、`content-quality.ts` 正则、`publish/route.ts` 阻断项）才生效——漏一处就静默失效。这不是第一次，也不会是最后一次。

## 调研结论（sage 流程，来源已标）

| 来源 | 核心做法 | 采纳点 |
|---|---|---|
| [Policy-as-Prompt (NeurIPS 2025)](https://www.emergentmind.com/papers/2509.23994) | 把规范编译成 **source-linked 策略树**，同一棵树产出①人类可读文档 ②提示词文本 ③运行时拦截器 | **策略树 = 单一真相源** |
| [Input/Output Guardrails](https://www.agentpatternscatalog.org/patterns/input-output-guardrails/) | 校验层放在**模型之外**；validators 是**可复用积木**；single chokepoint + 集中审计 | 发布门只问决策 |
| [LLM-as-Judge](https://www.agentpatternscatalog.org/patterns/llm-as-judge/) | 结构化分数 + **rationale**；"scores are **advisory unless calibrated**" | 分数降级为辅助 + 带理由 |
| [Duda AI-ready templates](https://developer.duda.co/docs/building-ai-ready-templates) | **靠模板构造 + opt-out 开关**，无发布时校验 | 反面对照：我们不退化 |

**明确不做**：不引入 LLM-as-Judge 让模型审模型（搜索结论：judge 必须用**不同模型族**，我们只有 DeepSeek，同族评审可疑）。

## 🔴 红队修正：原方案 6 项砍到 2 项

| 原项 | 判定 | 证据 |
|---|---|---|
| ① 策略树 + 三者派生 | ✅ **做** | 真实发生过三处不一致的 bug |
| ② 质检器加 `presentation` 参数 | ❌ **砍** | **161 份草稿 0 次超容量**（实际最大 features=6/services=4）；schema 已有 `.max(12)` |
| ③ 发布门改问决策 | ✅ **做** | `publish/route.ts:68` 手工列 `hardBlockers`，今天加 `metaCommentary` 时确实改了两处 |
| ④ `factsConfirmed` 落库 | ⏸️ **延后** | 无证据表明是痛点 |
| ⑤ 接 `hideUnlessFilled` | ❌ **砍** | **22 个模板文件 0 个标注**（只有类型定义）；且现有 `scrubPlaceholders` 已覆盖该场景 |
| ⑥ 删硬编码 15/40 | 🔴 **改方案** | 见下「关键修正」 |

### 关键修正：`maxLength` ≠ 可读性推荐值

红队指出原方案会**引入行为退化**。实测：

| 槽位 | `maxLength`（schema 硬上限） | 提示词/质检器限制（可读性） |
|---|---|---|
| `hero.title` | **160** | 15 汉字 / 10 词 |
| `about.body` | **800** | 40 汉字 / 25 词 |

**若统一用 `maxLength`，标题允许 160 字——比现在松 10 倍，直接放过撑爆排版的长标题。**

→ **修正**：两个约束**并存**，都进策略树，但 severity 不同：
- 超 `maxLength` → `block`（存不下/破版）
- 超 `recommendedLimit` → `warn`（读着累，不拦）

需给 `TemplateSlotBinding` 新增 `recommendedLimit?: { zh?: number; en?: number }` 字段（当前只有 `maxLength`，见 `lib/template-manifests/types.ts:27`）。

## 最小可行重构（MVP 范围）

### 目标
三者从同一棵树派生，**不改现有行为**（360 项测试全绿 + 三场景分数不变）。

### 新增 `lib/content-policy.ts`

```ts
export type PolicyRuleId =
  | "fabricated" | "missing" | "meta_commentary" | "over_limit"
  | "language_drift" | "fact_gap" | "unverified_fact";

export type PolicyRule = {
  id: PolicyRuleId;
  severity: "block" | "warn";        // block=拦发布 / warn=提示
  owner: "ai" | "user" | "template"; // 决定"该谁动手"
  weight: number;                    // 质检扣分
  promptRule?: string;               // 提示词规则文本（空=不注入）
  message: string;                   // 用户可见文案
  hideOnPublish?: boolean;           // 发布时隐藏对应字段
};
```

### 三者派生

| 角色 | 改动 | 文件 |
|---|---|---|
| **提示词** | 规则文本从 `policyRulesText()` 派生；长度约束从 manifest 的 `recommendedLimit` 派生 | `lib/ai-provider.ts`（删 4 处手写文案） |
| **质检器** | 每条 finding 带 `{ruleId, owner, severity, message}`（= LLM-as-Judge 的 rationale） | `lib/content-quality.ts` |
| **发布门** | 改调 `policyDecision(report)`，不再手工列 `hardBlockers` | `app/api/sites/[siteId]/publish/route.ts:68` |

### 同源性测试（红队要求，方案成立的前提）

遍历策略树，断言每条规则在**三处的行为一致**：

```ts
for (const rule of POLICY_RULES) {
  if (rule.promptRule) assert.ok(promptText.includes(rule.promptRule));
  if (rule.severity === "block") assert.ok(blockingIds.includes(rule.id));
  assert.equal(rule.severity === "block", !allowsPublishWith(rule.id));
}
```

**若写不出这个测试，说明同源性没建立**——红队明确指出：测试只能验行为一致，验不了实现同源，所以必须显式设计这个断言。

## 验收（三步）

1. **回归**：`npm test` 360 项全绿；`npx tsc --noEmit` 无错
2. **行为不漂移**（红队 kill criterion）：重构前后跑同一组三场景，**分数必须完全相同**
   - A 仅事实缺失 → 92 / publishable=true
   - B 伪造邮箱 → 80 / publishable=false
   - C 首屏=待补充 → 80 / publishable=false
3. **新增**：同源性测试通过

## 风险与回退

| 风险 | 缓解 |
|---|---|
| 重构改变行为（今天已有先例：加 `metaCommentary` 后默认草稿文案被拦） | 验收第 2 步锁死分数 |
| 工时超预期 | MVP 只做 ①②③，不做 ④⑤；超 1 天即停 |
| 策略树变成"第四份实现" | 同源性测试是唯一防线 |

## 执行顺序

1. 先跑「重构前」三场景，**记录分数基线**（防止验收时无参照）
2. 建 `content-policy.ts` + 同源性测试
3. 改提示词派生（删手写文案）
4. 改质检器带 rationale
5. 改发布门调 `policyDecision`
6. 跑验收三步

> 前置依赖：`TemplateSlotBinding` 加 `recommendedLimit` 字段（否则长度约束无法去重）。

## 来源清单（sage 证据链）

- Policy-as-Prompt: https://www.emergentmind.com/papers/2509.23994
- Input/Output Guardrails: https://www.agentpatternscatalog.org/patterns/input-output-guardrails/
- LLM-as-Judge: https://www.agentpatternscatalog.org/patterns/llm-as-judge/
- Duda AI-ready templates: https://developer.duda.co/docs/building-ai-ready-templates
- Temporal HITL approvals（④ 延后，留作参考）: https://docs.temporal.io/guides/reliable-document-approvals

**通道说明**：GitHub raw / r.jina.ai 本机不通（curl 返回 000）；WebFetch 预检被 cc-switch 覆盖，本次已重加 `skipWebFetchPreflight` 后恢复。调研全程用 WebSearch + WebFetch。

---

# 📋 总任务看板（2026-09-09 逐项核验版）

> **本看板是唯一进度真相源**。每项状态均已用命令核验，不照抄计划原文。
> 状态定义：✅完成（有证据） / ⚠️部分（列出具体缺什么） / ❌未开始

## ✅ 已完成

| 项 | 证据 |
|---|---|
| P0.1-P0.7 可观测全链路 | `lib/generation-trace.ts`；360 项测试；真实生成 JSONL 14 事件 |
| P1.1 `draft_operations` v2 | `lib/prompt-registry.ts:27` |
| P1.2 提示词强化 | 冻结骨架 / 宁缺勿假 / 逐节自查 |
| P1.3 强制产证 + 对账 | `templateAwareness` + `section_understanding` 列 |
| P1.4 兜底显性化 | `generatedContentSections`、generate 页提示、visual-review fidelity |
| P1.5 契约测试同步 | 已更新 |
| P2.1 门禁三层 L1/L2/L3 | `lib/template-fidelity-guard.ts` |
| P2.6 采样验证取消 | 按用户决定 |
| 三角色调研 + 红队 + 沉淀 | `docs/solutions/20260908-three-role-policy-architecture.md` |
| 三端对齐修复（2026-09-08 晚） | 360 项测试全绿 + 三场景实测 |

## ⚠️ 部分完成（缺什么已列清）

| 项 | 已完成 | 缺 |
|---|---|---|
| **P1.7** 47 产物检测 | 跑过 8 个，抓 3 缺陷 | ❌ 47 个全量未跑（fidelity JSON = 0） |
| **P2.2** 词汇表泛化 | 注册表函数 4 个 | ❌ `PresentationRole` 仍硬编码联合类型（`types.ts:55`）<br>❌ `TARGET_SLOT_PREFIXES` 硬编码（`template-slot-guard.ts:354`）<br>❌ `REQUIRED_TARGETS` 硬编码（`e2e/helpers/coverage-scan.ts:102`） |
| **P2.1** `nativeFallbackHost` | 13 模板已标 | ❌ **9 模板 0 标注**：astrofy / astropaper / devportfolio / kindred / moon / nextjs-landing / shadcn-landing / tailwind-landing / yukina |
| **P2.4** 历史清理 | A9 已固化检测规则 | ❌ A10 中文容量未做<br>❌ A11 SEO/域名未做 |
| **P3.1** 点选编辑 | `selectPreviewTarget` 点选→填 AI 对话框 | ❌ **不是就地编辑**（改完仍需点发送） |
| **P3.4** 本地化 | 20 个模板有 dist | ❌ 缺 2 个（共 22 模板目录） |

## ❌ 未开始

| 项 | 说明 |
|---|---|
| P2.3 / P3.5 A8 询盘表单 | `contact.formAction` 仍 `support: "unsupported"` |
| P2.5 门禁全量验收 | 47 产物跑 L2/L3 |
| P3.2 图片可替换 | `draft.assets` 不存在 |
| P3.3 AI 具身上下文 | 只传 draft JSON |
| P3.6 打磨分层 | 未定收手线 |
| P4 全部（5 项） | 未开始 |
| P5 全部（4 项） | 未开始 |
| 三角色重构 MVP | 方案已定，见本文件「三角色协同重构方案」 |
| F1 Docker 验证 | 发布前跑一次 |

---

## 执行顺序（2026-09-09 定稿：单线推进，不延后）

> **原则**：按架构依赖排序，一条线做到底；每项完成后汇报并更新本看板。

| # | 任务 | 为什么在这个位置 | 状态 |
|---|---|---|---|
| 1 | **三角色重构 MVP**（策略树 + 同源性测试） | **契约层**：后续新增任何内容规则都注册进它 | ✅ **完成 2026-09-09** |
| 2 | **P2.2 词汇表泛化**（槽位词表 → 注册表） | **词汇层**：P4/P5 新节必须先有注册表 | ✅ **完成 2026-09-09** |
| 3 | **P2.1** `nativeFallbackHost` 接线 | 原以为是补标注，核实后是**接线** | ✅ **完成 2026-09-09** |
| 4 | **P2.4** A10 中文容量 + A11 SEO/域名 | 内容与可发现性 | ✅ **完成 2026-09-09** |
| 5 | **A 精修现有 22 模板** | A1✅ A2✅ A3⬜ A4⬜ A5⬜ | ⏳ 进行中 |
| 6 | **P3.6** 定打磨收手线（quality-speed 矩阵） | 划边界再动手 | ⬜ |
| 7 | **P3.1** 点选就地编辑 | P3 地基 | ⬜ |
| 8 | **P3.2** 图片可替换（资产槽升级 + `draft.assets`） | 依赖 #7 | ⬜ |
| 9 | **P3.3** AI 具身上下文（DOM 摘要进 chat） | 依赖 #7 | ⬜ |
| 10 | **P3.5 + P2.3** A8 询盘表单 | 独立，与 #7-#9 同域 | ⬜ |
| 11 | **P3.4** 本地化补齐 2/22 | 独立 | ⬜ |
| 12 | **P4** 国内行业模板库 | 依赖 #1、#2 | ⬜ |
| 13 | **P5** 模板学习器 MVP | 依赖 #12 | ⬜ |
| 14 | **F1** Docker 一致性验证 | 发布前一次 | ⬜ |

## 维护规则（防止"没完成却标完成"）

1. **改状态必须贴证据**：命令输出、测试结果、文件行号；无证据不得标 ✅。
2. **⚠️ 必须写清"缺什么"**，不允许笼统写"部分完成"。
3. **每次收口时更新本看板**，并核对是否有新增的"部分完成"项。
4. 计划正文（PART 2/PART 4）保留原始设计意图，**本看板是执行真相源**；两者冲突时以本看板为准。


---

## #1 三角色重构 MVP — 完成记录（2026-09-09）

### 交付物

| 文件 | 内容 |
|---|---|
| `lib/content-policy.ts`（新增） | 策略树：7 条 `PolicyRule`（id/severity/owner/weight/label/message/promptRule/hideOnPublish）+ `policyRulesText()` + `qualityScore()` + `policyDecision()` |
| `tests/content-policy.test.ts`（新增） | **同源性测试 9 项**：字段完整性 / 提示词派生 / 发布门派生 / 豁免唯一性 / 权重一致 |
| `lib/content-quality.ts` | 分数与 `publishable` 改由策略树派生；报告新增 `counts` 字段 |
| `app/api/sites/[siteId]/publish/route.ts` | 删掉手工列的 `hardBlockers`/`factsOnly`，改调 `policyDecision(counts, factsConfirmed)` |
| `lib/ai-provider.ts` | 规则段改由 `policyRulesText()` 派生，删掉重复手写项 |
| `lib/prompt-registry.ts` | `draft_operations` v2→**v3**（规则段来源变更） |

### 验证（红队 kill criterion）

```
重构前基线：A=88/true  B=82/false  C=82/false
重构后实测：A=88/true  B=82/false  C=82/false   → ✅ 行为零漂移

npm test          → 369 项全绿（新增 9 项同源性测试）
npx tsc --noEmit  → 无错误
publish-rollback e2e → 5/5 通过
```

### 效果

- 改一条内容规则 = 只改 `content-policy.ts` 一处，提示词/质检器/发布门自动跟上
- 发布门不再自己判断"哪些字段算阻断项"（此前加 `metaCommentary` 时要改两处）
- 每条判定带 `label`/`message`（LLM-as-Judge 的 rationale），用户能看懂为什么被拦

### 已知未做（红队砍掉，非遗漏）

- ❌ 质检器加 `presentation` 参数（161 草稿 0 次超容量）
- ❌ 接 `hideUnlessFilled`（22 模板 0 标注）
- ❌ `factsConfirmed` 落库（无证据是痛点）
- ❌ 长度约束双字段化（`recommendedLimit`）——**留待 #4 A10 中文容量一起做**，避免二次改类型


---

## #2 词汇表泛化 — 完成记录（2026-09-09）

### 做了什么

把"新增行业节时必须改的硬编码点"从 **4 处**清零到 **0 处**：

| # | 原硬编码 | 位置 | 改为 |
|---|---|---|---|
| 1 | 槽位取值 `switch(target)` | `lib/template-content-coverage.ts` | **`registerTargetResolver()` 注册表**（新节在自己的模块注册一次） |
| 2 | 同一 switch 的副本 | `lib/content-quality.ts:92` | 删除，复用 `resolveDraftTarget()`（单一真相源） |
| 3 | `TARGET_SLOT_PREFIXES` 固定表 | `lib/template-slot-guard.ts:354` | `registerRequiredTargetPrefix()`；五节前缀=节名已由 fallback 覆盖，只登记 hero/brand 别名 |
| 4 | `REQUIRED_TARGETS` 固定 10 项 | `e2e/helpers/coverage-scan.ts:102` | `requiredTargetsFor(templateId)` **从 manifest 的 `slot.required` 派生** |

### 关于 `PresentationRole`（核实后未改，有理由）

原计划要泛化它，但核实发现：**它只用于字符串相等比较和提示词文本，没有任何穷举 switch**。
→ 新增 role 是纯类型变更，零运行时风险，**不需要注册表**。计划中的这条判断不成立，如实修正。

### 验证（行为中立性已证实）

```
22 个模板的 manifest required 与旧硬编码列表：0 处差异
  → 泛化只对未来新增节生效，不改变现有行为

npm test            → 375 项全绿（新增 6 项注册表测试）
npx tsc --noEmit    → 无错误
template-content-coverage e2e → 4/4 通过
```

### 对 P4/P5 的意义

新增行业节（资质墙/厂房/新闻/地图）现在只需：
1. 在 manifest 里声明槽位（`required: true` 自动进覆盖检查）
2. 调用 `registerTargetResolver()` 注册取值
3. 调用 `registerSectionType()` 注册门禁节类型

**不用改任何核心文件**。


---

## #3 `nativeFallbackHost` 接线 — 完成记录（2026-09-09）

### 任务前提被推翻（如实记录）

计划原文是「补 9 模板的 `nativeFallbackHost`」。核实后**两项都不成立**：

| 原判断 | 核实结果 |
|---|---|
| 9 个模板缺标注 | ❌ 它们用 `defaultPresentation()`（`card_grid`）或原生 `product_grid`——**本就不该标 generated**。一个都不需要补 |
| 该字段已生效 | ❌ **从未被任何地方消费**（32 处标注是死数据）——`evaluateFidelity` 无人传 `manifestHosts` |

**真实缺陷**：声明了 `nativeFallbackHost: "generated"` 的节，门禁 L3 仍按注册表 `requiresNative` 判违规 → **误报**。

### 做了什么（接线，非补数据）

| 文件 | 改动 |
|---|---|
| `lib/template-fidelity-guard.ts` | 新增 `manifestHostsFor(presentation)`；`evaluateFidelity` 接受 `presentation` 参数并自动派生 `manifestHosts`（显式传入优先） |
| `scripts/visual-review.mjs` | 传入 `getTemplatePresentation(templateId)`——**这是唯一的真实消费点** |
| `tests/template-fidelity-guard.test.ts` | +4 项：提取正确性 / 声明 generated 不误报 / 声明 native 仍判违规 / 显式优先 |

### 验证（真实模板数据）

```
signal.services 声明: generated
接线前 violation: true  → passed: false   ← 误报
接线后 violation: false → passed: true    ← 正确

npm test         → 379 项全绿（+4）
npx tsc --noEmit → 无错误
node --check scripts/visual-review.mjs → 语法通过
```

### 效果

- 声明「由通用承载」的节不再被误判为结构违规（减少假阳性）
- 声明「必须原生」却走兜底 = 真缺陷，仍被拦住
- `nativeFallbackHost` 从死数据变成**实际生效的显式声明**（与 Duda 的"模板侧显式声明"思路一致）

---

## #4 A10 中文容量 + A11 SEO — 完成记录（2026-09-09）

### A10 中文容量：提示词说了，代码没查

**问题**：`"中文按模板容量×0.9"` 只写在提示词里，代码侧无对应校验 → 提示词说了但没人检查 = 白说。

**改动**（`lib/content-quality.ts`）：
- 新增 `COPY_READABILITY` 常量：`title{zh:15,en:10}` / `body{zh:40,en:25}` / `chineseCapacityFactor:0.9`
- `exceedsCopyLimit` 用常量替代硬编码 15/40/10/25
- 中英混排时按系数折算取更严的一方，避免"中文超限但英文没超"漏判

**注**：红队指出的「`maxLength`(160) ≠ 可读性(15)」问题在此明确——两者**并存**，`maxLength` 管"存不下"，`COPY_READABILITY` 管"读着累"。

### A11 SEO：发布页此前零元数据

**问题**：发布页整体是客户端组件（`"use client"`），**没有 title/description/OG**——分享链接无预览、搜索引擎抓不到摘要。

**改动**：
| 文件 | 改动 |
|---|---|
| `lib/seo-metadata.ts`（新增） | `deriveSeoMetadata(draft, locale)` 纯函数：标题=公司名+首屏主张（截 60 字）；描述=副标题→简介→目标（截 160 字）；**占位/伪造值不得进 SEO**（搜索摘要里不能出现"待补充"/example.com） |
| `app/published/[siteKey]/page.tsx` | 改为**服务端外壳**：`generateMetadata` 读发布快照派生元数据；同时把草稿作为 `initialDraft` 传给客户端 |
| `app/published/[siteKey]/client.tsx`（由 page.tsx 拆出） | 原客户端逻辑；有 `initialDraft` 时跳过首屏 fetch |
| `tests/seo-metadata.test.ts`（新增） | 7 项：标题组成 / 描述优先级 / 占位剔除 / 伪造剔除 / 截断 / 多语言 / 空草稿兜底 |
| `tests/publish-contract.test.ts` | 断言更新到新架构（服务端外壳读快照 + 客户端回退走公开 API） |

**架构说明**：`release-store` 是服务端专用（PG/文件存储），不能进客户端包——这是拆分的根本原因，也是构建期暴露的（原方案直接 import 会构建失败）。

### 验证

```
npm test         → 386 项全绿（+7 SEO 测试）
npx tsc --noEmit → 无错误
npm run build    → 通过（/published/[siteKey] 为 ƒ Dynamic 服务端渲染）
SEO 实际输出（只读验证）：
  title:       "启衡工业 | 让精密制造更可靠"
  description: "为新能源设备提供精密组件与联合工程服务。"
  ogTitle/ogDescription 同源
```

**待复验**：`npx playwright test e2e/specs/publish-rollback.spec.ts`（Docker 重启后待跑）

### 附带修复

- **工作目录陷阱**：用 `cd app/published/[siteKey] && mv` 后，bash 工作目录持久化，导致后续 `playwright.config.ts: No such file`。已回到项目根，记录备查。

### 域名（A11 的另一半）

计划写的是「SEO/域名/部署」。**域名部分未做**——发布页目前用 `siteKey` 路径（`/published/<siteKey>`），自定义域名绑定属独立功能（DNS/证书/路由），不在本次范围内。**如实标注为未做**。


---

## #5 成品审计结论 + 方向调整（2026-09-09）

### 审计工具（新增，可复用）

`scripts/audit-deliverables.mjs` — 对 `成品展示/*.html` 跑 L2/L3 门禁，产出不合格清单。
**区分「对照基线」（模板原版/原生版）与「成品」**：基线本就含 demo 文案/图，不参与判定。

### 审计结果（8 个 HTML 产物）

```
总计 8 个（2 个对照基线不判定），待判定 6 个，不合格 2 个，通过率 67%
  资产(high): 东莞华固精密制造-成品、华曜新能源科技-光伏  ← 宇航员图
  结构违规:   0（修正后）
```

### 审计过程中的两个修复

1. **`card_grid` 误报修正**：12 个模板的 services 原生角色就是 `card_grid`（类型注释明说"唯一允许通用卡片渲染的角色"），但注册表 `requiresNative=true` 导致误判违规。→ `manifestHostsFor` 现在把 `role === "card_grid"` 自动视为允许通用渲染。
2. **宇航员图溯源**：`vendor/open-source-templates/moon/dist` 里就有该图 → **来自模板自身**，非我们注入。AI 未替换它。

### 🔴 用户方向调整（2026-09-09）

> 「我成品展示里面的内容很多都不合格所以没必要去改写他们，主要还是对我的那些开源模板做处理」
> 「先把 A 做完吧，我待会会给你发 P4 内容里的各行业模板，然后你进行处理」

→ **放弃修成品**，转向**精修 22 个开源模板**；P4 素材由用户提供。

---

## #5（新）A 精修现有 22 模板 — 待办清单

### 测量数据（2026-09-09 实测）

| 维度 | 现状 | 目标 |
|---|---|---|
| 本地快照 | **20/22**（缺 landwind、tailwind-landing） | 22/22 |
| 缺失节声明 | **24/132 节（18%）** | 0 |
| features 卡片墙 | **11/22** | 尽量原生 |
| services 卡片墙 | **12/22** | 尽量原生 |
| 无适配器 | **4 个**（nextjs-landing/kindred/shadcn-landing/tailwind-landing） | 补齐 |

### 待办（按优先级）

| # | 任务 | 说明 |
|---|---|---|
| A1 | 补 2 个本地快照 | landwind、tailwind-landing 缺 dist → 预览回退境外 demoUrl |
| A2 | 补 24 个缺失节声明 | astrofy(3)、astropaper(4)、yukina(4)、devportfolio(3) 最严重 |
| A3 | 补 4 个缺失适配器 | nextjs-landing/kindred/shadcn-landing/tailwind-landing |
| A4 | demo 资产处理 | 模板自带 demo 图（如 moon 宇航员图）→ 注入器覆盖或隐藏 |
| A5 | 复验 | 22 模板跑门禁 + 覆盖扫描，确认无回归 |

### 边界（诚实标注）

精修**解决不了信息架构错位**（landing page 骨架 vs 国内工厂站逻辑）——那是 P4 的职责。
A 的目标是"让现有模板的填充更贴合其原生排版"，不是"把它们改造成工厂站"。


---

## A1 + A2 完成记录（2026-09-09）

### A1：本地快照 —— **伪需求**

核实发现 `getTemplateStaticRoot` 已有兜底：无 `dist/` 时直接用根目录 `index.html`。
landwind、tailwind-landing 均为纯静态模板 → **实测预览走本地**（`X-Sitecraft-Preview-Source: local-open-source-snapshot`），不依赖境外。**无需处理。**

### A2：缺失节声明 24 → 0

**根因**：`defaultPresentation()` 本身**没有 hero 项**，导致 5 个用默认表的模板全缺 hero。

| 处置 | 模板 | 做法 |
|---|---|---|
| **修默认表** | （5 个受益） | `defaultPresentation()` 补 `hero_centered` 兜底 |
| **补 about 声明** | signal/powerai/lonestone/foxi | 首页确无 about（SaaS 落地页，about 在子页）→ 标 `nativeFallbackHost: "generated"` |
| **补 about 声明** | awesome | 确有 `#about` 区块 → 原生声明 |
| **补 hero/services/products** | astrofy/devportfolio | 作品集语义（projects/store）→ 原生声明 |
| **补 hero/services/products/contact** | astropaper/yukina | 博客语义 → 混合（有原生区的声明，无的标 generated） |
| **显式标注 card_grid** | 全部 | 19 处 `card_grid` 补 `nativeFallbackHost: "generated"`（不依赖隐式推导） |

### 验证

```
缺失节: 24 → 0 / 132
npm test         → 386 项全绿
npx tsc --noEmit → 无错误
22/22 模板均有承载声明
原生承载 90 节 | 通用兜底(设计内) 42 节
```

### 过程中的一次失误（已修复）

用 Python 脚本批量插入声明时**插错位置**（重复了 `{`），导致 4 个 manifest 语法错误、测试全红。
已修复并回归通过。教训：批量改源码后必须立刻 `tsc --noEmit` 验证。

---

# A3 / A4 / A5 + P3 执行计划（2026-09-09 定稿）

> 用户指令：**「到 P3 之前都不用问我直接做，然后再给我概括 P3 你打算怎么做」**。
> 本段即 A3→A5 的自主执行计划 + P3 的完整设计概括。P3 之前的每一步做完贴真实输出汇报。

## 核查结论（本轮新增，修正了 A 清单的两处前提）

| 原判断 | 核查结果 | 影响 |
|---|---|---|
| A8 询盘表单「死链，可能 mailto」 | ❌ **已打通**：发布态 form → bridge 拦截（`preview/route.ts:977-990`）→ `sitecraft:lead-submit` → `client.tsx:39-58` → `POST /api/public/[siteKey]/leads` → `lead-store.ts` 落库。测试：`tests/lead-store.test.ts` | P3.5 降级为「契约同步 + e2e 补断言 + 无 form 模板兜底」 |
| 4 个模板「缺适配器」 | ✅ 属实，但**不是阻断**：无适配器 = 走通用引擎（`route.ts:81-86` 全用 `?.` + 空默认），模板照常渲染 | A3 是**观感精修**，不是修 bug；优先级按「有无原生 CSS 类名/结构可利用」排序 |
| `hero.image` / `brand.logo` 是「待升级的资产槽」 | ❌ **纯死数据**：全仓仅存在于类型/manifest/测试，**无任何运行时消费点**（`shared.ts:14,21` 是唯一出现 selector 的地方） | P3.2 是**从零接线**，不是改开关 |

---

## A3 — 补 4 个模板适配器

**共同前提**：无适配器模板走通用引擎，通用引擎的定位全靠中文/英文语义正则（`scopeBy('about', /about|who we are|story|关于/i)` 等）。适配器的价值 = 用**模板已知的原生结构**替代猜测。

逐个的诊断与动作（均已读 manifest + vendor 产物）：

### A3.1 `nextjs-landing`（vendor 目录同名，有 `dist/index.html` + `src/`）
- 现状：manifest 只有 `hero.title`/`about.body`/`features.items`/`services.items`/`products`/`contact.title`/`contact.body` 的 demoFingerprints；**无 presentation**（走 `defaultPresentation()`）。
- 风险：`src/` 里是 React 组件，dist 是构建产物，**类名是 Tailwind 原子类**（无语义），通用 `scopeBy` 正则命中率低。
- 动作：读 `dist/index.html` 摸清分节（`#top`/`#about`/`#features`/`#services`/`#work`/`#contact`）→ 写 `nextjs-landing.ts` adapter：`prepareFn`（删 demo 导航冗余项、打 section id/scope）+ `heroFn`（`h1` 定位）+ `sanitize`（demo 残留正则）+ 可选 `designTokenCss`。
- **e2e 已存在** `e2e/specs/nextjs-landing-preview.spec.ts` → 改完直接跑它。

### A3.2 `kindred`（vendor 目录是 **`odyssey`**，注意映射）
- 现状：manifest 只有 2 个 demoFingerprints（`hero.title`/`contact.title`），**无 presentation**。
- 特点：Astro 主题，`dist/index.html` + `dist/company/`、`dist/blog/`、`dist/landing-pages/` 多页面。
- 动作：同上写 `kindred.ts` adapter；重点处理**多页导航**（首页只需 hero/features/services/contact，其余导航项要收敛为锚点或删除，避免点了跳到 demo 子页）。
- 参考同类 Astro 适配器：`lib/template-adapters/atlas.ts`、`astro-starter.ts`。

### A3.3 `shadcn-landing`（vendor 同名，有 `dist/` + 根 `index.html`，Vite+React）
- 现状：manifest 只有 `hero.title`/`about.body`，**无 presentation**。注意：**不要与 `shadcn-landing2` 混淆**——后者已有适配器（`lib/template-adapters/shadcn-landing2.ts`），可作参照。
- 特点：单页 div 结构、**无 `<section id>`**，通用 `scopeBy` 几乎无法定位。
- 动作：以 `shadcn-landing2.ts` 为蓝本写 `shadcn-landing.ts`；因无 section 锚点，`prepareFn` 需**按 DOM 顺序 + 标题文本双重判定**打 scope。
- **e2e 已存在** `e2e/specs/shadcn-pro-preview.spec.ts`、`shadcn-diag2/3.spec.ts`。

### A3.4 `tailwind-landing`（vendor 同名，**只有根 `index.html` + `hero.png`，无 dist/src**）
- 现状：manifest 只有 `hero.title`，**无 presentation**。
- 特点：单文件静态 HTML，结构最直白（`hero.png` 就是首屏图 → 也是 A4 的目标）。
- 动作：写 `tailwind-landing.ts` adapter，`prepareFn` 打 scope + 删 demo 链接，`heroFn` 定位 h1。这个最简单，可作为 A3 的**首个验证样例**（快速跑通「写 adapter → 通用引擎接管 → 覆盖扫描通过」的闭环）。

**A3 统一验收**：
```
npx tsc --noEmit                                  → 无错误
npm test                                          → 全绿（新增 adapter 契约测试）
npx playwright test e2e/specs/template-content-coverage.spec.ts --project=chromium --workers=1
npx playwright test e2e/specs/nextjs-landing-preview.spec.ts e2e/specs/shadcn-pro-preview.spec.ts --project=chromium --workers=1
node --experimental-strip-types scripts/audit-deliverables.mjs   → 结构违规仍为 0
```
每个 adapter 配一条 `tests/template-adapters.test.ts` 断言（注册存在 + 关键字段非空）。

---

## A4 — demo 资产处理

**核心判断：不改 `vendor/` 里的模板文件。** 理由：
1. vendor 是上游快照，改了会与上游漂移，后续升级/对照基线（`成品展示/*真实模板*.html`）失效；
2. 用户已定「别人拿到的要和本地 PR 一致」——改 dist 会让 PR 混入大量二进制 diff，审不动；
3. demo 图本身是模板身份的一部分，**正确解法是「运行时替换」而不是「从模板里删掉」**。

所以 A4 拆成三件**可验证**的事：

### A4.1 检测规则泛化（机械层，负责拦）
现状 `lib/template-fidelity-guard.ts:107-114, 227-242` 只认 `astronaut|宇航员|太空`（单个样本固化）。改为**模板 demo 资产特征注册表**：
- 新增 `registerTemplateDemoAsset({ templateId, pattern, reason })`，先扫 22 个模板的 hero 区首图，把**确属 demo 素材**的（如 moon 的 astronaut/moon 图、astroplate 的 `hero-image`、screwfast 的 `hero-image`）登记进去；
- 检测点从「只查 hero」扩展到 `extractImageAssets()` 已有的全量 `<img>` 扫描（`route.ts` 的 `detectAssetIssues`）；
- 新增单测：每个登记的模板，用其真实 dist HTML 断言命中。

### A4.2 归因清单（产出工单，指导 P3.2）
跑一个只读探针脚本（`scripts/scan-template-assets.mjs`），对 22 个模板输出：

| 模板 | hero 图 src | 是否 demo 素材 | 有几张 | 可定位性 |
|---|---|---|---|---|

这张表直接决定 **P3.2 的 `assetFn` 优先名单**——没有它，P3.2 的图片替换会大面积 `missing`。

### A4.3 运行时处置
- **默认**：保留模板原图（隐藏会破版，AI 无法生图——DeepSeek 不出图，这是硬约束）。
- **发布前**：`evaluateFidelity` 命中 demo 资产 → 列为 blocker 提示「首屏主视觉为模板示例图，请替换后发布」。
- **真正的替换**：由 P3.2 的图片替换完成（用户上传实拍图 → `draft.assets['hero.image']` → 运行时覆盖）。**A4 与 P3.2 是同一机制的两端**：A4 负责「发现并拦住」，P3.2 负责「换掉」。

**A4 验收**：`npm test` 全绿（新增 demo 资产注册表测试）；`scripts/scan-template-assets.mjs` 输出 22 行归因表；对 8 个 `成品展示/*.html` 重跑 `audit-deliverables.mjs`，demo 资产命中数与人工目视一致。

---

## A5 — 22 模板复验

A1-A4 全做完后的**统一回归**，证明精修没有引入回归：

```
# 1. 机械层
npm test                                          → 全绿
npx tsc --noEmit                                  → 无错误
npm run build                                     → 通过

# 2. 覆盖层（22 模板逐个）
npx playwright test e2e/specs/template-content-coverage.spec.ts --project=chromium --workers=1
npx playwright test e2e/specs/coverage-scan.spec.ts --project=chromium --workers=1

# 3. 门禁层（22 模板 fidelity）
node --experimental-strip-types scripts/audit-deliverables.mjs

# 4. 资产层（A4 探针）
node --experimental-strip-types scripts/scan-template-assets.mjs
```

**A5 交付物**：一张 22×5 的矩阵表（本地快照 / 适配器 / 承载声明 / 覆盖扫描 / 门禁），作为 A 板块的收口证据，并更新总任务看板。

---

## P3 — 直接编辑（设计概括）

### P3.6 收手线（先划边界，quality-speed 矩阵）

| 项 | 定位 | v1 做到什么程度 |
|---|---|---|
| 文本就地编辑的**映射正确性**与**失败可解释性** | 核心闭环 | **HIGH CRAFT**：每条映射规则有单测；映射不出来必须给人话原因，绝不静默 |
| 提交走标准 operation + 并发保护 | 核心闭环 | **HIGH CRAFT**：复用 `PUT /draft` + `baseRevision` + `expectedValue` |
| 图片替换的四种结果（成功/无图/多图/还原） | 核心闭环 | **HIGH CRAFT**：全部有明确 UI 反馈 |
| 发布态询盘闭环（含无 form 模板） | 核心闭环 | **HIGH CRAFT**：e2e 断言到落库 |
| 富文本、素材库、裁剪压缩、CRDT、局部 DOM patch、每模板 assetFn 全覆盖 | 外围 | **MOVE FAST / v1 不做** |

### P3.1 就地编辑

**复用而非新建**：写入口只有一个 —— `PUT /api/sites/[siteId]/draft`（`draft/route.ts`，45 行）→ `commitOperations`。就地编辑编译成一条标准 `set_text` 操作，历史/撤销/并发/导出零改动。

**反向映射**（新增 `lib/inline-edit-mapping.ts`，纯函数可单测）：`data-sitecraft-slot` 已编码 `{target}.{locale}`（`preview/route.ts:135-144` 的 `setText` 写入），直接解析：
- `hero.title.zh` → `set_text{target:'hero.title', locale:'zh'}`
- `companyName.zh` → 非本地化 target（**节点含 img/svg 时拒绝**，否则会抹掉 logo）
- `features.items.<id|index>.title.zh` → `update_card`
- `products.<sku>.name.zh` → `update_product`（sku 含 `.` 时贪婪匹配）
- 明确拒绝并给出原因：`footer.*`/`form.*`/`brand.logo`/`hero.image`/无 slot 节点

**协议**：新增 `sitecraft:edit-commit`（iframe→父）/ `sitecraft:edit-result`（父→iframe），`content`/`select`/`applied` 保持兼容。

**防闪烁四件套**（关键工程细节）：编辑中挂起 content 应用（`deferredContent`）/ 重试去重 2.5s 窗口 / 生成兜底区指纹跳过重建 / 滚动位置守护（`scrollBehavior='auto'` + 复原 `scrollTop`）。

> **⚠ 红队修正（2026-09-09，优先于上一句）**：实测（`probe-reinject-damage.mjs`，3 模板）全量重注入**滚动位移 0px、hero 节点身份保留、生成区未重建**——四件套里 **M1/M2/M4 实测不必要**。唯一真缺陷是**产品卡每次重建**（0/1 节点保留 → 图片重载闪烁）。
> **改为**：只做 **M3 指纹跳过重建，并扩展到 `renderAdditionalProducts` 的产品卡**（数量与内容未变则复用节点）；M1/M2/M4 降级为「实测出问题再补」，不预先写。

**顺手修 bug**：`preview/route.ts:1012` 的 `let target = 'products'` 兜底——无 slot 命中时误报 products，改为不发 `select`。

### P3.2 图片替换（资产槽升级）

**数据模型**：`SiteDraft` 新增 `assets: { "hero.image"?: {url,alt,mime,width,height}, "brand.logo"?: {...} }`（zod schema + `defaultDraft` 补 `assets:{}`，兼容旧 JSON）。

**新操作** `set_asset`（**只进 `siteOperationSchema`，不进 `aiOperationSchema`**——AI 无法上传图片）：
```
{op:"set_asset", target:"hero.image"|"brand.logo", asset: {...} | null}   // null = 还原模板原图
```

**契约**：`TemplateNonContentSlot.support` 从 `"template-owned"` 扩展为 `"template-owned" | "replaceable"`；`hero.image`/`brand.logo` 改 `"replaceable"`。

> **⚠ 红队修正（2026-09-09，优先于本节其它描述）**：实测仅 14/22 模板有可定位首屏 `<img>`，且 2 个会定位到 logo（假阳性）。因此：
> 1. **改为逐模板显式声明**：manifest 新增 `heroAssetSelector?: string`（与 `presentation` 同级），**未声明 = 不可替换**（fail-closed）；
> 2. 声明表**与 A4.2 的 demo 图归因表合并**——一次声明同时服务「能否替换」与「是否 demo 资产」；
> 3. CSS 背景图/SVG 形态（astrogent/devportfolio/signal）v1 标不可替换，不做启发式猜测；
> 4. **不保留**「hero 区面积最大的 `<img>`」启发式——它是假阳性的来源。

**bridge 侧 `applyAssets`**（新增 `lib/template-bridge/assets.ts` 源码字符串模块）：
- 定位优先级：adapter `assetFn`（新增扩展点）→ hero 作用域内**可见面积最大**的 `<img>` → manifest selector；
- 替换必须 `removeAttribute('srcset'/'sizes')`（沿用 `screwfast.ts:86-99` 已验证的范式）；
- 首次替换前把原图存进 `data-sitecraft-original-src`，支持「恢复模板原图」；
- **四种结果全部上报**：`applied` / `missing{reason}` / `skipped{count}` —— 无图模板明确提示「此模板首屏没有可替换图片」，不静默。

**上传通道**：复用 `POST /api/product-images`（`lib/product-image-store.ts`：MIME 白名单 + 5MB + 随机文件名），不新建端点。取舍：该端点无站点作用域、孤儿文件不回收（v1 接受，留待引用计数清理）。

### P3.3 AI 具身上下文

把 `sitecraft:applied` 报告升级为**结构化渲染结构摘要**（`serializeRenderedStructure`，放 `lib/template-slot-guard.ts`）：哪些槽有值、各节是 native 还是 generated 兜底。随 chat 请求体进 prompt，让「把首屏副标题改成 XX」这类指令命中页面真实结构，而不是只看到 draft JSON。

**安全**：结构摘要标注为**不可信数据**，不参与指令解析（防注入）。

### P3.5 A8 询盘表单

- **契约同步**：`contact.formAction.support` 从 `"unsupported"` 改为 `"sitecraft-hosted"`（如实描述现状）。
- **e2e 补断言**：新增 `e2e/specs/lead-form.spec.ts`——发布 → 填表 → 提交 → 断言落库。
- **无 form 模板兜底**：published 变体由 bridge 注入最小可用询盘表单（name/email/message + honeypot），**preview/workspace 变体不注入**（不污染编辑面）。

### P3.4 本地化补齐

- 20/22 有 `dist/`，2 个（landwind、tailwind-landing）走根 `index.html` —— **实测均走本地**（`X-Sitecraft-Preview-Source: local-open-source-snapshot`），A1 已确认为伪需求。
- P3.4 实际要做的是**外链清理**：抽查发现 `awesome` 引 `unpkg.com`（4 处）、`astrogent` 引 `fonts.googleapis.com`（3 处）、`awesome` 的 10 张 `example.com` 死链图。→ 对 22 个模板做**外链扫描 + 本地化改写**，产出「境外依赖 = 0」的证据。

---

## P3 验收总纲

| 层 | 命令/断言 |
|---|---|
| 机械 | `npm test`（新增 mapping/assets/structure 单测）+ `npx tsc --noEmit` + `npm run build` |
| E2E | 新增 `inline-edit.spec.ts` / `asset-replace.spec.ts` / `lead-form.spec.ts`；回归 `workspace.spec.ts`、`publish-rollback.spec.ts` |
| 行为 | 发布页询盘提交落库；替换后的图在导出 HTML 内为 `data:` URI |
| 离线 | 拔网线后预览仍可渲染（P3.4 外链清理后） |
| 环境 | 最后跑一次 `docker compose up -d --build`（PG 存储），验证 `generation_records` 落库与 dev 一致（F1） |

## P3 明确不做（v1 边界）

富文本（加粗/链接/列表，一律纯文本）· 产品卡图片替换 · 素材库/历史图选择 · 裁剪压缩多尺寸 · CRDT/协同编辑 · 每模板 `assetFn` 全覆盖（先通用定位 + `missing` 上报，按 A4.2 归因表增量补）· 生成区 DOM 级复用重构 · 编辑后自动重跑质检/自动发布 · 表单像素级贴合每个模板 · 资产垃圾回收。

---

## P3 设计审计记录（intended-vs-implemented + quality-speed，2026-09-09）

> 方法：先立意图（上方 P3 计划原文），再逐条取证（代码行号），分类「会误导实现」/「契约失准」/「措辞小错」。
> **本节修正优先于上方 P3 正文**——实现时以本节为准。

### 🔴 高：会误导实现的错误

| # | 计划原文 | 代码取证 | 修正 |
|---|---|---|---|
| **A1** | 「`set_asset` 全部经 `commitOperations`，撤销/重做零改动」 | `lib/site-operations.ts:236` 在 **`replace_products` 分支内** `inverseOperations.unshift({op:"replace_draft", draft: cloneDraft(draft)})` —— 这是**兜底逆操作**，排在它**之后**的分支永远进不去 | **`set_asset` 分支必须插在 `replace_products` 之前**，并显式 `unshift({op:"set_asset", target, asset: previous})`。否则撤销后「文本回退、图片不动」 |
| **A2** | 「`applyAssets` 必须晚于 `prepareFn`，否则 screwfast 会把用户图覆盖回去」 | `preview/route.ts:675` —— `applyContent` 第一行就是 `if (typeof prepareTemplate === 'function') prepareTemplate();`，即 `prepareTemplate` **本身在 `applyContent` 内** | 结论（晚于）正确，但描述的时序风险不存在。**写成「在 applyContent 内、prepareTemplate 之后」即可**，无需额外小心 |
| **A3** | 「P3.4 本地化：20/22 有 dist，缺 2 个」 | 实测 **22/22 全部有本地快照**（landwind、tailwind-landing 走根 `index.html`，`getTemplateStaticRoot` 第二级 fallback） | **P3.4 只剩「外链清理」一件事**（awesome→unpkg、astrogent→Google Fonts、awesome 10 张 example.com 死链图）。本地化本身已完成 |

### 🟡 中：契约与规模失准

| # | 计划原文 | 代码取证 | 修正 |
|---|---|---|---|
| **B1** | 隐含「`sitecraft:select` 的 target 可用于映射」 | `preview/route.ts:1012-1020` 的 target 只有 **9 个**（products/heroTitle/heroSubtitle/primaryCta/brand/about/features/services/contact），**无 locale 粒度** | **反向映射必须完全依赖 `data-sitecraft-slot`**，target 仅供 AI 对话框文案。`targetPrompts` 表（`open-source-template-frame.tsx:42-52`）不可用于映射 |
| **B2** | 「无 form 模板注入询盘表单」写成边界兜底 | 实测 **22 个模板中 8 个有 `<form>`，14 个没有**（含 astrofy/astropaper/devportfolio/moon/nextjs-landing/odyssey/tailwind-landing 等） | **这是主路径不是兜底**：注入逻辑按「主流路径」设计（含样式、校验、honeypot），不能当边缘 case 草草处理 |
| **B3** | 「编辑中挂起 content 应用」 | `open-source-template-frame.tsx:95-98` 有 **4 次定时重试**（500/1500/3500/6000ms），`applyContent` 每次全量重写 DOM | **提交成功后必须重置/取消这 4 个定时器**，否则用户刚提交完就被旧 payload 覆盖一次。挂起机制要覆盖「提交后重试重新计时」 |

### 🟢 低：措辞与事实小错

| # | 内容 | 修正 |
|---|---|---|
| **C1** | `data-sitecraft-slot` 格式被当作统一带 locale 后缀 | **两种格式并存**：`about.body`（无后缀，`route.ts:365`）+ `hero.title.zh`（带后缀）。映射器必须同时处理 |
| **C2** | 计划中的行号引用（如「1040 行 cursor 样式」） | 实现时**重新核对**，不照抄行号 |

### ✅ 审计确认站得住的设计（不需要改）

- 复用 `PUT /draft` + `commitOperations` 作为唯一写入口 —— `draft/route.ts:24-45` 结构完全支持
- 复用 `/api/product-images` 上传通道 —— `product-image-store.ts` 已具备 MIME 白名单 + 5MB + 随机文件名
- 图片替换清 `srcset` —— `screwfast.ts:92-99` 已验证范式
- `set_asset` 不进 AI 白名单 —— `aiOperationSchema` 与 `siteOperationSchema` 确实分离
- P3.3 结构摘要标为不可信数据 —— 符合防注入要求

### quality-speed 复核（P3.6 收手线）

按矩阵复核，P3 的定位是**核心产品闭环 + 用户高频使用 + 差异化能力** → **HIGH CRAFT** 成立。但审计发现一处**收手线划错**：P3.4「本地化」已不是工作量（22/22 已本地），而**外链清理**才是真工作，且它属于「国内可访问性」的**产品可用性硬门槛**（不是打磨），应从「可延后」上调为**必做**。

---

## 后续任务统一流程（用户 2026-09-09 定）

> **每个任务板块开始前，先用 skill 审「完成度 + 合理性」，产出修正，再执行。**

1. **立意图**：从计划文件拉该板块原文（不凭记忆）
2. **取证**：逐条 grep/读代码，拿真实行号，不接受「大概是这样」
3. **分类**：🔴 会误导实现 / 🟡 契约失准 / 🟢 措辞小错 / ✅ 站得住
4. **落盘**：修正写回计划文件（「本节修正优先于正文」）
5. **再执行**：按修正后的计划动手，每步贴真实输出

**目的**：防止「计划写得漂亮、代码里根本没有对应结构」的意图差。历史证据：A1（伪需求）、A8（已完成）、`nativeFallbackHost`（死数据）、P3 的 6 处错误——都是这个流程抓出来的。

### ⚡ 验证节奏（用户 2026-09-09 定）

> **不要每改一步就跑全量验证**——浪费 token、拖慢进度。

| 时机 | 做什么 |
|---|---|
| **改的过程中** | 只跑 `tsc --noEmit`（秒级，防语法错），**不跑** probe/截图/全量测试 |
| **一个适配器改完** | 跑一次 `probe-template-coverage` 确认 generated 归零 |
| **一个板块（A3/A4）全部改完** | 统一跑：`npm test` + `tsc` + 22 模板 probe + 门禁 + 截图抽查 |
| **A5 收口** | 全量复验矩阵 |

**反例（已发生）**：tailwind-landing 改了 6 轮，每轮都跑 probe+截图+tsc，重复验证占了大半 token。

---

## A3 执行记录与剩余计划（2026-09-09）

### ✅ A3.4 tailwind-landing 完成

| 项 | 结果 |
|---|---|
| 新增适配器 | `lib/template-adapters/tailwind-landing.ts` |
| generated 节数 | **3 → 0**（22 模板中最差 → 与 forge 标杆持平） |
| 覆盖 | 100%（10/10 槽） |
| 验证 | `npm test` 386 绿、`tsc` 0 错、截图确认、7 模板回归无退化 |

**过程中发现的 3 个通用问题（都影响全部模板，已修）**：

| # | 问题 | 根因 | 修法 |
|---|---|---|---|
| 1 | **模板 CSS 依赖境外 CDN → 国内零样式** | `tailwind-landing` 全部 CSS 来自 `unpkg.com/tailwindcss@2.2.19`，浏览器 `net::ERR_CONNECTION_CLOSED`（curl 通是因为走代理，浏览器不走） | 新增 `lib/template-asset-mirror.ts`：登记表 + 仓库内镜像 `vendor/template-assets/`，预览时重写为本地路径。**认 URL 不认模板，P4 加一行即可** |
| 2 | **18 个模板的 `designTokenCss` 静默失效** | `applyDesignTokens` 在 `draft.designTokens` 为 null 时**直接 return**，适配器 CSS 从未注入 | 拆开：模板专属 CSS 始终注入；通用默认 CSS 仅在有 tokens 时注入（避免 `var(--sitecraft-primary)` 未定义导致按钮透明） |
| 3 | **astrofy 缺 contact.phone/address** | 适配器 `nativeFillFn` 只写了 email，接管 contact 后通用引擎不再生成联系区 | 补齐三项（全量探针发现） |

### 🔄 A3.3 shadcn-landing 进行中（generated 3→0 已达成，视觉待收尾）

**关键差异**：它是 **Vite + React SPA** —— `dist/index.html` 仅 2KB（空挂载点 `div#root`），真实 DOM 由 407KB bundle 客户端渲染。因此**选择器必须按渲染后结构写**，且新增 `scripts/dump-dom.mjs` 用于探测。

已完成：适配器 `lib/template-adapters/shadcn-landing.ts`；`generated 3→0`；`residualDemo` 消失；覆盖 100%。

**踩过的坑（已修，写入注释）**：
- `h3.closest('div')` 会一路**上溯到 `div#root`**，删除 footer 版权行时把整个 React 应用删了 → 改用「只删 footer 内非 #root 的最近容器」
- 模板字符串里正则的 `/` 必须写 `\\/`，否则序列化后 `Invalid regular expression flags`

**剩余视觉缺陷（下一步修）**：

| # | 现象 | 原因 | 修法 |
|---|---|---|---|
| 1 | features 卡仍是 demo 正文 + "About feature" | 卡片正文是 `div.p-6.pt-0` 而非 `<p>`，我的 selector 取空 | 按 `.rounded-lg.border` 卡内 `div.p-6.pt-0` 定位正文 |
| 2 | services 卡残留 demo 图 + "About services" | 卡内插图与链接未清 | 隐藏卡内 `img` 与 "About *" 链接 |
| 3 | hero 副文是英文 demo | `hero.subtitle` 未落位（首屏 `<p>` 未被 setText） | 在 nativeFill 里补 hero 副文槽 |
| 4 | hero 按钮 "Get Started"/"Github Repository" | demo CTA 未替换 | 首个按钮写 `hero.cta`，其余隐藏 |
| 5 | 特性标签 pill（Dark/Light theme 等）残留 | 未处理 | 隐藏该 pill 行 |
| 6 | 空 features 卡仍占位 | 只有 2 条数据但 3 张卡 | 无数据的卡 `display:none`（已有逻辑，需确认 selector 命中） |

### ⬜ A3.1 nextjs-landing（结构已探明，预计最快）

`dist/index.html` 4.7K **静态 HTML，语义 id 齐全**：
`header.site-header` → `section.hero`(h1) → `section.about#about` → `section.section#features`(h2+3×h3) → `section.section.services#services` → `section.section#work`(h2+2×h3) → `section.contact#contact` → `footer`

映射：hero→`.hero`，about→`#about`，features→`#features`，services→`#services`，products→`#work`（作品/案例语义），contact→`#contact`。已有 e2e `nextjs-landing-preview.spec.ts` 可直接跑。

### ⬜ A3.2 kindred（vendor 目录 `odyssey`，Astro 静态）

`dist/index.html` 29K，**首页只有 3 类区**：
`header#odysseyNavHeader` → `section.hero-section__section`(h1) → 三个 `section.feature-card__section`(h2 + h3.feature-card__title) → `footer`

**首页无 about/services/products/contact 原生区** → 这 4 节走 generated（manifest 已声明）。适配器主要做：
1. hero 落位（h1 + 副文 + CTA）；
2. features 落进 3 个 feature-card section（卡片上限 3）；
3. 多页导航收敛（模板有 `/company`、`/blog`、`/landing-pages` 子页，导航项要改为锚点或删）；
4. footer 清 demo 社交链接、补企业联系。

### ⬜ A4 demo 资产处理

- **检测泛化**：`lib/template-fidelity-guard.ts` 的 demo 资产特征从「单个宇航员样本」改为**注册表**（`registerTemplateDemoAsset`），按 `scripts/probe-hero-asset.mjs` 的归因结果登记
- **归因表**（探针已产出雏形，见下表）→ **与 P3.2 的 `heroAssetSelector` 声明表合并**
- **运行时处置**：默认保留原图（AI 不出图）；发布前 `evaluateFidelity` 命中 demo 资产 → blocker 提示「请替换首屏主视觉后发布」

首屏图片归因（`probe-hero-asset.mjs` 实测 22 模板）：

| 类别 | 模板 | 处置 |
|---|---|---|
| 有可用 `<img>` | forge/atlas/kindred/landwind/lonestone/astro-starter/moon/foxi/yukina/fresh/screwfast/tailwind-landing/shadcn-landing(logo)/astrofy(小图) | 登记 selector；**shadcn-landing/astrofy 需排除**（定位到的是 logo/小图） |
| 首屏无图 | powerai/awesome/astropaper/nextjs-landing/shadcn-landing2 | 标不可替换 |
| CSS 背景图 | astrogent/devportfolio | 标不可替换（v1） |
| 只有大 SVG | signal | 标不可替换（v1） |

### ⬜ A5 22 模板复验矩阵

A3/A4 全完成后跑：`npm test` + `tsc` + 22 模板 coverage 探针 + 门禁审计 + 截图抽查，产出 22×5 矩阵（本地快照/适配器/承载声明/覆盖扫描/门禁）。

### 新增可复用脚本（P4 接入新模板时直接复用）

| 脚本 | 用途 |
|---|---|
| `scripts/probe-template-coverage.mjs` | 槽位覆盖 + generated 节数 |
| `scripts/probe-slot-mapping.mjs` | 点选槽位可映射性（P3.1 前置验证） |
| `scripts/probe-reinject-damage.mjs` | 重注入破坏性（P3.1 前置验证） |
| `scripts/probe-hero-asset.mjs` | 首屏图片可替换性（P3.2 前置验证） |
| `scripts/shot-template.mjs` | 模板截图（视觉预筛） |
| `scripts/dump-dom.mjs` | 渲染后 DOM 结构 dump（SPA/复杂模板写 adapter 用） |
| `scripts/diag-preview-css.mjs` | 预览 CSS/资源加载诊断 |
| `scripts/audit-deliverables.mjs` | 成品门禁审计 |

---

## P3 红队审校（strategy-red-team，2026-09-09）

> 方法：提取承重假设 → steelman → 攻击 → 给「本周可拿到的证据 + kill 标准 + 最便宜的测试」。
> **本次三条假设里，两条用真实探针测掉了，一条被证伪。**

### 探针工具（新增，可复用）

| 脚本 | 测什么 |
|---|---|
| `scripts/probe-slot-mapping.mjs` | 22 模板全部 `data-sitecraft-slot` 的可映射性 |
| `scripts/probe-reinject-damage.mjs` | 全量重注入对滚动/节点身份/生成区的破坏 |
| `scripts/probe-hero-asset.mjs` | 22 模板首屏可替换 `<img>` 的定位可行性 |
| `scripts/probe-template-coverage.mjs` | 槽位覆盖 + generated 节数（A3 基线） |

### 🔴 假设 1（被证伪）：hero 图可通用定位

- **Claim**：「把 `hero.image` 升级为可替换资产槽」在多数模板可行（通用定位器 = hero 区面积最大的 `<img>`）
- **实测（`probe-hero-asset.mjs`）**：**仅 14/22 有可定位首屏 `<img>`**

| 情形 | 模板 | 数量 |
|---|---|---|
| ✅ 可定位 | forge/atlas/kindred/landwind/lonestone/astro-starter/moon/foxi/yukina/fresh/screwfast/tailwind-landing 等 | 14 |
| ❌ 首屏无图 | powerai、awesome、astropaper、nextjs-landing、shadcn-landing2 | 5 |
| ⚠ CSS 背景图 | astrogent、devportfolio | 2 |
| ⚠ 只有大 SVG | signal | 1 |

- **更糟的是假阳性**：`shadcn-landing` 最大首屏 img 是 **96×96（logo）**、`astrofy` 是 **208×117**——通用启发式会**替换错图**（把 logo 当 hero 图）。
- **Fails if**：把 `hero.image` 一律标为 `replaceable` 并走通用定位 → 8/22 报 missing，其中 2 个会替换错元素。
- **修正（已写入下方 P3.2 设计）**：
  1. **改为逐模板显式声明**（manifest 新增 `heroAssetSelector?: string`，与 `presentation` 同级），**未声明 = 不可替换**（fail-closed，不是 fail-open）；
  2. 声明里同时登记「该图是否为模板 demo 资产」——**与 A4.2 的归因表合并为同一张表**，一次声明服务两个用途；
  3. CSS 背景图/SVG 形态的模板（astrogent/devportfolio/signal）**v1 直接标不可替换**，不做启发式猜测。
- **Kill criterion**：若 P3.2 实测 `missing` 比例 > 30%（即声明表覆盖率 < 70%），说明「逐模板声明」成本过高，应退回「只支持用户上传全局 hero 图（不绑定模板结构）」的降级方案。

### 🟢 假设 2（成立）：点选槽位可反向映射

- **Claim**：`data-sitecraft-slot` 足以把点选编译成 draft 操作
- **实测（`probe-slot-mapping.mjs`，22 模板）**：42 种 slot（去重）→ **可映射 31 / 有意拒绝 11 / 真正不可映射 0**

| 类别 | 内容 |
|---|---|
| 可映射 31 | `hero.*`/`about.*`/`features.*`/`services.*`/`products.*`/`contact.*`/`navigation.*`/`companyName.*`（含 `products.<sku>.name.zh` 这类多段式） |
| 有意拒绝 11 | `footer.*`（模板 UI 文案）、`form.*`（表单标签/占位符）、`faq.title.*` —— 本就不属于 draft 内容 |
| 不可映射 0 | —— |

- **结论**：P3.1 的映射层**没有未知风险**，可以按原设计推进。计划里「映射不出来给人话原因」的兜底路径实际用不到（但保留，作为未来新节的安全网）。

### 🟢 假设 3（成立，但暴露一个真缺陷）：全量重注入可接受

- **Claim**：改一个槽 → 全量重注入 → 体验可接受
- **实测（`probe-reinject-damage.mjs`，forge/shadcn-landing/tailwind-landing）**：

```
滚动位置:  800 → 800  (位移 0px)        ← 无跳变
hero 节点身份保留: ✅ 是                 ← contenteditable 所在节点不会被替换
生成区节点身份保留: ✅ 是                ← 内容未变时不重建（已优于计划预期）
产品卡节点保留: 0/1                      ← ❌ 真缺陷：每次重注入重建产品卡
```

- **结论**：计划里的 M1（编辑中挂起）/M2（重试去重）/M4（滚动守护）**大部分不必要**——实测没有跳变、节点也没被换掉。**唯一真问题是产品卡重建**（`renderAdditionalProducts` 每次 `section.innerHTML=''` 重建，图片会重新加载 → 闪烁）。
- **修正**：P3.1 只保留 **M3（生成区指纹跳过重建）** 并把它**扩展到产品卡**（数量与内容未变则复用节点）；M1/M2/M4 降级为「若实测出问题再补」。

### 🟡 假设 4（用户已裁决）：用户要的是「就地编辑」

- 现状：点选后 prompt 自动填进对话框，**用户仍需点发送**（`selectPreviewTarget`）。
- **用户裁决（2026-09-09）**：**直接做就地编辑**，不做埋点验证。P3.1 按原计划推进。

### 🟡 假设 5（用户已裁决）：图片由客户提供实拍图

- A4 已证明「宇航员图来自模板自身」，而 **AI 不能生成图片**（DeepSeek 不出图）。
- **用户裁决（2026-09-09）**：**客户会提供实拍图** → P3.2 的**上传体验是主路径**，优先级不变。
- 推论：P3.2 要重点做好「上传 → 预览 → 持久化 → 导出内联」的完整体验，而不是只做一个替换入口。

### What's Well-Reasoned（红队确认站得住）

- **复用 `PUT /draft` + `commitOperations` 作唯一写入口** —— 探测证明槽位映射无未知风险，这个设计成立
- **`set_asset` 不进 AI 白名单** —— `aiOperationSchema`/`siteOperationSchema` 已分离，机制正确
- **映射失败必须给人话原因** —— 虽然实测用不到，但作为新节安全网保留是正确取舍
- **P3.5 询盘闭环是主路径而非兜底** —— 14/22 无原生 form，这个规模判断正确

### What I Couldn't Assess

- **编辑延迟体感**：全量重注入的实际耗时（含网络往返）未测；若 > 2s，用户会觉得「卡」
- **多语言下的编辑**：探针只跑了 zh；en 槽位是否同样可映射未验证（格式一致，风险低）
- **移动端**：点选在触屏上的可用性未测
