# SiteCraft AI 综合优化基线

日期：2026-09-03

## 范围

- 目标链路：中文输入、DeepSeek 结构化生成、模板匹配、SiteDraft、AI 对话微调、SSE、模板 iframe、发布入口。
- 本次基线不修改业务生成逻辑，不代表最终对抗性验收通过。
- 工作区已有修改和 vendor 快照保留，不将其归因于本批次。

## 环境

- 项目根目录：`D:/sitecraft-ai`
- 当前分支：`feat/nl-site-generation`
- `.env.local`：存在
- `node_modules`：存在
- PostgreSQL：是否可用由 `e2e/scripts/preflight.mjs` 在实际浏览器验收前确认
- Playwright 测试专用端口：3210；当前配置不复用已有服务

## 新鲜命令证据

| 命令 | 结果 |
|---|---|
| `npm test` | 223/223 通过，退出 0；Node 报 `MODULE_TYPELESS_PACKAGE_JSON` 警告 |
| `npm run build` | Next.js 16.3.1 构建 14 个页面，退出 0 |
| `npm run typecheck` | 退出 0；在构建完成后串行执行 |
| `node --test --experimental-strip-types tests/contract-baseline.test.ts`（红灯） | 退出 1，因夹具模块尚不存在，符合 TDD 预期 |

## 已确认的契约事实

- AI 操作在 `lib/site-operations.ts` 中限制数量并走白名单校验。
- 草稿提交在 `lib/site-store.ts` 中使用 revision 乐观锁。
- 生成和聊天 API 使用 SSE，模板 iframe 通过 `postMessage` 回报应用状态。
- 当前发布入口是公开展示页链接，独立 release 快照和回滚 API 不在现有路由清单中。
- `lib/site-store.ts` 使用固定 workspace 配置，统一 actor/role 权限上下文尚未接入。

## 本批次变更

- 新增 `tests/fixtures/adversarial-inputs.ts` 作为后续后端对抗测试的脱敏输入源。
- 新增 `tests/contract-baseline.test.ts`，确认必需验证类别不会从测试清单中消失。
- Playwright 不再静默复用 3210 上的旧服务。

## 未验证

- 真实 DeepSeek provider 时延和内容质量。
- PostgreSQL 真实发布/回滚流程。
- 多 workspace 权限隔离。
- 完整 Playwright 对抗性场景。
