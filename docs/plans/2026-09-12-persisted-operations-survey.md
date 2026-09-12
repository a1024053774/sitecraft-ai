# 存量落盘 operations 调研报告（阶段 4-1，只读）

> 用户裁决第 1 条：「先做只读调研：统计 `.sitecraft-data` 与 Postgres 中已落盘的
> operations/inverseOperations 里 `update_card`/`add_card`/`remove_card` 的实际出现频次与形态，
> 输出报告后**停下等我确认，再动代码**。禁止在没摸清存量数据前定别名方案。」
>
> 本报告完成后**停下**。未动任何产品代码，只新增两个只读脚本。
>
> **2026-09-12 修订**：PG 侧原为"无法取证"（本机 5432 无监听）。用户已把
> `docker-compose.yml` 的 postgres 映射改为 `5433:5432` 并起好服务，本节据**实证**重写。
> 见 §六「修订记录」。

---

## 〇、一句话看结论

| 后端 | 站点 | ChangeSet | 旧名出现 | 其中 `add_card`/`remove_card` |
|---|---:|---:|---:|---|
| **文件** `.sitecraft-data/sites/*.json` | 433 | 109 | **288** | **0 / 0** |
| **Postgres** `sitecraft_sites` | 845 | 553 | **398** | **0 / 0** |
| （PG 另有）`generation_records` 存证 | 59 行 | —— | 129 | 0 / 0 |

> ### ⚠️ 两个后端是**独立数据**，数字**互不包含、不可相加**
>
> 不是"同一批东西的两份"。实测 site_id 重叠度：
> ```
> PG site_id 数：845
> 文件 site_id 数：434
> **重叠数：39**（仅 9.0% 的文件站点在 PG 里也有）
> PG 独有：806；文件独有：395
> ```
> 所以 **288 与 398 不是矛盾，也不是谁漏了谁**——它们各自统计自己那一批。
> 合计 686 也**不是**"总存量"，只是"两批之和"，业务上无意义。
>
> 旁证：`ChangeSource` 分布两边截然不同——文件 `ai` 82 / `manual` 20，
> PG `manual` 421 / `ai` 123 / `template` 9。测试产生的站点（PG 独有 806 个里的
> `p1-schema-once-*`、`f2-timeout-twice-*` 这类）与本地演示站点（文件独有）
> 本就是两批不同用途的数据。

---

## 一、方法与可复现命令

| 脚本 | 取数范围 | 命令 |
|---|---|---|
| [`scripts/survey-persisted-operations.mjs`](../scripts/survey-persisted-operations.mjs) | 文件后端 `.sitecraft-data/sites/*.json` | `node scripts/survey-persisted-operations.mjs` |
| [`scripts/survey-persisted-operations-pg.mjs`](../scripts/survey-persisted-operations-pg.mjs) | Postgres `sitecraft_sites(history, future)` | `node scripts/survey-persisted-operations-pg.mjs` |

两个脚本都**只读**：文件侧只 `readFile`，PG 侧只 `SELECT`；不建表、不迁移、不写。

**后端判定**（`.env` 与 `.env.local` 实读，两者一致）：
```
SITE_STORE=file
DATABASE_URL=postgresql://…@127.0.0.1:5432/site_studio   （凭据未打印）
```
`lib/site-store.ts:67` 的判定是 `SITE_STORE === "postgres" || NODE_ENV === "production"`，
本机 `SITE_STORE=file` → **应用当前写的是文件后端**。

⚠️ 但 PG 里**确实有另一批数据**（845 行）——是历史上以 `SITE_STORE=postgres`
（或 `NODE_ENV=production`）跑出来的，与本地文件数据无交集的那部分（见 §〇 重叠度）。
**改后端不会让两批合并**，所以别名方案必须同时覆盖两条读取路径。

**PG 侧连法**（用户已起服务，宿主机映射 5433）：
```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/site_studio \
  node scripts/survey-persisted-operations-pg.mjs
```
`.env.local` 的 `DATABASE_URL` 仍指向 5432，**维持不动**（用户裁决第 5 条）。

---

## 二、结论（先说结果）

### 2.1 文件后端（`.sitecraft-data/`）

```
数据根：D:\sitecraft-ai\.sitecraft-data\sites
站点记录文件：433
含 history/future 的文件：84
ChangeSet 总数：109（history 108 / future 1）
forward operations 总数：966
inverseOperations 总数：838

**旧名出现次数：forward 146 / inverse 142 / 合计 288**
**含旧名的文件数：28**
```

