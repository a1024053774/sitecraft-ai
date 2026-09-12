# 阶段 4 收口报告：操作名归一 + 持久化兼容

> 用户裁决：阶段 4 验收通过；两项发现裁决 ①（接受连带收敛为特性 + 三道护栏）、②（窄修照准、宽修单开批次）；
> 新增 Finishing 门禁 3（e2e 双后端）与 4（本报告）。
>
> **结论：阶段 4 的代码与门禁已完成；`test:e2e` 整体未能判定为绿，原因已归因并登记 T-7。
> 按用户指令「失败先报告不硬修」，**不自称完成**。**

---

## 一、五个 commit 清单

| # | commit | 内容 |
|---|---|---|
| 1 | `5ccc3cd` | **op 改名** `update_card`/`add_card`/`remove_card` → `update_item`/`add_item`/`remove_item`（114 处 / 16 文件）+ 别名表 `lib/legacy-op-names.ts` + 两处读取归一化 + 往返测试（文件 / PG 各一） |
| 2 | `6772fe6` | **`card:` 键构造收口**为唯一函数 `operationConflictIdentity`（裁决 6 的前置：两处原本各手拼且**已漂**） |
| 3 | `90d4b25` | **批内键前缀** `card:` → `item:` |
| 4 | `46eb29f` | **T-6 窄修**：`update_item` 的 `locale` 守卫 |
| 5 | `0d0fea0` | glossary：T-6 补记「改名把它激活了」+ 记下那次假门禁 |
| 6 | `c9970cf` | 别名表**三道护栏**（①a 快照测试 / ①b 附则 5 / ①c 方案 §2.2 就地改正） |
| 7 | `6802278` | e2e 端口解析收为**单一来源** + 端口自证门禁 + 阶段 4 端到端往返门禁 |

（1–7 共 7 个；用户问"五个 commit 清单"，实际含护栏与 e2e 批次共 7 个，一并列出。）

---

## 二、两次负向验证原文（附则 3）

### 2.1 别名表「删一条 → 静默读不出来」的护栏

把 `add_card: "add_item"` 从别名表删掉：

```
✖ 别名表快照：内容与快照逐条一致（改值/删条目都会红） (2.1662ms)
✖ 别名表追加式：快照里的每一条都仍在，且值没被改过 (0.3812ms)
✔ 别名表只做映射，不改行为：不是旧名的原样返回 (0.1871ms)
ℹ pass 1
ℹ fail 2
```

恢复后：`ℹ pass 3 / ℹ fail 0`

### 2.2 读取归一化的「重放」验证（两次，第一次是**假门禁**）

**第一次（错的）**：打空别名表后，用例红在**样本构造处**：

```
✖ 文件后端往返… AssertionError: 别名表必须把旧名 update_card 映射到 update_item
  + actual - expected
  + undefined
  - 'update_item'
```

这条**看着像门禁生效，其实没有**——它根本没走到"旧名能不能重放"那一步。
**已改**：删掉样本构造处的断言，让用例红在归一化结果上。

**第二次（对的）**：别名表仍为空，红在**重放处**：

```
✖ 文件后端往返：旧名读入 → undo 重放 → 新名落盘 → 再读 (19.4658ms)
  AssertionError [ERR_ASSERTION]: 旧名历史必须能重放
  'empty' !== 'applied'
```

`'empty'` 的含义是「这批逆操作一条都没匹配上」→ 正是归一化断链的**静默**症状。
恢复别名表后全绿。

### 2.3 e2e 端口自证（裁决 1 点名的实现要点）

把 `docker-compose.yml` 的 postgres 映射改成 `6433:5432`：

```
compose postgres 映射：6433:5432（宿主机:容器内）
  ok   容器内端口常量 == compose 右侧: 5432
 FAIL  缺省宿主机端口 == compose 左侧: 5433（期望 6433）
  ...
不一致 1 项：缺省宿主机端口 == compose 左侧
exit=1
```

恢复后 `exit=0`。**它证明的是"检查的端口 == compose 真实映射"**，
而不是"端口能不能连"——前者才是假门禁的高发区。

---

## 三、e2e 输出原文

### 3.1 修复前（`5432` 硬编码 → 服务根本起不来）

