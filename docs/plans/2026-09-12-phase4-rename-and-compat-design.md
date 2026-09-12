# 阶段 4 设计方案：操作名归一 + 持久化数据兼容

> **状态：待裁决，一行产品代码都还没动。**
> 调研依据：[`2026-09-12-persisted-operations-survey.md`](2026-09-12-persisted-operations-survey.md)（同目录）
> 用户裁决第 3 条：「op 名映射与读取归一化必须覆盖两个后端的读取路径；
> 往返验收测试（旧名读入→undo 重放→新名落盘→再读）文件、PG 各一个样本。」

---

## 一、先厘清范围：阶段 4 其实有**两个独立的问题**

调研过程中发现它们常被混为一谈，但**风险等级、改法、验收方式全都不同**，
必须拆开做（各自独立 commit）。

| | 问题 A：**op 改名** | 问题 B：**历史 op 缺字段** |
|---|---|---|
| 是什么 | `update_card` → `update_item` 等 | PG 里 8 条 `update_card` **缺 `locale`** |
| 存量 | 686 处（文件 288 + PG 398） | 8 处（**只在 PG**） |
| 今天的状态 | **能正常读**（名字不同不影响读取，因为代码里没有按 op 名的 schema 校验） | **能读，但会写坏草稿**（见 §四） |
| 性质 | 命名债 | **静默数据损坏** |
| 我的建议 | 按裁决做 | **优先做**（危害更实） |

**先摆这个表，是因为如果只按"改名"理解阶段 4，会漏掉 B，而 B 是会真坏数据的那个。**

---

## 二、问题 A：op 名映射与读取归一化

### 2.1 归一化点：两处，且是**唯一**的两处（已取证）