| op 名 | forward | inverse |
|---|---:|---:|
| `set_text` | 716 | 618 |
| **`update_card`** | **146** | **142** |
| `set_template` | 41 | 15 |
| `set_design_tokens` | 31 | 31 |
| `update_product` | 18 | 18 |
| `set_section_visibility` | 12 | 12 |
| `replace_products` | 2 | 2 |
| **`add_card`** | **0** | **0** |
| **`remove_card`** | **0** | **0** |

**要点：存量旧名 100% 是 `update_card`，`add_card`/`remove_card` 从未落盘。**

### 2.2 `update_card` 的字段形态（四种，全部含 `op/section/index/locale`）

| 次数 | 形态 |
|---:|---|
| 156 | `{body, index, locale, op, section, title}` |
| 122 | `{body, index, itemId, locale, op, section, title}` |
| 6 | `{index, locale, op, section, title}` |
| 4 | `{index, itemId, locale, op, section, title}` |

- 带 `itemId` 的：**126 / 288**；不带的：162。
- `section` 取值只有两种：`features` 160 / `services` 128 —— **`faq` 一次都没有**。
- `ChangeSource` 分布：`ai` 82 / `manual` 20 / `template` 7。

这与 `updateCardOperationSchema` 的 `itemId` 可选、`section` 用 `cardSectionSchema` 完全吻合，
**没有出现任何 schema 装不下的形态**（假如有，那本身就是更严重的读取缺陷）。

### 2.3 `card:` 前缀串：**落盘数据里零出现**（用两种方式核实）

第一种是按字段名递归扫（跳过 `op/operations/inverseOperations`，且**不**跳过 `provenance`）：

```
## 非 op 位置的 card: 前缀串（幂等键候选）
  （无）
```

第二种更严——**整个 ChangeSet 递归找 `card:` 子串**（不看字段名，只匹配任何字符串值）：

```
扫描文件: 433 | 含 provenance 的 ChangeSet: 0
包含子串 "card:" 的字符串出现次数: 0
```

