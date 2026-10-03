---
id: T-070
title: 修改摘要只说实际落到页面上的改动
type: build
status: closed
blocked_by: [T-067]
claimed_by: codex-build
supersedes:
---

## What to build

T-053 遗留：模型的修改摘要有时描述页面上没有的东西，例如把首屏改成左文右图时说「右侧留出图片位」，实际右侧是参数牌。摘要里关于「改了什么」的部分应当从这次 change set 的实际落点生成（改动标记已经这样做），模型的话只用来解释原因，不能描述页面上不存在的元素。

等 T-067 截图打完包再开工。

## Acceptance

- [x] 测试先写、改动前先失败：用上面那个例子（左文右图、没有图片时右侧是参数牌），摘要里不出现图片位一类描述，只说实际换成的布局
- [x] 换布局、改文字、被拒绝、撤销四种情况的摘要都和实际落点一致
- [x] `npm run typecheck`、`npm test`、`npm run build` 通过（563/563）
- [x] 代码审查通过；Claude 验收

## Resolution

- 改动：服务端提交 AI change set 后只用实际 `appliedTargets` 生成历史、改动标记和对话修改摘要；确认卡只用 operation 目标标签生成「将修改：…」；模型 summary 完全不进入用户可见摘要。拒绝保留拒绝理由；工作台撤销/重做用逆/正操作返回的落点生成「已撤销/已重做」摘要。
- 复审 P1 修法：普通聊天的 rejected/no_change/conflict 分支和需求对齐确认的 rejected/no_change/conflict/error 分支，均从终态结果构造 `aiSummary`；applied 用 change set 摘要，拒绝用去重拒绝原因，冲突/错误用明确结果原因，不再把 provider/proposed summary 写入会话或作为后续模型的「AI摘要」。新增普通聊天拒绝、对齐确认冲突的会话回读回归测试。
- 59ms 失败根因与修法：`chat-route-block-layouts` 的 no_change SSE 摘要被新会话拒绝逻辑错误地加了「未修改：」前缀；工作台本身已有状态标签负责显示「未修改」，所以恢复 `done.summary` 为纯去重拒绝原因，同时会话 `aiSummary` 也保存同一纯原因，未放回模型摘要。
- 第三次复审 P1 红测：普通聊天 no-op `set_text` 夹具在 clean b99b96f 上确实把 `CHAT_REJECT_NOOP_MODEL_PROSE_7301` 写进会话，行为级失败保留在 `artifacts/t070/red-rework3-chat-rejected.txt`；当前实现改为终态结果原因并通过回读测试。
- 第三次复审 P2 修法：对齐确认真正 rejected 后持久化纯 `rejectionSummary`，`emitRecordedResult` 重放沿用纯原因，工作台状态标签负责唯一的「未修改：」前缀；新增首次 confirm、重复 confirm 和会话回读回归测试，红测见 `artifacts/t070/red-rework3-rejected-confirm.txt`。
- 测试先写红：原 `red-rework-summary.txt` 仅因新导出不存在而失败，已改名保留为 `artifacts/t070/red-rework-summary-invalid-import.txt`；不依赖新导出的 FS/Postgres 行为测试在 clean b99b96f 临时副本上失败并暴露 ChangeSet.summary 的模型原因，见 `artifacts/t070/red-rework2-store-summary.txt`。旧红测与无效 3034 日志仍分别保留在 `red-summary.txt`、`red-summary-invalid-econnrefused.txt`。
- 改后 focused：T-070 摘要/确认卡 9/9，FS/Postgres 历史回读 1/1，普通聊天拒绝与对齐冲突回读回归通过，相关 provider/alignment/chat/workspace 测试全绿（`artifacts/t070/rework-related-final.txt`、`artifacts/t070/rework-chat-route.txt`）。
- 验证（2026-10-03）：`npm run typecheck`、`npm test`（本次复审修复后 563/563）、`npm run build` 全部通过，证据为 `rework-typecheck-final2.txt`、`rework-npm-test-final2.txt`、`rework-build-final3.txt`。普通聊天/对齐回归单独通过（`rework-chat-route-final2.txt`）。前一提交完整套件的 555/556 与 3034 中断证据仍见 `npm-test-3.txt`、`npm-test-rerun.txt`。
- 浏览器证据已按本次重构重新截图：Chrome for Testing 1440 / 768 / 375 为 `artifacts/t070/rework-workspace-1440.png`、`rework-workspace-768.png`、`rework-workspace-375.png`；living docs 已同步 `docs/project/spec.md`、`CONTEXT.md`。
- 合并后验证（`713b5ee`，2026-10-03 05:46 UTC）：停 3034、删除 `.next` 后 `npm run typecheck` 通过；重启 3034 后全量 `npm test` 596/596、`npm run build` 通过，证据在 `artifacts/merge-713b5ee/typecheck.txt`、`npm-test.txt`、`build.txt`。用 `commitOperations` 复制注塑专家站并依次提交 `products=index`、`services=vertical`、`hero=cover`、`certifications=table`，站点与提交记录见 `artifacts/merge-713b5ee/site-copy.json`；工业基线 `products=index` 被拒绝并保留原因于 `industrial-index-rejection.json`。三家基线站的中英文三档 `check-published` 全通过；复制站因型号索引表缺少 31/34 项资料事实且 1440 宽有“询价” sr-only 溢出而 NO_GO，完整日志/截图在 `artifacts/merge-713b5ee/check-published/`。
- 合并后真实界面证据：对通过 `commitOperations` 复制的注塑副本 `merge713-t070-6863dd36-bfc8-4092-8b4f-d1f78cd5bae3` 只发出一次真实 DeepSeek 请求「首屏换成大标题加参数条」，得到「已更新：首屏布局」；随后点击一次撤销得到「已撤销：首屏布局」。1440/768/375 的修改与撤销截图逐张查看，路径为 `artifacts/merge-713b5ee/t070-ui/applied-{1440,768,375}.png`、`undone-{1440,768,375}.png`，交互状态和模型延迟见 `t070-ui/ui-state.json`。
- 提交：本次重构创建新的本地 T-070 commit（不改写 b99b96f，不推送；最终 SHA 在交接中报告）。

独立审核与验收（2026-10-03 EDT）：Astra（gpt-6-astra）四轮审查，前三轮 NO_GO（模型原因靠关键词黑名单过滤会漏放和误删、确认卡直接显示模型 summary、会话 aiSummary 仍写模型原话、红测只是导入失败、对齐 rejected 重放双前缀），第四轮 PASS（`artifacts/review-astra-t070.md`，候选 `db83fe0`）。合并 `713b5ee` 后全量 596/596、typecheck、build 通过；真实工作台证据 `artifacts/merge-713b5ee/t070-ui/`（真实 DeepSeek 一次，「已更新：首屏布局」、撤销后「已撤销：首屏布局」，三档截图看过）。遗留：撤销/重做那条在工作台显示为「已应用：已撤销：…」，状态前缀叠两层，另开 [T-075](T-075-undo-status-prefix.md)。Claude 验收关闭。
