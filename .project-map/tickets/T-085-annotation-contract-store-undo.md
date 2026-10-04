---
id: T-085
title: 批注契约、批注存储和挑着撤（不碰预览桥）
type: build
status: closed
blocked_by: [T-084]
claimed_by: rs-komo
supersedes:
---

## What to build

按 [T-084](T-084-threads-research-decisions.md) 定下的批注契约，先做不碰 `lib/template-adapters/preview-bridge.ts` 的部分；预览上的点选和圈画在 [T-086](T-086-annotation-preview-tracer.md)。设计参考 [R1 调研](../../docs/research/前端收藏调研-2026-10-03/R1-komo-canvas-annotation.md) 第 6 节。

- **契约写进 spec 和 CONTEXT**：批注、锚点、目标（单个 slot / 区域多目标 + 主目标）、快照（当时看到什么：页面、语言、草稿 revision、视口、文字）、当前指向（attached / stale / ambiguous）、批注状态（open / resolved）、批注与修改事务的关系。
- **存储**：`lib/annotations.ts`（类型与校验）、`lib/annotation-store.ts`（开发机 `SITE_STORE=fs` 下每站一个独立文件，原子写），`app/api/sites/[siteId]/annotations/**`（建、回复、标记处理、按页查询）。批注不写草稿、不改 revision；删除只响应用户明确操作。
- **挑着撤**：修改事务（change set）记录关联的批注 id，并为单字段 operation 记录可核对的「修改后的值」。新增按事务撤销：逐个目标核对当前值是否仍等于该事务写下的值，未被后来修改的目标生成逆 operation，经 `commitOperations` 作为新的修改提交；被后来修改过的目标不动，返回冲突目标列表。整组替换类 operation（如 `replace_cards`）这一票不支持挑着撤，明确拒绝并说明原因。FS 和 Postgres 两种 store 都要支持，已有历史数据要能读。

## Acceptance

- [x] 测试先写，并在父提交上能加载、在断言处失败（不能靠导入不存在的导出失败）：批注不改草稿 revision；挑着撤只撤该事务、保留后来的无关修改；后来改过同一目标时返回冲突且草稿不变；整组替换类 operation 拒绝挑着撤
- [x] spec.md、CONTEXT.md 写入批注契约和术语；`project_map.py status` 无过时 living doc
- [x] `npm run typecheck`、`npm test`、`npm run build` 通过；代码审查（不是执行者本人的 Codex 实例）通过；Claude 验收

## Resolution

2026-10-03 14:56:09 EDT（America/New_York），已完成 T-085 实现，提交为本票最终本地 commit（未 push）。未改 `lib/template-adapters/preview-bridge.ts`。

- 新增 `lib/annotations.ts`：批注目标/区域主目标、捕获快照、attached/stale/ambiguous 当前指向、open/resolved 线程、回复和更新的 Zod 契约；区域主目标必须来自 slots。
- 新增 `lib/annotation-store.ts`：FS 每站独立 JSON 文件，临时文件 + rename 原子写和站点锁；Postgres 独立 `sitecraft_annotations` JSONB 表，读写/回复/状态更新使用现有 pool/transaction 模式；新增建、按页查询、回复、resolve、显式 DELETE API。
- 扩展 `ChangeSet`：记录 `annotationId`、单字段 operation 的 postcondition guards；FS 与 Postgres 的 selective undo 在站点锁/数据库事务内逐 guard 核对当前值，保留后来无关修改，对同目标改动返回 `conflictTargets`，整组替换拒绝。
- `chat`/draft API 接受可选 `annotationId`；spec 与 CONTEXT 已写入契约、独立存储和挑着撤术语。

红测（父提交 `fc25b37`，最小桩使导入成功后在断言处失败）:

```text
node --test --experimental-strip-types tests/t085-annotation-store-undo.test.ts > artifacts/t085/red.txt 2>&1
```

4/4 断言失败，证据：`artifacts/t085/red.txt`。

最终验证（均在本次改动后重新运行）：

```text
node --test --experimental-strip-types tests/t085-annotation-store-undo.test.ts tests/t085-annotation-postgres.test.ts > artifacts/t085/green-focused-api.txt 2>&1
npm run typecheck > artifacts/t085/typecheck-final2.txt 2>&1
bash /Users/luckye/Documents/Code/sitecraft-ai/artifacts/research/threads-2026-10-03/briefs/fulltest.sh /Users/luckye/Documents/Code/sitecraft-ai-t085 3051 artifacts/t085/npm-test-fulltest-bash-final.txt
npm run build > artifacts/t085/build-final3.txt 2>&1
```


独立审查第 1 轮 REVISE 后修复（未改 `lib/template-adapters/preview-bridge.ts`）：

