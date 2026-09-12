# 契约冲突清单（阶段 1 · 只读普查）

> 产出日期：2026-09-12 ｜ 流程见 [`contracts-unify-prompt-for-deepseek.md`](contracts-unify-prompt-for-deepseek.md)
> 证据来源：三路只读探查 + 本日真机实测（每行均可按 文件:行号 复核）
>
> **本文只做普查，不改任何文件。** 请确认术语表后再进入阶段 2。

---

## 一、命名冲突（同一概念多个名字）

| 概念 | 各处名称 | 出现位置 | 语义是否一致 | 建议统一为 |
|---|---|---|---|---|
| 内容条目 | `card`（操作名） | `lib/site-operations.ts:106-127` | 一致 | `item` |
| 同上 | `item`（同一 schema 的 payload 字段） | `lib/site-operations.ts:117-122` | **同一条 schema 内两名并用** | `item` |
| 同上 | `items`（草稿数组） | `lib/site-document.ts:171-175,353` | 一致 | `items` |
| 同上 | `EditableCard`（类型名） | `lib/site-document.ts:14-19` | 一致 | `EditableItem` |
| 同上 | `products`（集合槽，无 `.items`） | `lib/template-manifests/types.ts:5-15` | **粒度不同**（N 条当 1 个 target） | 见「不该合并」 |
| 拼装器板块 | `ComposerBlock{type,variant}` | `lib/template-composer-dsl.ts:43-57,127-131` | 独立概念 | 见「不该合并」 |
| 模板排版块 | `TemplatePresentationBlock{slot,role,capacity}` | `lib/template-manifests/types.ts:85-104` | 独立概念 | 见「不该合并」 |
| 设计容器 | `container` / `wrapper` / `frame` / `shell` — 目前**未发现**混用问题 | — | — | 无需处理 |
| 业务段名列表 | `sectionKeys`（5 节） | `lib/site-document.ts:77-83` | 基准 | `sectionKeys` |
| 同上 | `cardSections`（3 节，含 faq） | `lib/site-operations.ts:102` | **有意不同** | 保留两名 |
| 同上 | `capacitySections`（2 节，**不含 faq**） | `lib/site-operations.ts:761` | **与 cardSections 不一致 → 见冲突 #3** | 待定 |
| 长度上限 | `SLOT_MAX_LENGTH`（唯一事实源） | `lib/template-slot-contract.ts:43-54` | 一致 | 保持 |
| 同上 | `DRAFT_FIELD_MAX_LENGTH` | `lib/draft-field-limits.ts:27-34` | **与上表部分重叠**（email:240/phone:80 各写一遍） | 见冲突 #8 |

## 二、平行契约文本（提示词 vs schema/校验）

| 概念 | 硬编码位置 | 性质 | 权威来源应是 |
|---|---|---|---|
| 枚举中文释义 ×3 套 | `lib/site-intent.ts:385-407`（businessExamples/audienceExamples/toneExamples） | 硬编码 | `BUSINESS_TYPES`/`AUDIENCES`/`TONES`（`site-intent.ts:19-21`） |
| 同上 | `lib/site-generator.ts:145-167`（businessLabel 等三张映射） | 硬编码 | 同上 |
| 意图输出字段名与示例 | `lib/site-intent.ts:419-428,462-465` | 硬编码 | `createSiteIntentResponseSchema` |
| 字数提示 60/110、200/380 | `lib/site-intent.ts:472-473` | 硬编码且**比 schema（120/400）更严** | schema 的 max() |
| "模板只有五个板块" | `lib/site-intent.ts:444` | 板块列表是派生，**"五个"是硬编码** | `sectionKeys.length` |
| target 白名单 ×2 | `lib/ai-provider.ts:599` 与 `lib/site-generator.ts:245` | 各写一份 | `textTargets`（`site-operations.ts:36-57`） |
| `update_card` section 枚举 | `lib/ai-provider.ts:307-309,600` | 只写 `features\|services`，**不含 faq** | `cardSections` |
| 规则数值（"标题不超过两行"等） | `lib/template-catalog.ts:69,87,159,269,398,415` | 硬编码，经 `ai-provider.ts:332` 进 chat 提示词 | **未逐条核实**，待定 |

**已完成同源的**（可作为阶段 2 的起点，不必从零设计）：
`buildTemplateCapabilitySummary`（`template-slot-guard.ts:52-93`）、
`buildPresentationCapacityText`（`site-generator.ts:211-217`）、
`policyRulesText` / `readabilityHint`（`content-policy.ts:68-72,159-164`）、
`SLOT_MAX_LENGTH` → manifest.maxLength（`template-manifests/shared.ts:60-132`，有测试锁）。