核实了它为什么不在：`card:` 由 [`lib/chat-task-executor.ts:27-33`](../lib/chat-task-executor.ts#L27-L33)
的 `operationEffects()` 与 [`lib/site-operations.ts:908`](../lib/site-operations.ts#L908)
的 `operationIdentity()` 产生，**两者都是批内内存计算**——前者用于同批操作冲突检测，
后者用于 `dedupeByTarget` 同目标去重，算完即弃，**从不进入 `ChangeSet`**。

→ **`card:` 不是持久化协议，改名没有存量兼容负担。**

> **顺带核实（不属本阶段范围，只登记）**：`ChangeSet.provenance` 在文件后端**同样恒不落盘**。
> 写入点[`lib/site-store.ts:301/449`](../lib/site-store.ts#L301) 是条件写入（`...(args.provenance ? {...} : {})`），
> 而它的上游 `recordGeneration()` 开头就是 `if (!usePostgres) return;`
> （[`lib/generation-record.ts:156`](../lib/generation-record.ts#L156)）——
> **文件后端下生成存证整条链路都不存在**（`listGenerationRecords` 同样是 `if (!usePostgres) return []`）。
> 本地一直是 `SITE_STORE=file`，所以 433 个文件里 0 条 provenance 是**设计使然，不是数据丢失**。
> 与阶段 4（改用与兼容）无关，仅作事实记录。

### 2.4 Postgres 侧：**实证结论**（845 行，与用户摸底完全吻合）

```
站点行数：845
ChangeSet 总数：553
forward operations：1452 / inverseOperations：1333

**旧名出现次数：forward 199 / inverse 199 / 合计 398**
**含旧名的站点数（forward）：27**
**含旧名的站点数（forward∪inverse）：27**
```

| op 名 | forward | inverse |
|---|---:|---:|
| `set_text` | 1057 | 965 |
| **`update_card`** | **199** | **199** |
| `set_template` | 65 | 47 |
| `set_design_tokens` | 47 | 40 |
| `update_product` | 38 | 37 |
| `set_asset` | 26 | 26 |
| `set_section_visibility` | 16 | 15 |
| `replace_products` | 4 | 4 |
| **`add_card`** | **0** | **0** |
| **`remove_card`** | **0** | **0** |

**与用户摸底的对照：845 ✓ / 398 ✓ / 27 ✓ / 0 ✓ 全部一致。**

#### `update_card` 的字段形态（PG 比文件多一种，见下）

| 次数 | 形态 |
|---:|---|
| 256 | `{body, index, locale, op, section, title}` |
| 102 | `{body, index, itemId, locale, op, section, title}` |
| 26 | `{index, locale, op, section, title}` |
| **8** | **`{body, index, locale, op, section}`** ← 文件后端没有这种 |
| 6 | `{index, itemId, locale, op, section, title}` |

- 带 `itemId` 的：**108 / 398**（文件侧是 126/288）。
- `section` 取值：`features` 228 / `services` 170 —— **仍然没有 `faq`**（两个后端一致）。
- `ChangeSource`：`manual` 421 / `ai` 123 / `template` 9。

**第 4 种形态的成因（已核实，不是缺陷）**：`updateCardOperationSchema` 的
`locale` 是 `z.enum(locales)`（**必填**，[`lib/site-operations.ts:112`](../lib/site-operations.ts#L112)），
所以 `{…, section}` 缺 `locale` 的形态**不可能由现在的代码写出**。
它只可能来自**更早版本**的 schema（那时 `locale` 还是可选），属于**历史遗留形态**。
→ 这条本身不构成读取缺陷（zod 读它会失败，但落盘数据只在 undo/重放时被读），
**但它提醒：别名方案不能假设"所有存量都符合今天的 schema"**。

#### `generation_records`：**另一个 store，不是 ChangeSet**

> 这一项单列，是因为它最容易和上面的 398 混起来被当成"又是旧名"。

```
generation_records 行数：59
generation_records.operations 里的 op 名：
       462  set_text
       129  update_card
        29  set_template
        16  set_section_visibility
        16  set_design_tokens
         2  update_product
  → 其中旧名：129
  含 provenance 的行：59
```

**本报告的 398 只统计 `sitecraft_sites.history/future` 的 ChangeSet，不含这 129。**
两者是不同的东西：ChangeSet 是**已提交的变更历史**（可 undo/redo），
`generation_records` 是**每次生成尝试的存证**（`recordGeneration` 写入，只读回显）。
如果把它们相加会得到 527，**那个数字没有业务含义**。

---

## 三、对别名方案的影响（供裁决，不是我在定方案）

### 3.1 一条**已撤回**的推断（记录在案，避免以后有人重新"发现"一次）

调研 `itemId` 形态时我曾推断出一个缺陷并写进本报告初稿，**动手前核实后撤回**：

> ~~`itemId` 上限在合法用户操作下会被撞到~~ —— **不成立**。

核实过程（两步都做了，不是只看代码）：

1. 写了一个测试：把条目 id 设成 70 字符（`editableItemSchema.id` 允许 ≤80），
   跑 `aiOperationSchema.safeParse` + `applySiteOperations` → **通过**。
2. 回头读 [`lib/inline-edit-mapping.ts:216/273/292`](../lib/inline-edit-mapping.ts#L216) 三处 `itemId: item.id`
   → **都是裸 id，没有任何前缀拼接**（我最初把注释里的文件路径 `xxx.ts:216` 误当成了"加前缀"）。

结论：`editableItemSchema.id` 的 `.max(80)` 与 `updateCardOperationSchema.itemId` 的 `.max(80)` **同值**，
且内联编辑原样传递，**当前不会溢出**。这两处仍属"同值不同源"（附则 2 的口径），但**不是缺陷**，
不构成待办。

### 3.2 别名方案必须同时覆盖两条读取路径（**本报告最重要的一条**）

两个后端是**独立数据**（重叠仅 39/434），**不是"换个后端读同一批"**。
这意味着：

> **只覆盖一条读取路径的别名方案，会漏掉另一条路径上的全部存量。**

具体地，别名与读取归一化必须落在**能被两条路径共同经过的位置**：

| 路径 | 入口 | 读 ChangeSet 的位置 |
|---|---|---|
| 文件 | [`lib/site-store.ts:79 readRecord`](../lib/site-store.ts#L79) | `history`/`future` 原样 `JSON.parse` 后直接当 `ChangeSet[]` 用 |
| PG | [`lib/site-store.ts`](../lib/site-store.ts) 的 PG 分支 | 同样把 `history`/`future` 当 `ChangeSet[]` 用 |

**两条路径都不过任何 schema 校验**——`readRecord` 里 `raw.history as ChangeSet[]` 是**类型断言**，
不是校验（[`lib/site-store.ts:85`](../lib/site-store.ts#L85)）。
所以"旧名读入"这件事今天**根本没有归一化点**，需要新建**唯一入口**（不是散落 `if`）。

### 3.3 需要用户裁决的三点（已按 PG 实证更新）

1. ~~是否启 Postgres 取证~~ → **已取证完毕**（845 行 / 398 处旧名 / 与摸底完全吻合），
   本条**已消解**，不再需要裁决。
   剩一个**新的**待定项：**`generation_records` 要不要一起做别名兼容？**
   它另有 **129 处旧名**，但它是"存证"（只读回显、不参与 undo/重放），
   按"写入只写新名、读取长期兼容"的原则，**可以只做读取侧容忍、不做写入侧改写**。
   需用户定性：**算不算在本次兼容范围内**。
2. **`card:` 前缀去留**：已证实**两个后端都零落盘**、纯批内。
   改名是**纯改代码**，无兼容层需求（本轮唯一可以"直接改干净"的协议串）。
3. **`add_card`/`remove_card` 两个后端都零存量** → 别名兼容的成本**全部压在 `update_card` 一个名字上**。
   （连带结论：`add_card`/`remove_card` 更名**可以直接改**，不需要别名机件。）

### 3.4 顺带登记：`update_card` 存在**不符合今天 schema** 的历史形态

PG 侧 8 处 `{body, index, locale, op, section}` **缺 `locale`**，而今天的
`updateCardOperationSchema.locale` 是**必填**。核对过写入代码：现在的代码写不出这种形态，
所以它是**更早版本 schema 的遗留**。

**这件事对别名方案是本报告最有价值的提醒**：
存量数据的形态**比今天的 schema 更宽**，任何"先按今天 schema 解析、失败再兜底"的
归一化写法都会在这 8 条上走兜底分支。归一化必须**容忍缺字段**，不能假设解析成功。

---

## 四、脚本自身的可信度（附则 3：门禁必须会失败）

`survey-persisted-operations.mjs --selftest` 会往站点目录放一条**人造记录**
（含 1 条 `update_card`），跑完自动清理。实测：

```
########## 基线（不加参数） ##########
站点记录文件：433
含 history/future 的文件：84
**旧名出现次数：forward 146 / inverse 142 / 合计 288**
**含旧名的文件数：28**

########## 负向自检（+1 条人造 update_card） ##########
站点记录文件：434
含 history/future 的文件：85
**旧名出现次数：forward 147 / inverse 142 / 合计 289**
**含旧名的文件数：29**
```

每个数字都跟着动了 → 统计链路**确实在读 `history[].operations[].op`**，不是一个打印 0 的空壳。
（清理后复跑 `ls .sitecraft-data/sites/*.json | wc -l` = 433，与基线一致。）

---

## 五、本轮改了什么 / 没改什么

**改了**：
- `lib/template-manifests/types.ts` 的 `presentationSlot` 注释（用户新登记的 **T-5**：
  原注释手抄了段名枚举，漏 `hero` 且第五值写成 `contact`；改为指向 `getTemplatePresentation()` 的引用，不再抄第二份）。
- 新增两个只读调研脚本。

**没改**（按裁决"出报告后停下等确认"）：
- 任何操作名、任何别名逻辑、任何 `schemaVersion`、任何 `card:` 字符串；
- 未跑迁移；未连任何远程库（PG 侧全程 `SELECT`）。

**写了又删的**（负向验证的产物，不留痕）：
- 一个临时测试 `tests/tmp-itemid-cap.test.ts`，用于证伪 3.1 的推断；已删除，`tests/` 无残留。

**由用户改的**（不在我的提交里、但与本报告相关）：
- `docker-compose.yml` 的 postgres 端口映射 `5432:5432` → `5433:5432`（宿主机 5432 被占）；
  容器内端口、healthcheck、具名卷 `sitecraft_pg` 均未动，数据未动。
  由我以独立 chore 提交入库（commit message 已注明）。
- `.env.local` 的 `DATABASE_URL` **仍指向 5432，维持不动**（用户裁决第 5 条）。

---

## 六、修订记录

| 日期 | 改动 | 原因 |
|---|---|---|
| 2026-09-12 | 初版：PG 侧记为"无法取证" | 本机 5432 无监听，按红线不擅自启容器 |
| 2026-09-12 | **PG 侧改为实证结论**（845 行 / 398 处旧名 / 27 站点），新增 §〇 后端独立性、§2.4 完整口径、§3.2 双路径、§3.3 更新裁决项、§3.4 历史形态登记 | 用户起好 PG 并把映射改为 5433，实证口径到手 |

**修订中被推翻的一条旧结论**（如实记录，不悄悄改掉）：
初版 §3.2 第 1 点写的是「若 PG 不启，则本报告结论永久停留在'无法取证'，
别名方案只能建立在**假设**上」。PG 实证后该假设被**证实为假**——
两批数据重叠仅 9%，不是"同库异卷"，**而是两个彻底独立的批次**。
现在的 §3.2 结论（必须同时覆盖两条读取路径）正是从这条推翻里来的。