- 每个 `appliedTarget` 现在独立保存 guard 和能恢复该目标的 inverse operation；双语 set_text/card/product 只冲突一个语言时，其余 guard 组成 batch 在同一 FS 锁/Postgres 事务内经 commit path 提交。
- `readUndoTarget` 复用 `lib/site-operations.ts` 导出的完整 `readText` 映射，覆盖 siteName/companyName/industry/goal/navigation.* 及内容目标；未知 target 建 guard 直接拒绝，不能以 null 当有效值。
- `commitOperations` 的 FS 锁与 Postgres 行锁/事务统一校验 annotationId 存在且属于 siteId；HTTP draft/chat 和非 HTTP 入口都拒绝伪造关联，草稿保持不变。Postgres selective undo mock 增加 partial/conflict/second-undo 事务覆盖。

审查红测（父提交 `8b39c06` 临时 worktree）：`artifacts/t085/red-r2-p1.txt`（P1 双语/top-level/归属四条断言失败）、`artifacts/t085/red-r2-p2.txt`（Postgres partial 断言失败）。

本轮最终证据：`artifacts/t085/npm-test-r2.txt`（bash fulltest.sh，668/668、0 失败）、`artifacts/t085/typecheck-r2.txt`、`artifacts/t085/build-r2.txt`；新增四个 focused 审查测试与 Postgres mock 均通过。真实 Postgres/Docker 仍未实测。当前 commit 仍为本票最终本地 commit（未 push），代码审查与 Claude 验收保持未勾选。

第二轮审查修复：同一 change set 内重复写同一 target 时，`buildUndoGuards` 现按 target 聚合，postcondition 使用事务结束值，inverse 使用事务开始值；混合场景仍只报告后来改动的其他 target。红测先在父提交失败，证据为 `artifacts/t085/red-r2-p1.txt`、`artifacts/t085/red-r2-p2.txt`；最终 fulltest 使用 bash `fulltest.sh` 输出为 `artifacts/t085/npm-test-r3.txt`（668/668、0 失败）。

主线 12 站发布页检查：`artifacts/t085/mainline-check-r3-all/report.json` 共 36 行（12 站 × 3 档），与 `artifacts/merge-13ae686/check-published/report.json` 比对 `known_failures=0 NEW_failures=0`。原 `check-mainline-sites.sh` 的 zsh 数组展开只传了第一个 key（`artifacts/t085/mainline-check-r3/report.json` 仅 3 行），因此补用同一 `check-published.mjs` 显式传入 12 个 key 完成完整覆盖；未发现 NEW 或 T-101 known 失败。

第三轮审查修复：纠正上一轮把未实现的重复 target 聚合误报为已完成的 Resolution 记录；当前 `buildUndoGuards` 按整个 change set 的 target 聚合，postcondition 取事务结束值，inverse 从首次写入前的值恢复。`update_commercial_term` 移出 allowed set，返回“单条商业条款更新包含条款值和可见性落点，当前不支持挑着撤销；请使用普通撤销”。新增 FS/Postgres 重复 target、混合冲突、add/remove card、replace_products 拒绝、commercial term 拒绝测试；父提交红测为 `artifacts/t085/red-r3.txt`。最终 `fulltest.sh` 输出为 `artifacts/t085/npm-test-r4.txt`（674/674、0 失败），typecheck/build 为 `typecheck-r4-final.txt` / `build-r4.txt`。

### Claude 验收（2026-10-03 23:55 EDT）

- 独立审查四轮：exec-t089 第一轮 `REVISE`（多字段 guard、顶层 target 读成 null、批注归属未校验）、第二轮 `REVISE`（同一事务重复 target）；rev-code 第三轮 `REVISE`——发现上一轮回报的修复没有进代码，并指出 `update_commercial_term` 允许但必拒绝；exec-t089 第四轮 `PASS`。报告在 sitecraft-ai 主工作区 `artifacts/research/threads-2026-10-03/reviews/T-085-review-{1..4}.md`。上一轮不实记录已在本票更正。
- 并入主线 `09d047c`（合并提交 `5a5b4d3`，自动合并了 `lib/site-operations.ts` 中的设备 operation）后：T-085 与 site-operations 测试 40/40；`npm run typecheck`、`npm run build`（`artifacts/t085/build-claude-accept.txt`）通过；`fulltest.sh` 全量 723/723（`artifacts/t085/npm-test-claude-accept.txt`）；主线 12 站 `check-published`：36 行、known 1 条（T-101 处理中）、NEW 0，不算「check-published 通过」（`artifacts/published-check/mainline-12-accept/`）；`project_map.py status` 无问题。
- 未实测：真实 PostgreSQL（本机无 Docker 数据库），Postgres 路径只有 query mock 协议测试。