```
[WebServer] Error: Port 5432 did not become ready within 60000ms
[WebServer]     at waitForPort (file:///D:/sitecraft-ai/e2e/scripts/serve.mjs:35:9)
[WebServer]     at async ensurePostgres (file:///D:/sitecraft-ai/e2e/scripts/serve.mjs:58:3)
Error: Process from config.webServer was not able to start. Exit code: 1
```

### 3.2 阶段 4 专测（PG 模式）—— **通过**

```
Running 1 test using 1 worker
  ok 1 [chromium] › e2e\specs\op-rename-roundtrip.spec.ts:71:7
       › 阶段 4 · op 改名 + 归一化 端到端往返 › 一句话建站 → 生成 → save → 旧名读入 → undo 重放 (3.2s)
  1 passed (14.3s)
```

### 3.3 文件后端模式 —— **被阻断，明确失败**

```
[e2e] 存储后端：file（E2E_STORE=file，不检查 Postgres）
    Error: 文件后端模式被阻断：next start 的 NODE_ENV=production 强制 usePostgres=true
           （lib/site-store.ts:92 等三处），SITE_STORE=file 覆盖不了。
```

**实测根因**（不是推断）：

```
createSite failed: 422 {"error":"DATABASE_URL 未配置，生产环境不会退回本地文件存储。"}
```

`next start` 把 `NODE_ENV` 设为 `production`，而三个 store 的判定都是
`SITE_STORE === "postgres" || NODE_ENV === "production"` → **production 强制走 PG，
`SITE_STORE=file` 覆盖不了**。解开它要改 `lib/` 或改被测服务形态，超出本批次红线。
**按用户门禁 4 的要求"跑不了的用例说明原因，不许静默 skip"——这里是显式失败 + 归因，不是 skip。**

### 3.4 全套 e2e（PG 模式）

```
10 failed
2 skipped
96 passed (5.9m)
```

---

## 四、10 条失败的归因（**先报告，不硬修**）

### 4.1 与阶段 4 改动的因果关系：**已排除**

| 失败 spec | 是否 import 阶段 4 改过的模块 |
|---|---|
| `access-isolation` | 否 |
| `shadcn-pro-preview` | 否 |
| `template-content-coverage` ×2 | 否 |
| `template-language-bridge` | 否 |
| `templates` ×2 | 否 |
| `tmp-asset` | 否 |
| **`workspace` ×2** | 是（`lib/site-store`） |

7 条 spec 连 import 都没有；`workspace.spec.ts` 本轮 **diff 为零**（`git diff c61279f HEAD -- e2e/specs/workspace.spec.ts` 为空）。
且那两条失败用例**只用 `set_text`**——**不是改名碰过的 op**。

### 4.2 那两条的真因：**e2e 测试进程与 `next start` 连不同的库**（登记为 T-7）

页面快照（失败现场）：

```
- strong: 当前草稿 · v1
- button "历史 0"
- log: ... YOU 改回上一条
        SITECRAFT AI 当前草稿没有可撤销的 AI 修改。注意：本次没有修改草稿
- button "撤销" [disabled]
```

即：测试通过 API 提交的那条 AI 变更**从未进入服务端看得见的库**。

**决定性证明**（在 Playwright 测试进程的环境下直接跑 `lib/site-store`）：

```
NODE_ENV = production          ← playwright 会设
SITE_STORE = undefined         ← .env 没被 playwright 加载
DATABASE_URL 端口 = (未设置)
→ getSite 直接抛：DATABASE_URL 未配置，生产环境不会退回本地文件存储。
   at getPostgresSite (lib/site-store.ts:441:9)
```

那个 `await commitOperations(...)` 在 `test()` 体内是**未被等待的 rejection**，
所以失败以"页面说没有可撤销的 AI 修改"的形式出现——**根因被伪装成 UI 问题**。

**数据库侧佐证**：

```
=== 5433 库最近写入的站点 ===
  2d05dec4-1a2a-4c6d-8d2f-6a064555a066 | history 0 | 2026-09-12T07:22:09.396Z
  ...
总行数: 896
```

- `2d05dec4-…` 正是失败快照里的站点，**`history` 为 0** → `commitOperations` 确实从未写入；
- 写入时间戳与测试运行吻合 → **应用侧（`next start`）连的是 5433**（`serve.mjs` 注入的
  `DATABASE_URL` 生效了，`.env` 里的 5432 被覆盖）。

