# AI 生成运行手册

## 适用范围

本手册用于 SiteCraft AI 内部团队处理自然语言建站和工作台 AI 微调的运行问题。当前链路为：

```text
用户输入 → 意图分析 → 模板匹配 → SiteDraft JSON → SiteOperation 校验
→ revision/CAS 提交 → iframe 预览 → 人工确认 → 发布快照
```

本手册不把模型输出视为可信输入。企业事实、模板槽位、操作类型和目标字段都必须经过服务端校验；未确认事实不得直接进入可发布版本。

## 开关与灰度

功能开关由环境变量解析，默认全部关闭：

| 开关 | 用途 | 当前接入状态 |
|---|---|---|
| `template_matching_v2` | 新版中文语义模板匹配 | 已登记、可观测；核心路由仍需逐项接入 |
| `quality_gate_v1` | 发布前质量门 | 已登记、可观测；发布逻辑已有独立质量检查 |
| `chat_cas_v1` | 工作台 AI 修改的字段级 CAS | 已登记、可观测；CAS 逻辑已有独立实现 |
| `release_v1` | immutable release 与回滚流程 | 已登记、可观测；发布流程已有独立实现 |
| `access_scope_v1` | workspace/actor 权限范围 | 已登记、可观测；strict 权限通过 `SITECRAFT_ACCESS_MODE` 控制 |

这批改动提供统一解析器和 `/api/health` 中的快照，方便部署、灰度和熔断。**不能据此声称所有核心路由已经按开关自动切换。** 在某个模块真正接入开关前，不应仅通过修改环境变量改变该模块行为。

### 配置规则

```env
# 全局启用（逗号分隔）
SITECRAFT_FEATURE_FLAGS=template_matching_v2,quality_gate_v1

# 单项覆盖优先于全局列表；false 可作为紧急熔断
SITECRAFT_FLAG_QUALITY_GATE_V1=false

# 仅对 canary workspace 额外启用
SITECRAFT_CANARY_WORKSPACES=canary-internal
SITECRAFT_CANARY_FLAGS=template_matching_v2,quality_gate_v1
```

解析优先级：逐项 `false` 熔断 > 逐项 `true` > 全局列表 > canary 额外启用 > 默认关闭。未知开关名称和无法识别的布尔值会被忽略，不会意外启用功能。

生产建议：

1. 先设置 `SITECRAFT_ACCESS_MODE=strict`，并确认真实内部网关能够提供不可伪造的访问上下文。当前 strict 实现仍依赖受控请求头，不能单独作为生产身份认证。
2. 只把内部 canary workspace 写入 `SITECRAFT_CANARY_WORKSPACES`。
3. 每次只启用一个功能开关，记录 build revision、workspace、开始时间和负责人。
4. 观察至少一批真实中文样本后再扩大 workspace 范围。
5. 发现质量、权限、时延或数据一致性异常时，优先把对应的 `SITECRAFT_FLAG_<NAME>=false` 作为熔断，然后再调查根因。

## 生成状态与处理动作

| 状态 | 含义 | 操作 |
|---|---|---|
| `analyzing` | 正在解析需求 | 检查 provider 配置和请求是否重复 |
| `generating` | 分阶段生成中 | 查看 SSE 是否持续推进，保留已完成板块 |
| `partial` | 部分板块完成 | 进入工作台补齐缺口，不直接宣称完整初稿 |
| `completed` | 所有必需板块完成 | 先检查质量报告和待确认事实，再考虑发布 |
| `cancelled` | 用户取消或请求中断 | 确认没有新的 commit，允许用户重新发起 |
| `timeout` | 达到最终预算 | 保留已提交内容，记录缺失板块和 provider 时延 |
| `conflict` | revision/CAS 冲突 | 重新读取最新草稿，展示差异后由用户决定 |
| `error` | provider、解析或存储失败 | 不覆盖草稿；根据错误码决定重试或转人工 |

慢请求提示不是成功终态。当前确定性预算为：25 秒慢请求提示、45 秒延长处理提示、75 秒服务端截止、78 秒客户端截止；真实 DeepSeek P50/P95 尚未完成校准，不能把这些数值当成性能达标承诺。

## 首轮排查

1. 请求 `/api/health`，确认 `status`、`deepseek.configured`、`persistence.database` 和 `featureFlags`。
2. 保存请求时间、`requestId`、`taskId`、siteId、workspaceId 和最终 SSE 事件；不要保存 API key、完整企业资料或原始对话。
3. 检查浏览器 Network：是否返回 4xx/5xx、是否重复 POST、SSE 是否有 `done`。
4. 检查草稿 revision：
   - revision 未变化：通常是分析失败、取消或冲突；
   - revision 只增加一次：继续核对是否发生重复提交；
   - revision 增加多次：检查幂等 key、并发标签页和 provider 重试。
5. 检查生成存证中的 `outcome`、`errorCode`、`missingSections` 和 `provenance`。`provenance` 应包含 provider、model、prompt 版本指纹、manifest/template/build revision 和脱敏输入哈希。

## 常见故障处理

### provider 超时或持续慢

- 先确认是否已经进入 `partial` 或 `timeout`，不要重复点击发送造成额外模型调用。
- 保留首屏和已完成板块，进入工作台继续人工修改。
- 记录 `firstEventAt`、`heroCompletedAt`、`coreCompletedAt`、`committedAt` 和 `doneAt`。
- 若多个请求连续超时，关闭对应 canary flag，暂停扩量；不能通过“重复直到成功”掩盖失败。

### revision 冲突

- 不强制覆盖当前草稿。
- 重新读取最新草稿和 revision，比较用户手动修改与 AI 操作的字段级差异。
- 只有用户确认后才重试；高风险操作仍需单独确认。

### SSE 中断、重复或乱序

- 客户端可用 requestId/taskId 重新获取终态；不得重新生成同一请求。
- 服务端应按 route + site + idempotency key 识别重复请求，并重放原始 `done`。
- 没有 `done` 的连接只能标记为未完成，不能显示“生成成功”。

### 质量门阻断发布

- 查看缺失槽位、占位词、语言漂移和未确认事实。
- 进入工作台补充或确认事实，再重新运行质量检查。
- 不要为了发布而关闭质量门；如需临时豁免，必须记录人工批准、范围和回滚点。

## Canary 观察门槛

每个 canary workspace 至少记录：请求数、完整交付率、部分交付率、超时率、P50/P95、重复提交数、revision 冲突数、未经确认事实拦截数和前端 4xx/5xx。

在真实样本证据不足时，以下只能作为停止扩量的信号，不能作为已达标承诺：

- 核心生成流程失败；
- 同一个幂等 key 造成重复 commit；
- revision 冲突覆盖人工内容；
- AI 修改未授权 target；
- 高风险操作无需确认；
- 页面有明显横向溢出或重叠；
- 真实 provider 没有完整时间线。

## 当前未验证项

- 真实 DeepSeek 的 P50/P95、完整交付率、部分交付率和超时率；
- chat/execute 多标签、跨实例幂等和取消后恢复；
- 真实 PostgreSQL provenance 行写入和 chat provenance；
- strict 模式接入真实内部网关签名；
- 最终对抗性 API、Playwright 和安全审查。

在这些项目有新鲜证据前，运行状态只能写“确定性测试通过，真实环境未验证”，不能写“性能达标”或“发布就绪”。
