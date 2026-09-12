# 存量落盘 operations 调研报告（阶段 4-1，只读）

> 用户裁决第 1 条：「先做只读调研：统计 `.sitecraft-data` 与 Postgres 中已落盘的
> operations/inverseOperations 里 `update_card`/`add_card`/`remove_card` 的实际出现频次与形态，
> 输出报告后**停下等我确认，再动代码**。禁止在没摸清存量数据前定别名方案。」
>
> 本报告完成后**停下**。未动任何产品代码，只新增两个只读脚本。

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
本机 `SITE_STORE=file` → **当前后端是文件**。

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

### 2.4 Postgres 侧：**无法取证**（不是「没有旧数据」）

```
$ node scripts/survey-persisted-operations-pg.mjs
无法取证：连不上 127.0.0.1:5432 —— connect ECONNREFUSED 127.0.0.1:5432
（本机 5432 无监听，Postgres 后端未在运行；这不是「没有旧数据」。）
exit=2
```

- `DATABASE_URL` 指向 **127.0.0.1**（本机，非生产库）；
- `netstat` 显示本机无 5432/5433 监听；`docker ps` 里只有 `yunpai-neo4j` 一个无关容器在重启；
- `docker-compose.yml` 定义了 `postgres:16-alpine` + 具名卷 `sitecraft_pg`，
  但**当前未运行**。具名卷意味着：若曾用 compose 跑过，数据可能仍在该卷里。

脚本遇到连不上时**退出码 2 并明确说"无法取证"**，不退回 0——否则「库没起」会被误读成「存量是空的」。

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

### 3.2 需要用户裁决的三点

1. **是否要启 Postgres 取证？** compose 里有服务与具名卷，但启容器属于「动环境」，
   按红线不擅自做。若不启，则本报告的 PG 结论**永久停留在"无法取证"**，
   别名方案只能建立在「文件后端 + 生产按 compose 部署时同库异卷」的假设上。
2. **`card:` 前缀去留**：已证实零落盘、纯批内。改名是**纯改代码**，无兼容层需求
   （这是本轮唯一一个可以"直接改干净"的协议串）。
3. **`add_card`/`remove_card` 零存量** → 别名兼容的成本主要压在 `update_card` 一个名字上。

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
- 未启 Postgres 容器；未跑迁移；未连任何远程库。

**写了又删的**（负向验证的产物，不留痕）：
- 一个临时测试 `tests/tmp-itemid-cap.test.ts`，用于证伪 3.1 的推断；已删除，`tests/` 无残留。
