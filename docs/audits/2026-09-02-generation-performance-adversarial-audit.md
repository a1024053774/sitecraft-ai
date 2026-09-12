# 自然语言建站性能与对抗性审计

日期：2026-09-02  
范围：只读代码、Git 历史、开发环境 `generation_records` 与现有测试  
结论状态：发现阻断 30 秒目标的关键路径；本文件不包含生产代码修改

## 1. 结论摘要

当前“正常一次建站 30 秒”的产品目标与服务端预算不一致：

- 中文完整建站正常路径上界约为 `25s 主生成 + 6s 自评 = 31s`，尚未计入意图分析、创建站点、读取草稿和提交。
- 英文完整建站正常路径上界约为 `90s 主生成 + 6s 自评 = 96s`。
- 英文 Batch B 异常后的部分交付路径上界约为 `90s + 8s 恢复 + 6s 自评 = 104s`。
- 非 forge 模板首屏失败后会递归重跑 forge，英文服务端最坏路径可达约 `194s`。
- 客户端虽然在执行链路设置了 45 秒绝对截止，服务端没有消费 `request.signal`，客户端离开后模型调用仍可继续。

真实开发记录与这些上界高度吻合：

| 样本 | 结果 | 耗时 |
|---|---|---:|
| ID 39 | complete | 96,675 ms |
| ID 5 | complete | 96,654 ms |
| ID 49 | partial | 101,586 ms |
| ID 48 / 47 | timeout | 120,025 / 120,017 ms |

当前 17 条 full 记录的面板指标为 P50 50,023 ms、P95 120,025 ms、超时率 35.3%。但这些记录混入自动化 revision conflict，不能当作纯真实用户 SLA。

## 2. 可复核证据

### 2.1 路由与 SSE

- 意图模型调用：`app/api/sites/[siteId]/generate/route.ts:79-139`
- 执行前读取当前草稿：`app/api/sites/[siteId]/generate/route.ts:179-185`
- Batch A/B 生成入口：`app/api/sites/[siteId]/generate/route.ts:197-225`
- 英文整站外层 90 秒预算：`app/api/sites/[siteId]/generate/route.ts:222-224`
- 提交与 done 事件：`app/api/sites/[siteId]/generate/route.ts:232-304`
- 路由没有把 `request.signal` 传入生成器：`app/api/sites/[siteId]/generate/route.ts:69-225`

### 2.2 生成器

- 默认预算：主任务 25 秒、恢复 8 秒、自评 6 秒：`lib/site-generator.ts:154-156`
- Batch A/B 并行：`lib/site-generator.ts:223-245`
- 非 forge 首屏失败后递归重跑 forge：`lib/site-generator.ts:246-258`
- Batch B 整批失败后按板块并行恢复：`lib/site-generator.ts:269-291`
- 自评在主提交关键路径：`lib/site-generator.ts:296-323`
- 自评的 6 秒 deadline 不会终止底层 Promise：`lib/site-generator.ts:186-197`

### 2.3 Provider

- 意图请求最多两次串行尝试：`lib/ai-provider.ts:222-266`
- 意图单次预算：含中文 45 秒、纯英文 90 秒：`lib/ai-provider.ts:243-245`
- 草稿请求最多两次串行尝试：`lib/ai-provider.ts:310-355`
- 英文草稿 provider 单次预算 75 秒：`lib/ai-provider.ts:325-327`
- provider 使用 `response.json()` 等待完整结构化输出，没有 token 流：`lib/ai-provider.ts:336-348`

### 2.4 自评

- 三个及以上操作必触发自评：`lib/ai-self-eval.ts:65-94`
- 首稿通常远超三个操作，因此正常完整建站基本都会多一次模型调用。
- 自评自身请求可运行 30 秒：`lib/ai-self-eval.ts:161-204`
- 外层 6 秒到期后，底层请求仍可能继续约 24 秒，占用连接与模型配额。

### 2.5 客户端

- 创建、读取 revision 和 SSE 共用 45 秒控制器：`app/generate/page.tsx:455-500`
- 客户端解析到 done 后仍等待流关闭：`app/generate/page.tsx:507-520`
- 因此“收到 done 但 SSE 不闭合”会被误报为 45 秒超时。

