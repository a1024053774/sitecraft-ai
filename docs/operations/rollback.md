# 发布与配置回滚手册

## 回滚原则

SiteCraft AI 的发布版本是 immutable snapshot。回滚不是覆盖历史记录，而是从选定的历史 release 创建一个新的发布版本；因此公开站点始终能追踪当前版本、回滚来源和操作人。

回滚顺序遵循：

```text
停止扩量/关闭异常 flag → 确认当前 release → 选择可用历史 release
→ 执行 rollback API → 检查公开页 → 记录证据 → 再处理根因
```

不要直接修改数据库中的历史 release 内容，也不要把公开页改为读取 mutable draft。

## 事前检查

1. 保存当前 build revision、站点 ID、workspace、当前 release ID 和数据库连接状态。
2. 通过 `/api/sites/{siteId}/releases` 查看 release 历史，确认目标版本存在且属于同一站点/工作区。
3. 确认当前草稿 revision 不会被误当成发布版本。
4. 如果故障来自 AI 生成，先停止 canary 扩量并关闭对应 flag；不要先删除草稿或历史版本。
5. 记录回滚原因和幂等 key，避免重复点击创建多个回滚版本。

## 公开站点内容回滚

请求示例（字段名称以当前 API 为准，值请替换为实际站点和 release）：

```http
POST /api/sites/{siteId}/releases/{releaseId}/rollback
Content-Type: application/json
Idempotency-Key: rollback-{incident-id}

{"reason":"恢复到上一个已验证版本"}
```

预期行为：

- 成功返回新的 release ID 和递增后的 version；
- 原当前版本变为 `superseded`；
- 目标历史内容被复制为新 immutable 快照；
- 相同 workspace、site、release 和幂等 key 的重复请求重放原结果，不重复插入版本；
- 发生 revision 或权限冲突时返回 409/403，不写入新 release。

回滚后必须验证：

1. `/api/sites/{siteId}/releases` 中新版本状态为当前发布版本；
2. `/api/public/{siteKey}` 返回新版本快照，而不是 mutable draft；
3. 公开页 iframe 实际显示目标版本标题、区块和语言；
4. 浏览器控制台无异常，关键资源没有 4xx/5xx；
5. 草稿仍保持原 revision 和内容，未被回滚操作覆盖；
6. 保存 API 响应、HTTP 状态、截图路径和数据库版本记录。

## 配置和功能开关回滚

功能开关变更是可逆配置，不需要数据库迁移：

1. 优先为异常开关设置 `SITECRAFT_FLAG_<FLAG_NAME>=false`，重新部署或重启实例。
2. 从 `SITECRAFT_FEATURE_FLAGS` 中移除该名称，避免后续环境合并时再次启用。
3. 从 `SITECRAFT_CANARY_FLAGS` 中移除对应名称，确认 canary workspace 不再显示为启用。
4. 请求 `/api/health`，保存 `featureFlags` 快照作为熔断证据。
5. 观察至少一个完整请求周期，确认没有新的 provider 调用、重复 commit 或权限异常。

逐项 `false` 的优先级高于全局列表和 canary 配置，可作为紧急熔断。未知名称和非法布尔值会被忽略；修改前应先检查部署配置，避免以拼写错误制造“已关闭”的假象。

## 数据库迁移失败

- 不直接手工删除表或列。
- 停止写入新发布和生成记录，保留当前公开 release。
- 查看迁移命令的原始错误日志和数据库事务状态。
- 如果迁移在事务中失败，确认事务已回滚；如果是幂等 `ADD COLUMN IF NOT EXISTS` 已部分执行，只能重新运行经过审查的迁移。
- 在 schema 恢复前，不能宣称 provenance 或 release 回滚可用。

## 失败与恢复判定

| 现象 | 可执行动作 | 是否允许判定恢复 |
|---|---|---|
| 公开页显示错误版本 | 回滚到最近已验证 release | 公开 API、iframe 和截图均确认后 |
| 草稿被人工误改 | 使用工作区历史/undo，不能用 release 回滚覆盖草稿 | revision 和字段差异核对后 |
| AI 生成质量下降 | 关闭对应 flag，保留已发布 release | canary 指标恢复且失败样本可解释后 |
| provider 持续超时 | 关闭生成扩量，保留部分交付 | 真实时间线和超时率重新验证后 |
| 权限越界 | 立即切到 strict 并关闭访问扩量 | 缺上下文、跨 workspace、viewer 写入均复测通过后 |

## 不可回滚边界

以下情况不能只靠 release rollback 解决，必须阻塞发布并人工处理：

- 已经将虚构企业事实发布给外部用户；
- 数据库发生跨 workspace 或跨用户泄露；
- revision 冲突覆盖了人工内容且没有历史可恢复；
- 密钥或环境变量进入日志、存证或公开页面；
- 迁移破坏了历史 release 或 generation record 的可读性。

这些情况需要保留证据、限制访问、修复数据和轮换凭据；不能用新增一个 release 掩盖数据问题。

## 当前回滚证据与未验证项

已具备确定性和 Playwright 证据：质量门阻断、revision 冲突阻断、版本递增、immutable snapshot、回滚创建新版本、重复 rollback 幂等重放、公开 iframe 显示回滚内容。

仍未完成：PostgreSQL 高并发回滚压测、真实内部网关签名、跨实例幂等、真实 provider 运行时和最终对抗性审查。因此当前手册描述的是可执行流程，不代表所有生产环境故障场景已经验收通过。