## 三、语义确实不同、**不该合并**（强行统一会破坏语义）

1. **`slot` 两种含义并存**：
   - DOM 可编辑路径 `hero.title` / `features.items.0.title.zh`（`template-composer.ts:62`、`inline-edit-mapping.ts:4`）
   - `presentation.slot` = **裸段名** `"features"`（`template-manifests/types.ts:85-104`）
   同一个词、两个概念。**但见冲突 #1：消费者对格式的认知不一致，这是真 bug。**
2. **`ComposerBlock` vs `TemplatePresentationBlock`**：一个是"拼装器选了哪个组件"，一个是"模板原生排版能装几条"。
3. **`cardSections`（可增删卡）vs `sectionKeys`（站点五节）**：成员不同是设计。
4. **基线模板契约 vs 运行时 `KNOWN_TARGETS`**：`template-runtime.ts:227-239` 注释明说两者本就不是同一张表。
5. **`hero.subtitle` 的 40/25 档 vs `about.body` 的契约容量**：前者无 manifest 槽位、按版式经验判；
   后者有契约容量。**已在本日收口为"有契约按契约、无契约才用启发值"**，不要再合并回一组数字。

---

## 四、🔴 本日新发现的高危冲突（证据一手核实）

### 冲突 #1 · `add_card` 容量门在生产上**恒不生效**（P0）

```
生产传入：presentation[].slot = "features"      site-generator.ts:402（getTemplatePresentation）
                                               site-generator.ts:778（buildTemplateCapabilitySummary → 同为裸段名）
校验器查：${section}.items = "features.items"   site-operations.ts:778, 795
                ↓ find() 永远 undefined → overCapacity 恒为空 → 越界从不被拦
单测传的：{ slot: "features.items" }            tests/site-operations.test.ts:323, 364
                ↓ 测试绿，但测的是生产永远不会传的形态
```

**这是 2026-09-10「AI 按容量提示写 → 越界 → 应用层炸掉整批」能发生的原因：当时加的防线没接上。**
附带：`capacitySections`（`site-operations.ts:761`）不含 `faq`，而 `cardSections` 含 —— 容量口径又一处不一致。

### 冲突 #2 · 提示词**否认代码已有的能力**

`site-intent.ts:444` 告诉模型「模板……不支持……博客」，
而 `site-generator.ts:100-104` 明确支持 `shape === "blog"` 的内容站生成。

### 冲突 #3 · 已隐藏板块仍被算作缺口（**本日已修，此处仅存档**）

`template-content-coverage.ts` 不认 `hiddenSections`，而 `evaluateDraftQuality` 认 →
新站因"还没有商品"自动隐藏 `products`，覆盖率仍把它报成待填 → `partial=true` 且**用户补不完**。

### 冲突 #4 · 诚实占位被同时算作 demo 残留（**本日已修，此处仅存档**）

`collectPlaceholders` 与 `residualDemoSlots` 顺序反了（注释写在正确顺序，代码没照做）→
`contact.phone` 同时进两个分类 → **如实留"待补充"的站永远发不出去**。

### 冲突 #5 · 长度契约四处副本（**本日已修三处，第四处在 chat 路径**）

`ai-provider.ts:365`（chat system prompt）、`site-vision.ts:225`（截图链路）、
`site-generator.ts:138`（`slice(0, 40)` 兜底）——均已改成读 `SLOT_MAX_LENGTH` 派生值。
**但 chat 路径的整段 policy 文本仍是手抄的**（未走 `policyRulesText()`），只统一了长度那一句。

### 冲突 #6 · 同值不同源（靠注释约束一致性）

| 值 | 位置 A | 位置 B |
|---|---|---|
| 24 | `MAX_LOGO_ITEMS`（`template-composer-dsl.ts:180-182`） | `site-document.ts:274` 的 `.max(24)` |
| 1000 | `site-document.ts:266` | `template-manifests/shared.ts:221` |
| 2000 | `SLOT_MAX_LENGTH_FALLBACK`（`template-slot-contract.ts:57`） | `template-runtime-server.ts:63` |
| 240 / 80 | `SLOT_MAX_LENGTH` | `DRAFT_FIELD_MAX_LENGTH`（两张表各写一遍） |

### 冲突 #7 · FAQ 注释与实现张力

`site-document.ts:237-248` 注释称"question/answer 语义不同，不能复用 EditableCard"，
实现却是 `editableCardSchema.extend({ items: z.array(editableCardSchema) })`——
**既是复用了、又是一次冗余 extend**（与父 schema 的 items 定义完全相同）。需人判断取舍。