### 2.6 记录口径

- 当前记录字段：`lib/generation-record.ts:13-53`
- 缺少：`runId`、流量来源、build revision、站点语言、阶段耗时、模型调用数、attempt 数、TTFA、TTFP 和取消原因。
- 至少 ID 40、44、46 是自动化 revision conflict，却进入同一 full 分母。
- 仓库内未发现持久化开发服务日志；本次只能使用实时记录 API。

## 3. 完整模型调用 DAG

```text
用户提交自然语言
  |
  v
I: requestSiteIntent
  |- 正常 1 次 HTTP
  '- 失败时最多第 2 次串行重试
  |
  v
用户确认 -> 创建站点 -> 读取 revision -> execute SSE 首个状态
  |
  +--------------------------+
  |                          |
  v                          v
A: 首屏/元数据            B: about/features/services/products/contact
最多 2 attempts           最多 2 attempts
  |                          |
  +----------- Promise.all --+
              |
       +------+------+
       |             |
   A 失败          B 失败
       |             |
非 forge 时递归       R1..Rn 单板块恢复
完整重跑 forge         最多 5 路并行，每路 8s
       |             |
       +------+------+
              |
              v
      确定性 operation 校验
              |
              v
      E: DeepSeek 自评（通常触发）
      主路径最多等待 6s，底层可继续 30s
              |
              v
          单次 commit
              |
              v
           SSE done
```

### 逻辑调用数

| 路径 | 意图 | execute | 总逻辑模型调用 |
|---|---:|---:|---:|
| 正常 | 1 | A + B + E = 3 | 4 |
| Batch B 失败，5 板块恢复 | 1 | A + B + 5R + E = 8 | 9 |
| 非 forge 的 A 失败，forge 正常 | 1 | A + B + A' + B' + E' = 5 | 6 |
| fallback 后 B' 再失败 | 1 | A + B + A' + B' + 5R + E' = 10 | 11 |

每个 I/A/B/R provider 内部还可能发生两次 HTTP attempt。快速 5xx、429 或 invalid JSON 会让物理 HTTP 调用数接近逻辑调用数的两倍。

## 4. 关键路径

以下仅计算模型/恢复/自评，不含数据库和网络提交的小额开销。

| 路径 | 中文 | 英文 |
|---|---:|---:|
| execute 正常 | `max(A,B) 25 + E 6 = 31s` | `90 + 6 = 96s` |
| B 失败后恢复 | `25 + max(R) 8 + E 6 = 39s` | `90 + 8 + 6 = 104s` |
| A 失败后 forge 正常 | `25 + 31 = 56s` | `90 + 96 = 186s` |
| A 失败，forge 的 B 再失败 | `25 + 39 = 64s` | `90 + 104 = 194s` |

意图分析另计：

- 含中文输入：最多 `2 * 45 = 90s`
- 纯英文输入：最多 `2 * 90 = 180s`

真实用户用中文要求“生成英文官网”时，意图按 45 秒预算判断，execute 却按英文站点使用 90 秒预算。若意图约 39 秒、execute 约 104 秒，总机器时间正好接近用户观察到的 143 秒。

## 5. “以前快、现在慢”的变更归因

### 高置信度

1. 当前未提交改动把英文整站外层从 25 秒放宽到 90 秒。
2. 同一组改动把英文草稿 provider 从 45 秒放宽到 75 秒。
3. 今天的可靠性提交在 Batch B 失败后增加最多 5 个恢复调用，额外关键路径最多 8 秒。
4. 今天的可靠性提交在非 forge 的 A 失败后递归重跑完整 forge 链路，且没有共享剩余预算。

### 中等置信度

1. 自评从 9 月 1 日起给正常首稿固定增加一次模型调用，主路径最多增加 6 秒。
2. A/B 两个请求虽然并行缩短理论时延，但会瞬时占用两个 provider 并发；进入恢复时可瞬时增加到五个。provider 限流时可能形成“并发越高，整体越慢”的反馈环。
3. 结构化输出使用 6000 token 且等待完整 JSON，慢首字节或慢尾部期间没有真实内容级进度。

