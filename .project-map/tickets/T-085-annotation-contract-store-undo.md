---
id: T-085
title: 批注契约、批注存储和挑着撤（不碰预览桥）
type: build
status: open
blocked_by: [T-084]
claimed_by:
supersedes:
---

## What to build

按 [T-084](T-084-threads-research-decisions.md) 定下的批注契约，先做不碰 `lib/template-adapters/preview-bridge.ts` 的部分；预览上的点选和圈画在 [T-086](T-086-annotation-preview-tracer.md)。设计参考 [R1 调研](../../docs/research/前端收藏调研-2026-10-03/R1-komo-canvas-annotation.md) 第 6 节。

- **契约写进 spec 和 CONTEXT**：批注、锚点、目标（单个 slot / 区域多目标 + 主目标）、快照（当时看到什么：页面、语言、草稿 revision、视口、文字）、当前指向（attached / stale / ambiguous）、批注状态（open / resolved）、批注与修改事务的关系。
- **存储**：`lib/annotations.ts`（类型与校验）、`lib/annotation-store.ts`（开发机 `SITE_STORE=fs` 下每站一个独立文件，原子写），`app/api/sites/[siteId]/annotations/**`（建、回复、标记处理、按页查询）。批注不写草稿、不改 revision；删除只响应用户明确操作。
- **挑着撤**：修改事务（change set）记录关联的批注 id，并为单字段 operation 记录可核对的「修改后的值」。新增按事务撤销：逐个目标核对当前值是否仍等于该事务写下的值，未被后来修改的目标生成逆 operation，经 `commitOperations` 作为新的修改提交；被后来修改过的目标不动，返回冲突目标列表。整组替换类 operation（如 `replace_cards`）这一票不支持挑着撤，明确拒绝并说明原因。FS 和 Postgres 两种 store 都要支持，已有历史数据要能读。

## Acceptance

- [ ] 测试先写，并在父提交上能加载、在断言处失败（不能靠导入不存在的导出失败）：批注不改草稿 revision；挑着撤只撤该事务、保留后来的无关修改；后来改过同一目标时返回冲突且草稿不变；整组替换类 operation 拒绝挑着撤
- [ ] spec.md、CONTEXT.md 写入批注契约和术语；`project_map.py status` 无过时 living doc
- [ ] `npm run typecheck`、`npm test`、`npm run build` 通过；代码审查（不是执行者本人的 Codex 实例）通过；Claude 验收

## Resolution