| 后端 | 函数 | 行 |
|---|---|---|
| 文件 | `readRecord()` | [`lib/site-store.ts:79`](../lib/site-store.ts#L79)（history 转换在 `:85-86`） |
| PG | `rowToRecord()` | [`lib/site-store.ts:352`](../lib/site-store.ts#L352)（history 转换在 `:356-357`） |

**改动面已被我缩到最小**：`ChangeSet` 类型**只在 `lib/site-store.ts` 里定义、只在那里被构造**，
所以在这两个函数里各插一次归一化，就覆盖了全部读取路径。**不需要碰 `ChangeSet` 形状**。

读取点调用方（改完自动受益，无需逐个改）：
`readRecord` → `:185 / :223 / :286 / :320 / :528 / :557`；
`rowToRecord` → `:380 / :409 / :565`。

**实现**：`lib/site-operations.ts` 导出一个纯函数

```ts
/** 把落盘的旧名 op 归一成新名。纯函数、只读、不抛错——读不认识的形态就原样返回。 */
export function normalizePersistedOperations(operations: unknown): SiteOperation[]
```

在 `readRecord` 与 `rowToRecord` 里各调一次。**关键：归一化必须容忍解析失败**
（见 §四——存量形态比今天的 schema 宽）。

### 2.2 写入路径：只需要改名字，**不需要兼容层**

取证结论：`writeRecord` / PG 的 `record.history = [...record.history, changeSet]`
**只 append 新 ChangeSet，从不回写旧条目**。
所以"写入只写新名"是**自然结果**，不需要额外做"新写时把旧历史也翻译一遍"这种危险操作。

⚠️ **但有一条必须说清楚**（否则用户会以为做完 A 就没旧名了）：
**历史条目里的旧 op 名会永远留着**。它们不会消失，也不需要消失——
读取侧能认就行。若将来想要"干净的落盘"，那是一次**显式迁移**（改写两个后端的 JSON），
属于另一个决策，**不在本方案内**。

### 2.3 关于 `schemaVersion`：**建议不引入**

理由（有调研支撑，不是省事）：

1. 项目**已经有** `DRAFT_SCHEMA_VERSION`，且它的注释明确记着**为什么刻意不提版本号**：
   一提就走 `normalizeDraft` 的破坏性 legacy 分支，会把整站重置成 Forge 演示文案
   （[`lib/site-document.ts:96-105`](../lib/site-document.ts#L96-L105)）。
   **给操作历史再引一个版本号，是在同一个坑边上再挖一个。**
2. 操作历史的兼容是**改名**问题，判据是"这个 op 名认不认识"，
   一个映射表就够了——**版本号解决的是"整体形状变了"，这里没到那一步。**
3. 8 条缺字段的数据（§四）**用版本号也救不了**：它们没有版本标记，
   只能靠**形态判据**（缺 `locale` 就是缺），而不是靠版本号。

**结论**：用「形态归一化」而不是「版本推进」。
若用户坚持要 `schemaVersion`，那它必须只出现在**归一化函数内部**做分支，
且**读取兼容层必须只有那一个入口**（裁决第 3 条）——**禁止散落 `if`**。

### 2.4 改名清单（**待裁决，我不自行定名**）

调研给出的事实：**存量旧名 100% 是 `update_card`**，`add_card`/`remove_card` **两个后端都为零**。

| 现名 | 建议 | 需要别名兼容吗 |
|---|---|---|
| `update_card` | `update_item` | **要**（686 处存量） |
| `add_card` | `add_item` | **不要**（零存量，可直接改） |
| `remove_card` | `remove_item` | **不要**（零存量，可直接改） |

⚠️ 按治理红线「**停下来问，不要自己发明名字**」：上表是**建议**，
**最终名以 glossary 条目为准**，需用户拍板后再动手。

### 2.5 别名映射表放在哪（单一来源）

新增 `lib/legacy-op-names.ts`，内容是**唯一**的一张表：

```ts
export const LEGACY_OPERATION_NAMES: Readonly<Record<string, string>> = {
  update_card: "update_item",
  add_card: "add_item",
  remove_card: "remove_item",
};
```

**为什么单独一个文件**：别名表本身是一个契约，将来只会"越来越少"（旧数据渐渐淘汰）。
放独立文件后，**删掉它 = 兼容期结束**，是一个可见的动作，不会埋在别的模块里被遗忘。

### 2.6 `card:` 前缀（裁决第 2 条要求评估去留）

**评估结论：可以一起改，且不需要任何兼容机件。**

- 两个后端落盘数据里**零出现**（文件侧两种扫法互证；PG 侧同样为零）；
- 产生它的两个函数（`chat-task-executor.ts` 的 `operationEffects`、
  `site-operations.ts:908` 的 `operationIdentity`）都是**批内内存计算，算完即弃**；
- 它**不是持久化协议**，改名不触碰任何落盘数据。

⚠️ **但要注意语义**：`card:` 里的 `card` 是**名词位**（指"一条条目"），
按阶段 3 已定的 glossary G-1 应该叫 `item`。所以建议改为 `item:`。
**这条改完后，`card:` 这个名字在整个仓库里应当只剩操作名（已在上表处理）**——
这正好可以作为阶段 4 的一条机械验收断言。

---

## 三、往返验收测试（裁决第 3 条要求，文件 / PG 各一个样本）

### 3.1 测试要证的链路

```
旧名读入 → undo 重放 → 新名落盘 → 再读
```

即：一条**旧名**的 ChangeSet 从存储读出来，`undo`/`redo` 能正常重放，
重放产生的 ChangeSet 落盘后是**新名**，再从存储读出来仍然能重放。

### 3.2 文件后端：**没有现成范式，需要一处小改造**

现状核实：
- **没有 `site-store` 的测试**（`tests/` 下只有 `lead-store.test.ts` / `release-store.test.ts`）；
- 但 `tests/chat-provenance.test.ts`、`tests/conversational-undo.test.ts`、
  `tests/generation-cancellation-contract.test.ts`、`tests/site-seed-draft.test.ts`
  **已经 import 了 `site-store`**，说明它在测试进程里**跑得起来**（顶层没有建表/连库副作用）。

**必须解决的障碍**：`storageRoot` 是**模块级常量**（`lib/site-store.ts:64`），
测试无法隔离——写测试会**污染真实的 `.sitecraft-data/sites`**。

**建议改法（对齐现成范式）**：项目里 `ReleaseStore` 就是**类 + 注入 `rootDir`**
（`lib/release-store.ts:70-76`），测试用 `mkdtemp` 隔离。
`site-store` 没有类，所以**最小改法是让 `storageRoot` 可被环境变量覆盖**：

```ts
const storageRoot = process.env.SITECRAFT_DATA_ROOT
  ? path.join(process.env.SITECRAFT_DATA_ROOT, "sites")
  : path.join(process.cwd(), ".sitecraft-data", "sites");
```

> **⚠️ 这一行本身是个设计决定，需要用户点头**：它给 `site-store` 引入了一个新的环境变量。
> 备选是"不测文件后端，只测归一化纯函数"——但那样就**证不了"读入→重放→落盘"这条真实链路**，
> 只剩单测，而本项目已经吃过三次"单测绿但生产不生效"的亏（glossary 附则 3）。

### 3.3 PG 后端：**有现成的可跑范式**（用户已起库）

用户已把 PG 起在宿主机 **5433**。测试连法沿用调研脚本的写法：

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/site_studio npm test
```

⚠️ **红线执行**：`.env.local` 的 `DATABASE_URL` **仍指 5432，不动**（裁决第 5 条）。
所以测试**不能依赖 `.env.local`**，必须走**显式传入的 `DATABASE_URL`**，
且**连不上就 skip 并打印原因**，不能算失败（否则 CI/无库环境全红）。

### 3.4 附则 3：这两个测试必须**先证明会失败**

负向验证的做法（本轮已有先例，照做）：
1. 先把别名映射表**改成空**（假装没做兼容）→ 跑测试 → **必须红**，
   且报错信息要能读出"旧名没被认出来"；
2. 还原映射表 → 跑测试 → **必须绿**；
3. 两条原文都贴进报告。

**不做第 1 步的话，这个测试就是第四个"假门禁"。**

---

## 四、问题 B：历史 op 缺字段会**静默写坏草稿**（本方案最重要的发现）

### 4.1 现象（实测，不是推理）

PG 里有 8 条 `update_card` 形态是 `{body, index, locale 缺失, op, section}`。
实测把它喂给今天的代码：

```
siteOperationSchema.safeParse(corrupt).success = false

applySiteOperations **没有抛错**，changed = true
写后的 item: {
 "id": "quality",
 "title": { "zh": "质量可追溯", "en": "Traceable quality", "undefined": "新标题" },
 "body":  { "zh": "关键过程与交付记录可逐项核验。", "en": "...", "undefined": "新正文" }
}
→ 是否污染： true
```

**`applySiteOperations` 里没有任何 schema 校验**（核实过：全文件零处 `siteOperationSchema.safeParse`），
`update_card` 分支直接写 `item.title[operation.locale]`，`locale` 是 `undefined` 时
**JS 会把它转成字符串 `"undefined"` 当键**，于是往 `zh`/`en` 旁边多写一个 `undefined` 键，
**`changed = true`，草稿被改坏，且不报错。**

### 4.2 为什么"今天还没炸"

- 这 8 条**只在 undo/redo 时被读**（`site-store.ts:323/472` 的 `changeSet.inverseOperations`）；
- `draft` 读取会过 `normalizeDraft` → `siteDraftSchema.safeParse` →
  **Zod 默认会剥掉未知键**（实测 `{zh,en,undefined}` → `{zh,en}`，success **true**），
  **所以下次读草稿时污染会被无声抹掉**——不是修好了，是**看不见了**。
- 但它**会短暂地坏**：在 `normalizeDraft` 跑之前，被污染的 `draft` 会先 `writeRecord`
  落盘；那段窗口里草稿是坏的。

### 4.3 严重性：**比 8 条数据更大的是这个机制**

**这个洞不是那 8 条数据造成的，是"`applySiteOperations` 没有入参校验"造成的。**
今天只有 8 条历史数据能触发它；**任何**能构造出缺字段操作的路径都能触发
（比如将来某个 schema 放宽、或某条别的旧数据）。

### 4.4 修法建议（**需要裁决，不自行修**）

两个层面，建议**都做**，但分两个 commit：

1. **窄修（针对 op 归一化，阶段 4 内）**：
   归一化函数对"缺 `locale` 的 `update_card`"补一个默认值（`zh`，与
   `nonLocalizedTargets` 分支的既有默认一致），并在**日志里留痕**（不静默）。
2. **宽修（独立批次，建议登记为 T-6）**：
   在 `applySiteOperations` 的入口**逐条做形状校验**，不合法就**抛可读错误**
   而不是写出坏键。这是"写入期拦截"该做的事——**和本项目冲突 #8 的修法同构**
   （那次也是"schema 层兜底不算写入期拦截"）。

> ⚠️ 红线：宽修会改变 `applySiteOperations` 的行为（现在有些"能跑但错"的输入会变成抛错），
> **可能打破现有 687 个测试中的某些假设**，必须先跑一遍确认影响面**再决定**。

---

## 五、执行顺序建议（每步一个 commit，各跑 typecheck + npm test）

| # | 内容 | 依赖 |
|---|---|---|
| 1 | 登记 T-6（`applySiteOperations` 无入参校验）到 glossary 待办区 | 无 |
| 2 | `card:` → `item:`（批内协议串改名，零存量、零兼容） | 无 |
| 3 | 问题 B 的窄修：归一化里补 `locale` + 留痕 | 归一化函数先存在 |
| 4 | 问题 A：改名 + `LEGACY_OPERATION_NAMES` + 两处归一化点 | **用户拍板新名** |
| 5 | 往返验收测试（文件 + PG 各一），含负向验证 | 2~4 完成 |
| 6 | （可选，另批）宽修：`applySiteOperations` 入参校验 | 先评估影响面 |

---

## 六、需要用户裁决的点（汇总）

1. **新名拍板**：`update_item` / `add_item` / `remove_item` 是否照准？（红线要求不自行发明名字）
2. **`schemaVersion`**：我建议**不引入**（理由见 §2.3）；若仍要，必须限定在归一化函数内部。
3. **`generation_records` 的 129 处旧名算不算范围内**？（它是存证、只读回显、不参与 undo/重放）
4. **`SITECRAFT_DATA_ROOT` 环境变量**：为了给文件后端写真实链路测试而引入，是否接受？
   （备选：只测纯函数，但证不了真实链路）
5. **问题 B 的窄修现在做，还是连宽修一起做？**（我建议窄修并入本阶段、宽修单列 T-6）
6. **`card:` → `item:`** 是否照准？

---

## 七、本方案**没做**的事（点名，不留白）

- **一行产品代码都没改**（本文件与新登的 T-6 除外）；未动任何 op 名、未建别名表；
- **未写任何测试**（测试要在 §5 的第 5 步、改名落定之后写，先写会写错名字）；
- **未跑迁移**：`.sitecraft-data` 与 PG 里的历史条目**原样保留**；
- **PG 侧全程只读**（`SELECT`），未写入任何行；
- `.env.local` **未动**（仍指 5432）。
