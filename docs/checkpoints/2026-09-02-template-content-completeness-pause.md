# SiteCraft AI 暂停恢复存档

更新时间：2026-09-02
暂停原因：用户电脑电量不足，计划明天继续；不是技术概念阻塞。

## 任务上下文

当前以 `docs/superpowers/plans/2026-09-02-template-content-completeness.md` 为 Codex 实施基准，从第一性原理修复自然语言建站卡死、真实模板内容不更新、进度缺少流式反馈、模板连锁阻塞、工作台 AI 精修不可靠和真实单文件导出问题。

## 已完成或已落地

- 精确模板内容槽位、内容覆盖分类和模板示例残留检测的本地确定性基础。
- 站点创建时原子持久化初稿，创建后的预览以服务端 draft/revision 为事实源。
- 生成 done 事件覆盖报告、缺失板块清单及并发上限 2、共享截止时间、单 revision 提交的一键补全。
- 工作台 SSE 半包处理、取消、错误原文恢复、滚动阈值、确认框焦点/ESC。
- 只撤销最近一次 AI change set 的对话级撤销及冲突澄清。
- retry helper 已支持最大次数、退避、absolute deadline 和可重试判断，但三个 provider 尚未全部迁移。

## 最近验证证据

- `npm test`：216/216 通过。
- `npm run typecheck`：退出码 0。
- 五组组合 Playwright：25 passed / 14 failed。
- `missing-section-recovery.spec.ts`：通过。

以上是暂停前的最近证据，不得在明天未重新运行时当作新的完成证据。

## 当前根因方向

最高优先级故障不是服务端 draft，而是预览 bridge 回归：`app/api/templates/[templateId]/preview/route.ts` 新增 `visibleTextsBySlot` / `residualDemoSlots` 后，直接打开 preview route 并发送 `sitecraft:content` 也收不到 `sitecraft:applied`。A 修改前 content-source E2E 通过，修改后失败，因此应先捕获运行时 pageerror/console，重点检查约 567-623 行的声明节点遍历、contact 节点和 manifest slot 汇总。

## 明天从这里继续

1. 用聚焦浏览器调试捕获 `template-content-coverage.spec.ts` 的 pageerror/console。
2. 保持 RED 证据，最小修复 bridge，先单跑覆盖 E2E。
3. bridge 绿后重跑 content-source 和 workspace，区分连锁失败与独立缺陷。
4. 消除实时 `.failed` 与终态“待补全”重复表达。
5. 修复 78 秒没有进入 `.generate-error` 的终态。
6. workspace 使用本地 capabilities fallback，iframe 识别失败也允许发送。
7. generate 页面统一 `lib/sse-events.ts`；三个 provider 统一接入 deadline-aware retry。
8. 接入 fact-check/structure-check，完成副语言、sandbox、a11y、DeepSeek 健壮性。
9. fresh 跑单测、typecheck、相关 E2E、diff check、production build。
10. 质量门全绿后，再用东莞恒准紧固件样例走真实建站、工作台精修和 `<10MB` 离线导出。

## 不可破坏的边界

- 不修改 `vendor/`，不自动 commit，不回滚共享工作区已有改动。
- `.project-to-act/` 和交接文档复核区由 Claude/DeepSeek 维护；Codex 只更新实施计划和交接登记。
- 内容质量门未绿前，不启动最终真实公司成品 Task 5。

我是因为用户设备电量不足而暂停任务，明天回来后从 bridge 运行时错误定位继续。
