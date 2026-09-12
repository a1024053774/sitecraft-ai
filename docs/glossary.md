# 术语表（Glossary）

> 契约治理的**唯一命名依据**。流程见 [`contracts-unify-prompt-for-deepseek.md`](contracts-unify-prompt-for-deepseek.md)，
> 冲突证据见 [`2026-09-12-contract-conflict-inventory.md`](2026-09-12-contract-conflict-inventory.md)。
>
> 用户裁决（2026-09-12）：建议 #2、#3 照准；#1 拆分——类型与 payload 统一到 `item`
> 并入改名范围，**操作名（`update_card`/`add_card`）留到阶段 4 做别名兼容**，
> 禁止混入改名提交。

---

## 一、核心术语（一词一概念）

| 术语 | 含义 | 权威定义 | 反例（禁用） |
|---|---|---|---|
| `item` | **一条内容条目**：`features`/`services`/`faq` 数组里的一项 | 类型 `EditableItem`（`lib/site-document.ts` 的 `editableItemSchema`）；草稿字段 `content.<section>.items` | `card`（作为**名词**使用时）、`entry`、`element` |
| `slot` | **DOM 上的可编辑位置**，点分路径，可带 locale 与下标：`hero.title.zh`、`features.items.0.title.zh`、`navigation.<id>.zh` | `data-sitecraft-slot` 属性；`lib/inline-edit-mapping.ts` 的文件头 | —— |
| `presentationSlot` | **模板原生排版的业务段名**，裸名无点分：`"features"`、`"services"`（**还有 `hero`**，它不是 `sectionKeys` 的一员） | `TemplatePresentationBlock.presentationSlot`（`lib/template-manifests/types.ts`） | ⚠️ 见下方「同名不同义」 |
| `section` | **站点业务板块**：`about`/`features`/`services`/`products`/`contact` | `sectionKeys`（`lib/site-document.ts`） | `block`、`module`、`section` 以外的叫法 |
| `target` | **操作指向的字段路径**（`set_text` 的 `target`）：`hero.title`、`about.body` | `textTargets`（`lib/site-operations.ts`） | `field`、`key` |
| `manifest` | **模板的内容契约**：槽位声明 + 排版角色 + 容量 | `TemplateManifest`（`lib/template-manifests/types.ts`） | `schema`（那个词留给 zod） |
| `maxLength` / `SLOT_MAX_LENGTH` | **槽位能装的字符数**，长度类约束的**唯一事实源** | `lib/template-slot-contract.ts` | ⚠️ 禁止在任何别处另写一个数字 |
| `capacityMax` | **模板原生排版能显示几条**（与 `maxLength` 是两条独立约束） | `TemplatePresentationBlock.capacity.max` | 不要与 `maxLength` 混用 |

### 为什么 `maxLength` 与 `capacityMax` 必须分开

它们是**两个问题**：前者是"存不存得下"（schema 层，超了会读取失败），
后者是"排版能显示几条"（观感层，超了只是不好看）。
2026-09-12 的事故正是把两者混为一谈：用**可读性建议值**（40）去拦**存储容量**（800）。

---

## 二、同名不同义：**必须保留两名，不得合并**

> 硬性约定：以下每组是**两个不同的概念**，强行统一会破坏语义。
> 用户裁决（2026-09-12）：五项全部保留，写入反面清单。

### 1. `slot` vs `presentationSlot`

| | `slot` | `presentationSlot` |
|---|---|---|
| 形态 | 点分路径，带 locale/下标：`features.items.0.title.zh` | 裸段名：`"features"` |
| 用途 | 定位 DOM 上的可编辑节点 | 查模板原生排版角色与容量 |
| 定义处 | `data-sitecraft-slot`、`inline-edit-mapping.ts` | `TemplatePresentationBlock.presentationSlot` |

⚠️ **这两者格式不同，混用会造成静默失效**——2026-09-12 修掉的 P0（冲突 #1）正是如此：
校验器按 `${section}.items` 查生产传来的裸段名，于是 `add_card` 容量门**从未生效**。

**约定**：代码里读 `presentation.slot` 的字段一律叫 `presentationSlot`；
描述 DOM 位置的才叫 `slot`。

> **附则 2 的实例（2026-09-12 自查发现）**：阶段 3 改完名后，本表**有两行没跟着改**——
> 上面写的 `editableCardSchema` 与 `TemplatePresentationBlock.slot` **在代码里已不存在**。
> 权威表的价值全在"能据它找到真东西"，指向不存在的符号等于自毁。
> 教训：**改名提交必须连带更新术语表**，否则改名的就是术语表自己。

### 2. `ComposerBlock` vs `TemplatePresentationBlock`

前者是**拼装器 DSL 里"选了哪个组件+版式"**（`template-composer-dsl.ts`）；
后者是**模板 manifest 里"这个业务槽原生长什么样、能装几条"**（`template-manifests/types.ts`）。
都叫 block，层级不同——**不要合并类型**。