## 6. 主要发现

### [Critical] 30 秒 SLA 与英文 90 秒预算直接冲突

即使完全无故障，英文 execute 上界也约为 96 秒。应先定义整条请求的绝对预算，再分配给 A、B、恢复和自评，而不是各模块独立累加预算。

### [Critical] 客户端取消没有终止服务端和上游模型

客户端 45 秒后恢复可操作，但服务端可继续运行到 104/194 秒。用户看到“停止”不等于成本和资源停止。

### [High] 降级递归重置完整预算

模板降级是一次新的完整递归调用，未继承已消耗时间。故障路径反而获得正常路径两倍预算。

### [High] 自评 deadline 不取消底层调用

用户不再等待，但上游连接仍存活，连续建站可能堆积后台自评请求。

### [High] SSE done 依赖连接关闭

成功事件已经到达时仍等待 transport EOF；代理、网关或测试桩不关闭连接会把成功变成超时。

### [Medium] 现有运行质量指标被测试流量污染

记录无法区分真实用户、Playwright、手工测试或代码版本。现有交付率/超时率只能表示“当前开发库混合流量”，不能用于发布判断。

### [Medium] SSE 是阶段事件，不是模型流式输出

路由会立即发“正在生成”，但 TTFP 之前必须等待 A 或 B 返回完整 JSON。慢模型期间 UI 只能显示活动状态，无法展示真实内容增量。

## 7. 对抗测试基准公司

所有自动化使用虚构测试公司，禁止使用生产数据：

> 我们是一家位于中国东莞的工业紧固件制造商，主要生产不锈钢螺丝、精密螺栓、螺母和非标定制紧固件，产品面向欧洲和北美采购经理。请创建专业可靠的英文官网，突出质量控制、定制能力、快速报价和全球交付，包含关于、优势、服务、产品和联系板块。

固定期望：

- 公司名：东莞恒准紧固件（测试）
- `siteLanguage=en`
- 5 个内容板块
- 模板主路径分别跑 forge 与一个非 forge 模板

## 8. 自动化对抗矩阵

| 场景 | 假 provider 行为 | 期望 DAG | 必须断言 | 时间门槛 |
|---|---|---|---|---:|
| 正常 | I=2s，A=6s，B=9s，E=1s | I -> A/B -> E | complete；无 missing；正常调用总数 4 | Total P95 ≤30s；execute P95 ≤22s |
| 单板块挂死 | B 快速失败；恢复中 about 永不返回，其余 2s 成功 | A/B -> 5R 并行 -> E | partial；只缺 about；其他板块可用；无串行阻塞 | TTLT ≤40s，绝对 ≤45s |
| 整批异常 | B 两次 5xx/invalid；5R 均成功 | A/B -> 5R -> E | complete 或明确 partial；恢复事件真实；调用数受控 | TTLT ≤40s |
| 模板不可用 | 子例 A：未知 ID；子例 B：非 forge 的 A 失败 | 直接 forge；或一次 fallback | requested/applied/reason 准确；至多一次降级；不重置绝对预算 | TTLT ≤45s |
| 慢首字节 | A/B 20s 后才返回 headers，随后成功 | A/B 仍并行 | TTFA 快；状态不伪造完成；最终 complete | TTFA P95 ≤1.5s；TTFP ≤25s；TTLT ≤30s |
| SSE 不闭合 | 子例 A：2s 发 done 后保持连接；子例 B：不发 done 且保持连接 | transport 故障 | A 必须按 done 完成；B 必须明确超时；不能无限等待 | done→UI ≤500ms；无 done ≤45s |

建议增加一个 P1 并发退化测试：3 个用户同时进入 Batch B 恢复，观察 15 个恢复调用是否触发 provider 限流雪崩。

## 9. 指标定义与验收阈值

统一起点 `T0`：用户点击“用此模板生成站点内容”。