**为什么是结构性的，不是改名造成的**：连接在 `getSite()` 阶段就断了，
而 `getSite` 与 `commitOperations` **出自同一个 `lib/site-store.ts`**，与 op 名无任何关系。

⚠️ **同时暴露的第二件事**：这次 e2e 把本地 PG **从 845 行写到了 896 行**（+51）。
e2e 会在真实本地库上建站点——这与"e2e 不碰真实数据"的期望有出入，一并留给 T-7 考虑。

---

## 五、验收对照（逐条）

| 验收项 | 状态 |
|---|---|
| 单元级验证（`tsc` + `npm test`） | ✅ **tsc 0 错误；694 pass / 0 fail / 1 skip（695）** |
| 别名表 append-only 快照测试 | ✅ 已建，且**证明会红** |
| glossary 写死"落盘旧名不具取证价值" | ✅ 附则 5 |
| 方案 §2.2 错误表述就地改正 | ✅ |
| 两次负向验证原文 | ✅ 本报告 §二（含**第一次是假门禁**的如实记录） |
| **门禁 3：e2e PG 侧覆盖完整路径** | ✅ 专测通过（3.2s） |
| **门禁 3：e2e 文件侧覆盖完整路径** | ❌ **被阻断**，已归因（NODE_ENV=production 强制 PG），未硬修 |
| **门禁 3：全套 e2e 绿** | ❌ **96 passed / 10 failed / 2 skipped**；10 条与本批无因果，真因登记 T-7 |
| 门禁 4：更新待办区 + 本报告 | ✅ |

### 没做的（点名，附则 4）

- **宽修**（`applySiteOperations` 入口全面校验）：按裁决单开批次，**未做**。
- **T-3**（枚举释义三套）、**T-4**（guardrails 核实）：按裁决属后续批次，**未做**。
- **文件后端 e2e 覆盖**：被 `NODE_ENV=production` 阻断，**未做**（已归因，非静默跳过）。
- **`workspace.spec.ts` 两条失败**：按"失败先报告不硬修"，**未修**，登记 T-7。
- **e2e 写入本地库的 51 行**：**未清理**（保留证据；清理与否待用户定）。

---

## 六、本轮 diff 范围自证

e2e 批次的临时红线：diff 只允许出现在 `e2e/`、`scripts/`、`.env.example`、`docker-compose.yml`；
业务代码与 `lib/` 零改动。

**e2e 批次（commit `6802278`）的 diff**——全部落在 `e2e/` 与 `docs/`：

```
 docs/debt-prevention-prompt-for-deepseek.md |  66 +++++++   ← 用户提供的输入文档，入库
 e2e/README.md                               |   2 +-
 e2e/global-setup.ts                         |  13 +-
 e2e/scripts/pg-target.d.mts                 |  10 ++
 e2e/scripts/pg-target.mjs                   |  98 +++++++++++++
 e2e/scripts/preflight.mjs                   |   6 +-
 e2e/scripts/serve.mjs                       |  37 +++++-
 e2e/scripts/verify-pg-target.mjs            | 103 +++++++++++++++
 e2e/specs/op-rename-roundtrip.spec.ts       | 177 ++++++++++++++++++++++++++++
 9 files changed, 503 insertions(+), 9 deletions(-)
```

**`lib/` 在 e2e 批次内零改动**——`lib/` 的改动全部属于阶段 4 的功能批次（commit `5ccc3cd`…`c9970cf`），
在 e2e 批次之前就已放行并提交。`git show --stat 6802278` 里没有任何 `lib/` 文件。

**`next-env.d.ts`** 曾被 Next 自动改写（dev 路径 → build 路径），**已 `git restore` 还原**，
未混入任何提交。它是一处值得记住的小坑：**跑一次 `next build` 就会改它**，
用 `git add -A` 提交时极易被卷进去。

**两次 `git add -A` 的夹带，均已在提交前拦下并纠正**（如实记录）：
1. `docs/debt-prevention-prompt-for-deepseek.md` 曾被卷进护栏提交，**已 `reset --soft` 拆出**、
   改为单独显式 `git add`；
2. `next-env.d.ts` 的构建产物改动，**已还原**。

结论：本批提交全部为显式 `git add <文件列表>`，不再用 `-A`。