### 3. `cardSections` vs `sectionKeys`

`cardSections = ["features","services","faq"]` 是"**哪些节能被 `update_card` 写**"；
`sectionKeys = ["about","features","services","products","contact"]` 是"**站点有哪五节**"。
成员不同是**设计**，不是漂移。

### 4. 基线模板契约 vs 运行时 `KNOWN_TARGETS`

两者**本就不是同一张表**（`lib/template-runtime.ts` 注释明说）。
沉淀模板的契约由运行时注册，基线由编译期常量维护。

### 5. `hero.subtitle` 的版式启发值 vs `about.body` 的契约容量

`hero.subtitle` 在 manifest 里**没有槽位**，只能按版式经验判（40/25）；
`about.body` **有契约容量**（800），必须按契约判。
**不要为了"统一"把它们并回一组数字**——那正是本轮事故的成因。

---

## 三、待办登记区

> 已识别但**尚未排期**的缺口。登记在此，不擅自修。

### T-1 · `faq` 的 `add_card` 无容量校验（用户裁决第 3 条：登记待排期）

`capacitySections = ["features", "services"]`（`lib/site-operations.ts`），
**不含 `faq`**；而 `cardSections` 含 `faq`。

后果：`faq` 的 `add_card` **不走模板容量校验**（既无 `presentation` 查表，也不在
`overCapacity` 投影范围内）。它的条数上限目前只由 `siteDraftSchema` 的
`MAX_COLLECTION_ITEMS` 兜底——而该兜底是**schema 层**，超了会让读取失败
（即本轮冲突 #8 的同款危害路径），**不是写入期拦截**。

修法待定（补 `faq` 的 presentation 声明？还是把 `capacitySections` 与 `cardSections`
的关系定义清楚？）。**由用户后续决定排期。**

### T-2 · `products` 契约两层不一致（只登记，不处理）

`slots` 层 22/22 声明 `products` 且 `required: true`；`presentation` 层只有 17/22 声明。
用户裁决：**只登记不处理**。

### T-3 · 枚举中文释义维护了**三套**（阶段 2 未做，补登记）

同一批枚举（`BUSINESS_TYPES` / `AUDIENCES` / `TONES`）的中文释义写在**三个地方**：

| 位置 | 内容 |
|---|---|
| `lib/site-intent.ts` 的 `buildIntentPrompt` 内 `businessExamples`/`audienceExamples`/`toneExamples` | 键 + 中文释义 |
| `lib/site-generator.ts:145-167` 的 `businessLabel`/`audienceLabel`/`toneLabel` | **同一批键的第二份中文释义** |
| `lib/site-intent.ts:19-21` 的枚举常量本体 | 只有键，没有释义 |

**处置意向**：把 label 映射**收口到 intent schema 派生**——在枚举常量旁挂一份
`Record<EnumValue, string>` 作为权威释义表，prompt 与 label 都从它读。

**本轮未做的原因**：阶段 2 的 prompt 收口聚焦在**字段名与枚举成员**
（能机械断言的那部分），"释义文本"是散文、无法靠"是否出现"来断言同源，
合并进来会扩大改动面且缺少验收手段，应单独一批做。

### T-4 · `template-catalog.ts` 的 `guardrails` 数值规则（阶段 2 未做，补登记）

`guardrails` 里有手写数值规则（"标题不超过两行""最多突出三类产品"
"每个功能点不超过两句""标题不超过八个中文字或六个英文词" 等），
经 `ai-provider.ts` 进入 chat 提示词。

**核实状态：未逐条核实**（阶段 2 只收了字段名与枚举成员，没动这些散文式规则）。

**处置意向**：逐条核实它与槽位契约校验器是否一致——
一致或无害的**归入 prompt 同源**（改为可派生的表述）；与契约冲突的**删除**
（留着就是第二个真相源，正是本轮反复出事的形态）。

**本轮未做的原因**：同 T-3，属散文规则、缺机械验收手段，且需要逐条对照
manifest 的真实容量，是独立的一批核实工作。

### T-5 · `presentationSlot` 的注释手抄了段名枚举（**已完成**）

`lib/template-manifests/types.ts` 的 `presentationSlot` 注释写的是
`about|features|services|products|contact`，**漏了 `hero`**（未手写 `presentation`
的 5 个模板走 `defaultPresentation()`，含 hero 共七值）。

处置：按附则 2 改为指向 `getTemplatePresentation()` 的引用，不再抄第二份。
见 commit `90dee19`。

### T-6 · `applySiteOperations` **没有入参校验**，坏操作会静默写坏草稿

**不是从代码读出来的，是实测出来的**（2026-09-12，阶段 4 调研）：

把 PG 里 8 条**缺 `locale`** 的历史 `update_card` 喂给今天的代码：

```
siteOperationSchema.safeParse(corrupt).success = false    ← 读不进来
applySiteOperations **没有抛错**，changed = true           ← 却照写
写后的 item: { "title": { "zh": "...", "en": "...", "undefined": "新标题" } }
```

