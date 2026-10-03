---
id: T-086
title: 预览上点选批注，到模型只改这一处、能单独撤销
type: build
status: open
blocked_by: [T-085, T-081]
claimed_by:
supersedes:
---

## What to build

在 [T-085](T-085-annotation-contract-store-undo.md) 的契约和存储上，打通工作台画板的批注全线。T-081 合回主线后再从主线拉分支（两边都改 `preview-bridge.ts`）。

- **预览桥**（`lib/template-adapters/preview-bridge.ts`）：批注模式下显示透明捕获层和悬停描边；点选只命中已声明的 `data-sitecraft-slot`，回报 slot、目标相对矩形、文字快照、视口、语言、revision；拖框回报完整包含在框内的全部 slot。草稿或页面变化后按 slot 唯一查找重新定位：命中 1 个为 attached，0 个为 stale，多于 1 个为 ambiguous，不按文字或顺序猜。
- **iframe 消息**（`components/open-source-template-frame.tsx`）：批注消息带会话标识和类型版本校验，iframe 重载后恢复批注模式。
- **工作台**（`app/workspace/page.tsx` 加新的批注组件）：批注按钮、输入框、当前页批注列表、标记点和脱离状态；1440 侧栏、768 窄侧栏或底部抽屉、375 底部抽屉且默认点选。
- **交给模型**（`lib/ai-provider.ts`）：批注作为不可信的定位上下文传入，模型只返回白名单 operation，经 `commitOperations` 提交；目标 stale 或 ambiguous 时要求用户重新指定，不提交；修改摘要只来自实际落点（T-070）。

## Acceptance

- [ ] 测试先写，并在父提交上能加载、在断言处失败：点中的产品卡在其他产品删除或重排后仍指向原产品；目标消失时显示 stale 且模型不提交；圈中多个目标时未指定主目标不允许修改
- [ ] 端到端（真实 DeepSeek，工作区自己的 dev 端口和 `SITECRAFT_BASE`）：1440 / 768 / 375 各走一次「点产品卡 → 写一句批注 → 模型只改这张卡 → 单独撤销 → 后续改同一处后再撤显示冲突」，截图和批注、修改记录 JSON 存 `artifacts/t086/`，每张截图打开看过
- [ ] spec.md、CONTEXT.md 与实现一致；`npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收

## Resolution