### 冲突 #8 · `add_card` index 上限构成越界路径 —— ✅ **实跑确认真实触发**（2026-09-12）

按裁决"先补实跑复现测试、把结论写进报告再决定修法"，已加
`tests/site-operations.test.ts` 的「冲突 #8 实跑复现」用例。**实测输出原文**：

```
[冲突#8 观察] 插入前 12 条 → 插入后 13 条；schema 可解析 = false
[冲突#8 观察] MAX_COLLECTION_ITEMS = 12
[冲突#8 结论] **真实触发**：可以插到超过上限，且该草稿无法通过 schema
             → 下次读取会走 normalizeDraft 的 destructive 兜底（整站回退成演示文案）
```

**完整链条**（每一环都有证据）：

| 环 | 事实 | 位置 |
|---|---|---|
| 1 | `add_card.index` 上限是字面量 `12`，**与 `MAX_COLLECTION_ITEMS` 无 import 关系** | `site-operations.ts:120` |
| 2 | 插入点是 `Math.min(index ?? items.length, items.length)`——满员时 `index=12` 夹到 12 = **尾部**，插入成第 13 条 | `site-operations.ts:484` |
| 3 | schema 要求 `items.length ≤ MAX_COLLECTION_ITEMS(12)` | `site-document.ts:174` |
| 4 | 13 条的草稿 `safeParse` 失败 → `normalizeDraft` 走 destructive 兜底 | `site-document.ts:457-477` |

**修法（待你裁决，本次未改代码）**，至少两条路：
- **A（推荐）**：`add_card.index` 上限改为 `.max(MAX_COLLECTION_ITEMS - 1)` 并 import 常量——
  与 schema 同源，顺手消掉"同值不同源"（冲突 #6 家族）；
- **B**：在 `applySiteOperations` 的插入处加容量前置校验，超限**拒绝单条**而非静默溢出
  （与 `update_card` 越界的处理方式一致）。

A 治入口、B 治兜底；**建议 A+B 都做**，因为 B 还能挡住"多次独立的 add_card 累计溢出"这种
A 挡不住的情况。

---

## 五、没查清的（需要人判断）

1. `template-catalog.ts` 的 `guardrails` 手写数值规则是否与槽位契约校验器一致——**未逐条核实**。
2. `about.title` 落进 15 字启发值分支（`SLOT_MAX_LENGTH` 无此键），**无测试锁定**，不确定是否预期。
3. 项目既有待办与本清单同源的三项（见下），需决定是并进本次治理还是单独立项。

---

## 六、与项目既有待办的重叠（**不另开单**）

`PROJECT_PROGRESS.md` 的「下一步」里已有三项与本治理同源：

| # | 既有待办 | 与本清单的关系 |
|---|---|---|
| 0 | **`add_card` 容量门恒不生效**（本日登记） | = 冲突 #1 |
| 1 | `products` 契约两层不一致：`slots` 层 22/22 声明且 required，`presentation` 层只 17/22 | 属"同值不同源"家族（冲突 #6 的延伸） |
| 2 | 文案长度实测：15/40 是拍的 → 需按模板×槽位做**字数梯度渲染实测**真实破版点 | `SLOT_MAX_LENGTH` 注释自承"仍是估算的"，本日只统一了来源、**未实测真值** |
| 3 | `/export/[siteId]` 无入口（页面存在但全站零链接） | 独立问题，不属契约治理 |

---

## 七、给术语表的三条建议（请确认或否决）

1. **`card` → `item`**：草稿层叫 `items`、类型叫 `EditableCard`、操作叫 `update_card`，
   而同一 schema 的 payload 字段已经叫 `item` 了。建议**以 `item` 为准**，操作名改 `update_item`。
   ⚠️ 操作名会进提示词与已落盘的变更历史，改名需评估兼容（阶段 4）。
2. **`slot` 保留两名、但把格式钉死**：`slot`（DOM 路径，点分含 locale/下标）与
   `presentationSlot`（裸段名）。**冲突 #1 正是因为两者同名同字段却不同格式。**
3. **长度类常量只留 `SLOT_MAX_LENGTH` 一张表**：`DRAFT_FIELD_MAX_LENGTH` 里与它重叠的
   `contact.email`/`contact.phone` 应改为从前者派生，或明确合并。

---

## 下一步（等你放行）

请确认：
- 术语表（尤其上面三条建议，以及「不该合并」的五项是否同意保留）；
- 冲突 #1/#2 这类**逻辑错误**是否按既定原则单独修（不夹带进改名提交）；
- 冲突 #7/#8 与第五节"没查清的"三项，是补查还是先搁置。