根因：`applySiteOperations` 全文件**零处** `siteOperationSchema.safeParse`，
`update_card` 分支直接 `item.title[operation.locale] = ...`，
而 `locale` 为 `undefined` 时 **JS 会把它转成字符串 `"undefined"` 当键**。

**为什么现在没炸**：`draft` 读取会过 `normalizeDraft` → `siteDraftSchema.safeParse`，
而 **Zod 默认剥掉未知键**（实测 `{zh,en,undefined}` → `{zh,en}`，success **true**），
所以污染**被无声抹掉**——不是修好了，是看不见了。

**为什么仍然要修**：这个洞**不是那 8 条数据造成的**，
是"写入期没有拦截"造成的。任何能构造出缺字段操作的路径都能触发。
与冲突 #8 同构（"schema 层兜底不算写入期拦截"）。

**处置意向**：在 `applySiteOperations` 入口逐条做形状校验，不合法**抛可读错误**。
**风险**：会改变现有行为（"能跑但错"的输入变抛错），**先跑一遍评估对 687 个测试的影响面再决定**。
方案见 `docs/plans/2026-09-12-phase4-rename-and-compat-design.md` §四。

**本轮未做的原因**：属独立批次——它与 op 改名无耦合，且改的是核心函数的契约行为，
需先出影响面评估。**由用户决定排期。**

---

## 四、附则

### 附则 1 · 注入提示词/脚本的字符串**禁用反引号**

**背景**：2026-09-12 一轮内同一个坑踩了**五次**——在"会被注入进模板页面的字符串"
（模板字面量）里写反引号，导致外层字符串提前终止。

最典型一次：给 `preview/route.ts` 的表单注入代码写注释时，用 Markdown 反引号
包裹标识符（``必须用 `templateUiCopy[locale]` ``），反引号直接把字符串切断，
后半段注释变成 JS 代码，`tsc` 报一串 `TS1005`。更早几次更隐蔽——被**偶数个**
反引号切成"看起来合法"的样子，**编译通过但运行时是坏的**。

**规则**：在注入用的模板字面量内部，注释与文本里写标识符时**不要用反引号**，
改用「」或裸写。

**防线**（不靠记性）：`tests/no-backtick-in-injection.test.ts` 按区域扫描
`preview/route.ts` 的 bridgeScript（第 93–1424 行），区内出现反引号即失败，
并精确报出行号。该测试自带锚点自检与检查器自检（本项目已吃过三次"假门禁"的亏）。

修改那段代码后若行号漂移，测试会失败并提示更新锚点——**这是有意的**，
防止检查悄悄空转。

### 附则 2 · 契约只在**一处**定义

同一个数字/枚举/字段名，只允许有一个权威来源；其余位置必须**读取它**而不是重写它。
2026-09-12 修掉的四处长度副本、`MAX_LOGO_ITEMS` vs `.max(24)`、
`index.max(12)` vs `MAX_COLLECTION_ITEMS` 都是反例。

判断方法：改掉权威来源后，**其他地方应当自动跟着变**。如果不会，那就是两处定义。

### 附则 3 · 门禁必须**会失败**

新增任何检查（测试/探针/门禁）时，必须同时证明它**能拦下真实缺陷**——
否则它是"假门禁"。本项目已吃过三次亏：

| 假门禁 | 症状 |
|---|---|
| `coverage-scan.spec.ts` | 零断言且被 `testIgnore` 排除，模板门禁实际不存在 |
| `probe-lead-form.mjs` | 逻辑正确但不设退出码，遇到异常直接崩溃退出（看着像环境问题） |
| `add_card` 容量门 | 单测喂的 key 与生产传的不是同一个形态，**测试绿但门从没生效** |

**做法**：负向验证——先把缺陷人为还原，确认门禁报红且信息可读，再修复。
本轮三次修复都走了这条路（先红 → 后绿），报告里附有原文。

### 附则 4 · 裁决内的活没做完，**必须点名说"没做、为什么"**

**背景**：2026-09-12 阶段 2，用户裁决里含"guardrails 核实并入阶段 2"一条。
我做的是**部分**——收了字段名与枚举成员，**没有**逐条核实 guardrails 的散文规则。
但汇报名单里**没有点出这件事**，只在别处提了一句"归阶段 2"就滑过去了，
是用户在验收时翻出来要求补账的。

**危害**：这比"做错了"更难发现。做错了至少在 diff 里看得见；
**没做而没提**，下一次翻到它时已经隔了好几轮，上下文全丢。

**规则**：
1. 汇报时对裁决逐条对照，每条明确给出**做完了 / 没做**；
2. 没做的必须写清**为什么没做**（原因可以是"判断该独立成批""缺验收手段"
   "被更高优先级打断"——但**不能是沉默**）；
3. 没做的**当场登记进待办区**（本文第三节），附处置意向，而不是口头带过。

**判断标准**：如果用户需要靠"自己再翻一遍裁决"才能发现某条没做，那就是违反本附则。