| 指标 | 定义 | 验收 |
|---|---|---:|
| TTFA | T0 到客户端解码首个 execute SSE status | P95 ≤1.5s |
| TTFP | T0 到首个真实板块进入 completed/failed/recovering | P50 ≤8s，P95 ≤12s |
| TTLT | T0 到首个 SSE done，而不是连接 close | 正常 P50 ≤18s，P95 ≤22s |
| NL-TOTAL | 提交自然语言到 done，自动化立即确认，排除人工思考时间 | P95 ≤30s |
| Degraded TTLT | 任一可恢复故障到 complete/partial/error | P95 ≤40s，硬上限 45s |
| Cancel propagation | 客户端 abort 到服务端及上游 provider abort | ≤1s |
| Done render | 收到 done 到终态 UI 可见 | ≤500ms |

质量阈值：

- 正常场景交付率 ≥99%。
- 可恢复场景必须 complete 或 partial，禁止无限 pending。
- 真实 canary 交付率目标 ≥95%，超时率 ≤1%。
- 正常链路逻辑模型调用数固定为 4（含意图），不允许隐藏重试。
- terminal 后不得再出现新的 provider 调用；1 秒后活动 provider 数必须为 0。

## 10. 测试分层

### L1：生成器确定性测试

- 使用 `draftOps` / `selfEval` 注入。
- 使用短预算和可控 Promise 测并发、挂死、恢复、fallback 共享预算。
- 断言结果、missingSections、调用次数、最大并发和 abort。
- 不访问真实 API 或数据库。

现有覆盖：单板块挂死、provider exception、unknown template fallback、selfEval fail-open。  
缺口：共享绝对 deadline、fallback 不重置预算、自评底层取消、调用并发上限。

### L2：Route + 假 OpenAI 兼容服务器

- 启动本地可编程 `/chat/completions` 假服务器。
- 通过独立环境变量把 Next route 指向假服务器。
- 假服务器记录每次请求开始、headers、body 完成、abort、并发峰值。
- 直接读取 SSE，记录 status/done 时间。
- 这是验证 provider 重试、HTTP abort 与 route cancel 的关键层。

### L3：Playwright 真端到端

- 从自然语言输入开始，经过 analyze、确认、创建站点、draft 和 execute。
- 不在浏览器层完全替换 execute SSE，否则无法覆盖服务端 DAG。
- 断言终态 UI、刷新恢复、显式降级、URL、TTFA/TTFP/TTLT。
- desktop 与 390px mobile 各跑故障终态。

### L4：真实模型 canary

- 不进入普通 CI。
- 每日/发布前串行运行 5 次中文、5 次英文，逐日累积至少 30 个样本后计算 P50/P95。
- 使用专用测试租户、专用 `source=canary` 和 build revision。
- 超阈值即停止扩量，不通过“重复直到成功”掩盖失败。

## 11. 观测字段建议

后续实现时，generation record 至少增加：

- `runId`、`source=user|e2e|canary`、`buildRevision`
- `siteLanguage`、`requestedBudgetMs`
- `analyzeMs`、`createMs`、`draftReadMs`
- `ttfaMs`、`ttfpMs`、`ttltMs`
- `batchAMs`、`batchBMs`、`recoveryMs`、`selfEvalWaitMs`、`commitMs`
- `logicalModelCalls`、`httpAttempts`、`peakModelConcurrency`
- `clientAborted`、`providerAborted`、`terminalReason`

指标面板必须默认排除 `source=e2e`，并按 build revision 与站点语言分组。

## 12. 修复优先级建议

1. P0：服务端建立唯一绝对 deadline，并把剩余预算传给 A/B、恢复、fallback 和自评。
2. P0：把 `request.signal` 传播到生成器和 provider；客户端取消后 1 秒内终止上游。
3. P0：客户端收到 done 立即结束，不依赖 SSE close。
4. P1：取消自评底层请求，或把自评移出首次交付关键路径。
5. P1：fallback 只使用剩余预算，不允许递归重置完整预算。
6. P1：记录分阶段 span、调用数、来源和 build revision，隔离自动化流量。
7. P1：在 provider 限流条件下验证恢复并发，必要时限制恢复并发数。
8. P2：如无法安全流式解析结构化 JSON，提供真实心跳和板块级完成事件，不伪造 token 流。

